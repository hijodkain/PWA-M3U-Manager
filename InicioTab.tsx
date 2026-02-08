import React, { useState, useEffect } from 'react';
import { Upload, Download, AlertCircle, Share2, Trash2, Link as LinkIcon, FileText, Settings, RefreshCw, Plus, Cloud, Database, FilePlus, List } from 'lucide-react';
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
            
            // Generate basic name if needed
            let name = 'Lista Reparadora';
             try {
                const urlParts = new URL(medicinaUrl).pathname.split('/');
                const last = urlParts[urlParts.length - 1];
                if (last) name = last;
            } catch (e) {}

            const rawName = prompt('Nombre para lista:', name);
            if (!rawName) return;
            
            name = rawName.replace(/\s+/g, '-');
            const newList = { id: Date.now().toString(), name, url: medicinaUrl, content };
            const updated = [...savedMedicinaLists, newList];
            setSavedMedicinaLists(updated);
            localStorage.setItem('medicinaLists', JSON.stringify(updated));
            setMedicinaUrl('');
            alert('Guardada OK');
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
            const newList = {
                id: Date.now().toString(),
                name,
                url: 'local',
                content
            };
            const updated = [...savedMedicinaLists, newList];
            setSavedMedicinaLists(updated);
            localStorage.setItem('medicinaLists', JSON.stringify(updated));
            alert('Guardada correctamente');
        } catch (err) {
            setMedicinaError('Error al leer el archivo.');
        } finally {
            setIsMedicinaLoading(false);
            e.target.value = '';
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
            <div className="flex-1 bg-gray-900 p-6 md:p-10 overflow-y-auto w-full">
                
                {/* 1. CARGA (Load Screen) */}
                {activeSubTab === 'load' && (
                    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
                         <div className="mb-8">
                            <h1 className="text-3xl font-bold text-white mb-2">Cargar Lista Principal</h1>
                            <p className="text-gray-400">Desde URL, archivo local o conecta tu Dropbox.</p>
                        </div>

                        {/* Connection Status Card */}
                        <div className={`p-6 rounded-xl border ${dropboxRefreshToken ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/30'} transition-colors`}>
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
                        <div className="mb-6 text-center">
                            <div className="inline-block p-4 rounded-full bg-purple-900/20 mb-4">
                                <FilePlus size={32} className="text-purple-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Añadir Lista Reparadora</h2>
                            <p className="text-gray-400 text-sm">Estas listas se usan para extraer canales y reparar los rotos de tu lista principal.</p>
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
                                    {isMedicinaLoading ? '...' : 'Guardar'}
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
                            <span className="bg-blue-900/30 text-blue-400 px-3 py-1 rounded-full text-sm font-medium">
                                {savedDropboxLists.length} listas
                            </span>
                        </div>

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
                            <span className="bg-purple-900/30 text-purple-400 px-3 py-1 rounded-full text-sm font-medium">
                                {savedMedicinaLists.length} listas
                            </span>
                        </div>

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
