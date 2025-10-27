"""import json

YouTube Live Stream M3U8 Extractor Lambdaimport requests

Basado en: https://github.com/benmoose39/YouTube_to_m3uimport os



Extrae URLs M3U8 de canales en directo de YouTube y las almacena en DynamoDBdef extract_youtube_stream(youtube_url):

Se ejecuta cada 3 horas vía EventBridge para mantener las URLs actualizadas    """

"""    Extrae la URL del stream M3U8 de una URL de YouTube

    Método simplificado basado en YouTube_To_m3u que SÍ funciona

import json    """

import os    debug_info = []

import boto3    try:

from decimal import Decimal        debug_info.append(f"Simple YouTube extractor - Processing: {youtube_url}")

import requests        

from datetime import datetime        # Método simple y directo como YouTube_To_m3u

        stream_url = grab_stream_url(youtube_url, debug_info)

# Cliente DynamoDB        

dynamodb = boto3.resource('dynamodb')        if stream_url:

table_name = os.environ.get('YOUTUBE_CHANNELS_TABLE', 'YouTubeChannels')            debug_info.append(f"SUCCESS: Found stream URL")

table = dynamodb.Table(table_name)            return stream_url, debug_info

        else:

def extract_m3u8_url(youtube_url):            debug_info.append("No stream URL found - returning placeholder")

    """            return None, debug_info

    Extrae la URL M3U8 del HTML de YouTube        

    Método exacto de youtube_m3ugrabber.py    except Exception as e:

    """        debug_info.append(f"Error in extraction: {e}")

    try:        return None, debug_info

        # Hacer petición HTTP GET con timeout de 15 segundos

        response = requests.get(youtube_url, timeout=15)def grab_stream_url(url, debug_info):

        html = response.text    """

            Método basado en youtube_non_stream_link.py del proyecto purplescorpion1/youtube-to-m3u

        # Buscar .m3u8 en el HTML    Extrae URLs HLS m3u8 directamente del HTML de YouTube

        if '.m3u8' not in html:    """

            print(f"No .m3u8 found in response from {youtube_url}")    try:

            return None        debug_info.append(f"Using direct HLS extraction method for: {url}")

                

        # Encontrar la posición de .m3u8        # Intentar método directo como youtube_non_stream_link.py

        end = html.find('.m3u8') + 5        try:

                    import re

        # Buscar hacia atrás para encontrar 'https://'            

        tuner = 100            # Headers similares a un navegador real

        while tuner < 1000:            headers = {

            segment = html[end-tuner:end]                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

            if 'https://' in segment:                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',

                start = segment.find('https://')                'Accept-Language': 'en-US,en;q=0.9',

                m3u8_url = segment[start:]                'Accept-Encoding': 'gzip, deflate',

                print(f"✅ M3U8 extracted: {m3u8_url[:80]}...")                'Referer': 'https://www.youtube.com/',

                return m3u8_url                'Origin': 'https://www.youtube.com',

            tuner += 5                'Connection': 'keep-alive',

                        'Upgrade-Insecure-Requests': '1',

        print(f"Could not find start of M3U8 URL")                'Sec-Fetch-Dest': 'document',

        return None                'Sec-Fetch-Mode': 'navigate',

                        'Sec-Fetch-Site': 'same-origin',

    except requests.Timeout:                'Cache-Control': 'max-age=0',

        print(f"⏱️ Timeout accessing {youtube_url}")            }

        return None            

    except Exception as e:            debug_info.append("Making request to YouTube with browser headers")

        print(f"❌ Error extracting M3U8: {str(e)}")            response = requests.get(url, headers=headers, timeout=20)

        return None            

            if response.status_code != 200:

                debug_info.append(f"Failed to access YouTube URL. HTTP Status: {response.status_code}")

