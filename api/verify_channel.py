from http.server import BaseHTTPRequestHandler
import json
import requests
from urllib.parse import urlparse, parse_qs

def check_channel(channel_url, session):
    """Verifica si una URL de canal está operativa y obtiene su resolución."""
    import subprocess
    import time
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        start = time.time()
        response = session.get(channel_url, timeout=10, stream=True, allow_redirects=True, headers=headers)
        elapsed = int((time.time() - start) * 1000)
        if not (200 <= response.status_code < 400): 
            return {'status': 'failed', 'elapsed': elapsed}

        content_type = response.headers.get('Content-Type', '').lower()
        valid_types = ['video', 'audio', 'octet-stream', 'mpegurl', 'x-mpegurl', 'application/vnd.apple.mpegurl']
        if not any(vt in content_type for vt in valid_types):
            response.close()
            return {'status': 'failed', 'elapsed': elapsed}

        # Intentar obtener resolución real con ffprobe
        resolution = None
        try:
            ffprobe_cmd = [
                'ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                '-of', 'json', channel_url
            ]
            result = subprocess.run(ffprobe_cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                import json as js
                info = js.loads(result.stdout)
                streams = info.get('streams', [])
                if streams and 'width' in streams[0] and 'height' in streams[0]:
                    resolution = {'width': streams[0]['width'], 'height': streams[0]['height']}
        except Exception:
            pass

        # Si no se pudo obtener con ffprobe, usar heurística por nombre
        if not resolution:
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
        return {'status': 'ok', 'resolution': resolution, 'elapsed': elapsed}
    except requests.exceptions.RequestException:
        return {'status': 'failed', 'elapsed': None}

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
