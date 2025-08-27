import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Upload, Download, Plus, Save, FileDown, Trash2, Copy, CheckSquare, ArrowLeftCircle, RotateCcw, PlusCircle, Zap } from 'lucide-react';

// --- TIPOS (TYPES) ---
interface Channel {
  id: string;
  order: number;
  tvgId: string;
  tvgName: string;
  tvgLogo: string;
  groupTitle: string;
  name: string;
  url: string;
}

interface EpgChannel {
    id: string;
    name: string;
    logo: string;
}

type Tab = 'editor' | 'curation' | 'epg' | 'save' | 'settings';
type AttributeKey = 'tvgId' | 'tvgName' | 'tvgLogo' | 'groupTitle' | 'name' | 'url';


// --- COMPONENTES DE UI (UI COMPONENTS) ---

interface EditableCellProps {
  value: string;
  onSave: (newValue: string) => void;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(value);

  const handleDoubleClick = () => { setText(value); setIsEditing(true); };
  const handleBlur = () => { if (text !== value) { onSave(text); } setIsEditing(false); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { handleBlur(); } else if (e.key === 'Escape') { setText(value); setIsEditing(false); } };

  if (isEditing) { return <input type="text" value={text} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown} autoFocus className="w-full bg-gray-700 border border-blue-500 rounded px-1 py-0.5 text-white" />; }
  return <div onDoubleClick={handleDoubleClick} className="truncate cursor-pointer px-1 py-0.5">{value}</div>;
};

interface ResizableHeaderProps {
  children: React.ReactNode;
  width: number;
  onResize: (newWidth: number) => void;
}

const ResizableHeader: React.FC<ResizableHeaderProps> = ({ children, width, onResize }) => {
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = width;
        const handleMouseMove = (moveEvent) => { const newWidth = startWidth + (moveEvent.clientX - startX); if (newWidth > 50) { onResize(newWidth); } };
        const handleMouseUp = () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };
    return (
        <th scope="col" style={{ width: `${width}px` }} className="relative px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
            {children}
            <div onMouseDown={handleMouseDown} className="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-gray-600/20 hover:bg-blue-500/50" />
        </th>
    );
};

interface SortableChannelRowProps {
  channel: Channel;
  onOrderChange: (channelId: string, newOrder: string) => void;
  onUpdate: (channelId: string, field: AttributeKey, newValue: string) => void;
  selectedChannels: string[];
  toggleChannelSelection: (id: string, isShiftClick: boolean) => void;
  columnWidths: Record<string, number>;
}

