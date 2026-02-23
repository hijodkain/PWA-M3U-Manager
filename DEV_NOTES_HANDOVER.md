# 📝 Notas de Entrega - Actualización EPG y Estabilidad

## 📅 Fecha: 23/02/2026

## ✅ Cambios Realizados (Rama: feature/mejoras-epg-tab -> main)

### 1. 📺 Mejoras en Asignar EPG (`AsignarEpgTab.tsx`)
- **Limpieza de UI**: Se eliminó el banner azul de "Carga una fuente EPG para empezar" y el botón de "Añadir fuentes".
- **Botones OTT y Tivimate**: Se rediseñaron para ser solo iconos (sin texto, bordes ni padding). Ahora tienen un efecto de escala y resplandor (naranja/azul) al estar activos o al pasar el ratón por encima. Se añadió el texto "Preparar el canal para:" a su izquierda.
- **Información de la lista principal**: En la lista de canales de la izquierda, ahora se muestra el `tvg-id` y `tvg-name` debajo del nombre del canal, en lugar del grupo al que pertenece.

### 2. 🔍 Buscador Inteligente (`useSmartSearch.ts`)
- Se modificó para que la búsqueda también tenga en cuenta la propiedad `id` de los canales (útil para buscar por ID en la lista EPG).
- Al hacer clic en un canal de la lista principal, el nombre que se pasa al buscador de la derecha ahora se normaliza automáticamente (usando `epgNormalizeChannelName`), aplicando los filtros de prefijos/sufijos configurados en la pestaña Ajustes.

## 📅 Fecha: 24/01/2026

## ✅ Cambios Realizados

### 1. 🛠️ Corrección de Estabilidad (Crashes en Brave/iOS)
- **Problema**: La app sufría "crashes" o errores de hidratación en navegadores como Brave debido a definiciones de componentes (`EpgIcon`) y constantes (`TABS`) dentro del ciclo de renderizado de React.
- **Solución**: Se movieron estas definiciones fuera del componente principal en `PWAM3UManager.tsx`.
- **Extra**: Se ajustó `tailwind.config.js` para asegurar que el breakpoint `xs` funcione correctamente.

### 2. 📺 Mejoras en Asignar EPG (`AsignarEpgTab.tsx`)
- **Fuentes Sugeridas**: Se ha añadido una nueva sección cuando no hay fuentes cargadas.
  - Ofrece acceso directo a las listas XMLTV de **David_DobleM** (`https://raw.githubusercontent.com/davidmuma/EPG_dobleM/master/guiaiptv.xml`) y **Open-EPG.org** (`https://www.open-epg.com/generate/A5KxjtxpeF.xml`).
  - Incluye funcionalidad de **copiar al portapapeles** y **añadir a fuentes guardadas** con un clic.
- **UI Toolbar**: Se reemplazaron los botones genéricos de texto/icono por los **logos oficiales de OTT y TiviMate**.

## 🚀 Estado Actual
- La aplicación es estable en navegadores móviles y desktop.
- La pestaña "Asignar EPG" ahora ofrece un onboarding más sencillo para nuevos usuarios.

## 🔜 Próximos Pasos (Pendientes)
- Verificar que los logos de OTT y TiviMate se visualicen correctamente en despliegue (asegurar que existen en `/public`).

## 📋 Comandos Útiles
- Despliegue AWS Lambda (si se modifican): `./deploy.sh` en `aws-lambda/`
