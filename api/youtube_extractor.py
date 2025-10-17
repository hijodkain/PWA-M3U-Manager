from http.server import BaseHTTPRequestHandler
import json
import requests
import subprocess
import re
from urllib.parse import urlparse, parse_qs

def extract_youtube_stream(youtube_url):
    """
    Extrae la URL del stream M3U8 de una URL de YouTube
    Implementación basada en benmoose39/Youtube_to_m3u con mejoras para canales
    """
    debug_info = []
    try:
        debug_info.append(f"Processing URL: {youtube_url}")
        print(f"DEBUG: Processing URL: {youtube_url}")
        
        # Lista de URLs a probar
        urls_to_try = []
        
        # Si es una URL de canal, agregar /live automáticamente
        if '/@' in youtube_url and '/live' not in youtube_url:
            live_url = youtube_url.rstrip('/') + '/live'
            urls_to_try.append(live_url)
            debug_info.append(f"Canal detectado, probando URL de live: {live_url}")
        
        # Siempre incluir la URL original
        urls_to_try.append(youtube_url)
        
        # Probar cada URL
        for i, url_to_try in enumerate(urls_to_try):
            debug_info.append(f"Trying URL: {url_to_try}")
            
            # Delay aleatorio entre requests para evitar detección de bot
            if i > 0:  # Solo después del primer intento
                import time
                import random
                delay = random.uniform(1.0, 3.0)  # Entre 1 y 3 segundos
                debug_info.append(f"Adding random delay: {delay:.1f}s to avoid bot detection")
                time.sleep(delay)
            
            # Estrategia optimizada para Vercel: requests primero con timeout conservador
            content = ""
            debug_info.append("Optimized strategy for Vercel: requests first with short timeout")
            print("🌐 Estrategia optimizada para Vercel...")
            
            # Primer intento: requests con headers variables para evitar detección de bot
            try:
                import random
                
                # Rotar User Agents para evitar detección
                user_agents = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0'
                ]
                
                selected_ua = random.choice(user_agents)
                debug_info.append(f"Using randomized User-Agent: {selected_ua[:50]}...")
                
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
                debug_info.append("Making requests call with 8s timeout for Vercel compatibility")
                
                # Usar sesión para mantener cookies como un navegador real
                session = requests.Session()
                session.headers.update(headers)
                
                # Opcional: hacer una request "calentamiento" a youtube.com primero
                if url_to_try.endswith('/live'):
                    try:
                        session.get('https://www.youtube.com', timeout=3)
                        debug_info.append("Warmup request to youtube.com completed")
                    except:
                        debug_info.append("Warmup request failed, continuing...")
                
                response = session.get(url_to_try, timeout=8)  # Timeout corto para Vercel
                if response.status_code == 200:
                    content = response.text
                    debug_info.append(f"Requests successful: {len(content)} characters, status: {response.status_code}")
                    print(f"✅ Requests exitoso: {len(content)} caracteres")
                else:
                    debug_info.append(f"Requests failed with status: {response.status_code}")
                    print(f"❌ Requests falló con status: {response.status_code}")
            except requests.exceptions.Timeout:
                debug_info.append("Requests timeout (8s) - expected in Vercel, trying curl if available")
                print("⏰ Requests timeout - probando curl si está disponible")
            except Exception as e:
                debug_info.append(f"Requests error: {e}")
                print(f"❌ Error requests: {e}")
            
            # Si requests no obtuvo suficiente contenido, intentar curl con timeout muy corto
            if not content or len(content) < 50000:  # Umbral más bajo
                debug_info.append("Content insufficient, trying curl with minimal timeout")
                print("🔄 Contenido insuficiente, probando curl...")
                try:
                    # Curl con timeout muy corto para Vercel
                    curl_command = [
                        'curl', '-s', '-L', '--max-time', '7',  # Muy corto para Vercel
                        '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        url_to_try
                    ]
                    result = subprocess.run(curl_command, capture_output=True, text=True, timeout=8)
                    if result.returncode == 0 and len(result.stdout) > len(content):
                        content = result.stdout
                        debug_info.append(f"Curl successful: {len(content)} characters (better than requests)")
                        print(f"✅ Curl mejor resultado: {len(content)} caracteres")
                    elif result.returncode == 0:
                        debug_info.append(f"Curl successful but shorter: {len(result.stdout)} chars vs {len(content)}")
                    else:
                        debug_info.append(f"Curl failed with return code: {result.returncode}")
                except subprocess.TimeoutExpired:
                    debug_info.append("Curl timeout - Vercel limitation confirmed")
                    print("⏰ Curl timeout - limitación de Vercel confirmada")
                except FileNotFoundError:
                    debug_info.append("Curl not available in Vercel environment")
                    print("❌ Curl no disponible en Vercel")
                except Exception as e:
                    debug_info.append(f"Curl error: {e}")
                    print(f"❌ Error curl: {e}")
            
            debug_info.append(f"Final content length: {len(content)} characters")
            
            # Verificar si está en vivo buscando indicadores
            live_indicators = ['isLive":true', '"isLiveContent":true', 'hls_manifest_url', '.m3u8']
            live_found = any(indicator in content for indicator in live_indicators)
            debug_info.append(f"Live indicators found: {live_found}")
            
            # Si no hay suficiente contenido, es probable que sea limitación de Vercel
            if len(content) < 100000:
                debug_info.append(f"WARNING: Content too short ({len(content)} chars) - likely Vercel timeout limitation")
                print(f"⚠️ Contenido muy corto - probable limitación de Vercel")
            
            # Si encontramos .m3u8, procesar esta respuesta
            if '.m3u8' in content:
                debug_info.append(f"Found .m3u8 in content from {url_to_try}")
                
                # Buscar la URL .m3u8 con algoritmo mejorado
                m3u8_count = content.count('.m3u8')
                debug_info.append(f"Found {m3u8_count} .m3u8 occurrences in content")
                
                position = 0
                while True:
                    pos = content.find('.m3u8', position)
                    if pos == -1:
                        break
                    
                    debug_info.append(f"Found .m3u8 at position {pos}")
                    print(f"DEBUG: Found .m3u8 at position {pos}")
                    
                    # Buscar https:// en un rango amplio antes del .m3u8 (hasta 1000 caracteres)
                    search_start = max(0, pos - 1000)
                    segment = content[search_start:pos + 5]
                    
                    # Buscar todas las ocurrencias de https:// en el segmento
                    search_pos = 0
                    while True:
                        https_pos = segment.find('https://', search_pos)
                        if https_pos == -1:
                            break
                        
                        # Extraer URL candidata desde https:// hasta .m3u8
                        url_candidate = segment[https_pos:len(segment)]
                        
                        # Limpiar caracteres problemáticos comunes en URLs de YouTube
                        url_candidate = url_candidate.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')
                        
                        debug_info.append(f"Checking candidate: {url_candidate[:100]}...")
                        print(f"DEBUG: Checking candidate: {url_candidate[:100]}...")
                        
                        # Verificar si es una URL válida de stream de YouTube
                        if ('googlevideo.com' in url_candidate and 
                            url_candidate.startswith('https://') and 
                            url_candidate.endswith('.m3u8')):
                            debug_info.append("Valid YouTube stream URL found")
                            print(f"DEBUG: Valid YouTube stream URL found")
                            return url_candidate, debug_info
                        
                        search_pos = https_pos + 1
                    
                    position = pos + 1
            else:
                debug_info.append(f"No .m3u8 found in content from {url_to_try}")
                
                # Analizar por qué no se encuentra .m3u8 cuando live indicators = True
                if live_found and len(content) > 500000:  # Contenido completo pero sin .m3u8
                    debug_info.append("ANALYSIS: Live indicators found but no .m3u8 - YouTube may be serving different content to Vercel")
                    
                    # Buscar patrones alternativos que podrían indicar streaming
                    alt_patterns = ['videoDetails', 'streamingData', 'adaptiveFormats', 'hlsManifestUrl']
                    found_patterns = [pattern for pattern in alt_patterns if pattern in content]
                    debug_info.append(f"Alternative streaming patterns found: {found_patterns}")
                    
                    # Buscar específicamente hlsManifestUrl
                    if 'hlsManifestUrl' in content:
                        debug_info.append("Found hlsManifestUrl in content - extracting...")
                        # Intentar extraer la URL del manifest HLS
                        hls_start = content.find('hlsManifestUrl')
                        if hls_start != -1:
                            # Buscar la URL en un segmento alrededor
                            segment_start = max(0, hls_start - 50)
                            segment_end = min(len(content), hls_start + 500)
                            hls_segment = content[segment_start:segment_end]
                            debug_info.append(f"HLS segment: {hls_segment[:200]}...")
                
                # Si no encontramos .m3u8 pero el contenido es muy corto, es probable que sea timeout de Vercel
                elif len(content) < 100000:
                    debug_info.append("DIAGNOSIS: Short content + no .m3u8 suggests Vercel timeout before page fully loaded")
                    print("🔍 DIAGNÓSTICO: Contenido corto + sin .m3u8 = probable timeout de Vercel")
        
        # Antes de darse por vencido, intentar buscar hlsManifestUrl como último recurso
        debug_info.append("Last resort: searching for hlsManifestUrl patterns")
        for url_to_try in urls_to_try:
            if url_to_try.endswith('/live'):  # Solo buscar en la URL de live
                debug_info.append(f"Searching hlsManifestUrl in content from {url_to_try}")
                
                # Buscar hlsManifestUrl directamente
                hls_pattern = r'"hlsManifestUrl":\s*"([^"]+)"'
                import re
                matches = re.findall(hls_pattern, content)
                if matches:
                    hls_url = matches[0].replace('\\u0026', '&').replace('\\/', '/')
                    debug_info.append(f"Found hlsManifestUrl: {hls_url[:100]}...")
                    if hls_url.startswith('https://') and ('googlevideo.com' in hls_url or 'youtube.com' in hls_url):
                        debug_info.append("Valid HLS manifest URL found via hlsManifestUrl pattern")
                        return hls_url, debug_info
                
                # Buscar otros patrones de streaming data
                streaming_patterns = [
                    r'"url":\s*"([^"]*\.m3u8[^"]*)"',
                    r'"manifestUrl":\s*"([^"]+)"',
                    r'https://[^"\\s]*\.m3u8[^"\\s]*'
                ]
                
                for pattern in streaming_patterns:
                    matches = re.findall(pattern, content)
                    for match in matches:
                        if isinstance(match, str):
                            clean_url = match.replace('\\u0026', '&').replace('\\/', '/')
                            if 'googlevideo.com' in clean_url and clean_url.startswith('https://'):
                                debug_info.append(f"Found streaming URL via regex pattern: {clean_url[:100]}...")
                                return clean_url, debug_info
                
                break  # Solo procesar la primera URL de live
        
        # Si llegamos aquí sin éxito, dar diagnóstico final
        if len(content) < 100000:
            debug_info.append("FINAL DIAGNOSIS: Content too short - Vercel likely timing out before YouTube page loads completely")
            debug_info.append("SOLUTION: Channel may be live but Vercel free tier cannot wait long enough for full page load")
        else:
            debug_info.append("FINAL DIAGNOSIS: Page loaded completely but no valid stream found")
            debug_info.append("POSSIBLE CAUSE: YouTube serving different content to Vercel (bot detection)")
            debug_info.append("ALTERNATIVE: Channel may not be live or using non-HLS streaming format")
        
        debug_info.append("No valid stream URL found after checking all URLs and patterns")
        return None, debug_info
        
    except Exception as e:
        debug_info.append(f"Error extracting YouTube stream: {e}")
        print(f"DEBUG: Error extracting YouTube stream: {e}")
        return None, debug_info

