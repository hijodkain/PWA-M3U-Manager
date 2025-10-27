import requests
import re
import dropbox
import difflib
import os
import configparser
import time
from urllib.parse import urlparse
from colorama import init, Fore, Style

# Inicializa colorama para que funcione en todas las terminales (Windows, Mac, Linux)
init(autoreset=True)

CONFIG_FILE = 'config.ini'
REPAIR_FOLDER = 'm3u_reparadores'
FINAL_FOLDER = 'REPARADOS xa Dropbox'

def load_config():
    """Carga la configuración desde el archivo config.ini."""
    config = configparser.ConfigParser()
    if os.path.exists(CONFIG_FILE):
        config.read(CONFIG_FILE)
    return config

def save_config(config):
    """Guarda la configuración en el archivo config.ini."""
    with open(CONFIG_FILE, 'w') as configfile:
        config.write(configfile)

def print_banner():
    """Imprime un banner de bienvenida atractivo."""
    print(Fore.CYAN + Style.BRIGHT + "=" * 70)
    print(Fore.CYAN + Style.BRIGHT + "      Validador, Reparador y Editor de Listas M3U (Versión Local)".center(70))
    print(Fore.CYAN + Style.BRIGHT + "=" * 70)
    print("\nEsta herramienta verificará, reparará y te permitirá editar tu lista M3U.\n")

