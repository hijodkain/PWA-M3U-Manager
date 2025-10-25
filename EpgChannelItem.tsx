import React from 'react';
import { EpgChannel } from './index';

interface EpgChannelItemProps {
    epgChannel: EpgChannel;
    onClick: () => void;
    style?: React.CSSProperties;
    isSelected?: boolean;
    showCheckbox?: boolean;
    onCheckboxChange?: (channelId: string, shiftKey: boolean) => void;
    assignmentMode?: 'tvg-id' | 'tvg-name';
    score?: number;
    matchType?: 'exact' | 'partial' | 'fuzzy';
}

const EpgChannelItem: React.FC<EpgChannelItemProps> = ({ 
    epgChannel, 
    onClick, 
    style, 
    isSelected = false,
    showCheckbox = false,
    onCheckboxChange,
    assignmentMode = 'tvg-id',
    score,
    matchType
}) => {
    return (
        <div
            style={style}
            onClick={onClick}
            className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-700 border-2 border-transparent"
        >
            {showCheckbox && (
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                        e.stopPropagation();
                        onCheckboxChange?.(epgChannel.id, e.shiftKey);
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
            )}
            <img
                src={epgChannel.logo || 'https://placehold.co/48x48/2d3748/e2e8f0?text=?'}
                alt="logo"
                className="w-12 h-12 object-contain rounded-md flex-shrink-0 bg-gray-900"
                onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/48x48/2d3748/e2e8f0?text=Error';
                }}
            />
            <div className="text-xs overflow-hidden flex-grow">
                <p className="font-bold text-white truncate text-sm">{epgChannel.name}</p>
                <p className="text-gray-400 truncate">
                    <span className="font-semibold text-gray-300">ID:</span> {epgChannel.id}
                </p>
                {score && matchType && (
                    <p className="text-xs text-blue-400">
                        {matchType === 'exact' ? '✓ Coincidencia exacta' : `${Math.round(score)}% similar`}
                    </p>
                )}
                {assignmentMode && (
                    <p className="text-xs text-green-400">
                        Modo: {assignmentMode === 'tvg-id' ? 'Asignar a tvg-id' : 'Asignar a tvg-name'}
                    </p>
                )}
            </div>
        </div>
    );
};

export default EpgChannelItem;
