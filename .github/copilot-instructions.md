# PWA M3U Manager - Instrucciones para Agentes de IA

## 🗣️ IDIOMA Y COMUNICACIÓN
**SIEMPRE responde en ESPAÑOL**. Este proyecto es en español, los commits deben ser en español, los comentarios de código en español, y toda comunicación con el desarrollador en español.

## 🏗️ Visión General de la Arquitectura

**Tipo**: PWA Next.js para gestión de listas M3U IPTV  
**Stack**: React 18, TypeScript, TailwindCSS, Next.js 14, @dnd-kit, @tanstack/react-virtual

### Componentes Principales
- **App Principal**: [PWAM3UManager.tsx](../PWAM3UManager.tsx) - Interfaz por pestañas con 7 secciones (Inicio, Editor, Reparación, Asignar EPG, Guardar, Configuración, Ayuda)
- **Gestión de Estado**: Custom hooks en `useChannels.ts`, `useReparacion.ts`, `useAsignarEpg.ts`, `useSettings.ts`
- **Web Worker**: [m3u-parser.worker.ts](../m3u-parser.worker.ts) - Parsea M3U sin bloquear la UI
- **AWS Lambda**: [aws-lambda/](../aws-lambda/) - Servicio de verificación de streams (simple + detección de calidad con FFprobe)
- **Sistema de Modos**: [AppModeContext.tsx](../AppModeContext.tsx) - App dual ('sencillo' vs 'pro')

### Flujo de Datos
1. Usuario carga M3U desde URL/archivo → Web Worker parsea → `useChannels` actualiza estado
2. Verificación de canales → Endpoints AWS Lambda o local `/api/verify_channel.ts` 
3. Persistencia → localStorage (claves Dropbox, URLs, prefijos/sufijos, modo app)
4. Exportación → Genera string M3U desde array `channels`

## 🎯 Patrones Críticos

### Arquitectura de Custom Hooks
Todas las features principales viven en hooks que aceptan dependencias (channels, setChannels, saveStateToHistory):
```typescript
// Ejemplo: useReparacion acepta canales principales y funciones de actualización
export const useReparacion = (
    mainChannels: Channel[],
    setMainChannels: React.Dispatch<React.SetStateAction<Channel[]>>,
    saveStateToHistory: () => void,
    settingsHook: { channelPrefixes: string[], channelSuffixes: string[] }
) => { ... }
```
**Por qué**: Desacopla lógica de negocio de UI, permite testing, evita prop drilling.

### Interface Channel
Tipo de dato central ([index.ts](../index.ts)):
```typescript
interface Channel {
  id: string;          // 'channel-{timestamp}-{random}'
  order: number;       // Orden de visualización
  tvgId: string;       // ID EPG
  tvgName: string;
  tvgLogo: string;
  groupTitle: string;  // Categoría
  name: string;        // Nombre de visualización
  url: string;         // URL del stream
  status?: 'ok' | 'failed' | 'verifying' | 'pending';
  quality?: 'SD' | 'HD' | 'FHD' | '4K' | 'unknown';
}
```

### Claves localStorage
El estado persistente usa estas claves (ver [useSettings.ts](../useSettings.ts)):
- `appMode`: 'sencillo' | 'pro'
- `dropbox_app_key`, `dropbox_refresh_token_new`
- `saved_m3u_urls`, `saved_epg_urls`
- `medicinaLists`: Listas reparadoras guardadas con {id, name, url}
- `dropboxLists`: Listas principales de Dropbox guardadas con {id, name, url, addedAt}
- `channel_prefixes`, `channel_suffixes`: Para normalización en búsqueda inteligente

### Sistema de Búsqueda Inteligente
[useSmartSearch.ts](../useSmartSearch.ts) implementa distancia de Levenshtein para matching difuso:
- Normaliza nombres de canales eliminando prefijos/sufijos configurables (ej: "HD ", " 4K")
- Devuelve coincidencias con score (0-100%) e indicadores de tipo (exacta/parcial/similaridad)
- Usado en pestañas Reparación y Asignar EPG para encontrar canales similares
- **VISIBLE en ambos modos** (sencillo y pro) desde las últimas actualizaciones

### Sistema de Nombres de Archivo Original
[useChannels.ts](../useChannels.ts) mantiene dos estados para nombres de archivo:
- `fileName`: Nombre editable para descargas locales
- `originalFileName`: Nombre extraído de la URL original al cargar, usado para actualizar en Dropbox
- Función `extractDropboxFileName()`: Extrae nombre de cualquier URL que termine en .m3u/.m3u8, limpia parámetros de query

## 🔧 Flujos de Trabajo de Desarrollo

### ⚠️ NO HAY DESARROLLO LOCAL
**IMPORTANTE**: Este proyecto NO se ejecuta en local. El flujo de trabajo es:
1. Crear rama feature en GitHub: `git checkout -b feature/descripcion`
2. Hacer cambios y commits en español
3. Push a GitHub: `git push origin feature/descripcion`
4. Vercel despliega automáticamente un preview URL
5. Probar en el preview URL de Vercel
6. Hacer PR cuando esté listo