def lambda_handler(event, context):                return None

    """            

    Handler principal de Lambda            debug_info.append(f"Response received. Content length: {len(response.text)}")

                

    Modos de operación:            # Método de youtube_non_stream_link.py: buscar URLs .m3u8 directamente

    1. Manual: Extrae M3U8 de una URL específica (parámetro 'url')            hls_patterns = [

    2. Cron: Actualiza todas las URLs almacenadas en DynamoDB (EventBridge)                r'https?://[^\s"\']+\.m3u8[^\s"\']*',

    3. Add: Añade un nuevo canal (parámetros 'url', 'name', 'group')                r'https?://manifest\.googlevideo\.com[^\s"\']+',

    4. List: Lista todos los canales guardados                r'"(https://manifest\.googlevideo\.com[^"]+\.m3u8[^"]*)"',

    5. Remove: Elimina un canal (parámetro 'channel_id')                r"'(https://manifest\.googlevideo\.com[^']+\.m3u8[^']*)'",

    """                r'hlsManifestUrl["\']:\s*["\']([^"\']+)["\']',

                    r'"hlsManifestUrl":"([^"]+)"'

    # Determinar modo de operación            ]

    if 'source' in event and event['source'] == 'aws.events':            

        # Modo CRON: Actualizar todos los canales            debug_info.append(f"Searching with {len(hls_patterns)} HLS patterns")

        print("🕐 CRON triggered - Updating all channels")            

        return update_all_channels()            for i, pattern in enumerate(hls_patterns, 1):

                    matches = re.findall(pattern, response.text, re.IGNORECASE)

    # Obtener parámetros de la petición                debug_info.append(f"HLS Pattern {i}: found {len(matches)} matches")

    params = event.get('queryStringParameters') or {}                

    action = params.get('action', 'extract')                for match in matches:

                        # Si es una tupla (por grupos en regex), tomar el primer elemento

    if action == 'extract':                    if isinstance(match, tuple):

        # Modo Manual: Extraer M3U8 de una URL específica                        hls_url = match[0]

        youtube_url = params.get('url')                    else:

        if not youtube_url:                        hls_url = match

            return {                    

                'statusCode': 400,                    # Limpiar la URL

                'headers': {                    hls_url = hls_url.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')

                    'Content-Type': 'application/json',                    hls_url = hls_url.strip().strip('"\'')

                    'Access-Control-Allow-Origin': '*'                    

                },                    debug_info.append(f"Found candidate HLS URL: {hls_url[:150]}...")

                'body': json.dumps({                    

                    'error': 'Missing url parameter'                    # Verificar que es una URL válida de HLS

                })                    if (hls_url.startswith('https://') and 

            }                        ('m3u8' in hls_url or 'manifest' in hls_url) and

                                ('googlevideo.com' in hls_url or 'youtube.com' in hls_url)):

        m3u8_url = extract_m3u8_url(youtube_url)                        

                                debug_info.append(f"SUCCESS: Found valid HLS URL via direct extraction")

        if m3u8_url:                        return hls_url

            return {            

                'statusCode': 200,            debug_info.append("Direct HLS extraction failed, no valid URLs found")

                'headers': {                

                    'Content-Type': 'application/json',        except Exception as e:

                    'Access-Control-Allow-Origin': '*'            debug_info.append(f"Direct HLS extraction error: {e}")

                },        

                'body': json.dumps({        # Fallback método 2: API interna de YouTube

                    'youtube_url': youtube_url,        debug_info.append("yt-dlp failed, trying YouTube internal API method")

                    'm3u8_url': m3u8_url,        

                    'extracted_at': datetime.utcnow().isoformat()        # Extraer video ID de la URL

                })        import re

            }        video_id = None

        else:        patterns = [

            return {            r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',

                'statusCode': 404,            r'youtu\.be\/([0-9A-Za-z_-]{11})',

                'headers': {            r'embed\/([0-9A-Za-z_-]{11})'

                    'Content-Type': 'application/json',        ]

                    'Access-Control-Allow-Origin': '*'        

                },        for pattern in patterns:

                'body': json.dumps({            match = re.search(pattern, url)

                    'error': 'No live stream found or extraction failed'            if match:

                })                video_id = match.group(1)

            }                break

            

    elif action == 'add':        if not video_id:

        # Añadir nuevo canal            debug_info.append("Could not extract video ID from URL")

        return add_channel(params)            return None

            

    elif action == 'list':        debug_info.append(f"Extracted video ID: {video_id}")

        # Listar todos los canales        

        return list_channels()        api_url = "https://www.youtube.com/youtubei/v1/player"

            

    elif action == 'remove':        # Headers de app móvil de YouTube

        # Eliminar canal        mobile_headers = {

        channel_id = params.get('channel_id')            'User-Agent': 'com.google.android.youtube/19.09.36 (Linux; U; Android 11) gzip',

        if not channel_id:            'Content-Type': 'application/json',

            return {            'X-YouTube-Client-Name': '3',

                'statusCode': 400,            'X-YouTube-Client-Version': '19.09.36',

                'headers': {        }

                    'Content-Type': 'application/json',        

                    'Access-Control-Allow-Origin': '*'        # Payload de API interna

                },        api_payload = {

                'body': json.dumps({'error': 'Missing channel_id parameter'})            "context": {

            }                "client": {

        return remove_channel(channel_id)                    "clientName": "ANDROID",

                        "clientVersion": "19.09.36",

    elif action == 'get_m3u8':                    "androidSdkVersion": 30,

        # Obtener M3U8 de un canal específico guardado                    "userAgent": "com.google.android.youtube/19.09.36 (Linux; U; Android 11) gzip",

        channel_id = params.get('channel_id')                    "hl": "en",

        if not channel_id:                    "timeZone": "UTC",

            return {                    "utcOffsetMinutes": 0

                'statusCode': 400,                }

                'headers': {            },

                    'Content-Type': 'application/json',            "videoId": video_id,

                    'Access-Control-Allow-Origin': '*'            "playbackContext": {

                },                "contentPlaybackContext": {

                'body': json.dumps({'error': 'Missing channel_id parameter'})                    "html5Preference": "HTML5_PREF_WANTS"

            }                }

        return get_channel_m3u8(channel_id)            },

                "contentCheckOk": True,

    else:            "racyCheckOk": True

        return {        }

            'statusCode': 400,        

            'headers': {        try:

                'Content-Type': 'application/json',            api_response = requests.post(api_url, json=api_payload, headers=mobile_headers, timeout=15)

                'Access-Control-Allow-Origin': '*'            debug_info.append(f"API response status: {api_response.status_code}")

            },            

            'body': json.dumps({            if api_response.status_code == 200:

                'error': 'Invalid action. Use: extract, add, list, remove, or get_m3u8'                api_data = api_response.json()

            })                debug_info.append("Successfully got API response")

        }                

                # Buscar streamingData en la respuesta de API

                if 'streamingData' in api_data:

