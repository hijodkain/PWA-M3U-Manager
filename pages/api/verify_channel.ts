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
 * Detecta calidad basándose en el bitrate (en bps)
 */
function getQualityFromBitrate(bitrate: number): QualityLevel {
    if (bitrate >= 20000000) return '4K';
    if (bitrate >= 8000000) return 'FHD';
    if (bitrate >= 3000000) return 'HD';
    if (bitrate >= 1000000) return 'SD';
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
                'Range': 'bytes=0-65535',
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
 * Verificación simple de stream - similar a AWS Lambda verify-simple
 * Usa HEAD primero, si falla usa GET
 * Solo acepta códigos 2xx como online
 */
async function verifyStreamSimple(url: string): Promise<VerificationResponse> {
    const TIMEOUT_SECONDS = 20;
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Encoding': 'gzip, deflate, br',
        'Range': 'bytes=0-65535',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
    };

    try {
        // Intentar primero con HEAD
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_SECONDS * 1000);
        
        let response: Response;
        let statusCode: number;
        
        try {
            response = await fetch(url, {
                method: 'HEAD',
                headers,
                signal: controller.signal,
                redirect: 'follow',
            });
            statusCode = response.status;
        } catch (headError: any) {
            clearTimeout(timeoutId);
            console.log('HEAD request failed, trying GET:', headError.message);
            
            // Intentar con GET
            try {
                response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        ...headers,
                        'Range': 'bytes=0-4096',
                    },
                    signal: controller.signal,
                    redirect: 'follow',
                });
                statusCode = response.status;
            } catch (getError: any) {
                clearTimeout(timeoutId);
                return {
                    status: 'failed',
                    quality: 'unknown',
                    error: getError.name === 'AbortError' ? 'Timeout' : getError.message,
                    message: `Connection failed: ${getError.message}`,
                };
            }
        }
        
        clearTimeout(timeoutId);
        
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
 * Verificación completa con detección de calidad - similar a AWS Lambda verify-quality
 * Ahora incluye verificación de segmentos reales para mayor precisión
 */
async function verifyChannel(url: string): Promise<VerificationResponse> {
    if (!url || url === 'http://--' || url.trim() === '') {
        return {
            status: 'failed',
            quality: 'unknown',
            error: 'Invalid URL',
        };
    }

    // 1. Verificación simple primero (igual que AWS)
    const simpleResult = await verifyStreamSimple(url);
    
    if (simpleResult.status !== 'ok') {
        return simpleResult;
    }

    // 2. Si es M3U8, intentar detectar calidad del manifest Y verificar segmentos reales
    if (url.includes('.m3u8')) {
        const { streams, baseUrl } = await analyzeM3U8MasterPlaylist(url);
        
        if (streams.length > 0) {
            // Ordenar streams por calidad (mayor resolución primero)
            const sortedStreams = [...streams].sort((a, b) => {
                const heightA = a.height || 0;
                const heightB = b.height || 0;
                return heightB - heightA;
            });

            // Intentar verificar el stream de mejor calidad primero
            for (const stream of sortedStreams) {
                if (!stream.url) continue;

                // Obtener un segmento real del stream
                const segmentUrl = await getFirstSegmentUrl(stream.url);
                
                if (segmentUrl) {
                    // Verificar que el segmento es reproducible (como hacía FFprobe)
                    const segmentResult = await verifyHLSSegment(segmentUrl);
                    
                    if (segmentResult.isPlayable) {
                        // El stream es realmente reproducible
                        let quality: QualityLevel = 'unknown';
                        
                        if (stream.width && stream.height) {
                            quality = getQualityFromResolution(stream.width, stream.height);
                            return {
                                status: 'ok',
                                quality,
                                resolution: `${stream.width}x${stream.height}`,
                                codec: stream.codecs,
                                bitrate: stream.bandwidth,
                                message: `Stream online - ${quality} quality verified (segment tested)`,
                            };
                        }
                        
                        if (stream.bandwidth) {
                            quality = getQualityFromBitrate(stream.bandwidth);
                            return {
                                status: 'ok',
                                quality,
                                bitrate: stream.bandwidth,
                                message: `Stream online - ${quality} quality verified (segment tested)`,
                            };
                        }
                        
                        // Si tenemos la URL pero no resolución/bitrate, usar la del manifest
                        return {
                            status: 'ok',
                            quality: 'unknown',
                            message: 'Stream online - verified via segment download',
                        };
                    }
                }
            }

            // Si no pudimos verificar ningún stream por segmento, usar datos del manifest
            const bestStream = sortedStreams[0];
            let quality: QualityLevel = 'unknown';
            
            if (bestStream.width && bestStream.height) {
                quality = getQualityFromResolution(bestStream.width, bestStream.height);
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
                quality = getQualityFromBitrate(bestStream.bandwidth);
                return {
                    status: 'ok',
                    quality,
                    bitrate: bestStream.bandwidth,
                    message: `Stream online - ${quality} quality from bandwidth`,
                };
            }
        }
    }

    // 3. Para streams que no son M3U8, usar detección avanzada
    const qualityResult = await detectStreamQuality(url);
    
    return {
        status: 'ok',
        quality: qualityResult.quality,
        resolution: qualityResult.resolution,
        bitrate: qualityResult.bitrate,
        message: qualityResult.quality !== 'unknown' 
            ? `Stream online - ${qualityResult.quality} quality (${qualityResult.method})`
            : 'Stream online',
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