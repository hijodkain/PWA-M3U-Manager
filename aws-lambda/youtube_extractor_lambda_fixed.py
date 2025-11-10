"""
YouTube Live Stream M3U8 Extractor Lambda

Basado en: https://github.com/benmoose39/YouTube_to_m3u

Extrae URLs M3U8 de canales en directo de YouTube y las almacena en DynamoDB
Se ejecuta cada 3 horas vía EventBridge para mantener las URLs actualizadas
"""

import json
import os
import boto3
from decimal import Decimal
import requests
from datetime import datetime
import re

# Cliente DynamoDB
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('YOUTUBE_CHANNELS_TABLE', 'YouTubeChannels')
table = dynamodb.Table(table_name)

# Cliente Secrets Manager para cookies
secrets_client = boto3.client('secretsmanager', region_name='eu-west-1')

def load_youtube_cookies():
    """
    Carga las cookies de YouTube desde AWS Secrets Manager
    Las cookies están en formato Netscape HTTP Cookie File
    """
    try:
        print("📥 Loading YouTube cookies from Secrets Manager...")
        response = secrets_client.get_secret_value(SecretId='youtube-cookies')
        cookies_text = response['SecretString']
        
        # Convertir formato Netscape a diccionario de cookies
        cookies_dict = {}
        for line in cookies_text.split('\n'):
            line = line.strip()
            # Ignorar líneas vacías y comentarios
            if not line or line.startswith('#'):
                continue
            
            # Formato Netscape: domain flag path secure expiration name value
            parts = line.split('\t')
            if len(parts) >= 7:
                cookie_name = parts[5]
                cookie_value = parts[6]
                cookies_dict[cookie_name] = cookie_value
        
        print(f"✅ Loaded {len(cookies_dict)} cookies from Secrets Manager")
        return cookies_dict
    
    except Exception as e:
        print(f"⚠️ Warning: Could not load cookies from Secrets Manager: {e}")
        print("Continuing without cookies - may face YouTube bot detection")
        return {}


def grab_stream_url(url, debug_info):
    """
    Método basado en youtube_non_stream_link.py del proyecto purplescorpion1/youtube-to-m3u
    Extrae URLs HLS m3u8 directamente del HTML de YouTube
    """
    try:
        debug_info.append(f"Using direct HLS extraction method for: {url}")
        
        # Cargar cookies de YouTube
        cookies = load_youtube_cookies()
        
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
        
        debug_info.append("Making request to YouTube with browser headers and cookies")
        response = requests.get(url, headers=headers, cookies=cookies, timeout=20)
        
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
        
        debug_info.append("No valid HLS URL found in response")
        return None
        
    except Exception as e:
        debug_info.append(f"Error in grab_stream_url: {str(e)}")
        return None


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


def extract_m3u8_url(youtube_url):
    """
    Extrae la URL M3U8 del HTML de YouTube
    Método simplificado con soporte para cookies
    """
    try:
        # Cargar cookies de YouTube
        cookies = load_youtube_cookies()
        
        # Headers de navegador
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.youtube.com/',
        }
        
        # Hacer petición HTTP GET con timeout y cookies
        response = requests.get(youtube_url, headers=headers, cookies=cookies, timeout=15)
        html = response.text
        
        # Buscar .m3u8 en el HTML
        if '.m3u8' not in html:
            print(f"No .m3u8 found in response from {youtube_url}")
            return None
        
        # Encontrar la posición de .m3u8
        end = html.find('.m3u8') + 5
        
        # Buscar hacia atrás para encontrar 'https://'
        tuner = 100
        while tuner < 1000:
            segment = html[end-tuner:end]
            if 'https://' in segment:
                start = segment.find('https://')
                m3u8_url = segment[start:]
                print(f"✅ M3U8 extracted: {m3u8_url[:80]}...")
                return m3u8_url
            tuner += 5
        
        print(f"Could not find start of M3U8 URL")
        return None
    
    except requests.Timeout:
        print(f"⏱️ Timeout accessing {youtube_url}")
        return None
    except Exception as e:
        print(f"❌ Error extracting M3U8: {str(e)}")
        return None


