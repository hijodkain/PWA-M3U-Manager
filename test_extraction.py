
#!/usr/bin/env python3
"""
Script de prueba para verificar la extracción de URLs .m3u8 de YouTube
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'api'))

from youtube_extractor import extract_youtube_stream, get_youtube_channel_info

def test_extraction(youtube_url):
    """Probar la extracción de un canal de YouTube"""
    print(f"Testing extraction for: {youtube_url}")
    print("-" * 60)
    
    # Probar extracción de stream
    result = extract_youtube_stream(youtube_url)
    
    # Manejar el nuevo formato de retorno (stream_url, debug_info)
    if isinstance(result, tuple):
        stream_url, debug_info = result
        
        # Mostrar información de debug
        if debug_info:
            print("🔍 Debug info:")
            for i, info in enumerate(debug_info, 1):
                print(f"   {i}. {info}")
            print()
    else:
        # Compatibilidad con formato anterior
        stream_url = result
        debug_info = []
    
    if stream_url:
        print(f"✅ Stream URL extraída: {stream_url}")
        print(f"   Longitud: {len(stream_url)} caracteres")
        print(f"   Contiene .m3u8: {'.m3u8' in stream_url}")
        print(f"   Es HTTPS: {stream_url.startswith('https://')}")
        print(f"   Dominio googlevideo: {'googlevideo.com' in stream_url}")
    else:
        print("❌ No se pudo extraer stream URL")
    
    print()
    
    # Probar extracción de información del canal
    channel_info = get_youtube_channel_info(youtube_url)
    print(f"📺 Información del canal:")
    print(f"   Título: {channel_info.get('title', 'N/A')}")
    print(f"   Thumbnail: {'Sí' if channel_info.get('thumbnail') else 'No'}")
    
    print("\n" + "=" * 60)
    
    return stream_url is not None

if __name__ == "__main__":
    # URLs de prueba (canales que suelen estar en vivo)
    test_urls = [
        "https://www.youtube.com/@CNN/live",
        "https://www.youtube.com/@BBCNews/live",
        "https://www.youtube.com/@SkyNews/live",
        "https://www.youtube.com/@DWNews/live"
    ]
    
    # Si se proporciona una URL como argumento, usar esa
    if len(sys.argv) > 1:
        test_urls = [sys.argv[1]]
    
    successful = 0
    total = len(test_urls)
    
    for url in test_urls:
        if test_extraction(url):
            successful += 1
    
    print(f"\nResumen: {successful}/{total} extracciones exitosas")
    
    if successful == 0:
        print("\n⚠️  Ninguna extracción fue exitosa. Posibles causas:")
        print("   - Los canales no están transmitiendo en vivo")
        print("   - Problema de conexión a internet") 
        print("   - YouTube cambió su estructura HTML")
        print("   - Falta la librería 'requests'")