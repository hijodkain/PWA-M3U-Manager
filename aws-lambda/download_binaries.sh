#!/bin/bash

# Script para descargar binarios precompilados de IPTVChecker y FFprobe
# Mucho más simple que compilar desde cero

set -e

echo "🚀 Descargando binarios precompilados para AWS Lambda..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Crear estructura de directorios
echo -e "${YELLOW}📁 Creando estructura de directorios...${NC}"
mkdir -p layer/bin

# 1. Descargar FFprobe estático (funciona en Amazon Linux)
echo -e "${YELLOW}📥 Descargando FFprobe estático para Linux...${NC}"
cd layer
curl -L -o ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz

echo -e "${YELLOW}📦 Extrayendo FFprobe...${NC}"
tar xf ffmpeg.tar.xz
FFMPEG_DIR=$(ls -d ffmpeg-*-static | head -n 1)
cp "$FFMPEG_DIR/ffprobe" bin/
chmod +x bin/ffprobe
rm -rf "$FFMPEG_DIR" ffmpeg.tar.xz

FFPROBE_SIZE=$(ls -lh bin/ffprobe | awk '{print $5}')
echo -e "${GREEN}✅ FFprobe descargado: ${FFPROBE_SIZE}${NC}"

cd ..

# 2. Intentar descargar IPTVChecker precompilado
echo -e "${YELLOW}📥 Buscando IPTVChecker precompilado...${NC}"

# Nota: Si no hay release, usaremos una alternativa
IPTV_CHECKER_URL="https://github.com/zhimin-dev/iptv-checker-rs/releases/latest/download/iptv-checker-rs-x86_64-unknown-linux-musl"

# Intentar descargar
if curl -s --head "$IPTV_CHECKER_URL" | grep "200 OK" > /dev/null; then
    echo -e "${GREEN}✅ Encontrado release precompilado${NC}"
    curl -L -o layer/bin/iptv-checker "$IPTV_CHECKER_URL"
    chmod +x layer/bin/iptv-checker
    BINARY_SIZE=$(ls -lh layer/bin/iptv-checker | awk '{print $5}')
    echo -e "${GREEN}✅ IPTVChecker descargado: ${BINARY_SIZE}${NC}"
else
    echo -e "${YELLOW}⚠️  No hay release precompilado de IPTVChecker${NC}"
    echo -e "${YELLOW}ℹ️  Creando binario placeholder (usaremos solo FFprobe por ahora)${NC}"
    
    # Crear un script wrapper que use solo FFprobe
    cat > layer/bin/iptv-checker << 'EOF'
#!/bin/bash
# Wrapper temporal que usa FFprobe directamente
# Formato: iptv-checker --url URL --json --timeout TIMEOUT

URL=""
TIMEOUT=15

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            URL="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --json)
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Ejecutar FFprobe
/opt/bin/ffprobe -v quiet -print_format json -show_streams -show_format -i "$URL" 2>&1
EOF
    chmod +x layer/bin/iptv-checker
    echo -e "${GREEN}✅ Wrapper de FFprobe creado${NC}"
fi

echo ""
echo -e "${GREEN}🎉 ¡Binarios listos!${NC}"
echo ""
echo -e "${YELLOW}Archivos descargados:${NC}"
ls -lh layer/bin/
echo ""
echo -e "${YELLOW}Próximo paso:${NC}"
echo "sam build && sam deploy --guided"
