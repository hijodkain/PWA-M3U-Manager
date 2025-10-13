import React, { useRef } from 'react';
import { useObviarPrefijosSufijos } from './useObviarPrefijosSufijos';
import { Upload, Copy, CheckSquare, ArrowLeftCircle, RotateCcw, Trash2, Link, Check } from 'lucide-react';
import { Zap } from 'lucide-react';
import { useReparacion } from './useReparacion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChannels } from './useChannels';
import ReparacionChannelItem from './ReparacionChannelItem';
import { useSettings } from './useSettings';
import { AttributeKey } from './index';

interface ReparacionTabProps {
    reparacionHook: ReturnType<typeof useReparacion>;
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
}

const ReparacionTab: React.FC<ReparacionTabProps> = ({ reparacionHook, channelsHook, settingsHook }) => {
    const { selectedPrefixes, selectedSuffixes } = useObviarPrefijosSufijos();
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
        verificationStatus,
        verifyChannel,
        clearFailedChannelsUrls,
        failedChannelsByGroup,
        reparacionUrl,
        setReparacionUrl,
        handleReparacionUrlLoad,
        isCurationLoading,
        curationError,
        verifyAllChannelsInGroup,
        scanQualityOfGroup,
    } = reparacionHook;

    const { undo, history } = channelsHook;

    const mainListParentRef = useRef<HTMLDivElement>(null);
    const reparacionListParentRef = useRef<HTMLDivElement>(null);

    const mainListRowVirtualizer = useVirtualizer({
        count: filteredMainChannels.length,
        getScrollElement: () => mainListParentRef.current,
        estimateSize: () => 68,
        overscan: 10,
    });

    const reparacionListRowVirtualizer = useVirtualizer({
        count: filteredReparacionChannels.length,
        getScrollElement: () => reparacionListParentRef.current,
        estimateSize: () => 68,
        overscan: 10,
    });

    const mainListVirtualItems = mainListRowVirtualizer.getVirtualItems();
    const reparacionListVirtualItems = reparacionListRowVirtualizer.getVirtualItems();

    const attributeLabels: { key: AttributeKey; label: string }[] = [
        { key: 'tvgId', label: 'tvg-id' },
        { key: 'tvgName', label: 'tvg-name' },
        { key: 'tvgLogo', label: 'Logo' },
        { key: 'groupTitle', label: 'Grupo' },
        { key: 'name', label: 'Nombre' },
        { key: 'url', label: 'URL' },
    ];

    const cleanChannelNameForSearch = (name: string): string => {
        let cleaned = name;
        // Eliminar prefijos seleccionados
        selectedPrefixes.forEach(pref => {
            if (cleaned.startsWith(pref)) {
                cleaned = cleaned.slice(pref.length).trim();
            }
        });
        // Eliminar sufijos seleccionados
        selectedSuffixes.forEach(suf => {
            if (cleaned.endsWith(suf)) {
                cleaned = cleaned.slice(0, -suf.length).trim();
            }
        });
        // Además, eliminar sufijos de calidad comunes
        const calidadRegex = /\s*[\(\[|]*\s*(4K|UHD|FHD|HD|SD|HEVC|H265|H264|x265|x264|1080p|720p|DUAL|MULTI)\s*[\)\]|]*$/i;
        return cleaned.replace(calidadRegex, '').trim();
    };

    const isAllInGroupSelected = filteredReparacionChannels.length > 0 && filteredReparacionChannels.every(c => selectedReparacionChannels.has(c.id));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4">
            <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col h-[calc(100vh-2rem)]">
                <h3 className="font-bold text-lg mb-2">Lista Principal</h3>
                <input
                    type="text"
                    placeholder="Buscar canal..."
                    value={mainListSearch}
                    onChange={(e) => setMainListSearch(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 mb-2 w-full"
                />
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
                    onClick={() => scanQualityOfGroup()}
                    className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 mb-2"
                >
                    <Zap size={14} /> Escanear Calidad Real del Grupo
                </button>
                <button
                    onClick={() => verifyAllChannelsInGroup(false)}
                    className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 mb-2"
                >
                    <Check size={14} /> Verificar Calidad del Grupo
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
                            return (
                                <div data-index={virtualItem.index} style={{position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualItem.start}px)`}}>
                                    <ReparacionChannelItem
                                        key={ch.id}
                                        channel={ch}
                                        onBodyClick={() => {
                                            setDestinationChannelId(ch.id)
                                            setReparacionListSearch(cleanChannelNameForSearch(ch.name));
                                        }}
                                        isSelected={destinationChannelId === ch.id}
                                        showCheckbox={false}
                                        verificationStatus={verificationStatus[ch.id] || { status: 'pending' }}
                                        onVerifyClick={() => verifyChannel(ch.id, ch.url)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="lg:col-span-1 flex flex-col items-center justify-start gap-2 bg-gray-800 p-4 rounded-lg">
                <button
                    onClick={() => scanQualityOfGroup(true)}
                    className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 mb-2"
                >
                    <Zap size={14} /> Escanear Calidad Real del Grupo
                </button>
                <div className="flex-grow">
                    <h4 className="font-bold text-center mb-2">Transferir Datos</h4>
                    <ArrowLeftCircle size={32} className="text-blue-400 mb-4 mx-auto" />
                    {attributeLabels.map(({ key, label }) => (
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
            <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col h-[calc(100vh-2rem)]">
                <h3 className="font-bold text-lg mb-2">Lista de recambios</h3>
                <div className="flex gap-2 mb-2">
                    <input
                        type="text"
                        placeholder="Cargar desde URL..."
                        value={reparacionUrl}
                        onChange={(e) => setReparacionUrl(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 w-full"
                    />
                    <button onClick={handleReparacionUrlLoad} className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-md">
                        <Link size={16} />
                    </button>
                </div>
                {isCurationLoading && <p className="text-center text-blue-400 mt-2">Cargando lista de recambios...</p>}
                {curationError && <p className="text-center text-red-400 bg-red-900/50 p-2 rounded mt-2">{curationError}</p>}
                <input
                    type="text"
                    placeholder="Buscar canal..."
                    value={reparacionListSearch}
                    onChange={(e) => setReparacionListSearch(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 mb-2 w-full"
                />
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
                <button
                    onClick={() => verifyAllChannelsInGroup(true)}
                    className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 mb-2"
                >
                    <Check size={14} /> Verificar Calidad del Grupo
                </button>
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
                <button
                    onClick={verifySelectedReparacionChannels}
                    disabled={selectedReparacionChannels.size === 0}
                    className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 mb-2"
                >
                    <Check size={14} /> Verificar Seleccionados
                </button>
                <label
                    htmlFor="reparacion-file-upload"
                    className="cursor-pointer text-sm w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center mb-2"
                >
                    <Upload size={16} className="mr-2" /> Subir Archivo
                </label>
                <input
                    id="reparacion-file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleReparacionFileUpload}
                    accept=".m3u,.m3u8"
                />
                <div ref={reparacionListParentRef} className="overflow-auto max-h-[60vh] pr-2">
                    <div style={{ height: `${reparacionListRowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {reparacionListVirtualItems.map((virtualItem) => {
                            const ch = filteredReparacionChannels[virtualItem.index];
                            if (!ch) return null;
                            return (
                                <div data-index={virtualItem.index} style={{position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualItem.start}px)`}}>
                                    <ReparacionChannelItem
                                        key={ch.id}
                                        channel={ch}
                                        onBodyClick={() => handleSourceChannelClick(ch)}
                                        onSelectClick={(e) => toggleReparacionSelection(ch.id, virtualItem.index, e.shiftKey, e.metaKey, e.ctrlKey)}
                                        isSelected={false}
                                        isChecked={selectedReparacionChannels.has(ch.id)}
                                        showCheckbox={true}
                                        verificationStatus={verificationStatus[ch.id] || { status: 'pending' }}
                                        onVerifyClick={() => verifyChannel(ch.id, ch.url)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReparacionTab;