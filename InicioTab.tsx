import React, { useState, useEffect } from 'react';
import { Upload, Download, AlertCircle, Share2, Trash2, Search, Link as LinkIcon, FileText, Settings, RefreshCw, Plus } from 'lucide-react';
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
    
    // Estados base (mantenidos del original)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    
    // Estados para gestión de listas
    const [medicinaUrl, setMedicinaUrl] = useState('');
    const [isMedicinaLoading, setIsMedicinaLoading] = useState(false);
    const [medicinaError, setMedicinaError] = useState('');
    const [savedMedicinaLists, setSavedMedicinaLists] = useState<Array<{ id: string; name: string; url: string; content?: string }>>([]);
    const [savedDropboxLists, setSavedDropboxLists] = useState<Array<{ id: string; name: string; url: string; addedAt: string }>>([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Initial Load
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

    // Handlers (Mantenidos y adaptados)
    const handleInstallClick = async () => {
        if (!deferredPrompt) {
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

    // --- Carga de listas desde barra lateral ---
    const loadList = async (item: { url: string; content?: string; name: string }) => {
        if (isLoading) return;

        if (item.url === 'local' && item.content) {
            // Cargar desde contenido guardado (simular archivo)
            try {
                const file = new File([item.content], `${item.name}.m3u`, { type: 'text/plain' });
                // @ts-ignore - Simulación básica del evento
                await handleFileUpload({ target: { files: [file] } } as any);
                setShowSuccessModal(true);
            } catch (e) {
                console.error("Error cargando lista local", e);
                alert("Error cargando lista local");
            }
        } else {
            // Cargar desde URL: selectAndLoad se encargará del flujo
            selectAndLoad(item.url);
        }
    };
    
    // Auto-load effect logic
    const [triggerLoad, setTriggerLoad] = useState(false);
    useEffect(() => {
        if (triggerLoad && url) {
            handleFetchUrl();
            setTriggerLoad(false);
            setShowSuccessModal(true);
        }
    }, [triggerLoad, url, handleFetchUrl]);

    const selectAndLoad = (u: string) => {
        setUrl(u);
        setTriggerLoad(true);
    };


    // Handlers de gestión de listas (Medicinas, etc)
    const handleMedicinaUrlLoad = async () => {
        if (!medicinaUrl) return;
        setIsMedicinaLoading(true);
        try {
            const response = await fetch(medicinaUrl);
            if (!response.ok) throw new Error('Falló descarga');
            const content = await response.text();
            const rawName = prompt('Nombre para lista:', 'Lista');
            if (!rawName) return;
            const name = rawName.replace(/\s+/g, '-');
            const newList = { id: Date.now().toString(), name, url: medicinaUrl, content };
            const updated = [...savedMedicinaLists, newList];
            setSavedMedicinaLists(updated);
            localStorage.setItem('medicinaLists', JSON.stringify(updated));
            setMedicinaUrl('');
            alert('Guardada OK');
        } catch (e) {
            setMedicinaError('Error al guardar lista');
        } finally {
            setIsMedicinaLoading(false);
        }
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

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] overflow-hidden bg-gray-900 border-t border-gray-800">
            {/* --- COLUMNA IZQUIERDA: MENÚS --- */}
            <div className="w-full md:w-1/3 max-w-sm bg-gray-900 border-r border-gray-800 flex flex-col h-full">
                
                {/* Sección Dropbox */}
                <div className="flex-1 overflow-y-auto border-b border-gray-800 p-4">
                    <div className="flex items-center gap-2 mb-4 text-gray-300">
                        <img src="/Dropbox_Icon.svg" alt="Dropbox" className="w-5 h-5 opacity-80" />
                        <h3 className="font-semibold text-sm uppercase tracking-wider">Mis Listas de Dropbox</h3>
                        <span className="ml-auto text-xs bg-gray-800 px-2 py-1 rounded-full text-gray-500">{savedDropboxLists.length}</span>
                    </div>
                    
                    {savedDropboxLists.length === 0 ? (
                        <div className="text-center py-8 px-4 border-2 border-dashed border-gray-800 rounded-lg">
                            <p className="text-gray-600 text-sm">No tienes listas guardadas.</p>
                            <p className="text-gray-700 text-xs mt-1">Sube una desde la pestaña 'Guardar'</p>
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {savedDropboxLists.map(list => (
                                <li key={list.id} className="group flex items-center justify-between p-2 rounded-md hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => selectAndLoad(list.url)}>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <FileText size={16} className="text-blue-500 flex-shrink-0" />
                                        <span className="text-gray-300 text-sm truncate">{list.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => handleShare(list.url)} className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-gray-700" title="Copiar enlace">
                                            <Share2 size={14} />
                                        </button>
                                        <button onClick={() => handleDeleteList('dropbox', list.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-gray-700" title="Eliminar">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Sección Medicina */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-900/50">
                    <div className="flex items-center gap-2 mb-4 text-gray-300">
                        <img src="/medical-history.png" alt="Medicina" className="w-5 h-5 opacity-80" />
                        <h3 className="font-semibold text-sm uppercase tracking-wider">Listas Medicina</h3>
                        <span className="ml-auto text-xs bg-gray-800 px-2 py-1 rounded-full text-gray-500">{savedMedicinaLists.length}</span>
                    </div>

                    {savedMedicinaLists.length === 0 ? (
                        <div className="text-center py-8 px-4 border-2 border-dashed border-gray-800 rounded-lg">
                            <p className="text-gray-600 text-sm">Sin listas auxiliares.</p>
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {savedMedicinaLists.map(list => (
                                <li key={list.id} className="group flex items-center justify-between p-2 rounded-md hover:bg-gray-800 transition-colors cursor-pointer" 
                                    onClick={() => list.url === 'local' && list.content ? loadList(list) : selectAndLoad(list.url)}>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0"></div>
                                        <span className="text-gray-300 text-sm truncate">{list.name}</span>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => handleDeleteList('medicina', list.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-gray-700">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* --- COLUMNA DERECHA: DASHBOARD --- */}
            <div className="flex-1 bg-gray-900 p-6 md:p-12 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-8">
                    
                    {/* Header */}
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Panel de Control</h1>
                        <p className="text-gray-400">Gestiona tus listas, verifica la conexión y carga contenido.</p>
                    </div>

                    {/* Connection Status Card */}
                    <div className={`p-6 rounded-xl border ${dropboxRefreshToken ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/30'} transition-colors`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-lg ${dropboxRefreshToken ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    <img src="/Dropbox_Icon.svg" className="w-8 h-8" style={{ filter: dropboxRefreshToken ? 'none' : 'grayscale(100%)' }} />
                                </div>
                                <div>
                                    <h2 className={`font-bold text-lg ${dropboxRefreshToken ? 'text-green-400' : 'text-red-400'}`}>
                                        {dropboxRefreshToken ? 'Conectado a Dropbox' : 'Desconectado'}
                                    </h2>
                                    <p className="text-sm text-gray-400">
                                        {dropboxRefreshToken ? 'Sincronización activa y lista para usar.' : 'Conecta tu cuenta para guardar y cargar listas.'}
                                    </p>
                                </div>
                            </div>
                            {!dropboxRefreshToken && (
                                <button onClick={onNavigateToSettings} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                                    Conectar ahora
                                </button>
                            )}
                            {dropboxRefreshToken && (
                                <div className="hidden md:flex items-center gap-2 text-sm text-green-500/80 bg-green-900/20 px-3 py-1 rounded-full">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    Online
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Área de Carga Manual */}
                    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <label className="block text-gray-300 font-medium mb-3">Cargar URL manualmente</label>
                        <div className="flex gap-2 mb-6">
                            <div className="relative flex-grow">
                                <LinkIcon size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                                <input 
                                    type="text" 
                                    value={url} 
                                    onChange={e => setUrl(e.target.value)}
                                    placeholder="https://ejemplo.com/lista.m3u"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>
                            <button 
                                onClick={() => handleFetchUrl()}
                                disabled={isLoading || !url}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <RefreshCw className="animate-spin" size={20} /> : <Download size={20} />}
                                <span className="hidden md:inline">Cargar</span>
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="h-px bg-gray-700 flex-grow"></span>
                            <span>O sube un archivo</span>
                            <span className="h-px bg-gray-700 flex-grow"></span>
                        </div>

                        <div className="mt-6 flex justify-center">
                            <input
                                id="file-upload-main"
                                type="file"
                                className="hidden"
                                onChange={async (e) => { await handleFileUpload(e); setShowSuccessModal(true); }}
                                accept=".m3u,.m3u8"
                            />
                            <label htmlFor="file-upload-main" className="cursor-pointer flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-700 rounded-xl hover:border-gray-500 hover:bg-gray-800 transition-all w-full md:w-2/3">
                                <Upload size={32} className="text-gray-400" />
                                <span className="text-gray-300 font-medium">Click para seleccionar archivo</span>
                                <span className="text-gray-500 text-xs">Soporta .m3u y .m3u8</span>
                            </label>
                        </div>
                    </div>

                    {/* Gestión Rápida (Añadir Medicina) */}
                    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                        <button 
                            onClick={() => {
                                const el = document.getElementById('medicina-panel');
                                if(el) el.classList.toggle('hidden');
                            }}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                        >
                            <Settings size={16} />
                            Gestionar Listas Auxiliares / Medicina
                        </button>
                        
                        <div id="medicina-panel" className="hidden mt-4 pt-4 border-t border-gray-700/50">
                             <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={medicinaUrl}
                                    onChange={(e) => setMedicinaUrl(e.target.value)}
                                    placeholder="URL nueva lista auxiliar..."
                                    className="flex-grow bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-center text-white"
                                />
                                <button
                                    onClick={handleMedicinaUrlLoad}
                                    disabled={isMedicinaLoading || !medicinaUrl}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 rounded text-sm disabled:opacity-50"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Modal Éxito */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center border border-gray-700 shadow-2xl transform transition-all">
                        <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Download size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">¡Lista Cargada!</h3>
                        <p className="text-gray-400 mb-6">La lista se ha importado correctamente al editor.</p>
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
