import React, { useState, useEffect } from 'react';
import { Upload, Download, Smartphone, AlertCircle, Share2, Trash2, Filter, CheckSquare, Square } from 'lucide-react';
import { useChannels } from './useChannels';
import { useSettings } from './useSettings';
import { Channel } from './index';

interface InicioTabProps {
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
    onNavigateToEditor: () => void;
    onNavigateToSettings?: () => void;
}

interface CategoryInfo {
    name: string;
    count: number;
    selected: boolean;
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InicioTab: React.FC<InicioTabProps> = ({ channelsHook, settingsHook, onNavigateToEditor, onNavigateToSettings }) => {
    const {
        url,
        setUrl,
        isLoading,
        error,
        handleFetchUrl,
        handleFileUpload,
    } = channelsHook;

    const { savedUrls, addSavedUrl, dropboxRefreshToken, dropboxAppKey } = settingsHook;
    
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [medicinaUrl, setMedicinaUrl] = useState('');
    const [isMedicinaLoading, setIsMedicinaLoading] = useState(false);
    const [medicinaError, setMedicinaError] = useState('');
    const [savedMedicinaLists, setSavedMedicinaLists] = useState<Array<{ id: string; name: string; url: string }>>([]);
    const [savedDropboxLists, setSavedDropboxLists] = useState<Array<{ id: string; name: string; url: string; addedAt: string }>>([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Estados para el filtrado de listas
    const [filterUrl, setFilterUrl] = useState('');
    const [isFilterLoading, setIsFilterLoading] = useState(false);
    const [filterError, setFilterError] = useState('');
    const [filterChannels, setFilterChannels] = useState<Channel[]>([]);
    const [categories, setCategories] = useState<CategoryInfo[]>([]);
    const [isUploadingFiltered, setIsUploadingFiltered] = useState(false);
    const [uploadFilteredStatus, setUploadFilteredStatus] = useState('');

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    useEffect(() => {
        // Cargar listas medicina guardadas
        const stored = localStorage.getItem('medicinaLists');
        if (stored) {
            setSavedMedicinaLists(JSON.parse(stored));
        }

        // Cargar listas de Dropbox guardadas
        const storedDropbox = localStorage.getItem('dropboxLists');
        if (storedDropbox) {
            setSavedDropboxLists(JSON.parse(storedDropbox));
        }
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            // Si no hay prompt, redirigir a página de instrucciones
            window.open('https://support.google.com/chrome/answer/9658361', '_blank');
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsInstallable(false);
        }
    };

    const handleMedicinaUrlLoad = async () => {
        if (!medicinaUrl) return;

        setIsMedicinaLoading(true);
        setMedicinaError('');

        try {
            const response = await fetch(medicinaUrl);
            if (!response.ok) throw new Error('No se pudo descargar la lista');
            
            const content = await response.text();
            
            // Pedir nombre al usuario
            const rawName = prompt('Nombre para esta lista medicina:', 'Lista Medicina');
            if (!rawName) {
                setIsMedicinaLoading(false);
                return;
            }

            // Reemplazar espacios con guiones medios
            const name = rawName.replace(/\s+/g, '-');

            // Guardar en localStorage
            const newList = {
                id: Date.now().toString(),
                name,
                url: medicinaUrl,
                content
            };

            const updated = [...savedMedicinaLists, newList];
            setSavedMedicinaLists(updated);
            localStorage.setItem('medicinaLists', JSON.stringify(updated));

            setMedicinaUrl('');
            alert(`Lista "${name}" guardada correctamente`);
        } catch (err) {
            setMedicinaError('Error al descargar la lista. Verifica la URL.');
        } finally {
            setIsMedicinaLoading(false);
        }
    };

    const handleMedicinaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsMedicinaLoading(true);
        setMedicinaError('');

        try {
            const content = await file.text();
            
            // Pedir nombre al usuario
            const rawName = prompt('Nombre para esta lista medicina:', file.name.replace(/\.(m3u8?|txt)$/i, ''));
            if (!rawName) {
                setIsMedicinaLoading(false);
                e.target.value = '';
                return;
            }

            // Reemplazar espacios con guiones medios
            const name = rawName.replace(/\s+/g, '-');

            // Guardar en localStorage
            const newList = {
                id: Date.now().toString(),
                name,
                url: 'local',
                content
            };

            const updated = [...savedMedicinaLists, newList];
            setSavedMedicinaLists(updated);
            localStorage.setItem('medicinaLists', JSON.stringify(updated));

            alert(`Lista "${name}" guardada correctamente`);
        } catch (err) {
            setMedicinaError('Error al leer el archivo.');
        } finally {
            setIsMedicinaLoading(false);
            e.target.value = '';
        }
    };

    const handleDeleteMedicinaList = (id: string) => {
        if (!confirm('¿Eliminar esta lista medicina?')) return;
        
        const updated = savedMedicinaLists.filter(list => list.id !== id);
        setSavedMedicinaLists(updated);
        localStorage.setItem('medicinaLists', JSON.stringify(updated));
    };

    const handleDeleteDropboxList = (id: string) => {
        if (!confirm('¿Eliminar esta lista de Dropbox?')) return;
        
        const updated = savedDropboxLists.filter(list => list.id !== id);
        setSavedDropboxLists(updated);
        localStorage.setItem('dropboxLists', JSON.stringify(updated));
    };

    const handleShareDropboxLink = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            alert('Enlace copiado al portapapeles');
        } catch (error) {
            console.error('Error al copiar enlace:', error);
            alert('No se pudo copiar el enlace');
        }
    };

