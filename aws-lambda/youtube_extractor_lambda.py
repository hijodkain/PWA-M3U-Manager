import json
import requests
import re
from urllib.parse import urlparse, parse_qs

def extract_youtube_stream(youtube_url):
    """
    Extrae la URL del stream M3U8 de una URL de YouTube
    Versión optimizada para AWS Lambda con múltiples estrategias
    """
    debug_info = []
    try:
        debug_info.append(f"AWS Lambda - Processing URL: {youtube_url}")
        
        # ESTRATEGIA 1: Intentar extraer video ID y usar API directa
        video_id = None
        
        # Extraer video ID de diferentes formatos de URL
        if 'watch?v=' in youtube_url:
            video_id = youtube_url.split('watch?v=')[1].split('&')[0]
            debug_info.append(f"Extracted video ID from watch URL: {video_id}")
        elif '/live' in youtube_url or '/@' in youtube_url:
            debug_info.append("Channel URL detected, will try web scraping")
        
        # Si tenemos video ID, intentar acceso directo
        if video_id and len(video_id) == 11:
            direct_result = try_direct_video_access(video_id, debug_info)
            if direct_result:
                return direct_result, debug_info
        
        # ESTRATEGIA 2: Web scraping mejorado
        web_result = try_web_scraping_strategy(youtube_url, debug_info)
        if web_result:
            return web_result, debug_info
        
        # ESTRATEGIA 3: Endpoint móvil
        mobile_result = try_mobile_endpoint_strategy(youtube_url, debug_info)
        if mobile_result:
            return mobile_result, debug_info
        
        debug_info.append("AWS Lambda: All strategies failed - no valid stream found")
        return None, debug_info
        
    except Exception as e:
        debug_info.append(f"AWS Lambda error: {e}")
        return None, debug_info

def try_direct_video_access(video_id, debug_info):
    """Estrategia 1: Acceso directo usando API interna de YouTube"""
    try:
        debug_info.append(f"Strategy 1: Direct video access for ID: {video_id}")
        
        # URL directa del endpoint de YouTube
        api_url = f"https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
        
        payload = {
            "context": {
                "client": {
                    "clientName": "WEB",
                    "clientVersion": "2.20231201.01.00"
                }
            },
            "videoId": video_id
        }
        
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.post(api_url, json=payload, headers=headers, timeout=30)
        if response.status_code == 200:
            data = response.json()
            
            if 'streamingData' in data and 'hlsManifestUrl' in data['streamingData']:
                hls_url = data['streamingData']['hlsManifestUrl']
                debug_info.append(f"Direct API success: Found HLS URL")
                return hls_url
            else:
                debug_info.append("Direct API: No streaming data found (video may not be live)")
        else:
            debug_info.append(f"Direct API failed with status: {response.status_code}")
            
    except Exception as e:
        debug_info.append(f"Direct access error: {e}")
    
    return None

def try_web_scraping_strategy(youtube_url, debug_info):
    """Estrategia 2: Web scraping mejorado"""
    try:
        debug_info.append("Strategy 2: Enhanced web scraping")
        
        # Lista de URLs a probar
        urls_to_try = []
        
        if '/@' in youtube_url:
            channel_base = youtube_url.split('/live')[0] if '/live' in youtube_url else youtube_url.rstrip('/')
            urls_to_try.extend([
                f"{channel_base}/live",
                f"{channel_base}/streams", 
                youtube_url
            ])
        else:
            urls_to_try.append(youtube_url)
        
        # Asegurar www.
        for url in urls_to_try.copy():
            if 'www.youtube.com' not in url and 'youtube.com' in url:
                urls_to_try.append(url.replace('youtube.com', 'www.youtube.com'))
        
        debug_info.append(f"Will try {len(urls_to_try)} URL variants")
        
        # User agents rotativos
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
        
        for i, url_to_try in enumerate(urls_to_try):
            debug_info.append(f"Attempt {i+1}/{len(urls_to_try)}: {url_to_try}")
            
            if i > 0:
                import time
                import random
                time.sleep(random.uniform(2.0, 4.0))
            
            headers = {
                'User-Agent': user_agents[i % len(user_agents)],
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache'
            }
            
            try:
                session = requests.Session()
                session.headers.update(headers)
                
                response = session.get(url_to_try, timeout=60)
                if response.status_code != 200:
                    debug_info.append(f"Failed with status: {response.status_code}")
                    continue
                
                content = response.text
                debug_info.append(f"Got {len(content)} characters")
                
                # Buscar indicadores de live
                live_indicators = [
                    'isLive":true', '"isLiveContent":true', '"isLiveNow":true',
                    'hls_manifest_url', '.m3u8', '"liveBroadcastContent":"live"'
                ]
                live_found = any(indicator in content for indicator in live_indicators)
                debug_info.append(f"Live indicators found: {live_found}")
                
                # Buscar URLs de streaming
                if live_found or '.m3u8' in content:
                    stream_url = extract_stream_url_from_content(content, debug_info)
                    if stream_url:
                        return stream_url
                        
            except Exception as e:
                debug_info.append(f"Request error: {e}")
                continue
        
        debug_info.append("Web scraping: No valid stream found")
        return None
        
    except Exception as e:
        debug_info.append(f"Web scraping error: {e}")
        return None

