import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Copy, Zap, ArrowLeftCircle, ChevronsUpDown, Settings as SettingsIcon, X, Tv, Image, Type, List, Plus, Search } from 'lucide-react';
import { useAsignarEpg } from './useAsignarEpg';
import { useChannels } from './useChannels';
import { useVirtualizer } from '@tanstack/react-virtual';
import ReparacionChannelItem from './ReparacionChannelItem';
import { useSettings } from './useSettings';
import { useAppMode } from './AppModeContext';
import EpgChannelItem from './EpgChannelItem';
import { AttributeKey, Channel } from './index';
import { SearchResultItem } from './SearchResultComponents';

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
        toggleSelectAllEpgChannels,
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
        return channelsToFilter;
    }, [channels, selectedGroup, mainListSearch, isSmartSearchEnabled, epgSearchChannels]);

    const doesChannelMatchLoadedEpg = useCallback((channel: Channel) => {
        if (epgIdSet.size === 0) {
            return false;
        }

        const valueToCheck = assignmentMode === 'tvg-id' ? channel.tvgId : channel.tvgName;
        const normalizedValue = valueToCheck?.trim();

        if (!normalizedValue) {
            return false;
        }

        return epgIdSet.has(normalizedValue);
    }, [assignmentMode, epgIdSet]);

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
            case 'ott': setOttModeActive(!ottModeActive); break;
            case 'tivimate': setTivimateModeActive(!tivimateModeActive); break;
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

    const ToolbarContent = () => (
        <>
            <button
                onClick={() => handleToggle('logo')}
                className={`flex items-center justify-center rounded-lg border transition-all w-9 h-9 ${
                    transferLogoActive
                        ? 'bg-green-800/50 border-green-500 text-green-300'
                        : 'bg-gray-700/60 border-gray-600/60 text-gray-400 hover:text-gray-200 hover:border-gray-500'
                }`}
                title="Copiar logo desde EPG al canal"
            >
                <Image size={14} />
            </button>

            <button
                onClick={() => handleToggle('no-logo')}
                className={`flex items-center justify-center rounded-lg border transition-all w-9 h-9 ${
                    keepLogoActive
                        ? 'bg-red-800/50 border-red-500 text-red-300'
                        : 'bg-gray-700/60 border-gray-600/60 text-gray-400 hover:text-gray-200 hover:border-gray-500'
                }`}
                title="No copiar logo, mantener el logo actual del canal"
            >
                <Image size={14} className="opacity-40" />
            </button>

            <button
                onClick={() => handleToggle('name')}
                className={`flex items-center justify-center rounded-lg border transition-all w-9 h-9 ${
                    copyNameActive
                        ? 'bg-yellow-800/50 border-yellow-500 text-yellow-300'
                        : 'bg-gray-700/60 border-gray-600/60 text-gray-400 hover:text-gray-200 hover:border-gray-500'
                }`}
                title="Copiar el nombre del canal desde EPG"
            >
                <Type size={14} />
            </button>

            <button
                onClick={handleAutoAssign}
                className="flex items-center justify-center rounded-lg border border-indigo-500/70 bg-indigo-700/60 text-white hover:bg-indigo-600 hover:border-indigo-400 transition-all w-9 h-9"
                title="Asignar EPG automáticamente a todos los canales visibles por similitud de nombre"
            >
                <Zap size={14} />
            </button>
        </>
    );

    return (
        <div className="flex flex-col h-[calc(100dvh-126px)] sm:h-[calc(100dvh-170px)] overflow-hidden">
            {/* Header: Load EPG Source & Tools */}
            <div className={`bg-gray-800 shadow-lg z-20 flex-shrink-0 overflow-y-auto md:h-auto md:min-h-0 md:overflow-visible ${isShortViewport ? 'px-1.5 py-1 h-[24%] min-h-[88px]' : 'px-2 py-1.5 h-[30%] min-h-[140px]'}`}>
                <div className={`flex items-center justify-between gap-1.5 mb-1 ${isShortViewport ? 'h-5' : 'h-7'}`}>
                    <div className="flex items-center gap-1 truncate min-w-0">
                        <h2 className={`font-bold text-white flex items-center truncate min-w-0 ${isShortViewport ? 'text-xs' : 'text-sm'}`}>
                            <Tv className={`mr-1 text-blue-400 flex-shrink-0 ${isShortViewport ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
                            <span className="truncate">{loadedEpgSourceName || 'Asignar EPG'}</span>
                        </h2>
                        
                        {/* Botón OTT */}
                        <button
                            onClick={() => handleToggle('ott')}
                            className={`flex items-center justify-center rounded-lg border transition-all duration-200 w-auto min-w-fit flex-shrink-0 ${isShortViewport ? 'h-5' : 'h-6'} ${
                                ottModeActive
                                    ? 'bg-orange-900/40 border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                                    : 'bg-gray-700/60 border-gray-600/60 hover:border-orange-600/60 hover:bg-gray-700'
                            }`}
                            title="Usar formato para OTT Navigator"
                        >
                            <img src="/ott-logo.png" alt="OTT" className="h-full w-auto object-contain px-1" onError={(e) => e.currentTarget.style.display = 'none'} />
                        </button>
                        
                        {/* Botón TiviMate */}
                        <button
                            onClick={() => handleToggle('tivimate')}
                            className={`flex items-center justify-center rounded-lg border transition-all duration-200 w-auto min-w-fit flex-shrink-0 ${isShortViewport ? 'h-5' : 'h-6'} ${
                                tivimateModeActive
                                    ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                                    : 'bg-gray-700/60 border-gray-600/60 hover:border-blue-600/60 hover:bg-gray-700'
                            }`}
                            title="Usar formato para TiviMate"
                        >
                            <img src="/tivimate-logo.png" alt="TiviMate" className="h-full w-auto object-contain px-1" onError={(e) => e.currentTarget.style.display = 'none'} />
                        </button>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 min-w-0 overflow-x-auto no-scrollbar">
                        {/* Toggle: controla si se valida por tvg-id o tvg-name */}
                        <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[8px] text-gray-500 uppercase tracking-wider font-semibold leading-none">Validar por</span>
                            <div className="flex bg-gray-700/50 rounded-lg p-0.5 border border-gray-600/50">
                                <button
                                    onClick={() => setAssignmentMode('tvg-id')}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                                        assignmentMode === 'tvg-id'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    ID
                                </button>
                                <button
                                    onClick={() => setAssignmentMode('tvg-name')}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                                        assignmentMode === 'tvg-name'
                                            ? 'bg-purple-600 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    NAME
                                </button>
                            </div>
                        </div>

                        <ToolbarContent />

                        {/* Settings Button */}
                        {onNavigateToSettings && (
                            <button
                                onClick={onNavigateToSettings}
                                className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors flex-shrink-0 w-9 h-9"
                                title="Ir a configuración"
                            >
                                <SettingsIcon size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Paneles de listas: 70% del alto, lado a lado para maximizar filas visibles */}
            <div className={`md:h-auto md:flex-1 grid grid-cols-2 min-h-0 bg-gray-900 ${isShortViewport ? 'h-[76%]' : 'h-[70%]'}`}>

                {/* PANEL IZQUIERDO: Lista principal */}
                <div className="flex flex-col min-h-0 border-r border-gray-700 bg-gray-800/50">
                    
                    {/* Filter Main List */}
                    <div className="px-2 pt-1.5 pb-1.5 bg-gray-800 border-b border-gray-700 flex-shrink-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Mi lista</span>
                            <span className="text-[10px] text-gray-500 font-mono">{filteredMainChannelsForEpg.length} canales</span>
                        </div>
                        <div className="flex gap-2">
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
                                const hasAssignedField = assignmentMode === 'tvg-id' ? !!channel.tvgId : !!channel.tvgName;
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
                                            <div className="w-6 h-6 rounded bg-black/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
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

                {/* PANEL DERECHO: Fuente EPG */}
                 <div className="flex flex-col min-h-0 bg-gray-800">
                    
                    {/* EPG Tools Header */}
                     <div className="p-1.5 bg-gray-800 border-b border-gray-700 flex flex-col gap-1.5 flex-shrink-0 shadow-sm z-10">
                        {/* Smart Search EPG + selector de fuente */}
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

                            {/* Fuente EPG */}
                            {savedEpgUrls.length > 0 ? (
                                <div className="flex flex-col gap-1 flex-shrink-0">
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
                                        className="bg-gray-900 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500 max-w-[140px]"
                                        title="Seleccionar fuente EPG"
                                    >
                                        <option value="" disabled>
                                            {isEpgLoading ? 'Cargando…' : (loadedEpgSourceName ? `✓ ${loadedEpgSourceName}` : 'Fuente EPG…')}
                                        </option>
                                        {savedEpgUrls.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    {loadedEpgSourceName && !isEpgLoading && (
                                        <span className="text-[10px] text-green-400 truncate max-w-[140px] text-right px-1">
                                            ✓ {loadedEpgSourceName}
                                        </span>
                                    )}
                                </div>
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
                        <div className="flex items-center gap-2 px-1">
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
                        </div>
                         {/* Selection Controls */}
                        {epgChannels.length > 0 && (
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                     <button
                                        onClick={toggleSelectAllEpgChannels}
                                        className="text-[10px] uppercase font-bold text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                                    >
                                        <ChevronsUpDown className="h-3 w-3" />
                                        {selectedEpgChannels.size === 0 ? 'Seleccionar Todo' : 'Deseleccionar'}
                                    </button>
                                     <span className="text-[10px] text-gray-600">|</span>
                                    <span className="text-[10px] text-gray-400 font-mono">
                                        {filteredEpgChannels.length} canales
                                    </span>
                                </div>
                                {selectedEpgChannels.size > 0 && (
                                    <button
                                        onClick={addSelectedEpgChannels}
                                        className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-[10px] font-bold uppercase transition-transform active:scale-95"
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
                                            <SearchResultItem
                                                score={matchScore}
                                                matchType={matchType as any}
                                                isSelected={isSelected}
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
                                                className={`h-full border border-gray-700/50 ${!destinationChannelId ? 'hover:border-blue-500/50' : ''}`}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    {/* Logo EPG */}
                                                    <div className="w-7 h-7 rounded bg-black/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {epg.logo ? (
                                                            <img src={epg.logo} className="w-full h-full object-contain" loading="lazy" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                        ) : (
                                                            <Tv className="w-3.5 h-3.5 text-gray-600" />
                                                        )}
                                                    </div>
                                                    {/* Nombre e ID */}
                                                    <div className="flex flex-col min-w-0 justify-center">
                                                        <div className="text-xs font-semibold text-white truncate leading-tight">{epg.name || epg.id}</div>
                                                        <div className="text-[10px] text-gray-400 truncate font-mono leading-tight mt-0.5">{epg.id}</div>
                                                    </div>
                                                </div>
                                            </SearchResultItem>
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
