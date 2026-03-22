import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Copy, Zap, ArrowLeftCircle, Settings as SettingsIcon, X, Tv, Image, Type, List, Plus, Search, Filter } from 'lucide-react';
import { useAsignarEpg } from './useAsignarEpg';
import { useChannels } from './useChannels';
import { useVirtualizer } from '@tanstack/react-virtual';
import ReparacionChannelItem from './ReparacionChannelItem';
import { useSettings } from './useSettings';
import { useAppMode } from './AppModeContext';
import EpgChannelItem from './EpgChannelItem';
import { AttributeKey, Channel } from './index';

interface AsignarEpgTabProps {
    epgHook: ReturnType<typeof useAsignarEpg>;
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
    onNavigateToSettings?: () => void;
}

const AsignarEpgTab: React.FC<AsignarEpgTabProps> = ({ epgHook, channelsHook, settingsHook, onNavigateToSettings }) => {
    const { mode, isSencillo } = useAppMode();
    const {
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
        setAttributesToCopy,
        handleEpgFileUpload,
        handleFetchEpgUrl,
        handleGenerateEpgFromUrls,
        epgIdSet,
        handleEpgSourceClick,
        epgSearchTerm,
        setEpgSearchTerm,
        isSmartSearchEnabled,
        toggleSmartSearch,
        // getEpgSimilarityScore, // Removed as unused
        smartSearch,
        assignmentMode,
        setAssignmentMode,
        selectedEpgChannels,
        toggleEpgChannelSelection,
        addSelectedEpgChannels,
        assignChannelName,
        autoAssignEpgToVisibleGroup,
        clearEpgChannels,
    } = epgHook;
    
    const { searchChannels: epgSearchChannels, normalizeChannelName: epgNormalizeChannelName } = smartSearch;
    const { channels } = channelsHook;
    const { savedEpgUrls } = settingsHook;
    const [mainListSearch, setMainListSearch] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [loadedEpgSourceName, setLoadedEpgSourceName] = useState('');
    
    // UI State for toggles
    const [ottModeActive, setOttModeActive] = useState(false);
    const [tivimateModeActive, setTivimateModeActive] = useState(false);
    const [transferLogoActive, setTransferLogoActive] = useState(false);
    const [keepLogoActive, setKeepLogoActive] = useState(false);
    const [copyNameActive, setCopyNameActive] = useState(false);
    const [isShortViewport, setIsShortViewport] = useState(false);
    const [selectedLettersCount, setSelectedLettersCount] = useState(0);
    const [showEpgControls, setShowEpgControls] = useState(false);
    const [showOnlyNoEpg, setShowOnlyNoEpg] = useState(false);

    useEffect(() => {
        const checkViewport = () => setIsShortViewport(window.innerHeight <= 560);
        checkViewport();
        window.addEventListener('resize', checkViewport);
        return () => window.removeEventListener('resize', checkViewport);
    }, []);

    const channelGroups = useMemo(() => {
        const groups = new Set(channels.map(c => c.groupTitle).filter(Boolean));
        return ['all', ...Array.from(groups)];
    }, [channels]);

    const filteredMainChannelsForEpg = useMemo(() => {
        let channelsToFilter = channels;
        if (selectedGroup !== 'all') {
            channelsToFilter = channelsToFilter.filter(c => c.groupTitle === selectedGroup);
        }
        if (mainListSearch) {
            if (isSmartSearchEnabled) {
                const searchResults = epgSearchChannels(channelsToFilter, mainListSearch, 0.4);
                return searchResults.map(result => result.item);
            } else {
                channelsToFilter = channelsToFilter.filter(c => c.name.toLowerCase().includes(mainListSearch.toLowerCase()));
            }
        }
        // Filtro de canales sin EPG
        if (showOnlyNoEpg && epgIdSet.size > 0) {
            channelsToFilter = channelsToFilter.filter(channel => {
                const valueToCheck = assignmentMode === 'tvg-id' ? channel.tvgId : channel.tvgName;
                const normalizedValue = valueToCheck?.trim();
                if (!normalizedValue) return true; // Sin relleno = sin EPG
                return !epgIdSet.has(normalizedValue);
            });
        }
        return channelsToFilter;
    }, [channels, selectedGroup, mainListSearch, isSmartSearchEnabled, epgSearchChannels, showOnlyNoEpg, assignmentMode, epgIdSet]);

    const doesChannelMatchLoadedEpg = useCallback((channel: Channel) => {
        if (epgIdSet.size === 0) {
            return false;
        }

        // Modo dual: ambos OTT y TiviMate activos => validar contra AMBOS tvg-id y tvg-name
        if (ottModeActive && tivimateModeActive) {
            const hasTvgId = !!channel.tvgId?.trim();
            const hasTvgName = !!channel.tvgName?.trim();
            
            // Ambos campos deben estar presentes
            if (!hasTvgId || !hasTvgName) {
                return false;
            }
            
            const idNormalized = channel.tvgId.trim();
            const nameNormalized = channel.tvgName.trim();
            
            // Validar que tvg-id coincida en el EPG
            const hasIdMatch = epgIdSet.has(idNormalized);
            
            // Validar que tvg-name coincida en el EPG (buscar por nombre)
            const hasNameMatch = epgChannels.some(epg => epg.name === nameNormalized);
            
            return hasIdMatch && hasNameMatch;
        }

        // Modo simple: usar assignmentMode para seleccionar campo
        const valueToCheck = assignmentMode === 'tvg-id' ? channel.tvgId : channel.tvgName;
        const normalizedValue = valueToCheck?.trim();

        if (!normalizedValue) {
            return false;
        }

        return epgIdSet.has(normalizedValue);
    }, [assignmentMode, epgIdSet, ottModeActive, tivimateModeActive, epgChannels]);

    // Virtualizers
    const mainListParentRef = useRef<HTMLDivElement>(null);
    const epgListParentRef = useRef<HTMLDivElement>(null);

    const mainListRowVirtualizer = useVirtualizer({
        count: filteredMainChannelsForEpg.length,
        getScrollElement: () => mainListParentRef.current,
        estimateSize: () => 46,
        overscan: 10,
    });

    const epgListRowVirtualizer = useVirtualizer({
        count: filteredEpgChannels.length,
        getScrollElement: () => epgListParentRef.current,
        estimateSize: () => 46,
        overscan: 10,
    });

    // Helper: Logic for Auto Assign
    const handleAutoAssign = () => {
        if (!confirm('¿Asignar automáticamente EPG a los canales visibles?')) return;
        autoAssignEpgToVisibleGroup(filteredMainChannelsForEpg);
    };

    // Helper: Logic for Toggle Buttons (Single Source of Truth)
    const handleToggle = (type: 'ott' | 'tivimate' | 'logo' | 'no-logo' | 'name') => {
        // Here we would implement the logic to update global state or hook
        // For now, local UI toggle
        switch(type) {
            case 'ott': 
                setOttModeActive(!ottModeActive);
                setAssignmentMode('tvg-name');
                if (!ottModeActive && !copyNameActive) {
                    setCopyNameActive(true);
                }
                break;
            case 'tivimate': 
                setTivimateModeActive(!tivimateModeActive);
                setAssignmentMode('tvg-id');
                if (!tivimateModeActive && !copyNameActive) {
                    setCopyNameActive(true);
                }
                break;
            case 'logo': 
                setTransferLogoActive(!transferLogoActive); 
                if(!transferLogoActive) setKeepLogoActive(false); 
                break;
            case 'no-logo':
                setKeepLogoActive(!keepLogoActive);
                if(!keepLogoActive) setTransferLogoActive(false);
                break;
            case 'name': setCopyNameActive(!copyNameActive); break;
        }
    };

    const CenterActionColumn = () => (
        <div className="flex h-full min-h-0 flex-col items-center gap-2 border-x border-gray-700 bg-gray-900/90 px-1.5 py-2">
            <div className="flex w-full flex-col items-stretch gap-1">
                <span className="text-center text-[8px] font-semibold uppercase tracking-wider text-gray-500">Validar por</span>
                <button
                    onClick={() => {
                        setAssignmentMode('tvg-id');
                        setTivimateModeActive(true);
                    }}
                    className={`flex h-9 items-center justify-center rounded-lg border text-[11px] font-bold transition-all ${
                        assignmentMode === 'tvg-id'
                            ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                            : 'border-gray-600/60 bg-gray-700/60 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                >
                    ID
                </button>
                <button
                    onClick={() => {
                        setAssignmentMode('tvg-name');
                        setOttModeActive(true);
                    }}
                    className={`flex h-9 items-center justify-center rounded-lg border text-[11px] font-bold transition-all ${
                        assignmentMode === 'tvg-name'
                            ? 'border-purple-500 bg-purple-600 text-white shadow-sm'
                            : 'border-gray-600/60 bg-gray-700/60 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                >
                    NAME
                </button>
            </div>

            <div className="w-full border-t border-gray-700/80" />

            <div className="flex w-full flex-col items-stretch gap-1">
                <button
                    onClick={() => handleToggle('ott')}
                    className={`flex h-9 items-center justify-center rounded-lg border transition-all duration-200 ${
                        ottModeActive
                            ? 'border-orange-500 bg-orange-900/40 shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                            : 'border-gray-600/60 bg-gray-700/60 hover:border-orange-600/60 hover:bg-gray-700'
                    }`}
                    title="Usar formato para OTT Navigator"
                >
                    <img src="/ott-logo.png" alt="OTT" className="h-full w-auto object-contain px-1" onError={(e) => e.currentTarget.style.display = 'none'} />
                </button>
                <button
                    onClick={() => handleToggle('tivimate')}
                    className={`flex h-9 items-center justify-center rounded-lg border transition-all duration-200 ${
                        tivimateModeActive
                            ? 'border-blue-500 bg-blue-900/40 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                            : 'border-gray-600/60 bg-gray-700/60 hover:border-blue-600/60 hover:bg-gray-700'
                    }`}
                    title="Usar formato para TiviMate"
                >
                    <img src="/tivimate-logo.png" alt="TiviMate" className="h-full w-auto object-contain px-1" onError={(e) => e.currentTarget.style.display = 'none'} />
                </button>
            </div>

            <div className="w-full border-t border-gray-700/80" />

            <div className="flex w-full flex-col items-stretch gap-1">
                <button
                    onClick={() => handleToggle('logo')}
                    className={`flex h-9 items-center justify-center rounded-lg border transition-all ${
                        transferLogoActive
                            ? 'border-green-500 bg-green-800/50 text-green-300'
                            : 'border-gray-600/60 bg-gray-700/60 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                    title="Copiar logo desde EPG al canal"
                >
                    <Image size={14} />
                </button>

                <button
                    onClick={() => handleToggle('no-logo')}
                    className={`flex h-9 items-center justify-center rounded-lg border transition-all ${
                        keepLogoActive
                            ? 'border-red-500 bg-red-800/50 text-red-300'
                            : 'border-gray-600/60 bg-gray-700/60 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                    title="No copiar logo, mantener el logo actual del canal"
                >
                    <Image size={14} className="opacity-40" />
                </button>

                <button
                    onClick={() => handleToggle('name')}
                    className={`flex h-9 items-center justify-center rounded-lg border transition-all ${
                        copyNameActive
                            ? 'border-yellow-500 bg-yellow-800/50 text-yellow-300'
                            : 'border-gray-600/60 bg-gray-700/60 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                    title="Copiar el nombre del canal desde EPG"
                >
                    <Type size={14} />
                </button>

                <button
                    onClick={handleAutoAssign}
                    className="flex h-9 items-center justify-center rounded-lg border border-indigo-500/70 bg-indigo-700/60 text-white transition-all hover:border-indigo-400 hover:bg-indigo-600"
                    title="Asignar EPG automáticamente a todos los canales visibles por similitud de nombre"
                >
                    <Zap size={14} />
                </button>

                {onNavigateToSettings && (
                    <button
                        onClick={onNavigateToSettings}
                        className="flex h-9 items-center justify-center rounded-lg border border-gray-600/60 bg-gray-700/60 text-gray-300 transition-colors hover:border-gray-500 hover:bg-gray-600"
                        title="Ir a configuración"
                    >
                        <SettingsIcon size={14} />
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex min-h-0 h-full flex-col overflow-hidden">
            {/* Header: Load EPG Source & Tools */}
            <div className={`bg-gray-800 shadow-lg z-20 flex-shrink-0 md:h-auto md:min-h-0 md:overflow-visible ${isShortViewport ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}>
                <div className={`flex items-center justify-between gap-1.5 ${isShortViewport ? 'min-h-6' : 'min-h-8'}`}>
                    <div className="flex items-center gap-1 truncate min-w-0">
                        <h2 className={`font-bold text-white flex items-center truncate min-w-0 ${isShortViewport ? 'text-sm' : 'text-base'}`}>
                            <Tv className={`mr-1 text-blue-400 flex-shrink-0 ${isShortViewport ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                            <span className="truncate">{loadedEpgSourceName || 'Asignar EPG'}</span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 min-w-0 overflow-x-auto no-scrollbar">
                        <span className="text-[10px] font-mono text-gray-500">{filteredEpgChannels.length} EPG</span>
                    </div>
                </div>
            </div>

            {/* Paneles de listas con columna central de acciones */}
            <div className="flex-1 min-h-0 grid bg-gray-900 grid-cols-[minmax(0,1fr)_3.75rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)]">

                {/* PANEL IZQUIERDO: Lista principal */}
                <div className="flex flex-col min-h-0 bg-gray-800/50">
                    
                    {/* Filter Main List */}
                    <div className="px-2 pt-1.5 pb-1.5 bg-gray-800 border-b border-gray-700 flex-shrink-0 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Mi lista</span>
                            <span className="text-[10px] text-gray-500 font-mono">{filteredMainChannelsForEpg.length} canales</span>
                        </div>
                        <div className="flex gap-2">
                            {/* Botón Sin EPG / Todos */}
                            <button
                                onClick={() => setShowOnlyNoEpg(!showOnlyNoEpg)}
                                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap border ${
                                    showOnlyNoEpg
                                        ? 'bg-red-900/40 border-red-600/60 text-red-400 hover:bg-red-900/60'
                                        : 'bg-gray-700/60 border-gray-600/60 text-gray-400 hover:bg-gray-700'
                                }`}
                                title={showOnlyNoEpg ? 'Mostrar todos los canales' : 'Mostrar solo canales sin EPG'}
                            >
                                {showOnlyNoEpg ? 'Sin EPG' : 'Todos'}
                            </button>
                            <div className="relative flex-grow min-w-0">
                                <select
                                    value={selectedGroup}
                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                    className="w-full bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none pl-8 truncate"
                                >
                                    {channelGroups.map(g => (
                                        <option key={g} value={g}>{g === 'all' ? 'Todos los grupos' : g}</option>
                                    ))}
                                </select>
                                <List className="absolute left-2.5 top-1.5 h-4 w-4 text-gray-400 pointer-events-none" />
                            </div>
                            {/* Search Main List */}
                            <div className="relative w-1/3 min-w-[90px]">
                                <input
                                    type="text"
                                    placeholder="Filtrar..."
                                    value={mainListSearch}
                                    onChange={(e) => setMainListSearch(e.target.value)}
                                    className="w-full bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 pl-7 border border-gray-600 focus:border-blue-500"
                                />
                                <Search className="absolute left-2 top-1.5 h-4 w-4 text-gray-500" />
                            </div>
                        </div>
                    </div>

                    {/* Main List Virtual Container */}
                    <div className="flex-grow overflow-auto relative bg-gray-900" ref={mainListParentRef}>
                         <div
                            style={{
                                height: `${mainListRowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {mainListRowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const channel = filteredMainChannelsForEpg[virtualRow.index];
                                const isTarget = destinationChannelId === channel.id;
                                const hasAssignedField = ottModeActive && tivimateModeActive 
                                    ? !!channel.tvgId && !!channel.tvgName
                                    : (assignmentMode === 'tvg-id' ? !!channel.tvgId : !!channel.tvgName);
                                const hasMatchingEpg = doesChannelMatchLoadedEpg(channel);

                                return (
                                    <div
                                        key={channel.id}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                        className="px-1.5 py-0.5"
                                    >
                                        <div
                                            onClick={() => {
                                                if (isTarget) {
                                                    setDestinationChannelId(null);
                                                    setEpgSearchTerm('');
                                                } else {
                                                    setDestinationChannelId(channel.id);
                                                    setEpgSearchTerm(epgNormalizeChannelName(channel.name));
                                                    if (!isSmartSearchEnabled) toggleSmartSearch();
                                                }
                                            }}
                                            className={`
                                                flex items-center gap-1.5 p-1 rounded-lg cursor-pointer border h-full select-none transition-all
                                                ${isTarget
                                                    ? 'bg-blue-600 border-blue-400 shadow-lg scale-[1.01] z-10'
                                                    : hasMatchingEpg
                                                        ? 'bg-gray-800/80 border-gray-700/80 hover:bg-gray-700/60'
                                                        : 'bg-gray-800 border-gray-700 hover:bg-gray-700/80'
                                                }
                                            `}
                                        >
                                            <div className={`w-1 h-6 rounded-full flex-shrink-0 ${hasMatchingEpg ? 'bg-green-500' : 'bg-gray-600'}`} />

                                            {/* Channel Logo */}
                                            <div className="aspect-square h-[90%] rounded bg-black/40 flex items-center justify-center flex-shrink-0 overflow-hidden self-center">
                                                {channel.tvgLogo ? (
                                                    <img src={channel.tvgLogo} alt="" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                ) : (
                                                    <Tv className="w-3 h-3 text-gray-600" />
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className={`text-xs font-semibold leading-tight truncate ${isTarget ? 'text-white' : 'text-gray-100'}`}>
                                                    {channel.name}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                    <span
                                                        className={`text-[10px] font-mono truncate max-w-[130px] ${isTarget ? 'text-blue-200' : 'text-gray-400'}`}
                                                        title={`tvg-id: ${channel.tvgId || 'N/A'} | tvg-name: ${channel.tvgName || 'N/A'}`}
                                                    >
                                                        {channel.tvgId || channel.tvgName || '—'}
                                                    </span>
                                                    {hasMatchingEpg && (
                                                        <span className="inline-flex items-center text-[8px] font-bold text-green-400 bg-green-900/30 px-1 py-0.5 rounded-full leading-none whitespace-nowrap">✓ EPG</span>
                                                    )}
                                                    {!hasMatchingEpg && hasAssignedField && epgIdSet.size > 0 && (
                                                        <span className="inline-flex items-center text-[8px] font-bold text-amber-400 bg-amber-900/30 px-1 py-0.5 rounded-full leading-none whitespace-nowrap">! Sin EPG</span>
                                                    )}
                                                </div>
                                            </div>

                                            {isTarget && (
                                                <div className="bg-white text-blue-600 p-1 rounded-full animate-pulse shadow-sm flex-shrink-0">
                                                    <ArrowLeftCircle size={12} className="-rotate-90 md:rotate-0" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <CenterActionColumn />

                {/* PANEL DERECHO: Fuente EPG */}
                 <div className="flex flex-col min-h-0 bg-gray-800">
                    
                    {/* EPG Tools Header */}
                     <div className="px-2 pt-1.5 pb-1.5 bg-gray-800 border-b border-gray-700 flex flex-col gap-1.5 flex-shrink-0 shadow-sm z-10">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Fuente EPG</span>
                            {savedEpgUrls.length > 0 ? (
                                loadedEpgSourceName ? (
                                    <div className="flex items-center gap-1 max-w-[210px]">
                                        <span className="text-[10px] text-gray-500 font-mono truncate" title={loadedEpgSourceName}>
                                            {loadedEpgSourceName}
                                        </span>
                                        <button
                                            onClick={() => {
                                                setLoadedEpgSourceName('');
                                                clearEpgChannels();
                                            }}
                                            className="flex items-center justify-center w-4 h-4 rounded text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors flex-shrink-0"
                                            title="Quitar fuente EPG seleccionada"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <select
                                        defaultValue=""
                                        onChange={e => {
                                            const source = savedEpgUrls.find(s => s.id === e.target.value);
                                            if (source) {
                                                setLoadedEpgSourceName(source.name);
                                                handleFetchEpgUrl(source.url);
                                                e.target.value = '';
                                            }
                                        }}
                                        className="bg-gray-900 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 max-w-[170px]"
                                        title="Seleccionar fuente EPG"
                                    >
                                        <option value="" disabled>
                                            {isEpgLoading ? 'Cargando…' : 'Fuente EPG…'}
                                        </option>
                                        {savedEpgUrls.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                )
                            ) : (
                                <button
                                    onClick={onNavigateToSettings}
                                    className="flex-shrink-0 flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 rounded-lg px-2 py-1.5 transition-colors whitespace-nowrap bg-blue-900/20"
                                    title="Ir a Ajustes → Fuentes EPG"
                                >
                                    <SettingsIcon size={12} />
                                    Añadir fuente EPG
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2 items-start">
                            <div className="relative flex-1 min-w-0">
                                <input
                                    type="text"
                                    value={epgSearchTerm}
                                    onChange={(e) => setEpgSearchTerm(e.target.value)}
                                    placeholder={destinationChannelId
                                        ? `Buscar EPG para: ${filteredMainChannelsForEpg.find(c => c.id === destinationChannelId)?.name || ''}...`
                                        : 'Buscar en guía EPG...'}
                                    className="w-full bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 pl-7 pr-8 border border-gray-600 focus:border-blue-500"
                                />
                                <Search className="absolute left-2 top-1.5 h-4 w-4 text-gray-500" />
                                <button
                                    onClick={toggleSmartSearch}
                                    className={`absolute right-1.5 top-1.5 h-4 w-4 rounded-full border transition-colors ${isSmartSearchEnabled ? 'border-green-400 bg-green-500/20' : 'border-gray-500 bg-transparent'}`}
                                    title={isSmartSearchEnabled ? 'Búsqueda inteligente activa' : 'Búsqueda inteligente inactiva'}
                                />
                            </div>
                            {/* Filtro de controles EPG */}
                            <button
                                onClick={() => setShowEpgControls(!showEpgControls)}
                                className={`px-2.5 py-1.5 rounded-lg border transition-all flex-shrink-0 flex items-center justify-center h-10 w-10 ${
                                    showEpgControls
                                        ? 'bg-gray-700/60 border-gray-600/60 text-gray-400 hover:bg-gray-700'
                                        : 'bg-red-900/40 border-red-600/60 text-red-400 hover:bg-red-900/60'
                                }`}
                                title={showEpgControls ? 'Ocultar controles de búsqueda' : 'Mostrar controles de búsqueda'}
                            >
                                <Filter className="h-4 w-4" />
                            </button>
                        </div>
                        {showEpgControls && (
                            <div className="flex items-center gap-2 px-1 flex-wrap">
                                <span className="text-[10px] text-green-400 flex-1">
                                    {isSmartSearchEnabled ? 'Búsqueda inteligente activa' : 'Búsqueda inteligente inactiva'}
                                </span>
                                
                                {/* Botón Menos */}
                                <button
                                    onClick={() => {
                                        if (selectedLettersCount > 0) {
                                            setSelectedLettersCount(selectedLettersCount - 1);
                                        }
                                    }}
                                    disabled={selectedLettersCount === 0}
                                    className="text-xs font-bold px-2 py-1 rounded bg-red-900/40 border border-red-600/60 text-red-400 hover:bg-red-900/60 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    title="Deseleccionar última letra"
                                >
                                    −
                                </button>
                                
                                {/* Botón Más */}
                                <button
                                    onClick={() => {
                                        if (selectedLettersCount < epgSearchTerm.length) {
                                            setSelectedLettersCount(selectedLettersCount + 1);
                                        }
                                    }}
                                    disabled={selectedLettersCount >= epgSearchTerm.length || epgSearchTerm.length === 0}
                                    className="text-xs font-bold px-2 py-1 rounded bg-green-900/40 border border-green-600/60 text-green-400 hover:bg-green-900/60 hover:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    title="Seleccionar siguiente letra"
                                >
                                    +
                                </button>
                                
                                {/* Botón Añadir Prefijo */}
                                <button
                                    onClick={() => {
                                        const selectedText = epgSearchTerm.substring(0, selectedLettersCount);
                                        if (selectedText.trim()) {
                                            const newPrefix = selectedText;
                                            const currentPrefixes = settingsHook.channelPrefixes || [];
                                            
                                            // Verificar si el prefijo ya existe
                                            if (!currentPrefixes.includes(newPrefix)) {
                                                const updatedPrefixes = [newPrefix, ...currentPrefixes];
                                                settingsHook.updateChannelPrefixes(updatedPrefixes);
                                                alert(`Prefijo "${newPrefix}" añadido a la búsqueda inteligente`);
                                                setSelectedLettersCount(0);
                                            } else {
                                                alert(`El prefijo "${newPrefix}" ya existe`);
                                            }
                                        }
                                    }}
                                    disabled={selectedLettersCount === 0}
                                    className="text-xs font-bold px-3 py-1 rounded bg-blue-900/40 border border-blue-600/60 text-blue-400 hover:bg-blue-900/60 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                                    title="Añadir texto seleccionado como prefijo"
                                >
                                    Añadir prefijo
                                </button>
                                {selectedEpgChannels.size > 0 && !destinationChannelId && (
                                    <button
                                        onClick={addSelectedEpgChannels}
                                        className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-[10px] font-bold uppercase transition-transform active:scale-95 whitespace-nowrap"
                                    >
                                        <Plus className="h-3 w-3" />
                                        Añadir ({selectedEpgChannels.size})
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* EPG List Virtual Container */}
                    <div className="flex-grow overflow-auto relative bg-gray-900" ref={epgListParentRef}>
                         {epgChannels.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center opacity-50">
                                <Tv className="h-12 w-12 mb-2 text-gray-600" />
                                <p className="text-sm">No hay fuente EPG cargada</p>
                            </div>
                        ) : (
                            <div
                                style={{
                                    height: `${epgListRowVirtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {epgListRowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const epg = filteredEpgChannels[virtualRow.index];
                                    const isSelected = selectedEpgChannels.has(epg.id);
                                    
                                    // Calculate match score if target is selected using SmartSearch
                                    let matchScore = undefined;
                                    let matchType = undefined;
                                    
                                    if (destinationChannelId && smartSearch) {
                                        const targetChannel = channels.find(c => c.id === destinationChannelId);
                                        if (targetChannel) {
                                            const score = smartSearch.calculateSimilarity(targetChannel.name, epg.name);
                                            matchScore = score;
                                            if (score > 0.9) matchType = 'exact';
                                            else if (score > 0.7) matchType = 'partial';
                                            else if (score > 0.5) matchType = 'fuzzy';
                                        }
                                    }

                                    return (
                                        <div
                                            key={epg.id}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: `${virtualRow.size}px`,
                                                transform: `translateY(${virtualRow.start}px)`,
                                            }}
                                                className="px-1.5 py-0.5"
                                        >
                                            <div
                                                onClick={() => {
                                                    if (destinationChannelId) {
                                                        handleEpgSourceClick(epg, {
                                                            ottMode: ottModeActive,
                                                            tivimateMode: tivimateModeActive,
                                                            transferLogo: transferLogoActive,
                                                            keepLogo: keepLogoActive,
                                                            copyName: copyNameActive
                                                        });
                                                    } else {
                                                        toggleEpgChannelSelection(epg.id);
                                                    }
                                                }}
                                                className={`
                                                    flex items-center gap-1.5 p-1 rounded-lg cursor-pointer border h-full select-none transition-all
                                                    ${isSelected
                                                        ? 'bg-blue-600 border-blue-400 shadow-lg scale-[1.01] z-10'
                                                        : matchScore !== undefined && matchScore >= 0.7
                                                            ? 'bg-gray-800/80 border-green-700/70 hover:bg-gray-700/60'
                                                            : 'bg-gray-800 border-gray-700 hover:bg-gray-700/80'
                                                    }
                                                `}
                                            >
                                                <div className={`w-1 h-6 rounded-full flex-shrink-0 ${isSelected ? 'bg-blue-200' : matchScore !== undefined && matchScore >= 0.7 ? 'bg-green-500' : 'bg-gray-600'}`} />

                                                <div className="aspect-square h-[90%] rounded bg-black/40 flex items-center justify-center flex-shrink-0 overflow-hidden self-center">
                                                    {epg.logo ? (
                                                        <img src={epg.logo} alt="" className="w-full h-full object-contain" loading="lazy" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                    ) : (
                                                        <Tv className="w-3.5 h-3.5 text-gray-600" />
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className={`text-xs font-semibold leading-tight truncate ${isSelected ? 'text-white' : 'text-gray-100'}`}>
                                                        {epg.name || epg.id}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                        <span className={`text-[10px] font-mono truncate max-w-[150px] ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                                                            {epg.id}
                                                        </span>
                                                        {matchScore !== undefined && destinationChannelId && (
                                                            <span className={`inline-flex items-center text-[8px] font-bold px-1 py-0.5 rounded-full leading-none whitespace-nowrap ${
                                                                matchScore >= 0.9
                                                                    ? 'text-green-400 bg-green-900/30'
                                                                    : matchScore >= 0.7
                                                                        ? 'text-yellow-400 bg-yellow-900/30'
                                                                        : 'text-blue-300 bg-blue-900/30'
                                                            }`}>
                                                                {Math.round(matchScore * 100)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {destinationChannelId && matchType === 'exact' && (
                                                    <div className="bg-white text-green-600 p-1 rounded-full shadow-sm flex-shrink-0">
                                                        <ArrowLeftCircle size={12} className="-rotate-90 md:rotate-0" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AsignarEpgTab;
