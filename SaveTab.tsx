import React, { useState } from 'react';
import { FileDown, UploadCloud, PlusCircle, RefreshCw, Save, HardDrive } from 'lucide-react';
import { useChannels } from './useChannels';
import { useSettings } from './useSettings';

interface SaveTabProps {
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
}

type SaveSubTab = 'update' | 'new' | 'download';

const SaveTab: React.FC<SaveTabProps> = ({ channelsHook, settingsHook }) => {
    const { channels, fileName, setFileName, originalFileName, handleDownload, generateM3UContent } = channelsHook;
    const { dropboxAppKey, dropboxRefreshToken } = settingsHook;

    const [activeSubTab, setActiveSubTab] = useState<SaveSubTab>('update');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [uploadedFileUrl, setUploadedFileUrl] = useState('');
    const [newListName, setNewListName] = useState('');

    const getDropboxAccessToken = async () => {
        const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: dropboxRefreshToken,
                client_id: dropboxAppKey,
            }),
        });

        if (!response.ok) {
            throw new Error('No se pudo obtener el token de acceso de Dropbox.');
        }

        const data = await response.json();
        return data.access_token;
    };

    const convertDropboxUrl = (url: string): string => {
        return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'dl=1');
    };

    const handleUploadToDropbox = async (isNewFile: boolean = false) => {
        if (!dropboxRefreshToken) {
            setUploadStatus('No estás conectado a Dropbox.');
            return;
        }

        setIsUploading(true);
        setUploadStatus('Generando archivo...');
        setUploadedFileUrl('');

        try {
            const content = generateM3UContent();
            
            // Determinar nombre del archivo
            let filenameToUse = originalFileName; // Por defecto actualizar original
            
            if (isNewFile) {
                if (!newListName.trim()) {
                    setUploadStatus('Debes poner un nombre a la nueva lista');
                    setIsUploading(false);
                    return;
                }
                const name = newListName.trim().replace(/\s+/g, '_');
                filenameToUse = name.endsWith('.m3u') ? name : `${name}.m3u`;
            } else if (!filenameToUse) {
                // Si intenta actualizar pero no hay nombre original, forzar como nuevo
                setUploadStatus('No hay archivo vinculado para actualizar. Usa "Nueva lista".');
                setIsUploading(false);
                return;
            }

            setUploadStatus('Obteniendo token...');
            const accessToken = await getDropboxAccessToken();

            setUploadStatus('Subiendo a Dropbox...');
            const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({
                        path: `/${filenameToUse}`,
                        mode: isNewFile ? 'add' : 'overwrite', // Si es nuevo añade, si es update sobrescribe
                        autorename: true,
                        mute: false,
                        strict_conflict: false
                    }),
                    'Content-Type': 'application/octet-stream',
                },
                body: content,
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Error al subir: ${response.statusText} - ${errText}`);
            }

            const data = await response.json();
            
            // Crear link compartido para guardar referencia
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
                sharedUrl = convertDropboxUrl(shareData.url);
            } else {
                 // Si ya existe link, buscarlo? O simplemente éxito parcial.
                 // Intentar list_shared_links?
                 const listLinks = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ path: data.path_display }),
                });
                if(listLinks.ok) {
                    const existing = await listLinks.json();
                     if (existing.links && existing.links.length > 0) {
                         sharedUrl = convertDropboxUrl(existing.links[0].url);
                     }
                }
            }

            // Guardar en LocalStorage si es nueva
            if (isNewFile && sharedUrl) {
                const currentList = JSON.parse(localStorage.getItem('dropboxLists') || '[]');
                const newList = {
                    id: Date.now().toString(),
                    name: newListName,
                    url: sharedUrl,
                    addedAt: new Date().toISOString()
                };
                localStorage.setItem('dropboxLists', JSON.stringify([...currentList, newList]));
            }

            setUploadStatus('¡Subida completada con éxito!');
            setUploadedFileUrl(sharedUrl);
            setTimeout(() => setUploadStatus(''), 5000);

        } catch (error: any) {
            console.error(error);
            setUploadStatus(`Error: ${error.message}`);
        } finally {
            setIsUploading(false);
            setNewListName('');
        }
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
                    icon={<RefreshCw size={24} />} 
                    active={activeSubTab === 'update'} 
                    onClick={() => setActiveSubTab('update')}
                    tooltip="Actualizar lista actual" 
                />
                <SidebarButton 
                    icon={<UploadCloud size={24} />} 
                    active={activeSubTab === 'new'} 
                    onClick={() => setActiveSubTab('new')} 
                    tooltip="Subir nueva lista"
                />
                <SidebarButton 
                    icon={<FileDown size={24} />} 
                    active={activeSubTab === 'download'} 
                    onClick={() => setActiveSubTab('download')} 
                    tooltip="Descargar archivo local"
                />
            </div>

            {/* --- CONTENT --- */}
            <div className="flex-1 bg-gray-900 p-6 md:p-10 overflow-y-auto w-full">
                
                {/* STATUS BAR GLOBAL SI HAY MENSAJES */}
                {(uploadStatus || uploadedFileUrl) && (
                     <div className="mb-6 bg-gray-800 border-l-4 border-blue-500 p-4 rounded shadow-lg animate-fadeIn flex flex-col gap-2">
                        <p className="text-white font-medium">{uploadStatus}</p>
                        {uploadedFileUrl && (
                             <div className="flex items-center gap-2 text-sm text-gray-300 bg-gray-900 p-2 rounded break-all">
                                <span className="text-green-400">URL:</span> {uploadedFileUrl}
                             </div>
                        )}
                    </div>
                )}

                {/* 1. ACTUALIZAR (Update) */}
                {activeSubTab === 'update' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                        <div className="mb-8 border-b border-gray-800 pb-4">
                            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                <RefreshCw className="text-blue-500" /> Actualizar en Dropbox
                            </h2>
                            <p className="text-gray-400">Sobrescribe el archivo original en tu nube con los cambios actuales.</p>
                        </div>
                        
                        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl text-center">
                            {originalFileName ? (
                                <>
                                    <div className="inline-block p-4 rounded-full bg-blue-900/20 mb-4">
                                        <Save size={32} className="text-blue-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Archivo vinculado:</h3>
                                    <p className="text-blue-300 font-mono bg-blue-900/10 py-1 px-3 rounded inline-block mb-6 border border-blue-900/30">
                                        {originalFileName}
                                    </p>
                                    
                                    <button
                                        onClick={() => handleUploadToDropbox(false)}
                                        disabled={isUploading || !dropboxRefreshToken}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-blue-900/30 flex items-center justify-center gap-3"
                                    >
                                        {isUploading ? <RefreshCw className="animate-spin" /> : <UploadCloud />}
                                        {isUploading ? 'Actualizando...' : 'Confirmar Actualización'}
                                    </button>
                                </>
                            ) : (
                                <div className="py-8">
                                    <p className="text-yellow-400 mb-4">No has cargado esta lista desde Dropbox o el nombre original se ha perdido.</p>
                                    <button onClick={() => setActiveSubTab('new')} className="text-blue-400 hover:underline">
                                        Usa la opción "Nueva Lista" en su lugar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. NUEVA LISTA (New) */}
                {activeSubTab === 'new' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                        <div className="mb-8 border-b border-gray-800 pb-4">
                            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                <UploadCloud className="text-purple-500" /> Subir Nueva Lista
                            </h2>
                            <p className="text-gray-400">Guarda tu lista actual como un archivo nuevo en Dropbox.</p>
                        </div>

                        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Nombre para el archivo</label>
                            <input
                                type="text"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                placeholder="Ej: Mi_Lista_Editada"
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none mb-6"
                            />
                            
                            <button
                                onClick={() => handleUploadToDropbox(true)}
                                disabled={isUploading || !dropboxRefreshToken || !newListName.trim()}
                                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-purple-900/30 flex items-center justify-center gap-3"
                            >
                                {isUploading ? <RefreshCw className="animate-spin" /> : <PlusCircle />}
                                {isUploading ? 'Subiendo...' : 'Subir a mi Dropbox'}
                            </button>
                            
                            {!dropboxRefreshToken && (
                                <p className="text-red-400 text-sm mt-4 text-center">Debes conectar tu Dropbox en Configuración primero.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. DESCARGAR (Download) */}
                {activeSubTab === 'download' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                        <div className="mb-8 border-b border-gray-800 pb-4">
                            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                <HardDrive className="text-green-500" /> Descarga Local
                            </h2>
                            <p className="text-gray-400">Guarda el archivo .m3u en tu dispositivo.</p>
                        </div>

                        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl">
                             <label className="block text-sm font-medium text-gray-300 mb-2">Nombre del archivo</label>
                            <div className="flex gap-2 mb-6">
                                <input
                                    type="text"
                                    value={fileName}
                                    onChange={(e) => setFileName(e.target.value)}
                                    placeholder="nombre_archivo"
                                    className="flex-grow bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-green-500 outline-none"
                                />
                                <span className="flex items-center px-4 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 font-mono">
                                    .m3u
                                </span>
                            </div>

                            <button
                                onClick={handleDownload}
                                disabled={channels.length === 0}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-green-900/30 flex items-center justify-center gap-3"
                            >
                                <FileDown />
                                Descargar Archivo
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default SaveTab;
