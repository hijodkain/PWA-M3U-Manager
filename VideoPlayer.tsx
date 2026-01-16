import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

interface VideoPlayerProps {
    url: string;
    channelName: string;
    onClose: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, channelName, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [streamInfo, setStreamInfo] = useState<{ resolution?: string; codec?: string } | null>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        setIsLoading(true);
        setError(null);

        const loadHls = async () => {
            // Verificar si el navegador soporta HLS nativamente (Safari)
            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = url;
                video.addEventListener('loadedmetadata', handleLoadedMetadata);
                video.addEventListener('error', handleVideoError);
                setIsLoading(false);
                video.play().then(() => setIsPlaying(true)).catch(handlePlayError);
            } else {
                // Cargar HLS.js dinámicamente
                try {
                    const Hls = (await import('hls.js')).default;
                    
                    if (Hls.isSupported()) {
                        const hls = new Hls({
                            enableWorker: true,
                            lowLatencyMode: true,
                            backBufferLength: 90,
                        });
                        hlsRef.current = hls;

                        hls.loadSource(url);
                        hls.attachMedia(video);

                        hls.on(Hls.Events.MANIFEST_PARSED, () => {
                            setIsLoading(false);
                            video.play().then(() => setIsPlaying(true)).catch(handlePlayError);
                        });

                        hls.on(Hls.Events.ERROR, (event: any, data: any) => {
                            console.error('HLS Error:', data);
                            if (data.fatal) {
                                switch (data.type) {
                                    case Hls.ErrorTypes.NETWORK_ERROR:
                                        setError('Error de red: No se puede cargar el stream. Puede estar offline o bloqueado por CORS.');
                                        hls.startLoad();
                                        break;
                                    case Hls.ErrorTypes.MEDIA_ERROR:
                                        setError('Error de medios: El formato del stream no es compatible.');
                                        hls.recoverMediaError();
                                        break;
                                    default:
                                        setError('Error fatal: No se puede reproducir el stream.');
                                        break;
                                }
                            }
                        });

                        hls.on(Hls.Events.LEVEL_LOADED, (event: any, data: any) => {
                            const level = hls.levels[data.level];
                            if (level) {
                                setStreamInfo({
                                    resolution: `${level.width}x${level.height}`,
                                    codec: level.videoCodec || 'unknown',
                                });
                            }
                        });
                    } else {
                        setError('Tu navegador no soporta HLS. Prueba con un navegador moderno.');
                        setIsLoading(false);
                    }
                } catch (err) {
                    console.error('Error loading HLS.js:', err);
                    setError('Error al cargar el reproductor.');
                    setIsLoading(false);
                }
            }
        };

        loadHls();

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            if (video) {
                video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                video.removeEventListener('error', handleVideoError);
            }
        };
    }, [url]);

    const handleLoadedMetadata = () => {
        setIsLoading(false);
        const video = videoRef.current;
        if (video) {
            setStreamInfo({
                resolution: `${video.videoWidth}x${video.videoHeight}`,
                codec: 'native',
            });
        }
    };

    const handleVideoError = () => {
        setError('Error al cargar el video. El stream puede estar offline o bloqueado.');
        setIsLoading(false);
    };

    const handlePlayError = (err: Error) => {
        console.error('Play error:', err);
        setError('No se pudo iniciar la reproducción automática. Haz clic en Play.');
        setIsLoading(false);
    };

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play().then(() => setIsPlaying(true)).catch(handlePlayError);
        } else {
            video.pause();
            setIsPlaying(false);
        }
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
    };

    const toggleFullscreen = () => {
        const video = videoRef.current;
        if (!video) return;

        if (!document.fullscreenElement) {
            video.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl mx-4 bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
                    <div>
                        <h2 className="text-lg font-bold text-white">{channelName}</h2>
                        {streamInfo && (
                            <p className="text-xs text-gray-400">
                                {streamInfo.resolution} • {streamInfo.codec}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <X size={24} className="text-white" />
                    </button>
                </div>

                {/* Video Container */}
                <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
                    <video
                        ref={videoRef}
                        className="w-full h-full"
                        controls={false}
                        autoPlay
                        playsInline
                    />

                    {/* Loading Overlay */}
                    {isLoading && !error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                <p className="text-white text-sm">Cargando stream...</p>
                            </div>
                        </div>
                    )}

                    {/* Error Overlay */}
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                            <div className="text-center max-w-md px-4">
                                <div className="text-red-500 text-6xl mb-4">⚠️</div>
                                <p className="text-white text-lg font-semibold mb-2">Error de Reproducción</p>
                                <p className="text-gray-300 text-sm">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Controls Overlay */}
                    {!error && !isLoading && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={togglePlay}
                                    className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
                                >
                                    {isPlaying ? <Pause size={24} className="text-white" /> : <Play size={24} className="text-white" />}
                                </button>
                                <button
                                    onClick={toggleMute}
                                    className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
                                >
                                    {isMuted ? <VolumeX size={20} className="text-white" /> : <Volume2 size={20} className="text-white" />}
                                </button>
                                <button
                                    onClick={toggleFullscreen}
                                    className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
                                >
                                    {isFullscreen ? <Minimize size={20} className="text-white" /> : <Maximize size={20} className="text-white" />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="p-3 bg-gray-800 border-t border-gray-700">
                    <p className="text-xs text-gray-400 truncate">
                        <span className="font-semibold">URL:</span> {url}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
