import React, { createContext, useContext, useState, useEffect } from 'react';
import { getStorageItem, setStorageItem } from './utils/storage';

type AppMode = 'sencillo' | 'pro';

interface AppModeContextType {
    mode: AppMode;
    toggleMode: () => void;
    isSencillo: boolean;
    isPro: boolean;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export const AppModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<AppMode>('pro');

    // Cargar el modo guardado del localStorage
    useEffect(() => {
        const savedMode = getStorageItem('appMode') as AppMode;
        if (savedMode === 'sencillo' || savedMode === 'pro') {
            setMode(savedMode);
        }
    }, []);

    const toggleMode = () => {
        setMode((prevMode) => {
            const newMode = prevMode === 'pro' ? 'sencillo' : 'pro';
            setStorageItem('appMode', newMode);
            return newMode;
        });
    };

    const value: AppModeContextType = {
        mode,
        toggleMode,
        isSencillo: mode === 'sencillo',
        isPro: mode === 'pro',
    };

    return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
};

export const useAppMode = () => {
    const context = useContext(AppModeContext);
    if (context === undefined) {
        throw new Error('useAppMode must be used within an AppModeProvider');
    }
    return context;
};
