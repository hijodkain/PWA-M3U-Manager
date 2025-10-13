import { useState, useEffect, useCallback } from 'react';

export interface SavedUrl {
    id: string;
    name: string;
    url: string;
}

const DB_APP_KEY = 'dropbox_app_key';
const DB_REFRESH_TOKEN_KEY = 'dropbox_refresh_token';
const SAVED_URLS_KEY = 'saved_urls';
const SAVED_EPG_URLS_KEY = 'saved_epg_urls';

export const useSettings = () => {
    const [dropboxAppKey, setDropboxAppKey] = useState('');
    const [dropboxRefreshToken, setDropboxRefreshToken] = useState('');
    const [savedUrls, setSavedUrls] = useState<SavedUrl[]>([]);
    const [savedEpgUrls, setSavedEpgUrls] = useState<SavedUrl[]>([]);

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
        deleteSavedUrl,
        savedEpgUrls,
        addSavedEpgUrl,
        deleteSavedEpgUrl,
    };
};