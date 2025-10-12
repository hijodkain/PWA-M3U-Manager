import React, { useState, useMemo, useRef } from 'react';
import { useObviarPrefijosSufijos } from './useObviarPrefijosSufijos';
import { Upload, Download, Copy, Zap, ArrowLeftCircle, ChevronsUpDown } from 'lucide-react';
import { useAsignarEpg } from './useAsignarEpg';
import { useChannels } from './useChannels';
import { useVirtualizer } from '@tanstack/react-virtual';
import ReparacionChannelItem from './ReparacionChannelItem';
import { useSettings } from './useSettings';
import EpgChannelItem from './EpgChannelItem';
import { AttributeKey, Channel } from './index';

interface AsignarEpgTabProps {
    epgHook: ReturnType<typeof useAsignarEpg>;
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
}

const AsignarEpgTab: React.FC<AsignarEpgTabProps> = ({ epgHook, channelsHook, settingsHook }) => {
    const { selectedPrefixes, selectedSuffixes } = useObviarPrefijosSufijos();
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
    const { savedEpgUrls } = settingsHook;
    const [mainListSearch, setMainListSearch] = useState('');
    const [epgListSearch, setEpgListSearch] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [isGeneratorVisible, setIsGeneratorVisible] = useState(false);

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
            channelsToFilter = channelsToFilter.filter(c => c.name.toLowerCase().includes(mainListSearch.toLowerCase()));
        }
        return channelsToFilter;
    }, [channels, mainListSearch, selectedGroup]);

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

    const handleMainChannelClick = (channel: Channel) => {
        setDestinationChannelId(channel.id);
        // Limpiar nombre usando prefijos/sufijos seleccionados
        let cleaned = channel.name;
        selectedPrefixes.forEach(pref => {
            if (cleaned.startsWith(pref)) {
                cleaned = cleaned.slice(pref.length).trim();
            }
        });
        selectedSuffixes.forEach(suf => {
            if (cleaned.endsWith(suf)) {
                cleaned = cleaned.slice(0, -suf.length).trim();
            }
        });
        const calidadRegex = /\s*[\(\[|]*\s*(4K|UHD|FHD|HD|SD|HEVC|H265|H264|x265|x264|1080p|720p|DUAL|MULTI)\s*[\)\]|]*$/i;
        cleaned = cleaned.replace(calidadRegex, '').trim();
        setEpgListSearch(cleaned);
    };

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
                    placeholder="Buscar en la fuente EPG..."
                    value={epgListSearch}
                    onChange={(e) => setEpgListSearch(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 mb-2 w-full"
                />
                <div className="space-y-4">
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
                                placeholder="o pega la URL del archivo .xml"
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
                    {savedEpgUrls.length > 0 && (
                        <select
                            id="saved-epg-urls-select"
                            value=""
                            onChange={(e) => { if (e.target.value) setEpgUrl(e.target.value); }}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                            <option value="">o selecciona una fuente guardada...</option>
                            {savedEpgUrls.map(item => (
                                <option key={item.id} value={item.url}>{item.name}</option>
                            ))}
                        </select>
                    )}
                    <div className="border-t border-gray-700 pt-4">
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