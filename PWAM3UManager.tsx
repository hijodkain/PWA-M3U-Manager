import React, { useState, useEffect } from 'react';
import { Tab, Channel } from './index';
import { useChannels } from './useChannels';
import { useReparacion } from './useReparacion';
import { useAsignarEpg } from './useAsignarEpg';
import { useSettings } from './useSettings';
import { useAppMode } from './AppModeContext';
import { getStorageItem, removeStorageItem } from './utils/storage';
import InicioTab from './InicioTab';
// ... rest of imports
import EditorTab from './EditorTab';
import ReparacionTab from './ReparacionTab';
import AsignarEpgTab from './AsignarEpgTab';
import SaveTab from './SaveTab';
import SettingsTab from './SettingsTab';
import HelpTab from './HelpTab';
import { Home, Edit, Wrench, Settings, Save, HelpCircle } from 'lucide-react';

const EpgIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <path d="M7 10h10" />
        <path d="M7 14h10" />
        <text x="50%" y="17" textAnchor="middle" fontSize="9" fontWeight="bold" stroke="none" fill="currentColor" style={{transformBox: 'fill-box', transformOrigin: 'center'}}>EPG</text>
    </svg>
);

const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: 'inicio', icon: Home, label: 'Inicio' },
    { id: 'editor', icon: Edit, label: 'Editor' },
    { id: 'reparacion', icon: Wrench, label: 'Reparar' },
    { id: 'asignar-epg', icon: EpgIcon, label: 'EPG' },
    { id: 'save', icon: Save, label: 'Guardar' },
    { id: 'settings', icon: Settings, label: 'Ajustes' },
    { id: 'ayuda', icon: HelpCircle, label: 'Ayuda' },
];

