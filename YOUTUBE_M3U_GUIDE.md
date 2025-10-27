# Guía del Sistema Youtube.m3u

## 📋 Descripción General

El sistema **Youtube.m3u** es un archivo separado e independiente que contiene exclusivamente canales de YouTube Live. Este archivo se gestiona de forma autónoma desde la pestaña de **Configuración** y se guarda localmente en el navegador usando `localStorage`.

## 🎯 ¿Por qué un archivo separado?

Los canales de YouTube tienen características especiales que los hacen diferentes de los canales IPTV tradicionales:

- **URLs temporales**: Las URLs M3U8 de YouTube expiran aproximadamente cada 6 horas
- **Actualización frecuente**: Necesitan ser re-extraídas periódicamente
- **Gestión independiente**: Es más práctico manejarlos en un archivo separado
- **Flexibilidad**: Puedes decidir si incluirlos o no en tu setup sin afectar tu playlist principal

## 📁 Ubicación del Archivo

- **Almacenamiento**: localStorage del navegador (`youtube_channels` key)
- **Nombre**: `Youtube.m3u` (cuando se descarga)
- **Formato**: M3U estándar compatible con cualquier reproductor

## 🚀 Flujo de Trabajo

### 1. Añadir Canales (Pestaña YouTube Live)

1. Ve a la pestaña **"YouTube Live"**
2. Pega la URL del canal de YouTube en vivo:
   ```
   https://www.youtube.com/@CanalRedLive/live
   ```
3. Personaliza (opcional):
   - **Nombre**: Nombre personalizado del canal
   - **Logo**: URL de la imagen/logo del canal
   - **Grupo**: Categoría (por defecto: "YouTube Live")
4. Haz clic en **"Añadir Canal"**
5. El sistema extrae automáticamente la URL M3U8
6. Cuando termines, haz clic en **"Guardar en Youtube.m3u"**

### 2. Gestionar Canales (Pestaña Configuración)

En la pestaña **"Configuración"**, en la sección **"Gestión de Youtube.m3u"** puedes:

- **Ver** todos los canales guardados con sus detalles
- **Descargar** el archivo `Youtube.m3u` actualizado
- **Eliminar** canales individuales
- **Limpiar** toda la lista de una vez

## 📊 Estructura del Archivo

El archivo `Youtube.m3u` generado tiene este formato:

```m3u
#EXTM3U
#EXTINF:-1 tvg-id="" tvg-name="Canal Red TV" tvg-logo="https://ejemplo.com/logo.png" group-title="YouTube Live",Canal Red TV
https://rr2---sn-vgqsknlr.googlevideo.com/videoplayback?expire=1234567890&...

#EXTINF:-1 tvg-id="" tvg-name="Otro Canal" tvg-logo="" group-title="YouTube Live",Otro Canal
https://rr1---sn-vgqsknlr.googlevideo.com/videoplayback?expire=1234567890&...
```

## ⚙️ Características Técnicas

### Persistencia de Datos

```typescript
// Los datos se guardan en localStorage
const YOUTUBE_CHANNELS_KEY = 'youtube_channels';

// Estructura de cada canal
interface Channel {
  id: string;
  order: number;
  tvgId: string;
  tvgName: string;
  tvgLogo: string;      // URL del logo
  groupTitle: string;   // Grupo (ej: "YouTube Live")
  name: string;         // Nombre del canal
  url: string;          // URL M3U8 extraída
  status?: 'pending' | 'ok' | 'failed';
}
```

### Funciones Disponibles (useSettings.ts)

| Función | Descripción |
|---------|-------------|
| `addYoutubeChannel(channel)` | Añade un canal individual |
| `addYoutubeChannels(channels)` | Añade múltiples canales |
| `deleteYoutubeChannel(id)` | Elimina un canal específico |
| `clearYoutubeChannels()` | Elimina todos los canales |
| `exportYoutubeM3U()` | Genera el contenido M3U |
| `downloadYoutubeM3U()` | Descarga el archivo |

## 🔄 Actualización de URLs

Las URLs M3U8 de YouTube expiran después de ~6 horas. Para actualizarlas:

