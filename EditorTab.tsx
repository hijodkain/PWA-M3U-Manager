import React, { useRef, useState, useMemo, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Upload, Download, Plus, Trash2, GripVertical, ShieldCheck, ShieldX, ShieldQuestion, Undo2, Redo2, HelpCircle, SlidersHorizontal, Search, X as XIcon } from 'lucide-react';
import { useChannels } from './useChannels';
import { useSettings } from './useSettings';
import { useAppMode } from './AppModeContext';
import { useColumnResizing } from './useColumnResizing';
import ResizableHeader from './ResizableHeader';
import SortableChannelRow from './SortableChannelRow';
import SaveLogoModal from './SaveLogoModal';
import { Channel } from './index';

interface EditorTabProps {
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
}

type ColumnKey = 'status' | 'tvgId' | 'tvgName' | 'tvgLogo' | 'saveLogo' | 'groupTitle' | 'name' | 'url' | 'play';

const ALL_EDITOR_COLUMNS: { key: ColumnKey; label: string; onlyPro?: boolean }[] = [
    { key: 'status', label: 'Estado', onlyPro: true },
    { key: 'tvgId', label: 'tvg-id', onlyPro: true },
    { key: 'tvgName', label: 'tvg-name', onlyPro: true },
    { key: 'tvgLogo', label: 'Logo' },
    { key: 'saveLogo', label: 'Guardar Logo', onlyPro: true },
    { key: 'groupTitle', label: 'Grupo' },
    { key: 'name', label: 'Nombre del canal' },
    { key: 'url', label: 'URL del stream', onlyPro: true },
    { key: 'play', label: 'Probar' },
];

const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
    status: true,
    tvgId: true,
    tvgName: true,
    tvgLogo: true,
    saveLogo: true,
    groupTitle: true,
    name: true,
    url: true,
    play: true,
};

type TmdbMediaType = 'movie' | 'tv';

interface TmdbSearchItem {
    id: number;
    name: string;
    popularity: number;
    voteCount: number;
}