    const handleUrlLoadWrapper = async () => {
        await handleFetchUrl();
        setShowSuccessModal(true);
    };

    const handleFileUploadWrapper = async (e: React.ChangeEvent<HTMLInputElement>) => {
        await handleFileUpload(e);
        setShowSuccessModal(true);
    };

    const handleModalOk = () => {
        setShowSuccessModal(false);
        onNavigateToEditor();
    };

    // Funciones para filtrado de listas
    const handleLoadFilterUrl = async () => {
        if (!filterUrl) return;

        setIsFilterLoading(true);
        setFilterError('');
        setFilterChannels([]);
        setCategories([]);

        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(filterUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('No se pudo descargar la lista');
            
            const content = await response.text();
            
            // Parsear M3U con Worker
            const worker = new Worker(new URL('./m3u-parser.worker.ts', import.meta.url), {
                type: 'module',
            });

            worker.onmessage = (event) => {
                const { type, channels, message } = event.data;
                if (type === 'success') {
                    setFilterChannels(channels);
                    
                    // Extraer categorías únicas con contadores
                    const categoryMap = new Map<string, number>();
                    channels.forEach((ch: Channel) => {
                        const group = ch.groupTitle || 'Sin Categoría';
                        categoryMap.set(group, (categoryMap.get(group) || 0) + 1);
                    });
                    
                    const categoryList: CategoryInfo[] = Array.from(categoryMap.entries())
                        .map(([name, count]) => ({ name, count, selected: true }))
                        .sort((a, b) => a.name.localeCompare(b.name));
                    
                    setCategories(categoryList);
                } else {
                    setFilterError(message);
                }
                setIsFilterLoading(false);
                worker.terminate();
            };

            worker.onerror = (error) => {
                setFilterError(`Error al parsear: ${error.message}`);
                setIsFilterLoading(false);
                worker.terminate();
            };

            worker.postMessage(content);
        } catch (err) {
            setFilterError('Error al descargar la lista. Verifica la URL.');
            setIsFilterLoading(false);
        }
    };

    const toggleCategory = (categoryName: string) => {
        setCategories(prev =>
            prev.map(cat =>
                cat.name === categoryName ? { ...cat, selected: !cat.selected } : cat
            )
        );
    };

    const toggleAllCategories = () => {
        const allSelected = categories.every(cat => cat.selected);
        setCategories(prev =>
            prev.map(cat => ({ ...cat, selected: !allSelected }))
        );
    };

    const getFilteredChannelCount = () => {
        const selectedCategories = new Set(
            categories.filter(cat => cat.selected).map(cat => cat.name)
        );
        return filterChannels.filter(ch => 
            selectedCategories.has(ch.groupTitle || 'Sin Categoría')
        ).length;
    };

    const generateFilteredM3U = () => {
        const selectedCategories = new Set(
            categories.filter(cat => cat.selected).map(cat => cat.name)
        );
        const filteredChans = filterChannels.filter(ch => 
            selectedCategories.has(ch.groupTitle || 'Sin Categoría')
        );

        let content = '#EXTM3U\n';
        filteredChans.forEach((channel) => {
            let attributes = '';
            if (channel.tvgId) attributes += ` tvg-id="${channel.tvgId}"`;
            if (channel.tvgName) attributes += ` tvg-name="${channel.tvgName}"`;
            if (channel.tvgLogo) attributes += ` tvg-logo="${channel.tvgLogo}"`;
            if (channel.groupTitle) attributes += ` group-title="${channel.groupTitle}"`;
            content += `#EXTINF:-1${attributes},${channel.name}\n${channel.url}\n`;
        });
        return content;
    };

