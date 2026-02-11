import React from 'react';
import { HelpCircle, BookOpen, Key, Tv, Wand, ListMusic, Save, Settings, Download, Upload, Cloud, Edit3, Type } from 'lucide-react';

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
        <div className="space-y-6 pb-20">
            <Section title="Gestiona tus Listas IPTV sin Riesgos" icon={<HelpCircle className="text-blue-400" />}>
                <p>
                    Bienvenido al Gestor de Listas M3U. Esta aplicación te permite gestionar tus listas de canales de forma <strong>segura, sencilla y potente</strong>.
                </p>
                <div className="my-4 bg-blue-900/30 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="font-bold text-white mb-2">🔒 Seguridad y Privacidad</p>
                    <p>
                        Todo ocurre en tu dispositivo. <strong>No subimos nada a ningún servidor externo.</strong> Tus listas viajan directamente de tu navegador a tu Dropbox privado. Puedes instalar la App pulsando "Añadir a pantalla de inicio" o "Instalar aplicación" desde tu navegador.
                    </p>
                </div>
                <p>
                    Maneja tus listas desde tu propio Dropbox y comparte el enlace generado. Solo necesitas conexión para subir o descargar desde tu nube. ¡Olvídate de subir listas con tus credenciales a servidores desconocidos!
                </p>
            </Section>

            <Section title="Reparación Inteligente de Canales" icon={<Wand className="text-purple-400" />}>
                <p>
                    ¿Tienes canales caídos en tu lista principal? Arréglalos fácilmente usando listas "medicina":
                </p>
                <ol className="list-decimal list-inside space-y-2 mt-2">
                    <li><strong className="text-white">Carga tu lista</strong> principal en Inicio.</li>
                    <li>Ve a la pestaña <strong>Reparar</strong>.</li>
                    <li><strong>Carga una lista de reparación</strong> (cualquier lista M3U gratuita que encuentres por internet y sepas que funciona).</li>
                    <li>Selecciona el canal roto en tu lista (izquierda).</li>
                    <li>El <strong>Buscador Inteligente</strong> encontrará automáticamente canales similares en la lista de reparación (derecha).</li>
                    <li>Haz clic en el nuevo canal funcional y ¡listo! Se reemplazará el stream.</li>
                </ol>
                <p className="mt-2 text-sm text-gray-400">
                    💡 Tip: Si quieres copiar también el logo o el nombre del canal nuevo, activa los botones de atributos antes de hacer clic.
                </p>
                <div className="mt-4">
                    <p>Una vez terminada la reparación, ve a la pestaña <strong>Guardar</strong> y pulsa "Actualizar en mi Dropbox". La lista se actualizará mágicamente en todos tus reproductores IPTV al instante, sin cambiar el enlace.</p>
                </div>
            </Section>

            <Section title="Guía EPG: Sincronización Visual" icon={<Tv className="text-green-400" />}>
                <p>
                    ¿Cansado de ver "Sin información" en tu reproductor? Asigna la guía de programación (EPG) fácilmente:
                </p>
                <ol className="list-decimal list-inside space-y-2 mt-2">
                    <li>Ve a <strong>Ajustes</strong>, pestaña Fuentes EPG, y añade la URL de tu fuente EPG favorita (o usa las sugeridas).</li>
                    <li>En la pestaña <strong>EPG</strong>, verás tus canales en <span className="text-red-400 font-bold">ROJO</span> (sin asignar).</li>
                    <li>Carga tu fuente EPG. Los canales que coincidan automáticamente se pondrán en <span className="text-white font-bold">BLANCO</span>.</li>
                    <li>Para los restantes: Pulsa el canal rojo → El buscador encuentra el programa → Pulsa el correcto → ¡Asignado!</li>
                </ol>
                <p className="mt-4 font-bold text-yellow-400">
                    ¡Olvídate de tener que sincronizar manualmente cada canal en cada reproductor IPTV que uses! Hazlo aquí una vez y sirve para siempre.
                </p>
            </Section>

            <Section title="Cómo Conectar con Dropbox (Gratis y Seguro)" icon={<Cloud className="text-blue-500" />}>
                <p>
                    Te recomendamos usar una cuenta de Dropbox gratuita (2GB es más que suficiente para miles de listas).
                </p>
                
                <h3 className="font-bold text-white mt-4 mb-2">Pasos para conectar:</h3>
                <ol className="list-decimal list-inside space-y-2">
                     <li>Ve a la <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Consola de Apps de Dropbox</a>.</li>
                     <li>Crea una app tipo <strong>"Scoped access"</strong> y acceso <strong>"App folder"</strong> (Más seguro).</li>
                     <li>En la pestaña <strong>Permissions</strong>, marca <code>files.content.write</code>.</li>
                     <li>En <strong>Settings</strong> > <strong>Redirect URIs</strong> añade: <code>https://m3umanager.cat/</code> (o tu URL local).</li>
                     <li>Copia el <strong>App Key</strong>.</li>
                     <li>En esta App, ve a <strong>Ajustes</strong>, pega el App Key y pulsa "Conectar".</li>
                </ol>
            </Section>

            <Section title="Edición y Ordenación Avanzada" icon={<Edit3 className="text-orange-400" />}>
                <ul className="space-y-3">
                    <li>
                        <strong className="text-white flex items-center gap-2"><ListMusic size={16}/> Reordenar Canales:</strong>
                        En el Editor, arrastra desde los 3 puntos a la izquierda. O selecciona varios, edita el número de "Orden" del primero, y se reordenarán consecutivamente.
                    </li>
                    <li>
                        <strong className="text-white flex items-center gap-2"><Edit3 size={16}/> Edición en Bloque:</strong>
                        Selecciona múltiples canales y haz doble clic en uno. Cualquier cambio (nombre, grupo, logo) se aplicará a TODOS los seleccionados.
                    </li>
                    <li>
                        <strong className="text-white flex items-center gap-2"><Type size={16}/> Limpieza de Nombres:</strong>
                        ¿Canales con nombres sucios como "ES: LA 1 HD"? Selecciona todos, abre el editor masivo, y en la sección "Prefijos/Sufijos" escribe "ES:" para eliminarlo de golpe de todos los canales.
                    </li>
                </ul>
            </Section>

             <Section title="Compartir es Vivir" icon={<Upload className="text-pink-400" />}>
                <p>
                    Una vez subida tu lista a Dropbox desde la pestaña Guardar/Inicio:
                </p>
                <ol className="list-decimal list-inside mt-2">
                    <li>Ve al icono de Dropbox en la barra lateral de Inicio.</li>
                    <li>Busca tu lista y pulsa el icono de <strong>Compartir</strong>.</li>
                    <li>Se copiará un enlace directo especial para reproductores IPTV.</li>
                    <li>¡Pásaselo a tu primo Paco por WhatsApp y listo!</li>
                </ol>
            </Section>
        </div>
    );
};

export default HelpTab;
