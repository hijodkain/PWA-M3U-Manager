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
                return <ReparacionTab reparacionHook={reparacionHook} channelsHook={channelsHook} settingsHook={settingsHook} />;
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
            case 'inicio': return <span className="hidden md:inline">Inicio</span>;
            case 'editor': return <span>Editor</span>;
            case 'reparacion': return <span>Reparar</span>;
            case 'asignar-epg': return <span>EPG</span>;
            case 'save': return <span className="hidden md:inline">Guardar</span>;
            case 'settings': return <span className="hidden md:inline">Configuración</span>;
            case 'ayuda': return <span className="hidden md:inline">Ayuda</span>;
            default: return null;
        }
    };

    const tabs: { id: Tab; icon: React.ElementType }[] = [
        { id: 'inicio', icon: Home },
        { id: 'editor', icon: Edit },
        { id: 'reparacion', icon: Wrench },
        { id: 'asignar-epg', icon: List },
        { id: 'save', icon: Save },
        { id: 'settings', icon: Settings },
        { id: 'ayuda', icon: HelpCircle },
    ];

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-full mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <img src="/logo.svg" alt="Logo" className="h-10 w-10 mr-3" />
                        <div>
                            <h1 className="text-3xl font-bold text-blue-400">M3U Manager</h1>
                            <p className="text-sm text-gray-400">Gestiona las listas M3U de tu Dropbox</p>
                        </div>
                    </div>
                    <button
                        onClick={toggleMode}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                            mode === 'pro'
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                                : 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white'
                        }`}
                    >
                        Modo {mode === 'pro' ? 'Pro' : 'Sencillo'}
                    </button>
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
                                title={tab.id}
                            >
                                <tab.icon className="mr-2 h-5 w-5" />
                                {getTabLabel(tab.id)}
                            </button>
                        ))}
                    </nav>
                </div>
                {renderTabContent()}
            </div>
        </div>
    );
}