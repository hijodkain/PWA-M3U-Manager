#!/bin/bash

# Script wrapper para el monitor de YouTube Live
# Se ejecuta automáticamente vía cron

# Configurar rutas
PROJECT_DIR="/Users/juancarlos/Sites/PWA-M3U-Manager"
PYTHON_BIN="$PROJECT_DIR/.venv/bin/python"
MONITOR_SCRIPT="$PROJECT_DIR/youtube_monitor.py"
LOG_FILE="$PROJECT_DIR/youtube_monitor.log"

# Cambiar al directorio del proyecto
cd "$PROJECT_DIR"

# Ejecutar el monitor y logging
echo "===========================================" >> "$LOG_FILE"
echo "Monitor ejecutado: $(date)" >> "$LOG_FILE"
echo "===========================================" >> "$LOG_FILE"

"$PYTHON_BIN" "$MONITOR_SCRIPT" >> "$LOG_FILE" 2>&1

echo "Monitor finalizado: $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"