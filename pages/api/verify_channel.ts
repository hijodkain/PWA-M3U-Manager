import type { NextApiRequest, NextApiResponse } from 'next';

export type QualityLevel = 'SD' | 'HD' | 'FHD' | '4K' | 'unknown';
export type ChannelStatus = 'ok' | 'failed' | 'verifying' | 'pending';

interface VerificationResponse {
    status: ChannelStatus;
    quality: QualityLevel;
    resolution?: string;
    codec?: string;
    bitrate?: number;
    error?: string;
    message?: string;
    warning?: 'segments-blocked';
}

/**
 * Códigos HTTP que se consideran como "stream online"
 * Solo códigos 2xx (200-299) son considerados online
 */
const SUCCESS_CODES = [200, 201, 202, 204, 206];

/**
 * Detecta la calidad del stream basándose en la resolución
 */
function getQualityFromResolution(width: number, height: number): QualityLevel {
    if (height >= 2160 || width >= 3840) return '4K';
    if (height >= 1080 || width >= 1920) return 'FHD';
    if (height >= 720 || width >= 1280) return 'HD';
    if (height >= 480 || width >= 854) return 'SD';
    return 'SD';
}

/**
 * Detecta calidad basándose en el bitrate (en bps).
 * Umbrales ajustados para streaming moderno con H.264/H.265:
 * un FHD con buena compresión puede ir a 1.5-3 Mbps.
 */
function getQualityFromBitrate(bitrate: number): QualityLevel {
    if (bitrate >= 10000000) return '4K';   // >= 10 Mbps
    if (bitrate >= 2000000) return 'FHD';   // >= 2 Mbps
    if (bitrate >= 900000) return 'HD';     // >= 900 Kbps
    if (bitrate >= 200000) return 'SD';     // >= 200 Kbps
    return 'SD';
}

/**
 * Detecta calidad analizando patrones en la URL
 * Este método es el más fiable para streams que no tienen manifest M3U8
 */
function detectQualityFromURL(url: string): QualityLevel | null {
    const urlLower = url.toLowerCase();
    
    // Patrones más específicos primero (evitar falsos positivos)
    if (urlLower.match(/\b(4k|2160p|uhd|ultra\s*hd)\b/)) return '4K';
    if (urlLower.match(/\b(1080p|fhd|fullhd|full\s*hd)\b/)) return 'FHD';
    if (urlLower.match(/\b(720p|hd\s|hd$)\b/)) return 'HD';
    if (urlLower.match(/\b(480p|sd\s|sd$|360p|240p)\b/)) return 'SD';
    
    return null;
}

/**
 * Intenta analizar un stream para detectar su calidad
 * Prueba múltiples métodos en orden de fiabilidad
 */
async function detectStreamQuality(url: string): Promise<{
    quality: QualityLevel;
    resolution?: string;
    bitrate?: number;
    method: string;
}> {
    // 1. Si es M3U8, usar análisis completo del manifest
    if (url.includes('.m3u8')) {
        const { streams } = await analyzeM3U8MasterPlaylist(url);
        
        if (streams.length > 0) {
            // Ordenar por calidad
            const sortedStreams = [...streams].sort((a, b) => {
                const heightA = a.height || 0;
                const heightB = b.height || 0;
                return heightB - heightA;
            });
            
            const bestStream = sortedStreams[0];
            
            if (bestStream.height) {
                return {
                    quality: getQualityFromResolution(bestStream.width || 0, bestStream.height),
                    resolution: bestStream.width ? `${bestStream.width}x${bestStream.height}` : undefined,
                    bitrate: bestStream.bandwidth,
                    method: 'm3u8-manifest',
                };
            }
            
            if (bestStream.bandwidth) {
                return {
                    quality: getQualityFromBitrate(bestStream.bandwidth),
                    bitrate: bestStream.bandwidth,
                    method: 'm3u8-bandwidth',
                };
            }
        }
    }
    
    // 2. Detectar por URL (más fiable para streams directos)
    const urlQuality = detectQualityFromURL(url);
    if (urlQuality) {
        return {
            quality: urlQuality,
            method: 'url-pattern',
        };
    }
    
    // 3. Para streams que no son M3U8 ni tienen calidad en URL
    // Intentar descargar un fragmento para analizar
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Range': 'bytes=0-1048576', // 1MB para analizar
            },
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            
            // Si es un stream de video válido
            if (contentType.includes('video') || contentType.includes('mpegurl') || contentType.includes('octet-stream')) {
                // No podemos determinar calidad real sin FFprobe, devolver unknown
                // en lugar de asumir SD incorrectamente
                return { quality: 'unknown', method: 'stream-valid' };
            }
        }
    } catch (e) {
        // Fallback falló
    }
    
    // 4. No se pudo detectar - devolver unknown en lugar de asumir SD
    return { quality: 'unknown', method: 'none' };
}

