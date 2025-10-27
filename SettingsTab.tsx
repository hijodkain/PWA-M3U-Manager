import React, { useState, useEffect } from 'react';
import { ExternalLink, XCircle, PlusCircle, Trash2 } from 'lucide-react';
import { useSettings } from './useSettings';

interface SettingsTabProps {
    settingsHook: ReturnType<typeof useSettings>;
}

// Helper function to generate a random string for PKCE and state
const generateRandomString = (length: number) => {
    const randomBytes = new Uint8Array(length);
    window.crypto.getRandomValues(randomBytes);
    return btoa(String.fromCharCode.apply(null, Array.from(randomBytes)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

// Helper function to generate the code challenge from the verifier
const generateCodeChallenge = async (verifier: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(hash))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

const SettingsTab: React.FC<SettingsTabProps> = ({ settingsHook }) => {
    const {
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
        channelPrefixes,
        channelSuffixes,
        updateChannelPrefixes,
        updateChannelSuffixes,
        resetChannelPrefixesAndSuffixes,
        youtubeChannels,
        deleteYoutubeChannel,
        clearYoutubeChannels,
        downloadYoutubeM3U,
    } = settingsHook;

    const [appKey, setAppKey] = useState(dropboxAppKey);
    const [newUrlName, setNewUrlName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newEpgUrlName, setNewEpgUrlName] = useState('');
    const [newEpgUrl, setNewEpgUrl] = useState('');
    const [authStatus, setAuthStatus] = useState('');
    const [newPrefix, setNewPrefix] = useState('');
    const [newSuffix, setNewSuffix] = useState('');

    useEffect(() => {
        setAppKey(dropboxAppKey);
    }, [dropboxAppKey]);

    const handleDropboxConnect = async () => {
        if (!appKey) {
            setAuthStatus('Por favor, introduce tu App Key de Dropbox primero.');
            return;
        }

        try {
            const verifier = generateRandomString(32);
            const challenge = await generateCodeChallenge(verifier);
            const state = generateRandomString(16);

            // Save the verifier, appKey, and state in localStorage to use after redirect
            localStorage.setItem('dropbox_pkce_verifier', verifier);
            localStorage.setItem('dropbox_app_key_temp', appKey);
            localStorage.setItem('dropbox_oauth_state', state);

            const redirectUri = window.location.origin + window.location.pathname;
            const authUrlParams = new URLSearchParams({
                client_id: appKey,
                response_type: 'code',
                token_access_type: 'offline',
                code_challenge: challenge,
                code_challenge_method: 'S256',
                redirect_uri: redirectUri,
                state: state,
                scope: 'files.content.write',
            });

            const authUrl = `https://www.dropbox.com/oauth2/authorize?${authUrlParams.toString()}`;
            
            window.location.href = authUrl;
        } catch (error) {
            console.error("Error during Dropbox auth initialization", error);
            setAuthStatus('Error al iniciar la autenticación con Dropbox.');
        }
    };

    const handleDropboxDisconnect = () => {
        clearDropboxSettings();
        setAuthStatus('Desconectado de Dropbox.');
    };

    const handleAddUrl = (e: React.FormEvent) => {
        e.preventDefault();
        if (newUrlName && newUrl) {
            addSavedUrl(newUrlName, newUrl);
            setNewUrlName('');
            setNewUrl('');
        }
    };

    const handleAddEpgUrl = (e: React.FormEvent) => {
        e.preventDefault();
        if (newEpgUrlName && newEpgUrl) {
            addSavedEpgUrl(newEpgUrlName, newEpgUrl);
            setNewEpgUrlName('');
            setNewEpgUrl('');
        }
    };

    const handleAddPrefix = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPrefix.trim() && !channelPrefixes.includes(newPrefix.trim())) {
            updateChannelPrefixes([...channelPrefixes, newPrefix.trim()]);
            setNewPrefix('');
        }
    };

    const handleRemovePrefix = (prefixToRemove: string) => {
        updateChannelPrefixes(channelPrefixes.filter(prefix => prefix !== prefixToRemove));
    };

    const handleAddSuffix = (e: React.FormEvent) => {
        e.preventDefault();
        if (newSuffix.trim() && !channelSuffixes.includes(newSuffix.trim())) {
            updateChannelSuffixes([...channelSuffixes, newSuffix.trim()]);
            setNewSuffix('');
        }
    };

    const handleRemoveSuffix = (suffixToRemove: string) => {
        updateChannelSuffixes(channelSuffixes.filter(suffix => suffix !== suffixToRemove));
    };

    // This effect runs on component mount and handles the redirect back from Dropbox
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        const receivedState = urlParams.get('state');

        if (authCode && receivedState) {
            const verifier = localStorage.getItem('dropbox_pkce_verifier');
            const tempAppKey = localStorage.getItem('dropbox_app_key_temp');
            const savedState = localStorage.getItem('dropbox_oauth_state');

            if (receivedState !== savedState) {
                setAuthStatus('Error: El estado de la autorización no coincide. Inténtalo de nuevo.');
                console.error("OAuth state mismatch");
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }

            if (verifier && tempAppKey) {
                setAuthStatus('Obteniendo token de refresco...');
                
                fetch('https://api.dropboxapi.com/oauth2/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: tempAppKey,
                        grant_type: 'authorization_code',
                        code: authCode,
                        code_verifier: verifier,
                        redirect_uri: window.location.origin + window.location.pathname
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        response.json().then(err => console.error('Token exchange error:', err));
                        throw new Error('Fallo al obtener el token de refresco.');
                    }
                    return response.json();
                })
                .then(data => {
                    saveDropboxSettings(tempAppKey, data.refresh_token);
                    setAuthStatus('¡Conectado a Dropbox con éxito!');
                })
                .catch(error => {
                    console.error("Error fetching refresh token", error);
                    setAuthStatus(`Error: ${error.message}`);
                })
                .finally(() => {
                    // Clean up localStorage and URL
                    localStorage.removeItem('dropbox_pkce_verifier');
                    localStorage.removeItem('dropbox_app_key_temp');
                    localStorage.removeItem('dropbox_oauth_state');
                    window.history.replaceState({}, document.title, window.location.pathname);
                });
            }
        }
    }, [saveDropboxSettings]);

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-white space-y-8">
            
            <div>
                <h2 className="text-xl font-bold mb-4">Configuración de Dropbox</h2>
                <div className="flex flex-col gap-4 md:w-1/2">
                    {dropboxRefreshToken ? (
                        <div>
                            <p className="text-green-400 font-semibold">Conectado a Dropbox.</p>
                            <p className="text-xs text-gray-400">App Key: {dropboxAppKey}</p>
                            <button
                                onClick={handleDropboxDisconnect}
                                className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center w-full md:w-auto self-start"
                            >
                                <XCircle size={18} className="mr-2" />
                                Desconectar
                            </button>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label htmlFor="dropbox-app-key" className="block text-sm font-medium text-gray-300 mb-2">
                                    Dropbox App Key
                                </label>
                                <input
                                    id="dropbox-app-key"
                                    type="text"
                                    placeholder="Pega tu App Key aquí"
                                    value={appKey}
                                    onChange={(e) => setAppKey(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <button
                                onClick={handleDropboxConnect}
                                disabled={!appKey}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center w-full md:w-auto self-start disabled:bg-gray-600"
                            >
                                <ExternalLink size={18} className="mr-2" />
                                Conectar a Dropbox
                            </button>
                        </>
                    )}
                    {authStatus && <p className="text-sm text-yellow-400 mt-2">{authStatus}</p>}
                </div>
            </div>

            <hr className="my-8 border-gray-600" />

            <div>
                <h2 className="text-xl font-bold mb-4">Playlists Guardadas</h2>
                
                <form onSubmit={handleAddUrl} className="bg-gray-700 p-4 rounded-lg mb-6 space-y-4 md:space-y-0 md:flex md:items-end md:gap-4">
                    <div className="flex-grow">
                        <label htmlFor="playlist-name" className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                        <input
                            id="playlist-name"
                            type="text"
                            placeholder="Ej: Lista de Casa"
                            value={newUrlName}
                            onChange={(e) => setNewUrlName(e.target.value)}
                            className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex-grow-[2]">
                        <label htmlFor="playlist-url" className="block text-sm font-medium text-gray-300 mb-1">URL</label>
                        <input
                            id="playlist-url"
                            type="url"
                            placeholder="https://..."
                            value={newUrl}
                            onChange={(e) => setNewUrl(e.target.value)}
                            className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center w-full md:w-auto">
                        <PlusCircle size={18} className="mr-2" />
                        Añadir
                    </button>
                </form>

                <div className="space-y-3">
                    {savedUrls.length > 0 ? (
                        savedUrls.map(item => (
                            <div key={item.id} className="bg-gray-700 p-3 rounded-md flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{item.name}</p>
                                    <p className="text-xs text-gray-400 truncate">{item.url}</p>
                                </div>
                                <button onClick={() => deleteSavedUrl(item.id)} className="text-red-400 hover:text-red-600 p-2">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-400">No tienes ninguna URL guardada.</p>
                    )}
                </div>
            </div>

            <hr className="my-8 border-gray-600" />

            <div>
                <h2 className="text-xl font-bold mb-4">Fuentes EPG Guardadas</h2>
                
                <form onSubmit={handleAddEpgUrl} className="bg-gray-700 p-4 rounded-lg mb-6 space-y-4 md:space-y-0 md:flex md:items-end md:gap-4">
                    <div className="flex-grow">
                        <label htmlFor="epg-name" className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                        <input
                            id="epg-name"
                            type="text"
                            placeholder="Ej: EPG Principal"
                            value={newEpgUrlName}
                            onChange={(e) => setNewEpgUrlName(e.target.value)}
                            className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex-grow-[2]">
                        <label htmlFor="epg-url" className="block text-sm font-medium text-gray-300 mb-1">URL del XMLTV</label>
                        <input
                            id="epg-url"
                            type="url"
                            placeholder="https://..."
                            value={newEpgUrl}
                            onChange={(e) => setNewEpgUrl(e.target.value)}
                            className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center w-full md:w-auto">
                        <PlusCircle size={18} className="mr-2" />
                        Añadir
                    </button>
                </form>

                <div className="space-y-3">
                    {savedEpgUrls.length > 0 ? (
                        savedEpgUrls.map(item => (
                            <div key={item.id} className="bg-gray-700 p-3 rounded-md flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{item.name}</p>
                                    <p className="text-xs text-gray-400 truncate">{item.url}</p>
                                </div>
                                <button onClick={() => deleteSavedEpgUrl(item.id)} className="text-red-400 hover:text-red-600 p-2">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-400">No tienes ninguna fuente EPG guardada.</p>
                    )}
                </div>
            </div>

            {/* Sección de Prefijos y Sufijos de Canales */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Filtros de Nombres de Canales</h2>
                    <button
                        onClick={resetChannelPrefixesAndSuffixes}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md text-sm"
                    >
                        Restablecer por defecto
                    </button>
                </div>
                <p className="text-gray-400 text-sm mb-6">
                    Configura los prefijos y sufijos que se eliminarán automáticamente del nombre del canal cuando hagas clic en él para buscar en la pestaña de Reparación.
                </p>

                {/* Prefijos */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Prefijos (se eliminan del inicio)</h3>
                    <form onSubmit={handleAddPrefix} className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={newPrefix}
                            onChange={(e) => setNewPrefix(e.target.value)}
                            placeholder="Ej: HD , FHD , 4K "
                            className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                            type="submit"
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center"
                        >
                            <PlusCircle size={18} className="mr-2" />
                            Agregar
                        </button>
                    </form>
                    <div className="flex flex-wrap gap-2">
                        {channelPrefixes.map(prefix => (
                            <div key={prefix} className="bg-gray-700 px-3 py-1 rounded-full flex items-center gap-2">
                                <span className="text-sm">"{prefix}"</span>
                                <button
                                    onClick={() => handleRemovePrefix(prefix)}
                                    className="text-red-400 hover:text-red-600"
                                >
                                    <XCircle size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sufijos */}
                <div>
                    <h3 className="text-lg font-semibold mb-3">Sufijos (se eliminan del final)</h3>
                    <form onSubmit={handleAddSuffix} className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={newSuffix}
                            onChange={(e) => setNewSuffix(e.target.value)}
                            placeholder="Ej:  HD,  4K,  (HD),  [FHD]"
                            className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                            type="submit"
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center"
                        >
                            <PlusCircle size={18} className="mr-2" />
                            Agregar
                        </button>
                    </form>
                    <div className="flex flex-wrap gap-2">
                        {channelSuffixes.map(suffix => (
                            <div key={suffix} className="bg-gray-700 px-3 py-1 rounded-full flex items-center gap-2">
                                <span className="text-sm">"{suffix}"</span>
                                <button
                                    onClick={() => handleRemoveSuffix(suffix)}
                                    className="text-red-400 hover:text-red-600"
                                >
                                    <XCircle size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Gestión de Youtube.m3u */}
            <div>
                <h2 className="text-xl font-bold mb-4">Gestión de Youtube.m3u</h2>
                <div className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm text-gray-300">
                                Canales guardados: <span className="font-bold text-white">{youtubeChannels.length}</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                Los canales de YouTube se guardan localmente en tu navegador
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={downloadYoutubeM3U}
                                disabled={youtubeChannels.length === 0}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                <ExternalLink size={18} className="mr-2" />
                                Descargar Youtube.m3u
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm('¿Estás seguro de que quieres eliminar TODOS los canales de YouTube? Esta acción no se puede deshacer.')) {
                                        clearYoutubeChannels();
                                    }
                                }}
                                disabled={youtubeChannels.length === 0}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                <Trash2 size={18} className="mr-2" />
                                Limpiar Todo
                            </button>
                        </div>
                    </div>

                    {youtubeChannels.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-sm font-semibold text-gray-300 mb-3">Canales guardados:</h3>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {youtubeChannels.map((channel) => (
                                    <div
                                        key={channel.id}
                                        className="bg-gray-600 p-3 rounded-md flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            {channel.tvgLogo && (
                                                <img
                                                    src={channel.tvgLogo}
                                                    alt={channel.name}
                                                    className="w-12 h-12 rounded object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            )}
                                            <div className="flex-1">
                                                <p className="font-semibold text-white">{channel.name}</p>
                                                <p className="text-xs text-gray-400">Grupo: {channel.groupTitle}</p>
                                                <p className="text-xs text-gray-500 truncate max-w-md">{channel.url}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (confirm(`¿Eliminar el canal "${channel.name}"?`)) {
                                                    deleteYoutubeChannel(channel.id);
                                                }
                                            }}
                                            className="text-red-400 hover:text-red-600 ml-2"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {youtubeChannels.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                            <p>No hay canales guardados</p>
                            <p className="text-sm mt-2">Ve a la pestaña "YouTube Live" para añadir canales</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsTab;
