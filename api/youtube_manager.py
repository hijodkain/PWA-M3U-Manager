from http.server import BaseHTTPRequestHandler
import json
import requests
from urllib.parse import urlparse, parse_qs
import time
from datetime import datetime, timedelta

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            action = data.get('action')
            
            if action == 'create_proxy_url':
                # Crear una URL proxy estable para un canal de YouTube
                youtube_url = data.get('youtube_url', '')
                channel_name = data.get('channel_name', '')
                
                if not youtube_url or not channel_name:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "youtube_url and channel_name are required"}).encode())
                    return
                
                # Generar un ID único para este canal
                import hashlib
                channel_id = hashlib.md5(f"{youtube_url}_{channel_name}_{int(time.time())}".encode()).hexdigest()[:8]
                
                # La URL proxy que será estable
                proxy_url = f"{self.headers.get('host', 'localhost')}/api/youtube_proxy?id={channel_id}"
                
                # En una implementación real, esto se guardaría en una base de datos
                # Por ahora, devolvemos la información para que el frontend la maneje
                result = {
                    'success': True,
                    'proxy_url': f"http://{proxy_url}",
                    'channel_id': channel_id,
                    'youtube_url': youtube_url,
                    'channel_name': channel_name,
                    'created_at': datetime.now().isoformat()
                }
                
            elif action == 'update_stream':
                # Actualizar la URL del stream de un canal
                channel_id = data.get('channel_id', '')
                new_stream_url = data.get('new_stream_url', '')
                
                # En una implementación real, esto actualizaría la base de datos
                result = {
                    'success': True,
                    'message': f'Stream updated for channel {channel_id}',
                    'updated_at': datetime.now().isoformat()
                }
                
            else:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Invalid action"}).encode())
                return
            
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
        # Endpoint para estadísticas y información
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        result = {
            'status': 'YouTube Manager API is running',
            'endpoints': {
                'POST /api/youtube_manager': 'Manage YouTube channels',
                'GET /api/youtube_extractor': 'Extract YouTube streams',
                'GET /api/youtube_proxy': 'Proxy YouTube streams'
            },
            'timestamp': datetime.now().isoformat()
        }
        
        self.wfile.write(json.dumps(result).encode())