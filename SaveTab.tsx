import React, { useState } from 'react';
import { FileDown, UploadCloud, PlusCircle, Share2 } from 'lucide-react';
import { useChannels } from './useChannels';
import { useSettings } from './useSettings';

interface SaveTabProps {
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
}

const SaveTab: React.FC<SaveTabProps> = ({ channelsHook, settingsHook }) => {
    const { channels, fileName, setFileName, originalFileName, handleDownload, generateM3UContent } = channelsHook;
    const { dropboxAppKey, dropboxRefreshToken } = settingsHook;

    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [showAddToListModal, setShowAddToListModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [uploadedFileUrl, setUploadedFileUrl] = useState('');
    const [newListName, setNewListName] = useState('');

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
            const errorData = await response.json();
            console.error('Dropbox token refresh error:', errorData);
            throw new Error('No se pudo obtener el token de acceso de Dropbox. Vuelve a conectar en la pestaña de Configuración.');
        }

        const data = await response.json();
        return data.access_token;
    };

    // Convertir URL de Dropbox a enlace directo
    const convertDropboxUrl = (url: string): string => {
        return url
            .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
            .replace('dl=0', 'dl=1');
    };

    // Obtener enlace compartido de Dropbox
    const getSharedLink = async (accessToken: string, filePath: string): Promise<string> => {
        try {
            // Intentar crear un nuevo enlace compartido
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

            // Si falla, intentar obtener enlaces existentes
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

    // Guardar lista en localStorage
    const saveToDropboxLists = (name: string, url: string) => {
        const lists = JSON.parse(localStorage.getItem('dropboxLists') || '[]');
        const newList = {
            id: Date.now().toString(),
            name,
            url,
            addedAt: new Date().toISOString(),
        };
        lists.push(newList);
        localStorage.setItem('dropboxLists', JSON.stringify(lists));
    };

    const handleUploadToDropbox = async (isNewFile: boolean = false) => {
        if (!dropboxAppKey || !dropboxRefreshToken) {
            setUploadStatus('Por favor, conecta tu cuenta de Dropbox en la pestaña de Configuración.');
            return;
        }
        if (channels.length === 0) {
            setUploadStatus('No hay canales para subir.');
            return;
        }

        setIsUploading(true);
        setUploadStatus('Obteniendo token de acceso y subiendo a Dropbox...');

        try {
            const accessToken = await getDropboxAccessToken();
            const fileContent = generateM3UContent();
            // Si es actualización (no nuevo archivo), usar el nombre original del archivo cargado
            const fileNameToUse = !isNewFile && originalFileName ? originalFileName : fileName;
            const filePath = `/${fileNameToUse}`;

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
                throw new Error(errorData.error_summary || 'Fallo al subir el archivo.');
            }

            // Obtener enlace compartido
            setUploadStatus('Obteniendo enlace compartido...');
            const shareUrl = await getSharedLink(accessToken, filePath);
            setUploadedFileUrl(shareUrl);

            setUploadStatus('¡Archivo subido a Dropbox con éxito!');
            
            // Si es un archivo nuevo, preguntar si quiere añadirlo a la lista
            if (isNewFile) {
                setShowAddToListModal(true);
            } else {
                setShowSuccessModal(true);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
            setUploadStatus(`Error: ${errorMessage}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddToList = () => {
        if (newListName.trim()) {
            saveToDropboxLists(newListName.trim(), uploadedFileUrl);
            setShowAddToListModal(false);
            setShowSuccessModal(true);
            setNewListName('');
        }
    };

    const handleSkipAddToList = () => {
        setShowAddToListModal(false);
        alert(`El archivo ${fileName} está subido al dropbox de todas formas. Puedes gestionarlo desde tu dropbox.`);
        setUploadStatus('');
    };

    const areDropboxSettingsMissing = !dropboxAppKey || !dropboxRefreshToken;

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-6 text-white">Guardar y Exportar Playlist</h2>

            {channels.length === 0 && (
                <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-6">
                    <p className="text-yellow-400">
                        No hay canales en la lista. Carga una lista en la pestaña "Inicio" para poder exportarla.
                    </p>
                </div>
            )}

            {/* SECCIÓN 1: Actualizar archivo original en Dropbox */}
            {originalFileName && (
                <>
                    <div className="mb-8">
                        <h3 className="text-lg font-bold text-blue-400 mb-3">1. Actualizar lista en mi Dropbox</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Actualiza el archivo <strong className="text-white">{originalFileName}</strong> en tu Dropbox con los cambios realizados.
                        </p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Nombre del archivo en Dropbox:
                            </label>
                            <input
                                type="text"
                                value={originalFileName}
                                disabled
                                className="w-full md:w-2/3 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-gray-400 cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-500 mt-1">Este es el nombre original del archivo que cargaste</p>
                        </div>

                        <button
                            onClick={() => handleUploadToDropbox(false)}
                            disabled={isUploading || channels.length === 0 || areDropboxSettingsMissing}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-md flex items-center justify-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            <UploadCloud size={20} className="mr-2" />
                            {isUploading ? 'Actualizando...' : 'Actualizar en mi Dropbox'}
                        </button>

                        {areDropboxSettingsMissing && (
                            <p className="text-xs text-yellow-400 mt-2">
                                Falta la configuración de Dropbox. Por favor, conéctate en la pestaña de Configuración.
                            </p>
                        )}
                        {uploadStatus && (
                            <p className="mt-4 text-sm text-yellow-300">{uploadStatus}</p>
                        )}
                    </div>

                    <hr className="my-8 border-gray-700" />
                </>
            )}

            {/* SECCIÓN 2: Subir nueva lista a Dropbox */}
            <div className="mb-8">
                <h3 className="text-lg font-bold text-green-400 mb-3">
                    {originalFileName ? '2. Subir como nueva lista a mi Dropbox' : '1. Subir nueva lista a mi Dropbox'}
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                    Crea una nueva lista en tu Dropbox y añádela a "Mis listas de Dropbox" para acceso rápido.
                </p>

                <button
                    onClick={() => handleUploadToDropbox(true)}
                    disabled={isUploading || channels.length === 0 || areDropboxSettingsMissing}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md flex items-center justify-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <PlusCircle size={20} className="mr-2" />
                    {isUploading ? 'Subiendo...' : 'Subir nueva lista a mi Dropbox'}
                </button>

                {areDropboxSettingsMissing && (
                    <p className="text-xs text-yellow-400 mt-2">
                        Falta la configuración de Dropbox. Por favor, conéctate en la pestaña de Configuración.
                    </p>
                )}
            </div>

            <hr className="my-8 border-gray-700" />

            {/* SECCIÓN 3: Descargar archivo M3U a local */}
            <div>
                <h3 className="text-lg font-bold text-purple-400 mb-3">
                    {originalFileName ? '3. Descargar archivo M3U a local' : '2. Descargar archivo M3U a local'}
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                    Descarga el archivo M3U a tu ordenador.
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Nombre del archivo a descargar:
                    </label>
                    <input
                        type="text"
                        value={fileName}
                        onChange={(e) => {
                            const newValue = e.target.value.replace(/\s+/g, '_');
                            setFileName(newValue);
                        }}
                        className="w-full md:w-2/3 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-purple-500 focus:border-purple-500"
                        placeholder="mi_playlist.m3u"
                    />
                    <p className="text-xs text-gray-400 mt-1">Los espacios se convertirán automáticamente en guiones bajos (_)</p>
                </div>

                <button
                    onClick={handleDownload}
                    disabled={channels.length === 0}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <FileDown size={20} className="mr-2" /> Descargar .m3u
                </button>
            </div>

            {/* Modal: Añadir a "Mis listas de Dropbox" */}
            {showAddToListModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-4 border border-blue-500">
                        <h3 className="text-xl font-semibold text-white mb-4">¿Añadir a "Mis listas de Dropbox"?</h3>
                        <p className="text-gray-300 mb-4">El archivo se ha subido correctamente. ¿Quieres añadirlo a tu lista de accesos rápidos?</p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Nombre de la lista:
                            </label>
                            <input
                                type="text"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                placeholder="Ej: Mi lista principal"
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleSkipAddToList}
                                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md"
                            >
                                No, gracias
                            </button>
                            <button
                                onClick={handleAddToList}
                                disabled={!newListName.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                Sí, añadir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Éxito */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-4 border border-green-500">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-4">¡Archivo subido con éxito!</h3>
                            <button
                                onClick={() => setShowSuccessModal(false)}
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

export default SaveTab;
