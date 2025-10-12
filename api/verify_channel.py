from http.server import BaseHTTPRequestHandler
import json
import requests
from urllib.parse import urlparse, parse_qs

def check_channel(channel_url, session):
    """Verifica si una URL de canal está operativa y obtiene su resolución."""
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = session.get(channel_url, timeout=5, stream=True, allow_redirects=True, headers=headers)
        if not (200 <= response.status_code < 400): 
            return {'status': 'failed'}

        content_type = response.headers.get('Content-Type', '').lower()
        if any(ct in content_type for ct in ['text/html', 'text/plain', 'application/json']):
            response.close()
            return {'status': 'failed'}

        # Intenta detectar resolución del stream a partir del nombre del canal o metadata
        resolution = None
        if '2160p' in channel_url or '4K' in channel_url.upper():
            resolution = {'width': 3840, 'height': 2160}
        elif '1440p' in channel_url or '2K' in channel_url.upper():
            resolution = {'width': 2560, 'height': 1440}
        elif '1080p' in channel_url or 'FHD' in channel_url.upper():
            resolution = {'width': 1920, 'height': 1080}
        elif '720p' in channel_url or 'HD' in channel_url.upper():
            resolution = {'width': 1280, 'height': 720}
        else:
            resolution = {'width': 854, 'height': 480}  # SD por defecto

        response.close()
        return {'status': 'ok', 'resolution': resolution}
    except requests.exceptions.RequestException:
        return {'status': 'failed'}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query_components = parse_qs(urlparse(self.path).query)
        url = query_components.get("url", [None])[0]

        if not url:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "URL is required"}).encode())
            return

        with requests.Session() as session:
            status = check_channel(url, session)

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"status": status}).encode())
        return
