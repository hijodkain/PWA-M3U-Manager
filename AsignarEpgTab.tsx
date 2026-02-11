import React, { useState, useMemo, useRef } from 'react';
import { Upload, Download, Copy, Zap, ArrowLeftCircle, ChevronsUpDown, Settings as SettingsIcon, X, Tv, Image, Type, List, Plus, Search } from 'lucide-react';
import { useAsignarEpg } from './useAsignarEpg';
import { useChannels } from './useChannels';
import { useVirtualizer } from '@tanstack/react-virtual';
import ReparacionChannelItem from './ReparacionChannelItem';
import { useSettings } from './useSettings';
import { useAppMode } from './AppModeContext';
import EpgChannelItem from './EpgChannelItem';
import { AttributeKey, Channel } from './index';
import { SmartSearchInput } from './SmartSearchInput';
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
        getEpgSimilarityScore,
        smartSearch,
        assignmentMode,
        toggleAssignmentMode,
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

    const SUGGESTED_EPGS = [
        { name: 'David_DobleM', url: 'https://raw.githubusercontent.com/davidmuma/EPG_dobleM/master/guiaiptv.xml' },
        { name: 'Open-EPG.org', url: 'https://www.open-epg.com/generate/A5KxjtxpeF.xml' }
    ];
    
    // UI State for toggles
    const [ottModeActive, setOttModeActive] = useState(false);
    const [tivimateModeActive, setTivimateModeActive] = useState(false);
    const [transferLogoActive, setTransferLogoActive] = useState(false);
    const [keepLogoActive, setKeepLogoActive] = useState(false);
    const [copyNameActive, setCopyNameActive] = useState(false);

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

    // Virtualizers
    const mainListParentRef = useRef<HTMLDivElement>(null);
    const epgListParentRef = useRef<HTMLDivElement>(null);

    const mainListRowVirtualizer = useVirtualizer({
        count: filteredMainChannelsForEpg.length,
        getScrollElement: () => mainListParentRef.current,
        estimateSize: () => 60,
        overscan: 10,
    });

    const epgListRowVirtualizer = useVirtualizer({
        count: filteredEpgChannels.length,
        getScrollElement: () => epgListParentRef.current,
        estimateSize: () => 60,
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
                onClick={() => handleToggle('ott')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${ottModeActive ? 'bg-orange-900/40 border border-orange-500/50' : 'bg-gray-700/50 border border-transparent hover:bg-gray-700'}`}
                title="Formato OTT"
            >
                <img src="/ott-logo.png" alt="OTT" className="w-5 h-5 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                <span className={`text-[10px] mt-1 font-bold ${ottModeActive ? 'text-orange-400' : 'text-gray-400'}`}>OTT</span>
            </button>

            <button 
                onClick={() => handleToggle('tivimate')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${tivimateModeActive ? 'bg-blue-900/40 border border-blue-500/50' : 'bg-gray-700/50 border border-transparent hover:bg-gray-700'}`}
                title="Formato TiviMate"
            >
                <img src="/tivimate-logo.png" alt="TiviMate" className="w-5 h-5 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                <span className={`text-[10px] mt-1 font-bold ${tivimateModeActive ? 'text-blue-400' : 'text-gray-400'}`}>TiviM</span>
            </button>

            <div className="w-px h-8 bg-gray-600 mx-1"></div>

            <button 
                onClick={() => handleToggle('logo')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${transferLogoActive ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                title="Asignar Logo"
            >
                <Image size={18} />
                <span className="text-[10px] mt-1 font-bold">Logo Si</span>
            </button>

            <button 
                onClick={() => handleToggle('no-logo')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${keepLogoActive ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                title="No Asignar Logo"
            >
                <Image size={18} className="opacity-50" />
                <span className="text-[10px] mt-1 font-bold">Logo No</span>
            </button>
            
            <button 
                onClick={() => handleToggle('name')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${copyNameActive ? 'bg-yellow-500 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                title="Usar Nombre Canal"
            >
                <Type size={18} />
                <span className="text-[10px] mt-1 font-bold">Nom</span>
            </button>

            <div className="w-px h-8 bg-gray-600 mx-1"></div>

            <button 
                onClick={handleAutoAssign}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
                title="Asignación Automática"
            >
                <Zap size={18} />
                <span className="text-[10px] mt-1 font-bold">Auto</span>
            </button>
        </>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] sm:h-[calc(100vh-180px)] overflow-hidden">
            {/* Header: Load EPG Source & Tools */}
            <div className="bg-gray-800 p-2 sm:p-4 shadow-lg z-20 flex-shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center truncate">
                        <Tv className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-blue-400 flex-shrink-0" />
                        <span className="truncate">{loadedEpgSourceName || 'Asignar EPG'}</span>
                    </h2>
                    
                     <div className="flex items-center gap-2 flex-shrink-0">
                         {/* Toggle Assignment Mode */}
                        <div className="flex bg-gray-700/50 rounded-lg p-0.5 border border-gray-600/50">
                            <button
                                onClick={toggleAssignmentMode}
                                className={`px-2 py-1 rounded-md text-[10px] sm:text-xs font-bold transition-all ${
                                    assignmentMode === 'tvg-id'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                ID
                            </button>
                            <button
                                onClick={toggleAssignmentMode}
                                className={`px-2 py-1 rounded-md text-[10px] sm:text-xs font-bold transition-all ${
                                    assignmentMode === 'tvg-name'
                                        ? 'bg-purple-600 text-white shadow-sm'
                                        : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                NAME
                            </button>
                        </div>

                        {/* Settings Button */}
                        {onNavigateToSettings && (
                            <button
                                onClick={onNavigateToSettings}
                                className="p-1.5 sm:p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                                title="Ir a configuración"
                            >
                                <SettingsIcon size={16} />
                            </button>
                        )}
                        
                    </div>
                </div>

                 {/* No EPG Loaded Warning */}
                 {epgChannels.length === 0 && !isEpgLoading && (
                    <div className="mb-2 bg-blue-900/30 border border-blue-500/30 rounded-lg p-3">
                         <div className="text-xs sm:text-sm text-blue-200 mb-2 flex items-center gap-2">
                             <Zap className="h-4 w-4 text-yellow-400" />
                             <span>Carga una fuente EPG para empezar:</span>
                         </div>
                         <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {SUGGESTED_EPGS.map((epg, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setLoadedEpgSourceName(epg.name);
                                        handleFetchEpgUrl(epg.url);
                                    }}
                                    className="flex-shrink-0 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-md text-xs text-blue-100 transition-colors whitespace-nowrap"
                                >
                                    {epg.name}
                                </button>
                            ))}
                            {onNavigateToSettings && (
                                <button
                                    onClick={onNavigateToSettings}
                                    className="flex-shrink-0 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-md text-xs text-gray-300 transition-colors whitespace-nowrap flex items-center gap-1"
                                >
                                    <span>Añadir fuentes</span>
                                    <ArrowLeftCircle className="h-3 w-3 rotate-180" />
                                </button>
                            )}
                         </div>
                    </div>
                 )}

                {/* Toolbar Horizontal Scrollable */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar mask-linear-fade">
                    <ToolbarContent />
                </div>
            </div>

            {/* Main Content Split - Vertical Mobile, Horizontal Desktop */}
            <div className="flex-grow flex flex-col lg:flex-row min-h-0 bg-gray-900">
                
                {/* TOP HEADER LIST (Main Channels) */}
                <div className="flex flex-col h-[40%] lg:h-full lg:w-1/2 min-h-[180px] border-b lg:border-b-0 lg:border-r border-gray-700 bg-gray-800/50">
                    
                    {/* Filter Main List */}
                    <div className="p-2 bg-gray-800 border-b border-gray-700 flex gap-2 flex-shrink-0">
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
                         <div className="relative w-1/3 min-w-[100px]">
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
                                const hasEpg = !!channel.tvgId;

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
                                        className="px-2 py-1"
                                    >
                                        <div
                                            onClick={() => setDestinationChannelId(isTarget ? null : channel.id)}
                                            className={`
                                                flex items-center gap-2 p-2 rounded-lg cursor-pointer border h-full select-none transition-all
                                                ${isTarget 
                                                    ? 'bg-blue-600 border-blue-400 shadow-lg scale-[1.01] z-10' 
                                                    : hasEpg
                                                        ? 'bg-gray-800 border-gray-700 opacity-60'
                                                        : 'bg-red-900/10 border-red-900/30 hover:bg-red-900/20'
                                                }
                                            `}
                                        >
                                            <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${hasEpg ? 'bg-green-500' : 'bg-red-500'}`} />
                                            
                                            {/* Channel Logo */}
                                            <div className="w-8 h-8 rounded bg-black/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                {channel.tvgLogo ? (
                                                    <img src={channel.tvgLogo} alt="" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                ) : (
                                                    <Tv className="w-4 h-4 text-gray-600" />
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className={`text-xs font-bold leading-tight truncate ${isTarget ? 'text-white' : 'text-gray-300'}`}>
                                                    {channel.name}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                                    <span className="truncate max-w-[80px]">{channel.groupTitle || 'No Group'}</span>
                                                    {hasEpg && <span className="text-green-400">EPG OK</span>}
                                                </div>
                                            </div>

                                            {isTarget && (
                                                <div className="bg-white text-blue-600 p-1 rounded-full animate-pulse shadow-sm">
                                                    <ArrowLeftCircle size={16} className="-rotate-90 lg:rotate-0" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* BOTTOM/RIGHT LIST (EPG Sources) */}
                <div className="flex flex-col h-[60%] lg:h-full lg:w-1/2 min-h-[220px] bg-gray-800">
                    
                    {/* EPG Tools Header */}
                     <div className="p-2 bg-gray-800 border-b border-gray-700 flex flex-col gap-2 flex-shrink-0 shadow-sm z-10">
                        {/* Smart Search EPG */}
                        <SmartSearchInput
                            searchTerm={epgSearchTerm}
                            onSearchChange={setEpgSearchTerm}
                            placeholder={destinationChannelId 
                                ? `Buscar EPG para: ${filteredMainChannelsForEpg.find(c => c.id === destinationChannelId)?.name}...` 
                                : "Buscar en guía EPG..."}
                            isSmartSearchEnabled={isSmartSearchEnabled}
                            onToggleSmartSearch={toggleSmartSearch}
                            className="w-full"
                        />
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
                                    
                                    // Calculate match score if target is selected
                                    let matchScore = undefined;
                                    let matchType = undefined;
                                    
                                    if (destinationChannelId && smartSearch) {
                                        const targetChannel = channels.find(c => c.id === destinationChannelId);
                                        if (targetChannel) {
                                            const score = getEpgSimilarityScore(targetChannel.name, epg.name);
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
                                            className="px-2 py-1"
                                        >
                                            <SearchResultItem
                                                name={epg.name || epg.id} // Valor por defecto para evitar nombre vacío
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
                                                <div className="flex items-center gap-3">
                                                    {/* EPG Logo Listing */}
                                                    <div className="w-8 h-8 rounded bg-white/5 p-0.5 flex-shrink-0">
                                                        {epg.logo ? (
                                                            <img src={epg.logo} className="w-full h-full object-contain rounded-sm" loading="lazy" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 font-bold bg-black/20 rounded-sm">
                                                                EPG
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                     <div className="flex flex-col min-w-0">
                                                        <div className="text-[10px] text-gray-400 truncate font-mono">{epg.id}</div>
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
