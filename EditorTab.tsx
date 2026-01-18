import React, { useRef, useState, useMemo, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Upload, Download, Plus, Trash2, GripVertical, ShieldCheck, ShieldX, ShieldQuestion, Undo2, Redo2 } from 'lucide-react';
import { useChannels } from './useChannels';
import { useSettings } from './useSettings';
import { useAppMode } from './AppModeContext';
import { useColumnResizing } from './useColumnResizing';
import ResizableHeader from './ResizableHeader';
import SortableChannelRow from './SortableChannelRow';
import { Channel } from './index';

interface EditorTabProps {
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
}

const EditorTab: React.FC<EditorTabProps> = ({ channelsHook, settingsHook }) => {
    const { isSencillo } = useAppMode();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showTutorialModal, setShowTutorialModal] = useState(false);
    const [newChannelData, setNewChannelData] = useState({
        order: '',
        name: '',
        groupTitle: '',
        url: '',
        tvgId: '',
        tvgName: '',
        tvgLogo: '',
    });
    const [filteredGroups, setFilteredGroups] = useState<string[]>([]);
    
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
        handleUpdateChannel,
        handleOrderChange,
        handleDragStart,
        handleDragEnd,
        uniqueGroups,
        filteredChannels,
        activeChannel,
        toggleChannelSelection,
        handleSelectAll,
        processM3UContent,
        undo,
        redo,
        history,
        redoHistory,
    } = channelsHook;

    const { savedUrls } = settingsHook;
    const { columnWidths, handleResize } = useColumnResizing();
    
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Requiere mover 8px antes de activar el drag
            },
        }),
        useSensor(KeyboardSensor)
    );
    
    const parentRef = tableContainerRef; // Reutilizamos la ref existente

    // Calcular el ancho total de la tabla sumando todas las columnas visibles
    const totalTableWidth = useMemo(() => {
        let width = columnWidths.select + columnWidths.order + columnWidths.tvgLogo + 
                    columnWidths.groupTitle + columnWidths.name;
        
        if (!isSencillo) {
            width += columnWidths.status + columnWidths.tvgId + columnWidths.tvgName + columnWidths.url;
        }
        
        return width;
    }, [columnWidths, isSencillo]);

    // Obtener el ancho del contenedor para decidir si usar 100% o el ancho calculado
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const updateWidth = () => {
            if (parentRef.current) {
                setContainerWidth(parentRef.current.clientWidth);
            }
        };
        
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [parentRef]);

    const tableWidth = Math.max(totalTableWidth, containerWidth);

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
                return <span title="Verificando..."><ShieldQuestion size={16} className="text-yellow-500 mx-auto animate-pulse" /></span>;
            default:
                return <span title="Pendiente"><ShieldQuestion size={16} className="text-gray-500 mx-auto" /></span>;
        }
    };

    const handleOpenCreateModal = () => {
        setNewChannelData({
            order: (channels.length + 1).toString(),
            name: '',
            groupTitle: '',
            url: '',
            tvgId: '',
            tvgName: '',
            tvgLogo: '',
        });
        setShowCreateModal(true);
    };

    const handleGroupInputChange = (value: string) => {
        setNewChannelData({ ...newChannelData, groupTitle: value });
        if (value) {
            const filtered = uniqueGroups.filter(g => 
                g !== 'Todos los canales' && g.toLowerCase().startsWith(value.toLowerCase())
            );
            setFilteredGroups(filtered);
        } else {
            setFilteredGroups([]);
        }
    };

    const handleCreateChannel = () => {
        if (!newChannelData.name.trim()) {
            alert('El nombre del canal es obligatorio');
            return;
        }

        const orderNum = parseInt(newChannelData.order) || channels.length + 1;
        
        const newChannel: Channel = {
            id: `channel-${Date.now()}-${Math.random()}`,
            order: orderNum,
            tvgId: newChannelData.tvgId,
            tvgName: newChannelData.tvgName,
            tvgLogo: newChannelData.tvgLogo,
            groupTitle: newChannelData.groupTitle || 'Sin Grupo',
            name: newChannelData.name,
            url: newChannelData.url,
            status: 'pending',
        };

        // Insertar en la posición correcta y reordenar
        const updatedChannels = [...channels];
        updatedChannels.splice(orderNum - 1, 0, newChannel);
        const reordered = updatedChannels.map((c, i) => ({ ...c, order: i + 1 }));
        
        channelsHook.setChannels(reordered);
        setShowCreateModal(false);
    };

    const handleDeleteSelectedClick = () => {
        if (selectedChannels.length > 0) {
            setShowDeleteModal(true);
        }
    };

    const handleConfirmDelete = () => {
        handleDeleteSelected();
        setShowDeleteModal(false);
    };

    // Funciones para operaciones de atributos
    const handleSwapIdName = () => {
        channelsHook.setChannels(prev =>
            prev.map(ch =>
                selectedChannels.includes(ch.id)
                    ? { ...ch, tvgId: ch.tvgName, tvgName: ch.tvgId }
                    : ch
            )
        );
        channelsHook.saveStateToHistory();
    };

    const handleCopyIdToName = () => {
        channelsHook.setChannels(prev =>
            prev.map(ch =>
                selectedChannels.includes(ch.id)
                    ? { ...ch, tvgName: ch.tvgId }
                    : ch
            )
        );
        channelsHook.saveStateToHistory();
    };

    const handleCopyNameToId = () => {
        channelsHook.setChannels(prev =>
            prev.map(ch =>
                selectedChannels.includes(ch.id)
                    ? { ...ch, tvgId: ch.tvgName }
                    : ch
            )
        );
        channelsHook.saveStateToHistory();
    };

    const handleClearId = () => {
        channelsHook.setChannels(prev =>
            prev.map(ch =>
                selectedChannels.includes(ch.id)
                    ? { ...ch, tvgId: '' }
                    : ch
            )
        );
        channelsHook.saveStateToHistory();
    };

    const handleClearName = () => {
        channelsHook.setChannels(prev =>
            prev.map(ch =>
                selectedChannels.includes(ch.id)
                    ? { ...ch, tvgName: '' }
                    : ch
            )
        );
        channelsHook.saveStateToHistory();
    };

    return (
        <>
            {!isSencillo && (
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
            )}

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
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Sección de edición de atributos */}
                        {!isSencillo && selectedChannels.length > 0 && (
                            <div className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg border border-gray-600">
                                <span className="text-xs text-gray-400 font-semibold mr-2">Edición de Atributos:</span>
                                <button
                                    onClick={handleSwapIdName}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-3 rounded-md text-xs"
                                    title="Intercambia tvg-id por tvg-name en los canales seleccionados"
                                >
                                    Intercambiar ID ↔ Name
                                </button>
                                <button
                                    onClick={handleCopyIdToName}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-md text-xs"
                                    title="Copia tvg-id en tvg-name de los canales seleccionados"
                                >
                                    Copiar ID → Name
                                </button>
                                <button
                                    onClick={handleCopyNameToId}
                                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-1.5 px-3 rounded-md text-xs"
                                    title="Copia tvg-name en tvg-id de los canales seleccionados"
                                >
                                    Copiar Name → ID
                                </button>
                                <button
                                    onClick={handleClearId}
                                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-1.5 px-3 rounded-md text-xs"
                                    title="Borra tvg-id de los canales seleccionados"
                                >
                                    Eliminar ID
                                </button>
                                <button
                                    onClick={handleClearName}
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-3 rounded-md text-xs"
                                    title="Borra tvg-name de los canales seleccionados"
                                >
                                    Eliminar Name
                                </button>
                            </div>
                        )}

                        {/* Sección de historial (deshacer/rehacer) */}
                        {!isSencillo && (history.length > 0 || redoHistory.length > 0) && (
                            <div className="flex items-center gap-2 p-2 bg-gray-700 rounded-lg border border-gray-600">
                                <span className="text-xs text-gray-400 font-semibold mr-2">Historial:</span>
                                <button
                                    onClick={undo}
                                    disabled={history.length === 0}
                                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-1.5 px-3 rounded-md flex items-center text-xs disabled:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    title={history.length > 0 ? `Deshacer (${history.length} cambios disponibles)` : 'No hay cambios para deshacer'}
                                >
                                    <Undo2 size={16} className="mr-1" /> Deshacer
                                </button>
                                <button
                                    onClick={redo}
                                    disabled={redoHistory.length === 0}
                                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-1.5 px-3 rounded-md flex items-center text-xs disabled:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    title={redoHistory.length > 0 ? `Rehacer (${redoHistory.length} cambios disponibles)` : 'No hay cambios para rehacer'}
                                >
                                    <Redo2 size={16} className="mr-1" /> Rehacer
                                </button>
                            </div>
                        )}

                        {/* Contador de selección y botones de acción */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm ${selectedChannels.length > 0 ? 'text-yellow-400 font-semibold' : 'text-gray-400'}`}>
                                {selectedChannels.length} de {filteredChannels.length} canales seleccionados
                            </p>
                            <button
                                onClick={handleOpenCreateModal}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md flex items-center"
                            >
                                <Plus size={18} className="mr-2" /> Crear Canal
                            </button>
                            <button
                                onClick={handleDeleteSelectedClick}
                                disabled={selectedChannels.length === 0}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md flex items-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                <Trash2 size={18} className="mr-2" /> Eliminar Seleccionados
                            </button>
                            <button
                                onClick={() => setShowTutorialModal(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md flex items-center"
                            >
                                ¿Cómo ordenar los canales de mi lista?
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div ref={tableContainerRef} className="overflow-auto rounded-lg shadow-lg max-h-[60vh]">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <table className="divide-y divide-gray-700" style={{ tableLayout: 'fixed', width: `${tableWidth}px` }}>
                        <thead className="bg-gray-800 sticky top-0 z-10">
                            <tr>
                                <th scope="col" style={{ width: `${columnWidths.select}px`, minWidth: `${columnWidths.select}px`, maxWidth: `${columnWidths.select}px` }} className="px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    <input
                                        type="checkbox"
                                        ref={selectAllCheckboxRef}
                                        checked={filteredChannels.length > 0 && selectedChannels.length === filteredChannels.length}
                                        onChange={handleSelectAll}
                                        className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                    />
                                </th>
                                <ResizableHeader width={columnWidths.order} onResize={(w) => handleResize('order', w)} align="center">
                                    Orden
                                </ResizableHeader>
                                {!isSencillo && (
                                    <ResizableHeader width={columnWidths.status} onResize={(w) => handleResize('status', w)} align="center">
                                        Estado
                                    </ResizableHeader>
                                )}
                                {!isSencillo && (
                                    <ResizableHeader width={columnWidths.tvgId} onResize={(w) => handleResize('tvgId', w)} align="left">
                                        tvg-id
                                    </ResizableHeader>
                                )}
                                {!isSencillo && (
                                    <ResizableHeader width={columnWidths.tvgName} onResize={(w) => handleResize('tvgName', w)} align="left">
                                        tvg-name
                                    </ResizableHeader>
                                )}
                                <ResizableHeader width={columnWidths.tvgLogo} onResize={(w) => handleResize('tvgLogo', w)} align="center">
                                    Logo
                                </ResizableHeader>
                                <ResizableHeader width={columnWidths.groupTitle} onResize={(w) => handleResize('groupTitle', w)} align="left">
                                    Grupo
                                </ResizableHeader>
                                <ResizableHeader width={columnWidths.name} onResize={(w) => handleResize('name', w)} align="left">
                                    Nombre del Canal
                                </ResizableHeader>
                                {!isSencillo && (
                                    <ResizableHeader width={columnWidths.url} onResize={(w) => handleResize('url', w)} align="left">
                                        URL del Stream
                                    </ResizableHeader>
                                )}
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
                                                <td style={{ width: `${columnWidths.status}px`, minWidth: `${columnWidths.status}px`, maxWidth: `${columnWidths.status}px` }} className="px-2 py-2 text-center"><StatusIndicator status={channel.status} /></td>
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
                            <table style={{ tableLayout: 'fixed', width: `${tableWidth}px` }}>
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
                                            !isSencillo ? (
                                                <td style={{ width: `${columnWidths.status}px`, minWidth: `${columnWidths.status}px`, maxWidth: `${columnWidths.status}px` }} className="px-2 py-2 text-center"><StatusIndicator status={activeChannel.status} /></td>
                                            ) : null
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

            {/* Modal Crear Canal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-blue-500">
                        <h2 className="text-2xl font-bold text-white mb-6">Crear Nuevo Canal</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Orden <span className="text-gray-500">(posición en la lista)</span>
                                </label>
                                <input
                                    type="number"
                                    value={newChannelData.order}
                                    onChange={(e) => setNewChannelData({ ...newChannelData, order: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Nombre del Canal <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newChannelData.name}
                                    onChange={(e) => setNewChannelData({ ...newChannelData, name: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Nombre del canal"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Grupo <span className="text-gray-500">(opcional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={newChannelData.groupTitle}
                                    onChange={(e) => handleGroupInputChange(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Nombre del grupo"
                                    list="groups-datalist"
                                />
                                {filteredGroups.length > 0 && (
                                    <div className="mt-2 bg-gray-700 border border-gray-600 rounded-md max-h-32 overflow-y-auto">
                                        {filteredGroups.map((group) => (
                                            <div
                                                key={group}
                                                onClick={() => {
                                                    setNewChannelData({ ...newChannelData, groupTitle: group });
                                                    setFilteredGroups([]);
                                                }}
                                                className="px-3 py-2 hover:bg-gray-600 cursor-pointer text-white text-sm"
                                            >
                                                {group}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    URL del Stream <span className="text-gray-500">(opcional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={newChannelData.url}
                                    onChange={(e) => setNewChannelData({ ...newChannelData, url: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="https://..."
                                />
                            </div>

                            {!isSencillo && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            tvg-id <span className="text-gray-500">(opcional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newChannelData.tvgId}
                                            onChange={(e) => setNewChannelData({ ...newChannelData, tvgId: e.target.value })}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            tvg-name <span className="text-gray-500">(opcional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newChannelData.tvgName}
                                            onChange={(e) => setNewChannelData({ ...newChannelData, tvgName: e.target.value })}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            URL del Logo <span className="text-gray-500">(opcional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newChannelData.tvgLogo}
                                            onChange={(e) => setNewChannelData({ ...newChannelData, tvgLogo: e.target.value })}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="https://..."
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleCreateChannel}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
                            >
                                Crear Canal
                            </button>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Confirmar Eliminación */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-4 border border-red-500">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                                <Trash2 className="h-6 w-6 text-red-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-4">
                                Vas a eliminar {selectedChannels.length} canal{selectedChannels.length !== 1 ? 'es' : ''}.
                            </h3>
                            <p className="text-gray-300 mb-6">¿Estás seguro?</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleConfirmDelete}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
                                >
                                    Sí, eliminar
                                </button>
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Tutorial de Ordenamiento */}
            {showTutorialModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-8 max-w-2xl mx-4 border border-blue-500">
                        <h2 className="text-2xl font-bold text-white mb-6">¿Cómo ordenar los canales de mi lista?</h2>
                        
                        <div className="space-y-6 text-gray-300">
                            <div className="bg-gray-700 p-4 rounded-lg">
                                <h3 className="text-lg font-semibold text-blue-400 mb-2">1. Cambiar posición mediante número de orden</h3>
                                <p className="text-sm leading-relaxed">
                                    Haz doble clic en el número de orden asignado al canal y asígnale una nueva posición. 
                                    Si tienes varios canales seleccionados, los demás tomarán las siguientes posiciones a la nueva posición asignada.
                                </p>
                            </div>

                            <div className="bg-gray-700 p-4 rounded-lg">
                                <h3 className="text-lg font-semibold text-blue-400 mb-2">2. Arrastrar y soltar <span className="text-yellow-400 text-xs">(en pruebas)</span></h3>
                                <p className="text-sm leading-relaxed">
                                    Pulsa en los 6 puntitos a la izquierda del canal que quieres mover y arrástralo arriba o abajo hasta su nueva posición.
                                </p>
                            </div>

                            <div className="bg-gray-700 p-4 rounded-lg">
                                <h3 className="text-lg font-semibold text-blue-400 mb-2">3. Editar campos del canal</h3>
                                <p className="text-sm leading-relaxed">
                                    Puedes editar cada campo de un canal si haces doble clic sobre él (excepto el logo).
                                </p>
                            </div>
                        </div>

                        <div className="mt-8">
                            <button
                                onClick={() => setShowTutorialModal(false)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default EditorTab;