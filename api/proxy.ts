/**
 * Reescribe las URLs internas de un manifiesto M3U8/M3U para que
 * los segmentos y sub-playlists se sirvan también a través de este proxy.
 * Así HLS.js nunca ve URLs http:// directas (evita Mixed Content en iframe HTTPS).
 *
 * @param {string} content  Contenido del manifiesto
 * @param {string} baseUrl  URL final del recurso (tras redirects), para resolver URLs relativas
 */
function rewriteM3U8(content, baseUrl) {
    let base;
    try { base = new URL(baseUrl); } catch { return content; }

    return content.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Reescribir URI="..." en directivas como #EXT-X-KEY, #EXT-X-MAP, etc.
        if (trimmed.startsWith('#') && trimmed.includes('URI=')) {
            return line.replace(/URI="([^"]+)"/g, (_, uri) => {
                try {
                    const abs = new URL(uri, base).toString();
                    return 'URI="/api/proxy?url=' + encodeURIComponent(abs) + '"';
                } catch { return 'URI="' + uri + '"'; }
            });
        }

        // Líneas que son URLs (segmentos .ts, sub-playlists .m3u8, etc.)
        if (!trimmed.startsWith('#')) {
            try {
                const abs = new URL(trimmed, base).toString();
                return '/api/proxy?url=' + encodeURIComponent(abs);
            } catch { return line; }
        }

        return line;
    }).join('\n');
}

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
const handler = async (req, res) => {
    // Responder al preflight OPTIONS del navegador
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const { url } = req.query;
    console.log(`Proxying URL: ${url}`);

    if (!url || typeof url !== 'string') {
        console.error('Missing URL parameter');
        return res.status(400).send('Missing URL parameter');
    }

    try {
        let fetchUrl = url;
        if (url.includes('dropbox.com')) {
            // Consistently transform to a direct download link
            const urlObject = new URL(url.replace('www.dropbox.com', 'dl.dropboxusercontent.com'));
            urlObject.searchParams.set('dl', '1');
            fetchUrl = urlObject.toString();
            console.log(`Transformed Dropbox URL to: ${fetchUrl}`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(fetchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        console.log(`Fetched URL: ${fetchUrl}, Status: ${response.status}`);
        if (!response.ok) {
            console.error(`Failed to fetch: ${response.statusText}`);
            // Forward the status code from the external server
            return res.status(response.status).send(response.statusText);
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        // URL final tras seguir posibles redirects (importante para resolver URLs relativas en M3U8)
        const finalUrl = response.url || fetchUrl;
        res.setHeader('Content-Type', contentType);

        // Distinguir entre texto (manifiestos M3U8/MPD) y binario (segmentos .ts, .aac…)
        // para no corromper el contenido al hacer text()
        const isText = contentType.includes('text') ||
                       contentType.includes('mpegurl') ||
                       contentType.includes('dash+xml') ||
                       contentType.includes('xml') ||
                       contentType.includes('json');

        // Detectar manifiesto M3U8 para reescribir URLs internas
        const finalUrlClean = finalUrl.split('?')[0].toLowerCase();
        const srcUrlClean = fetchUrl.split('?')[0].toLowerCase();
        const isM3U8 = contentType.includes('mpegurl') ||
                       finalUrlClean.endsWith('.m3u8') || finalUrlClean.endsWith('.m3u') ||
                       srcUrlClean.endsWith('.m3u8') || srcUrlClean.endsWith('.m3u');

        if (isText) {
            let data = await response.text();
            // Reescribir URLs del manifiesto para que todo vaya por este proxy (evita Mixed Content)
            if (isM3U8) data = rewriteM3U8(data, finalUrl);
            res.status(200).send(data);
        } else {
            const buffer = await response.arrayBuffer();
            res.status(200).send(Buffer.from(buffer));
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error fetching URL: ${errorMessage}`);
        res.status(500).send(`Error fetching URL: ${errorMessage}`);
    }
};

module.exports = handler;
