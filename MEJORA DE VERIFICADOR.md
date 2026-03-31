Canal realmente reproducible (modo estricto) = verdadero solo si cumple todas estas condiciones en la misma verificación:

La URL responde con GET real a manifest o stream con código 200 o 206.
No se acepta 403, 401 ni 302 en bucle como válido para reproducible.
El contenido no es HTML/JSON/texto de error.
Si es HLS master, se elige una variante y esa variante debe pasar prueba de segmentos.
La prueba de segmentos exige descargar al menos 2 segmentos distintos con éxito (200/206, tamaño útil > 1 KB, tiempo por segmento < 8 s).
La calidad reportada (SD/HD/FHD/4K) se calcula desde la variante que sí pasó segmentos, no desde metadata teórica.
Si falla cualquiera de los puntos anteriores, el estado final es failed con motivo técnico explícito (auth_required, cors_or_origin_block, manifest_invalid, segment_unreachable, codec_unsupported, timeout).
En modo actual (compatibilidad), se mantiene el comportamiento de hoy: online y calidad pueden salir como ok aunque luego no reproduzca.

Cómo Está Hoy (baseline real)

Se considera online en simple incluso con 403: stream_verifier_lambda.py:106, stream_verifier_lambda.py:130, stream_verifier_lambda.py:148.
En quality también se acepta 403 en el chequeo rápido: stream_quality_lambda.py:151, stream_quality_lambda.py:165.
El fallback local puede devolver ok/FHD por manifest sin probar segmentos: verify_channel.ts:51, verify_channel.ts:183, verify_channel.ts:275.
El reproductor intenta cargar directo en cliente y ahí aparecen CORS/auth/códec: VideoPlayer.tsx:57, VideoPlayer.tsx:68, VideoPlayer.tsx:204.
La verificación se dispara desde reparación en rutas separadas simple/quality: useReparacion.ts:70, useReparacion.ts:175, useReparacion.ts:397, useReparacion.ts:408.
Guion Para Que Un Agente Lo Ejecute Sin Romper Flujo (con vuelta atrás)

Congelar estado actual antes de tocar nada.
Crear rama de feature, crear tag de respaldo en main, y documentar una muestra de 10 canales con resultado actual (status + quality + si reproduce o no). Esto permite comparar y volver exactamente al punto inicial.

Implementar modo dual, dejando por defecto el comportamiento actual.
Añadir ajuste persistente strictPlayableValidation con valor inicial false en useSettings.ts:16, useSettings.ts:39, useSettings.ts:191.
Exponer toggle en la pestaña de filtros de SettingsTab.tsx:30, SettingsTab.tsx:353.
Mientras esté en false, todo debe comportarse igual que hoy.

Extender contrato de verificación sin romper tipos existentes.
Mantener status, quality, resolution, codec, bitrate en verify_channel.ts:6.
Añadir campos opcionales: isOnline, isPlayable, failureReason, checkedVariant, verificationMode.
No eliminar campos actuales para no romper UI.

Aplicar criterio estricto en backend solo cuando strictPlayableValidation esté activo.
Ajustar stream_verifier_lambda.py:106 y stream_quality_lambda.py:151 para que 403 deje de ser reproducible en modo estricto (motivo auth_required).
En verify_channel.ts:51, además de parsear manifest, probar segmentos reales y decidir isPlayable con ese resultado.
La quality final debe salir de la variante que pasó segmentos.

Conectar el modo estricto desde frontend de reparación.
En useReparacion.ts:70 y useReparacion.ts:175, enviar parámetro strict=1 solo si strictPlayableValidation=true.
Mantener el flujo de progreso/cancelación y límites AWS exactamente como está.

Añadir motivo visible sin romper UI actual.
Extender estado interno de verificación en useReparacion.ts:4 para guardar failureReason opcional.
Mostrarlo en tooltip o texto secundario en la lista (si no se muestra, al menos conservarlo en estado para debug).

Validación de no-regresión obligatoria.
Repetir la misma muestra de 10 canales con toggle apagado: los resultados deben coincidir con baseline.
Encender toggle y verificar que los falsos positivos pasan a failed con motivo explícito.

Estrategia de vuelta atrás inmediata si no te gusta el resultado.
Primero: apagar toggle en Ajustes y vuelves al comportamiento anterior sin redeploy.
Segundo: revertir commits de la feature (sin reset destructivo).
Tercero: si hace falta, volver al tag de respaldo en una rama de recuperación.

Texto corto para pasarle al agente

Implementa strictPlayableValidation con default false y persistencia en ajustes.
No rompas contrato actual de verificación; solo añade campos opcionales.
En modo estricto, define reproducible únicamente con prueba de 2 segmentos reales y sin aceptar 403/401.
Quality debe venir de la variante realmente reproducible.
Mantén comportamiento actual intacto cuando el toggle esté apagado.
Entrega evidencia antes/después con la misma muestra de canales y plan de rollback probado.