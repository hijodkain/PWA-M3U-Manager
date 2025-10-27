# 🎯 Guía Rápida: Verificación de Streams con IPTVChecker + AWS Lambda

## 📖 Resumen

Hemos configurado una solución que usa **IPTVChecker (con FFprobe)** corriendo en **AWS Lambda** para verificar la calidad de streams IPTV de forma precisa.

### ¿Por qué esta solución?

✅ **IPTVChecker** es la herramienta más valorada por la comunidad IPTV  
✅ Usa **FFprobe** para análisis real de video (resolución, codecs, bitrate)  
✅ **AWS Lambda en Europa** evita problemas de geolocalización  
✅ **Fallback automático** si Lambda no está disponible  
✅ **Gratis** hasta 80,000 verificaciones/mes  

---

## 🚀 Pasos para poner en marcha

### 1️⃣ Compilar IPTVChecker

```bash
cd "/Users/juancarlos/Local Sites/PWA M3U Manager/aws-lambda"
./build_iptv_checker.sh
```

Esto:
- Clona IPTVChecker desde GitHub
- Lo compila para Amazon Linux 2 usando Docker
- Crea la estructura de Lambda Layer

**Si falla**, asegúrate de tener Docker instalado y corriendo.

---

### 2️⃣ Añadir FFprobe a la Layer

```bash
./add_ffprobe_to_layer.sh
```

Esto descarga FFprobe estático y lo añade a la layer para que IPTVChecker pueda usarlo.

---

### 3️⃣ Configurar región AWS (Europa)

Edita `aws-lambda/samconfig.toml`:

```toml
[default.deploy.parameters]
stack_name = "iptv-stream-analyzer"
region = "eu-west-1"  # Irlanda - CAMBIAR ESTO
# O usar: "eu-central-1" para Frankfurt
```

**¿Por qué Europa?**
- Evita problemas de geolocalización con streams europeos
- Menor latencia desde España

---

### 4️⃣ Deploy a AWS

```bash
cd aws-lambda

# Instalar AWS SAM CLI si no lo tienes
# macOS: brew install aws-sam-cli

# Build
sam build

# Deploy (primera vez - te hará preguntas)
sam deploy --guided

# Respuestas recomendadas:
# - Stack Name: iptv-stream-analyzer
# - AWS Region: eu-west-1
# - Confirm changes: Y
# - Allow SAM CLI IAM role creation: Y
# - Save arguments to samconfig.toml: Y
```

---

### 5️⃣ Obtener URL de la Lambda

Después del deploy verás:

```
Outputs
-----------------------------------------------------------------------
StreamAnalyzerApi:  https://xxxxx.execute-api.eu-west-1.amazonaws.com/Prod/analyze
-----------------------------------------------------------------------
```

**Copia esa URL** ☝️

---

### 6️⃣ Configurar Vercel

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Añade:
   ```
   Variable: STREAM_ANALYZER_API
   Value: https://xxxxx.execute-api.eu-west-1.amazonaws.com/Prod/analyze
   ```
4. Redeploy tu aplicación en Vercel

---

### 7️⃣ Probar

1. Ve a tu aplicación PWA M3U Manager
2. Abre la pestaña de "Reparación"
3. Haz clic en "Verify" en un canal
4. Ahora debería mostrar la calidad real (SD/HD/FHD/4K) con resolución exacta

---

## 🔍 ¿Cómo funciona?

```
┌─────────┐      ┌─────────┐      ┌──────────────┐      ┌──────────────┐
│ Usuario │─────▶│ Vercel  │─────▶│ AWS Lambda   │─────▶│ Stream IPTV  │
│  (PWA)  │      │   API   │      │ IPTVChecker  │      │              │
└─────────┘      └─────────┘      │  + FFprobe   │      └──────────────┘
                                   └──────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  Respuesta   │
                                   │  JSON con    │
                                   │  calidad     │
                                   └──────────────┘
```

1. Usuario hace clic en "Verify"
2. Vercel API (`/api/verify_channel`) llama a Lambda
3. Lambda ejecuta IPTVChecker con FFprobe
4. FFprobe analiza el stream (resolución, codecs, bitrate)
5. Lambda devuelve JSON con la información
6. Vercel muestra el badge de calidad

**Fallback:** Si Lambda no responde, usa análisis M3U8 local (menos preciso).

---

## 💰 Costos

**AWS Lambda Free Tier:**
- ✅ 1 millón requests gratis/mes
- ✅ ~80,000 verificaciones gratis (con 512MB y 5-10s cada una)
- ✅ Después: $0.20 por cada 100,000 verificaciones adicionales

**Vercel:**
- ✅ Sin cambios en tu plan actual

---

## 🛠️ Comandos útiles

### Ver logs en tiempo real
```bash
cd aws-lambda
sam logs -n StreamAnalyzerFunction --tail
```

### Actualizar después de cambios
```bash
sam build && sam deploy
```

### Probar localmente
```bash
sam local invoke StreamAnalyzerFunction -e test_event.json
```

### Eliminar todo
```bash
sam delete
```

---

## 📝 Archivos importantes

```
aws-lambda/
├── stream_analyzer_lambda.py       # Función Lambda
├── template.yaml                   # Configuración AWS SAM
├── build_iptv_checker.sh          # Script de compilación
├── add_ffprobe_to_layer.sh        # Script para añadir FFprobe
├── README_STREAM_ANALYZER.md      # Documentación completa
└── layer/
    └── bin/
        ├── iptv-checker           # Binario compilado
        └── ffprobe                # FFprobe estático

pages/api/
└── verify_channel.ts               # API de Vercel (llama a Lambda)

.env.example                        # Variables de entorno
```

---

## ❓ Troubleshooting

### Lambda devuelve error 500
- Verifica logs: `sam logs -n StreamAnalyzerFunction --tail`
- Puede que falte FFprobe: ejecuta `./add_ffprobe_to_layer.sh`

### Lambda timeout
- Aumenta timeout en `template.yaml` (línea ~50): `Timeout: 60`
- Redeploy: `sam build && sam deploy`

### Streams dan "unknown"
- Algunos streams pueden estar bloqueados geográficamente
- Verifica logs de Lambda para ver el error exacto

### CORS errors
- Los headers CORS ya están configurados en `stream_analyzer_lambda.py`
- Si persiste, verifica la URL de Lambda en Vercel

---

## 🎉 ¡Listo!

Ahora tienes verificación de calidad REAL usando IPTVChecker con FFprobe, corriendo en Lambda AWS en Europa.

**Siguiente paso:** Hacer el deploy siguiendo los pasos 1-7 de arriba.
