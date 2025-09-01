import React, { useState } from 'react';
import { Tab } from './index';
import { useChannels } from './useChannels';
import { useCuration } from './useCuration';
import { useEpg } from './useEpg';
import EditorTab from './EditorTab';
import CurationTab from './CurationTab';
import EpgTab from './EpgTab';
import SaveTab from './SaveTab';

export default function PWAM3UManager() {
    const [activeTab, setActiveTab] = useState<Tab>('editor');
    const channelsHook = useChannels();
    const curationHook = useCuration(channelsHook.channels, channelsHook.setChannels, channelsHook.saveStateToHistory);
    const epgHook = useEpg(channelsHook.channels, channelsHook.setChannels, channelsHook.saveStateToHistory);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'editor':
                return <EditorTab channelsHook={channelsHook} />;
            case 'curation':
                return <CurationTab curationHook={curationHook} channelsHook={channelsHook} />;
            case 'epg':
                return <EpgTab epgHook={epgHook} channelsHook={channelsHook} />;
            case 'save':
                return <SaveTab channelsHook={channelsHook} />;
            default:
                return (
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold text-white">Pestaña en construcción</h2>
                    </div>
                );
        }
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-full mx-auto">
                <h1 className="text-3xl font-bold mb-4 text-blue-400 text-center">Gestor de Listas M3U</h1>
                <div className="mb-6 border-b border-gray-700">
                    <nav className="-mb-px flex space-x-8 justify-center" aria-label="Tabs">
                        {(['editor', 'curation', 'epg', 'save', 'settings'] as Tab[]).map((tab) => {
                            const names = {
                                editor: 'Editor de Playlist',
                                curation: 'Curación',
                                epg: 'EPG',
                                save: 'Guardar y Exportar',
                                settings: 'Configuración',
                            };
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`${
                                        activeTab === tab
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
