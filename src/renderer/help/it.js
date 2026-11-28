'use strict';
// Help text, Italian. The master text is en.js (format: see help.js).
HELP_TEXT.it = {
  ui: {
    title: 'Guida',
    search: 'Cerca nella guida',
    close: 'Chiudi',
    none: 'Nessun risultato.',
    found: '{n} risultati in {s} sezioni',
    hint: 'F1 apre questa guida in qualsiasi momento.',
    keysIntro: 'Tutti i comandi del programma con i tasti che hanno ora. Sul Mac Ctrl è Cmd e Alt è Option. Ogni tasto si può cambiare in Configurazione > Scorciatoie...; questo elenco segue le tue modifiche.',
    keysFoot: 'Inoltre: Invio apre la cartella, l\'archivio o il file sotto il cursore, Backspace sale di livello, Tab cambia pannello, le frecce, Home, Fine, PagSu e PagGiù muovono il cursore, Esc chiude finestre e menu. Se si scrive del testo, questo va nella riga di comando in basso.',
  },
  sections: [
    {
      id: 'start', t: 'Primi passi',
      h: `<p>Alternate Commander è un gestore di file con <b>due pannelli</b>, nello stile di Total Commander. Un pannello è attivo (il suo percorso è evidenziato); l'altro è la destinazione di copia e spostamento. Tutto si può fare da tastiera, e per tutto c'è anche una voce di menu o un pulsante.</p>
<ul>
<li><kbd>Tab</kbd> cambia il pannello attivo. Le frecce muovono il cursore, <kbd>Invio</kbd> apre una cartella, un archivio o un file, <kbd>Backspace</kbd> sale di un livello.</li>
<li><kbd>F5</kbd> copia i file selezionati nell'altro pannello, <kbd>F6</kbd> li sposta, <kbd>F7</kbd> crea una cartella, <kbd>F8</kbd> elimina, <kbd>F3</kbd> visualizza, <kbd>F4</kbd> modifica. Questi pulsanti si trovano anche in fondo alla finestra.</li>
<li>Il pulsante in alto a sinistra di un pannello apre l'<b>elenco delle unità</b> (<kbd>Alt+F1</kbd> per il pannello sinistro, <kbd>Alt+F2</kbd> per il destro): dischi, cartelle standard, unità di rete, preferiti e le connessioni a server e cloud.</li>
<li>Il <b>menu</b> si apre con il mouse oppure con <kbd>F9</kbd> / <kbd>F10</kbd>. L'ultima voce, <b>Informazioni</b>, contiene questa guida e la finestra della versione e degli aggiornamenti.</li>
</ul>
<p class="help-tip">Primo utilizzo? Leggi prima "Pannelli, schede e navigazione", "Selezionare i file" e "Copiare, spostare, rinominare, eliminare". Gli altri capitoli descrivono le funzioni aggiuntive una per una; usa il campo di ricerca per trovare una parola.</p>
<p>Sotto i pannelli c'è la <b>riga di comando</b>: scrivi un comando e premi Invio per eseguirlo nella cartella del pannello attivo; <code>cd cartella</code> invece cambia la cartella del pannello attivo. <kbd>Ctrl+Invio</kbd> mette nella riga di comando il nome del file sotto il cursore, <kbd>Ctrl+Shift+Invio</kbd> il percorso completo.</p>`,
    },
    {
      id: 'panels', t: 'Pannelli, schede e navigazione',
      h: `<h3>Cartelle ed elenco delle unità</h3>
<p>Il percorso di un pannello è mostrato sopra l'elenco; la riga sotto l'elenco indica numero e dimensione dei file selezionati e di tutti i file. <kbd>Alt+F1</kbd> / <kbd>Alt+F2</kbd> aprono l'elenco delle unità del pannello sinistro / destro. Contiene: i dischi locali, le unità di rete collegate (con il percorso di rete), le cartelle standard (Home, Desktop, Documenti, Download ...), su Windows le distribuzioni <b>WSL</b> installate e, più in basso, le connessioni aperte e salvate (NAS, SSH, FTP, WebDAV, Dropbox, Google Drive). Su macOS sono elencati i volumi in <code>/Volumes</code> (anche le condivisioni di rete).</p>
<h3>Cronologia e ritorno</h3>
<p><kbd>Alt+Sinistra</kbd> e <kbd>Alt+Destra</kbd> vanno indietro e avanti nella cronologia del pannello. <kbd>Ctrl+U</kbd> scambia i due pannelli; nel menu Comandi c'è anche "Destinazione=Origine", che mostra la stessa cartella nell'altro pannello.</p>
<h3>Schede</h3>
<p>Ogni pannello ha le proprie schede: <kbd>Ctrl+T</kbd> ne apre una nuova (copia della cartella corrente), <kbd>Ctrl+W</kbd> la chiude, <kbd>Ctrl+Tab</kbd> / <kbd>Ctrl+Shift+Tab</kbd> passano dall'una all'altra e <kbd>Ctrl+Su</kbd> apre in una nuova scheda la cartella (o l'archivio) sotto il cursore. Le schede vengono ricordate alla chiusura del programma.</p>
<h3>Ordinamento e viste</h3>
<p>Fai clic sull'intestazione di una colonna, oppure premi <kbd>Ctrl+F3</kbd> (nome), <kbd>Ctrl+F4</kbd> (estensione), <kbd>Ctrl+F5</kbd> (data), <kbd>Ctrl+F6</kbd> (dimensione). Premendo di nuovo lo stesso tasto l'ordine si inverte. <kbd>Ctrl+Shift+F4</kbd> passa il pannello alle <b>miniature</b> (immagini, fotogrammi video, PDF e documenti); <kbd>Ctrl+Q</kbd> trasforma l'altro pannello in una <b>vista rapida</b> del file sotto il cursore. <kbd>Ctrl+R</kbd> rilegge la cartella.</p>
<h3>Cartelle preferite</h3>
<p><kbd>Ctrl+D</kbd> apre le cartelle preferite. Si può aggiungere la cartella corrente, anche di un cloud, di un NAS o di un server SSH, FTP o WebDAV: scegliendo un preferito di questo tipo il programma si ricollega se necessario e va direttamente lì. I preferiti di Total Commander vengono importati una volta da <code>wincmd.ini</code>, se il programma lo trova.</p>
<h3>Barra unità e preferiti</h3>
<p>Si attiva con <b>Mostra &gt; Barra unità e preferiti</b>: sopra ogni pannello compare una fila di pulsanti con le unità, <b>..</b> (su), la cartella Home e i tuoi preferiti. <b>+</b> aggiunge la cartella aperta; assegnale un'etichetta breve (2-3 lettere, per esempio UD), una descrizione e un percorso. Nel percorso si possono usare <code>~</code>, <code>$HOME</code>, <code>$NAME</code> o <code>%NAME%</code>; su Windows funzionano anche le cartelle di rete come <code>\\\\server\\share</code>. Tieni il mouse su un pulsante per vedere descrizione e percorso. Con il tasto destro si aggiungono, modificano, rimuovono e spostano i preferiti. Gli stessi preferiti compaiono nell'elenco delle unità. Ogni sistema ha il proprio elenco, incluso nella sincronizzazione delle impostazioni. Ogni preferito può avere un'icona: una di quelle incluse o un'immagine propria (per esempio dal tema di icone di Linux). Con il tasto destro l'elenco si può anche importare ed esportare come <code>drivefavorites.ini</code>.</p>
<h3>Larghezza e un solo pannello</h3>
<p>Trascina il bordo tra i pannelli per cambiarne la larghezza; un doppio clic li rende uguali. <b>Un pannello (tutta la larghezza)</b> nel menu di visualizzazione (<kbd>Ctrl+Shift+P</kbd>) mostra solo il pannello attivo, comodo per le miniature. <kbd>Tab</kbd> o il pulsante <b>⇄</b> mostra l'altro. Il pannello nascosto ricorda la sua cartella: <kbd>F5</kbd> e <kbd>F6</kbd> continuano ad andare lì, e il percorso si può cambiare nella finestra di conferma. La vista rapida mostra entrambi i pannelli finché è attiva.</p>
<p>Nella vista a miniature il cursore in basso nel pannello cambia la dimensione delle immagini (lo fa anche <kbd>Ctrl</kbd> + la rotellina del mouse); un doppio clic sul cursore ripristina la dimensione normale. Ogni pannello ha la sua dimensione.</p>`,
    },
    {
      id: 'select', t: 'Selezionare i file',
      h: `<p>La maggior parte dei comandi agisce sui file <b>selezionati</b>, oppure sul file sotto il cursore se non è selezionato nulla. I nomi selezionati hanno un colore diverso.</p>
<ul>
<li><kbd>Ins</kbd> seleziona il file e scende; <kbd>Spazio</kbd> lo seleziona e resta fermo (su una cartella calcola anche la dimensione totale del contenuto, mostrata nella colonna Dimensione).</li>
<li><kbd>Num +</kbd> seleziona un gruppo con una maschera (<code>*.jpg</code>, <code>report*.*</code>), <kbd>Num -</kbd> deseleziona un gruppo, <kbd>Num *</kbd> inverte la selezione, <kbd>Ctrl+A</kbd> seleziona tutto, <kbd>Ctrl+Num -</kbd> deseleziona tutto.</li>
<li><kbd>Alt+Num +</kbd> seleziona tutti i file con la stessa estensione del file sotto il cursore.</li>
<li>Con il mouse: <kbd>Ctrl</kbd>+clic aggiunge o toglie un file. Con la tastiera: tieni premuto <kbd>Shift</kbd> mentre muovi il cursore con le frecce.</li>
</ul>
<p>Il menu <b>Seleziona</b> ha gli stessi comandi, più "Copia negli appunti i nomi selezionati" e "Copia negli appunti i nomi con percorso" (comodi per incollare un elenco di file in un messaggio). <b>Confronta cartelle</b> (<kbd>Shift+F2</kbd>) seleziona in entrambi i pannelli i file che mancano nell'altro o sono più recenti o diversi (due cartelle normali, non archivi né server).</p>`,
    },
    {
      id: 'ops', t: 'Copiare, spostare, rinominare, eliminare',
      h: `<ul>
<li><b>Copia / Sposta</b> (<kbd>F5</kbd> / <kbd>F6</kbd>): la finestra mostra la destinazione (la cartella dell'altro pannello); si può cambiare o indicare un nuovo nome. Se un file esiste già, il programma chiede se sovrascriverlo o saltare i file esistenti. Le cartelle vengono copiate con tutto il contenuto.</li>
<li><b>Rinomina</b>: <kbd>F2</kbd> o <kbd>Shift+F6</kbd> chiede il nuovo nome del file sotto il cursore. Lo <b>Strumento di rinomina multipla</b> (<kbd>Ctrl+M</kbd>) rinomina molti file con maschere per nome ed estensione (<code>[N]</code> nome, <code>[C]</code> contatore, <code>[YMD]</code> data, parti del vecchio nome), con cerca e sostituisci, anteprima e preimpostazioni salvate.</li>
<li><b>Nuova cartella</b>: <kbd>F7</kbd>. <b>Modifica nuovo file</b>: <kbd>Shift+F4</kbd>.</li>
<li><b>Elimina</b>: <kbd>F8</kbd> o <kbd>Canc</kbd> sposta i file nel Cestino; <kbd>Shift+F8</kbd> o <kbd>Shift+Canc</kbd> li elimina definitivamente. Sui server e negli archivi non c'è il Cestino: i file vengono rimossi subito. Dropbox conserva i file eliminati per 30 giorni; Google Drive li sposta nel proprio cestino.</li>
<li><b>Proprietà</b> (<kbd>Alt+Invio</kbd>), <b>Calcola spazio occupato</b> (<kbd>Ctrl+L</kbd>) e <b>Cambia attributi</b> sono nel menu File.</li>
</ul>
<h3>Avanzamento, background e coda</h3>
<p>Le operazioni lunghe mostrano una finestra di avanzamento con nome del file, velocità e il pulsante <b>Annulla</b>. <b>Pausa</b> le ferma temporaneamente. <b>In background</b> manda l'operazione in coda e ti restituisce la finestra; nella finestra di copia la stessa cosa è il pulsante <b>F2 Coda</b> (l'operazione va direttamente in coda senza finestra di avanzamento); la finestra della coda elenca le operazioni in attesa, che vengono eseguite una dopo l'altra e si possono riordinare o annullare. La copia tra due dischi remoti (per esempio da Dropbox a un NAS) passa automaticamente da una cartella temporanea su questo computer.</p>
<p class="help-tip">Per copiare un file da un server o da un archivio, apri la cartella di destinazione nell'altro pannello e premi <kbd>F5</kbd>. Per copiare dentro un server o un archivio, aprilo prima nell'altro pannello.</p>`,
    },
    {
      id: 'archives', t: 'Archivi',
      h: `<p>Gli archivi si aprono come cartelle: <kbd>Invio</kbd> su un archivio ne mostra il contenuto, <kbd>Backspace</kbd> al primo livello lo chiude. <kbd>F3</kbd> visualizza un file all'interno, <kbd>F5</kbd> copia i file all'esterno.</p>
<table>
<tr><th>Formato</th><th>Sfogliare ed estrarre</th><th>Modificare sul posto</th><th>Comprimere</th></tr>
<tr><td>zip</td><td>sì</td><td>sì (aggiungere, eliminare, rinominare, nuova cartella, modificare e salvare un file)</td><td>sì</td></tr>
<tr><td>7z, tar, tar.gz (tgz), tar.bz2, tar.xz, cab, gz, bz2, xz</td><td>sì</td><td>no (sola lettura)</td><td>7z, tar, tar.gz, tar.bz2, tar.xz, gz, bz2, xz</td></tr>
<tr><td>rar</td><td>sì</td><td>no</td><td>no (solo estrazione)</td></tr>
</table>
<ul>
<li><kbd>Alt+F5</kbd> <b>comprime</b> i file selezionati (scegli formato e nome; avanzamento e annullamento come per la copia). <kbd>Alt+F9</kbd> <b>estrae</b> gli archivi selezionati, oppure solo i file selezionati di un archivio aperto.</li>
<li><kbd>Alt+Shift+F9</kbd> <b>verifica</b> gli archivi (controlla che non siano danneggiati). Menu File: <b>Dividi file...</b> e <b>Unisci file...</b> (con il file <code>.crc</code> di Total Commander).</li>
<li>Un archivio su un NAS o su un server SSH viene scaricato in una copia temporanea e si apre in sola lettura; se ne possono copiare i file. La copia diretta tra due archivi non è ancora supportata: usa una cartella intermedia.</li>
</ul>`,
    },
    {
      id: 'search', t: 'Cercare i file',
      h: `<p><b>Comandi > Cerca...</b> (<kbd>Alt+F7</kbd>) apre la finestra di ricerca.</p>
<ul>
<li><b>Nomi:</b> più maschere separate da <code>;</code> ed esclusioni dopo <code>|</code>, per esempio <code>*.js;*.ts|node_modules/</code>, oppure un'espressione regolare. Si può cercare in una o più cartelle, solo negli elementi selezionati, con un limite di profondità, e tra i nomi dentro i file zip.</li>
<li><b>Testo nei file:</b> parole intere, maiuscole/minuscole, espressione regolare, byte esadecimali, "che non contiene"; vengono provate le codifiche ANSI, DOS, UTF-8 e UTF-16; viene trovato anche il testo nei file docx, xlsx, pptx e OpenDocument.</li>
<li><b>Filtri:</b> data (compresa tra, più recente o più vecchia di), dimensione, attributi. <b>Duplicati:</b> file con lo stesso nome, la stessa dimensione o lo stesso contenuto.</li>
<li>Doppio clic su un risultato per andare al file; <b>Elenco nel pannello</b> mostra tutti i risultati come elenco in un pannello, dove F3, F5, F8 e gli altri comandi agiscono su di essi.</li>
</ul>
<h3>Indice dei file (ricerca veloce)</h3>
<p>Configurazione > <b>Indice dei file...</b> crea un indice dei nomi dei file nelle cartelle che scegli (lavora in background e viene salvato compresso nella cartella dati del programma). Con "Usa l'indice" attivo, le ricerche per nome, dimensione e data sono immediate se ogni cartella cercata si trova dentro una cartella indicizzata; altrimenti viene eseguita la normale ricerca sul disco. La ricerca di testo legge sempre i file.</p>
<h3>File su un server</h3>
<p>Per un server aperto in un pannello (Synology NAS, SSH, FTP, WebDAV, Dropbox, Google Drive) si apre la stessa finestra di ricerca: premi <kbd>Alt+F7</kbd> sul suo pannello o usa <b>Rete > Database dei file del server...</b>. L\'analisi percorre le cartelle una volta e memorizza nomi, dimensioni e date; l\'aggiornamento lo rifà. Poi la ricerca risponde subito: maschere dei nomi, cartelle, profondità, date, dimensioni, attributi cartella e nascosto, duplicati per nome o dimensione, ricerche salvate ed elenco dei risultati nel pannello. Il testo nei file, il contenuto degli zip e i duplicati per contenuto lì non sono disponibili. Una parola senza <code>*</code> o <code>?</code> significa "il nome la contiene"; un nome con estensione (<code>103.jpg</code>) trova solo esattamente quel nome, e <code>*103.jpg</code> tutti i nomi che finiscono così. Il database è un file su questo computer. Un\'unità di rete con lettera si indicizza nella configurazione dell\'indice dei file.</p>
<p>"Feed to listbox" nella finestra del database mette tutti i file trovati (fino a 20.000) nel pannello in un unico elenco. Lì si possono vedere, aprire e copiare su questo computer con <kbd>F5</kbd> (i nomi uguali ricevono un numero). <kbd>Backspace</kbd> esce dall'elenco.</p>`,
    },
    {
      id: 'viewer', t: 'Visualizzatore, editor e vista rapida',
      h: `<h3>Visualizzatore (F3)</h3>
<p>Mostra il file sotto il cursore senza aprire un altro programma: testo con riconoscimento automatico della codifica (UTF-8, UTF-16, Windows-1251, CP866 ...; si cambia nell'elenco Codifica in alto), dump esadecimale, immagini, PDF, video e audio. I <b>documenti</b> (docx, xlsx, pptx, OpenDocument, e i vecchi doc e rtf come testo semplice) sono disegnati dal programma stesso con titoli, elenchi, tabelle e immagini, quindi Word o Office non servono. I formati video e audio che il motore non sa riprodurre (HEVC, AVI, WMV, AC3, APE, WavPack, ALAC, AIFF ...) vengono convertiti al volo da ffmpeg, incluso nel programma. Nel visualizzatore <kbd>F7</kbd> cerca il testo, <kbd>N</kbd> e <kbd>P</kbd> mostrano il file successivo e precedente della cartella, <kbd>Esc</kbd> lo chiude. Funziona anche con i file negli archivi e sui server (il file viene prima scaricato in una posizione temporanea).</p>
<h3>Editor (F4)</h3>
<p>Un editor di testo semplice che mantiene la codifica, il BOM e le terminazioni di riga del file, con cerca e sostituisci. Modifica i file negli archivi zip e sui server NAS, SSH, FTP e WebDAV e li risalva. <kbd>Shift+F4</kbd> crea un nuovo file. Carattere e tabulazione si impostano in Configurazione > <b>Editor...</b>.</p>
<h3>Vista rapida (Ctrl+Q)</h3>
<p>L'altro pannello mostra l'anteprima del file sotto il cursore e lo segue mentre ti muovi. <kbd>Ctrl+Q</kbd> di nuovo riporta l'elenco dei file.</p>
<p>Altri modi per aprire un file: <kbd>Invio</kbd> lo avvia con l'applicazione associata dal sistema operativo; File > <b>Apri con l'applicazione predefinita</b> fa lo stesso con qualsiasi file.</p>
<h3>Immagini HEIC</h3>
<p>Le foto HEIC / HEIF sono mostrate dal visualizzatore, dalla vista rapida e dalle miniature. <b>File > Converti HEIC / JPG...</b> trasforma i file HEIC scelti in JPG, e JPG o PNG in HEIC; si può scegliere la qualità. Gli originali restano e niente viene sovrascritto. Funziona anche con le immagini su un server (pannello del server o elenco dei file trovati su di esso): i risultati vanno su questo computer o sul server; a questo scopo le immagini vengono scaricate, convertite su questo computer e caricate.</p>
<p>Invio e doppio clic mostrano immagini (anche HEIC), video, PDF, testo e documenti per ufficio nel visualizzatore integrato. Per il programma di sistema usa "Open With Default Application" nel menu dei file; si può disattivare nelle impostazioni.</p>`,
    },
    {
      id: 'media', t: 'Musica e video',
      h: `<h3>Lettore musicale</h3>
<p><kbd>Invio</kbd> su un file audio avvia il lettore: sopra i pulsanti dei tasti funzione compare una barra e la musica continua mentre sfogli. Gli altri file audio della cartella formano la coda. La barra ha precedente / riproduci-pausa / successivo, cursore di posizione, ordine casuale, ripetizione (no / tutti / uno), volume e un pulsante che chiude il lettore.</p>
<ul>
<li>Scorciatoie: <kbd>Ctrl+Spazio</kbd> (macOS: <kbd>Option+Spazio</kbd>) riproduci / pausa, <kbd>Ctrl+Shift+Destra</kbd> / <kbd>Ctrl+Shift+Sinistra</kbd> brano successivo / precedente. Funzionano anche i tasti multimediali della tastiera. Il menu Comandi ha le stesse voci.</li>
<li>mp3, FLAC, WAV, OGG, Opus, AAC e M4A si riproducono direttamente; APE, WavPack, ALAC, AIFF, WMA, DSD, AC3, DTS, MPC e altri sono decodificati da ffmpeg.</li>
<li>La musica di un pannello NAS, SSH, FTP, WebDAV, Dropbox o Google Drive viene trasmessa in streaming: parte subito e si può saltare in qualsiasi punto del brano.</li>
</ul>
<h3>Musica chip (ZX Spectrum, Atari ST, Amstrad)</h3>
<p>Lo stesso lettore riproduce i moduli per il chip sonoro AY-3-8910 / YM2149: <b>PT3, PT2, PT1, STC, ST1, ST3, STP, SQT, ASC, PSC, PSM, FTC, GTR, AY, AYC, PSG, TSD, VTX e YM</b>. Il chip è emulato; prima del primo suono il programma prepara l'intero brano (circa un secondo per qualche minuto di musica, "rendering..." nel titolo), poi ci si può spostare come in qualsiasi altro file. Il titolo viene preso dal modulo.</p>
<h3>Video</h3>
<p><kbd>F3</kbd> o <kbd>Invio</kbd> su un video lo apre nel visualizzatore, con possibilità di spostarsi, anche da server e cloud.</p>`,
    },
    {
      id: 'nas', t: 'Synology NAS',
      h: `<p><b>Rete > Synology NAS...</b> (<kbd>Ctrl+F</kbd>) si collega alla File Station di un DiskStation Synology e la mostra come un disco.</p>
<ol>
<li>Indirizzo: l'indirizzo locale con la porta di DSM (per esempio <code>nas.local:5001</code> o <code>192.168.1.20:5000</code>) oppure un indirizzo <b>QuickConnect</b> (<code>https://id.region.quickconnect.to</code> o solo l'id). QuickConnect impiega qualche secondo per trovare la strada verso il NAS.</li>
<li>Utente e password; il codice della <b>verifica in 2 passaggi</b> se è attiva per l'account.</li>
<li>"Consenti un certificato non attendibile" serve per un NAS con certificato autofirmato. "Ricorda la password" la salva cifrata dal sistema operativo.</li>
<li><b>Connetti</b>. La connessione viene salvata nell'elenco a sinistra della finestra; la volta successiva basta un doppio clic.</li>
</ol>
<p>Nel pannello si può sfogliare, copiare in entrambe le direzioni (con avanzamento), creare cartelle, rinominare, eliminare, visualizzare, modificare e riprodurre video e musica in streaming. <b>Rete > Disconnetti</b> chiude la connessione; l'elenco delle unità (<kbd>Alt+F1</kbd>) mostra quelle aperte e permette di tornarci.</p>
<p><b>macOS:</b> se la copia da un NAS nella tua rete è lenta, apri <b>System Settings > Privacy & Security > Local Network</b>: Commander deve essere attivo lì. Senza questa autorizzazione la connessione passa da internet. La riga sopra il pannello mostra il percorso: local network, direct over the internet o QuickConnect relay.</p>
<p>La casella "Connetti all'avvio del programma e mantieni la connessione" nella finestra di connessione (serve l'accesso salvato) collega il server a ogni avvio, lo controlla ogni tanto e lo ricollega dopo un'interruzione. Un accesso rifiutato o un NAS che chiede il codice in due passaggi non viene ritentato; l'elenco delle unità mostra il motivo. Dopo una disconnessione manuale non si ricollega da solo. In cima al server non c'è la riga "..": si esce dall'elenco delle unità o disconnettendo.</p>`,
    },
    {
      id: 'ssh', t: 'SSH, SFTP e console',
      h: `<p><b>Rete > Server SSH...</b> (<kbd>Ctrl+Shift+F</kbd>) si collega con una password o un file di chiave (OpenSSH, PEM; le chiavi PuTTY versione 2 vengono convertite).</p>
<ul>
<li><b>Apri come:</b> "Disco" mostra l'elenco dei file del server (SFTP), "Console" apre prima un vero terminale. <kbd>Ctrl+O</kbd> passa dall'uno all'altro in qualsiasi momento; la console conserva la cronologia.</li>
<li>Nella <b>console</b> tutti i tasti vanno al server tranne <kbd>Ctrl+O</kbd>. I file copiati con <kbd>F5</kbd> o trascinati sulla console vengono caricati nella cartella in cui si trova la console.</li>
<li><b>Chiave dell'host:</b> la prima volta il programma mostra l'impronta del server e chiede di considerarlo attendibile; viene ricordata, e una chiave cambiata viene segnalata con un avviso (può indicare un attacco o un server reinstallato).</li>
<li><b>Apri in PuTTY</b> (menu Rete o pulsante della finestra) avvia PuTTY con la stessa connessione, se PuTTY è installato.</li>
<li>I file remoti si possono visualizzare, modificare, copiare e trascinare dal pannello in un'altra applicazione.</li>
</ul>
<h3>Importazione da WinSCP</h3>
<p><b>Rete > Importa da WinSCP...</b> legge le sessioni di WinSCP (dal registro di sistema o da un file <code>WinSCP.ini</code> a scelta) e crea le connessioni: le sessioni SFTP / SCP diventano connessioni SSH (i file delle chiavi vengono copiati nella cartella protetta del programma), le sessioni FTP e WebDAV diventano connessioni FTP e WebDAV. Le password non vengono importate: inseriscile alla prima connessione. Le sessioni S3 non sono supportate.</p>`,
    },
    {
      id: 'ftp', t: 'FTP, FTPS e WebDAV',
      h: `<h3>FTP e FTPS</h3>
<p><b>Rete > Server FTP / FTPS...</b></p>
<table>
<tr><td>Host</td><td>il nome del server, eventualmente con la porta: <code>ftp.example.com</code> o <code>ftp.example.com:2121</code></td></tr>
<tr><td>Sicurezza</td><td><b>FTP su TLS (esplicito)</b> è quello consigliato: porta 21, la connessione passa a TLS. Il <b>TLS implicito</b> usa la porta 990. L'<b>FTP semplice</b> invia la password senza cifratura: usalo solo in una rete fidata.</td></tr>
<tr><td>Utente, Password</td><td>oppure premi <b>Accesso anonimo</b> (utente <code>anonymous</code>, password in forma di indirizzo e-mail).</td></tr>
<tr><td>Cartella remota</td><td>facoltativa: la cartella da aprire per prima, per esempio <code>/public_html</code></td></tr>
<tr><td>Cartella locale</td><td>facoltativa: alla connessione l'altro pannello va in questa cartella.</td></tr>
<tr><td>Mantieni attiva</td><td>facoltativo: invia un NOOP ogni N secondi, perché un server con un breve limite di inattività non chiuda la connessione. (Una connessione chiusa dal server viene comunque riaperta da sola.)</td></tr>
<tr><td>Dopo l'accesso</td><td>comandi FTP facoltativi inviati dopo l'accesso, separati da <code>;</code></td></tr>
</table>
<p>"Consenti un certificato non attendibile" serve per un server con certificato TLS autofirmato. Il programma usa la modalità passiva (quella che funziona attraverso router e firewall).</p>
<h3>WebDAV</h3>
<p><b>Rete > Server WebDAV...</b> richiede l'indirizzo completo della cartella WebDAV: Nextcloud / ownCloud <code>https://cloud.example.com/remote.php/dav/files/NAME/</code>, Synology, Apache, nginx, IIS, Box e altri. L'accesso può essere Basic o Digest; con l'utente vuoto ci si collega senza accesso. Un reindirizzamento verso un altro server non porta con sé la password.</p>
<h3>QNAP, UGREEN</h3>
<p><b>Rete > QNAP NAS...</b>, <b>Rete > UGREEN NAS...</b> si collegano a questi NAS tramite WebDAV. La finestra indica dove attivarlo e ha un proprio elenco di connessioni.</p>
<ul>
<li><b>QNAP:</b> attiva WebDAV in <b>Control Panel > Network & File Services > Win/MAC/NFS/WebDAV > WebDAV</b>.</li>
<li><b>UGREEN:</b> attiva WebDAV in <b>Control Panel > File Service > WebDAV</b>; 5006 (HTTPS), 5005 (HTTP).</li>
</ul>
<p>Usa HTTPS. Il consenso a un certificato non attendibile serve per il certificato creato dal NAS stesso: selezionalo solo nella tua rete.</p>
<p>Entrambi i tipi funzionano come i pannelli NAS e SSH: sfogliare, copiare in entrambe le direzioni con avanzamento, creare, rinominare, eliminare, visualizzare, modificare e riprodurre in streaming video e musica con possibilità di spostarsi. Note: un server che non fornisce le date di modifica mostra date vuote; i nomi devono essere in UTF-8; per WebDAV non ci sono blocchi dei file.</p>`,
    },
    {
      id: 'cloud', t: 'Dropbox e Google Drive',
      h: `<p><b>Rete > Dropbox...</b> e <b>Rete > Google Drive...</b> mostrano il cloud come un disco normale. Non serve il client desktop di Dropbox o Google.</p>
<ol>
<li>Premi il pulsante di accesso: si apre il browser, accedi sulla pagina di Dropbox o Google e premi Consenti. La password non arriva mai a questo programma.</li>
<li>Quando il browser indica che l'accesso è riuscito, torna al programma; i file compaiono nel pannello.</li>
<li>"Resta connesso su questo computer" conserva un token di aggiornamento (cifrato dal sistema operativo), così la volta successiva basta <b>Connetti</b>. "Usa un altro account" ripete l'accesso.</li>
</ol>
<p>Si può sfogliare, copiare in entrambe le direzioni, creare, rinominare, eliminare, visualizzare, modificare e riprodurre in streaming. I documenti di Google (Documenti, Fogli, Presentazioni) vengono esportati quando li copi. Dropbox conserva i file eliminati per 30 giorni; Google Drive li sposta nel cestino.</p>
<p class="help-warn">Dropbox e Google richiedono che ogni programma si identifichi con una propria chiave app. Le versioni normali la contengono e basta accedere. Se la finestra chiede una "Chiave app" o un "Client ID", premi lì "Impostazioni e guida alla configurazione...": spiega in pochi passaggi come creare una volta una chiave gratuita nella console del servizio (il campo viene ricordato per tutti gli account).</p>`,
    },
    {
      id: 'sync', t: 'Sincronizzazione delle impostazioni',
      h: `<p>Configurazione > <b>Sincronizzazione impostazioni...</b> mantiene uguali le impostazioni su tutti i tuoi computer. Sono salvate in un unico file zip, <code>/Commander/settings.zip</code>, nel tuo Dropbox o Google Drive, oppure in una cartella di questo computer (una chiavetta USB o una cartella sincronizzata da un altro programma).</p>
<ul>
<li>Cosa viene sincronizzato: connessioni, preferiti, preimpostazioni di ricerca e rinomina, lingua e impostazioni di visualizzazione. Quando si uniscono due computer vince la modifica più recente di ogni impostazione.</li>
<li><b>Tieni le impostazioni lì:</b> sincronizza all'avvio del programma e dopo ogni modifica. <b>Sincronizza ora</b> unisce una volta; <b>Recupera impostazioni</b> e <b>Salva impostazioni</b> forzano una direzione (prendere le impostazioni dell'altro computer, oppure sovrascriverle con queste).</li>
<li><b>Includi nello zip password, accessi e file di chiavi SSH:</b> senza questa opzione viaggiano solo nomi e indirizzi delle connessioni. Se la attivi, proteggi lo zip con una password (AES-256, la stessa su tutti i computer); senza password chiunque possa aprire quel posto può leggere le tue password. Una password dimenticata non si può recuperare.</li>
</ul>
<p class="help-tip">Per lo zip usa una password ASCII senza virgolette né barre rovesciate: viene passata a 7-Zip.</p>`,
    },
    {
      id: 'tools', t: 'Strumenti dei menu File e Comandi',
      h: `<ul>
<li><b>Confronta cartelle</b> (<kbd>Shift+F2</kbd>): seleziona le differenze tra i due pannelli. <b>Sincronizza cartelle...</b> (menu Comandi) elenca le differenze tra le due cartelle con le sottocartelle e copia i file mancanti o più recenti nella direzione scelta. Entrambi richiedono due cartelle normali.</li>
<li><b>Confronta per contenuto...</b> (menu File): due file affiancati, con le differenze evidenziate.</li>
<li><b>Strumento di rinomina multipla</b> (<kbd>Ctrl+M</kbd>), <b>Cambia attributi</b> (sola lettura, nascosto, sistema, archivio, date, anche nelle sottocartelle), <b>Proprietà</b> (<kbd>Alt+Invio</kbd>), <b>Calcola spazio occupato</b> (<kbd>Ctrl+L</kbd>).</li>
<li><b>Modifica commento</b> (<kbd>Ctrl+Z</kbd>): la descrizione di un file, salvata in <code>descript.ion</code> come in Total Commander e mostrata nel pannello.</li>
<li><b>Crea file di checksum...</b> e <b>Verifica checksum...</b>: MD5, SHA-1, SHA-256 e altri; una finestra di avanzamento e l'elenco dei file danneggiati o mancanti.</li>
<li><b>Dividi file...</b> / <b>Unisci file...</b>: taglia un file grande in parti della dimensione scelta e le riunisce (un file <code>.crc</code> conserva l'ordine e le somme di controllo).</li>
<li><b>Codifica / Decodifica file (MIME, UUE)</b>: trasforma un file binario in testo per l'e-mail e viceversa.</li>
<li><b>Programmi in avvio automatico...</b> (menu Comandi): mostra cosa si avvia insieme al computer, nello stile di Autoruns di Sysinternals.</li>
</ul>`,
    },
    {
      id: 'extras', t: 'Altre funzioni',
      h: `<ul>
<li><b>Emulatore ZX Spectrum:</b> <kbd>Invio</kbd> su un file <code>.trd .scl .tap .tzx .z80 .sna .szx .fdi .td0 .udi .csw .hob</code> lo avvia nell'emulatore incluso (Unreal Speccy Portable); File > <b>Esegui nell'emulatore ZX Spectrum</b> fa lo stesso.</li>
<li><b>WSL come disco:</b> le distribuzioni Linux installate compaiono nell'elenco delle unità come "WSL: nome"; ogni percorso <code>\\\\wsl$\\name\\...</code> è una cartella normale.</li>
<li><b>Trascinamento:</b> trascina i file da un pannello in un'altra applicazione (dai dischi remoti vengono prima scaricati). I file trascinati sulla console SSH vengono caricati nella sua cartella corrente.</li>
<li><b>Barra degli strumenti:</b> la fila di pulsanti sotto il menu si mostra o si nasconde in Configurazione > Mostra barra degli strumenti.</li>
<li><b>Finestre di dialogo separate:</b> come in Total Commander, una finestra di dialogo si può portare fuori dalla finestra principale. Si disattiva in Configurazione > Visualizzazione.</li>
<li><b>Lingue dell'interfaccia:</b> inglese, russo, ucraino, bielorusso, polacco, portoghese, spagnolo, tedesco e italiano (Configurazione > Lingua...). Menu, finestre, pulsanti e questa guida seguono la lingua; i nomi dei file non vengono mai tradotti.</li>
</ul>`,
    },
    {
      id: 'keys', t: 'Scorciatoie da tastiera',
      h: '',
    },
    {
      id: 'config', t: 'Configurazione e aggiornamenti',
      h: `<ul>
<li><b>Configurazione...</b> contiene i gruppi di opzioni (visualizzazione, pannelli, operazioni sui file e altri). <b>Scorciatoie...</b> permette di assegnare altri tasti a ogni comando, <b>Editor...</b> imposta l'editor, <b>Lingua...</b> cambia la lingua (il programma riavvia la finestra). Il <b>Tema scuro</b> (menu Configurazione, oppure Configurazione > Visualizzazione) può essere attivo, disattivato o come il sistema, cioè segue l'impostazione del sistema operativo.</li>
<li><b>Cerca aggiornamenti...</b>: il programma controlla anche da solo, pochi secondi dopo l'avvio, se c'è una nuova versione e propone di installarla. Su Windows il nuovo programma portatile sostituisce il vecchio file dopo il controllo dello SHA-256; su Linux fa lo stesso il nuovo AppImage; sul Mac l'installazione con un solo comando viene eseguita dal programma. Si può saltare una versione.</li>
<li><b>Indice dei file...</b> e <b>Sincronizzazione impostazioni...</b> hanno capitoli propri.</li>
<li><b>Informazioni</b> > <b>Informazioni su Alternate Commander...</b> mostra la versione e le novità dell'ultimo rilascio. C'è l'interruttore <b>Modalità sviluppatore</b>: apre una finestra con il registro dettagliato di sincronizzazione, aggiornamenti e archivi, utile per segnalare un problema.</li>
</ul>
<p>Impostazioni, preferiti e connessioni salvate si trovano nella cartella dati del programma (chiamata <code>Commander</code> nella cartella dei dati delle applicazioni del tuo utente). Il programma portatile per Windows li tiene accanto a sé in <code>Commander-data</code>. Le password salvate sono cifrate, vedi "Password, privacy e sicurezza".</p>`,
    },
    {
      id: 'platforms', t: 'Windows, macOS e Linux',
      h: `<h3>Windows</h3>
<p>Windows 10 / 11 a 64 bit. Il programma portatile non richiede installazione. Le versioni non sono ancora firmate, quindi la prima volta SmartScreen può mostrare un avviso: scegli <b>Ulteriori informazioni</b> e <b>Esegui comunque</b>. Installazione con Scoop: <code>scoop bucket add powervac https://github.com/powervac/scoop-bucket</code> e <code>scoop install alternate-commander</code>.</p>
<h3>macOS</h3>
<p>Apple Silicon e Intel. Il modo più semplice: <code>curl -fsSL https://altcom.cc/install-mac.sh | bash</code> nel Terminale (evita anche il messaggio "danneggiata" delle app non firmate) oppure <code>brew install --cask powervac/tap/alternate-commander</code>. Se macOS dice che l'app è danneggiata: <code>xattr -cr /Applications/Commander.app</code>.</p>
<ul>
<li><b>Ctrl diventa Cmd e Alt diventa Option</b> in tutte le scorciatoie di questa guida, tranne <kbd>Ctrl+Q</kbd> (vista rapida) e i tasti della console SSH, che restano Ctrl. <kbd>Cmd+A</kbd> seleziona tutti i file, <kbd>Cmd+W</kbd> chiude una scheda, <kbd>Cmd+M</kbd> è la rinomina multipla, <kbd>Cmd+Q</kbd> chiude il programma.</li>
<li>I tasti F richiedono <kbd>Fn</kbd>, oppure attiva "Usa i tasti F1, F2, ecc. come tasti funzione standard" in Impostazioni di Sistema > Tastiera. I pulsanti in fondo alla finestra e i menu fanno lo stesso.</li>
<li>La prima volta che il programma legge Documenti, Download o Scrivania, macOS chiede il permesso. Le condivisioni di rete sono nell'elenco delle unità, in <code>/Volumes</code>.</li>
</ul>
<h3>Linux</h3>
<p>x86_64. <code>curl -fsSL https://altcom.cc/install-linux.sh | bash</code> installa il programma in <code>~/Applications</code> e lo aggiunge al menu delle applicazioni; oppure scarica l'AppImage ed esegui <code>chmod +x</code>. Se il sistema non ha un portachiavi (keyring), le password salvate sono protette da un file chiave del programma.</p>`,
    },
    {
      id: 'security', t: 'Password, privacy e sicurezza',
      h: `<ul>
<li>Le <b>password salvate</b> sono facoltative ("Ricorda la password") e vengono salvate cifrate dal sistema operativo (DPAPI di Windows, Portachiavi di macOS, keyring di Linux). Vengono inviate solo al server a cui ti colleghi.</li>
<li>L'<b>accesso al cloud</b> avviene nel browser; il programma conserva solo un token di aggiornamento. I file passano direttamente tra questo computer e il servizio, mai attraverso un server di questo programma.</li>
<li><b>SSH</b> considera attendibile la chiave dell'host la prima volta e avvisa se cambia. <b>FTPS</b> e <b>HTTPS</b> controllano il certificato del server; "Consenti un certificato non attendibile" disattiva il controllo per una connessione, usalo solo con un server che conosci.</li>
<li>L'<b>FTP semplice</b> e gli indirizzi WebDAV <b>http://</b> inviano la password senza cifratura.</li>
<li>Lo streaming dei file multimediali dai server è in ascolto solo su questo computer (127.0.0.1) e richiede una chiave casuale creata a ogni avvio.</li>
<li>Il programma controlla gli aggiornamenti su <code>altcom.cc</code> e scarica solo file con lo SHA-256 corretto.</li>
<li>Sincronizzazione delle impostazioni con le password: usa la password dello zip (vedi "Sincronizzazione delle impostazioni").</li>
</ul>`,
    },
    {
      id: 'trouble', t: 'Risoluzione dei problemi e domande',
      h: `<h3>Non riesco a collegarmi al mio server NAS, SSH, FTP o WebDAV</h3>
<p>Leggi il messaggio nella finestra di connessione, che indica le cause più comuni. "Connection refused" significa porta sbagliata o servizio fermo, "did not answer in time" un firewall o un indirizzo errato, "Login failed" utente o password errati. "The server certificate is not trusted": il server usa un certificato autofirmato; se ti fidi, spunta "Consenti un certificato non attendibile". Con QuickConnect attendi qualche secondo; se continua a fallire, prova l'indirizzo locale con la porta.</p>
<h3>Una connessione FTP mostra l'elenco ma fallisce con i file</h3>
<p>Il programma usa la modalità passiva; un firewall che blocca le porte delle connessioni dati passive interrompe il trasferimento. Prova una volta "FTP semplice" per capire se la causa è TLS, oppure chiedi all'amministratore di aprire l'intervallo delle porte passive.</p>
<h3>Un video o un brano non si riproduce</h3>
<p>I formati che il motore non conosce vengono convertiti da ffmpeg; se il file è danneggiato o usa un codec molto raro, il visualizzatore lo segnala. Su un computer lento lascia a un video grande un momento per partire.</p>
<h3>I tasti non funzionano su macOS</h3>
<p>Vedi "Windows, macOS e Linux": i tasti F richiedono Fn, e Ctrl in questa guida significa Cmd.</p>
<h3>La lingua del programma è sbagliata</h3>
<p>Configurazione > Lingua... Se la sincronizzazione delle impostazioni è attiva, può essere ripresa la lingua dell'altro computer: cambiala ancora una volta.</p>
<h3>Una finestra di dialogo è sparita o è sullo schermo sbagliato</h3>
<p>Le finestre di dialogo sono finestre separate; chiudila con Esc e riaprila, oppure disattiva l'opzione in Configurazione > Visualizzazione.</p>
<h3>Segnalare un problema o chiedere una funzione</h3>
<p>Usa il modulo su <a href="#" data-u="https://altcom.cc/#requests">altcom.cc</a> o apri una segnalazione su <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander/issues">GitHub</a>. Attiva la <b>Modalità sviluppatore</b> in Informazioni, ripeti il problema e aggiungi alla segnalazione le righe della finestra del registro.</p>`,
    },
    {
      id: 'about', t: 'Informazioni sul programma',
      h: `<p><b>Alternate Commander</b> è un gestore di file a due pannelli gratuito e open source per Windows, macOS e Linux, nello stile di Total Commander. È un progetto indipendente e non è affiliato a Total Commander né a Ghisler Software.</p>
<ul>
<li>Sito: <a href="#" data-u="https://altcom.cc">altcom.cc</a>; novità di ogni versione: <a href="#" data-u="https://altcom.cc/changelog.html">changelog</a>.</li>
<li>Codice sorgente e segnalazioni: <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander">github.com/powervac/Alternate-Total-Commander</a> (licenza MIT).</li>
<li>Realizzato con Electron. Componenti di terze parti: l'emulatore ZX Spectrum Unreal Speccy Portable (GPL-3.0), ffmpeg e 7-Zip per conversioni e archivi, xterm.js per la console SSH, ssh2 e basic-ftp per le connessioni, e il carattere Inter. L'elenco completo è nel README del progetto.</li>
</ul>
<p>La versione e il controllo degli aggiornamenti si trovano in <b>Informazioni > Informazioni su Alternate Commander...</b>.</p>`,
    },
  ],
};
