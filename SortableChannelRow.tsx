import React, { useRef, useEffect } from 'react';
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
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
    columnWidths: Record<string, number>;
    style?: React.CSSProperties;
    measureRef?: (node: HTMLElement | null) => void;
    isOverlay?: boolean;
}

const SortableChannelRow: React.FC<SortableChannelRowProps> = ({
    channel,
    onOrderChange,
    onUpdate,
    selectedChannels,
    toggleChannelSelection,
    statusIndicator,
    columnWidths,
    style: virtualizerStyle,
    measureRef,
    isOverlay,
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: channel.id,
        disabled: isOverlay,
        animateLayoutChanges: (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true }),
    });

    const combinedRef = (node: HTMLElement | null) => {
        // Ref para dnd-kit
        setNodeRef(node);
        // Ref para el virtualizador
        if (measureRef) {
            measureRef(node);
        }
    };

    const dndKitTransform = CSS.Transform.toString(transform);

    const style = {
        ...virtualizerStyle,
        // Combina la transformación de dnd-kit (si existe) con la de la virtualización
        transform: dndKitTransform ? `${virtualizerStyle?.transform || ''} ${dndKitTransform}` : virtualizerStyle?.transform,
        transition,
        opacity: isDragging && !isOverlay ? 0.5 : 1,
        zIndex: isDragging ? 1 : 0, // Asegura que el elemento arrastrado esté por encima
    };

    // Cuando es un overlay, no queremos los listeners de drag, solo los atributos.
    const rowListeners = isOverlay ? {} : listeners;

    return (
        <tr ref={combinedRef} style={style} className={`transition-colors ${selectedChannels.includes(channel.id) ? 'bg-blue-900/50' : 'bg-gray-800'} ${!isOverlay ? 'hover:bg-gray-700' : ''}`}>
            <td style={{ width: `${columnWidths.select}px`, minWidth: `${columnWidths.select}px`, maxWidth: `${columnWidths.select}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-center">
                <div className="flex items-center justify-center space-x-2">
                    <div {...attributes} {...rowListeners} className={`${isOverlay ? '' : 'cursor-grab touch-none'} p-1`}>
                         <GripVertical size={16} />
                     </div>
                    <input
                        type="checkbox"
                        checked={selectedChannels.includes(channel.id)}
                        onClick={(e: React.MouseEvent<HTMLInputElement>) => toggleChannelSelection(channel.id, e.shiftKey)}
                        onChange={() => {}}
                        className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                </div>
            </td>
            <td style={{ width: `${columnWidths.order}px`, minWidth: `${columnWidths.order}px`, maxWidth: `${columnWidths.order}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-center">
                <EditableCell value={channel.order.toString()} onSave={(val) => onOrderChange(channel.id, val)} />
            </td>
            {statusIndicator}
            <td style={{ width: `${columnWidths.tvgId}px`, minWidth: `${columnWidths.tvgId}px`, maxWidth: `${columnWidths.tvgId}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300">
                <div className="truncate">
                    <EditableCell value={channel.tvgId} onSave={(val) => onUpdate(channel.id, 'tvgId', val)} />
                </div>
            </td>
            <td style={{ width: `${columnWidths.tvgName}px`, minWidth: `${columnWidths.tvgName}px`, maxWidth: `${columnWidths.tvgName}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300">
                <div className="truncate">
                    <EditableCell value={channel.tvgName} onSave={(val) => onUpdate(channel.id, 'tvgName', val)} />
                </div>
            </td>
            <td style={{ width: `${columnWidths.tvgLogo}px`, minWidth: `${columnWidths.tvgLogo}px`, maxWidth: `${columnWidths.tvgLogo}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-center">
                <div className="flex items-center justify-center">
                    <img
                        src={channel.tvgLogo || 'https://placehold.co/40x40/2d3748/e2e8f0?text=?'}
                        alt="logo"
                        className="h-10 w-auto object-contain rounded-sm"
                        onError={(e) => {
                            e.currentTarget.src = 'https://placehold.co/40x40/2d3748/e2e8f0?text=Error';
                        }}
                    />
                </div>
            </td>
            <td style={{ width: `${columnWidths.groupTitle}px`, minWidth: `${columnWidths.groupTitle}px`, maxWidth: `${columnWidths.groupTitle}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300">
                <div className="truncate">
                    <EditableCell value={channel.groupTitle} onSave={(val) => onUpdate(channel.id, 'groupTitle', val)} />
                </div>
            </td>
            <td style={{ width: `${columnWidths.name}px`, minWidth: `${columnWidths.name}px`, maxWidth: `${columnWidths.name}px` }} className="px-2 py-2 text-sm text-white font-medium">
                <div className="truncate">
                    <EditableCell value={channel.name} onSave={(val) => onUpdate(channel.id, 'name', val)} />
                </div>
            </td>
            <td style={{ width: `${columnWidths.url}px`, minWidth: `${columnWidths.url}px`, maxWidth: `${columnWidths.url}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-400">
                <div className="truncate">
                    <EditableCell value={channel.url} onSave={(val) => onUpdate(channel.id, 'url', val)} />
                </div>
            </td>
        </tr>
    );
};

export default SortableChannelRow;
