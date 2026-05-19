# Especificación: Contador de Uso con APIs Reales de Vercel y Cloudflare

> **Estado**: Pendiente de implementar  
> **Prioridad**: Media  
> **Objetivo**: Sustituir el contador localStorage (por dispositivo, aproximado) por datos reales obtenidos directamente de las APIs de Vercel y Cloudflare, reflejando el consumo global y exacto.

---

## ¿Por qué es necesario?

El contador actual (`utils/usageTracking.ts`) usa `localStorage`, lo que implica:
- **Solo cuenta peticiones del dispositivo actual** — si usas la PWA en móvil y ordenador, los contadores no se suman
- **No refleja el consumo real** — solo las peticiones lanzadas desde la app en ese navegador
- **No cuenta** llamadas desde otros clientes que puedan usar el mismo backend

La integración con APIs reales resuelve todo esto: los datos vienen de la fuente de verdad.

---

## Arquitectura General

```
[SettingsTab UI]
      │
      ▼
[useUsageTracking.ts]  ──── polling cada 5 min ────►  [/pages/api/usage-stats.ts]
                                                               │
                                            ┌──────────────────┴──────────────────┐
                                            ▼                                     ▼
                                  [Vercel REST API]                   [Cloudflare GraphQL API]
                                  api.vercel.com/v2/usage             api.cloudflare.com/client/v4/graphql
```

**Por qué un API route intermediario (`/pages/api/usage-stats.ts`)**:
- Las APIs de Vercel y Cloudflare no tienen CORS habilitado para llamadas desde el navegador
- Los tokens de acceso deben vivir en variables de entorno del servidor (nunca en el cliente)
- El API route actúa de proxy seguro: el cliente solo llama a `/api/usage-stats`

---

## Parte 1: Vercel API

### Credenciales necesarias

| Variable | Dónde obtenerla |
|---|---|
| `VERCEL_ACCESS_TOKEN` | vercel.com/account/tokens → "Create Token" (scope: full account) |
| `VERCEL_TEAM_ID` | Solo si tienes cuenta de equipo. En cuenta personal dejar vacío. |

Guardar en: **Vercel Dashboard → Settings → Environment Variables** (solo Production/Preview, nunca en el repo).

### Endpoint: Function Invocations

```
GET https://api.vercel.com/v2/usage
Headers:
  Authorization: Bearer {VERCEL_ACCESS_TOKEN}
```

**Alternativa más específica** — Analytics de una deployment (requiere Vercel Pro/Enterprise).  
Para **Hobby** el endpoint disponible es:

```
GET https://api.vercel.com/v9/projects/{projectId}/analytics/usage
```

> **Limitación importante**: La API de Vercel Hobby **no expone invocaciones de funciones** directamente. Lo que sí expone son "Edge requests" y "Bandwidth". Las invocaciones de Serverless Functions solo se ven en el dashboard visual.
>
> **Alternativa**: Usar los **Vercel Logs** (si están habilitados) o el endpoint de deployment metrics:
> ```
> GET https://api.vercel.com/v1/insights/usage?teamId=...&since=...&until=...
> ```

### Respuesta esperada (simplificada)

```json
{
  "data": {
    "functionInvocations": {
      "value": 4521,
      "limit": 100000
    },
    "bandwidth": {
      "value": 1073741824,
      "limit": 107374182400
    }
  }
}
```

### Nota práctica sobre Vercel Hobby

La API de Vercel para cuentas Hobby es bastante limitada. El enfoque más realista es:
1. Obtener el total de invocaciones del mes actual via la API de analytics (si está disponible)
2. Si no está disponible, mantener el contador localStorage como fallback y mostrar un enlace directo al dashboard: `https://vercel.com/dashboard/usage`

---

## Parte 2: Cloudflare Workers API (GraphQL)

### Credenciales necesarias

| Variable | Dónde obtenerla |
|---|---|
| `CF_API_TOKEN` | dash.cloudflare.com → My Profile → API Tokens → "Create Token" con permiso `Account Analytics:Read` |
| `CF_ACCOUNT_ID` | dash.cloudflare.com → lado derecho de la página principal del account |
| `CF_WORKER_NAME` | El nombre del worker desplegado (ej: `stream-verifier`) |