/**
 * Analiza un archivo M3U8 master playlist para extraer información de calidad
 * Ahora también obtiene URLs de variantes para verificación de segmentos reales
 */
async function analyzeM3U8MasterPlaylist(url: string): Promise<{
    streams: { width?: number; height?: number; bandwidth?: number; codecs?: string; url?: string }[];
    baseUrl: string;
}> {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Range': 'bytes=0-262143',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
            },
            signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
            return { streams: [], baseUrl: url };
        }

        const content = await response.text();
        const lines = content.split('\n');
        const streams: any[] = [];

        // Extraer la URL base del manifest para resolver URLs relativas
        const urlObj = new URL(url);
        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('#EXT-X-STREAM-INF:')) {
                const streamInfo: any = {};

                const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
                if (resolutionMatch) {
                    streamInfo.width = parseInt(resolutionMatch[1]);
                    streamInfo.height = parseInt(resolutionMatch[2]);
                }

                const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/i);
                if (bandwidthMatch) {
                    streamInfo.bandwidth = parseInt(bandwidthMatch[1]);
                }

                const codecsMatch = line.match(/CODECS="([^"]+)"/i);
                if (codecsMatch) {
                    streamInfo.codecs = codecsMatch[1];
                }

                // La siguiente línea no comentada es la URL del stream
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim();
                    if (nextLine && !nextLine.startsWith('#')) {
                        // Resolver URL relativa
                        if (nextLine.startsWith('http://') || nextLine.startsWith('https://')) {
                            streamInfo.url = nextLine;
                        } else if (nextLine.startsWith('/')) {
                            streamInfo.url = `${urlObj.protocol}//${urlObj.host}${nextLine}`;
                        } else {
                            streamInfo.url = baseUrl + nextLine;
                        }
                    }
                }

                streams.push(streamInfo);
            }
        }

        return { streams, baseUrl };
    } catch (error) {
        console.error('Error analyzing M3U8:', error);
        return { streams: [], baseUrl: url };
    }
}

/**
 * Verifica si un segmento HLS es realmente reproducible descargándolo
 * Esto es lo que hacía FFprobe en AWS Lambda
 */
async function verifyHLSSegment(segmentUrl: string): Promise<{
    isPlayable: boolean;
    width?: number;
    height?: number;
    bitrate?: number;
}> {
    try {
        const response = await fetch(segmentUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Range': 'bytes=0-131072', // Descargar los primeros 128KB del segmento
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok || response.status < 200 || response.status >= 300) {
            return { isPlayable: false };
        }

        // Si podemos descargar el segmento, el stream está reproducible
        // Intentar detectar resolución del contenido si es posible
        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type');

        return {
            isPlayable: true,
            bitrate: contentLength ? parseInt(contentLength) * 8 : undefined, // bits si took ~1s
        };
    } catch (error) {
        console.log('Segment verification failed:', error);
        return { isPlayable: false };
    }
}

/**
 * Analiza un archivo M3U8 de variante (no master) para obtener un segmento real
 */
async function getFirstSegmentUrl(variantUrl: string): Promise<string | null> {
    try {
        const response = await fetch(variantUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Range': 'bytes=0-16384',
                'Accept': '*/*',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) return null;

        const content = await response.text();
        const lines = content.split('\n');
        const baseUrl = variantUrl.substring(0, variantUrl.lastIndexOf('/') + 1);
        const urlObj = new URL(variantUrl);

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                // Resolver URL relativa
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                    return trimmed;
                } else if (trimmed.startsWith('/')) {
                    return `${urlObj.protocol}//${urlObj.host}${trimmed}`;
                } else {
                    return baseUrl + trimmed;
                }
            }
        }

        return null;
    } catch (error) {
        console.log('Error getting first segment:', error);
        return null;
    }
}

/**
 * Bug D: Detecta calidad de una M3U8 media playlist (variante directa, sin #EXT-X-STREAM-INF).
 * Busca #EXT-X-BITRATE, y si no lo encuentra intenta descargar el primer segmento para
 * confirmar que es reproducible. La URL aquí es la de la propia media playlist.
 */