```bash
# ❌ NO HACER - No ejecutar localmente
npm run dev          

# ✅ FLUJO CORRECTO
git checkout -b feature/nueva-funcionalidad
# hacer cambios...
git add .
git commit -m "Añade funcionalidad X para mejorar Y"
git push origin feature/nueva-funcionalidad
# Vercel despliega automáticamente en preview URL
```

### Despliegue de AWS Lambda
```bash
cd aws-lambda
./deploy.sh          # Descarga FFprobe, construye SAM, despliega
```
Crea URL de API Gateway → Actualizar `NEXT_PUBLIC_AWS_VERIFY_API_URL` en variables de entorno de Vercel

### Entorno Virtual Python
Algunos scripts Python ([youtube_extractor.py](../api/youtube_extractor.py), [verificador.py](../archivos_aportados/verificador.py)) requieren:
```bash
source .venv/bin/activate
pip install -r requirements.txt
```

## 🌐 Rutas API y Servicios Externos

### Rutas API Next.js
- [/api/proxy.ts](../api/proxy.ts): Proxy CORS para obtener M3U desde URLs externas, maneja transformación de URLs Dropbox
- [/api/verify_channel.ts](../pages/api/verify_channel.ts): Verificación local de canales con análisis de playlist M3U8

### Endpoints AWS Lambda
- `/verify-simple?url=<URL>`: Verificación rápida online/offline (timeout 15s)
- `/verify-quality?url=<URL>`: Detección de calidad con FFprobe (timeout 30s, 1024MB)

### Integración Dropbox
Transformación de URLs: `www.dropbox.com` → `dl.dropboxusercontent.com` con parámetro `?dl=1` (ver [api/proxy.ts](../api/proxy.ts))

## 📏 Convenciones del Proyecto

### Organización de Archivos de Componentes
- Componentes de pestañas: `{Name}Tab.tsx` (ej: [InicioTab.tsx](../InicioTab.tsx))
- UI reutilizable: `{Name}.tsx` (ej: [EditableCell.tsx](../EditableCell.tsx))
- Sin directorio `components/` separado - estructura plana

### Strictness TypeScript
- Todos los tipos exportados desde [index.ts](../index.ts)
- NO usar `any` - usar interfaces/types apropiados
- Props pasadas como objetos hook únicos: `channelsHook`, `settingsHook`, `reparacionHook`

### Estilos
- Solo clases utility de TailwindCSS
- Tema oscuro por defecto: `bg-gray-900`, `text-white`
- Responsive: breakpoints `sm:`, `lg:` con enfoque mobile-first
- Iconos: librería `lucide-react`

### Actualizaciones de Estado
Siempre usar patrones inmutables con spreads:
```typescript
// ✅ Correcto
setChannels(prev => prev.map(ch => ch.id === id ? {...ch, name: newName} : ch));

// ❌ Incorrecto
channels[0].name = newName; setChannels(channels);
```

### Git y Commits
- **Commits SIEMPRE en español**: "Añade función X", "Corrige error en Y", "Mejora rendimiento de Z"
- Mensajes descriptivos y concisos
- Commits atómicos (un cambio lógico por commit)
- Nombres de ramas descriptivos: `feature/busqueda-inteligente`, `fix/verificacion-canales`

### 📋 Sistema de Seguimiento de Cambios con Checklists

**REGLAS OBLIGATORIAS:**

1. **Al subir cambios a una rama feature:**
   - SIEMPRE terminar la respuesta con un **checklist numerado** de TODOS los cambios realizados en esa rama
   - Formato: `## 📋 CHECKLIST DE CAMBIOS (Rama: feature/nombre)`
   - Cada cambio debe ser verificable con pasos claros
   - Incluir checkboxes vacíos `[ ]` para que el usuario pueda marcar

2. **Persistencia del checklist:**
   - Mantener el checklist completo en memoria durante toda la conversación sobre esa rama
   - Si el usuario menciona un cambio específico (ej: "cambio 3"), los cambios NO revisados (4, 5, etc.) se DEBEN seguir mencionando
   - NO eliminar cambios del checklist hasta que se haga merge a main

3. **Al hacer merge a main:**
   - Presentar un **checklist abreviado** de TODOS los cambios de la rama mergeada
   - Formato más compacto: título + descripción breve (1 línea por cambio)
   - Incluir enlace al commit en GitHub

**Ejemplo de checklist en rama:**
```markdown
## 📋 CHECKLIST DE CAMBIOS (Rama: feature/mejoras-epg-settings)

### 1. SettingsTab - Cambio de título principal
- [ ] Ir a Configuración
- [ ] Verificar que el título es "Ajustes de EPG"

### 2. AsignarEpgTab - Enlace "Añadir fuentes"
- [ ] Ir a Asignar EPG
- [ ] Verificar enlace "Añadir fuentes →"
- [ ] Hacer clic y confirmar navegación
```

