# 📺 YouTube Live M3U8 Extractor - Guía de Uso

## ✅ Estado: LISTO PARA DESPLEGAR

**Rama:** `feature/youtube-m3u-extractor`  
**Commit:** `7d85cbfc`

---

## 🎯 ¿Qué hace esta función?

Extrae URLs M3U8 de canales en directo de YouTube y las **actualiza automáticamente cada 3 horas** usando EventBridge (cron).

### Basado en:
- Proyecto: [YouTube_to_m3u](https://github.com/benmoose39/YouTube_to_m3u)
- Método: Scraping HTML para encontrar URLs `.m3u8`
- Actualización: Cron cada 3 horas (como recomienda el proyecto original)

---

## 📦 Componentes Desplegados

### 1. **Lambda Function: YouTubeExtractorFunction**
- **Runtime:** Python 3.11
- **Timeout:** 60 segundos
- **Memoria:** 512 MB
- **Trigger:** EventBridge (cada 3 horas) + API Gateway

### 2. **DynamoDB Table: YouTubeChannels**
- **Billing:** Pay-per-request (Free Tier compatible)
- **Schema:**
  ```
  channel_id (PK)      -> yt-1234567890
  youtube_url          -> https://www.youtube.com/watch?v=...
  m3u8_url             -> https://manifest.googlevideo.com/.../master.m3u8
  channel_name         -> "Mi Canal Favorito"
  group_title          -> "YouTube Live"
  tvg_logo             -> URL del logo
  status               -> "active" | "offline"
  created_at           -> ISO timestamp
  updated_at           -> ISO timestamp
  last_check           -> ISO timestamp
  ```

### 3. **EventBridge Rule**
- **Schedule:** `rate(3 hours)`
- **Función:** Actualiza automáticamente todas las URLs M3U8

### 4. **API Gateway Endpoint**
- **URL:** `https://[API-ID].execute-api.eu-west-1.amazonaws.com/Prod/youtube`
- **CORS:** Habilitado

---

## 🚀 Despliegue

### Paso 1: Build
```bash
cd /Users/juancarlos/Local\ Sites/PWA\ M3U\ Manager/aws-lambda
sam build
```

### Paso 2: Deploy
```bash
sam deploy
```

### Paso 3: Obtener URLs
Después del deploy, SAM mostrará:
```
Outputs:
  YouTubeExtractorApi: https://[API-ID].execute-api.eu-west-1.amazonaws.com/Prod/youtube
  YouTubeExtractorFunction: arn:aws:lambda:eu-west-1:...
  YouTubeChannelsTableName: YouTubeChannels
```

**Guarda la URL del YouTubeExtractorApi** para usarla en tu PWA.

---

## 📖 API Reference

### 1. **Añadir Canal YouTube**

```bash
GET /youtube?action=add&url=YOUTUBE_URL&name=NOMBRE&group=GRUPO&logo=LOGO_URL
```

**Parámetros:**
- `action=add` (requerido)
- `url` (requerido): URL de YouTube live stream
- `name` (opcional): Nombre del canal
- `group` (opcional): Grupo M3U (default: "YouTube Live")
- `logo` (opcional): URL del logo

**Ejemplo:**
```bash
curl "https://[API-ID].execute-api.eu-west-1.amazonaws.com/Prod/youtube?action=add&url=https://www.youtube.com/watch?v=XXXXXXXXXXX&name=Mi%20Canal&group=Noticias"
```

**Respuesta:**
```json
{
  "success": true,
  "channel_id": "yt-1730000000000",
  "channel_name": "Mi Canal",
  "m3u8_url": "https://manifest.googlevideo.com/.../master.m3u8",
  "message": "Channel added successfully"
}
```

---

### 2. **Listar Todos los Canales**

```bash
GET /youtube?action=list
```

**Respuesta:**
```json
{
  "total": 5,
  "channels": [
    {
      "channel_id": "yt-1730000000000",
      "channel_name": "Mi Canal",
      "youtube_url": "https://www.youtube.com/watch?v=...",
      "m3u8_url": "https://manifest.googlevideo.com/.../master.m3u8",
      "group_title": "Noticias",
      "status": "active",
      "updated_at": "2025-10-27T12:00:00.000Z",
      "last_check": "2025-10-27T15:00:00.000Z"
    }
  ]
}
```

---

### 3. **Obtener M3U8 de un Canal**

```bash
GET /youtube?action=get_m3u8&channel_id=CHANNEL_ID
```

**Respuesta:**
```json
{
  "channel_id": "yt-1730000000000",
  "m3u8_url": "https://manifest.googlevideo.com/.../master.m3u8",
  "channel_name": "Mi Canal",
  "status": "active",
  "updated_at": "2025-10-27T15:00:00.000Z"
}
```

---

### 4. **Eliminar Canal**

```bash
GET /youtube?action=remove&channel_id=CHANNEL_ID
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Channel yt-1730000000000 removed successfully"
}
```

---

### 5. **Extracción Manual (sin guardar)**

```bash
GET /youtube?action=extract&url=YOUTUBE_URL
```

**Respuesta:**
```json
{
  "youtube_url": "https://www.youtube.com/watch?v=...",
  "m3u8_url": "https://manifest.googlevideo.com/.../master.m3u8",
  "extracted_at": "2025-10-27T15:30:00.000Z"
}
```

---

## ⏰ Actualización Automática

El cron de EventBridge se ejecuta **cada 3 horas** automáticamente:

1. Lee todos los canales de DynamoDB
2. Extrae la URL M3U8 actualizada de cada canal YouTube
3. Actualiza el campo `m3u8_url` en DynamoDB
4. Marca canales offline si no se puede extraer la URL

**Logs del Cron:**
```
🔄 Updating 5 channels...
Processing: Mi Canal (yt-1730000000000)
✅ Updated: Mi Canal
Processing: Canal 2 (yt-1730000000001)
❌ Offline: Canal 2
```

---

## 💰 Costes AWS (Estimación)

### Capa Gratuita:
- **Lambda:** 1M peticiones/mes + 400,000 GB-segundo
- **DynamoDB:** 25 GB almacenamiento + 25 WCU + 25 RCU
- **EventBridge:** 1M eventos/mes

### Uso estimado (10 canales):
```
EventBridge: 8 invocaciones/día × 30 = 240 eventos/mes
Lambda: 240 cron + 100 API calls = 340 invocaciones/mes
DynamoDB: ~10 KB storage + 500 read/write operations

TOTAL: $0.00 (100% dentro de capa gratuita) ✅
```

---

## 🎨 Integración con PWA

### Próximos pasos:

1. **Crear pestaña "YouTube Live"** en `PWAM3UManager.tsx`
2. **Componente:** `YouTubeLiveTab.tsx`
3. **API calls:** Usar `NEXT_PUBLIC_YOUTUBE_EXTRACTOR_API`

### Ejemplo de integración:

```typescript
// pages/api/youtube.ts
export default async function handler(req, res) {
  const YOUTUBE_API = process.env.YOUTUBE_EXTRACTOR_API;
  const { action, ...params } = req.query;
  
  const queryString = new URLSearchParams({
    action,
    ...params
  }).toString();
  
  const response = await fetch(`${YOUTUBE_API}?${queryString}`);
  const data = await response.json();
  
  res.status(response.status).json(data);
}
```

---

## 🔧 Testing Manual

### Test 1: Extraer M3U8 de un canal en directo

```bash
YOUTUBE_API="https://[API-ID].execute-api.eu-west-1.amazonaws.com/Prod/youtube"

curl "$YOUTUBE_API?action=extract&url=https://www.youtube.com/watch?v=9Auq9mYxFEE"
```

**Resultado esperado:** URL M3U8 extraída

---

### Test 2: Añadir canal

```bash
curl "$YOUTUBE_API?action=add&url=https://www.youtube.com/watch?v=9Auq9mYxFEE&name=Sky%20News&group=Noticias"
```

**Resultado esperado:** 
```json
{
  "success": true,
  "channel_id": "yt-...",
  "m3u8_url": "https://manifest.googlevideo.com/..."
}
```

---

### Test 3: Listar canales

```bash
curl "$YOUTUBE_API?action=list"
```

**Resultado esperado:** Lista de canales guardados

---

### Test 4: Verificar auto-actualización

1. Añade un canal
2. Espera 3 horas
3. Consulta el canal de nuevo
4. Verifica que `updated_at` cambió

---

## ⚠️ Limitaciones Conocidas

1. **URLs M3U8 temporales:** Las URLs extraídas expiran en ~6 horas
2. **Solo canales EN DIRECTO:** No funciona con videos grabados
3. **Método de scraping:** Si YouTube cambia su HTML, puede dejar de funcionar
4. **Rate limiting:** YouTube puede bloquear si se hacen demasiadas peticiones

---

## 🐛 Troubleshooting

### Error: "No live stream found"
**Causa:** El canal no está en directo o YouTube cambió el formato HTML  
**Solución:** Verifica que el canal esté transmitiendo en vivo

### Error: "Timeout accessing YouTube"
**Causa:** YouTube tardó más de 15 segundos en responder  
**Solución:** Reintenta la petición

### Error: "Database error"
**Causa:** Permisos insuficientes para DynamoDB  
**Solución:** Verifica que la Lambda tenga permisos `dynamodb:*`

---

## 📝 Próximos Pasos

1. ✅ **Desplegar a AWS** (`sam build` + `sam deploy`)
2. ⏳ **Crear UI en PWA** (YouTubeLiveTab.tsx)
3. ⏳ **Configurar variable de entorno** en Vercel
4. ⏳ **Testing con canales reales**
5. ⏳ **Documentar uso para usuarios finales**

---

## 📚 Referencias

- [YouTube_to_m3u GitHub](https://github.com/benmoose39/YouTube_to_m3u)
- [AWS Lambda Python](https://docs.aws.amazon.com/lambda/latest/dg/lambda-python.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [EventBridge Schedule Expressions](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html)

---

**Rama GitHub:** `feature/youtube-m3u-extractor`  
**Commit:** `7d85cbfc`  
**Estado:** ✅ Listo para desplegar