Guardar en: **Vercel Dashboard → Environment Variables**.

### Endpoint: GraphQL Analytics

```
POST https://api.cloudflare.com/client/v4/graphql
Headers:
  Authorization: Bearer {CF_API_TOKEN}
  Content-Type: application/json
```

### Query GraphQL

```graphql
query WorkerUsage($accountTag: string!, $workerName: string!, $since: string!, $until: string!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(
        limit: 1
        filter: {
          scriptName: $workerName
          datetime_geq: $since
          datetime_leq: $until
        }
        orderBy: [datetime_DESC]
      ) {
        dimensions {
          scriptName
        }
        sum {
          requests
          errors
          subrequests
        }
        quantiles {
          cpuTimeP50
          cpuTimeP99
        }
      }
    }
  }
}
```

**Variables de ejemplo**:
```json
{
  "accountTag": "tu_account_id",
  "workerName": "stream-verifier",
  "since": "2026-05-19T00:00:00Z",
  "until": "2026-05-19T23:59:59Z"
}
```

**Respuesta esperada**:
```json
{
  "data": {
    "viewer": {
      "accounts": [{
        "workersInvocationsAdaptive": [{
          "sum": {
            "requests": 3542,
            "errors": 12,
            "subrequests": 0
          }
        }]
      }]
    }
  }
}
```

El campo `requests` es el número de invocaciones del worker para el día actual.

---

## Parte 3: API Route en Next.js

