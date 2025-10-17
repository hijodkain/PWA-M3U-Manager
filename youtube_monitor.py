#!/usr/bin/env python3
"""
Monitor de YouTube Live - Actualiza automáticamente las URLs de stream
Basado en el sistema de monitoreo del proyecto Youtube_to_m3u
"""

import json
import os
import sys
import time
from datetime import datetime

# Agregar el directorio api al path
sys.path.append(os.path.join(os.path.dirname(__file__), 'api'))

from youtube_extractor import extract_youtube_stream, get_youtube_channel_info

def load_youtube_channels():
    """Cargar canales de YouTube del localStorage simulado"""
    channels_file = 'youtube_channels.json'
    if os.path.exists(channels_file):
        with open(channels_file, 'r') as f:
            return json.load(f)
    return []

def save_youtube_channels(channels):
    """Guardar canales actualizados"""
    channels_file = 'youtube_channels.json'
    with open(channels_file, 'w') as f:
        json.dump(channels, f, indent=2)

def update_channel_stream(channel):
    """Actualizar la URL de stream de un canal específico"""
    youtube_url = channel.get('url', '')
    if not youtube_url:
        return channel
    
    print(f"Verificando canal: {channel.get('name', 'Sin nombre')}")
    print(f"URL: {youtube_url}")
    
    # Intentar extraer stream
    stream_url = extract_youtube_stream(youtube_url)
    
    updated_channel = channel.copy()
    updated_channel['lastChecked'] = datetime.now().isoformat()
    
    if stream_url:
        if stream_url != channel.get('streamUrl', ''):
            print(f"✅ Nuevo stream detectado!")
            print(f"   Nueva URL: {stream_url[:80]}...")
            updated_channel['streamUrl'] = stream_url
            updated_channel['status'] = 'active'
        else:
            print(f"✅ Stream sigue activo (sin cambios)")
            updated_channel['status'] = 'active'
    else:
        if channel.get('status') == 'active':
            print(f"❌ Stream ya no está disponible")
        else:
            print(f"⏸️  Canal no está en vivo")
        updated_channel['streamUrl'] = ''
        updated_channel['status'] = 'checking'
    
    print("-" * 50)
    return updated_channel

def generate_m3u_file(channels):
    """Generar archivo M3U con los canales activos"""
    active_channels = [ch for ch in channels if ch.get('status') == 'active' and ch.get('streamUrl')]
    
    m3u_content = '#EXTM3U\n'
    
    if not active_channels:
        m3u_content += '# Lista de canales de YouTube Live\n'
        m3u_content += '# Ningún canal está actualmente en vivo\n'
        m3u_content += '# Este archivo se actualiza automáticamente cada hora\n'
    else:
        for channel in active_channels:
            logo_attr = f' tvg-logo="{channel.get("logo", "")}"' if channel.get('logo') else ''
            name = channel.get('name', 'Canal de YouTube')
            group = channel.get('group', 'YouTube Live')
            stream_url = channel.get('streamUrl', '')
            
            m3u_content += f'#EXTINF:-1 tvg-name="{name}" group-title="{group}"{logo_attr},{name}\n'
            m3u_content += f'{stream_url}\n'
    
    # Guardar archivo M3U
    with open('youtube_live.m3u', 'w') as f:
        f.write(m3u_content)
    
    return len(active_channels)

def monitor_channels():
    """Función principal de monitoreo"""
    print(f"🔄 Iniciando monitoreo de canales de YouTube Live")
    print(f"⏰ Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Cargar canales
    channels = load_youtube_channels()
    
    if not channels:
        print("❌ No hay canales configurados para monitorear")
        print("   Configura canales desde la interfaz web primero")
        return
    
    print(f"📺 Monitoreando {len(channels)} canal(es):")
    for i, ch in enumerate(channels, 1):
        print(f"   {i}. {ch.get('name', 'Sin nombre')} ({ch.get('status', 'unknown')})")
    print()
    
    # Actualizar cada canal
    updated_channels = []
    for channel in channels:
        updated_channel = update_channel_stream(channel)
        updated_channels.append(updated_channel)
    
    # Guardar canales actualizados
    save_youtube_channels(updated_channels)
    
    # Generar archivo M3U actualizado
    active_count = generate_m3u_file(updated_channels)
    
    print("=" * 60)
    print(f"✅ Monitoreo completado")
    print(f"📊 Resumen: {active_count}/{len(updated_channels)} canales activos")
    print(f"📄 Archivo M3U actualizado: youtube_live.m3u")
    
    # Mostrar estado de cada canal
    print(f"\n📋 Estado actual:")
    for channel in updated_channels:
        name = channel.get('name', 'Sin nombre')
        status = channel.get('status', 'unknown')
        emoji = "🟢" if status == 'active' else "🟡" if status == 'checking' else "🔴"
        print(f"   {emoji} {name}: {status}")

if __name__ == "__main__":
    try:
        monitor_channels()
    except KeyboardInterrupt:
        print("\n❌ Monitoreo interrumpido por el usuario")
    except Exception as e:
        print(f"\n❌ Error durante el monitoreo: {e}")
        import traceback
        traceback.print_exc()