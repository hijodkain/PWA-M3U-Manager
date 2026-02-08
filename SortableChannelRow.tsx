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
    suggestions?: {
        groupTitle?: string[];
        // Add more suggestion types later if needed
    };
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
    suggestions,
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

    // Fix for "disappearing items":
    // Combine virtualizer style (positioning) with dnd-kit style (transform).
    // If we used translateY in virtualizerStyle, dndKitTransform would overwrite it.
    // Now EditorTab passes 'top' instead of 'transform' for virtualization, so we can use transform safely.
    // Also ensuring zIndex management is correct.

    const style: React.CSSProperties = {
        ...virtualizerStyle,
        transform: dndKitTransform && !isOverlay ? dndKitTransform : virtualizerStyle?.transform,
        transition: isDragging ? transition : undefined,
        opacity: isDragging && !isOverlay ? 0.3 : 1, // Slight visibility for the placeholder
        zIndex: isDragging && !isOverlay ? 1 : 'auto',
        display: 'grid',
        gridTemplateColumns: gridTemplateColumns,
        alignItems: 'center',
        // Visual indicator that this is the placeholder space
        border: isDragging && !isOverlay ? '1px dashed #4b5563' : undefined,
    };

    const rowListeners = isOverlay ? {} : listeners;
    const isSelected = selectedChannels.includes(channel.id);

    // State for local editing of Logo
    const [isEditingLogo, setIsEditingLogo] = React.useState(false);

    // Marquee helper: container with overflow hidden, child with animation on hover
    // Using simple truncate for now as base, and hover effect via CSS classes defined globally or locally.
    // To enable the "marquee on hover", we wrap EditableCell in a container that handles the hover trigger.
    const MarqueeCell = ({ value, onSave, suggestionsList }: { value: string, onSave: (val: string) => void, suggestionsList?: string[] }) => (
        <div className="w-full overflow-hidden group relative" title={value}>
             <div className="truncate group-hover:overflow-visible group-hover:w-auto">
                <div className={`inline-block ${value.length > 20 ? 'group-hover:animate-marquee' : ''}`}>
                    <EditableCell 
                        value={value} 
                        onSave={onSave} 
                        className=""
                        suggestions={suggestionsList}
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
            <div 
                className="px-2 py-2 text-center flex items-center justify-center overflow-hidden h-full"
                onDoubleClick={() => setIsEditingLogo(true)}
                title="Doble clic para editar URL del logo"
            >
                 {isEditingLogo ? (
                    <input 
                        type="text" 
                        defaultValue={channel.tvgLogo}
                        autoFocus
                        onBlur={(e) => {
                            onUpdate(channel.id, 'tvgLogo', e.target.value);
                            setIsEditingLogo(false);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onUpdate(channel.id, 'tvgLogo', e.currentTarget.value);
                                setIsEditingLogo(false);
                            }
                            if (e.key === 'Escape') {
                                setIsEditingLogo(false);
                            }
                        }}
                        className="w-full text-xs bg-gray-900 text-white border border-blue-500 rounded px-1 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                    />
                 ) : channel.tvgLogo ? (
                    <img
                        src={channel.tvgLogo}
                        alt="logo"
                        className="h-8 w-auto object-contain rounded-sm cursor-pointer hover:opacity-80 transition-opacity"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent && !parent.querySelector('span')) {
                                parent.innerHTML += '<span class="text-gray-500 text-xs">Sin Logo</span>';
                            }
                        }}
                    />
                ) : (
                    <span className="text-gray-500 text-xs cursor-text select-text">Sin Logo</span>
                )}
            </div>

            {/* Group */}
            <div className="px-2 py-2 text-sm text-gray-300 overflow-hidden">
                 <MarqueeCell 
                    value={channel.groupTitle || ''} 
                    onSave={(val) => onUpdate(channel.id, 'groupTitle', val)} 
                    suggestionsList={suggestions?.groupTitle}
                />
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
