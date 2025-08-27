import React from 'react';
import { Upload, Copy, CheckSquare, ArrowLeftCircle, RotateCcw } from 'lucide-react';
import { useCuration } from './useCuration';
import { useChannels } from './useChannels';
import CurationChannelItem from './CurationChannelItem';
import { AttributeKey } from './index';

interface CurationTabProps {
    curationHook: ReturnType<typeof useCuration>;
    channelsHook: ReturnType<typeof useChannels>;
}

const CurationTab: React.FC<CurationTabProps> = ({ curationHook, channelsHook }) => {
    const {
        selectedCurationChannels,
        attributesToCopy,
        destinationChannelId,
        setDestinationChannelId,
        mainListFilter,
        setMainListFilter,
        curationListFilter,
        setCurationListFilter,
        handleCurationFileUpload,
        toggleAttributeToCopy,
        handleSourceChannelClick,
        mainListUniqueGroups,
        curationListUniqueGroups,
        filteredMainChannels,
        filteredCurationChannels,
        toggleCurationSelection,
        handleAddSelectedFromCuration,
    } = curationHook;

    const { undo, history } = channelsHook;

    const attributeLabels: { key: AttributeKey; label: string }[] = [
        { key: 'tvgId', label: 'tvg-id' },
        { key: 'tvgName', label: 'tvg-name' },
        { key: 'tvgLogo', label: 'Logo' },
        { key: 'groupTitle', label: 'Grupo' },
        { key: 'name', label: 'Nombre' },
        { key: 'url', label: 'URL' },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4">
            <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col">
                <h3 className="font-bold text-lg mb-2">Lista Principal</h3>
                <select
                    value={mainListFilter}
                    onChange={(e) => setMainListFilter(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 mb-2"
                >
                    {mainListUniqueGroups.map((g) => (
                        <option key={g} value={g}>
                            {g}
                        </option>
                    ))}
                </select>
                <div className="overflow-auto max-h-[60vh] space-y-1 pr-2">
                    {filteredMainChannels.map((ch) => (
                        <CurationChannelItem
                            key={ch.id}
                            channel={ch}
                            onBodyClick={() => setDestinationChannelId(ch.id)}
                            isSelected={destinationChannelId === ch.id}
                            showCheckbox={false}
                        />
                    ))}
                </div>
            </div>
            <div className="lg:col-span-1 flex flex-col items-center justify-start gap-2 bg-gray-800 p-4 rounded-lg">
                <div className="flex-grow">
                    <h4 className="font-bold text-center mb-2">Transferir Datos</h4>
                    <ArrowLeftCircle size={32} className="text-blue-400 mb-4 mx-auto" />
                    {attributeLabels.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => toggleAttributeToCopy(key)}
                            className={`w-full text-xs py-2 px-1 mb-2 rounded-md flex items-center justify-center gap-1 transition-colors ${
                                attributesToCopy.has(key) ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                        >
                            {attributesToCopy.has(key) ? <CheckSquare size={14} /> : <Copy size={14} />} {label}
                        </button>
                    ))}
                </div>
                <div className="w-full border-t border-gray-700 my-2"></div>
                <div className="w-full">
                    <h4 className="font-bold text-center mb-2">Añadir a Lista</h4>
                    <button
                        onClick={handleAddSelectedFromCuration}
                        disabled={selectedCurationChannels.size === 0}
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
            <div className="lg:col-span-5 bg-gray-800 p-4 rounded-lg flex flex-col">
                <h3 className="font-bold text-lg mb-2">Lista de Curación</h3>
                <select
                    value={curationListFilter}
                    onChange={(e) => setCurationListFilter(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 mb-2"
                >
                    {curationListUniqueGroups.map((g) => (
                        <option key={g} value={g}>
                            {g}
                        </option>
                    ))}
                </select>
                <label
                    htmlFor="curation-file-upload"
                    className="cursor-pointer text-sm w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center mb-2"
                >
                    <Upload size={16} className="mr-2" /> Subir Archivo
                </label>
                <input
                    id="curation-file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleCurationFileUpload}
                    accept=".m3u,.m3u8"
                />
                <div className="overflow-auto max-h-[60vh] space-y-1 pr-2">
                    {filteredCurationChannels.map((ch) => (
                        <CurationChannelItem
                            key={ch.id}
                            channel={ch}
                            onBodyClick={() => handleSourceChannelClick(ch)}
                            onSelectClick={() => toggleCurationSelection(ch.id)}
                            isSelected={false}
                            isChecked={selectedCurationChannels.has(ch.id)}
                            showCheckbox={true}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CurationTab;
