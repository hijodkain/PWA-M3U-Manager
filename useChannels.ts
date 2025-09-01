import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { Channel } from './index';

const parseM3U = (content: string): Channel[] => {
    const lines = content.split('\n');
    if (lines[0].trim() !== '#EXTM3U') {
        throw new Error('Archivo no válido. Debe empezar con #EXTM3U.');
    }
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
            if (name && url) {
                parsedChannels.push({
                    id: `channel-${Date.now()}-${Math.random()}`,
                    order: order++,
                    tvgId,
                    tvgName,
                    tvgLogo,
                    groupTitle,
                    name,
                    url,
                });
            }
        }
    }
    return parsedChannels;
};

export const useChannels = () => {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState('my_playlist.m3u');
    const [activeId, setActiveId] = useState<string | null>(null);
    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
    const [filterGroup, setFilterGroup] = useState<string>('All');
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const prevChannelsCount = useRef(channels.length);
    const [history, setHistory] = useState<Channel[][]>([]);

    const handleFetchUrl = async () => {
        if (!url) {
            setError('Por favor, introduce una URL.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`Error al descargar la lista: ${response.statusText}`);
            }
            const text = await response.text();
            setChannels(parseM3U(text));
            setSelectedChannels([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsLoading(true);
        setError(null);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                setChannels(parseM3U(e.target?.result as string));
                setSelectedChannels([]);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error al procesar el archivo.');
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            setError('No se pudo leer el archivo.');
            setIsLoading(false);
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleAddNewChannel = () => {
        const newChannel: Channel = {
            id: `channel-${Date.now()}-${Math.random()}`,
            order: channels.length + 1,
            tvgId: '',
            tvgName: '',
            tvgLogo: '',
            groupTitle: filterGroup === 'All' ? 'Nuevo Grupo' : filterGroup,
            name: 'Nuevo Canal',
            url: '',
        };
        setChannels((prev) => [...prev, newChannel]);
    };

    const handleDeleteSelected = () => {
        setChannels((prev) =>
            prev.filter((c) => !selectedChannels.includes(c.id)).map((c, i) => ({ ...c, order: i + 1 }))
        );
        setSelectedChannels([]);
    };

    const generateM3UContent = useCallback(() => {
        let content = '#EXTM3U\n';
        channels.forEach((channel) => {
            let attributes = '';
            if (channel.tvgId) attributes += ` tvg-id="${channel.tvgId}"`;
            if (channel.tvgName) attributes += ` tvg-name="${channel.tvgName}"`;
            if (channel.tvgLogo) attributes += ` tvg-logo="${channel.tvgLogo}"`;
            if (channel.groupTitle) attributes += ` group-title="${channel.groupTitle}"`;
            content += `#EXTINF:-1${attributes},${channel.name}\n${channel.url}\n`;
        });
        return content;
    }, [channels]);

    const handleDownload = () => {
        const content = generateM3UContent();
        const blob = new Blob([content], { type: 'application/vnd.apple.mpegurl' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.m3u') || fileName.endsWith('.m3u8') ? fileName : `${fileName}.m3u`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleUpdateChannel = (channelId: string, field: keyof Channel, newValue: any) => {
        const isGroupUpdate =
            field === 'groupTitle' &&
            selectedChannels.includes(channelId) &&
            selectedChannels.length > 1;

        if (isGroupUpdate) {
            if (window.confirm(`¿Quieres actualizar el grupo de los ${selectedChannels.length} canales seleccionados?`)) {
                setChannels((prev) =>
                    prev.map((ch) =>
                        selectedChannels.includes(ch.id) ? { ...ch, groupTitle: newValue } : ch
                    )
                );
            }
        } else {
            setChannels((prev) =>
                prev.map((ch) => (ch.id === channelId ? { ...ch, [field]: newValue } : ch))
            );
        }
    };

    const handleOrderChange = (channelId: string, newOrderStr: string) => {
        const newOrder = parseInt(newOrderStr, 10);
        if (isNaN(newOrder) || newOrder <= 0) return;

        let wasGroupMove = false;
        setChannels((prev) => {
            const isGroupMove = selectedChannels.includes(channelId) && selectedChannels.length > 1;
            wasGroupMove = isGroupMove;

            if (isGroupMove) {
                const selectedObjs = prev
                    .filter((c) => selectedChannels.includes(c.id))
                    .sort((a, b) => a.order - b.order);
                const unselected = prev.filter((c) => !selectedChannels.includes(c.id));
                const targetIndex = Math.max(0, Math.min(newOrder - 1, unselected.length));
                unselected.splice(targetIndex, 0, ...selectedObjs);
                return unselected.map((ch, index) => ({ ...ch, order: index + 1 }));
            } else {
                const copy = [...prev];
                const currentIndex = copy.findIndex((c) => c.id === channelId);
                if (currentIndex === -1) return prev;
                const [moved] = copy.splice(currentIndex, 1);
                const targetIndex = Math.max(0, Math.min(newOrder - 1, copy.length));
                copy.splice(targetIndex, 0, moved);
                return copy.map((ch, index) => ({ ...ch, order: index + 1 }));
            }
        });

        if (wasGroupMove) {
            setSelectedChannels([]);
        }
    };

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setChannels((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex).map((c, i) => ({ ...c, order: i + 1 }));
            });
        }
        setActiveId(null);
    };

    const uniqueGroups = useMemo(
        () => ['All', ...Array.from(new Set(channels.map((c) => c.groupTitle).filter(Boolean)))],
        [channels]
    );

    const filteredChannels = useMemo(
        () => (filterGroup === 'All' ? channels : channels.filter((c) => c.groupTitle === filterGroup)),
        [channels, filterGroup]
    );

    const activeChannel = useMemo(() => channels.find((c) => c.id === activeId), [activeId, channels]);

    const toggleChannelSelection = (id: string, isShiftClick: boolean) => {
        if (isShiftClick && lastSelectedId) {
            const lastIndex = filteredChannels.findIndex((c) => c.id === lastSelectedId);
            const currentIndex = filteredChannels.findIndex((c) => c.id === id);
            if (lastIndex === -1 || currentIndex === -1) return;

            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            const rangeIds = filteredChannels.slice(start, end + 1).map((c) => c.id);
            setSelectedChannels((prev) => Array.from(new Set([...prev, ...rangeIds])));
        } else {
            setSelectedChannels((prev) =>
                prev.includes(id) ? prev.filter((channelId) => channelId !== id) : [...prev, id]
            );
        }
        setLastSelectedId(id);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedChannels(e.target.checked ? filteredChannels.map((c) => c.id) : []);
    };

    useEffect(() => {
        if (channels.length > prevChannelsCount.current && tableContainerRef.current) {
            tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
        }
        prevChannelsCount.current = channels.length;
    }, [channels]);

    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            selectAllCheckboxRef.current.indeterminate =
                selectedChannels.length > 0 && selectedChannels.length < filteredChannels.length;
        }
    }, [selectedChannels, filteredChannels]);
    
    const saveStateToHistory = useCallback(() => {
        setHistory(prev => [...prev, channels]);
    }, [channels]);

    const undo = () => {
        if (history.length === 0) return;
        setChannels(history[history.length - 1]);
        setHistory(prev => prev.slice(0, -1));
    };

    return {
        channels,
        setChannels,
        url,
        setUrl,
        isLoading,
        error,
        fileName,
        setFileName,
        activeId,
        selectedChannels,
        setSelectedChannels,
        filterGroup,
        setFilterGroup,
        lastSelectedId,
        selectAllCheckboxRef,
        tableContainerRef,
        handleFetchUrl,
        handleFileUpload,
        handleAddNewChannel,
        handleDeleteSelected,
        handleDownload,
        handleUpdateChannel,
        handleOrderChange,
        handleDragStart,
        handleDragEnd,
        uniqueGroups,
        filteredChannels,
        activeChannel,
        toggleChannelSelection,
        handleSelectAll,
        saveStateToHistory,
        undo,
        history,
    };
};
