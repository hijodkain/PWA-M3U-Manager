import React, { useRef, useState, useEffect } from 'react';
import { Upload, Copy, CheckSquare, ArrowLeftCircle, RotateCcw, Trash2, Link, Check, Search, X, RefreshCw } from 'lucide-react';
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

const ReparacionTab: React.FC<ReparacionTabProps> = ({ reparacionHook, channelsHook, settingsHook, onNavigateToSave, onNavigateToInicio }) => {
    const { isSencillo } = useAppMode();
    
    // States for UI Toggles
    const [showMainSearch, setShowMainSearch] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [savedMedicinaLists, setSavedMedicinaLists] = useState<Array<{ id: string; name: string; url: string; content?: string }>>([]);
    const [bulkActionType, setBulkActionType] = useState('offline_repair');
    const [hasPendingReparacionChanges, setHasPendingReparacionChanges] = useState(false);
    const [isUpdatingReparacionList, setIsUpdatingReparacionList] = useState(false);

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

    // Initial Load of Medicina Lists
    useEffect(() => {
        const stored = getStorageItem('medicinaLists');
        if (stored) setSavedMedicinaLists(JSON.parse(stored));
    }, []);

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
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
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
        <div className={`grid grid-cols-1 lg:grid-cols-11 gap-4 h-[calc(100vh-140px)] ${isMobile ? 'overflow-y-auto block' : ''}`}>
            
            {/* --- BLOQUE MOVIL: ATRIBUTOS ARRIBA --- */}
            {isMobile && (
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
            <div className={`lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col border border-gray-700 min-h-0 ${isMobile ? 'h-[400px] mb-4' : 'h-full'}`}>
                
                {/* Header Lista Principal */}
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700 shrink-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <h3 className="font-bold text-lg truncate text-white">
                            {channels.length > 0 ? `Mi lista: ${fileName}` : 'Lista Principal'}
                        </h3>
                        {channels.length > 0 && (
                             <button onClick={handleClearMainListClick} className="text-red-500 hover:text-red-400 p-1 hover:bg-gray-700 rounded transition-colors">
                                <X size={18} />
                            </button>
                        )}
                    </div>
                    {/* Botón Lupa (Search Toggle) */}
                    {channels.length > 0 && (
                        <button 
                            onClick={() => setShowMainSearch(!showMainSearch)}
                            className={`p-1.5 rounded transition-colors ${showMainSearch ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                        >
                            <Search size={18} />
                        </button>
                    )}
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
                    <div className="mb-3 animate-fadeIn">
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
                
                {/* Filtros y Verificación */}
                <div className="space-y-2 mb-2">
                    {/* Fila: Filtro Grupo + Toggle Unverified + Verificación Rápida */}
                    <div className="flex gap-2 w-full">
                        <select
                            value={mainListFilter}
                            onChange={(e) => setMainListFilter(e.target.value)}
                            className={`bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white text-sm focus:ring-blue-500 focus:border-blue-500 truncate ${mainListFilter !== 'Todos los canales' ? 'w-1/3' : 'w-2/3'}`}
                        >
                            <option value="Todos los canales">Todos los canales</option>
                            {mainListUniqueGroups.map((g) => {
                                if (g === 'Todos los canales') return null;
                                const failedCount = failedChannelsByGroup[g] || 0;
                                return (
                                    <option key={g} value={g} className={failedCount > 0 ? 'text-yellow-400' : ''}>
                                        {g} {failedCount > 0 ? `(${failedCount})` : ''}
                                    </option>
                                );
                            })}
                        </select>
                        {mainListFilter !== 'Todos los canales' && (
                            <button
                                onClick={handleQuickVerify}
                                className="w-1/3 text-xs py-1.5 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-blue-600 hover:bg-blue-700 shadow-sm"
                                title="Verificación rápida de grupo"
                            >
                                <Check size={14} /> <span className="hidden xl:inline">Verif. Rápida</span><span className="xl:hidden">Verif.</span>
                            </button>
                        )}
                        <select
                            value={mainStatusFilter}
                            onChange={(e) => setMainStatusFilter(e.target.value)}
                            className={`bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-xs font-bold focus:ring-blue-500 focus:border-blue-500 truncate ${mainListFilter !== 'Todos los canales' ? 'w-1/3' : 'w-1/3'} ${mainStatusFilter !== 'Todos' ? 'text-yellow-400 border-yellow-500/50 bg-yellow-900/40' : 'text-gray-400'} ${mainStatusFilter === 'Todos' ? 'text-white' : ''}`}
                            title="Filtrar por estado de verificación"
                        >
                            <option value="Todos" style={{ color: 'white' }}>Todos</option>
                            <option value="Rotos" style={{ color: '#ef4444' }}>❌ Offline</option>
                            <option value="Pendientes" style={{ color: '#9ca3af' }}>○ Pendientes</option>
                            <option value="ResDesconocida" style={{ color: 'white', backgroundColor: '#4b5563' }}>❓ Res. desconocida</option>
                        </select>
                    </div>
                    
                    {!isSencillo && (
                        <div className="flex gap-2 w-full mt-2 mb-2">
                            <select
                                className="w-1/3 bg-gray-900 text-xs border border-gray-700 rounded p-1.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 truncate"
                                value={mainDomainFilter}
                                onChange={(e) => setMainDomainFilter(e.target.value)}
                            >
                                {mainListUniqueDomains.map(domain => (
                                    <option key={domain} value={domain}>{domain}</option>
                                ))}
                            </select>
                            <select
                                className="w-1/3 bg-gray-900 text-xs border border-gray-700 rounded p-1.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 truncate"
                                value={bulkActionType}
                                onChange={(e) => setBulkActionType(e.target.value)}
                            >
                                <option value="offline_repair">Offline a reparar</option>
                                <option value="res_desconocida_repair">Res desconocida a reparar</option>
                                <option value="eliminar">Eliminar canal</option>
                            </select>
                            <button
                                onClick={() => executeBulkAction(bulkActionType, filteredMainChannels)}
                                className="w-1/3 text-xs py-1.5 px-0 rounded border border-red-900/50 text-red-500 hover:bg-red-900/20 flex items-center justify-center gap-1"
                                title="Aplicar acción"
                            >
                                <Trash2 size={12} /> <span className="hidden sm:inline">Aplicar</span>
                            </button>
                        </div>
                    )}
                </div>

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
            {!isMobile && (
            <div className="lg:col-span-1 flex flex-col items-center justify-start gap-3 bg-gray-800 p-3 rounded-lg border border-gray-700">
                 <div className="text-center w-full">
                    <h4 className="font-bold text-xs uppercase text-gray-400 mb-2">Atributos</h4>
                    <ArrowLeftCircle size={24} className="text-blue-500 mb-3 mx-auto" />
                    <div className="space-y-1.5">
                        {attributeLabels
                            .filter(({ key }) => isSencillo ? (key !== 'tvgId' && key !== 'tvgName') : true)
                            .map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => toggleAttributeToCopy(key)}
                                className={`w-full text-[10px] py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-colors ${attributesToCopy.has(key) ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                            >
                                {attributesToCopy.has(key) ? <CheckSquare size={12} /> : <Copy size={12} />} {label}
                            </button>
                        ))}
                    </div>
                </div>
                {!isSencillo && (
                    <div className="w-full mt-2">
                        <button
                            onClick={handleAddSelectedFromReparacion}
                            disabled={selectedReparacionChannels.size === 0}
                            className="w-full text-xs py-2 bg-green-600 hover:bg-green-700 text-white rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            + Añadir
                        </button>
                    </div>
                )}
                <div className="w-full mt-2">
                    <button
                        onClick={undo}
                        disabled={history.length === 0}
                        className="w-full text-xs py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                        <RotateCcw size={12} /> Deshacer
                    </button>
                </div>
            </div>
            )}

            {/* --- PANEL DERECHO (Lista Reparadora) --- */}
            <div className={`lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col border border-gray-700 min-h-0 ${isMobile ? 'h-[400px]' : 'h-full'}`}>
                
                {/* Header Lista Reparadora */}
                <div className="mb-4">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex-grow flex items-center gap-2">
                            <h3 className="font-bold text-lg text-gray-300">
                                {isSencillo ? 'Lista Reparadora: ' : 'Lista reparadora: '}
                            </h3>
                            {reparacionListName && (
                                <div className="flex items-center gap-1.5 ml-2 bg-gray-700/50 px-2 py-1 rounded-md max-w-full">
                                    <span className="text-sm font-bold text-gray-200 truncate">{reparacionListName}</span>
                                    <button
                                        onClick={clearReparacion}
                                        className="text-red-400 hover:text-red-300 p-0.5 hover:bg-gray-600 rounded transition-colors flex-shrink-0"
                                        title="Eliminar y descargar lista actual"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                        {!reparacionListName && savedMedicinaLists.length > 0 && (
                            <select
                                onChange={(e) => loadRepairList(e.target.value)}
                                value=""
                                className="ml-2 w-48 bg-gray-700 border border-gray-600 text-xs rounded px-2 py-1.5 text-white"
                            >
                                <option value="">Cargar guardada...</option>
                                {savedMedicinaLists.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    {/* Si no hay lista, mostramos la caja de inputs */}
                    {!reparacionListName ? (
                        <div className="bg-gray-700/30 p-3 rounded border border-gray-700 flex flex-wrap gap-2 items-center">
                            <input
                                type="text"
                                placeholder="URL..."
                                value={reparacionUrl}
                                onChange={(e) => setReparacionUrl(e.target.value)}
                                className="flex-1 min-w-[150px] bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500"
                            />
                            <button onClick={() => onUrlLoad()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium">
                                Cargar
                            </button>
                            <div className="w-px h-6 bg-gray-600 mx-1"></div>
                            <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                                <Upload size={14} /> Subir
                                <input id="rep-file" type="file" className="hidden" onChange={onFileUpload} accept=".m3u,.m3u8" />
                            </label>
                        </div>
                    ) : null}
                </div>

                {/* Filtros e Inputs de la lista reparadora */}
                {(filteredReparacionChannels.length > 0 || !!reparacionListSearch || !!reparacionListName) && (
                    <div className="space-y-2 mb-2">
                        {/* Buscador Reparación - Visible siempre en Pro, o Sencillo si hay necesidad */}
                         <SmartSearchInput
                            searchTerm={reparacionListSearch}
                            onSearchChange={setReparacionListSearch}
                            isSmartSearchEnabled={isSmartSearchEnabled}
                            onToggleSmartSearch={toggleSmartSearch}
                            placeholder="Buscar en medicina..."
                            showResults={false} // Simple input here vs suggestions
                            className="bg-gray-900"
                        />
                         
                         <div className="flex gap-2 items-center">
                            <select
                                value={reparacionListFilter}
                                onChange={(e) => setReparacionListFilter(e.target.value)}
                                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white"
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
