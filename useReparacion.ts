import { useState, useMemo, useCallback } from 'react';
import { Channel, AttributeKey, QualityLevel, ChannelStatus } from './index';
import { useSmartSearch, SearchMatch } from './useSmartSearch';

interface ChannelVerificationInfo {
    status: ChannelStatus;
    quality: QualityLevel;
    resolution?: string;
}

export const useReparacion = (
    mainChannels: Channel[],
    setMainChannels: React.Dispatch<React.SetStateAction<Channel[]>>,
    saveStateToHistory: () => void,
    settingsHook: { channelPrefixes: string[], channelSuffixes: string[] }
) => {
    const [reparacionChannels, setReparacionChannels] = useState<Channel[]>([]);
    const [selectedReparacionChannels, setSelectedReparacionChannels] = useState<Set<string>>(new Set());
    const [attributesToCopy, setAttributesToCopy] = useState<Set<AttributeKey>>(new Set());
    const [destinationChannelId, setDestinationChannelId] = useState<string | null>(null);
    const [verificationInfo, setVerificationInfo] = useState<Record<string, ChannelVerificationInfo>>({});
    const [reparacionUrl, setReparacionUrl] = useState('');
    const [isCurationLoading, setIsCurationLoading] = useState(false);
    const [curationError, setCurationError] = useState<string | null>(null);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

    const [mainListFilter, setMainListFilter] = useState('All');
    const [reparacionListFilter, setReparacionListFilter] = useState('All');
    const [mainListSearch, setMainListSearch] = useState('');
    const [reparacionListSearch, setReparacionListSearch] = useState('');
    const [smartSearchResults, setSmartSearchResults] = useState<SearchMatch<Channel>[]>([]);
    const [isSmartSearchEnabled, setIsSmartSearchEnabled] = useState(true);

    // Inicializar búsqueda inteligente
    const smartSearch = useSmartSearch({
        channelPrefixes: settingsHook.channelPrefixes,
        channelSuffixes: settingsHook.channelSuffixes
    });
    
    // Extraer funciones para evitar problemas de dependencias
    const { searchChannels, normalizeChannelName } = smartSearch;

    const verifyChannel = async (channelId: string, url: string) => {
        setVerificationInfo(prev => ({ 
            ...prev, 
            [channelId]: { status: 'verifying', quality: 'unknown' }
        }));
        
        try {
            const apiUrl = `/api/verify_channel?url=${encodeURIComponent(url)}`;
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            setVerificationInfo(prev => ({ 
                ...prev, 
                [channelId]: {
                    status: data.status || 'failed',
                    quality: data.quality || 'unknown',
                    resolution: data.resolution,
                }
            }));

            // También actualizar el canal con la calidad detectada
            setReparacionChannels(prevChannels => 
                prevChannels.map(ch => 
                    ch.id === channelId 
                        ? { ...ch, quality: data.quality, resolution: data.resolution, status: data.status }
                        : ch
                )
            );
            setMainChannels(prevChannels => 
                prevChannels.map(ch => 
                    ch.id === channelId 
                        ? { ...ch, quality: data.quality, resolution: data.resolution, status: data.status }
                        : ch
                )
            );
        } catch (error) {
            console.error('Verification failed', error);
            setVerificationInfo(prev => ({ 
                ...prev, 
                [channelId]: { status: 'failed', quality: 'unknown' }
            }));
        }
    };

    const verifyAllChannelsInGroup = () => {
        const channelsToVerify = mainChannels.filter(channel => 
            mainListFilter === 'All' || channel.groupTitle === mainListFilter
        );
        channelsToVerify.forEach(channel => {
            verifyChannel(channel.id, channel.url);
        });
    };

    const verifySelectedReparacionChannels = () => {
        selectedReparacionChannels.forEach(channelId => {
            const channel = reparacionChannels.find(c => c.id === channelId);
            if (channel) {
                verifyChannel(channel.id, channel.url);
            }
        });
    };

    const processCurationM3U = useCallback((content: string) => {
        setIsCurationLoading(true);
        setCurationError(null);

        const worker = new Worker(new URL('./m3u-parser.worker.ts', import.meta.url), {
            type: 'module',
        });

        worker.onmessage = (event) => {
            const { type, channels, message } = event.data;
            if (type === 'success') {
                setReparacionChannels(channels);
            } else {
                setCurationError(message);
            }
            setIsCurationLoading(false);
            worker.terminate();
        };

        worker.onerror = (error) => {
            setCurationError(`Worker error: ${error.message}`);
            setIsCurationLoading(false);
            worker.terminate();
        };

        worker.postMessage(content);
    }, []);

    const handleReparacionUrlLoad = async () => {
        if (!reparacionUrl) return;
        setIsCurationLoading(true);
        setCurationError(null);
        try {
            // Detectar si es una URL blob (generada por YouTube Live)
            if (reparacionUrl.startsWith('blob:')) {
                // Para URLs blob, usar el contenido guardado en localStorage
                const youtubeContent = localStorage.getItem('youtube_m3u_content');
                if (youtubeContent) {
                    processCurationM3U(youtubeContent);
                    return;
                } else {
                    // Si no hay contenido guardado, intentar fetch directo de la URL blob
                    const response = await fetch(reparacionUrl);
                    if (!response.ok) {
                        throw new Error(`Error al cargar la lista: ${response.statusText}`);
                    }
                    const text = await response.text();
                    processCurationM3U(text);
                    return;
                }
            }
            
            // Para URLs normales, usar el proxy como antes
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(reparacionUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`Error al descargar la lista: ${response.statusText}`);
            }
            const text = await response.text();
            processCurationM3U(text);
        } catch (error) {
            console.error('Failed to load from URL', error);
            setCurationError(error instanceof Error ? error.message : 'Ocurrió un error desconocido.');
            setIsCurationLoading(false);
        }
    };

    const clearFailedChannelsUrls = () => {
        saveStateToHistory();
        const newInfo = { ...verificationInfo };
        setMainChannels(prev =>
            prev.map(channel => {
                if (verificationInfo[channel.id]?.status === 'failed') {
                    newInfo[channel.id] = { status: 'pending', quality: 'unknown' };
                    return { ...channel, url: 'http://--', status: 'pending', quality: 'unknown' };
                }
                return channel;
            })
        );
        setVerificationInfo(newInfo);
    };

    const failedChannelsByGroup = useMemo(() => {
        return mainChannels.reduce((acc, channel) => {
            if (verificationInfo[channel.id]?.status === 'failed') {
                const group = channel.groupTitle || 'Sin Grupo';
                acc[group] = (acc[group] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
    }, [mainChannels, verificationInfo]);


    const handleReparacionFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsCurationLoading(true);
        setCurationError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (content) {
                processCurationM3U(content);
            } else {
                setCurationError('No se pudo leer el contenido del archivo.');
                setIsCurationLoading(false);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const toggleAttributeToCopy = (attribute: AttributeKey) => {
        setAttributesToCopy(prev => {
            const newSet = new Set(prev);
            if (newSet.has(attribute)) {
                newSet.delete(attribute);
            } else {
                newSet.add(attribute);
            }
            return newSet;
        });
    };

    const handleSourceChannelClick = (sourceChannel: Channel) => {
        if (!destinationChannelId || attributesToCopy.size === 0) return;
        saveStateToHistory();
        setMainChannels(prev =>
            prev.map(channel => {
                if (channel.id === destinationChannelId) {
                    const updatedChannel = { ...channel };
                    attributesToCopy.forEach(attr => {
                        (updatedChannel[attr] as any) = sourceChannel[attr];
                    });
                    return updatedChannel;
                }
                return channel;
            })
        );

        if (attributesToCopy.has('url')) {
            verifyChannel(destinationChannelId, sourceChannel.url);
        }
    };

    const mainListUniqueGroups = useMemo(
        () => ['All', ...Array.from(new Set(mainChannels.map((c) => c.groupTitle).filter(Boolean)))],
        [mainChannels]
    );

    const reparacionListUniqueGroups = useMemo(
        () => ['All', ...Array.from(new Set(reparacionChannels.map((c) => c.groupTitle).filter(Boolean)))],
        [reparacionChannels]
    );

    const filteredMainChannels = useMemo(() => {
        let channels = mainChannels;
        if (mainListFilter !== 'All') {
            channels = channels.filter(c => c.groupTitle === mainListFilter);
        }
        if (mainListSearch) {
            if (isSmartSearchEnabled) {
                // Usar búsqueda inteligente
                const searchResults = searchChannels(channels, mainListSearch, 0.4);
                return searchResults.map(result => result.item);
            } else {
                // Búsqueda tradicional exacta
                channels = channels.filter(c => c.name.toLowerCase().includes(mainListSearch.toLowerCase()));
            }
        }
        return channels;
    }, [mainChannels, mainListFilter, mainListSearch, isSmartSearchEnabled, searchChannels]);

    const filteredReparacionChannels = useMemo(() => {
        let channels = reparacionChannels;
        if (reparacionListFilter !== 'All') {
            channels = channels.filter(c => c.groupTitle === reparacionListFilter);
        }
        if (reparacionListSearch) {
            if (isSmartSearchEnabled) {
                // Usar búsqueda inteligente y guardar resultados para mostrar scores
                const searchResults = searchChannels(channels, reparacionListSearch, 0.4);
                setSmartSearchResults(searchResults);
                return searchResults.map(result => result.item);
            } else {
                // Búsqueda tradicional exacta
                channels = channels.filter(c => c.name.toLowerCase().includes(reparacionListSearch.toLowerCase()));
                setSmartSearchResults([]);
            }
        } else {
            setSmartSearchResults([]);
        }
        return channels;
    }, [reparacionChannels, reparacionListFilter, reparacionListSearch, isSmartSearchEnabled, searchChannels]);

    const toggleReparacionSelection = useCallback((id: string, index: number, shiftKey: boolean, metaKey: boolean, ctrlKey: boolean) => {
        const newSelected = new Set(selectedReparacionChannels);

        if (shiftKey && lastSelectedIndex !== null) {
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);
            for (let i = start; i <= end; i++) {
                newSelected.add(filteredReparacionChannels[i].id);
            }
        } else if (metaKey || ctrlKey) {
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
        } else {
            if (newSelected.has(id) && newSelected.size === 1) {
                newSelected.clear();
            } else {
                newSelected.clear();
                newSelected.add(id);
            }
        }

        setSelectedReparacionChannels(newSelected);
        setLastSelectedIndex(index);
    }, [selectedReparacionChannels, lastSelectedIndex, filteredReparacionChannels]);

    const toggleSelectAllReparacionGroup = () => {
        const allIdsInGroup = filteredReparacionChannels.map(c => c.id);
        const currentSelection = new Set(selectedReparacionChannels);

        const allVisibleSelected = allIdsInGroup.length > 0 && allIdsInGroup.every(id => currentSelection.has(id));

        if (allVisibleSelected) {
            allIdsInGroup.forEach(id => currentSelection.delete(id));
        } else {
            allIdsInGroup.forEach(id => currentSelection.add(id));
        }
        setSelectedReparacionChannels(new Set(currentSelection));
    };

    const handleAddSelectedFromReparacion = () => {
        if (selectedReparacionChannels.size === 0) return;
        saveStateToHistory();
        const channelsToAdd = reparacionChannels.filter(c => selectedReparacionChannels.has(c.id));
        setMainChannels(prev => [...prev, ...channelsToAdd].map((c, i) => ({ ...c, order: i + 1 })));
        setSelectedReparacionChannels(new Set());
    };

    // Función para buscar canales similares automáticamente
    const findSimilarChannels = useCallback((channelName: string, sourceChannels: Channel[] = reparacionChannels) => {
        if (!channelName.trim()) return [];
        return searchChannels(sourceChannels, channelName, 0.5);
    }, [searchChannels, reparacionChannels]);

    // Función para alternar entre búsqueda inteligente y exacta
    const toggleSmartSearch = useCallback(() => {
        setIsSmartSearchEnabled(prev => !prev);
        // Limpiar resultados cuando cambiamos de modo
        setSmartSearchResults([]);
    }, []);

    // Función para obtener el score de similitud de un canal
    const getChannelSimilarityScore = useCallback((channelId: string): number => {
        const result = smartSearchResults.find(result => result.item.id === channelId);
        return result ? result.score : 0;
    }, [smartSearchResults]);

    return {
        selectedReparacionChannels,
        attributesToCopy,
        destinationChannelId,
        setDestinationChannelId,
        mainListFilter,
        setMainListFilter,
        reparacionListFilter,
        setReparacionListFilter,
        handleReparacionFileUpload,
        toggleAttributeToCopy,
        handleSourceChannelClick,
        mainListUniqueGroups,
        reparacionListUniqueGroups,
        filteredMainChannels,
        filteredReparacionChannels,
        toggleReparacionSelection,
        toggleSelectAllReparacionGroup,
        verifySelectedReparacionChannels,
        handleAddSelectedFromReparacion,
        mainListSearch,
        setMainListSearch,
        reparacionListSearch,
        setReparacionListSearch,
        setReparacionChannels,
        verificationInfo,
        verifyChannel,
        clearFailedChannelsUrls,
        failedChannelsByGroup,
        reparacionUrl,
        setReparacionUrl,
        handleReparacionUrlLoad,
        isCurationLoading,
        curationError,
        verifyAllChannelsInGroup,
        // Nuevas funciones de búsqueda inteligente
        smartSearchResults,
        isSmartSearchEnabled,
        toggleSmartSearch,
        findSimilarChannels,
        getChannelSimilarityScore,
        smartSearch,
    };
};