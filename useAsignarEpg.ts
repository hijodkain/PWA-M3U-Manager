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
    const [lastSelectedEpgChannelIndex, setLastSelectedEpgChannelIndex] = useState<number | null>(null);

    // Inicializar búsqueda inteligente - se recrea cuando cambian los prefijos/sufijos
    const smartSearch = useSmartSearch({
        channelPrefixes: settingsHook.channelPrefixes,
        channelSuffixes: settingsHook.channelSuffixes
    });
    
    // Extraer funciones - se actualizarán automáticamente cuando smartSearch cambie
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

    const handleFetchEpgUrl = async (urlToFetch?: string) => {
        const targetUrl = urlToFetch || epgUrl;
        if (!targetUrl) {
            setEpgError('Por favor, introduce una URL de EPG.');
            return;
        }
        setIsEpgLoading(true);
        setEpgError(null);
        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`Error al descargar el EPG: ${response.statusText}`);
            }
            const text = await response.text();
            setEpgChannels(parseXMLTV(text));
            // Actualizar epgUrl si se pasó una URL específica
            if (urlToFetch) {
                setEpgUrl(urlToFetch);
            }
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
                    
                    // Verificar modos activos
                    const isOttMode = attributesToCopy.has('tvgName');
                    const isTivimateMode = attributesToCopy.has('tvgId');
                    const copyName = attributesToCopy.has('name');
                    
                    // Modo OTT: asignar el channel ID solo a tvgName
                    if (isOttMode) {
                        updated.tvgName = sourceEpg.id;
                    }
                    
                    // Modo TiviMate: asignar el channel ID a tvgId
                    if (isTivimateMode) {
                        updated.tvgId = sourceEpg.id;
                    }
                    
                    // Copiar logo si está seleccionado
                    if (attributesToCopy.has('tvgLogo')) {
                        updated.tvgLogo = sourceEpg.logo;
                    }
                    
                    // Copiar nombre si está activo
                    if (copyName) {
                        updated.name = sourceEpg.name;
                    }
                    
                    return updated;
                }
                return dest;
            })
        );
        setDestinationChannelId(null);
    };

    // Función para asignar el nombre del canal EPG al canal principal seleccionado
    const assignChannelName = useCallback((sourceEpg: EpgChannel) => {
        if (!destinationChannelId) return;
        saveStateToHistory();
        setChannels((prev) =>
            prev.map((dest) => {
                if (dest.id === destinationChannelId) {
                    return { ...dest, name: sourceEpg.name };
                }
                return dest;
            })
        );
        setDestinationChannelId(null);
    }, [destinationChannelId, setChannels, saveStateToHistory]);

    // Función para asignar automáticamente EPG a canales sin asignación en un grupo filtrado
    const autoAssignEpgToVisibleGroup = useCallback((visibleChannels: Channel[]) => {
        if (epgChannels.length === 0) {
            alert('No hay canales EPG cargados');
            return;
        }

        // Filtrar solo canales sin EPG asignado
        const channelsWithoutEpg = visibleChannels.filter(ch => !ch.tvgId && !ch.tvgName);

        if (channelsWithoutEpg.length === 0) {
            alert('Todos los canales visibles ya tienen EPG asignado');
            return;
        }

        // Primero, calcular coincidencias para contar correctamente
        const matches = new Map<string, EpgChannel>();
        
        channelsWithoutEpg.forEach((channel) => {
            let exactMatch: EpgChannel | undefined;
            
            // Intento 1: Comparación exacta (case-insensitive y trim)
            const channelNameClean = channel.name.trim().toLowerCase();
            exactMatch = epgChannels.find(epgCh => 
                epgCh.name.trim().toLowerCase() === channelNameClean
            );
            
            // Intento 2: Si no encuentra, probar con normalización (eliminar prefijos/sufijos)
            if (!exactMatch) {
                const normalizedChannelName = normalizeChannelName(channel.name).toLowerCase();
                exactMatch = epgChannels.find(epgCh => {
                    const normalizedEpgName = normalizeChannelName(epgCh.name).toLowerCase();
                    return normalizedEpgName === normalizedChannelName;
                });
            }
            
            // Intento 3: Si aún no encuentra, probar sin espacios
            if (!exactMatch) {
                const channelNameNoSpaces = channel.name.trim().toLowerCase().replace(/\s+/g, '');
                exactMatch = epgChannels.find(epgCh => 
                    epgCh.name.trim().toLowerCase().replace(/\s+/g, '') === channelNameNoSpaces
                );
            }
            
            if (exactMatch) {
                matches.set(channel.id, exactMatch);
            }
        });

        if (matches.size === 0) {
            alert(`No se encontraron coincidencias exactas para los ${channelsWithoutEpg.length} canales sin EPG`);
            return;
        }

        saveStateToHistory();

        setChannels((prev) => {
            return prev.map((channel) => {
                // Solo procesar canales que tienen coincidencia
                const exactMatch = matches.get(channel.id);
                if (!exactMatch) {
                    return channel;
                }

                const updated = { ...channel };

                // En modo automático, siempre asignar tvgId (modo estándar)
                updated.tvgId = exactMatch.id;
                
                // Copiar logo si está disponible
                if (exactMatch.logo) {
                    updated.tvgLogo = exactMatch.logo;
                }

                return updated;
            });
        });

        alert(`EPG asignado automáticamente a ${matches.size} de ${channelsWithoutEpg.length} canales`);
    }, [epgChannels, normalizeChannelName, setChannels, saveStateToHistory]);

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

    // Función para alternar selección de canales EPG con soporte para selección por rango (Shift)
    const toggleEpgChannelSelection = useCallback((channelId: string, shiftKey: boolean = false) => {
        const currentIndex = filteredEpgChannels.findIndex(ch => ch.id === channelId);
        
        if (shiftKey && lastSelectedEpgChannelIndex !== null && currentIndex !== -1) {
            // Selección por rango con Shift
            const startIndex = Math.min(lastSelectedEpgChannelIndex, currentIndex);
            const endIndex = Math.max(lastSelectedEpgChannelIndex, currentIndex);
            
            setSelectedEpgChannels(prev => {
                const newSelected = new Set(prev);
                const channelsInRange = filteredEpgChannels.slice(startIndex, endIndex + 1);
                
                // Determinar si vamos a seleccionar o deseleccionar basado en el canal clickeado
                const shouldSelect = !newSelected.has(channelId);
                
                channelsInRange.forEach(channel => {
                    if (shouldSelect) {
                        newSelected.add(channel.id);
                    } else {
                        newSelected.delete(channel.id);
                    }
                });
                
                return newSelected;
            });
        } else {
            // Selección individual normal
            setSelectedEpgChannels(prev => {
                const newSelected = new Set(prev);
                if (newSelected.has(channelId)) {
                    newSelected.delete(channelId);
                } else {
                    newSelected.add(channelId);
                }
                return newSelected;
            });
        }
        
        // Actualizar el último índice seleccionado
        setLastSelectedEpgChannelIndex(currentIndex);
    }, [filteredEpgChannels, lastSelectedEpgChannelIndex]);

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

    // Función para limpiar la fuente EPG cargada
    const clearEpgChannels = useCallback(() => {
        setEpgChannels([]);
        setEpgUrl('');
        setEpgSearchTerm('');
        setSmartSearchResults([]);
        setSelectedEpgChannels(new Set());
        setDestinationChannelId(null);
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
        // Nuevas funciones para asignación de nombre y asignación automática
        assignChannelName,
        autoAssignEpgToVisibleGroup,
        // Función para limpiar fuente EPG
        clearEpgChannels,
    };
};
