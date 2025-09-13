import React from 'react';
import { Channel } from './index';

interface ReparacionChannelItemProps {
    channel: Channel;
    onBodyClick: () => void;
    onSelectClick?: () => void;
    isSelected: boolean;
    isChecked?: boolean;
    hasEpg?: boolean;
    showCheckbox?: boolean;
    verificationStatus?: 'pending' | 'verifying' | 'ok' | 'failed';
    onVerifyClick?: () => void;
}

const ReparacionChannelItem: React.FC<ReparacionChannelItemProps> = ({
    channel,
    onBodyClick,
    onSelectClick,
    isSelected,
    isChecked,
    hasEpg,
    showCheckbox = false,
    verificationStatus = 'pending',
    onVerifyClick,
}) => {
    const getDomainFromUrl = (url: string) => {
        if (!url) return '---';
        if (typeof window === 'undefined') {
            const parts = url.split('/');
            return parts.length > 2 ? parts[2] : url;
        }
        try {
            return new URL(url).hostname;
        } catch (_) {
            const parts = url.split('/');
            return parts.length > 2 ? parts[2] : url;
        }
    };

    const nameColor = verificationStatus === 'failed' ? 'text-yellow-400' : (hasEpg === false ? 'text-red-400' : 'text-white');

    const statusIndicator = () => {
        switch (verificationStatus) {
            case 'ok':
                return <span className="text-green-500">OK</span>;
            case 'failed':
                return <span className="text-red-500">Failed</span>;
            case 'verifying':
                return <span className="text-yellow-500">Verifying...</span>;
            default:
                return <span className="text-gray-500">Pending</span>;
        }
    };

    return (
        <div
            onClick={onBodyClick}
            className={`flex items-center gap-3 p-2 rounded-lg border-2 ${
                isSelected ? 'border-blue-500 bg-blue-900/50' : 'border-transparent'
            } cursor-pointer hover:bg-gray-700`}
        >
            <img
                src={channel.tvgLogo || 'https://placehold.co/48x48/2d3748/e2e8f0?text=?'}
                alt="logo"
                className="w-12 h-12 object-contain rounded-md flex-shrink-0 bg-gray-900"
                onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/48x48/2d3748/e2e8f0?text=Error';
                }}
            />
            <div className="text-xs overflow-hidden flex-grow">
                <p className={`font-bold truncate text-sm ${nameColor}`}>{channel.name}</p>
                <p className="text-gray-400 truncate">
                    <span className="font-semibold text-gray-300">ID:</span> {channel.tvgId || '---'}
                </p>
                <p className="text-gray-400 truncate">
                    <span className="font-semibold text-gray-300">Name:</span> {channel.tvgName || '---'}
                </p>
                <p className="text-gray-400 truncate">
                    <span className="font-semibold text-gray-300">URL:</span> {getDomainFromUrl(channel.url)}
                </p>
            </div>
            <div className="flex flex-col items-center justify-center ml-auto">
                {statusIndicator()}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onVerifyClick) onVerifyClick();
                    }}
                    disabled={verificationStatus === 'verifying'}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-xs mt-1 disabled:opacity-50"
                >
                    Verify
                </button>
            </div>
            {showCheckbox && (
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                        e.stopPropagation();
                        if (onSelectClick) onSelectClick();
                    }}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 ml-2"
                />
            )}
        </div>
    );
};

export default ReparacionChannelItem;