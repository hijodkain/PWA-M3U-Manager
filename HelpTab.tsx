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
                    <li><strong><Wand size={16} className="inline-block mr-1"/> Reparación:</strong> Esta pestaña te ofrece herramientas para una limpieza automática y masiva de tu lista. Puedes cargar listas de respaldo para reparar canales fallidos y transferir atributos entre canales.</li>
                    <li><strong><Tv size={16} className="inline-block mr-1"/> Asignar EPG:</strong> Te permite cargar un archivo XMLTV (el formato estándar para guías de programación) y asignarlo a tus canales. La aplicación intentará encontrar la correspondencia automáticamente, pero también puedes asignarla manualmente.</li>
                    <li><strong><Save size={16} className="inline-block mr-1"/> Guardar y Exportar:</strong> Una vez que has terminado de editar, aquí puedes <Download size={16} className="inline-block mx-1"/>descargar el archivo .m3u resultante a tu ordenador o <Upload size={16} className="inline-block mx-1"/>subirlo directamente a tu Dropbox.</li>
                    <li><strong><Settings size={16} className="inline-block mr-1"/> Configuración:</strong> Aquí puedes guardar tus credenciales de Dropbox para no tener que introducirlas cada vez, y también puedes guardar tus URLs de playlists más usadas para cargarlas rápidamente desde el Editor.</li>
                </ul>
            </Section>

            <Section title="Cómo Conectar con Dropbox" icon={<Key className="text-yellow-400" />}>
                <p>
                    Para poder subir tu lista de canales directamente a tu Dropbox, primero necesitas autorizar a esta aplicación. El proceso es seguro y solo le da permiso a la aplicación para escribir en su propia carpeta dedicada dentro de tu Dropbox.
                </p>
                <p>Sigue estos sencillos pasos:</p>
                <ol>
                    <li><strong>Ve a la Consola de Apps de Dropbox:</strong> <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Dropbox App Console</a>.</li>
                    <li><strong>Crea una nueva aplicación:</strong>
                        <ul className="list-disc list-inside ml-4">
                            <li>Haz clic en el botón <strong>"Create app"</strong>.</li>
                            <li>Selecciona la opción <strong>"Scoped access"</strong>.</li>
                            <li>En el tipo de acceso, elige <strong>"App folder"</strong>. Esto es más seguro.</li>
                            <li>Dale un nombre único a tu aplicación (por ejemplo: <strong>MiGestorM3U</strong>).</li>
                        </ul>
                    </li>
                    <li><strong>Configura los Permisos:</strong>
                        <ul className="list-disc list-inside ml-4">
                            <li>Una vez creada la app, ve a la pestaña <strong>"Permissions"</strong>.</li>
                            <li>Busca la opción <code>files.content.write</code> y marca la casilla para darle permiso de escritura.</li>
                            <li>Haz clic en <strong>"Submit"</strong> al final de la página para guardar los cambios.</li>
                        </ul>
                    </li>
                    <li><strong>Añade la URI de Redirección (¡Paso Importante!):</strong>
                        <ul className="list-disc list-inside ml-4">
                            <li>Vuelve a la pestaña <strong>"Settings"</strong>.</li>
                            <li>Busca el campo <strong>"Redirect URIs"</strong> y haz clic en <strong>"Add"</strong>.</li>
                            <li>Añade la URL exacta donde se ejecuta la aplicación. Para la versión en producción usa <code>https://m3umanager.cat</code>. Si la usas en desarrollo local, probablemente sea <code>http://localhost:3000</code>.</li>
                        </ul>
                    </li>
                    <li><strong>Obtén tu App Key:</strong>
                        <ul className="list-disc list-inside ml-4">
                            <li>En la misma pestaña <strong>"Settings"</strong>, copia el valor del campo <strong>"App key"</strong>.</li>
                        </ul>
                    </li>
                    <li><strong>Conecta la Aplicación:</strong>
                        <ul className="list-disc list-inside ml-4">
                            <li>Vuelve a esta aplicación y ve a la pestaña <strong>"Configuración"</strong>.</li>
                            <li>Pega tu <strong>App Key</strong> en el campo correspondiente.</li>
                            <li>Haz clic en el botón <strong>"Conectar a Dropbox"</strong>.</li>
                            <li>Serás redirigido a la página de autorización de Dropbox. Acepta para permitir el acceso.</li>
                            <li>¡Y listo! La aplicación se conectará y guardará la autorización de forma segura en tu navegador.</li>
                        </ul>
                    </li>
                </ol>
                <p className="mt-4 font-bold">Ahora podrás subir tus listas a Dropbox desde la pestaña "Guardar y Exportar" con un solo clic.</p>
            </Section>
        </div>
    );
};

export default HelpTab;
