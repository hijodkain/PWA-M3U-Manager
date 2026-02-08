import React, { useState, useMemo, useRef } from 'react';
import { Upload, Download, Copy, Zap, ArrowLeftCircle, ChevronsUpDown, Settings as SettingsIcon, X, Tv, Image, Type, List } from 'lucide-react';
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
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${ottModeActive ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                title="Formato OTT"
            >
                <Tv size={18} />
                <span className="text-[10px] mt-1 font-bold">OTT</span>
            </button>

            <button 
                onClick={() => handleToggle('tivimate')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${tivimateModeActive ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                title="Formato TiviMate"
            >
                <List size={18} />
                <span className="text-[10px] mt-1 font-bold">TiviM</span>
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
        <div className="h-[calc(100vh-140px)] flex flex-col">
            
            {/* --- MOBILE SUBMENU (TOOLBAR) --- */}
            <div className="lg:hidden bg-gray-800 border-b border-gray-700 p-2 overflow-x-auto no-scrollbar flex items-center gap-2 sticky top-[50px] z-40 shrink-0 shadow-lg">
                <ToolbarContent />
            </div>

            {/* --- MAIN GRID --- */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] gap-4 lg:gap-2 h-full min-h-0 pt-2 lg:pt-0">
                
                {/* --- LEFT PANEL: MAIN LIST --- */}
                <div className="bg-gray-800 p-3 rounded-lg flex flex-col h-full min-h-0 border border-gray-700">
                    <h3 className="font-bold text-white mb-2 flex items-center justify-between">
                        <span>Canales ({filteredMainChannelsForEpg.length})</span>
                    </h3>
                    
                    {/* Filters */}
                    <div className="space-y-2 mb-2">
                         <div className="flex gap-2">
                             <select
                                value={selectedGroup}
                                onChange={(e) => setSelectedGroup(e.target.value)}
                                className="flex-1 bg-gray-700 border border-gray-600 rounded text-xs px-2 py-1.5 text-white"
                            >
                                <option value="all">Todos los grupos</option>
                                {channelGroups.slice(1).map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                         </div>
                        <SmartSearchInput
                            searchTerm={mainListSearch}
                            onSearchChange={setMainListSearch}
                            isSmartSearchEnabled={isSmartSearchEnabled}
                            onToggleSmartSearch={toggleSmartSearch}
                            placeholder="Buscar canal..."
                            showResults={false}
                        />
                    </div>

                    {/* List */}
                    <div ref={mainListParentRef} className="flex-1 overflow-auto pr-1">
                         <div style={{ height: `${mainListRowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                            {mainListRowVirtualizer.getVirtualItems().map((virtualItem) => {
                                const ch = filteredMainChannelsForEpg[virtualItem.index];
                                return (
                                    <ReparacionChannelItem
                                        key={ch.id}
                                        channel={ch}
                                        isSelected={destinationChannelId === ch.id}
                                        onBodyClick={() => {
                                            setDestinationChannelId(ch.id);
                                            // Auto-search in EPG right list if Smart Search is on?
                                            if (isSmartSearchEnabled) {
                                               setEpgSearchTerm(epgNormalizeChannelName(ch.name));
                                            }
                                        }}
                                        isSencillo={isSencillo}
                                        showCheckbox={false}
                                        hasEpg={!!ch.tvgId}
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

                {/* --- CENTER PANEL: CONTROLS (DESKTOP ONLY) --- */}
                <div className="hidden lg:flex flex-col items-center justify-start py-8 gap-4 bg-gray-800 rounded-lg border border-gray-700">
                     <ToolbarContent />
                </div>

                {/* --- RIGHT PANEL: EPG SOURCE --- */}
                <div className="bg-gray-800 p-3 rounded-lg flex flex-col h-full min-h-0 border border-gray-700">
                     <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-white">Fuente EPG</h3>
                        <div className="flex gap-1">
                             {epgChannels.length > 0 && (
                                <button onClick={clearEpgChannels} className="text-red-400 hover:text-red-300 p-1" title="Limpiar EPG">
                                    <X size={16} />
                                </button>
                             )}
                             <button onClick={onNavigateToSettings} className="text-gray-400 hover:text-white p-1" title="Ajustes">
                                <SettingsIcon size={16} />
                             </button>
                        </div>
                    </div>

                    {/* Source Selector / Loader */}
                    {epgChannels.length === 0 ? (
                        <div className="bg-gray-700/30 p-4 rounded text-center mb-4">
                            <p className="text-xs text-gray-400 mb-2">Selecciona una fuente EPG guardada</p>
                            {savedEpgUrls.length > 0 ? (
                                <div className="space-y-1">
                                    {savedEpgUrls.map(epg => (
                                        <button
                                            key={epg.url}
                                            onClick={() => {
                                                setEpgUrl(epg.url);
                                                handleFetchEpgUrl();
                                                setLoadedEpgSourceName(epg.name);
                                            }}
                                            className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white truncate"
                                        >
                                            {epg.name}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <button onClick={onNavigateToSettings} className="text-blue-400 text-xs underline">
                                    Ir a Configuración para añadir fuentes
                                </button>
                            )}
                            
                            <div className="my-3 border-t border-gray-600"></div>
                            
                            <label className="cursor-pointer bg-gray-600 hover:bg-gray-500 text-white text-xs py-2 px-3 rounded block">
                                Subir archivo .xml
                                <input type="file" className="hidden" onChange={handleEpgFileUpload} accept=".xml" />
                            </label>
                        </div>
                    ) : (
                        <>
                             {/* EPG Filter */}
                             <div className="mb-2">
                                <input
                                    type="text"
                                    value={epgSearchTerm}
                                    onChange={(e) => setEpgSearchTerm(e.target.value)}
                                    placeholder="Buscar en EPG..."
                                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500"
                                />
                             </div>

                             {/* EPG List */}
                             <div ref={epgListParentRef} className="flex-1 overflow-auto pr-1">
                                <div style={{ height: `${epgListRowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                                    {isEpgLoading ? (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                            Cargando...
                                        </div>
                                    ) : (
                                        epgListRowVirtualizer.getVirtualItems().map((virtualItem) => {
                                            const epgCh = filteredEpgChannels[virtualItem.index];
                                            const isSelected = selectedEpgChannels.has(epgCh.id);
                                            return (
                                                <div
                                                    key={epgCh.id}
                                                    style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100%',
                                                        transform: `translateY(${virtualItem.start}px)`,
                                                    }}
                                                    onClick={() => handleEpgSourceClick(epgCh)}
                                                >
                                                    <EpgChannelItem
                                                        channel={epgCh}
                                                        assignedChannelsCount={0} 
                                                        isSelected={isSelected}
                                                        onSelectClick={() => {}}
                                                    />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                             </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AsignarEpgTab;
