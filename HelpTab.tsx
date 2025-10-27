import React from 'react';
import { HelpCircle, BookOpen, Key, Tv, Wand, ListMusic, Save, Settings, Download, Upload, Youtube } from 'lucide-react';

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
                    <li><strong><Youtube size={16} className="inline-block mr-1"/> YouTube Live:</strong> Añade canales de YouTube que transmiten en vivo a tu playlist. El sistema crea URLs proxy estables que se actualizan automáticamente cuando YouTube cambia la URL del stream.</li>
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

            <Section title="Gestión de Canales de YouTube Live" icon={<Youtube className="text-red-500" />}>
                <p>
                    La funcionalidad de YouTube Live te permite añadir canales que transmiten en vivo directamente a un archivo separado <strong>Youtube.m3u</strong> que se guarda localmente en tu navegador. El sistema extrae las URLs M3U8 directamente desde YouTube usando una Lambda en AWS.
                </p>
                <h4 className="font-semibold mt-4 mb-2">¿Cómo funciona?</h4>
                <ol>
                    <li><strong>Extracción automática:</strong> El sistema usa yt-dlp en AWS Lambda para extraer la URL del stream M3U8 en tiempo real desde YouTube.</li>
                    <li><strong>URLs directas M3U8:</strong> Se obtienen las URLs directas de Google Video que apuntan al stream en vivo en la mejor calidad disponible.</li>
                    <li><strong>Caché inteligente:</strong> Las URLs se cachean en DynamoDB durante 2 horas para evitar llamadas innecesarias a YouTube.</li>
                    <li><strong>Archivo separado:</strong> Los canales de YouTube se guardan en un archivo <code>Youtube.m3u</code> independiente que puedes descargar desde la pestaña de Configuración.</li>
                    <li><strong>Compatibilidad total:</strong> Las URLs M3U8 son completamente compatibles con cualquier reproductor (VLC, Kodi, TiviMate, etc.).</li>
                </ol>
                <h4 className="font-semibold mt-4 mb-2">Pasos para añadir un canal:</h4>
                <ol>
                    <li>Ve a la pestaña <strong>"YouTube Live"</strong></li>
                    <li>Pega la URL del canal de YouTube que esté transmitiendo en vivo</li>
                    <li>Opcionalmente personaliza el nombre del canal, logo y el grupo</li>
                    <li>Haz clic en <strong>"Añadir Canal"</strong></li>
                    <li>El sistema extraerá automáticamente el stream M3U8</li>
                    <li>Una vez listo, haz clic en <strong>"Guardar en Youtube.m3u"</strong> para añadirlos al archivo local</li>
                    <li>Ve a <strong>"Configuración"</strong> para gestionar, ver y descargar tu archivo <code>Youtube.m3u</code></li>
                </ol>
                <h4 className="font-semibold mt-4 mb-2">Tipos de URLs soportadas:</h4>
                <ul>
                    <li><code>https://www.youtube.com/@USERNAME/live</code> - Usuario en vivo (⭐ Recomendado)</li>
                    <li><code>https://www.youtube.com/watch?v=VIDEO_ID</code> - Videos/streams específicos</li>
                    <li><code>https://www.youtube.com/channel/CHANNEL_ID/live</code> - Canal en vivo</li>
                </ul>
                <h4 className="font-semibold mt-4 mb-2">Gestión del archivo Youtube.m3u:</h4>
                <ul>
                    <li>Todos los canales se guardan automáticamente en localStorage de tu navegador</li>
                    <li>Puedes ver la lista completa de canales en la pestaña <strong>"Configuración"</strong></li>
                    <li>Puedes eliminar canales individuales o limpiar toda la lista</li>
                    <li>Descarga el archivo <code>Youtube.m3u</code> actualizado en cualquier momento</li>
                    <li>El archivo se actualiza automáticamente cada vez que añades nuevos canales</li>
                </ul>
                <p className="mt-4 text-yellow-400">
                    <strong>⚠️ Importante:</strong> El canal debe estar transmitiendo en vivo en el momento de añadirlo. Las URLs M3U8 de YouTube son válidas por aproximadamente 6 horas y luego caducan. Para streams permanentes, necesitarás extraer nuevamente las URLs periódicamente desde la pestaña YouTube Live.
                </p>
            </Section>
        </div>
    );
};

export default HelpTab;
