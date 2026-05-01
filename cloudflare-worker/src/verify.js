/**
 * Cloudflare Worker - Verificación Simple de Canales IPTV
 * Verifica si un stream está online sin analizar calidad
 * Gratis hasta 100K requests/día
 * 
 * Despliegue: wrangler deploy
 */

export default {
    async fetch(request, env, ctx) {
        // Manejar CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Accept',
                }
            });
        }

        const url = new URL(request.url);
        const streamUrl = url.searchParams.get('url');

        if (!streamUrl) {
            return new Response(JSON.stringify({ 
                status: 'failed', 
                error: 'Missing url parameter' 
            }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json', 
                    'Access-Control-Allow-Origin': '*' 
                }
            });
        }

        try {
            // Decodificar URL si viene codificada
            const decodedUrl = decodeURIComponent(streamUrl);
            
            // Realizar request con timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(decodedUrl, {
                method: 'HEAD',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'PWA-M3U-Manager/1.0',
                    'Accept': '*/*',
                }
            });
            
            clearTimeout(timeoutId);

            // Verificar código de estado
            const successCodes = [200, 201, 202, 204, 206, 301, 302, 303, 307, 308];
            const isOnline = successCodes.includes(response.status);

            return new Response(JSON.stringify({
                status: isOnline ? 'ok' : 'failed',
                message: isOnline ? `Stream online (HTTP ${response.status})` : `Stream offline (HTTP ${response.status})`,
                httpStatus: response.status
            }), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json', 
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-store'
                }
            });

        } catch (error) {
            return new Response(JSON.stringify({
                status: 'failed',
                error: error.message || 'Verification failed'
            }), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json', 
                    'Access-Control-Allow-Origin': '*' 
                }
            });
        }
    }
};