def normalize_name(name):
    """Limpia un nombre de canal para una comparación más flexible."""
    name = name.lower()
    name = re.sub(r'\[.*?\]|\(.*?\)|hd|fhd|uhd|4k|sd|\+|plus|es|esp|españa', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def parse_m3u(content):
    """Parsea el contenido de un archivo M3U, capturando el group-title."""
    print(Fore.YELLOW + "[INFO] Parseando el archivo M3U...")
    extinf_pattern = re.compile(r'#EXTINF:-1(?:.*?tvg-id="([^"]*)")?(?:.*?group-title="([^"]*)")?.*?,(.*)')
    lines = content.split('\n')
    channels = []
    for i, line in enumerate(lines):
        if line.strip().startswith('#EXTINF'):
            match = extinf_pattern.match(line.strip())
            if match and i + 1 < len(lines) and lines[i+1].strip().startswith('http'):
                url = lines[i+1].strip()
                channels.append({
                    'tvg_id': match.group(1) or '',
                    'group_title': match.group(2) or 'Sin Grupo',
                    'name': match.group(3).strip(),
                    'url': url, 'extinf_line': line.strip(),
                    'status': 'pendiente', 'new_url': None
                })
    print(f"{Fore.GREEN}[INFO] Se encontraron {len(channels)} canales.")
    return channels

def check_channel(channel_url, session):
    """Verifica si una URL de canal está operativa."""
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = session.get(channel_url, timeout=5, stream=True, allow_redirects=True, headers=headers)
        if not (200 <= response.status_code < 400): return 'failed'
        content_type = response.headers.get('Content-Type', '').lower()
        if any(ct in content_type for ct in ['text/html', 'text/plain', 'application/json']):
            response.close(); return 'failed'
        response.close(); return 'ok'
    except requests.exceptions.RequestException:
        return 'failed'

def generate_new_m3u_content(channels):
    """
    Genera el contenido del nuevo archivo M3U en el orden exacto de la lista proporcionada.
    """
    content = ["#EXTM3U"]
    for channel in channels:
        content.append(channel['extinf_line'])
        content.append(channel['new_url'] or channel['url'])
    return "\n".join(content)

def save_to_dropbox(file_path, content, token):
    """Sube el contenido actualizado a Dropbox."""
    try:
        dbx = dropbox.Dropbox(token)
        dbx.files_upload(content.encode('utf-8'), file_path, mode=dropbox.files.WriteMode('overwrite'))
        print(f"\n{Fore.GREEN}{Style.BRIGHT}[ÉXITO] El archivo ha sido actualizado en Dropbox: {file_path}")
    except dropbox.exceptions.AuthError:
        print(f"\n{Fore.RED}[ERROR DE AUTENTICACIÓN] El token de acceso es inválido o ha expirado.")
    except Exception as e:
        print(f"\n{Fore.RED}[ERROR AL GUARDAR] No se pudo subir el archivo. Error: {e}")

def get_user_input(prompt, config, section, option):
    """Obtiene input del usuario, ofreciendo usar el valor guardado."""
    last_value = None
    if config.has_option(section, option):
        last_value = config.get(section, option)
    if last_value:
        use_last = input(f"{Fore.WHITE}El último valor para '{option}' fue '{last_value}'. ¿Quieres usarlo de nuevo? (s/n): ").lower()
        if use_last == 's':
            return last_value
    new_value = input(prompt)
    if 'DEFAULT' not in config: config.add_section('DEFAULT')
    config.set('DEFAULT', option, new_value)
    save_config(config)
    return new_value

def download_m3u_with_retries(url, session, save_location_folder="", max_retries=3, delay=5):
    """Descarga una URL con reintentos y la guarda localmente."""
    headers = {'User-Agent': 'Mozilla/5.0'}
    for attempt in range(max_retries):
        try:
            print(f"\n{Fore.YELLOW}[INFO] Descargando lista (intento {attempt + 1}/{max_retries})...")
            response = session.get(url, timeout=10, headers=headers)
            response.raise_for_status()
            
            if save_location_folder:
                try: filename = os.path.basename(urlparse(url).path) or f"lista_{int(time.time())}.m3u"
                except Exception: filename = f"lista_{int(time.time())}.m3u"
                
                full_path = os.path.join(save_location_folder, filename)
                with open(full_path, 'wb') as f: f.write(response.content)
                print(f"{Fore.GREEN}[INFO] Lista guardada localmente en: {full_path}")
            
            return response
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                print(f"{Fore.RED}[AVISO] Falló el intento {attempt + 1}: {type(e).__name__}. Reintentando en {delay} segundos...")
                time.sleep(delay)
            else:
                print(f"{Fore.RED}[ERROR] Todos los intentos de descarga fallaron.")
                return None

def add_new_channels(final_channel_list, source_channels):
    """Función interactiva para añadir nuevos canales a la lista final."""
    if not source_channels:
        return final_channel_list

    while True:
        if input(f"\n{Fore.WHITE}FASE 3: ¿Quieres añadir nuevos canales desde la lista de reparación? (s/n): ").lower() != 's':
            break

        categories = sorted(list(set(c['group_title'] for c in source_channels)))
        print(f"\n{Fore.CYAN}--- Elige una categoría para explorar ---")
        for i, cat in enumerate(categories): print(f"  [{i+1}] {cat}")
        
        try:
            cat_choice = int(input(f"\n{Fore.WHITE}Introduce el número de la categoría (o 0 para salir):\n> "))
            if cat_choice == 0: break
            
            selected_cat = categories[cat_choice - 1]
            channels_in_cat = [c for c in source_channels if c['group_title'] == selected_cat]
            
            print(f"\n{Fore.CYAN}--- Canales en '{selected_cat}' ---")
            for i, c in enumerate(channels_in_cat): print(f"  [{i+1}] {c['name']}")
            
            add_choices = input(f"\n{Fore.WHITE}Introduce los números de los canales a añadir, separados por comas (o presiona Enter para volver):\n> ")
            if not add_choices: continue

            for i_str in add_choices.split(','):
                new_channel = channels_in_cat[int(i_str.strip())-1]
                if not any(c['extinf_line'] == new_channel['extinf_line'] for c in final_channel_list):
                    final_channel_list.append(new_channel)
                    print(f"{Fore.GREEN}Añadido: {new_channel['name']}")
                else:
                    print(f"{Fore.YELLOW}Ya existe: {new_channel['name']}")
        
        except (ValueError, IndexError):
            print(f"{Fore.RED}[ERROR] Selección inválida.")
    
    return final_channel_list

def organize_channels(channel_list):
    """Función interactiva para reordenar o eliminar canales."""
    if not channel_list: return channel_list
    
    if input(f"\n{Fore.WHITE}FASE 4: ¿Quieres organizar la lista final ({len(channel_list)} canales)? (s/n): ").lower() != 's':
        return channel_list
        
    temp_list = list(channel_list)
    
    while True:
        print(f"\n{Fore.CYAN}--- Editor de Lista de Canales ---")
        print("Comandos: [l]istar, [m]over <origen> <destino>, [d]elete <numero>, [g]uardar y salir")
        cmd_input = input("> ").lower().split()
        
        if not cmd_input: continue
        cmd = cmd_input[0]

        if cmd == 'l':
            for i, c in enumerate(temp_list): print(f"  [{i+1}] {c['name']}")
        elif cmd == 'm' and len(cmd_input) == 3:
            try:
                origin = int(cmd_input[1]) - 1
                destination = int(cmd_input[2]) - 1
                channel_to_move = temp_list.pop(origin)
                temp_list.insert(destination, channel_to_move)
                print(f"{Fore.GREEN}Movido '{channel_to_move['name']}' a la posición {destination + 1}")
            except (ValueError, IndexError):
                print(f"{Fore.RED}Error en los números. Asegúrate de que son válidos.")
        elif cmd == 'd' and len(cmd_input) == 2:
            try:
                channel_to_delete = temp_list.pop(int(cmd_input[1]) - 1)
                print(f"{Fore.RED}Eliminado: {channel_to_delete['name']}")
            except (ValueError, IndexError):
                print(f"{Fore.RED}Número inválido.")
        elif cmd == 'g':
            print(f"{Fore.GREEN}Orden guardado.")
            return temp_list
        else:
            print(f"{Fore.RED}Comando no reconocido.")

def main():
    """Función principal del script."""
    print_banner()
    config = load_config()

    for folder in [REPAIR_FOLDER, FINAL_FOLDER]:
        if not os.path.exists(folder):
            print(f"{Fore.CYAN}[INFO] Creando carpeta: {folder}")
            os.makedirs(folder)

    m3u_url = get_user_input(Fore.WHITE + Style.BRIGHT + "Introduce la URL de tu archivo M3U de Dropbox:\n> ", config, 'DEFAULT', 'url')
    original_filename = os.path.basename(urlparse(m3u_url).path)
    if "dropbox.com" in m3u_url:
        m3u_url = m3u_url.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace("?dl=0", "").replace("?dl=1", "")

    with requests.Session() as session:
        response = download_m3u_with_retries(m3u_url, session, save_location_folder="")
        if not response: return

        # La lista original se mantiene como la base que se irá modificando
        channels_to_process = parse_m3u(response.text)
        if not channels_to_process: return

        # --- FASE 1: VERIFICACIÓN ---
        print(f"\n{Fore.CYAN}--- FASE 1: Verificando {len(channels_to_process)} canales ---")
        failed_channels = []
        for i, channel in enumerate(channels_to_process):
            print(f"[{i+1:03d}/{len(channels_to_process)}] Verificando '{channel['name']}'... ", end="")
            status = check_channel(channel['url'], session)
            if status == 'ok': print(Fore.GREEN + "OK")
            else:
                print(Fore.RED + "FALLO")
                failed_channels.append(channel)
        
        print(f"\n{Fore.CYAN}{Style.BRIGHT}--- Diagnóstico Completado ---")
        if not failed_channels:
            print(Fore.GREEN + "¡Felicidades! Todos los canales están operativos.")
        else:
            print(f"Se encontraron {Fore.RED}{len(failed_channels)}{Style.RESET_ALL} canales fallidos:")
            for fc in failed_channels: print(f"  - {fc['name']}")

        # --- FASE 2: REPARACIÓN ---
        source_channels = None
        if failed_channels and input(f"\n{Fore.WHITE}¿Quieres iniciar la FASE 2: Reparación Interactiva? (s/n): ").lower() == 's':
            source_url = input(f"\n{Fore.WHITE}Introduce la URL de la lista M3U de origen para reparar:\n> ")
            source_response = download_m3u_with_retries(source_url, session, save_location_folder=REPAIR_FOLDER)
            if source_response:
                source_channels = parse_m3u(source_response.text)
                
                categories = sorted(list(set(c['group_title'] for c in source_channels)))
                print(f"\n{Fore.CYAN}--- Selección de Categorías de Búsqueda ---")
                for i, cat in enumerate(categories): print(f"  [{i+1}] {cat}")
                selected_indices = input(f"\n{Fore.WHITE}Introduce los números de las categorías donde buscar (separados por comas):\n> ")
                try:
                    selected_cats = [categories[int(i)-1] for i in selected_indices.split(',')]
                    search_pool = [c for c in source_channels if c['group_title'] in selected_cats]
                except (ValueError, IndexError):
                    print(f"{Fore.RED}[ERROR] Selección inválida. Se buscará en todos los canales.")
                    search_pool = source_channels

                repaired_count = 0
                for fc in failed_channels:
                    excluded_matches = []
                    while True:
                        print(f"\n{Fore.CYAN}--- Reparando canal: {Style.BRIGHT}{fc['name']}{Style.RESET_ALL} ---")
                        available_to_show = [m for m in search_pool if m not in excluded_matches]
                        potential_matches = sorted(available_to_show, key=lambda x: difflib.SequenceMatcher(None, fc['name'], x['name']).ratio(), reverse=True)[:15]
                        
                        if not potential_matches:
                            print(f"{Fore.RED}No se encontraron más reemplazos posibles.")
                            break

                        for i, match in enumerate(potential_matches): print(f"  [{i+1}] {match['name']} ({match['group_title']})")
                        choice = input(f"\n{Fore.WHITE}Elige un número para probar, 'b' para buscar más, o 's' para saltar:\n> ").lower()
                        
                        if choice == 's': break
                        if choice == 'b':
                            excluded_matches.extend(potential_matches)
                            continue
                        try:
                            selected_match = potential_matches[int(choice)-1]
                            print(f"Probando enlace de '{selected_match['name']}'... ", end="")
                            if check_channel(selected_match['url'], session) == 'ok':
                                print(Fore.GREEN + "¡Funciona! Canal reparado.")
                                fc['new_url'] = selected_match['url']
                                repaired_count += 1
                                break
                            else:
                                print(Fore.RED + "Este enlace también falló.")
                                excluded_matches.append(selected_match)
                        except (ValueError, IndexError):
                            print(f"{Fore.RED}Opción inválida.")
        
        # --- FASE 3: AÑADIR CANALES ---
        final_list = add_new_channels(channels_to_process, source_channels)
        
        # --- FASE 4: ORGANIZAR CANALES ---
        final_list = organize_channels(final_list)

        # --- FASE 5: GUARDADO ---
        if input(f"\n{Fore.WHITE}¿Quieres guardar la lista final ({len(final_list)} canales)? (s/n): ").lower() == 's':
            final_content = generate_new_m3u_content(final_list)
            
            local_filename = f"{os.path.splitext(original_filename)[0]}_reparado.m3u"
            local_save_path = os.path.join(FINAL_FOLDER, local_filename)
            try:
                with open(local_save_path, 'w', encoding='utf-8') as f: f.write(final_content)
                print(f"\n{Fore.GREEN}[ÉXITO] Archivo final guardado localmente en: {local_save_path}")
            except Exception as e:
                print(f"\n{Fore.RED}[ERROR] No se pudo guardar el archivo localmente. Error: {e}")
                return

            if input(f"\n{Fore.WHITE}¿Subir también a Dropbox? (s/n): ").lower() == 's':
                file_path = get_user_input(f"{Fore.WHITE}1. Ruta en Dropbox (ej: /listas/mi_lista.m3u):\n> ", config, 'DEFAULT', 'ruta')
                if not file_path or not file_path.startswith('/'): return

                token = get_user_input(f"{Fore.WHITE}2. Pega tu token de acceso de Dropbox aquí:\n> ", config, 'DEFAULT', 'token')
                if not token: return
                
                save_to_dropbox(file_path, final_content, token)

        print("\n¡Proceso finalizado!")

if __name__ == "__main__":
    main()
