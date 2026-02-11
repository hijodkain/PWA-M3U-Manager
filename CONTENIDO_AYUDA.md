# Bienvenido al Gestor de Listas M3U

Esta aplicación te permite gestionar tus listas de canales M3U de forma segura, sencilla y potente. Segura porque no se sube nada a el servidor de la app, todo ocurre en tu dispositivo. Puedes descargar la App pulsando Añadir a pantalla de inicio en tu dispositivo o Instalar app desde el naveagador de tu portatil. Maneja tus listas desde tu propio dropbox y comparte el enlace con quien quieras. Solo necesitas conexion para subir o descargar listas desde o hacia tu nube Dropbox privada. 
Puedes arreglar cada lista compartida a distancia, solo cárgala como principal en M3U Manager, ve a la pestaña Reparar, carga alguna lista de reparacion que tengas y sepas que funciona ( cualquier lista random que hayas encontrado por internet) selecciona el canal a reaparar en tu lista y el buscador inteligente buscará en la lista de reparación canales con el mismo nombre o parecido. cuando veas el canal que te es tan solo haz click sobre él y cambiará el stream roto de tu lista por el nuevo de la lista de reapración. (si quieres transferir el logo o cualquier otro atributo del canal de reapración al canal de tu lista solo tienes que haber selecionado el boton del atributo que quieras trasferir previamente.) Así de facíl. Luego ve a la pestaña Guardar, y pulsa actualizar en mi dropbox e inmediatamente estará disponible en todos los reproductores IPTV donde tengas esa lista. Sin cambiar el enlace, sin hacer nada más. Solo con actualizarla en el reproductor será suficiente. 

## Puedo usar una cuenta de Dropbox gratuita con M3U Manager?

