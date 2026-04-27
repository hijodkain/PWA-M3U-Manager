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
 * Similar a AWS Lambda - acepta 2xx, 3xx y 403
 */
const SUCCESS_CODES = [200, 201, 202, 204, 206, 301, 302, 307, 308, 403];

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
 */
function detectQualityFromURL(url: string): QualityLevel | null {
    const urlLower = url.toLowerCase();
    
    if (urlLower.match(/\b(4k|2160p?|uhd|ultra)\b/)) return '4K';
    if (urlLower.match(/\b(1080p?|fhd|fullhd|full.?hd)\b/)) return 'FHD';
    if (urlLower.match(/\b(720p?|hd)\b/)) return 'HD';
    if (urlLower.match(/\b(480p?|sd|360p?|240p?)\b/)) return 'SD';
    
    return null;
}

/**
 * Analiza un archivo M3U8 master playlist para extraer información de calidad
 */
async function analyzeM3U8MasterPlaylist(url: string): Promise<{ width?: number; height?: number; bandwidth?: number; codecs?: string }[]> {
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
            return [];
        }

        const content = await response.text();
        const lines = content.split('\n');
        const streams: any[] = [];

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
 * Verificación simple de stream - similar a AWS Lambda verify-simple
 * Usa HEAD primero, si falla con 405 usa GET
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
        
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                headers,
                signal: controller.signal,
                redirect: 'follow',
            });
            
            clearTimeout(timeoutId);
            const statusCode = response.status;
            
            if (SUCCESS_CODES.includes(statusCode)) {
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
                    message: `Unexpected status code: ${statusCode}`,
                };
            }
        } catch (headError: any) {
            clearTimeout(timeoutId);
            
            // Si hay error, puede ser 405 (Method Not Allowed) - intentar con GET
            console.log('HEAD failed, trying GET:', headError.message);
        }

        // Si HEAD falló, intentar con GET
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), TIMEOUT_SECONDS * 1000);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...headers,
                    'Range': 'bytes=0-4096', // Leer solo 4KB para confirmar
                },
                signal: controller2.signal,
                redirect: 'follow',
            });
            
            clearTimeout(timeoutId2);
            const statusCode = response.status;
            
            if (SUCCESS_CODES.includes(statusCode)) {
                // Leer un poco para confirmar que el stream responde
                try {
                    await response.arrayBuffer();
                } catch (e) {
                    // Ignorar errores de lectura
                }
                
                return {
                    status: 'ok',
                    quality: 'unknown',
                    message: `Stream online (HTTP ${statusCode} via GET)`,
                };
            } else {
                return {
                    status: 'failed',
                    quality: 'unknown',
                    error: `HTTP ${statusCode}`,
                    message: `Unexpected status code: ${statusCode}`,
                };
            }
        } catch (getError: any) {
            clearTimeout(timeoutId2);
            return {
                status: 'failed',
                quality: 'unknown',
                error: getError.name === 'AbortError' ? 'Timeout' : getError.message,
                message: `GET failed: ${getError.message}`,
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
 */
async function verifyChannel(url: string): Promise<VerificationResponse> {
    if (!url || url === 'http://--' || url.trim() === '') {
        return {
            status: 'failed',
            quality: 'unknown',
            error: 'Invalid URL',
        };
    }

    // 1. Intentar usar AWS Lambda con FFprobe si está configurado
    const lambdaUrl = process.env.STREAM_ANALYZER_API;
    
    if (lambdaUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const lambdaResponse = await fetch(
                `${lambdaUrl}?url=${encodeURIComponent(url)}&timeout=15`,
                {
                    method: 'GET',
                    signal: controller.signal,
                }
            );
            
            clearTimeout(timeoutId);

            if (lambdaResponse.ok) {
                const lambdaData = await lambdaResponse.json();
                
                if (lambdaData.status === 'ok' && lambdaData.quality !== 'unknown') {
                    return {
                        status: 'ok',
                        quality: lambdaData.quality,
                        resolution: lambdaData.resolution,
                        codec: lambdaData.codec,
                        bitrate: lambdaData.bitrate,
                        message: `Stream online - ${lambdaData.quality} quality detected`,
                    };
                }
            }
        } catch (lambdaError) {
            console.log('Lambda verification failed, falling back to local analysis:', lambdaError);
        }
    }

    // 2. Verificación simple primero (igual que AWS)
    const simpleResult = await verifyStreamSimple(url);
    
    if (simpleResult.status !== 'ok') {
        return simpleResult;
    }

    // 3. Si es M3U8, intentar detectar calidad del manifest
    if (url.includes('.m3u8')) {
        const streams = await analyzeM3U8MasterPlaylist(url);
        
        if (streams.length > 0) {
            const bestStream = streams.reduce((best, current) => {
                const bestHeight = best.height || 0;
                const currentHeight = current.height || 0;
                const bestBandwidth = best.bandwidth || 0;
                const currentBandwidth = current.bandwidth || 0;
                
                if (currentHeight > bestHeight) return current;
                if (currentHeight === bestHeight && currentBandwidth > bestBandwidth) return current;
                return best;
            }, streams[0]);

            let quality: QualityLevel = 'unknown';
            
            if (bestStream.width && bestStream.height) {
                quality = getQualityFromResolution(bestStream.width, bestStream.height);
                return {
                    status: 'ok',
                    quality,
                    resolution: `${bestStream.width}x${bestStream.height}`,
                    codec: bestStream.codecs,
                    bitrate: bestStream.bandwidth,
                    message: `Stream online - ${quality} quality from M3U8`,
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

    // 4. Detección de calidad por URL como último recurso
    const urlQuality = detectQualityFromURL(url);
    
    return {
        status: 'ok',
        quality: urlQuality || 'unknown',
        message: urlQuality ? `Stream online - ${urlQuality} quality from URL` : 'Stream online',
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