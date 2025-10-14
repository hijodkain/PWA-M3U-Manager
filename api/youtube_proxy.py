from http.server import BaseHTTPRequestHandler
import json
import requests
from urllib.parse import urlparse, parse_qs

# En una implementación real, esto estaría en una base de datos
# Para el demo, usamos un diccionario en memoria
YOUTUBE_CHANNELS = {}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            query_components = parse_qs(urlparse(self.path).query)
            channel_id = query_components.get("id", [None])[0]
            
            if not channel_id:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Channel ID is required"}).encode())
                return
            
            # En una implementación real, buscaríamos en la base de datos
            # Por ahora, extraemos el stream en tiempo real
            
            # Simulamos que tenemos la URL original del canal guardada
            # En la implementación real, esto vendría de la base de datos
            if channel_id not in YOUTUBE_CHANNELS:
                # Para el demo, podemos aceptar una URL de YouTube como parámetro
                youtube_url = query_components.get("youtube_url", [None])[0]
                if not youtube_url:
                    self.send_response(404)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Channel not found"}).encode())
                    return
            else:
                youtube_url = YOUTUBE_CHANNELS[channel_id]['youtube_url']
            
            # Extraer el stream actual de YouTube
            stream_url = self.extract_youtube_stream(youtube_url)
            
            if stream_url:
                # Redirigir al stream real
                self.send_response(302)
                self.send_header('Location', stream_url)
                self.end_headers()
            else:
                # Si no hay stream disponible, devolver error
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": "Stream not available",
                    "message": "El canal no está transmitiendo en vivo en este momento"
                }).encode())
                
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def extract_youtube_stream(self, youtube_url):
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
                        import re
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

    def do_POST(self):
        # Registrar un nuevo canal
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            channel_id = data.get('channel_id')
            youtube_url = data.get('youtube_url')
            channel_name = data.get('channel_name', '')
            
            if not channel_id or not youtube_url:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "channel_id and youtube_url are required"}).encode())
                return
            
            # Guardar en nuestro "database" en memoria
            YOUTUBE_CHANNELS[channel_id] = {
                'youtube_url': youtube_url,
                'channel_name': channel_name,
                'created_at': self.get_current_time(),
                'last_updated': self.get_current_time()
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "message": f"Channel {channel_id} registered successfully"
            }).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def get_current_time(self):
        from datetime import datetime
        return datetime.now().isoformat()