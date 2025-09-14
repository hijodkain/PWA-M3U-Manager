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
                    <li><strong><Settings size={16} className="inline-block mr-1"/> Configuración:</strong> Aquí puedes guardar tus credenciales de Dropbox para no tener que introducirlas cada vez, y también puedes guardar tus URLs de playlists más usadas para cargarlas rápidamente desde el Editor.</li>
                </ul>
            </Section>

            <Section title="Cómo Obtener las Credenciales de Dropbox" icon={<Key className="text-yellow-400" />}>
                <p>
                    Para subir tu lista a Dropbox, necesitas credenciales de la API. Debido a cambios en la política de Dropbox, ahora el proceso es más seguro pero requiere algunos pasos manuales para obtener credenciales que no caduquen.
                </p>
                <p>Sigue estos pasos con atención:</p>
                <ol>
                    <li><strong>Ve a la Consola de Apps de Dropbox:</strong> <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Dropbox App Console</a>.</li>
                    <li><strong>Crea una nueva aplicación:</strong>
                        <ul className="list-disc list-inside">
                            <li>Haz clic en <strong>"Create app"</strong>.</li>
                            <li>Selecciona <strong>"Scoped access"</strong>.</li>
                            <li>Elige el tipo de acceso <strong>"App folder"</strong> para mayor seguridad.</li>
                            <li>Dale un nombre único a tu app (ej. "MiGestorM3U").</li>
                        </ul>
                    </li>
                    <li><strong>Configura los Permisos:</strong>
                        <ul className="list-disc list-inside">
                            <li>En la pestaña <strong>"Permissions"</strong>, busca y marca la casilla <code>files.content.write</code>.</li>
                            <li>Haz clic en <strong>"Submit"</strong> al final de la página.</li>
                        </ul>
                    </li>
                    <li><strong>Obtén el App Key y el App Secret:</strong>
                        <ul className="list-disc list-inside">
                            <li>Vuelve a la pestaña <strong>"Settings"</strong>.</li>
                            <li>Encontrarás tu <strong>App key</strong> y <strong>App secret</strong>. Copia ambos valores. Los necesitarás en la pestaña de Configuración de esta aplicación.</li>
                        </ul>
                    </li>
                    <li><strong>Genera el Refresh Token (Paso crucial):</strong>
                        <ul className="list-disc list-inside">
                            <li>Construye la siguiente URL en un editor de texto, reemplazando <code>YOUR_APP_KEY</code> con tu App Key:</li>
                            <li><pre className="bg-gray-900 p-2 rounded-md text-xs overflow-x-auto"><code>https://www.dropbox.com/oauth2/authorize?client_id=YOUR_APP_KEY&token_access_type=offline&response_type=code</code></pre></li>
                            <li>Pega esta URL en tu navegador.</li>
                            <li>Autoriza la aplicación en la página de Dropbox. Serás redirigido a una página en blanco o que da error, ¡no te preocupes! Copia el <strong>código de autorización</strong> de la URL (el valor del parámetro `code`).</li>
                            <li>Abre una terminal o línea de comandos en tu ordenador y ejecuta el siguiente comando, reemplazando <code>YOUR_AUTH_CODE</code>, <code>YOUR_APP_KEY</code>, y <code>YOUR_APP_SECRET</code> con tus valores:</li>
                            <li><pre className="bg-gray-900 p-2 rounded-md text-xs overflow-x-auto"><code>curl -X POST https://api.dropboxapi.com/oauth2/token -d grant_type=authorization_code -d code=YOUR_AUTH_CODE -u YOUR_APP_KEY:YOUR_APP_SECRET</code></pre></li>
                            <li>La respuesta será un JSON. Busca el valor de <strong>`refresh_token`</strong> y cópialo. ¡Este token es de larga duración!</li>
                        </ul>
                    </li>
                    <li><strong>Guarda las Credenciales:</strong>
                        <ul className="list-disc list-inside">
                            <li>Vuelve a esta aplicación, ve a la pestaña <strong>"Configuración"</strong>.</li>
                            <li>Pega el <strong>App Key</strong>, <strong>App Secret</strong> y <strong>Refresh Token</strong> en sus campos correspondientes y guarda.</li>
                        </ul>
                    </li>
                </ol>
                <p className="mt-4 font-bold">¡Listo! Ahora podrás subir tus listas a Dropbox sin que tu sesión caduque.</p>
            </Section>
        </div>
    );
};

export default HelpTab;
