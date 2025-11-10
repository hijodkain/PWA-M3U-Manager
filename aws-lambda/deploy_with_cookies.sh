#!/bin/bash

# Script para redesplegar YouTube Extractor Lambda con soporte de cookies

echo "🚀 Desplegando YouTube Extractor Lambda con soporte de cookies..."
echo ""

cd "$(dirname "$0")"

# Verificar que estamos en el directorio correcto
if [ ! -f "youtube_extractor_lambda.py" ]; then
    echo "❌ Error: No se encuentra youtube_extractor_lambda.py"
    echo "   Asegúrate de estar en el directorio aws-lambda/"
    exit 1
fi

echo "📦 Paso 1: Construyendo Lambda con SAM..."
sam build

if [ $? -ne 0 ]; then
    echo "❌ Error en sam build"
    exit 1
fi

echo ""
echo "🚢 Paso 2: Desplegando a AWS..."
sam deploy

if [ $? -ne 0 ]; then
    echo "❌ Error en sam deploy"
    exit 1
fi

echo ""
echo "✅ ¡Despliegue completado con éxito!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Verifica que las cookies estén actualizadas en Secrets Manager (youtube-cookies)"
echo "2. Prueba la extracción desde la app"
echo "3. Revisa los logs en CloudWatch si hay problemas"
echo ""
echo "🔍 Logs de CloudWatch:"
echo "   /aws/lambda/youtube-extractor-streaml-YouTubeExtractorFunction-*"
echo ""