async function detectMediaPlaylistQuality(url: string): Promise<{
    quality: QualityLevel;
    resolution?: string;
    bitrate?: number;
} | null> {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Range': 'bytes=0-32767',
                'Accept': '*/*',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) return null;

        const content = await response.text();

        // Solo procesar si realmente es una media playlist
        if (!content.includes('#EXTINF')) return null;

        // 1. Buscar #EXT-X-BITRATE (valor en kbps)
        const bitrateMatch = content.match(/#EXT-X-BITRATE:(\d+)/i);
        if (bitrateMatch) {
            const bitrateBps = parseInt(bitrateMatch[1]) * 1000;
            return { quality: getQualityFromBitrate(bitrateBps), bitrate: bitrateBps };
        }

        // 2. Buscar resolución embebida (raro pero posible)
        const resMatch = content.match(/RESOLUTION=(\d+)x(\d+)/i);
        if (resMatch) {
            const w = parseInt(resMatch[1]);
            const h = parseInt(resMatch[2]);
            return { quality: getQualityFromResolution(w, h), resolution: `${w}x${h}` };
        }

        // 3. Calcular bitrate real: (Content-Length del segmento * 8) / duración #EXTINF
        // Esto es lo más fiable para media playlists en vivo sin metadatos de calidad
        const extinf = content.match(/#EXTINF:(\d+\.?\d*),/);
        const segmentDuration = extinf ? parseFloat(extinf[1]) : null;

        const segmentUrl = await getFirstSegmentUrl(url);
        if (segmentUrl && segmentDuration && segmentDuration > 0) {
            try {
                const headResp = await fetch(segmentUrl, {
                    method: 'HEAD',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    },
                    signal: AbortSignal.timeout(8000),
                });
                const contentLength = headResp.headers.get('content-length');
                if (headResp.ok && contentLength) {
                    const bytes = parseInt(contentLength);
                    const bitrateBps = Math.round((bytes * 8) / segmentDuration);
                    return { quality: getQualityFromBitrate(bitrateBps), bitrate: bitrateBps };
                }
                // HEAD sin Content-Length → stream reproducible, calidad desconocida
                if (headResp.ok) {
                    return { quality: 'unknown' };
                }
            } catch (_) {
                // Si HEAD del segmento falla (CORS, timeout), intentar confirmar reproducibilidad con GET parcial
                const segResult = await verifyHLSSegment(segmentUrl);
                if (segResult.isPlayable) {
                    return { quality: 'unknown' };
                }
            }
        }

        return null;
    } catch (e) {
        return null;
    }
}

// Códigos HTTP de HEAD que indican que el método no está soportado → hacer fallback a GET
const HEAD_UNSUPPORTED_CODES = [400, 405, 416, 501];

/**
 * Intenta una petición GET con su propio AbortController independiente
 */
async function tryGetRequest(url: string, timeoutMs: number): Promise<{ statusCode: number; error?: string }> {
    const getController = new AbortController();
    const getTimeoutId = setTimeout(() => getController.abort(), timeoutMs);
    const getHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Range': 'bytes=0-4096',
        'Connection': 'keep-alive',
    };
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders,
            signal: getController.signal,
            redirect: 'follow',
        });
        clearTimeout(getTimeoutId);
        return { statusCode: response.status };
    } catch (err: any) {
        clearTimeout(getTimeoutId);
        return {
            statusCode: 0,
            error: err.name === 'AbortError' ? 'Timeout' : err.message,
        };
    }
}

/**
 * Verificación simple de stream.
 * Usa HEAD primero (sin Range para evitar rechazos en CDN).
 * Si HEAD responde 400/405/416/501 o lanza error de red, hace fallback a GET
 * con un AbortController nuevo e independiente (Bug A+B+C).
 * Solo acepta códigos 2xx como online.
 */
