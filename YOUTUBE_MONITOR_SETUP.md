# Configuración del Monitor Automático de YouTube Live

## ¿Qué hace el sistema?

El sistema de monitoreo automático:
1. **Verifica periódicamente** todos los canales de YouTube configurados
2. **Detecta automáticamente** cuando un canal entra en vivo
3. **Extrae las URLs .m3u8** reales de los streams en vivo
4. **Actualiza el archivo M3U** con los streams activos
5. **Mantiene un log** de todas las actividades

## Archivos del sistema

- `youtube_monitor.py` - Script principal de monitoreo
- `run_youtube_monitor.sh` - Script wrapper para cron
- `youtube_channels.json` - Base de datos de canales configurados
- `youtube_live.m3u` - Archivo M3U generado automáticamente
- `youtube_monitor.log` - Log de actividades

## Configuración del cron job

### Paso 1: Abrir crontab
```bash
crontab -e
```

### Paso 2: Añadir las siguientes líneas

```bash
# Monitor de YouTube Live - cada hora
0 * * * * /Users/juancarlos/Sites/PWA-M3U-Manager/run_youtube_monitor.sh

# Monitor de YouTube Live - cada 30 minutos (opcional, más frecuente)
# 0,30 * * * * /Users/juancarlos/Sites/PWA-M3U-Manager/run_youtube_monitor.sh

# Monitor de YouTube Live - cada 15 minutos (opcional, muy frecuente)
# */15 * * * * /Users/juancarlos/Sites/PWA-M3U-Manager/run_youtube_monitor.sh
```

### Paso 3: Guardar y salir
- En nano: `Ctrl + X`, luego `Y`, luego `Enter`
- En vim: `:wq`

## Verificar que el cron está funcionando

### Ver cron jobs activos:
```bash
crontab -l
```

### Ver el log del monitor:
```bash
tail -f /Users/juancarlos/Sites/PWA-M3U-Manager/youtube_monitor.log
```

### Ejecutar manualmente para probar:
```bash
cd /Users/juancarlos/Sites/PWA-M3U-Manager
./run_youtube_monitor.sh
```

## Cómo funciona la sincronización

1. **Añadir canales**: Usa la interfaz web para añadir canales de YouTube
2. **Sincronización**: Los canales se guardan en localStorage del navegador
3. **Monitor**: El cron job lee `youtube_channels.json` y verifica cada canal
4. **Actualización**: Cuando detecta un stream en vivo, actualiza el archivo M3U
5. **IPTV**: Los reproductores IPTV pueden usar el archivo `youtube_live.m3u`

## Estados de los canales

- 🟢 **active**: Canal en vivo con stream .m3u8 válido
- 🟡 **checking**: Canal configurado pero no está en vivo
- 🔴 **error**: Error al verificar el canal

## Ejemplo de uso

1. Añadir un canal desde la web: `https://www.youtube.com/@NASA/live`
2. El sistema lo guarda como "checking"
3. El monitor verifica cada hora
4. Cuando NASA entre en vivo, el monitor:
   - Extrae la URL .m3u8 real
   - Actualiza el estado a "active"
   - Incluye el canal en el archivo M3U
5. Los reproductores IPTV pueden reproducir el stream

## Solución de problemas

### El cron no se ejecuta:
- Verificar permisos: `chmod +x run_youtube_monitor.sh`
- Verificar rutas en el script
- Revisar logs del sistema: `tail /var/log/system.log`

### No se detectan streams:
- Los canales pueden no estar en vivo
- YouTube cambió su estructura (actualizar algoritmo)
- Problemas de red o timeout

### Archivo M3U vacío:
- Normal si ningún canal está en vivo
- Verificar que `youtube_channels.json` tiene canales configurados

## Comandos útiles

```bash
# Ver estado actual
cat /Users/juancarlos/Sites/PWA-M3U-Manager/youtube_live.m3u

# Ver canales configurados  
cat /Users/juancarlos/Sites/PWA-M3U-Manager/youtube_channels.json

# Ver últimas actividades del monitor
tail -20 /Users/juancarlos/Sites/PWA-M3U-Manager/youtube_monitor.log

# Ejecutar monitor manualmente
cd /Users/juancarlos/Sites/PWA-M3U-Manager && ./run_youtube_monitor.sh
```