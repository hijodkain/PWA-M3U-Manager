# 🚀 Guía de Despliegue AWS Lambda (5 minutos)

## ⚡ Pasos Rápidos

### 1️⃣ Instalar AWS CLI (si no lo tienes)
```bash
# macOS
brew install awscli

# Verificar instalación
aws --version
```

### 2️⃣ Instalar SAM CLI (si no lo tienes)
```bash
# macOS
brew tap aws/tap
brew install aws-sam-cli

# Verificar instalación
sam --version
```

### 3️⃣ Configurar AWS CLI (primera vez)
```bash
aws configure
```

Te pedirá:
- **AWS Access Key ID**: (de tu cuenta AWS)
- **AWS Secret Access Key**: (de tu cuenta AWS)
- **Default region**: `eu-west-1` (o tu región)
- **Default output format**: `json`

**¿No tienes las keys?** Ve a: AWS Console → IAM → Users → Tu usuario → Security credentials → Create access key

---

### 4️⃣ Desplegar Lambda (1 comando)
```bash
cd /Users/juancarlos/Sites/PWA-M3U-Manager/aws-lambda
./deploy.sh
```

El script hace TODO automáticamente:
- ✅ Descarga FFprobe
- ✅ Construye las Lambda
- ✅ Despliega a AWS
- ✅ Crea `.env.local` con la URL

**IMPORTANTE**: En la primera ejecución te hará unas preguntas:

```
Stack Name [pwa-m3u-stream-verification]: [ENTER] (dejar por defecto)
AWS Region [eu-west-1]: [ENTER] (o tu región)
Confirm changes before deploy [Y/n]: Y
Allow SAM CLI IAM role creation [Y/n]: Y
Disable rollback [y/N]: N
Save arguments to configuration file [Y/n]: Y
```

**Espera 2-3 minutos** mientras AWS crea todo...

---

### 5️⃣ Al finalizar verás algo así:

```
✅ API Gateway URL:
   https://abc123xyz.execute-api.eu-west-1.amazonaws.com/Prod/

Endpoints disponibles:
  • Verificación Simple:  https://abc123xyz.../verify-simple?url=<STREAM_URL>
  • Verificación Calidad: https://abc123xyz.../verify-quality?url=<STREAM_URL>

⚠️  Guarda esta URL - la necesitarás en Vercel
```

**COPIA ESA URL** 📋

---

### 6️⃣ Configurar en Vercel

1. Ve a: https://vercel.com/hijodkain/pwa-m3u-manager (o tu dashboard)
2. Settings → Environment Variables
3. Click "Add Variable"
4. **Name**: `NEXT_PUBLIC_AWS_VERIFY_API_URL`
5. **Value**: `https://abc123xyz.execute-api.eu-west-1.amazonaws.com/Prod/` (tu URL)
6. **Environment**: Production, Preview, Development (marca los 3)
7. Click "Save"
8. Ve a "Deployments" → Click en los 3 puntos del último deployment → "Redeploy"

**¡LISTO!** 🎉

---

## 🧪 Probar que funciona

Una vez desplegado en Vercel:

1. Ve a tu app: https://pwa-m3u-manager.vercel.app (o tu dominio)
2. Pestaña **Reparación**
3. Carga una lista M3U en la **lista principal**
4. Click en botón **"Verify"** de un canal
5. Deberías ver: ✅ **ok** o ❌ **failed**

---

## 🆘 Si algo falla:

### Error: "AWS CLI not configured"
```bash
aws configure
```

### Error: "SAM not found"
```bash
brew install aws-sam-cli
```

### Error: "Permission denied"
```bash
chmod +x deploy.sh
```

### Ver logs de Lambda en AWS
```bash
sam logs --stack-name pwa-m3u-stream-verification --tail
```

O ve a: AWS Console → CloudWatch → Log groups → `/aws/lambda/...`

---

## 💰 ¿Cuánto cuesta?

**GRATIS** para uso normal:
- AWS Free Tier: 1 millón de peticiones/mes GRATIS
- Después: $0.0000002 por petición (casi nada)

**Ejemplo**: Verificar 10,000 canales/mes = **$0.002 USD**

---

## 🗑️ Eliminar recursos (si quieres)

```bash
cd /Users/juancarlos/Sites/PWA-M3U-Manager/aws-lambda
sam delete --stack-name pwa-m3u-stream-verification
```

---

## 📞 Problemas comunes:

1. **"No module named 'boto3'"** → Normal, AWS lo provee automáticamente
2. **"FFprobe not found"** → El script lo descarga automático
3. **"Timeout"** → Los timeouts ya están configurados (15s simple, 30s quality)

---

¿Listo? Ejecuta:
```bash
cd /Users/juancarlos/Sites/PWA-M3U-Manager/aws-lambda
./deploy.sh
```

Y copia la URL que te dé al final para configurarla en Vercel 🚀