const EditorTab: React.FC<EditorTabProps> = ({ channelsHook, settingsHook }) => {
    const { isSencillo } = useAppMode();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showTutorialModal, setShowTutorialModal] = useState(false);
    const [webPlayerUrl, setWebPlayerUrl] = useState<string | null>(null);
    const [saveLogoChannel, setSaveLogoChannel] = useState<Channel | null>(null);
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
    const [prefixInput, setPrefixInput] = useState('');
    const [suffixInput, setSuffixInput] = useState('');
    const [showColumnsDropdown, setShowColumnsDropdown] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_VISIBLE_COLUMNS);
    const [showRelativeOrder, setShowRelativeOrder] = useState(false);
    const [nameSearch, setNameSearch] = useState('');
    const [showNameSearch, setShowNameSearch] = useState(false);
    const [urlSortMode, setUrlSortMode] = useState<'none' | 'alpha' | 'domain-cycle'>('none');
    const [domainCycleStep, setDomainCycleStep] = useState(0);
    const [tableSortMode, setTableSortMode] = useState<'none' | 'tvgId' | 'tvgName' | 'status' | 'tvgLogo'>('none');
    const [isAssigningTmdbIds, setIsAssigningTmdbIds] = useState(false);
    const [tmdbProgress, setTmdbProgress] = useState<{ processed: number; total: number } | null>(null);
    const [showTmdbTypeModal, setShowTmdbTypeModal] = useState(false);
    const columnsDropdownRef = useRef<HTMLDivElement>(null);
    const nameSearchRef = useRef<HTMLInputElement>(null);
    
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
        mainDomainFilter,
        setMainDomainFilter,
        statusFilter,
        setStatusFilter,
        uniqueDomains,
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

    useEffect(() => {
        try {
            const savedColumns = localStorage.getItem('editor_visible_columns');
            if (savedColumns) {
                const parsed = JSON.parse(savedColumns);
                setVisibleColumns({
                    ...DEFAULT_VISIBLE_COLUMNS,
                    ...parsed,
                });
            }
        } catch {
            // Si localStorage falla, mantenemos la configuración por defecto.
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('editor_visible_columns', JSON.stringify(visibleColumns));
        } catch {
            // Si localStorage falla, no bloqueamos el uso de la tabla.
        }
    }, [visibleColumns]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (columnsDropdownRef.current && !columnsDropdownRef.current.contains(event.target as Node)) {
                setShowColumnsDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Resetear orden relativo cuando cambia el filtro de grupo
    useEffect(() => {
        setShowRelativeOrder(false);
    }, [filterGroup]);

    // Al cambiar filtros o búsqueda, volver al orden base.
    useEffect(() => {
        setUrlSortMode('none');
        setDomainCycleStep(0);
        setTableSortMode('none');
    }, [filterGroup, mainDomainFilter, statusFilter, nameSearch]);

    const isColumnVisible = (key: ColumnKey) => {
        if (isSencillo && (key === 'status' || key === 'tvgId' || key === 'tvgName' || key === 'url' || key === 'saveLogo')) {
            return false;
        }
        return visibleColumns[key];
    };

    const visibleColumnOptions = useMemo(
        () => ALL_EDITOR_COLUMNS.filter(col => !col.onlyPro || !isSencillo),
        [isSencillo]
    );
    
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Requiere mover 8px antes de activar el drag
            },
        }),
        useSensor(TouchSensor, {
            // Ajustes específicos para móviles
            activationConstraint: {
                delay: 250, // Esperar 250ms antes de activar drag (previene scroll accidental)
                tolerance: 5, // Permitir 5px de movimiento durante el delay
            },
        }),
        useSensor(KeyboardSensor)
    );
    
    const parentRef = tableContainerRef; // Reutilizamos la ref existente

    // Calcular el ancho total de la tabla sumando todas las columnas visibles
    const totalTableWidth = useMemo(() => {
        let width = columnWidths.select + columnWidths.order;

        if (isColumnVisible('status')) width += columnWidths.status;
        if (isColumnVisible('tvgId')) width += columnWidths.tvgId;
        if (isColumnVisible('tvgName')) width += columnWidths.tvgName;
        if (isColumnVisible('tvgLogo')) width += columnWidths.tvgLogo;
        if (isColumnVisible('saveLogo')) width += columnWidths.saveLogo;
        if (isColumnVisible('groupTitle')) width += columnWidths.groupTitle;
        if (isColumnVisible('name')) width += columnWidths.name;
        if (isColumnVisible('url')) width += columnWidths.url;
        if (isColumnVisible('play')) width += columnWidths.play;

        return width;
    }, [columnWidths, visibleColumns, isSencillo]);

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

    const getChannelDomain = (rawUrl: string) => {
        try {
            return new URL(rawUrl).hostname.toLowerCase();
        } catch {
            return '__sin_dominio__';
        }
    };

    const qualityRank = (quality?: Channel['quality']) => {
        switch (quality) {
            case '4K': return 0;
            case 'FHD': return 1;
            case 'HD': return 2;
            case 'SD': return 3;
            default: return 4;
        }
    };

    const statusRank = (channel: Channel) => {
        if (channel.status === 'failed') return 0;

        if (channel.status === 'ok') {
            const hasKnownQuality = channel.quality && channel.quality !== 'unknown';
            const hasResolution = !!channel.resolution;

            if (!hasKnownQuality && !hasResolution) {
                // Verificados sin resolución obtenida
                return 1;
            }

            // Verificados con resolución (4K, FHD, HD, SD)
            return 2 + qualityRank(channel.quality);
        }

        // No verificados (pending / verifying / undefined)
        return 10;
    };

    // Filtrado local por nombre (lupa de búsqueda)
    const nameFilteredChannels = useMemo(() => {
        if (!nameSearch.trim()) return filteredChannels;
        const q = nameSearch.toLowerCase();
        return filteredChannels.filter(ch => ch.name.toLowerCase().includes(q));
    }, [filteredChannels, nameSearch]);

    const alphaUrlChannels = useMemo(
        () => [...nameFilteredChannels].sort((a, b) => a.url.localeCompare(b.url, 'es', { sensitivity: 'base' })),
        [nameFilteredChannels]
    );

    const domainOrder = useMemo(() => {
        const seen = new Set<string>();
        const order: string[] = [];
        alphaUrlChannels.forEach((ch) => {
            const domain = getChannelDomain(ch.url);
            if (!seen.has(domain)) {
                seen.add(domain);
                order.push(domain);
            }
        });
        return order;
    }, [alphaUrlChannels]);

    const sortedByHeaderChannels = useMemo(() => {
        if (tableSortMode === 'none') return nameFilteredChannels;

        const copy = [...nameFilteredChannels];

        if (tableSortMode === 'tvgId') {
            return copy.sort((a, b) => {
                const aEmpty = !a.tvgId?.trim();
                const bEmpty = !b.tvgId?.trim();
                if (aEmpty !== bEmpty) return aEmpty ? -1 : 1;
                const byText = (a.tvgId || '').localeCompare(b.tvgId || '', 'es', { sensitivity: 'base' });
                return byText !== 0 ? byText : a.order - b.order;
            });
        }

        if (tableSortMode === 'tvgName') {
            return copy.sort((a, b) => {
                const aEmpty = !a.tvgName?.trim();
                const bEmpty = !b.tvgName?.trim();
                if (aEmpty !== bEmpty) return aEmpty ? -1 : 1;
                const byText = (a.tvgName || '').localeCompare(b.tvgName || '', 'es', { sensitivity: 'base' });
                return byText !== 0 ? byText : a.order - b.order;
            });
        }

        if (tableSortMode === 'tvgLogo') {
            return copy.sort((a, b) => {
                const aEmpty = !a.tvgLogo?.trim();
                const bEmpty = !b.tvgLogo?.trim();
                if (aEmpty !== bEmpty) return aEmpty ? -1 : 1;
                return a.order - b.order;
            });
        }

        return copy.sort((a, b) => {
            const byRank = statusRank(a) - statusRank(b);
            if (byRank !== 0) return byRank;
            return a.order - b.order;
        });
    }, [nameFilteredChannels, tableSortMode]);

    const displayChannels = useMemo(() => {
        if (urlSortMode !== 'none') {
            if (urlSortMode === 'alpha') {
                return alphaUrlChannels;
            }

            if (domainOrder.length === 0) {
                return alphaUrlChannels;
            }

            const movedDomains = new Set(domainOrder.slice(0, Math.min(domainCycleStep, domainOrder.length)));
            return [
                ...alphaUrlChannels.filter((ch) => !movedDomains.has(getChannelDomain(ch.url))),
                ...alphaUrlChannels.filter((ch) => movedDomains.has(getChannelDomain(ch.url))),
            ];
        }

        return sortedByHeaderChannels;
    }, [urlSortMode, alphaUrlChannels, domainOrder, domainCycleStep, sortedByHeaderChannels]);

    // Mapa canal -> orden relativo dentro del grupo filtrado
    const relativeOrderMap = useMemo(() => {
        const map = new Map<string, number>();
        displayChannels.forEach((ch, idx) => map.set(ch.id, idx + 1));
        return map;
    }, [displayChannels]);

    const handleOrderHeaderClick = () => {
        if (filterGroup && filterGroup !== 'Todos los canales') {
            setShowRelativeOrder(prev => !prev);
        }
    };

    const handleUrlHeaderClick = () => {
        setTableSortMode('none');

        if (urlSortMode === 'none') {
            setUrlSortMode('alpha');
            setDomainCycleStep(0);
            return;
        }

        if (urlSortMode === 'alpha') {
            if (domainOrder.length === 0) {
                setUrlSortMode('none');
                return;
            }
            setUrlSortMode('domain-cycle');
            setDomainCycleStep(1);
            return;
        }

        const nextStep = domainCycleStep + 1;
        if (nextStep > domainOrder.length) {
            setUrlSortMode('none');
            setDomainCycleStep(0);
        } else {
            setDomainCycleStep(nextStep);
        }
    };

    const handleHeaderSortToggle = (mode: 'tvgId' | 'tvgName' | 'status' | 'tvgLogo') => {
        setUrlSortMode('none');
        setDomainCycleStep(0);
        setTableSortMode((prev) => (prev === mode ? 'none' : mode));
    };

    const rowVirtualizer = useVirtualizer({
        count: displayChannels.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45, // Estimación de la altura de cada fila en píxeles
        overscan: 10, // Renderiza 10 items extra fuera de la vista para un scroll más suave
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();

    // Esto es necesario para que el DragOverlay funcione correctamente con la virtualización
    const activeChannelIndex = activeId ? displayChannels.findIndex(c => c.id === activeId) : -1;

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

    const handleRemovePrefix = () => {
        if (!prefixInput.trim()) {
            alert('Por favor, introduce un prefijo');
            return;
        }

        channelsHook.setChannels(prev =>
            prev.map(ch => {
                if (!selectedChannels.includes(ch.id)) return ch;
                
                // Si el nombre empieza con el prefijo, eliminarlo
                if (ch.name.startsWith(prefixInput)) {
                    const newName = ch.name.substring(prefixInput.length).trim();
                    return { ...ch, name: newName };
                }
                return ch;
            })
        );
        channelsHook.saveStateToHistory();
        setPrefixInput('');
    };

    const handleAddPrefix = () => {
        if (!prefixInput.trim()) {
            alert('Por favor, introduce un prefijo');
            return;
        }

        channelsHook.setChannels(prev =>
            prev.map(ch => {
                if (!selectedChannels.includes(ch.id)) return ch;
                
                // Añadir prefijo solo si no lo tiene ya
                if (!ch.name.startsWith(prefixInput)) {
                    return { ...ch, name: `${prefixInput}${ch.name}` };
                }
                return ch;
            })
        );
        channelsHook.saveStateToHistory();
        setPrefixInput('');
    };

    const handleRemoveSuffix = () => {
        if (!suffixInput.trim()) {
            alert('Por favor, introduce un sufijo');
            return;
        }

        channelsHook.setChannels(prev =>
            prev.map(ch => {
                if (!selectedChannels.includes(ch.id)) return ch;
                
                // Si el nombre termina con el sufijo, eliminarlo
                if (ch.name.endsWith(suffixInput)) {
                    const newName = ch.name.substring(0, ch.name.length - suffixInput.length).trim();
                    return { ...ch, name: newName };
                }
                return ch;
            })
        );
        channelsHook.saveStateToHistory();
        setSuffixInput('');
    };

    const handleAddSuffix = () => {
        if (!suffixInput.trim()) {
            alert('Por favor, introduce un sufijo');
            return;
        }

        channelsHook.setChannels(prev =>
            prev.map(ch => {
                if (!selectedChannels.includes(ch.id)) return ch;
                
                // Añadir sufijo solo si no lo tiene ya
                if (!ch.name.endsWith(suffixInput)) {
                    return { ...ch, name: `${ch.name}${suffixInput}` };
                }
                return ch;
            })
        );
        channelsHook.saveStateToHistory();
        setSuffixInput('');
    };

    const getBestTmdbResult = (items: TmdbSearchItem[], query: string) => {
        if (items.length === 0) return null;
        const queryNormalized = query.trim().toLowerCase();
        const sorted = [...items].sort((a, b) => {
            const aName = (a.name || '').toLowerCase();
            const bName = (b.name || '').toLowerCase();
            const aExact = aName === queryNormalized;
            const bExact = bName === queryNormalized;

            if (aExact !== bExact) return aExact ? -1 : 1;
            if (a.popularity !== b.popularity) return b.popularity - a.popularity;
            return b.voteCount - a.voteCount;
        });
        return sorted[0];
    };

    const normalizeTmdbTitle = (value: string) => {
        let title = value.trim();
        title = title.replace(/[\u2018\u2019]/g, "'");
        title = title.replace(/[\u201C\u201D]/g, '"');
        title = title.replace(/\s+/g, ' ');
        return title.trim();
    };

    const extractYearFromTitle = (value: string): { title: string; year: number | null } => {
        const normalized = normalizeTmdbTitle(value);
        const yearMatch = normalized.match(/(?:\(|\[)?(19\d{2}|20\d{2})(?:\)|\])?\s*$/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
        const title = normalized
            .replace(/\s*(?:\(|\[)?(?:19\d{2}|20\d{2})(?:\)|\])?\s*$/, '')
            .trim();

        return {
            title: title || normalized,
            year,
        };
    };

    const generateTmdbQueryCandidates = (rawTitle: string): string[] => {
        const { title } = extractYearFromTitle(rawTitle);
        const candidates = new Set<string>();
        const normalized = normalizeTmdbTitle(rawTitle);
        const clean = normalizeTmdbTitle(title);

        if (clean) candidates.add(clean);
        if (normalized) candidates.add(normalized);

        if (clean.includes(':')) {
            const beforeColon = clean.split(':')[0].trim();
            if (beforeColon.length >= 3) candidates.add(beforeColon);
        }

        if (clean.includes('-')) {
            const beforeDash = clean.split('-')[0].trim();
            if (beforeDash.length >= 3) candidates.add(beforeDash);
        }

        return Array.from(candidates).filter(Boolean);
    };

    const searchTmdbWithFallbacks = async (
        rawQuery: string,
        mediaType: TmdbMediaType,
        apiKey: string
    ): Promise<TmdbSearchItem[]> => {
        const { year } = extractYearFromTitle(rawQuery);
        const candidates = generateTmdbQueryCandidates(rawQuery);
        const languageAttempts: Array<'en-US' | 'es-ES'> = ['en-US', 'es-ES'];

        for (const candidate of candidates) {
            for (const language of languageAttempts) {
                const params = new URLSearchParams({
                    api_key: apiKey,
                    query: candidate,
                    language,
                    page: '1',
                    include_adult: 'false',
                });

                if (year) {
                    if (mediaType === 'movie') {
                        params.set('year', String(year));
                    } else {
                        params.set('first_air_date_year', String(year));
                    }
                }

                const tmdbUrl = `https://api.themoviedb.org/3/search/${mediaType}?${params.toString()}`;
                const response = await fetch(tmdbUrl, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                    },
                });

                if (!response.ok) {
                    continue;
                }

                const data = (await response.json()) as {
                    results?: Array<{
                        id: number;
                        title?: string;
                        name?: string;
                        popularity?: number;
                        vote_count?: number;
                    }>;
                };

                const normalizedResults: TmdbSearchItem[] = (data.results || []).map((item) => ({
                    id: item.id,
                    name: item.title || item.name || '',
                    popularity: item.popularity || 0,
                    voteCount: item.vote_count || 0,
                }));

                if (normalizedResults.length > 0) {
                    return normalizedResults;
                }
            }
        }

        return [];
    };

    const getTmdbTargetChannels = () => channels.filter((ch) => ch.groupTitle === filterGroup);

    const runAssignTmdbIdsByGroup = async (mediaType: TmdbMediaType) => {
        const targetChannels = getTmdbTargetChannels();

        const mediaTypeLabel = mediaType === 'movie' ? 'Películas' : 'Series';
        const tmdbApiKey = settingsHook.tmdbApiKey.trim();
        const shouldContinue = confirm(
            `Se procesarán ${targetChannels.length} canales del grupo "${filterGroup}" buscando solo en ${mediaTypeLabel}.\n\n¿Continuar?`
        );

        if (!shouldContinue) return;

        setIsAssigningTmdbIds(true);
        setTmdbProgress({ processed: 0, total: targetChannels.length });

        const updates = new Map<string, string>();
        let processed = 0;
        let noQueryCount = 0;
        let notFoundCount = 0;
        let errorCount = 0;
        const concurrency = 3;

        try {
            for (let i = 0; i < targetChannels.length; i += concurrency) {
                const batch = targetChannels.slice(i, i + concurrency);

                await Promise.all(
                    batch.map(async (channel) => {
                        const query = (channel.tvgName || channel.name || '').trim();

                        if (!query) {
                            noQueryCount += 1;
                            processed += 1;
                            setTmdbProgress({ processed, total: targetChannels.length });
                            return;
                        }

                        try {
                            const normalizedResults = await searchTmdbWithFallbacks(query, mediaType, tmdbApiKey);
                            const bestResult = getBestTmdbResult(normalizedResults, query);

                            if (bestResult?.id) {
                                updates.set(channel.id, String(bestResult.id));
                            } else {
                                notFoundCount += 1;
                            }
                        } catch {
                            errorCount += 1;
                        } finally {
                            processed += 1;
                            setTmdbProgress({ processed, total: targetChannels.length });
                        }
                    })
                );
            }

            if (updates.size > 0) {
                channelsHook.setChannels((prev) =>
                    prev.map((ch) =>
                        updates.has(ch.id)
                            ? { ...ch, tvgId: updates.get(ch.id) || ch.tvgId }
                            : ch
                    )
                );
                channelsHook.saveStateToHistory();
            }

            alert(
                [
                    `Asignación TMDB completada para el grupo "${filterGroup}" (${mediaTypeLabel}).`,
                    `Actualizados: ${updates.size}`,
                    `Sin búsqueda (sin nombre): ${noQueryCount}`,
                    `Sin coincidencia: ${notFoundCount}`,
                    `Con error: ${errorCount}`,
                ].join('\n')
            );
        } finally {
            setIsAssigningTmdbIds(false);
            setTmdbProgress(null);
        }
    };

    const handleAssignTmdbIdsByGroup = () => {
        if (isAssigningTmdbIds) return;

        if (!settingsHook.tmdbApiKey?.trim()) {
            alert('Configura primero la API key de TMDB en Ajustes > Verificación.');
            return;
        }

        if (!filterGroup || filterGroup === 'Todos los canales') {
            alert('Selecciona un grupo específico en el filtro de grupo antes de usar esta acción.');
            return;
        }

        const targetChannels = getTmdbTargetChannels();
        if (targetChannels.length === 0) {
            alert('No hay canales en el grupo seleccionado.');
            return;
        }

        setShowTmdbTypeModal(true);
    };

    const handleSelectTmdbMediaType = (mediaType: TmdbMediaType) => {
        setShowTmdbTypeModal(false);
        void runAssignTmdbIdsByGroup(mediaType);
    };

    const gridTemplateColumns = useMemo(() => {
        const cols: string[] = [`${columnWidths.select}px`, `${columnWidths.order}px`];
        if (isColumnVisible('status')) cols.push(`${columnWidths.status}px`);
        if (isColumnVisible('tvgId')) cols.push(`${columnWidths.tvgId}px`);
        if (isColumnVisible('tvgName')) cols.push(`${columnWidths.tvgName}px`);
        if (isColumnVisible('tvgLogo')) cols.push(`${columnWidths.tvgLogo}px`);
        if (isColumnVisible('saveLogo')) cols.push(`${columnWidths.saveLogo}px`);
        if (isColumnVisible('groupTitle')) cols.push(`${columnWidths.groupTitle}px`);
        if (isColumnVisible('name')) cols.push(`${columnWidths.name}px`);
        if (isColumnVisible('url')) cols.push(`${columnWidths.url}px`);
        if (isColumnVisible('play')) cols.push(`${columnWidths.play}px`);
        return cols.join(' ');
    }, [columnWidths, visibleColumns, isSencillo]);

    return (
        <>
            {channels.length > 0 && (
                <div className="bg-gray-800 p-4 rounded-lg mb-4 shadow-lg flex flex-col gap-4">
                    {/* Upper Row: Editing Tools (Attributes & Name Mods) */}
                    {!isSencillo && selectedChannels.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Col 1: Attributes */}
                            <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600">
                                <span className="text-xs text-gray-400 font-semibold mb-2 block uppercase tracking-wider">Edición de Atributos</span>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={handleSwapIdName}
                                        className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-1 px-3 rounded text-xs border border-gray-500"
                                        title="Intercambia tvg-id por tvg-name"
                                    >
                                        Intercambiar ID ↔ Name
                                    </button>
                                    <button
                                        onClick={handleCopyIdToName}
                                        className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-1 px-3 rounded text-xs border border-gray-500"
                                        title="Copia tvg-id en tvg-name"
                                    >
                                        Copiar ID → Name
                                    </button>
                                    <button
                                        onClick={handleCopyNameToId}
                                        className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-1 px-3 rounded text-xs border border-gray-500"
                                        title="Copia tvg-name en tvg-id"
                                    >
                                        Copiar Name → ID
                                    </button>
                                    <button
                                        onClick={handleClearId}
                                        className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-1 px-3 rounded text-xs border border-gray-500"
                                        title="Borra tvg-id"
                                    >
                                        Eliminar ID
                                    </button>
                                    <button
                                        onClick={handleClearName}
                                        className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-1 px-3 rounded text-xs border border-gray-500"
                                        title="Borra tvg-name"
                                    >
                                        Eliminar Name
                                    </button>
                                </div>
                            </div>

                            {/* Col 2: Name Modifiers */}
                            <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600">
                                <span className="text-xs text-gray-400 font-semibold mb-2 block uppercase tracking-wider">Modificar Nombres</span>
                                <div className="space-y-2">
                                    {/* Prefijos */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={prefixInput}
                                            onChange={(e) => setPrefixInput(e.target.value)}
                                            placeholder="Prefijo (ej: HD )"
                                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs flex-grow focus:ring-blue-500 focus:border-blue-500 h-7"
                                        />
                                        <div className="flex gap-1">
                                            <button
                                                onClick={handleRemovePrefix}
                                                disabled={!prefixInput.trim()}
                                                className="bg-red-900/40 hover:bg-red-800 text-red-200 border border-red-800 font-medium py-1 px-2 rounded text-xs disabled:opacity-30 disabled:cursor-not-allowed h-7"
                                            >
                                                Quitar
                                            </button>
                                            <button
                                                onClick={handleAddPrefix}
                                                disabled={!prefixInput.trim()}
                                                className="bg-green-900/40 hover:bg-green-800 text-green-200 border border-green-800 font-medium py-1 px-2 rounded text-xs disabled:opacity-30 disabled:cursor-not-allowed h-7"
                                            >
                                                Añadir
                                            </button>
                                        </div>
                                    </div>
                                    {/* Sufijos */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={suffixInput}
                                            onChange={(e) => setSuffixInput(e.target.value)}
                                            placeholder="Sufijo (ej: 4K)"
                                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs flex-grow focus:ring-blue-500 focus:border-blue-500 h-7"
                                        />
                                         <div className="flex gap-1">
                                            <button
                                                onClick={handleRemoveSuffix}
                                                disabled={!suffixInput.trim()}
                                                className="bg-red-900/40 hover:bg-red-800 text-red-200 border border-red-800 font-medium py-1 px-2 rounded text-xs disabled:opacity-30 disabled:cursor-not-allowed h-7"
                                            >
                                                Quitar
                                            </button>
                                            <button
                                                onClick={handleAddSuffix}
                                                disabled={!suffixInput.trim()}
                                                className="bg-green-900/40 hover:bg-green-800 text-green-200 border border-green-800 font-medium py-1 px-2 rounded text-xs disabled:opacity-30 disabled:cursor-not-allowed h-7"
                                            >
                                                Añadir
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isSencillo && (
                        <div className="bg-indigo-900/20 p-3 rounded-lg border border-indigo-800/70">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider block">TMDB por grupo</span>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Procesa todos los canales del grupo seleccionado en el filtro y sobrescribe su tvg-id con TMDB.
                                    </p>
                                    {tmdbProgress && (
                                        <p className="text-xs text-indigo-200 mt-1">
                                            Procesando TMDB: {tmdbProgress.processed} / {tmdbProgress.total}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={handleAssignTmdbIdsByGroup}
                                    disabled={isAssigningTmdbIds || filterGroup === 'Todos los canales' || channels.length === 0}
                                    className="bg-indigo-700 hover:bg-indigo-600 text-white font-medium py-2 px-4 rounded text-sm border border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Pregunta tipo (películas/series) y asigna tvg-id con TMDB a todo el grupo filtrado"
                                >
                                    {isAssigningTmdbIds ? 'Buscando en TMDB...' : 'Asignar tvg-id TMDB al grupo'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bottom Row: Controls & Stats */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-gray-700">
                        {/* Left Side: Filter & History */}
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center">
                                <span className="text-xs text-gray-400 mr-2 uppercase tracking-wide font-semibold">Grupo</span>
                                <select
                                    id="group-filter"
                                    value={filterGroup}
                                    onChange={(e) => setFilterGroup(e.target.value)}
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 truncate"
                                >
                                    {uniqueGroups.map((group) => (
                                        <option key={group} value={group}>
                                            {group}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {!isSencillo && (
                                <div className="flex items-center">
                                    <span className="text-xs text-gray-400 mr-2 uppercase tracking-wide font-semibold">Dominio</span>
                                    <select
                                        id="domain-filter"
                                        value={mainDomainFilter}
                                        onChange={(e) => setMainDomainFilter(e.target.value)}
                                        className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 max-w-[220px] truncate"
                                    >
                                        {uniqueDomains.map((domain) => (
                                            <option key={domain} value={domain}>
                                                {domain}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex items-center">
                                <span className="text-xs text-gray-400 mr-2 uppercase tracking-wide font-semibold">Estado</span>
                                <select
                                    id="status-filter"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 truncate"
                                >
                                    <option value="Todos">Todos</option>
                                    <option value="Operativos">Operativos</option>
                                    <option value="Fallidos">Fallidos</option>
                                    <option value="Verificando">Verificando</option>
                                    <option value="Pendientes">Pendientes</option>
                                </select>
                            </div>

                            {!isSencillo && (history.length > 0 || redoHistory.length > 0) && (
                                <div className="flex items-center gap-1 bg-gray-700/50 rounded p-1 border border-gray-600">
                                    <button
                                        onClick={undo}
                                        disabled={history.length === 0}
                                        className="p-1.5 hover:bg-gray-600 rounded text-gray-300 hover:text-white disabled:opacity-30"
                                        title={`Deshacer (${history.length})`}
                                    >
                                        <Undo2 size={16} />
                                    </button>
                                    <div className="w-px h-4 bg-gray-600"></div>
                                    <button
                                        onClick={redo}
                                        disabled={redoHistory.length === 0}
                                        className="p-1.5 hover:bg-gray-600 rounded text-gray-300 hover:text-white disabled:opacity-30"
                                        title={`Rehacer (${redoHistory.length})`}
                                    >
                                        <Redo2 size={16} />
                                    </button>
                                </div>
                            )}

                             <span className={`text-sm ${selectedChannels.length > 0 ? 'text-yellow-400 font-semibold' : 'text-gray-500'}`}>
                                {selectedChannels.length} / {displayChannels.length} <span className="text-xs font-normal text-gray-500">seleccionados</span>
                                {(channelsHook.originalFileName || channelsHook.fileName) && (
                                     <span className="ml-2 pl-2 border-l border-gray-600 text-gray-400 font-normal italic">
                                        {channelsHook.originalFileName || channelsHook.fileName}
                                    </span>
                                )}
                            </span>
                        </div>

                        {/* Right Side: Actions */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleOpenCreateModal}
                                className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-1.5 px-3 rounded-md flex items-center text-sm border border-gray-600"
                            >
                                <Plus size={16} className="mr-2" /> Crear Canal
                            </button>

                            <div className="relative" ref={columnsDropdownRef}>
                                <button
                                    onClick={() => setShowColumnsDropdown(prev => !prev)}
                                    className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-1.5 px-3 rounded-md flex items-center text-sm border border-gray-600"
                                    title="Seleccionar columnas visibles"
                                >
                                    <SlidersHorizontal size={16} className="mr-2" /> Columnas
                                </button>

                                {showColumnsDropdown && (
                                    <div className="absolute right-0 mt-2 w-60 bg-gray-800 border border-gray-600 rounded-md shadow-xl z-30 p-3">
                                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">Columnas visibles</p>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {visibleColumnOptions.map((column) => (
                                                <label key={column.key} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={visibleColumns[column.key]}
                                                        onChange={(e) => {
                                                            const isChecked = e.target.checked;
                                                            if (column.key === 'name' && !isChecked) {
                                                                return;
                                                            }
                                                            setVisibleColumns(prev => ({
                                                                ...prev,
                                                                [column.key]: isChecked,
                                                            }));
                                                        }}
                                                        className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                                    />
                                                    <span>{column.label}</span>
                                                    {column.key === 'name' && (
                                                        <span className="text-[10px] text-gray-500 ml-auto">obligatoria</span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {selectedChannels.length > 0 && (
                                <button
                                    onClick={handleDeleteSelectedClick}
                                    className="bg-red-900/60 hover:bg-red-800 text-red-100 font-medium py-1.5 px-3 rounded-md flex items-center text-sm border border-red-800"
                                >
                                    <Trash2 size={16} className="mr-2" /> Eliminar ({selectedChannels.length})
                                </button>
                            )}

                            <button
                                onClick={() => {
                                    const next = !showNameSearch;
                                    setShowNameSearch(next);
                                    if (!next) setNameSearch('');
                                    else setTimeout(() => nameSearchRef.current?.focus(), 50);
                                }}
                                className={`p-2 rounded-full transition-colors ${showNameSearch ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-blue-400 hover:bg-gray-700'}`}
                                title="Buscar canal por nombre"
                            >
                                <Search size={20} />
                            </button>
                             <button
                                onClick={() => setShowTutorialModal(true)}
                                className="text-gray-400 hover:text-blue-400 p-2 rounded-full hover:bg-gray-700 transition-colors"
                                title="¿Cómo ordenar los canales?"
                            >
                                <HelpCircle size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Barra de búsqueda por nombre (Cambio #5) */}
                    {showNameSearch && (
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                            <Search size={15} className="text-blue-400 flex-shrink-0" />
                            <input
                                ref={nameSearchRef}
                                type="text"
                                placeholder="Buscar por nombre de canal..."
                                value={nameSearch}
                                onChange={(e) => setNameSearch(e.target.value)}
                                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            {nameSearch && (
                                <span className="text-xs text-blue-300 whitespace-nowrap">{displayChannels.length} resultado{displayChannels.length !== 1 ? 's' : ''}</span>
                            )}
                            <button
                                onClick={() => { setNameSearch(''); setShowNameSearch(false); }}
                                className="text-gray-500 hover:text-white p-1 rounded transition-colors"
                                title="Cerrar búsqueda"
                            >
                                <XIcon size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div ref={tableContainerRef} className="overflow-auto rounded-lg shadow-lg max-h-[70vh] bg-gray-900 border border-gray-700">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    {/* Header GRID */}
                     <div 
                        className="bg-gray-800 sticky top-0 z-10 border-b border-gray-600"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: gridTemplateColumns,
                            width: `${tableWidth}px` // Ensure header matches body scroll width
                        }}
                    >
                        <div style={{ width: `${columnWidths.select}px` }} className="px-2 py-2 flex justify-center items-center border-b border-gray-600">
                             <input
                                type="checkbox"
                                ref={selectAllCheckboxRef}
                                checked={filteredChannels.length > 0 && selectedChannels.length === filteredChannels.length}
                                onChange={handleSelectAll}
                                className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
                            />
                        </div>
                        <ResizableHeader width={columnWidths.order} onResize={(w) => handleResize('order', w)} align="center">
                            <button
                                onClick={handleOrderHeaderClick}
                                className={`w-full h-full cursor-pointer select-none flex items-center justify-center gap-1 ${filterGroup && filterGroup !== 'Todos los canales' ? 'hover:text-blue-300' : ''}`}
                                title={filterGroup && filterGroup !== 'Todos los canales' ? (showRelativeOrder ? 'Mostrar posición general' : 'Mostrar posición en el grupo') : ''}
                            >
                                Orden
                                {filterGroup && filterGroup !== 'Todos los canales' && showRelativeOrder && (
                                    <span className="text-[9px] text-blue-400 font-bold ml-0.5">(grupo)</span>
                                )}
                            </button>
                        </ResizableHeader>
                        {isColumnVisible('status') && (
                            <ResizableHeader width={columnWidths.status} onResize={(w) => handleResize('status', w)} align="center">
                                <button
                                    onClick={() => handleHeaderSortToggle('status')}
                                    className="w-full h-full cursor-pointer select-none text-center hover:text-blue-300"
                                    title={tableSortMode === 'status' ? 'Volver al orden original' : 'Ordenar por estado y calidad'}
                                >
                                    Estado
                                    {tableSortMode === 'status' && (
                                        <span className="ml-1 text-[9px] text-blue-400 font-bold">(ON)</span>
                                    )}
                                </button>
                            </ResizableHeader>
                        )}
                        {isColumnVisible('tvgId') && (
                            <ResizableHeader width={columnWidths.tvgId} onResize={(w) => handleResize('tvgId', w)} align="left">
                                <button
                                    onClick={() => handleHeaderSortToggle('tvgId')}
                                    className="w-full h-full cursor-pointer select-none text-left hover:text-blue-300"
                                    title={tableSortMode === 'tvgId' ? 'Volver al orden original' : 'Vacíos primero y luego A-Z'}
                                >
                                    tvg-id
                                    {tableSortMode === 'tvgId' && (
                                        <span className="ml-1 text-[9px] text-blue-400 font-bold">(A-Z)</span>
                                    )}
                                </button>
                            </ResizableHeader>
                        )}
                        {isColumnVisible('tvgName') && (
                            <ResizableHeader width={columnWidths.tvgName} onResize={(w) => handleResize('tvgName', w)} align="left">
                                <button
                                    onClick={() => handleHeaderSortToggle('tvgName')}
                                    className="w-full h-full cursor-pointer select-none text-left hover:text-blue-300"
                                    title={tableSortMode === 'tvgName' ? 'Volver al orden original' : 'Vacíos primero y luego A-Z'}
                                >
                                    tvg-name
                                    {tableSortMode === 'tvgName' && (
                                        <span className="ml-1 text-[9px] text-blue-400 font-bold">(A-Z)</span>
                                    )}
                                </button>
                            </ResizableHeader>
                        )}
                        {isColumnVisible('tvgLogo') && (
                            <ResizableHeader width={columnWidths.tvgLogo} onResize={(w) => handleResize('tvgLogo', w)} align="center">
                                <button
                                    onClick={() => handleHeaderSortToggle('tvgLogo')}
                                    className="w-full h-full cursor-pointer select-none text-center hover:text-blue-300"
                                    title={tableSortMode === 'tvgLogo' ? 'Volver al orden original' : 'Sin logo primero'}
                                >
                                    Logo
                                    {tableSortMode === 'tvgLogo' && (
                                        <span className="ml-1 text-[9px] text-blue-400 font-bold">(sin logo)</span>
                                    )}
                                </button>
                            </ResizableHeader>
                        )}
                        {isColumnVisible('saveLogo') && (
                            <div
                                className="px-1 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider"
                                style={{ width: `${columnWidths.saveLogo}px` }}
                                title="Guardar logo en Dropbox"
                            >
                                💾
                            </div>
                        )}
                        {isColumnVisible('groupTitle') && (
                            <ResizableHeader width={columnWidths.groupTitle} onResize={(w) => handleResize('groupTitle', w)} align="left">
                                Grupo
                            </ResizableHeader>
                        )}
                        {isColumnVisible('name') && (
                            <ResizableHeader width={columnWidths.name} onResize={(w) => handleResize('name', w)} align="left">
                                Nombre del Canal
                            </ResizableHeader>
                        )}
                        {isColumnVisible('url') && (
                            <ResizableHeader width={columnWidths.url} onResize={(w) => handleResize('url', w)} align="left">
                                <button
                                    onClick={handleUrlHeaderClick}
                                    className="w-full h-full text-left cursor-pointer select-none hover:text-blue-300"
                                    title={
                                        urlSortMode === 'none'
                                            ? 'Orden original'
                                            : urlSortMode === 'alpha'
                                                ? 'Orden alfabético por URL'
                                                : `Rotación por dominio (${domainCycleStep}/${domainOrder.length})`
                                    }
                                >
                                    URL del Stream
                                    {urlSortMode === 'alpha' && (
                                        <span className="ml-1 text-[9px] text-blue-400 font-bold">(A-Z)</span>
                                    )}
                                    {urlSortMode === 'domain-cycle' && (
                                        <span className="ml-1 text-[9px] text-blue-400 font-bold">(dom {domainCycleStep}/{domainOrder.length})</span>
                                    )}
                                </button>
                            </ResizableHeader>
                        )}
                        {isColumnVisible('play') && (
                            <div
                                className="px-2 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider"
                                style={{ width: `${columnWidths.play}px` }}
                            >
                                Probar
                            </div>
                        )}
                    </div>

                    {/* VIRTUALIZED BODY GRID */}
                    <SortableContext items={displayChannels.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        <div 
                            style={{ 
                                height: `${totalSize}px`, 
                                width: `${tableWidth}px`, 
                                position: 'relative' 
                            }}
                        >
                            {virtualItems.map((virtualItem) => {
                                const channel = displayChannels[virtualItem.index];
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
                                            <StatusIndicator status={channel.status} />
                                        }
                                        gridTemplateColumns={gridTemplateColumns}
                                        visibleColumns={visibleColumns}
                                        relativeOrder={showRelativeOrder && filterGroup && filterGroup !== 'Todos los canales' ? relativeOrderMap.get(channel.id) : undefined}
                                        measureRef={rowVirtualizer.measureElement}
                                        suggestions={{ groupTitle: uniqueGroups }}
                                        onPlayWebClick={(url) => setWebPlayerUrl(url)}
                                        onSaveLogo={(ch) => setSaveLogoChannel(ch)}
                                        style={{
                                            position: 'absolute',
                                            top: `${virtualItem.start}px`, // Use top instead of transform for virtualization
                                            left: 0,
                                            width: '100%',
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </SortableContext>
                    
                    <DragOverlay>
                        {activeChannel ? (
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
                                        <StatusIndicator status={activeChannel.status} />
                                    ) : null
                                }
                                gridTemplateColumns={gridTemplateColumns}
                                visibleColumns={visibleColumns}
                                suggestions={{ groupTitle: uniqueGroups }}
                                style={{ width: `${tableWidth}px` }} // Overlay matches table width
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
            {filteredChannels.length === 0 && channels.length > 0 && !isLoading && (
                <div className="text-center py-16 px-4 bg-gray-800 rounded-lg mt-6">
                    <h3 className="text-lg font-medium text-white">No hay canales en este grupo</h3>
                    <p className="mt-1 text-sm text-gray-400">
                        Ajusta los filtros de grupo, dominio o estado para ver más canales.
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

            {/* Modal Reproductor Web */}
            {webPlayerUrl && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
                    onClick={() => setWebPlayerUrl(null)}
                >
                    <div
                        className="relative w-full max-w-4xl mx-4"
                        style={{ aspectRatio: '16/9' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setWebPlayerUrl(null)}
                            className="absolute -top-9 right-0 text-white bg-gray-700 hover:bg-gray-600 rounded px-3 py-1 text-sm flex items-center gap-1 z-10"
                        >
                            ✕ Cerrar
                        </button>
                        <iframe
                            src={'/player.html?url=' + encodeURIComponent(webPlayerUrl)}
                            className="w-full h-full rounded-lg border border-gray-700"
                            allow="autoplay; fullscreen"
                            allowFullScreen
                        />
                    </div>
                </div>
            )}

            {showTmdbTypeModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowTmdbTypeModal(false)}
                >
                    <div
                        className="bg-gray-800 border border-indigo-700 rounded-lg p-5 w-full max-w-md"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-white mb-2">Tipo de contenido</h3>
                        <p className="text-sm text-gray-300 mb-5">
                            Elige si el grupo "{filterGroup}" corresponde a películas o series.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-end">
                            <button
                                onClick={() => setShowTmdbTypeModal(false)}
                                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md border border-gray-600"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleSelectTmdbMediaType('movie')}
                                className="bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-2 rounded-md border border-indigo-500"
                            >
                                Películas
                            </button>
                            <button
                                onClick={() => handleSelectTmdbMediaType('tv')}
                                className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-md border border-blue-500"
                            >
                                Series
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Guardar Logo en Dropbox */}
            {saveLogoChannel && (
                <SaveLogoModal
                    channel={saveLogoChannel}
                    dropboxAppKey={settingsHook.dropboxAppKey}
                    dropboxRefreshToken={settingsHook.dropboxRefreshToken}
                    onClose={() => setSaveLogoChannel(null)}
                />
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