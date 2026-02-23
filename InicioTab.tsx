import React, { useState, useEffect } from 'react';
import { Upload, Download, AlertCircle, Share2, Trash2, Link as LinkIcon, FileText, Settings, RefreshCw, Plus, Cloud, Database, FilePlus, List, Filter, Check, X, CheckSquare, Square, Search } from 'lucide-react';
import { useChannels } from './useChannels';
import { useSettings } from './useSettings';
import { getStorageItem, setStorageItem, removeStorageItem } from './utils/storage';

interface InicioTabProps {
    channelsHook: ReturnType<typeof useChannels>;
    settingsHook: ReturnType<typeof useSettings>;
    onNavigateToEditor: () => void;
    onNavigateToSettings?: () => void;
}

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type SubTab = 'load' | 'add-repair' | 'dropbox-lists' | 'repair-lists';

const InicioTab: React.FC<InicioTabProps> = ({ channelsHook, settingsHook, onNavigateToEditor, onNavigateToSettings }) => {
    const {
        url,
        setUrl,
        isLoading,
        error,
        handleFetchUrl,
        handleFileUpload,
    } = channelsHook;

    const { savedUrls, addSavedUrl, dropboxRefreshToken } = settingsHook;
    
    // UI State
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('load');
    
    // Estados base (mantenidos)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    
    // Estados para gestión de listas
    const [medicinaUrl, setMedicinaUrl] = useState('');
    const [isMedicinaLoading, setIsMedicinaLoading] = useState(false);
    const [medicinaError, setMedicinaError] = useState('');
    const [savedMedicinaLists, setSavedMedicinaLists] = useState<Array<{ id: string; name: string; url: string; content?: string }>>([]);
    const [savedDropboxLists, setSavedDropboxLists] = useState<Array<{ id: string; name: string; url: string; addedAt: string }>>([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [triggerLoad, setTriggerLoad] = useState(false);

    // Estados para Preview y Upload (Nueva funcionalidad)
    const [previewContent, setPreviewContent] = useState<{content: string, name: string, groups: string[]} | null>(null);
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');

    // Estados para búsqueda en Dropbox
    const [isSearchingDropbox, setIsSearchingDropbox] = useState(false);
    const [dropboxSearchResults, setDropboxSearchResults] = useState<Array<{name: string, path_lower: string, id: string, folder: 'root' | 'principales' | 'reparadoras'}>>([]);
    const [showDropboxSearchModal, setShowDropboxSearchModal] = useState(false);
    const [selectedDropboxFiles, setSelectedDropboxFiles] = useState<Set<string>>(new Set());
    const [dropboxSearchScope, setDropboxSearchScope] = useState<'all' | 'principales' | 'reparadoras'>('all');

    // --- Effects ---
    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setIsInstallable(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    useEffect(() => {
        const stored = getStorageItem('medicinaLists');
        if (stored) setSavedMedicinaLists(JSON.parse(stored));

        const storedDropbox = getStorageItem('dropboxLists');
        if (storedDropbox) setSavedDropboxLists(JSON.parse(storedDropbox));
        
        // Verificar si debemos navegar automáticamente a la pestaña de Dropbox
        const shouldNavigateToDropbox = getStorageItem('navigate_to_dropbox_lists');
        if (shouldNavigateToDropbox === 'true') {
            setActiveSubTab('dropbox-lists');
            removeStorageItem('navigate_to_dropbox_lists');
        }
    }, []);

    // Auto-load Logic
    useEffect(() => {
        if (triggerLoad && url) {
            handleFetchUrl();
            setTriggerLoad(false);
            onNavigateToEditor();
        }
    }, [triggerLoad, url, handleFetchUrl, onNavigateToEditor]);

    // --- Dropbox Helpers ---
    const getDropboxAccessToken = async () => {
        const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: settingsHook.dropboxRefreshToken,
                client_id: settingsHook.dropboxAppKey,
            }),
        });

        if (!response.ok) throw new Error('No se pudo obtener el token de acceso de Dropbox.');
        const data = await response.json();
        return data.access_token;
    };

    const handleUploadSelectionToDropbox = async (onlySelectedGroups: boolean) => {
        if (!previewContent || !settingsHook.dropboxRefreshToken) return;

        // Preguntar fecha de caducidad
        const expirationInput = prompt(
            "¿Cuándo caduca esta lista? (DD/MM/AAAA)\n\n" +
            "• Si introduces fecha: Se añadirá _EXP_DD_MM_YY al nombre.\n" +
            "• Si lo dejas vacío: Se añadirá _SUBIDA_DD_MM_YY (fecha de hoy)."
        );

        // Generar sufijo de fecha
        let dateSuffix = '';
        const now = new Date();
        const todayStr = `${String(now.getDate()).padStart(2, '0')}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getFullYear()).slice(-2)}`;

        if (expirationInput && expirationInput.trim().length > 0) {
            // Intentar parsear entrada
            const parts = expirationInput.trim().split(/[\/\-\.]/);
            if (parts.length >= 2) {
                const d = parts[0].padStart(2, '0');
                const m = parts[1].padStart(2, '0');
                let y = parts[2] || String(now.getFullYear());
                if (y.length === 4) y = y.slice(-2);
                dateSuffix = `EXP_${d}_${m}_${y}`;
            } else {
                // Fallback si no se entiende
                dateSuffix = `SUBIDA_${todayStr}`;
            }
        } else {
            // Vacío o CANCEL -> Fecha subir
            dateSuffix = `SUBIDA_${todayStr}`;
        }

        setIsUploading(true);
        setUploadStatus('Preparando subida...');

        try {
            let contentToUpload = previewContent.content;
            // Limpiar nombre base y extensión
            let baseName = previewContent.name.replace(/\.m3u8?$/i, '');

            if (onlySelectedGroups) {
                if (selectedGroups.size === 0) {
                    alert("Selecciona al menos un grupo");
                    setIsUploading(false);
                    return;
                }

                // Filtrar contenido
                setUploadStatus('Filtrando canales...');
                const lines = previewContent.content.split('\n');
                let newContent = ['#EXTM3U'];
                let currentItem: string[] = [];
                let includeCurrent = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith('#EXTINF')) {
                        // Nuevo item, procesar anterior
                        if (includeCurrent && currentItem.length > 0) {
                            newContent.push(...currentItem);
                        }
                        
                        // Reset para nuevo item
                        currentItem = [line];
                        const groupMatch = line.match(/group-title="([^"]*)"/);
                        const group = groupMatch ? groupMatch[1] : 'Sin Grupo';
                        includeCurrent = selectedGroups.has(group);
                    } else if (line.startsWith('#') && !line.startsWith('#EXTM3U')) {
                        // Metadata extra
                        currentItem.push(line);
                    } else if (line.length > 0) {
                        // URL
                        currentItem.push(line);
                        // Fin del item logico (asumiendo formato standard)
                        if (includeCurrent) {
                            newContent.push(...currentItem);
                        }
                        currentItem = [];
                        includeCurrent = false;
                    }
                }
                contentToUpload = newContent.join('\n');
                baseName = `${baseName}_filtrada`;
            } 
            
            // Construir nombre final con sufijo de fecha
            const filename = `${baseName}_${dateSuffix}.m3u`;

            setUploadStatus('Obteniendo token...');
            const accessToken = await getDropboxAccessToken();

            setUploadStatus('Subiendo archivo...');
            const folder = activeSubTab === 'add-repair' ? 'Listas Reparadoras' : 'Listas Principales';
            const uploadPath = `/${folder}/${filename}`;

            const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({
                        path: uploadPath,
                        mode: 'add',
                        autorename: true,
                        mute: false
                    }),
                    'Content-Type': 'application/octet-stream',
                },
                body: contentToUpload,
            });

            if (!response.ok) throw new Error('Falló la subida a Dropbox');
            
            const data = await response.json();
            
            // Crear link compartido
            setUploadStatus('Generando enlace...');
            const shareResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: data.path_display }),
            });

            let sharedUrl = '';
            if (shareResponse.ok) {
                const shareData = await shareResponse.json();
                sharedUrl = shareData.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'dl=1');
            } else {
                 // Intentar obtener existente
                 const listLinks = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: data.path_display }),
                });
                if(listLinks.ok) {
                    const existing = await listLinks.json();
                     if (existing.links?.length > 0) {
                         sharedUrl = existing.links[0].url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'dl=1');
                     }
                }
            }

            if (sharedUrl) {
                const newList = {
                    id: Date.now().toString(),
                    name: filename,
                    url: sharedUrl,
                    addedAt: new Date().toISOString()
                };

                if (activeSubTab === 'add-repair') {
                     // Guardar en mis listas reparadoras
                     const currentLists = JSON.parse(getStorageItem('medicinaLists') || '[]');
                     const updated = [...currentLists, newList];
                     setSavedMedicinaLists(updated);
                     setStorageItem('medicinaLists', JSON.stringify(updated));
                     alert('¡Subido a Dropbox y añadido a tus listas reparadoras!');
                } else {
                    // Guardar en mis listas dropbox (Default)
                    const currentLists = JSON.parse(getStorageItem('dropboxLists') || '[]');
                    const updated = [...currentLists, newList];
                    setSavedDropboxLists(updated);
                    setStorageItem('dropboxLists', JSON.stringify(updated));
                    alert('¡Subido a Dropbox y añadido a tus listas principales!');
                }

                setPreviewContent(null); // Reset UI
            } else {
                alert('Subido a Dropbox pero no se pudo generar enlace.');
            }

        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setIsUploading(false);
            setUploadStatus('');
        }
    };

    const handleSearchDropbox = async (scope: 'all' | 'principales' | 'reparadoras' = 'all') => {
        if (!settingsHook.dropboxRefreshToken) {
            alert("Debes conectar tu cuenta de Dropbox en Ajustes primero.");
            if (onNavigateToSettings) onNavigateToSettings();
            return;
        }

        setDropboxSearchScope(scope);
        setIsSearchingDropbox(true);
        setDropboxSearchResults([]);
        setSelectedDropboxFiles(new Set());
        setShowDropboxSearchModal(true);

        try {
            const accessToken = await getDropboxAccessToken();

            const isM3U = (name: string) => /\.(m3u8?)$/i.test(name);

            const listFolder = async (path: string): Promise<any[]> => {
                try {
                    const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path, recursive: false }),
                    });
                    if (!res.ok) return [];
                    const data = await res.json();
                    return data.entries || [];
                } catch { return []; }
            };

            type FolderKey = 'root' | 'principales' | 'reparadoras';
            const results: Array<{name: string, path_lower: string, id: string, folder: FolderKey}> = [];

            const addEntries = (entries: any[], folder: FolderKey) => {
                entries.filter(e => e['.tag'] === 'file' && isM3U(e.name)).forEach(e => {
                    results.push({ name: e.name, path_lower: e.path_lower, id: e.id, folder });
                });
            };

            if (scope === 'all') {
                const [rootEntries, principalesEntries, reparadorasEntries] = await Promise.all([
                    listFolder(''),
                    listFolder('/Listas Principales'),
                    listFolder('/Listas Reparadoras'),
                ]);
                addEntries(rootEntries, 'root');
                addEntries(principalesEntries, 'principales');
                addEntries(reparadorasEntries, 'reparadoras');
            } else if (scope === 'principales') {
                const entries = await listFolder('/Listas Principales');
                addEntries(entries, 'principales');
            } else {
                const entries = await listFolder('/Listas Reparadoras');
                addEntries(entries, 'reparadoras');
            }

            setDropboxSearchResults(results);
        } catch (e) {
            console.error(e);
            alert('Error buscando listas en Dropbox');
        } finally {
            setIsSearchingDropbox(false);
        }
    };

    const getOrCreateSharedUrl = async (accessToken: string, filePath: string): Promise<string> => {
        const shareRes = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath }),
        });
        if (shareRes.ok) {
            const d = await shareRes.json();
            return d.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'dl=1');
        }
        // Link already exists — retrieve it
        const listRes = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath }),
        });
        if (listRes.ok) {
            const d = await listRes.json();
            if (d.links?.length > 0)
                return d.links[0].url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('dl=0', 'dl=1');
        }
        return '';
    };

    const handleAddSelectedFromDropbox = async (targetFolder: 'principales' | 'reparadoras') => {
        const filesToAdd = dropboxSearchResults.filter(f => selectedDropboxFiles.has(f.id));
        if (filesToAdd.length === 0) { alert('Selecciona al menos una lista.'); return; }

        setIsSearchingDropbox(true);
        try {
            const accessToken = await getDropboxAccessToken();
            
            const newPrincipales: any[] = [];
            const newReparadoras: any[] = [];

            for (const file of filesToAdd) {
                let filePath = file.path_lower;

                // Si está en la raíz, moverla a la carpeta destino
                if (file.folder === 'root') {
                    const destFolder = targetFolder === 'principales' ? '/Listas Principales' : '/Listas Reparadoras';
                    const moveRes = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ from_path: file.path_lower, to_path: `${destFolder}/${file.name}`, autorename: true }),
                    });
                    if (moveRes.ok) {
                        const moveData = await moveRes.json();
                        filePath = moveData.metadata.path_lower;
                    }
                }

                const sharedUrl = await getOrCreateSharedUrl(accessToken, filePath);
                if (!sharedUrl) continue;

                if (targetFolder === 'principales') {
                    newPrincipales.push({ id: `${Date.now()}-${Math.random()}`, name: file.name, url: sharedUrl, addedAt: new Date().toISOString() });
                } else {
                    newReparadoras.push({ id: `${Date.now()}-${Math.random()}`, name: file.name, url: sharedUrl, content: '' });
                }
            }

            if (targetFolder === 'principales' && newPrincipales.length > 0) {
                setSavedDropboxLists(prev => {
                    const updated = [...prev, ...newPrincipales];
                    localStorage.setItem('dropboxLists', JSON.stringify(updated));
                    return updated;
                });
            } else if (targetFolder === 'reparadoras' && newReparadoras.length > 0) {
                setSavedMedicinaLists(prev => {
                    const updated = [...prev, ...newReparadoras];
                    localStorage.setItem('medicinaLists', JSON.stringify(updated));
                    return updated;
                });
            }

            setShowDropboxSearchModal(false);
            setSelectedDropboxFiles(new Set());
        } catch (e) {
            alert((e as Error).message);
        } finally {
            setIsSearchingDropbox(false);
        }
    };

    // --- Parsing Helpers ---
    const parseGroups = (content: string) => {
        const groupSet = new Set<string>();
        const lines = content.split('\n');
        lines.forEach(line => {
             const match = line.match(/group-title="([^"]*)"/);
             if (match) groupSet.add(match[1]);
        });
        return Array.from(groupSet).sort();
    };

    // --- Handlers ---

    const loadList = async (item: { url: string; content?: string; name: string }) => {
        if (isLoading) return;

        if (item.url === 'local' && item.content) {
            try {
                const file = new File([item.content], `${item.name}.m3u`, { type: 'text/plain' });
                // @ts-ignore
                await handleFileUpload({ target: { files: [file] } } as any);
                setShowSuccessModal(true);
            } catch (e) {
                console.error("Error cargando lista local", e);
                alert("Error cargando lista local");
            }
        } else {
            selectAndLoad(item.url);
        }
    };

    const selectAndLoad = (u: string) => {
        setUrl(u);
        setTriggerLoad(true);
    };

    const normalizeIptvUrl = (rawUrl: string): { fetchUrl: string; suggestedName: string } => {
        let fetchUrl = rawUrl.trim();
        let suggestedName = 'Lista Reparadora';

        try {
            const u = new URL(fetchUrl);

            // --- Xtream Codes V1: /get.php?username=X&password=Y ---
            const isXtreamV1 = u.pathname.endsWith('/get.php') && u.searchParams.has('username') && u.searchParams.has('password');
            if (isXtreamV1) {
                // Ensure type=m3u_plus for maximum compatibility
                if (!u.searchParams.get('type')) {
                    u.searchParams.set('type', 'm3u_plus');
                }
                // Some panels use 'output' instead of 'type'
                if (u.searchParams.has('output') && !u.searchParams.has('type')) {
                    u.searchParams.set('type', u.searchParams.get('output')!);
                }
                // Force m3u_plus format
                u.searchParams.set('type', 'm3u_plus');
                fetchUrl = u.toString();
                suggestedName = `Xtream-${u.searchParams.get('username') || u.hostname}`;
                return { fetchUrl, suggestedName };
            }

            // --- Xtream Codes V2: /username/password[/type] ---
            // Pattern: host:port/user/pass or host:port/user/pass/m3u_plus
            const parts = u.pathname.split('/').filter(Boolean);
            const isXtreamV2 =
                parts.length >= 2 &&
                !fetchUrl.includes('get.php') &&
                !fetchUrl.endsWith('.m3u') &&
                !fetchUrl.endsWith('.m3u8') &&
                !fetchUrl.endsWith('.txt') &&
                (u.searchParams.size === 0 || (u.searchParams.has('username') && u.searchParams.has('password')));

            if (isXtreamV2 && parts.length >= 2) {
                // Could be /username/password or /username/password/type
                const [username, password] = parts;
                const base = `${u.protocol}//${u.host}`;
                fetchUrl = `${base}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus`;
                suggestedName = `Xtream-${username}`;
                return { fetchUrl, suggestedName };
            }

            // --- Standard URL: extract name from path or query params ---
            // Check for username in query params (some panels)
            const user = u.searchParams.get('username') || u.searchParams.get('user');
            if (user) {
                suggestedName = `Lista-${user}`;
            } else {
                const pathParts = u.pathname.split('/');
                const last = pathParts[pathParts.length - 1];
                if (last && last !== 'get.php') {
                    suggestedName = last.replace(/\.(m3u8?|txt)$/i, '') || u.hostname;
                } else {
                    suggestedName = u.hostname;
                }
            }
        } catch (_) {
            // Invalid URL — leave as-is, proxy will report the error
        }

        return { fetchUrl, suggestedName };
    };

    const handleMedicinaUrlLoad = async () => {
        if (!medicinaUrl) return;
        setIsMedicinaLoading(true);
        setMedicinaError('');
        try {
            const { fetchUrl, suggestedName } = normalizeIptvUrl(medicinaUrl);

            const proxyUrl = `/api/proxy?url=${encodeURIComponent(fetchUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            const content = await response.text();

            // Validate it's actually an M3U playlist
            const trimmed = content.trimStart();
            if (!trimmed.startsWith('#EXTM3U') && !trimmed.startsWith('#EXT')) {
                throw new Error('La respuesta no es una lista M3U válida. Comprueba la URL.');
            }

            const rawName = prompt('Nombre para lista:', suggestedName);
            if (!rawName) return;

            const name = rawName.replace(/\s+/g, '-');
            const groups = parseGroups(content);

            setPreviewContent({ content, name, groups });
            setMedicinaUrl('');
        } catch (e) {
            setMedicinaError(e instanceof Error ? e.message : 'Error al cargar lista. Verifica la URL.');
        } finally {
            setIsMedicinaLoading(false);
        }
    };
    
    const handleMedicinaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsMedicinaLoading(true);
        try {
            const content = await file.text();
            const rawName = prompt('Nombre para esta lista medicina:', file.name.replace(/\.(m3u8?|txt)$/i, ''));
            if (!rawName) return;

            const name = rawName.replace(/\s+/g, '-');
            const groups = parseGroups(content);
            
            setPreviewContent({ content, name, groups });
        } catch (err) {
            setMedicinaError('Error al leer el archivo.');
        } finally {
            setIsMedicinaLoading(false);
            e.target.value = '';
        }
    };

    const handleSavePreviewLocally = () => {
        if (!previewContent) return;
        const newList = {
            id: Date.now().toString(),
            name: previewContent.name,
            url: 'local',
            content: previewContent.content
        };
        const updated = [...savedMedicinaLists, newList];
        setSavedMedicinaLists(updated);
        localStorage.setItem('medicinaLists', JSON.stringify(updated));
        alert('Guardada localmente');
        setPreviewContent(null);
    };

    const handleDeleteList = async (type: 'dropbox' | 'medicina', id: string, name?: string) => {
        if (!confirm('¿Estás seguro de eliminar esta lista de la PWA?')) return;
        
        // Si tenemos nombre y token, intentamos mover a papelera de Dropbox
        if (settingsHook.dropboxRefreshToken && name && confirm('¿Quieres mover también el archivo original a la carpeta "Listas Eliminadas" de Dropbox?')) {
            try {
                const accessToken = await getDropboxAccessToken();
                const trashFolder = '/Listas Eliminadas';
                const filename = name.endsWith('.m3u') || name.endsWith('.m3u8') ? name : `${name}.m3u`;
                
                // Determinar carpeta origen probable
                const originFolder = type === 'medicina' ? '/Listas Reparadoras' : '/Listas Principales';
                const pathInFolder = `${originFolder}/${filename}`;
                const pathInRoot = `/${filename}`;
                const destinationPath = `${trashFolder}/${filename}`;

                // Función helper para intentar mover
                const tryMove = async (fromPath: string) => {
                    // Usar nuestro endpoint API local
                    const res = await fetch('/api/dropbox_move', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accessToken, fromPath, toPath: destinationPath })
                    });
                     // 404 manejado por la API retornando status 404
                    if (res.status === 404) throw new Error('Not found');
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error_summary || 'Error desconocido');
                    }
                    return await res.json();
                };

                let movedToTrash = false;
                try {
                    // Intento 1: En carpeta organizada
                    await tryMove(pathInFolder);
                    movedToTrash = true;
                } catch (e) {
                    // Intento 2: En raíz (legacy)
                    try {
                        await tryMove(pathInRoot);
                        movedToTrash = true;
                    } catch (e2) {
                        console.warn('No se pudo encontrar el archivo en Dropbox para moverlo.', e2);
                        alert(`No se pudo encontrar "${filename}" en Dropbox (ni en ${originFolder} ni en raíz). Se borrará solo de la PWA.`);
                    }
                }
                
                if (movedToTrash) {
                    alert(`Archivo movido a "${trashFolder}" en Dropbox exitosamente.`);
                }

            } catch (error: any) {
                console.error('Error al intentar mover a papelera Dropbox:', error);
                alert('Hubo un error al intentar comunicar con Dropbox. Se procederá a borrar solo de la PWA.');
            }
        }

        if (type === 'dropbox') {
            const upd = savedDropboxLists.filter(l => l.id !== id);
            setSavedDropboxLists(upd);
            localStorage.setItem('dropboxLists', JSON.stringify(upd));
        } else {
            const upd = savedMedicinaLists.filter(l => l.id !== id);
            setSavedMedicinaLists(upd);
            localStorage.setItem('medicinaLists', JSON.stringify(upd));
        }
    };

    const handleShare = async (u: string) => {
        try {
            await navigator.clipboard.writeText(u);
            alert('Enlace copiado');
        } catch (e) {
            alert('No se pudo copiar');
        }
    };

    const SidebarButton = ({ icon, active, onClick, tooltip }: { icon: React.ReactNode, active: boolean, onClick: () => void, tooltip: string }) => (
        <button
            onClick={onClick}
            className={`p-3 rounded-lg transition-all duration-200 group relative flex items-center justify-center ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            title={tooltip}
        >
            {icon}
             {/* Tooltip on right */}
        </button>
    );

    return (
        <div className="flex h-[calc(100vh-80px)] bg-gray-900 overflow-hidden">
            {/* --- SIDEBAR --- */}
            <div className="w-16 flex flex-col items-center py-6 bg-gray-800 border-r border-gray-700 gap-4 z-10 shrink-0">
                <SidebarButton 
                    icon={<Download size={24} />} 
                    active={activeSubTab === 'load'} 
                    onClick={() => setActiveSubTab('load')}
                    tooltip="Cargar Listas" 
                />
                <SidebarButton 
                    icon={<FilePlus size={24} />} 
                    active={activeSubTab === 'add-repair'} 
                    onClick={() => setActiveSubTab('add-repair')} 
                    tooltip="Añadir L. Reparadora"
                />
                <SidebarButton 
                    icon={<img src="/Dropbox_Icon.svg" alt="Dropbox" className={`w-6 h-6 transition-opacity ${activeSubTab === 'dropbox-lists' ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`} style={{ filter: (!dropboxRefreshToken && activeSubTab !== 'dropbox-lists') ? 'grayscale(100%)' : '' }} />} 
                    active={activeSubTab === 'dropbox-lists'} 
                    onClick={() => setActiveSubTab('dropbox-lists')} 
                    tooltip="Mis Listas Dropbox"
                />
                <SidebarButton 
                    icon={<List size={24} />} 
                    active={activeSubTab === 'repair-lists'} 
                    onClick={() => setActiveSubTab('repair-lists')} 
                    tooltip="Mis Listas Reparadoras"
                />
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="flex-1 bg-gray-900 p-2 sm:p-6 md:p-8 overflow-y-auto w-full custom-scrollbar">
                
                {/* 1. CARGA (Load Screen) */}
                {activeSubTab === 'load' && (
                    <div className="max-w-4xl mx-auto space-y-3 md:space-y-6 animate-fadeIn pt-2 sm:pt-4">
                         <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3 text-white">
                                <Download size={24} className="sm:w-7 sm:h-7 text-blue-400" />
                                Cargar Lista Principal
                            </h2>
                             <div className="flex gap-2">
                                <button
                                    onClick={() => handleSearchDropbox('all')}
                                    disabled={isSearchingDropbox}
                                    className={`px-2 py-1.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 shadow-sm transition-all ${dropboxRefreshToken ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-75'}`}
                                    title={dropboxRefreshToken ? "Buscar archivos .m3u en tu Dropbox" : "Conecta Dropbox para buscar"}
                                >
                                    <Search className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Buscar en Dropbox</span><span className="xs:hidden">Buscar</span>
                                </button>
                            </div>
                        </div>

                        {/* Connection Status Card */}
                        <div className={`p-3 sm:p-4 rounded-xl border ${dropboxRefreshToken ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/30'} transition-colors`}>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${dropboxRefreshToken ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        <img src="/Dropbox_Icon.svg" className="w-6 h-6 sm:w-8 sm:h-8" style={{ filter: dropboxRefreshToken ? 'none' : 'grayscale(100%)' }} />
                                    </div>
                                    <div>
                                        <h2 className={`font-bold text-base sm:text-lg ${dropboxRefreshToken ? 'text-green-400' : 'text-red-400'}`}>
                                            {dropboxRefreshToken ? 'Conectado a Dropbox' : 'Desconectado'}
                                        </h2>
                                        <p className="text-xs sm:text-sm text-gray-400">
                                            {dropboxRefreshToken ? 'Sincronización activa' : 'Conecta para guardar listas'}
                                        </p>
                                    </div>
                                </div>
                                {!dropboxRefreshToken && (
                                    <button onClick={onNavigateToSettings} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-xs sm:text-sm whitespace-nowrap">
                                        Conectar
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Load Area */}
                        <div className="bg-gray-800/50 rounded-xl p-4 sm:p-6 border border-gray-700 shadow-xl">
                            {dropboxRefreshToken && savedDropboxLists.length > 0 && (
                                <div className="mb-4 animate-fadeIn">
                                    <label className="block text-[10px] sm:text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                                        Tus listas en Dropbox
                                    </label>
                                    <div className="relative group">
                                        <select
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-3 pr-8 py-2 text-sm sm:text-base text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none cursor-pointer hover:bg-gray-800 transition-colors"
                                            onChange={(e) => {
                                                const listId = e.target.value;
                                                const list = savedDropboxLists.find(l => l.id === listId);
                                                if (list) {
                                                    loadList(list);
                                                }
                                            }}
                                            value=""
                                        >
                                            <option value="" disabled>Selecciona una lista...</option>
                                            {savedDropboxLists.map(list => (
                                                <option key={list.id} value={list.id}>
                                                    {list.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500 group-hover:text-blue-400 transition-colors">
                                            <Cloud size={16} />
                                        </div>
                                    </div>
                                    
                                    <div className="relative flex py-3 items-center">
                                        <div className="flex-grow border-t border-gray-700"></div>
                                        <span className="flex-shrink-0 mx-2 text-gray-500 text-[10px] uppercase tracking-widest">O URL externa</span>
                                        <div className="flex-grow border-t border-gray-700"></div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 mb-4">
                                <div className="relative flex-grow">
                                    <LinkIcon size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                                    <input 
                                        type="text" 
                                        value={url} 
                                        onChange={e => setUrl(e.target.value)}
                                        placeholder="Pegar URL de lista..."
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm sm:text-base text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <button 
                                    onClick={() => handleFetchUrl()}
                                    disabled={isLoading || !url}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 text-sm"
                                >
                                    {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
                                    <span className="hidden sm:inline">Cargar</span>
                                </button>
                            </div>
                            
                            <div className="relative flex py-3 items-center">
                                <div className="flex-grow border-t border-gray-700"></div>
                                <span className="flex-shrink-0 mx-2 text-gray-500 text-[10px] uppercase tracking-widest">O archivo local</span>
                                <div className="flex-grow border-t border-gray-700"></div>
                            </div>

                            <div className="flex justify-center">
                                <input id="file-upload-main" type="file" className="hidden" onChange={async (e) => { await handleFileUpload(e); setShowSuccessModal(true); }} accept=".m3u,.m3u8" />
                                <label htmlFor="file-upload-main" className="cursor-pointer group flex flex-col items-center gap-1 sm:gap-2 p-4 sm:p-6 border-2 border-dashed border-gray-700 rounded-xl hover:border-blue-500/50 hover:bg-blue-900/10 transition-all w-full">
                                    <div className="p-3 rounded-full bg-gray-800 group-hover:bg-blue-600 transition-colors">
                                        <Upload size={20} className="text-gray-400 group-hover:text-white" />
                                    </div>
                                    <span className="text-gray-300 font-medium group-hover:text-white text-sm">Seleccionar archivo</span>
                                    <span className="text-gray-500 text-xs">.m3u, .m3u8</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. AÑADIR REPARADORA (Add Repair Screen) */}
                {activeSubTab === 'add-repair' && (
                    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
                        {previewContent ? (
                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg space-y-6">
                                <div className="text-center border-b border-gray-700 pb-4">
                                    <h3 className="text-xl font-bold text-white mb-1">Previsualización de Lista</h3>
                                    <p className="text-gray-400 text-sm">{previewContent.name}</p>
                                    <div className="mt-2 text-xs bg-gray-900 inline-block px-3 py-1 rounded text-gray-300">
                                        {previewContent.groups.length} grupos detectados
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                              <Filter size={16} className="text-purple-400" />
                                              Filtrar categorías para subir
                                          </label>
                                          <div className="flex gap-2">
                                              <button 
                                                onClick={() => setSelectedGroups(new Set(previewContent.groups))}
                                                className="text-xs text-blue-400 hover:text-blue-300"
                                              >
                                                  Todas
                                              </button>
                                              <button 
                                                onClick={() => setSelectedGroups(new Set())}
                                                className="text-xs text-gray-500 hover:text-gray-300"
                                              >
                                                  Ninguna
                                              </button>
                                          </div>
                                    </div>
                                    
                                    <div className="max-h-60 overflow-y-auto bg-gray-900 rounded p-4 border border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {previewContent.groups.map(group => (
                                            <div key={group} 
                                                 onClick={() => {
                                                     const next = new Set(selectedGroups);
                                                     if (next.has(group)) next.delete(group);
                                                     else next.add(group);
                                                     setSelectedGroups(next);
                                                 }}
                                                 className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selectedGroups.has(group) ? 'bg-purple-900/30 border border-purple-500/30' : 'hover:bg-gray-800 border border-transparent'}`}
                                            >
                                                {selectedGroups.has(group) ? <CheckSquare size={16} className="text-purple-400 shrink-0" /> : <Square size={16} className="text-gray-600 shrink-0" />}
                                                <span className={`text-sm truncate ${selectedGroups.has(group) ? 'text-white' : 'text-gray-400'}`}>{group || 'Sin Grupo'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 border-t border-gray-700 pt-6">
                                    {/* Opciones de Dropbox */}
                                    {settingsHook.dropboxRefreshToken ? (
                                        <div className="grid grid-cols-2 gap-3">
                                             <button
                                                onClick={() => handleUploadSelectionToDropbox(true)}
                                                disabled={isUploading}
                                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                                            >
                                                {isUploading ? <RefreshCw className="animate-spin" size={16} /> : <Filter size={16} />}
                                                Subir Selección
                                            </button>
                                            <button
                                                onClick={() => handleUploadSelectionToDropbox(false)}
                                                disabled={isUploading}
                                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                                            >
                                                {isUploading ? <RefreshCw className="animate-spin" size={16} /> : <Cloud size={16} />}
                                                Subir Completa
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-yellow-900/20 text-yellow-500 text-sm text-center rounded border border-yellow-900/30">
                                            Conecta Dropbox en Ajustes para subir listas
                                        </div>
                                    )}

                                    {/* Opción Local Standard */}
                                    <button
                                        onClick={handleSavePreviewLocally}
                                        disabled={isUploading}
                                        className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        <Database size={16} />
                                        Guardar en Local (Solo PWA)
                                    </button>

                                    {/* Cancelar */}
                                    <button
                                        onClick={() => setPreviewContent(null)}
                                        disabled={isUploading}
                                        className="w-full text-gray-500 hover:text-white py-2 text-xs"
                                    >
                                        Cancelar operación
                                    </button>
                                </div>
                                
                                {uploadStatus && (
                                    <div className="text-center text-sm text-purple-300 animate-pulse">
                                        {uploadStatus}
                                    </div>
                                )}

                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3 text-white">
                                        <FilePlus size={24} className="sm:w-7 sm:h-7 text-purple-400" />
                                        Añadir Lista Reparadora
                                    </h2>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSearchDropbox('all')}
                                            disabled={isSearchingDropbox}
                                            className={`px-2 py-1.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 shadow-sm transition-all ${dropboxRefreshToken ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-75'}`}
                                            title={dropboxRefreshToken ? "Buscar archivos .m3u en tu Dropbox" : "Conecta Dropbox para buscar"}
                                        >
                                            <Search className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Buscar en Dropbox</span><span className="xs:hidden">Buscar</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700 shadow-lg">
                                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">Desde URL</label>
                                    <div className="flex gap-2 mb-4">
                                        <input
                                            type="text"
                                            value={medicinaUrl}
                                            onChange={(e) => setMedicinaUrl(e.target.value)}
                                            placeholder="https://..."
                                            className="flex-grow bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm sm:text-base text-white focus:ring-purple-500 focus:border-purple-500"
                                        />
                                        <button
                                            onClick={handleMedicinaUrlLoad}
                                            disabled={isMedicinaLoading || !medicinaUrl}
                                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md disabled:bg-gray-600 text-sm whitespace-nowrap"
                                        >
                                            {isMedicinaLoading ? '...' : 'Analizar'}
                                        </button>
                                    </div>

                                    <div className="relative flex py-2 items-center mb-4">
                                        <div className="flex-grow border-t border-gray-700"></div>
                                        <span className="flex-shrink-0 mx-2 text-gray-500 text-[10px] uppercase">O archivo local</span>
                                        <div className="flex-grow border-t border-gray-700"></div>
                                    </div>
                                    
                                    <div className="flex justify-center">
                                        <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg w-full text-center border border-gray-500 border-dashed transition-all">
                                            <span className="flex items-center justify-center gap-2 text-sm">
                                                <Upload size={16} /> Subir archivo .m3u
                                            </span>
                                            <input type="file" className="hidden" onChange={handleMedicinaFileUpload} accept=".m3u,.m3u8" />
                                        </label>
                                    </div>

                                    {medicinaError && (
                                        <div className="mt-4 p-2 bg-red-900/30 border border-red-900/50 rounded text-red-400 text-xs flex items-center gap-2">
                                            <AlertCircle size={14} /> {medicinaError}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* 3. LISTAS DROPBOX (Dropbox Lists Table) */}
                {activeSubTab === 'dropbox-lists' && (
                    <div className="max-w-4xl mx-auto animate-fadeIn pt-2 sm:pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
                                <img src="/Dropbox_Icon.svg" className="w-6 h-6 sm:w-8 sm:h-8" />
                                Mis Listas de Dropbox
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSearchDropbox('principales')}
                                    disabled={isSearchingDropbox}
                                    className={`px-2 py-1.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 shadow-sm transition-all ${dropboxRefreshToken ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-75'}`}
                                    title={dropboxRefreshToken ? "Buscar archivos .m3u en /Listas Principales" : "Conecta Dropbox para buscar"}
                                >
                                    <Search className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Buscar en Dropbox</span><span className="xs:hidden">Buscar</span>
                                </button>
                                <span className="bg-blue-900/30 text-blue-400 px-2 py-1.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium border border-blue-900/50 whitespace-nowrap">
                                    {savedDropboxLists.length} <span className="hidden sm:inline">listas</span>
                                </span>
                            </div>
                        </div>

                        {/* Modal para resultados de búsqueda movido al final del componente */}

                        {savedDropboxLists.length === 0 ? (
                            <div className="text-center py-8 sm:py-16 bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-800">
                                <Cloud size={32} className="sm:w-12 sm:h-12 mx-auto text-gray-600 mb-2 sm:mb-4" />
                                <p className="text-gray-400 text-sm sm:text-base">No tienes listas guardadas.</p>
                                <button onClick={() => setActiveSubTab('load')} className="mt-2 sm:mt-4 text-blue-400 hover:text-blue-300 underline text-sm sm:text-base">
                                    Cargar una nueva
                                </button>
                            </div>
                        ) : (
                            <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-900/50 text-gray-400 text-[10px] sm:text-xs uppercase">
                                        <tr>
                                            <th className="px-3 py-2 sm:px-6 sm:py-4 font-medium">Nombre de la lista</th>
                                            <th className="px-3 py-2 sm:px-6 sm:py-4 font-medium hidden sm:table-cell">URL / Origen</th>
                                            <th className="px-3 py-2 sm:px-6 sm:py-4 font-medium text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {savedDropboxLists.map(list => (
                                            <tr key={list.id} className="hover:bg-gray-700/50 transition-colors group">
                                                <td className="px-3 py-2 sm:px-6 sm:py-4">
                                                    <button onClick={() => selectAndLoad(list.url)} className="font-medium text-white hover:text-blue-400 text-left flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                                                        <FileText size={16} className="text-blue-500 sm:w-[18px] sm:h-[18px]" />
                                                        <span className="truncate max-w-[150px] sm:max-w-xs">{list.name}</span>
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2 sm:px-6 sm:py-4 text-gray-400 text-xs sm:text-sm truncate max-w-xs hidden sm:table-cell">
                                                    {list.url}
                                                </td>
                                                <td className="px-3 py-2 sm:px-6 sm:py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1 sm:gap-2 opacity-100 sm:opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleShare(list.url)} 
                                                            className="p-1.5 sm:p-2 hover:bg-gray-600 rounded-md text-gray-400 hover:text-white"
                                                            title="Copiar Enlace"
                                                        >
                                                            <Share2 size={14} className="sm:w-4 sm:h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteList('dropbox', list.id)} 
                                                            className="p-1.5 sm:p-2 hover:bg-red-900/30 rounded-md text-gray-400 hover:text-red-400"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={14} className="sm:w-4 sm:h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. LISTAS REPARADORAS (Repair Lists Table) */}
                {activeSubTab === 'repair-lists' && (
                    <div className="max-w-4xl mx-auto animate-fadeIn pt-2 sm:pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3 text-purple-400">
                                <Database size={24} className="sm:w-7 sm:h-7" />
                                Mis Listas Reparadoras
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSearchDropbox('reparadoras')}
                                    disabled={isSearchingDropbox}
                                    className={`px-2 py-1.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 shadow-sm transition-all ${dropboxRefreshToken ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-75'}`}
                                    title={dropboxRefreshToken ? "Buscar archivos .m3u en /Listas Reparadoras" : "Conecta Dropbox para buscar"}
                                >
                                    <Search className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Buscar en Dropbox</span><span className="xs:hidden">Buscar</span>
                                </button>
                                <span className="bg-purple-900/30 text-purple-400 px-2 py-1.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium border border-purple-900/50 whitespace-nowrap">
                                    {savedMedicinaLists.length} <span className="hidden sm:inline">listas</span>
                                </span>
                            </div>
                        </div>

                         {/* Reutilizamos el mismo modal para resultados de búsqueda, que ya renderiza si showDropboxSearchModal es true */}

                        {savedMedicinaLists.length === 0 ? (
                            <div className="text-center py-8 sm:py-16 bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-800">
                                <FilePlus size={32} className="sm:w-12 sm:h-12 mx-auto text-gray-600 mb-2 sm:mb-4" />
                                <p className="text-gray-400 text-sm sm:text-base">No tienes listas auxiliares guardadas.</p>
                                <button onClick={() => setActiveSubTab('add-repair')} className="mt-2 sm:mt-4 text-purple-400 hover:text-purple-300 underline text-sm sm:text-base">
                                    Añadir una ahora
                                </button>
                            </div>
                        ) : (
                            <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-900/50 text-gray-400 text-[10px] sm:text-xs uppercase">
                                        <tr>
                                            <th className="px-3 py-2 sm:px-6 sm:py-4 font-medium">Nombre</th>
                                            <th className="px-3 py-2 sm:px-6 sm:py-4 font-medium hidden sm:table-cell">Origen</th>
                                            <th className="px-3 py-2 sm:px-6 sm:py-4 font-medium text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {savedMedicinaLists.map(list => (
                                            <tr key={list.id} className="hover:bg-gray-700/50 transition-colors group">
                                                <td className="px-3 py-2 sm:px-6 sm:py-4">
                                                    <button 
                                                        onClick={() => list.url === 'local' && list.content ? loadList(list) : selectAndLoad(list.url)}
                                                        className="font-medium text-white hover:text-purple-400 text-left flex items-center gap-2 sm:gap-3 text-sm sm:text-base"
                                                        title="Cargar como lista principal"
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
                                                        <span className="truncate max-w-[150px] sm:max-w-xs">{list.name}</span>
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2 sm:px-6 sm:py-4 text-gray-400 text-xs sm:text-sm truncate max-w-xs hidden sm:table-cell">
                                                    {list.url === 'local' ? 'Archivo Local' : list.url}
                                                </td>
                                                <td className="px-3 py-2 sm:px-6 sm:py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1 sm:gap-2 opacity-100 sm:opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleDeleteList('medicina', list.id, list.name)} 
                                                            className="p-1.5 sm:p-2 hover:bg-red-900/30 rounded-md text-gray-400 hover:text-red-400"
                                                        >
                                                            <Trash2 size={14} className="sm:w-4 sm:h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Modal para resultados de búsqueda (Global) */}
            {showDropboxSearchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-700">
                        {/* Cabecera */}
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-xl">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Cloud size={18} className="text-blue-400" />
                                Listas en Dropbox
                                {dropboxSearchResults.length > 0 && (
                                    <span className="text-xs font-normal text-gray-400 ml-1">({dropboxSearchResults.length} archivos)</span>
                                )}
                            </h3>
                            <button onClick={() => setShowDropboxSearchModal(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Leyenda de colores */}
                        {dropboxSearchResults.length > 0 && (
                            <div className="px-4 pt-3 pb-1 flex flex-wrap gap-3 text-[11px] text-gray-400">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white inline-block"></span>Raíz</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>Listas Principales</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{backgroundColor:'#C084FC'}}></span>Listas Reparadoras</span>
                            </div>
                        )}

                        {/* Lista de archivos */}
                        <div className="px-4 pt-2 pb-2 overflow-y-auto flex-1 custom-scrollbar">
                            {isSearchingDropbox && dropboxSearchResults.length === 0 ? (
                                <div className="text-center py-8">
                                    <RefreshCw className="animate-spin mb-3 mx-auto text-blue-500" size={24} />
                                    <p className="text-gray-400">Buscando en tu Dropbox...</p>
                                </div>
                            ) : dropboxSearchResults.length > 0 ? (
                                <div className="space-y-1.5">
                                    {/* Selectall */}
                                    <label className="flex items-center gap-2 px-2 py-1 cursor-pointer text-xs text-gray-400 hover:text-white select-none">
                                        <input
                                            type="checkbox"
                                            className="accent-blue-500 w-4 h-4"
                                            checked={selectedDropboxFiles.size === dropboxSearchResults.length && dropboxSearchResults.length > 0}
                                            onChange={e => {
                                                if (e.target.checked) setSelectedDropboxFiles(new Set(dropboxSearchResults.map(f => f.id)));
                                                else setSelectedDropboxFiles(new Set());
                                            }}
                                        />
                                        Seleccionar todo ({selectedDropboxFiles.size}/{dropboxSearchResults.length})
                                    </label>

                                    {dropboxSearchResults.map(file => {
                                        const nameColor =
                                            file.folder === 'principales' ? 'text-green-400' :
                                            file.folder === 'reparadoras' ? 'text-[#C084FC]' :
                                            'text-white';
                                        const folderLabel =
                                            file.folder === 'principales' ? 'Listas Principales' :
                                            file.folder === 'reparadoras' ? 'Listas Reparadoras' :
                                            'Raíz';
                                        const isChecked = selectedDropboxFiles.has(file.id);
                                        return (
                                            <label
                                                key={file.id}
                                                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-colors ${isChecked ? 'bg-gray-700 border-blue-500/50' : 'bg-gray-700/40 border-gray-600/40 hover:bg-gray-700/70'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="accent-blue-500 w-4 h-4 flex-shrink-0"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                        setSelectedDropboxFiles(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(file.id)) next.delete(file.id);
                                                            else next.add(file.id);
                                                            return next;
                                                        });
                                                    }}
                                                />
                                                <FileText size={16} className="text-blue-400 flex-shrink-0" />
                                                <div className="flex-1 overflow-hidden">
                                                    <p className={`text-sm font-medium truncate ${nameColor}`}>{file.name}</p>
                                                    <p className="text-[11px] text-gray-500 truncate">{folderLabel}</p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    No se encontraron archivos .m3u en Dropbox
                                </div>
                            )}
                        </div>

                        {/* Botones de acción */}
                        {dropboxSearchResults.length > 0 && (
                            <div className="p-4 border-t border-gray-700 flex flex-col sm:flex-row gap-2">
                                {dropboxSearchScope !== 'reparadoras' && (
                                    <button
                                        onClick={() => handleAddSelectedFromDropbox('principales')}
                                        disabled={isSearchingDropbox || selectedDropboxFiles.size === 0}
                                        className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isSearchingDropbox ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
                                        Añadir a Listas Principales
                                    </button>
                                )}
                                {dropboxSearchScope !== 'principales' && (
                                    <button
                                        onClick={() => handleAddSelectedFromDropbox('reparadoras')}
                                        disabled={isSearchingDropbox || selectedDropboxFiles.size === 0}
                                        className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                                        style={{backgroundColor: selectedDropboxFiles.size === 0 || isSearchingDropbox ? '#7c5ba8' : '#9333ea'}}
                                    >
                                        {isSearchingDropbox ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
                                        Añadir a Listas Reparadoras
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Éxito */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center border border-gray-700 shadow-2xl transform transition-all scale-100">
                        <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Download size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">¡Lista Cargada!</h3>
                        <p className="text-gray-400 mb-6">La lista se ha importado correctamente.</p>
                        <button
                            onClick={() => { setShowSuccessModal(false); onNavigateToEditor(); }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
                        >
                            Ir al Editor
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InicioTab;
