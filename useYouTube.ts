import { useState, useCallback, useEffect } from 'react';
import { Channel } from './index';

interface YouTubeChannel {
    id: string;
    name: string;
    group: string;
    url: string;
    proxyUrl: string;
    logo: string;
    status: 'active' | 'error' | 'checking';
    lastChecked: string;
}

const STORAGE_KEY = 'youtube_channels_list';
const M3U_FILENAME = 'mis_canales_youtube.m3u';

export const useYouTube = () => {
    const [youtubeChannels, setYoutubeChannels] = useState<YouTubeChannel[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cargar canales del localStorage al iniciar
    useEffect(() => {
        const savedChannels = localStorage.getItem(STORAGE_KEY);
        if (savedChannels) {
            try {
                const parsedChannels = JSON.parse(savedChannels);
                setYoutubeChannels(parsedChannels);
            } catch (error) {
                console.error('Error loading saved YouTube channels:', error);
            }
        }
    }, []);

    // Guardar canales en localStorage y generar archivo M3U
    const saveChannelsAndGenerateM3U = useCallback((updatedChannels: YouTubeChannel[]) => {
        // Guardar en localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedChannels));
        
        // Generar contenido M3U
        let m3uContent = '#EXTM3U\n';
        updatedChannels.forEach(channel => {
            const logoAttr = channel.logo ? ` tvg-logo="${channel.logo}"` : '';
            m3uContent += `#EXTINF:-1 tvg-name="${channel.name}" group-title="${channel.group}"${logoAttr},${channel.name}\n`;
            m3uContent += `${channel.proxyUrl}\n`;
        });
        
        // Crear y descargar archivo M3U automáticamente
        const blob = new Blob([m3uContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        // Guardar referencia del archivo para poder cargarlo posteriormente
        localStorage.setItem('youtube_m3u_content', m3uContent);
        localStorage.setItem('youtube_m3u_url', url);
        
        console.log(`Lista M3U generada con ${updatedChannels.length} canales`);
    }, []);

    const extractYouTubeStream = useCallback(async (url: string): Promise<{ streamUrl: string; title: string; channelName: string }> => {
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await fetch('/api/youtube_extractor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ youtube_url: url }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Error extrayendo stream de YouTube');
            }

            return {
                streamUrl: data.stream_url,
                title: data.title,
                channelName: data.channel_name
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            setError(errorMessage);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createProxyChannel = useCallback(async (youtubeUrl: string, streamUrl: string, title: string): Promise<string> => {
        try {
            const response = await fetch('/api/youtube_manager', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    youtube_url: youtubeUrl,
                    stream_url: streamUrl,
                    title: title
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Error creando canal proxy');
            }

            return data.proxy_url;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            setError(errorMessage);
            throw error;
        }
    }, []);

    const addYouTubeChannelToPlaylist = useCallback(async (
        youtubeUrl: string,
        customName?: string,
        customGroup?: string,
        customLogo?: string,
        setChannels?: (channels: Channel[] | ((prev: Channel[]) => Channel[])) => void
    ) => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Extraer información del stream
            const { streamUrl, title, channelName } = await extractYouTubeStream(youtubeUrl);
            
            // 2. Crear canal proxy
            const proxyUrl = await createProxyChannel(youtubeUrl, streamUrl, title);
            
            // 3. Crear objeto de canal para YouTube
            const youtubeChannel: YouTubeChannel = {
                id: `youtube_${Date.now()}`,
                name: customName || title,
                group: customGroup || 'YouTube Live',
                url: youtubeUrl,
                proxyUrl: proxyUrl,
                logo: customLogo || '',
                status: 'active',
                lastChecked: new Date().toISOString()
            };

            // 4. Añadir a la lista de canales de YouTube y guardar
            const updatedYouTubeChannels = [...youtubeChannels, youtubeChannel];
            setYoutubeChannels(updatedYouTubeChannels);
            saveChannelsAndGenerateM3U(updatedYouTubeChannels);

            // 5. Añadir al playlist principal si se proporcionó setChannels
            if (setChannels) {
                const playlistChannel: Channel = {
                    id: youtubeChannel.id,
                    order: Date.now(),
                    name: youtubeChannel.name,
                    groupTitle: youtubeChannel.group,
                    url: youtubeChannel.proxyUrl,
                    tvgLogo: youtubeChannel.logo,
                    tvgId: '',
                    tvgName: '',
                    status: 'ok'
                };

                setChannels(prev => [...prev, playlistChannel]);
            }

            return youtubeChannel;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error añadiendo canal de YouTube';
            setError(errorMessage);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [youtubeChannels, extractYouTubeStream, createProxyChannel, saveChannelsAndGenerateM3U]);

    const removeYouTubeChannel = useCallback((channelId: string) => {
        const updatedChannels = youtubeChannels.filter(channel => channel.id !== channelId);
        setYoutubeChannels(updatedChannels);
        saveChannelsAndGenerateM3U(updatedChannels);
    }, [youtubeChannels, saveChannelsAndGenerateM3U]);

    const getM3UContent = useCallback(() => {
        return localStorage.getItem('youtube_m3u_content') || '';
    }, []);

    const downloadM3UFile = useCallback(() => {
        const content = getM3UContent();
        if (content) {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = M3U_FILENAME;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }, [getM3UContent]);

    const refreshChannel = useCallback(async (channelId: string) => {
        const channel = youtubeChannels.find(ch => ch.id === channelId);
        if (!channel) return;

        try {
            setYoutubeChannels(prev => prev.map(ch => 
                ch.id === channelId ? { ...ch, status: 'checking' } : ch
            ));

            const { streamUrl } = await extractYouTubeStream(channel.url);
            const proxyUrl = await createProxyChannel(channel.url, streamUrl, channel.name);

            const updatedChannels = youtubeChannels.map(ch => 
                ch.id === channelId 
                    ? { ...ch, proxyUrl, status: 'active' as const, lastChecked: new Date().toISOString() }
                    : ch
            );
            
            setYoutubeChannels(updatedChannels);
            saveChannelsAndGenerateM3U(updatedChannels);
        } catch (error) {
            setYoutubeChannels(prev => prev.map(ch => 
                ch.id === channelId ? { ...ch, status: 'error' } : ch
            ));
        }
    }, [youtubeChannels, extractYouTubeStream, createProxyChannel, saveChannelsAndGenerateM3U]);

    return {
        channels: youtubeChannels,
        isLoading,
        error,
        extractYouTubeStream,
        createProxyChannel,
        addYouTubeChannelToPlaylist,
        removeYouTubeChannel,
        getM3UContent,
        downloadM3UFile,
        refreshChannel,
        m3uFilename: M3U_FILENAME
    };
};