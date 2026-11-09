import { getStorageItem } from './storage';

const DB_APP_KEY = 'dropbox_app_key';
const DB_REFRESH_TOKEN_KEY = 'dropbox_refresh_token';

const isDropboxUrl = (url: string): boolean => {
    return url.includes('dropbox.com') || url.includes('dropboxusercontent.com');
};

const toDropboxSharedWebUrl = (url: string): string => {
    try {
        const u = new URL(url);
        if (u.hostname === 'dl.dropboxusercontent.com') {
            u.hostname = 'www.dropbox.com';
        }
        u.searchParams.set('dl', '0');
        u.searchParams.delete('raw');
        return u.toString();
    } catch {
        return url
            .replace('dl.dropboxusercontent.com', 'www.dropbox.com')
            .replace('dl=1', 'dl=0');
    }
};

const extractFilenameFromUrl = (url: string): string | null => {
    try {
        const u = new URL(url);
        const parts = u.pathname.split('/').filter(Boolean);
        let filename = parts[parts.length - 1] || '';
        if (filename.includes('?')) {
            filename = filename.split('?')[0];
        }
        filename = decodeURIComponent(filename);
        if (filename && /\.(m3u8?|txt)$/i.test(filename)) {
            return filename;
        }
        return null;
    } catch {
        return null;
    }
};

const fetchDropboxM3UDirectlyViaApi = async (targetUrl: string): Promise<string | null> => {
    const appKey = getStorageItem(DB_APP_KEY);
    const refreshToken = getStorageItem(DB_REFRESH_TOKEN_KEY);
    if (!appKey || !refreshToken) {
        return null;
    }

    try {
        // 1. Obtener token de acceso de Dropbox
        const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: appKey,
            }),
        });

        if (!tokenRes.ok) {
            return null;
        }

        const tokenData = await tokenRes.json();
        const accessToken: string | undefined = tokenData?.access_token;
        if (!accessToken) {
            return null;
        }

        // 2. Intentar descarga directa del enlace compartido usando /2/sharing/get_shared_link_file
        const sharedWebUrl = toDropboxSharedWebUrl(targetUrl);
        const sharedDownloadRes = await fetch('https://content.dropboxapi.com/2/sharing/get_shared_link_file', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Dropbox-API-Arg': JSON.stringify({ url: sharedWebUrl }),
            },
        });

        if (sharedDownloadRes.ok) {
            const text = await sharedDownloadRes.text();
            if (text && (text.includes('#EXTM3U') || text.includes('#EXTINF'))) {
                return text;
            }
        }

        // 3. Si el enlace compartido caducó o falló, buscar por nombre en las carpetas de Dropbox y descargar con /2/files/download
        const filename = extractFilenameFromUrl(targetUrl);
        if (filename) {
            const candidatePaths = [
                `/Listas Principales/${filename}`,
                `/Listas Reparadoras/${filename}`,
                `/${filename}`,
            ];

            for (const candidatePath of candidatePaths) {
                const fileRes = await fetch('https://content.dropboxapi.com/2/files/download', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Dropbox-API-Arg': JSON.stringify({ path: candidatePath }),
                    },
                });

                if (fileRes.ok) {
                    const text = await fileRes.text();
                    if (text && (text.includes('#EXTM3U') || text.includes('#EXTINF'))) {
                        return text;
                    }
                }
            }
        }
    } catch (error) {
        console.warn('Fallback directo con API de Dropbox no disponible:', error);
    }

    return null;
};

/**
 * Descarga el contenido de una lista M3U desde una URL.
 * - Si es una URL de Dropbox y el usuario tiene su cuenta conectada, intenta primero
 *   descargarla mediante la API oficial de Dropbox (evitando rate-limits 429/403 de enlaces públicos)
 *   y usa `/api/proxy` como respaldo (o viceversa si no hay credenciales).
 * - Para cualquier otra URL externa, utiliza `/api/proxy` con validación de respuesta M3U.
 */
export const fetchM3UContentFromUrl = async (targetUrl: string): Promise<string> => {
    const cleanUrl = targetUrl.trim();

    // Si es una URL de Dropbox, probar primero mediante la API oficial autenticada (no sufre bloqueos 429 de IP de Vercel)
    if (isDropboxUrl(cleanUrl)) {
        const directDropboxText = await fetchDropboxM3UDirectlyViaApi(cleanUrl);
        if (directDropboxText) {
            return directDropboxText;
        }
    }

    // Descarga a través del proxy de servidor (/api/proxy)
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(cleanUrl)}`;
    const response = await fetch(proxyUrl, { cache: 'no-store' });

    if (!response.ok) {
        // Si falló el proxy y es Dropbox (por si no entró antes o falló el primer intento), último intento por cliente directo CORS
        if (isDropboxUrl(cleanUrl)) {
            try {
                const directUrl = new URL(cleanUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com'));
                directUrl.searchParams.set('dl', '1');
                directUrl.searchParams.set('raw', '1');
                const browserRes = await fetch(directUrl.toString(), { cache: 'no-store' });
                if (browserRes.ok) {
                    const browserText = await browserRes.text();
                    if (browserText && (browserText.includes('#EXTM3U') || browserText.includes('#EXTINF'))) {
                        return browserText;
                    }
                }
            } catch {
                // Ignorar y lanzar el error detallado del proxy
            }
        }

        const errDetail = (await response.text().catch(() => '')).trim();
        throw new Error(
            `Error al descargar la lista (${response.status}${errDetail ? `: ${errDetail.slice(0, 120)}` : ''})`
        );
    }

    return await response.text();
};
