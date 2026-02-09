import React, { useState, useEffect } from 'react';
import { Upload, Download, AlertCircle, Share2, Trash2, Link as LinkIcon, FileText, Settings, RefreshCw, Plus, Cloud, Database, FilePlus, List, Filter, Check, X, CheckSquare, Square, Search } from 'lucide-react';
import { useChannels } from './useChannels';
import { useSettings } from './useSettings';

interface InicioTabProps {
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
    onNavigateToEditor: () => void;
    onNavigateToSettings?: () => void;
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type SubTab = 'load' | 'add-repair' | 'dropbox-lists' | 'repair-lists';

const InicioTab: React.FC<InicioTabProps> = ({ channelsHook, settingsHook, onNavigateToEditor, onNavigateToSettings }) => {
    const {
        url,
        setUrl,
        isLoading,
        error,
        handleFetchUrl,
        handleFileUpload,
    } = channelsHook;

    const { savedUrls, addSavedUrl, dropboxRefreshToken } = settingsHook;
    
    // UI State
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('load');
    
    // Estados base (mantenidos)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    
    // Estados para gestión de listas
    const [medicinaUrl, setMedicinaUrl] = useState('');
    const [isMedicinaLoading, setIsMedicinaLoading] = useState(false);
    const [medicinaError, setMedicinaError] = useState('');
    const [savedMedicinaLists, setSavedMedicinaLists] = useState<Array<{ id: string; name: string; url: string; content?: string }>>([]);
    const [savedDropboxLists, setSavedDropboxLists] = useState<Array<{ id: string; name: string; url: string; addedAt: string }>>([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [triggerLoad, setTriggerLoad] = useState(false);

    // Estados para Preview y Upload (Nueva funcionalidad)
    const [previewContent, setPreviewContent] = useState<{content: string, name: string, groups: string[]} | null>(null);
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');

    // Estados para búsqueda en Dropbox
    const [isSearchingDropbox, setIsSearchingDropbox] = useState(false);
    const [dropboxSearchResults, setDropboxSearchResults] = useState<Array<{name: string, path_lower: string, id: string}>>([]);
    const [showDropboxSearchModal, setShowDropboxSearchModal] = useState(false);

    // --- Effects ---
    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setIsInstallable(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem('medicinaLists');
        if (stored) setSavedMedicinaLists(JSON.parse(stored));

        const storedDropbox = localStorage.getItem('dropboxLists');
        if (storedDropbox) setSavedDropboxLists(JSON.parse(storedDropbox));
    }, []);

    // Auto-load Logic
    useEffect(() => {
        if (triggerLoad && url) {
            handleFetchUrl();
            setTriggerLoad(false);
            setShowSuccessModal(true);
        }
    }, [triggerLoad, url, handleFetchUrl]);

    // --- Dropbox Helpers ---
    const getDropboxAccessToken = async () => {
        const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: settingsHook.dropboxRefreshToken,
                client_id: settingsHook.dropboxAppKey,
            }),
        });

        if (!response.ok) throw new Error('No se pudo obtener el token de acceso de Dropbox.');
        const data = await response.json();
        return data.access_token;
    };

    const handleUploadSelectionToDropbox = async (onlySelectedGroups: boolean) => {
        if (!previewContent || !settingsHook.dropboxRefreshToken) return;

        setIsUploading(true);
        setUploadStatus('Preparando subida...');

        try {
            let contentToUpload = previewContent.content;
            let filename = previewContent.name;

            if (onlySelectedGroups) {
                if (selectedGroups.size === 0) {
                    alert("Selecciona al menos un grupo");
                    setIsUploading(false);
                    return;
                }

                // Filtrar contenido
                setUploadStatus('Filtrando canales...');
                const lines = previewContent.content.split('\n');
                let newContent = ['#EXTM3U'];
                let currentItem: string[] = [];
                let includeCurrent = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith('#EXTINF')) {
                        // Nuevo item, procesar anterior
                        if (includeCurrent && currentItem.length > 0) {
                            newContent.push(...currentItem);
                        }
                        
                        // Reset para nuevo item
                        currentItem = [line];
                        const groupMatch = line.match(/group-title="([^"]*)"/);
                        const group = groupMatch ? groupMatch[1] : 'Sin Grupo';
                        includeCurrent = selectedGroups.has(group);
                    } else if (line.startsWith('#') && !line.startsWith('#EXTM3U')) {
                        // Metadata extra
                        currentItem.push(line);
                    } else if (line.length > 0) {
                        // URL
                        currentItem.push(line);
                        // Fin del item logico (asumiendo formato standard)
                        if (includeCurrent) {
                            newContent.push(...currentItem);
                        }
                        currentItem = [];
                        includeCurrent = false;
                    }
                }
                contentToUpload = newContent.join('\n');
                filename = `${filename}_filtrada.m3u`;
            } else {
                 filename = filename.endsWith('.m3u') ? filename : `${filename}.m3u`;
            }

            setUploadStatus('Obteniendo token...');
            const accessToken = await getDropboxAccessToken();

            setUploadStatus('Subiendo archivo...');
            const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({
                        path: `/${filename}`,
                        mode: 'add',
                        autorename: true,
                        mute: false
                    }),
                    'Content-Type': 'application/octet-stream',
                },
                body: contentToUpload,
            });

            if (!response.ok) throw new Error('Falló la subida a Dropbox');
            
            const data = await response.json();
            
            // Crear link compartido
            setUploadStatus('Generando enlace...');
            const shareResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: data.path_display }),
            });

            let sharedUrl = '';
            if (shareResponse.ok) {
                const shareData = await shareResponse.json();
                sharedUrl = shareData.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'dl=1');
            } else {
                 // Intentar obtener existente
                 const listLinks = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: data.path_display }),
                });
                if(listLinks.ok) {
                    const existing = await listLinks.json();
                     if (existing.links?.length > 0) {
                         sharedUrl = existing.links[0].url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'dl=1');
                     }
                }
            }

            if (sharedUrl) {
                // Guardar en mis listas dropbox
                const newList = {
                    id: Date.now().toString(),
                    name: filename,
                    url: sharedUrl,
                    addedAt: new Date().toISOString()
                };
                const currentDropboxLists = JSON.parse(localStorage.getItem('dropboxLists') || '[]');
                const updated = [...currentDropboxLists, newList];
                setSavedDropboxLists(updated);
                localStorage.setItem('dropboxLists', JSON.stringify(updated));
                alert('¡Subido a Dropbox y añadido a tus listas!');
                setPreviewContent(null); // Reset UI
            } else {
                alert('Subido a Dropbox pero no se pudo generar enlace.');
            }

        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setIsUploading(false);
            setUploadStatus('');
        }
    };

    const handleSearchDropbox = async () => {
        if (!settingsHook.dropboxRefreshToken) {
            alert("Debes conectar tu cuenta de Dropbox en Ajustes primero.");
            if (onNavigateToSettings) onNavigateToSettings();
            return;
        }
        
        setIsSearchingDropbox(true);
        setDropboxSearchResults([]);
        setShowDropboxSearchModal(true);

        try {
            const accessToken = await getDropboxAccessToken();
            
            const response = await fetch('https://api.dropboxapi.com/2/files/search_v2', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: ".m3u", // Busca cualquier cosa con m3u
                    options: {
                        filename_only: true,
                        file_extensions: ['m3u', 'm3u8'],
                        max_results: 20
                    }
                })
            });

            if (!response.ok) throw new Error('Error buscando en Dropbox');
            const data = await response.json();
            
            const files = data.matches.map((match: any) => ({
                name: match.metadata.metadata.name,
                path_lower: match.metadata.metadata.path_lower,
                id: match.metadata.metadata.id
            }));
            
            setDropboxSearchResults(files);

        } catch (e) {
            console.error(e);
            alert('Error buscando lista en Dropbox');
        } finally {
            setIsSearchingDropbox(false);
        }
    };

    const handleAddFromDropboxSearch = async (file: {name: string, path_lower: string, id: string}) => {
         try {
             setIsSearchingDropbox(true);
             const accessToken = await getDropboxAccessToken();
            
            // Generar link compartido para este archivo
            const shareResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: file.path_lower }),
            });

            let sharedUrl = '';
            if (shareResponse.ok) {
                const shareData = await shareResponse.json();
                sharedUrl = shareData.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'dl=1');
            } else {
                 const listLinks = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: file.path_lower }),
                });
                if(listLinks.ok) {
                    const existing = await listLinks.json();
                     if (existing.links?.length > 0) {
                         sharedUrl = existing.links[0].url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'dl=1');
                     }
                }
            }
            
            if (sharedUrl) {
                if (activeSubTab === 'dropbox-lists') {
                    // Añadir a Mis Listas Dropbox
                    const newList = {
                        id: Date.now().toString(),
                        name: file.name,
                        url: sharedUrl,
                        addedAt: new Date().toISOString()
                    };
                    const updated = [...savedDropboxLists, newList];
                    setSavedDropboxLists(updated);
                    localStorage.setItem('dropboxLists', JSON.stringify(updated));
                    alert('Añadida a tus listas principales');
                } else if (activeSubTab === 'repair-lists') {
                     // Añadir a Mis Listas Reparadoras
                     const newList = {
                        id: Date.now().toString(),
                        name: file.name,
                        url: sharedUrl,
                        addedAt: new Date().toISOString(), // Optional for parsing but good context
                        content: '' // No content loaded yet, will load on use
                    };
                    // @ts-ignore - addedAt is extra but harmless
                    const updated = [...savedMedicinaLists, newList];
                    setSavedMedicinaLists(updated);
                    localStorage.setItem('medicinaLists', JSON.stringify(updated));
                    alert('Añadida a tus listas reparadoras');
                }
                
                setShowDropboxSearchModal(false);
            } else {
                alert('No se pudo generar enlace para este archivo');
            }

         } catch (e) {
             alert((e as Error).message);
         } finally {
             setIsSearchingDropbox(false);
         }
    };

    // --- Parsing Helpers ---
    const parseGroups = (content: string) => {
        const groupSet = new Set<string>();
        const lines = content.split('\n');
        lines.forEach(line => {
             const match = line.match(/group-title="([^"]*)"/);
             if (match) groupSet.add(match[1]);
        });
        return Array.from(groupSet).sort();
    };

    // --- Handlers ---

    const loadList = async (item: { url: string; content?: string; name: string }) => {
        if (isLoading) return;

        if (item.url === 'local' && item.content) {
            try {
                const file = new File([item.content], `${item.name}.m3u`, { type: 'text/plain' });
                // @ts-ignore
                await handleFileUpload({ target: { files: [file] } } as any);
                setShowSuccessModal(true);
            } catch (e) {
                console.error("Error cargando lista local", e);
                alert("Error cargando lista local");
            }
        } else {
            selectAndLoad(item.url);
        }
    };

    const selectAndLoad = (u: string) => {
        setUrl(u);
        setTriggerLoad(true);
    };

    const handleMedicinaUrlLoad = async () => {
        if (!medicinaUrl) return;
        setIsMedicinaLoading(true);
        setMedicinaError('');
        try {
            const response = await fetch(medicinaUrl);
            if (!response.ok) throw new Error('Falló descarga');
            const content = await response.text();
            
            let name = 'Lista Reparadora';
             try {
                const urlParts = new URL(medicinaUrl).pathname.split('/');
                const last = urlParts[urlParts.length - 1];
                if (last) name = last;
            } catch (e) {}

            const rawName = prompt('Nombre para lista:', name);
            if (!rawName) return;
            
            name = rawName.replace(/\s+/g, '-');
            const groups = parseGroups(content);
            
            setPreviewContent({ content, name, groups });
            setMedicinaUrl('');
        } catch (e) {
            setMedicinaError('Error al guardar lista. Verifica la URL.');
        } finally {
            setIsMedicinaLoading(false);
        }
    };
    
    const handleMedicinaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsMedicinaLoading(true);
        try {
            const content = await file.text();
            const rawName = prompt('Nombre para esta lista medicina:', file.name.replace(/\.(m3u8?|txt)$/i, ''));
            if (!rawName) return;

            const name = rawName.replace(/\s+/g, '-');
            const groups = parseGroups(content);
            
            setPreviewContent({ content, name, groups });
        } catch (err) {
            setMedicinaError('Error al leer el archivo.');
        } finally {
            setIsMedicinaLoading(false);
            e.target.value = '';
        }
    };

    const handleSavePreviewLocally = () => {
        if (!previewContent) return;
        const newList = {
            id: Date.now().toString(),
            name: previewContent.name,
            url: 'local',
            content: previewContent.content
        };
        const updated = [...savedMedicinaLists, newList];
        setSavedMedicinaLists(updated);
        localStorage.setItem('medicinaLists', JSON.stringify(updated));
        alert('Guardada localmente');
        setPreviewContent(null);
    };

    const handleDeleteList = (type: 'dropbox' | 'medicina', id: string) => {
        if (!confirm('¿Eliminar lista?')) return;
        if (type === 'dropbox') {
            const upd = savedDropboxLists.filter(l => l.id !== id);
            setSavedDropboxLists(upd);
            localStorage.setItem('dropboxLists', JSON.stringify(upd));
        } else {
            const upd = savedMedicinaLists.filter(l => l.id !== id);
            setSavedMedicinaLists(upd);
            localStorage.setItem('medicinaLists', JSON.stringify(upd));
        }
    };

    const handleShare = async (u: string) => {
        try {
            await navigator.clipboard.writeText(u);
            alert('Enlace copiado');
        } catch (e) {
            alert('No se pudo copiar');
        }
    };

    const SidebarButton = ({ icon, active, onClick, tooltip }: { icon: React.ReactNode, active: boolean, onClick: () => void, tooltip: string }) => (
        <button
            onClick={onClick}
            className={`p-3 rounded-lg transition-all duration-200 group relative flex items-center justify-center ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            title={tooltip}
        >
            {icon}
             {/* Tooltip on right */}
        </button>
    );

    return (
        <div className="flex h-[calc(100vh-80px)] bg-gray-900 overflow-hidden">
            {/* --- SIDEBAR --- */}
            <div className="w-16 flex flex-col items-center py-6 bg-gray-800 border-r border-gray-700 gap-4 z-10 shrink-0">
                <SidebarButton 
                    icon={<Download size={24} />} 
                    active={activeSubTab === 'load'} 
                    onClick={() => setActiveSubTab('load')}
                    tooltip="Cargar Listas" 
                />
                <SidebarButton 
                    icon={<FilePlus size={24} />} 
                    active={activeSubTab === 'add-repair'} 
                    onClick={() => setActiveSubTab('add-repair')} 
                    tooltip="Añadir L. Reparadora"
                />
                <SidebarButton 
                    icon={<img src="/Dropbox_Icon.svg" alt="Dropbox" className={`w-6 h-6 transition-opacity ${activeSubTab === 'dropbox-lists' ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`} style={{ filter: (!dropboxRefreshToken && activeSubTab !== 'dropbox-lists') ? 'grayscale(100%)' : '' }} />} 
                    active={activeSubTab === 'dropbox-lists'} 
                    onClick={() => setActiveSubTab('dropbox-lists')} 
                    tooltip="Mis Listas Dropbox"
                />
                <SidebarButton 
                    icon={<List size={24} />} 
                    active={activeSubTab === 'repair-lists'} 
                    onClick={() => setActiveSubTab('repair-lists')} 
                    tooltip="Mis Listas Reparadoras"
                />
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="flex-1 bg-gray-900 p-4 md:p-10 overflow-y-auto w-full">
                
                {/* 1. CARGA (Load Screen) */}
                {activeSubTab === 'load' && (
                    <div className="max-w-3xl mx-auto space-y-4 md:space-y-8 animate-fadeIn pt-10">
                         <div className="mb-6 text-center">
                            <div className="inline-block p-4 rounded-full bg-blue-900/20 mb-4">
                                <Download size={32} className="text-blue-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Cargar Lista Principal</h2>
                            <p className="text-gray-400 text-sm">Desde URL, archivo local o conecta tu Dropbox.</p>
                        </div>

                        {/* Connection Status Card */}
                        <div className={`p-4 md:p-6 rounded-xl border ${dropboxRefreshToken ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/30'} transition-colors`}>
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-lg ${dropboxRefreshToken ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        <img src="/Dropbox_Icon.svg" className="w-8 h-8" style={{ filter: dropboxRefreshToken ? 'none' : 'grayscale(100%)' }} />
                                    </div>
                                    <div>
                                        <h2 className={`font-bold text-lg ${dropboxRefreshToken ? 'text-green-400' : 'text-red-400'}`}>
                                            {dropboxRefreshToken ? 'Conectado a Dropbox' : 'Desconectado'}
                                        </h2>
                                        <p className="text-sm text-gray-400">
                                            {dropboxRefreshToken ? 'Sincronización activa' : 'Conecta para guardar tus listas'}
                                        </p>
                                    </div>
                                </div>
                                {!dropboxRefreshToken && (
                                    <button onClick={onNavigateToSettings} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm">
                                        Conectar ahora
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Load Area */}
                        <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700 shadow-xl">
                            {dropboxRefreshToken && savedDropboxLists.length > 0 && (
                                <div className="mb-6 animate-fadeIn">
                                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                        Tus listas en Dropbox
                                    </label>
                                    <div className="relative group">
                                        <select
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-4 pr-10 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none cursor-pointer hover:bg-gray-800 transition-colors"
                                            onChange={(e) => {
                                                const listId = e.target.value;
                                                const list = savedDropboxLists.find(l => l.id === listId);
                                                if (list) {
                                                    loadList(list);
                                                }
                                            }}
                                            value=""
                                        >
                                            <option value="" disabled>Selecciona una lista para cargar automáticamente...</option>
                                            {savedDropboxLists.map(list => (
                                                <option key={list.id} value={list.id}>
                                                    {list.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500 group-hover:text-blue-400 transition-colors">
                                            <Cloud size={18} />
                                        </div>
                                    </div>
                                    
                                    <div className="relative flex py-5 items-center">
                                        <div className="flex-grow border-t border-gray-700"></div>
                                        <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase tracking-widest">O usa una URL externa</span>
                                        <div className="flex-grow border-t border-gray-700"></div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 mb-8">
                                <div className="relative flex-grow">
                                    <LinkIcon size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                                    <input 
                                        type="text" 
                                        value={url} 
                                        onChange={e => setUrl(e.target.value)}
                                        placeholder="Pegar URL de lista (ej: https://...)"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <button 
                                    onClick={() => handleFetchUrl()}
                                    disabled={isLoading || !url}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isLoading ? <RefreshCw className="animate-spin" size={20} /> : <Download size={20} />}
                                    <span className="hidden sm:inline">Cargar</span>
                                </button>
                            </div>
                            
                            <div className="relative flex py-5 items-center">
                                <div className="flex-grow border-t border-gray-700"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase tracking-widest">O sube un archivo</span>
                                <div className="flex-grow border-t border-gray-700"></div>
                            </div>

                            <div className="flex justify-center">
                                <input id="file-upload-main" type="file" className="hidden" onChange={async (e) => { await handleFileUpload(e); setShowSuccessModal(true); }} accept=".m3u,.m3u8" />
                                <label htmlFor="file-upload-main" className="cursor-pointer group flex flex-col items-center gap-2 p-8 border-2 border-dashed border-gray-700 rounded-xl hover:border-blue-500/50 hover:bg-blue-900/10 transition-all w-full">
                                    <div className="p-4 rounded-full bg-gray-800 group-hover:bg-blue-600 transition-colors">
                                        <Upload size={24} className="text-gray-400 group-hover:text-white" />
                                    </div>
                                    <span className="text-gray-300 font-medium group-hover:text-white">Seleccionar archivo local</span>
                                    <span className="text-gray-500 text-xs">.m3u, .m3u8</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. AÑADIR REPARADORA (Add Repair Screen) */}
                {activeSubTab === 'add-repair' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn pt-10">
                        {previewContent ? (
                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg space-y-6">
                                <div className="text-center border-b border-gray-700 pb-4">
                                    <h3 className="text-xl font-bold text-white mb-1">Previsualización de Lista</h3>
                                    <p className="text-gray-400 text-sm">{previewContent.name}</p>
                                    <div className="mt-2 text-xs bg-gray-900 inline-block px-3 py-1 rounded text-gray-300">
                                        {previewContent.groups.length} grupos detectados
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                              <Filter size={16} className="text-purple-400" />
                                              Filtrar categorías para subir
                                          </label>
                                          <div className="flex gap-2">
                                              <button 
                                                onClick={() => setSelectedGroups(new Set(previewContent.groups))}
                                                className="text-xs text-blue-400 hover:text-blue-300"
                                              >
                                                  Todas
                                              </button>
                                              <button 
                                                onClick={() => setSelectedGroups(new Set())}
                                                className="text-xs text-gray-500 hover:text-gray-300"
                                              >
                                                  Ninguna
                                              </button>
                                          </div>
                                    </div>
                                    
                                    <div className="max-h-60 overflow-y-auto bg-gray-900 rounded p-4 border border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {previewContent.groups.map(group => (
                                            <div key={group} 
                                                 onClick={() => {
                                                     const next = new Set(selectedGroups);
                                                     if (next.has(group)) next.delete(group);
                                                     else next.add(group);
                                                     setSelectedGroups(next);
                                                 }}
                                                 className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selectedGroups.has(group) ? 'bg-purple-900/30 border border-purple-500/30' : 'hover:bg-gray-800 border border-transparent'}`}
                                            >
                                                {selectedGroups.has(group) ? <CheckSquare size={16} className="text-purple-400 shrink-0" /> : <Square size={16} className="text-gray-600 shrink-0" />}
                                                <span className={`text-sm truncate ${selectedGroups.has(group) ? 'text-white' : 'text-gray-400'}`}>{group || 'Sin Grupo'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 border-t border-gray-700 pt-6">
                                    {/* Opciones de Dropbox */}
                                    {settingsHook.dropboxRefreshToken ? (
                                        <div className="grid grid-cols-2 gap-3">
                                             <button
                                                onClick={() => handleUploadSelectionToDropbox(true)}
                                                disabled={isUploading}
                                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                                            >
                                                {isUploading ? <RefreshCw className="animate-spin" size={16} /> : <Filter size={16} />}
                                                Subir Selección
                                            </button>
                                            <button
                                                onClick={() => handleUploadSelectionToDropbox(false)}
                                                disabled={isUploading}
                                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                                            >
                                                {isUploading ? <RefreshCw className="animate-spin" size={16} /> : <Cloud size={16} />}
                                                Subir Completa
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-yellow-900/20 text-yellow-500 text-sm text-center rounded border border-yellow-900/30">
                                            Conecta Dropbox en Ajustes para subir listas
                                        </div>
                                    )}

                                    {/* Opción Local Standard */}
                                    <button
                                        onClick={handleSavePreviewLocally}
                                        disabled={isUploading}
                                        className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        <Database size={16} />
                                        Guardar en Local (Solo PWA)
                                    </button>

                                    {/* Cancelar */}
                                    <button
                                        onClick={() => setPreviewContent(null)}
                                        disabled={isUploading}
                                        className="w-full text-gray-500 hover:text-white py-2 text-xs"
                                    >
                                        Cancelar operación
                                    </button>
                                </div>
                                
                                {uploadStatus && (
                                    <div className="text-center text-sm text-purple-300 animate-pulse">
                                        {uploadStatus}
                                    </div>
                                )}

                            </div>
                        ) : (
                            <>
                                <div className="mb-6 text-center">
                                    <div className="inline-block p-4 rounded-full bg-purple-900/20 mb-4">
                                        <FilePlus size={32} className="text-purple-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">Añadir Lista Reparadora</h2>
                                    <p className="text-gray-400 text-sm">Carga una lista para usarla como fuente de reparación o subirla a tu nube.</p>
                                </div>

                                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Desde URL</label>
                                    <div className="flex gap-2 mb-6">
                                        <input
                                            type="text"
                                            value={medicinaUrl}
                                            onChange={(e) => setMedicinaUrl(e.target.value)}
                                            placeholder="https://proveedor.com/lista.m3u"
                                            className="flex-grow bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-purple-500 focus:border-purple-500"
                                        />
                                        <button
                                            onClick={handleMedicinaUrlLoad}
                                            disabled={isMedicinaLoading || !medicinaUrl}
                                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-md disabled:bg-gray-600"
                                        >
                                            {isMedicinaLoading ? '...' : 'Analizar'}
                                        </button>
                                    </div>

                                    <div className="relative flex py-2 items-center mb-6">
                                        <div className="flex-grow border-t border-gray-700"></div>
                                        <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase">O archivo local</span>
                                        <div className="flex-grow border-t border-gray-700"></div>
                                    </div>
                                    
                                    <div className="flex justify-center">
                                        <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white py-3 px-6 rounded-lg w-full text-center border border-gray-500 border-dashed transition-all">
                                            <span className="flex items-center justify-center gap-2">
                                                <Upload size={18} /> Subir archivo .m3u
                                            </span>
                                            <input type="file" className="hidden" onChange={handleMedicinaFileUpload} accept=".m3u,.m3u8" />
                                        </label>
                                    </div>

                                    {medicinaError && (
                                        <div className="mt-4 p-3 bg-red-900/30 border border-red-900/50 rounded text-red-400 text-sm flex items-center gap-2">
                                            <AlertCircle size={16} /> {medicinaError}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* 3. LISTAS DROPBOX (Dropbox Lists Table) */}
                {activeSubTab === 'dropbox-lists' && (
                    <div className="max-w-4xl mx-auto animate-fadeIn">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                <img src="/Dropbox_Icon.svg" className="w-8 h-8" />
                                Mis Listas de Dropbox
                            </h2>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleSearchDropbox}
                                    disabled={isSearchingDropbox}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-all ${dropboxRefreshToken ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-75'}`}
                                    title={dropboxRefreshToken ? "Buscar archivos .m3u en tu Dropbox" : "Conecta Dropbox para buscar"}
                                >
                                    <Search className="w-4 h-4" /> Buscar en mi Dropbox
                                </button>
                                <span className="bg-blue-900/30 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-900/50">
                                    {savedDropboxLists.length} listas
                                </span>
                            </div>
                        </div>

                        {/* Modal para resultados de búsqueda */}
                        {showDropboxSearchModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                                <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl border border-gray-700">
                                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-xl">
                                        <h3 className="font-bold text-white flex items-center gap-2">
                                            <Cloud size={18} className="text-blue-400" /> Archivos .m3u encontrados
                                        </h3>
                                        <button onClick={() => setShowDropboxSearchModal(false)} className="text-gray-400 hover:text-white">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    
                                    <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                                        {isSearchingDropbox && dropboxSearchResults.length === 0 ? (
                                            <div className="text-center py-8">
                                                <RefreshCw className="animate-spin mb-3 mx-auto text-blue-500" size={24} />
                                                <p className="text-gray-400">Buscando en tu Dropbox...</p>
                                            </div>
                                        ) : dropboxSearchResults.length > 0 ? (
                                            <div className="space-y-2">
                                                {dropboxSearchResults.map(file => (
                                                    <div key={file.id} className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 border border-gray-600/50">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <FileText size={20} className="text-blue-400 flex-shrink-0" />
                                                            <span className="text-sm text-gray-200 truncate">{file.name}</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleAddFromDropboxSearch(file)}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors ml-3 whitespace-nowrap"
                                                        >
                                                            Añadir
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-gray-400">
                                                No se encontraron archivos .m3u
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {savedDropboxLists.length === 0 ? (
                            <div className="text-center py-16 bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-800">
                                <Cloud size={48} className="mx-auto text-gray-600 mb-4" />
                                <p className="text-gray-400">No tienes listas guardadas.</p>
                                <button onClick={() => setActiveSubTab('load')} className="mt-4 text-blue-400 hover:text-blue-300 underline">
                                    Cargar una nueva
                                </button>
                            </div>
                        ) : (
                            <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Nombre de la lista</th>
                                            <th className="px-6 py-4 font-medium hidden sm:table-cell">URL / Origen</th>
                                            <th className="px-6 py-4 font-medium text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {savedDropboxLists.map(list => (
                                            <tr key={list.id} className="hover:bg-gray-700/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <button onClick={() => selectAndLoad(list.url)} className="font-medium text-white hover:text-blue-400 text-left flex items-center gap-3">
                                                        <FileText size={18} className="text-blue-500" />
                                                        {list.name}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-gray-400 text-sm truncate max-w-xs hidden sm:table-cell">
                                                    {list.url}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleShare(list.url)} 
                                                            className="p-2 hover:bg-gray-600 rounded-md text-gray-400 hover:text-white"
                                                            title="Copiar Enlace"
                                                        >
                                                            <Share2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteList('dropbox', list.id)} 
                                                            className="p-2 hover:bg-red-900/30 rounded-md text-gray-400 hover:text-red-400"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. LISTAS REPARADORAS (Repair Lists Table) */}
                {activeSubTab === 'repair-lists' && (
                    <div className="max-w-4xl mx-auto animate-fadeIn">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold flex items-center gap-3 text-purple-400">
                                <Database size={28} />
                                Mis Listas Reparadoras
                            </h2>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleSearchDropbox}
                                    disabled={isSearchingDropbox}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-all ${dropboxRefreshToken ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-75'}`}
                                    title={dropboxRefreshToken ? "Buscar archivos .m3u en tu Dropbox" : "Conecta Dropbox para buscar"}
                                >
                                    <Search className="w-4 h-4" /> Buscar en mi Dropbox
                                </button>
                                <span className="bg-purple-900/30 text-purple-400 px-3 py-1.5 rounded-lg text-sm font-medium border border-purple-900/50">
                                    {savedMedicinaLists.length} listas
                                </span>
                            </div>
                        </div>

                         {/* Reutilizamos el mismo modal para resultados de búsqueda, que ya renderiza si showDropboxSearchModal es true */}

                        {savedMedicinaLists.length === 0 ? (
                            <div className="text-center py-16 bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-800">
                                <FilePlus size={48} className="mx-auto text-gray-600 mb-4" />
                                <p className="text-gray-400">No tienes listas auxiliares guardadas.</p>
                                <button onClick={() => setActiveSubTab('add-repair')} className="mt-4 text-purple-400 hover:text-purple-300 underline">
                                    Añadir una ahora
                                </button>
                            </div>
                        ) : (
                            <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Nombre</th>
                                            <th className="px-6 py-4 font-medium hidden sm:table-cell">Origen</th>
                                            <th className="px-6 py-4 font-medium text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {savedMedicinaLists.map(list => (
                                            <tr key={list.id} className="hover:bg-gray-700/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <button 
                                                        onClick={() => list.url === 'local' && list.content ? loadList(list) : selectAndLoad(list.url)}
                                                        className="font-medium text-white hover:text-purple-400 text-left flex items-center gap-3"
                                                        title="Cargar como lista principal"
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                                        {list.name}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-gray-400 text-sm truncate max-w-xs hidden sm:table-cell">
                                                    {list.url === 'local' ? 'Archivo Local' : list.url}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleDeleteList('medicina', list.id)} 
                                                            className="p-2 hover:bg-red-900/30 rounded-md text-gray-400 hover:text-red-400"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Modal Éxito */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center border border-gray-700 shadow-2xl transform transition-all scale-100">
                        <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Download size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">¡Lista Cargada!</h3>
                        <p className="text-gray-400 mb-6">La lista se ha importado correctamente.</p>
                        <button
                            onClick={() => { setShowSuccessModal(false); onNavigateToEditor(); }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
                        >
                            Ir al Editor
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InicioTab;
