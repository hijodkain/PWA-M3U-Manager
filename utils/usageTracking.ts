/**
 * usageTracking.ts
 * Funciones puras para rastrear el consumo de peticiones a APIs externas.
 * Los contadores se guardan en localStorage y se resetean automáticamente
 * según el ciclo de cada servicio.
 *
 * Límites gratuitos:
 *  - Vercel Hobby: 100,000 invocaciones de Serverless Functions / mes
 *  - Cloudflare Workers Free: 100,000 requests / día (renueva a medianoche UTC)
 */

const STORAGE_KEY = 'api_usage_v1';

// Límites gratuitos
export const VERCEL_MONTHLY_LIMIT = 100_000;
export const CF_DAILY_LIMIT = 100_000;

export interface ServiceUsage {
    count: number;
    /** Para Vercel: 'YYYY-MM'. Para CF: 'YYYY-MM-DD' */
    period: string;
    /** Fecha ISO del próximo reset */
    resetDate: string;
}

export interface UsageData {
    vercel: ServiceUsage;
    cf: ServiceUsage;
}

// Obtiene el periodo actual para Vercel (mes: 'YYYY-MM')
function currentVercelPeriod(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Obtiene el periodo actual para Cloudflare (día: 'YYYY-MM-DD')
function currentCfPeriod(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

// Calcula la fecha de reset del mes siguiente para Vercel
function nextMonthResetDate(): string {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return next.toISOString().slice(0, 10);
}

// Calcula la fecha de reset del día siguiente para Cloudflare (medianoche UTC)
function tomorrowResetDate(): string {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return tomorrow.toISOString().slice(0, 10);
}

function defaultUsageData(): UsageData {
    return {
        vercel: {
            count: 0,
            period: currentVercelPeriod(),
            resetDate: nextMonthResetDate(),
        },
        cf: {
            count: 0,
            period: currentCfPeriod(),
            resetDate: tomorrowResetDate(),
        },
    };
}

/** Lee y valida los datos de uso desde localStorage, reseteando periodos expirados */
export function readUsageData(): UsageData {
    if (typeof window === 'undefined') return defaultUsageData();

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const data: UsageData = raw ? JSON.parse(raw) : defaultUsageData();

        // Resetear Vercel si el mes cambió
        if (data.vercel?.period !== currentVercelPeriod()) {
            data.vercel = {
                count: 0,
                period: currentVercelPeriod(),
                resetDate: nextMonthResetDate(),
            };
        }

        // Resetear Cloudflare si el día cambió
        if (data.cf?.period !== currentCfPeriod()) {
            data.cf = {
                count: 0,
                period: currentCfPeriod(),
                resetDate: tomorrowResetDate(),
            };
        }

        return data;
    } catch {
        return defaultUsageData();
    }
}

/** Guarda los datos de uso en localStorage */
function saveUsageData(data: UsageData): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
        // Silenciar errores de cuota
    }
}

/** Incrementa el contador de Vercel en N peticiones (por defecto 1) */
export function trackVercelCall(n = 1): void {
    const data = readUsageData();
    data.vercel.count += n;
    saveUsageData(data);
}

/** Incrementa el contador de Cloudflare Workers en N peticiones (por defecto 1) */
export function trackCfCall(n = 1): void {
    const data = readUsageData();
    data.cf.count += n;
    saveUsageData(data);
}

/** Resetea manualmente un contador ('vercel' | 'cf') */
export function resetUsage(service: 'vercel' | 'cf'): void {
    const data = readUsageData();
    if (service === 'vercel') {
        data.vercel.count = 0;
    } else {
        data.cf.count = 0;
    }
    saveUsageData(data);
}