def add_channel(params):                    streaming_data = api_data['streamingData']

    """Añade un nuevo canal YouTube a la base de datos"""                    debug_info.append("Found streamingData in API response")

    youtube_url = params.get('url')                    

    channel_name = params.get('name', 'YouTube Live Channel')                    # Buscar hlsManifestUrl

    group_title = params.get('group', 'YouTube Live')                    if 'hlsManifestUrl' in streaming_data:

    tvg_logo = params.get('logo', '')                        hls_url = streaming_data['hlsManifestUrl']

                            debug_info.append(f"Found HLS manifest from API: {hls_url[:100]}...")

    if not youtube_url:                        return hls_url

        return {                    

            'statusCode': 400,                    # Buscar adaptiveFormats

            'headers': {                    if 'adaptiveFormats' in streaming_data:

                'Content-Type': 'application/json',                        formats = streaming_data['adaptiveFormats']

                'Access-Control-Allow-Origin': '*'                        debug_info.append(f"Found {len(formats)} adaptive formats from API")

            },                        

            'body': json.dumps({'error': 'Missing url parameter'})                        for fmt in formats:

        }                            if 'url' in fmt and 'googlevideo.com' in fmt['url']:

                                    debug_info.append(f"Found googlevideo URL from API: {fmt['url'][:100]}...")

    # Extraer M3U8 inicialmente                                return fmt['url']

    m3u8_url = extract_m3u8_url(youtube_url)                

                    if 'playabilityStatus' in api_data:

    if not m3u8_url:                    status = api_data['playabilityStatus']

        return {                    debug_info.append(f"API playability status: {status.get('status')}, reason: {status.get('reason', 'N/A')}")

            'statusCode': 404,            

            'headers': {        except Exception as e:

                'Content-Type': 'application/json',            debug_info.append(f"API method failed: {e}")

                'Access-Control-Allow-Origin': '*'        

            },        # Fallback final: método web scraping

            'body': json.dumps({        debug_info.append("All methods failed, trying basic web scraping")

                'error': 'No live stream found. Make sure the channel is live.'        

            })        # Headers básicos

        }        headers = {

                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

    # Generar ID único            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',

    import time            'Accept-Language': 'en-US,en;q=0.9',

    channel_id = f"yt-{int(time.time() * 1000)}"            'Accept-Encoding': 'identity',

                'Connection': 'keep-alive',

    # Guardar en DynamoDB        }

    try:        

        table.put_item(        response = requests.get(url, headers=headers, timeout=15)

            Item={        response_text = response.text

                'channel_id': channel_id,        

                'youtube_url': youtube_url,        debug_info.append(f"Web response status: {response.status_code}, Content length: {len(response_text)}")

                'm3u8_url': m3u8_url,        

                'channel_name': channel_name,        # Buscar patterns de googlevideo.com básicos

                'group_title': group_title,        googlevideo_patterns = [

                'tvg_logo': tvg_logo,            'manifest.googlevideo.com',

                'created_at': datetime.utcnow().isoformat(),            'googlevideo.com',

                'updated_at': datetime.utcnow().isoformat(),            'manifest.googlevideo',

                'last_check': datetime.utcnow().isoformat(),            'hls_variant',

                'status': 'active'            'hls_playlist'

            }        ]

        )        

                found_googlevideo = False

        return {        for pattern in googlevideo_patterns:

            'statusCode': 200,            if pattern in response_text:

            'headers': {                debug_info.append(f"Found pattern '{pattern}' in response")

                'Content-Type': 'application/json',                found_googlevideo = True

                'Access-Control-Allow-Origin': '*'                break

            },        

            'body': json.dumps({        if not found_googlevideo:

                'success': True,            debug_info.append("No googlevideo patterns found in web scraping")

                'channel_id': channel_id,            return None

                'channel_name': channel_name,        

                'm3u8_url': m3u8_url,        # Buscar URLs completas de manifest.googlevideo.com

                'message': 'Channel added successfully'        import re

            })        

        }        # Patterns más específicos para URLs de streaming de YouTube

    except Exception as e:        url_patterns = [

        print(f"Error saving to DynamoDB: {str(e)}")            r'https://manifest\.googlevideo\.com/api/manifest/hls_variant[^"\s]+',

        return {            r'https://manifest\.googlevideo\.com[^"\s]+\.m3u8[^"\s]*',

            'statusCode': 500,            r'https://[^"\s]*googlevideo\.com[^"\s]*manifest[^"\s]*',

            'headers': {            r'https://[^"\s]*googlevideo\.com[^"\s]*\.m3u8[^"\s]*',

                'Content-Type': 'application/json',            r'"(https://manifest\.googlevideo\.com[^"]+)"',

                'Access-Control-Allow-Origin': '*'            r"'(https://manifest\.googlevideo\.com[^']+)'"

            },        ]

            'body': json.dumps({'error': f'Database error: {str(e)}'})        

        }        debug_info.append(f"Searching with {len(url_patterns)} URL patterns")

        

        for i, pattern in enumerate(url_patterns):

def list_channels():            matches = re.findall(pattern, response_text, re.IGNORECASE)

    """Lista todos los canales guardados"""            debug_info.append(f"Pattern {i+1}: found {len(matches)} matches")

    try:            

        response = table.scan()            for match in matches:

        channels = response.get('Items', [])                # Si es una tupla (por grupos en regex), tomar el primer elemento

                        if isinstance(match, tuple):

        # Convertir Decimals a floats para JSON                    stream_url = match[0]

        def convert_decimals(obj):                else:

            if isinstance(obj, list):                    stream_url = match

                return [convert_decimals(i) for i in obj]                

            elif isinstance(obj, dict):                # Limpiar la URL de caracteres de escape

                return {k: convert_decimals(v) for k, v in obj.items()}                stream_url = stream_url.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&')

            elif isinstance(obj, Decimal):                

                return float(obj)                debug_info.append(f"Found candidate URL: {stream_url[:100]}...")

            return obj                

                        # Verificar que es una URL válida de YouTube streaming

        channels = convert_decimals(channels)                if (stream_url.startswith('https://') and 

                            'googlevideo.com' in stream_url and 

        return {                    ('manifest' in stream_url or '.m3u8' in stream_url)):

            'statusCode': 200,                    

            'headers': {                    debug_info.append(f"SUCCESS: Found valid YouTube stream URL")

                'Content-Type': 'application/json',                    return stream_url

                'Access-Control-Allow-Origin': '*'        

            },        # Si no encontramos con regex, buscar manualmente como YouTube_To_m3u

            'body': json.dumps({        debug_info.append("Regex search failed, trying manual search")

                'total': len(channels),        

                'channels': channels        # Buscar fragmentos y reconstruir URLs

            })        search_terms = [

        }            'manifest.googlevideo.com',

    except Exception as e:            'googlevideo.com/api/manifest',

        print(f"Error listing channels: {str(e)}")            'googlevideo.com',

        return {            'manifest/hls_variant',

            'statusCode': 500,            'hls_variant',

            'headers': {            '/api/manifest/'

                'Content-Type': 'application/json',        ]

                'Access-Control-Allow-Origin': '*'        

            },        all_fragments = []

            'body': json.dumps({'error': f'Database error: {str(e)}'})        

        }        for term in search_terms:

            pos = 0

            while True:

def remove_channel(channel_id):                pos = response_text.find(term, pos)

    """Elimina un canal de la base de datos"""                if pos == -1:

    try:                    break

        table.delete_item(                

            Key={'channel_id': channel_id}                debug_info.append(f"Found '{term}' at position {pos}")

        )                

                        # Extraer un fragmento más grande alrededor del término

        return {                start_search = max(0, pos - 200)

            'statusCode': 200,                end_search = min(len(response_text), pos + 1500)

            'headers': {                fragment = response_text[start_search:end_search]

                'Content-Type': 'application/json',                

                'Access-Control-Allow-Origin': '*'                # Limpiar caracteres de escape

            },                clean_fragment = fragment.replace('\\u002F', '/').replace('\\/', '/').replace('\\u0026', '&').replace('\\"', '"')

            'body': json.dumps({                

                'success': True,                all_fragments.append(clean_fragment)

                'message': f'Channel {channel_id} removed successfully'                pos += 1

            })        

        }        debug_info.append(f"Collected {len(all_fragments)} fragments for analysis")

    except Exception as e:        

        print(f"Error deleting channel: {str(e)}")        # Para debugging, mostrar algunos fragmentos

        return {        if all_fragments:

            'statusCode': 500,            debug_info.append(f"Sample fragment 1: {repr(all_fragments[0][:150])}")

            'headers': {            if len(all_fragments) > 5:

                'Content-Type': 'application/json',                debug_info.append(f"Sample fragment 6: {repr(all_fragments[5][:150])}")

                'Access-Control-Allow-Origin': '*'        

            },        # Estrategia mejorada: Buscar configuraciones JSON de YouTube

            'body': json.dumps({'error': f'Database error: {str(e)}'})        debug_info.append("Searching for YouTube JSON configurations")

        }        

        # Buscar específicamente ytInitialPlayerResponse

        import json

def get_channel_m3u8(channel_id):        

    """Obtiene la URL M3U8 actual de un canal específico"""        # Patrón más robusto para ytInitialPlayerResponse

    try:        player_response_patterns = [

        response = table.get_item(            r'var\s+ytInitialPlayerResponse\s*=\s*({.+?});',

            Key={'channel_id': channel_id}            r'ytInitialPlayerResponse\s*=\s*({.+?});',

        )            r'window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});'

                ]

        if 'Item' not in response:        

            return {        for pattern in player_response_patterns:

                'statusCode': 404,            matches = re.findall(pattern, response_text, re.DOTALL)

                'headers': {            debug_info.append(f"Player response pattern found {len(matches)} matches")

                    'Content-Type': 'application/json',            

                    'Access-Control-Allow-Origin': '*'            for match in matches:

                },                try:

                'body': json.dumps({'error': 'Channel not found'})                    debug_info.append(f"Trying to parse player response JSON (length: {len(match)})")

            }                    

                            # Intentar parsear el JSON

        channel = response['Item']                    player_data = json.loads(match)

                            debug_info.append("Successfully parsed ytInitialPlayerResponse JSON")

        # Convertir Decimals                    

        def convert_decimals(obj):                    # Mostrar las claves principales para debugging

            if isinstance(obj, dict):                    main_keys = list(player_data.keys())[:10]  # Limitar a 10 para evitar overflow

                return {k: convert_decimals(v) for k, v in obj.items()}                    debug_info.append(f"Main keys in player response: {main_keys}")

            elif isinstance(obj, Decimal):                    

                return float(obj)                    # Buscar streamingData

            return obj                    if 'streamingData' in player_data:

                                streaming_data = player_data['streamingData']

        channel = convert_decimals(channel)                        debug_info.append("Found streamingData in player response")

                                

        return {                        # Buscar hlsManifestUrl

            'statusCode': 200,                        if 'hlsManifestUrl' in streaming_data:

            'headers': {                            hls_url = streaming_data['hlsManifestUrl']

                'Content-Type': 'application/json',                            debug_info.append(f"Found hlsManifestUrl: {hls_url[:100]}...")

                'Access-Control-Allow-Origin': '*'                            if 'googlevideo.com' in hls_url:

            },                                return hls_url

            'body': json.dumps(channel)                        

        }                        # Buscar adaptiveFormats

    except Exception as e:                        if 'adaptiveFormats' in streaming_data:

        print(f"Error getting channel: {str(e)}")                            formats = streaming_data['adaptiveFormats']

        return {                            debug_info.append(f"Found {len(formats)} adaptive formats")

            'statusCode': 500,                            

            'headers': {                            for fmt in formats:

                'Content-Type': 'application/json',                                if 'url' in fmt and 'googlevideo.com' in fmt['url']:

                'Access-Control-Allow-Origin': '*'                                    debug_info.append(f"Found googlevideo URL in format: {fmt['url'][:100]}...")

            },                                    return fmt['url']

            'body': json.dumps({'error': f'Database error: {str(e)}'})                        

        }                        # Buscar formats regulares

                        if 'formats' in streaming_data:

                            formats = streaming_data['formats']

def update_all_channels():                            debug_info.append(f"Found {len(formats)} regular formats")

    """                            

    Actualiza las URLs M3U8 de todos los canales                            for fmt in formats:

    Se ejecuta automáticamente cada 3 horas vía EventBridge                                if 'url' in fmt and 'googlevideo.com' in fmt['url']:

    """                                    debug_info.append(f"Found googlevideo URL in regular format: {fmt['url'][:100]}...")

    try:                                    return fmt['url']

        # Obtener todos los canales                    

        response = table.scan()                    debug_info.append("No streaming URLs found in ytInitialPlayerResponse")

        channels = response.get('Items', [])                    

                            # También verificar si hay videoDetails o playabilityStatus que puedan indicar por qué no hay streams

        print(f"🔄 Updating {len(channels)} channels...")                    if 'videoDetails' in player_data:

                                video_details = player_data['videoDetails']

        updated = 0                        debug_info.append(f"Video details available: videoId={video_details.get('videoId', 'N/A')}, isLiveContent={video_details.get('isLiveContent', 'N/A')}")

        failed = 0                    

                            if 'playabilityStatus' in player_data:

        for channel in channels:                        playability = player_data['playabilityStatus']

            channel_id = channel['channel_id']                        debug_info.append(f"Playability status: {playability.get('status', 'N/A')}, reason={playability.get('reason', 'N/A')}")

            youtube_url = channel['youtube_url']                    

            channel_name = channel.get('channel_name', 'Unknown')                except json.JSONDecodeError as e:

                                debug_info.append(f"JSON decode error: {e}")

            print(f"Processing: {channel_name} ({channel_id})")                    

                                # Intentar encontrar JSON válido dentro del match

            # Extraer nueva URL M3U8                    try:

            m3u8_url = extract_m3u8_url(youtube_url)                        # Buscar el primer { y el último } que coincida

                                    start = match.find('{')

            if m3u8_url:                        if start != -1:

                # Actualizar en DynamoDB                            brace_count = 0

                table.update_item(                            end = start

                    Key={'channel_id': channel_id},                            for i in range(start, len(match)):

                    UpdateExpression='SET m3u8_url = :m3u8, updated_at = :updated, last_check = :check, #status = :status',                                if match[i] == '{':

                    ExpressionAttributeNames={                                    brace_count += 1

                        '#status': 'status'                                elif match[i] == '}':

                    },                                    brace_count -= 1

                    ExpressionAttributeValues={                                    if brace_count == 0:

                        ':m3u8': m3u8_url,                                        end = i + 1

                        ':updated': datetime.utcnow().isoformat(),                                        break

                        ':check': datetime.utcnow().isoformat(),                            

                        ':status': 'active'                            clean_json = match[start:end]

                    }                            player_data = json.loads(clean_json)

                )                            debug_info.append("Successfully parsed cleaned JSON")

                updated += 1                            

                print(f"✅ Updated: {channel_name}")                            # Repetir búsqueda con JSON limpio

            else:                            if 'streamingData' in player_data:

                # Marcar como offline pero no eliminar                                streaming_data = player_data['streamingData']

                table.update_item(                                if 'hlsManifestUrl' in streaming_data:

                    Key={'channel_id': channel_id},                                    hls_url = streaming_data['hlsManifestUrl']

                    UpdateExpression='SET last_check = :check, #status = :status',                                    if 'googlevideo.com' in hls_url:

                    ExpressionAttributeNames={                                        return hls_url

                        '#status': 'status'                    

                    },                    except Exception as e2:

                    ExpressionAttributeValues={                        debug_info.append(f"Cleanup attempt failed: {e2}")

                        ':check': datetime.utcnow().isoformat(),                        continue

                        ':status': 'offline'                

                    }                except Exception as e:

                )                    debug_info.append(f"General JSON parsing error: {e}")

                failed += 1                    continue

                print(f"❌ Offline: {channel_name}")                    

                # Fallback: Analizar fragmentos para reconstruir URLs

        return {        debug_info.append("JSON search failed, analyzing fragments manually")

            'statusCode': 200,        

            'body': json.dumps({        for i, fragment in enumerate(all_fragments):

                'message': f'Update completed. Updated: {updated}, Failed: {failed}, Total: {len(channels)}'            debug_info.append(f"Analyzing fragment {i+1}")

            })            

        }            # Solo procesar los primeros 5 fragmentos para evitar timeout

                    if i >= 5:

    except Exception as e:                debug_info.append("Limiting fragment analysis to first 5 for performance")

        print(f"Error in bulk update: {str(e)}")                break

        return {            

            'statusCode': 500,            # Buscar patrones de URL dentro del fragmento

            'body': json.dumps({'error': f'Update failed: {str(e)}'})            url_starts = []

        }            for j in range(len(fragment) - 8):

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