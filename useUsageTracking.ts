import { useState, useEffect, useCallback } from 'react';
import {
    readUsageData,
    resetUsage,
    UsageData,
    VERCEL_MONTHLY_LIMIT,
    CF_DAILY_LIMIT,
} from './utils/usageTracking';

export interface UsageHook {
    usage: UsageData;
    vercelPercent: number;
    cfPercent: number;
    refresh: () => void;
    resetVercel: () => void;
    resetCf: () => void;
}

/**
 * Hook para leer y actualizar el estado de uso de APIs en la UI.
 * Se refresca automáticamente cada 5 segundos cuando está montado.
 */
export function useUsageTracking(): UsageHook {
    const [usage, setUsage] = useState<UsageData>(() => readUsageData());

    const refresh = useCallback(() => {
        setUsage(readUsageData());
    }, []);

    // Refresca cada 5 segundos para capturar cambios de useReparacion
    useEffect(() => {
        const id = setInterval(refresh, 5000);
        return () => clearInterval(id);
    }, [refresh]);

    const resetVercel = useCallback(() => {
        resetUsage('vercel');
        refresh();
    }, [refresh]);

    const resetCf = useCallback(() => {
        resetUsage('cf');
        refresh();
    }, [refresh]);

    return {
        usage,
        vercelPercent: Math.min(100, (usage.vercel.count / VERCEL_MONTHLY_LIMIT) * 100),
        cfPercent: Math.min(100, (usage.cf.count / CF_DAILY_LIMIT) * 100),
        refresh,
        resetVercel,
        resetCf,
    };
}
