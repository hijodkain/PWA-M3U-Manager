import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { Channel, ChannelStatus } from './index';

function extractDropboxFileName(url: string): string | null {
    if (!url) {
        return null;
    }
    try {
        const urlObject = new URL(url);
        const pathname = urlObject.pathname;
        const parts = pathname.split('/');
        let filename = parts[parts.length - 1];
        
        // Limpiar parámetros de query si existen en el nombre
        if (filename.includes('?')) {
            filename = filename.split('?')[0];
        }
        
        // Verificar que sea un archivo válido (.m3u, .m3u8, etc.)
        if (filename && (filename.endsWith('.m3u') || filename.endsWith('.m3u8') || filename.includes('.'))) {
            return filename;
        }
        
        return null;
    } catch (error) {
        console.error('Error extracting filename from URL:', error);
        return null;
    }
}

type Status = 'ok' | 'failed';

interface VerificationResult {
    [url: string]: Status;
}

export const useChannels = (setFailedChannels: React.Dispatch<React.SetStateAction<Channel[]>>) => {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState('my_playlist.m3u');
    const [originalFileName, setOriginalFileName] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
    const [filterGroup, setFilterGroup] = useState<string>('Todos los canales');
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const prevChannelsCount = useRef(channels.length);
    const [history, setHistory] = useState<Channel[][]>([]);
    const [redoHistory, setRedoHistory] = useState<Channel[][]>([]);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationProgress, setVerificationProgress] = useState(0);

    const processM3UContent = (content: string) => {
        setIsLoading(true);
        setError(null);

        const worker = new Worker(new URL('./m3u-parser.worker.ts', import.meta.url), {
            type: 'module',
        });

        worker.onmessage = (event) => {
            const { type, channels, message } = event.data;
            if (type === 'success') {
                setChannels(channels);
                setSelectedChannels([]);
            } else {
                setError(message);
            }
            setIsLoading(false);
            worker.terminate();
        };

        worker.onerror = (error) => {
            setError(`Worker error: ${error.message}`);
            setIsLoading(false);
            worker.terminate();
        };

        worker.postMessage(content);
    };

    const handleFetchUrl = async () => {
        if (!url) {
            setError('Por favor, introduce una URL.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            // Detectar si es una URL blob (generada por YouTube Live)
            if (url.startsWith('blob:')) {
                // Para URLs blob, usar el contenido guardado en localStorage
                const youtubeContent = localStorage.getItem('youtube_m3u_content');
                if (youtubeContent) {
                    processM3UContent(youtubeContent);
                    setFileName('YouTube Live');
                    return;
                } else {
                    // Si no hay contenido guardado, intentar fetch directo de la URL blob
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Error al cargar la lista: ${response.statusText}`);
                    }
                    const text = await response.text();
                    processM3UContent(text);
                    setFileName('YouTube Live');
                    return;
                }
            }
            
            // Para URLs normales, usar el proxy como antes
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`Error al descargar la lista: ${response.statusText}`);
            }
            const text = await response.text();
            processM3UContent(text);
            const extractedFname = extractDropboxFileName(url);
            if (extractedFname) {
                setFileName(extractedFname);
                setOriginalFileName(extractedFname);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocurrió un error desconocido.');
            setIsLoading(false); // Also set loading to false on fetch error
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsLoading(true);
        setError(null);
        setFileName(file.name);
        setOriginalFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (content) {
                processM3UContent(content);
            } else {
                setError('No se pudo leer el contenido del archivo.');
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
            groupTitle: filterGroup === 'Todos los canales' ? 'Nuevo Grupo' : filterGroup,
            name: 'Nuevo Canal',
            url: '',
            status: 'pending',
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

    const handleUpdateChannel = (channelId: string, field: keyof Channel, newValue: string) => {
        const isMultiSelect = selectedChannels.includes(channelId) && selectedChannels.length > 1;
        
        if (isMultiSelect) {
            if (field === 'groupTitle') {
                setChannels((prev) =>
                    prev.map((ch) =>
                        selectedChannels.includes(ch.id) ? { ...ch, groupTitle: newValue } : ch
                    )
                );
                // Deseleccionar todos los canales después de aplicar el cambio
                setSelectedChannels([]);
            }
        } else {
            setChannels((prev) =>
                prev.map((ch) => (ch.id === channelId ? { ...ch, [field]: newValue } : ch))
            );
        }
    };    const handleOrderChange = (channelId: string, newOrderStr: string) => {
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
        
        if (!over) {
            setActiveId(null);
            return;
        }

        if (active.id !== over.id) {
            setChannels((items) => {
                const isMultiDrag = selectedChannels.includes(active.id) && selectedChannels.length > 1;

                if (isMultiDrag) {
                    // Mover múltiples canales seleccionados
                    const activeIndex = items.findIndex((i) => i.id === active.id);
                    const overIndex = items.findIndex((i) => i.id === over.id);
                    
                    if (activeIndex === -1 || overIndex === -1) return items;

                    // Si soltamos sobre un ítem que es parte de la selección, no hacemos nada
                    if (selectedChannels.includes(over.id)) return items;

                    const storedSelectedItems = items.filter(item => selectedChannels.includes(item.id));
                    // Mantener el orden relativo original de la selección
                    // Opcional: ordenar por su orden actual si se desea
                    // storedSelectedItems.sort((a, b) => a.order - b.order); 

                    const itemsWithoutSelection = items.filter(item => !selectedChannels.includes(item.id));
                    
                    // Encontrar el índice de destino en el array limpio
                    // El índice 'over' que nos da dnd-kit es sobre el array visual, 
                    // pero al mutar el array necesitamos el índice en 'itemsWithoutSelection'.
                    // Sin embargo, una simplificación es buscar el ítem 'over' en 'itemsWithoutSelection'
                    let targetIndex = itemsWithoutSelection.findIndex(item => item.id === over.id);
                    
                    // Si estamos arrastrando hacia abajo, el target debe ser después del ítem over
                    // Pero dnd-kit logic standard is "replace". 
                    // Mejor estrategia simple: insertar en la posición donde está el 'over' en la lista filtrada.
                    
                    // Ajuste fino: si arrastramos "hacia abajo" visualmente en relación al grupo,
                    // a veces se prefiere insertar después. 
                    // Pero keep it simple: insert before the 'over' item in the filtered list based on visualization.
                    
                    // Si el target no está en la lista sin selección (raro si ya chequeamos que over no es seleccionado)
                    if (targetIndex === -1) return items;

                     // Insertar
                     const newItems = [...itemsWithoutSelection];
                     // Decisión: Insertar ANTES o DESPUÉS. 
                     // Dnd-kit sortable standard: si vamos de arriba a abajo, insertamos después. De abajo a arriba, antes.
                     // Pero en multiselect es complejo determinar "dirección" de todo el bloque.
                     // Asumiremos inserción en la posición del target (desplaza target a la derecha/abajo).
                     
                     // Si el overIndex > activeIndex (movimiento general hacia abajo), puede que queramos insertar después.
                     // Pero activeIndex es de UN item del grupo.
                     // Simplificación: Insertar en targetIndex. 
                     // Si el usuario arrastra justo debajo, el 'over' será el siguiente item.
                     
                     // Corrección: para que se sienta natural como "Sortable":
                     // Si activeItem.order < overItem.order -> insert after overItem?
                     // Standard Finder/Explorer behavior: Drop ON moves into folder. Drop BETWEEN moves.
                     // Sortable list: Drop OVER replaces position.
                     
                     // Vamos a usar la lógica simple: insertar en la posición del overID en la lista filtrada.
                     // Si arrastramos de arriba a abajo, esto pone los elementos ENCIMA del overID.
                     // Si queremos ponerlos DEBAJO, el usuario tendría que hacer hover en el siguiente elemento.
                     const overItem = items.find(i => i.id === over.id);
                     const activeItem = items.find(i => i.id === active.id);
                     
                     // Ajuste para UX natural:
                     // Si el elemento sobre el que estamos tiene un orden mayor, insertamos DESPUÉS
                     // SOLO si targetIndex no es el final.
                     // Pero es arriesgado. Mantengamos inserción directa en índice.
                     newItems.splice(targetIndex, 0, ...storedSelectedItems);

                     return newItems.map((c, i) => ({ ...c, order: i + 1 }));

                } else {
                    // Mover un solo canal (comportamiento original)
                    const oldIndex = items.findIndex((item) => item.id === active.id);
                    const newIndex = items.findIndex((item) => item.id === over.id);
                    
                    if (oldIndex === -1 || newIndex === -1) return items;
                    
                    const reordered = arrayMove(items, oldIndex, newIndex);
                    return reordered.map((c, i) => ({ ...c, order: i + 1 }));
                }
            });
            saveStateToHistory();
        }
        setActiveId(null);
    };

    const uniqueGroups = useMemo(
        () => ['Todos los canales', ...Array.from(new Set(channels.map((c) => c.groupTitle).filter(Boolean)))],
        [channels]
    );

    const filteredChannels = useMemo(
        () => (filterGroup === 'Todos los canales' ? channels : channels.filter((c) => c.groupTitle === filterGroup)),
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
        if (selectAllCheckboxRef.current) {
            selectAllCheckboxRef.current.indeterminate = 
                selectedChannels.length > 0 && selectedChannels.length < filteredChannels.length;
        }
    }, [selectedChannels, filteredChannels]);
    
    const saveStateToHistory = useCallback(() => {
        setHistory(prev => [...prev, channels]);
        setRedoHistory([]); // Limpiar redo history cuando se hace un cambio nuevo
    }, [channels]);

    const undo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        setRedoHistory(prev => [...prev, channels]); // Guardar estado actual en redo
        setChannels(previousState);
        setHistory(prev => prev.slice(0, -1));
    };

    const redo = () => {
        if (redoHistory.length === 0) return;
        const nextState = redoHistory[redoHistory.length - 1];
        setHistory(prev => [...prev, channels]); // Guardar estado actual en undo
        setChannels(nextState);
        setRedoHistory(prev => prev.slice(0, -1));
    };

    const handleVerifyChannels = async () => {
        const channelIdsToVerify = selectedChannels.length > 0 ? selectedChannels : channels.map(c => c.id);

        setIsVerifying(true);
        setVerificationProgress(0);

        const channelsToVerify = channels.filter(c => channelIdsToVerify.includes(c.id));
        setChannels(prev => prev.map(c => channelIdsToVerify.includes(c.id) ? { ...c, status: 'verifying' } : c));

        const batchSize = 5; // Reducido para evitar saturación
        let verifiedCount = 0;
        let finalChannels: Channel[] = [];

        for (let i = 0; i < channelsToVerify.length; i += batchSize) {
            const batch = channelsToVerify.slice(i, i + batchSize);
            
            // Verificación simple LOCAL (sin AWS Lambda, solo online/offline)
            const verificationPromises = batch.map(async (channel) => {
                try {
                    // Petición HEAD con timeout de 10 segundos
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);
                    
                    const response = await fetch(channel.url, {
                        method: 'HEAD',
                        signal: controller.signal,
                        cache: 'no-store',
                    });
                    
                    clearTimeout(timeoutId);
                    
                    // Considerar OK si responde 200 o 403 (a veces 403 significa online pero requiere headers)
                    const isOnline = response.ok || response.status === 403;
                    
                    return {
                        id: channel.id,
                        status: isOnline ? 'ok' as ChannelStatus : 'failed' as ChannelStatus
                    };
                } catch (error) {
                    console.error(`Verification failed for ${channel.name}:`, error);
                    return {
                        id: channel.id,
                        status: 'failed' as ChannelStatus
                    };
                }
            });

            const batchResults = await Promise.all(verificationPromises);

            setChannels(prev => {
                const newChannels = prev.map(c => {
                    const result = batchResults.find(r => r.id === c.id);
                    if (result) {
                        return { ...c, status: result.status };
                    }
                    return c;
                });
                finalChannels = newChannels;
                return newChannels;
            });

            verifiedCount += batch.length;
            setVerificationProgress(Math.round((verifiedCount / channelsToVerify.length) * 100));
        }

        setIsVerifying(false);

        const failed = finalChannels.filter(c => c.status === 'failed');
        setFailedChannels(failed);
    };

    const handleDeleteFailed = () => {
        setChannels(prev => prev.filter(c => c.status !== 'failed'));
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
        originalFileName,
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
        redo,
        history,
        redoHistory,
        generateM3UContent,
        processM3UContent,
        handleVerifyChannels,
        handleDeleteFailed,
        isVerifying,
        verificationProgress,
    };
};