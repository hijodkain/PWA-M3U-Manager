from http.server import BaseHTTPRequestHandler
import json
import requests
import re
from datetime import datetime, timedelta
import os

# En una implementación real, esto estaría en una base de datos
# Para el demo, usamos almacenamiento en memoria
YOUTUBE_CHANNELS_DB = {}

def extract_youtube_stream(youtube_url):
    """
    Extrae la URL del stream M3U8 de una URL de YouTube
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(youtube_url, headers=headers, timeout=15)
        response.raise_for_status()
        
        content = response.text
        
        # Buscar URLs .m3u8 en el contenido
        if '.m3u8' not in content:
            return None
            
        # Encontrar la posición del .m3u8
        end = content.find('.m3u8') + 5
        tuner = 100
        
        while tuner < len(content):
            segment = content[max(0, end-tuner):end]
            if 'https://' in segment:
                start_idx = segment.find('https://')
                if start_idx != -1:
                    # Extraer la URL completa
                    stream_url = segment[start_idx:segment.find('.m3u8') + 5]
                    # Limpiar caracteres extraños
                    stream_url = re.sub(r'["\\\n\r\t]', '', stream_url)
                    if stream_url.startswith('https://') and stream_url.endswith('.m3u8'):
                        return stream_url
            tuner += 50
            
        return None
        
    except Exception as e:
        print(f"Error extracting YouTube stream: {e}")
        return None

def check_all_youtube_channels():
    """
    Verifica todos los canales de YouTube registrados y actualiza sus streams
    """
    results = {
        'checked': 0,
        'updated': 0,
        'failed': 0,
        'channels': []
    }
    
    for channel_id, channel_data in YOUTUBE_CHANNELS_DB.items():
        results['checked'] += 1
        
        try:
            # Extraer el stream actual
            current_stream = extract_youtube_stream(channel_data['youtube_url'])
            
            channel_result = {
                'channel_id': channel_id,
                'name': channel_data.get('name', 'Unknown'),
                'youtube_url': channel_data['youtube_url'],
                'previous_stream': channel_data.get('current_stream_url'),
                'current_stream': current_stream,
                'updated': False,
                'is_live': bool(current_stream)
            }
            
            if current_stream:
                # Verificar si el stream cambió
                if current_stream != channel_data.get('current_stream_url'):
                    # Actualizar el stream
                    YOUTUBE_CHANNELS_DB[channel_id]['current_stream_url'] = current_stream
                    YOUTUBE_CHANNELS_DB[channel_id]['last_updated'] = datetime.now().isoformat()
                    channel_result['updated'] = True
                    results['updated'] += 1
                
                YOUTUBE_CHANNELS_DB[channel_id]['last_checked'] = datetime.now().isoformat()
                YOUTUBE_CHANNELS_DB[channel_id]['is_live'] = True
            else:
                # Canal no está en vivo
                YOUTUBE_CHANNELS_DB[channel_id]['is_live'] = False
                YOUTUBE_CHANNELS_DB[channel_id]['last_checked'] = datetime.now().isoformat()
                results['failed'] += 1
            
            results['channels'].append(channel_result)
            
        except Exception as e:
            print(f"Error checking channel {channel_id}: {e}")
            channel_result = {
                'channel_id': channel_id,
                'name': channel_data.get('name', 'Unknown'),
                'error': str(e),
                'is_live': False
            }
            results['channels'].append(channel_result)
            results['failed'] += 1
    
    return results

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Endpoint para ejecutar el monitoreo automático
        try:
            # Verificar si es una llamada de cron o manual
            is_cron = self.headers.get('X-Vercel-Cron-Secret') == os.environ.get('CRON_SECRET')
            
            # Ejecutar verificación
            results = check_all_youtube_channels()
            
            response_data = {
                'success': True,
                'timestamp': datetime.now().isoformat(),
                'is_cron_job': is_cron,
                'summary': {
                    'total_channels': results['checked'],
                    'updated_channels': results['updated'],
                    'failed_channels': results['failed'],
                    'success_rate': f"{((results['checked'] - results['failed']) / max(results['checked'], 1) * 100):.1f}%" if results['checked'] > 0 else "0%"
                },
                'details': results['channels']
            }
            
            # Log para debugging
            print(f"YouTube Monitor executed: {results['checked']} channels checked, {results['updated']} updated")
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data, indent=2).encode())
            
        except Exception as e:
            error_response = {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(error_response).encode())

    def do_POST(self):
        # Endpoint para registrar/desregistrar canales
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            action = data.get('action')
            
            if action == 'register':
                # Registrar un nuevo canal para monitoreo
                channel_id = data.get('channel_id')
                youtube_url = data.get('youtube_url')
                channel_name = data.get('channel_name', '')
                
                if not channel_id or not youtube_url:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "channel_id and youtube_url are required"}).encode())
                    return
                
                # Extraer stream inicial
                initial_stream = extract_youtube_stream(youtube_url)
                
                YOUTUBE_CHANNELS_DB[channel_id] = {
                    'youtube_url': youtube_url,
                    'name': channel_name,
                    'current_stream_url': initial_stream,
                    'created_at': datetime.now().isoformat(),
                    'last_checked': datetime.now().isoformat(),
                    'last_updated': datetime.now().isoformat(),
                    'is_live': bool(initial_stream)
                }
                
                response = {
                    'success': True,
                    'message': f'Channel {channel_id} registered for monitoring',
                    'initial_stream': initial_stream,
                    'is_live': bool(initial_stream)
                }
                
            elif action == 'unregister':
                # Desregistrar un canal
                channel_id = data.get('channel_id')
                
                if channel_id in YOUTUBE_CHANNELS_DB:
                    del YOUTUBE_CHANNELS_DB[channel_id]
                    response = {'success': True, 'message': f'Channel {channel_id} unregistered'}
                else:
                    response = {'success': False, 'error': 'Channel not found'}
                    
            elif action == 'list':
                # Listar todos los canales registrados
                response = {
                    'success': True,
                    'channels': dict(YOUTUBE_CHANNELS_DB),
                    'count': len(YOUTUBE_CHANNELS_DB)
                }
                
            else:
                response = {'success': False, 'error': 'Invalid action'}
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())