import React, { useState } from 'react';
import { HelpCircle, BookOpen, Key, Tv, Wand, ListMusic, Save, Settings, Download, Upload, Cloud, Edit3, Type, ChevronDown, ChevronUp } from 'lucide-react';

const HelpTab: React.FC = () => {
    const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));

    const toggleSection = (idx: number) => {
        setOpenSections(prev => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; idx: number }> = ({ title, icon, children, idx }) => {
        const isOpen = openSections.has(idx);
        return (
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                <button
                    onClick={() => toggleSection(idx)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-700/50 transition-colors focus:outline-none"
                >
                    <h2 className="text-lg font-bold text-white flex items-center">
                        {icon}
                        <span className="ml-3">{title}</span>
                    </h2>
                    {isOpen ? <ChevronUp size={20} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />}
                </button>
                {isOpen && (
                    <div className="px-6 pb-6 pt-2 prose prose-invert prose-sm max-w-none text-gray-300 border-t border-gray-700">
                        {children}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-20">
            <Section idx={0} title="Gestiona tus Listas IPTV sin Riesgos" icon={<HelpCircle className="text-blue-400" />}>
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

            <Section idx={1} title="Reparación Inteligente de Canales" icon={<Wand className="text-purple-400" />}>
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

            <Section idx={2} title="Guía EPG: Tutorial de Asignación Automática" icon={<Tv className="text-green-400" />}>
                <p>
                    Si quieres que tu reproductor muestre la programación de cada canal, en la pestaña <strong>EPG</strong> puedes vincular tu lista M3U con una <strong>fuente EPG</strong>. La app compara tus canales con los <strong>channel id</strong> de la guía y rellena automáticamente <strong>tvg-id</strong> o <strong>tvg-name</strong> según el modo que elijas.
                </p>

                <h3 className="font-bold text-white mt-4 mb-2">Paso 1: Añade una fuente EPG</h3>
                <ol className="list-decimal list-inside space-y-2 mt-2">
                    <li>Ve a <strong>Ajustes</strong> → <strong>Fuentes EPG</strong>.</li>
                    <li>Añade la URL de tu guía EPG y ponle un nombre reconocible.</li>
                    <li>Vuelve a la pestaña <strong>EPG</strong> y cárgala desde el bloque <strong>Fuente EPG</strong>.</li>
                </ol>

                <h3 className="font-bold text-white mt-4 mb-2">Paso 2: Elige cómo quieres asignar la guía</h3>
                <p>
                    En la columna central verás los botones <strong>ID</strong> y <strong>NAME</strong>:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                    <li><strong className="text-white">ID</strong>: compara y rellena el campo <strong>tvg-id</strong>.</li>
                    <li><strong className="text-white">NAME</strong>: compara y rellena el campo <strong>tvg-name</strong>.</li>
                </ul>
                <p className="mt-2">
                    Debajo del nombre de cada canal de tu lista principal se mostrará el valor activo: si has elegido <strong>ID</strong> verás el <strong>tvg-id</strong>, y si has elegido <strong>NAME</strong> verás el <strong>tvg-name</strong>.
                </p>

                <h3 className="font-bold text-white mt-4 mb-2">Paso 3: Usa los botones de la columna central</h3>
                <ul className="list-disc list-inside space-y-2 mt-2">
                    <li><strong className="text-white">OTT</strong>: copia el <strong>channel id</strong> de la fuente EPG al campo <strong>tvg-name</strong>.</li>
                    <li><strong className="text-white">TiviMate</strong>: copia el <strong>channel id</strong> de la fuente EPG al campo <strong>tvg-id</strong>.</li>
                    <li><strong className="text-white">Logo</strong>: copia el logo de la fuente EPG a tu canal.</li>
                    <li><strong className="text-white">NO LOGO</strong>: mantiene el logo actual del canal.</li>
                    <li><strong className="text-white">Nombre</strong>: copia el nombre del canal de la fuente EPG a tu lista.</li>
                    <li><strong className="text-white">Auto</strong>: intenta asignar automáticamente EPG a todos los canales visibles.</li>
                    <li><strong className="text-white">Rueda de ajustes</strong>: te lleva directamente a <strong>Ajustes</strong> → <strong>Fuentes EPG</strong>.</li>
                </ul>

                <div className="mt-4 bg-green-900/20 p-4 rounded-lg border-l-4 border-green-500">
                    <p className="font-bold text-white mb-2">Ejemplo práctico</p>
                    <p>
                        Supón que en tu lista tienes un canal llamado <strong>ES: LA 1 HD</strong>, pero en tu fuente EPG aparece como <strong>LA 1 HD</strong>. Si el prefijo <strong>ES: </strong> molesta en la búsqueda, puedes enseñarle a la app a ignorarlo y así aumentar mucho las coincidencias automáticas.
                    </p>
                </div>

                <h3 className="font-bold text-white mt-4 mb-2">Paso 4: Asignación automática</h3>
                <ol className="list-decimal list-inside space-y-2 mt-2">
                    <li>Activa <strong>ID</strong> o <strong>NAME</strong>, según el campo que quieras completar.</li>
                    <li>Activa también <strong>OTT</strong>, <strong>TiviMate</strong> o ambos, según tu reproductor.</li>
                    <li>Opcionalmente activa <strong>Logo</strong> y/o <strong>Nombre</strong>.</li>
                    <li>Pulsa el botón <strong>Sin EPG</strong> si quieres trabajar solo con los canales pendientes.</li>
                    <li>Pulsa <strong>Auto</strong>.</li>
                </ol>
                <p className="mt-2">
                    La app comprobará el campo seleccionado (<strong>tvg-id</strong> o <strong>tvg-name</strong>) contra los <strong>channel id</strong> reales de la fuente EPG cargada. Si encuentra coincidencia, marcará el canal como <strong>EPG OK</strong> y rellenará el atributo correspondiente.
                </p>

                <h3 className="font-bold text-white mt-4 mb-2">¿Qué hacer con los canales que no tienen coincidencia del 100%?</h3>
                <ol className="list-decimal list-inside space-y-2 mt-2">
                    <li>Pulsa el canal de tu lista principal a la izquierda.</li>
                    <li>La lista de la derecha se filtrará automáticamente con una búsqueda inteligente.</li>
                    <li>Si ves una coincidencia correcta aunque no llegue al <strong>100%</strong>, puedes pulsarla manualmente y quedará asignada igualmente.</li>
                    <li>Si no aparece arriba del todo, refina el texto del buscador usando los controles <strong>+</strong>, <strong>−</strong> y <strong>Añadir prefijo</strong>.</li>
                </ol>
                <p className="mt-2 text-sm text-gray-400">
                    No necesitas que todos estén al 100%. Muchas veces una coincidencia del 70%-90% ya es el canal correcto, especialmente si el nombre tiene prefijos del país, calidad o etiquetas adicionales.
                </p>

                <h3 className="font-bold text-white mt-4 mb-2">Cómo usar los botones + y − para añadir prefijos</h3>
                <p>
                    Cuando seleccionas un canal de tu lista, su nombre pasa al buscador de la derecha. Los botones <strong>+</strong> y <strong>−</strong> sirven para elegir cuántas letras iniciales quieres tomar como prefijo a eliminar en búsquedas futuras.
                </p>
                <ol className="list-decimal list-inside space-y-2 mt-2">
                    <li>Selecciona un canal con nombre <strong>ES: LA 1 HD</strong>.</li>
                    <li>En el buscador aparecerá ese texto.</li>
                    <li>Pulsa <strong>+</strong> hasta seleccionar el tramo inicial <strong>ES: </strong>.</li>
                    <li>Si te pasas, usa <strong>−</strong> para quitar la última letra seleccionada.</li>
                    <li>Cuando el prefijo seleccionado sea exactamente <strong>ES: </strong>, pulsa <strong>Añadir prefijo</strong>.</li>
                </ol>
                <p className="mt-2">
                    A partir de ese momento, el buscador inteligente ignorará ese prefijo en futuras comparaciones y será más fácil que <strong>ES: LA 1 HD</strong> coincida con <strong>LA 1 HD</strong> en la fuente EPG.
                </p>

                <h3 className="font-bold text-white mt-4 mb-2">Consejo final</h3>
                <p className="font-bold text-yellow-400">
                    Si no sabes qué modo usa tu reproductor, deja activos <strong>OTT</strong> y <strong>TiviMate</strong> para rellenar ambos campos. Así tendrás más compatibilidad con distintos reproductores IPTV.
                </p>
            </Section>

            <Section idx={3} title="Cómo Conectar con Dropbox (Gratis y Seguro)" icon={<Cloud className="text-blue-500" />}>
                <p>
                    Te recomendamos usar una cuenta de Dropbox gratuita (2GB es más que suficiente para miles de listas).
                </p>
                
                <h3 className="font-bold text-white mt-4 mb-2">Pasos para conectar:</h3>
                <ol className="list-decimal list-inside space-y-2">
                     <li>Ve a la <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Consola de Apps de Dropbox</a>.</li>
                     <li>Crea una app tipo <strong>"Scoped access"</strong> y acceso <strong>"App folder"</strong> (Más seguro).</li>
                     <li>En la pestaña <strong>Permissions</strong>, marca <code>files.content.write</code>.</li>
                     <li>En <strong>Settings</strong> &gt; <strong>Redirect URIs</strong> añade: <code>https://m3umanager.cat/</code> (o tu URL local).</li>
                     <li>Copia el <strong>App Key</strong>.</li>
                     <li>En esta App, ve a <strong>Ajustes</strong>, pega el App Key y pulsa "Conectar".</li>
                </ol>
            </Section>

            <Section idx={4} title="Edición y Ordenación Avanzada" icon={<Edit3 className="text-orange-400" />}>
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

             <Section idx={5} title="Compartir es Vivir" icon={<Upload className="text-pink-400" />}>
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
