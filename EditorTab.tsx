import React, { useRef } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Upload, Download, Plus, Trash2, GripVertical, Zap, ShieldCheck, ShieldX, Hourglass, ShieldQuestion } from 'lucide-react';
import { useChannels } from './useChannels';
import { useColumnResizing } from './useColumnResizing';
import { useSettings } from './useSettings';
import SortableChannelRow from './SortableChannelRow';
import ResizableHeader from './ResizableHeader';
import { Channel } from './index';

interface EditorTabProps {
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
}

const EditorTab: React.FC<EditorTabProps> = ({ channelsHook, settingsHook }) => {
    const {
        channels,
        url,
        setUrl,
        isLoading,
        error,
        activeId,
        selectedChannels,
        filterGroup,
        setFilterGroup,
        selectAllCheckboxRef,
        tableContainerRef,
        handleFetchUrl,
        handleFileUpload,
        handleAddNewChannel,
        handleDeleteSelected,
        handleVerifyChannels,
        handleDeleteFailed,
        isVerifying,
        verificationProgress,
        handleUpdateChannel,
        handleOrderChange,
        handleDragStart,
        handleDragEnd,
        uniqueGroups,
        filteredChannels,
        activeChannel,
        toggleChannelSelection,
        handleSelectAll,
    } = channelsHook;

    const { savedUrls } = settingsHook;
    const { columnWidths, handleResize } = useColumnResizing();
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
    const parentRef = tableContainerRef; // Reutilizamos la ref existente

    const rowVirtualizer = useVirtualizer({
        count: filteredChannels.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45, // Estimación de la altura de cada fila en píxeles
        overscan: 10, // Renderiza 10 items extra fuera de la vista para un scroll más suave
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();

    // Esto es necesario para que el DragOverlay funcione correctamente con la virtualización
    const activeChannelIndex = activeId ? filteredChannels.findIndex(c => c.id === activeId) : -1;

    const StatusIndicator: React.FC<{ status: Channel['status'] }> = ({ status }) => {
        switch (status) {
            case 'ok':
                return <span title="Operativo"><ShieldCheck size={16} className="text-green-500 mx-auto" /></span>;
            case 'failed':
                return <span title="Fallido"><ShieldX size={16} className="text-red-500 mx-auto" /></span>;
            case 'verifying':
                return <span title="Verificando..."><Hourglass size={16} className="text-yellow-500 mx-auto animate-spin" /></span>;
            default:
                return <span title="Pendiente"><ShieldQuestion size={16} className="text-gray-500 mx-auto" /></span>;
        }
    };

    return (
        <>
            <div className="bg-gray-800 p-4 rounded-lg mb-6 shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <label htmlFor="url-input" className="block text-sm font-medium text-gray-300 mb-1">
                            Cargar desde URL
                        </label>
                        <div className="flex">
                            <input
                                id="url-input"
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://.../playlist.m3u"
                                className="flex-grow bg-gray-700 border border-gray-600 rounded-l-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                            />
                            <button
                                onClick={handleFetchUrl}
                                disabled={isLoading}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r-md flex items-center disabled:bg-blue-800 disabled:cursor-not-allowed"
                            >
                                <Download size={18} className="mr-2" /> Descargar
                            </button>
                        </div>
                        {savedUrls.length > 0 && (
                            <div className="mt-2">
                                <select
                                    id="saved-urls-select"
                                    value=""
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setUrl(e.target.value);
                                        }
                                    }}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500 text-sm"
                                >
                                    <option value="">o selecciona una lista guardada...</option>
                                    {savedUrls.map(item => (
                                        <option key={item.id} value={item.url}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-center md:justify-end">
                        <label
                            htmlFor="file-upload"
                            className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md flex items-center"
                        >
                            <Upload size={18} className="mr-2" /> Subir Archivo M3U
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            className="hidden"
                            onChange={handleFileUpload}
                            accept=".m3u,.m3u8"
                        />
                    </div>
                </div>
                {isLoading && <p className="text-center mt-4 text-blue-400">Cargando...</p>}
                {error && <p className="text-center mt-4 text-red-400 bg-red-900/50 p-2 rounded">{error}</p>}
            </div>

            {channels.length > 0 && (
                <div className="bg-gray-800 p-4 rounded-lg mb-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <label htmlFor="group-filter" className="text-sm font-medium text-gray-300 mr-2">
                            Filtrar por grupo:
                        </label>
                        <select
                            id="group-filter"
                            value={filterGroup}
                            onChange={(e) => setFilterGroup(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500"
                        >
                            {uniqueGroups.map((group) => (
                                <option key={group} value={group}>
                                    {group}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {isVerifying && (
                                <div className="text-sm text-blue-400">
                                    Verificando {verificationProgress} de {channels.length}...
                                </div>
                            )}
                            <button
                                onClick={handleVerifyChannels}
                                disabled={isVerifying}
                                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                <Zap size={18} className="mr-2" /> Verificar Canales
                            </button>
                            <button
                                onClick={handleDeleteFailed}
                                disabled={isVerifying || channels.every(c => c.status !== 'failed')}
                                className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                <Trash2 size={18} className="mr-2" /> Eliminar Fallidos
                            </button>
                            <p className="text-sm text-gray-400">
                                {selectedChannels.length} de {filteredChannels.length} canales seleccionados
                            </p>
                            <button
                                onClick={handleAddNewChannel}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center"
                            >
                                <Plus size={18} className="mr-2" /> Crear Canal
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedChannels.length === 0}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                <Trash2 size={18} className="mr-2" /> Eliminar Seleccionados
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div ref={tableContainerRef} className="overflow-auto rounded-lg shadow-lg max-h-[60vh]">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <table className="min-w-full divide-y divide-gray-700 table-fixed">
                        <thead className="bg-gray-800 sticky top-0 z-10">
                            <tr>
                                <th scope="col" style={{ width: `${columnWidths.select}px` }} className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    <input
                                        type="checkbox"
                                        ref={selectAllCheckboxRef}
                                        checked={filteredChannels.length > 0 && selectedChannels.length === filteredChannels.length}
                                        onChange={handleSelectAll}
                                        className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                    />
                                </th>
                                <ResizableHeader width={columnWidths.order} onResize={(w) => handleResize('order', w)}>
                                    <div className="text-center">Orden</div>
                                </ResizableHeader>
                                <ResizableHeader width={columnWidths.status} onResize={(w) => handleResize('status', w)}>
                                    <div className="text-center">Estado</div>
                                </ResizableHeader>
                                <ResizableHeader width={columnWidths.tvgId} onResize={(w) => handleResize('tvgId', w)}>
                                    tvg-id
                                </ResizableHeader>
                                <ResizableHeader width={columnWidths.tvgName} onResize={(w) => handleResize('tvgName', w)}>
                                    tvg-name
                                </ResizableHeader>
                                <ResizableHeader width={columnWidths.tvgLogo} onResize={(w) => handleResize('tvgLogo', w)}>
                                    <div className="text-center">Logo</div>
                                </ResizableHeader>
                                <ResizableHeader width={columnWidths.groupTitle} onResize={(w) => handleResize('groupTitle', w)}>
                                    Grupo
                                </ResizableHeader>
                                <ResizableHeader width={columnWidths.name} onResize={(w) => handleResize('name', w)}>
                                    Nombre del Canal
                                </ResizableHeader>
                                <ResizableHeader width={columnWidths.url} onResize={(w) => handleResize('url', w)}>
                                    URL del Stream
                                </ResizableHeader>
                            </tr>
                        </thead>
                        <SortableContext items={filteredChannels.map(c => c.id)} strategy={verticalListSortingStrategy}>
                            <tbody style={{ height: `${totalSize}px`, width: '100%', position: 'relative' }} className="bg-gray-900 divide-y divide-gray-700">
                                {virtualItems.map((virtualItem) => {
                                    const channel = filteredChannels[virtualItem.index];
                                    if (!channel) return null;

                                    return (
                                        <SortableChannelRow
                                            key={channel.id}
                                            id={channel.id}
                                            channel={channel}
                                            onOrderChange={handleOrderChange}
                                            onUpdate={handleUpdateChannel}
                                            selectedChannels={selectedChannels}
                                            toggleChannelSelection={toggleChannelSelection}
                                            statusIndicator={
                                                <td style={{ width: `${columnWidths.status}px` }} className="px-2 py-2 text-center"><StatusIndicator status={channel.status} /></td>
                                            }
                                            columnWidths={columnWidths}
                                            measureRef={rowVirtualizer.measureElement}
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
                            </tbody>
                        </SortableContext>
                    </table>
                    <DragOverlay>
                        {activeChannel ? (
                            <table className="w-full table-fixed">
                                <tbody className="bg-gray-700 shadow-2xl">
                                    <SortableChannelRow
                                        id={activeChannel.id}
                                        channel={activeChannel}
                                        isOverlay
                                        onOrderChange={() => {}}
                                        onUpdate={() => {}}
                                        selectedChannels={[]}
                                        toggleChannelSelection={() => {}}
                                        statusIndicator={
                                            <td style={{ width: `${columnWidths.status}px` }} className="px-2 py-2 text-center"><StatusIndicator status={activeChannel.status} /></td>
                                        }
                                        columnWidths={columnWidths}
                                    />
                                </tbody>
                            </table>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
            {filteredChannels.length === 0 && channels.length > 0 && !isLoading && (
                <div className="text-center py-16 px-4 bg-gray-800 rounded-lg mt-6">
                    <h3 className="text-lg font-medium text-white">No hay canales en este grupo</h3>
                    <p className="mt-1 text-sm text-gray-400">
                        Selecciona "All" en el filtro de grupos para ver todos los canales.
                    </p>
                </div>
            )}
            {channels.length === 0 && !isLoading && (
                <div className="text-center py-16 px-4 bg-gray-800 rounded-lg mt-6">
                    <h3 className="text-lg font-medium text-white">Tu lista está vacía</h3>
                    <p className="mt-1 text-sm text-gray-400">
                        Pega una URL o sube un archivo .m3u para empezar a gestionar tus canales.
                    </p>
                </div>
            )}
        </>
    );
};

export default EditorTab;