"""
AWS Lambda function que usa FFprobe para analizar streams
Basado en el enfoque de IPTVChecker
"""
import json
import subprocess
import os
import urllib.parse
from typing import Dict, Any, Optional

def extract_quality_info(ffprobe_output: str) -> Dict[str, Any]:
    """
    Extrae información de calidad del output de FFprobe
    """
    result = {
        'status': 'unknown',
        'quality': 'unknown',
        'resolution': None,
        'codec': None,
        'bitrate': None,
        'audio_channels': None,
        'error': None
    }
    
    try:
        # FFprobe devuelve JSON con la información del stream
        data = json.loads(ffprobe_output)
        
        # Buscar stream de video
        video_stream = None
        audio_stream = None
        
        for stream in data.get('streams', []):
            if stream.get('codec_type') == 'video' and not video_stream:
                video_stream = stream
            elif stream.get('codec_type') == 'audio' and not audio_stream:
                audio_stream = stream
        
        # Extraer información de video
        if video_stream:
            width = video_stream.get('width')
            height = video_stream.get('height')
            
            if width and height:
                result['resolution'] = f"{width}x{height}"
                
                # Determinar calidad basada en resolución
                if height >= 2160:
                    result['quality'] = '4K'
                elif height >= 1080:
                    result['quality'] = 'FHD'
                elif height >= 720:
                    result['quality'] = 'HD'
                elif height >= 480:
                    result['quality'] = 'SD'
                else:
                    result['quality'] = 'SD'
            
            result['codec'] = video_stream.get('codec_name')
            
            # Bitrate del video
            bit_rate = video_stream.get('bit_rate')
            if bit_rate:
                result['bitrate'] = int(bit_rate)
        
        # Extraer información de audio
        if audio_stream:
            result['audio_channels'] = audio_stream.get('channels')
        
        # Si encontramos info de video, marcar como exitoso
        if video_stream:
            result['status'] = 'ok'
        
    except json.JSONDecodeError as e:
        result['error'] = f'Could not parse FFprobe output: {str(e)}'
    except Exception as e:
        result['error'] = f'Error extracting quality info: {str(e)}'
    
    return result


def lambda_handler(event, context):
    """
    Lambda handler para analizar streams usando IPTVChecker
    
    Parámetros esperados:
    - url: URL del stream a analizar
    - timeout: (opcional) timeout en segundos (default: 15)
    """
    
    # Parsear parámetros
    params = event.get('queryStringParameters', {}) or {}
    url = params.get('url')
    timeout = int(params.get('timeout', 15))
    
    if not url:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            'body': json.dumps({
                'status': 'failed',
                'quality': 'unknown',
                'error': 'URL parameter is required'
            })
        }
    
    # Decodificar URL si viene encoded
    url = urllib.parse.unquote(url)
    
    # Ruta al binario de FFprobe
    ffprobe_path = os.environ.get('FFPROBE_PATH', '/opt/bin/ffprobe')
    
    # Si no existe en /opt, buscar en el directorio actual
    if not os.path.exists(ffprobe_path):
        ffprobe_path = os.path.join(os.path.dirname(__file__), 'ffprobe')
    
    if not os.path.exists(ffprobe_path):
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'status': 'failed',
                'quality': 'unknown',
                'error': 'FFprobe binary not found'
            })
        }
    
    try:
        # Ejecutar FFprobe directamente
        # Comando: ffprobe -v quiet -print_format json -show_streams -show_format -i URL
        cmd = [
            ffprobe_path,
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-show_format',
            '-i', url
        ]
        
        print(f"Executing: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout + 5,  # Timeout del proceso un poco mayor
            check=False
        )
        
        print(f"Return code: {result.returncode}")
        print(f"Stdout: {result.stdout}")
        print(f"Stderr: {result.stderr}")
        
        # Si el comando falló
        if result.returncode != 0:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({
                    'status': 'failed',
                    'quality': 'unknown',
                    'error': result.stderr or 'Stream verification failed'
                })
            }
        
        # Parsear output de FFprobe
        quality_info = extract_quality_info(result.stdout)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            'body': json.dumps(quality_info)
        }
        
    except subprocess.TimeoutExpired:
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'status': 'failed',
                'quality': 'unknown',
                'error': 'Timeout: Stream took too long to respond'
            })
        }
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'status': 'failed',
                'quality': 'unknown',
                'error': str(e)
            })
        }
