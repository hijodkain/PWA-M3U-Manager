import { useState, useCallback, useEffect } from 'react';
import { Channel } from './index';
import { SavedUrl } from './useSettings';

interface YouTubeChannel {
    id: string;
    name: string;
    group: string;
    url: string;
    proxyUrl: string;
    streamUrl?: string; // URL directa del stream .m3u8
    logo: string;
    status: 'active' | 'error' | 'checking';
    lastChecked: string;
}

const STORAGE_KEY = 'youtube_channels_list';
const M3U_FILENAME = 'YouTube Live';
const YOUTUBE_PLAYLIST_KEY = 'youtube_playlist_blob_url';

export const useYouTube = (addOrUpdateSavedUrl?: (name: string, url: string) => void) => {
    const [youtubeChannels, setYoutubeChannels] = useState<YouTubeChannel[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cargar canales del localStorage al iniciar y crear lista precargada
    useEffect(() => {
        const savedChannels = localStorage.getItem(STORAGE_KEY);
        if (savedChannels) {
            try {
                const parsedChannels = JSON.parse(savedChannels);
                setYoutubeChannels(parsedChannels);
                // Regenerar la lista M3U con los canales existentes
                if (parsedChannels.length > 0) {
                    saveChannelsAndGenerateM3U(parsedChannels);
                } else {
                    initializeEmptyPlaylist();
                }
            } catch (error) {
                console.error('Error loading saved YouTube channels:', error);
                initializeEmptyPlaylist();
            }
        } else {
            // Si no hay canales guardados, crear lista precargada vacía
            initializeEmptyPlaylist();
        }
    }, []);

    // Función para inicializar lista vacía precargada
    const initializeEmptyPlaylist = useCallback(() => {
        const emptyM3uContent = '#EXTM3U\n# Lista de canales de YouTube Live\n# Esta lista se actualizará automáticamente cuando añadas canales\n';
        const blob = new Blob([emptyM3uContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        localStorage.setItem('youtube_m3u_content', emptyM3uContent);
        localStorage.setItem(YOUTUBE_PLAYLIST_KEY, url);
        
        // Añadir lista precargada vacía a playlists guardadas
        if (addOrUpdateSavedUrl) {
            addOrUpdateSavedUrl(M3U_FILENAME, url);
        }
        
        console.log('Lista de YouTube Live inicializada y guardada en Configuración');
    }, [addOrUpdateSavedUrl]);

    // Guardar canales en localStorage y generar archivo M3U
    const saveChannelsAndGenerateM3U = useCallback((updatedChannels: YouTubeChannel[]) => {
        // Guardar en localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedChannels));
        
        // Generar contenido M3U
        let m3uContent = '#EXTM3U\n';
        if (updatedChannels.length === 0) {
            m3uContent += '# Lista de canales de YouTube Live\n';
            m3uContent += '# Esta lista se actualizará automáticamente cuando añadas canales\n';
        } else {
            // Incluir todos los canales - usar streamUrl si está disponible, sino usar URL placeholder
            updatedChannels.forEach(channel => {
                const logoAttr = channel.logo ? ` tvg-logo="${channel.logo}"` : '';
                m3uContent += `#EXTINF:-1 tvg-name="${channel.name}" group-title="${channel.group}"${logoAttr},${channel.name}\n`;
                
                // Priorizar streamUrl .m3u8 si está disponible y es válida
                if (channel.streamUrl && 
                    channel.streamUrl !== channel.url && 
                    channel.streamUrl !== '' &&
                    channel.status === 'active') {
                    // Usar la URL del stream .m3u8 extraída
                    m3uContent += `${channel.streamUrl}\n`;
                } else {
                    // Si no hay stream válido, usar placeholder temporal
                    // Esto permite que el canal aparezca en la lista aunque no esté activo
                    m3uContent += `# ${channel.url} (Stream no disponible - se actualizará automáticamente)\n`;
                    m3uContent += `https://via.placeholder.com/1x1.mp4\n`; // URL placeholder que no rompe reproductores
                }
            });
        }
        
        // Crear blob y URL
        const blob = new Blob([m3uContent], { type: 'application/x-mpegurl;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        // Guardar referencia del archivo para poder cargarlo posteriormente
        localStorage.setItem('youtube_m3u_content', m3uContent);
        
        // Revocar URL anterior si existe
        const oldUrl = localStorage.getItem(YOUTUBE_PLAYLIST_KEY);
        if (oldUrl) {
            URL.revokeObjectURL(oldUrl);
        }
        
        // Guardar nueva URL
        localStorage.setItem(YOUTUBE_PLAYLIST_KEY, url);
        
        // Añadir/actualizar en playlists guardadas si hay función disponible
        if (addOrUpdateSavedUrl) {
            addOrUpdateSavedUrl(M3U_FILENAME, url);
        }
        
        const activeCount = updatedChannels.filter(ch => ch.status === 'active').length;
        console.log(`Lista M3U generada con ${activeCount}/${updatedChannels.length} canales activos`);
    }, [addOrUpdateSavedUrl]);

    const extractYouTubeStream = useCallback(async (url: string): Promise<{ streamUrl: string; title: string; channelName: string }> => {
        setIsLoading(true);
        setError(null);
        
        console.log('🚀 Iniciando extracción de YouTube:', url);
        
        try {
            const requestBody = { url: url, action: 'extract' };
            console.log('📤 Enviando petición a API:', requestBody);
            
                  const response = await fetch('https://3pcj3j8ovl.execute-api.eu-west-1.amazonaws.com/Prod/extract', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            
            console.log('📡 Respuesta de API recibida:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Error HTTP:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('📦 Data recibida de API:', {
                success: data.success,
                hasStreamUrl: !!data.stream_url,
                streamUrlLength: data.stream_url ? data.stream_url.length : 0,
                streamUrlPreview: data.stream_url ? data.stream_url.substring(0, 100) + '...' : 'N/A',
                error: data.error,
                channelInfo: data.channel_info,
                debugInfo: data.debug_info
            });
            
            // Mostrar información de debug si está disponible
            if (data.debug_info && Array.isArray(data.debug_info)) {
                console.log('🔍 Debug Info del servidor:');
                data.debug_info.forEach((info: string, index: number) => {
                    console.log(`  ${index + 1}. ${info}`);
                });
            }
            
            if (!data.success) {
                console.error('❌ API reportó fallo:', data.error);
                throw new Error(data.error || 'No se pudo extraer el stream');
            }

            // Manejar el formato de respuesta de la API actualizada
            const streamUrl = data.stream_url || '';
            const channelInfo = data.channel_info || {};
            
            console.log('✅ Extracción exitosa:', {
                streamUrlFound: !!streamUrl,
                streamUrlValid: streamUrl.startsWith('https://'),
                isGoogleVideo: streamUrl.includes('googlevideo.com'),
                title: channelInfo.title
            });
            
            return {
                streamUrl: streamUrl,
                title: channelInfo.title || 'Canal de YouTube',
                channelName: channelInfo.title || 'YouTube'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            console.error('💥 Error en extractYouTubeStream:', errorMessage);
            setError(errorMessage);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);    const addYouTubeChannelToPlaylist = useCallback(async (
        youtubeUrl: string,
        customName?: string,
        customGroup?: string,
        customLogo?: string,
        setChannels?: (channels: Channel[] | ((prev: Channel[]) => Channel[])) => void
    ) => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Intentar extraer información del stream
            let streamUrl = '';
            let title = customName || 'Canal de YouTube';
            let channelName = '';
            let extractionSuccess = false;
            
            try {
                const result = await extractYouTubeStream(youtubeUrl);
                streamUrl = result.streamUrl;
                title = customName || result.title;
                channelName = result.channelName;
                extractionSuccess = !!streamUrl;
                
                console.log('Extracción exitosa:', {
                    originalUrl: youtubeUrl,
                    extractedStream: streamUrl,
                    title: title,
                    success: extractionSuccess
                });
            } catch (extractError) {
                console.warn('No se pudo extraer el stream, creando canal placeholder:', extractError);
                // Continuar sin stream, será un placeholder que se actualizará cuando esté en vivo
                streamUrl = '';
                extractionSuccess = false;
            }
            
            // 2. Determinar la URL final a usar
            // IMPORTANTE: Solo usar YouTube URL directa si NO pudimos extraer el .m3u8
            let finalStreamUrl = '';
            let status: 'active' | 'checking' | 'error' = 'checking';
            
            if (extractionSuccess && streamUrl && streamUrl !== youtubeUrl) {
                // Tenemos un stream .m3u8 válido
                finalStreamUrl = streamUrl;
                status = 'active';
                console.log('Usando stream .m3u8 extraído:', finalStreamUrl);
            } else {
                // No pudimos extraer el stream, guardar como placeholder
                finalStreamUrl = ''; // URL vacía, se actualizará con el monitor diario
                status = 'checking';
                console.log('Canal guardado como placeholder, se actualizará cuando esté en vivo');
            }
            
            // 3. Crear objeto de canal para YouTube
            const youtubeChannel: YouTubeChannel = {
                id: `youtube_${Date.now()}`,
                name: title,
                group: customGroup || 'YouTube Live',
                url: youtubeUrl, // URL original de YouTube
                proxyUrl: '', // Ya no usamos proxy
                streamUrl: finalStreamUrl, // URL del stream .m3u8 o vacía
                logo: customLogo || '',
                status: status,
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
                    url: youtubeChannel.streamUrl || youtubeChannel.url, // Usar streamUrl si está disponible
                    tvgLogo: youtubeChannel.logo,
                    tvgId: '',
                    tvgName: '',
                    status: extractionSuccess ? 'ok' : 'pending'
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
    }, [youtubeChannels, extractYouTubeStream, saveChannelsAndGenerateM3U]);

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
            const blob = new Blob([content], { type: 'application/x-mpegurl;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${M3U_FILENAME}.m3u`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }, [getM3UContent]);

    const syncChannelsToFile = useCallback(() => {
        try {
            // Exportar canales de YouTube del localStorage al archivo JSON para el monitor
            const channelsData = localStorage.getItem(STORAGE_KEY);
            if (channelsData) {
                const channels = JSON.parse(channelsData);
                // En un entorno real, esto se haría a través de una API
                // Por ahora, simplemente loggeamos para que se pueda copiar manualmente
                console.log('Canales para sincronizar con youtube_channels.json:', JSON.stringify(channels, null, 2));
            }
        } catch (error) {
            console.error('Error sincronizando canales:', error);
        }
    }, []);

    const refreshChannel = useCallback(async (channelId: string) => {
        const channel = youtubeChannels.find(ch => ch.id === channelId);
        if (!channel) return;

        try {
            const result = await extractYouTubeStream(channel.url);
            const finalStreamUrl = result.streamUrl;
            
            // Actualizar el canal específico
            const updatedChannels = youtubeChannels.map(ch => 
                ch.id === channelId 
                    ? { ...ch, streamUrl: finalStreamUrl, status: 'active' as const, lastChecked: new Date().toISOString() }
                    : ch
            );
            
            setYoutubeChannels(updatedChannels);
            saveChannelsAndGenerateM3U(updatedChannels);
        } catch (error) {
            setYoutubeChannels(prev => prev.map(ch => 
                ch.id === channelId ? { ...ch, status: 'error' } : ch
            ));
        }
    }, [youtubeChannels, extractYouTubeStream, saveChannelsAndGenerateM3U]);    return {
        channels: youtubeChannels,
        isLoading,
        error,
        extractYouTubeStream,
        addYouTubeChannelToPlaylist,
        removeYouTubeChannel,
        getM3UContent,
        downloadM3UFile,
        refreshChannel,
        syncChannelsToFile,
        m3uFilename: M3U_FILENAME
    };
};