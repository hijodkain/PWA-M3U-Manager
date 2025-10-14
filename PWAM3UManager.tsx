import React, { useState, useEffect } from 'react';
import { Tab, Channel } from './index';
import { useChannels } from './useChannels';
import { useReparacion } from './useReparacion';
import { useAsignarEpg } from './useAsignarEpg';
import { useSettings } from './useSettings';
import EditorTab from './EditorTab';
import ReparacionTab from './ReparacionTab';
import AsignarEpgTab from './AsignarEpgTab';
import { YouTubeTab } from './YouTubeTab';
import SaveTab from './SaveTab';
import SettingsTab from './SettingsTab';
import HelpTab from './HelpTab';
import { Edit, Wrench, List, Settings, Save, HelpCircle, Youtube } from 'lucide-react';

export default function PWAM3UManager() {
    const [activeTab, setActiveTab] = useState<Tab>('editor');
    const [failedChannels, setFailedChannels] = useState<Channel[]>([]);
    const channelsHook = useChannels(setFailedChannels);
    const settingsHook = useSettings();
    const reparacionHook = useReparacion(channelsHook.channels, channelsHook.setChannels, channelsHook.saveStateToHistory);
    const epgHook = useAsignarEpg(channelsHook.channels, channelsHook.setChannels, channelsHook.saveStateToHistory);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'editor':
                return <EditorTab channelsHook={channelsHook} settingsHook={settingsHook} />;
            case 'reparacion':
                return <ReparacionTab reparacionHook={reparacionHook} channelsHook={channelsHook} settingsHook={settingsHook} />;
            case 'asignar-epg':
                return <AsignarEpgTab epgHook={epgHook} channelsHook={channelsHook} settingsHook={settingsHook} />;
            case 'youtube':
                return <YouTubeTab channels={channelsHook.channels} setChannels={channelsHook.setChannels} settingsHook={settingsHook} />;
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

    const tabs: { id: Tab; name: string; icon: React.ElementType }[] = [
        { id: 'editor', name: 'Editor de Playlist', icon: Edit },
        { id: 'reparacion', name: 'Reparación', icon: Wrench },
        { id: 'asignar-epg', name: 'Asignar EPG', icon: List },
        { id: 'youtube', name: 'YouTube Live', icon: Youtube },
        { id: 'save', name: 'Guardar y Exportar', icon: Save },
        { id: 'settings', name: 'Configuración', icon: Settings },
        { id: 'ayuda', name: 'Ayuda', icon: HelpCircle },
    ];

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-full mx-auto">
                <div className="flex items-center justify-center mb-4">
                    <img src="/logo.svg" alt="Logo" className="h-10 w-10 mr-3" />
                    <h1 className="text-3xl font-bold text-blue-400">Gestor de Listas M3U</h1>
                </div>
                <div className="mb-6 border-b border-gray-700">
                    <nav className="-mb-px flex space-x-8 justify-center" aria-label="Tabs">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-400'
                                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                                    } flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none`}
                            >
                                <tab.icon className="mr-2 h-5 w-5" />
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>
                {renderTabContent()}
            </div>
        </div>
    );
}