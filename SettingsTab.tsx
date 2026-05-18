import React, { useState, useEffect } from 'react';
import { ExternalLink, PlusCircle, Trash2, Filter, List, Cloud, Zap, Plus, Copy, Upload } from 'lucide-react';
import { useSettings } from './useSettings';
import { getStorageItem, removeStorageItem, setStorageItem } from './utils/storage';

interface SettingsTabProps {
    settingsHook: ReturnType<typeof useSettings>;
}

// Helper function to generate a random string for PKCE and state
const generateRandomString = (length: number) => {
    const randomBytes = new Uint8Array(length);
    window.crypto.getRandomValues(randomBytes);
    return btoa(String.fromCharCode.apply(null, Array.from(randomBytes)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

const generateCodeChallenge = async (verifier: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(hash))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

type SettingsSubTab = 'dropbox' | 'epg' | 'filters' | 'verification';

const SettingsTab: React.FC<SettingsTabProps> = ({ settingsHook }) => {
    const {
        dropboxAppKey,
        dropboxRefreshToken,
        saveDropboxSettings,
        clearDropboxSettings,
        savedEpgUrls,
        addSavedEpgUrl,
        deleteSavedEpgUrl,
        channelPrefixes,
        channelSuffixes,
        updateChannelPrefixes,
        updateChannelSuffixes,
        resetChannelPrefixesAndSuffixes,
        // Cloudflare Worker settings
        cfVerifyApiUrl,
        cfProxyApiUrl,
        useCfWorker,
        saveCfSettings,
    } = settingsHook;

    const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(() => {
        // Leer directamente de localStorage para evitar el desfase del useEffect de useSettings
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('dropbox_refresh_token') : null;
            return token ? 'epg' : 'dropbox';
        } catch {
            return 'dropbox';
        }
    });
    const [appKey, setAppKey] = useState(dropboxAppKey);
    const [newEpgUrl, setNewEpgUrl] = useState('');
    const xmlFileInputRef = React.useRef<HTMLInputElement>(null);
    const [newEpgName, setNewEpgName] = useState('');
    const [isUploadingXml, setIsUploadingXml] = useState(false);
    const [xmlUploadStatus, setXmlUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    
    // Cloudflare Worker local state
    const [localCfVerifyUrl, setLocalCfVerifyUrl] = useState(cfVerifyApiUrl);
    const [localCfProxyUrl, setLocalCfProxyUrl] = useState(cfProxyApiUrl);
    const [localUseCf, setLocalUseCf] = useState(useCfWorker);

    const SUGGESTED_EPGS = [
        { name: 'David_DobleM', url: 'https://raw.githubusercontent.com/davidmuma/EPG_dobleM/master/guiaiptv.xml' },
        { name: 'Open-EPG.org', url: 'https://www.open-epg.com/generate/A5KxjtxpeF.xml' },
        { name: 'IPTV-EPG', url: 'https://iptv-epg.org/files/epg-es.xml' },
    ];
    const visibleSuggestions = SUGGESTED_EPGS.filter(s => !savedEpgUrls.some(saved => saved.url === s.url));

    const [localPrefixes, setLocalPrefixes] = useState(channelPrefixes.join(', '));
    const [localSuffixes, setLocalSuffixes] = useState(channelSuffixes.join(', '));

    useEffect(() => {
        setAppKey(dropboxAppKey);
    }, [dropboxAppKey]);

    useEffect(() => {
        setLocalPrefixes(channelPrefixes.join(', '));
        setLocalSuffixes(channelSuffixes.join(', '));
    }, [channelPrefixes, channelSuffixes]);

    // Sincronizar estados de Cloudflare Worker
    useEffect(() => {
        setLocalCfVerifyUrl(cfVerifyApiUrl);
        setLocalCfProxyUrl(cfProxyApiUrl);
        setLocalUseCf(useCfWorker);
    }, [cfVerifyApiUrl, cfProxyApiUrl, useCfWorker]);

    useEffect(() => {
        const targetSubTab = getStorageItem('settings_target_subtab');
        if (targetSubTab === 'filters' || targetSubTab === 'epg') {
            setActiveSubTab(targetSubTab as SettingsSubTab);
            removeStorageItem('settings_target_subtab');
        }
    }, []);

    const handleDropboxAuth = async () => {
        if (!appKey) {
            alert('Por favor, ingresa el App Key de Dropbox.');
            return;
        }

        // PKCE: code_verifier debe tener entre 43 y 128 caracteres.
        // 64 bytes aleatorios codificados en base64url resultan en aprox 86 caracteres.
        // Usar 128 bytes resultaba en ~171 caracteres, excediendo el límite de Dropbox.
        const codeVerifier = generateRandomString(64);
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const state = generateRandomString(16);

        setStorageItem('dropbox_code_verifier', codeVerifier);
        setStorageItem('dropbox_auth_state', state);
        setStorageItem('dropbox_temp_app_key', appKey);

        const redirectUri = window.location.origin + '/';
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&code_challenge=${codeChallenge}&code_challenge_method=S256&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&token_access_type=offline`;

        window.location.href = authUrl;
    };

    const handleSaveEpgUrl = () => {
        if (newEpgName && newEpgUrl) {
            addSavedEpgUrl(newEpgName, newEpgUrl);
            setNewEpgName('');
            setNewEpgUrl('');
        }
    };

    const getDropboxAccessToken = async (): Promise<string> => {
        const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: dropboxRefreshToken,
                client_id: dropboxAppKey,
            }),
        });
        if (!tokenRes.ok) throw new Error('No se pudo obtener el token de Dropbox.');
        const tokenData = await tokenRes.json();
        return tokenData.access_token as string;
    };

    const convertDropboxUrl = (url: string): string =>
        url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'dl=1');

    const handleXmlFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        if (!dropboxRefreshToken || !dropboxAppKey) {
            setXmlUploadStatus({ type: 'error', message: 'Debes conectar Dropbox primero para subir archivos XML.' });
            return;
        }

        setIsUploadingXml(true);
        setXmlUploadStatus(null);

        try {
            // Leer contenido del archivo
            const content = await file.text();
            const epgName = file.name.replace(/\.xml$/i, '');
            const uploadPath = `/Fuentes EPG Subidas/${file.name}`;

            // Obtener token de acceso
            const accessToken = await getDropboxAccessToken();

            // Subir archivo a Dropbox
            const uploadRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({
                        path: uploadPath,
                        mode: 'overwrite',
                        autorename: false,
                        mute: false,
                        strict_conflict: false,
                    }),
                    'Content-Type': 'application/octet-stream',
                },
                body: content,
            });

            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`Error al subir a Dropbox: ${uploadRes.status} ${errText}`);
            }

            const uploaded = await uploadRes.json();

            // Crear enlace compartido (o recuperar el existente)
            let sharedUrl = '';
            const shareResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: uploaded.path_display }),
            });

            if (shareResponse.ok) {
                const shareData = await shareResponse.json();
                sharedUrl = convertDropboxUrl(shareData.url);
            } else {
                // Si ya existe un enlace, recuperarlo
                const listLinks = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ path: uploaded.path_display }),
                });
                if (listLinks.ok) {
                    const existing = await listLinks.json();
                    if (existing.links && existing.links.length > 0) {
                        sharedUrl = convertDropboxUrl(existing.links[0].url);
                    }
                }
            }

            if (!sharedUrl) {
                throw new Error('No se pudo generar el enlace compartido de Dropbox.');
            }

            addSavedEpgUrl(epgName, sharedUrl);
            setXmlUploadStatus({ type: 'success', message: `"${epgName}" subido a Dropbox y añadido como fuente EPG.` });
        } catch (err) {
            setXmlUploadStatus({ type: 'error', message: err instanceof Error ? err.message : 'Error desconocido al subir el archivo.' });
        } finally {
            setIsUploadingXml(false);
        }
    };

    const handleSaveFilters = () => {
        const prefixes = localPrefixes.split(',').map(s => s.trim()).filter(Boolean);
        const suffixes = localSuffixes.split(',').map(s => s.trim()).filter(Boolean);
        
        updateChannelPrefixes(prefixes);
        updateChannelSuffixes(suffixes);
        alert('Filtros guardados correctamente');
    };

    const SidebarButton = ({ icon, active, onClick, tooltip }: { icon: React.ReactNode, active: boolean, onClick: () => void, tooltip: string }) => (
        <button
            onClick={onClick}
            className={`p-3 rounded-lg transition-all duration-200 group relative flex items-center justify-center ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            title={tooltip}
        >
            {icon}
        </button>
    );

    return (
        <div className="flex h-[calc(100vh-80px)] bg-gray-900 overflow-hidden">
            {/* --- SIDEBAR --- */}
            <div className="w-16 flex flex-col items-center py-6 bg-gray-800 border-r border-gray-700 gap-4 z-10 shrink-0">
                <SidebarButton 
                    icon={<img src="/Dropbox_Icon.svg" className="w-6 h-6" style={{ filter: activeSubTab !== 'dropbox' ? 'grayscale(100%) brightness(150%)' : '' }} />} 
                    active={activeSubTab === 'dropbox'} 
                    onClick={() => setActiveSubTab('dropbox')}
                    tooltip="Configurar Dropbox" 
                />
                <SidebarButton 
                    icon={<List size={24} />} 
                    active={activeSubTab === 'epg'} 
                    onClick={() => setActiveSubTab('epg')} 
                    tooltip="Fuentes EPG"
                />
                <SidebarButton 
                    icon={<Filter size={24} />} 
                    active={activeSubTab === 'filters'} 
                    onClick={() => setActiveSubTab('filters')} 
                    tooltip="Filtros Smart Search"
                />
                <SidebarButton 
                    icon={<Zap size={24} />} 
                    active={activeSubTab === 'verification'} 
                    onClick={() => setActiveSubTab('verification')} 
                    tooltip="Verificación"
                />
            </div>

            {/* --- CONTENT --- */}
            <div className="flex-1 bg-gray-900 p-6 md:p-10 overflow-y-auto w-full">
                
                {/* 1. DROPBOX */}
                {activeSubTab === 'dropbox' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                        <div className="mb-8 border-b border-gray-800 pb-4">
                            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                <Cloud className="text-blue-500" /> Configuración de Dropbox
                            </h2>
                            <p className="text-gray-400">Conecta tu cuenta para sincronizar tus listas automáticamente.</p>
                        </div>

                        {dropboxRefreshToken ? (
                            <div className="bg-green-900/10 border border-green-900/50 rounded-xl p-8 text-center">
                                <div className="inline-block p-4 rounded-full bg-green-900/20 mb-4">
                                    <Cloud size={48} className="text-green-500" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Conectado Correctamente</h3>
                                <p className="text-gray-400 mb-6">Tu cuenta de Dropbox está vinculada.</p>
                                <button
                                    onClick={clearDropboxSettings}
                                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
                                >
                                    Desconectar
                                </button>
                            </div>
                        ) : (
                            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl">
                                {/* Instrucciones Paso a Paso */}
                                <div className="mb-6 p-4 bg-blue-900/20 border border-blue-900/50 rounded-lg text-sm text-gray-300 space-y-4">
                                    <h4 className="font-bold text-blue-400 mb-2 border-b border-blue-900/30 pb-2">Guía de Conexión (Importante: Configurar Exactamente así)</h4>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <span className="font-bold text-white block mb-1">Paso 1: Crear App</span>
                                            <ol className="list-decimal list-inside space-y-1 ml-2 text-gray-400">
                                                <li>Ve a <a href="https://www.dropbox.com/developers/apps/create" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">Dropbox Developers Console</a>.</li>
                                                <li>Elige API: <strong>Scoped Access</strong>.</li>
                                                <li>Elige Type: <strong className="text-red-400">Full Dropbox</strong> (No "App Folder").</li>
                                                <li>Ponle un nombre único (ej: "M3U_Manager_TuNombre") y crea la App.</li>
                                            </ol>
                                        </div>

                                        <div>
                                            <span className="font-bold text-white block mb-1">Paso 2: Permisos (Permissions Tab)</span>
                                            <p className="text-xs mb-2">Marca TODAS estas casillas y pulsa <strong>Submit</strong> al final:</p>
                                            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500/50 rounded-sm"></div> files.content.read</div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500/50 rounded-sm"></div> files.content.write</div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500/50 rounded-sm"></div> sharing.write</div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500/50 rounded-sm"></div> sharing.read</div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500/50 rounded-sm"></div> files.metadata.read</div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500/50 rounded-sm"></div> files.metadata.write</div>
                                            </div>
                                        </div>

                                        <div>
                                            <span className="font-bold text-white block mb-1">Paso 3: Redirect URI (Settings Tab)</span>
                                            <p className="mb-1">En "OAuth 2" &gt; "Redirect URIs", añade exacta:</p>
                                            <div className="flex items-center gap-2">
                                                <code className="bg-black/50 px-2 py-1 rounded text-xs text-yellow-500 font-mono select-all flex-grow">
                                                    {typeof window !== 'undefined' ? window.location.origin : '...'}
                                                    /
                                                </code>
                                                <span className="text-xs text-gray-500 whitespace-nowrap">&larr; Copiar y "Add"</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-blue-900/30 text-center">
                                         <p className="font-bold text-white animate-pulse">👇 Copia el "App Key" y pégalo aquí 👇</p>
                                    </div>
                                </div>

                                <label className="block text-sm font-medium text-gray-300 mb-2">Dropbox App Key</label>
                                <input
                                    type="text"
                                    value={appKey}
                                    onChange={(e) => setAppKey(e.target.value)}
                                    placeholder="Ingresa tu App Key"
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none mb-6"
                                />
                                <button
                                    onClick={handleDropboxAuth}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <ExternalLink size={18} /> Conectar con Dropbox
                                </button>
                                <p className="text-xs text-center text-gray-500 mt-4">
                                    Necesitarás crear una App en la consola de desarrolladores de Dropbox.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. FUENTES EPG */}
                {activeSubTab === 'epg' && (
                    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
                        <div className="mb-8 border-b border-gray-800 pb-4">
                            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                <List className="text-purple-500" /> Fuentes EPG
                            </h2>
                            <p className="text-gray-400">Añade URLs para cargar datos de guía de programación.</p>
                        </div>

                        {visibleSuggestions.length > 0 && (
                            <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-6 mb-6">
                                <h3 className="font-bold text-blue-400 mb-4 flex items-center gap-2">
                                    <Zap size={18} /> Fuentes Recomendadas
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {visibleSuggestions.map((epg, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
                                            <div className="min-w-0">
                                                <div className="font-bold text-white text-sm">{epg.name}</div>
                                                <div className="text-gray-500 text-xs truncate max-w-[200px]">{epg.url}</div>
                                            </div>
                                            <button
                                                onClick={() => addSavedEpgUrl(epg.name, epg.url)}
                                                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                                                title="Añadir fuente"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
                            <h3 className="font-bold text-white mb-4">Añadir Nueva Fuente</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <input
                                    type="text"
                                    value={newEpgName}
                                    onChange={(e) => setNewEpgName(e.target.value)}
                                    placeholder="Nombre (ej: EPG España)"
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500"
                                />
                                <div className="md:col-span-2 flex gap-2">
                                    <input
                                        type="text"
                                        value={newEpgUrl}
                                        onChange={(e) => setNewEpgUrl(e.target.value)}
                                        placeholder="URL (https://...)"
                                        className="flex-grow bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500"
                                    />
                                    <button
                                        onClick={handleSaveEpgUrl}
                                        disabled={!newEpgName || !newEpgUrl}
                                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white p-2 rounded-lg"
                                        title="Añadir URL"
                                    >
                                        <PlusCircle size={24} />
                                    </button>
                                </div>
                            </div>
                            <div className="border-t border-gray-700 pt-4">
                                <p className="text-sm text-gray-400 mb-3">
                                    O sube un archivo EPG local (.xml) — se guardará en tu Dropbox en la carpeta <span className="text-white font-medium">Fuentes EPG Subidas</span>:
                                </p>
                                <input
                                    ref={xmlFileInputRef}
                                    type="file"
                                    accept=".xml,application/xml,text/xml"
                                    className="hidden"
                                    onChange={handleXmlFileUpload}
                                />
                                <button
                                    onClick={() => xmlFileInputRef.current?.click()}
                                    disabled={isUploadingXml}
                                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                                >
                                    {isUploadingXml
                                        ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Subiendo...</>
                                        : <><Upload size={16} /> Subir archivo .xml a Dropbox</>
                                    }
                                </button>
                                {!dropboxRefreshToken && (
                                    <p className="text-yellow-400 text-xs mt-2">⚠️ Conecta Dropbox primero para usar esta función.</p>
                                )}
                                {xmlUploadStatus && (
                                    <p className={`text-xs mt-2 ${xmlUploadStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                        {xmlUploadStatus.type === 'success' ? '✓' : '✗'} {xmlUploadStatus.message}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-xl">
                            <table className="w-full text-left">
                                <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
                                    <tr>
                                        <th className="px-6 py-4">Nombre</th>
                                        <th className="px-6 py-4">URL</th>
                                        <th className="px-6 py-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {savedEpgUrls.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                                No hay fuentes guardadas
                                            </td>
                                        </tr>
                                    ) : (
                                        savedEpgUrls.map((epg, idx) => (
                                            <tr key={idx} className="hover:bg-gray-700/30 transition-colors">
                                                <td className="px-6 py-4 text-white font-medium">{epg.name}</td>
                                                <td className="px-6 py-4 text-gray-400 text-sm truncate max-w-xs">{epg.url}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => { navigator.clipboard.writeText(epg.url).then(() => {}).catch(() => {}); }}
                                                            className="text-gray-500 hover:text-blue-400 transition-colors"
                                                            title="Copiar URL al portapapeles"
                                                        >
                                                            <Copy size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteSavedEpgUrl(epg.url)}
                                                            className="text-gray-500 hover:text-red-400 transition-colors"
                                                            title="Eliminar fuente"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 3. FILTROS SMART SEARCH */}
                {activeSubTab === 'filters' && (
                    <div id="settings-filtros-busqueda" className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                        <div className="mb-8 border-b border-gray-800 pb-4">
                            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                <Filter className="text-yellow-500" /> Filtros de Búsqueda Inteligente
                            </h2>
                            <p className="text-gray-400">Configura qué textos ignorar al comparar nombres de canales.</p>
                        </div>

                        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Prefijos a ignorar (separados por comas)
                                </label>
                                <textarea
                                    value={localPrefixes}
                                    onChange={(e) => setLocalPrefixes(e.target.value)}
                                    rows={3}
                                    placeholder="Ej: ES|, UK|, (HD), [4K]"
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm font-mono focus:ring-2 focus:ring-yellow-500 outline-none"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Sufijos a ignorar (separados por comas)
                                </label>
                                <textarea
                                    value={localSuffixes}
                                    onChange={(e) => setLocalSuffixes(e.target.value)}
                                    rows={3}
                                    placeholder="Ej: HD, FHD, 4K, HEVC"
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm font-mono focus:ring-2 focus:ring-yellow-500 outline-none"
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={handleSaveFilters}
                                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                                >
                                    Guardar Cambios
                                </button>
                                <button
                                    onClick={resetChannelPrefixesAndSuffixes}
                                    className="px-6 py-3 border border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 rounded-lg transition-colors"
                                >
                                    Restaurar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. VERIFICACIÓN (Cloudflare Workers) */}
                {activeSubTab === 'verification' && (
                    <div id="settings-verificacion" className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                        <div className="mb-8 border-b border-gray-800 pb-4">
                            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                <Zap className="text-yellow-500" /> Configuración de Verificación
                            </h2>
                            <p className="text-gray-400">Usa Cloudflare Workers para verificar canales sin costos de servidor.</p>
                        </div>

                        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl space-y-6">
                            {/* Toggle para usar Cloudflare */}
                            <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                                <div>
                                    <h3 className="text-white font-medium">Usar Cloudflare Workers</h3>
                                    <p className="text-gray-400 text-sm">Gratis hasta 100,000 peticiones/día</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={localUseCf}
                                        onChange={(e) => setLocalUseCf(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* URLs de Cloudflare Worker */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        URL del Worker de Verificación
                                    </label>
                                    <input 
                                        type="text"
                                        value={localCfVerifyUrl}
                                        onChange={(e) => setLocalCfVerifyUrl(e.target.value)}
                                        placeholder="https://tu-worker.workers.dev/verify"
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <p className="text-gray-500 text-xs mt-1">
                                        Endpoint de verificación simple (sin análisis de calidad)
                                    </p>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        URL del Proxy de Streams
                                    </label>
                                    <input 
                                        type="text"
                                        value={localCfProxyUrl}
                                        onChange={(e) => setLocalCfProxyUrl(e.target.value)}
                                        placeholder="https://tu-worker.workers.dev/proxy"
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <p className="text-gray-500 text-xs mt-1">
                                        Proxy para reproducir streams con CORS bloqueado
                                    </p>
                                </div>
                            </div>

                            {/* Botón guardar */}
                            <button
                                onClick={() => {
                                    saveCfSettings(localCfVerifyUrl, localCfProxyUrl, localUseCf);
                                    alert('Configuración guardada correctamente');
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                            >
                                Guardar Configuración
                            </button>

                            {/* Info adicional */}
                            <div className="p-4 bg-blue-900/20 border border-blue-900/50 rounded-lg">
                                <h4 className="text-blue-400 font-medium mb-2">¿Cómo obtener las URLs?</h4>
                                <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                                    <li>Crea una cuenta en <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Cloudflare</a></li>
                                    <li>Instala Wrangler: <code className="bg-gray-800 px-1 rounded">npm install -g wrangler</code></li>
                                    <li>Ejecuta <code className="bg-gray-800 px-1 rounded">wrangler login</code></li>
                                    <li>Despliega los workers desde la carpeta <code className="bg-gray-800 px-1 rounded">cloudflare-worker/</code></li>
                                </ol>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsTab;
