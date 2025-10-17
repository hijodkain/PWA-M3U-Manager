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
    """Estrategia 1: Acceso directo usando API interna de YouTube con autenticación"""
    try:
        debug_info.append(f"Strategy 1: Direct video access with auth for ID: {video_id}")
        
        # Intentar primero sin autenticación
        api_url = f"https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
        
        payload = {
            "context": {
                "client": {
                    "clientName": "WEB",
                    "clientVersion": "2.20231201.01.00",
                    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            },
            "videoId": video_id
        }
        
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-YouTube-Client-Name': '1',
            'X-YouTube-Client-Version': '2.20231201.01.00',
            'Origin': 'https://www.youtube.com',
            'Referer': f'https://www.youtube.com/watch?v={video_id}'
        }
        
        response = requests.post(api_url, json=payload, headers=headers, timeout=30)
        if response.status_code == 200:
            data = response.json()
            
            if 'streamingData' in data and 'hlsManifestUrl' in data['streamingData']:
                hls_url = data['streamingData']['hlsManifestUrl']
                debug_info.append(f"Direct API success: Found HLS URL")
                return hls_url
            else:
                debug_info.append("Direct API: No streaming data found (trying with auth)")
                
                # Intentar con headers de autenticación simulada
                auth_headers = headers.copy()
                auth_headers.update({
                    'Cookie': 'CONSENT=PENDING+987; VISITOR_INFO1_LIVE=dQw4w9WgXcQ; PREF=f1=50000000&f6=40000000&hl=en&gl=US',
                    'X-Goog-Visitor-Id': 'CgtWSVNJVE9SX0lORl9MQ1dJU0lUT1I',
                    'X-YouTube-Bootstrap-Logged-In': 'false'
                })
                
                # Payload con más contexto para usuario autenticado
                auth_payload = {
                    "context": {
                        "client": {
                            "clientName": "WEB",
                            "clientVersion": "2.20231201.01.00",
                            "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                            "gl": "US",
                            "hl": "en"
                        },
                        "user": {
                            "lockedSafetyMode": False
                        },
                        "request": {
                            "useSsl": True
                        }
                    },
                    "videoId": video_id,
                    "playbackContext": {
                        "contentPlaybackContext": {
                            "html5Preference": "HTML5_PREF_WANTS"
                        }
                    }
                }
                
                debug_info.append("Retrying API with auth simulation")
                auth_response = requests.post(api_url, json=auth_payload, headers=auth_headers, timeout=30)
                
                if auth_response.status_code == 200:
                    auth_data = auth_response.json()
                    if 'streamingData' in auth_data and 'hlsManifestUrl' in auth_data['streamingData']:
                        hls_url = auth_data['streamingData']['hlsManifestUrl']
                        debug_info.append(f"Direct API with auth success: Found HLS URL")
                        return hls_url
                    else:
                        debug_info.append("Direct API with auth: Still no streaming data")
                else:
                    debug_info.append(f"Direct API with auth failed: {auth_response.status_code}")
        else:
            debug_info.append(f"Direct API failed with status: {response.status_code}")
            
    except Exception as e:
        debug_info.append(f"Direct access error: {e}")
    
    return None

