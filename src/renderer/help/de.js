'use strict';
// Hilfe, Deutsch. Das Format steht in help.js; die Kennungen der Abschnitte sind dieselben wie in en.js.
HELP_TEXT.de = {
  ui: {
    title: 'Hilfe',
    search: 'In der Hilfe suchen',
    close: 'Schließen',
    none: 'Nichts gefunden.',
    found: '{n} Treffer in {s} Abschnitten',
    hint: 'F1 öffnet diese Hilfe jederzeit.',
    keysIntro: 'Alle Befehle des Programms mit den Tasten, die sie jetzt haben. Auf einem Mac ist Ctrl gleich Cmd und Alt gleich Option. Jede Taste lässt sich unter Konfiguration > Tastenkürzel... ändern; diese Liste folgt Ihren Änderungen.',
    keysFoot: 'Außerdem: Enter öffnet den Ordner, das Archiv oder die Datei unter dem Cursor, Backspace geht eine Ebene höher, Tab wechselt das Panel, die Pfeiltasten, Pos1, Ende, Bild auf und Bild ab bewegen den Cursor, Esc schließt Dialoge und Menüs. Getippter Text landet in der Befehlszeile unten.',
  },
  sections: [
    {
      id: 'start', t: 'Erste Schritte',
      h: `<p>Alternate Commander ist ein Dateimanager mit <b>zwei Panels</b> im Stil von Total Commander. Ein Panel ist aktiv (sein Pfad ist hervorgehoben); das andere ist das Ziel beim Kopieren und Verschieben. Alles lässt sich mit der Tastatur erledigen, und alles hat auch einen Menüpunkt oder eine Schaltfläche.</p>
<ul>
<li><kbd>Tab</kbd> wechselt das aktive Panel. Die Pfeiltasten bewegen den Cursor, <kbd>Enter</kbd> öffnet einen Ordner, ein Archiv oder eine Datei, <kbd>Backspace</kbd> geht eine Ebene höher.</li>
<li><kbd>F5</kbd> kopiert die markierten Dateien ins andere Panel, <kbd>F6</kbd> verschiebt sie, <kbd>F7</kbd> legt einen Ordner an, <kbd>F8</kbd> löscht, <kbd>F3</kbd> zeigt an, <kbd>F4</kbd> bearbeitet. Diese Schaltflächen gibt es auch unten im Fenster.</li>
<li>Die Schaltfläche oben links in einem Panel öffnet die <b>Laufwerksliste</b> (<kbd>Alt+F1</kbd> für das linke, <kbd>Alt+F2</kbd> für das rechte Panel): Laufwerke, Standardordner, Netzlaufwerke, Favoriten und Ihre Verbindungen zu Servern und Clouds.</li>
<li>Das <b>Menü</b> öffnet sich mit der Maus oder mit <kbd>F9</kbd> / <kbd>F10</kbd>. Der letzte Eintrag, <b>Info</b>, enthält diese Hilfe und das Fenster mit Version und Updates.</li>
</ul>
<p class="help-tip">Neu im Programm? Lesen Sie zuerst „Panels, Tabs und Navigation“, „Dateien markieren“ und „Kopieren, Verschieben, Umbenennen, Löschen“. Die übrigen Kapitel beschreiben die weiteren Funktionen der Reihe nach; ein Wort finden Sie mit dem Suchfeld.</p>
<p>Unter den Panels befindet sich die <b>Befehlszeile</b>: Geben Sie einen Befehl ein und drücken Sie Enter, um ihn im Ordner des aktiven Panels auszuführen; <code>cd Ordner</code> wechselt stattdessen den Ordner des aktiven Panels. <kbd>Ctrl+Enter</kbd> fügt den Namen der Datei unter dem Cursor in die Befehlszeile ein, <kbd>Ctrl+Shift+Enter</kbd> ihren vollständigen Pfad.</p>`,
    },
    {
      id: 'panels', t: 'Panels, Tabs und Navigation',
      h: `<h3>Ordner und die Laufwerksliste</h3>
<p>Der Pfad eines Panels steht über seiner Liste; die Zeile darunter zeigt Anzahl und Größe der markierten und aller Dateien. <kbd>Alt+F1</kbd> / <kbd>Alt+F2</kbd> öffnen die Laufwerksliste des linken / rechten Panels. Sie enthält: die lokalen Laufwerke, verbundene Netzlaufwerke (mit dem Netzwerkpfad), die Standardordner (Benutzerordner, Desktop, Dokumente, Downloads ...), unter Windows die installierten <b>WSL</b>-Distributionen und darunter Ihre geöffneten und gespeicherten Verbindungen (NAS, SSH, FTP, WebDAV, Dropbox, Google Drive). Unter macOS werden die Volumes aus <code>/Volumes</code> aufgeführt (auch Netzfreigaben).</p>
<h3>Verlauf und Zurück</h3>
<p><kbd>Alt+Left</kbd> und <kbd>Alt+Right</kbd> gehen im Verlauf des Panels zurück und vor. <kbd>Ctrl+U</kbd> vertauscht die beiden Panels; das Menü Befehle hat außerdem „Ziel=Quelle“, das denselben Ordner im anderen Panel zeigt.</p>
<h3>Tabs</h3>
<p>Jedes Panel hat eigene Tabs: <kbd>Ctrl+T</kbd> öffnet einen neuen (eine Kopie des aktuellen Ordners), <kbd>Ctrl+W</kbd> schließt ihn, <kbd>Ctrl+Tab</kbd> / <kbd>Ctrl+Shift+Tab</kbd> wechseln zwischen ihnen und <kbd>Ctrl+Up</kbd> öffnet den Ordner (oder das Archiv) unter dem Cursor in einem neuen Tab. Die Tabs bleiben beim Beenden des Programms erhalten.</p>
<h3>Sortierung und Ansichten</h3>
<p>Klicken Sie auf eine Spaltenüberschrift oder drücken Sie <kbd>Ctrl+F3</kbd> (Name), <kbd>Ctrl+F4</kbd> (Endung), <kbd>Ctrl+F5</kbd> (Datum), <kbd>Ctrl+F6</kbd> (Größe). Dieselbe Taste noch einmal kehrt die Reihenfolge um. <kbd>Ctrl+Shift+F4</kbd> schaltet das Panel auf <b>Vorschaubilder</b> (Bilder, Videobilder, PDF und Dokumente); <kbd>Ctrl+Q</kbd> macht das andere Panel zur <b>Schnellansicht</b> der Datei unter dem Cursor. <kbd>Ctrl+R</kbd> liest den Ordner neu ein.</p>
<h3>Verzeichnis-Favoriten</h3>
<p><kbd>Ctrl+D</kbd> öffnet Ihre Lieblingsordner. Der aktuelle Ordner lässt sich zur Liste hinzufügen, auch der aktuelle Ordner eines Cloud-Laufwerks, eines NAS oder eines SSH-, FTP- oder WebDAV-Servers: Beim Wählen eines solchen Favoriten verbindet das Programm bei Bedarf neu und geht direkt dorthin. Die Favoriten von Total Commander werden einmalig aus <code>wincmd.ini</code> importiert, wenn das Programm die Datei findet.</p>`,
    },
    {
      id: 'select', t: 'Dateien markieren',
      h: `<p>Die meisten Befehle wirken auf die <b>markierten</b> Dateien oder, wenn nichts markiert ist, auf die Datei unter dem Cursor. Markierte Namen erscheinen in einer anderen Farbe.</p>
<ul>
<li><kbd>Insert</kbd> markiert die Datei und geht nach unten; <kbd>Space</kbd> markiert und bleibt stehen (bei einem Ordner berechnet es zusätzlich die Gesamtgröße seines Inhalts, die in der Spalte Größe erscheint).</li>
<li><kbd>Num +</kbd> markiert eine Gruppe nach Maske (<code>*.jpg</code>, <code>report*.*</code>), <kbd>Num -</kbd> hebt die Markierung einer Gruppe auf, <kbd>Num *</kbd> kehrt die Markierung um, <kbd>Ctrl+A</kbd> markiert alles, <kbd>Ctrl+Num -</kbd> hebt alle Markierungen auf.</li>
<li><kbd>Alt+Num +</kbd> markiert alle Dateien mit derselben Endung wie die Datei unter dem Cursor.</li>
<li>Mit der Maus: <kbd>Ctrl</kbd>+Klick fügt eine Datei hinzu oder entfernt sie. Mit der Tastatur: <kbd>Shift</kbd> gedrückt halten und den Cursor mit den Pfeiltasten bewegen.</li>
</ul>
<p>Das Menü <b>Markieren</b> hat dieselben Befehle sowie „Gewählte Namen kopieren“ und einen gleichen Befehl mit vollständigen Pfaden (praktisch, um eine Dateiliste in eine Nachricht einzufügen). <b>Verzeichnisse vergleichen</b> (<kbd>Shift+F2</kbd>) markiert in beiden Panels die Dateien, die im anderen Panel fehlen oder neuer bzw. unterschiedlich sind (zwei normale Ordner, keine Archive oder Server).</p>`,
    },
    {
      id: 'ops', t: 'Kopieren, Verschieben, Umbenennen, Löschen',
      h: `<ul>
<li><b>Kopieren / Verschieben</b> (<kbd>F5</kbd> / <kbd>F6</kbd>): Der Dialog zeigt das Ziel (der Ordner des anderen Panels); Sie können es ändern oder einen neuen Namen angeben. Existiert eine Datei schon, fragt das Programm, ob sie überschrieben werden soll oder vorhandene übersprungen werden. Ordner werden samt Inhalt kopiert.</li>
<li><b>Umbenennen</b>: <kbd>F2</kbd> oder <kbd>Shift+F6</kbd> fragt nach dem neuen Namen der Datei unter dem Cursor. <b>Mehrfach umbenennen</b> (<kbd>Ctrl+M</kbd>) benennt viele Dateien nach Masken für Name und Endung um (<code>[N]</code> Name, <code>[C]</code> Zähler, <code>[YMD]</code> Datum, Teile des alten Namens), mit Suchen und Ersetzen, Vorschau und gespeicherten Vorgaben.</li>
<li><b>Neuer Ordner</b>: <kbd>F7</kbd>. <b>Neue Datei bearbeiten</b>: <kbd>Shift+F4</kbd>.</li>
<li><b>Löschen</b>: <kbd>F8</kbd> oder <kbd>Delete</kbd> verschiebt die Dateien in den Papierkorb; <kbd>Shift+F8</kbd> oder <kbd>Shift+Delete</kbd> löscht sie endgültig. Auf Servern und in Archiven gibt es keinen Papierkorb: Die Dateien werden sofort entfernt. Bei Dropbox bleiben gelöschte Dateien 30 Tage erhalten; bei Google Drive landen sie in dessen Papierkorb.</li>
<li><b>Eigenschaften</b> (<kbd>Alt+Enter</kbd>), <b>Belegten Platz berechnen...</b> (<kbd>Ctrl+L</kbd>) und <b>Attribute ändern...</b> stehen im Menü Dateien.</li>
</ul>
<h3>Fortschritt, Hintergrund und Warteschlange</h3>
<p>Längere Aufgaben zeigen ein Fortschrittsfenster mit Dateiname, Geschwindigkeit und einer Schaltfläche <b>Abbrechen</b>. <b>Pause</b> hält die Aufgabe eine Weile an. <b>Im Hintergrund</b> schickt die Aufgabe in die Warteschlange und gibt Ihnen das Fenster zurück; im Kopierdialog heißt dasselbe <b>F2 Warteschlange</b> (die Aufgabe geht sofort in die Warteschlange, ohne Fortschrittsfenster); das Warteschlangenfenster listet die wartenden Aufgaben auf, sie laufen nacheinander, und Sie können sie umordnen oder abbrechen. Das Kopieren zwischen zwei entfernten Laufwerken (zum Beispiel von Dropbox auf ein NAS) läuft automatisch über einen temporären Ordner auf diesem Computer.</p>
<p class="help-tip">Um eine Datei von einem Server oder aus einem Archiv zu kopieren, öffnen Sie den Zielordner im anderen Panel und drücken <kbd>F5</kbd>. Um auf einen Server oder in ein Archiv zu kopieren, öffnen Sie es zuerst im anderen Panel.</p>`,
    },
    {
      id: 'archives', t: 'Archive',
      h: `<p>Archive öffnen sich wie Ordner: <kbd>Enter</kbd> auf einem Archiv zeigt seinen Inhalt, <kbd>Backspace</kbd> auf der obersten Ebene verlässt es. <kbd>F3</kbd> zeigt eine Datei darin an, <kbd>F5</kbd> kopiert Dateien heraus.</p>
<table>
<tr><th>Format</th><th>Durchsuchen und herauskopieren</th><th>Direkt ändern</th><th>Packen</th></tr>
<tr><td>zip</td><td>ja</td><td>ja (hinzufügen, löschen, umbenennen, neuer Ordner, Datei bearbeiten und speichern)</td><td>ja</td></tr>
<tr><td>7z, tar, tar.gz (tgz), tar.bz2, tar.xz, cab, gz, bz2, xz</td><td>ja</td><td>nein (nur lesen)</td><td>7z, tar, tar.gz, tar.bz2, tar.xz, gz, bz2, xz</td></tr>
<tr><td>rar</td><td>ja</td><td>nein</td><td>nein (nur entpacken)</td></tr>
</table>
<ul>
<li><kbd>Alt+F5</kbd> <b>packt</b> die markierten Dateien (Format und Name wählen; Fortschritt und Abbruch wie beim Kopieren). <kbd>Alt+F9</kbd> <b>entpackt</b> die markierten Archive oder nur die markierten Dateien eines geöffneten Archivs.</li>
<li><kbd>Alt+Shift+F9</kbd> <b>prüft</b> Archive (ob sie unbeschädigt sind). Menü Dateien: <b>Datei teilen...</b> und <b>Dateien zusammenfügen...</b> (mit der <code>.crc</code>-Datei von Total Commander).</li>
<li>Ein Archiv auf einem NAS- oder SSH-Server wird in eine temporäre Kopie geladen und schreibgeschützt geöffnet; Dateien lassen sich daraus kopieren. Das direkte Kopieren zwischen zwei Archiven wird noch nicht unterstützt: Nutzen Sie einen Ordner als Zwischenstation.</li>
</ul>`,
    },
    {
      id: 'search', t: 'Dateien suchen',
      h: `<p><b>Befehle > Suchen...</b> (<kbd>Alt+F7</kbd>) öffnet das Suchfenster.</p>
<ul>
<li><b>Namen:</b> mehrere Masken, getrennt durch <code>;</code>, und Ausschlüsse nach <code>|</code>, zum Beispiel <code>*.js;*.ts|node_modules/</code>, oder ein regulärer Ausdruck. Suche in einem oder mehreren Ordnern, nur in den markierten Elementen, mit Tiefenbegrenzung, sowie Namen in zip-Dateien.</li>
<li><b>Text in Dateien:</b> ganze Wörter, Groß-/Kleinschreibung, regulärer Ausdruck, Hexadezimal-Bytes, „enthält nicht“; es werden die Kodierungen ANSI, DOS, UTF-8 und UTF-16 versucht; auch Text in docx-, xlsx-, pptx- und OpenDocument-Dateien wird gefunden.</li>
<li><b>Filter:</b> Datum (zwischen, neuer oder älter als), Größe, Attribute. <b>Duplikate:</b> Dateien mit gleichem Namen, gleicher Größe oder gleichem Inhalt.</li>
<li>Ein Doppelklick auf ein Ergebnis springt zur Datei; <b>In Liste anzeigen</b> zeigt alle Ergebnisse als Liste in einem Panel, in dem F3, F5, F8 und die übrigen Befehle darauf wirken.</li>
</ul>
<h3>Dateiindex (Schnellsuche)</h3>
<p>Konfiguration > <b>Dateiindex (Schnellsuche)...</b> legt einen Index der Dateinamen der gewählten Ordner an (im Hintergrund; komprimiert im Datenordner des Programms gespeichert). Ist „Index verwenden“ angehakt, sind Suchen nach Name, Größe und Datum sofort fertig, wenn alle durchsuchten Ordner innerhalb indizierter Ordner liegen; sonst läuft die normale Suche auf dem Laufwerk. Die Textsuche in Dateien liest immer die Dateien.</p>`,
    },
    {
      id: 'viewer', t: 'Anzeige, Editor und Schnellansicht',
      h: `<h3>Anzeige (F3)</h3>
<p>Zeigt die Datei unter dem Cursor an, ohne ein anderes Programm zu öffnen: Text mit automatischer Erkennung der Kodierung (UTF-8, UTF-16, Windows-1251, CP866 ...; die Liste Kodierung oben ändert sie), Hex-Dump, Bilder, PDF, Video und Audio. <b>Dokumente</b> (docx, xlsx, pptx, OpenDocument sowie alte doc und rtf als reiner Text) zeichnet das Programm selbst mit Überschriften, Listen, Tabellen und Bildern, Word oder Office sind also nicht nötig. Video- und Audioformate, die die Engine nicht abspielen kann (HEVC, AVI, WMV, AC3, APE, WavPack, ALAC, AIFF ...), wandelt das mitgelieferte ffmpeg unterwegs um. In der Anzeige sucht <kbd>F7</kbd> Text, <kbd>N</kbd> und <kbd>P</kbd> zeigen die nächste und die vorherige Datei des Ordners, <kbd>Esc</kbd> schließt. Sie funktioniert auch für Dateien in Archiven und auf Servern (die Datei wird zuerst an einen temporären Ort geladen).</p>
<h3>Editor (F4)</h3>
<p>Ein einfacher Texteditor, der Kodierung, BOM und Zeilenenden der Datei beibehält, mit Suchen und Ersetzen. Er bearbeitet Dateien in zip-Archiven und auf NAS-, SSH-, FTP- und WebDAV-Servern und speichert sie zurück. <kbd>Shift+F4</kbd> legt eine neue Datei an. Schrift und Tabulator stellen Sie unter Konfiguration > <b>Editor...</b> ein.</p>
<h3>Schnellansicht (Ctrl+Q)</h3>
<p>Das andere Panel zeigt eine Vorschau der Datei unter dem Cursor und folgt dem Cursor. Noch einmal <kbd>Ctrl+Q</kbd> bringt die Dateiliste zurück.</p>
<p>Weitere Wege, eine Datei zu öffnen: <kbd>Enter</kbd> führt sie mit der Anwendung aus, die das System dafür kennt; Dateien > <b>Mit Standardanwendung öffnen</b> macht dasselbe für jede Datei.</p>`,
    },
    {
      id: 'media', t: 'Musik und Video',
      h: `<h3>Musikplayer</h3>
<p><kbd>Enter</kbd> auf einer Audiodatei startet den Player: Über den Funktionstasten-Schaltflächen erscheint eine Leiste, und die Musik spielt weiter, während Sie arbeiten. Die übrigen Audiodateien des Ordners bilden die Warteschlange. Die Leiste hat zurück / Pause-Wiedergabe / weiter, einen Positionsregler, Zufallswiedergabe, Wiederholen (aus / alle / eins), Lautstärke und eine Schaltfläche zum Schließen des Players.</p>
<ul>
<li>Tasten: <kbd>Ctrl+Space</kbd> (macOS: <kbd>Option+Space</kbd>) Pause / Wiedergabe, <kbd>Ctrl+Shift+Right</kbd> / <kbd>Ctrl+Shift+Left</kbd> nächster / vorheriger Titel. Auch die Medientasten der Tastatur funktionieren. Das Menü Befehle hat dieselben Einträge.</li>
<li>mp3, FLAC, WAV, OGG, Opus, AAC und M4A werden direkt abgespielt; APE, WavPack, ALAC, AIFF, WMA, DSD, AC3, DTS, MPC und andere dekodiert das mitgelieferte ffmpeg.</li>
<li>Musik aus einem NAS-, SSH-, FTP-, WebDAV-, Dropbox- oder Google-Drive-Panel wird gestreamt: Sie beginnt sofort, und Sie können an jede Stelle des Titels springen.</li>
</ul>
<h3>Chipmusik (ZX Spectrum, Atari ST, Amstrad)</h3>
<p>Derselbe Player spielt Module für den Soundchip AY-3-8910 / YM2149: <b>PT3, PT2, PT1, STC, ST1, ST3, STP, SQT, ASC, PSC, PSM, FTC, GTR, AY, AYC, PSG, TSD, VTX und YM</b>. Der Chip wird emuliert; vor dem ersten Ton bereitet das Programm den ganzen Titel vor (etwa eine Sekunde für einige Minuten Musik, „rendering...“ im Titel), danach funktioniert das Spulen wie bei jeder anderen Datei. Der Titel stammt aus dem Modul.</p>
<h3>Video</h3>
<p><kbd>F3</kbd> oder <kbd>Enter</kbd> auf einem Video öffnet es in der Anzeige mit Spulen, auch von Servern und Clouds.</p>`,
    },
    {
      id: 'nas', t: 'Synology NAS',
      h: `<p><b>Netz > Synology NAS...</b> (<kbd>Ctrl+F</kbd>) verbindet mit der File Station einer Synology DiskStation und zeigt sie als Laufwerk.</p>
<ol>
<li>Adresse: die lokale Adresse mit dem DSM-Port (zum Beispiel <code>nas.local:5001</code> oder <code>192.168.1.20:5000</code>) oder eine <b>QuickConnect</b>-Adresse (<code>https://id.region.quickconnect.to</code> oder nur die ID). QuickConnect braucht ein paar Sekunden, um den Weg zum NAS zu finden.</li>
<li>Benutzer und Passwort; der Code der <b>Bestätigung in zwei Schritten</b>, falls sie für das Konto eingeschaltet ist.</li>
<li>„Nicht vertrauenswürdiges Zertifikat zulassen“ ist für ein NAS mit selbstsigniertem Zertifikat. „Passwort merken“ speichert es vom Betriebssystem verschlüsselt.</li>
<li><b>Verbinden</b>. Die Verbindung wird in der Liste links im Fenster gespeichert; beim nächsten Mal genügt ein Doppelklick darauf.</li>
</ol>
<p>Im Panel können Sie durchsuchen, in beide Richtungen kopieren (mit Fortschritt), Ordner anlegen, umbenennen, löschen, anzeigen, bearbeiten und Video und Musik streamen. <b>Netz > Trennen (NAS / SSH)</b> beendet die Verbindung; die Laufwerksliste (<kbd>Alt+F1</kbd>) zeigt die geöffneten und lässt Sie dorthin zurückkehren.</p>`,
    },
    {
      id: 'ssh', t: 'SSH, SFTP und die Konsole',
      h: `<p><b>Netz > SSH-Server...</b> (<kbd>Ctrl+Shift+F</kbd>) verbindet mit Passwort oder Schlüsseldatei (OpenSSH, PEM; PuTTY-Schlüssel der Version 2 werden umgewandelt).</p>
<ul>
<li><b>Öffnen als:</b> „Laufwerk“ zeigt die Dateiliste des Servers (SFTP), „Konsole“ öffnet zuerst ein echtes Terminal. <kbd>Ctrl+O</kbd> wechselt jederzeit zwischen beiden; die Konsole behält ihren Verlauf.</li>
<li>In der <b>Konsole</b> gehören alle Tasten dem Server, außer <kbd>Ctrl+O</kbd>. Mit <kbd>F5</kbd> kopierte oder auf die Konsole gezogene Dateien werden in den Ordner hochgeladen, in dem die Konsole gerade ist.</li>
<li><b>Hostschlüssel:</b> Beim ersten Mal zeigt das Programm den Fingerabdruck des Servers und bittet um Vertrauen; er wird gemerkt, und ein geänderter Schlüssel wird als Warnung gemeldet (das kann ein Angriff oder ein neu installierter Server sein).</li>
<li><b>In PuTTY öffnen</b> (Menü Netz oder die Schaltfläche des Fensters) startet PuTTY mit derselben Verbindung, wenn PuTTY installiert ist.</li>
<li>Entfernte Dateien lassen sich anzeigen, bearbeiten, kopieren und aus dem Panel in eine andere Anwendung ziehen.</li>
</ul>
<h3>Aus WinSCP importieren</h3>
<p><b>Netz > Aus WinSCP importieren...</b> liest die Sitzungen von WinSCP (aus der Registry oder aus einer <code>WinSCP.ini</code>, die Sie wählen) und legt Verbindungen an: SFTP- / SCP-Sitzungen werden zu SSH-Verbindungen (ihre Schlüsseldateien werden in den eigenen geschützten Ordner des Programms kopiert), FTP- und WebDAV-Sitzungen werden zu FTP- und WebDAV-Verbindungen. Passwörter werden nicht importiert: Geben Sie sie bei der ersten Verbindung ein. S3-Sitzungen werden nicht unterstützt.</p>`,
    },
    {
      id: 'ftp', t: 'FTP, FTPS und WebDAV',
      h: `<h3>FTP und FTPS</h3>
<p><b>Netz > FTP- / FTPS-Server...</b></p>
<table>
<tr><td>Host</td><td>der Servername, wahlweise mit Port: <code>ftp.example.com</code> oder <code>ftp.example.com:2121</code></td></tr>
<tr><td>Sicherheit</td><td><b>FTP über TLS (explizit)</b> wird empfohlen: Port 21, die Verbindung wird auf TLS umgestellt. <b>Implizites TLS</b> ist Port 990. <b>Einfaches FTP</b> sendet das Passwort unverschlüsselt: nur in einem vertrauenswürdigen Netz verwenden.</td></tr>
<tr><td>Benutzer, Passwort</td><td>oder <b>Anonyme Anmeldung</b> drücken (Benutzer <code>anonymous</code>, ein Passwort in Form einer E-Mail-Adresse).</td></tr>
<tr><td>Remote-Ordner</td><td>optional: der Ordner, der zuerst geöffnet wird, zum Beispiel <code>/public_html</code></td></tr>
<tr><td>Lokaler Ordner</td><td>optional: Das andere Panel wechselt beim Verbinden in diesen Ordner.</td></tr>
<tr><td>Verbindung halten</td><td>optional: alle N Sekunden ein NOOP senden, damit ein Server mit kurzem Leerlauflimit die Verbindung nicht schließt. (Eine vom Server geschlossene Verbindung öffnet das Programm von selbst neu.)</td></tr>
<tr><td>Nach der Anmeldung</td><td>optionale FTP-Befehle, die nach der Anmeldung gesendet werden, getrennt durch <code>;</code></td></tr>
</table>
<p>„Nicht vertrauenswürdiges Zertifikat zulassen“ ist für einen Server mit selbstsigniertem TLS-Zertifikat. Das Programm verwendet den passiven Modus (der durch Router und Firewalls funktioniert).</p>
<h3>WebDAV</h3>
<p><b>Netz > WebDAV-Server...</b> erwartet die vollständige Adresse des WebDAV-Ordners: Nextcloud / ownCloud <code>https://cloud.example.com/remote.php/dav/files/NAME/</code>, Synology, Apache, nginx, IIS, Box und andere. Die Anmeldung kann Basic oder Digest sein; ein leerer Benutzer verbindet ohne Anmeldung. Eine Weiterleitung auf einen anderen Server nimmt Ihr Passwort nicht mit.</p>
<p>Beide Arten funktionieren wie die NAS- und SSH-Panels: Durchsuchen, Kopieren in beide Richtungen mit Fortschritt, Anlegen, Umbenennen, Löschen, Anzeigen, Bearbeiten sowie Streamen von Video und Musik mit Spulen. Hinweise: Ein Server, der keine Änderungsdaten liefert, zeigt leere Daten; Namen werden in UTF-8 erwartet; Dateisperren gibt es bei WebDAV nicht.</p>`,
    },
    {
      id: 'cloud', t: 'Dropbox und Google Drive',
      h: `<p><b>Netz > Dropbox...</b> und <b>Netz > Google Drive...</b> zeigen die Cloud als gewöhnliches Laufwerk. Ein Desktop-Client von Dropbox oder Google ist nicht nötig.</p>
<ol>
<li>Drücken Sie die Anmelde-Schaltfläche: Der Browser öffnet sich, melden Sie sich auf der Seite von Dropbox oder Google an und drücken Sie Zulassen. Das Passwort gelangt nie in dieses Programm.</li>
<li>Sobald der Browser meldet, dass Sie angemeldet sind, kehren Sie zum Programm zurück; die Dateien erscheinen im Panel.</li>
<li>„Auf diesem Computer angemeldet bleiben“ speichert ein Aktualisierungs-Token (vom Betriebssystem verschlüsselt), sodass beim nächsten Mal <b>Verbinden</b> genügt. „Anderes Konto verwenden“ meldet neu an.</li>
</ol>
<p>Sie können durchsuchen, in beide Richtungen kopieren, anlegen, umbenennen, löschen, anzeigen, bearbeiten und streamen. Eigene Google-Dokumente (Docs, Tabellen, Präsentationen) werden beim Kopieren exportiert. Dropbox bewahrt gelöschte Dateien 30 Tage auf; Google Drive verschiebt sie in seinen Papierkorb.</p>
<p class="help-warn">Dropbox und Google verlangen, dass sich jedes Programm mit einem eigenen App-Schlüssel ausweist. Normale Versionen enthalten ihn, und Sie melden sich einfach an. Verlangt das Fenster einen „App key“ oder eine „Client ID“, drücken Sie dort „Einstellungen und Hilfe...“: Es erklärt in wenigen Schritten, wie Sie einmalig einen kostenlosen Schlüssel in der Konsole des Dienstes erstellen (der Wert wird für alle Konten gemerkt).</p>`,
    },
    {
      id: 'sync', t: 'Einstellungen synchronisieren',
      h: `<p>Konfiguration > <b>Einstellungen synchronisieren (Dropbox, Google Drive, Ordner)...</b> hält Ihre Einstellungen auf allen Ihren Computern gleich. Sie liegen in einer zip-Datei, <code>/Commander/settings.zip</code>, in Ihrem Dropbox oder Google Drive oder in einem Ordner auf diesem Computer (einem USB-Stick oder einem Ordner, den ein anderes Programm synchronisiert).</p>
<ul>
<li>Was synchronisiert wird: Verbindungen, Favoriten, Vorgaben für Suche und Umbenennen, die Sprache und die Ansichtseinstellungen. Beim Zusammenführen zweier Computer gewinnt die neuere Änderung jeder Einstellung.</li>
<li><b>Einstellungen dort halten:</b> Synchronisierung beim Start des Programms und nach jeder Änderung. <b>Jetzt synchronisieren</b> führt einmal zusammen; <b>Einstellungen abrufen</b> und <b>Einstellungen speichern</b> erzwingen eine Richtung (die Einstellungen des anderen Computers übernehmen oder sie mit diesen überschreiben).</li>
<li><b>Passwörter, Logins und SSH-Schlüsseldateien in die zip-Datei legen:</b> Ohne das wandern nur die Namen und Adressen der Verbindungen. Mit dem Haken schützen Sie die zip-Datei mit einem Passwort (AES-256, auf jedem Computer dasselbe); ohne Passwort kann jeder, der diesen Ort öffnen kann, Ihre Passwörter lesen. Ein vergessenes Passwort lässt sich nicht wiederherstellen.</li>
</ul>
<p class="help-tip">Verwenden Sie für die zip-Datei ein ASCII-Passwort ohne Anführungszeichen und Rückwärtsschrägstriche: Es wird an 7-Zip übergeben.</p>`,
    },
    {
      id: 'tools', t: 'Werkzeuge der Menüs Dateien und Befehle',
      h: `<ul>
<li><b>Verzeichnisse vergleichen</b> (<kbd>Shift+F2</kbd>): markiert, was sich zwischen den beiden Panels unterscheidet. <b>Verzeichnisse synchronisieren...</b> (Menü Befehle) listet die Unterschiede zweier Ordner samt Unterordnern auf und kopiert fehlende oder neuere Dateien in der gewählten Richtung. Beide Werkzeuge brauchen zwei normale Ordner.</li>
<li><b>Nach Inhalt vergleichen...</b> (Menü Dateien): zwei Dateien nebeneinander, mit markierten Unterschieden.</li>
<li><b>Mehrfach umbenennen</b> (<kbd>Ctrl+M</kbd>), <b>Attribute ändern...</b> (schreibgeschützt, versteckt, System, Archiv, Datumsangaben, auch in Unterordnern), <b>Eigenschaften</b> (<kbd>Alt+Enter</kbd>), <b>Belegten Platz berechnen...</b> (<kbd>Ctrl+L</kbd>).</li>
<li><b>Kommentar bearbeiten...</b> (<kbd>Ctrl+Z</kbd>): eine Beschreibung der Datei, gespeichert in <code>descript.ion</code> wie bei Total Commander und im Panel angezeigt.</li>
<li><b>Prüfsummendateien erstellen...</b> und <b>Prüfsummen überprüfen...</b>: MD5, SHA-1, SHA-256 und andere; ein Fortschrittsfenster und eine Liste beschädigter oder fehlender Dateien.</li>
<li><b>Datei teilen...</b> / <b>Dateien zusammenfügen...</b>: eine große Datei in Teile gewählter Größe schneiden und wieder zusammensetzen (eine <code>.crc</code>-Datei hält Reihenfolge und Prüfsummen).</li>
<li><b>Datei kodieren / dekodieren (MIME, UUE)</b>: macht aus einer Binärdatei Text für E-Mail und zurück.</li>
<li><b>Autostart-Programme...</b> (Menü Befehle): zeigt, was zusammen mit dem Computer startet (Autostart-Programme), im Stil von Sysinternals Autoruns.</li>
</ul>`,
    },
    {
      id: 'extras', t: 'Weitere Funktionen',
      h: `<ul>
<li><b>ZX-Spectrum-Emulator:</b> <kbd>Enter</kbd> auf einer Datei <code>.trd .scl .tap .tzx .z80 .sna .szx .fdi .td0 .udi .csw .hob</code> startet sie im eingebauten Emulator (Unreal Speccy Portable); Dateien > <b>Im ZX-Spectrum-Emulator starten</b> macht dasselbe.</li>
<li><b>WSL als Laufwerk:</b> Die installierten Linux-Distributionen erscheinen in der Laufwerksliste als „WSL: Name“; jeder Pfad <code>\\\\wsl$\\Name\\...</code> ist ein gewöhnlicher Ordner.</li>
<li><b>Ziehen und Ablegen:</b> Ziehen Sie Dateien aus einem Panel in eine andere Anwendung (von entfernten Laufwerken werden sie zuvor geladen). Auf die SSH-Konsole gezogene Dateien werden in deren aktuellen Ordner hochgeladen.</li>
<li><b>Symbolleiste:</b> Die Schaltflächenreihe unter dem Menü lässt sich unter Konfiguration > Symbolleiste anzeigen ein- oder ausblenden.</li>
<li><b>Dialoge in eigenen Fenstern:</b> Wie bei Total Commander kann ein Dialog aus dem Hauptfenster herausgelöst werden. Das lässt sich unter Konfiguration > Konfiguration..., Abschnitt „Anzeige“ ausschalten.</li>
<li><b>Sprachen der Oberfläche:</b> Englisch, Russisch, Ukrainisch, Weißrussisch, Polnisch, Portugiesisch, Spanisch und Deutsch (Konfiguration > Sprache...). Menüs, Dialoge, Schaltflächen und diese Hilfe folgen der Sprache; Dateinamen werden nie übersetzt.</li>
</ul>`,
    },
    {
      id: 'keys', t: 'Tastenkürzel',
      h: '',
    },
    {
      id: 'config', t: 'Konfiguration und Updates',
      h: `<ul>
<li><b>Konfiguration...</b> enthält die Optionsgruppen (Anzeige, Vorgänge, Editor, Sprache, Werkzeuge). <b>Tastenkürzel...</b> lassen jedem Befehl andere Tasten zuweisen, <b>Editor...</b> stellt den Editor ein, <b>Sprache...</b> ändert die Sprache (das Fenster des Programms startet neu).</li>
<li><b>Nach Updates suchen...</b> (Menü Konfiguration): Das Programm sucht auch einige Sekunden nach dem Start nach einer neuen Version und bietet die Installation an. Unter Windows ersetzt das neue portable Programm die alte Datei, nachdem sein SHA-256 geprüft wurde; unter Linux tut das neue AppImage dasselbe; auf einem Mac läuft der Einzeiler-Installer im Programm. Eine Version lässt sich überspringen.</li>
<li><b>Dateiindex...</b> und <b>Einstellungen synchronisieren...</b> (Menü Konfiguration) sind in eigenen Kapiteln beschrieben.</li>
<li><b>Info</b> > <b>Info zu Alternate Commander...</b> zeigt Ihre Version und die Neuigkeiten der letzten Version. Dort gibt es einen Schalter <b>Entwicklermodus</b>: Er öffnet ein Fenster mit einem ausführlichen Protokoll von Synchronisierung, Updates und Archivarbeit, was beim Melden eines Problems hilft.</li>
</ul>
<p>Einstellungen, Favoriten und gespeicherte Verbindungen liegen im Datenordner des Programms (er heißt <code>Commander</code> und liegt im Anwendungsdatenordner Ihres Benutzers). Das portable Windows-Programm legt sie neben sich in <code>Commander-data</code> ab. Gespeicherte Passwörter werden verschlüsselt abgelegt, siehe „Passwörter, Datenschutz und Sicherheit“.</p>`,
    },
    {
      id: 'platforms', t: 'Windows, macOS und Linux',
      h: `<h3>Windows</h3>
<p>Windows 10 / 11, 64 Bit. Das portable Programm braucht keine Installation. Die Versionen sind noch nicht code-signiert, daher kann SmartScreen beim ersten Start warnen: Wählen Sie <b>Weitere Informationen</b> und <b>Trotzdem ausführen</b>. Installation mit Scoop: <code>scoop bucket add powervac https://github.com/powervac/scoop-bucket</code> und <code>scoop install alternate-commander</code>.</p>
<h3>macOS</h3>
<p>Apple Silicon und Intel. Am einfachsten: <code>curl -fsSL https://altcom.cc/install-mac.sh | bash</code> im Terminal (das umgeht auch die Meldung „beschädigt“ bei nicht signierten Apps) oder <code>brew install --cask powervac/tap/alternate-commander</code>. Sagt macOS, die App sei beschädigt: <code>xattr -cr /Applications/Commander.app</code>.</p>
<ul>
<li><b>Ctrl ist Cmd und Alt ist Option</b> in allen Kürzeln dieser Hilfe, außer <kbd>Ctrl+Q</kbd> (Schnellansicht) und den Tasten der SSH-Konsole, die Ctrl bleiben. <kbd>Cmd+A</kbd> markiert alle Dateien, <kbd>Cmd+W</kbd> schließt einen Tab, <kbd>Cmd+M</kbd> ist Mehrfach umbenennen, <kbd>Cmd+Q</kbd> beendet.</li>
<li>Die F-Tasten brauchen <kbd>Fn</kbd>, oder schalten Sie unter Systemeinstellungen > Tastatur „F1, F2 usw. als Standardfunktionstasten verwenden“ ein. Die Schaltflächen unten im Fenster und die Menüs tun dasselbe.</li>
<li>Beim ersten Lesen von Dokumenten, Downloads oder Schreibtisch fragt macOS um Erlaubnis. Netzfreigaben stehen in der Laufwerksliste unter <code>/Volumes</code>.</li>
</ul>
<h3>Linux</h3>
<p>x86_64. <code>curl -fsSL https://altcom.cc/install-linux.sh | bash</code> installiert das Programm in <code>~/Applications</code> und fügt es dem Anwendungsmenü hinzu; oder laden Sie das AppImage herunter und führen Sie <code>chmod +x</code> darauf aus. Hat das System keinen Schlüsselbund, schützt eine Schlüsseldatei des Programms die gespeicherten Passwörter.</p>`,
    },
    {
      id: 'security', t: 'Passwörter, Datenschutz und Sicherheit',
      h: `<ul>
<li><b>Gespeicherte Passwörter</b> sind optional („Passwort merken“) und werden vom Betriebssystem verschlüsselt abgelegt (Windows DPAPI, macOS-Schlüsselbund, Linux-Keyring). Sie gehen nur an den Server, mit dem Sie sich verbinden.</li>
<li><b>Die Cloud-Anmeldung</b> geschieht in Ihrem Browser; das Programm speichert nur ein Aktualisierungs-Token. Ihre Dateien gehen direkt zwischen diesem Computer und dem Dienst, nie über einen Server dieses Programms.</li>
<li><b>SSH</b> vertraut einem Hostschlüssel beim ersten Mal und warnt, wenn er sich ändert. <b>FTPS</b> und <b>HTTPS</b> prüfen das Zertifikat des Servers; „Nicht vertrauenswürdiges Zertifikat zulassen“ schaltet diese Prüfung für eine Verbindung aus, nutzen Sie es nur für einen Server, den Sie kennen.</li>
<li><b>Einfaches FTP</b> und WebDAV-Adressen mit <b>http://</b> senden das Passwort unverschlüsselt.</li>
<li>Das Streaming von Medien von Servern lauscht nur auf diesem Computer (127.0.0.1) und verlangt einen zufälligen Schlüssel, der bei jedem Start erzeugt wird.</li>
<li>Das Programm sucht Updates auf <code>altcom.cc</code> und lädt nur Dateien, deren SHA-256 übereinstimmt.</li>
<li>Einstellungen synchronisieren mit Passwörtern: Verwenden Sie das zip-Passwort (siehe „Einstellungen synchronisieren“).</li>
</ul>`,
    },
    {
      id: 'trouble', t: 'Fehlerbehebung und Fragen',
      h: `<h3>Ich kann mich nicht mit meinem NAS-, SSH-, FTP- oder WebDAV-Server verbinden</h3>
<p>Lesen Sie die Meldung im Verbindungsfenster, sie nennt die üblichen Ursachen. „Connection refused“ bedeutet falscher Port oder gestoppter Dienst, „did not answer in time“ eine Firewall oder falsche Adresse, „Login failed“ falscher Benutzer oder falsches Passwort. „The server certificate is not trusted“: Der Server verwendet ein selbstsigniertes Zertifikat; haken Sie „Nicht vertrauenswürdiges Zertifikat zulassen“ an, wenn Sie ihm vertrauen. Geben Sie QuickConnect ein paar Sekunden; klappt es weiter nicht, versuchen Sie die lokale Adresse mit Port.</p>
<h3>Eine FTP-Verbindung zeigt die Liste, scheitert aber bei Dateien</h3>
<p>Das Programm verwendet den passiven Modus; eine Firewall, die die Ports passiver Datenverbindungen blockiert, stoppt die Übertragung. Probieren Sie einmal „Einfaches FTP“, um zu sehen, ob TLS die Ursache ist, oder bitten Sie den Administrator, den Bereich der passiven Ports zu öffnen.</p>
<h3>Ein Video oder Lied wird nicht abgespielt</h3>
<p>Formate, die die Engine nicht kennt, wandelt das mitgelieferte ffmpeg um; ist die Datei beschädigt oder nutzt sie einen sehr seltenen Codec, meldet das die Anzeige. Geben Sie einem großen Video auf einem langsamen Computer einen Moment zum Starten.</p>
<h3>Die Tasten funktionieren unter macOS nicht</h3>
<p>Siehe „Windows, macOS und Linux“: Die F-Tasten brauchen Fn, und Ctrl bedeutet in dieser Hilfe Cmd.</p>
<h3>Die Sprache des Programms ist falsch</h3>
<p>Konfiguration > Sprache... Ist die Synchronisierung der Einstellungen eingeschaltet, kann die Sprache eines anderen Computers übernommen worden sein: Ändern Sie sie noch einmal.</p>
<h3>Ein Dialogfenster ist verschwunden oder auf dem falschen Bildschirm</h3>
<p>Dialoge sind eigene Fenster; schließen Sie den Dialog mit Esc und öffnen Sie ihn neu, oder schalten Sie die Einstellung unter Konfiguration > Konfiguration..., Abschnitt „Anzeige“ aus.</p>
<h3>Ein Problem melden oder eine Funktion wünschen</h3>
<p>Nutzen Sie das Formular auf <a href="#" data-u="https://altcom.cc/#requests">altcom.cc</a> oder eröffnen Sie ein Issue auf <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander/issues">GitHub</a>. Schalten Sie in Info den <b>Entwicklermodus</b> ein, wiederholen Sie das Problem und fügen Sie die Zeilen des Protokollfensters Ihrer Meldung bei.</p>`,
    },
    {
      id: 'about', t: 'Über das Programm',
      h: `<p><b>Alternate Commander</b> ist ein kostenloser Open-Source-Dateimanager mit zwei Panels für Windows, macOS und Linux im Stil von Total Commander. Es ist ein unabhängiges Projekt ohne Verbindung zu Total Commander oder Ghisler Software.</p>
<ul>
<li>Website: <a href="#" data-u="https://altcom.cc">altcom.cc</a>; Neuigkeiten jeder Version: <a href="#" data-u="https://altcom.cc/changelog.html">Änderungsliste</a>.</li>
<li>Quellcode und Issues: <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander">github.com/powervac/Alternate-Total-Commander</a> (MIT-Lizenz).</li>
<li>Gebaut mit Electron. Komponenten von Dritten: der ZX-Spectrum-Emulator Unreal Speccy Portable (GPL-3.0), ffmpeg und 7-Zip für Konvertierung und Archive, xterm.js für die SSH-Konsole, ssh2 und basic-ftp für die Verbindungen sowie die Schrift Inter. Die vollständige Liste steht in der README des Projekts.</li>
</ul>
<p>Ihre Version und die Update-Suche finden Sie unter <b>Info > Info zu Alternate Commander...</b>.</p>`,
    },
  ],
};
