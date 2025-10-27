import { useState, useEffect, useCallback } from 'react';
import { Channel } from './index';

export interface SavedUrl {
    id: string;
    name: string;
    url: string;
}

const DB_APP_KEY = 'dropbox_app_key';
const DB_REFRESH_TOKEN_KEY = 'dropbox_refresh_token';
const SAVED_URLS_KEY = 'saved_urls';
const SAVED_EPG_URLS_KEY = 'saved_epg_urls';
const CHANNEL_PREFIXES_KEY = 'channel_prefixes';
const CHANNEL_SUFFIXES_KEY = 'channel_suffixes';
const YOUTUBE_CHANNELS_KEY = 'youtube_channels';

// Prefijos y sufijos por defecto
const DEFAULT_PREFIXES = ['HD ', 'FHD ', 'UHD ', '4K ', 'SD '];
const DEFAULT_SUFFIXES = [
    ' 4K', ' UHD', ' FHD', ' HD', ' SD', ' HEVC', ' H265', ' H264', ' x265', ' x264', 
    ' 1080p', ' 720p', ' DUAL', ' MULTI', ' (4K)', ' (UHD)', ' (FHD)', ' (HD)', ' (SD)',
    ' [4K]', ' [UHD]', ' [FHD]', ' [HD]', ' [SD]', ' |4K', ' |UHD', ' |FHD', ' |HD', ' |SD'
];

