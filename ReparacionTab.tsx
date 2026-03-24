import React, { useRef, useState, useEffect } from 'react';
import { Upload, Copy, CheckSquare, ArrowLeftCircle, RotateCcw, Trash2, Link, Check, Search, X, RefreshCw, SlidersHorizontal, Filter, Database } from 'lucide-react';
import { useReparacion } from './useReparacion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChannels } from './useChannels';
import ReparacionChannelItem from './ReparacionChannelItem';
import { useSettings } from './useSettings';
import { useAppMode } from './AppModeContext';
import { AttributeKey } from './index';
import { SmartSearchInput } from './SmartSearchInput';
import { getStorageItem, setStorageItem } from './utils/storage';

interface ReparacionTabProps {
    reparacionHook: ReturnType<typeof useReparacion>;
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
    onNavigateToSave?: () => void;
    onNavigateToInicio?: () => void;
}

type ColumnVisibilityConfig = {
    logo: boolean;
    name: boolean;
    tvgId: boolean;
    tvgName: boolean;
    url: boolean;
    verifyButton: boolean;
    playButton: boolean;
    statusIndicator: boolean;
    selectionCheckbox: boolean;
};

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibilityConfig = {
    logo: true,
    name: true,
    tvgId: true,
    tvgName: true,
    url: true,
    verifyButton: true,
    playButton: true,
    statusIndicator: true,
    selectionCheckbox: true,
};

const REPARACION_MAIN_VISIBLE_FIELDS_KEY = 'reparacion_main_visible_fields';
const REPARACION_AUX_VISIBLE_FIELDS_KEY = 'reparacion_aux_visible_fields';

