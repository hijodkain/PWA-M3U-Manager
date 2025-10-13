import { useState, useMemo, useCallback } from 'react';
import { Channel, AttributeKey } from '../types';

type VerificationStatus = 'pending' | 'verifying' | 'ok' | 'failed';

export interface ChannelVerification {
    status: VerificationStatus | string;
    elapsed?: number;
}

export const useReparacion = (
    mainChannels: Channel[],
    setMainChannels: React.Dispatch<React.SetStateAction<Channel[]>>,
    saveStateToHistory: () => void
) => {
    const [reparacionChannels, setReparacionChannels] = useState<Channel[]>([]);
    const [selectedReparacionChannels, setSelectedReparacionChannels] = useState<Set<string>>(new Set());
    const [attributesToCopy, setAttributesToCopy] = useState<Set<AttributeKey>>(new Set());
    const [destinationChannelId, setDestinationChannelId] = useState<string | null>(null);
    const [verificationStatus, setVerificationStatus] = useState<Record<string, VerificationStatus>>({});
    const [reparacionUrl, setReparacionUrl] = useState('');
    const [isCurationLoading, setIsCurationLoading] = useState(false);
    const [curationError, setCurationError] = useState<string | null>(null);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

    const [mainListFilter, setMainListFilter] = useState('All');
    const [reparacionListFilter, setReparacionListFilter] = useState('All');
    const [mainListSearch, setMainListSearch] = useState('');
    const [reparacionListSearch, setReparacionListSearch] = useState('');

    const verifyChannel = async (channelId: string, url: string) => {
        setVerificationStatus(prev => ({ ...prev, [channelId]: 'verifying' }));
        try {
            const proxyUrl = `/api/verify_channel?url=${encodeURIComponent(url)}&spoof=true`;
            const response = await fetch(proxyUrl);
            const data = await response.json();
            setVerificationStatus(prev => ({ ...prev, [channelId]: data.status || 'failed' }));
        } catch (error) {
            console.error('Verification failed', error);
            setVerificationStatus(prev => ({ ...prev, [channelId]: 'failed' }));
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
        const newStatus = { ...verificationStatus };
        setMainChannels(prev =>
            prev.map(channel => {
                if (verificationStatus[channel.id] === 'failed') {
                    newStatus[channel.id] = 'pending';
                    return { ...channel, url: 'http://--' };
                }
                return channel;
            })
        );
        setVerificationStatus(newStatus);
    };

    const failedChannelsByGroup = useMemo(() => {
        return mainChannels.reduce((acc, channel) => {
            if (verificationStatus[channel.id] === 'failed') {
                const group = channel.groupTitle || 'Sin Grupo';
                acc[group] = (acc[group] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
    }, [mainChannels, verificationStatus]);


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
            channels = channels.filter(c => c.name.toLowerCase().includes(mainListSearch.toLowerCase()));
        }
        return channels;
    }, [mainChannels, mainListFilter, mainListSearch]);

    const filteredReparacionChannels = useMemo(() => {
        let channels = reparacionChannels;
        if (reparacionListFilter !== 'All') {
            channels = channels.filter(c => c.groupTitle === reparacionListFilter);
        }
        if (reparacionListSearch) {
            channels = channels.filter(c => c.name.toLowerCase().includes(reparacionListSearch.toLowerCase()));
        }
        return channels;
    }, [reparacionChannels, reparacionListFilter, reparacionListSearch]);

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
        verificationStatus,
        verifyChannel,
        clearFailedChannelsUrls,
        failedChannelsByGroup,
        reparacionUrl,
        setReparacionUrl,
        handleReparacionUrlLoad,
        isCurationLoading,
        curationError,
        verifyAllChannelsInGroup,
    };
};