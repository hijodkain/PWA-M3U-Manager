import React, { useState, useEffect } from 'react';
import { ExternalLink, XCircle, PlusCircle, Trash2, Copy } from 'lucide-react';
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
                scope: 'files.content.write sharing.write sharing.read',
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
                
                {!dropboxRefreshToken && (
                    <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
                        <h3 className="font-semibold text-blue-300 mb-3 flex items-center">
                            <ExternalLink size={16} className="mr-2" />
                            Guía de conexión con Dropbox
                        </h3>
                        <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                            <li>
                                <strong>Ve a la Consola de Apps de Dropbox:</strong>{' '}
                                <a 
                                    href="https://www.dropbox.com/developers/apps" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-400 hover:underline"
                                >
                                    Dropbox App Console
                                </a>
                            </li>
                            <li>
                                <strong>Crea una nueva aplicación:</strong>
                                <ul className="ml-6 mt-1 space-y-1 list-disc">
                                    <li>Haz clic en "Create app"</li>
                                    <li>Selecciona "Scoped access"</li>
                                    <li>Tipo de acceso: "App folder" (más seguro)</li>
                                    <li>Dale un nombre único (ej: MiGestorM3U)</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Configura los permisos (pestaña "Permissions"):</strong>
                                <ul className="ml-6 mt-1 space-y-1 list-disc">
                                    <li>Marca: <code className="bg-gray-800 px-1 rounded">files.content.write</code></li>
                                    <li>Marca: <code className="bg-gray-800 px-1 rounded">sharing.write</code></li>
                                    <li>Marca: <code className="bg-gray-800 px-1 rounded">sharing.read</code></li>
                                    <li>Haz clic en "Submit" al final de la página</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Añade la URI de Redirección (pestaña "Settings"):</strong>
                                <ul className="ml-6 mt-1 space-y-1 list-disc">
                                    <li>Busca "Redirect URIs" y haz clic en "Add"</li>
                                    <li>Añade: <code className="bg-gray-800 px-1 rounded">https://m3umanager.cat</code></li>
                                    <li>Para desarrollo local: <code className="bg-gray-800 px-1 rounded">http://localhost:3000</code></li>
                                </ul>
                            </li>
                            <li>
                                <strong>Copia tu App Key</strong> (en la pestaña "Settings") y pégala abajo
                            </li>
                        </ol>
                    </div>
                )}

                <div className="flex flex-col gap-4 md:w-1/2">
                    {dropboxRefreshToken ? (
                        <div>
                            <p className="text-green-400 font-semibold">✓ Conectado a Dropbox</p>
                            <p className="text-xs text-gray-400 mt-1">App Key: {dropboxAppKey}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Permisos activos: Subir archivos • Crear enlaces compartidos • Listar enlaces
                            </p>
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
                <h2 className="text-xl font-bold mb-2 text-center">Ajustes de EPG</h2>
                <div className="mb-4 text-sm text-gray-300">
                    <p className="mb-2">Prueba con alguna de estas dos listas públicas o añade la tuya:</p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-300">
                                1. https://raw.githubusercontent.com/davidmuma/EPG_dobleM/master/guiaiptv.xml
                            </span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText('https://raw.githubusercontent.com/davidmuma/EPG_dobleM/master/guiaiptv.xml');
                                }}
                                className="text-blue-400 hover:text-blue-300 p-1"
                                title="Copiar al portapapeles"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-300">
                                2. https://iptv-epg.org/files/epg-es.xml
                            </span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText('https://iptv-epg.org/files/epg-es.xml');
                                }}
                                className="text-blue-400 hover:text-blue-300 p-1"
                                title="Copiar al portapapeles"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-yellow-300 bg-yellow-900/20 p-3 rounded border border-yellow-700">
                        <strong>Nota:</strong> Si tu proveedor de EPG solo te da un enlace terminado en .xml.gz ten en cuenta que no se puede descomprimir en un navegador, deberás descargar el archivo y subirlo en la pestaña Asignar EPG con el botón Subir XMLTV.
                    </p>
                </div>

                <h3 className="text-lg font-semibold mb-3">Añadir EPG</h3>
                
                <form onSubmit={handleAddEpgUrl} className="bg-gray-700 p-4 rounded-lg mb-4 space-y-4 md:space-y-0 md:flex md:items-end md:gap-4">
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

                <h3 className="text-lg font-semibold mb-3">Fuentes EPG guardadas</h3>

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

            <hr className="my-8 border-gray-600" />

            {/* Sección de Ajustes de Búsqueda Inteligente */}
            <div id="smart-search-settings">
                <h2 className="text-xl font-bold text-center mb-4">Ajustes de la Búsqueda Inteligente</h2>
                <div className="flex items-center justify-end mb-4">
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
        </div>
    );
};

export default SettingsTab;
