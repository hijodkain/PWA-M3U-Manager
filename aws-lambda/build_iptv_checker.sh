#!/bin/bash

# Script para compilar IPTVChecker y preparar la Lambda Layer
# Uso: ./build_iptv_checker.sh

set -e

echo "🔧 Building IPTVChecker for AWS Lambda..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado. Instálalo desde https://www.docker.com/${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Clonando IPTVChecker desde GitHub...${NC}"

# Limpiar si existe
rm -rf iptv-checker-rs

# Clonar repo
git clone https://github.com/zhimin-dev/iptv-checker-rs.git
cd iptv-checker-rs

echo -e "${YELLOW}🔨 Compilando para Amazon Linux 2 (x86_64-unknown-linux-musl)...${NC}"

# Compilar usando Docker con Rust
docker run --rm \
  -v "$(pwd)":/workspace \
  -w /workspace \
  rust:1.70 \
  bash -c "
    apt-get update && \
    apt-get install -y musl-tools && \
    rustup target add x86_64-unknown-linux-musl && \
    cargo build --release --target x86_64-unknown-linux-musl
  "

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error compilando IPTVChecker${NC}"
    exit 1
fi

cd ..

echo -e "${YELLOW}📁 Creando estructura de Lambda Layer...${NC}"

# Crear directorios
mkdir -p layer/bin

# Copiar binario
cp iptv-checker-rs/target/x86_64-unknown-linux-musl/release/iptv-checker layer/bin/

# Permisos de ejecución
chmod +x layer/bin/iptv-checker

# Verificar
BINARY_SIZE=$(ls -lh layer/bin/iptv-checker | awk '{print $5}')
echo -e "${GREEN}✅ Binario compilado: layer/bin/iptv-checker (${BINARY_SIZE})${NC}"

# Verificar que sea estático
FILE_INFO=$(file layer/bin/iptv-checker)
echo -e "${YELLOW}ℹ️  Información del archivo:${NC}"
echo "   $FILE_INFO"

if echo "$FILE_INFO" | grep -q "statically linked"; then
    echo -e "${GREEN}✅ El binario es estático (perfecto para Lambda)${NC}"
else
    echo -e "${YELLOW}⚠️  El binario podría no ser completamente estático${NC}"
    echo -e "${YELLOW}   Puede que necesites incluir dependencias en la layer${NC}"
fi

echo ""
echo -e "${GREEN}🎉 ¡Compilación completada!${NC}"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo "1. Verificar que aws-lambda/layer/bin/iptv-checker existe"
echo "2. Configurar región en aws-lambda/samconfig.toml (eu-west-1 o eu-central-1)"
echo "3. Ejecutar: cd aws-lambda && sam build && sam deploy --guided"
echo ""
echo -e "${YELLOW}Nota:${NC} IPTVChecker necesita FFprobe. Si falla en Lambda, ejecuta:"
echo "./add_ffprobe_to_layer.sh"
