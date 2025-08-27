import React from 'react';
import { FileDown, Save } from 'lucide-react';
import { useChannels } from './useChannels';

interface SaveTabProps {
    channelsHook: ReturnType<typeof useChannels>;
}

const SaveTab: React.FC<SaveTabProps> = ({ channelsHook }) => {
    const { channels, fileName, setFileName, handleDownload } = channelsHook;

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
                <button
                    disabled={true}
                    className="bg-blue-500 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <Save size={18} className="mr-2" /> Subir a Dropbox (Próximamente)
                </button>
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