export default function PWAM3UManager() {
    const [activeTab, setActiveTab] = useState<Tab>('inicio');
    const [failedChannels, setFailedChannels] = useState<Channel[]>([]);
    const { mode, toggleMode } = useAppMode();
    const channelsHook = useChannels(setFailedChannels);
    const settingsHook = useSettings();
    const reparacionHook = useReparacion(channelsHook.channels, channelsHook.setChannels, channelsHook.saveStateToHistory, settingsHook);
    const epgHook = useAsignarEpg(channelsHook.channels, channelsHook.setChannels, channelsHook.saveStateToHistory, settingsHook);

    // Manejar el retorno de la autenticación de Dropbox
    useEffect(() => {
        const handleDropboxCallback = async () => {
            const searchParams = new URLSearchParams(window.location.search);
            const code = searchParams.get('code');
            const state = searchParams.get('state');

            if (code && state) {
                // Limpiar la URL inmediatamente para evitar procesar el código dos veces o compartirlo
                window.history.replaceState({}, document.title, window.location.pathname);

                const storedState = getStorageItem('dropbox_auth_state');
                const codeVerifier = getStorageItem('dropbox_code_verifier');
                const appKey = getStorageItem('dropbox_temp_app_key');

                if (!storedState || !codeVerifier || !appKey) {
                    console.warn('Callback de Dropbox detectado pero faltan datos de sesión local.');
                    return;
                }

                if (state !== storedState) {
                    alert('Error de seguridad: El estado de autenticación (state) no coincide. Por favor, intenta conectar de nuevo.');
                    return;
                }

                try {
                    // Indicador visual de carga
                    const notification = document.createElement('div');
                    notification.id = 'dropbox-loading-notification';
                    notification.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-4 rounded-lg shadow-xl z-50 flex items-center gap-3 animate-pulse';
                    notification.innerHTML = `
                        <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Finalizando conexión con Dropbox...</span>
                    `;
                    document.body.appendChild(notification);

                    const redirectUri = window.location.origin + '/';
                    
                    // Usar nuestro endpoint API local para evitar problemas de CORS con Dropbox
                    const response = await fetch('/api/dropbox_auth', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json', // Cambiado a JSON para nuestro endpoint
                        },
                        body: JSON.stringify({
                            code,
                            client_id: appKey,
                            code_verifier: codeVerifier,
                            redirect_uri: redirectUri,
                        }),
                    });

                    const data = await response.json();
                    
                    // Eliminar notificación
                    const loadingEl = document.getElementById('dropbox-loading-notification');
                    if (loadingEl) loadingEl.remove();

                    if (data.error) {
                        throw new Error(data.error_description || JSON.stringify(data.error));
                    }

                    if (data.refresh_token) {
                        settingsHook.saveDropboxSettings(appKey, data.refresh_token);
                        
                        // Mensaje de éxito
                        const successMsg = document.createElement('div');
                        successMsg.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl z-50 animate-bounce';
                        successMsg.textContent = '¡Dropbox conectado exitosamente!';
                        document.body.appendChild(successMsg);
                        
                        setTimeout(() => {
                            successMsg.remove();
                            // Navegar a Inicio -> Mis listas de Dropbox
                            setStorageItem('navigate_to_dropbox_lists', 'true');
                            setActiveTab('inicio');
                        }, 2000);

                    } else {
                        alert('Conexión autorizada, pero no se recibió refresh_token. Es posible que ya estuvieras conectado. Intenta usar la aplicación, si falla, vuelve a conectar.');
                        // Aún así guardamos la key, y si hay access token podríamos usarlo, pero la app espera refresh token.
                        // En este caso asumimos éxito parcial.
                        settingsHook.saveDropboxSettings(appKey, data.refresh_token || ''); 
                        
                        setTimeout(() => {
                             // Navegar a Inicio -> Mis listas de Dropbox también en este caso si hay key
                             setStorageItem('navigate_to_dropbox_lists', 'true');
                             setActiveTab('inicio');
                        }, 2000);
                    }

                    // Limpiar storage temporal
                    removeStorageItem('dropbox_auth_state');
                    removeStorageItem('dropbox_code_verifier');
                    removeStorageItem('dropbox_temp_app_key');

                } catch (error: any) {
                    const loadingEl = document.getElementById('dropbox-loading-notification');
                    if (loadingEl) loadingEl.remove();
                    
                    console.error('Error Dropbox Auth:', error);
                    alert(`Error al conectar con Dropbox: ${error.message || error}`);
                }
            }
        };

        handleDropboxCallback();
    }, []);

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
        const isSelected = activeTab === tab;
        const baseClasses = "flex items-center gap-2";

        // Logic for Text Visibility based on specific user priority:
        // 1. Ayuda, Inicio (Disappear first) -> Visible only on lg+
        // 2. Guardar (Disappear second) -> Visible only on md+
        // 3. Ajustes, Editor (Disappear third) -> Visible only on sm+
        // 4. Reparación, EPG (Disappear last) -> Reparación sm+, EPG text always visible
        
        let textClass = "";
        
        switch(tab) {
            case 'ayuda':
            case 'inicio':
                textClass = "hidden lg:inline";
                break;
            case 'save':
                textClass = "hidden md:inline";
                break;
            case 'settings':
            case 'editor':
            case 'reparacion':
                textClass = "hidden sm:inline";
                break;
            case 'asignar-epg':
                textClass = "inline"; // Always show text "EPG"
                break;
            default:
                textClass = "hidden sm:inline";
        }

        const renderIcon = () => {
             const tabDef = TABS.find(t => t.id === tab);
             if (!tabDef) return null;
             const Icon = tabDef.icon;
             
             // EPG Special Case: Hide Icon on Mobile (show text only), Show Icon on Desktop
             if (tab === 'asignar-epg') {
                 // Custom Logic: If small screen, hide icon. 
                 // We use Tailwind 'hidden sm:block' to hide on mobile, show on sm+
                 return <Icon className="h-5 w-5 hidden sm:block" />;
             }
             return <Icon className="h-5 w-5" />;
        };

        const renderText = () => {
            const label = TABS.find(t => t.id === tab)?.label;
            return <span className={textClass}>{label}</span>;
        };

        return (
            <div className={baseClasses}>
                {renderIcon()}
                {renderText()}
            </div>
        );
    };

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
                        {TABS.map((tab) => (
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