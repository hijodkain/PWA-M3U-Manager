import React from 'react';
import { HelpCircle, BookOpen, Key, Tv, Wand, ListMusic, Save, Settings, Download, Upload } from 'lucide-react';

const HelpTab: React.FC = () => {
    const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-white flex items-center">
                {icon}
                <span className="ml-3">{title}</span>
            </h2>
            <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                {children}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <Section title="Bienvenido al Gestor de Listas M3U" icon={<HelpCircle className="text-blue-400" />}>
                <p>
                    Esta aplicación te permite gestionar tus listas de canales M3U de forma sencilla y potente. Puedes cargar una lista desde una URL o un archivo local, editarla, limpiarla, asignarle una guía de programación (EPG) y guardarla de nuevo en tu ordenador o directamente en tu Dropbox.
                </p>
            </Section>

            <Section title="Guía de Pestañas" icon={<BookOpen className="text-green-400" />}>
                <ul>
                    <li><strong><ListMusic size={16} className="inline-block mr-1"/> Editor de Playlist:</strong> Es la vista principal. Aquí puedes ver todos tus canales, cambiar su orden, editar sus nombres, URLs, logos, etc. También puedes añadir nuevos canales o eliminar los que no quieras.</li>
                    <li><strong><Wand size={16} className="inline-block mr-1"/> Curación:</strong> Esta pestaña te ofrece herramientas para una limpieza automática y masiva de tu lista. Puedes eliminar canales duplicados, quitar atributos que no uses o filtrar y borrar canales en bloque.</li>
                    <li><strong><Tv size={16} className="inline-block mr-1"/> EPG:</strong> Te permite cargar un archivo XMLTV (el formato estándar para guías de programación) y asignarlo a tus canales. La aplicación intentará encontrar la correspondencia automáticamente, pero también puedes asignarla manualmente.</li>
                    <li><strong><Save size={16} className="inline-block mr-1"/> Guardar y Exportar:</strong> Una vez que has terminado de editar, aquí puedes <Download size={16} className="inline-block mx-1"/>descargar el archivo .m3u resultante a tu ordenador o <Upload size={16} className="inline-block mx-1"/>subirlo directamente a tu Dropbox.</li>
                    <li><strong><Settings size={16} className="inline-block mr-1"/> Configuración:</strong> Aquí puedes guardar tu token de Dropbox para no tener que introducirlo cada vez, y también puedes guardar tus URLs de playlists más usadas para cargarlas rápidamente desde el Editor.</li>
                </ul>
            </Section>

            <Section title="Cómo Obtener el Token de Dropbox" icon={<Key className="text-yellow-400" />}>
                <p>
                    Para poder subir tu lista de canales a Dropbox, necesitas un "token de acceso". Es una clave que le da permiso a esta aplicación para escribir un archivo en tu nombre. La aplicación solo pedirá permiso para escribir en su propia carpeta.
                </p>
                <p>Sigue estos pasos para generarlo (solo necesitas hacerlo una vez):</p>
                <ol>
                    <li>Ve a la consola de aplicaciones de Dropbox haciendo clic aquí: <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Dropbox App Console</a>.</li>
                    <li>Haz clic en el botón <strong>"Create app"</strong>.</li>
                    <li>Selecciona la opción <strong>"Scoped access"</strong>.</li>
                    <li>En el tipo de acceso, elige <strong>"App folder"</strong>. Esto es más seguro, ya que solo le dará acceso a su propia carpeta dedicada.</li>
                    <li>Dale un nombre a tu aplicación. Puede ser lo que quieras, por ejemplo: <strong>MiGestorM3U</strong>.</li>
                    <li>Una vez creada la app, ve a la pestaña <strong>"Permissions"</strong>.</li>
                    <li>Busca la opción <code>files.content.write</code> y marca la casilla para darle permiso de escritura. Haz clic en "Submit" al final.</li>
                    <li>Vuelve a la pestaña <strong>"Settings"</strong> de tu aplicación de Dropbox.</li>
                    <li>En la sección "Generated access token", haz clic en el botón <strong>"Generate"</strong>.</li>
                    <li>Justo debajo, verás una opción llamada <strong>"Access token expiration"</strong>. Selecciona <strong>"No expiration"</strong> en el menú desplegable.</li>
                    <li>Ahora sí, haz clic en el botón <strong>"Generate"</strong>.</li>
                    <li>Copia el nuevo código largo que aparece. ¡Ese es tu token de larga duración!</li>
                    <li>Vuelve a esta aplicación, ve a la pestaña <strong>"Configuración"</strong> y pega el token en el campo correspondiente para guardarlo.</li>
                </ol>
            </Section>
        </div>
    );
};

export default HelpTab;
