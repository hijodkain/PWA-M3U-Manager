import { useState, useMemo } from 'react';
import { Channel, AttributeKey } from './index';

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
            const tvgId = info.match(/tvg-id="([^"]*)"?/)?.[1] || '';
            const tvgName = info.match(/tvg-name="([^"]*)"?/)?.[1] || '';
            const tvgLogo = info.match(/tvg-logo="([^"]*)"?/)?.[1] || '';
            const groupTitle = info.match(/group-title="([^"]*)"?/)?.[1] || '';
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


export const useCuration = (
    mainChannels: Channel[], 
    setMainChannels: React.Dispatch<React.SetStateAction<Channel[]>>,
    saveStateToHistory: () => void
) => {
    const [curationChannels, setCurationChannels] = useState<Channel[]>([]);
    const [selectedCurationChannels, setSelectedCurationChannels] = useState<Set<string>>(new Set());
    const [isCurationLoading, setIsCurationLoading] = useState(false);
    const [curationError, setCurationError] = useState<string | null>(null);
    const [attributesToCopy, setAttributesToCopy] = useState<Set<AttributeKey>>(new Set());
    const [destinationChannelId, setDestinationChannelId] = useState<string | null>(null);
    const [mainListFilter, setMainListFilter] = useState('All');
    const [curationListFilter, setCurationListFilter] = useState('All');
    const [mainListSearch, setMainListSearch] = useState('');
    const [curationListSearch, setCurationListSearch] = useState('');

    const handleCurationFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsCurationLoading(true);
        setCurationError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                setCurationChannels(parseM3U(e.target?.result as string));
            } catch (err) {
                setCurationError(err instanceof Error ? err.message : 'Error al procesar el archivo.');
            } finally {
                setIsCurationLoading(false);
            }
        };
        reader.onerror = () => {
            setCurationError('No se pudo leer el archivo.');
            setIsCurationLoading(false);
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const toggleAttributeToCopy = (attr: AttributeKey) => {
        setAttributesToCopy((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(attr)) {
                newSet.delete(attr);
            } else {
                newSet.add(attr);
            }
            return newSet;
        });
    };

    const handleSourceChannelClick = (sourceChannel: Channel) => {
        if (!destinationChannelId || attributesToCopy.size === 0) return;
        saveStateToHistory();
        setMainChannels((prev) =>
            prev.map((dest) => {
                if (dest.id === destinationChannelId) {
                    const updated = { ...dest };
                    attributesToCopy.forEach((attr) => {
                        (updated as any)[attr] = sourceChannel[attr];
                    });
                    return updated;
                }
                return dest;
            })
        );
        setDestinationChannelId(null);
    };

    const mainListUniqueGroups = useMemo(
        () => ['All', ...new Set(mainChannels.map((c) => c.groupTitle).filter(Boolean))],
        [mainChannels]
    );

    const curationListUniqueGroups = useMemo(
        () => ['All', ...new Set(curationChannels.map((c) => c.groupTitle).filter(Boolean))],
        [curationChannels]
    );

    const filteredMainChannels = useMemo(() => {
        let channelsToFilter = mainListFilter === 'All' ? mainChannels : mainChannels.filter((c) => c.groupTitle === mainListFilter);
        if (mainListSearch) {
            channelsToFilter = channelsToFilter.filter(c => c.name.toLowerCase().includes(mainListSearch.toLowerCase()));
        }
        return channelsToFilter;
    }, [mainChannels, mainListFilter, mainListSearch]);

    const filteredCurationChannels = useMemo(() => {
        let channelsToFilter = curationListFilter === 'All'
            ? curationChannels
            : curationChannels.filter((c) => c.groupTitle === curationListFilter);
        if (curationListSearch) {
            channelsToFilter = channelsToFilter.filter(c => c.name.toLowerCase().includes(curationListSearch.toLowerCase()));
        }
        return channelsToFilter;
    }, [curationChannels, curationListFilter, curationListSearch]);

    const toggleCurationSelection = (id: string) => {
        setSelectedCurationChannels((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleAddSelectedFromCuration = () => {
        if (selectedCurationChannels.size === 0) return;
        const channelsToAdd = curationChannels.filter((c) => selectedCurationChannels.has(c.id));
        const newChannels = channelsToAdd.map((c) => ({
            ...c,
            id: `channel-${Date.now()}-${Math.random()}`,
            groupTitle: mainListFilter === 'All' ? c.groupTitle || 'Sin Grupo' : mainListFilter,
        }));
        setMainChannels((prev) => [...prev, ...newChannels].map((c, i) => ({ ...c, order: i + 1 })));
        setSelectedCurationChannels(new Set());
    };

    return {
        curationChannels,
        selectedCurationChannels,
        isCurationLoading,
        curationError,
        attributesToCopy,
        destinationChannelId,
        setDestinationChannelId,
        mainListFilter,
        setMainListFilter,
        curationListFilter,
        setCurationListFilter,
        handleCurationFileUpload,
        toggleAttributeToCopy,
        handleSourceChannelClick,
        mainListUniqueGroups,
        curationListUniqueGroups,
        filteredMainChannels,
        filteredCurationChannels,
        toggleCurationSelection,
        handleAddSelectedFromCuration,
        mainListSearch,
        setMainListSearch,
        curationListSearch,
        setCurationListSearch,
    };
};