def lambda_handler(event, context):
    """
    Handler principal de Lambda
    
    Modos de operación:
    1. Manual: Extrae M3U8 de una URL específica (parámetro 'url')
    2. Cron: Actualiza todas las URLs almacenadas en DynamoDB (EventBridge)
    3. Add: Añade un nuevo canal (parámetros 'url', 'name', 'group')
    4. List: Lista todos los canales guardados
    5. Remove: Elimina un canal (parámetro 'channel_id')
    """
    
    # Determinar modo de operación
    if 'source' in event and event['source'] == 'aws.events':
        # Modo CRON: Actualizar todos los canales
        print("🕐 CRON triggered - Updating all channels")
        return update_all_channels()
    
    # Obtener parámetros de la petición
    params = event.get('queryStringParameters') or {}
    action = params.get('action', 'extract')
    
    if action == 'extract':
        # Modo Manual: Extraer M3U8 de una URL específica
        youtube_url = params.get('url')
        if not youtube_url:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Missing url parameter'
                })
            }
        
        # Usar el método mejorado
        stream_url, debug_info = extract_youtube_stream(youtube_url)
        
        if stream_url:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'm3u8_url': stream_url,
                    'youtube_url': youtube_url,
                    'extracted_at': datetime.utcnow().isoformat(),
                    'debug': debug_info
                })
            }
        else:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Could not extract M3U8 URL from YouTube',
                    'debug': debug_info
                })
            }
    
    elif action == 'add':
        return add_channel(params)
    elif action == 'list':
        return list_channels()
    elif action == 'remove':
        return remove_channel(params)
    else:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': f'Invalid action: {action}'
            })
        }


def add_channel(params):
    """Añade un nuevo canal a DynamoDB"""
    channel_id = params.get('channel_id')
    youtube_url = params.get('url')
    name = params.get('name', '')
    group = params.get('group', 'YouTube Live')
    logo = params.get('logo', '')
    
    if not channel_id or not youtube_url:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Missing channel_id or url parameter'})
        }
    
    # Extraer M3U8
    stream_url, debug_info = extract_youtube_stream(youtube_url)
    
    # Guardar en DynamoDB
    item = {
        'channel_id': channel_id,
        'name': name,
        'group_title': group,
        'tvg_logo': logo,
        'youtube_url': youtube_url,
        'm3u8_url': stream_url or '',
        'last_updated': datetime.utcnow().isoformat(),
        'created_at': datetime.utcnow().isoformat()
    }
    
    table.put_item(Item=item)
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'message': 'Channel added',
            'channel': decimal_to_float(item),
            'debug': debug_info
        })
    }


def list_channels():
    """Lista todos los canales guardados"""
    response = table.scan()
    items = response.get('Items', [])
    items = decimal_to_float(items)
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'channels': items,
            'count': len(items)
        })
    }


def remove_channel(params):
    """Elimina un canal de DynamoDB"""
    channel_id = params.get('channel_id')
    if not channel_id:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Missing channel_id parameter'})
        }
    
    table.delete_item(Key={'channel_id': channel_id})
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'message': 'Channel removed',
            'channel_id': channel_id
        })
    }


def update_all_channels():
    """Actualiza las URLs M3U8 de todos los canales (llamado por EventBridge)"""
    print("📡 Updating all channels...")
    response = table.scan()
    items = response.get('Items', [])
    
    updated_count = 0
    failed_count = 0
    
    for item in items:
        channel_id = item['channel_id']
        youtube_url = item['youtube_url']
        print(f"🔄 Updating {channel_id}")
        
        try:
            stream_url, debug_info = extract_youtube_stream(youtube_url)
            if stream_url:
                table.update_item(
                    Key={'channel_id': channel_id},
                    UpdateExpression='SET m3u8_url = :m3u8, last_updated = :updated',
                    ExpressionAttributeValues={
                        ':m3u8': stream_url,
                        ':updated': datetime.utcnow().isoformat()
                    }
                )
                print(f"✅ Updated {channel_id}")
                updated_count += 1
            else:
                print(f"❌ Failed to extract for {channel_id}")
                print(f"Debug: {debug_info}")
                failed_count += 1
        except Exception as e:
            print(f"❌ Error updating {channel_id}: {e}")
            failed_count += 1
    
    result = {
        'message': 'Update completed',
        'updated': updated_count,
        'failed': failed_count,
        'total': len(items),
        'timestamp': datetime.utcnow().isoformat()
    }
    
    print(f"📊 Summary: {result}")
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(result)
    }


def decimal_to_float(obj):
    """Convierte objetos Decimal a float para JSON"""
    if isinstance(obj, list):
        return [decimal_to_float(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return float(obj)
    else:
        return obj
