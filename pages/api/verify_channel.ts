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
}

interface StreamInfo {
    resolution?: string;
    width?: number;
    height?: number;
    bandwidth?: number;
    codecs?: string;
}

/**
 * Detecta la calidad del stream basándose en la resolución
 * Basado en IPTVChecker quality detection
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
 * Similar al enfoque de IPTVChecker
 */
function getQualityFromBitrate(bitrate: number): QualityLevel {
    if (bitrate >= 20000000) return '4K';      // >= 20 Mbps
    if (bitrate >= 8000000) return 'FHD';      // >= 8 Mbps
    if (bitrate >= 3000000) return 'HD';       // >= 3 Mbps
    if (bitrate >= 1000000) return 'SD';       // >= 1 Mbps
    return 'SD';
}

/**
 * Analiza un archivo M3U8 master playlist para extraer información de calidad
 * Implementación inspirada en IPTVChecker
 */
async function analyzeM3U8MasterPlaylist(url: string): Promise<StreamInfo[]> {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
            },
            signal: AbortSignal.timeout(12000),
        });

        if (!response.ok) {
            return [];
        }

        const content = await response.text();
        const lines = content.split('\n');
        const streams: StreamInfo[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Buscar EXT-X-STREAM-INF (master playlist)
            if (line.startsWith('#EXT-X-STREAM-INF:')) {
                const streamInfo: StreamInfo = {};

                // Extraer RESOLUTION
                const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
                if (resolutionMatch) {
                    streamInfo.width = parseInt(resolutionMatch[1]);
                    streamInfo.height = parseInt(resolutionMatch[2]);
                    streamInfo.resolution = `${streamInfo.width}x${streamInfo.height}`;
                }

                // Extraer BANDWIDTH
                const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/i);
                if (bandwidthMatch) {
                    streamInfo.bandwidth = parseInt(bandwidthMatch[1]);
                }

                // Extraer CODECS
                const codecsMatch = line.match(/CODECS="([^"]+)"/i);
                if (codecsMatch) {
                    streamInfo.codecs = codecsMatch[1];
                }

                streams.push(streamInfo);
            }
        }

        return streams;
    } catch (error) {
        console.error('Error analyzing M3U8:', error);
        return [];
    }
}

/**
 * Detecta calidad analizando patrones en la URL
 * Basado en el enfoque de IPTVChecker
 */
function detectQualityFromURL(url: string): QualityLevel | null {
    const urlLower = url.toLowerCase();
    
    // Patrones de 4K
    if (urlLower.match(/\b(4k|2160p?|uhd|ultra)\b/)) return '4K';
    
    // Patrones de FHD
    if (urlLower.match(/\b(1080p?|fhd|fullhd|full.?hd)\b/)) return 'FHD';
    
    // Patrones de HD
    if (urlLower.match(/\b(720p?|hd)\b/)) return 'HD';
    
    // Patrones de SD
    if (urlLower.match(/\b(480p?|sd|360p?|240p?)\b/)) return 'SD';
    
    return null;
}

/**
 * Verifica un canal de streaming y detecta su calidad
 * Usa AWS Lambda con IPTVChecker (FFprobe) cuando está disponible
 */
