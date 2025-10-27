# 🎬 Guía de Uso: YouTube Live en PWA M3U Manager

## 🚀 Inicio Rápido (5 minutos)

### Paso 1: Accede a la pestaña YouTube Live

1. Abre la PWA M3U Manager en tu navegador: http://localhost:3000
2. Haz clic en la pestaña **"YouTube Live"** (icono de YouTube rojo)

### Paso 2: Añade tu primer canal

Ejemplo con Canal Red Live (canal de noticias en español):

```
URL: https://www.youtube.com/@CanalRedLive/live
Nombre: Canal Red (Noticias)
Grupo: Noticias España
```

1. Pega la URL en el campo **"URL de YouTube"**
2. Personaliza el nombre: `Canal Red (Noticias)`
3. Cambia el grupo a: `Noticias España`
4. Haz clic en **"Añadir Canal"**

### Paso 3: Espera la extracción

- Verás un spinner azul 🔄 mientras se extrae el stream
- En 5-10 segundos aparecerá:
  - ✅ **Éxito**: "Stream extraído (1080p)"
  - ❌ **Error**: Mensaje de error con opción de reintentar

### Paso 4: Añade a tu playlist M3U

1. Una vez extraído, haz clic en **"Añadir a Playlist M3U"**
2. El canal se añadirá a tu lista principal en el grupo "Noticias España"
3. Ve a la pestaña **"Editor de Playlist"** para ver tu canal

### Paso 5: Guarda tu playlist

1. Ve a la pestaña **"Guardar y Exportar"**
2. Descarga el archivo `.m3u` o súbelo a Dropbox
3. Usa el archivo en tu reproductor favorito (VLC, Kodi, TiviMate, etc.)

---

## 📺 Canales de ejemplo para probar

### Canales de Noticias en Español

| Canal | URL | Descripción |
|-------|-----|-------------|
| Canal Red | `https://www.youtube.com/@CanalRedLive/live` | Noticias 24/7 |
| DW Español | `https://www.youtube.com/@dwespanol/live` | Noticias internacionales |

### Canales Internacionales

| Canal | URL | Descripción |
|-------|-----|-------------|
| NASA TV | `https://www.youtube.com/@NASA/live` | Transmisiones espaciales |
| Bloomberg | `https://www.youtube.com/@markets/live` | Noticias financieras |

### Canales de Música/Relax

| Canal | URL | Descripción |
|-------|-----|-------------|
| Lofi Girl | `https://www.youtube.com/@LofiGirl/live` | Música lofi 24/7 |
| ChilledCow | `https://www.youtube.com/@ChillMusicLab/live` | Música relajante |

---

## 🎯 Casos de Uso

### Caso 1: Crear lista de noticias 24/7

```yaml
Objetivo: Playlist con canales de noticias internacionales

Canales:
  - Canal Red (@CanalRedLive/live)
  - DW Español (@dwespanol/live)
  - France 24 (@FRANCE24/live)
  - RT en Español (@ActualidadRT/live)

Grupo: "Noticias 24/7"

Pasos:
  1. Añadir todos los canales en YouTube Live tab
  2. Esperar extracción de todos
  3. Añadir a Playlist M3U
  4. Guardar como "noticias_24_7.m3u"
```

### Caso 2: Música ambiente para trabajar

```yaml
Objetivo: Canales de música lofi/chill para concentración

Canales:
  - Lofi Girl (@LofiGirl/live)
  - ChillHop Music (@Chillhop Music/live)
  - The Jazz Cafe (@thejazzcafe/live)

Grupo: "Música Trabajo"

Pasos:
  1. Añadir canales en YouTube Live tab
  2. Personalizar nombres (ej: "Lofi - Estudio")
  3. Añadir a Playlist M3U
  4. Guardar como "musica_trabajo.m3u"
```

### Caso 3: Mezclar YouTube Live con canales IPTV normales

```yaml
Objetivo: Playlist combinada con canales tradicionales + YouTube

Pasos:
  1. Editor Tab: Cargar playlist IPTV existente
  2. YouTube Live Tab: Añadir canales de YouTube
  3. Editor Tab: Ver todos los canales mezclados
  4. Reordenar según preferencia
  5. Asignar EPG si es necesario
  6. Guardar playlist final
```

---

## 🔧 Solución de Problemas Comunes

### ❌ Error: "El canal no está en vivo"

**Problema**: La URL apunta a un canal que no está transmitiendo

**Solución**:
1. Verifica en YouTube que el canal esté EN VIVO
2. Usa URLs tipo `/@canal/live` en lugar de `/streams`
3. Si es un video específico, asegúrate de que sea un livestream activo

**Ejemplo correcto**:
```
❌ https://www.youtube.com/@CanalRedLive/streams  (lista de streams)
✅ https://www.youtube.com/@CanalRedLive/live     (stream actual)
```

### ❌ Error: "Sign in to confirm you're not a bot"

**Problema**: YouTube bloqueó la extracción por detección de bot

**Solución**:
- Este error es raro gracias a las cookies de autenticación
- Si ocurre, espera 5 minutos y vuelve a intentar
- Usa el botón **"Reintentar"** en el canal fallido

### ⏰ Las URLs dejaron de funcionar después de unas horas

**Problema**: Las URLs M3U8 de YouTube caducan

**Solución**:
1. Ve a YouTube Live tab
2. Vuelve a añadir el mismo canal
3. Añade a Playlist M3U (reemplazará el anterior)
4. Guarda la playlist actualizada

**Prevención**:
- Configura tu reproductor para actualizar la playlist cada 4 horas
- O usa herramientas que refresquen automáticamente las URLs

### 🐌 La extracción es muy lenta