const SortableChannelRow: React.FC<SortableChannelRowProps> = ({ channel, onOrderChange, onUpdate, selectedChannels, toggleChannelSelection, columnWidths }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: channel.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <tr ref={setNodeRef} style={style} className={`transition-colors ${selectedChannels.includes(channel.id) ? 'bg-blue-900/50' : 'bg-gray-800'} hover:bg-gray-700`}>
      <td style={{ width: `${columnWidths.select}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-center"><div className="flex items-center justify-center space-x-2"><div {...attributes} {...listeners} className="cursor-grab touch-none p-1"><GripVertical size={16} /></div><input type="checkbox" checked={selectedChannels.includes(channel.id)} onChange={(e) => toggleChannelSelection(channel.id, e.nativeEvent.shiftKey)} className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" /></div></td>
      <td style={{ width: `${columnWidths.order}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-center"><EditableCell value={channel.order.toString()} onSave={(val) => onOrderChange(channel.id, val)} /></td>
      <td style={{ width: `${columnWidths.tvgId}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300"><EditableCell value={channel.tvgId} onSave={(val) => onUpdate(channel.id, 'tvgId', val)} /></td>
      <td style={{ width: `${columnWidths.tvgName}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300"><EditableCell value={channel.tvgName} onSave={(val) => onUpdate(channel.id, 'tvgName', val)} /></td>
      <td style={{ width: `${columnWidths.tvgLogo}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300 text-center"><div className="flex items-center justify-center"><img src={channel.tvgLogo || 'https://placehold.co/40x40/2d3748/e2e8f0?text=?'} alt="logo" className="h-8 w-8 object-contain rounded-sm" onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.src = 'https://placehold.co/40x40/2d3748/e2e8f0?text=Error'; }} /></div></td>
      <td style={{ width: `${columnWidths.groupTitle}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-300"><EditableCell value={channel.groupTitle} onSave={(val) => onUpdate(channel.id, 'groupTitle', val)} /></td>
      <td style={{ width: `${columnWidths.name}px` }} className="px-2 py-2 text-sm text-white font-medium"><EditableCell value={channel.name} onSave={(val) => onUpdate(channel.id, 'name', val)} /></td>
      <td style={{ width: `${columnWidths.url}px` }} className="px-2 py-2 whitespace-nowrap text-sm text-gray-400"><EditableCell value={channel.url} onSave={(val) => onUpdate(channel.id, 'url', val)} /></td>
    </tr>
  );
};

interface CurationChannelItemProps {
    channel: Channel;
    onBodyClick: () => void;
    onSelectClick?: () => void;
    isSelected: boolean;
    isChecked?: boolean;
    hasEpg?: boolean;
    showCheckbox?: boolean;
}

const CurationChannelItem: React.FC<CurationChannelItemProps> = ({ channel, onBodyClick, onSelectClick, isSelected, isChecked, hasEpg, showCheckbox = false }) => {
    const getDomainFromUrl = (url) => {
        if (!url) return '---';
        try { return new URL(url).hostname; } 
        catch (_) { const parts = url.split('/'); return parts.length > 2 ? parts[2] : url; }
    };
    const nameColor = hasEpg === false ? 'text-red-400' : 'text-white';
    return (
        <div onClick={onBodyClick} className={`flex items-center gap-3 p-2 rounded-lg border-2 ${isSelected ? 'border-blue-500 bg-blue-900/50' : 'border-transparent'} cursor-pointer hover:bg-gray-700`}>
            <img src={channel.tvgLogo || 'https://placehold.co/48x48/2d3748/e2e8f0?text=?'} alt="logo" className="w-12 h-12 object-contain rounded-md flex-shrink-0 bg-gray-900" onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.src = 'https://placehold.co/48x48/2d3748/e2e8f0?text=Error'; }} />
            <div className="text-xs overflow-hidden flex-grow">
                <p className={`font-bold truncate text-sm ${nameColor}`}>{channel.name}</p>
                <p className="text-gray-400 truncate"><span className="font-semibold text-gray-300">ID:</span> {channel.tvgId || '---'}</p>
                <p className="text-gray-400 truncate"><span className="font-semibold text-gray-300">Name:</span> {channel.tvgName || '---'}</p>
                <p className="text-gray-400 truncate"><span className="font-semibold text-gray-300">URL:</span> {getDomainFromUrl(channel.url)}</p>
            </div>
            {showCheckbox && (
                <input 
                    type="checkbox" 
                    checked={isChecked} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        e.stopPropagation();
                        if (onSelectClick) onSelectClick();
                    }}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 ml-auto" 
                />
            )}
        </div>
    );
};

interface EpgChannelItemProps {
    epgChannel: EpgChannel;
    onClick: () => void;
}

const EpgChannelItem: React.FC<EpgChannelItemProps> = ({ epgChannel, onClick }) => (
    <div onClick={onClick} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-700 border-2 border-transparent">
        <img src={epgChannel.logo || 'https://placehold.co/48x48/2d3748/e2e8f0?text=?'} alt="logo" className="w-12 h-12 object-contain rounded-md flex-shrink-0 bg-gray-900" onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.src = 'https://placehold.co/48x48/2d3748/e2e8f0?text=Error'; }} />
        <div className="text-xs overflow-hidden flex-grow">
            <p className="font-bold text-white truncate text-sm">{epgChannel.name}</p>
            <p className="text-gray-400 truncate"><span className="font-semibold text-gray-300">ID:</span> {epgChannel.id}</p>
        </div>
    </div>
);


