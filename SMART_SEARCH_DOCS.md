# 🔍 Búsqueda Inteligente - Documentación

## 🎯 Resumen de Mejoras

Esta rama implementa un sistema de **búsqueda inteligente** avanzado para las pestañas **Reparación** y **Asignar EPG**, que mejora significativamente la experiencia de usuario al buscar canales con nombres similares.

## ✨ Características Principales

### 🧠 Búsqueda Inteligente
- **Coincidencias exactas**: Prioridad máxima para nombres idénticos
- **Coincidencias parciales**: Encuentra texto contenido en nombres de canales
- **Búsqueda por similaridad**: Usa algoritmo de distancia de Levenshtein para encontrar nombres parecidos
- **Ordenación por relevancia**: Los resultados se ordenan por score de similaridad (0-100%)

### 🎛️ Normalización Automática
- **Elimina prefijos**: HD, FHD, UHD, 4K, SD automáticamente
- **Elimina sufijos**: (HD), [4K], |UHD, HEVC, H265, 1080p, DUAL, etc.
- **Actualización en tiempo real**: Los prefijos/sufijos nuevos se aplican inmediatamente
- **Configuración persistente**: Se guardan en localStorage y se mantienen entre sesiones

### 🔄 Modo Dual de Búsqueda
- **Búsqueda Inteligente** (🟢): Encuentra coincidencias parciales y por similaridad
- **Búsqueda Exacta** (⚪): Funcionalidad tradicional de búsqueda por texto contenido
- **Alternancia fácil**: Botón toggle para cambiar entre modos

### 📊 Indicadores Visuales
- **Scores de similaridad**: Porcentaje de coincidencia (0-100%)
- **Tipos de coincidencia**:
  - 🎯 **Exacta**: Coincidencia perfecta
  - ⭐ **Parcial**: Texto contenido en el nombre
  - ⚡ **Similaridad**: Coincidencia por algoritmo de distancia
- **Barras de progreso**: Representación visual del score de similaridad
- **Códigos de color**: Verde (>90%), Amarillo (>70%), Naranja (>50%), Rojo (<50%)

## 🛠️ Implementación Técnica

### Nuevos Componentes
- **`useSmartSearch.ts`**: Hook principal con lógica de búsqueda inteligente
- **`SmartSearchInput.tsx`**: Componente de input con toggle de modo de búsqueda
- **`SearchResultComponents.tsx`**: Componentes para mostrar resultados con scores

### Hooks Actualizados
- **`useReparacion.ts`**: Integra búsqueda inteligente en pestaña de Reparación
- **`useAsignarEpg.ts`**: Integra búsqueda inteligente en pestaña de Asignar EPG
- **`useSettings.ts`**: Ya existente, gestiona prefijos y sufijos configurables

### Algoritmo de Similaridad
```typescript
// Distancia de Levenshtein normalizada
const similarity = (maxLength - levenshteinDistance) / maxLength;

// Scores de prioridad:
// 1.0 - Coincidencia exacta original
// 0.95 - Coincidencia exacta normalizada
// 0.9 - Contiene búsqueda original
// 0.85 - Contiene búsqueda normalizada
// 0.8-0.6 - Similaridad por palabras
// 0.6 - Similaridad global mínima
```

## 🎮 Uso para el Usuario

### En Pestaña Reparación
1. **Seleccionar canal de destino** en la lista principal
2. **Búsqueda automática**: El nombre se normaliza y busca automáticamente en la lista de reparación
3. **Ajustar búsqueda**: Modificar término de búsqueda si es necesario
4. **Alternar modo**: Usar botón toggle para cambiar entre búsqueda inteligente/exacta
5. **Ver resultados**: Los canales se muestran ordenados por relevancia con scores visuales

### En Pestaña Asignar EPG
1. **Seleccionar canal de destino** en la lista principal  
2. **Búsqueda automática**: Busca automáticamente en la fuente EPG
3. **Refinar búsqueda**: Usar búsqueda inteligente para encontrar coincidencias similares
4. **Asignar EPG**: Hacer clic en el canal EPG deseado para asignar ID y logo

### Configuración de Prefijos/Sufijos
1. **Ir a Configuración** → Gestión de Prefijos/Sufijos
2. **Añadir/Eliminar** prefijos y sufijos según necesidades
3. **Aplicación inmediata**: Los cambios se aplican automáticamente sin cambiar de pestaña
4. **Reset**: Botón para restaurar configuración por defecto

## 🔧 Configuración Avanzada

### Prefijos por Defecto
```typescript
['HD ', 'FHD ', 'UHD ', '4K ', 'SD ']
```

### Sufijos por Defecto  
```typescript
[' 4K', ' UHD', ' FHD', ' HD', ' SD', ' HEVC', ' H265', ' H264', ' x265', ' x264', 
 ' 1080p', ' 720p', ' DUAL', ' MULTI', ' (4K)', ' (UHD)', ' (FHD)', ' (HD)', ' (SD)',
 ' [4K]', ' [UHD]', ' [FHD]', ' [HD]', ' [SD]', ' |4K', ' |UHD', ' |FHD', ' |HD', ' |SD']
```

### Umbrales de Similaridad
- **Mínimo para mostrar**: 40% (0.4)
- **Buena coincidencia**: 60% (0.6) 
- **Excelente coincidencia**: 90% (0.9)

## 🚀 Beneficios

1. **⚡ Búsqueda más rápida**: Encuentra canales similares sin escribir nombres exactos
2. **🎯 Mayor precisión**: Algoritmo inteligente que entiende variaciones de nombres
3. **🔄 Actualización inmediata**: Prefijos/sufijos se aplican sin recargar
4. **📊 Feedback visual**: Scores de similaridad ayudan a elegir mejor coincidencia
5. **🛠️ Configuración flexible**: Adaptable a diferentes fuentes de listas M3U
6. **💾 Persistencia**: Configuración se mantiene entre sesiones

## 🔮 Casos de Uso Ejemplo

### Canal: "ESPN HD 1080p HEVC"
**Búsqueda normalizada**: "ESPN" 
**Encuentra**:
- ✅ "ESPN" (100% - Exacta)
- ✅ "ESPN 2" (95% - Parcial) 
- ✅ "ESPN Deportes" (85% - Parcial)
- ✅ "FOX Sports ESPN" (75% - Similaridad)

### Canal: "[HD] Discovery Channel 4K"
**Búsqueda normalizada**: "Discovery Channel"
**Encuentra**:
- ✅ "Discovery Channel" (100% - Exacta)
- ✅ "Discovery Science" (80% - Similaridad)
- ✅ "Animal Planet Discovery" (70% - Similaridad)

Esta implementación transforma la experiencia de gestión de listas M3U, haciendo la búsqueda y asignación de canales mucho más intuitiva y eficiente.