    const extractDomainFromUrl = (url: string): string => {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/\./g, '_');
        } catch {
            return 'unknown';
        }
    };

    const getCurrentDateString = (): string => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        return `${day}_${month}_${year}`;
    };

    const getDropboxAccessToken = async () => {
        const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: dropboxRefreshToken,
                client_id: dropboxAppKey,
            }),
        });

        if (!response.ok) {
            throw new Error('No se pudo obtener el token de acceso de Dropbox');
        }

        const data = await response.json();
        return data.access_token;
    };

    const convertDropboxUrl = (url: string): string => {
        return url
            .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
            .replace('dl=0', 'dl=1');
    };

    const getSharedLink = async (accessToken: string, filePath: string): Promise<string> => {
        try {
            // Intentar crear enlace compartido
            const createResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    path: filePath,
                    settings: {
                        requested_visibility: 'public',
                    }
                }),
            });

            if (createResponse.ok) {
                const data = await createResponse.json();
                return convertDropboxUrl(data.url);
            }

            // Si falla, obtener enlaces existentes
            const listResponse = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    path: filePath,
                }),
            });

            if (listResponse.ok) {
                const data = await listResponse.json();
                if (data.links && data.links.length > 0) {
                    return convertDropboxUrl(data.links[0].url);
                }
            }

            throw new Error('No se pudo crear el enlace compartido');
        } catch (error) {
            console.error('Error getting shared link:', error);
            throw error;
        }
    };

    const handleUploadFilteredToDropbox = async () => {
        if (!dropboxAppKey || !dropboxRefreshToken) {
            setUploadFilteredStatus('Por favor, conecta tu cuenta de Dropbox en Configuración');
            return;
        }

        const selectedCount = getFilteredChannelCount();
        if (selectedCount === 0) {
            setUploadFilteredStatus('Selecciona al menos una categoría');
            return;
        }

        setIsUploadingFiltered(true);
        setUploadFilteredStatus('Generando lista filtrada...');

        try {
            const domain = extractDomainFromUrl(filterUrl);
            const dateStr = getCurrentDateString();
            const fileName = `Repara_${domain}_${dateStr}.m3u`;
            const fileContent = generateFilteredM3U();

            setUploadFilteredStatus('Obteniendo token de Dropbox...');
            const accessToken = await getDropboxAccessToken();

            setUploadFilteredStatus('Subiendo a Dropbox...');
            const filePath = `/${fileName}`;
            const dropboxApiArg = {
                path: filePath,
                mode: 'overwrite',
                autorename: false,
                mute: true,
            };

            const uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify(dropboxApiArg),
                    'Content-Type': 'application/octet-stream',
                },
                body: fileContent,
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error_summary || 'Fallo al subir el archivo');
            }

            setUploadFilteredStatus('Creando enlace compartido...');
            const shareUrl = await getSharedLink(accessToken, filePath);

            // Añadir a lista de medicina guardadas
            const newList = {
                id: Date.now().toString(),
                name: fileName.replace('.m3u', ''),
                url: shareUrl,
            };

            const updatedMedicina = [...savedMedicinaLists, newList];
            setSavedMedicinaLists(updatedMedicina);
            localStorage.setItem('medicinaLists', JSON.stringify(updatedMedicina));

            setUploadFilteredStatus(`✅ ${fileName} subido y añadido a Listas Reparadoras`);
            
            // Limpiar después de 3 segundos
            setTimeout(() => {
                setUploadFilteredStatus('');
                setFilterUrl('');
                setFilterChannels([]);
                setCategories([]);
            }, 3000);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            setUploadFilteredStatus(`❌ Error: ${errorMessage}`);
        } finally {
            setIsUploadingFiltered(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Estado de conexión a Dropbox */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                {dropboxRefreshToken ? (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-green-400 font-semibold">Conectado a Dropbox</span>
                        </div>
                        <img src="/Dropbox_Icon.svg" alt="Dropbox" className="h-5 w-5" />
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-red-400 font-semibold">No conectado a Dropbox</span>
                        </div>
                        <button
                            onClick={() => onNavigateToSettings?.()}
                            className="text-blue-400 hover:text-blue-300 underline text-sm"
                        >
                            Conectar ahora
                        </button>
                    </div>
                )}
            </div>

            {/* Sección principal - Cargar lista */}
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-blue-400 mb-3">Vamos a cargar la lista que quieres gestionar</h2>
                    <p className="text-gray-300 text-sm">
                        Si no tienes ninguna aún en tu Dropbox, puedes cargar una cualquiera que editarás a tu gusto y luego subirás como lista nueva a tu Dropbox.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Campo de texto para URL */}
                    <div>
                        <label htmlFor="inicio-url-input" className="block text-sm font-medium text-gray-300 mb-2">
                            Pega aquí el enlace de tu lista IPTV
                        </label>
                        <div className="flex">
                            <input
                                id="inicio-url-input"
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://dominio...m3u_plus"
                                className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md px-4 py-3 text-white focus:ring-blue-500 focus:border-blue-500"
                            />
                            <button
                                onClick={handleUrlLoadWrapper}
                                disabled={isLoading || !url}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-r-md flex items-center disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
                            >
                                <Download size={20} className="mr-2" /> Cargar
                            </button>
                        </div>
                        {savedDropboxLists.length > 0 && (
                            <div className="mt-3">
                                <select
                                    id="inicio-dropbox-select"
                                    value=""
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setUrl(e.target.value);
                                        }
                                    }}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-3 text-white focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">o selecciona una de tu Dropbox</option>
                                    {savedDropboxLists.map(item => (
                                        <option key={item.id} value={item.url}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Divisor */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-600"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-gray-800 text-gray-400">o</span>
                        </div>
                    </div>

                    {/* Botón de subir archivo */}
                    <div className="text-center">
                        <label
                            htmlFor="inicio-file-upload"
                            className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-md inline-flex items-center transition-colors"
                        >
                            <Upload size={20} className="mr-2" /> Añadir desde archivo .m3u
                        </label>
                        <input
                            id="inicio-file-upload"
                            type="file"
                            className="hidden"
                            onChange={handleFileUploadWrapper}
                            accept=".m3u,.m3u8"
                        />
                    </div>

                    {/* Mensajes de estado */}
                    {isLoading && (
                        <div className="text-center mt-4">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                            <p className="text-blue-400 mt-2">Cargando lista M3U...</p>
                        </div>
                    )}
                    {error && (
                        <div className="text-center mt-4 text-red-400 bg-red-900/50 p-4 rounded-md">
                            {error}
                        </div>
                    )}
                </div>
            </div>

            {/* Sección Filtrar Lista por Categorías */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg border-2 border-purple-500">
                <div className="flex items-center gap-3 mb-4">
                    <Filter className="text-purple-400" size={24} />
                    <h3 className="text-xl font-bold text-purple-400">Filtrar Lista por Categorías</h3>
                </div>
                <p className="text-gray-300 text-sm mb-4">
                    Carga una lista, selecciona las categorías que quieres mantener y súbela directamente a tu Dropbox como lista reparadora.
                </p>

                {/* Paso 1: Cargar URL */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Paso 1: Pega la URL de la lista a filtrar
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={filterUrl}
                            onChange={(e) => setFilterUrl(e.target.value)}
                            placeholder="https://..."
                            className="flex-grow bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-purple-500 focus:border-purple-500"
                        />
                        <button
                            onClick={handleLoadFilterUrl}
                            disabled={isFilterLoading || !filterUrl}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {isFilterLoading ? 'Cargando...' : 'Analizar'}
                        </button>
                    </div>
                </div>

                {isFilterLoading && (
                    <div className="text-center text-purple-400 text-sm mb-4">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400 mb-2"></div>
                        <p>Analizando lista M3U...</p>
                    </div>
                )}

                {filterError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/30 p-3 rounded mb-4">
                        <AlertCircle size={16} />
                        {filterError}
                    </div>
                )}

                {/* Paso 2: Seleccionar Categorías */}
                {categories.length > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">
                                Paso 2: Selecciona las categorías a mantener ({getFilteredChannelCount()} de {filterChannels.length} canales)
                            </label>
                            <button
                                onClick={toggleAllCategories}
                                className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                            >
                                {categories.every(cat => cat.selected) ? (
                                    <>
                                        <Square size={16} /> Deseleccionar todas
                                    </>
                                ) : (
                                    <>
                                        <CheckSquare size={16} /> Seleccionar todas
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="bg-gray-700 rounded-md p-4 max-h-64 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {categories.map((cat) => (
                                    <label
                                        key={cat.name}
                                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-600 p-2 rounded transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={cat.selected}
                                            onChange={() => toggleCategory(cat.name)}
                                            className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                                        />
                                        <span className="text-white text-sm flex-grow truncate">
                                            {cat.name}
                                        </span>
                                        <span className="text-gray-400 text-xs">
                                            ({cat.count})
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Paso 3: Subir a Dropbox */}
                {categories.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Paso 3: Subir lista filtrada a Dropbox
                        </label>
                        <button
                            onClick={handleUploadFilteredToDropbox}
                            disabled={isUploadingFiltered || !dropboxRefreshToken || getFilteredChannelCount() === 0}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            <UploadCloud size={20} />
                            {isUploadingFiltered ? 'Subiendo...' : `Subir ${getFilteredChannelCount()} canales a Dropbox`}
                        </button>
                        {!dropboxRefreshToken && (
                            <p className="text-xs text-yellow-400 mt-2">
                                Conéctate a Dropbox en Configuración para poder subir listas
                            </p>
                        )}
                        {uploadFilteredStatus && (
                            <p className={`mt-3 text-sm ${uploadFilteredStatus.includes('✅') ? 'text-green-400' : uploadFilteredStatus.includes('❌') ? 'text-red-400' : 'text-yellow-300'}`}>
                                {uploadFilteredStatus}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Sección Añadir Lista Reparadora */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-purple-400 mb-4">Añadir nueva lista reparadora</h3>
                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        value={medicinaUrl}
                        onChange={(e) => setMedicinaUrl(e.target.value)}
                        placeholder="URL de la lista medicina..."
                        className="flex-grow bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-purple-500 focus:border-purple-500"
                    />
                    <button
                        onClick={handleMedicinaUrlLoad}
                        disabled={isMedicinaLoading || !medicinaUrl}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        Guardar
                    </button>
                    <label
                        htmlFor="medicina-file-upload"
                        className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md inline-flex items-center whitespace-nowrap"
                    >
                        <Upload size={18} className="mr-1" /> Subir M3U
                    </label>
                    <input
                        id="medicina-file-upload"
                        type="file"
                        className="hidden"
                        onChange={handleMedicinaFileUpload}
                        accept=".m3u,.m3u8"
                    />
                </div>
                
                {isMedicinaLoading && (
                    <div className="text-center text-purple-400 text-sm">
                        Guardando lista medicina...
                    </div>
                )}
                {medicinaError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/30 p-2 rounded">
                        <AlertCircle size={16} />
                        {medicinaError}
                    </div>
                )}
            </div>

            {/* Dos columnas: Dropbox y Listas Reparadoras */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Columna Dropbox */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold text-white">Mis Listas de</h3>
                            <img src="/Dropbox_Icon.svg" alt="Dropbox" className="h-6 w-6" />
                            <h3 className="text-lg font-bold text-white">Dropbox</h3>
                        </div>
                        <p className="text-xs text-gray-400">Pulsa compartir para copiar el enlace para tu app de IPTV</p>
                    </div>
                    {savedDropboxLists.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                            <p className="text-sm">No hay listas guardadas</p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {savedDropboxLists.map(list => (
                                <li key={list.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md">
                                    <span className="text-white text-sm truncate flex-grow">{list.name}</span>
                                    <div className="flex items-center gap-2 ml-2">
                                        <button
                                            onClick={() => handleShareDropboxLink(list.url)}
                                            className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                                            title="Compartir enlace"
                                        >
                                            <Share2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteDropboxList(list.id)}
                                            className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Columna Listas Reparadoras */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                        <h3 className="text-lg font-bold text-white">Listas Reparadoras</h3>
                        <img src="/medical-history.png" alt="Medicina" className="h-6 w-6" />
                    </div>
                    {savedMedicinaLists.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                            <p className="text-sm">No hay listas guardadas</p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {savedMedicinaLists.map(list => (
                                <li key={list.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md">
                                    <span className="text-white text-sm truncate flex-grow">{list.name}</span>
                                    <button
                                        onClick={() => handleDeleteMedicinaList(list.id)}
                                        className="text-red-400 hover:text-red-300 text-xs ml-2"
                                    >
                                        Eliminar
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Modal de éxito */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-4 border border-green-500">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-4">Lista cargada exitosamente</h3>
                            <button
                                onClick={handleModalOk}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-md transition-colors"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InicioTab;
