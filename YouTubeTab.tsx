import React, { useState } from 'react';
import { Youtube, Plus, Trash2, Download, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { Channel } from './index';
import { useSettings } from './useSettings';
import {
    YOUTUBE_API_CONFIG,
    getAPIHeaders,
    buildExtractURL,
    extractChannelNameFromURL,
    formatQuality,
    parseAPIError,
    type YouTubeAPIResponse,
    type ExtractionStatus,
} from './youtube-api-config';

interface YouTubeTabProps {
    settingsHook: ReturnType<typeof useSettings>;
}

interface YouTubeChannel {
    id: string;
    youtubeUrl: string;
    customName?: string;
    customLogo?: string;
    customGroup?: string;
    status: ExtractionStatus;
    m3u8Url?: string;
    quality?: string;
    error?: string;
}

const YouTubeTab: React.FC<YouTubeTabProps> = ({ settingsHook }) => {
    const { addYoutubeChannels } = settingsHook;
    const [youtubeChannels, setYoutubeChannels] = useState<YouTubeChannel[]>([]);
    const [newYoutubeUrl, setNewYoutubeUrl] = useState('');
    const [customName, setCustomName] = useState('');
    const [customLogo, setCustomLogo] = useState('');
    const [customGroup, setCustomGroup] = useState(YOUTUBE_API_CONFIG.DEFAULT_GROUP);

    // Extraer M3U8 URL desde la Lambda
    const extractM3U8Url = async (youtubeUrl: string): Promise<{ m3u8Url: string; quality: string } | null> => {
        try {
            const response = await fetch(buildExtractURL(youtubeUrl), {
                method: 'GET',
                headers: getAPIHeaders(),
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data: YouTubeAPIResponse = await response.json();

            if (data.success && data.m3u8_url) {
                return {
                    m3u8Url: data.m3u8_url,
                    quality: data.quality || 'unknown',
                };
            } else {
                throw new Error(parseAPIError(data.error || 'No se pudo extraer la URL del stream'));
            }
        } catch (error) {
            console.error('Error extracting M3U8 URL:', error);
            throw error;
        }
    };

    // Extraer nombre del canal desde la URL de YouTube
    const getChannelName = (url: string): string => {
        return extractChannelNameFromURL(url);
    };

    // Añadir canal de YouTube
    const handleAddYoutubeChannel = () => {
        if (!newYoutubeUrl) return;

        const channelId = `yt-${Date.now()}-${Math.random()}`;
        const channelName = customName || getChannelName(newYoutubeUrl);

        const newChannel: YouTubeChannel = {
            id: channelId,
            youtubeUrl: newYoutubeUrl,
            customName: channelName,
            customLogo: customLogo,
            customGroup: customGroup || YOUTUBE_API_CONFIG.DEFAULT_GROUP,
            status: 'extracting',
        };

        setYoutubeChannels((prev) => [...prev, newChannel]);

        // Extraer M3U8 URL
        extractM3U8Url(newYoutubeUrl)
            .then((result) => {
                if (result) {
                    setYoutubeChannels((prev) =>
                        prev.map((ch) =>
                            ch.id === channelId
                                ? { ...ch, status: 'success', m3u8Url: result.m3u8Url, quality: result.quality }
                                : ch
                        )
                    );
                }
            })
            .catch((error) => {
                setYoutubeChannels((prev) =>
                    prev.map((ch) =>
                        ch.id === channelId
                            ? { ...ch, status: 'error', error: error.message }
                            : ch
                    )
                );
            });

        // Limpiar formulario
        setNewYoutubeUrl('');
        setCustomName('');
        setCustomLogo('');
    };

    // Eliminar canal de YouTube
    const handleDeleteYoutubeChannel = (id: string) => {
        setYoutubeChannels((prev) => prev.filter((ch) => ch.id !== id));
    };

    // Añadir canales de YouTube al archivo Youtube.m3u local
    const handleAddToYoutubeM3U = () => {
        const successfulChannels = youtubeChannels.filter((ch) => ch.status === 'success' && ch.m3u8Url);

        const newChannels: Channel[] = successfulChannels.map((ytCh, index) => ({
            id: `youtube-${Date.now()}-${index}-${Math.random()}`,
            order: index + 1,
            tvgId: '',
            tvgName: ytCh.customName || '',
            tvgLogo: ytCh.customLogo || '',
            groupTitle: ytCh.customGroup || 'YouTube Live',
            name: ytCh.customName || 'YouTube Channel',
            url: ytCh.m3u8Url || '',
            status: 'pending',
        }));

        // Guardar en localStorage vía useSettings
        addYoutubeChannels(newChannels);

        // Limpiar la lista temporal de extracciones
        setYoutubeChannels([]);

        // Mensaje de éxito
        alert(`✅ ${newChannels.length} canal(es) añadido(s) al archivo Youtube.m3u\n\nPuedes descargar el archivo desde la pestaña Configuración.`);
    };

    // Reintentar extracción
    const handleRetry = (channelId: string) => {
        const channel = youtubeChannels.find((ch) => ch.id === channelId);
        if (!channel) return;

        setYoutubeChannels((prev) =>
            prev.map((ch) => (ch.id === channelId ? { ...ch, status: 'extracting', error: undefined } : ch))
        );

        extractM3U8Url(channel.youtubeUrl)
            .then((result) => {
                if (result) {
                    setYoutubeChannels((prev) =>
                        prev.map((ch) =>
                            ch.id === channelId
                                ? { ...ch, status: 'success', m3u8Url: result.m3u8Url, quality: result.quality }
                                : ch
                        )
                    );
                }
            })
            .catch((error) => {
                setYoutubeChannels((prev) =>
                    prev.map((ch) =>
                        ch.id === channelId ? { ...ch, status: 'error', error: error.message } : ch
                    )
                );
            });
    };

    const getStatusIcon = (status: YouTubeChannel['status']) => {
        switch (status) {
            case 'pending':
                return <AlertCircle className="text-gray-400" size={20} />;
            case 'extracting':
                return <Loader className="text-blue-400 animate-spin" size={20} />;
            case 'success':
                return <CheckCircle className="text-green-400" size={20} />;
            case 'error':
                return <AlertCircle className="text-red-400" size={20} />;
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <div className="flex items-center mb-6">
                <Youtube className="text-red-500 mr-3" size={32} />
                <h2 className="text-2xl font-bold text-white">YouTube Live Streams</h2>
            </div>

            {/* Formulario para añadir canales */}
            <div className="bg-gray-700 p-4 rounded-lg mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Añadir Canal de YouTube</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            URL de YouTube *
                        </label>
                        <input
                            type="text"
                            value={newYoutubeUrl}
                            onChange={(e) => setNewYoutubeUrl(e.target.value)}
                            placeholder="https://www.youtube.com/@CanalRedLive/live"
                            className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Formatos: /@canal/live, /watch?v=..., /channel/...
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Nombre del Canal (opcional)
                        </label>
                        <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder="Nombre personalizado"
                            className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            URL del Logo/Icono (opcional)
                        </label>
                        <input
                            type="text"
                            value={customLogo}
                            onChange={(e) => setCustomLogo(e.target.value)}
                            placeholder="https://ejemplo.com/logo.png"
                            className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            URL del icono que se mostrará en tu reproductor
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Grupo (opcional)
                        </label>
                        <input
                            type="text"
                            value={customGroup}
                            onChange={(e) => setCustomGroup(e.target.value)}
                            placeholder="YouTube Live"
                            className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                <button
                    onClick={handleAddYoutubeChannel}
                    disabled={!newYoutubeUrl}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <Plus size={18} className="mr-2" /> Añadir Canal
                </button>
            </div>

            {/* Lista de canales de YouTube */}
            {youtubeChannels.length > 0 && (
                <div className="bg-gray-700 p-4 rounded-lg mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">
                            Canales de YouTube ({youtubeChannels.length})
                        </h3>
                        <button
                            onClick={handleAddToYoutubeM3U}
                            disabled={!youtubeChannels.some((ch) => ch.status === 'success')}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            <Download size={18} className="mr-2" /> Guardar en Youtube.m3u
                        </button>
                    </div>

                    <div className="space-y-3">
                        {youtubeChannels.map((ytCh) => (
                            <div
                                key={ytCh.id}
                                className="bg-gray-600 p-4 rounded-lg flex items-center justify-between"
                            >
                                <div className="flex items-center space-x-4 flex-1">
                                    <div>{getStatusIcon(ytCh.status)}</div>
                                    <div className="flex-1">
                                        <h4 className="text-white font-semibold">{ytCh.customName}</h4>
                                        <p className="text-sm text-gray-400 truncate max-w-md">
                                            {ytCh.youtubeUrl}
                                        </p>
                                        {ytCh.status === 'success' && (
                                            <p className="text-xs text-green-400 mt-1">
                                                ✓ Stream extraído ({formatQuality(ytCh.quality)})
                                            </p>
                                        )}
                                        {ytCh.status === 'error' && (
                                            <p className="text-xs text-red-400 mt-1">✗ {ytCh.error}</p>
                                        )}
                                        {ytCh.status === 'extracting' && (
                                            <p className="text-xs text-blue-400 mt-1">
                                                Extrayendo stream...
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    {ytCh.status === 'error' && (
                                        <button
                                            onClick={() => handleRetry(ytCh.id)}
                                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded text-sm"
                                        >
                                            Reintentar
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteYoutubeChannel(ytCh.id)}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Información */}
            <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-lg">
                <h4 className="text-blue-300 font-semibold mb-2 flex items-center">
                    <AlertCircle size={18} className="mr-2" /> Información
                </h4>
                <ul className="text-sm text-gray-300 space-y-1">
                    <li>• Los canales se añadirán al grupo "YouTube Live" por defecto</li>
                    <li>• Solo funciona con canales que estén transmitiendo en vivo</li>
                    <li>• Las URLs M3U8 son válidas por aproximadamente 6 horas</li>
                    <li>• Soporta URLs: /@canal/live, /watch?v=..., /channel/...</li>
                    <li>• Los canales añadidos se guardarán en tu playlist M3U</li>
                </ul>
            </div>
        </div>
    );
};

export default YouTubeTab;
