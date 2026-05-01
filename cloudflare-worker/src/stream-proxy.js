/**
 * Cloudflare Worker - Proxy de Streams para evitar CORS
 * Permite reproducir streams que bloquean CORS desde el navegador
 * 
 * Despliegue: wrangler deploy --env proxy
 */

export default {
    async fetch(request, env, ctx) {
        // Manejar CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                }
            });
        }

        const url = new URL(request.url);
        const streamUrl = url.searchParams.get('url');

        if (!streamUrl) {
            return new Response('Missing url parameter', { 
                status: 400,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        try {
            const decodedUrl = decodeURIComponent(streamUrl);
            
            // Fetch del stream
            const response = await fetch(decodedUrl, {
                method: request.method,
                headers: {
                    ...Object.fromEntries(request.headers.entries()),
                    // Eliminar headers que podrían causar problemas
                    'Origin': undefined,
                    'Referer': decodedUrl,
                    'User-Agent': 'PWA-M3U-Manager/1.0'
                },
                body: request.body
            });

            // Crear respuesta con CORS permitido
            const headers = new Headers(response.headers);
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            headers.set('Access-Control-Allow-Headers', '*');
            headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            
            // Para HLS, asegurar content-type correcto
            if (decodedUrl.includes('.m3u8')) {
                headers.set('Content-Type', 'application/vnd.apple.mpegurl');
            } else if (decodedUrl.includes('.ts')) {
                headers.set('Content-Type', 'video/mp2t');
            }

            return new Response(response.body, {
                status: response.status,
                headers: headers
            });

        } catch (error) {
            return new Response(`Proxy error: ${error.message}`, { 
                status: 502,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }
    }
};