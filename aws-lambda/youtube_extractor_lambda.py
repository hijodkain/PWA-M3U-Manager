import json
import requests
import subprocess
import re
from urllib.parse import urlparse, parse_qs

def extract_youtube_stream(youtube_url):
    """
    Extrae la URL del stream M3U8 de una URL de YouTube
    Versión optimizada para AWS Lambda con CORS
    """
    debug_info = []
    try:
        debug_info.append(f"AWS Lambda - Processing URL: {youtube_url}")
        
        # Lista de URLs a probar
        urls_to_try = []
        
        # Si es una URL de canal, agregar /live automáticamente
        if '/@' in youtube_url and '/live' not in youtube_url:
            live_url = youtube_url.rstrip('/') + '/live'
            urls_to_try.append(live_url)
            debug_info.append(f"Canal detectado, probando URL de live: {live_url}")
        
        # Siempre incluir la URL original
        urls_to_try.append(youtube_url)
        
        # Probar cada URL con timeouts generosos para AWS Lambda
        for i, url_to_try in enumerate(urls_to_try):
            debug_info.append(f"Trying URL: {url_to_try}")
            
            # Delay entre requests
            if i > 0:
                import time
                import random
                delay = random.uniform(1.0, 3.0)
                debug_info.append(f"Adding random delay: {delay:.1f}s")
                time.sleep(delay)
            
            content = ""
            debug_info.append("AWS Lambda strategy: longer timeouts and better resources")
            
            # Usar requests con timeout generoso (AWS Lambda permite 15 min)
            try:
                import random
                
                user_agents = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0'
                ]
                
                selected_ua = random.choice(user_agents)
                debug_info.append(f"Using User-Agent: {selected_ua[:50]}...")
                
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
                    'Cache-Control': 'max-age=0'
                }
                
                debug_info.append("Making requests call with 60s timeout (AWS Lambda)")
                session = requests.Session()
                session.headers.update(headers)
                
                # Request de calentamiento
                if url_to_try.endswith('/live'):
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
                    
            except requests.exceptions.Timeout:
                debug_info.append("Requests timeout (60s) - trying curl fallback")
            except Exception as e:
                debug_info.append(f"Requests error: {e}")
            
            debug_info.append(f"Final content length: {len(content)} characters")
            
            # Verificar indicadores de live
            live_indicators = ['isLive":true', '"isLiveContent":true', 'hls_manifest_url', '.m3u8']
            live_found = any(indicator in content for indicator in live_indicators)
            debug_info.append(f"Live indicators found: {live_found}")
            
            # Buscar .m3u8 URLs
            if '.m3u8' in content:
                debug_info.append(f"Found .m3u8 in content from {url_to_try}")
                
                m3u8_count = content.count('.m3u8')
                debug_info.append(f"Found {m3u8_count} .m3u8 occurrences")
                
                # Algoritmo de extracción (mismo que local)
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
                            debug_info.append("Valid YouTube stream URL found in AWS Lambda")
                            return url_candidate, debug_info
                        
                        search_pos = https_pos + 1
                    
                    position = pos + 1
            
            # Buscar patrones alternativos
            if live_found and len(content) > 500000:
                hls_pattern = r'"hlsManifestUrl":\s*"([^"]+)"'
                matches = re.findall(hls_pattern, content)
                if matches:
                    hls_url = matches[0].replace('\\u0026', '&').replace('\\/', '/')
                    debug_info.append(f"Found hlsManifestUrl: {hls_url[:100]}...")
                    if hls_url.startswith('https://') and 'googlevideo.com' in hls_url:
                        debug_info.append("Valid HLS manifest found via regex")
                        return hls_url, debug_info
        
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