# AWS Lambda Stream Analyzer con IPTVChecker

Esta Lambda ejecuta el binario de IPTVChecker (Rust) con FFprobe para analizar streams IPTV y detectar calidad, resolución, codecs, etc.

## 📋 Prerrequisitos

1. **AWS CLI** configurado con tus credenciales
2. **AWS SAM CLI** instalado
3. **Docker** (para compilar el binario de Rust)
4. **Rust toolchain** (opcional, si quieres compilar localmente)

## 🔨 Paso 1: Compilar IPTVChecker para Lambda

AWS Lambda usa **Amazon Linux 2** (similar a Red Hat/CentOS), así que necesitamos compilar el binario de IPTVChecker para esa arquitectura.

### Opción A: Compilar con Docker (RECOMENDADO)

```bash
# 1. Clonar IPTVChecker
cd aws-lambda
git clone https://github.com/zhimin-dev/iptv-checker-rs.git
cd iptv-checker-rs

# 2. Compilar para Amazon Linux 2 usando Docker
docker run --rm -v "$(pwd)":/workspace -w /workspace rust:1.70 \
  bash -c "apt-get update && \
           apt-get install -y musl-tools && \
           rustup target add x86_64-unknown-linux-musl && \
           cargo build --release --target x86_64-unknown-linux-musl"

# 3. El binario estará en: target/x86_64-unknown-linux-musl/release/iptv-checker
```

### Opción B: Compilar localmente (si tienes Rust)

```bash
cd aws-lambda
git clone https://github.com/zhimin-dev/iptv-checker-rs.git
cd iptv-checker-rs

# Instalar target para musl
rustup target add x86_64-unknown-linux-musl

# Compilar
cargo build --release --target x86_64-unknown-linux-musl
```

## 📦 Paso 2: Crear la Lambda Layer con el binario

```bash
# Desde aws-lambda/
cd ..  # Volver a aws-lambda/

# Crear estructura de directorios para la layer
mkdir -p layer/bin

# Copiar el binario compilado
cp iptv-checker-rs/target/x86_64-unknown-linux-musl/release/iptv-checker layer/bin/

# Dar permisos de ejecución
chmod +x layer/bin/iptv-checker

# Verificar que el binario existe
ls -lh layer/bin/iptv-checker
```

## 🚀 Paso 3: Deploy a AWS

### Configurar región (IMPORTANTE para evitar geolocalización)

Edita `samconfig.toml` y cambia la región a Europa:

```toml
region = "eu-west-1"  # Irlanda
# O
region = "eu-central-1"  # Frankfurt
```

### Hacer el deploy

```bash
# Desde aws-lambda/

# Build
sam build

# Deploy (primera vez)
sam deploy --guided

# Deploy (subsecuentes)
sam deploy
```

Durante `--guided` te preguntará:
- **Stack Name**: `iptv-stream-analyzer`
- **AWS Region**: `eu-west-1` (o `eu-central-1`)
- **Confirm changes**: `Y`
- **Allow SAM CLI IAM role creation**: `Y`
- **Disable rollback**: `N`
- **Save arguments to configuration**: `Y`

## 🌍 Paso 4: Obtener la URL del API

Después del deploy exitoso, verás en los outputs:

```
Outputs
-----------------------------------------------------------------------
Key                 StreamAnalyzerApi
Description         API Gateway endpoint URL for Stream Analyzer function
Value               https://xxxxx.execute-api.eu-west-1.amazonaws.com/Prod/analyze
-----------------------------------------------------------------------
```

**Copia esta URL**, la necesitarás para configurar Vercel.

## 🔧 Paso 5: Configurar Vercel para usar la Lambda

1. Crea una variable de entorno en Vercel:
   ```
   STREAM_ANALYZER_API=https://xxxxx.execute-api.eu-west-1.amazonaws.com/Prod/analyze
   ```

2. La API de Vercel (`/api/verify_channel.ts`) llamará a esta URL pasándole el stream:
   ```
   GET https://xxxxx.execute-api.eu-west-1.amazonaws.com/Prod/analyze?url=STREAM_URL
   ```

## 📝 Uso de la API

### Request

```bash
GET /analyze?url=http://example.com/stream.m3u8&timeout=15
```

**Parámetros:**
- `url` (requerido): URL del stream a analizar
- `timeout` (opcional): Timeout en segundos (default: 15)

### Response

```json
{
  "status": "ok",
  "quality": "FHD",
  "resolution": "1920x1080",
  "codec": "h264",
  "bitrate": 8000000,
  "audio_channels": 2
}
```

### Ejemplo con curl

```bash
curl "https://xxxxx.execute-api.eu-west-1.amazonaws.com/Prod/analyze?url=http://example.com/stream.m3u8"
```

## 🛠️ Troubleshooting

### El binario no funciona en Lambda

IPTVChecker necesita FFprobe. Asegúrate de que el binario sea **estático** (compilado con musl):

```bash
# Verificar que sea estático
file layer/bin/iptv-checker
# Debe decir: "statically linked"
```

Si no es estático, necesitas incluir FFprobe en la layer también.

### Incluir FFprobe en la Layer

```bash
# Descargar FFmpeg estático para Linux
cd layer
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar xvf ffmpeg-release-amd64-static.tar.xz
mv ffmpeg-*-static/ffprobe bin/
chmod +x bin/ffprobe

# Limpiar
rm -rf ffmpeg-*-static*
```

### Error de timeout

Aumenta el timeout en `template.yaml`:

```yaml
StreamAnalyzerFunction:
  Type: AWS::Serverless::Function
  Properties:
    Timeout: 60  # Aumentar de 30 a 60 segundos
```

### Problemas de CORS

Verifica que los headers CORS estén configurados en `stream_analyzer_lambda.py`.

## 💰 Costos

AWS Lambda Free Tier incluye:
- 1 millón de requests gratis por mes
- 400,000 GB-segundos de tiempo de compute

Con esta configuración (512MB, ~5-10s por request):
- **Gratuito** hasta ~80,000 verificaciones por mes
- Después: ~$0.20 por cada 100,000 verificaciones adicionales

## 🔄 Actualizar la Lambda

Después de hacer cambios:

```bash
sam build
sam deploy
```

## 📊 Monitoreo

Ver logs en tiempo real:

```bash
sam logs -n StreamAnalyzerFunction --tail
```

Ver métricas en AWS CloudWatch:
- Lambda > Functions > StreamAnalyzerFunction > Monitoring

## 🗑️ Eliminar todo

```bash
sam delete
```

Esto eliminará la stack completa de AWS.