const ReparacionTab: React.FC<ReparacionTabProps> = ({ reparacionHook, channelsHook, settingsHook, onNavigateToSave, onNavigateToInicio }) => {
    const { isSencillo, isPro } = useAppMode();
    
    // States for UI Toggles
    const [showMainSearch, setShowMainSearch] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [savedMedicinaLists, setSavedMedicinaLists] = useState<Array<{ id: string; name: string; url: string; content?: string }>>([]);
    const [bulkActionType, setBulkActionType] = useState('offline_repair');
    const [hasPendingReparacionChanges, setHasPendingReparacionChanges] = useState(false);
    const [isUpdatingReparacionList, setIsUpdatingReparacionList] = useState(false);
    const [showMainColumnsMenu, setShowMainColumnsMenu] = useState(false);
    const [showReparacionColumnsMenu, setShowReparacionColumnsMenu] = useState(false);
    const [showMedicinaSearchControls, setShowMedicinaSearchControls] = useState(false);
    const [selectedMedicinaLettersCount, setSelectedMedicinaLettersCount] = useState(0);
    const [mainVisibleFields, setMainVisibleFields] = useState<ColumnVisibilityConfig>(DEFAULT_COLUMN_VISIBILITY);
    const [reparacionVisibleFields, setReparacionVisibleFields] = useState<ColumnVisibilityConfig>(DEFAULT_COLUMN_VISIBILITY);

    const {
        selectedReparacionChannels,
        reparacionListName,
        setReparacionListName,
        setReparacionChannels,
        attributesToCopy,
        destinationChannelId,
        setDestinationChannelId,
        mainListFilter,
        setMainListFilter,
        mainDomainFilter,
        setMainDomainFilter,
        reparacionListFilter,
        setReparacionListFilter,
        handleReparacionFileUpload,
        processCurationM3U,
        toggleAttributeToCopy,
        handleSourceChannelClick,
        mainListUniqueGroups,
        mainListUniqueDomains,
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
        reparacionChannels,
        verificationInfo,
        verificationProgress,
        cancelVerification,
        verifyChannel,
        executeBulkAction,
        failedChannelsByGroup,
        reparacionUrl,
        setReparacionUrl,
        handleReparacionUrlLoad,
        isCurationLoading,
        curationError,
        verifyAllChannelsInGroup,
        smartSearchResults,
        isSmartSearchEnabled,
        toggleSmartSearch,
        getChannelSimilarityScore,
        smartSearch,
        mainStatusFilter,
        setMainStatusFilter,
        selectMultipleChannels,
        handleDeleteSelectedReparacionChannels,
    } = reparacionHook;
    
    const { normalizeChannelName } = smartSearch;
    const { undo, history, setChannels, fileName, channels, saveStateToHistory } = channelsHook;

    const mainListParentRef = useRef<HTMLDivElement>(null);
    const reparacionListParentRef = useRef<HTMLDivElement>(null);
    const mainColumnsMenuRef = useRef<HTMLDivElement>(null);
    const reparacionColumnsMenuRef = useRef<HTMLDivElement>(null);
    const medicinaSearchInputRef = useRef<HTMLInputElement>(null);

    // Initial Load of Medicina Lists
    useEffect(() => {
        const stored = getStorageItem('medicinaLists');
        if (stored) setSavedMedicinaLists(JSON.parse(stored));

        const storedMainFields = getStorageItem(REPARACION_MAIN_VISIBLE_FIELDS_KEY);
        if (storedMainFields) {
            try {
                const parsed = JSON.parse(storedMainFields);
                setMainVisibleFields(prev => ({ ...prev, ...parsed }));
            } catch {
                // Ignorar valores corruptos y seguir con defaults
            }
        }

        const storedAuxFields = getStorageItem(REPARACION_AUX_VISIBLE_FIELDS_KEY);
        if (storedAuxFields) {
            try {
                const parsed = JSON.parse(storedAuxFields);
                setReparacionVisibleFields(prev => ({ ...prev, ...parsed }));
            } catch {
                // Ignorar valores corruptos y seguir con defaults
            }
        }
    }, []);

    useEffect(() => {
        setStorageItem(REPARACION_MAIN_VISIBLE_FIELDS_KEY, JSON.stringify(mainVisibleFields));
    }, [mainVisibleFields]);

    useEffect(() => {
        setStorageItem(REPARACION_AUX_VISIBLE_FIELDS_KEY, JSON.stringify(reparacionVisibleFields));
    }, [reparacionVisibleFields]);

    // Virtualizers
    const mainListRowVirtualizer = useVirtualizer({
        count: filteredMainChannels.length,
        getScrollElement: () => mainListParentRef.current,
        estimateSize: () => 60,
        overscan: 10,
    });

    const reparacionListRowVirtualizer = useVirtualizer({
        count: filteredReparacionChannels.length,
        getScrollElement: () => reparacionListParentRef.current,
        estimateSize: () => 60,
        overscan: 10,
    });

    const mainListVirtualItems = mainListRowVirtualizer.getVirtualItems();

    // Check if is mobile
    const [isMobile, setIsMobile] = useState(false);
    const [isMobileLandscape, setIsMobileLandscape] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    // Gestores globales de puntero para finalizar el arrastre
    const handleGlobalDragEnd = () => setIsDragging(false);

    useEffect(() => {
        window.addEventListener('mouseup', handleGlobalDragEnd);
        window.addEventListener('touchend', handleGlobalDragEnd);
        window.addEventListener('pointerup', handleGlobalDragEnd);
        return () => {
            window.removeEventListener('mouseup', handleGlobalDragEnd);
            window.removeEventListener('touchend', handleGlobalDragEnd);
            window.removeEventListener('pointerup', handleGlobalDragEnd);
        };
    }, []);

    useEffect(() => {
        const checkMobile = () => {
            // Landscape cuando ancho > alto (horizontal orientation)
            setIsMobileLandscape(window.innerWidth > window.innerHeight);
            // Mobile cuando ancho < 1024
            setIsMobile(window.innerWidth < 1024);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const rootLayoutClass = isMobileLandscape
        ? 'grid grid-cols-11 gap-1 h-screen px-1'
        : isMobile
            ? 'grid grid-cols-1 gap-0 h-screen overflow-y-auto'
            : 'grid grid-cols-1 lg:grid-cols-11 gap-4 h-[calc(100vh-60px)] px-4';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (mainColumnsMenuRef.current && !mainColumnsMenuRef.current.contains(target)) {
                setShowMainColumnsMenu(false);
            }
            if (reparacionColumnsMenuRef.current && !reparacionColumnsMenuRef.current.contains(target)) {
                setShowReparacionColumnsMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        // Mantener el selector dentro del rango actual del texto buscado
        setSelectedMedicinaLettersCount(prev => Math.min(prev, reparacionListSearch.length));
    }, [reparacionListSearch]);

    useEffect(() => {
        if (!medicinaSearchInputRef.current) return;
        medicinaSearchInputRef.current.focus();
        medicinaSearchInputRef.current.setSelectionRange(0, selectedMedicinaLettersCount);
    }, [selectedMedicinaLettersCount]);
    
    // --- Computed Values ---
    const isAllInGroupSelected = filteredReparacionChannels.length > 0 && filteredReparacionChannels.every(c => selectedReparacionChannels.has(c.id));

    const attributeLabels: { key: AttributeKey; label: string }[] = [
        { key: 'url', label: 'Stream' },
        { key: 'tvgLogo', label: 'Logo' },
        { key: 'name', label: 'Nombre' },
        { key: 'groupTitle', label: 'Grupo' },
        { key: 'tvgId', label: 'tvg-id' },
        { key: 'tvgName', label: 'tvg-name' },
    ];

    const mainVisibilityOptions: Array<{ key: keyof ColumnVisibilityConfig; label: string }> = [
        { key: 'logo', label: 'Logo' },
        { key: 'name', label: 'Nombre del canal' },
        { key: 'tvgId', label: 'ID' },
        { key: 'tvgName', label: 'Name' },
        { key: 'url', label: 'URL' },
        { key: 'verifyButton', label: 'Botón Verify' },
        { key: 'playButton', label: 'Play en VLC' },
        { key: 'statusIndicator', label: 'Texto estado (Pending/OK)' },
    ];

    const reparacionVisibilityOptions: Array<{ key: keyof ColumnVisibilityConfig; label: string }> = [
        ...mainVisibilityOptions,
        { key: 'selectionCheckbox', label: 'Selector para añadir (+)' },
    ];

    const toggleVisibilityField = (
        listType: 'main' | 'reparacion',
        field: keyof ColumnVisibilityConfig
    ) => {
        const setConfig = listType === 'main' ? setMainVisibleFields : setReparacionVisibleFields;
        setConfig(prev => ({ ...prev, [field]: !prev[field] }));
    };

    // Actualizar nombre de lista cuando se carga por URL
    const onUrlLoad = async () => {
        const urlToLoad = reparacionUrl;
        await handleReparacionUrlLoad();
        setHasPendingReparacionChanges(false);
        if (urlToLoad) {
            try {
                const urlObj = new URL(urlToLoad);
                let name = urlObj.pathname.split('/').pop() || 'Lista Medicina';
                // Si es un enlace de dropbox, intentar sacar el nombre del dl=
                if (urlToLoad.includes('dropbox') && name === 'file') {
                    name = 'Lista de Dropbox';
                }
                setReparacionListName(name);
            } catch (e) {
                setReparacionListName('Lista Medicina URL');
            }
        }
    };

    // Actualizar nombre de lista cuando se carga por archivo
    const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setReparacionListName(file.name);
            await handleReparacionFileUpload(e);
            setHasPendingReparacionChanges(false);
        }
    };

    const getDropboxAccessToken = async () => {
        const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: settingsHook.dropboxRefreshToken,
                client_id: settingsHook.dropboxAppKey,
            }),
        });

        if (!tokenRes.ok) {
            throw new Error('No se pudo obtener el token de Dropbox.');
        }

        const tokenData = await tokenRes.json();
        return tokenData.access_token as string;
    };

    const convertDropboxUrl = (url: string): string => {
        return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'dl=1');
    };

    const getReparacionFileName = (): string => {
        const base = (reparacionListName || 'lista_reparadora').trim().replace(/\s+/g, '_');
        return base.endsWith('.m3u') || base.endsWith('.m3u8') ? base : `${base}.m3u`;
    };

    const generateReparacionM3UContent = () => {
        let content = '#EXTM3U\n';
        reparacionChannels.forEach((channel) => {
            let attributes = '';
            if (channel.tvgId) attributes += ` tvg-id="${channel.tvgId}"`;
            if (channel.tvgName) attributes += ` tvg-name="${channel.tvgName}"`;
            if (channel.tvgLogo) attributes += ` tvg-logo="${channel.tvgLogo}"`;
            if (channel.groupTitle) attributes += ` group-title="${channel.groupTitle}"`;
            content += `#EXTINF:-1${attributes},${channel.name}\n${channel.url}\n`;
        });
        return content;
    };

    const handleUpdateReparacionList = async () => {
        if (!reparacionListName) {
            alert('No hay una lista reparadora cargada para actualizar.');
            return;
        }
        if (!settingsHook.dropboxRefreshToken || !settingsHook.dropboxAppKey) {
            alert('Debes configurar Dropbox en Ajustes para actualizar la lista reparadora.');
            return;
        }

        setIsUpdatingReparacionList(true);
        try {
            const accessToken = await getDropboxAccessToken();
            const filename = getReparacionFileName();
            const uploadPath = `/Listas Reparadoras/${filename}`;
            const content = generateReparacionM3UContent();

            const uploadRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({
                        path: uploadPath,
                        mode: 'overwrite',
                        autorename: false,
                        mute: false,
                        strict_conflict: false,
                    }),
                    'Content-Type': 'application/octet-stream',
                },
                body: content,
            });

            if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`Dropbox upload error: ${uploadRes.status} ${errText}`);
            }

            const uploaded = await uploadRes.json();

            let sharedUrl = '';
            const shareResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: uploaded.path_display }),
            });

            if (shareResponse.ok) {
                const shareData = await shareResponse.json();
                sharedUrl = convertDropboxUrl(shareData.url);
            } else {
                const listLinks = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ path: uploaded.path_display }),
                });
                if (listLinks.ok) {
                    const existing = await listLinks.json();
                    if (existing.links && existing.links.length > 0) {
                        sharedUrl = convertDropboxUrl(existing.links[0].url);
                    }
                }
            }

            if (sharedUrl) {
                const stored = JSON.parse(localStorage.getItem('medicinaLists') || '[]');
                const updated = Array.isArray(stored)
                    ? stored.map((list: any) =>
                        list.name === reparacionListName
                            ? { ...list, url: sharedUrl }
                            : list
                    )
                    : [];

                const exists = updated.some((list: any) => list.name === reparacionListName);
                const finalLists = exists
                    ? updated
                    : [
                        ...updated,
                        {
                            id: Date.now().toString(),
                            name: reparacionListName,
                            url: sharedUrl,
                        },
                    ];

                localStorage.setItem('medicinaLists', JSON.stringify(finalLists));
                setSavedMedicinaLists(finalLists);
                setReparacionUrl(sharedUrl);
            }

            setHasPendingReparacionChanges(false);
            alert('Lista reparadora actualizada en Dropbox correctamente.');
        } catch (error) {
            console.error('Error actualizando lista reparadora', error);
            alert(`No se pudo actualizar la lista reparadora: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        } finally {
            setIsUpdatingReparacionList(false);
        }
    };

    const handleDeleteSelectedFromReparacionList = () => {
        if (selectedReparacionChannels.size === 0) return;

        if (!confirm(`Se van a eliminar ${selectedReparacionChannels.size} canales de la lista reparadora. ¿Deseas continuar?`)) {
            return;
        }

        const deletedCount = handleDeleteSelectedReparacionChannels();
        if (deletedCount > 0) {
            setHasPendingReparacionChanges(true);
        }
    };

    // Clear Main List Logic
    const isWindows = typeof window !== 'undefined' && /Windows/i.test(navigator.userAgent);
    const shouldShowPlayButton = !isSencillo || (isSencillo && isWindows);

    const openInVLC = (url: string) => {
        window.location.href = `vlc://${url}`;
        setTimeout(() => {
            const m3uContent = `#EXTM3U\n#EXTINF:-1,Stream\n${url}`;
            const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'stream.m3u';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }, 500);
    };

    const handleClearMainListClick = () => setShowClearConfirm(true);

    const handleDeleteCurrentRepairList = async () => {
         if (!reparacionListName) return;
         
         const stored = localStorage.getItem('medicinaLists');
         const savedMedicinaLists = stored ? JSON.parse(stored) : [];
         const currentList = savedMedicinaLists.find((l: any) => l.name === reparacionListName);
         
         if (!currentList) {
             // Es una lista cargada temporalmente o no guardada, solo limpiamos UI
             setReparacionListName('');
             setReparacionUrl('');
             return; 
         }

         if (!confirm(`¿Estás seguro de eliminar la lista reparadora "${reparacionListName}" de tus guardados?`)) return;

         let movedToTrash = false;
         
         // Lógica de borrado Dropbox
         if (settingsHook.dropboxRefreshToken && confirm('¿Quieres mover también el archivo original a la carpeta "Listas Eliminadas" de Dropbox?')) {
             try {
                 const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: settingsHook.dropboxRefreshToken,
                        client_id: settingsHook.dropboxAppKey,
                    }),
                });
                
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    const accessToken = tokenData.access_token;
                    
                    const trashFolder = '/Listas Eliminadas';
                    const filename = reparacionListName.endsWith('.m3u') || reparacionListName.endsWith('.m3u8') ? reparacionListName : `${reparacionListName}.m3u`;
                    
                    // Al estar en ReparacionTab, sabemos que es lista reparadora
                    const originFolder = '/Listas Reparadoras'; 
                    const pathInFolder = `${originFolder}/${filename}`;
                    const pathInRoot = `/${filename}`;
                    const destinationPath = `${trashFolder}/${filename}`;

                    const tryMove = async (fromPath: string) => {
                        const res = await fetch('/api/dropbox_move', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ accessToken, fromPath, toPath: destinationPath })
                        });
                        if (res.status === 404) throw new Error('Not found');
                        if (!res.ok) throw new Error('Error API');
                        return await res.json();
                    };

                    try {
                        await tryMove(pathInFolder);
                        movedToTrash = true;
                    } catch (e) {
                         try {
                            await tryMove(pathInRoot);
                            movedToTrash = true;
                        } catch (e2) {
                             alert('No se encontró el archivo en Dropbox para moverlo. Se borrará solo de la PWA.');
                        }
                    }

                    if (movedToTrash) alert('Archivo movido a papelera en Dropbox.');
                }
             } catch (error) {
                 console.error('Error borrando en Dropbox', error);
             }
         }

         // Borrar de LocalStorage
         const updated = savedMedicinaLists.filter((l: any) => l.name !== reparacionListName);
         setSavedMedicinaLists(updated);
         localStorage.setItem('medicinaLists', JSON.stringify(updated));
         
         // Limpiar vista
         setReparacionListName('');
         setReparacionUrl('');
    };
    
    const handleConfirmClear = (action: 'clear' | 'save' | 'cancel') => {
        setShowClearConfirm(false);
        if (action === 'clear') {
            setChannels([]);
            if (onNavigateToInicio) onNavigateToInicio();
        } else if (action === 'save') {
            if (onNavigateToSave) onNavigateToSave();
        }
    };

    // Quick Verification Logic
    const handleQuickVerify = () => {
        if (mainListFilter === 'Todos los canales') return;
        
        // Is large list?
        const LIMIT = 50; 
        const VERIFY_COUNT = 10;
        
        const channelsInScope = filteredMainChannels.filter(ch => verificationInfo[ch.id]?.status !== 'ok');
        
        // Note: filteredMainChannels is already filtered by group since mainListFilter is set
        if (filteredMainChannels.length > LIMIT) {
            // "Si hay mas de 20 results" (Prompt said 20 or 50, example said >50 in text, but user prompt "solo verifique los 10 primeros resultados si hay mas de 20").
            // I'll stick to >20 trigger, check 10.
            if (channelsInScope.length > 20) {
                const toVerify = channelsInScope.slice(0, VERIFY_COUNT);
                alert(`Lista larga detectada. Verificando solo los primeros ${VERIFY_COUNT} canales del grupo.`);
                toVerify.forEach(ch => verifyChannel(ch.id, ch.url));
            } else {
                 channelsInScope.forEach(ch => verifyChannel(ch.id, ch.url));
            }
        } else {
             channelsInScope.forEach(ch => verifyChannel(ch.id, ch.url));
        }
    };

    // Load Repair List Logic
    const loadRepairList = async (listId: string) => {
        const list = savedMedicinaLists.find(l => l.id === listId);
        if(!list) return;

        setReparacionListName(list.name);
        setHasPendingReparacionChanges(false);
        
        if (list.url === 'local' && list.content) {
            // Emulate file upload
            const file = new File([list.content], `${list.name}.m3u`, { type: 'text/plain' });
             // @ts-ignore
            await handleReparacionFileUpload({ target: { files: [file] } } as any);
        } else {
            setReparacionUrl(list.url);
            handleReparacionUrlLoad(list.url);
        }
    };

    const clearReparacion = () => {
        setReparacionListName('');
        setReparacionUrl('');
        setReparacionChannels([]);
        setHasPendingReparacionChanges(false);
    };


    return (
        <div className={rootLayoutClass}>
            
            {/* --- BLOQUE MOVIL: ATRIBUTOS ARRIBA --- */}
            {isMobile && !isMobileLandscape && (
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 mb-4 sticky top-0 z-10 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-xs uppercase text-gray-400">Atributos a copiar</h4>
                        <div className="flex gap-2">
                            {!isSencillo && (
                                <button
                                    onClick={handleAddSelectedFromReparacion}
                                    disabled={selectedReparacionChannels.size === 0}
                                    className="text-xs py-1 px-3 bg-green-600 hover:bg-green-700 text-white rounded shadow-sm disabled:opacity-50"
                                >
                                    + Añadir
                                </button>
                            )}
                            <button
                                onClick={undo}
                                disabled={history.length === 0}
                                className="text-xs py-1 px-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded disabled:opacity-50"
                            >
                                <RotateCcw size={12} />
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                         {attributeLabels
                            .filter(({ key }) => isSencillo ? (key !== 'tvgId' && key !== 'tvgName') : true)
                            .map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => toggleAttributeToCopy(key)}
                                className={`text-[10px] py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors flex-grow ${attributesToCopy.has(key) ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                            >
                                {attributesToCopy.has(key) ? <CheckSquare size={12} /> : <Copy size={12} />} {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* --- PANEL IZQUIERDO (Lista Principal) --- */}
            <div className={`bg-gray-800 flex flex-col min-h-0 ${isMobileLandscape ? 'col-span-5 h-full border-r border-gray-700 p-1' : `p-4 lg:col-span-5 ${isMobile ? 'h-[400px] mb-4 rounded-lg border border-gray-700' : 'h-full'}`}`}>
                
                {/* Header Lista Principal */}
                <div className={`flex justify-between items-center ${isMobileLandscape ? 'pb-1 mb-1 border-b border-gray-700' : 'pb-2 mb-3 border-b border-gray-700'} shrink-0`}>
                    <div className="flex items-center gap-1 overflow-hidden min-w-0">
                        <img src="/Dropbox_Icon.svg" alt="Dropbox" className={`flex-shrink-0 text-blue-400 ${isMobileLandscape ? 'w-4 h-4' : 'w-5 h-5'}`} />
                        {channels.length > 0 ? (
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                                <span className={`font-bold truncate text-blue-400 ${isMobileLandscape ? 'text-sm' : 'text-base'}`}>{fileName}</span>
                                <button
                                    onClick={handleClearMainListClick}
                                    className="text-red-400 hover:text-red-300 p-0.5 hover:bg-gray-600 rounded transition-colors flex-shrink-0"
                                    title="Cerrar lista principal"
                                >
                                    <X size={isMobileLandscape ? 14 : 16} />
                                </button>
                            </div>
                        ) : (
                            <span className={`font-bold text-gray-400 truncate ${isMobileLandscape ? 'text-sm' : 'text-base'}`}>Mi lista</span>
                        )}
                    </div>
                    {/* Botones Acciones */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {isPro && channels.length > 0 && (
                            <div className="relative" ref={mainColumnsMenuRef}>
                                <button
                                    onClick={() => setShowMainColumnsMenu(prev => !prev)}
                                    className={`p-1 rounded transition-colors ${showMainColumnsMenu ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                                    title="Elegir columnas visibles en lista principal"
                                >
                                    <SlidersHorizontal size={isMobileLandscape ? 14 : 18} />
                                </button>
                                {showMainColumnsMenu && (
                                    <div className="absolute right-0 mt-2 w-64 bg-gray-900/95 border border-gray-600 rounded-lg shadow-xl p-3 z-40 backdrop-blur-sm">
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Mostrar en lista principal</p>
                                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                            {mainVisibilityOptions.map(option => (
                                                <label key={`main-${option.key}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-gray-800/70 hover:bg-gray-700/70 px-2 py-1.5 text-xs text-gray-200 cursor-pointer transition-colors">
                                                    <span>{option.label}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={mainVisibleFields[option.key]}
                                                        onChange={() => toggleVisibilityField('main', option.key)}
                                                        className="h-3.5 w-3.5 rounded border-gray-500 bg-gray-900 text-blue-500 focus:ring-blue-500"
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {channels.length > 0 && (
                            <button 
                                onClick={() => setShowMainSearch(!showMainSearch)}
                                className={`p-1 rounded transition-colors ${showMainSearch ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                            >
                                <Search size={isMobileLandscape ? 14 : 18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Modal Confirmación Borrado (Overlay absoluto) */}
                {showClearConfirm && (
                    <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 rounded-lg">
                        <div className="bg-gray-800 border border-gray-600 p-4 rounded-lg max-w-xs text-center shadow-xl">
                            <h4 className="text-white font-bold mb-2">¿Estás seguro?</h4>
                            <p className="text-sm text-gray-400 mb-4">Perderás los cambios no guardados en tu lista de trabajo.</p>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => handleConfirmClear('save')} className="bg-green-600 hover:bg-green-700 text-white py-1.5 rounded text-sm">Actualizar en Dropbox</button>
                                <button onClick={() => handleConfirmClear('clear')} className="bg-red-600 hover:bg-red-700 text-white py-1.5 rounded text-sm">Cerrar Lista</button>
                                <button onClick={() => handleConfirmClear('cancel')} className="bg-gray-600 hover:bg-gray-500 text-white py-1.5 rounded text-sm">Cancelar</button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Buscador (Condicional) */}
                {showMainSearch && (
                    <div className={`${isMobileLandscape ? 'mb-1' : 'mb-3'} animate-fadeIn`}>
                        <SmartSearchInput
                            searchTerm={mainListSearch}
                            onSearchChange={setMainListSearch}
                            isSmartSearchEnabled={isSmartSearchEnabled}
                            onToggleSmartSearch={toggleSmartSearch}
                            placeholder="Buscar canal..."
                            showResults={true}
                            resultCount={filteredMainChannels.length}
                        />
                    </div>
                )}
                
                {/* Filtros estilo EPG */}
                {channels.length > 0 && (
                <div className={`${isMobileLandscape ? 'mb-1 gap-1' : 'mb-2 gap-2'} flex flex-wrap items-center`}>
                    <select
                        value={mainListFilter}
                        onChange={(e) => setMainListFilter(e.target.value)}
                        className={`bg-gray-900 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 truncate flex-1 min-w-[100px] ${isMobileLandscape ? 'py-1' : 'py-1.5'}`}
                    >
                        <option value="Todos los canales">Todos los grupos</option>
                        {mainListUniqueGroups.map((g) => {
                            if (g === 'Todos los canales') return null;
                            return (
                                <option key={g} value={g}>{g}</option>
                            );
                        })}
                    </select>
                    {mainListFilter !== 'Todos los canales' && (
                        <button
                            onClick={handleQuickVerify}
                            className={`text-xs px-2 rounded-md flex items-center justify-center gap-1 transition-colors bg-blue-600 hover:bg-blue-700 shadow-sm text-white whitespace-nowrap ${isMobileLandscape ? 'py-1' : 'py-1.5'}`}
                            title="Verificación rápida de grupo"
                        >
                            <Check size={12} /> Verif.
                        </button>
                    )}
                    <select
                        value={mainStatusFilter}
                        onChange={(e) => setMainStatusFilter(e.target.value)}
                        className={`bg-gray-900 border border-gray-600 rounded-lg px-2 text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:border-blue-500 truncate flex-1 min-w-[80px] ${isMobileLandscape ? 'py-1' : 'py-1.5'} ${mainStatusFilter !== 'Todos' ? 'text-yellow-400 border-yellow-500/50 bg-yellow-900/40' : 'text-white'}`}
                        title="Filtrar por estado de verificación"
                    >
                        <option value="Todos" style={{ color: 'white' }}>Todos</option>
                        <option value="Rotos" style={{ color: '#ef4444' }}>❌ Offline</option>
                        <option value="Pendientes" style={{ color: '#9ca3af' }}>○ Pendientes</option>
                        <option value="ResDesconocida" style={{ color: 'white' }}>❓ Desconocida</option>
                    </select>
                </div>
                )}
                
                {!isSencillo && channels.length > 0 && (
                <div className={`${isMobileLandscape ? 'mb-1 gap-1' : 'mb-2 gap-2'} flex flex-wrap items-center`}>
                    <select
                        className={`flex-1 min-w-[100px] bg-gray-900 text-xs border border-gray-600 rounded-lg px-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 truncate ${isMobileLandscape ? 'py-1' : 'py-1.5'}`}
                        value={mainDomainFilter}
                        onChange={(e) => setMainDomainFilter(e.target.value)}
                    >
                        {mainListUniqueDomains.map(domain => (
                            <option key={domain} value={domain}>{domain}</option>
                        ))}
                    </select>
                    <select
                        className={`flex-1 min-w-[100px] bg-gray-900 text-xs border border-gray-600 rounded-lg px-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 truncate ${isMobileLandscape ? 'py-1' : 'py-1.5'}`}
                        value={bulkActionType}
                        onChange={(e) => setBulkActionType(e.target.value)}
                    >
                        <option value="offline_repair">Offline a reparar</option>
                        <option value="res_desconocida_repair">Res desconocida</option>
                        <option value="eliminar">Eliminar canal</option>
                    </select>
                    <button
                        onClick={() => executeBulkAction(bulkActionType, filteredMainChannels)}
                        className={`text-xs px-2 rounded border border-red-900/50 text-red-500 hover:bg-red-900/20 flex items-center justify-center gap-1 whitespace-nowrap ${isMobileLandscape ? 'py-1' : 'py-1.5'}`}
                        title="Aplicar acción"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
                )}

                {/* Lista de Canales */}
                <div ref={mainListParentRef} className="flex-1 overflow-y-auto min-h-0 pr-1">
                    <div style={{ height: `${mainListRowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {mainListVirtualItems.map((virtualItem) => {
                            const ch = filteredMainChannels[virtualItem.index];
                            if (!ch) return null;
                            const channelInfo = verificationInfo[ch.id] || { status: 'pending', quality: 'unknown' };
                            return (
                                <ReparacionChannelItem
                                    key={ch.id}
                                    channel={ch}
                                    onBodyClick={() => {
                                        if (destinationChannelId === ch.id) {
                                            setDestinationChannelId('');
                                            setReparacionListSearch('');
                                        } else {
                                            setDestinationChannelId(ch.id);
                                            setReparacionListSearch(normalizeChannelName(ch.name));
                                            reparacionListParentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                                        }
                                    }}
                                    isSelected={destinationChannelId === ch.id}
                                    showCheckbox={false}
                                    verificationStatus={channelInfo.status}
                                    quality={channelInfo.quality}
                                    resolution={channelInfo.resolution}
                                    onVerifyClick={() => verifyChannel(ch.id, ch.url)}
                                    onPlayClick={shouldShowPlayButton ? () => openInVLC(ch.url) : undefined}
                                    isSencillo={isSencillo}
                                    compact={isMobileLandscape}
                                    visibleFields={isPro ? mainVisibleFields : undefined}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- PANEL CENTRAL: Acciones (SOLO DESKTOP) --- */}
            {(!isMobile || isMobileLandscape) && (
            <div className={`${isMobileLandscape ? 'col-span-1 p-1 gap-1.5 border-x border-gray-700' : 'lg:col-span-1 p-3 gap-3 rounded-lg border border-gray-700'} flex flex-col items-center justify-start bg-gray-800`}>
                 <div className="text-center w-full">
                    <h4 className={`font-bold uppercase text-gray-400 ${isMobileLandscape ? 'text-[10px] mb-1' : 'text-xs mb-2'}`}>Atributos</h4>
                    <ArrowLeftCircle size={isMobileLandscape ? 16 : 24} className={`text-blue-500 mx-auto ${isMobileLandscape ? 'mb-1.5' : 'mb-3'}`} />
                    <div className={isMobileLandscape ? 'space-y-1' : 'space-y-1.5'}>
                        {attributeLabels
                            .filter(({ key }) => isSencillo ? (key !== 'tvgId' && key !== 'tvgName') : true)
                            .map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => toggleAttributeToCopy(key)}
                                className={`w-full rounded flex items-center justify-center gap-1 transition-colors ${isMobileLandscape ? 'text-[9px] py-1 px-0.5' : 'text-[10px] py-1.5 px-1'} ${attributesToCopy.has(key) ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                            >
                                {attributesToCopy.has(key) ? <CheckSquare size={isMobileLandscape ? 10 : 12} /> : <Copy size={isMobileLandscape ? 10 : 12} />} {label}
                            </button>
                        ))}
                    </div>
                </div>
                {!isSencillo && (
                    <div className={`w-full ${isMobileLandscape ? 'mt-1' : 'mt-2'}`}>
                        <button
                            onClick={handleAddSelectedFromReparacion}
                            disabled={selectedReparacionChannels.size === 0}
                            className={`w-full bg-green-600 hover:bg-green-700 text-white rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isMobileLandscape ? 'text-[10px] py-1.5' : 'text-xs py-2'}`}
                        >
                            + Añadir
                        </button>
                    </div>
                )}
                <div className={`w-full ${isMobileLandscape ? 'mt-1' : 'mt-2'}`}>
                    <button
                        onClick={undo}
                        disabled={history.length === 0}
                        className={`w-full bg-yellow-600 hover:bg-yellow-700 text-white rounded flex items-center justify-center gap-1 disabled:opacity-50 ${isMobileLandscape ? 'text-[10px] py-1.5' : 'text-xs py-2'}`}
                    >
                        <RotateCcw size={isMobileLandscape ? 10 : 12} /> Deshacer
                    </button>
                </div>
            </div>
            )}

            {/* --- PANEL DERECHO (Lista Reparadora) --- */}
            <div className={`bg-gray-800 flex flex-col min-h-0 ${isMobileLandscape ? 'col-span-5 h-full border-l border-gray-700 p-1' : `p-4 lg:col-span-5 ${isMobile ? 'h-[400px] rounded-lg border border-gray-700' : 'h-full'}`}`}>
                
                {/* Header Lista Reparadora */}
                <div className={`flex justify-between items-center ${isMobileLandscape ? 'pb-1 mb-1 border-b border-gray-700' : 'pb-2 mb-3 border-b border-gray-700'} flex-wrap shrink-0`}>
                    <div className="flex items-center gap-1 overflow-hidden min-w-0">
                        <Database size={isMobileLandscape ? 16 : 20} className="flex-shrink-0 text-purple-400" />
                        {reparacionListName && (
                            <div className="flex items-center gap-1 min-w-0">
                                <span className={`font-bold truncate text-purple-400 ${isMobileLandscape ? 'text-sm' : 'text-base'}`}>{reparacionListName}</span>
                                <button
                                    onClick={clearReparacion}
                                    className="text-red-400 hover:text-red-300 p-0.5 hover:bg-gray-600 rounded transition-colors flex-shrink-0"
                                    title="Eliminar y descargar lista actual"
                                >
                                    <X size={isMobileLandscape ? 14 : 16} />
                                </button>
                            </div>
                        )}
                        {!reparacionListName && (
                            <span className={`font-bold text-gray-400 ${isMobileLandscape ? 'text-sm' : 'text-base'}`}>Lista reparadora</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {isPro && (
                            <div className="relative" ref={reparacionColumnsMenuRef}>
                                <button
                                    onClick={() => setShowReparacionColumnsMenu(prev => !prev)}
                                    className={`p-1 rounded transition-colors ${showReparacionColumnsMenu ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                                    title="Elegir columnas visibles en lista reparadora"
                                >
                                    <SlidersHorizontal size={isMobileLandscape ? 14 : 18} />
                                </button>
                                {showReparacionColumnsMenu && (
                                    <div className="absolute right-0 mt-2 w-64 bg-gray-900/95 border border-gray-600 rounded-lg shadow-xl p-3 z-40 backdrop-blur-sm">
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Mostrar en lista reparadora</p>
                                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                            {reparacionVisibilityOptions.map(option => (
                                                <label key={`reparacion-${option.key}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-gray-800/70 hover:bg-gray-700/70 px-2 py-1.5 text-xs text-gray-200 cursor-pointer transition-colors">
                                                    <span>{option.label}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={reparacionVisibleFields[option.key]}
                                                        onChange={() => toggleVisibilityField('reparacion', option.key)}
                                                        className="h-3.5 w-3.5 rounded border-gray-500 bg-gray-900 text-blue-500 focus:ring-blue-500"
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {!reparacionListName && savedMedicinaLists.length > 0 && (
                            <select
                                onChange={(e) => loadRepairList(e.target.value)}
                                value=""
                                className={`bg-gray-900 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${isMobileLandscape ? 'w-auto' : 'w-48'}`}
                                title="Seleccionar fuente reparadora"
                            >
                                <option value="">Cargar guardada</option>
                                {savedMedicinaLists.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* Filtros e Inputs de la lista reparadora */}
                {(filteredReparacionChannels.length > 0 || !!reparacionListSearch || !!reparacionListName) && (
                    <div className="space-y-2 mb-2">
                        {/* Buscador de medicina con estilo EPG */}
                        <div className="space-y-2">
                            <div className="flex gap-2 items-start">
                                <div className="relative flex-1 min-w-0">
                                    <input
                                        ref={medicinaSearchInputRef}
                                        type="text"
                                        value={reparacionListSearch}
                                        onChange={(e) => setReparacionListSearch(e.target.value)}
                                        placeholder="Buscar en medicina..."
                                        className="w-full bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 pl-7 pr-8 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                    <Search className="absolute left-2 top-1.5 h-4 w-4 text-gray-500" />
                                    <button
                                        onClick={toggleSmartSearch}
                                        className={`absolute right-1.5 top-1.5 h-4 w-4 rounded-full border transition-colors ${isSmartSearchEnabled ? 'border-green-400 bg-green-500/20' : 'border-gray-500 bg-transparent'}`}
                                        title={isSmartSearchEnabled ? 'Búsqueda inteligente activa' : 'Búsqueda inteligente inactiva'}
                                    />
                                </div>

                                <button
                                    onClick={() => setShowMedicinaSearchControls(!showMedicinaSearchControls)}
                                    className={`px-2.5 py-1.5 rounded-lg border transition-all flex-shrink-0 flex items-center justify-center h-8 w-8 ${
                                        showMedicinaSearchControls
                                            ? 'bg-gray-700/60 border-gray-600/60 text-gray-400 hover:bg-gray-700'
                                            : 'bg-red-900/40 border-red-600/60 text-red-400 hover:bg-red-900/60'
                                    }`}
                                    title={showMedicinaSearchControls ? 'Ocultar controles de búsqueda' : 'Mostrar controles de búsqueda'}
                                >
                                    <Filter className="h-4 w-4" />
                                </button>
                            </div>

                            {showMedicinaSearchControls && (
                                <div className="flex items-center gap-2 px-1 flex-wrap">
                                    <span className="text-[10px] text-green-400 flex-1">
                                        {isSmartSearchEnabled ? 'Búsqueda inteligente activa' : 'Búsqueda inteligente inactiva'}
                                    </span>

                                    <button
                                        onClick={() => {
                                            if (selectedMedicinaLettersCount > 0) {
                                                setSelectedMedicinaLettersCount(selectedMedicinaLettersCount - 1);
                                            }
                                        }}
                                        disabled={selectedMedicinaLettersCount === 0}
                                        className="text-xs font-bold px-2 py-1 rounded bg-red-900/40 border border-red-600/60 text-red-400 hover:bg-red-900/60 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        title="Deseleccionar última letra"
                                    >
                                        −
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (selectedMedicinaLettersCount < reparacionListSearch.length) {
                                                setSelectedMedicinaLettersCount(selectedMedicinaLettersCount + 1);
                                            }
                                        }}
                                        disabled={selectedMedicinaLettersCount >= reparacionListSearch.length || reparacionListSearch.length === 0}
                                        className="text-xs font-bold px-2 py-1 rounded bg-green-900/40 border border-green-600/60 text-green-400 hover:bg-green-900/60 hover:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        title="Seleccionar siguiente letra"
                                    >
                                        +
                                    </button>

                                    <button
                                        onClick={() => {
                                            const selectedText = reparacionListSearch.substring(0, selectedMedicinaLettersCount);
                                            if (selectedText.trim()) {
                                                const newPrefix = selectedText;
                                                const currentPrefixes = settingsHook.channelPrefixes || [];

                                                if (!currentPrefixes.includes(newPrefix)) {
                                                    const updatedPrefixes = [newPrefix, ...currentPrefixes];
                                                    settingsHook.updateChannelPrefixes(updatedPrefixes);
                                                    alert(`Prefijo "${newPrefix}" añadido a la búsqueda inteligente`);
                                                    setSelectedMedicinaLettersCount(0);
                                                } else {
                                                    alert(`El prefijo "${newPrefix}" ya existe`);
                                                }
                                            }
                                        }}
                                        disabled={selectedMedicinaLettersCount === 0}
                                        className="text-xs font-bold px-3 py-1 rounded bg-blue-900/40 border border-blue-600/60 text-blue-400 hover:bg-blue-900/60 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                                        title="Añadir texto seleccionado como prefijo"
                                    >
                                        Añadir prefijo
                                    </button>
                                </div>
                            )}
                        </div>
                         
                         <div className="flex gap-2 items-center">
                            <select
                                value={reparacionListFilter}
                                onChange={(e) => setReparacionListFilter(e.target.value)}
                                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="Todos los canales">Todos los Grupos</option>
                                {reparacionListUniqueGroups.map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                            
                            <button onClick={() => toggleSelectAllReparacionGroup()} className="px-2 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-xs text-white whitespace-nowrap">
                                {isAllInGroupSelected ? 'Deseleccionar Grupo' : 'Seleccionar Grupo'}
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Lista canales reparadores */}
                <div 
                    ref={reparacionListParentRef} 
                    className="flex-1 overflow-y-auto min-h-0 pr-1"
                    onPointerDown={() => setIsDragging(true)}
                    onPointerUp={() => setIsDragging(false)}
                    onPointerLeave={() => setIsDragging(false)}
                    onDragStart={(e) => e.preventDefault()}
                >
                     <div style={{ height: `${reparacionListRowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {reparacionListRowVirtualizer.getVirtualItems().map((virtualItem) => {
                            const ch = filteredReparacionChannels[virtualItem.index];
                            const isChSelected = selectedReparacionChannels.has(ch.id);
                            const channelInfo = verificationInfo[ch.id] || { status: 'pending', quality: 'unknown' };
                            return (
                                <ReparacionChannelItem
                                    key={ch.id}
                                    channel={ch}
                                    isSelected={isChSelected}
                                    animateMarqueeWhenSelected={false}
                                    isChecked={isChSelected}
                                    showCheckbox={true}
                                    onSelectClick={(e) => toggleReparacionSelection(ch.id, virtualItem.index, e.shiftKey, e.metaKey, e.ctrlKey)}
                                    onDragSelect={() => {
                                        if (isDragging && !isChSelected) {
                                            selectMultipleChannels([ch.id]);
                                        }
                                    }}
                                    onBodyClick={destinationChannelId ? () => {
                                        if (attributesToCopy.size === 0) {
                                            alert(`Selecciona al menos un atributo para reparar en el canal "${filteredMainChannels.find(c => c.id === destinationChannelId)?.name || 'seleccionado'}"`);
                                        } else {
                                            handleSourceChannelClick(ch);
                                        }
                                    } : undefined}
                                    isSencillo={isSencillo}
                                    verificationStatus={channelInfo.status}
                                    quality={channelInfo.quality}
                                    resolution={channelInfo.resolution}
                                    onVerifyClick={() => verifyChannel(ch.id, ch.url)}
                                    onPlayClick={shouldShowPlayButton ? () => openInVLC(ch.url) : undefined}
                                    compact={isMobileLandscape}
                                    visibleFields={isPro ? reparacionVisibleFields : undefined}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                />
                            );
                        })}
                        {filteredReparacionChannels.length === 0 && (
                            <div className="text-center text-gray-500 py-10">
                                {reparacionListName ? 'No hay canales en esta vista' : 'Carga una lista para comenzar'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Botón Añadir — visible al seleccionar canales */}
                {selectedReparacionChannels.size > 0 && (
                    <div className="pt-2 border-t border-gray-700 mt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                                onClick={handleAddSelectedFromReparacion}
                                className="w-full py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow"
                            >
                                <Check size={15} />
                                Añadir {selectedReparacionChannels.size}
                            </button>
                            <button
                                onClick={handleDeleteSelectedFromReparacionList}
                                className="w-full py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow"
                            >
                                <Trash2 size={15} />
                                Eliminar {selectedReparacionChannels.size}
                            </button>
                        </div>
                    </div>
                )}

                {hasPendingReparacionChanges && reparacionListName && (
                    <div className="pt-2 border-t border-gray-700 mt-2">
                        <button
                            onClick={handleUpdateReparacionList}
                            disabled={isUpdatingReparacionList}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow"
                        >
                            {isUpdatingReparacionList ? <RefreshCw size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                            {isUpdatingReparacionList ? 'Actualizando lista reparadora...' : 'Actualizar lista reparadora'}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ReparacionTab;