1. Ve a la pestaña **"YouTube Live"**
2. Vuelve a añadir los canales (puedes usar las mismas URLs)
3. El sistema extraerá las nuevas URLs M3U8 actualizadas
4. Haz clic en **"Guardar en Youtube.m3u"**
5. Descarga el archivo actualizado desde **"Configuración"**

## 📱 Uso en Reproductores

### VLC

1. Descarga el archivo `Youtube.m3u` desde la pestaña Configuración
2. Abre VLC → Media → Open File
3. Selecciona `Youtube.m3u`

### Kodi / TiviMate / Perfect Player

1. Descarga el archivo `Youtube.m3u`
2. Sube el archivo a un servidor web o Dropbox
3. Usa la URL pública en la configuración de tu reproductor

### Integración con Playlist Principal

Si prefieres tener todo en un solo archivo:

1. Descarga `Youtube.m3u` desde Configuración
2. Abre el archivo en un editor de texto
3. Copia los canales (excepto la primera línea `#EXTM3U`)
4. Pégalos en tu archivo M3U principal

## ⚠️ Limitaciones y Consideraciones

### Expiración de URLs
- Las URLs M3U8 de YouTube son temporales
- Válidas por aproximadamente 6 horas
- Necesitan ser re-extraídas periódicamente

### Canales en Vivo
- Solo funciona con canales que están transmitiendo EN VIVO
- No funciona con videos pregrabados (a menos que sean streams 24/7)
- Usa URLs del formato `/@canal/live` para mejor compatibilidad

### Almacenamiento Local
- Los datos se guardan en localStorage del navegador
- Si limpias los datos del navegador, se pierden los canales
- **Recomendación**: Descarga el archivo `Youtube.m3u` regularmente como backup

## 🔧 Troubleshooting

### "No hay canales guardados"
- Verifica que hayas hecho clic en "Guardar en Youtube.m3u" después de extraer
- Comprueba que no hayas limpiado los datos del navegador

### "El reproductor no abre el archivo"
- Asegúrate de que el canal estaba transmitiendo cuando se extrajo la URL
- Las URLs pueden haber expirado (re-extrae los canales)
- Verifica que el reproductor soporte formato M3U8

### "Error al extraer canal"
- El canal debe estar transmitiendo EN VIVO
- Usa el formato de URL recomendado: `/@canal/live`
- Verifica que la URL sea correcta

## 💡 Mejores Prácticas

1. **Extrae URLs frescas** antes de usar el archivo
2. **Descarga backups** del archivo regularmente
3. **Usa nombres descriptivos** para identificar canales fácilmente
4. **Añade logos** para mejor visualización en reproductores
5. **Organiza por grupos** para categorizar tus canales

## 📝 Ejemplo Completo

```javascript
// Flujo completo de uso
1. Ir a "YouTube Live"
2. Añadir: https://www.youtube.com/@CanalRedLive/live
   - Nombre: "Canal Red TV en Vivo"
   - Logo: "https://i.ytimg.com/vi/ABC123/maxresdefault.jpg"
   - Grupo: "Noticias"
3. Clic en "Añadir Canal" → Esperar extracción
4. Clic en "Guardar en Youtube.m3u"
5. Ir a "Configuración"
6. Clic en "Descargar Youtube.m3u"
7. Usar el archivo en tu reproductor favorito
```

## 🔐 Seguridad y Privacidad

- Los datos se guardan **solo localmente** en tu navegador
- No se envían a ningún servidor externo
- Las URLs M3U8 son públicas (proporcionadas por Google/YouTube)
- Tu lista de canales es completamente privada

## 🎉 Ventajas del Sistema

✅ **Independiente**: No afecta tu playlist M3U principal  
✅ **Actualizable**: Fácil de mantener al día  
✅ **Portable**: Descarga y usa en cualquier reproductor  
✅ **Flexible**: Añade/elimina canales sin complicaciones  
✅ **Persistente**: Se guarda automáticamente en tu navegador  
✅ **Compatible**: Formato M3U estándar universal  

---

**¿Necesitas ayuda?** Consulta la pestaña **"Ayuda"** en la aplicación para más información.
