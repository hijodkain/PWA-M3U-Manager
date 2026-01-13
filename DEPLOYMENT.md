# PWA M3U Manager - Deployment Guide

Guía de despliegue completo del proyecto PWA M3U Manager.

## 📋 Requisitos

- Node.js 18+ y npm
- Cuenta en Vercel (para el frontend)
- Cuenta en AWS (para las Lambda de verificación)
- AWS CLI y SAM CLI instalados (para despliegue de Lambda)

## 🚀 Despliegue Frontend (Vercel)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Desarrollo local
```bash
npm run dev
```

El sitio estará disponible en `http://localhost:3000`

### 3. Desplegar a Vercel
```bash
# Opción 1: Despliegue automático desde GitHub
# - Conecta tu repositorio a Vercel
# - Push a main despliega automáticamente

# Opción 2: Despliegue manual
npx vercel
```

## ☁️ Despliegue AWS Lambda (Verificación de Canales)

Las funciones Lambda permiten verificar canales IPTV sin consumir tu IP local.

### 1. Navegar al directorio AWS
```bash
cd aws-lambda
```

### 2. Ejecutar el script de despliegue
```bash
chmod +x deploy.sh
./deploy.sh
```

El script:
- Descarga FFprobe automáticamente si no existe
- Construye las funciones Lambda
- Despliega a AWS usando SAM
- Crea archivo `.env.local` con la configuración

### 3. Guardar la URL del API Gateway

Después del despliegue verás algo como:
```
StreamVerificationApi: https://xxxxxxxxxx.execute-api.eu-west-1.amazonaws.com/Prod/
```

Esta URL se guarda automáticamente en `.env.local`

### 4. Variables de entorno

Crea o actualiza `.env.local` en la raíz del proyecto:
```bash
NEXT_PUBLIC_AWS_VERIFY_API_URL=https://xxxxxxxxxx.execute-api.eu-west-1.amazonaws.com/Prod/
```

### 5. Redesplegar frontend

Después de configurar las variables de entorno:
```bash
# Desarrollo local
npm run dev

# O push a GitHub para despliegue automático en Vercel
git add .
git commit -m "Add AWS Lambda configuration"
git push
```

**Importante**: En Vercel, añade la variable de entorno:
- Ve a Settings → Environment Variables
- Añade: `NEXT_PUBLIC_AWS_VERIFY_API_URL` con la URL de tu API Gateway
- Redespliega desde Vercel Dashboard

## 🧪 Testing

### Probar Lambda localmente
```bash
cd aws-lambda

# Test verificación simple
python stream_verifier_lambda.py

# Test verificación con calidad (requiere FFprobe local)
python stream_quality_lambda.py
```

### Probar API desplegada
```bash
# Verificación simple
curl "https://YOUR-API.execute-api.eu-west-1.amazonaws.com/Prod/verify-simple?url=https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"

# Verificación con calidad
curl "https://YOUR-API.execute-api.eu-west-1.amazonaws.com/Prod/verify-quality?url=https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
```

## 📊 Funcionalidades de Verificación

### Lista Principal (Reparación Tab)
- **Botón "Verify"** en cada canal
- Usa `/verify-simple` (solo online/offline)
- No detecta calidad para ser más rápido
- Muestra: ✅ "ok" o ❌ "failed"

### Lista de Reemplazo (Reparación Tab)
- **Botón "Verify"** en cada canal
- Usa `/verify-quality` (análisis completo con FFprobe)
- Detecta resolución (1920x1080, etc.)
- Detecta calidad (4K, FHD, HD, SD)
- Muestra: ✅ "ok" + resolución

## 🛠️ Troubleshooting

### Frontend no se conecta a Lambda
1. Verifica que `.env.local` existe y tiene la URL correcta
2. Asegúrate de que la URL termina en `/` (slash final)
3. Reinicia el servidor de desarrollo (`npm run dev`)
4. En Vercel, verifica las variables de entorno

### Lambda timeout
- Los timeouts están configurados para servidores lentos
- Simple: 15 segundos
- Quality: 30 segundos
- Si aún falla, edita `aws-lambda/template.yaml` y aumenta `Timeout`

### FFprobe no funciona
```bash
cd aws-lambda/ffprobe-layer/bin
chmod +x ffprobe
./ffprobe -version  # Debe mostrar la versión
```

## 📝 Actualizar Lambda

Después de modificar el código Python:
```bash
cd aws-lambda
sam build
sam deploy
```

## 🗑️ Eliminar recursos AWS

Para eliminar completamente las Lambda de AWS:
```bash
cd aws-lambda
sam delete --stack-name pwa-m3u-stream-verification
```

## 📞 Soporte

- **Frontend**: Issues en GitHub
- **AWS Lambda**: Consulta `aws-lambda/README.md`
- **CloudWatch Logs**: Para debugging de Lambda

## 🔐 Seguridad

- Las API de Lambda están configuradas con CORS abierto (`*`)
- No hay autenticación (considera añadir API Keys si es necesario)
- Los logs se guardan en CloudWatch (incluyen URLs de streams)

## 💰 Costos

### Vercel
- Plan gratuito: Suficiente para uso personal
- Despliegues ilimitados desde GitHub

### AWS Lambda
- Free Tier: 1M peticiones/mes gratis
- Después: ~$0.0000002 por petición
- **Costo estimado**: Casi gratis incluso con miles de verificaciones

## 🎯 Roadmap

- [ ] Verificación por lotes (grupos completos)
- [ ] Caché de verificaciones (DynamoDB)
- [ ] Dashboard de estadísticas
- [ ] Notificaciones de canales caídos
