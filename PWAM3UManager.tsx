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

    const getTabLabel = (tab: Tab) => {
        switch (tab) {
            case 'inicio': return null;
            case 'editor': return <span className="hidden sm:inline ml-2">Editor</span>;
            case 'reparacion': return <span className="hidden sm:inline ml-2">Reparar</span>;
            case 'asignar-epg': return <span className="hidden sm:inline ml-2">EPG</span>;
            case 'save': return null;
            case 'settings': return null;
            case 'ayuda': return null;
            default: return null;
        }
    };

    const tabs: { id: Tab; icon: React.ElementType; label?: string }[] = [
        { id: 'inicio', icon: Home, label: 'Inicio' },
        { id: 'editor', icon: Edit, label: 'Editor' },
        { id: 'reparacion', icon: Wrench, label: 'Reparación' },
        { id: 'asignar-epg', icon: List, label: 'Asignar EPG' },
        { id: 'save', icon: Save, label: 'Guardar' },
        { id: 'settings', icon: Settings, label: 'Configuración' },
        { id: 'ayuda', icon: HelpCircle, label: 'Ayuda' },
    ];

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
             <div className="sticky top-0 z-50 bg-gray-900 shadow-md border-b border-gray-800">
                <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between py-3">
                        <div className="flex items-center">
                            <img src="/logo.svg" alt="Logo" className="h-8 w-8 mr-3" />
                             <div>
                                <h1 className="text-xl font-bold text-blue-400 hidden md:block">M3U Manager</h1>
                            </div>
                        </div>
                         <div className="overflow-x-auto no-scrollbar ml-4">
                            <nav className="flex space-x-2 sm:space-x-4" aria-label="Tabs">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`${activeTab === tab.id
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                            } flex items-center justify-center px-3 py-2 rounded-md font-medium text-sm transition-colors focus:outline-none`}
                                        title={tab.label}
                                    >
                                        <tab.icon className={`h-5 w-5 ${getTabLabel(tab.id) ? '' : ''}`} />
                                        {getTabLabel(tab.id)}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="ml-4">
                            <button
                                onClick={toggleMode}
                                className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-all ${
                                    mode === 'pro'
                                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                            >
                                {mode === 'pro' ? 'Pro' : 'Lite'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="p-4 sm:p-6 lg:p-8 max-w-full mx-auto">
                {renderTabContent()}
            </div>
        </div>
    );
}