export const useSettings = () => {
    const [dropboxAppKey, setDropboxAppKey] = useState('');
    const [dropboxRefreshToken, setDropboxRefreshToken] = useState('');
    const [savedUrls, setSavedUrls] = useState<SavedUrl[]>([]);
    const [savedEpgUrls, setSavedEpgUrls] = useState<SavedUrl[]>([]);
    const [channelPrefixes, setChannelPrefixes] = useState<string[]>(DEFAULT_PREFIXES);
    const [channelSuffixes, setChannelSuffixes] = useState<string[]>(DEFAULT_SUFFIXES);
    const [youtubeChannels, setYoutubeChannels] = useState<Channel[]>([]);

    useEffect(() => {
        try {
            setDropboxAppKey(localStorage.getItem(DB_APP_KEY) || '');
            setDropboxRefreshToken(localStorage.getItem(DB_REFRESH_TOKEN_KEY) || '');

            const savedUrlsJson = localStorage.getItem(SAVED_URLS_KEY);
            if (savedUrlsJson) {
                setSavedUrls(JSON.parse(savedUrlsJson));
            }

            const savedEpgUrlsJson = localStorage.getItem(SAVED_EPG_URLS_KEY);
            if (savedEpgUrlsJson) {
                setSavedEpgUrls(JSON.parse(savedEpgUrlsJson));
            }

            const savedPrefixesJson = localStorage.getItem(CHANNEL_PREFIXES_KEY);
            if (savedPrefixesJson) {
                setChannelPrefixes(JSON.parse(savedPrefixesJson));
            }

            const savedSuffixesJson = localStorage.getItem(CHANNEL_SUFFIXES_KEY);
            if (savedSuffixesJson) {
                setChannelSuffixes(JSON.parse(savedSuffixesJson));
            }

            const youtubeChannelsJson = localStorage.getItem(YOUTUBE_CHANNELS_KEY);
            if (youtubeChannelsJson) {
                setYoutubeChannels(JSON.parse(youtubeChannelsJson));
            }
        } catch (error) {
            console.error("Error loading settings from localStorage", error);
        }
    }, []);

    const saveDropboxSettings = useCallback((appKey: string, refreshToken: string) => {
        try {
            localStorage.setItem(DB_APP_KEY, appKey);
            setDropboxAppKey(appKey);
            localStorage.setItem(DB_REFRESH_TOKEN_KEY, refreshToken);
            setDropboxRefreshToken(refreshToken);
        } catch (error) {
            console.error("Error saving Dropbox settings to localStorage", error);
        }
    }, []);

    const clearDropboxSettings = useCallback(() => {
        try {
            localStorage.removeItem(DB_APP_KEY);
            setDropboxAppKey('');
            localStorage.removeItem(DB_REFRESH_TOKEN_KEY);
            setDropboxRefreshToken('');
        } catch (error) {
            console.error("Error clearing Dropbox settings from localStorage", error);
        }
    }, []);

    const updateChannelPrefixes = useCallback((prefixes: string[]) => {
        try {
            localStorage.setItem(CHANNEL_PREFIXES_KEY, JSON.stringify(prefixes));
            setChannelPrefixes(prefixes);
        } catch (error) {
            console.error("Error saving channel prefixes to localStorage", error);
        }
    }, []);

    const updateChannelSuffixes = useCallback((suffixes: string[]) => {
        try {
            localStorage.setItem(CHANNEL_SUFFIXES_KEY, JSON.stringify(suffixes));
            setChannelSuffixes(suffixes);
        } catch (error) {
            console.error("Error saving channel suffixes to localStorage", error);
        }
    }, []);

    const resetChannelPrefixesAndSuffixes = useCallback(() => {
        try {
            localStorage.setItem(CHANNEL_PREFIXES_KEY, JSON.stringify(DEFAULT_PREFIXES));
            localStorage.setItem(CHANNEL_SUFFIXES_KEY, JSON.stringify(DEFAULT_SUFFIXES));
            setChannelPrefixes(DEFAULT_PREFIXES);
            setChannelSuffixes(DEFAULT_SUFFIXES);
        } catch (error) {
            console.error("Error resetting channel prefixes and suffixes", error);
        }
    }, []);

    const addSavedUrl = useCallback((name: string, url: string) => {
        if (!name || !url) return;
        const newUrl: SavedUrl = { id: `url-${Date.now()}`, name, url };
        const updatedUrls = [...savedUrls, newUrl];
        try {
            localStorage.setItem(SAVED_URLS_KEY, JSON.stringify(updatedUrls));
            setSavedUrls(updatedUrls);
        } catch (error) {
            console.error("Error saving URL to localStorage", error);
        }
    }, [savedUrls]);

    const addOrUpdateSavedUrl = useCallback((name: string, url: string) => {
        if (!name || !url) return;
        
        // Buscar si ya existe una URL con ese nombre
        const existingIndex = savedUrls.findIndex(savedUrl => savedUrl.name === name);
        
        let updatedUrls: SavedUrl[];
        if (existingIndex >= 0) {
            // Actualizar URL existente
            updatedUrls = [...savedUrls];
            updatedUrls[existingIndex] = { ...updatedUrls[existingIndex], url };
        } else {
            // Añadir nueva URL
            const newUrl: SavedUrl = { id: `url-${Date.now()}`, name, url };
            updatedUrls = [...savedUrls, newUrl];
        }
        
        try {
            localStorage.setItem(SAVED_URLS_KEY, JSON.stringify(updatedUrls));
            setSavedUrls(updatedUrls);
        } catch (error) {
            console.error("Error saving URL to localStorage", error);
        }
    }, [savedUrls]);

    const deleteSavedUrl = useCallback((id: string) => {
        const updatedUrls = savedUrls.filter(url => url.id !== id);
        try {
            localStorage.setItem(SAVED_URLS_KEY, JSON.stringify(updatedUrls));
            setSavedUrls(updatedUrls);
        } catch (error) {
            console.error("Error deleting URL from localStorage", error);
        }
    }, [savedUrls]);

    const addSavedEpgUrl = useCallback((name: string, url: string) => {
        if (!name || !url) return;
        const newEpgUrl: SavedUrl = { id: `epg-url-${Date.now()}`, name, url };
        const updatedEpgUrls = [...savedEpgUrls, newEpgUrl];
        try {
            localStorage.setItem(SAVED_EPG_URLS_KEY, JSON.stringify(updatedEpgUrls));
            setSavedEpgUrls(updatedEpgUrls);
        } catch (error) {
            console.error("Error saving EPG URL to localStorage", error);
        }
    }, [savedEpgUrls]);

    const deleteSavedEpgUrl = useCallback((id: string) => {
        const updatedEpgUrls = savedEpgUrls.filter(url => url.id !== id);
        try {
            localStorage.setItem(SAVED_EPG_URLS_KEY, JSON.stringify(updatedEpgUrls));
            setSavedEpgUrls(updatedEpgUrls);
        } catch (error) {
            console.error("Error deleting EPG URL from localStorage", error);
        }
    }, [savedEpgUrls]);

    // Gestión de canales de YouTube
    const addYoutubeChannel = useCallback((channel: Channel) => {
        const updatedChannels = [...youtubeChannels, channel];
        try {
            localStorage.setItem(YOUTUBE_CHANNELS_KEY, JSON.stringify(updatedChannels));
            setYoutubeChannels(updatedChannels);
        } catch (error) {
            console.error("Error saving YouTube channel to localStorage", error);
        }
    }, [youtubeChannels]);

    const addYoutubeChannels = useCallback((channels: Channel[]) => {
        const updatedChannels = [...youtubeChannels, ...channels];
        try {
            localStorage.setItem(YOUTUBE_CHANNELS_KEY, JSON.stringify(updatedChannels));
            setYoutubeChannels(updatedChannels);
        } catch (error) {
            console.error("Error saving YouTube channels to localStorage", error);
        }
    }, [youtubeChannels]);

    const deleteYoutubeChannel = useCallback((id: string) => {
        const updatedChannels = youtubeChannels.filter(ch => ch.id !== id);
        try {
            localStorage.setItem(YOUTUBE_CHANNELS_KEY, JSON.stringify(updatedChannels));
            setYoutubeChannels(updatedChannels);
        } catch (error) {
            console.error("Error deleting YouTube channel from localStorage", error);
        }
    }, [youtubeChannels]);

    const clearYoutubeChannels = useCallback(() => {
        try {
            localStorage.setItem(YOUTUBE_CHANNELS_KEY, JSON.stringify([]));
            setYoutubeChannels([]);
        } catch (error) {
            console.error("Error clearing YouTube channels from localStorage", error);
        }
    }, []);

    const exportYoutubeM3U = useCallback(() => {
        if (youtubeChannels.length === 0) {
            return null;
        }

        let m3uContent = '#EXTM3U\n';
        youtubeChannels.forEach((channel) => {
            const tvgId = channel.tvgId || '';
            const tvgName = channel.tvgName || channel.name;
            const tvgLogo = channel.tvgLogo || '';
            const groupTitle = channel.groupTitle || 'YouTube Live';

            m3uContent += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${tvgLogo}" group-title="${groupTitle}",${channel.name}\n`;
            m3uContent += `${channel.url}\n`;
        });

        return m3uContent;
    }, [youtubeChannels]);

    const downloadYoutubeM3U = useCallback(() => {
        const content = exportYoutubeM3U();
        if (!content) {
            alert('No hay canales de YouTube para exportar');
            return;
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Youtube.m3u';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [exportYoutubeM3U]);

    return {
        dropboxAppKey,
        dropboxRefreshToken,
        saveDropboxSettings,
        clearDropboxSettings,
        savedUrls,
        addSavedUrl,
        addOrUpdateSavedUrl,
        deleteSavedUrl,
        savedEpgUrls,
        addSavedEpgUrl,
        deleteSavedEpgUrl,
        channelPrefixes,
        channelSuffixes,
        updateChannelPrefixes,
        updateChannelSuffixes,
        resetChannelPrefixesAndSuffixes,
        youtubeChannels,
        addYoutubeChannel,
        addYoutubeChannels,
        deleteYoutubeChannel,
        clearYoutubeChannels,
        exportYoutubeM3U,
        downloadYoutubeM3U,
    };
};