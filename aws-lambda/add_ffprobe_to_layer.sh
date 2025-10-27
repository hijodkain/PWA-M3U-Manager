#!/bin/bash

# Script para añadir FFprobe a la Lambda Layer
# Uso: ./add_ffprobe_to_layer.sh

set -e

echo "🔧 Adding FFprobe to Lambda Layer..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}📥 Descargando FFmpeg estático para Linux...${NC}"

cd layer

# Descargar build estático de FFmpeg (incluye ffprobe)
wget -O ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz

echo -e "${YELLOW}📦 Extrayendo archivos...${NC}"

# Extraer
tar xvf ffmpeg.tar.xz

# Copiar solo ffprobe a bin/
FFMPEG_DIR=$(ls -d ffmpeg-*-static)
cp "$FFMPEG_DIR/ffprobe" bin/
chmod +x bin/ffprobe

# Limpiar
rm -rf "$FFMPEG_DIR"
rm ffmpeg.tar.xz

cd ..

FFPROBE_SIZE=$(ls -lh layer/bin/ffprobe | awk '{print $5}')
echo -e "${GREEN}✅ FFprobe añadido: layer/bin/ffprobe (${FFPROBE_SIZE})${NC}"

# Verificar versión
echo -e "${YELLOW}ℹ️  Verificando FFprobe:${NC}"
docker run --rm -v "$(pwd)/layer/bin":/app amazonlinux:2 /app/ffprobe -version | head -n 1

echo ""
echo -e "${GREEN}🎉 ¡FFprobe listo!${NC}"
echo ""
echo -e "${YELLOW}Ahora ejecuta:${NC}"
echo "cd aws-lambda && sam build && sam deploy"
