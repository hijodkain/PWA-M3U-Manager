"""
AWS Lambda function que usa IPTVChecker (Rust binary) para analizar streams
Basado en: https://github.com/zhimin-dev/iptv-checker-rs
"""
import json
import subprocess
import os
import urllib.parse
from typing import Dict, Any, Optional

def extract_quality_info(iptv_output: str) -> Dict[str, Any]:
    """
    Extrae información de calidad del output de IPTVChecker
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
        # IPTVChecker devuelve JSON con la información del stream
        data = json.loads(iptv_output)
        
        # Extraer información de video
        if 'video' in data:
            video = data['video']
            width = video.get('width')
            height = video.get('height')
            
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
            
            result['codec'] = video.get('codec_name')
            result['bitrate'] = video.get('bit_rate')
        
        # Extraer información de audio
        if 'audio' in data:
            audio = data['audio']
            result['audio_channels'] = audio.get('channels')
        
        result['status'] = 'ok'
        
    except json.JSONDecodeError:
        # Si no es JSON, intentar parsear output de texto
        if 'resolution' in iptv_output.lower():
            # Parsear output de texto plano
            for line in iptv_output.split('\n'):
                if 'resolution:' in line.lower():
                    res_part = line.split(':', 1)[1].strip()
                    result['resolution'] = res_part
                    
                    # Extraer altura para determinar calidad
                    if 'x' in res_part:
                        try:
                            height = int(res_part.split('x')[1])
                            if height >= 2160:
                                result['quality'] = '4K'
                            elif height >= 1080:
                                result['quality'] = 'FHD'
                            elif height >= 720:
                                result['quality'] = 'HD'
                            else:
                                result['quality'] = 'SD'
                        except:
                            pass
                
                elif 'codec:' in line.lower():
                    result['codec'] = line.split(':', 1)[1].strip()
                
                elif 'bitrate:' in line.lower():
                    result['bitrate'] = line.split(':', 1)[1].strip()
            
            result['status'] = 'ok'
        else:
            result['error'] = 'Could not parse IPTVChecker output'
    
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
    
    # Ruta al binario de IPTVChecker
    # El binario debe estar en /opt/bin/iptv-checker o en el mismo directorio
    iptv_checker_path = os.environ.get('IPTV_CHECKER_PATH', '/opt/bin/iptv-checker')
    
    # Si no existe en /opt, buscar en el directorio actual
    if not os.path.exists(iptv_checker_path):
        iptv_checker_path = os.path.join(os.path.dirname(__file__), 'iptv-checker')
    
    if not os.path.exists(iptv_checker_path):
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'status': 'failed',
                'quality': 'unknown',
                'error': 'IPTVChecker binary not found'
            })
        }
    
    try:
        # Ejecutar IPTVChecker
        # Comando: iptv-checker --url "URL" --json --timeout 15
        cmd = [
            iptv_checker_path,
            '--url', url,
            '--json',  # Output en formato JSON
            '--timeout', str(timeout)
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
        
        # Parsear output de IPTVChecker
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
