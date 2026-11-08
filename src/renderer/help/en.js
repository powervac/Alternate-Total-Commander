'use strict';
// Help text, English (the master text: a section that another language does not have is shown in English). Format: see help.js.
HELP_TEXT.en = {
  ui: {
    title: 'Help',
    search: 'Search the help',
    close: 'Close',
    none: 'Nothing found.',
    found: '{n} matches in {s} sections',
    hint: 'F1 opens this help at any time.',
    keysIntro: 'Every command of the program with the keys it has now. Ctrl is Cmd on a Mac, Alt is Option. You can change any key in Configuration > Hotkeys...; this list follows your changes.',
    keysFoot: 'Also: Enter opens the folder, archive or file under the cursor, Backspace goes up, Tab switches the panel, the arrow keys, Home, End, PageUp and PageDown move the cursor, Esc closes dialogs and menus. Typing text starts the command line at the bottom.',
  },
  sections: [
    {
      id: 'start', t: 'Getting started',
      h: `<p>Alternate Commander is a file manager with <b>two panels</b>, in the manner of Total Commander. One panel is active (its path is highlighted); the other one is the target of copy and move. Everything can be done from the keyboard, and everything has a menu item or a button as well.</p>
<ul>
<li><kbd>Tab</kbd> switches the active panel. Arrow keys move the cursor, <kbd>Enter</kbd> opens a folder, an archive or a file, <kbd>Backspace</kbd> goes up one level.</li>
<li><kbd>F5</kbd> copies the selected files to the other panel, <kbd>F6</kbd> moves them, <kbd>F7</kbd> makes a folder, <kbd>F8</kbd> deletes, <kbd>F3</kbd> views, <kbd>F4</kbd> edits. These buttons are at the bottom of the window too.</li>
<li>The button at the top left of a panel opens the <b>drive list</b> (<kbd>Alt+F1</kbd> for the left, <kbd>Alt+F2</kbd> for the right panel): disks, standard folders, network drives, favourites and your connections to servers and clouds.</li>
<li>The <b>menu</b> opens with the mouse or with <kbd>F9</kbd> / <kbd>F10</kbd>. The last item, <b>About</b>, holds this help and the version / update window.</li>
</ul>
<p class="help-tip">New to the program? Read "Panels, tabs and navigation", "Selecting files" and "Copying, moving, renaming, deleting" first. The rest of the chapters describe the extra features one by one; use the search field to find a word.</p>
<p>The window below the panels shows the <b>command line</b>: type a command and press Enter to run it in the folder of the active panel; <code>cd folder</code> changes the folder of the active panel instead. <kbd>Ctrl+Enter</kbd> puts the name of the file under the cursor into the command line, <kbd>Ctrl+Shift+Enter</kbd> its full path.</p>`,
    },
    {
      id: 'panels', t: 'Panels, tabs and navigation',
      h: `<h3>Folders and the drive list</h3>
<p>The path of a panel is shown above its list; the line below the list shows the number and size of the selected and of all files. <kbd>Alt+F1</kbd> / <kbd>Alt+F2</kbd> open the drive list of the left / right panel. It contains: the local disks, mapped network drives (with the network path), the standard folders (Home, Desktop, Documents, Downloads ...), on Windows the installed <b>WSL</b> distributions, and below them your open and saved connections (NAS, SSH, FTP, WebDAV, Dropbox, Google Drive). On macOS the volumes under <code>/Volumes</code> (also network shares) are listed.</p>
<h3>History and going back</h3>
<p><kbd>Alt+Left</kbd> and <kbd>Alt+Right</kbd> go back and forward in the history of the panel. <kbd>Ctrl+U</kbd> swaps the two panels; the Commands menu also has "Target=Source" which shows the same folder in the other panel.</p>
<h3>Tabs</h3>
<p>Each panel has its own tabs: <kbd>Ctrl+T</kbd> opens a new one (a copy of the current folder), <kbd>Ctrl+W</kbd> closes it, <kbd>Ctrl+Tab</kbd> / <kbd>Ctrl+Shift+Tab</kbd> move between them and <kbd>Ctrl+Up</kbd> opens the folder (or archive) under the cursor in a new tab. Tabs are remembered when you close the program.</p>
<h3>Sorting and views</h3>
<p>Click a column header, or press <kbd>Ctrl+F3</kbd> (name), <kbd>Ctrl+F4</kbd> (extension), <kbd>Ctrl+F5</kbd> (date), <kbd>Ctrl+F6</kbd> (size). The same key again reverses the order. <kbd>Ctrl+Shift+F4</kbd> switches the panel to <b>thumbnails</b> (pictures, video frames, PDF and documents); <kbd>Ctrl+Q</kbd> turns the other panel into a <b>quick view</b> of the file under the cursor. <kbd>Ctrl+R</kbd> reads the folder again.</p>
<h3>Directory hotlist</h3>
<p><kbd>Ctrl+D</kbd> opens your favourite folders. The current folder can be added to the list, including the current folder of a cloud drive, NAS, SSH, FTP or WebDAV server: choosing such a favourite reconnects if needed and goes straight there. Favourites of Total Commander are imported once from <code>wincmd.ini</code> if the program finds it.</p>`,
    },
    {
      id: 'select', t: 'Selecting files',
      h: `<p>Most commands work on the <b>selected</b> files, or on the file under the cursor when nothing is selected. Selected names are shown in a different colour.</p>
<ul>
<li><kbd>Insert</kbd> selects the file and moves down; <kbd>Space</kbd> selects it and stays (on a folder it also calculates the total size of its contents, shown in the Size column).</li>
<li><kbd>Num +</kbd> selects a group by a mask (<code>*.jpg</code>, <code>report*.*</code>), <kbd>Num -</kbd> unselects a group, <kbd>Num *</kbd> inverts the selection, <kbd>Ctrl+A</kbd> selects all, <kbd>Ctrl+Num -</kbd> unselects all.</li>
<li><kbd>Alt+Num +</kbd> selects all files with the same extension as the file under the cursor.</li>
<li>With the mouse: <kbd>Ctrl</kbd>+click adds or removes one file. With the keyboard: hold <kbd>Shift</kbd> while you move the cursor with the arrow keys.</li>
</ul>
<p>The <b>Mark</b> menu has the same commands, and also "Copy Selected Names To Clipboard" and "Copy Names With Path To Clipboard" (handy for pasting a file list into a message). <b>Compare Directories</b> (<kbd>Shift+F2</kbd>) selects, in both panels, the files that are missing in the other panel or are newer or different (two normal folders, not archives or servers).</p>`,
    },
    {
      id: 'ops', t: 'Copying, moving, renaming, deleting',
      h: `<ul>
<li><b>Copy / Move</b> (<kbd>F5</kbd> / <kbd>F6</kbd>): the dialog shows the target (the folder of the other panel); you can change it or give a new name. If a file already exists the program asks whether to overwrite it or skip the existing files. Folders are copied with everything inside.</li>
<li><b>Rename</b>: <kbd>F2</kbd> or <kbd>Shift+F6</kbd> asks for the new name of the file under the cursor. <b>Multi-Rename Tool</b> (<kbd>Ctrl+M</kbd>) renames many files by masks for the name and the extension (<code>[N]</code> name, <code>[C]</code> counter, <code>[YMD]</code> date, ranges of the old name), with search and replace, a preview and saved presets.</li>
<li><b>New folder</b>: <kbd>F7</kbd>. <b>Edit new file</b>: <kbd>Shift+F4</kbd>.</li>
<li><b>Delete</b>: <kbd>F8</kbd> or <kbd>Delete</kbd> moves the files to the Recycle Bin (Trash); <kbd>Shift+F8</kbd> or <kbd>Shift+Delete</kbd> deletes them permanently. On servers and in archives there is no Recycle Bin: the files are removed at once. On Dropbox deleted files are kept 30 days; on Google Drive they go to its Trash.</li>
<li><b>Properties</b> (<kbd>Alt+Enter</kbd>), <b>Calculate Occupied Space</b> (<kbd>Ctrl+L</kbd>) and <b>Change Attributes</b> are in the Files menu.</li>
</ul>
<h3>Progress, background and the queue</h3>
<p>Long jobs show a progress window with the file name, speed and a <b>Cancel</b> button. <b>Pause</b> stops it for a while. <b>Background</b> sends the job to the queue and gives the window back to you; in the copy dialog the same thing is the <b>F2 Queue</b> button (the job goes straight to the queue without a progress window); the queue window lists the waiting jobs, they run one after another, and you can reorder or cancel them. Copying between two remote disks (for example Dropbox to a NAS) goes through a temporary folder on this computer automatically.</p>
<p class="help-tip">To copy a file out of a server or an archive, open the target folder in the other panel and press <kbd>F5</kbd>. To copy into a server or an archive, open it in the other panel first.</p>`,
    },
    {
      id: 'archives', t: 'Archives',
      h: `<p>Archives open like folders: <kbd>Enter</kbd> on an archive shows its contents, <kbd>Backspace</kbd> at the top level leaves it. <kbd>F3</kbd> views a file inside, <kbd>F5</kbd> copies files out.</p>
<table>
<tr><th>Format</th><th>Browse and copy out</th><th>Change in place</th><th>Pack</th></tr>
<tr><td>zip</td><td>yes</td><td>yes (add, delete, rename, new folder, edit and save a file)</td><td>yes</td></tr>
<tr><td>7z, tar, tar.gz (tgz), tar.bz2, tar.xz, cab, gz, bz2, xz</td><td>yes</td><td>no (read-only)</td><td>7z, tar, tar.gz, tar.bz2, tar.xz, gz, bz2, xz</td></tr>
<tr><td>rar</td><td>yes</td><td>no</td><td>no (extract only)</td></tr>
</table>
<ul>
<li><kbd>Alt+F5</kbd> <b>packs</b> the selected files (choose the format and the name; progress and cancel as for copying). <kbd>Alt+F9</kbd> <b>unpacks</b> the selected archives, or only the selected files of an archive that is open.</li>
<li><kbd>Alt+Shift+F9</kbd> <b>tests</b> archives (checks that they are not damaged). Files menu: <b>Split File...</b> and <b>Combine Files...</b> (with the <code>.crc</code> file of Total Commander).</li>
<li>An archive on a NAS or SSH server is downloaded to a temporary copy and opens read-only; files can be copied out of it. Copying directly between two archives is not supported yet: use a folder in between.</li>
</ul>`,
    },
    {
      id: 'search', t: 'Finding files',
      h: `<p><b>Commands > Search...</b> (<kbd>Alt+F7</kbd>) opens the search window.</p>
<ul>
<li><b>Names:</b> several masks separated by <code>;</code> and exclusions after <code>|</code>, for example <code>*.js;*.ts|node_modules/</code>, or a regular expression. Search one or several folders, only the selected items, with a depth limit, and names inside zip files.</li>
<li><b>Text inside files:</b> whole words, case, regular expression, hex bytes, "not containing"; the encodings ANSI, DOS, UTF-8 and UTF-16 are tried; text inside docx, xlsx, pptx and OpenDocument files is found as well.</li>
<li><b>Filters:</b> date (between, newer or older than), size, attributes. <b>Duplicates:</b> files with the same name, the same size or the same content.</li>
<li>Double-click a result to go to the file; <b>Feed to listbox</b> shows all results as a list in a panel, where F3, F5, F8 and the other commands work on them.</li>
</ul>
<h3>File index (fast search)</h3>
<p>Configuration > <b>File index...</b> builds an index of the file names of the folders you choose (it runs in the background and is stored compressed in the program's data folder). With "Use the index" ticked, searches by name, size and date are instant when every searched folder lies inside an indexed folder; otherwise the normal search of the disk runs. Searching for text inside files always reads the files.</p>`,
    },
    {
      id: 'viewer', t: 'Viewer, editor and quick view',
      h: `<h3>Viewer (F3)</h3>
<p>Shows the file under the cursor without opening another program: text with automatic detection of the encoding (UTF-8, UTF-16, Windows-1251, CP866 ...; the Encoding list at the top changes it), a hex dump, pictures, PDF, video and audio. <b>Documents</b> (docx, xlsx, pptx, OpenDocument, and old doc and rtf as plain text) are drawn by the program itself with headings, lists, tables and pictures, so Word or Office is not needed. Video and audio formats that the engine cannot play (HEVC, AVI, WMV, AC3, APE, WavPack, ALAC, AIFF ...) are converted on the fly by the bundled ffmpeg. In the viewer <kbd>F7</kbd> finds text, <kbd>N</kbd> and <kbd>P</kbd> show the next and the previous file of the folder, <kbd>Esc</kbd> closes it. It also works for files inside archives and on servers (the file is downloaded to a temporary place first).</p>
<h3>Editor (F4)</h3>
<p>A plain text editor that keeps the encoding, the BOM and the line endings of the file, with find and replace. It edits files inside zip archives and on NAS, SSH, FTP and WebDAV servers and saves them back. <kbd>Shift+F4</kbd> creates a new file. The font and tab settings are in Configuration > <b>Editor...</b>.</p>
<h3>Quick view (Ctrl+Q)</h3>
<p>The other panel shows a preview of the file under the cursor and follows the cursor while you move it. <kbd>Ctrl+Q</kbd> again brings the file list back.</p>
<p>Other ways to open a file: <kbd>Enter</kbd> runs it with the application that the operating system has for it; Files > <b>Open With Default Application</b> does the same for any file.</p>`,
    },
    {
      id: 'media', t: 'Music and video',
      h: `<h3>Music player</h3>
<p><kbd>Enter</kbd> on an audio file starts the player: a bar appears above the function key buttons and the music keeps playing while you browse. The other audio files of the folder form the queue. The bar has previous / play-pause / next, a seek slider, shuffle, repeat (off / all / one), volume and a button that closes the player.</p>
<ul>
<li>Shortcuts: <kbd>Ctrl+Space</kbd> (macOS: <kbd>Option+Space</kbd>) play / pause, <kbd>Ctrl+Shift+Right</kbd> / <kbd>Ctrl+Shift+Left</kbd> next / previous track. The media keys of the keyboard work too. The Commands menu has the same items.</li>
<li>mp3, FLAC, WAV, OGG, Opus, AAC and M4A play directly; APE, WavPack, ALAC, AIFF, WMA, DSD, AC3, DTS, MPC and others are decoded by the bundled ffmpeg.</li>
<li>Music of a NAS, SSH, FTP, WebDAV, Dropbox or Google Drive panel is streamed: it starts at once and you can jump anywhere in the track.</li>
</ul>
<h3>Chip music (ZX Spectrum, Atari ST, Amstrad)</h3>
<p>The same player plays modules for the AY-3-8910 / YM2149 sound chip: <b>PT3, PT2, PT1, STC, ST1, ST3, STP, SQT, ASC, PSC, PSM, FTC, GTR, AY, AYC, PSG, TSD, VTX and YM</b>. The chip is emulated; before the first sound the program prepares the whole track (about a second for a few minutes of music, "rendering..." in the title), then seeking works like for any other file. The title comes from the module.</p>
<h3>Video</h3>
<p><kbd>F3</kbd> or <kbd>Enter</kbd> on a video opens it in the viewer, with seeking, also from servers and clouds.</p>`,
    },
    {
      id: 'nas', t: 'Synology NAS',
      h: `<p><b>Net > Synology NAS...</b> (<kbd>Ctrl+F</kbd>) connects to the File Station of a Synology DiskStation and shows it as a disk.</p>
<ol>
<li>Address: the local address with the DSM port (for example <code>nas.local:5001</code> or <code>192.168.1.20:5000</code>) or a <b>QuickConnect</b> address (<code>https://id.region.quickconnect.to</code> or just the id). QuickConnect needs a few seconds to find the way to the NAS.</li>
<li>User and password; the code of the <b>2-step verification</b> if it is switched on for the account.</li>
<li>"Allow an untrusted certificate" is for a NAS with a self-signed certificate. "Remember the password" stores it encrypted by the operating system.</li>
<li><b>Connect</b>. The connection is saved in the list on the left of the window; double-click it next time.</li>
</ol>
<p>In the panel you can browse, copy both ways (with progress), create folders, rename, delete, view, edit and stream video and music. <b>Net > Disconnect</b> closes the connection; the drive list (<kbd>Alt+F1</kbd>) shows the open ones and lets you return to them.</p>`,
    },
    {
      id: 'ssh', t: 'SSH, SFTP and the console',
      h: `<p><b>Net > SSH server...</b> (<kbd>Ctrl+Shift+F</kbd>) connects with a password or a key file (OpenSSH, PEM; PuTTY keys of version 2 are converted).</p>
<ul>
<li><b>Open as:</b> "Disk" shows the file list of the server (SFTP), "Console" opens a real terminal first. <kbd>Ctrl+O</kbd> switches between them at any time; the console keeps its history.</li>
<li>In the <b>console</b> every key belongs to the server except <kbd>Ctrl+O</kbd>. Files copied with <kbd>F5</kbd> or dropped onto the console are uploaded into the folder the console is in now.</li>
<li><b>Host key:</b> the first time the program shows the fingerprint of the server and asks you to trust it; it is remembered, and a changed key is reported as a warning (it can mean an attack, or a reinstalled server).</li>
<li><b>Open in PuTTY</b> (Net menu or the button of the window) starts PuTTY with the same connection if PuTTY is installed.</li>
<li>Remote files can be viewed, edited, copied and dragged out of the panel to another application.</li>
</ul>
<h3>Import from WinSCP</h3>
<p><b>Net > Import from WinSCP...</b> reads the sessions of WinSCP (from the registry, or from a <code>WinSCP.ini</code> file that you choose) and creates connections: SFTP / SCP sessions become SSH connections (their key files are copied into the program's own protected folder), FTP and WebDAV sessions become FTP and WebDAV connections. Passwords are not imported: enter them at the first connection. S3 sessions are not supported.</p>`,
    },
    {
      id: 'ftp', t: 'FTP, FTPS and WebDAV',
      h: `<h3>FTP and FTPS</h3>
<p><b>Net > FTP / FTPS server...</b></p>
<table>
<tr><td>Host</td><td>the server name, optionally with a port: <code>ftp.example.com</code> or <code>ftp.example.com:2121</code></td></tr>
<tr><td>Security</td><td><b>FTP over TLS (explicit)</b> is the recommended one: port 21, the connection is upgraded to TLS. <b>Implicit TLS</b> is port 990. <b>Plain FTP</b> sends the password without encryption: use it only in a trusted network.</td></tr>
<tr><td>User, Password</td><td>or press <b>Anonymous login</b> (user <code>anonymous</code>, an e-mail style password).</td></tr>
<tr><td>Remote folder</td><td>optional: the folder to open first, for example <code>/public_html</code></td></tr>
<tr><td>Local folder</td><td>optional: the other panel goes to this folder when you connect.</td></tr>
<tr><td>Keep alive</td><td>optional: send a NOOP every N seconds so that a server with a short idle limit does not close the connection. (A connection that the server closed is opened again by itself.)</td></tr>
<tr><td>After login</td><td>optional FTP commands sent after the login, separated by <code>;</code></td></tr>
</table>
<p>"Allow an untrusted certificate" is for a server with a self-signed TLS certificate. The program uses the passive mode (the one that works through routers and firewalls).</p>
<h3>WebDAV</h3>
<p><b>Net > WebDAV server...</b> takes the full address of the WebDAV folder: Nextcloud / ownCloud <code>https://cloud.example.com/remote.php/dav/files/NAME/</code>, Synology, Apache, nginx, IIS, Box and others. The login may be Basic or Digest; an empty user connects without a login. A redirect to another server does not take your password along.</p>
<p>Both kinds work like the NAS and SSH panels: browse, copy both ways with progress, create, rename, delete, view, edit, and stream video and music with seeking. Notes: a server that gives no modification dates shows empty dates; names are expected in UTF-8; there are no file locks for WebDAV.</p>`,
    },
    {
      id: 'cloud', t: 'Dropbox and Google Drive',
      h: `<p><b>Net > Dropbox...</b> and <b>Net > Google Drive...</b> show the cloud as an ordinary disk. No desktop client of Dropbox or Google is needed.</p>
<ol>
<li>Press the sign-in button: your browser opens and you sign in on the page of Dropbox or Google and press Allow. The password never goes to this program.</li>
<li>When the browser says that you are signed in, go back to the program; the files appear in the panel.</li>
<li>"Stay signed in on this computer" keeps a refresh token (encrypted by the operating system) so that next time <b>Connect</b> is enough. "Use a different account" signs in again.</li>
</ol>
<p>You can browse, copy both ways, create, rename, delete, view, edit and stream. Google's own documents (Docs, Sheets, Slides) are exported when you copy them. Dropbox keeps deleted files for 30 days; Google Drive moves them to its Trash.</p>
<p class="help-warn">Dropbox and Google want every program to identify itself with its own app key. Normal builds contain it and you just sign in. If the window asks for an "App key" or a "Client ID", press "Settings and setup help..." there: it explains in a few steps how to create a free key once in the console of the service (the same field is remembered for all accounts).</p>`,
    },
    {
      id: 'sync', t: 'Settings sync',
      h: `<p>Configuration > <b>Settings sync...</b> keeps your settings the same on all your computers. They are stored in one zip file, <code>/Commander/settings.zip</code>, in your Dropbox or Google Drive, or in a folder on this computer (a USB stick or a folder that another program synchronizes).</p>
<ul>
<li>What is synced: connections, favourites, search and rename presets, the language and the view settings. Newer changes of each setting win when two computers are merged.</li>
<li><b>Keep the settings there:</b> sync at the start of the program and after each change. <b>Sync now</b> merges once; <b>Retrieve settings</b> and <b>Save settings</b> force one direction (take the other computer's settings, or overwrite them with these).</li>
<li><b>Put passwords, logins and SSH key files into the zip:</b> without it only the connection names and addresses travel. With it, protect the zip with a password (AES-256, the same on every computer); without a password anyone who can open that place can read your passwords. A forgotten password cannot be recovered.</li>
</ul>
<p class="help-tip">Use an ASCII password without quotes and backslashes for the zip: it is passed to 7-Zip.</p>`,
    },
    {
      id: 'tools', t: 'Tools of the Files and Commands menus',
      h: `<ul>
<li><b>Compare Directories</b> (<kbd>Shift+F2</kbd>): selects what is different between the two panels. <b>Synchronize Dirs...</b> (Commands menu) lists the differences of the two folders with their subfolders and copies the files that are missing or newer, in the direction you choose. Both tools need two normal folders.</li>
<li><b>Compare By Content...</b> (Files menu): two files side by side, with the differences marked.</li>
<li><b>Multi-Rename Tool</b> (<kbd>Ctrl+M</kbd>), <b>Change Attributes</b> (read-only, hidden, system, archive, dates, also in subfolders), <b>Properties</b> (<kbd>Alt+Enter</kbd>), <b>Calculate Occupied Space</b> (<kbd>Ctrl+L</kbd>).</li>
<li><b>Edit Comment</b> (<kbd>Ctrl+Z</kbd>): a description of a file, stored in <code>descript.ion</code> like in Total Commander and shown in the panel.</li>
<li><b>Create Checksum File(s)...</b> and <b>Verify Checksums...</b>: MD5, SHA-1, SHA-256 and others; a progress window and a list of damaged or missing files.</li>
<li><b>Split File...</b> / <b>Combine Files...</b>: cut a large file into parts of a chosen size and join them again (a <code>.crc</code> file keeps the order and the check sums).</li>
<li><b>Encode / Decode File (MIME, UUE)</b>: turn a binary file into text for e-mail and back.</li>
<li><b>Autostart Programs...</b> (Commands menu): shows what starts together with the computer (startup programs), in the manner of Sysinternals Autoruns.</li>
</ul>`,
    },
    {
      id: 'extras', t: 'More features',
      h: `<ul>
<li><b>ZX Spectrum emulator:</b> <kbd>Enter</kbd> on a <code>.trd .scl .tap .tzx .z80 .sna .szx .fdi .td0 .udi .csw .hob</code> file starts it in the built-in emulator (Unreal Speccy Portable); Files > <b>Run in ZX Spectrum Emulator</b> does the same.</li>
<li><b>WSL as a disk:</b> the installed Linux distributions appear in the drive list as "WSL: name"; any <code>\\\\wsl$\\name\\...</code> path is an ordinary folder.</li>
<li><b>Drag and drop:</b> drag files out of a panel into another application (from remote disks they are downloaded first). Files dropped onto the SSH console are uploaded to its current folder.</li>
<li><b>Toolbar:</b> the row of buttons below the menu can be shown or hidden in Configuration > Show toolbar.</li>
<li><b>Dialogs in their own windows:</b> like in Total Commander a dialog can be moved out of the main window. This can be switched off in Configuration > Display.</li>
<li><b>Interface languages:</b> English, Russian, Ukrainian, Belarusian, Polish, Portuguese, Spanish and German (Configuration > Language...). Menus, dialogs, buttons and this help follow the language; file names are never translated.</li>
</ul>`,
    },
    {
      id: 'keys', t: 'Keyboard shortcuts',
      h: '',
    },
    {
      id: 'config', t: 'Configuration and updates',
      h: `<ul>
<li><b>Configuration...</b> has the groups of options (display, panels, file operations and others). <b>Hotkeys...</b> lets you give every command other keys, <b>Editor...</b> sets the editor, <b>Language...</b> changes the language (the program restarts its window).</li>
<li><b>Check for Updates...</b>: the program also looks for a new version a few seconds after it starts and offers to install it. On Windows the new portable program replaces the old file after its SHA-256 is checked; on Linux the new AppImage does the same; on a Mac the one-line installer runs inside the program. You can skip a version.</li>
<li><b>File index...</b> and <b>Settings sync...</b> are described in their own chapters.</li>
<li><b>About</b> > <b>About Alternate Commander...</b> shows your version and the news of the last release. There is a <b>Developer mode</b> switch: it opens a window with a detailed log of syncing, updates and archive work, which helps when you report a problem.</li>
</ul>
<p>The settings, favourites and saved connections are kept in the data folder of the program (named <code>Commander</code> in the application data folder of your user). The portable Windows program keeps them next to itself in <code>Commander-data</code>. Saved passwords are stored encrypted, see "Passwords, privacy and security".</p>`,
    },
    {
      id: 'platforms', t: 'Windows, macOS and Linux',
      h: `<h3>Windows</h3>
<p>Windows 10 / 11, 64-bit. The portable program needs no installation. The builds are not code-signed yet, so SmartScreen may warn you the first time: choose <b>More info</b> and <b>Run anyway</b>. Install with Scoop: <code>scoop bucket add powervac https://github.com/powervac/scoop-bucket</code> and <code>scoop install alternate-commander</code>.</p>
<h3>macOS</h3>
<p>Apple Silicon and Intel. Easiest: <code>curl -fsSL https://altcom.cc/install-mac.sh | bash</code> in Terminal (it also avoids the "damaged" message of unsigned apps) or <code>brew install --cask powervac/tap/alternate-commander</code>. If macOS says the app is damaged: <code>xattr -cr /Applications/Commander.app</code>.</p>
<ul>
<li><b>Ctrl is Cmd and Alt is Option</b> in all shortcuts of this help, except <kbd>Ctrl+Q</kbd> (quick view) and the keys of the SSH console, which stay Ctrl. <kbd>Cmd+A</kbd> selects all files, <kbd>Cmd+W</kbd> closes a tab, <kbd>Cmd+M</kbd> is the multi-rename tool, <kbd>Cmd+Q</kbd> quits.</li>
<li>The F keys need <kbd>Fn</kbd>, or switch on "Use F1, F2 etc. keys as standard function keys" in System Settings > Keyboard. The buttons at the bottom of the window and the menus do the same.</li>
<li>The first time the program reads Documents, Downloads or Desktop, macOS asks for permission. Network shares are in the drive list under <code>/Volumes</code>.</li>
</ul>
<h3>Linux</h3>
<p>x86_64. <code>curl -fsSL https://altcom.cc/install-linux.sh | bash</code> installs the program into <code>~/Applications</code> and adds it to the application menu; or download the AppImage and run <code>chmod +x</code> on it. If the system has no keyring, saved passwords are protected by a key file of the program instead.</p>`,
    },
    {
      id: 'security', t: 'Passwords, privacy and security',
      h: `<ul>
<li><b>Saved passwords</b> are optional ("Remember the password") and stored encrypted with the operating system (Windows DPAPI, macOS Keychain, the keyring of Linux). They are sent only to the server you connect to.</li>
<li><b>Cloud sign-in</b> happens in your browser; the program only keeps a refresh token. Your files go directly between this computer and the service, never through a server of this program.</li>
<li><b>SSH</b> trusts a host key the first time and warns when it changes. <b>FTPS</b> and <b>HTTPS</b> check the certificate of the server; "Allow an untrusted certificate" turns that check off for one connection, use it only for a server you know.</li>
<li><b>Plain FTP</b> and <b>http://</b> WebDAV addresses send the password without encryption.</li>
<li>The streaming of media from servers listens only on this computer (127.0.0.1) and needs a random key made at each start.</li>
<li>The program checks for updates on <code>altcom.cc</code> and downloads only files whose SHA-256 matches.</li>
<li>Settings sync with passwords: use the zip password (see "Settings sync").</li>
</ul>`,
    },
    {
      id: 'trouble', t: 'Troubleshooting and questions',
      h: `<h3>I cannot connect to my NAS, SSH, FTP or WebDAV server</h3>
<p>Read the message in the connection window, it names the usual causes. "Connection refused" means a wrong port or a stopped service, "did not answer in time" a firewall or a wrong address, "Login failed" a wrong user or password. "The server certificate is not trusted": the server uses a self-signed certificate; tick "Allow an untrusted certificate" if you trust it. For QuickConnect give it a few seconds; if it keeps failing, try the local address with the port.</p>
<h3>An FTP connection works for the list but fails on files</h3>
<p>The program uses the passive mode; a firewall that blocks the ports of passive data connections stops the transfer. Try "Plain FTP" once to see whether TLS is the cause, or ask the administrator to open the passive port range.</p>
<h3>A video or a song does not play</h3>
<p>Formats that the engine does not know are converted by the bundled ffmpeg; if the file is damaged or uses a very rare codec the viewer says so. On a slow computer give a big video a moment to start.</p>
<h3>The keys do not work on macOS</h3>
<p>See "Windows, macOS and Linux": the F keys need Fn, and Ctrl in this help means Cmd.</p>
<h3>The language of the program is wrong</h3>
<p>Configuration > Language... If Settings sync is on, the language of the other computer may be taken over: change it once more.</p>
<h3>A window of a dialog is gone or on a wrong screen</h3>
<p>Dialogs are separate windows; close the dialog with Esc and open it again, or switch the setting off in Configuration > Display.</p>
<h3>Reporting a problem or asking for a feature</h3>
<p>Use the form on <a href="#" data-u="https://altcom.cc/#requests">altcom.cc</a> or open an issue on <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander/issues">GitHub</a>. Switch on the <b>Developer mode</b> in About, repeat the problem and add the lines of the log window to your report.</p>`,
    },
    {
      id: 'about', t: 'About the program',
      h: `<p><b>Alternate Commander</b> is a free, open-source two-panel file manager for Windows, macOS and Linux, in the manner of Total Commander. It is an independent project and is not affiliated with Total Commander or Ghisler Software.</p>
<ul>
<li>Website: <a href="#" data-u="https://altcom.cc">altcom.cc</a>; news of every version: <a href="#" data-u="https://altcom.cc/changelog.html">changelog</a>.</li>
<li>Source code and issues: <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander">github.com/powervac/Alternate-Total-Commander</a> (MIT license).</li>
<li>Made with Electron. Third-party parts: the ZX Spectrum emulator Unreal Speccy Portable (GPL-3.0), ffmpeg and 7-Zip for conversion and archives, xterm.js for the SSH console, ssh2 and basic-ftp for the connections, and the font Inter. The full list is in the README of the project.</li>
</ul>
<p>Your version and the update check are in <b>About > About Alternate Commander...</b>.</p>`,
    },
  ],
};
