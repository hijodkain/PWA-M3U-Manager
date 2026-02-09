import React, { useState, useEffect } from 'react';
import { Tab, Channel } from './index';
import { useChannels } from './useChannels';
import { useReparacion } from './useReparacion';
import { useAsignarEpg } from './useAsignarEpg';
import { useSettings } from './useSettings';
import { useAppMode } from './AppModeContext';
import InicioTab from './InicioTab';
import EditorTab from './EditorTab';
import ReparacionTab from './ReparacionTab';
import AsignarEpgTab from './AsignarEpgTab';
import SaveTab from './SaveTab';
import SettingsTab from './SettingsTab';
import HelpTab from './HelpTab';
import { Home, Edit, Wrench, List, Settings, Save, HelpCircle } from 'lucide-react';

export default function PWAM3UManager() {
    const [activeTab, setActiveTab] = useState<Tab>('inicio');
    const [failedChannels, setFailedChannels] = useState<Channel[]>([]);
    const { mode, toggleMode } = useAppMode();
    const channelsHook = useChannels(setFailedChannels);
    const settingsHook = useSettings();
    const reparacionHook = useReparacion(channelsHook.channels, channelsHook.setChannels, channelsHook.saveStateToHistory, settingsHook);
    const epgHook = useAsignarEpg(channelsHook.channels, channelsHook.setChannels, channelsHook.saveStateToHistory, settingsHook);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'inicio':
                return <InicioTab channelsHook={channelsHook} settingsHook={settingsHook} onNavigateToEditor={() => setActiveTab('editor')} onNavigateToSettings={() => setActiveTab('settings')} />;
            case 'editor':
                return <EditorTab channelsHook={channelsHook} settingsHook={settingsHook} />;
            case 'reparacion':
                return <ReparacionTab 
                    reparacionHook={reparacionHook} 
                    channelsHook={channelsHook} 
                    settingsHook={settingsHook} 
                    onNavigateToSave={() => setActiveTab('save')}
                    onNavigateToInicio={() => setActiveTab('inicio')}
                />;
            case 'asignar-epg':
                return <AsignarEpgTab epgHook={epgHook} channelsHook={channelsHook} settingsHook={settingsHook} />;
            case 'save':
                return <SaveTab channelsHook={channelsHook} settingsHook={settingsHook} />;
            case 'settings':
                return <SettingsTab settingsHook={settingsHook} />;
            case 'ayuda':
                return <HelpTab />;
            default:
                return (
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold text-white">Pestaña no encontrada</h2>
                    </div>
                );
        }
    };

    const getTabContent = (tab: Tab) => {
        // Desktop: Icon + Text (Always)
        // Mobile Rules:
        // - Editor, Reparar: Icon + Text
        // - EPG: Text Only
        // - Others: Icon Only
        
        const isSelected = activeTab === tab;
        const baseClasses = "flex items-center gap-2";

        // Icon Rendering
        const renderIcon = () => {
             const Icon = tabs.find(t => t.id === tab)?.icon;
             if (!Icon) return null;
             
             // EPG Special Case: Hidden on Mobile
             if (tab === 'asignar-epg') {
                 return <Icon className="h-5 w-5 hidden sm:block" />;
             }
             return <Icon className="h-5 w-5" />;
        };

        // Text Rendering
        const renderText = () => {
            const label = tabs.find(t => t.id === tab)?.label;
            
            // Cases where text is shown on mobile
            if (tab === 'editor' || tab === 'reparacion' || tab === 'asignar-epg') {
                return <span>{label}</span>;
            }
            
            // Default: Hidden on mobile, inline on sm+
            return <span className="hidden sm:inline">{label}</span>;
        };

        return (
            <div className={baseClasses}>
                {renderIcon()}
                {renderText()}
            </div>
        );
    };

    const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
        { id: 'inicio', icon: Home, label: 'Inicio' },
        { id: 'editor', icon: Edit, label: 'Editor' },
        { id: 'reparacion', icon: Wrench, label: 'Reparar' },
        { id: 'asignar-epg', icon: List, label: 'EPG' },
        { id: 'save', icon: Save, label: 'Guardar' },
        { id: 'settings', icon: Settings, label: 'Ajustes' },
        { id: 'ayuda', icon: HelpCircle, label: 'Ayuda' },
    ];

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans flex flex-col">
            
            {/* 1. Static Header (Scrolls away) */}
             <div className="bg-gray-900 border-b border-gray-800">
                <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between py-3">
                        <div className="flex items-center">
                            <img src="/logo.svg" alt="Logo" className="h-8 w-8 mr-3" />
                             <div>
                                <h1 className="text-xl font-bold text-blue-400">M3U Manager</h1>
                                <p className="text-xs text-gray-400 hidden sm:block">Gestión inteligente de listas IPTV</p>
                            </div>
                        </div>
                        <div>
                            <button
                                onClick={toggleMode}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all shadow-lg ${
                                    mode === 'pro'
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-900/50'
                                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-900/50'
                                }`}
                            >
                                {mode === 'pro' ? 'MODO PRO' : 'MODO LITE'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Sticky Navigation Bar */}
            <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm shadow-xl border-b border-gray-800">
                <div className="max-w-full mx-auto px-1 sm:px-6 lg:px-8">
                     <nav className="flex items-center justify-center space-x-1 sm:space-x-2 py-2 overflow-x-auto no-scrollbar" aria-label="Tabs">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`${activeTab === tab.id
                                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
                                    } px-2 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all focus:outline-none whitespace-nowrap`}
                            >
                                {getTabContent(tab.id)}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>
            
            {/* 3. Main Content */}
            <div className="flex-grow p-0 sm:p-6 lg:p-8 max-w-full mx-auto w-full overflow-x-hidden">
                {renderTabContent()}
            </div>
        </div>
    );
}