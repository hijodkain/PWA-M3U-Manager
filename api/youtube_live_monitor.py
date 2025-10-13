from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse
import json
import yt_dlp
import time

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send_cors_headers()
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        self._send_cors_headers()
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data)
        channel_url = data.get('channelUrl')

        if not channel_url:
            self._send_error("Channel URL is required")
            return

        # Validar URL
        try:
            parsed_url = urlparse(channel_url)
            if not parsed_url.netloc or 'youtube.com' not in parsed_url.netloc:
                self._send_error("Invalid YouTube URL")
                return
        except:
            self._send_error("Invalid URL format")
            return

        start_time = time.time()
        try:
            ydl_opts = {
                'format': 'best',
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'force_generic_extractor': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                channel_info = ydl.extract_info(channel_url, download=False)
                # Buscar streams en vivo
                live_streams = []
                if 'entries' in channel_info:
                    for entry in channel_info['entries'][:5]:  # Limitar a los primeros 5 videos
                        if entry.get('is_live'):
                            try:
                                stream_info = ydl.extract_info(
                                    f"https://www.youtube.com/watch?v={entry['id']}", 
                                    download=False
                                )
                                live_streams.append({
                                    'title': entry.get('title'),
                                    'video_id': entry.get('id'),
                                    'stream_url': stream_info.get('url'),
                                    'thumbnail': entry.get('thumbnail'),
                                    'viewer_count': entry.get('viewer_count'),
                                    'start_time': entry.get('start_time'),
                                })
                            except Exception as e:
                                print(f"Error getting stream info: {e}")
                                continue

                elapsed_ms = int((time.time() - start_time) * 1000)
                response_data = {
                    'success': True,
                    'channel_info': {
                        'id': channel_info.get('id'),
                        'title': channel_info.get('title'),
                        'is_live': len(live_streams) > 0,
                        'streams': live_streams,
                        'elapsed_ms': elapsed_ms
                    }
                }
                self._send_response(response_data)

        except Exception as e:
            self._send_error(str(e))

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _send_response(self, data):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _send_error(self, message):
        self.send_response(400)
        self.send_header('Content-type', 'application/json')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({
            'success': False,
            'error': message
        }).encode())