async function verifyStreamSimple(url: string): Promise<VerificationResponse> {
    const TIMEOUT_MS = 20000;

    // HEAD sin Range — muchos CDN/streaming rechazan HEAD+Range con 416 o 400
    const headHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
    };

    let statusCode: number = 0;

    try {
        // Intento 1: HEAD
        const headController = new AbortController();
        const headTimeoutId = setTimeout(() => headController.abort(), TIMEOUT_MS);

        try {
            const headResponse = await fetch(url, {
                method: 'HEAD',
                headers: headHeaders,
                signal: headController.signal,
                redirect: 'follow',
            });
            clearTimeout(headTimeoutId);
            statusCode = headResponse.status;
        } catch (headError: any) {
            clearTimeout(headTimeoutId);
            console.log('HEAD request failed, trying GET:', headError.message);
            // HEAD falló con error de red o timeout → GET con nuevo controller
            const getResult = await tryGetRequest(url, TIMEOUT_MS);
            if (getResult.statusCode === 0) {
                return {
                    status: 'failed',
                    quality: 'unknown',
                    error: getResult.error || 'Connection failed',
                    message: `Connection failed: ${getResult.error}`,
                };
            }
            statusCode = getResult.statusCode;
        }

        // Intento 2: si HEAD devuelve código que indica que no soporta el método → GET
        if (HEAD_UNSUPPORTED_CODES.includes(statusCode)) {
            console.log(`HEAD returned ${statusCode}, falling back to GET`);
            const getResult = await tryGetRequest(url, TIMEOUT_MS);
            if (getResult.statusCode > 0) {
                statusCode = getResult.statusCode;
            }
            // Si GET también falla (0), mantenemos el statusCode del HEAD
        }

        // Solo códigos 2xx son online
        if (statusCode >= 200 && statusCode < 300) {
            return {
                status: 'ok',
                quality: 'unknown',
                message: `Stream online (HTTP ${statusCode})`,
            };
        } else {
            return {
                status: 'failed',
                quality: 'unknown',
                error: `HTTP ${statusCode}`,
                message: `Stream offline (HTTP ${statusCode})`,
            };
        }

    } catch (error: any) {
        console.error('Verification error:', error);
        return {
            status: 'failed',
            quality: 'unknown',
            error: error.name === 'AbortError' ? 'Timeout' : error.message,
            message: `Connection failed: ${error.message}`,
        };
    }
}

/**
 * Verificación completa con detección de calidad.
 * Orden: 1) verifica conectividad (HEAD/GET), 2) analiza manifest M3U8 master,
 * 3) si es media playlist directa detecta calidad (Bug D),
 * 4) verifica primer segmento para detectar falsos positivos (Bug F).
 */
async function verifyChannel(url: string): Promise<VerificationResponse> {
    if (!url || url === 'http://--' || url.trim() === '') {
        return {
            status: 'failed',
            quality: 'unknown',
            error: 'Invalid URL',
        };
    }

    // 1. Verificación simple primero (HEAD/GET)
    const simpleResult = await verifyStreamSimple(url);
    
    if (simpleResult.status !== 'ok') {
        return simpleResult;
    }

    // 2. Si es M3U8, usar los datos del manifest directamente
    if (url.includes('.m3u8')) {
        const { streams } = await analyzeM3U8MasterPlaylist(url);
        
        if (streams.length > 0) {
            // Ordenar streams por calidad (mayor resolución primero)
            const sortedStreams = [...streams].sort((a, b) => {
                const heightA = a.height || 0;
                const heightB = b.height || 0;
                return heightB - heightA;
            });

            const bestStream = sortedStreams[0];

            // Usar los datos del manifest directamente
            if (bestStream.height) {
                const quality = getQualityFromResolution(bestStream.width || 0, bestStream.height);
                return {
                    status: 'ok',
                    quality,
                    resolution: `${bestStream.width}x${bestStream.height}`,
                    codec: bestStream.codecs,
                    bitrate: bestStream.bandwidth,
                    message: `Stream online - ${quality} quality from M3U8 manifest`,
                };
            }
            
            if (bestStream.bandwidth) {
                const quality = getQualityFromBitrate(bestStream.bandwidth);
                return {
                    status: 'ok',
                    quality,
                    bitrate: bestStream.bandwidth,
                    message: `Stream online - ${quality} quality from bandwidth`,
                };
            }
        }
        
        // Bug D: streams.length === 0 → puede ser una media playlist (variante directa)
        // Intentar detectar calidad a partir de la propia playlist
        const mediaQuality = await detectMediaPlaylistQuality(url);
        if (mediaQuality) {
            return {
                status: 'ok',
                quality: mediaQuality.quality,
                resolution: mediaQuality.resolution,
                bitrate: mediaQuality.bitrate,
                message: `Stream online - quality from media playlist`,
            };
        }

        // M3U8 pero sin variantes ni metadatos de calidad
        return {
            status: 'ok',
            quality: 'unknown',
            message: 'Stream online - M3U8 without quality variants',
        };
    }

    // 3. Para streams que no son M3U8, intentar detectar por URL
    const urlQuality = detectQualityFromURL(url);
    
    return {
        status: 'ok',
        quality: urlQuality || 'unknown',
        message: urlQuality 
            ? `Stream online - ${urlQuality} quality from URL` 
            : 'Stream online - quality unknown',
    };
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<VerificationResponse>
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({
            status: 'failed',
            quality: 'unknown',
            error: `Method ${req.method} Not Allowed`,
        });
    }

    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({
            status: 'failed',
            quality: 'unknown',
            error: 'URL parameter is required',
        });
    }

    const result = await verifyChannel(url);
    res.status(200).json(result);
}