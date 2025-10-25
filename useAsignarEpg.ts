import { useState, useMemo, useCallback } from 'react';
import { Channel, EpgChannel, AttributeKey } from './index';
import { useSmartSearch, SearchMatch } from './useSmartSearch';

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
    saveStateToHistory: () => void,
    settingsHook: { channelPrefixes: string[], channelSuffixes: string[] }
) => {
    const [epgChannels, setEpgChannels] = useState<EpgChannel[]>([]);
    const [isEpgLoading, setIsEpgLoading] = useState(false);
    const [epgError, setEpgError] = useState<string | null>(null);
    const [epgUrl, setEpgUrl] = useState('');
    const [epgIdListUrl, setEpgIdListUrl] = useState('');
    const [epgLogoFolderUrl, setEpgLogoFolderUrl] = useState('');
    const [destinationChannelId, setDestinationChannelId] = useState<string | null>(null);
    const [attributesToCopy, setAttributesToCopy] = useState<Set<AttributeKey>>(new Set());
    const [epgSearchTerm, setEpgSearchTerm] = useState('');
    const [isSmartSearchEnabled, setIsSmartSearchEnabled] = useState(true);
    const [smartSearchResults, setSmartSearchResults] = useState<SearchMatch<EpgChannel>[]>([]);
    const [assignmentMode, setAssignmentMode] = useState<'tvg-id' | 'tvg-name'>('tvg-id');
    const [selectedEpgChannels, setSelectedEpgChannels] = useState<Set<string>>(new Set());

    // Inicializar búsqueda inteligente
    const smartSearch = useSmartSearch({
        channelPrefixes: settingsHook.channelPrefixes,
        channelSuffixes: settingsHook.channelSuffixes
    });
    
    // Extraer funciones para evitar problemas de dependencias
    const { searchChannels, normalizeChannelName } = smartSearch;

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

    // Filtrar canales EPG con búsqueda inteligente
    const filteredEpgChannels = useMemo(() => {
        if (!epgSearchTerm.trim()) {
            setSmartSearchResults([]);
            return epgChannels;
        }

        if (isSmartSearchEnabled) {
            // Usar búsqueda inteligente
            const searchResults = searchChannels(epgChannels, epgSearchTerm, 0.4);
            setSmartSearchResults(searchResults);
            return searchResults.map(result => result.item);
        } else {
            // Búsqueda tradicional exacta
            setSmartSearchResults([]);
            return epgChannels.filter(channel => 
                channel.name.toLowerCase().includes(epgSearchTerm.toLowerCase()) ||
                channel.id.toLowerCase().includes(epgSearchTerm.toLowerCase())
            );
        }
    }, [epgChannels, epgSearchTerm, isSmartSearchEnabled, searchChannels]);

    const handleEpgSourceClick = (sourceEpg: EpgChannel) => {
        if (!destinationChannelId) return;
        saveStateToHistory();
        setChannels((prev) =>
            prev.map((dest) => {
                if (dest.id === destinationChannelId) {
                    const updated = { ...dest };
                    
                    // Asignar según el modo seleccionado
                    if (assignmentMode === 'tvg-id') {
                        updated.tvgId = sourceEpg.id;
                    } else {
                        updated.tvgName = sourceEpg.name;
                    }
                    
                    // Copiar logo si está seleccionado
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

    // Función para buscar canales EPG similares automáticamente
    const findSimilarEpgChannels = useCallback((channelName: string) => {
        if (!channelName.trim()) return [];
        return searchChannels(epgChannels, channelName, 0.5);
    }, [searchChannels, epgChannels]);

    // Función para alternar entre búsqueda inteligente y exacta
    const toggleSmartSearch = useCallback(() => {
        setIsSmartSearchEnabled(prev => !prev);
        setSmartSearchResults([]);
    }, []);

    // Función para obtener el score de similitud de un canal EPG
    const getEpgSimilarityScore = useCallback((channelId: string): number => {
        const result = smartSearchResults.find(result => result.item.id === channelId);
        return result ? result.score : 0;
    }, [smartSearchResults]);

    // Función para alternar selección de canales EPG
    const toggleEpgChannelSelection = useCallback((channelId: string) => {
        setSelectedEpgChannels(prev => {
            const newSelected = new Set(prev);
            if (newSelected.has(channelId)) {
                newSelected.delete(channelId);
            } else {
                newSelected.add(channelId);
            }
            return newSelected;
        });
    }, []);

    // Función para seleccionar/deseleccionar todos los canales EPG visibles
    const toggleSelectAllEpgChannels = useCallback(() => {
        const allVisibleIds = filteredEpgChannels.map(c => c.id);
        const currentSelection = new Set(selectedEpgChannels);
        
        const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => currentSelection.has(id));
        
        if (allSelected) {
            // Deseleccionar todos los visibles
            allVisibleIds.forEach(id => currentSelection.delete(id));
        } else {
            // Seleccionar todos los visibles
            allVisibleIds.forEach(id => currentSelection.add(id));
        }
        
        setSelectedEpgChannels(new Set(currentSelection));
    }, [filteredEpgChannels, selectedEpgChannels]);

    // Función para añadir canales EPG seleccionados a la lista principal
    const addSelectedEpgChannels = useCallback(() => {
        if (selectedEpgChannels.size === 0) return;
        
        saveStateToHistory();
        
        const channelsToAdd = epgChannels
            .filter(c => selectedEpgChannels.has(c.id))
            .map((epgChannel, index) => ({
                id: `epg-${Date.now()}-${index}`,
                order: 0, // Se actualizará después
                tvgId: epgChannel.id,
                tvgName: epgChannel.name,
                tvgLogo: epgChannel.logo,
                groupTitle: 'EPG Channels',
                name: epgChannel.name,
                url: 'http://error-stream-not-available.invalid/stream.m3u8'
            }));
        
        setChannels(prev => {
            const newChannels = [...prev, ...channelsToAdd];
            // Actualizar órdenes
            return newChannels.map((c, i) => ({ ...c, order: i + 1 }));
        });
        
        // Limpiar selección
        setSelectedEpgChannels(new Set());
    }, [selectedEpgChannels, epgChannels, setChannels, saveStateToHistory]);

    // Función para alternar entre modos de asignación
    const toggleAssignmentMode = useCallback(() => {
        setAssignmentMode(prev => prev === 'tvg-id' ? 'tvg-name' : 'tvg-id');
    }, []);

    return {
        epgChannels,
        filteredEpgChannels,
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
        // Nuevas funciones de búsqueda inteligente
        epgSearchTerm,
        setEpgSearchTerm,
        isSmartSearchEnabled,
        toggleSmartSearch,
        findSimilarEpgChannels,
        getEpgSimilarityScore,
        smartSearchResults,
        smartSearch,
        // Nuevas funciones para modo de asignación y añadir canales
        assignmentMode,
        toggleAssignmentMode,
        selectedEpgChannels,
        toggleEpgChannelSelection,
        toggleSelectAllEpgChannels,
        addSelectedEpgChannels,
    };
};