**Problema**: Tarda más de 15 segundos

**Solución**:
- Es normal, la Lambda puede tardar 5-15 segundos
- YouTube a veces responde lento
- Si tarda >30 segundos, recarga la página e intenta de nuevo

---

## 💡 Tips y Mejores Prácticas

### ✅ DO (Hacer)

- ✅ Usa URLs `/@usuario/live` siempre que sea posible
- ✅ Verifica que el canal esté en vivo antes de añadir
- ✅ Personaliza nombres y grupos para mejor organización
- ✅ Actualiza las URLs cada 4-6 horas si las vas a usar largo plazo
- ✅ Guarda tu playlist después de cada cambio importante

### ❌ DON'T (No hacer)

- ❌ No uses URLs `/streams` (listan futuros streams, no el actual)
- ❌ No añadas canales que no estén en vivo
- ❌ No esperes que las URLs funcionen más de 6 horas sin actualizar
- ❌ No añadas el mismo canal múltiples veces (usa "Añadir a Playlist" solo una vez)

---

## 📱 Uso en Reproductores IPTV

### VLC Media Player

1. Guarda tu playlist: `mi_lista_youtube.m3u`
2. VLC → Media → Open File → Selecciona `mi_lista_youtube.m3u`
3. Los canales de YouTube aparecerán mezclados con el resto

### Kodi

1. Instala addon: PVR IPTV Simple Client
2. Settings → Add-ons → PVR IPTV Simple Client → Configure
3. M3U Play List URL: Ruta a tu `mi_lista_youtube.m3u`
4. Reload

### TiviMate (Android)

1. Settings → Playlists → Add Playlist
2. Choose file: Selecciona tu `mi_lista_youtube.m3u`
3. Todos los canales (incluidos YouTube) estarán disponibles

### Perfect Player (Android/Windows)

1. Settings → General → Playlist 1
2. Browse → Selecciona `mi_lista_youtube.m3u`
3. Reload playlist

---

## 🎓 Ejemplo Completo Paso a Paso

### Crear playlist "Mis Canales 24/7"

**Objetivo**: Una playlist con noticias y música que funcione todo el día

#### Paso 1: Preparar canales de YouTube

En YouTube Live tab, añade:

1. **Canal Red** (Noticias)
   - URL: `https://www.youtube.com/@CanalRedLive/live`
   - Nombre: `Canal Red Noticias 24/7`
   - Grupo: `Noticias`

2. **DW Español** (Noticias)
   - URL: `https://www.youtube.com/@dwespanol/live`
   - Nombre: `DW Deutsch Welle Español`
   - Grupo: `Noticias`

3. **Lofi Girl** (Música)
   - URL: `https://www.youtube.com/@LofiGirl/live`
   - Nombre: `Lofi Hip Hop - Beats to Study`
   - Grupo: `Música`

#### Paso 2: Esperar extracción

Espera a que los 3 canales muestren ✅ (success)

#### Paso 3: Añadir a Playlist

Haz clic en **"Añadir a Playlist M3U"**

#### Paso 4: Organizar en Editor

Ve a **Editor de Playlist**:
- Verás tus 3 canales
- Reordenar si quieres: Noticias arriba, Música abajo
- Editar logos si quieres (tvg-logo)

#### Paso 5: Guardar

Ve a **Guardar y Exportar**:
- Nombre: `mis_canales_24_7.m3u`
- Descargar o subir a Dropbox

#### Paso 6: Usar en reproductor

1. Copia `mis_canales_24_7.m3u` a tu dispositivo
2. Abre con VLC/Kodi/TiviMate
3. ¡Disfruta tus canales 24/7!

---

## 🔄 Actualización de URLs (Rutina semanal)

Para mantener tus canales de YouTube funcionando:

### Opción A: Manual (10 minutos)

**Cada 4-5 días**:
1. Abre PWA M3U Manager
2. Ve a YouTube Live tab
3. Vuelve a añadir cada canal (copia las URLs del YOUTUBE_INTEGRATION.md)
4. Añade a Playlist M3U
5. Guarda y exporta

### Opción B: Semi-automática (recomendada)

**Configura tu reproductor**:
- TiviMate: Auto-update playlist cada 4 horas
- Kodi: Reload playlist automáticamente
- VLC: Usa script de actualización

---

## 📊 Estadísticas y Rendimiento

### Tiempos de extracción

- **Normal**: 5-10 segundos
- **Con caché**: <1 segundo (si se extrajo en las últimas 2 horas)
- **Lento**: 15-20 segundos (YouTube responde lento)

### Calidades disponibles

- **4K**: 2160p (raro en YouTube Live)
- **FHD**: 1080p (común en canales profesionales)
- **HD**: 720p (mayoría de canales)
- **SD**: 480p o menos (canales pequeños)

### Límites de API

- **Rate limit**: 50 requests/segundo
- **Burst**: 100 requests
- **Diario**: 10,000 requests
- **Uso normal**: ~3-5 requests/día por usuario

---

## 🎉 ¡Listo!

Ya tienes todo lo necesario para usar YouTube Live en tu PWA M3U Manager.

**Próximos pasos**:
1. Prueba con Canal Red Live (siempre está en vivo)
2. Experimenta con diferentes canales
3. Crea tu playlist personalizada
4. Comparte tus playlists con amigos/familia

**¿Necesitas ayuda?**
- Lee la documentación en `YOUTUBE_INTEGRATION.md`
- Revisa los logs de CloudWatch si hay errores
- Verifica que las cookies estén actualizadas en AWS Secrets Manager

¡Disfruta de tus canales de YouTube en tu reproductor IPTV favorito! 🎬📺
