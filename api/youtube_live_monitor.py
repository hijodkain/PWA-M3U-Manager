from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse
import json
import yt_dlp
import time
from typing import Dict, Any

def handle_cors() -> Dict[str, str]:
    return {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
        'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
    }

def handler(request):
    # Handle CORS preflight request
    if request['method'] == 'OPTIONS':
        return {
            'statusCode': 204,
            'headers': handle_cors(),
            'body': ''
        }

    if request['method'] != 'POST':
        return {
            'statusCode': 405,
            'headers': handle_cors(),
            'body': json.dumps({'error': 'Method not allowed'})
        }

    try:
        # Parse request body
        body = json.loads(request['body'])
        channel_url = body.get('channelUrl')

        if not channel_url:
            return {
                'statusCode': 400,
                'headers': handle_cors(),
                'body': json.dumps({'error': 'Channel URL is required'})
            }

        # Validar URL
        try:
            parsed_url = urlparse(channel_url)
            if not parsed_url.netloc or 'youtube.com' not in parsed_url.netloc:
                return {
                    'statusCode': 400,
                    'headers': handle_cors(),
                    'body': json.dumps({'error': 'Invalid YouTube URL'})
                }
        except:
            return {
                'statusCode': 400,
                'headers': handle_cors(),
                'body': json.dumps({'error': 'Invalid URL format'})
            }

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
                
                return {
                    'statusCode': 200,
                    'headers': {
                        **handle_cors(),
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps(response_data)
                }

        except Exception as e:
            return {
                'statusCode': 500,
                'headers': handle_cors(),
                'body': json.dumps({
                    'success': False,
                    'error': str(e)
                })
            }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': handle_cors(),
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
        self.wfile.write(json.dumps({
            'success': False,
            'error': message
        }).encode())