Si, de hecho es muy recomendable que lo hagas así puesto que el enlace que se genera lleva datos que pueden ser sensibles,(y en manos alguien con conocimientos de hacking no tardaría mucho en poder acceder a tu cuenta. Por seguridad te recomiendo que no metas tus datos personales en esa cuenta, ni tu tarjeta de credito!. 

## Como conecto mi dropbox a M3U Manager? 
Ve a la pestaña Ajustes y sigue las instrucciones paso a paso. Obtendrás un API KEY (algo como esto: 013oeer0set7csz2) que tendrás que introducir en el hueco para ello. La primera vez te pedirá que vuelvas a acceder con tu usuario y contraseña a dropbox para autorizar a M3U Manager a acceder y darle un token de acceso. las siguientes veces que abras M3U Manager en ese dispositivo ya no será necesario que lo vuelvas a hacer, sencillamente verás en Inicio como estás conectado. 

## No tengo ninguna lista en dropbox ni nada, como empiezO?
solo tienes que pegar la URL de alguna lista que tengas y sepas que funciona en la pestaña Inicio, y se cargará. Puedes editarla, borrar canales, reordenarlos a tu gusto en el editor. Despues ve a la pestaña Guardar, pulsa el icono de subir que ves en el lateral, asignale un nombre para recordarlo (Primo_paco) y pulsa subir a mi Dropbox. y ya tienes esa lista en tu dropbox privada. 

## Como se que enlace tiene cada lista de mi dropbox?
Una vez tengas alguna lista subida, solo tienes que ir a Inicio y en el menu de la izquierda pulsar el icono de Dropbox que te llevará a la sección tus listas principales de Dropbox. al lado de cada lista verás un icono de compartir, si lo pulsas se copiará a tu portapapeles la URL de esa lista, modificada para que puedas entroducirla directamente en cualquier reproductor IPTV. Pásala a tu primo Paco por Whatsapp y que la meta en su IPTV player y ya está. 

## Puedo hacer que se vea que estan pasando en cada canal?
por supuesto, y con hacerlo una sola vez será suficiente! carga la lista que quieras sincronizar con la fuente EPG (electronic program guide) de tu proveedor. Ve a la pestaña Ajustes, pulsa el 2 icono lateral y añade la fuente de tu proveedor y ponle un nombre para reconocerla. Ve a la pestaña EPG, y verás tu lista de canales con los canales en rojo. Al lado verás que puedes cargar tu Fuente EPG. Cargalá y los canales que ya estén sincronizados con esa fuente EPG se volverán de color blanco. Los rojos deberás ir sincronizandolos uno por uno. Pulsa el canal a sincronizar, el buscador inteligente buscará el canal en la fuente EPG, cuando veas el correcto pulsalo y tu canal se actualiará para mostrar lo que estan pasando por ese canal. 
OLvidaté de sincronizar en el reproductor que usas cada canal con el de la fuente EPG que uses!

## No tengo proveedor de EPG, ¿Qué hago?

es fácil encontrar listas EPG en internet, algunas son gratuitas y otras de pago. Te dejo las gratuitas que considero mejores, tan solo tienes que darle al signo + que tienen y se añadiran. Todas las listas que añadas serán seleccionables en la pestaña EPG, en el bloque Fuentes EPG. 

## El buscador inteligente no encuentra apenas canales. ¿Qué hago?
El buscador se sirve de eliminar prefijos y sufijos que puede tener tu lista de canales. por ejemplo, en tu lista tienes un canal que se llama: "ES: La 1 HD (REEMPLAZO). Cuando lo pulses ese texto se pasará al buscador inteligente. Si no encuentra el canal en la EPG prueba a añadir los prefijos y sufijos que crees que le sobran al nombre de tu canal para que coincida con el de la fuente EPG. En este caso podias incluir el prefijo "ES: " y el sufijo. "(REEMPLAZO). Ahora el buscador inteligente buscará solo "La 1 HD". y es más probable que lo encuentre. Estos Prefijos y sufijos se mantendrán para otras búsquedas, por lo que no hace falta que vuelvas a escribirlo. 

## ¿qué botones tengo que tner pulsados en EPG para que funcionen la EPG con la lista? 
el 1 boton, el de OTT, hará que el ID de la fuente EPG pase al tvg-name, y el de Tivimate hace que pase al atriubto tvg-id del canal de tu lista. Depende de la manera que tenga el software para reproducir la lista necesitaremos uno u otro. Si no sabes bien como lo hace tu reproductor deja selecionados ambos. Si vas a usar TiviMate deja marcado ese boton. La mayoria de reproductores le listas IPTV usan el mismo modo de TiviMate.

## Tengo una mezcla de canales de varios paises y necesito usar varias fuentes EPG en mi reproductor IPTV para que funcione. que puedo hacer? 
Los canales que no encuentres en una fuente EPG puedes buscarlos en otra, luego tendrás que añadir ambas al reproductor IPTV (siempre que tenga esa opcion). 

## La URL de Fuente EPG de mi proveedor no la puedo cargar en M3U Manager, que hago? 
Muchas veces la fuente EPG puede que no se cargue, esto suele pasar porque te dan un enlace terminado en .xml.gz. (https://proveedor.iptv....guia.xml.gz) esto es porque lo que hace ese enlace es servirte la guia en un archivo comprimido y M3U Manager al vivir en el navegador no puede descomprimir archivos. te recomiendo que intentes introducir esa URL en un navegador web como chrome o Firefox y lo mas probable es que se te descargue ese archivo, (guia.xml.gz) descomprimelo en tu ordenador y tendrás el archivo .xml que si puede procesar M3U Manager. Añadelo con el botón Añadir archivo.xml y ya puedes sincronizar los canales de tu lista con los de ese archivo. Luego puedes añadir la URL que te dió tu proveedor junto con tu lista y el reproductor IPTV los unirá. 

## y los demás botones de la sección EPG,  ¿para qué sirven?
si pulsas el botón "Logo Si" cambiarás el logo de tu canal por el de la  fuente EPG, usalo si tu canal no tiene logo, o está desfasado, o simplemente porque te gusta más el de la fuente EPG; tu elijes. 



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

Ahora podrás subir tus listas a Dropbox desde la pestaña "Guardar" con un solo clic.

## Cómo Ordenar Mi lista
En la pestaña Editor puedes modificar la posicion de los canales indidualmente o en bloque si previamente los has seleccionado. Los puedes resituar agarrando por los 3 puntos que tiene a la izquierda y soltandolo en su nueva posicion. Tambien puedes cambiar el número de Orden y se le asignará esa posicion ( y las siguientes si hay más canales seleccionados). Puedes selecciona todos los canales que quieres al principio de tu lista y asignale el 1, todos aparecerán al principio de la lista y luego arrastrando y soltando ajusta las posiciones a tu gusto. Puedes editar cada campo de un canal haciendo doble click sobre el. Si hay varios selecionados al editar uno ese campo se replicará en todos los canales seleccionados. 

## Editar los nombres de los canales.
A veces los canales vienen con nombres como ES: LA 1 4K, ES: La 2 HD,.... puedes quitarle a todos el prefijo si selecionas todos los canales y en la Edicion de atributos que se despliega arriba tras soleccionarlos escribe el texto ES: en la caja de prefijos y se eliminará ese prefijo de todos los canales que lo contengan, si no lo contienen no sufrirán ningun cambio. Puedes hacer lo mismo con el sufijo 4K, por ejemplo, escribiendo 4K en sufijos. 

## Cómo 