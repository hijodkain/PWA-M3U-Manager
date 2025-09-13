from http.server import BaseHTTPRequestHandler
import json
import requests
from urllib.parse import urlparse, parse_qs

def check_channel(channel_url, session):
    """Verifica si una URL de canal está operativa."""
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = session.get(channel_url, timeout=5, stream=True, allow_redirects=True, headers=headers)
        if not (200 <= response.status_code < 400): return 'failed'
        content_type = response.headers.get('Content-Type', '').lower()
        if any(ct in content_type for ct in ['text/html', 'text/plain', 'application/json']):
            response.close()
            return 'failed'
        response.close()
        return 'ok'
    except requests.exceptions.RequestException:
        return 'failed'

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
