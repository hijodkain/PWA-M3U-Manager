import { useState, useMemo } from 'react';
import { Channel, AttributeKey } from './index';

type VerificationStatus = 'pending' | 'verifying' | 'ok' | 'failed';

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

    const [mainListFilter, setMainListFilter] = useState('All');
    const [reparacionListFilter, setReparacionListFilter] = useState('All');
    const [mainListSearch, setMainListSearch] = useState('');
    const [reparacionListSearch, setReparacionListSearch] = useState('');

    const verifyChannel = async (channelId: string, url: string) => {
        setVerificationStatus(prev => ({ ...prev, [channelId]: 'verifying' }));
        try {
            const response = await fetch(`/api/verify_channel?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            setVerificationStatus(prev => ({ ...prev, [channelId]: data.status || 'failed' }));
        } catch (error) {
            console.error('Verification failed', error);
            setVerificationStatus(prev => ({ ...prev, [channelId]: 'failed' }));
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
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                setReparacionChannels(parseM3U(e.target?.result as string));
            } catch (err) {
                console.error(err);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleReparacionUrlLoad = async () => {
        if (!reparacionUrl) return;
        try {
            const response = await fetch(reparacionUrl);
            const text = await response.text();
            setReparacionChannels(parseM3U(text));
        } catch (error) {
            console.error('Failed to load from URL', error);
        }
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

    const toggleReparacionSelection = (id: string) => {
        setSelectedReparacionChannels(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
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
    };
};