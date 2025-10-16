from http.server import BaseHTTPRequestHandler
import json
import requests
from urllib.parse import urlparse, parse_qs
import re
import os

def extract_youtube_stream(youtube_url):
    """
    Extrae la URL del stream M3U8 de una URL de YouTube
    Basado en el proyecto Youtube_to_m3u de benmoose39
    """
    try:
        # Hacer request a la URL de YouTube
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(youtube_url, headers=headers, timeout=15)
        response.raise_for_status()
        
        content = response.text
        
        # Buscar URLs .m3u8 en el contenido - Método del proyecto original
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
                    # Extraer la URL completa del stream
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

def get_youtube_channel_info(youtube_url):
    """
    Extrae información básica del canal de YouTube
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(youtube_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        content = response.text
        
        # Extraer título del canal/video
        title_match = re.search(r'<title>([^<]+)</title>', content)
        title = title_match.group(1) if title_match else "Canal de YouTube"
        title = title.replace(' - YouTube', '').strip()
        
        # Extraer thumbnail
        thumbnail_match = re.search(r'"thumbnail":\s*{\s*"thumbnails":\s*\[\s*{\s*"url":\s*"([^"]+)"', content)
        thumbnail = thumbnail_match.group(1) if thumbnail_match else ""
        
        return {
            'title': title,
            'thumbnail': thumbnail,
            'original_url': youtube_url
        }
        
    except Exception as e:
        print(f"Error getting YouTube channel info: {e}")
        return {
            'title': "Canal de YouTube",
            'thumbnail': "",
            'original_url': youtube_url
        }

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Leer el body de la request
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            youtube_url = data.get('url', '')
            action = data.get('action', 'extract')  # 'extract' o 'info'
            
            if not youtube_url:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "URL is required"}).encode())
                return
            
            # Validar que sea una URL de YouTube
            if 'youtube.com' not in youtube_url and 'youtu.be' not in youtube_url:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "URL debe ser de YouTube"}).encode())
                return
            
            if action == 'extract':
                # Extraer stream URL
                stream_url = extract_youtube_stream(youtube_url)
                
                if stream_url:
                    # También obtener info del canal
                    channel_info = get_youtube_channel_info(youtube_url)
                    
                    result = {
                        'success': True,
                        'stream_url': stream_url,
                        'channel_info': channel_info
                    }
                else:
                    result = {
                        'success': False,
                        'error': 'No se pudo extraer el stream de YouTube. Puede que no esté en vivo.'
                    }
                    
            elif action == 'info':
                # Solo obtener información del canal
                channel_info = get_youtube_channel_info(youtube_url)
                result = {
                    'success': True,
                    'channel_info': channel_info
                }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_GET(self):
        # Para testing
        query_components = parse_qs(urlparse(self.path).query)
        url = query_components.get("url", [None])[0]
        
        if not url:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "URL parameter is required"}).encode())
            return
        
        # Extraer stream
        stream_url = extract_youtube_stream(url)
        channel_info = get_youtube_channel_info(url)
        
        result = {
            'success': bool(stream_url),
            'stream_url': stream_url,
            'channel_info': channel_info
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())