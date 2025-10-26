import type { NextApiRequest, NextApiResponse } from 'next';

export type QualityLevel = 'SD' | 'HD' | 'FHD' | '4K' | 'unknown';
export type ChannelStatus = 'ok' | 'failed' | 'verifying' | 'pending';

interface VerificationResponse {
    status: ChannelStatus;
    quality: QualityLevel;
    resolution?: string;
    error?: string;
}

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
 * Analiza un archivo M3U8 para extraer información de calidad
 */
async function analyzeM3U8(url: string): Promise<{ quality: QualityLevel; resolution?: string }> {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            return { quality: 'unknown' };
        }

        const content = await response.text();
        const lines = content.split('\n');

        // Buscar etiquetas EXT-X-STREAM-INF que contienen información de resolución
        let maxResolution: { width: number; height: number } | null = null;
        let maxBandwidth = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Buscar resolución en EXT-X-STREAM-INF
            if (line.startsWith('#EXT-X-STREAM-INF:')) {
                // Extraer RESOLUTION
                const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
                if (resolutionMatch) {
                    const width = parseInt(resolutionMatch[1]);
                    const height = parseInt(resolutionMatch[2]);
                    
                    if (!maxResolution || height > maxResolution.height) {
                        maxResolution = { width, height };
                    }
                }

                // Extraer BANDWIDTH como fallback
                const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/i);
                if (bandwidthMatch) {
                    const bandwidth = parseInt(bandwidthMatch[1]);
                    if (bandwidth > maxBandwidth) {
                        maxBandwidth = bandwidth;
                    }
                }
            }
        }

        // Si encontramos resolución, usarla
        if (maxResolution) {
            const quality = getQualityFromResolution(maxResolution.width, maxResolution.height);
            return {
                quality,
                resolution: `${maxResolution.width}x${maxResolution.height}`,
            };
        }

        // Si solo tenemos bandwidth, estimar calidad
        if (maxBandwidth > 0) {
            // Estimaciones basadas en bandwidth típico
            if (maxBandwidth >= 15000000) return { quality: '4K' }; // >= 15 Mbps
            if (maxBandwidth >= 5000000) return { quality: 'FHD' }; // >= 5 Mbps
            if (maxBandwidth >= 2500000) return { quality: 'HD' }; // >= 2.5 Mbps
            return { quality: 'SD' }; // < 2.5 Mbps
        }

        return { quality: 'unknown' };
    } catch (error) {
        console.error('Error analyzing M3U8:', error);
        return { quality: 'unknown' };
    }
}

/**
 * Verifica un canal de streaming y detecta su calidad
 */
async function verifyChannel(url: string): Promise<VerificationResponse> {
    if (!url || url === 'http://--' || url.trim() === '') {
        return {
            status: 'failed',
            quality: 'unknown',
            error: 'Invalid URL',
        };
    }

    try {
        // Primer intento: verificar si la URL responde
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos

        const response = await fetch(url, {
            method: 'HEAD', // Solo headers para ser más rápido
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
            },
            signal: controller.signal,
            redirect: 'follow',
        });

        clearTimeout(timeoutId);

        // Verificar si la respuesta es válida
        if (response.status < 200 || response.status >= 400) {
            return {
                status: 'failed',
                quality: 'unknown',
                error: `HTTP ${response.status}`,
            };
        }

        const contentType = response.headers.get('content-type')?.toLowerCase() || '';

        // Verificar que no sea HTML, JSON, etc. (debe ser un stream)
        if (['text/html', 'application/json', 'text/plain'].some(ct => contentType.includes(ct))) {
            return {
                status: 'failed',
                quality: 'unknown',
                error: 'Not a valid stream',
            };
        }

        // Si es M3U8 (HLS), analizar para obtener calidad
        if (url.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('m3u8')) {
            const { quality, resolution } = await analyzeM3U8(url);
            return {
                status: 'ok',
                quality,
                resolution,
            };
        }

        // Para otros tipos de streams (MPEG-TS, etc.)
        // Intentar estimar basado en el content-length si está disponible
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
            const size = parseInt(contentLength);
            // Si es muy grande, probablemente sea alta calidad
            // Esto es solo una estimación básica
            if (size > 50000000) return { status: 'ok', quality: 'FHD' };
            if (size > 20000000) return { status: 'ok', quality: 'HD' };
        }

        // Stream válido pero no podemos determinar calidad exacta
        return {
            status: 'ok',
            quality: 'unknown',
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
