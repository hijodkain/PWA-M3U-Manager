import React, { useState } from 'react';
import { useYouTube } from './useYouTube';
import { useSettings } from './useSettings';
import { Channel } from './index';
import { Youtube, Plus, RefreshCw, Download, Trash2, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';

interface YouTubeTabProps {
    channels: Channel[];
    setChannels: React.Dispatch<React.SetStateAction<Channel[]>>;
    settingsHook: ReturnType<typeof useSettings>;
}

export const YouTubeTab: React.FC<YouTubeTabProps> = ({ channels, setChannels, settingsHook }) => {
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [customName, setCustomName] = useState('');
    const [customGroup, setCustomGroup] = useState('YouTube Live');
    const [customLogo, setCustomLogo] = useState('');
    
    const {
        channels: youtubeChannels,
        isLoading,
        error,
        addYouTubeChannelToPlaylist,
        removeYouTubeChannel,
        getM3UContent,
        downloadM3UFile,
        refreshChannel,
        m3uFilename
    } = useYouTube(settingsHook.addOrUpdateSavedUrl);

    const handleAddChannel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!youtubeUrl.trim()) return;

        try {
            await addYouTubeChannelToPlaylist(
                youtubeUrl.trim(),
                customName.trim() || undefined,
                customGroup.trim() || undefined,
                customLogo.trim() || undefined,
                setChannels
            );
            
            // Limpiar formulario
            setYoutubeUrl('');
            setCustomName('');
            setCustomGroup('YouTube Live');
            setCustomLogo('');
        } catch (error) {
            console.error('Error adding YouTube channel:', error);
        }
    };

    const getStatusIcon = (status: 'active' | 'error' | 'checking') => {
        switch (status) {
            case 'active':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'checking':
                return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
            default:
                return null;
        }
    };

    const openUrl = (url: string) => {
        window.open(url, '_blank');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Youtube className="text-red-500" size={24} />
                <h2 className="text-xl font-bold">Gestión de Canales YouTube Live</h2>
            </div>

            {/* Información sobre la lista generada */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    📋 Lista M3U Automática: {m3uFilename}
                </h3>
                <p className="text-blue-800 dark:text-blue-200 text-sm mb-3">
                    Los canales que añadas aquí se extraen automáticamente como <strong>URLs .m3u8 directas</strong> compatibles con reproductores IPTV. 
                    La lista <strong>"{m3uFilename}"</strong> se crea automáticamente en la pestaña <strong>"Configuración"</strong> bajo "Playlists Guardadas" 
                    y puede ser cargada en la pestaña "Reparación". 
                </p>
                <div className="text-xs text-blue-700 dark:text-blue-300 mb-3 space-y-1">
                    <div>🟢 <strong>Canales Activos:</strong> En vivo con stream .m3u8 extraído</div>
                    <div>🟡 <strong>Canales en Espera:</strong> Guardados, esperando a que entren en vivo</div>
                    <div>⚙️ <strong>Monitor Automático:</strong> Verifica periódicamente y actualiza las URLs cuando detecta streams en vivo</div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={downloadM3UFile}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Descargar Lista ({youtubeChannels.filter(ch => ch.status === 'active').length}/{youtubeChannels.length})
                    </button>
                    <div className="text-sm text-blue-700 dark:text-blue-300 flex items-center">
                        {youtubeChannels.length === 0 ? 
                            'Lista vacía creada y guardada en Configuración' : 
                            `${youtubeChannels.filter(ch => ch.status === 'active').length} activo${youtubeChannels.filter(ch => ch.status === 'active').length !== 1 ? 's' : ''} de ${youtubeChannels.length} total${youtubeChannels.length !== 1 ? 'es' : ''}`
                        }
                    </div>
                </div>
            </div>

            {/* Formulario para añadir canal */}
            <form onSubmit={handleAddChannel} className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="font-semibold">Añadir Canal de YouTube Live</h3>
                
                <div>
                    <label htmlFor="youtube-url" className="block text-sm font-medium mb-1">
                        URL de YouTube *
                    </label>
                    <input
                        id="youtube-url"
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=... o https://www.youtube.com/@canal/live"
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="custom-name" className="block text-sm font-medium mb-1">
                            Nombre personalizado (opcional)
                        </label>
                        <input
                            id="custom-name"
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder="Se usará el título del stream si se deja vacío"
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white"
                        />
                    </div>

                    <div>
                        <label htmlFor="custom-group" className="block text-sm font-medium mb-1">
                            Grupo
                        </label>
                        <input
                            id="custom-group"
                            type="text"
                            value={customGroup}
                            onChange={(e) => setCustomGroup(e.target.value)}
                            placeholder="YouTube Live"
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white"
                        />
                    </div>

                    <div>
                        <label htmlFor="custom-logo" className="block text-sm font-medium mb-1">
                            URL del Logo (opcional)
                        </label>
                        <input
                            id="custom-logo"
                            type="url"
                            value={customLogo}
                            onChange={(e) => setCustomLogo(e.target.value)}
                            placeholder="https://ejemplo.com/logo.png"
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading || !youtubeUrl.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4" />
                    )}
                    {isLoading ? 'Añadiendo...' : 'Añadir Canal'}
                </button>
            </form>

            {/* Mostrar error si existe */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                    <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                </div>
            )}

            {/* Lista de canales de YouTube */}
            {youtubeChannels.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-semibold">Canales de YouTube Registrados ({youtubeChannels.length})</h3>
                    <div className="space-y-2">
                        {youtubeChannels.map((channel) => (
                            <div
                                key={channel.id}
                                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(channel.status)}
                                        <h4 className="font-medium">{channel.name}</h4>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            • {channel.group}
                                        </span>
                                        {channel.status === 'active' && (
                                            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded">
                                                EN VIVO
                                            </span>
                                        )}
                                        {channel.status === 'checking' && (
                                            <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-1 rounded">
                                                ESPERANDO
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                                        <div>
                                            <strong>Original:</strong> {channel.url.length > 60 ? channel.url.substring(0, 60) + '...' : channel.url}
                                        </div>
                                        {channel.streamUrl && channel.streamUrl !== channel.url && (
                                            <div className="text-green-600 dark:text-green-400">
                                                <strong>Stream .m3u8:</strong> {channel.streamUrl.length > 60 ? channel.streamUrl.substring(0, 60) + '...' : channel.streamUrl}
                                            </div>
                                        )}
                                        <div>
                                            <strong>Última verificación:</strong> {new Date(channel.lastChecked).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openUrl(channel.url)}
                                        className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                                        title="Abrir en YouTube"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => refreshChannel(channel.id)}
                                        className="p-2 text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400"
                                        title="Actualizar stream"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => removeYouTubeChannel(channel.id)}
                                        className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                                        title="Eliminar canal"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Información de ayuda */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold mb-2">ℹ️ Cómo funciona el sistema</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• <strong>Extracción directa:</strong> Convierte URLs de YouTube a streams .m3u8 reales compatibles con IPTV</li>
                    <li>• <strong>Sistema de placeholders:</strong> Los canales se guardan aunque no estén en vivo</li>
                    <li>• <strong>Monitor automático:</strong> Verifica periódicamente y actualiza las URLs cuando detecta streams activos</li>
                    <li>• <strong>Compatible con IPTV:</strong> Las URLs .m3u8 funcionan en reproductores como VLC, IPTV Smarters, etc.</li>
                    <li>• <strong>Persistencia:</strong> Los canales se guardan permanentemente en el navegador</li>
                    <li>• <strong>Integración:</strong> La lista "{m3uFilename}" aparece automáticamente en "Configuración" → "Playlists Guardadas"</li>
                    <li>• <strong>Sincronización:</strong> El monitor automático mantiene las URLs actualizadas cuando los streams cambien</li>
                </ul>
            </div>
        </div>
    );
};