def try_web_scraping_strategy(youtube_url, debug_info):
    """Estrategia 2: Web scraping mejorado con autenticación simulada"""
    try:
        debug_info.append("Strategy 2: Enhanced web scraping with auth simulation")
        
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
        
        # User agents más realistas
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
        
        # Cookies básicas de sesión para simular usuario autenticado
        session_cookies = {
            'CONSENT': 'PENDING+987',
            'VISITOR_INFO1_LIVE': 'dQw4w9WgXcQ',
            'PREF': 'f1=50000000&f6=40000000&hl=en&gl=US',
            'SID': 'g.a000bQiOGf0123456789abcdefghijklmnop',
            'HSID': 'A1bcD2efG3hiJ4',
            'SSID': 'A1bcD2efG3hiJ4',
            'APISID': 'abcdef123456/7890123456789012345',
            'SAPISID': '7890123456789012345/abcdef123456'
        }
        
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
                'Cache-Control': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'X-YouTube-Client-Name': '1',
                'X-YouTube-Client-Version': '2.20231201.01.00'
            }
            
            try:
                session = requests.Session()
                session.headers.update(headers)
                
                # Establecer cookies de sesión
                for name, value in session_cookies.items():
                    session.cookies.set(name, value, domain='.youtube.com')
                
                debug_info.append(f"Using authenticated session with {len(session_cookies)} cookies")
                
                # Hacer request inicial para establecer sesión
                response = session.get('https://www.youtube.com', timeout=15)
                debug_info.append(f"Session warmup: {response.status_code}")
                
                # Hacer request al URL objetivo
                response = session.get(url_to_try, timeout=60)
                if response.status_code != 200:
                    debug_info.append(f"Failed with status: {response.status_code}")
                    continue
                
                content = response.text
                debug_info.append(f"Got {len(content)} characters with auth session")
                
                # Buscar indicadores de live con patrones más amplios
                live_indicators = [
                    'isLive":true', '"isLiveContent":true', '"isLiveNow":true',
                    'hls_manifest_url', '.m3u8', '"liveBroadcastContent":"live"',
                    '"videoDetails".*"isLive":true',
                    '"playabilityStatus".*"LIVE_STREAM"',
                    '"streamingData"', '"hlsManifestUrl"', '"dashManifestUrl"',
                    'videoplayback', 'manifest', '/live/', 'livestream',
                    '"isLiveContent":true', '"isLiveBroadcast":true',
                    'BADGE_STYLE_TYPE_LIVE_NOW', 'live-badge'
                ]
                live_found = any(indicator in content for indicator in live_indicators)
                debug_info.append(f"Live indicators found with auth: {live_found}")
                
                # Si encontramos indicadores, buscar más agresivamente
                if live_found:
                    debug_info.append("Live indicators detected - searching for streams")
                    stream_url = extract_stream_url_from_content(content, debug_info)
                    if stream_url:
                        return stream_url
                
                # Buscar URLs de streaming incluso sin indicadores explícitos
                elif any(fmt in content for fmt in ['.m3u8', 'manifest', 'videoplayback']):
                    debug_info.append("No live indicators but found streaming formats - attempting extraction")
                    stream_url = extract_stream_url_from_content(content, debug_info)
                    if stream_url:
                        return stream_url
                        
            except Exception as e:
                debug_info.append(f"Request error: {e}")
                continue
        
        debug_info.append("Web scraping with auth: No valid stream found")
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
    """Extrae URLs de streaming del contenido HTML/JSON - Busca múltiples formatos"""
    
    # Patrones para buscar URLs de streaming (no solo .m3u8)
    patterns = [
        # HLS manifest URLs
        r'"hlsManifestUrl":\s*"([^"]+)"',
        r'"hlsManifestUrl":"([^"]+)"',
        # Stream URLs directas
        r'"url":"([^"]*\.m3u8[^"]*)"',
        r'"url":"([^"]*manifest[^"]*)"',
        r'"url":"([^"]*stream[^"]*)"',
        # Dash manifest
        r'"dashManifestUrl":\s*"([^"]+)"',
        r'"dashManifestUrl":"([^"]+)"',
        # URLs de video en vivo generales
        r'https://[^"\s]+\.m3u8[^"\s]*',
        r'https://[^"\s]+manifest[^"\s]*',
        r'https://[^"\s]+/videoplayback[^"\s]*',
        # Nuevos patrones específicos de YouTube Live
        r'"streamingData"[^}]*"hlsManifestUrl":\s*"([^"]+)"',
        r'"formats"[^}]*"url":\s*"([^"]*googlevideo[^"]*)"',
        r'"adaptiveFormats"[^}]*"url":\s*"([^"]*googlevideo[^"]*)"'
    ]
    
    if is_mobile:
        patterns.extend([
            r'manifest_url["\']:\s*["\']([^"\']+)["\']',
            r'stream_url["\']:\s*["\']([^"\']+)["\']',
            r'"video_url":\s*"([^"]+)"'
        ])
    
    debug_info.append(f"Searching with {len(patterns)} patterns for streaming URLs")
    
    for i, pattern in enumerate(patterns):
        matches = re.findall(pattern, content, re.IGNORECASE | re.DOTALL)
        debug_info.append(f"Pattern {i+1}: found {len(matches)} matches")
        
        for match in matches:
            if isinstance(match, tuple):
                match = match[0]
            
            clean_url = match.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')
            debug_info.append(f"Checking URL: {clean_url[:150]}...")
            
            # Criterios más amplios para URLs válidas
            if clean_url.startswith('https://'):
                if (('googlevideo.com' in clean_url or 'youtube.com' in clean_url) and 
                    ('.m3u8' in clean_url or 'manifest' in clean_url or 'videoplayback' in clean_url)):
                    debug_info.append(f"Found valid YouTube stream URL via pattern {i+1}")
                    return clean_url
                elif (len(clean_url) > 50 and 
                      any(fmt in clean_url.lower() for fmt in ['m3u8', 'manifest', 'stream', 'video', 'live'])):
                    debug_info.append(f"Found potential non-YouTube stream URL via pattern {i+1}: {clean_url[:200]}")
                    return clean_url
    
    # Búsqueda manual más amplia
    streaming_formats = ['.m3u8', 'manifest', 'videoplayback', '/live/', '/stream/']
    
    for format_type in streaming_formats:
        if format_type in content:
            debug_info.append(f"Found '{format_type}' in content - doing manual search")
            position = 0
            occurrences = 0
            
            while True:
                pos = content.find(format_type, position)
                if pos == -1:
                    break
                
                occurrences += 1
                if occurrences > 50:  # Límite para evitar bucles infinitos
                    break
                
                # Buscar hacia atrás para encontrar el inicio de la URL
                start = pos
                for i in range(pos, max(0, pos - 2000), -1):
                    if content[i:i+8] == 'https://':
                        start = i
                        break
                
                # Buscar hacia adelante para encontrar el final
                end = pos + len(format_type)
                for i in range(end, min(len(content), end + 500)):
                    if content[i] in ['"', "'", ' ', '\n', '\r', '\t']:
                        end = i
                        break
                
                url_candidate = content[start:end]
                url_candidate = url_candidate.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')
                
                debug_info.append(f"Manual check: {url_candidate[:150]}...")
                
                # Criterios más permisivos para debugging
                if url_candidate.startswith('https://'):
                    if ('googlevideo.com' in url_candidate or 'youtube.com' in url_candidate):
                        debug_info.append(f"Found valid URL via manual search for '{format_type}'")
                        return url_candidate
                    elif len(url_candidate) > 50:  # URL significativa
                        debug_info.append(f"Found potential URL (non-YouTube): {url_candidate[:200]}")
                        # Si es una URL larga y parece ser de streaming, intentémosla
                        if any(indicator in url_candidate.lower() for indicator in ['stream', 'video', 'live', 'manifest', 'm3u8']):
                            debug_info.append(f"Accepting non-YouTube streaming URL")
                            return url_candidate
                
                position = pos + 1
            
            debug_info.append(f"Manual search for '{format_type}': checked {occurrences} occurrences")
    
    debug_info.append("No valid streaming URLs found in content")
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