/**
 * Cloudflare Worker - Verificación con Análisis de Calidad
 * Analiza el manifest M3U8 para detectar calidad sin FFprobe
 * 
 * Despliegue: wrangler deploy --env quality
 */

const QUALITY_PATTERNS = {
    '4K': /\b(4k|2160p|uhd|ultra\s*hd)\b/i,
    'FHD': /\b(1080p|fhd|fullhd|full\s*hd)\b/i,
    'HD': /\b(720p|hd\s|hd$)\b/i,
    'SD': /\b(480p|sd\s|sd$|360p|240p)\b/i
};

function detectQualityFromURL(url) {
    for (const [quality, pattern] of Object.entries(QUALITY_PATTERNS)) {
        if (pattern.test(url)) return quality;
    }
    return 'unknown';
}

function parseM3U8Quality(manifest) {
    const lines = manifest.split('\n');
    let currentBandwidth = 0;
    let currentResolution = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Buscar EXT-X-STREAM-INF
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
            // Extraer BANDWIDTH
            const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
            if (bandwidthMatch) {
                currentBandwidth = parseInt(bandwidthMatch[1]);
            }
            
            // Extraer RESOLUTION
            const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
            if (resMatch) {
                currentResolution = resMatch[1];
            }
            
            // La siguiente línea no es comentario es la URL
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                if (nextLine && !nextLine.startsWith('#')) {
                    return {
                        bandwidth: currentBandwidth,
                        resolution: currentResolution,
                        url: nextLine
                    };
                }
            }
        }
    }
    
    return null;
}

function getQualityFromBandwidth(bandwidth) {
    if (bandwidth >= 20000000) return '4K';
    if (bandwidth >= 8000000) return 'FHD';
    if (bandwidth >= 3000000) return 'HD';
    return 'SD';
}

function getQualityFromResolution(resolution) {
    if (!resolution) return 'unknown';
    const [width, height] = resolution.split('x').map(Number);
    if (height >= 2160) return '4K';
    if (height >= 1080) return 'FHD';
    if (height >= 720) return 'HD';
    return 'SD';
}

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
            const decodedUrl = decodeURIComponent(streamUrl);
            
            // 1. Verificar si el stream está online
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const headResponse = await fetch(decodedUrl, {
                method: 'HEAD',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const successCodes = [200, 201, 202, 204, 206, 301, 302, 303, 307, 308];
            if (!successCodes.includes(headResponse.status)) {
                return new Response(JSON.stringify({
                    status: 'failed',
                    quality: 'unknown',
                    message: `HTTP ${headResponse.status}`
                }), {
                    status: 200,
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Access-Control-Allow-Origin': '*' 
                    }
                });
            }

            // 2. Si es M3U8, analizar el manifest
            let quality = 'unknown';
            let resolution = undefined;
            let method = 'url-pattern';
            
            if (decodedUrl.includes('.m3u8')) {
                try {
                    const manifestController = new AbortController();
                    const manifestTimeout = setTimeout(() => manifestController.abort(), 10000);
                    
                    const manifestResponse = await fetch(decodedUrl, {
                        signal: manifestController.signal
                    });
                    clearTimeout(manifestTimeout);
                    
                    if (manifestResponse.ok) {
                        const manifest = await manifestResponse.text();
                        const streamInfo = parseM3U8Quality(manifest);
                        
                        if (streamInfo) {
                            if (streamInfo.resolution) {
                                quality = getQualityFromResolution(streamInfo.resolution);
                                resolution = streamInfo.resolution;
                                method = 'm3u8-resolution';
                            } else if (streamInfo.bandwidth) {
                                quality = getQualityFromBandwidth(streamInfo.bandwidth);
                                method = 'm3u8-bandwidth';
                            }
                        }
                    }
                } catch (e) {
                    console.log('M3U8 analysis failed:', e.message);
                }
            }
            
            // 3. Si no se detectó del manifest, usar patrón de URL
            if (quality === 'unknown') {
                quality = detectQualityFromURL(decodedUrl);
                method = 'url-pattern';
            }

            return new Response(JSON.stringify({
                status: 'ok',
                quality: quality,
                resolution: resolution,
                method: method,
                message: `Quality detected: ${quality}`
            }), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json', 
                    'Access-Control-Allow-Origin': '*' 
                }
            });

        } catch (error) {
            return new Response(JSON.stringify({
                status: 'failed',
                quality: 'unknown',
                error: error.message
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