import React, { useState, useEffect } from 'react';
import { X, Save, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Channel } from './index';

interface ExistingEpgChannel {
    id: string;
    displayName: string;
    iconSrc: string;
    group: string;
}

const LAST_GROUP_KEY = 'saveLogo_lastGroup';

interface SaveLogoModalProps {
    channel: Channel;
    dropboxAppKey: string;
    dropboxRefreshToken: string;
    onClose: () => void;
}

const LOGOS_FOLDER = '/Logos';
const LOGOS_XML_PATH = '/Logos/logos.xml';

type Step = 'form' | 'uploading' | 'success' | 'error';
type Mode = 'new' | 'update';

const SaveLogoModal: React.FC<SaveLogoModalProps> = ({
    channel,
    dropboxAppKey,
    dropboxRefreshToken,
    onClose,
}) => {
    const [mode, setMode] = useState<Mode>('new');
    const [channelId, setChannelId] = useState(channel.tvgId || '');
    const [displayName, setDisplayName] = useState(channel.name || '');
    const [tvgName, setTvgName] = useState(channel.tvgName || '');
    const [groupName, setGroupName] = useState(() => {
        try { return localStorage.getItem(LAST_GROUP_KEY) || ''; } catch { return ''; }
    });
    const [selectedExistingId, setSelectedExistingId] = useState('');
    const [existingChannels, setExistingChannels] = useState<ExistingEpgChannel[]>([]);
    const [existingGroups, setExistingGroups] = useState<string[]>([]);
    const [step, setStep] = useState<Step>('form');
    const [statusMsg, setStatusMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoadingXml, setIsLoadingXml] = useState(false);
    const [resultUrl, setResultUrl] = useState('');

    useEffect(() => {
        if (dropboxRefreshToken) {
            loadExistingXml();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getDropboxAccessToken = async (): Promise<string> => {
        const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: dropboxRefreshToken,
                client_id: dropboxAppKey,
            }),
        });
        if (!response.ok) throw new Error('No se pudo obtener el token de Dropbox');
        const data = await response.json();
        return data.access_token;
    };

    const loadExistingXml = async () => {
        setIsLoadingXml(true);
        try {
            const accessToken = await getDropboxAccessToken();
            const res = await fetch('https://content.dropboxapi.com/2/files/download', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({ path: LOGOS_XML_PATH }),
                },
            });
            if (res.ok) {
                const xmlText = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(xmlText, 'text/xml');
                const channels = Array.from(doc.querySelectorAll('channel')).map(ch => ({
                    id: ch.getAttribute('id') || '',
                    displayName: ch.querySelector('display-name')?.textContent || '',
                    iconSrc: ch.querySelector('icon')?.getAttribute('src') || '',
                    group: ch.getAttribute('group') || '',
                }));
                setExistingChannels(channels);
                const groups = Array.from(new Set(channels.map(ch => ch.group).filter(Boolean)));
                setExistingGroups(groups);
            }
        } catch {
            // El XML no existe todavía — se creará al guardar el primer logo
        } finally {
            setIsLoadingXml(false);
        }
    };

    const downloadLogoBlob = async (url: string): Promise<{ blob: Blob; ext: string }> => {
        let res: Response;
        try {
            res = await fetch(url);
            if (!res.ok) throw new Error('not ok');
        } catch {
            // Si falla por CORS o error de red, intentar via proxy interno
            res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
        }
        if (!res.ok) throw new Error(`No se pudo descargar el logo (${res.status})`);
        const blob = await res.blob();
        const contentType = res.headers.get('content-type') || blob.type || 'image/png';
        let ext = 'png';
        if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
        else if (contentType.includes('svg')) ext = 'svg';
        else if (contentType.includes('webp')) ext = 'webp';
        else if (contentType.includes('gif')) ext = 'gif';
        return { blob, ext };
    };

    const buildXml = (
        existingXml: string | null,
        channelData: {
            id: string;
            displayName: string;
            tvgName: string;
            groupName: string;
            iconSrc: string;
        },
        targetId: string
    ): string => {
        const parser = new DOMParser();
        const serializer = new XMLSerializer();

        let doc: Document;
        if (existingXml && existingXml.trim().startsWith('<')) {
            doc = parser.parseFromString(existingXml, 'text/xml');
            // Comprobar que no hubo error de parseo
            if (doc.querySelector('parsererror')) {
                doc = parser.parseFromString('<?xml version="1.0" encoding="UTF-8"?><tv generator-info-name="PWA M3U Manager"></tv>', 'text/xml');
            }
        } else {
            doc = parser.parseFromString('<?xml version="1.0" encoding="UTF-8"?><tv generator-info-name="PWA M3U Manager"></tv>', 'text/xml');
        }

        const tvEl = doc.querySelector('tv');
        if (!tvEl) throw new Error('XML malformado: falta elemento <tv>');

        // Buscar canal existente por targetId
        const existingEl = Array.from(doc.querySelectorAll('channel')).find(
            ch => ch.getAttribute('id') === targetId
        );

        if (existingEl) {
            // Solo actualizar el src del icono
            const iconEl = existingEl.querySelector('icon');
            if (iconEl) {
                iconEl.setAttribute('src', channelData.iconSrc);
            } else {
                const newIcon = doc.createElement('icon');
                newIcon.setAttribute('src', channelData.iconSrc);
                existingEl.appendChild(newIcon);
            }
        } else {
            // Crear nuevo elemento <channel>
            const channelEl = doc.createElement('channel');
            channelEl.setAttribute('id', channelData.id);

            if (channelData.groupName) {
                channelEl.setAttribute('group', channelData.groupName);
            }

            const displayNameEl = doc.createElement('display-name');
            displayNameEl.setAttribute('lang', 'es');
            displayNameEl.textContent = channelData.displayName;
            channelEl.appendChild(displayNameEl);

            if (channelData.tvgName && channelData.tvgName !== channelData.displayName) {
                const tvgNameEl = doc.createElement('display-name');
                tvgNameEl.textContent = channelData.tvgName;
                channelEl.appendChild(tvgNameEl);
            }

            const iconEl = doc.createElement('icon');
            iconEl.setAttribute('src', channelData.iconSrc);
            channelEl.appendChild(iconEl);

            tvEl.appendChild(channelEl);
        }

        // Serializar eliminando la declaración XML que XMLSerializer puede duplicar
        const serialized = serializer.serializeToString(doc);
        const withoutXmlDecl = serialized.replace(/^<\?xml[^?]*\?>\s*/i, '');
        return `<?xml version="1.0" encoding="UTF-8"?>\n${withoutXmlDecl}`;
    };

    const createSharedLink = async (accessToken: string, path: string): Promise<string> => {
        const shareRes = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path }),
        });

        if (shareRes.ok) {
            const shareData = await shareRes.json();
            return shareData.url
                .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                .replace('dl=0', 'dl=1');
        }

        // Si ya existe el enlace, recuperarlo
        const listRes = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path }),
        });

        if (listRes.ok) {
            const listData = await listRes.json();
            if (listData.links?.length > 0) {
                return listData.links[0].url
                    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                    .replace('dl=0', 'dl=1');
            }
        }

        return '';
    };

    const handleSave = async () => {
        if (!channel.tvgLogo) {
            setErrorMsg('Este canal no tiene URL de logo configurada');
            return;
        }
        if (!dropboxRefreshToken) {
            setErrorMsg('No estás conectado a Dropbox. Configúralo en Ajustes.');
            return;
        }
        if (mode === 'new' && !channelId.trim()) {
            setErrorMsg('El Channel ID es obligatorio');
            return;
        }
        if (mode === 'update' && !selectedExistingId) {
            setErrorMsg('Selecciona un canal existente');
            return;
        }

        setStep('uploading');
        setErrorMsg('');

        try {
            // 1. Obtener token de acceso
            setStatusMsg('Obteniendo acceso a Dropbox...');
            const accessToken = await getDropboxAccessToken();

            // 2. Descargar el logo
            setStatusMsg('Descargando imagen del logo...');
            const { blob: logoBlob, ext: logoExt } = await downloadLogoBlob(channel.tvgLogo);

            // 3. Determinar nombre e ID final
            const finalId = mode === 'update' ? selectedExistingId : channelId.trim();
            const safeId = finalId.replace(/[^a-zA-Z0-9._-]/g, '_');
            const logoFileName = `${safeId}.${logoExt}`;
            const logoPath = `${LOGOS_FOLDER}/${logoFileName}`;

            // 4. Subir imagen del logo a /Logos/
            setStatusMsg(`Subiendo logo a /Logos/${logoFileName}...`);
            const uploadRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({
                        path: logoPath,
                        mode: 'overwrite',
                        autorename: false,
                        mute: false,
                    }),
                    'Content-Type': 'application/octet-stream',
                },
                body: logoBlob,
            });

            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`Error al subir el logo: ${errText}`);
            }

            // 5. Crear enlace compartido de la imagen
            setStatusMsg('Creando enlace del logo...');
            const logoShareUrl = await createSharedLink(accessToken, logoPath);

            // 6. Leer XML existente (si existe)
            setStatusMsg('Leyendo archivo logos.xml...');
            let existingXml: string | null = null;
            const downloadXmlRes = await fetch('https://content.dropboxapi.com/2/files/download', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({ path: LOGOS_XML_PATH }),
                },
            });
            if (downloadXmlRes.ok) {
                existingXml = await downloadXmlRes.text();
            }

            // 7. Construir XML actualizado
            setStatusMsg('Actualizando logos.xml...');
            const newXml = buildXml(
                existingXml,
                {
                    id: finalId,
                    displayName: displayName || channel.name,
                    tvgName: tvgName,
                    groupName: groupName,
                    iconSrc: logoShareUrl || channel.tvgLogo,
                },
                finalId
            );

            // 8. Subir el XML actualizado
            setStatusMsg('Guardando logos.xml en Dropbox...');
            const xmlUploadRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({
                        path: LOGOS_XML_PATH,
                        mode: 'overwrite',
                        autorename: false,
                        mute: false,
                    }),
                    'Content-Type': 'application/octet-stream',
                },
                body: new TextEncoder().encode(newXml),
            });

            if (!xmlUploadRes.ok) {
                const errText = await xmlUploadRes.text();
                throw new Error(`Error al guardar el XML: ${errText}`);
            }

            if (groupName.trim()) {
                try { localStorage.setItem(LAST_GROUP_KEY, groupName.trim()); } catch { /* ignore */ }
            }
            setResultUrl(logoShareUrl || channel.tvgLogo);
            setStep('success');

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            console.error('[SaveLogoModal]', error);
            setErrorMsg(message);
            setStep('error');
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full border border-gray-600 shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Cabecera */}
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Save size={20} className="text-green-400" />
                        Guardar Logo en Dropbox
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Paso: Formulario */}
                {step === 'form' && (
                    <>
                        {/* Vista previa del logo y canal */}
                        <div className="flex items-center gap-3 mb-5 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                            {channel.tvgLogo ? (
                                <img
                                    src={channel.tvgLogo}
                                    alt="logo"
                                    className="h-12 w-auto max-w-[80px] object-contain rounded flex-shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="h-12 w-12 bg-gray-600 rounded flex items-center justify-center flex-shrink-0">
                                    <span className="text-gray-400 text-xs">Sin logo</span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium truncate">{channel.name}</p>
                                {channel.tvgLogo && (
                                    <p className="text-xs text-gray-400 truncate mt-0.5">{channel.tvgLogo}</p>
                                )}
                            </div>
                        </div>

                        {/* Selector de modo */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setMode('new')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                    mode === 'new'
                                        ? 'bg-green-700 text-white border border-green-600'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                                }`}
                            >
                                Nuevo canal
                            </button>
                            <button
                                onClick={() => setMode('update')}
                                disabled={existingChannels.length === 0 && !isLoadingXml}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                    mode === 'update'
                                        ? 'bg-blue-700 text-white border border-blue-600'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                                }`}
                                title={existingChannels.length === 0 ? 'No hay canales en logos.xml todavía' : 'Actualizar logo de un canal ya existente en el XML'}
                            >
                                Actualizar existente
                                {isLoadingXml && (
                                    <span className="ml-1 text-xs opacity-60">(cargando...)</span>
                                )}
                            </button>
                        </div>

                        {/* Selector de canal existente */}
                        {mode === 'update' && (
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
                                    Canal existente en logos.xml
                                </label>
                                <select
                                    value={selectedExistingId}
                                    onChange={(e) => setSelectedExistingId(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">-- Seleccionar canal --</option>
                                    {existingChannels.map(ch => (
                                        <option key={ch.id} value={ch.id}>
                                            {ch.id}{ch.displayName ? ` — ${ch.displayName}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Campos para nuevo canal */}
                        {mode === 'new' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
                                        Channel ID <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={channelId}
                                        onChange={(e) => setChannelId(e.target.value)}
                                        placeholder="ej: canal.es"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-green-500 focus:border-green-500 outline-none"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Identificador único del canal en el EPG
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="Nombre para mostrar"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-green-500 focus:border-green-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
                                        tvg-name
                                    </label>
                                    <input
                                        type="text"
                                        value={tvgName}
                                        onChange={(e) => setTvgName(e.target.value)}
                                        placeholder="Nombre alternativo (tvg-name del M3U)"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-green-500 focus:border-green-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
                                        Grupo / Categoría
                                    </label>
                                    <input
                                        type="text"
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        list="saveLogo-group-suggestions"
                                        placeholder="ej: Deportes, Noticias, Entretenimiento..."
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-green-500 focus:border-green-500 outline-none"
                                    />
                                    {existingGroups.length > 0 && (
                                        <datalist id="saveLogo-group-suggestions">
                                            {existingGroups.map(g => (
                                                <option key={g} value={g} />
                                            ))}
                                        </datalist>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                        {existingGroups.length > 0
                                            ? `${existingGroups.length} categoría${existingGroups.length !== 1 ? 's' : ''} existente${existingGroups.length !== 1 ? 's' : ''} — escribe o selecciona`
                                            : 'Facilita localizar el canal en el XML'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Mensaje de aviso si no hay logo */}
                        {!channel.tvgLogo && (
                            <div className="mt-3 flex items-center gap-2 text-yellow-400 text-sm bg-yellow-900/30 border border-yellow-800 rounded-lg px-3 py-2">
                                <AlertCircle size={16} className="flex-shrink-0" />
                                Este canal no tiene URL de logo. Añade una primero editando la celda.
                            </div>
                        )}

                        {/* Mensaje de aviso si no hay Dropbox */}
                        {!dropboxRefreshToken && (
                            <div className="mt-3 flex items-center gap-2 text-yellow-400 text-sm bg-yellow-900/30 border border-yellow-800 rounded-lg px-3 py-2">
                                <AlertCircle size={16} className="flex-shrink-0" />
                                No estás conectado a Dropbox. Configúralo en la pestaña Configuración.
                            </div>
                        )}

                        {/* Error de validación */}
                        {errorMsg && (
                            <div className="mt-3 flex items-center gap-2 text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
                                <AlertCircle size={16} className="flex-shrink-0" />
                                {errorMsg}
                            </div>
                        )}

                        {/* Botones de acción */}
                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors border border-gray-600"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={
                                    !channel.tvgLogo ||
                                    !dropboxRefreshToken ||
                                    (mode === 'new' && !channelId.trim()) ||
                                    (mode === 'update' && !selectedExistingId)
                                }
                                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-green-700 hover:bg-green-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                <Save size={16} />
                                Guardar Logo
                            </button>
                        </div>
                    </>
                )}

                {/* Paso: Subiendo */}
                {step === 'uploading' && (
                    <div className="text-center py-10">
                        <Loader2 size={44} className="text-green-400 animate-spin mx-auto mb-4" />
                        <p className="text-white font-medium text-base">{statusMsg}</p>
                        <p className="text-sm text-gray-400 mt-2">Por favor, no cierres esta ventana...</p>
                    </div>
                )}

                {/* Paso: Éxito */}
                {step === 'success' && (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center mx-auto mb-4">
                            <Check size={32} className="text-green-400" />
                        </div>
                        <h3 className="text-white font-bold text-lg mb-1">¡Logo guardado!</h3>
                        <p className="text-gray-400 text-sm mb-1">
                            Imagen subida a <code className="text-green-300">{LOGOS_FOLDER}/</code>
                        </p>
                        <p className="text-gray-400 text-sm mb-4">
                            XML actualizado en <code className="text-green-300">logos.xml</code>
                        </p>
                        {resultUrl && (
                            <a
                                href={resultUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:underline break-all block mb-4"
                            >
                                {resultUrl}
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-green-700 hover:bg-green-600 text-white transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                )}

                {/* Paso: Error */}
                {step === 'error' && (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 rounded-full bg-red-900/40 border border-red-700 flex items-center justify-center mx-auto mb-4">
                            <AlertCircle size={32} className="text-red-400" />
                        </div>
                        <h3 className="text-white font-bold text-lg mb-1">Error al guardar</h3>
                        <p className="text-red-300 text-sm mb-4 break-words">{errorMsg}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setStep('form'); setErrorMsg(''); }}
                                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors border border-gray-600"
                            >
                                Volver
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-red-800 hover:bg-red-700 text-white transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SaveLogoModal;