**Ejemplo de checklist abreviado al merge:**
```markdown
## ✅ CAMBIOS MERGEADOS A MAIN

1. **SettingsTab**: Título cambiado a "Ajustes de EPG" con URLs copiables
2. **AsignarEpgTab**: Añadido enlace "Añadir fuentes" que navega a Configuración
3. **ReparacionTab**: Igualados anchos de listas (5+1+5)

Commit: https://github.com/hijodkain/PWA-M3U-Manager/commit/xxxxx
```

## 📦 Archivos Vercel y .gitignore

### NO subir a GitHub (Vercel los genera automáticamente)
- `.next/` - Build output de Next.js
- `.vercel/` - Configuración local de Vercel
- `out/` - Export estático (si se usa)
- `.env.local` - Variables de entorno locales (usar Vercel Environment Variables en su lugar)

### SÍ incluir en el repo
- `.env.example` - Plantilla de variables de entorno
- `vercel.json` - Configuración de despliegue Vercel
- `next.config.js` - Configuración Next.js
- Archivos de código fuente (`.ts`, `.tsx`, `.css`)

El `.gitignore` ya está configurado correctamente. NO modificar sin razón.

## ⚠️ Restricciones y Gotchas Conocidos

1. **Límites AWS Lambda**: `MAX_AWS_VERIFICATIONS = 20` - advertir al usuario si la verificación por lotes excede esto
2. **Terminación Worker**: Siempre llamar `worker.terminate()` después de completar el parseo M3U
3. **Verificaciones Concurrentes**: Limitadas a 5 simultáneas (`MAX_CONCURRENT_VERIFICATIONS`)
4. **URLs Dropbox**: Deben transformarse antes de fetch (ver lógica en proxy.ts)
5. **Features por Modo**: Verificar `useAppMode().isPro` antes de mostrar funciones avanzadas
6. **Gestión de Historial**: Llamar `saveStateToHistory()` después de actualizaciones masivas de canales para undo/redo

## 🆕 Actualizaciones Recientes (Enero 2026)

### ReparacionTab - Mejoras UX
- **Toggle de selección**: Canal seleccionado se deselecciona al hacer clic de nuevo (`destinationChannelId === ch.id ? null : ch.id`)
- **Búsqueda visible en modo sencillo**: SmartSearchInput ahora visible en ambos modos (pro y sencillo) para lista de reparación
- **Header con nombre de lista**: En modo sencillo muestra "Lista de reparación: [Nombre]" con botón X rojo para limpiar
- **Estado `reparacionListName`**: Nuevo estado que guarda el nombre de la lista cargada, extraído de URL o archivo
- **Función `clearReparacionList()`**: Limpia canales, nombre y URL, vuelve a mostrar selector

### SaveTab - Reorganización Completa (3 Secciones)
**SECCIÓN 1: Actualizar lista en mi Dropbox** (azul, siempre visible)
- Caja de texto deshabilitada con `originalFileName || fileName`
- Botón "Actualizar en mi Dropbox" usa nombre original del archivo cargado
- Descripción dinámica según haya `originalFileName` o no

**SECCIÓN 2: Subir nueva lista a mi Dropbox** (verde)
- Botón "Subir nueva lista a mi Dropbox" abre modal pidiendo nombre
- Añade automáticamente a `dropboxLists` en localStorage
- Función `handleUploadToDropbox(true)` para archivos nuevos

**SECCIÓN 3: Descargar archivo M3U a local** (púrpura)
- Caja de texto editable con `fileName` para personalizar nombre de descarga
- Botón "Descargar .m3u" usa el nombre personalizado
- Espacios convertidos automáticamente a guiones bajos

### InicioTab - Funcionalidades Añadidas
- **Búsqueda en Dropbox**: Botones "Buscar en mi Dropbox" en secciones de listas principales y reparadoras
- **Búsqueda recursiva**: Función `searchDropboxForM3UFiles()` con paginación automática
- **Filtrado por categorías**: Carga M3U, selecciona group-title, genera lista filtrada con nombre automático `Repara_dominio_DD_MM_YYYY.m3u`
- **Gestión de listas medicina**: localStorage `medicinaLists` con añadir/eliminar/cargar

## 📚 Archivos de Documentación Clave
- [DEPLOYMENT.md](../DEPLOYMENT.md): Guía completa de despliegue (Vercel + AWS)
- [SMART_SEARCH_DOCS.md](../SMART_SEARCH_DOCS.md): Detalles del algoritmo de búsqueda inteligente
- [aws-lambda/README.md](../aws-lambda/README.md): Arquitectura Lambda y specs API

## 🚨 Testing de Verificación
Antes de hacer commit de cambios en lógica de verificación, probar con:
- URLs con timeout corto (< 5s de respuesta)
- Playlists M3U8 con/sin variantes de calidad
- Streams fallidos (escenarios 404, timeout)
