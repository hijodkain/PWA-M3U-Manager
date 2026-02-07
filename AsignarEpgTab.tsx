import React, { useState, useMemo, useRef } from 'react';
import { Upload, Download, Copy, Zap, ArrowLeftCircle, ChevronsUpDown, Settings as SettingsIcon, X } from 'lucide-react';
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
        // Nuevas funciones de búsqueda inteligente
        epgSearchTerm,
        setEpgSearchTerm,
        isSmartSearchEnabled,
        toggleSmartSearch,
        getEpgSimilarityScore,
        smartSearch,
        // Nuevas funciones para modo de asignación y selección
        assignmentMode,
        toggleAssignmentMode,
        selectedEpgChannels,
        toggleEpgChannelSelection,
        toggleSelectAllEpgChannels,
        addSelectedEpgChannels,
        // Nuevas funciones para asignar nombre y asignación automática
        assignChannelName,
        autoAssignEpgToVisibleGroup,
        // Función para limpiar fuente EPG
        clearEpgChannels,
    } = epgHook;
    
    // Extraer funciones para evitar problemas de dependencias
    const { searchChannels: epgSearchChannels, normalizeChannelName: epgNormalizeChannelName } = smartSearch;

    const { channels } = channelsHook;
    const { savedEpgUrls } = settingsHook;
    const [mainListSearch, setMainListSearch] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [isGeneratorVisible, setIsGeneratorVisible] = useState(false);
    
    // Estados para modo sencillo - controlar fuente EPG cargada
    const [loadedEpgSourceName, setLoadedEpgSourceName] = useState<string | null>(null);
    
    // Estados para los botones toggle
    const [ottModeActive, setOttModeActive] = useState(false);
    const [tivimateModeActive, setTivimateModeActive] = useState(false);
    const [transferLogoActive, setTransferLogoActive] = useState(false);
    const [keepLogoActive, setKeepLogoActive] = useState(false);

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
                // Usar búsqueda inteligente
                const searchResults = epgSearchChannels(channelsToFilter, mainListSearch, 0.4);
                return searchResults.map(result => result.item);
            } else {
                // Búsqueda tradicional exacta
                channelsToFilter = channelsToFilter.filter(c => c.name.toLowerCase().includes(mainListSearch.toLowerCase()));
            }
        }
        return channelsToFilter;
    }, [channels, mainListSearch, selectedGroup, isSmartSearchEnabled, epgSearchChannels]);

    const mainListParentRef = useRef<HTMLDivElement>(null);
    const epgListParentRef = useRef<HTMLDivElement>(null);

    const mainListRowVirtualizer = useVirtualizer({
        count: filteredMainChannelsForEpg.length,
        getScrollElement: () => mainListParentRef.current,
        estimateSize: () => 68,
        overscan: 10,
    });

    const epgListRowVirtualizer = useVirtualizer({
        count: filteredEpgChannels.length,
        getScrollElement: () => epgListParentRef.current,
        estimateSize: () => 68,
        overscan: 10,
    });

    const mainListVirtualItems = mainListRowVirtualizer.getVirtualItems();
    const epgListVirtualItems = epgListRowVirtualizer.getVirtualItems();

    const handleMainChannelClick = (channel: Channel) => {
        setDestinationChannelId(channel.id);
        setEpgSearchTerm(epgNormalizeChannelName(channel.name));
    };

    // Manejadores para los botones toggle
    const handleOttModeClick = () => {
        const newState = !ottModeActive;
        setOttModeActive(newState);
        
        // Actualizar attributesToCopy con tvgName
        setAttributesToCopy(prev => {
            const newSet = new Set(prev);
            if (newState) {
                newSet.add('tvgName');
            } else {
                newSet.delete('tvgName');
            }
            return newSet;
        });
    };

    const handleTivimateModeClick = () => {
        const newState = !tivimateModeActive;
        setTivimateModeActive(newState);
        
        // Actualizar attributesToCopy con tvgId
        setAttributesToCopy(prev => {
            const newSet = new Set(prev);
            if (newState) {
                newSet.add('tvgId');
            } else {
                newSet.delete('tvgId');
            }
            return newSet;
        });
    };

    const handleTransferLogoClick = () => {
        const newState = !transferLogoActive;
        setTransferLogoActive(newState);
        setKeepLogoActive(false);
        
        // Actualizar attributesToCopy añadiendo o quitando tvgLogo
        setAttributesToCopy(prev => {
            const newSet = new Set(prev);
            if (newState) {
                newSet.add('tvgLogo');
            } else {
                newSet.delete('tvgLogo');
            }
            return newSet;
        });
    };

    const handleKeepLogoClick = () => {
        const newState = !keepLogoActive;
        setKeepLogoActive(newState);
        setTransferLogoActive(false);
        
        // Cuando está activo "Mantener Logo", removemos tvgLogo de attributesToCopy
        setAttributesToCopy(prev => {
            const newSet = new Set(prev);
            newSet.delete('tvgLogo');
            return newSet;
        });
    };

    // Función para manejar selección de fuente EPG en modo sencillo (carga automática)
    const handleEpgSourceSelect = async (selectedUrl: string, selectedName: string) => {
        if (!selectedUrl) return;
        
        // Cargar automáticamente la fuente pasando la URL directamente
        try {
            await handleFetchEpgUrl(selectedUrl);
            setLoadedEpgSourceName(selectedName);
        } catch (error) {
            console.error('Error al cargar fuente EPG:', error);
        }
    };

    // Función para limpiar la fuente EPG cargada
    const clearLoadedEpgSource = () => {
        setLoadedEpgSourceName(null);
        clearEpgChannels();
    };

    // Renderizado común (3 columnas) con variaciones según modo
    return (
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4">
            <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col">
                <h3 className="font-bold text-lg mb-2">Lista Principal</h3>
                <div className="flex gap-2 mb-2">
                    <input
                        type="text"
                        placeholder="Buscar canal..."
                        value={mainListSearch}
                        onChange={(e) => setMainListSearch(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 w-full"
                    />
                    <select
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500"
                    >
                        {channelGroups.map(group => (
                            <option key={group} value={group}>{group === 'all' ? 'Todos los Grupos' : group}</option>
                        ))}
                    </select>
                </div>
                <div ref={mainListParentRef} className="overflow-auto max-h-[70vh] pr-2">
                    <div style={{ height: `${mainListRowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {mainListVirtualItems.map((virtualItem) => {
                            const ch = filteredMainChannelsForEpg[virtualItem.index];
                            if (!ch) return null;
                            return (
                                <ReparacionChannelItem
                                    key={ch.id}
                                    channel={ch}
                                    onBodyClick={() => handleMainChannelClick(ch)}
                                    isSelected={destinationChannelId === ch.id}
                                    hasEpg={epgIdSet.has(ch.tvgId)}
                                    showCheckbox={false}
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
            <div className="lg:col-span-1 flex flex-col items-center justify-start gap-3 bg-gray-800 p-4 rounded-lg">
                <h4 className="font-bold text-center mb-1">Preparar para:</h4>
                
                {/* Botones de modo: OTT y TiviMate */}
                <div className="w-full space-y-2">
                    <button
                        onClick={handleOttModeClick}
                        className={`w-full p-2 rounded-md border-2 transition-all overflow-hidden ${
                            ottModeActive 
                                ? 'border-purple-500 bg-purple-900/30' 
                                : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'
                        }`}
                        title="Modo OTT: Asigna channel ID a tvg-id y tvg-name"
                    >
                        <div className="flex items-center justify-center w-full h-full">
                            <img 
                                src="/ott-logo.webp" 
                                alt="OTT" 
                                className="w-full h-auto object-contain"
                            />
                        </div>
                    </button>
                    
                    <button
                        onClick={handleTivimateModeClick}
                        className={`w-full p-2 rounded-md border-2 transition-all overflow-hidden ${
                            tivimateModeActive 
                                ? 'border-blue-500 bg-blue-900/30' 
                                : 'border-gray-600 hover:border-gray-500 bg-gray-700/30'
                        }`}
                        title="Modo TiviMate: Asigna channel ID solo a tvg-id"
                    >
                        <div className="flex items-center justify-center w-full h-full">
                            <img 
                                src="/tivimate-logo.webp" 
                                alt="TiviMate" 
                                className="w-full h-auto object-contain"
                            />
                        </div>
                    </button>
                </div>
                
                <div className="w-full border-t border-gray-700 my-1"></div>
                
                {/* Pregunta sobre logo */}
                <p className="text-xs text-center text-gray-300 mb-2">
                    ¿Extraer el logo del EPG y asignarlo a mi canal?
                </p>
                
                {/* Botones de logo */}
                <div className="w-full space-y-2">
                    <button
                        onClick={handleTransferLogoClick}
                        className={`w-full text-xs py-2 px-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
                            transferLogoActive 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }`}
                    >
                        <Copy size={14} /> Si
                    </button>
                    
                    <button
                        onClick={handleKeepLogoClick}
                        className={`w-full text-xs py-2 px-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
                            keepLogoActive 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }`}
                    >
                        <ArrowLeftCircle size={14} /> NO
                    </button>
                </div>
                
                {/* Botón "Arreglar nombre del canal" - AMBOS MODOS */}
                <div className="w-full border-t border-gray-700 my-2"></div>
                <button
                    onClick={() => {
                        const selectedEpgChannel = epgChannels.find(ch => selectedEpgChannels.has(ch.id));
                        if (selectedEpgChannel && destinationChannelId) {
                            assignChannelName(selectedEpgChannel);
                        }
                    }}
                    disabled={!destinationChannelId || selectedEpgChannels.size !== 1}
                    className={`w-full text-xs py-2 px-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
                        destinationChannelId && selectedEpgChannels.size === 1
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Asigna el nombre del canal EPG seleccionado al nombre del canal principal"
                >
                    Arreglar nombre del canal
                </button>
                
                {/* Botón de asignación automática por grupo - AMBOS MODOS */}
                <button
                    onClick={() => autoAssignEpgToVisibleGroup(filteredMainChannelsForEpg)}
                    disabled={filteredMainChannelsForEpg.length === 0 || epgChannels.length === 0}
                    className="w-full text-xs py-2 px-2 rounded-md flex items-center justify-center gap-2 transition-colors bg-yellow-600 hover:bg-yellow-700 text-white disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed mt-2"
                    title="Busca coincidencias exactas y asigna EPG automáticamente a canales sin EPG en el grupo visible"
                >
                    <Zap size={14} /> Asignar EPG al grupo
                </button>
            </div>
            <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-lg">Fuente EPG</h3>
                        {loadedEpgSourceName && (
                            <div className="flex items-center gap-2 bg-green-900/30 border border-green-600 rounded-md px-3 py-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-green-400 font-semibold text-sm">{loadedEpgSourceName}</span>
                                <button
                                    onClick={clearLoadedEpgSource}
                                    className="text-red-400 hover:text-red-300 transition-colors ml-1"
                                    title="Limpiar fuente EPG"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                    {!loadedEpgSourceName && (
                        <button
                            onClick={() => onNavigateToSettings?.()}
                            className="text-xs text-blue-400 hover:text-blue-300 underline"
                        >
                            Añadir fuentes →
                        </button>
                    )}
                </div>
                
                {/* Input de URL de fuente EPG - Solo visible si NO hay fuente cargada */}
                {!loadedEpgSourceName && (
                    isSencillo ? (
                        // MODO SENCILLO: Solo selector
                        <div className="space-y-2 mb-4">
                            {savedEpgUrls.length > 0 ? (
                                <select
                                    id="saved-epg-urls-select-simple"
                                    value=""
                                    onChange={(e) => {
                                        const selectedOption = savedEpgUrls.find(item => item.url === e.target.value);
                                        if (selectedOption) {
                                            handleEpgSourceSelect(selectedOption.url, selectedOption.name);
                                        }
                                    }}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-3 text-white focus:ring-blue-500 focus:border-blue-500 text-sm"
                                >
                                    <option value="">Selecciona una fuente EPG...</option>
                                    {savedEpgUrls.map(item => (
                                        <option key={item.id} value={item.url}>{item.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-center text-gray-400 py-4">
                                    <p className="text-sm">No hay fuentes EPG guardadas</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        // MODO PRO: UI completa con todas las opciones
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2">
                                <input
                                    id="epg-file-upload"
                                    type="file"
                                    className="hidden"
                                    onChange={handleEpgFileUpload}
                                    accept=".xml,.xml.gz"
                                />
                                <label
                                    htmlFor="epg-file-upload"
                                    className="cursor-pointer text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center"
                                >
                                    <Upload size={16} className="mr-2" /> Subir XMLTV
                                </label>
                                <div className="flex-grow flex">
                                    <input
                                        type="text"
                                        value={epgUrl}
                                        onChange={(e) => setEpgUrl(e.target.value)}
                                        placeholder="Pega la URL del archivo .xml"
                                        className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <button
                                        onClick={() => handleFetchEpgUrl()}
                                        disabled={!epgUrl || isEpgLoading}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-r-md flex items-center text-sm disabled:bg-gray-600 disabled:cursor-not-allowed"
                                    >
                                        <Download size={16} />
                                    </button>
                                </div>
                            </div>
                            {savedEpgUrls.length > 0 && (
                                <select
                                    id="saved-epg-urls-select"
                                    value=""
                                    onChange={(e) => {
                                        const selectedOption = savedEpgUrls.find(item => item.url === e.target.value);
                                        if (selectedOption && e.target.value) {
                                            handleEpgSourceSelect(selectedOption.url, selectedOption.name);
                                        }
                                    }}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500 text-sm"
                                >
                                    <option value="">o selecciona una fuente guardada...</option>
                                    {savedEpgUrls.map(item => (
                                        <option key={item.id} value={item.url}>{item.name}</option>
                                    ))}
                                </select>
                            )}
                            <div className="border-t border-gray-700 pt-2">
                            <button 
                                onClick={() => setIsGeneratorVisible(!isGeneratorVisible)}
                                className="w-full text-sm text-left text-gray-300 hover:text-white flex items-center"
                            >
                                <ChevronsUpDown size={16} className="mr-2" />
                                Generar EPG desde URLs
                            </button>
                            {isGeneratorVisible && (
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                                    <input
                                        type="text"
                                        value={epgIdListUrl}
                                        onChange={(e) => setEpgIdListUrl(e.target.value)}
                                        placeholder="URL de lista de IDs (.txt)"
                                        className="md:col-span-1 w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <input
                                        type="text"
                                        value={epgLogoFolderUrl}
                                        onChange={(e) => setEpgLogoFolderUrl(e.target.value)}
                                        placeholder="URL de carpeta de logos"
                                        className="md:col-span-1 w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <button
                                        onClick={handleGenerateEpgFromUrls}
                                        className="md:col-span-1 w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center text-sm"
                                    >
                                        <Zap size={16} className="mr-2" /> Generar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
                )}
                {isEpgLoading && <p className="text-center text-blue-400 mb-2">Cargando...</p>}
                {epgError && <p className="text-center text-red-400 bg-red-900/50 p-2 rounded mb-2">{epgError}</p>}
                
                {/* Buscador con enlace a ajustes en modo sencillo */}
                {isSencillo ? (
                    <div className="mb-2">
                        <div className="flex items-center gap-2">
                            <div className="flex-grow">
                                <SmartSearchInput
                                    searchTerm={epgSearchTerm}
                                    onSearchChange={setEpgSearchTerm}
                                    isSmartSearchEnabled={isSmartSearchEnabled}
                                    onToggleSmartSearch={toggleSmartSearch}
                                    placeholder="Buscar en la fuente EPG..."
                                    showResults={true}
                                    resultCount={filteredEpgChannels.length}
                                />
                            </div>
                            <button
                                onClick={() => {
                                    if (onNavigateToSettings) {
                                        onNavigateToSettings();
                                        setTimeout(() => {
                                            const element = document.getElementById('smart-search-settings');
                                            if (element) {
                                                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }
                                        }, 100);
                                    }
                                }}
                                className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 whitespace-nowrap"
                                title="Ir a Ajustes de la búsqueda inteligente"
                            >
                                <SettingsIcon size={16} />
                                Ajustes
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <SmartSearchInput
                            searchTerm={epgSearchTerm}
                            onSearchChange={setEpgSearchTerm}
                            isSmartSearchEnabled={isSmartSearchEnabled}
                            onToggleSmartSearch={toggleSmartSearch}
                            placeholder="Buscar en la fuente EPG..."
                            showResults={true}
                            resultCount={filteredEpgChannels.length}
                            className="mb-2"
                        />
                        
                        {/* Controles - SOLO MODO PRO */}
                        {/* Botón para arreglar nombre del canal */}
                        <div className="mb-2">
                            <button
                                onClick={() => {
                                    const selectedEpgChannel = epgChannels.find(ch => selectedEpgChannels.has(ch.id));
                                    if (selectedEpgChannel && destinationChannelId) {
                                        assignChannelName(selectedEpgChannel);
                                    }
                                }}
                                disabled={!destinationChannelId || selectedEpgChannels.size !== 1}
                                className={`w-full text-sm py-2 px-3 rounded-md transition-colors ${
                                    destinationChannelId && selectedEpgChannels.size === 1
                                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                                title="Asigna el nombre del canal EPG seleccionado al nombre del canal principal"
                            >
                                Arreglar nombre del canal
                            </button>
                        </div>

                        {/* Botón de añadir seleccionados */}
                        <div className="mb-2">
                            <button
                                onClick={addSelectedEpgChannels}
                                disabled={selectedEpgChannels.size === 0}
                                className={`w-full text-sm py-2 px-3 rounded-md transition-colors ${
                                    selectedEpgChannels.size > 0
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                Añadir {selectedEpgChannels.size > 0 ? `(${selectedEpgChannels.size})` : 'Seleccionados'}
                            </button>
                        </div>

                        {/* Checkbox para seleccionar todos - SOLO MODO PRO */}
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                id="select-all-epg"
                                checked={filteredEpgChannels.length > 0 && filteredEpgChannels.every(ch => selectedEpgChannels.has(ch.id))}
                                onChange={toggleSelectAllEpgChannels}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="select-all-epg" className="text-sm text-gray-300 cursor-pointer">
                                Seleccionar todos ({filteredEpgChannels.length} canales)
                            </label>
                        </div>
                    </>
                )}
                
                {/* Lista de canales EPG */}
                <div ref={epgListParentRef} className="overflow-auto max-h-[40vh] pr-2 mt-2">
                    <div style={{ height: `${epgListRowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {epgListVirtualItems.map((virtualItem) => {
                            const ch = filteredEpgChannels[virtualItem.index];
                            if (!ch) return null;
                            return (
                                <EpgChannelItem
                                    key={ch.id}
                                    epgChannel={ch}
                                    onClick={() => handleEpgSourceClick(ch)}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                    isSelected={selectedEpgChannels.has(ch.id)}
                                    showCheckbox={!isSencillo}
                                    onCheckboxChange={toggleEpgChannelSelection}
                                    assignmentMode={assignmentMode}
                                    score={getEpgSimilarityScore(ch.id)}
                                    matchType={epgSearchTerm && ch.name.toLowerCase().includes(epgSearchTerm.toLowerCase()) ? 'exact' : 'fuzzy'}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AsignarEpgTab;