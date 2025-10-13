import React, { useState } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import type { YouTubeChannel, YouTubeChannelStatus } from '../hooks/useYouTubeLiveMonitor';

interface YouTubeLiveSettingsProps {
    channels: YouTubeChannel[];
    channelsStatus: Record<string, YouTubeChannelStatus>;
    settings: {
        enabled: boolean;
        globalInterval: number;
    };
    onAddChannel: (channel: Omit<YouTubeChannel, 'id' | 'addedDate'>) => void;
    onRemoveChannel: (id: string) => void;
    onUpdateSettings: (settings: { enabled: boolean; globalInterval: number }) => void;
    onCheckChannel: (id: string) => Promise<void>;
}

const YouTubeLiveSettings: React.FC<YouTubeLiveSettingsProps> = ({
    channels,
    channelsStatus,
    settings,
    onAddChannel,
    onRemoveChannel,
    onUpdateSettings,
    onCheckChannel,
}) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        channelUrl: '',
        group: '',
        intervalMinutes: settings.globalInterval
    });

    const handleAddChannel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.channelUrl) return;
        
        onAddChannel({
            channelUrl: formData.channelUrl,
            name: formData.name,
            group: formData.group,
            intervalMinutes: formData.intervalMinutes || settings.globalInterval,
        });
        setFormData({
            name: '',
            channelUrl: '',
            group: '',
            intervalMinutes: settings.globalInterval
        });
    };

    return (
        <div className="space-y-6 bg-gray-800 p-6 rounded-lg text-white">
            {/* Settings */}
            <div className="flex items-center space-x-4 flex-wrap gap-4">
                <label className="flex items-center space-x-2">
                    <span>Monitoreo automático:</span>
                    <input
                        type="checkbox"
                        checked={settings.enabled}
                        onChange={(e) =>
                            onUpdateSettings({ ...settings, enabled: e.target.checked })
                        }
                        className="w-5 h-5 rounded"
                    />
                </label>
                <label className="flex items-center space-x-2">
                    <span>Intervalo global (minutos):</span>
                    <input
                        type="number"
                        min={1}
                        max={60}
                        value={settings.globalInterval}
                        onChange={(e) =>
                            onUpdateSettings({ ...settings, globalInterval: parseInt(e.target.value) || 5 })
                        }
                        className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1"
                    />
                </label>
            </div>

            {/* Add Channel Form */}
            <form onSubmit={handleAddChannel} className="bg-gray-700 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input
                        type="text"
                        placeholder="Nombre del canal"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="bg-gray-600 border border-gray-500 rounded px-3 py-2"
                    />
                    <input
                        type="url"
                        placeholder="URL del canal de YouTube"
                        value={formData.channelUrl}
                        onChange={(e) => setFormData({ ...formData, channelUrl: e.target.value })}
                        required
                        pattern="https?://(www\.)?youtube\.com/.+"
                        className="bg-gray-600 border border-gray-500 rounded px-3 py-2"
                    />
                    <input
                        type="text"
                        placeholder="Grupo (opcional)"
                        value={formData.group}
                        onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                        className="bg-gray-600 border border-gray-500 rounded px-3 py-2"
                    />
                    <input
                        type="number"
                        placeholder="Intervalo (min)"
                        min={1}
                        max={60}
                        value={formData.intervalMinutes}
                        onChange={(e) => setFormData({ ...formData, intervalMinutes: parseInt(e.target.value) })}
                        className="bg-gray-600 border border-gray-500 rounded px-3 py-2"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                    Agregar canal
                </button>
            </form>

            {/* Channels Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="px-4 py-2 text-left">Nombre</th>
                            <th className="px-4 py-2 text-left">URL del Canal</th>
                            <th className="px-4 py-2 text-left">Grupo</th>
                            <th className="px-4 py-2 text-left">Estado</th>
                            <th className="px-4 py-2 text-left">Título actual</th>
                            <th className="px-4 py-2 text-left">Última verificación</th>
                            <th className="px-4 py-2 text-left">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {channels.length > 0 ? (
                            channels.map((channel) => {
                                const status = channelsStatus[channel.id];
                                const isVerifying = status?.verification.status === 'verifying';
                                return (
                                    <tr key={channel.id} className="border-b border-gray-700">
                                        <td className="px-4 py-2">{channel.name}</td>
                                        <td className="px-4 py-2 text-xs truncate max-w-xs">{channel.channelUrl}</td>
                                        <td className="px-4 py-2">{channel.group || '-'}</td>
                                        <td className="px-4 py-2">{status?.verification.status || 'Sin verificar'}</td>
                                        <td className="px-4 py-2 truncate max-w-xs">{status?.currentTitle || '-'}</td>
                                        <td className="px-4 py-2 text-xs">
                                            {status?.lastCheck 
                                                ? new Date(status.lastCheck).toLocaleString()
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => onCheckChannel(channel.id)}
                                                    disabled={isVerifying}
                                                    className="text-blue-400 hover:text-blue-300 disabled:text-gray-500 p-1"
                                                    title="Verificar canal"
                                                >
                                                    <RefreshCw size={18} className={isVerifying ? 'animate-spin' : ''} />
                                                </button>
                                                <button
                                                    onClick={() => onRemoveChannel(channel.id)}
                                                    className="text-red-400 hover:text-red-300 p-1"
                                                    title="Eliminar canal"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                    No hay canales configurados
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default YouTubeLiveSettings;