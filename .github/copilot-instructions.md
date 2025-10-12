# Copilot Instructions for PWA-M3U-Manager

## Arquitectura General
- Proyecto basado en Next.js y React, orientado a la gestión y edición de listas M3U para IPTV.
- El flujo principal involucra la edición, reparación y asignación de EPG a canales, con componentes tabulares y workers para procesamiento.
- Los archivos principales de UI están en la raíz (`*.tsx`), mientras que la lógica de negocio y hooks personalizados están en archivos `use*.ts`.
- El worker `m3u-parser.worker.ts` se usa para parsear listas M3U de forma asíncrona, evitando bloquear el hilo principal.

## Convenciones y Patrones
- Los componentes de pestañas (`*Tab.tsx`) agrupan funcionalidades: edición, reparación, ayuda, configuración, etc.
- Los hooks (`use*.ts`) encapsulan lógica de estado y manipulación de datos, por ejemplo: `useChannels.ts` para gestión de canales, `useAsignarEpg.ts` para EPG.
- Los componentes de tabla (`EditableCell.tsx`, `SortableChannelRow.tsx`, `ResizableHeader.tsx`) siguen patrones de edición en línea y reordenamiento.
- Los archivos en `api/` implementan endpoints Next.js (`proxy.ts`, `verify_channel.py`) para validaciones y procesamiento externo.

## Workflows de Desarrollo
- **Build:** Usar los scripts de Next.js (`next build`, `next dev`).
- **Estilos:** TailwindCSS está configurado en `tailwind.config.js` y `postcss.config.js`.
- **Configuración:** Variables y rutas en `next.config.js` y `vercel.json`.
- **Debug:** El worker puede ser depurado por separado; los hooks suelen tener lógica desacoplada para facilitar pruebas.
- **Tests:** No se detectan archivos de test, pero los hooks y workers son candidatos para pruebas unitarias.

## Integraciones y Dependencias
- **TailwindCSS** para estilos.
- **Next.js** para SSR y API routes.
- **Vercel** para despliegue (ver `vercel.json`).
- **Workers** para procesamiento M3U.
- **Python** (`verify_channel.py`) para validación de canales, invocado desde API route.

## Ejemplos de Patrones
- **Hook personalizado:**
  ```ts
  // useChannels.ts
  const { channels, addChannel, removeChannel } = useChannels();
  ```
- **Worker usage:**
  ```ts
  // m3u-parser.worker.ts
  const worker = new Worker('m3u-parser.worker.js');
  worker.postMessage(m3uContent);
  ```
- **API route con Python:**
  ```ts
  // pages/api/verify.ts
  // Llama a verify_channel.py para validar canales
  ```

## Archivos Clave
- `PWAM3UManager.tsx`: Componente principal de la app.
- `m3u-parser.worker.ts`: Lógica de parsing M3U.
- `useChannels.ts`, `useAsignarEpg.ts`, `useReparacion.ts`: Hooks principales.
- `api/proxy.ts`, `api/verify_channel.py`: Integración backend.
- `tailwind.config.js`, `postcss.config.js`: Configuración de estilos.

---
¿Hay algún flujo, convención o integración que no esté claro o que deba documentarse mejor? Indica detalles específicos para mejorar estas instrucciones.