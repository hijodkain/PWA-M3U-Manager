import React, { useRef, useEffect } from 'react';
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useAppMode } from './AppModeContext';
import EditableCell from './EditableCell';
import { Channel } from './index';

interface SortableChannelRowProps {
    id: string;
    channel: Channel;
    onOrderChange: (id: string, order: string) => void;
    onUpdate: (id: string, field: keyof Channel, value: any) => void;
    selectedChannels: string[];
    toggleChannelSelection: (id: string, isShiftClick: boolean) => void;
    statusIndicator: React.ReactNode;
    style?: React.CSSProperties;
    measureRef?: (node: HTMLElement | null) => void;
    isOverlay?: boolean;
    gridTemplateColumns: string;
}

const SortableChannelRow: React.FC<SortableChannelRowProps> = ({
    channel,
    onOrderChange,
    onUpdate,
    selectedChannels,
    toggleChannelSelection,
    statusIndicator,
    style: virtualizerStyle,
    measureRef,
    isOverlay,
    gridTemplateColumns,
}) => {
    const { isSencillo } = useAppMode();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: channel.id,
        disabled: isOverlay,
        animateLayoutChanges: (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
    });

    const combinedRef = (node: HTMLElement | null) => {
        setNodeRef(node);
        if (measureRef) measureRef(node);
    };

    const dndKitTransform = transform ? CSS.Transform.toString(transform) : undefined;

    const style: React.CSSProperties = {
        ...virtualizerStyle,
        transform: dndKitTransform && !isOverlay ? dndKitTransform : virtualizerStyle?.transform,
        transition: isDragging ? transition : undefined,
        opacity: isDragging && !isOverlay ? 0.5 : 1,
        zIndex: isDragging && !isOverlay ? 1 : 0,
        display: 'grid',
        gridTemplateColumns: gridTemplateColumns,
        alignItems: 'center',
    };

    const rowListeners = isOverlay ? {} : listeners;
    const isSelected = selectedChannels.includes(channel.id);

    // Marquee helper: container with overflow hidden, child with animation on hover
    // Using simple truncate for now as base, and hover effect via CSS classes defined globally or locally.
    // To enable the "marquee on hover", we wrap EditableCell in a container that handles the hover trigger.
    const MarqueeCell = ({ value, onSave }: { value: string, onSave: (val: string) => void }) => (
        <div className="w-full overflow-hidden group relative" title={value}>
             <div className="truncate group-hover:overflow-visible group-hover:w-auto">
                <div className={`inline-block ${value.length > 20 ? 'group-hover:animate-marquee' : ''}`}>
                    <EditableCell 
                        value={value} 
                        onSave={onSave} 
                        className=""
                    />
                </div>
             </div>
        </div>
    );
    // Note: The structure above is a bit experimental for marquee. 
    // Pure CSS Marquee is tricky. The "unhide and animate" approach:
    // When hovering parent, child animates.
    // But EditableCell needs to be clickable. Marquee moving target is hard to click.
    // User requested: "se desplace ... para poder leerlo completo".
    
    // Improved Marquee Strategy:
    // Only animate if hovered. 
    // Double click to edit might pause animation? 'group-hover:pause' (custom class needed).
    
    return (
        <div 
            ref={combinedRef} 
            style={style} 
            className={`transition-colors border-b border-gray-700 ${isSelected ? 'bg-blue-900/50' : 'bg-gray-800'} ${!isOverlay ? 'hover:bg-gray-700' : ''}`}
        >
            {/* Handle & Checkbox */}
            <div className="flex items-center justify-center space-x-2 px-2 py-2">
                <div {...attributes} {...rowListeners} className={`${isOverlay ? '' : 'cursor-grab touch-none'} p-1 text-gray-400`}>
                     <GripVertical size={16} />
                 </div>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(e: React.MouseEvent<HTMLInputElement>) => toggleChannelSelection(channel.id, e.shiftKey)}
                    onChange={() => {}}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
                />
            </div>

            {/* Order */}
            <div className="px-2 py-2 text-center text-sm text-gray-300">
                <EditableCell value={channel.order.toString()} onSave={(val) => onOrderChange(channel.id, val)} />
            </div>

            {/* Status (Pro only) */}
            {!isSencillo && (
                <div className="px-2 py-2 text-center flex items-center justify-center">
                    {statusIndicator}
                </div>
            )}

            {/* TvgID (Pro only) */}
            {!isSencillo && (
                <div className="px-2 py-2 text-sm text-gray-300 overflow-hidden">
                    <MarqueeCell value={channel.tvgId || ''} onSave={(val) => onUpdate(channel.id, 'tvgId', val)} />
                </div>
            )}

             {/* TvgName (Pro only) */}
            {!isSencillo && (
                <div className="px-2 py-2 text-sm text-gray-300 overflow-hidden">
                    <MarqueeCell value={channel.tvgName || ''} onSave={(val) => onUpdate(channel.id, 'tvgName', val)} />
                </div>
            )}

            {/* Logo */}
            <div className="px-2 py-2 text-center flex items-center justify-center overflow-hidden">
                 {channel.tvgLogo ? (
                    <img
                        src={channel.tvgLogo}
                        alt="logo"
                        className="h-8 w-auto object-contain rounded-sm"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) parent.innerHTML = '<span class="text-gray-500 text-xs">Sin Logo</span>';
                        }}
                    />
                ) : (
                    <span className="text-gray-500 text-xs">Sin Logo</span>
                )}
            </div>

            {/* Group */}
            <div className="px-2 py-2 text-sm text-gray-300 overflow-hidden">
                 <MarqueeCell value={channel.groupTitle || ''} onSave={(val) => onUpdate(channel.id, 'groupTitle', val)} />
            </div>

             {/* Name */}
            <div className="px-2 py-2 text-sm text-white font-medium overflow-hidden">
                 <MarqueeCell value={channel.name} onSave={(val) => onUpdate(channel.id, 'name', val)} />
            </div>

             {/* URL (Pro only) */}
            {!isSencillo && (
                <div className="px-2 py-2 text-sm text-gray-400 overflow-hidden">
                     <MarqueeCell value={channel.url} onSave={(val) => onUpdate(channel.id, 'url', val)} />
                </div>
            )}
        </div>
    );
};

export default SortableChannelRow;