// --- COMPONENTE PRINCIPAL (MAIN APP COMPONENT) ---
export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('editor');
  const [fileName, setFileName] = useState('my_playlist.m3u');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [filterGroup, setFilterGroup] = useState<string>('All');
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const prevChannelsCount = useRef(channels.length);
  const [columnWidths, setColumnWidths] = useState({ select: 80, order: 80, tvgId: 200, tvgName: 200, tvgLogo: 100, groupTitle: 180, name: 250, url: 300 });
  const [curationChannels, setCurationChannels] = useState<Channel[]>([]);
  const [selectedCurationChannels, setSelectedCurationChannels] = useState<Set<string>>(new Set());
  const [isCurationLoading, setIsCurationLoading] = useState(false);
  const [curationError, setCurationError] = useState<string | null>(null);
  const [attributesToCopy, setAttributesToCopy] = useState<Set<AttributeKey>>(new Set());
  const [destinationChannelId, setDestinationChannelId] = useState<string | null>(null);
  const [history, setHistory] = useState<Channel[][]>([]);
  const [mainListFilter, setMainListFilter] = useState('All');
  const [curationListFilter, setCurationListFilter] = useState('All');
  const [epgChannels, setEpgChannels] = useState<EpgChannel[]>([]);
  const [isEpgLoading, setIsEpgLoading] = useState(false);
  const [epgError, setEpgError] = useState<string | null>(null);
  const [epgUrl, setEpgUrl] = useState('');
  const [epgIdListUrl, setEpgIdListUrl] = useState('');
  const [epgLogoFolderUrl, setEpgLogoFolderUrl] = useState('');

  const handleResize = (key, newWidth) => setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  
  const parseM3U = (content: string) => {
    const lines = content.split('\n');
    if (lines[0].trim() !== '#EXTM3U') throw new Error('Archivo no válido. Debe empezar con #EXTM3U.');
    const parsedChannels: Channel[] = [];
    let order = 1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith('#EXTINF:')) {
        const info = lines[i].trim().substring(8);
        const url = lines[++i]?.trim() || '';
        const tvgId = info.match(/tvg-id="([^"]*)"/)?.[1] || '';
        const tvgName = info.match(/tvg-name="([^"]*)"/)?.[1] || '';
        const tvgLogo = info.match(/tvg-logo="([^"]*)"/)?.[1] || '';
        const groupTitle = info.match(/group-title="([^"]*)"/)?.[1] || '';
        const name = info.split(',').pop()?.trim() || '';
        if (name && url) parsedChannels.push({ id: `channel-${Date.now()}-${Math.random()}`, order: order++, tvgId, tvgName, tvgLogo, groupTitle, name, url });
      }
    }
    return parsedChannels;
  };

  const parseXMLTV = (content: string) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, "text/xml");
    const channelElements = xmlDoc.getElementsByTagName('channel');
    const parsedEpg: EpgChannel[] = [];
    for (let i = 0; i < channelElements.length; i++) {
        const id = channelElements[i].getAttribute('id') || '';
        const name = channelElements[i].getElementsByTagName('display-name')[0]?.textContent || '';
        const logo = channelElements[i].getElementsByTagName('icon')[0]?.getAttribute('src') || '';
        if (id && name) {
            parsedEpg.push({ id, name, logo });
        }
    }
    return parsedEpg;
  };

  const generateM3UContent = () => {
    let content = '#EXTM3U\n';
    channels.forEach(channel => {
        let attributes = '';
        if (channel.tvgId) attributes += ` tvg-id="${channel.tvgId}"`;
        if (channel.tvgName) attributes += ` tvg-name="${channel.tvgName}"`;
        if (channel.tvgLogo) attributes += ` tvg-logo="${channel.tvgLogo}"`;
        if (channel.groupTitle) attributes += ` group-title="${channel.groupTitle}"`;
        content += `#EXTINF:-1${attributes},${channel.name}\n${channel.url}\n`;
    });
    return content;
  };

  const handleFetchUrl = async () => {
    if (!url) { setError('Por favor, introduce una URL.'); return; }
    setIsLoading(true); setError(null);
    try {
        const proxyUrl = `https://cors-anywhere.herokuapp.com/`;
        const response = await fetch(proxyUrl + url);
        if (!response.ok) throw new Error(`Error al descargar la lista: ${response.statusText}`);
        const text = await response.text();
        setChannels(parseM3U(text)); setSelectedChannels([]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido.'); } 
    finally { setIsLoading(false); }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true); setError(null); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        setChannels(parseM3U(e.target?.result as string)); setSelectedChannels([]);
      } catch (err) { setError(err instanceof Error ? err.message : 'Error al procesar el archivo.'); } 
      finally { setIsLoading(false); }
    };
    reader.onerror = () => { setError('No se pudo leer el archivo.'); setIsLoading(false); }
    reader.readAsText(file);
    event.target.value = ''; 
  };
  
  const handleAddNewChannel = () => {
      const firstGroup = channels.length > 0 ? channels[0].groupTitle : 'Nuevo Grupo';
      const newChannel: Channel = { id: `channel-${Date.now()}-${Math.random()}`, order: channels.length + 1, tvgId: '', tvgName: '', tvgLogo: '', groupTitle: firstGroup, name: 'Nuevo Canal', url: '' };
      setChannels(prev => [...prev, newChannel]);
  };

  const handleDeleteSelected = () => {
    setChannels(prev => prev.filter(c => !selectedChannels.includes(c.id)).map((c, i) => ({ ...c, order: i + 1 })));
    setSelectedChannels([]);
  };

  const handleDownload = () => {
    const content = generateM3UContent();
    const blob = new Blob([content], { type: 'application/vnd.apple.mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.m3u') || fileName.endsWith('.m3u8') ? fileName : `${fileName}.m3u`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleUpdateChannel = (channelId, field, newValue) => setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, [field]: newValue } : ch));

  const handleOrderChange = (channelId, newOrderStr) => {
    const newOrder = parseInt(newOrderStr, 10);
    if (isNaN(newOrder) || newOrder <= 0) return;
    let wasGroupMove = false;
    setChannels(prev => {
        const isGroupMove = selectedChannels.includes(channelId) && selectedChannels.length > 1;
        wasGroupMove = isGroupMove;
        if (isGroupMove) {
            const selectedObjs = prev.filter(c => selectedChannels.includes(c.id)).sort((a, b) => a.order - b.order);
            const unselected = prev.filter(c => !selectedChannels.includes(c.id));
            const targetIndex = Math.max(0, Math.min(newOrder - 1, unselected.length));
            unselected.splice(targetIndex, 0, ...selectedObjs);
            return unselected.map((ch, index) => ({ ...ch, order: index + 1 }));
        } else {
            const copy = [...prev];
            const currentIndex = copy.findIndex(c => c.id === channelId);
            if (currentIndex === -1) return prev;
            const [moved] = copy.splice(currentIndex, 1);
            const targetIndex = Math.max(0, Math.min(newOrder - 1, copy.length));
            copy.splice(targetIndex, 0, moved);
            return copy.map((ch, index) => ({ ...ch, order: index + 1 }));
        }
    });
    if (wasGroupMove) { setSelectedChannels([]); }
  };

  const handleDragStart = (event) => setActiveId(event.active.id);
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setChannels((items) => arrayMove(items, items.findIndex(item => item.id === active.id), items.findIndex(item => item.id === over.id)).map((c, i) => ({ ...c, order: i + 1 })));
    }
    setActiveId(null);
  };
  
  const uniqueGroups = useMemo(() => ['All', ...new Set(channels.map(c => c.groupTitle).filter(Boolean))], [channels]);
  const filteredChannels = useMemo(() => filterGroup === 'All' ? channels : channels.filter(c => c.groupTitle === filterGroup), [channels, filterGroup]);
  const activeChannel = useMemo(() => channels.find(c => c.id === activeId), [activeId, channels]);
  
  const toggleChannelSelection = (id: string, isShiftClick: boolean) => {
    if (isShiftClick && lastSelectedId) {
        const lastIndex = filteredChannels.findIndex(c => c.id === lastSelectedId);
        const currentIndex = filteredChannels.findIndex(c => c.id === id);
        if (lastIndex === -1 || currentIndex === -1) return;
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = filteredChannels.slice(start, end + 1).map(c => c.id);
        setSelectedChannels(prev => Array.from(new Set([...prev, ...rangeIds])));
    } else {
        setSelectedChannels(prev => prev.includes(id) ? prev.filter(channelId => channelId !== id) : [...prev, id]);
    }
    setLastSelectedId(id);
  };
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => setSelectedChannels(e.target.checked ? filteredChannels.map(c => c.id) : []);

  useEffect(() => { if (channels.length > prevChannelsCount.current && tableContainerRef.current) { tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight; } prevChannelsCount.current = channels.length; }, [channels]);
  useEffect(() => { if (selectAllCheckboxRef.current) selectAllCheckboxRef.current.indeterminate = selectedChannels.length > 0 && selectedChannels.length < filteredChannels.length; }, [selectedChannels, filteredChannels]);

  const handleCurationFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsCurationLoading(true); setCurationError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try { setCurationChannels(parseM3U(e.target?.result as string)); } 
      catch (err) { setCurationError(err instanceof Error ? err.message : 'Error al procesar el archivo.'); } 
      finally { setIsCurationLoading(false); }
    };
    reader.onerror = () => { setCurationError('No se pudo leer el archivo.'); setIsCurationLoading(false); }
    reader.readAsText(file);
    event.target.value = '';
  };
  const toggleAttributeToCopy = (attr: AttributeKey) => {
    setAttributesToCopy(prev => {
        const newSet = new Set(prev);
        if (newSet.has(attr)) newSet.delete(attr);
        else newSet.add(attr);
        return newSet;
    });
  };
  const handleSourceChannelClick = (sourceChannel: Channel) => {
    if (!destinationChannelId || attributesToCopy.size === 0) return;
    setHistory(prev => [...prev, channels]);
    setChannels(prev => prev.map(dest => {
        if (dest.id === destinationChannelId) {
            const updated = { ...dest };
            attributesToCopy.forEach(attr => { updated[attr] = sourceChannel[attr]; });
            return updated;
        }
        return dest;
    }));
    setDestinationChannelId(null);
  };
  const handleUndoCuration = () => {
    if (history.length === 0) return;
    setChannels(history[history.length - 1]);
    setHistory(prev => prev.slice(0, -1));
  };
  const mainListUniqueGroups = useMemo(() => ['All', ...new Set(channels.map(c => c.groupTitle).filter(Boolean))], [channels]);
  const curationListUniqueGroups = useMemo(() => ['All', ...new Set(curationChannels.map(c => c.groupTitle).filter(Boolean))], [curationChannels]);
  const filteredMainChannels = useMemo(() => mainListFilter === 'All' ? channels : channels.filter(c => c.groupTitle === mainListFilter), [channels, mainListFilter]);
  const filteredCurationChannels = useMemo(() => curationListFilter === 'All' ? curationChannels : curationChannels.filter(c => c.groupTitle === curationListFilter), [curationChannels, curationListFilter]);
  const toggleCurationSelection = (id: string) => {
    setSelectedCurationChannels(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  };
  const handleAddSelectedFromCuration = () => {
    if (selectedCurationChannels.size === 0) return;
    const channelsToAdd = curationChannels.filter(c => selectedCurationChannels.has(c.id));
    const newChannels = channelsToAdd.map(c => ({
        ...c,
        id: `channel-${Date.now()}-${Math.random()}`,
        groupTitle: mainListFilter === 'All' ? (c.groupTitle || 'Sin Grupo') : mainListFilter,
    }));
    setChannels(prev => [...prev, ...newChannels].map((c, i) => ({ ...c, order: i + 1 })));
    setSelectedCurationChannels(new Set());
  };

  const handleEpgFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsEpgLoading(true); setEpgError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try { setEpgChannels(parseXMLTV(e.target?.result as string)); } 
      catch (err) { setEpgError(err instanceof Error ? err.message : 'Error al procesar el archivo.'); } 
      finally { setIsEpgLoading(false); }
    };
    reader.onerror = () => { setEpgError('No se pudo leer el archivo.'); setIsEpgLoading(false); }
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleFetchEpgUrl = async () => {
    if (!epgUrl) { setEpgError('Por favor, introduce una URL de EPG.'); return; }
    setIsEpgLoading(true); setEpgError(null);
    try {
        const proxyUrl = `https://cors-anywhere.herokuapp.com/`;
        const response = await fetch(proxyUrl + epgUrl);
        if (!response.ok) throw new Error(`Error al descargar el EPG: ${response.statusText}`);
        const text = await response.text();
        setEpgChannels(parseXMLTV(text));
    } catch (err) { setEpgError(err instanceof Error ? err.message : 'Ocurrió un error desconocido.'); } 
    finally { setIsEpgLoading(false); }
  };

  const handleGenerateEpgFromUrls = async () => {
    if (!epgIdListUrl || !epgLogoFolderUrl) { setEpgError('Introduce ambas URLs para generar el EPG.'); return; }
    setIsEpgLoading(true); setEpgError(null);
    try {
        const proxyUrl = `https://cors-anywhere.herokuapp.com/`;
        const response = await fetch(proxyUrl + epgIdListUrl);
        if (!response.ok) throw new Error(`Error al descargar la lista de IDs: ${response.statusText}`);
        const text = await response.text();
        const ids = text.split('\n').map(id => id.trim()).filter(Boolean);
        const generatedEpg = ids.map(id => ({
            id,
            name: id,
            logo: `${epgLogoFolderUrl.replace(/\/$/, '')}/${id}.png`
        }));
        setEpgChannels(generatedEpg);
    } catch (err) { setEpgError(err instanceof Error ? err.message : 'Ocurrió un error desconocido.'); } 
    finally { setIsEpgLoading(false); }
  };

  const epgIdSet = useMemo(() => new Set(epgChannels.map(c => c.id)), [epgChannels]);

  const handleEpgSourceClick = (sourceEpg: EpgChannel) => {
    if (!destinationChannelId) return;
    setHistory(prev => [...prev, channels]);
    setChannels(prev => prev.map(dest => {
        if (dest.id === destinationChannelId) {
            const updated = { ...dest, tvgId: sourceEpg.id };
            if (attributesToCopy.has('tvgLogo')) updated.tvgLogo = sourceEpg.logo;
            return updated;
        }
        return dest;
    }));
    setDestinationChannelId(null);
  };

  const renderTabContent = () => {
    switch (activeTab) {
        case 'editor':
            return (
                <>
                    <div className="bg-gray-800 p-4 rounded-lg mb-6 shadow-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                          <label htmlFor="url-input" className="block text-sm font-medium text-gray-300 mb-1">Cargar desde URL</label>
                          <div className="flex">
                            <input id="url-input" type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://.../playlist.m3u" className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" />
                            <button onClick={handleFetchUrl} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-md flex items-center disabled:bg-blue-800 disabled:cursor-not-allowed"><Download size={18} className="mr-2" /> Descargar</button>
                          </div>
                        </div>
                        <div className="flex justify-center md:justify-end">
                          <label htmlFor="file-upload" className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md flex items-center"><Upload size={18} className="mr-2" /> Subir Archivo M3U</label>
                          <input id="file-upload" type="file" className="hidden" onChange={handleFileUpload} accept=".m3u,.m3u8" />
                        </div>
                      </div>
                      {isLoading && <p className="text-center mt-4 text-blue-400">Cargando...</p>}
                      {error && <p className="text-center mt-4 text-red-400 bg-red-900/50 p-2 rounded">{error}</p>}
                    </div>

                    {channels.length > 0 && (
                        <div className="bg-gray-800 p-4 rounded-lg mb-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <label htmlFor="group-filter" className="text-sm font-medium text-gray-300 mr-2">Filtrar por grupo:</label>
                                <select id="group-filter" value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500">{uniqueGroups.map(group => <option key={group} value={group}>{group}</option>)}</select>
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="text-sm text-gray-400">{selectedChannels.length} de {filteredChannels.length} canales seleccionados</p>
                                <button onClick={handleAddNewChannel} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center"><Plus size={18} className="mr-2" /> Crear Canal</button>
                                <button onClick={handleDeleteSelected} disabled={selectedChannels.length === 0} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"><Trash2 size={18} className="mr-2" /> Eliminar Seleccionados</button>
                            </div>
                        </div>
                    )}

                    <div ref={tableContainerRef} className="overflow-auto rounded-lg shadow-lg max-h-[60vh]">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                        <table className="min-w-full divide-y divide-gray-700 table-fixed">
                          <thead className="bg-gray-800 sticky top-0 z-10">
                            <tr>
                              <th scope="col" style={{ width: `${columnWidths.select}px` }} className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider"><input type="checkbox" ref={selectAllCheckboxRef} checked={filteredChannels.length > 0 && selectedChannels.length === filteredChannels.length} onChange={handleSelectAll} className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" /></th>
                              <ResizableHeader width={columnWidths.order} onResize={(w) => handleResize('order', w)}><div className="text-center">Orden</div></ResizableHeader>
                              <ResizableHeader width={columnWidths.tvgId} onResize={(w) => handleResize('tvgId', w)}>tvg-id</ResizableHeader>
                              <ResizableHeader width={columnWidths.tvgName} onResize={(w) => handleResize('tvgName', w)}>tvg-name</ResizableHeader>
                              <ResizableHeader width={columnWidths.tvgLogo} onResize={(w) => handleResize('tvgLogo', w)}><div className="text-center">Logo</div></ResizableHeader>
                              <ResizableHeader width={columnWidths.groupTitle} onResize={(w) => handleResize('groupTitle', w)}>Grupo</ResizableHeader>
                              <ResizableHeader width={columnWidths.name} onResize={(w) => handleResize('name', w)}>Nombre del Canal</ResizableHeader>
                              <ResizableHeader width={columnWidths.url} onResize={(w) => handleResize('url', w)}>URL del Stream</ResizableHeader>
                            </tr>
                          </thead>
                          <SortableContext items={filteredChannels.map(c => c.id)} strategy={verticalListSortingStrategy}>
                            <tbody className="bg-gray-900 divide-y divide-gray-700">
                              {filteredChannels.map(channel => (<SortableChannelRow key={channel.id} channel={channel} onOrderChange={handleOrderChange} onUpdate={handleUpdateChannel} selectedChannels={selectedChannels} toggleChannelSelection={toggleChannelSelection} columnWidths={columnWidths} />))}
                            </tbody>
                          </SortableContext>
                        </table>
                        <DragOverlay>{activeChannel ? (<table className="w-full table-fixed"><tbody className="bg-gray-700 shadow-2xl"><tr><td style={{width: `${columnWidths.select}px`}} className="px-2 py-2 text-center"><GripVertical size={16} /></td><td style={{width: `${columnWidths.order}px`}} className="px-2 py-2 text-center">{activeChannel.order}</td><td style={{width: `${columnWidths.tvgId}px`}} className="px-2 py-2 truncate">{activeChannel.tvgId}</td><td style={{width: `${columnWidths.tvgName}px`}} className="px-2 py-2 truncate">{activeChannel.tvgName}</td><td style={{width: `${columnWidths.tvgLogo}px`}} className="px-2 py-2 text-center"><img src={activeChannel.tvgLogo} alt="logo" className="h-8 w-8 object-contain rounded-sm mx-auto"/></td><td style={{width: `${columnWidths.groupTitle}px`}} className="px-2 py-2 truncate">{activeChannel.groupTitle}</td><td style={{width: `${columnWidths.name}px`}} className="px-2 py-2 font-medium text-white truncate">{activeChannel.name}</td><td style={{width: `${columnWidths.url}px`}} className="px-2 py-2 text-gray-400 truncate">{activeChannel.url}</td></tr></tbody></table>) : null}</DragOverlay>
                      </DndContext>
                    </div>
                    {channels.length === 0 && !isLoading && (
                        <div className="text-center py-16 px-4 bg-gray-800 rounded-lg mt-6"><h3 className="text-lg font-medium text-white">Tu lista está vacía</h3><p className="mt-1 text-sm text-gray-400">Pega una URL o sube un archivo .m3u para empezar a gestionar tus canales.</p></div>
                    )}
                </>
            );
        case 'curation':
            const attributeLabels: { key: AttributeKey; label: string }[] = [ { key: 'tvgId', label: 'tvg-id' }, { key: 'tvgName', label: 'tvg-name' }, { key: 'tvgLogo', label: 'Logo' }, { key: 'groupTitle', label: 'Grupo' }, { key: 'name', label: 'Nombre' }, { key: 'url', label: 'URL' }];
            return (
                <div className="grid grid-cols-1 lg:grid-cols-11 gap-4">
                    <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col">
                        <h3 className="font-bold text-lg mb-2">Lista Principal</h3>
                        <select value={mainListFilter} onChange={(e) => setMainListFilter(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 mb-2">{mainListUniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}</select>
                        <div className="overflow-auto max-h-[60vh] space-y-1 pr-2">{filteredMainChannels.map(ch => <CurationChannelItem key={ch.id} channel={ch} onBodyClick={() => setDestinationChannelId(ch.id)} isSelected={destinationChannelId === ch.id} showCheckbox={false} />)}</div>
                    </div>
                    <div className="lg:col-span-1 flex flex-col items-center justify-start gap-2 bg-gray-800 p-4 rounded-lg">
                        <div className="flex-grow">
                            <h4 className="font-bold text-center mb-2">Transferir Datos</h4>
                            <ArrowLeftCircle size={32} className="text-blue-400 mb-4 mx-auto" />
                            {attributeLabels.map(({ key, label }) => (<button key={key} onClick={() => toggleAttributeToCopy(key)} className={`w-full text-xs py-2 px-1 mb-2 rounded-md flex items-center justify-center gap-1 transition-colors ${attributesToCopy.has(key) ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{attributesToCopy.has(key) ? <CheckSquare size={14} /> : <Copy size={14} />} {label}</button>))}
                        </div>
                        <div className="w-full border-t border-gray-700 my-2"></div>
                        <div className="w-full">
                             <h4 className="font-bold text-center mb-2">Añadir a Lista</h4>
                            <button onClick={handleAddSelectedFromCuration} disabled={selectedCurationChannels.size === 0} className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-green-600 hover:bg-green-700 disabled:bg-gray-600"><ArrowLeftCircle size={14} /> Añadir Canal</button>
                        </div>
                        <div className="mt-auto w-full pt-4">
                            <button onClick={handleUndoCuration} disabled={history.length === 0} className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600"><RotateCcw size={14} /> Deshacer</button>
                        </div>
                    </div>
                    <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col">
                        <h3 className="font-bold text-lg mb-2">Lista de Curación</h3>
                        <select value={curationListFilter} onChange={(e) => setCurationListFilter(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 mb-2">{curationListUniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}</select>
                        <label htmlFor="curation-file-upload" className="cursor-pointer text-sm w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center mb-2"><Upload size={16} className="mr-2" /> Subir Archivo</label>
                        <input id="curation-file-upload" type="file" className="hidden" onChange={handleCurationFileUpload} accept=".m3u,.m3u8" />
                        <div className="overflow-auto max-h-[60vh] space-y-1 pr-2">{filteredCurationChannels.map(ch => <CurationChannelItem key={ch.id} channel={ch} onBodyClick={() => handleSourceChannelClick(ch)} onSelectClick={() => toggleCurationSelection(ch.id)} isSelected={false} isChecked={selectedCurationChannels.has(ch.id)} showCheckbox={true} />)}</div>
                    </div>
                </div>
            );
        case 'epg':
            return (
                <div className="grid grid-cols-1 lg:grid-cols-11 gap-4">
                    <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col">
                        <h3 className="font-bold text-lg mb-2">Lista Principal</h3>
                        <div className="overflow-auto max-h-[70vh] space-y-1 pr-2">{channels.map(ch => <CurationChannelItem key={ch.id} channel={ch} onBodyClick={() => setDestinationChannelId(ch.id)} isSelected={destinationChannelId === ch.id} hasEpg={epgIdSet.has(ch.tvgId)} showCheckbox={false} />)}</div>
                    </div>
                     <div className="lg:col-span-1 flex flex-col items-center justify-start gap-2 bg-gray-800 p-4 rounded-lg">
                        <h4 className="font-bold text-center mb-2">Asignar EPG</h4>
                        <ArrowLeftCircle size={32} className="text-blue-400 mb-4" />
                        <button onClick={() => setAttributesToCopy(new Set(['tvgId']))} className={`w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-blue-600 text-white`}><Copy size={14} /> Asignar ID</button>
                        <button onClick={() => setAttributesToCopy(new Set(['tvgId', 'tvgLogo']))} className={`w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-blue-600 text-white`}><Copy size={14} /> ID y Logo</button>
                    </div>
                    <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col">
                         <h3 className="font-bold text-lg mb-2">Fuente EPG</h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="epg-file-upload" className="cursor-pointer text-sm w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center"><Upload size={16} className="mr-2" /> Subir Archivo XMLTV</label>
                                <input id="epg-file-upload" type="file" className="hidden" onChange={handleEpgFileUpload} accept=".xml,.xml.gz" />
                            </div>
                            <div className="border-t border-gray-700 pt-4">
                                <div className="flex"><input type="text" value={epgUrl} onChange={(e) => setEpgUrl(e.target.value)} placeholder="URL del archivo .xml" className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500" /><button onClick={handleFetchEpgUrl} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-r-md flex items-center text-sm"><Download size={16} /></button></div>
                            </div>
                             <div className="border-t border-gray-700 pt-4 space-y-2">
                                <p className="text-xs text-gray-400 text-center">O generar desde URLs:</p>
                                <input type="text" value={epgIdListUrl} onChange={(e) => setEpgIdListUrl(e.target.value)} placeholder="URL de lista de IDs (.txt)" className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500" />
                                <input type="text" value={epgLogoFolderUrl} onChange={(e) => setEpgLogoFolderUrl(e.target.value)} placeholder="URL de carpeta de logos" className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500" />
                                <button onClick={handleGenerateEpgFromUrls} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center text-sm"><Zap size={16} className="mr-2" /> Generar EPG</button>
                            </div>
                        </div>
                        {isEpgLoading && <p className="text-center text-blue-400 mt-2">Cargando...</p>}
                        {epgError && <p className="text-center text-red-400 bg-red-900/50 p-2 rounded mt-2">{epgError}</p>}
                        <div className="overflow-auto max-h-[40vh] space-y-1 pr-2 mt-4">{epgChannels.map(ch => <EpgChannelItem key={ch.id} epgChannel={ch} onClick={() => handleEpgSourceClick(ch)} />)}</div>
                    </div>
                </div>
            );
        case 'save':
            return (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold mb-4 text-white">Guardar y Exportar Playlist</h2>
                    <div className="mb-6">
                        <label htmlFor="filename-input" className="block text-sm font-medium text-gray-300 mb-2">Nombre del archivo</label>
                        <input id="filename-input" type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="w-full md:w-1/2 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <button onClick={handleDownload} disabled={channels.length === 0} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"><FileDown size={18} className="mr-2" /> Descargar .m3u</button>
                        <button disabled={true} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"><Save size={18} className="mr-2" /> Subir a Dropbox (Próximamente)</button>
                    </div>
                     {channels.length === 0 && (<p className="mt-4 text-yellow-400">No hay canales en la lista para guardar. Carga una lista en la pestaña "Editor de Playlist".</p>)}
                </div>
            );
        default:
            return <div className="bg-gray-800 p-6 rounded-lg shadow-lg"><h2 className="text-xl font-bold text-white">Pestaña en construcción</h2></div>;
    }
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-full mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-blue-400">Gestor de Listas M3U</h1>
        <div className="mb-6 border-b border-gray-700">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                {(['editor', 'curation', 'epg', 'save', 'settings'] as Tab[]).map(tab => {
                    const names = { editor: 'Editor de Playlist', curation: 'Curación', epg: 'EPG', save: 'Guardar y Exportar', settings: 'Configuración' };
                    return (<button key={tab} onClick={() => setActiveTab(tab)} className={`${activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none`}>{names[tab]}</button>)
                })}
            </nav>
        </div>
        {renderTabContent()}
      </div>
    </div>
  );
}
