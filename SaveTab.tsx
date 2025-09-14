import React, { useState } from 'react';
import { FileDown, UploadCloud } from 'lucide-react';
import { useChannels } from './useChannels';
import { useSettings } from './useSettings';

interface SaveTabProps {
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
}

const SaveTab: React.FC<SaveTabProps> = ({ channelsHook, settingsHook }) => {
    const { channels, fileName, setFileName, handleDownload, generateM3UContent } = channelsHook;
    const { dropboxAppKey, dropboxAppSecret, dropboxRefreshToken } = settingsHook;

    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');

    const getDropboxAccessToken = async () => {
        const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(`${dropboxAppKey}:${dropboxAppSecret}`),
            },
            body: `grant_type=refresh_token&refresh_token=${dropboxRefreshToken}`,
        });

        if (!response.ok) {
            throw new Error('No se pudo obtener el token de acceso de Dropbox. Revisa tu configuración.');
        }

        const data = await response.json();
        return data.access_token;
    };

    const handleUploadToDropbox = async () => {
        if (!dropboxAppKey || !dropboxAppSecret || !dropboxRefreshToken) {
            setUploadStatus('Por favor, completa la configuración de Dropbox en la pestaña de Configuración.');
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

            const dropboxApiArg = {
                path: `/${fileName}`,
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

            setUploadStatus('¡Archivo subido a Dropbox con éxito!');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
            setUploadStatus(`Error: ${errorMessage}`);
        } finally {
            setIsUploading(false);
        }
    };

    const areDropboxSettingsMissing = !dropboxAppKey || !dropboxAppSecret || !dropboxRefreshToken;

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-white">Guardar y Exportar Playlist</h2>

            <div className="mb-6">
                <label htmlFor="filename-input" className="block text-sm font-medium text-gray-300 mb-2">
                    Nombre del archivo
                </label>
                <input
                    id="filename-input"
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full md:w-1/2 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                />
            </div>
            <div className="flex flex-wrap gap-4">
                <button
                    onClick={handleDownload}
                    disabled={channels.length === 0}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <FileDown size={18} className="mr-2" /> Descargar .m3u
                </button>
            </div>

            <hr className="my-8 border-gray-600" />

            <div>
                <h3 className="text-lg font-bold text-white mb-2">Subir a Dropbox</h3>
                <p className="text-sm text-gray-400 mb-4">
                    El archivo se guardará como <strong>{fileName}</strong> en la carpeta de la aplicación de tu Dropbox.
                </p>
                <div className="flex flex-col gap-4 md:w-1/2">
                    <button
                        onClick={handleUploadToDropbox}
                        disabled={isUploading || channels.length === 0 || areDropboxSettingsMissing}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        <UploadCloud size={18} className="mr-2" />
                        {isUploading ? 'Subiendo...' : 'Subir a Dropbox'}
                    </button>
                    {areDropboxSettingsMissing && (
                        <p className="text-xs text-yellow-400 mt-2">
                            Falta la configuración de Dropbox. Por favor, añádela en la pestaña de Configuración.
                        </p>
                    )}
                </div>
                {uploadStatus && (
                    <p className="mt-4 text-sm text-yellow-300">{uploadStatus}</p>
                )}
            </div>

            {channels.length === 0 && (
                <p className="mt-4 text-yellow-400">
                    No hay canales en la lista para guardar. Carga una lista en la pestaña "Editor de Playlist".
                </p>
            )}
        </div>
    );
};

export default SaveTab;
