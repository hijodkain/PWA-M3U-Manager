import React, { useRef } from 'react';
import { Upload, Copy, CheckSquare, ArrowLeftCircle, RotateCcw, Trash2, Link, Check } from 'lucide-react';
import { useReparacion } from './useReparacion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChannels } from './useChannels';
import ReparacionChannelItem from './ReparacionChannelItem';
import { useSettings } from './useSettings';
import { useAppMode } from './AppModeContext';
import { AttributeKey } from './index';
import { SmartSearchInput } from './SmartSearchInput';

interface ReparacionTabProps {
    reparacionHook: ReturnType<typeof useReparacion>;
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
}

const ReparacionTab: React.FC<ReparacionTabProps> = ({ reparacionHook, channelsHook, settingsHook }) => {
    const { isSencillo } = useAppMode();
    const {
        selectedReparacionChannels,
        attributesToCopy,
        destinationChannelId,
        setDestinationChannelId,
        mainListFilter,
        setMainListFilter,
        reparacionListFilter,
        setReparacionListFilter,
        handleReparacionFileUpload,
        processCurationM3U,
        toggleAttributeToCopy,
        handleSourceChannelClick,
        mainListUniqueGroups,
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
        verificationInfo,
        verificationProgress,
        cancelVerification,
        verifyChannel,
        clearFailedChannelsUrls,
        failedChannelsByGroup,
        reparacionUrl,
        setReparacionUrl,
        handleReparacionUrlLoad,
        isCurationLoading,
        curationError,
        verifyAllChannelsInGroup,
        // Nuevas funciones de búsqueda inteligente
        smartSearchResults,
        isSmartSearchEnabled,
        toggleSmartSearch,
        getChannelSimilarityScore,
        smartSearch,
        showOnlyUnverified,
        toggleShowOnlyUnverified,
    } = reparacionHook;
    
    // Extraer funciones para evitar problemas de dependencias
    const { normalizeChannelName } = smartSearch;

    const { undo, history } = channelsHook;

    const mainListParentRef = useRef<HTMLDivElement>(null);
    const reparacionListParentRef = useRef<HTMLDivElement>(null);

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
    const reparacionListVirtualItems = reparacionListRowVirtualizer.getVirtualItems();

    const attributeLabels: { key: AttributeKey; label: string }[] = [
        { key: 'url', label: 'Stream' },
        { key: 'tvgLogo', label: 'Logo' },
        { key: 'name', label: 'Nombre' },
        { key: 'groupTitle', label: 'Grupo' },
        { key: 'tvgId', label: 'tvg-id' },
        { key: 'tvgName', label: 'tvg-name' },
    ];

    const isAllInGroupSelected = filteredReparacionChannels.length > 0 && filteredReparacionChannels.every(c => selectedReparacionChannels.has(c.id));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4">
            <div className="lg:col-span-4 bg-gray-800 p-4 rounded-lg flex flex-col">
                <h3 className="font-bold text-lg mb-2">Lista Principal</h3>
                <SmartSearchInput
                    searchTerm={mainListSearch}
                    onSearchChange={setMainListSearch}
                    isSmartSearchEnabled={isSmartSearchEnabled}
                    onToggleSmartSearch={toggleSmartSearch}
                    placeholder="Buscar canal en lista principal..."
                    showResults={true}
                    resultCount={filteredMainChannels.length}
                    className="mb-2"
                />
                
                {/* Botón filtro de no verificados */}
                <div className="flex items-center gap-2 mb-2 bg-gray-700 p-2 rounded-md">
                    <button
                        onClick={toggleShowOnlyUnverified}
                        className={`flex items-center gap-2 transition-colors ${
                            showOnlyUnverified 
                                ? 'text-yellow-400' 
                                : 'text-gray-400'
                        }`}
                        title={showOnlyUnverified ? 'Mostrando solo canales no verificados' : 'Mostrando todos los canales'}
                    >
                        {showOnlyUnverified ? (
                            <Check size={18} className="text-yellow-400" />
                        ) : (
                            <Check size={18} className="text-gray-400" />
                        )}
                        <span className="text-xs font-medium">
                            {showOnlyUnverified ? 'Solo no verificados' : 'Mostrar no verificados'}
                        </span>
                    </button>
                </div>
                
                <select
                    value={mainListFilter}
                    onChange={(e) => setMainListFilter(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 mb-2"
                >
                    {mainListUniqueGroups.map((g) => {
                        const failedCount = failedChannelsByGroup[g] || 0;
                        return (
                            <option key={g} value={g} className={failedCount > 0 ? 'text-yellow-400' : ''}>
                                {g} {failedCount > 0 ? `(${failedCount})` : ''}
                            </option>
                        );
                    })}
                </select>
                <button
                    onClick={verifyAllChannelsInGroup}
                    className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 mb-2"
                >
                    <Check size={14} /> Verificar Canales del Grupo
                </button>
                <button
                    onClick={clearFailedChannelsUrls}
                    className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-red-600 hover:bg-red-700 disabled:bg-gray-600 mb-2"
                >
                    <Trash2 size={14} /> Eliminar URLs de Canales Fallidos
                </button>
                <div ref={mainListParentRef} className="overflow-auto max-h-[60vh] pr-2">
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
                                        setDestinationChannelId(ch.id)
                                        setReparacionListSearch(normalizeChannelName(ch.name));
                                    }}
                                    isSelected={destinationChannelId === ch.id}
                                    showCheckbox={false}
                                    verificationStatus={channelInfo.status}
                                    quality={channelInfo.quality}
                                    resolution={channelInfo.resolution}
                                    onVerifyClick={() => verifyChannel(ch.id, ch.url)}
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
            <div className="lg:col-span-1 flex flex-col items-center justify-start gap-2 bg-gray-800 p-4 rounded-lg">
                <div className="flex-grow">
                    <h4 className="font-bold text-center mb-2">Partes del canal a reparar</h4>
                    <ArrowLeftCircle size={32} className="text-blue-400 mb-4 mx-auto" />
                    {attributeLabels
                        .filter(({ key }) => isSencillo ? (key !== 'tvgId' && key !== 'tvgName') : true)
                        .map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => toggleAttributeToCopy(key)}
                            className={`w-full text-xs py-2 px-1 mb-2 rounded-md flex items-center justify-center gap-1 transition-colors ${attributesToCopy.has(key) ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                            {attributesToCopy.has(key) ? <CheckSquare size={14} /> : <Copy size={14} />} {label}
                        </button>
                    ))}
                </div>
                <div className="w-full border-t border-gray-700 my-2"></div>
                <div className="w-full">
                    <h4 className="font-bold text-center mb-2">Añadir a Lista</h4>
                    <button
                        onClick={handleAddSelectedFromReparacion}
                        disabled={selectedReparacionChannels.size === 0}
                        className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-green-600 hover:bg-green-700 disabled:bg-gray-600"
                    >
                        <ArrowLeftCircle size={14} /> Añadir Canal
                    </button>
                </div>
                <div className="mt-auto w-full pt-4">
                    <button
                        onClick={undo}
                        disabled={history.length === 0}
                        className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600"
                    >
                        <RotateCcw size={14} /> Deshacer
                    </button>
                </div>
            </div>
            <div className="lg:col-span-6 bg-gray-800 p-4 rounded-lg flex flex-col">
                <h3 className="font-bold text-lg mb-3">Selecciona la lista de la que vas a extraer la medicina</h3>
                <div className="flex gap-2 mb-2">
                    <input
                        type="text"
                        placeholder="Pega aquí la URL de la lista"
                        value={reparacionUrl}
                        onChange={(e) => setReparacionUrl(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 flex-grow"
                    />
                    <button onClick={handleReparacionUrlLoad} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md font-semibold whitespace-nowrap">
                        Cargar
                    </button>
                    <label
                        htmlFor="reparacion-file-upload"
                        className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-4 rounded-md flex items-center gap-2 whitespace-nowrap"
                    >
                        <Upload size={16} /> Subir Archivo
                    </label>
                    <input
                        id="reparacion-file-upload"
                        type="file"
                        className="hidden"
                        onChange={handleReparacionFileUpload}
                        accept=".m3u,.m3u8"
                    />
                </div>
                
                {isCurationLoading && <p className="text-center text-blue-400 mt-2">Cargando lista de recambios...</p>}
                {curationError && <p className="text-center text-red-400 bg-red-900/50 p-2 rounded mt-2">{curationError}</p>}
                
                <p className="text-sm text-gray-300 mt-3 mb-1 font-medium">Selecciona el grupo en el que está el canal</p>
                <select
                    value={reparacionListFilter}
                    onChange={(e) => setReparacionListFilter(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 mb-2"
                >
                    {reparacionListUniqueGroups.map((g) => (
                        <option key={g} value={g}>
                            {g}
                        </option>
                    ))}
                </select>
                <div className="flex items-center gap-2 mb-2">
                    <input
                        type="checkbox"
                        id="select-all-group"
                        checked={isAllInGroupSelected}
                        onChange={toggleSelectAllReparacionGroup}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="select-all-group" className="text-sm text-gray-300">Seleccionar todo el grupo</label>
                </div>
                
                {/* Indicador de progreso de verificación */}
                {verificationProgress.isRunning && (
                    <div className="mb-2 p-3 bg-gray-700 rounded-md">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-gray-300">
                                Verificando: {verificationProgress.completed} / {verificationProgress.total}
                            </span>
                            <button
                                onClick={cancelVerification}
                                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded"
                            >
                                Cancelar
                            </button>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-2">
                            <div
                                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(verificationProgress.completed / verificationProgress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
                
                <button
                    onClick={() => verifySelectedReparacionChannels()}
                    disabled={selectedReparacionChannels.size === 0 || verificationProgress.isRunning}
                    className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 mb-2"
                >
                    <Check size={14} /> Verificar Seleccionados
                </button>
                
                <p className="text-sm text-gray-300 mb-2 font-medium">Selecciona el canal con el que quieres curar</p>
                <div ref={reparacionListParentRef} className="overflow-auto max-h-[60vh] pr-2">
                    <div style={{ height: `${reparacionListRowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {reparacionListVirtualItems.map((virtualItem) => {
                            const ch = filteredReparacionChannels[virtualItem.index];
                            if (!ch) return null;
                            const channelInfo = verificationInfo[ch.id] || { status: 'pending', quality: 'unknown' };
                            return (
                                <ReparacionChannelItem
                                    key={ch.id}
                                    channel={ch}
                                    onBodyClick={() => handleSourceChannelClick(ch)}
                                    onSelectClick={(e) => toggleReparacionSelection(ch.id, virtualItem.index, e.shiftKey, e.metaKey, e.ctrlKey)}
                                    isSelected={false}
                                    isChecked={selectedReparacionChannels.has(ch.id)}
                                    showCheckbox={true}
                                    verificationStatus={channelInfo.status}
                                    quality={channelInfo.quality}
                                    resolution={channelInfo.resolution}
                                    onVerifyClick={() => verifyChannel(ch.id, ch.url)}
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
        </div>
    );
};

export default ReparacionTab;