def get_youtube_channel_info(youtube_url):
    """
    Extrae información básica del canal de YouTube
    """
    try:
        response = requests.get(youtube_url, timeout=10)
        response.raise_for_status()
        
        content = response.text
        
        # Extraer título del canal/video
        title_match = re.search(r'<title>([^<]+)</title>', content)
        title = title_match.group(1) if title_match else "Canal de YouTube"
        title = title.replace(' - YouTube', '').strip()
        
        # Extraer thumbnail
        thumbnail_match = re.search(r'"thumbnail":\s*{\s*"thumbnails":\s*\[\s*{\s*"url":\s*"([^"]+)"', content)
        thumbnail = thumbnail_match.group(1) if thumbnail_match else ""
        
        return {
            'title': title,
            'thumbnail': thumbnail,
            'original_url': youtube_url
        }
        
    except Exception as e:
        print(f"Error getting YouTube channel info: {e}")
        return {
            'title': "Canal de YouTube",
            'thumbnail': "",
            'original_url': youtube_url
        }

def get_youtube_channel_info(youtube_url):
    """
    Extrae información básica del canal de YouTube
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(youtube_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        content = response.text
        
        # Extraer título del canal/video
        title_match = re.search(r'<title>([^<]+)</title>', content)
        title = title_match.group(1) if title_match else "Canal de YouTube"
        title = title.replace(' - YouTube', '').strip()
        
        # Extraer thumbnail
        thumbnail_match = re.search(r'"thumbnail":\s*{\s*"thumbnails":\s*\[\s*{\s*"url":\s*"([^"]+)"', content)
        thumbnail = thumbnail_match.group(1) if thumbnail_match else ""
        
        return {
            'title': title,
            'thumbnail': thumbnail,
            'original_url': youtube_url
        }
        
    except Exception as e:
        print(f"Error getting YouTube channel info: {e}")
        return {
            'title': "Canal de YouTube",
            'thumbnail': "",
            'original_url': youtube_url
        }

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            print("🚀 API YouTube Extractor: Petición POST recibida")
            
            # Leer el body de la request
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            youtube_url = data.get('url', '')
            action = data.get('action', 'extract')  # 'extract' o 'info'
            
            print(f"📝 Parámetros recibidos: url={youtube_url}, action={action}")
            
            if not youtube_url:
                print("❌ Error: URL no proporcionada")
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "URL is required"}).encode())
                return
            
            # Validar que sea una URL de YouTube
            if 'youtube.com' not in youtube_url and 'youtu.be' not in youtube_url:
                print("❌ Error: URL no es de YouTube")
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "URL debe ser de YouTube"}).encode())
                return
            
            if action == 'extract':
                print("🔍 Iniciando extracción de stream...")
                # Extraer stream URL
                stream_url, debug_info = extract_youtube_stream(youtube_url)
                
                print(f"📊 Resultado extracción: {'ÉXITO' if stream_url else 'FALLO'}")
                if stream_url:
                    print(f"🔗 Stream URL encontrado: {len(stream_url)} caracteres")
                    print(f"🎯 Dominio: {'googlevideo.com' if 'googlevideo.com' in stream_url else 'Otro'}")
                
                if stream_url:
                    # También obtener info del canal
                    print("📋 Obteniendo información del canal...")
                    channel_info = get_youtube_channel_info(youtube_url)
                    
                    result = {
                        'success': True,
                        'stream_url': stream_url,
                        'channel_info': channel_info,
                        'debug_info': debug_info
                    }
                    print("✅ Respuesta exitosa preparada")
                else:
                    result = {
                        'success': False,
                        'error': 'No se pudo extraer el stream de YouTube. Puede que no esté en vivo.',
                        'debug_info': debug_info
                    }
                    print("❌ Respuesta de error preparada")
                    
            elif action == 'info':
                print("📋 Solo obteniendo información del canal...")
                # Solo obtener información del canal
                channel_info = get_youtube_channel_info(youtube_url)
                result = {
                    'success': True,
                    'channel_info': channel_info
                }
            
            print(f"📤 Enviando respuesta: success={result.get('success')}")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            print(f"💥 Error en API: {str(e)}")
            import traceback
            traceback.print_exc()
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_GET(self):
        # Para testing
        query_components = parse_qs(urlparse(self.path).query)
        url = query_components.get("url", [None])[0]
        
        if not url:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "URL parameter is required"}).encode())
            return
        
        # Extraer stream
        stream_url, debug_info = extract_youtube_stream(url)
        channel_info = get_youtube_channel_info(url)
        
        result = {
            'success': bool(stream_url),
            'stream_url': stream_url,
            'channel_info': channel_info,
            'debug_info': debug_info
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())