def try_mobile_endpoint_strategy(youtube_url, debug_info):
    """Estrategia 3: Endpoint móvil"""
    try:
        debug_info.append("Strategy 3: Mobile endpoint")
        
        mobile_url = youtube_url.replace('www.youtube.com', 'm.youtube.com')
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
        
        response = requests.get(mobile_url, headers=headers, timeout=45)
        if response.status_code == 200:
            content = response.text
            debug_info.append(f"Mobile: Got {len(content)} characters")
            
            stream_url = extract_stream_url_from_content(content, debug_info, is_mobile=True)
            if stream_url:
                return stream_url
        else:
            debug_info.append(f"Mobile failed: {response.status_code}")
            
    except Exception as e:
        debug_info.append(f"Mobile error: {e}")
    
    return None

def extract_stream_url_from_content(content, debug_info, is_mobile=False):
    """Extrae URLs de streaming del contenido HTML/JSON"""
    
    # Patrones para buscar URLs
    patterns = [
        r'"hlsManifestUrl":\s*"([^"]+)"',
        r'"url":"([^"]*\.m3u8[^"]*)"',
        r'https://[^"\s]+\.m3u8[^"\s]*'
    ]
    
    if is_mobile:
        patterns.extend([
            r'"hlsManifestUrl":"([^"]+)"',
            r'manifest_url["\']:\s*["\']([^"\']+)["\']'
        ])
    
    for pattern in patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                match = match[0]
            
            clean_url = match.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')
            
            if (clean_url.startswith('https://') and 
                'googlevideo.com' in clean_url and 
                '.m3u8' in clean_url):
                debug_info.append(f"Found valid stream URL via pattern")
                return clean_url
    
    # Búsqueda manual en el contenido
    if '.m3u8' in content:
        debug_info.append("Doing manual .m3u8 search")
        position = 0
        while True:
            pos = content.find('.m3u8', position)
            if pos == -1:
                break
            
            # Buscar hacia atrás para encontrar el inicio de la URL
            start = pos
            for i in range(pos, max(0, pos - 1000), -1):
                if content[i:i+8] == 'https://':
                    start = i
                    break
            
            # Extraer URL candidata
            url_end = pos + 5
            url_candidate = content[start:url_end]
            url_candidate = url_candidate.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')
            
            if ('googlevideo.com' in url_candidate and 
                url_candidate.startswith('https://') and 
                url_candidate.endswith('.m3u8')):
                debug_info.append("Found valid URL via manual search")
                return url_candidate
            
            position = pos + 1
    
    return None

def lambda_handler(event, context):
    """AWS Lambda handler function con CORS"""
    
    # Headers CORS
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    }
    
    try:
        # Handle preflight OPTIONS
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': ''
            }
        
        # Parse request
        if event.get('body'):
            body = json.loads(event['body'])
        else:
            body = event
            
        youtube_url = body.get('url', '')
        action = body.get('action', 'extract')
        
        if not youtube_url:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({"error": "URL is required"})
            }
        
        if 'youtube.com' not in youtube_url and 'youtu.be' not in youtube_url:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({"error": "URL debe ser de YouTube"})
            }
        
        if action == 'extract':
            stream_url, debug_info = extract_youtube_stream(youtube_url)
            
            if stream_url:
                result = {
                    'success': True,
                    'stream_url': stream_url,
                    'debug_info': debug_info,
                    'source': 'AWS Lambda Enhanced'
                }
            else:
                result = {
                    'success': False,
                    'error': 'No se pudo extraer el stream de YouTube. Puede que no esté en vivo.',
                    'debug_info': debug_info,
                    'source': 'AWS Lambda Enhanced'
                }
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps(result)
            }
        
    except Exception as e:
        import traceback
        error_details = {
            "error": str(e),
            "traceback": traceback.format_exc(),
            "source": "AWS Lambda Enhanced"
        }
        
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps(error_details)
        }