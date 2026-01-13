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
    };
};