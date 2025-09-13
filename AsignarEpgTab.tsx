import React, { useState, useMemo, useRef } from 'react';
import { Upload, Download, Copy, Zap, ArrowLeftCircle } from 'lucide-react';
import { useAsignarEpg } from './useAsignarEpg';
import { useChannels } from './useChannels';
import { useVirtualizer } from '@tanstack/react-virtual';
import ReparacionChannelItem from './ReparacionChannelItem';
import EpgChannelItem from './EpgChannelItem';
import { AttributeKey } from './index';

interface AsignarEpgTabProps {
    epgHook: ReturnType<typeof useAsignarEpg>;
    channelsHook: ReturnType<typeof useChannels>;
}

const AsignarEpgTab: React.FC<AsignarEpgTabProps> = ({ epgHook, channelsHook }) => {
    const {
        epgChannels,
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
    } = epgHook;

    const { channels } = channelsHook;
    const [mainListSearch, setMainListSearch] = useState('');
    const [epgListSearch, setEpgListSearch] = useState('');

    const filteredMainChannelsForEpg = useMemo(() => {
        let channelsToFilter = channels;
        if (mainListSearch) {
            channelsToFilter = channelsToFilter.filter(c => c.name.toLowerCase().includes(mainListSearch.toLowerCase()));
        }
        return channelsToFilter;
    }, [channels, mainListSearch]);

    const filteredEpgChannels = useMemo(() => {
        let channelsToFilter = epgChannels;
        if (epgListSearch) {
            channelsToFilter = channelsToFilter.filter(c => c.name.toLowerCase().includes(epgListSearch.toLowerCase()));
        }
        return channelsToFilter;
    }, [epgChannels, epgListSearch]);

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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4">
            <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col">
                <h3 className="font-bold text-lg mb-2">Lista Principal</h3>
                <input
                    type="text"
                    placeholder="Buscar canal..."
                    value={mainListSearch}
                    onChange={(e) => setMainListSearch(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 mb-2 w-full"
                />
                <div ref={mainListParentRef} className="overflow-auto max-h-[70vh] pr-2">
                    <div style={{ height: `${mainListRowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {mainListVirtualItems.map((virtualItem) => {
                            const ch = filteredMainChannelsForEpg[virtualItem.index];
                            if (!ch) return null;
                            return (
                                <ReparacionChannelItem
                                    key={ch.id}
                                    channel={ch}
                                    onBodyClick={() => setDestinationChannelId(ch.id)}
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
            <div className="lg:col-span-1 flex flex-col items-center justify-start gap-2 bg-gray-800 p-4 rounded-lg">
                <h4 className="font-bold text-center mb-2">Asignar EPG</h4>
                <ArrowLeftCircle size={32} className="text-blue-400 mb-4" />
                <button
                    onClick={() => setAttributesToCopy(new Set<AttributeKey>(['tvgId']))}
                    className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-blue-600 text-white"
                >
                    <Copy size={14} /> Asignar ID
                </button>
                <button
                    onClick={() => setAttributesToCopy(new Set<AttributeKey>(['tvgId', 'tvgLogo']))}
                    className="w-full text-xs py-2 px-1 rounded-md flex items-center justify-center gap-1 transition-colors bg-blue-600 text-white"
                >
                    <Copy size={14} /> ID y Logo
                </button>
            </div>
            <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col">
                <h3 className="font-bold text-lg mb-2">Fuente EPG</h3>
                <input
                    type="text"
                    placeholder="Buscar canal..."
                    value={epgListSearch}
                    onChange={(e) => setEpgListSearch(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 mb-2 w-full"
                />
                <div className="space-y-4">
                    <div>
                        <label
                            htmlFor="epg-file-upload"
                            className="cursor-pointer text-sm w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center"
                        >
                            <Upload size={16} className="mr-2" /> Subir Archivo XMLTV
                        </label>
                        <input
                            id="epg-file-upload"
                            type="file"
                            className="hidden"
                            onChange={handleEpgFileUpload}
                            accept=".xml,.xml.gz"
                        />
                    </div>
                    <div className="border-t border-gray-700 pt-4">
                        <div className="flex">
                            <input
                                type="text"
                                value={epgUrl}
                                onChange={(e) => setEpgUrl(e.target.value)}
                                placeholder="URL del archivo .xml"
                                className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                            <button
                                onClick={handleFetchEpgUrl}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-r-md flex items-center text-sm"
                            >
                                <Download size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="border-t border-gray-700 pt-4 space-y-2">
                        <p className="text-xs text-gray-400 text-center">O generar desde URLs:</p>
                        <input
                            type="text"
                            value={epgIdListUrl}
                            onChange={(e) => setEpgIdListUrl(e.target.value)}
                            placeholder="URL de lista de IDs (.txt)"
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                            type="text"
                            value={epgLogoFolderUrl}
                            onChange={(e) => setEpgLogoFolderUrl(e.target.value)}
                            placeholder="URL de carpeta de logos"
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                            onClick={handleGenerateEpgFromUrls}
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center text-sm"
                        >
                            <Zap size={16} className="mr-2" /> Generar EPG
                        </button>
                    </div>
                </div>
                {isEpgLoading && <p className="text-center text-blue-400 mt-2">Cargando...</p>}
                {epgError && <p className="text-center text-red-400 bg-red-900/50 p-2 rounded mt-2">{epgError}</p>}
                <div ref={epgListParentRef} className="overflow-auto max-h-[40vh] pr-2 mt-4">
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