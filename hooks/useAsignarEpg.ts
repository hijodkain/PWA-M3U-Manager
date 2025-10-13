import { useState, useMemo } from 'react';
import { Channel, EpgChannel, AttributeKey } from '../types';

const parseXMLTV = (content: string): EpgChannel[] => {
    if (typeof window === 'undefined') {
        return [];
    }
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

export const useAsignarEpg = (
    channels: Channel[],
    setChannels: React.Dispatch<React.SetStateAction<Channel[]>>,
    saveStateToHistory: () => void
) => {
    const [epgChannels, setEpgChannels] = useState<EpgChannel[]>([]);
    const [isEpgLoading, setIsEpgLoading] = useState(false);
    const [epgError, setEpgError] = useState<string | null>(null);
    const [epgUrl, setEpgUrl] = useState('');
    const [epgIdListUrl, setEpgIdListUrl] = useState('');
    const [epgLogoFolderUrl, setEpgLogoFolderUrl] = useState('');
    const [destinationChannelId, setDestinationChannelId] = useState<string | null>(null);
    const [attributesToCopy, setAttributesToCopy] = useState<Set<AttributeKey>>(new Set());

    const handleEpgFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsEpgLoading(true);
        setEpgError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                setEpgChannels(parseXMLTV(e.target?.result as string));
            } catch (err) {
                setEpgError(err instanceof Error ? err.message : 'Error al procesar el archivo.');
            } finally {
                setIsEpgLoading(false);
            }
        };
        reader.onerror = () => {
            setEpgError('No se pudo leer el archivo.');
            setIsEpgLoading(false);
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleFetchEpgUrl = async () => {
        if (!epgUrl) {
            setEpgError('Por favor, introduce una URL de EPG.');
            return;
        }
        setIsEpgLoading(true);
        setEpgError(null);
        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(epgUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`Error al descargar el EPG: ${response.statusText}`);
            }
            const text = await response.text();
            setEpgChannels(parseXMLTV(text));
        } catch (err) {
            setEpgError(err instanceof Error ? err.message : 'Ocurrió un error desconocido.');
        } finally {
            setIsEpgLoading(false);
        }
    };

    const handleGenerateEpgFromUrls = async () => {
        if (!epgIdListUrl || !epgLogoFolderUrl) {
            setEpgError('Introduce ambas URLs para generar el EPG.');
            return;
        }
        setIsEpgLoading(true);
        setEpgError(null);
        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(epgIdListUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`Error al descargar la lista de IDs: ${response.statusText}`);
            }
            const text = await response.text();
            const ids = text.split('\n').map((id) => id.trim()).filter(Boolean);
            const generatedEpg = ids.map((id) => ({
                id,
                name: id,
                logo: `${epgLogoFolderUrl.replace(/\$/, '')}/${id}.png`,
            }));
            setEpgChannels(generatedEpg);
        } catch (err) {
            setEpgError(err instanceof Error ? err.message : 'Ocurrió un error desconocido.');
        } finally {
            setIsEpgLoading(false);
        }
    };

    const epgIdSet = useMemo(() => new Set(epgChannels.map((c) => c.id)), [epgChannels]);

    const handleEpgSourceClick = (sourceEpg: EpgChannel) => {
        if (!destinationChannelId) return;
        saveStateToHistory();
        setChannels((prev) =>
            prev.map((dest) => {
                if (dest.id === destinationChannelId) {
                    const updated = { ...dest, tvgId: sourceEpg.id };
                    if (attributesToCopy.has('tvgLogo')) {
                        updated.tvgLogo = sourceEpg.logo;
                    }
                    return updated;
                }
                return dest;
            })
        );
        setDestinationChannelId(null);
    };

    return {
        epgChannels,
        isEpgLoading,
        epgError,
        epgUrl,
        setEpgUrl,
        epgIdListUrl,
        setEpgIdListUrl,
        epgLogoFolderUrl,
        setEpgLogoFolderUrl,
        destinationChannelId,
        setDestinationChannelId,
        attributesToCopy,
        setAttributesToCopy,
        handleEpgFileUpload,
        handleFetchEpgUrl,
        handleGenerateEpgFromUrls,
        epgIdSet,
        handleEpgSourceClick,
    };
};
