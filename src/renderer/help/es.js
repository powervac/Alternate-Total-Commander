'use strict';
// Ayuda, español. El formato está en help.js; los identificadores de las secciones son los mismos que en en.js.
HELP_TEXT.es = {
  ui: {
    title: 'Ayuda',
    search: 'Buscar en la ayuda',
    close: 'Cerrar',
    none: 'No se encontró nada.',
    found: '{n} coincidencias en {s} secciones',
    hint: 'F1 abre esta ayuda en cualquier momento.',
    keysIntro: 'Todos los comandos del programa con las teclas que tienen ahora. En un Mac, Ctrl es Cmd y Alt es Option. Puede cambiar cualquier tecla en Configuración > Atajos de teclado...; esta lista sigue sus cambios.',
    keysFoot: 'Además: Enter abre la carpeta, el archivo comprimido o el archivo bajo el cursor, Retroceso (Backspace) sube un nivel, Tab cambia de panel, las flechas, Inicio, Fin, RePág y AvPág mueven el cursor, Esc cierra los diálogos y los menús. El texto que escriba va a la línea de comandos de abajo.',
  },
  sections: [
    {
      id: 'start', t: 'Primeros pasos',
      h: `<p>Alternate Commander es un administrador de archivos con <b>dos paneles</b>, al estilo de Total Commander. Un panel está activo (su ruta aparece resaltada); el otro es el destino de las copias y los movimientos. Todo se puede hacer con el teclado, y todo tiene también una opción de menú o un botón.</p>
<ul>
<li><kbd>Tab</kbd> cambia el panel activo. Las flechas mueven el cursor, <kbd>Enter</kbd> abre una carpeta, un archivo comprimido o un archivo, <kbd>Backspace</kbd> sube un nivel.</li>
<li><kbd>F5</kbd> copia los archivos seleccionados al otro panel, <kbd>F6</kbd> los mueve, <kbd>F7</kbd> crea una carpeta, <kbd>F8</kbd> elimina, <kbd>F3</kbd> visualiza, <kbd>F4</kbd> edita. Estos botones también están en la parte inferior de la ventana.</li>
<li>El botón de la esquina superior izquierda de un panel abre la <b>lista de unidades</b> (<kbd>Alt+F1</kbd> para el panel izquierdo, <kbd>Alt+F2</kbd> para el derecho): discos, carpetas estándar, unidades de red, favoritos y sus conexiones a servidores y nubes.</li>
<li>El <b>menú</b> se abre con el ratón o con <kbd>F9</kbd> / <kbd>F10</kbd>. El último elemento, <b>Acerca de</b>, contiene esta ayuda y la ventana de versión y actualizaciones.</li>
</ul>
<p class="help-tip">¿Es la primera vez? Lea primero “Paneles, pestañas y navegación”, “Seleccionar archivos” y “Copiar, mover, renombrar, eliminar”. Los demás capítulos describen las funciones adicionales una por una; use el campo de búsqueda para encontrar una palabra.</p>
<p>Debajo de los paneles está la <b>línea de comandos</b>: escriba un comando y pulse Enter para ejecutarlo en la carpeta del panel activo; <code>cd carpeta</code> cambia en cambio la carpeta del panel activo. <kbd>Ctrl+Enter</kbd> pone en la línea de comandos el nombre del archivo bajo el cursor, <kbd>Ctrl+Shift+Enter</kbd> su ruta completa.</p>`,
    },
    {
      id: 'panels', t: 'Paneles, pestañas y navegación',
      h: `<h3>Carpetas y la lista de unidades</h3>
<p>La ruta de un panel se muestra encima de su lista; la línea inferior indica el número y el tamaño de los archivos seleccionados y de todos. <kbd>Alt+F1</kbd> / <kbd>Alt+F2</kbd> abren la lista de unidades del panel izquierdo / derecho. Contiene: los discos locales, las unidades de red asignadas (con la ruta de red), las carpetas estándar (Inicio, Escritorio, Documentos, Descargas ...), en Windows las distribuciones <b>WSL</b> instaladas y, debajo, sus conexiones abiertas y guardadas (NAS, SSH, FTP, WebDAV, Dropbox, Google Drive). En macOS se listan los volúmenes de <code>/Volumes</code> (también los recursos de red).</p>
<h3>Historial y volver</h3>
<p><kbd>Alt+Left</kbd> y <kbd>Alt+Right</kbd> retroceden y avanzan en el historial del panel. <kbd>Ctrl+U</kbd> intercambia los dos paneles; el menú Comandos también tiene “Destino=Origen”, que muestra la misma carpeta en el otro panel.</p>
<h3>Pestañas</h3>
<p>Cada panel tiene sus propias pestañas: <kbd>Ctrl+T</kbd> abre una nueva (una copia de la carpeta actual), <kbd>Ctrl+W</kbd> la cierra, <kbd>Ctrl+Tab</kbd> / <kbd>Ctrl+Shift+Tab</kbd> se mueven entre ellas y <kbd>Ctrl+Up</kbd> abre la carpeta (o el archivo comprimido) bajo el cursor en una pestaña nueva. Las pestañas se recuerdan al cerrar el programa.</p>
<h3>Orden y vistas</h3>
<p>Pulse el encabezado de una columna o <kbd>Ctrl+F3</kbd> (nombre), <kbd>Ctrl+F4</kbd> (extensión), <kbd>Ctrl+F5</kbd> (fecha), <kbd>Ctrl+F6</kbd> (tamaño). La misma tecla otra vez invierte el orden. <kbd>Ctrl+Shift+F4</kbd> cambia el panel a <b>miniaturas</b> (imágenes, fotogramas de vídeo, PDF y documentos); <kbd>Ctrl+Q</kbd> convierte el otro panel en una <b>vista rápida</b> del archivo bajo el cursor. <kbd>Ctrl+R</kbd> vuelve a leer la carpeta.</p>
<h3>Directorios favoritos</h3>
<p><kbd>Ctrl+D</kbd> abre sus carpetas favoritas. La carpeta actual se puede añadir a la lista, incluida la carpeta actual de un disco en la nube, un NAS o un servidor SSH, FTP o WebDAV: al elegir un favorito así, el programa vuelve a conectar si hace falta y va directamente allí. Los favoritos de Total Commander se importan una vez desde <code>wincmd.ini</code>, si el programa lo encuentra.</p>`,
    },
    {
      id: 'select', t: 'Seleccionar archivos',
      h: `<p>La mayoría de los comandos actúan sobre los archivos <b>seleccionados</b> o, si no hay ninguno, sobre el archivo bajo el cursor. Los nombres seleccionados se muestran con otro color.</p>
<ul>
<li><kbd>Insert</kbd> selecciona el archivo y baja; <kbd>Space</kbd> selecciona y se queda (en una carpeta calcula además el tamaño total de su contenido, que se muestra en la columna Tamaño).</li>
<li><kbd>Num +</kbd> selecciona un grupo por máscara (<code>*.jpg</code>, <code>report*.*</code>), <kbd>Num -</kbd> deselecciona un grupo, <kbd>Num *</kbd> invierte la selección, <kbd>Ctrl+A</kbd> selecciona todo, <kbd>Ctrl+Num -</kbd> deselecciona todo.</li>
<li><kbd>Alt+Num +</kbd> selecciona todos los archivos con la misma extensión que el archivo bajo el cursor.</li>
<li>Con el ratón: <kbd>Ctrl</kbd>+clic añade o quita un archivo. Con el teclado: mantenga <kbd>Shift</kbd> mientras mueve el cursor con las flechas.</li>
</ul>
<p>El menú <b>Marcar</b> tiene los mismos comandos y también “Copiar nombres seleccionados” y un comando igual con las rutas completas (útil para pegar una lista de archivos en un mensaje). <b>Comparar directorios</b> (<kbd>Shift+F2</kbd>) selecciona, en los dos paneles, los archivos que faltan en el otro panel o que son más nuevos o distintos (dos carpetas normales, no archivos comprimidos ni servidores).</p>`,
    },
    {
      id: 'ops', t: 'Copiar, mover, renombrar, eliminar',
      h: `<ul>
<li><b>Copiar / Mover</b> (<kbd>F5</kbd> / <kbd>F6</kbd>): el cuadro muestra el destino (la carpeta del otro panel); puede cambiarlo o dar un nombre nuevo. Si un archivo ya existe, el programa pregunta si se debe sobrescribir u omitir los existentes. Las carpetas se copian con todo su contenido.</li>
<li><b>Renombrar</b>: <kbd>F2</kbd> o <kbd>Shift+F6</kbd> pide el nuevo nombre del archivo bajo el cursor. <b>Renombrar varios</b> (<kbd>Ctrl+M</kbd>) cambia el nombre de muchos archivos con máscaras de nombre y extensión (<code>[N]</code> nombre, <code>[C]</code> contador, <code>[YMD]</code> fecha, partes del nombre antiguo), con búsqueda y reemplazo, vista previa y ajustes predefinidos guardados.</li>
<li><b>Carpeta nueva</b>: <kbd>F7</kbd>. <b>Editar archivo nuevo</b>: <kbd>Shift+F4</kbd>.</li>
<li><b>Eliminar</b>: <kbd>F8</kbd> o <kbd>Delete</kbd> envía los archivos a la Papelera; <kbd>Shift+F8</kbd> o <kbd>Shift+Delete</kbd> los elimina de forma permanente. En servidores y archivos comprimidos no hay Papelera: los archivos se quitan al instante. En Dropbox los archivos eliminados se guardan 30 días; en Google Drive van a su Papelera.</li>
<li><b>Propiedades</b> (<kbd>Alt+Enter</kbd>), <b>Calcular espacio ocupado...</b> (<kbd>Ctrl+L</kbd>) y <b>Cambiar atributos...</b> están en el menú Archivos.</li>
</ul>
<h3>Progreso, segundo plano y cola</h3>
<p>Las tareas largas muestran una ventana de progreso con el nombre del archivo, la velocidad y un botón <b>Cancelar</b>. <b>Pausa</b> detiene la tarea un rato. <b>En segundo plano</b> envía la tarea a la cola y le devuelve la ventana; en el cuadro de copia lo mismo es el botón <b>F2 Cola</b> (la tarea va directamente a la cola, sin ventana de progreso); la ventana de la cola lista las tareas en espera, que se ejecutan una tras otra, y puede reordenarlas o cancelarlas. La copia entre dos discos remotos (por ejemplo, de Dropbox a un NAS) pasa automáticamente por una carpeta temporal de este equipo.</p>
<p class="help-tip">Para copiar un archivo desde un servidor o un archivo comprimido, abra la carpeta de destino en el otro panel y pulse <kbd>F5</kbd>. Para copiar a un servidor o a un archivo comprimido, ábralo primero en el otro panel.</p>`,
    },
    {
      id: 'archives', t: 'Archivos comprimidos',
      h: `<p>Los archivos comprimidos se abren como carpetas: <kbd>Enter</kbd> sobre uno muestra su contenido, <kbd>Backspace</kbd> en el nivel superior sale de él. <kbd>F3</kbd> visualiza un archivo de dentro, <kbd>F5</kbd> copia archivos hacia fuera.</p>
<table>
<tr><th>Formato</th><th>Examinar y copiar hacia fuera</th><th>Cambiar en el sitio</th><th>Comprimir</th></tr>
<tr><td>zip</td><td>sí</td><td>sí (añadir, eliminar, renombrar, carpeta nueva, editar y guardar un archivo)</td><td>sí</td></tr>
<tr><td>7z, tar, tar.gz (tgz), tar.bz2, tar.xz, cab, gz, bz2, xz</td><td>sí</td><td>no (solo lectura)</td><td>7z, tar, tar.gz, tar.bz2, tar.xz, gz, bz2, xz</td></tr>
<tr><td>rar</td><td>sí</td><td>no</td><td>no (solo extraer)</td></tr>
</table>
<ul>
<li><kbd>Alt+F5</kbd> <b>comprime</b> los archivos seleccionados (elija el formato y el nombre; progreso y cancelación como al copiar). <kbd>Alt+F9</kbd> <b>descomprime</b> los archivos comprimidos seleccionados, o solo los archivos seleccionados de uno abierto.</li>
<li><kbd>Alt+Shift+F9</kbd> <b>prueba</b> los archivos comprimidos (comprueba que no estén dañados). Menú Archivos: <b>Dividir archivo...</b> y <b>Combinar archivos...</b> (con el archivo <code>.crc</code> de Total Commander).</li>
<li>Un archivo comprimido de un servidor NAS o SSH se descarga a una copia temporal y se abre en solo lectura; se pueden copiar archivos desde él. Copiar directamente entre dos archivos comprimidos aún no es posible: use una carpeta intermedia.</li>
</ul>`,
    },
    {
      id: 'search', t: 'Buscar archivos',
      h: `<p><b>Comandos > Buscar...</b> (<kbd>Alt+F7</kbd>) abre la ventana de búsqueda.</p>
<ul>
<li><b>Nombres:</b> varias máscaras separadas por <code>;</code> y exclusiones después de <code>|</code>, por ejemplo <code>*.js;*.ts|node_modules/</code>, o una expresión regular. Busque en una o varias carpetas, solo en los elementos seleccionados, con límite de profundidad, y nombres dentro de archivos zip.</li>
<li><b>Texto dentro de los archivos:</b> palabras completas, mayúsculas y minúsculas, expresión regular, bytes hexadecimales, “no contiene”; se prueban las codificaciones ANSI, DOS, UTF-8 y UTF-16; también se encuentra el texto dentro de archivos docx, xlsx, pptx y OpenDocument.</li>
<li><b>Filtros:</b> fecha (entre, más nuevos o más antiguos que), tamaño, atributos. <b>Duplicados:</b> archivos con el mismo nombre, el mismo tamaño o el mismo contenido.</li>
<li>Haga doble clic en un resultado para ir al archivo; <b>Al panel (lista)</b> muestra todos los resultados como una lista en un panel, donde F3, F5, F8 y los demás comandos actúan sobre ellos.</li>
</ul>
<h3>Índice de archivos (búsqueda rápida)</h3>
<p>Configuración > <b>Índice de archivos (búsqueda rápida)...</b> crea un índice de los nombres de archivo de las carpetas que elija (en segundo plano; se guarda comprimido en la carpeta de datos del programa). Con “Usar el índice” marcado, las búsquedas por nombre, tamaño y fecha son instantáneas cuando todas las carpetas buscadas están dentro de carpetas indexadas; si no, se hace la búsqueda normal en el disco. La búsqueda de texto dentro de los archivos siempre lee los archivos.</p>`,
    },
    {
      id: 'viewer', t: 'Visor, editor y vista rápida',
      h: `<h3>Visor (F3)</h3>
<p>Muestra el archivo bajo el cursor sin abrir otro programa: texto con detección automática de la codificación (UTF-8, UTF-16, Windows-1251, CP866 ...; la lista Codificación, arriba, la cambia), volcado hexadecimal, imágenes, PDF, vídeo y audio. Los <b>documentos</b> (docx, xlsx, pptx, OpenDocument y los antiguos doc y rtf como texto sin formato) los dibuja el propio programa, con títulos, listas, tablas e imágenes, así que no hacen falta Word ni Office. Los formatos de vídeo y audio que el motor no reproduce (HEVC, AVI, WMV, AC3, APE, WavPack, ALAC, AIFF ...) los convierte al vuelo el ffmpeg incluido. En el visor, <kbd>F7</kbd> busca texto, <kbd>N</kbd> y <kbd>P</kbd> muestran el archivo siguiente y el anterior de la carpeta, <kbd>Esc</kbd> lo cierra. También funciona con archivos dentro de archivos comprimidos y en servidores (el archivo se descarga antes a un lugar temporal).</p>
<h3>Editor (F4)</h3>
<p>Un editor de texto sencillo que conserva la codificación, el BOM y los finales de línea del archivo, con buscar y reemplazar. Edita archivos dentro de archivos zip y en servidores NAS, SSH, FTP y WebDAV y los guarda de vuelta. <kbd>Shift+F4</kbd> crea un archivo nuevo. La fuente y el tabulador se ajustan en Configuración > <b>Editor...</b>.</p>
<h3>Vista rápida (Ctrl+Q)</h3>
<p>El otro panel muestra una vista previa del archivo bajo el cursor y sigue al cursor. <kbd>Ctrl+Q</kbd> otra vez devuelve la lista de archivos.</p>
<p>Otras formas de abrir un archivo: <kbd>Enter</kbd> lo ejecuta con la aplicación que el sistema tiene para él; Archivos > <b>Abrir con la aplicación predeterminada</b> hace lo mismo con cualquier archivo.</p>`,
    },
    {
      id: 'media', t: 'Música y vídeo',
      h: `<h3>Reproductor de música</h3>
<p><kbd>Enter</kbd> sobre un archivo de audio inicia el reproductor: aparece una barra encima de los botones de las teclas de función y la música sigue sonando mientras usted navega. Los demás archivos de audio de la carpeta forman la cola. La barra tiene anterior / pausa-reproducir / siguiente, un control de posición, aleatorio, repetir (no / todo / una), volumen y un botón que cierra el reproductor.</p>
<ul>
<li>Atajos: <kbd>Ctrl+Space</kbd> (macOS: <kbd>Option+Space</kbd>) pausa / reproduce, <kbd>Ctrl+Shift+Right</kbd> / <kbd>Ctrl+Shift+Left</kbd> pista siguiente / anterior. Las teclas multimedia del teclado también funcionan. El menú Comandos tiene los mismos elementos.</li>
<li>mp3, FLAC, WAV, OGG, Opus, AAC y M4A se reproducen directamente; APE, WavPack, ALAC, AIFF, WMA, DSD, AC3, DTS, MPC y otros los decodifica el ffmpeg incluido.</li>
<li>La música de un panel NAS, SSH, FTP, WebDAV, Dropbox o Google Drive se reproduce en flujo: empieza al instante y se puede saltar a cualquier punto de la pista.</li>
</ul>
<h3>Música de chip (ZX Spectrum, Atari ST, Amstrad)</h3>
<p>El mismo reproductor toca módulos para el chip de sonido AY-3-8910 / YM2149: <b>PT3, PT2, PT1, STC, ST1, ST3, STP, SQT, ASC, PSC, PSM, FTC, GTR, AY, AYC, PSG, TSD, VTX y YM</b>. El chip se emula; antes del primer sonido el programa prepara toda la pista (alrededor de un segundo por unos minutos de música, “rendering...” en el título) y después se puede avanzar y retroceder como en cualquier otro archivo. El título viene del módulo.</p>
<h3>Vídeo</h3>
<p><kbd>F3</kbd> o <kbd>Enter</kbd> sobre un vídeo lo abre en el visor, con búsqueda en la línea de tiempo, también desde servidores y nubes.</p>`,
    },
    {
      id: 'nas', t: 'Synology NAS',
      h: `<p><b>Red > Synology NAS...</b> (<kbd>Ctrl+F</kbd>) se conecta al File Station de un Synology DiskStation y lo muestra como un disco.</p>
<ol>
<li>Dirección: la dirección local con el puerto de DSM (por ejemplo <code>nas.local:5001</code> o <code>192.168.1.20:5000</code>) o una dirección <b>QuickConnect</b> (<code>https://id.region.quickconnect.to</code> o solo el id). QuickConnect necesita unos segundos para encontrar el camino hasta el NAS.</li>
<li>Usuario y contraseña; el código de la <b>verificación en dos pasos</b>, si está activada en la cuenta.</li>
<li>“Permitir un certificado no fiable” es para un NAS con certificado autofirmado. “Recordar la contraseña” la guarda cifrada por el sistema operativo.</li>
<li><b>Conectar</b>. La conexión se guarda en la lista de la izquierda de la ventana; la próxima vez haga doble clic en ella.</li>
</ol>
<p>En el panel puede examinar, copiar en ambos sentidos (con progreso), crear carpetas, renombrar, eliminar, visualizar, editar y reproducir vídeo y música en flujo. <b>Red > Desconectar (NAS / SSH)</b> cierra la conexión; la lista de unidades (<kbd>Alt+F1</kbd>) muestra las abiertas y permite volver a ellas.</p>`,
    },
    {
      id: 'ssh', t: 'SSH, SFTP y la consola',
      h: `<p><b>Red > Servidor SSH...</b> (<kbd>Ctrl+Shift+F</kbd>) se conecta con contraseña o con un archivo de clave (OpenSSH, PEM; las claves de PuTTY versión 2 se convierten).</p>
<ul>
<li><b>Abrir como:</b> “Disco” muestra la lista de archivos del servidor (SFTP), “Consola” abre primero un terminal de verdad. <kbd>Ctrl+O</kbd> cambia entre ambos en cualquier momento; la consola conserva su historial.</li>
<li>En la <b>consola</b> todas las teclas pertenecen al servidor, salvo <kbd>Ctrl+O</kbd>. Los archivos copiados con <kbd>F5</kbd> o soltados en la consola se suben a la carpeta en la que está la consola ahora.</li>
<li><b>Clave del host:</b> la primera vez el programa muestra la huella del servidor y pide confiar en ella; se recuerda, y una clave que cambia se avisa como advertencia (puede significar un ataque o un servidor reinstalado).</li>
<li><b>Abrir en PuTTY</b> (menú Red o el botón de la ventana) inicia PuTTY con la misma conexión, si PuTTY está instalado.</li>
<li>Los archivos remotos se pueden visualizar, editar, copiar y arrastrar desde el panel a otra aplicación.</li>
</ul>
<h3>Importar de WinSCP</h3>
<p><b>Red > Importar de WinSCP...</b> lee las sesiones de WinSCP (del registro o de un archivo <code>WinSCP.ini</code> que usted elija) y crea conexiones: las sesiones SFTP / SCP pasan a ser conexiones SSH (sus archivos de clave se copian a la carpeta protegida del propio programa), las sesiones FTP y WebDAV pasan a ser conexiones FTP y WebDAV. Las contraseñas no se importan: escríbalas en la primera conexión. Las sesiones S3 no son compatibles.</p>`,
    },
    {
      id: 'ftp', t: 'FTP, FTPS y WebDAV',
      h: `<h3>FTP y FTPS</h3>
<p><b>Red > Servidor FTP / FTPS...</b></p>
<table>
<tr><td>Host</td><td>el nombre del servidor, opcionalmente con puerto: <code>ftp.example.com</code> o <code>ftp.example.com:2121</code></td></tr>
<tr><td>Seguridad</td><td><b>FTP sobre TLS (explícito)</b> es el recomendado: puerto 21, la conexión se eleva a TLS. <b>TLS implícito</b> es el puerto 990. <b>FTP simple</b> envía la contraseña sin cifrar: úselo solo en una red de confianza.</td></tr>
<tr><td>Usuario, Contraseña</td><td>o pulse <b>Acceso anónimo</b> (usuario <code>anonymous</code>, una contraseña con forma de correo electrónico).</td></tr>
<tr><td>Carpeta remota</td><td>opcional: la carpeta que se abre primero, por ejemplo <code>/public_html</code></td></tr>
<tr><td>Carpeta local</td><td>opcional: el otro panel va a esta carpeta al conectar.</td></tr>
<tr><td>Mantener conexión</td><td>opcional: enviar un NOOP cada N segundos para que un servidor con un límite corto de inactividad no cierre la conexión. (Una conexión que el servidor cerró se vuelve a abrir sola.)</td></tr>
<tr><td>Tras el acceso</td><td>comandos FTP opcionales enviados después de iniciar sesión, separados por <code>;</code></td></tr>
</table>
<p>“Permitir un certificado no fiable” es para un servidor con certificado TLS autofirmado. El programa usa el modo pasivo (el que funciona a través de routers y cortafuegos).</p>
<h3>WebDAV</h3>
<p><b>Red > Servidor WebDAV...</b> admite la dirección completa de la carpeta WebDAV: Nextcloud / ownCloud <code>https://cloud.example.com/remote.php/dav/files/NOMBRE/</code>, Synology, Apache, nginx, IIS, Box y otros. El acceso puede ser Basic o Digest; un usuario vacío conecta sin acceso. Una redirección a otro servidor no se lleva su contraseña.</p>
<p>Los dos tipos funcionan como los paneles NAS y SSH: examinar, copiar en ambos sentidos con progreso, crear, renombrar, eliminar, visualizar, editar y reproducir vídeo y música en flujo con búsqueda en la línea de tiempo. Notas: un servidor que no da fechas de modificación muestra fechas vacías; se esperan nombres en UTF-8; no hay bloqueos de archivos en WebDAV.</p>`,
    },
    {
      id: 'cloud', t: 'Dropbox y Google Drive',
      h: `<p><b>Red > Dropbox...</b> y <b>Red > Google Drive...</b> muestran la nube como un disco normal. No hace falta el cliente de escritorio de Dropbox ni de Google.</p>
<ol>
<li>Pulse el botón de inicio de sesión: se abre el navegador, inicie sesión en la página de Dropbox o de Google y pulse Permitir. La contraseña nunca llega a este programa.</li>
<li>Cuando el navegador diga que ha iniciado sesión, vuelva al programa; los archivos aparecen en el panel.</li>
<li>“Mantener la sesión en este equipo” guarda un token de actualización (cifrado por el sistema operativo) para que la próxima vez baste con <b>Conectar</b>. “Usar otra cuenta” inicia sesión de nuevo.</li>
</ol>
<p>Puede examinar, copiar en ambos sentidos, crear, renombrar, eliminar, visualizar, editar y reproducir en flujo. Los documentos propios de Google (Documentos, Hojas de cálculo, Presentaciones) se exportan al copiarlos. Dropbox guarda los archivos eliminados 30 días; Google Drive los mueve a su Papelera.</p>
<p class="help-warn">Dropbox y Google quieren que cada programa se identifique con su propia clave de aplicación. Las compilaciones normales la incluyen y basta con iniciar sesión. Si la ventana pide una “App key” o un “Client ID”, pulse en ella “Ajustes y ayuda...”: explica en unos pasos cómo crear una clave gratuita una sola vez en la consola del servicio (el valor se recuerda para todas las cuentas).</p>`,
    },
    {
      id: 'sync', t: 'Sincronización de ajustes',
      h: `<p>Configuración > <b>Sincronización de ajustes (Dropbox, Google Drive, carpeta)...</b> mantiene sus ajustes iguales en todos sus equipos. Se guardan en un solo archivo zip, <code>/Commander/settings.zip</code>, en su Dropbox o Google Drive, o en una carpeta de este equipo (un pendrive o una carpeta que sincroniza otro programa).</p>
<ul>
<li>Qué se sincroniza: conexiones, favoritos, ajustes predefinidos de búsqueda y de renombrado, el idioma y los ajustes de vista. Al combinar dos equipos gana el cambio más reciente de cada ajuste.</li>
<li><b>Mantener los ajustes allí:</b> sincroniza al iniciar el programa y tras cada cambio. <b>Sincronizar ahora</b> combina una vez; <b>Obtener ajustes</b> y <b>Guardar ajustes</b> fuerzan un sentido (tomar los ajustes del otro equipo o sobrescribirlos con estos).</li>
<li><b>Poner contraseñas, accesos y archivos de clave SSH en el zip:</b> sin esto solo viajan los nombres y las direcciones de las conexiones. Con esto, proteja el zip con una contraseña (AES-256, la misma en todos los equipos); sin contraseña, cualquiera que pueda abrir ese lugar puede leer sus contraseñas. Una contraseña olvidada no se puede recuperar.</li>
</ul>
<p class="help-tip">Use para el zip una contraseña ASCII sin comillas ni barras invertidas: se pasa a 7-Zip.</p>`,
    },
    {
      id: 'tools', t: 'Herramientas de los menús Archivos y Comandos',
      h: `<ul>
<li><b>Comparar directorios</b> (<kbd>Shift+F2</kbd>): selecciona lo que es distinto entre los dos paneles. <b>Sincronizar directorios...</b> (menú Comandos) lista las diferencias de dos carpetas con sus subcarpetas y copia los archivos que faltan o son más nuevos, en el sentido que elija. Las dos herramientas necesitan dos carpetas normales.</li>
<li><b>Comparar por contenido...</b> (menú Archivos): dos archivos lado a lado, con las diferencias marcadas.</li>
<li><b>Renombrar varios</b> (<kbd>Ctrl+M</kbd>), <b>Cambiar atributos...</b> (solo lectura, oculto, sistema, archivo, fechas, también en subcarpetas), <b>Propiedades</b> (<kbd>Alt+Enter</kbd>), <b>Calcular espacio ocupado...</b> (<kbd>Ctrl+L</kbd>).</li>
<li><b>Editar comentario...</b> (<kbd>Ctrl+Z</kbd>): una descripción del archivo, guardada en <code>descript.ion</code> como en Total Commander y mostrada en el panel.</li>
<li><b>Crear archivos de suma de verificación...</b> y <b>Verificar sumas de verificación...</b>: MD5, SHA-1, SHA-256 y otras; una ventana de progreso y la lista de archivos dañados o ausentes.</li>
<li><b>Dividir archivo...</b> / <b>Combinar archivos...</b>: corta un archivo grande en partes del tamaño que elija y las vuelve a unir (un archivo <code>.crc</code> guarda el orden y las sumas de verificación).</li>
<li><b>Codificar / Decodificar archivo (MIME, UUE)</b>: convierte un archivo binario en texto para el correo electrónico y viceversa.</li>
<li><b>Programas de inicio...</b> (menú Comandos): muestra lo que se inicia junto con el equipo (programas de arranque), al estilo de Sysinternals Autoruns.</li>
</ul>`,
    },
    {
      id: 'extras', t: 'Más funciones',
      h: `<ul>
<li><b>Emulador de ZX Spectrum:</b> <kbd>Enter</kbd> sobre un archivo <code>.trd .scl .tap .tzx .z80 .sna .szx .fdi .td0 .udi .csw .hob</code> lo inicia en el emulador incluido (Unreal Speccy Portable); Archivos > <b>Ejecutar en el emulador ZX Spectrum</b> hace lo mismo.</li>
<li><b>WSL como disco:</b> las distribuciones de Linux instaladas aparecen en la lista de unidades como “WSL: nombre”; cualquier ruta <code>\\\\wsl$\\nombre\\...</code> es una carpeta normal.</li>
<li><b>Arrastrar y soltar:</b> arrastre archivos de un panel a otra aplicación (desde discos remotos se descargan antes). Los archivos soltados en la consola SSH se suben a su carpeta actual.</li>
<li><b>Barra de herramientas:</b> la fila de botones bajo el menú se puede mostrar u ocultar en Configuración > Mostrar barra de herramientas.</li>
<li><b>Diálogos en ventanas propias:</b> como en Total Commander, un diálogo puede sacarse de la ventana principal. Se puede desactivar en Configuración > Configuración..., sección “Visualización”.</li>
<li><b>Idiomas de la interfaz:</b> inglés, ruso, ucraniano, bielorruso, polaco, portugués, español y alemán (Configuración > Idioma...). Los menús, los diálogos, los botones y esta ayuda siguen el idioma; los nombres de archivo nunca se traducen.</li>
</ul>`,
    },
    {
      id: 'keys', t: 'Atajos de teclado',
      h: '',
    },
    {
      id: 'config', t: 'Configuración y actualizaciones',
      h: `<ul>
<li><b>Configuración...</b> tiene los grupos de opciones (visualización, operaciones, editor, idioma, herramientas). <b>Atajos de teclado...</b> permite dar otras teclas a cada comando, <b>Editor...</b> ajusta el editor, <b>Idioma...</b> cambia el idioma (la ventana del programa se reinicia).</li>
<li><b>Buscar actualizaciones...</b> (menú Configuración): el programa también busca una versión nueva unos segundos después de iniciarse y ofrece instalarla. En Windows el nuevo programa portátil sustituye al archivo antiguo tras comprobar su SHA-256; en Linux lo hace el nuevo AppImage; en un Mac el instalador de una línea se ejecuta dentro del programa. Puede omitir una versión.</li>
<li><b>Índice de archivos...</b> y <b>Sincronización de ajustes...</b> (menú Configuración) se describen en sus propios capítulos.</li>
<li><b>Acerca de</b> > <b>Acerca de Alternate Commander...</b> muestra su versión y las novedades de la última versión. Hay un interruptor de <b>Modo de desarrollador</b>: abre una ventana con un registro detallado de la sincronización, las actualizaciones y el trabajo con archivos comprimidos, lo que ayuda al informar de un problema.</li>
</ul>
<p>Los ajustes, los favoritos y las conexiones guardadas se almacenan en la carpeta de datos del programa (se llama <code>Commander</code> y está en la carpeta de datos de aplicaciones de su usuario). El programa portátil de Windows los guarda junto a sí mismo en <code>Commander-data</code>. Las contraseñas guardadas se almacenan cifradas, vea “Contraseñas, privacidad y seguridad”.</p>`,
    },
    {
      id: 'platforms', t: 'Windows, macOS y Linux',
      h: `<h3>Windows</h3>
<p>Windows 10 / 11, 64 bits. El programa portátil no necesita instalación. Las compilaciones aún no están firmadas, así que SmartScreen puede avisar la primera vez: elija <b>Más información</b> y <b>Ejecutar de todas formas</b>. Instalación con Scoop: <code>scoop bucket add powervac https://github.com/powervac/scoop-bucket</code> y <code>scoop install alternate-commander</code>.</p>
<h3>macOS</h3>
<p>Apple Silicon e Intel. Lo más fácil: <code>curl -fsSL https://altcom.cc/install-mac.sh | bash</code> en Terminal (también evita el mensaje de “dañado” de las aplicaciones sin firmar) o <code>brew install --cask powervac/tap/alternate-commander</code>. Si macOS dice que la aplicación está dañada: <code>xattr -cr /Applications/Commander.app</code>.</p>
<ul>
<li><b>Ctrl es Cmd y Alt es Option</b> en todos los atajos de esta ayuda, salvo <kbd>Ctrl+Q</kbd> (vista rápida) y las teclas de la consola SSH, que siguen siendo Ctrl. <kbd>Cmd+A</kbd> selecciona todos los archivos, <kbd>Cmd+W</kbd> cierra una pestaña, <kbd>Cmd+M</kbd> es renombrar varios, <kbd>Cmd+Q</kbd> sale.</li>
<li>Las teclas F necesitan <kbd>Fn</kbd>, o active “Usar las teclas F1, F2, etc. como teclas de función estándar” en Ajustes del Sistema > Teclado. Los botones de la parte inferior de la ventana y los menús hacen lo mismo.</li>
<li>La primera vez que el programa lee Documentos, Descargas o el Escritorio, macOS pide permiso. Los recursos de red están en la lista de unidades, en <code>/Volumes</code>.</li>
</ul>
<h3>Linux</h3>
<p>x86_64. <code>curl -fsSL https://altcom.cc/install-linux.sh | bash</code> instala el programa en <code>~/Applications</code> y lo añade al menú de aplicaciones; o descargue el AppImage y aplíquele <code>chmod +x</code>. Si el sistema no tiene llavero, las contraseñas guardadas se protegen con un archivo de clave del programa.</p>`,
    },
    {
      id: 'security', t: 'Contraseñas, privacidad y seguridad',
      h: `<ul>
<li><b>Las contraseñas guardadas</b> son opcionales (“Recordar la contraseña”) y se almacenan cifradas por el sistema operativo (Windows DPAPI, Llavero de macOS, llavero de Linux). Se envían solo al servidor al que se conecta.</li>
<li><b>El inicio de sesión en la nube</b> ocurre en su navegador; el programa solo guarda un token de actualización. Sus archivos van directamente entre este equipo y el servicio, nunca por un servidor de este programa.</li>
<li><b>SSH</b> confía en una clave de host la primera vez y avisa cuando cambia. <b>FTPS</b> y <b>HTTPS</b> comprueban el certificado del servidor; “Permitir un certificado no fiable” desactiva esa comprobación para una conexión, úselo solo con un servidor que conozca.</li>
<li>El <b>FTP simple</b> y las direcciones WebDAV <b>http://</b> envían la contraseña sin cifrar.</li>
<li>La transmisión de medios desde servidores escucha solo en este equipo (127.0.0.1) y exige una clave aleatoria creada en cada inicio.</li>
<li>El programa busca actualizaciones en <code>altcom.cc</code> y descarga solo archivos cuyo SHA-256 coincide.</li>
<li>Sincronización de ajustes con contraseñas: use la contraseña del zip (vea “Sincronización de ajustes”).</li>
</ul>`,
    },
    {
      id: 'trouble', t: 'Solución de problemas y preguntas',
      h: `<h3>No puedo conectarme a mi servidor NAS, SSH, FTP o WebDAV</h3>
<p>Lea el mensaje de la ventana de conexión: nombra las causas habituales. “Connection refused” significa puerto equivocado o servicio detenido, “did not answer in time” un cortafuegos o una dirección equivocada, “Login failed” usuario o contraseña incorrectos. “The server certificate is not trusted”: el servidor usa un certificado autofirmado; marque “Permitir un certificado no fiable” si confía en él. Con QuickConnect espere unos segundos; si sigue fallando, pruebe la dirección local con el puerto.</p>
<h3>Una conexión FTP muestra la lista pero falla con los archivos</h3>
<p>El programa usa el modo pasivo; un cortafuegos que bloquea los puertos de las conexiones de datos pasivas detiene la transferencia. Pruebe una vez “FTP simple” para ver si el culpable es TLS, o pida al administrador que abra el rango de puertos pasivos.</p>
<h3>Un vídeo o una canción no se reproduce</h3>
<p>Los formatos que el motor no conoce los convierte el ffmpeg incluido; si el archivo está dañado o usa un códec muy raro, el visor lo indica. En un equipo lento, dé un momento a un vídeo grande para empezar.</p>
<h3>Las teclas no funcionan en macOS</h3>
<p>Vea “Windows, macOS y Linux”: las teclas F necesitan Fn, y Ctrl en esta ayuda significa Cmd.</p>
<h3>El idioma del programa es incorrecto</h3>
<p>Configuración > Idioma... Si la sincronización de ajustes está activada, puede haberse tomado el idioma de otro equipo: cámbielo otra vez.</p>
<h3>Una ventana de diálogo desapareció o está en otra pantalla</h3>
<p>Los diálogos son ventanas independientes; ciérrelo con Esc y ábralo de nuevo, o desactive la opción en Configuración > Configuración..., sección “Visualización”.</p>
<h3>Informar de un problema o pedir una función</h3>
<p>Use el formulario de <a href="#" data-u="https://altcom.cc/#requests">altcom.cc</a> o abra una incidencia en <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander/issues">GitHub</a>. Active el <b>Modo de desarrollador</b> en Acerca de, repita el problema y añada las líneas del registro a su informe.</p>`,
    },
    {
      id: 'about', t: 'Acerca del programa',
      h: `<p><b>Alternate Commander</b> es un administrador de archivos de dos paneles, gratuito y de código abierto, para Windows, macOS y Linux, al estilo de Total Commander. Es un proyecto independiente, sin relación con Total Commander ni con Ghisler Software.</p>
<ul>
<li>Sitio web: <a href="#" data-u="https://altcom.cc">altcom.cc</a>; novedades de cada versión: <a href="#" data-u="https://altcom.cc/changelog.html">historial de cambios</a>.</li>
<li>Código fuente e incidencias: <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander">github.com/powervac/Alternate-Total-Commander</a> (licencia MIT).</li>
<li>Hecho con Electron. Componentes de terceros: el emulador de ZX Spectrum Unreal Speccy Portable (GPL-3.0), ffmpeg y 7-Zip para la conversión y los archivos comprimidos, xterm.js para la consola SSH, ssh2 y basic-ftp para las conexiones y la fuente Inter. La lista completa está en el README del proyecto.</li>
</ul>
<p>Su versión y la búsqueda de actualizaciones están en <b>Acerca de > Acerca de Alternate Commander...</b>.</p>`,
    },
  ],
};
