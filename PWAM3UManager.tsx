import React, { useState, useEffect } from 'react';
import { Tab, Channel } from './index';
import { useChannels } from './useChannels';
import { useCuration } from './useCuration';
import { useEpg } from './useEpg';
import { useSettings } from './useSettings';
import EditorTab from './EditorTab';
import CurationTab from './CurationTab';
import EpgTab from './EpgTab';
import SaveTab from './SaveTab';
import SettingsTab from './SettingsTab';
import HelpTab from './HelpTab';

export default function PWAM3UManager() {
    const [activeTab, setActiveTab] = useState<Tab>('editor');
    const [failedChannels, setFailedChannels] = useState<Channel[]>([]);
    const channelsHook = useChannels(setFailedChannels);
    const settingsHook = useSettings();
    const curationHook = useCuration(channelsHook.channels, channelsHook.setChannels, channelsHook.saveStateToHistory);
    const epgHook = useEpg(channelsHook.channels, channelsHook.setChannels, channelsHook.saveStateToHistory);

    useEffect(() => {
        if (activeTab === 'curation' && failedChannels.length > 0) {
            curationHook.setCurationChannels(failedChannels);
            setFailedChannels([]);
            alert('Los canales que fallaron la verificación se han movido a la pestaña de Curación.');
        }
    }, [activeTab, failedChannels, curationHook, setFailedChannels]);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'editor':
                return <EditorTab channelsHook={channelsHook} settingsHook={settingsHook} />;
            case 'curation':
                return <CurationTab curationHook={curationHook} channelsHook={channelsHook} />;
            case 'epg':
                return <EpgTab epgHook={epgHook} channelsHook={channelsHook} />;
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

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-full mx-auto">
                <div className="flex items-center justify-center mb-4">
                    <img src="/logo.svg" alt="Logo" className="h-10 w-10 mr-3" />
                    <h1 className="text-3xl font-bold text-blue-400">Gestor de Listas M3U</h1>
                </div>
                <div className="mb-6 border-b border-gray-700">
                    <nav className="-mb-px flex space-x-8 justify-center" aria-label="Tabs">
                        {(['editor', 'curation', 'epg', 'save', 'settings', 'ayuda'] as Tab[]).map((tab) => {
                            const names = {
                                editor: 'Editor de Playlist',
                                curation: 'Curación',
                                epg: 'EPG',
                                save: 'Guardar y Exportar',
                                settings: 'Configuración',
                                ayuda: 'Ayuda',
                            };
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`${activeTab === tab
                                            ? 'border-blue-500 text-blue-400'
                                            : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none`}
                                >
                                    {names[tab]}
                                </button>
                            );
                        })}
                    </nav>
                </div>
                {renderTabContent()}
            </div>
        </div>
    );
}