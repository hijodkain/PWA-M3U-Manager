# Bienvenido al Gestor de Listas M3U

Esta aplicación te permite gestionar tus listas de canales M3U de forma sencilla y potente. Puedes cargar una lista desde una URL o un archivo local, editarla, limpiarla, asignarle una guía de programación (EPG) y guardarla de nuevo en tu ordenador o directamente en tu Dropbox.

## Guía de Pestañas

*   **Editor de Playlist:** Es la vista principal. Aquí puedes ver todos tus canales, cambiar su orden, editar sus nombres, URLs, logos, etc. También puedes añadir nuevos canales o eliminar los que no quieras.
*   **Reparación:** Esta pestaña te ofrece herramientas para una limpieza automática y masiva de tu lista. Puedes cargar listas de respaldo para reparar canales fallidos y transferir atributos entre canales.
*   **Asignar EPG:** Te permite cargar un archivo XMLTV (el formato estándar para guías de programación) y asignarlo a tus canales. La aplicación intentará encontrar la correspondencia automáticamente, pero también puedes asignarla manualmente.
*   **Guardar y Exportar:** Una vez que has terminado de editar, aquí puedes descargar el archivo .m3u resultante a tu ordenador o subirlo directamente a tu Dropbox.
*   **Configuración:** Aquí puedes guardar tus credenciales de Dropbox para no tener que introducirlas cada vez, y también puedes guardar tus URLs de playlists más usadas para cargarlas rápidamente desde el Editor.

## Cómo Conectar con Dropbox

Para poder subir tu lista de canales directamente a tu Dropbox, primero necesitas autorizar a esta aplicación. El proceso es seguro y solo le da permiso a la aplicación para escribir en su propia carpeta dedicada dentro de tu Dropbox.

Sigue estos sencillos pasos:

1.  **Ve a la Consola de Apps de Dropbox:** [Dropbox App Console](https://www.dropbox.com/developers/apps).
2.  **Crea una nueva aplicación:**
    *   Haz clic en el botón **"Create app"**.
    *   Selecciona la opción **"Scoped access"**.
    *   En el tipo de acceso, elige **"App folder"**. Esto es más seguro.
    *   Dale un nombre único a tu aplicación (por ejemplo: **MiGestorM3U**).
3.  **Configura los Permisos:**
    *   Una vez creada la app, ve a la pestaña **"Permissions"**.
    *   Busca la opción `files.content.write` y marca la casilla para darle permiso de escritura.
    *   Haz clic en **"Submit"** al final de la página para guardar los cambios.
4.  **Añade la URI de Redirección (¡Paso Importante!):**
    *   Vuelve a la pestaña **"Settings"**.
    *   Busca el campo **"Redirect URIs"** y haz clic en **"Add"**.
    *   Añade la URL exacta donde se ejecuta la aplicación. Para la versión en producción usa `https://m3umanager.cat` y `https://m3u-manager-dropbox-auth.vercel.app/`. Si la usas en desarrollo local, probablemente sea `http://localhost:3000`.
5.  **Obtén tu App Key:**
    *   En la misma pestaña **"Settings"**, copia el valor del campo **"App key"**.
6.  **Conecta la Aplicación:**
    *   Vuelve a esta aplicación y ve a la pestaña **"Configuración"**.
    *   Pega tu **App Key** en el campo correspondiente.
    *   Haz clic en el botón **"Conectar a Dropbox"**.
    *   Serás redirigido a la página de autorización de Dropbox. Acepta para permitir el acceso.
    *   ¡Y listo! La aplicación se conectará y guardará la autorización de forma segura en tu navegador.

Ahora podrás subir tus listas a Dropbox desde la pestaña "Guardarr" con un solo clic.

## Cómo Ordenar Mi lista
En la pestaña Editor puedes modificar la posicion de los canales indidualmente o en bloque si previamente los has seleccionado. Los puedes resituar agarrando por los 3 puntos que tiene a la izquierda y soltandolo en su nueva posicion. Tambien puedes cambiar el número de Orden y se le asignará esa posicion ( y las siguientes si hay más canales seleccionados). Puedes selecciona todos los canales que quieres al principio de tu lista y asignale el 1, todos aparecerán al principio de la lista y luego arrastrando y soltando ajusta las posiciones a tu gusto. Puedes editar cada campo de un canal haciendo doble click sobre el. Si hay varios selecionados al editar uno ese campo se replicará en todos los canales seleccionados. 

## Editar los nombres de los canales.
A veces los canales vienen con nombres como ES: LA 1 4K, ES: La 2 HD,.... puedes quitarle a todos el prefijo si selecionas todos los canales y en la Edicion de atributos que se despliega arriba tras soleccionarlos escribe el texto ES: en la caja de prefijos y se eliminará ese prefijo de todos los canales que lo contengan, si no lo contienen no sufrirán ningun cambio. Puedes hacer lo mismo con el sufijo 4K, por ejemplo, escribiendo 4K en sufijos. 

## Cómo 