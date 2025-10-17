import json
import requests
import subprocess
import re
from urllib.parse import urlparse, parse_qs

def extract_youtube_stream(youtube_url):
    """
    Extrae la URL del stream M3U8 de una URL de YouTube
    Versión optimizada para AWS Lambda con estrategias anti-detección avanzadas
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
            # Para canales, necesitamos encontrar el video ID del stream actual
            debug_info.append("Channel URL detected, will try to find current live video ID")
        
        # Si tenemos video ID, intentar acceso directo
        if video_id and len(video_id) == 11:  # Los video IDs de YouTube tienen 11 caracteres
            direct_result = try_direct_video_access(video_id, debug_info)
            if direct_result:
                return direct_result, debug_info
        
        # ESTRATEGIA 2: Scraping web mejorado (método original mejorado)
        web_result = try_web_scraping_strategy(youtube_url, debug_info)
        if web_result:
            return web_result, debug_info
        
        # ESTRATEGIA 3: Intentar usando endpoint móvil de YouTube
        mobile_result = try_mobile_endpoint_strategy(youtube_url, debug_info)
        if mobile_result:
            return mobile_result, debug_info
        
        debug_info.append("AWS Lambda: All strategies failed - no valid stream found")
        return None, debug_info
        
    except Exception as e:
        debug_info.append(f"AWS Lambda error: {e}")
        return None, debug_info

def try_direct_video_access(video_id, debug_info):
    """
    Estrategia 1: Acceso directo usando el video ID
    """
    try:
        debug_info.append(f"Strategy 1: Direct video access for ID: {video_id}")
        
        # URL directa del endpoint de YouTube para obtener información del video
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

def try_mobile_endpoint_strategy(youtube_url, debug_info):
    """
    Estrategia 3: Usar endpoint móvil que a veces tiene menos restricciones
    """
    try:
        debug_info.append("Strategy 3: Mobile endpoint approach")
        
        # Convertir a URL móvil
        mobile_url = youtube_url.replace('www.youtube.com', 'm.youtube.com')
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br'
        }
        
        response = requests.get(mobile_url, headers=headers, timeout=45)
        if response.status_code == 200:
            content = response.text
            debug_info.append(f"Mobile endpoint success: {len(content)} characters")
            
            # Buscar patrones específicos del sitio móvil
            mobile_patterns = [
                r'"hlsManifestUrl":"([^"]+)"',
                r'"url":"([^"]*\.m3u8[^"]*)"',
                r'hlsManifestUrl.*?([^"]*googlevideo\.com[^"]*\.m3u8[^"]*)'
            ]
            
            for pattern in mobile_patterns:
                matches = re.findall(pattern, content)
                for match in matches:
                    clean_url = match.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')
                    if clean_url.startswith('https://') and 'googlevideo.com' in clean_url and '.m3u8' in clean_url:
                        debug_info.append("Mobile endpoint: Found valid stream URL")
                        return clean_url
            
            debug_info.append("Mobile endpoint: No stream URLs found")
        else:
            debug_info.append(f"Mobile endpoint failed: {response.status_code}")
            
    except Exception as e:
        debug_info.append(f"Mobile strategy error: {e}")
    
    return None

def try_web_scraping_strategy(youtube_url, debug_info):
    """
    Estrategia 2: Web scraping mejorado (método original optimizado)
    """
        
        # Lista de URLs a probar con estrategias más inteligentes
        urls_to_try = []
        
        # Si es una URL de canal, generar múltiples variantes
        if '/@' in youtube_url:
            channel_base = youtube_url.split('/live')[0] if '/live' in youtube_url else youtube_url.rstrip('/')
            
            # Agregar variantes de URLs de canal
            urls_to_try.extend([
                f"{channel_base}/live",
                f"{channel_base}/streams", 
                youtube_url  # URL original también
            ])
        else:
            urls_to_try.append(youtube_url)
        
        # Probar también con www. si no lo tiene
        for url in urls_to_try.copy():
            if 'www.youtube.com' not in url and 'youtube.com' in url:
                urls_to_try.append(url.replace('youtube.com', 'www.youtube.com'))
        
        debug_info.append(f"Will try {len(urls_to_try)} URL variants: {urls_to_try}")
        
        # Probar cada URL con diferentes estrategias
        for i, url_to_try in enumerate(urls_to_try):
            debug_info.append(f"Attempt {i+1}/{len(urls_to_try)}: {url_to_try}")
            
            # Delay entre requests para parecer más humano
            if i > 0:
                import time
                import random
                delay = random.uniform(2.0, 4.0)  # Delay más largo
                debug_info.append(f"Adding random delay: {delay:.1f}s")
                time.sleep(delay)
            
            # Usar diferentes User-Agents para cada intento
            user_agents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
            ]
            
            selected_ua = user_agents[i % len(user_agents)]
            debug_info.append(f"Using User-Agent #{i+1}: {selected_ua[:50]}...")
            
            headers = {
                'User-Agent': selected_ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'no-cache'  # Evitar contenido cacheado
            }
            
            content = ""
            debug_info.append("AWS Lambda strategy: improved detection and multiple attempts")
            
            # Usar requests con timeout generoso (AWS Lambda permite 15 min)
            try:
                debug_info.append("Making requests call with 60s timeout (AWS Lambda)")
                session = requests.Session()
                session.headers.update(headers)
                
                # Request de calentamiento solo en el primer intento
                if i == 0 and url_to_try.endswith('/live'):
                    try:
                        session.get('https://www.youtube.com', timeout=10)
                        debug_info.append("Warmup request completed")
                    except:
                        debug_info.append("Warmup request failed, continuing...")
                
                response = session.get(url_to_try, timeout=60)  # 60s timeout en AWS Lambda
                if response.status_code == 200:
                    content = response.text
                    debug_info.append(f"Requests successful: {len(content)} characters, status: {response.status_code}")
                else:
                    debug_info.append(f"Requests failed with status: {response.status_code}")
                    continue  # Probar siguiente URL
                    
            except requests.exceptions.Timeout:
                debug_info.append("Requests timeout (60s) - trying next URL")
                continue
            except Exception as e:
                debug_info.append(f"Requests error: {e}")
                continue
            
            debug_info.append(f"Final content length: {len(content)} characters")
            
            # Verificar indicadores de live con patrones más amplios
            live_indicators = [
                'isLive":true', 
                '"isLiveContent":true', 
                '"isLiveNow":true',
                'hls_manifest_url', 
                '.m3u8',
                '"liveBroadcastContent":"live"',
                '"broadcastId"',
                '"isLiveContent":true',
                'videoDetails.*isLive',
                'player_response.*isLive'
            ]
            live_found = any(indicator in content for indicator in live_indicators)
            debug_info.append(f"Live indicators found: {live_found}")
            
            # Buscar patrones específicos de streaming
            streaming_patterns = [
                r'"hlsManifestUrl":\s*"([^"]+)"',
                r'"videoPlaybackUberProto".*?"url":\s*"([^"]*\.m3u8[^"]*)"',
                r'hlsManifestUrl.*?([^"]*googlevideo\.com[^"]*\.m3u8[^"]*)',
                r'"streamingData".*?"hlsManifestUrl":\s*"([^"]+)"'
            ]
            
            # Si encontramos indicadores de live, buscar patrones
            for pattern in streaming_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE | re.DOTALL)
                for match in matches:
                    if isinstance(match, tuple):
                        match = match[0] if match else ""
                    
                    # Limpiar y validar URL
                    clean_url = match.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')
                    if clean_url.startswith('https://') and 'googlevideo.com' in clean_url and '.m3u8' in clean_url:
                        debug_info.append(f"Found streaming URL via regex pattern: {pattern}")
                        return clean_url, debug_info
            
            # Buscar .m3u8 URLs manualmente (método existente mejorado)
            if '.m3u8' in content:
                debug_info.append(f"Found .m3u8 in content from {url_to_try}")
                
                m3u8_count = content.count('.m3u8')
                debug_info.append(f"Found {m3u8_count} .m3u8 occurrences")
                
                # Buscar todos los patrones posibles de URLs con .m3u8
                m3u8_patterns = [
                    r'https://[^"\s]+\.m3u8[^"\s]*',  # URLs completas
                    r'"(https://[^"]*googlevideo\.com[^"]*\.m3u8[^"]*)"',  # URLs entrecomilladas
                    r"'(https://[^']*googlevideo\.com[^']*\.m3u8[^']*)'",  # URLs con comillas simples
                ]
                
                for pattern in m3u8_patterns:
                    pattern_matches = re.findall(pattern, content)
                    for match in pattern_matches:
                        # Si es tupla, tomar el primer elemento
                        url_candidate = match[0] if isinstance(match, tuple) else match
                        url_candidate = url_candidate.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')
                        
                        if ('googlevideo.com' in url_candidate and 
                            url_candidate.startswith('https://') and 
                            url_candidate.endswith('.m3u8')):
                            debug_info.append(f"Valid YouTube stream URL found via pattern: {pattern}")
                            return url_candidate, debug_info
                
                # Método original de búsqueda posicional (fallback)
                position = 0
                while True:
                    pos = content.find('.m3u8', position)
                    if pos == -1:
                        break
                    
                    search_start = max(0, pos - 1000)
                    segment = content[search_start:pos + 5]
                    
                    search_pos = 0
                    while True:
                        https_pos = segment.find('https://', search_pos)
                        if https_pos == -1:
                            break
                        
                        url_candidate = segment[https_pos:len(segment)]
                        url_candidate = url_candidate.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')
                        
                        if ('googlevideo.com' in url_candidate and 
                            url_candidate.startswith('https://') and 
                            url_candidate.endswith('.m3u8')):
                            debug_info.append("Valid YouTube stream URL found via positional search")
                            return url_candidate, debug_info
                        
                        search_pos = https_pos + 1
                    
                    position = pos + 1
            
            # Buscar patrones alternativos si tenemos indicadores de live
            if live_found and len(content) > 500000:
                debug_info.append("Searching for alternative patterns with live indicators")
                
                # Buscar hlsManifestUrl específicamente
                hls_pattern = r'"hlsManifestUrl":\s*"([^"]+)"'
                matches = re.findall(hls_pattern, content)
                if matches:
                    hls_url = matches[0].replace('\\u0026', '&').replace('\\/', '/')
                    debug_info.append(f"Found hlsManifestUrl: {hls_url[:100]}...")
                    if hls_url.startswith('https://') and 'googlevideo.com' in hls_url:
                        debug_info.append("Valid HLS manifest found via regex")
                        return hls_url, debug_info
                
                # Buscar en streamingData
                streaming_pattern = r'"streamingData"[^}]+?"hlsManifestUrl":\s*"([^"]+)"'
                streaming_matches = re.findall(streaming_pattern, content, re.DOTALL)
                if streaming_matches:
                    streaming_url = streaming_matches[0].replace('\\u0026', '&').replace('\\/', '/')
                    debug_info.append(f"Found streamingData URL: {streaming_url[:100]}...")
                    if streaming_url.startswith('https://') and 'googlevideo.com' in streaming_url:
                        debug_info.append("Valid streaming URL found in streamingData")
                        return streaming_url, debug_info
            
            # Si el canal parece estar en vivo pero no encontramos URLs, intentar estrategia diferente
            if live_found and '.m3u8' not in content:
                debug_info.append("Live indicators found but no .m3u8 - trying embedded data search")
                
                # Buscar datos embebidos en variables JavaScript
                js_patterns = [
                    r'var ytInitialPlayerResponse\s*=\s*({.+?});',
                    r'window\[\"ytInitialPlayerResponse\"\]\s*=\s*({.+?});',
                    r'ytInitialPlayerResponse[\"\']\s*:\s*({.+?})[\"\'"]',
                ]
                
                for js_pattern in js_patterns:
                    js_matches = re.findall(js_pattern, content, re.DOTALL)
                    for js_match in js_matches:
                        if 'hlsManifestUrl' in js_match:
                            # Extraer URL de los datos JavaScript
                            hls_in_js = re.findall(r'"hlsManifestUrl":\s*"([^"]+)"', js_match)
                            if hls_in_js:
                                js_url = hls_in_js[0].replace('\\u0026', '&').replace('\\/', '/')
                                debug_info.append(f"Found URL in JavaScript data: {js_url[:100]}...")
                                if js_url.startswith('https://') and 'googlevideo.com' in js_url:
                                    debug_info.append("Valid URL found in embedded JavaScript")
                                    return js_url, debug_info
        
        debug_info.append("AWS Lambda: No valid stream found after all attempts")
        return None, debug_info
        
    except Exception as e:
        debug_info.append(f"AWS Lambda error: {e}")
        return None, debug_info

def lambda_handler(event, context):
    """
    AWS Lambda handler function with proper CORS
    """
    
    # CORS headers
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    }
    
    try:
        # Handle preflight OPTIONS request
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': ''
            }
        
        # Parse HTTP event
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
            # Extraer stream
            stream_url, debug_info = extract_youtube_stream(youtube_url)
            
            if stream_url:
                result = {
                    'success': True,
                    'stream_url': stream_url,
                    'debug_info': debug_info,
                    'source': 'AWS Lambda'
                }
            else:
                result = {
                    'success': False,
                    'error': 'No se pudo extraer el stream de YouTube. Puede que no esté en vivo.',
                    'debug_info': debug_info,
                    'source': 'AWS Lambda'
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
            "source": "AWS Lambda"
        }
        
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps(error_details)
        }