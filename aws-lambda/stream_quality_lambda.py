"""
Lambda Function para verificación CON CALIDAD de canales IPTV
Verifica si un canal está online Y detecta resolución/calidad usando FFprobe
Requiere FFprobe Layer con el binario compilado
"""

import json
import subprocess
import urllib.request
import urllib.error
import ssl
import os
import re
from typing import Dict, Any, Optional

# Configuración
FFPROBE_PATH = os.environ.get('FFPROBE_PATH', '/opt/bin/ffprobe')
TIMEOUT_SECONDS = int(os.environ.get('TIMEOUT_SECONDS', '25'))
FFPROBE_TIMEOUT = 15  # Timeout específico para FFprobe (más corto)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handler principal de la Lambda
    
    Parámetros esperados en query string:
    - url: URL del canal a verificar (requerido)
    
    Respuesta:
    {
        "status": "ok" | "failed",
        "quality": "4K" | "FHD" | "HD" | "SD" | "unknown",
        "resolution": "1920x1080" (opcional),
        "codec": "h264, aac" (opcional),
        "bitrate": 5000000 (opcional, en bps),
        "message": "descripción",
        "url": "url verificada"
    }
    """
    
    # Extraer parámetros
    query_params = event.get('queryStringParameters', {}) or {}
    stream_url = query_params.get('url')
    
    if not stream_url:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'status': 'failed',
                'quality': 'unknown',
                'message': 'Missing required parameter: url',
            })
        }
    
    # Verificar con calidad
    result = verify_stream_with_quality(stream_url)
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(result)
    }


def verify_stream_with_quality(url: str) -> Dict[str, Any]:
    """
    Verifica stream y detecta calidad usando FFprobe
    
    Args:
        url: URL del stream
        
    Returns:
        Dict con status, quality, resolution, codec, bitrate, message
    """
    
    # Primero verificar si está online con HTTP HEAD (más rápido)
    online_check = quick_online_check(url)
    if not online_check['is_online']:
        return {
            'status': 'failed',
            'quality': 'unknown',
            'message': online_check['message'],
            'url': url,
        }
    
    # Si está online, analizar con FFprobe
    try:
        quality_info = analyze_with_ffprobe(url)
        
        if quality_info:
            return {
                'status': 'ok',
                'quality': quality_info['quality'],
                'resolution': quality_info.get('resolution'),
                'codec': quality_info.get('codec'),
                'bitrate': quality_info.get('bitrate'),
                'message': f"Stream online - {quality_info['quality']} quality detected",
                'url': url,
            }
        else:
            # Online pero no se pudo detectar calidad
            return {
                'status': 'ok',
                'quality': 'unknown',
                'message': 'Stream online but quality detection failed',
                'url': url,
            }
    
    except Exception as e:
        # Si falla FFprobe pero sabemos que está online
        return {
            'status': 'ok',
            'quality': 'unknown',
            'message': f'Stream online but FFprobe analysis failed: {str(e)}',
            'url': url,
        }


def quick_online_check(url: str) -> Dict[str, Any]:
    """
    Verificación rápida HEAD para saber si el stream está online
    Si HEAD falla con 405, intentar con GET
    
    Returns:
        Dict con 'is_online' (bool) y 'message' (str)
    """
    try:
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
        }
        
        # Intentar primero con HEAD
        request = urllib.request.Request(url, headers=headers, method='HEAD')
        
        try:
            with urllib.request.urlopen(request, timeout=10, context=ssl_context) as response:
                status_code = response.getcode()
                
                if status_code in [200, 201, 202, 204, 206, 403]:
                    return {'is_online': True, 'message': f'Online (HTTP {status_code})'}
                else:
                    return {'is_online': False, 'message': f'Unexpected status: {status_code}'}
        
        except urllib.error.HTTPError as e:
            # Si HEAD devuelve 405, intentar con GET
            if e.code == 405:
                request = urllib.request.Request(url, headers=headers, method='GET')
                with urllib.request.urlopen(request, timeout=10, context=ssl_context) as response:
                    status_code = response.getcode()
                    # Leer solo un poco para confirmar
                    response.read(4096)
                    
                    if status_code in [200, 201, 202, 204, 206, 403]:
                        return {'is_online': True, 'message': f'Online (HTTP {status_code} via GET)'}
                    else:
                        return {'is_online': False, 'message': f'Unexpected status: {status_code}'}
            else:
                raise  # Re-lanzar otros errores HTTP
    
    except Exception as e:
        return {'is_online': False, 'message': f'Connection failed: {str(e)}'}


def analyze_with_ffprobe(url: str) -> Optional[Dict[str, Any]]:
    """
    Analiza el stream con FFprobe para extraer información de calidad
    
    Returns:
        Dict con quality, resolution, codec, bitrate o None si falla
    """
    
    try:
        # Comando FFprobe optimizado para IPTV streams
        # Intentamos obtener info rápidamente sin analizar demasiado
        cmd = [
            FFPROBE_PATH,
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-select_streams', 'v:0',
            '-probesize', '5000000',      # Reducido a 5MB para ser más rápido
            '-analyzeduration', '5000000', # Reducido a 5 segundos
            url
        ]
        
        print(f"Running FFprobe with {FFPROBE_TIMEOUT}s timeout")
        
        # Ejecutar FFprobe con timeout más corto
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=FFPROBE_TIMEOUT,  # Usar timeout más corto
            check=False
        )
        
        print(f"FFprobe return code: {result.returncode}")
        
        if result.returncode != 0:
            if result.stderr:
                print(f"FFprobe stderr: {result.stderr[:200]}")
            return None
        
        # Parsear output JSON
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            print(f"Failed to parse FFprobe JSON: {e}")
            return None
        
        streams = data.get('streams', [])
        
        if not streams:
            print("No video streams found")
            return None
        
        stream = streams[0]
        
        # Extraer información
        width = stream.get('width')
        height = stream.get('height')
        codec_name = stream.get('codec_name', 'unknown')
        bit_rate = stream.get('bit_rate')
        
        # Convertir bitrate a int si existe
        if bit_rate:
            try:
                bit_rate = int(bit_rate)
            except (ValueError, TypeError):
                bit_rate = None
        
        # Determinar calidad basado en resolución
        quality = 'unknown'
        resolution_str = None
        
        if width and height:
            resolution_str = f"{width}x{height}"
            quality = determine_quality(width, height, bit_rate)
        elif bit_rate:
            # Si no tenemos resolución, usar bitrate
            quality = quality_from_bitrate(bit_rate)
        
        return {
            'quality': quality,
            'resolution': resolution_str,
            'codec': codec_name,
            'bitrate': bit_rate,
        }
    
    except subprocess.TimeoutExpired:
        print(f"FFprobe timeout after {FFPROBE_TIMEOUT}s")
        return None
    
    except Exception as e:
        print(f"FFprobe error: {str(e)}")
        return None


def determine_quality(width: int, height: int, bitrate: Optional[int] = None) -> str:
    """
    Determina la calidad basándose en resolución (y opcionalmente bitrate)
    
    Returns:
        '4K', 'FHD', 'HD', 'SD', o 'unknown'
    """
    
    # Primero por altura (más confiable)
    if height >= 2160 or width >= 3840:
        return '4K'
    elif height >= 1080 or width >= 1920:
        return 'FHD'
    elif height >= 720 or width >= 1280:
        return 'HD'
    elif height >= 480 or width >= 854:
        return 'SD'
    
    # Si la resolución es muy baja, usar bitrate como fallback
    if bitrate:
        return quality_from_bitrate(bitrate)
    
    return 'SD'


def quality_from_bitrate(bitrate: int) -> str:
    """
    Determina calidad solo por bitrate (menos preciso)
    
    Args:
        bitrate: en bps (bits per second)
        
    Returns:
        '4K', 'FHD', 'HD', 'SD', o 'unknown'
    """
    
    if bitrate >= 20_000_000:    # >= 20 Mbps
        return '4K'
    elif bitrate >= 8_000_000:   # >= 8 Mbps
        return 'FHD'
    elif bitrate >= 3_000_000:   # >= 3 Mbps
        return 'HD'
    elif bitrate >= 1_000_000:   # >= 1 Mbps
        return 'SD'
    
    return 'unknown'


# Para testing local
if __name__ == '__main__':
    test_event = {
        'queryStringParameters': {
            'url': 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
        }
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(json.loads(result['body']), indent=2))
