import React from 'react';
import { EpgChannel } from './index';

interface EpgChannelItemProps {
    epgChannel: EpgChannel;
    onClick: () => void;
    style?: React.CSSProperties;
}

const EpgChannelItem: React.FC<EpgChannelItemProps> = ({ epgChannel, onClick, style }) => (
    <div
        style={style}
        onClick={onClick}
        className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-700 border-2 border-transparent"
    >
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
        </div>
    </div>
);

export default EpgChannelItem;
