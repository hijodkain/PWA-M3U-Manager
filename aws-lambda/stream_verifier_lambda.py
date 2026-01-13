"""
Lambda Function para verificación SIMPLE de canales IPTV
Verifica si un canal está online (ok) o offline (failed)
NO detecta calidad - solo estado del stream
"""

import json
import urllib.request
import urllib.error
import ssl
from typing import Dict, Any

# Timeout configurable desde variables de entorno
import os
TIMEOUT_SECONDS = int(os.environ.get('TIMEOUT_SECONDS', '10'))


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handler principal de la Lambda
    
    Parámetros esperados en query string:
    - url: URL del canal a verificar (requerido)
    
    Respuesta:
    {
        "status": "ok" | "failed",
        "message": "descripción del resultado",
        "url": "url verificada"
    }
    """
    
    # Extraer parámetros del query string
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
                'message': 'Missing required parameter: url',
            })
        }
    
    # Verificar el canal
    result = verify_stream_simple(stream_url)
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(result)
    }


def verify_stream_simple(url: str) -> Dict[str, Any]:
    """
    Verifica si un stream está online usando una petición HTTP HEAD
    
    Args:
        url: URL del stream a verificar
        
    Returns:
        Dict con status ('ok' o 'failed') y mensaje
    """
    
    try:
        # Crear contexto SSL que acepte certificados autofirmados
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        # Configurar headers para simular un cliente legítimo
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
        }
        
        # Crear request
        request = urllib.request.Request(url, headers=headers, method='HEAD')
        
        # Hacer la petición con timeout
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS, context=ssl_context) as response:
            status_code = response.getcode()
            
            # Códigos de éxito
            if status_code in [200, 201, 202, 204, 206]:
                return {
                    'status': 'ok',
                    'message': f'Stream is online (HTTP {status_code})',
                    'url': url,
                    'statusCode': status_code,
                }
            # 403 a veces significa que el stream está online pero requiere headers específicos
            elif status_code == 403:
                return {
                    'status': 'ok',
                    'message': 'Stream is online but may require authentication',
                    'url': url,
                    'statusCode': status_code,
                }
            else:
                return {
                    'status': 'failed',
                    'message': f'Unexpected status code: {status_code}',
                    'url': url,
                    'statusCode': status_code,
                }
    
    except urllib.error.HTTPError as e:
        # Errores HTTP específicos
        if e.code == 403:
            # 403 puede significar que está online pero requiere autenticación
            return {
                'status': 'ok',
                'message': 'Stream is online but requires authentication',
                'url': url,
                'statusCode': 403,
            }
        else:
            return {
                'status': 'failed',
                'message': f'HTTP Error {e.code}: {e.reason}',
                'url': url,
                'statusCode': e.code,
            }
    
    except urllib.error.URLError as e:
        # Errores de conexión (timeout, DNS, etc)
        return {
            'status': 'failed',
            'message': f'Connection error: {str(e.reason)}',
            'url': url,
        }
    
    except Exception as e:
        # Cualquier otro error
        return {
            'status': 'failed',
            'message': f'Unexpected error: {str(e)}',
            'url': url,
        }


# Para testing local
if __name__ == '__main__':
    # Test event
    test_event = {
        'queryStringParameters': {
            'url': 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
        }
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(json.loads(result['body']), indent=2))
