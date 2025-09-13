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
            const tvgId = info.match(/tvg-id="([^"]*)"/?.[1] || '';
            const tvgName = info.match(/tvg-name="([^"]*)"/?.[1] || '';
            const tvgLogo = info.match(/tvg-logo="([^"]*)"/?.[1] || '';
            const groupTitle = info.match(/group-title="([^"]*)"/?.[1] || '';
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
    const [attributesToCopy, setAttributesToCopy] = useState<Set<AttributeKey>>(new Set());
    const [destinationChannelId, setDestinationChannelId] = useState<string | null>(null);
    const [verificationStatus, setVerificationStatus] = useState<Record<string, VerificationStatus>>({});

    const [mainListFilter, setMainListFilter] = useState('All');
    const [curationListFilter, setCurationListFilter] = useState('All');
    const [mainListSearch, setMainListSearch] = useState('');
    const [curationListSearch, setCurationListSearch] = useState('');

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

    const handleCurationFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                setCurationChannels(parseM3U(e.target?.result as string));
            } catch (err) {
                console.error(err);
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
    };

    const mainListUniqueGroups = useMemo(
        () => ['All', ...Array.from(new Set(mainChannels.map((c) => c.groupTitle).filter(Boolean)))],
        [mainChannels]
    );

    const curationListUniqueGroups = useMemo(
        () => ['All', ...Array.from(new Set(curationChannels.map((c) => c.groupTitle).filter(Boolean)))],
        [curationChannels]
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

    const filteredCurationChannels = useMemo(() => {
        let channels = curationChannels;
        if (curationListFilter !== 'All') {
            channels = channels.filter(c => c.groupTitle === curationListFilter);
        }
        if (curationListSearch) {
            channels = channels.filter(c => c.name.toLowerCase().includes(curationListSearch.toLowerCase()));
        }
        return channels;
    }, [curationChannels, curationListFilter, curationListSearch]);

    const toggleCurationSelection = (id: string) => {
        setSelectedCurationChannels(prev => {
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
        saveStateToHistory();
        const channelsToAdd = curationChannels.filter(c => selectedCurationChannels.has(c.id));
        setMainChannels(prev => [...prev, ...channelsToAdd].map((c, i) => ({ ...c, order: i + 1 })));
        setSelectedCurationChannels(new Set());
    };

    return {
        selectedCurationChannels,
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
        setCurationChannels,
        verificationStatus,
        verifyChannel,
    };
};