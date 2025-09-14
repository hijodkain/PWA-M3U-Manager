import React, { useState, useEffect } from 'react';
import { Save, Trash2, PlusCircle } from 'lucide-react';
import { useSettings } from './useSettings';

interface SettingsTabProps {
    settingsHook: ReturnType<typeof useSettings>;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settingsHook }) => {
    const {
        dropboxAppKey,
        dropboxAppSecret,
        dropboxRefreshToken,
        saveDropboxSettings,
        savedUrls,
        addSavedUrl,
        deleteSavedUrl,
        savedEpgUrls,
        addSavedEpgUrl,
        deleteSavedEpgUrl,
    } = settingsHook;

    const [appKey, setAppKey] = useState(dropboxAppKey);
    const [appSecret, setAppSecret] = useState(dropboxAppSecret);
    const [refreshToken, setRefreshToken] = useState(dropboxRefreshToken);
    const [newUrlName, setNewUrlName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newEpgUrlName, setNewEpgUrlName] = useState('');
    const [newEpgUrl, setNewEpgUrl] = useState('');
    const [tokenSaveStatus, setTokenSaveStatus] = useState('');

    useEffect(() => {
        setAppKey(dropboxAppKey);
        setAppSecret(dropboxAppSecret);
        setRefreshToken(dropboxRefreshToken);
    }, [dropboxAppKey, dropboxAppSecret, dropboxRefreshToken]);

    const handleSaveToken = () => {
        saveDropboxSettings(appKey, appSecret, refreshToken);
        setTokenSaveStatus('Configuración de Dropbox guardada con éxito!');
        setTimeout(() => setTokenSaveStatus(''), 3000);
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

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-white space-y-8">
            
            <div>
                <h2 className="text-xl font-bold mb-4">Configuración de Dropbox</h2>
                <div className="flex flex-col gap-4 md:w-1/2">
                    <div>
                        <label htmlFor="dropbox-app-key" className="block text-sm font-medium text-gray-300 mb-2">
                            Dropbox App Key
                        </label>
                        <input
                            id="dropbox-app-key"
                            type="password"
                            placeholder="Pega tu App Key aquí"
                            value={appKey}
                            onChange={(e) => setAppKey(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="dropbox-app-secret" className="block text-sm font-medium text-gray-300 mb-2">
                            Dropbox App Secret
                        </label>
                        <input
                            id="dropbox-app-secret"
                            type="password"
                            placeholder="Pega tu App Secret aquí"
                            value={appSecret}
                            onChange={(e) => setAppSecret(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="dropbox-refresh-token" className="block text-sm font-medium text-gray-300 mb-2">
                            Dropbox Refresh Token
                        </label>
                        <input
                            id="dropbox-refresh-token"
                            type="password"
                            placeholder="Pega tu Refresh Token aquí"
                            value={refreshToken}
                            onChange={(e) => setRefreshToken(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <button
                        onClick={handleSaveToken}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center w-full md:w-auto self-start"
                    >
                        <Save size={18} className="mr-2" />
                        Guardar Configuración de Dropbox
                    </button>
                    {tokenSaveStatus && <p className="text-sm text-green-400 mt-2">{tokenSaveStatus}</p>}
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
        </div>
    );
};

export default SettingsTab;