async function verifyChannel(url: string): Promise<VerificationResponse> {
    if (!url || url === 'http://--' || url.trim() === '') {
        return {
            status: 'failed',
            quality: 'unknown',
            error: 'Invalid URL',
        };
    }

    // 1. Intentar usar AWS Lambda con IPTVChecker (método más preciso)
    const lambdaUrl = process.env.STREAM_ANALYZER_API;
    
    if (lambdaUrl) {
        try {
            const lambdaResponse = await fetch(
                `${lambdaUrl}?url=${encodeURIComponent(url)}&timeout=15`,
                {
                    method: 'GET',
                    signal: AbortSignal.timeout(20000), // 20s timeout total
                }
            );

            if (lambdaResponse.ok) {
                const lambdaData = await lambdaResponse.json();
                
                // Si la Lambda devolvió información válida, usarla
                if (lambdaData.status === 'ok' && lambdaData.quality !== 'unknown') {
                    return {
                        status: 'ok',
                        quality: lambdaData.quality,
                        resolution: lambdaData.resolution,
                        codec: lambdaData.codec,
                        bitrate: lambdaData.bitrate,
                    };
                }
            }
        } catch (lambdaError) {
            console.log('Lambda verification failed, falling back to manual analysis:', lambdaError);
            // Continuar con métodos alternativos
        }
    }

    try {
        // 2. Si es M3U8, analizar el manifest (método de fallback)
        if (url.includes('.m3u8')) {
            const streams = await analyzeM3U8MasterPlaylist(url);
            
            if (streams.length > 0) {
                // Encontrar el stream de mayor calidad
                const bestStream = streams.reduce((best, current) => {
                    const bestHeight = best.height || 0;
                    const currentHeight = current.height || 0;
                    const bestBandwidth = best.bandwidth || 0;
                    const currentBandwidth = current.bandwidth || 0;
                    
                    // Preferir por resolución, luego por bandwidth
                    if (currentHeight > bestHeight) return current;
                    if (currentHeight === bestHeight && currentBandwidth > bestBandwidth) return current;
                    return best;
                }, streams[0]);

                let quality: QualityLevel = 'unknown';
                
                // Determinar calidad por resolución
                if (bestStream.width && bestStream.height) {
                    quality = getQualityFromResolution(bestStream.width, bestStream.height);
                    return {
                        status: 'ok',
                        quality,
                        resolution: bestStream.resolution,
                        codec: bestStream.codecs,
                        bitrate: bestStream.bandwidth,
                    };
                }
                
                // Si no hay resolución, usar bandwidth
                if (bestStream.bandwidth) {
                    quality = getQualityFromBitrate(bestStream.bandwidth);
                    return {
                        status: 'ok',
                        quality,
                        bitrate: bestStream.bandwidth,
                    };
                }
            }
            
            // Si no se pudo analizar el M3U8, devolver unknown
            return {
                status: 'ok',
                quality: 'unknown',
                error: 'No se pudo analizar el manifest M3U8',
            };
        }

        // 2. Para streams no-M3U8, intentar descargar una muestra
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            // Intentar GET con Range para obtener headers y una muestra
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Range': 'bytes=0-65536', // Primeros 64KB
                },
                signal: controller.signal,
                redirect: 'follow',
            });

            clearTimeout(timeoutId);

            if (response.status >= 200 && response.status < 400) {
                const contentType = response.headers.get('content-type')?.toLowerCase() || '';

                // Rechazar HTML/JSON/texto
                if (['text/html', 'application/json', 'text/plain'].some(ct => contentType.includes(ct))) {
                    return {
                        status: 'failed',
                        quality: 'unknown',
                        error: 'Not a valid stream',
                    };
                }

                // Verificar si es un stream de video válido
                const isValidStream = contentType.includes('video') || 
                                     contentType.includes('mpegurl') || 
                                     contentType.includes('octet-stream') ||
                                     contentType.includes('mpeg');

                if (!isValidStream) {
                    return {
                        status: 'failed',
                        quality: 'unknown',
                        error: 'Content-Type inválido',
                    };
                }

                // Stream válido pero sin información de calidad
                // Como último recurso, intentar detectar por URL
                const urlQuality = detectQualityFromURL(url);
                
                return {
                    status: 'ok',
                    quality: urlQuality || 'unknown',
                };
            }
        } catch (rangeError) {
            console.log('GET with Range failed, trying HEAD');
        }

        // 3. Fallback a HEAD si GET con Range falla
        const response2 = await fetch(url, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
            },
            signal: AbortSignal.timeout(8000),
        });

        if (response2.status >= 200 && response2.status < 400) {
            const contentType = response2.headers.get('content-type')?.toLowerCase() || '';

            if (['text/html', 'application/json', 'text/plain'].some(ct => contentType.includes(ct))) {
                return {
                    status: 'failed',
                    quality: 'unknown',
                    error: 'Not a valid stream',
                };
            }

            // Como último recurso, usar detección por URL
            const urlQuality = detectQualityFromURL(url);
            
            return {
                status: 'ok',
                quality: urlQuality || 'unknown',
            };
        }

        return {
            status: 'failed',
            quality: 'unknown',
            error: `HTTP ${response2.status}`,
        };

    } catch (error: any) {
        console.error('Verification error:', error);
        return {
            status: 'failed',
            quality: 'unknown',
            error: error.name === 'AbortError' ? 'Timeout' : error.message,
        };
    }
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
