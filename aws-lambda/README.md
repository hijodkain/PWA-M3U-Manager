# AWS Lambda - Stream Verification

Sistema de verificación de canales IPTV usando AWS Lambda.

## 📋 Estructura

```
aws-lambda/
├── template.yaml                    # SAM template - infraestructura
├── stream_verifier_lambda.py       # Lambda SIMPLE (solo online/offline)
├── stream_quality_lambda.py        # Lambda CON CALIDAD (FFprobe)
├── ffprobe-layer/                   # Layer con binario FFprobe
│   └── bin/
│       └── ffprobe                  # Binario estático de FFprobe
├── deploy.sh                        # Script de despliegue
└── README.md                        # Esta documentación
```

## 🎯 Funciones Lambda

### 1. StreamVerifierFunction (Verificación Simple)
- **Endpoint**: `/verify-simple?url=<STREAM_URL>`
- **Propósito**: Verificar si un canal está online (ok) o offline (failed)
- **Timeout**: 15 segundos
- **Uso**: Lista principal de canales en Reparación

**Respuesta**:
```json
{
  "status": "ok" | "failed",
  "message": "Stream is online (HTTP 200)",
  "url": "https://...",
  "statusCode": 200
}
```

### 2. StreamQualityFunction (Verificación con Calidad)
- **Endpoint**: `/verify-quality?url=<STREAM_URL>`
- **Propósito**: Verificar canal Y detectar resolución/calidad con FFprobe
- **Timeout**: 30 segundos
- **Memoria**: 1024 MB
- **Uso**: Lista de reemplazo en Reparación

**Respuesta**:
```json
{
  "status": "ok" | "failed",
  "quality": "4K" | "FHD" | "HD" | "SD" | "unknown",
  "resolution": "1920x1080",
  "codec": "h264",
  "bitrate": 5000000,
  "message": "Stream online - FHD quality detected",
  "url": "https://..."
}
```

## 🚀 Despliegue

### Requisitos previos
1. AWS CLI instalado y configurado
2. AWS SAM CLI instalado
3. Cuenta AWS con permisos para Lambda, API Gateway, CloudFormation

### Opción 1: Despliegue automático (recomendado)
```bash
cd aws-lambda
chmod +x deploy.sh
./deploy.sh
```

### Opción 2: Despliegue manual
```bash
cd aws-lambda

# Build
sam build

# Deploy
sam deploy --guided
```

En el primer despliegue (`--guided`) te preguntará:
- **Stack Name**: `pwa-m3u-stream-verification`
- **AWS Region**: `eu-west-1` (o tu región preferida)
- **Confirm changes before deploy**: `Y`
- **Allow SAM CLI IAM role creation**: `Y`
- **Disable rollback**: `N`
- **Save arguments to configuration file**: `Y`

### Después del despliegue

El comando mostrará la **API Gateway URL**:
```
Outputs:
StreamVerificationApi: https://xxxxxxxxxx.execute-api.eu-west-1.amazonaws.com/Prod/
```

**Guarda esta URL** - la necesitarás en el frontend.

## 🔧 FFprobe Layer

El layer incluye el binario estático de FFprobe compilado para AWS Lambda (Amazon Linux 2023).

### Descarga del binario
```bash
# Crear directorio
mkdir -p ffprobe-layer/bin

# Descargar FFprobe estático de John Van Sickle
cd ffprobe-layer/bin
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar -xf ffmpeg-release-amd64-static.tar.xz
mv ffmpeg-*-amd64-static/ffprobe .
rm -rf ffmpeg-*
chmod +x ffprobe

# Verificar
./ffprobe -version
```

## 📊 Límites y Costos

### AWS Lambda Free Tier
- **1 millón** de peticiones gratis/mes
- **400,000 GB-segundos** de computación gratis/mes

### Costos estimados (después de Free Tier)
- **Verificación Simple**: ~0.0000002 USD por petición
- **Verificación con Calidad**: ~0.0000004 USD por petición

**Ejemplo**: 10,000 verificaciones/mes ≈ **$0.002** USD (prácticamente gratis)

## 🧪 Testing Local

### Verificación Simple
```bash
python stream_verifier_lambda.py
```

### Verificación con Calidad
```bash
# Asegúrate de tener FFprobe instalado localmente
python stream_quality_lambda.py
```

## 🔗 Integración con Frontend

Actualiza en tu frontend (`useReparacion.ts`):

```typescript
const AWS_API_URL = 'https://YOUR-API-ID.execute-api.eu-west-1.amazonaws.com/Prod';

// Verificación simple (lista principal)
const response = await fetch(`${AWS_API_URL}/verify-simple?url=${encodeURIComponent(channelUrl)}`);

// Verificación con calidad (lista de reemplazo)
const response = await fetch(`${AWS_API_URL}/verify-quality?url=${encodeURIComponent(channelUrl)}`);
```

## 📝 Notas Importantes

1. **Timeouts**: Ajustados para dar tiempo suficiente a servidores lentos
   - Simple: 10s request + 5s buffer = 15s total
   - Calidad: 25s FFprobe + 5s buffer = 30s total

2. **CORS**: Configurado para permitir peticiones desde cualquier origen (`*`)

3. **SSL**: Acepta certificados autofirmados (común en streams IPTV)

4. **Rate Limiting**: No implementado - AWS Lambda escala automáticamente

5. **Logs**: Todos los logs se guardan en CloudWatch Logs

## 🛠️ Troubleshooting

### Error: "FFprobe binary not found"
- Verifica que el layer está correctamente empaquetado
- Comprueba que `FFPROBE_PATH` apunta a `/opt/bin/ffprobe`

### Error: "Task timed out"
- Aumenta `Timeout` en `template.yaml`
- Verifica que la URL del stream es válida

### Error: "Memory limit exceeded"
- Aumenta `MemorySize` en `template.yaml` para StreamQualityFunction

## 📞 Soporte

Si tienes problemas con el despliegue, consulta:
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