### Archivo a crear: `/pages/api/usage-stats.ts`

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const result: { vercel?: number; cf?: number; errors: string[] } = { errors: [] };

    // ── Vercel ──────────────────────────────────────────────────────────────
    const vercelToken = process.env.VERCEL_ACCESS_TOKEN;
    if (vercelToken) {
        try {
            // Obtener el inicio del mes actual (UTC)
            const now = new Date();
            const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

            const vRes = await fetch(
                `https://api.vercel.com/v1/insights/usage?since=${since}`,
                { headers: { Authorization: `Bearer ${vercelToken}` } }
            );

            if (vRes.ok) {
                const vData = await vRes.json();
                // Adaptar según la estructura real de la respuesta
                result.vercel = vData?.data?.functionInvocations?.value ?? null;
            } else {
                result.errors.push(`Vercel API: ${vRes.status}`);
            }
        } catch (e: any) {
            result.errors.push(`Vercel API error: ${e.message}`);
        }
    }

    // ── Cloudflare ──────────────────────────────────────────────────────────
    const cfToken = process.env.CF_API_TOKEN;
    const cfAccountId = process.env.CF_ACCOUNT_ID;
    const cfWorkerName = process.env.CF_WORKER_NAME;

    if (cfToken && cfAccountId && cfWorkerName) {
        try {
            const now = new Date();
            const since = new Date(Date.UTC(
                now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0
            )).toISOString();
            const until = new Date(Date.UTC(
                now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59
            )).toISOString();

            const query = `
                query {
                  viewer {
                    accounts(filter: { accountTag: "${cfAccountId}" }) {
                      workersInvocationsAdaptive(
                        limit: 1
                        filter: {
                          scriptName: "${cfWorkerName}"
                          datetime_geq: "${since}"
                          datetime_leq: "${until}"
                        }
                      ) {
                        sum { requests }
                      }
                    }
                  }
                }
            `;

            const cfRes = await fetch('https://api.cloudflare.com/client/v4/graphql', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${cfToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            if (cfRes.ok) {
                const cfData = await cfRes.json();
                const invocations = cfData?.data?.viewer?.accounts?.[0]
                    ?.workersInvocationsAdaptive?.[0]?.sum?.requests;
                result.cf = invocations ?? null;
            } else {
                result.errors.push(`CF API: ${cfRes.status}`);
            }
        } catch (e: any) {
            result.errors.push(`CF API error: ${e.message}`);
        }
    }

    // Cache de 5 minutos para no abusar de las APIs
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(result);
}
```

---

## Parte 4: Actualizar `useUsageTracking.ts`

### Cambios necesarios

```typescript
// Añadir al hook existente un efecto que consulte la API real cada 5 minutos
// Si la API devuelve datos, usarlos; si falla, mantener el contador localStorage

useEffect(() => {
    const fetchRealUsage = async () => {
        try {
            const res = await fetch('/api/usage-stats');
            if (!res.ok) return;
            const data = await res.json();

            setUsage(prev => ({
                vercel: data.vercel != null
                    ? { ...prev.vercel, count: data.vercel, fromApi: true }
                    : prev.vercel,
                cf: data.cf != null
                    ? { ...prev.cf, count: data.cf, fromApi: true }
                    : prev.cf,
            }));
        } catch {
            // Fallback silencioso al contador local
        }
    };

    fetchRealUsage(); // Al montar
    const id = setInterval(fetchRealUsage, 5 * 60 * 1000); // Cada 5 minutos
    return () => clearInterval(id);
}, []);
```

### Añadir campo `fromApi` a `ServiceUsage`

```typescript
export interface ServiceUsage {
    count: number;
    period: string;
    resetDate: string;
    fromApi?: boolean; // true si el dato viene de la API real, false si es localStorage
}
```

Usar `fromApi` en la UI para mostrar un indicador:
- `fromApi: true` → icono verde "Datos en tiempo real"  
- `fromApi: false` → icono amarillo "Estimación local (dispositivo actual)"

---

## Parte 5: Variables de entorno a configurar en Vercel

En **Vercel Dashboard → tu proyecto → Settings → Environment Variables**:

| Variable | Entornos | Descripción |
|---|---|---|
| `VERCEL_ACCESS_TOKEN` | Production, Preview | Token personal de Vercel |
| `VERCEL_TEAM_ID` | Production, Preview | Solo si es cuenta de equipo. Dejar vacío en personal. |
| `CF_API_TOKEN` | Production, Preview | Token de API de Cloudflare con permiso Analytics:Read |
| `CF_ACCOUNT_ID` | Production, Preview | ID de la cuenta Cloudflare |
| `CF_WORKER_NAME` | Production, Preview | Nombre del worker (ej: `stream-verifier`) |

> **Seguridad**: Estas variables son solo accesibles desde el servidor (API routes). El navegador no las ve nunca.

---

## Parte 6: UI — Indicador de fuente de datos

En el widget `UsageWidget` de `SettingsTab.tsx`, añadir junto al título de cada servicio:

```tsx
{usage.vercel.fromApi ? (
    <span className="text-xs text-green-400 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"></span>
        Tiempo real
    </span>
) : (
    <span className="text-xs text-yellow-500 flex items-center gap-1" title="Solo cuenta este dispositivo">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block"></span>
        Estimación local
    </span>
)}
```

---

## Limitaciones conocidas y decisiones de diseño

| Limitación | Impacto | Solución |
|---|---|---|
| Vercel Hobby API no expone invocaciones de funciones | Puede que `result.vercel` sea siempre `null` | Mostrar enlace al dashboard + mantener contador local como fallback |
| CF GraphQL puede tardar 1-2 min en reflejar datos nuevos | Datos casi-realtime, no instantáneos | Aceptable para el caso de uso |
| El API route de usage-stats consume él mismo una invocación de Vercel | Overhead mínimo (polling cada 5 min) | Ignorar o no contabilizar estas llamadas |
| Si CF_WORKER_NAME es incorrecto, la query devuelve `requests: 0` sin error | Puede parecer que no hay uso | Validar el nombre en el onboarding de configuración |

---

## Resumen de archivos a crear/modificar

| Archivo | Acción | Descripción |
|---|---|---|
| `pages/api/usage-stats.ts` | **CREAR** | API route proxy que consulta Vercel + CF |
| `useUsageTracking.ts` | **MODIFICAR** | Añadir polling a `/api/usage-stats`, campo `fromApi` |
| `utils/usageTracking.ts` | **MODIFICAR** | Añadir campo `fromApi` a `ServiceUsage` |
| `SettingsTab.tsx` | **MODIFICAR** | Indicador visual "Tiempo real" vs "Estimación local" |
| Variables de entorno en Vercel | **CONFIGURAR** | 5 variables (ver Parte 5) |

---

*Documento creado el 19 de mayo de 2026. Para implementar, mostrar este archivo a la IA y pedir que siga las instrucciones de cada parte en orden.*
