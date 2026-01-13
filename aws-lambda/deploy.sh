#!/bin/bash

# Script de despliegue para AWS Lambda Stream Verification
# PWA M3U Manager

set -e

echo "🚀 Desplegando Stream Verification Lambda Functions..."
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "template.yaml" ]; then
    echo -e "${RED}❌ Error: template.yaml no encontrado${NC}"
    echo "Ejecuta este script desde el directorio aws-lambda/"
    exit 1
fi

# Verificar AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ Error: AWS CLI no está instalado${NC}"
    echo "Instala AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Verificar SAM CLI
if ! command -v sam &> /dev/null; then
    echo -e "${RED}❌ Error: AWS SAM CLI no está instalado${NC}"
    echo "Instala SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

# Verificar FFprobe binary
if [ ! -f "ffprobe-layer/bin/ffprobe" ]; then
    echo -e "${YELLOW}⚠️  Advertencia: FFprobe binary no encontrado en ffprobe-layer/bin/${NC}"
    echo ""
    echo "Descargando FFprobe estático..."
    mkdir -p ffprobe-layer/bin
    cd ffprobe-layer/bin
    
    # Descargar FFmpeg estático de John Van Sickle
    echo "Descargando desde johnvansickle.com..."
    wget -q --show-progress https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
    
    echo "Extrayendo..."
    tar -xf ffmpeg-release-amd64-static.tar.xz
    
    # Mover solo ffprobe
    mv ffmpeg-*-amd64-static/ffprobe .
    
    # Limpiar
    rm -rf ffmpeg-*
    
    # Dar permisos de ejecución
    chmod +x ffprobe
    
    cd ../..
    
    echo -e "${GREEN}✅ FFprobe descargado correctamente${NC}"
    echo ""
fi

# Verificar configuración de AWS
echo "Verificando configuración de AWS..."
aws sts get-caller-identity &> /dev/null
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: No estás autenticado en AWS${NC}"
    echo "Ejecuta: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)
echo -e "${GREEN}✅ AWS Account: ${ACCOUNT_ID}${NC}"
echo -e "${GREEN}✅ Region: ${REGION}${NC}"
echo ""

# Build
echo "📦 Building SAM application..."
sam build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Deploy
echo "🚀 Deploying to AWS..."
echo ""

# Verificar si existe samconfig.toml
if [ -f "samconfig.toml" ]; then
    echo "Usando configuración existente en samconfig.toml"
    sam deploy
else
    echo "Primera vez desplegando - se te harán algunas preguntas:"
    echo ""
    sam deploy --guided
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deploy failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Despliegue completado exitosamente${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Información del despliegue:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Obtener outputs del stack
STACK_NAME=$(grep stack_name samconfig.toml | cut -d'"' -f2 2>/dev/null || echo "pwa-m3u-stream-verification")
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='StreamVerificationApi'].OutputValue" --output text)

if [ -n "$API_URL" ]; then
    echo -e "${GREEN}✅ API Gateway URL:${NC}"
    echo "   $API_URL"
    echo ""
    echo "Endpoints disponibles:"
    echo "  • Verificación Simple:  ${API_URL}verify-simple?url=<STREAM_URL>"
    echo "  • Verificación Calidad: ${API_URL}verify-quality?url=<STREAM_URL>"
    echo ""
    echo -e "${YELLOW}⚠️  Guarda esta URL - la necesitarás en el frontend${NC}"
    echo ""
    
    # Crear archivo .env.local si no existe
    if [ ! -f "../.env.local" ]; then
        echo "Creando archivo .env.local con la configuración..."
        cat > ../.env.local << EOF
# AWS Lambda Stream Verification API
NEXT_PUBLIC_AWS_VERIFY_API_URL=${API_URL}
EOF
        echo -e "${GREEN}✅ Archivo .env.local creado${NC}"
    else
        echo -e "${YELLOW}⚠️  Actualiza manualmente tu .env.local:${NC}"
        echo "   NEXT_PUBLIC_AWS_VERIFY_API_URL=${API_URL}"
    fi
else
    echo -e "${RED}❌ No se pudo obtener la URL del API Gateway${NC}"
    echo "Verifica manualmente en la consola de AWS CloudFormation"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}🎉 ¡Despliegue completado!${NC}"
echo ""
echo "Siguiente paso:"
echo "  1. Copia la URL del API Gateway"
echo "  2. Actualiza useReparacion.ts con la nueva URL"
echo "  3. Prueba la verificación de canales"
echo ""
