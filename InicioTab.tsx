import React from 'react';
import { Upload, Download } from 'lucide-react';
import { useChannels } from './useChannels';
import { useSettings } from './useSettings';

interface InicioTabProps {
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
}

const InicioTab: React.FC<InicioTabProps> = ({ channelsHook, settingsHook }) => {
    const {
        url,
        setUrl,
        isLoading,
        error,
        handleFetchUrl,
        handleFileUpload,
    } = channelsHook;

    const { savedUrls } = settingsHook;

    return (
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-blue-400 mb-2">Bienvenido al Gestor de Listas M3U</h2>
                <p className="text-gray-300 text-lg">Añade una lista M3U que te guste</p>
            </div>

            <div className="space-y-6">
                {/* Campo de texto para URL */}
                <div>
                    <label htmlFor="inicio-url-input" className="block text-sm font-medium text-gray-300 mb-2">
                        Pega el enlace de tu lista M3U
                    </label>
                    <div className="flex">
                        <input
                            id="inicio-url-input"
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://.../playlist.m3u"
                            className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md px-4 py-3 text-white focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                            onClick={handleFetchUrl}
                            disabled={isLoading || !url}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-r-md flex items-center disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
                        >
                            <Download size={20} className="mr-2" /> Cargar
                        </button>
                    </div>
                    {savedUrls.length > 0 && (
                        <div className="mt-3">
                            <select
                                id="inicio-saved-urls-select"
                                value=""
                                onChange={(e) => {
                                    if (e.target.value) {
                                        setUrl(e.target.value);
                                    }
                                }}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-3 text-white focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">o selecciona una lista guardada...</option>
                                {savedUrls.map(item => (
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
                        <Upload size={20} className="mr-2" /> Subir Archivo M3U
                    </label>
                    <input
                        id="inicio-file-upload"
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
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
    );
};

export default InicioTab;
