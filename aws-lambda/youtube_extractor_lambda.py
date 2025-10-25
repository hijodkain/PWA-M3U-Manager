import json
import requests
import os

def extract_youtube_stream(youtube_url):
    """
    Extrae la URL del stream M3U8 de una URL de YouTube
    Método simplificado basado en YouTube_To_m3u que SÍ funciona
    """
    debug_info = []
    try:
        debug_info.append(f"Simple YouTube extractor - Processing: {youtube_url}")
        
        # Método simple y directo como YouTube_To_m3u
        stream_url = grab_stream_url(youtube_url, debug_info)
        
        if stream_url:
            debug_info.append(f"SUCCESS: Found stream URL")
            return stream_url, debug_info
        else:
            debug_info.append("No stream URL found - returning placeholder")
            return None, debug_info
        
    except Exception as e:
        debug_info.append(f"Error in extraction: {e}")
        return None, debug_info

def grab_stream_url(url, debug_info):
    """
    Método basado en youtube_non_stream_link.py del proyecto purplescorpion1/youtube-to-m3u
    Extrae URLs HLS m3u8 directamente del HTML de YouTube
    """
    try:
        debug_info.append(f"Using direct HLS extraction method for: {url}")
        
        # Intentar método directo como youtube_non_stream_link.py
        try:
            import re
            
            # Headers similares a un navegador real
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate',
                'Referer': 'https://www.youtube.com/',
                'Origin': 'https://www.youtube.com',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Cache-Control': 'max-age=0',
            }
            
            debug_info.append("Making request to YouTube with browser headers")
            response = requests.get(url, headers=headers, timeout=20)
            
            if response.status_code != 200:
                debug_info.append(f"Failed to access YouTube URL. HTTP Status: {response.status_code}")
                return None
            
            debug_info.append(f"Response received. Content length: {len(response.text)}")
            
            # Método de youtube_non_stream_link.py: buscar URLs .m3u8 directamente
            hls_patterns = [
                r'https?://[^\s"\']+\.m3u8[^\s"\']*',
                r'https?://manifest\.googlevideo\.com[^\s"\']+',
                r'"(https://manifest\.googlevideo\.com[^"]+\.m3u8[^"]*)"',
                r"'(https://manifest\.googlevideo\.com[^']+\.m3u8[^']*)'",
                r'hlsManifestUrl["\']:\s*["\']([^"\']+)["\']',
                r'"hlsManifestUrl":"([^"]+)"'
            ]
            
            debug_info.append(f"Searching with {len(hls_patterns)} HLS patterns")
            
            for i, pattern in enumerate(hls_patterns, 1):
                matches = re.findall(pattern, response.text, re.IGNORECASE)
                debug_info.append(f"HLS Pattern {i}: found {len(matches)} matches")
                
                for match in matches:
                    # Si es una tupla (por grupos en regex), tomar el primer elemento
                    if isinstance(match, tuple):
                        hls_url = match[0]
                    else:
                        hls_url = match
                    
                    # Limpiar la URL
                    hls_url = hls_url.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')
                    hls_url = hls_url.strip().strip('"\'')
                    
                    debug_info.append(f"Found candidate HLS URL: {hls_url[:150]}...")
                    
                    # Verificar que es una URL válida de HLS
                    if (hls_url.startswith('https://') and 
                        ('m3u8' in hls_url or 'manifest' in hls_url) and
                        ('googlevideo.com' in hls_url or 'youtube.com' in hls_url)):
                        
                        debug_info.append(f"SUCCESS: Found valid HLS URL via direct extraction")
                        return hls_url
            
            debug_info.append("Direct HLS extraction failed, no valid URLs found")
                
        except Exception as e:
            debug_info.append(f"Direct HLS extraction error: {e}")
        
        # Fallback método 2: API interna de YouTube
        debug_info.append("yt-dlp failed, trying YouTube internal API method")
        
        # Extraer video ID de la URL
        import re
        video_id = None
        patterns = [
            r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
            r'youtu\.be\/([0-9A-Za-z_-]{11})',
            r'embed\/([0-9A-Za-z_-]{11})'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                video_id = match.group(1)
                break
        
        if not video_id:
            debug_info.append("Could not extract video ID from URL")
            return None
        
        debug_info.append(f"Extracted video ID: {video_id}")
        
        api_url = "https://www.youtube.com/youtubei/v1/player"
        
        # Headers de app móvil de YouTube
        mobile_headers = {
            'User-Agent': 'com.google.android.youtube/19.09.36 (Linux; U; Android 11) gzip',
            'Content-Type': 'application/json',
            'X-YouTube-Client-Name': '3',
            'X-YouTube-Client-Version': '19.09.36',
        }
        
        # Payload de API interna
        api_payload = {
            "context": {
                "client": {
                    "clientName": "ANDROID",
                    "clientVersion": "19.09.36",
                    "androidSdkVersion": 30,
                    "userAgent": "com.google.android.youtube/19.09.36 (Linux; U; Android 11) gzip",
                    "hl": "en",
                    "timeZone": "UTC",
                    "utcOffsetMinutes": 0
                }
            },
            "videoId": video_id,
            "playbackContext": {
                "contentPlaybackContext": {
                    "html5Preference": "HTML5_PREF_WANTS"
                }
            },
            "contentCheckOk": True,
            "racyCheckOk": True
        }
        
        try:
            api_response = requests.post(api_url, json=api_payload, headers=mobile_headers, timeout=15)
            debug_info.append(f"API response status: {api_response.status_code}")
            
            if api_response.status_code == 200:
                api_data = api_response.json()
                debug_info.append("Successfully got API response")
                
                # Buscar streamingData en la respuesta de API
                if 'streamingData' in api_data:
                    streaming_data = api_data['streamingData']
                    debug_info.append("Found streamingData in API response")
                    
                    # Buscar hlsManifestUrl
                    if 'hlsManifestUrl' in streaming_data:
                        hls_url = streaming_data['hlsManifestUrl']
                        debug_info.append(f"Found HLS manifest from API: {hls_url[:100]}...")
                        return hls_url
                    
                    # Buscar adaptiveFormats
                    if 'adaptiveFormats' in streaming_data:
                        formats = streaming_data['adaptiveFormats']
                        debug_info.append(f"Found {len(formats)} adaptive formats from API")
                        
                        for fmt in formats:
                            if 'url' in fmt and 'googlevideo.com' in fmt['url']:
                                debug_info.append(f"Found googlevideo URL from API: {fmt['url'][:100]}...")
                                return fmt['url']
                
                if 'playabilityStatus' in api_data:
                    status = api_data['playabilityStatus']
                    debug_info.append(f"API playability status: {status.get('status')}, reason: {status.get('reason', 'N/A')}")
            
        except Exception as e:
            debug_info.append(f"API method failed: {e}")
        
        # Fallback final: método web scraping
        debug_info.append("All methods failed, trying basic web scraping")
        
        # Headers básicos
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive',
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        response_text = response.text
        
        debug_info.append(f"Web response status: {response.status_code}, Content length: {len(response_text)}")
        
        # Buscar patterns de googlevideo.com básicos
        googlevideo_patterns = [
            'manifest.googlevideo.com',
            'googlevideo.com',
            'manifest.googlevideo',
            'hls_variant',
            'hls_playlist'
        ]
        
        found_googlevideo = False
        for pattern in googlevideo_patterns:
            if pattern in response_text:
                debug_info.append(f"Found pattern '{pattern}' in response")
                found_googlevideo = True
                break
        
        if not found_googlevideo:
            debug_info.append("No googlevideo patterns found in web scraping")
            return None
        
        # Buscar URLs completas de manifest.googlevideo.com
        import re
        
        # Patterns más específicos para URLs de streaming de YouTube
        url_patterns = [
            r'https://manifest\.googlevideo\.com/api/manifest/hls_variant[^"\s]+',
            r'https://manifest\.googlevideo\.com[^"\s]+\.m3u8[^"\s]*',
            r'https://[^"\s]*googlevideo\.com[^"\s]*manifest[^"\s]*',
            r'https://[^"\s]*googlevideo\.com[^"\s]*\.m3u8[^"\s]*',
            r'"(https://manifest\.googlevideo\.com[^"]+)"',
            r"'(https://manifest\.googlevideo\.com[^']+)'"
        ]
        
        debug_info.append(f"Searching with {len(url_patterns)} URL patterns")
        
        for i, pattern in enumerate(url_patterns):
            matches = re.findall(pattern, response_text, re.IGNORECASE)
            debug_info.append(f"Pattern {i+1}: found {len(matches)} matches")
            
            for match in matches:
                # Si es una tupla (por grupos en regex), tomar el primer elemento
                if isinstance(match, tuple):
                    stream_url = match[0]
                else:
                    stream_url = match
                
                # Limpiar la URL de caracteres de escape
                stream_url = stream_url.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')
                
                debug_info.append(f"Found candidate URL: {stream_url[:100]}...")
                
                # Verificar que es una URL válida de YouTube streaming
                if (stream_url.startswith('https://') and 
                    'googlevideo.com' in stream_url and 
                    ('manifest' in stream_url or '.m3u8' in stream_url)):
                    
                    debug_info.append(f"SUCCESS: Found valid YouTube stream URL")
                    return stream_url
        
        # Si no encontramos con regex, buscar manualmente como YouTube_To_m3u
        debug_info.append("Regex search failed, trying manual search")
        
        # Buscar fragmentos y reconstruir URLs
        search_terms = [
            'manifest.googlevideo.com',
            'googlevideo.com/api/manifest',
            'googlevideo.com',
            'manifest/hls_variant',
            'hls_variant',
            '/api/manifest/'
        ]
        
        all_fragments = []
        
        for term in search_terms:
            pos = 0
            while True:
                pos = response_text.find(term, pos)
                if pos == -1:
                    break
                
                debug_info.append(f"Found '{term}' at position {pos}")
                
                # Extraer un fragmento más grande alrededor del término
                start_search = max(0, pos - 200)
                end_search = min(len(response_text), pos + 1500)
                fragment = response_text[start_search:end_search]
                
                # Limpiar caracteres de escape
                clean_fragment = fragment.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&').replace('\\"', '"')
                
                all_fragments.append(clean_fragment)
                pos += 1
        
        debug_info.append(f"Collected {len(all_fragments)} fragments for analysis")
        
        # Para debugging, mostrar algunos fragmentos
        if all_fragments:
            debug_info.append(f"Sample fragment 1: {repr(all_fragments[0][:150])}")
            if len(all_fragments) > 5:
                debug_info.append(f"Sample fragment 6: {repr(all_fragments[5][:150])}")
        
        # Estrategia mejorada: Buscar configuraciones JSON de YouTube
        debug_info.append("Searching for YouTube JSON configurations")
        
        # Buscar específicamente ytInitialPlayerResponse
        import json
        
        # Patrón más robusto para ytInitialPlayerResponse
        player_response_patterns = [
            r'var\s+ytInitialPlayerResponse\s*=\s*({.+?});',
            r'ytInitialPlayerResponse\s*=\s*({.+?});',
            r'window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});'
        ]
        
        for pattern in player_response_patterns:
            matches = re.findall(pattern, response_text, re.DOTALL)
            debug_info.append(f"Player response pattern found {len(matches)} matches")
            
            for match in matches:
                try:
                    debug_info.append(f"Trying to parse player response JSON (length: {len(match)})")
                    
                    # Intentar parsear el JSON
                    player_data = json.loads(match)
                    debug_info.append("Successfully parsed ytInitialPlayerResponse JSON")
                    
                    # Mostrar las claves principales para debugging
                    main_keys = list(player_data.keys())[:10]  # Limitar a 10 para evitar overflow
                    debug_info.append(f"Main keys in player response: {main_keys}")
                    
                    # Buscar streamingData
                    if 'streamingData' in player_data:
                        streaming_data = player_data['streamingData']
                        debug_info.append("Found streamingData in player response")
                        
                        # Buscar hlsManifestUrl
                        if 'hlsManifestUrl' in streaming_data:
                            hls_url = streaming_data['hlsManifestUrl']
                            debug_info.append(f"Found hlsManifestUrl: {hls_url[:100]}...")
                            if 'googlevideo.com' in hls_url:
                                return hls_url
                        
                        # Buscar adaptiveFormats
                        if 'adaptiveFormats' in streaming_data:
                            formats = streaming_data['adaptiveFormats']
                            debug_info.append(f"Found {len(formats)} adaptive formats")
                            
                            for fmt in formats:
                                if 'url' in fmt and 'googlevideo.com' in fmt['url']:
                                    debug_info.append(f"Found googlevideo URL in format: {fmt['url'][:100]}...")
                                    return fmt['url']
                        
                        # Buscar formats regulares
                        if 'formats' in streaming_data:
                            formats = streaming_data['formats']
                            debug_info.append(f"Found {len(formats)} regular formats")
                            
                            for fmt in formats:
                                if 'url' in fmt and 'googlevideo.com' in fmt['url']:
                                    debug_info.append(f"Found googlevideo URL in regular format: {fmt['url'][:100]}...")
                                    return fmt['url']
                    
                    debug_info.append("No streaming URLs found in ytInitialPlayerResponse")
                    
                    # También verificar si hay videoDetails o playabilityStatus que puedan indicar por qué no hay streams
                    if 'videoDetails' in player_data:
                        video_details = player_data['videoDetails']
                        debug_info.append(f"Video details available: videoId={video_details.get('videoId', 'N/A')}, isLiveContent={video_details.get('isLiveContent', 'N/A')}")
                    
                    if 'playabilityStatus' in player_data:
                        playability = player_data['playabilityStatus']
                        debug_info.append(f"Playability status: {playability.get('status', 'N/A')}, reason={playability.get('reason', 'N/A')}")
                    
                except json.JSONDecodeError as e:
                    debug_info.append(f"JSON decode error: {e}")
                    
                    # Intentar encontrar JSON válido dentro del match
                    try:
                        # Buscar el primer { y el último } que coincida
                        start = match.find('{')
                        if start != -1:
                            brace_count = 0
                            end = start
                            for i in range(start, len(match)):
                                if match[i] == '{':
                                    brace_count += 1
                                elif match[i] == '}':
                                    brace_count -= 1
                                    if brace_count == 0:
                                        end = i + 1
                                        break
                            
                            clean_json = match[start:end]
                            player_data = json.loads(clean_json)
                            debug_info.append("Successfully parsed cleaned JSON")
                            
                            # Repetir búsqueda con JSON limpio
                            if 'streamingData' in player_data:
                                streaming_data = player_data['streamingData']
                                if 'hlsManifestUrl' in streaming_data:
                                    hls_url = streaming_data['hlsManifestUrl']
                                    if 'googlevideo.com' in hls_url:
                                        return hls_url
                    
                    except Exception as e2:
                        debug_info.append(f"Cleanup attempt failed: {e2}")
                        continue
                
                except Exception as e:
                    debug_info.append(f"General JSON parsing error: {e}")
                    continue
                    
        # Fallback: Analizar fragmentos para reconstruir URLs
        debug_info.append("JSON search failed, analyzing fragments manually")
        
        for i, fragment in enumerate(all_fragments):
            debug_info.append(f"Analyzing fragment {i+1}")
            
            # Solo procesar los primeros 5 fragmentos para evitar timeout
            if i >= 5:
                debug_info.append("Limiting fragment analysis to first 5 for performance")
                break
            
            # Buscar patrones de URL dentro del fragmento
            url_starts = []
            for j in range(len(fragment) - 8):
                if fragment[j:j+8] == 'https://':
                    url_starts.append(j)
            
            for start_pos in url_starts:
                # Buscar el final de la URL
                end_pos = start_pos + 8
                for k in range(start_pos + 8, len(fragment)):
                    if fragment[k] in ['"', "'", ' ', '\n', '\r', '\t', ')', '}', ']']:
                        end_pos = k
                        break
                    elif k == len(fragment) - 1:
                        end_pos = len(fragment)
                
                candidate_url = fragment[start_pos:end_pos]
                
                if (len(candidate_url) > 50 and 
                    'googlevideo.com' in candidate_url and
                    ('manifest' in candidate_url or 'hls' in candidate_url)):
                    
                    debug_info.append(f"Fragment analysis found candidate: {candidate_url[:100]}...")
                    
                    # Validar que la URL sea accesible
                    if candidate_url.startswith('https://manifest.googlevideo.com'):
                        debug_info.append(f"SUCCESS: Fragment analysis found valid manifest URL")
                        return candidate_url
        
        # Último intento: buscar texto codificado/ofuscado
        debug_info.append("Trying to decode obfuscated content")
        
        # Buscar patrones típicos de URLs ofuscadas de YouTube
        encoded_patterns = [
            r'manifest\.googlevideo\.com[^"\\]*',
            r'googlevideo\.com[^"\\]*manifest[^"\\]*',
            r'[a-zA-Z0-9+/=]{50,}',  # Base64-like strings
        ]
        
        for pattern in encoded_patterns:
            matches = re.findall(pattern, response_text)
            for match in matches:
                if 'googlevideo' in match:
                    decoded = match.replace('\\u002F', '/').replace('\\/', '/')
                    if decoded.startswith('manifest.googlevideo'):
                        full_url = f"https://{decoded}"
                        debug_info.append(f"Decoded obfuscated URL: {full_url[:100]}...")
                        return full_url
        
        debug_info.append("No valid googlevideo.com URLs found")
        return None
        
    except Exception as e:
        debug_info.append(f"Error in grab_stream_url: {e}")
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
                    'source': 'AWS Lambda Simple (YouTube_To_m3u method)'
                }
            else:
                result = {
                    'success': False,
                    'error': 'No se pudo extraer el stream de YouTube usando método simple.',
                    'debug_info': debug_info,
                    'source': 'AWS Lambda Simple (YouTube_To_m3u method)'
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
            "source": "AWS Lambda Simple (YouTube_To_m3u method)"
        }
        
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps(error_details)
        }