import { useState, useEffect, useCallback } from 'react';
import { ChannelVerification } from './useReparacion';

export interface YouTubeChannel {
    id: string;
    name: string;
    channelUrl: string;
    group: string;
    intervalMinutes: number;
    addedDate: string;
}

export interface YouTubeChannelStatus extends YouTubeChannel {
    isLive: boolean;
    currentTitle?: string;
    currentVideoId?: string;
    streamUrl?: string;
    lastCheck: string;
    verification: ChannelVerification;
}

interface YouTubeLiveSettings {
    enabled: boolean;
    globalInterval: number;
    lastUpdate: string;
}

export const useYouTubeLiveMonitor = () => {
    const [channels, setChannels] = useState<YouTubeChannel[]>([]);
    const [channelsStatus, setChannelsStatus] = useState<Record<string, YouTubeChannelStatus>>({});
    const [settings, setSettings] = useState<YouTubeLiveSettings>({
        enabled: true,
        globalInterval: 5, // minutos
        lastUpdate: new Date().toISOString()
    });

    // Cargar datos desde localStorage al iniciar
    useEffect(() => {
        const savedChannels = localStorage.getItem('youtube_live_channels');
        const savedSettings = localStorage.getItem('youtube_live_settings');
        
        if (savedChannels) {
            setChannels(JSON.parse(savedChannels));
        }
        if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
        }
    }, []);

    // Guardar cambios en localStorage
    useEffect(() => {
        localStorage.setItem('youtube_live_channels', JSON.stringify(channels));
    }, [channels]);

    useEffect(() => {
        localStorage.setItem('youtube_live_settings', JSON.stringify(settings));
    }, [settings]);

    // Monitoreo automático
    useEffect(() => {
        if (!settings.enabled) return;

        const checkInterval = setInterval(() => {
            checkAllChannels();
        }, settings.globalInterval * 60 * 1000);

        return () => clearInterval(checkInterval);
    }, [settings.enabled, settings.globalInterval]);

    const checkAllChannels = useCallback(async () => {
        for (const channel of channels) {
            await checkChannel(channel.id);
        }
    }, [channels]);

    const checkChannel = async (channelId: string) => {
        const channel = channels.find(c => c.id === channelId);
        if (!channel) return;

        try {
            setChannelsStatus(prev => ({
                ...prev,
                [channelId]: {
                    ...prev[channelId],
                    verification: { status: 'verifying' }
                }
            }));

            const response = await fetch('/api/youtube_live_monitor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelUrl: channel.channelUrl })
            });

            const data = await response.json();

            if (data.success) {
                setChannelsStatus(prev => ({
                    ...prev,
                    [channelId]: {
                        ...channel,
                        isLive: data.channel_info.is_live,
                        currentTitle: data.channel_info.streams[0]?.title,
                        currentVideoId: data.channel_info.streams[0]?.video_id,
                        streamUrl: data.channel_info.streams[0]?.stream_url,
                        lastCheck: new Date().toISOString(),
                        verification: {
                            status: data.channel_info.is_live ? '🔴 LIVE' : '⚫ OFFLINE',
                            elapsed: data.channel_info.elapsed_ms
                        }
                    }
                }));
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            setChannelsStatus(prev => ({
                ...prev,
                [channelId]: {
                    ...prev[channelId],
                    verification: { status: 'failed' }
                }
            }));
        }
    };

    const addChannel = (channel: Omit<YouTubeChannel, 'id' | 'addedDate'>) => {
        const newChannel: YouTubeChannel = {
            ...channel,
            id: `yt-${Date.now()}`,
            addedDate: new Date().toISOString()
        };
        setChannels(prev => [...prev, newChannel]);
    };

    const removeChannel = (channelId: string) => {
        setChannels(prev => prev.filter(c => c.id !== channelId));
        setChannelsStatus(prev => {
            const { [channelId]: removed, ...rest } = prev;
            return rest;
        });
    };

    const updateSettings = (newSettings: Partial<YouTubeLiveSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    const getLiveChannels = useCallback(() => {
        return Object.values(channelsStatus).filter(
            status => status.verification.status === '🔴 LIVE'
        );
    }, [channelsStatus]);

    return {
        channels,
        channelsStatus,
        settings,
        addChannel,
        removeChannel,
        updateSettings,
        checkChannel,
        checkAllChannels,
        getLiveChannels,
    };
};