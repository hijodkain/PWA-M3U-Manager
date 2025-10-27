/**
 * Configuración de la API de YouTube Live Extractor
 * 
 * Este archivo contiene las constantes necesarias para conectar
 * la PWA con la Lambda de AWS que extrae streams de YouTube.
 */

export const YOUTUBE_API_CONFIG = {
  /**
   * URL base del API Gateway de AWS
   * Región: eu-west-1
   * Endpoint: /youtube/extract
   */
  API_GATEWAY_URL: 'https://4h0qgf6co9.execute-api.eu-west-1.amazonaws.com/Prod/youtube/extract',

  /**
   * API Key para autenticación
   * Rate limits:
   * - 50 requests/segundo
   * - 100 burst
   * - 10,000 requests/día
   */
  API_KEY: 'iPGrA2a34MLiD4ZkUr61aV57ELAAf9b79Y71sUI0',

  /**
   * Timeout para las peticiones (en milisegundos)
   */
  REQUEST_TIMEOUT: 30000, // 30 segundos

  /**
   * TTL del caché en DynamoDB (en horas)
   */
  CACHE_TTL_HOURS: 2,

  /**
   * Grupo por defecto para canales de YouTube
   */
  DEFAULT_GROUP: 'YouTube Live',

  /**
   * Reintentos en caso de error
   */
  MAX_RETRIES: 2,

  /**
   * Tipos de URLs soportadas
   */
  SUPPORTED_URL_PATTERNS: [
    '/@(.+)/live',           // @CanalRedLive/live
    '/watch\\?v=(.+)',       // watch?v=VIDEO_ID
    '/channel/(.+)/live',    // /channel/UC.../live
  ],
};

/**
 * Headers por defecto para las peticiones a la API
 */
export const getAPIHeaders = () => ({
  'x-api-key': YOUTUBE_API_CONFIG.API_KEY,
  'Content-Type': 'application/json',
});

/**
 * Construye la URL completa para la extracción
 * @param youtubeUrl - URL del canal/video de YouTube
 * @returns URL completa del API Gateway
 */
export const buildExtractURL = (youtubeUrl: string): string => {
  const encodedUrl = encodeURIComponent(youtubeUrl);
  return `${YOUTUBE_API_CONFIG.API_GATEWAY_URL}?url=${encodedUrl}`;
};

/**
 * Valida si una URL de YouTube es soportada
 * @param url - URL a validar
 * @returns true si es una URL válida de YouTube
 */
export const isValidYouTubeURL = (url: string): boolean => {
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    return false;
  }

  return YOUTUBE_API_CONFIG.SUPPORTED_URL_PATTERNS.some((pattern) => {
    const regex = new RegExp(pattern);
    return regex.test(url);
  });
};

/**
 * Extrae el nombre del canal desde una URL de YouTube
 * @param url - URL de YouTube
 * @returns Nombre del canal o 'YouTube Channel' por defecto
 */
export const extractChannelNameFromURL = (url: string): string => {
  const patterns = [
    { regex: /@([^/]+)/, prefix: '' },           // @CanalRedLive
    { regex: /channel\/([^/]+)/, prefix: '' },   // /channel/UC...
    { regex: /c\/([^/]+)/, prefix: '' },         // /c/ChannelName
    { regex: /[?&]v=([^&]+)/, prefix: 'Video: ' }, // watch?v=...
  ];

  for (const { regex, prefix } of patterns) {
    const match = url.match(regex);
    if (match) {
      const name = match[1].replace(/_/g, ' ').replace(/-/g, ' ');
      return prefix + name;
    }
  }

  return 'YouTube Channel';
};

/**
 * Formatea la calidad del stream
 * @param quality - Calidad recibida de la API (ej: "1080p", "720p")
 * @returns Calidad formateada
 */
export const formatQuality = (quality?: string): string => {
  if (!quality) return 'Unknown';
  
  const qualityMap: Record<string, string> = {
    '2160p': '4K Ultra HD',
    '1440p': '2K Quad HD',
    '1080p': 'Full HD',
    '720p': 'HD',
    '480p': 'SD',
    '360p': 'Low',
  };

  return qualityMap[quality] || quality;
};

/**
 * Tipos de respuesta de la API
 */
export interface YouTubeAPIResponse {
  success: boolean;
  channel_id?: string;
  youtube_url?: string;
  m3u8_url?: string;
  quality?: string;
  cached?: boolean;
  extracted_at?: string;
  error?: string;
}

/**
 * Estados posibles de extracción
 */
export type ExtractionStatus = 'pending' | 'extracting' | 'success' | 'error';

/**
 * Mensajes de error comunes
 */
export const ERROR_MESSAGES = {
  NOT_LIVE: 'El canal no está transmitiendo en vivo actualmente',
  BOT_DETECTED: 'YouTube detectó la petición como bot. Intenta de nuevo en unos minutos',
  INVALID_URL: 'URL de YouTube no válida. Usa formatos: /@canal/live o /watch?v=...',
  TIMEOUT: 'La extracción tardó demasiado. Intenta de nuevo',
  NETWORK_ERROR: 'Error de red. Verifica tu conexión a internet',
  API_ERROR: 'Error del servidor. Intenta de nuevo más tarde',
  RATE_LIMIT: 'Demasiadas peticiones. Espera un momento e intenta de nuevo',
};

/**
 * Parsea errores de la API y retorna un mensaje amigable
 * @param error - Error recibido
 * @returns Mensaje de error formateado
 */
export const parseAPIError = (error: string): string => {
  if (error.includes('not a bot')) return ERROR_MESSAGES.BOT_DETECTED;
  if (error.includes('unavailable')) return ERROR_MESSAGES.NOT_LIVE;
  if (error.includes('timeout')) return ERROR_MESSAGES.TIMEOUT;
  if (error.includes('rate limit')) return ERROR_MESSAGES.RATE_LIMIT;
  
  return error;
};
