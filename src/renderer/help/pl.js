'use strict';
// Pomoc, język polski. Format opisano w help.js; identyfikatory rozdziałów są takie same jak w en.js.
HELP_TEXT.pl = {
  ui: {
    title: 'Pomoc',
    search: 'Szukaj w pomocy',
    close: 'Zamknij',
    none: 'Nic nie znaleziono.',
    found: 'Trafień: {n}, rozdziałów: {s}',
    hint: 'F1 otwiera tę pomoc w każdej chwili.',
    keysIntro: 'Wszystkie polecenia programu i ich klawisze w tej chwili. Na Macu zamiast Ctrl używa się Cmd, zamiast Alt — Option. Dowolny klawisz można zmienić w Konfiguracja > Skróty klawiszowe...; ta lista uwzględnia Twoje zmiany.',
    keysFoot: 'Ponadto: Enter otwiera folder, archiwum lub plik pod kursorem, Backspace przechodzi poziom wyżej, Tab przełącza panel, strzałki, Home, End, PageUp i PageDown przesuwają kursor, Esc zamyka okna dialogowe i menu. Wpisywany tekst trafia do wiersza poleceń na dole.',
  },
  sections: [
    {
      id: 'start', t: 'Pierwsze kroki',
      h: `<p>Alternate Commander to menedżer plików z <b>dwoma panelami</b> w stylu Total Commandera. Jeden panel jest aktywny (jego ścieżka jest podświetlona), drugi jest celem kopiowania i przenoszenia. Wszystko można zrobić z klawiatury, a każda czynność ma też pozycję w menu lub przycisk.</p>
<ul>
<li><kbd>Tab</kbd> przełącza aktywny panel. Strzałki przesuwają kursor, <kbd>Enter</kbd> otwiera folder, archiwum lub plik, <kbd>Backspace</kbd> przechodzi o poziom wyżej.</li>
<li><kbd>F5</kbd> kopiuje zaznaczone pliki do drugiego panelu, <kbd>F6</kbd> je przenosi, <kbd>F7</kbd> tworzy folder, <kbd>F8</kbd> usuwa, <kbd>F3</kbd> wyświetla, <kbd>F4</kbd> edytuje. Te same przyciski są na dole okna.</li>
<li>Przycisk w lewym górnym rogu panelu otwiera <b>listę dysków</b> (<kbd>Alt+F1</kbd> dla lewego, <kbd>Alt+F2</kbd> dla prawego panelu): dyski, foldery standardowe, dyski sieciowe, ulubione oraz Twoje połączenia z serwerami i chmurami.</li>
<li><b>Menu</b> otwiera się myszą albo klawiszami <kbd>F9</kbd> / <kbd>F10</kbd>. Ostatnia pozycja, <b>O programie</b>, zawiera tę pomoc oraz okno z wersją i aktualizacjami.</li>
</ul>
<p class="help-tip">Pierwszy raz w programie? Przeczytaj rozdziały „Panele, karty i nawigacja”, „Zaznaczanie plików” oraz „Kopiowanie, przenoszenie, zmiana nazw, usuwanie”. Pozostałe rozdziały opisują kolejne możliwości po kolei; słowa szukaj w polu wyszukiwania.</p>
<p>Pod panelami jest <b>wiersz poleceń</b>: wpisz polecenie i naciśnij Enter, aby uruchomić je w folderze aktywnego panelu; polecenie <code>cd folder</code> zmienia natomiast folder aktywnego panelu. <kbd>Ctrl+Enter</kbd> wstawia do wiersza poleceń nazwę pliku pod kursorem, <kbd>Ctrl+Shift+Enter</kbd> — jego pełną ścieżkę.</p>`,
    },
    {
      id: 'panels', t: 'Panele, karty i nawigacja',
      h: `<h3>Foldery i lista dysków</h3>
<p>Ścieżka panelu jest widoczna nad jego listą; wiersz pod listą pokazuje liczbę i rozmiar zaznaczonych i wszystkich plików. <kbd>Alt+F1</kbd> / <kbd>Alt+F2</kbd> otwierają listę dysków lewego / prawego panelu. Zawiera ona: dyski lokalne, podłączone dyski sieciowe (ze ścieżką sieciową), foldery standardowe (Użytkownik, Pulpit, Dokumenty, Pobrane ...), w Windows zainstalowane dystrybucje <b>WSL</b>, a niżej Twoje otwarte i zapisane połączenia (NAS, SSH, FTP, WebDAV, Dropbox, Google Drive). W macOS wymienione są woluminy z <code>/Volumes</code> (także udziały sieciowe).</p>
<h3>Historia i powrót</h3>
<p><kbd>Alt+Left</kbd> i <kbd>Alt+Right</kbd> przechodzą wstecz i do przodu w historii panelu. <kbd>Ctrl+U</kbd> zamienia panele miejscami; w menu „Polecenia” jest też „Cel=Źródło”, które pokazuje ten sam folder w drugim panelu.</p>
<h3>Karty</h3>
<p>Każdy panel ma własne karty: <kbd>Ctrl+T</kbd> otwiera nową (kopię bieżącego folderu), <kbd>Ctrl+W</kbd> ją zamyka, <kbd>Ctrl+Tab</kbd> / <kbd>Ctrl+Shift+Tab</kbd> przełączają między nimi, a <kbd>Ctrl+Up</kbd> otwiera folder (lub archiwum) pod kursorem w nowej karcie. Karty są zapamiętywane po zamknięciu programu.</p>
<h3>Sortowanie i widoki</h3>
<p>Kliknij nagłówek kolumny albo naciśnij <kbd>Ctrl+F3</kbd> (nazwa), <kbd>Ctrl+F4</kbd> (rozszerzenie), <kbd>Ctrl+F5</kbd> (data), <kbd>Ctrl+F6</kbd> (rozmiar). Ponowne naciśnięcie odwraca kolejność. <kbd>Ctrl+Shift+F4</kbd> przełącza panel na <b>miniatury</b> (obrazy, klatki wideo, PDF i dokumenty); <kbd>Ctrl+Q</kbd> zamienia drugi panel w <b>szybki podgląd</b> pliku pod kursorem. <kbd>Ctrl+R</kbd> ponownie wczytuje folder.</p>
<h3>Ulubione katalogi</h3>
<p><kbd>Ctrl+D</kbd> otwiera ulubione foldery. Bieżący folder można dodać do listy, także bieżący folder dysku w chmurze, serwera NAS, SSH, FTP lub WebDAV: wybór takiej pozycji w razie potrzeby ponownie łączy i od razu przechodzi na miejsce. Ulubione z Total Commandera są jednorazowo importowane z <code>wincmd.ini</code>, jeśli program go znajdzie.</p>`,
    },
    {
      id: 'select', t: 'Zaznaczanie plików',
      h: `<p>Większość poleceń działa na <b>zaznaczonych</b> plikach albo, gdy nic nie jest zaznaczone, na pliku pod kursorem. Zaznaczone nazwy mają inny kolor.</p>
<ul>
<li><kbd>Insert</kbd> zaznacza plik i schodzi w dół; <kbd>Space</kbd> zaznacza i zostaje na miejscu (na folderze dodatkowo oblicza łączny rozmiar jego zawartości, widoczny w kolumnie Rozmiar).</li>
<li><kbd>Num +</kbd> zaznacza grupę według maski (<code>*.jpg</code>, <code>report*.*</code>), <kbd>Num -</kbd> odznacza grupę, <kbd>Num *</kbd> odwraca zaznaczenie, <kbd>Ctrl+A</kbd> zaznacza wszystko, <kbd>Ctrl+Num -</kbd> odznacza wszystko.</li>
<li><kbd>Alt+Num +</kbd> zaznacza wszystkie pliki z tym samym rozszerzeniem co plik pod kursorem.</li>
<li>Myszą: <kbd>Ctrl</kbd>+kliknięcie dodaje lub usuwa jeden plik. Z klawiatury: przytrzymaj <kbd>Shift</kbd>, przesuwając kursor strzałkami.</li>
</ul>
<p>Menu <b>Zaznacz</b> zawiera te same polecenia oraz „Kopiuj zaznaczone nazwy do schowka” i takie samo polecenie z pełnymi ścieżkami (wygodne do wklejenia listy plików do wiadomości). <b>Porównaj katalogi</b> (<kbd>Shift+F2</kbd>) zaznacza w obu panelach pliki, których brakuje w drugim panelu albo które są nowsze lub różne (dwa zwykłe foldery, nie archiwa ani serwery).</p>`,
    },
    {
      id: 'ops', t: 'Kopiowanie, przenoszenie, zmiana nazw, usuwanie',
      h: `<ul>
<li><b>Kopiowanie / przenoszenie</b> (<kbd>F5</kbd> / <kbd>F6</kbd>): okno pokazuje cel (folder drugiego panelu); można go zmienić albo podać nową nazwę. Jeśli plik już istnieje, program pyta, czy go zastąpić, czy pominąć istniejące. Foldery są kopiowane razem z zawartością.</li>
<li><b>Zmiana nazwy</b>: <kbd>F2</kbd> lub <kbd>Shift+F6</kbd> pyta o nową nazwę pliku pod kursorem. <b>Zmiana nazw wielu plików</b> (<kbd>Ctrl+M</kbd>) zmienia nazwy wielu plików według masek nazwy i rozszerzenia (<code>[N]</code> nazwa, <code>[C]</code> licznik, <code>[YMD]</code> data, fragmenty starej nazwy), z wyszukiwaniem i zamianą, podglądem i zapisywanymi szablonami.</li>
<li><b>Nowy folder</b>: <kbd>F7</kbd>. <b>Nowy plik w edytorze</b>: <kbd>Shift+F4</kbd>.</li>
<li><b>Usuwanie</b>: <kbd>F8</kbd> lub <kbd>Delete</kbd> przenosi pliki do Kosza; <kbd>Shift+F8</kbd> lub <kbd>Shift+Delete</kbd> usuwa je na stałe. Na serwerach i w archiwach nie ma Kosza: pliki są usuwane od razu. W Dropboksie usunięte pliki są przechowywane 30 dni, w Google Drive trafiają do jego Kosza.</li>
<li><b>Właściwości</b> (<kbd>Alt+Enter</kbd>), <b>Oblicz zajęte miejsce...</b> (<kbd>Ctrl+L</kbd>) i <b>Zmień atrybuty...</b> są w menu „Pliki”.</li>
</ul>
<h3>Postęp, tło i kolejka</h3>
<p>Długie zadania pokazują okno postępu z nazwą pliku, prędkością i przyciskiem <b>Anuluj</b>. Przycisk <b>Pauza</b> wstrzymuje zadanie na jakiś czas. Przycisk <b>W tle</b> wysyła zadanie do kolejki i oddaje Ci okno; w oknie kopiowania to samo robi przycisk <b>F2 Kolejka</b> (zadanie trafia od razu do kolejki, bez okna postępu); okno kolejki wymienia oczekujące zadania, są wykonywane jedno po drugim, można je przestawiać i anulować. Kopiowanie między dwoma dyskami zdalnymi (na przykład z Dropboksa na NAS) odbywa się automatycznie przez tymczasowy folder na tym komputerze.</p>
<p class="help-tip">Aby skopiować plik z serwera lub archiwum, otwórz folder docelowy w drugim panelu i naciśnij <kbd>F5</kbd>. Aby skopiować na serwer lub do archiwum, najpierw otwórz go w drugim panelu.</p>`,
    },
    {
      id: 'archives', t: 'Archiwa',
      h: `<p>Archiwa otwierają się jak foldery: <kbd>Enter</kbd> na archiwum pokazuje jego zawartość, <kbd>Backspace</kbd> na najwyższym poziomie z niego wychodzi. <kbd>F3</kbd> wyświetla plik w środku, <kbd>F5</kbd> kopiuje pliki na zewnątrz.</p>
<table>
<tr><th>Format</th><th>Przeglądanie i kopiowanie na zewnątrz</th><th>Zmiany w miejscu</th><th>Pakowanie</th></tr>
<tr><td>zip</td><td>tak</td><td>tak (dodawanie, usuwanie, zmiana nazwy, nowy folder, edycja i zapis pliku)</td><td>tak</td></tr>
<tr><td>7z, tar, tar.gz (tgz), tar.bz2, tar.xz, cab, gz, bz2, xz</td><td>tak</td><td>nie (tylko odczyt)</td><td>7z, tar, tar.gz, tar.bz2, tar.xz, gz, bz2, xz</td></tr>
<tr><td>rar</td><td>tak</td><td>nie</td><td>nie (tylko rozpakowywanie)</td></tr>
</table>
<ul>
<li><kbd>Alt+F5</kbd> <b>pakuje</b> zaznaczone pliki (wybierz format i nazwę; postęp i anulowanie jak przy kopiowaniu). <kbd>Alt+F9</kbd> <b>rozpakowuje</b> zaznaczone archiwa albo tylko zaznaczone pliki otwartego archiwum.</li>
<li><kbd>Alt+Shift+F9</kbd> <b>testuje</b> archiwa (sprawdza, czy nie są uszkodzone). Menu „Pliki”: <b>Podziel plik...</b> i <b>Połącz pliki...</b> (z plikiem <code>.crc</code> jak w Total Commanderze).</li>
<li>Archiwum na serwerze NAS lub SSH jest pobierane do tymczasowej kopii i otwierane tylko do odczytu; pliki można z niego kopiować. Kopiowanie bezpośrednio między dwoma archiwami nie jest jeszcze obsługiwane: użyj folderu pośredniego.</li>
</ul>`,
    },
    {
      id: 'search', t: 'Wyszukiwanie plików',
      h: `<p><b>Polecenia > Szukaj...</b> (<kbd>Alt+F7</kbd>) otwiera okno wyszukiwania.</p>
<ul>
<li><b>Nazwy:</b> kilka masek rozdzielonych <code>;</code> i wykluczenia po <code>|</code>, na przykład <code>*.js;*.ts|node_modules/</code>, lub wyrażenie regularne. Szukanie w jednym lub kilku folderach, tylko wśród zaznaczonych elementów, z ograniczeniem głębokości oraz nazw wewnątrz plików zip.</li>
<li><b>Tekst wewnątrz plików:</b> całe słowa, wielkość liter, wyrażenie regularne, bajty szesnastkowe, „nie zawiera”; sprawdzane są kodowania ANSI, DOS, UTF-8 i UTF-16; tekst wewnątrz plików docx, xlsx, pptx i OpenDocument także jest znajdowany.</li>
<li><b>Filtry:</b> data (między, nowsze lub starsze niż), rozmiar, atrybuty. <b>Duplikaty:</b> pliki o tej samej nazwie, tym samym rozmiarze lub tej samej zawartości.</li>
<li>Dwukrotne kliknięcie wyniku przechodzi do pliku; <b>Do panelu (lista)</b> pokazuje wszystkie wyniki jako listę w panelu, gdzie F3, F5, F8 i inne polecenia działają na nich.</li>
</ul>
<h3>Indeks plików (szybkie szukanie)</h3>
<p>Konfiguracja > <b>Indeks plików (szybkie szukanie)...</b> buduje indeks nazw plików w wybranych folderach (w tle; zapisywany w postaci skompresowanej w folderze danych programu). Gdy zaznaczone jest „Użyj indeksu”, szukanie według nazwy, rozmiaru i daty jest natychmiastowe, jeśli wszystkie przeszukiwane foldery leżą wewnątrz zaindeksowanych; w przeciwnym razie działa zwykłe przeszukiwanie dysku. Szukanie tekstu wewnątrz plików zawsze czyta pliki.</p>`,
    },
    {
      id: 'viewer', t: 'Podgląd, edytor i szybki podgląd',
      h: `<h3>Podgląd (F3)</h3>
<p>Pokazuje plik pod kursorem bez uruchamiania innego programu: tekst z automatycznym wykrywaniem kodowania (UTF-8, UTF-16, Windows-1251, CP866 ...; lista Kodowanie u góry zmienia je), zrzut szesnastkowy, obrazy, PDF, wideo i dźwięk. <b>Dokumenty</b> (docx, xlsx, pptx, OpenDocument oraz stare doc i rtf jako zwykły tekst) program rysuje sam, z nagłówkami, listami, tabelami i obrazami, więc Word ani Office nie są potrzebne. Formaty wideo i dźwięku, których silnik nie odtwarza (HEVC, AVI, WMV, AC3, APE, WavPack, ALAC, AIFF ...), są konwertowane w locie przez wbudowany ffmpeg. W podglądzie <kbd>F7</kbd> szuka tekstu, <kbd>N</kbd> i <kbd>P</kbd> pokazują następny i poprzedni plik folderu, <kbd>Esc</kbd> zamyka okno. Podgląd działa także dla plików wewnątrz archiwów i na serwerach (plik jest najpierw pobierany w tymczasowe miejsce).</p>
<h3>Edytor (F4)</h3>
<p>Prosty edytor tekstu, który zachowuje kodowanie, BOM i zakończenia wierszy pliku, z wyszukiwaniem i zamianą. Edytuje pliki wewnątrz archiwów zip oraz na serwerach NAS, SSH, FTP i WebDAV i zapisuje je z powrotem. <kbd>Shift+F4</kbd> tworzy nowy plik. Czcionkę i tabulację ustawia się w Konfiguracja > <b>Edytor...</b>.</p>
<h3>Szybki podgląd (Ctrl+Q)</h3>
<p>Drugi panel pokazuje podgląd pliku pod kursorem i podąża za kursorem. Ponowne <kbd>Ctrl+Q</kbd> przywraca listę plików.</p>
<p>Inne sposoby otwarcia pliku: <kbd>Enter</kbd> uruchamia go w programie przypisanym w systemie; Pliki > <b>Otwórz w domyślnej aplikacji</b> robi to samo dla dowolnego pliku.</p>`,
    },
    {
      id: 'media', t: 'Muzyka i wideo',
      h: `<h3>Odtwarzacz muzyki</h3>
<p><kbd>Enter</kbd> na pliku dźwiękowym uruchamia odtwarzacz: nad przyciskami klawiszy funkcyjnych pojawia się pasek, a muzyka gra dalej, gdy pracujesz. Pozostałe pliki dźwiękowe folderu tworzą kolejkę. Pasek ma: poprzedni / pauza-odtwarzanie / następny, suwak przewijania, losową kolejność, powtarzanie (wył. / wszystkie / jeden), głośność i przycisk zamykający odtwarzacz.</p>
<ul>
<li>Skróty: <kbd>Ctrl+Space</kbd> (macOS: <kbd>Option+Space</kbd>) pauza / odtwarzanie, <kbd>Ctrl+Shift+Right</kbd> / <kbd>Ctrl+Shift+Left</kbd> następny / poprzedni utwór. Działają też klawisze multimedialne klawiatury. Te same pozycje są w menu „Polecenia”.</li>
<li>mp3, FLAC, WAV, OGG, Opus, AAC i M4A odtwarzane są bezpośrednio; APE, WavPack, ALAC, AIFF, WMA, DSD, AC3, DTS, MPC i inne dekoduje wbudowany ffmpeg.</li>
<li>Muzyka z paneli NAS, SSH, FTP, WebDAV, Dropbox i Google Drive jest odtwarzana strumieniowo: zaczyna się od razu i można przeskoczyć w dowolne miejsce utworu.</li>
</ul>
<h3>Muzyka układów (ZX Spectrum, Atari ST, Amstrad)</h3>
<p>Ten sam odtwarzacz gra moduły dla układu dźwiękowego AY-3-8910 / YM2149: <b>PT3, PT2, PT1, STC, ST1, ST3, STP, SQT, ASC, PSC, PSM, FTC, GTR, AY, AYC, PSG, TSD, VTX i YM</b>. Układ jest emulowany; przed pierwszym dźwiękiem program przygotowuje cały utwór (około sekundy na kilka minut muzyki, w tytule „rendering...”), po czym przewijanie działa jak dla każdego innego pliku. Tytuł pochodzi z modułu.</p>
<h3>Wideo</h3>
<p><kbd>F3</kbd> lub <kbd>Enter</kbd> na wideo otwiera je w podglądzie z przewijaniem, także z serwerów i chmur.</p>`,
    },
    {
      id: 'nas', t: 'Synology NAS',
      h: `<p><b>Sieć > Synology NAS...</b> (<kbd>Ctrl+F</kbd>) łączy z File Station serwera Synology DiskStation i pokazuje go jako dysk.</p>
<ol>
<li>Adres: adres lokalny z portem DSM (na przykład <code>nas.local:5001</code> lub <code>192.168.1.20:5000</code>) albo adres <b>QuickConnect</b> (<code>https://id.region.quickconnect.to</code> lub sam identyfikator). QuickConnect potrzebuje kilku sekund, aby znaleźć drogę do NAS.</li>
<li>Użytkownik i hasło; kod <b>weryfikacji dwuetapowej</b>, jeśli jest włączona dla konta.</li>
<li>„Zezwól na niezaufany certyfikat” jest dla NAS z certyfikatem samopodpisanym. „Zapamiętaj hasło” zapisuje je zaszyfrowane przez system operacyjny.</li>
<li><b>Połącz</b>. Połączenie zapisuje się na liście po lewej stronie okna; następnym razem wystarczy dwukrotnie je kliknąć.</li>
</ol>
<p>W panelu można przeglądać, kopiować w obie strony (z postępem), tworzyć foldery, zmieniać nazwy, usuwać, wyświetlać, edytować oraz odtwarzać strumieniowo wideo i muzykę. <b>Sieć > Rozłącz (NAS / SSH)</b> zamyka połączenie; lista dysków (<kbd>Alt+F1</kbd>) pokazuje otwarte połączenia i pozwala do nich wrócić.</p>`,
    },
    {
      id: 'ssh', t: 'SSH, SFTP i konsola',
      h: `<p><b>Sieć > Serwer SSH...</b> (<kbd>Ctrl+Shift+F</kbd>) łączy za pomocą hasła lub pliku klucza (OpenSSH, PEM; klucze PuTTY w wersji 2 są konwertowane).</p>
<ul>
<li><b>Otwórz jako:</b> „Dysk” pokazuje listę plików serwera (SFTP), „Konsola” najpierw otwiera prawdziwy terminal. <kbd>Ctrl+O</kbd> w każdej chwili przełącza między nimi; konsola zachowuje swoją historię.</li>
<li>W <b>konsoli</b> wszystkie klawisze należą do serwera, poza <kbd>Ctrl+O</kbd>. Pliki skopiowane klawiszem <kbd>F5</kbd> lub upuszczone na konsolę są wysyłane do folderu, w którym konsola jest teraz.</li>
<li><b>Klucz hosta:</b> przy pierwszym połączeniu program pokazuje odcisk serwera i prosi o zaufanie; jest zapamiętywany, a zmiana klucza jest zgłaszana jako ostrzeżenie (może to oznaczać atak albo ponownie zainstalowany serwer).</li>
<li><b>Otwórz w PuTTY</b> (menu „Sieć” lub przycisk okna) uruchamia PuTTY z tym samym połączeniem, jeśli PuTTY jest zainstalowany.</li>
<li>Pliki zdalne można wyświetlać, edytować, kopiować i przeciągać z panelu do innej aplikacji.</li>
</ul>
<h3>Import z WinSCP</h3>
<p><b>Sieć > Importuj z WinSCP...</b> czyta sesje WinSCP (z rejestru albo z pliku <code>WinSCP.ini</code>, który wskażesz) i tworzy połączenia: sesje SFTP / SCP stają się połączeniami SSH (ich pliki kluczy są kopiowane do własnego chronionego folderu programu), sesje FTP i WebDAV stają się połączeniami FTP i WebDAV. Hasła nie są importowane: wpisz je przy pierwszym połączeniu. Sesje S3 nie są obsługiwane.</p>`,
    },
    {
      id: 'ftp', t: 'FTP, FTPS i WebDAV',
      h: `<h3>FTP i FTPS</h3>
<p><b>Sieć > Serwer FTP / FTPS...</b></p>
<table>
<tr><td>Host</td><td>nazwa serwera, opcjonalnie z portem: <code>ftp.example.com</code> lub <code>ftp.example.com:2121</code></td></tr>
<tr><td>Zabezpieczenia</td><td><b>FTP przez TLS (jawny)</b> jest zalecany: port 21, połączenie jest przełączane na TLS. <b>Niejawny TLS</b> to port 990. <b>Zwykły FTP</b> wysyła hasło bez szyfrowania: używaj go tylko w zaufanej sieci.</td></tr>
<tr><td>Użytkownik, Hasło</td><td>albo naciśnij <b>Logowanie anonimowe</b> (użytkownik <code>anonymous</code>, hasło w postaci adresu e-mail).</td></tr>
<tr><td>Folder zdalny</td><td>opcjonalnie: folder otwierany jako pierwszy, na przykład <code>/public_html</code></td></tr>
<tr><td>Folder lokalny</td><td>opcjonalnie: drugi panel po połączeniu przechodzi do tego folderu.</td></tr>
<tr><td>Podtrzymanie połączenia</td><td>opcjonalnie: wysyłaj NOOP co N sekund, aby serwer z krótkim limitem bezczynności nie zamykał połączenia. (Połączenie zamknięte przez serwer program otwiera ponownie sam.)</td></tr>
<tr><td>Po zalogowaniu</td><td>opcjonalne polecenia FTP wysyłane po zalogowaniu, rozdzielone <code>;</code></td></tr>
</table>
<p>„Zezwól na niezaufany certyfikat” jest dla serwera z samopodpisanym certyfikatem TLS. Program używa trybu pasywnego (takiego, który działa przez routery i zapory).</p>
<h3>WebDAV</h3>
<p><b>Sieć > Serwer WebDAV...</b> przyjmuje pełny adres folderu WebDAV: Nextcloud / ownCloud <code>https://cloud.example.com/remote.php/dav/files/NAZWA/</code>, Synology, Apache, nginx, IIS, Box i inne. Logowanie może być Basic lub Digest; pusty użytkownik oznacza połączenie bez logowania. Przekierowanie na inny serwer nie zabiera ze sobą Twojego hasła.</p>
<p>Oba rodzaje działają jak panele NAS i SSH: przeglądanie, kopiowanie w obie strony z postępem, tworzenie, zmiana nazw, usuwanie, wyświetlanie, edycja oraz odtwarzanie strumieniowe wideo i muzyki z przewijaniem. Uwagi: serwer, który nie podaje dat modyfikacji, pokazuje puste daty; nazwy są oczekiwane w UTF-8; blokad plików WebDAV nie ma.</p>`,
    },
    {
      id: 'cloud', t: 'Dropbox i Google Drive',
      h: `<p><b>Sieć > Dropbox...</b> i <b>Sieć > Google Drive...</b> pokazują chmurę jako zwykły dysk. Klient Dropbox ani Google na komputerze nie jest potrzebny.</p>
<ol>
<li>Naciśnij przycisk logowania: otworzy się przeglądarka, zaloguj się na stronie Dropbox lub Google i naciśnij „Zezwól”. Hasło nigdy nie trafia do tego programu.</li>
<li>Gdy przeglądarka pokaże, że logowanie się udało, wróć do programu; pliki pojawią się w panelu.</li>
<li>„Pozostań zalogowany na tym komputerze” zapisuje token odświeżania (zaszyfrowany przez system operacyjny), dzięki czemu następnym razem wystarczy <b>Połącz</b>. „Użyj innego konta” loguje od nowa.</li>
</ol>
<p>Można przeglądać, kopiować w obie strony, tworzyć, zmieniać nazwy, usuwać, wyświetlać, edytować i odtwarzać strumieniowo. Własne dokumenty Google (Dokumenty, Arkusze, Prezentacje) są przy kopiowaniu eksportowane. Dropbox przechowuje usunięte pliki 30 dni; Google Drive przenosi je do swojego Kosza.</p>
<p class="help-warn">Dropbox i Google wymagają, aby każdy program przedstawiał się własnym kluczem aplikacji. Zwykłe wersje go zawierają i wystarczy się zalogować. Jeśli okno prosi o „App key” lub „Client ID”, naciśnij tam „Ustawienia i pomoc...”: w kilku krokach wyjaśnia, jak raz utworzyć bezpłatny klucz w konsoli usługi (wpisana wartość jest zapamiętywana dla wszystkich kont).</p>`,
    },
    {
      id: 'sync', t: 'Synchronizacja ustawień',
      h: `<p>Konfiguracja > <b>Synchronizacja ustawień (Dropbox, Google Drive, folder)...</b> sprawia, że ustawienia są takie same na wszystkich Twoich komputerach. Są przechowywane w jednym pliku zip, <code>/Commander/settings.zip</code>, w Twoim Dropboksie lub Google Drive albo w folderze na tym komputerze (pendrive lub folder synchronizowany przez inny program).</p>
<ul>
<li>Co jest synchronizowane: połączenia, ulubione, szablony wyszukiwania i zmiany nazw, język i ustawienia widoku. Przy scalaniu dwóch komputerów wygrywa nowsza zmiana każdego ustawienia.</li>
<li><b>Przechowuj tam ustawienia:</b> synchronizacja przy uruchomieniu programu i po każdej zmianie. <b>Synchronizuj teraz</b> scala jednorazowo; <b>Pobierz ustawienia</b> i <b>Zapisz ustawienia</b> wymuszają jeden kierunek (przyjęcie ustawień drugiego komputera albo nadpisanie ich tymi).</li>
<li><b>Dodaj do zip hasła, loginy i pliki kluczy SSH:</b> bez tego podróżują tylko nazwy i adresy połączeń. Z tym zabezpiecz zip hasłem (AES-256, takim samym na każdym komputerze); bez hasła każdy, kto może otworzyć to miejsce, przeczyta Twoje hasła. Zapomnianego hasła nie da się odzyskać.</li>
</ul>
<p class="help-tip">Do zip użyj hasła złożonego ze znaków ASCII, bez cudzysłowów i ukośników wstecznych: jest ono przekazywane do 7-Zip.</p>`,
    },
    {
      id: 'tools', t: 'Narzędzia menu „Pliki” i „Polecenia”',
      h: `<ul>
<li><b>Porównaj katalogi</b> (<kbd>Shift+F2</kbd>): zaznacza różnice między dwoma panelami. <b>Synchronizuj katalogi...</b> (menu „Polecenia”) wymienia różnice dwóch folderów wraz z podfolderami i kopiuje brakujące lub nowsze pliki w wybranym kierunku. Oba narzędzia wymagają dwóch zwykłych folderów.</li>
<li><b>Porównaj zawartość...</b> (menu „Pliki”): dwa pliki obok siebie z zaznaczonymi różnicami.</li>
<li><b>Zmiana nazw wielu plików</b> (<kbd>Ctrl+M</kbd>), <b>Zmień atrybuty...</b> (tylko do odczytu, ukryty, systemowy, archiwalny, daty, także w podfolderach), <b>Właściwości</b> (<kbd>Alt+Enter</kbd>), <b>Oblicz zajęte miejsce...</b> (<kbd>Ctrl+L</kbd>).</li>
<li><b>Edytuj komentarz...</b> (<kbd>Ctrl+Z</kbd>): opis pliku zapisywany w <code>descript.ion</code> jak w Total Commanderze i pokazywany w panelu.</li>
<li><b>Utwórz pliki sum kontrolnych...</b> i <b>Sprawdź sumy kontrolne...</b>: MD5, SHA-1, SHA-256 i inne; okno postępu oraz lista uszkodzonych lub brakujących plików.</li>
<li><b>Podziel plik...</b> / <b>Połącz pliki...</b>: pocięcie dużego pliku na części wybranego rozmiaru i złożenie z powrotem (plik <code>.crc</code> przechowuje kolejność i sumy kontrolne).</li>
<li><b>Koduj / dekoduj plik (MIME, UUE)</b>: zamienia plik binarny na tekst do poczty e-mail i z powrotem.</li>
<li><b>Programy autostartu...</b> (menu „Polecenia”): pokazuje, co uruchamia się razem z komputerem (programy autostartu), w stylu Sysinternals Autoruns.</li>
</ul>`,
    },
    {
      id: 'extras', t: 'Dodatkowe możliwości',
      h: `<ul>
<li><b>Emulator ZX Spectrum:</b> <kbd>Enter</kbd> na pliku <code>.trd .scl .tap .tzx .z80 .sna .szx .fdi .td0 .udi .csw .hob</code> uruchamia go we wbudowanym emulatorze (Unreal Speccy Portable); Pliki > <b>Uruchom w emulatorze ZX Spectrum</b> robi to samo.</li>
<li><b>WSL jako dysk:</b> zainstalowane dystrybucje Linuksa pojawiają się na liście dysków jako „WSL: nazwa”; każda ścieżka <code>\\\\wsl$\\nazwa\\...</code> to zwykły folder.</li>
<li><b>Przeciąganie:</b> przeciągaj pliki z panelu do innej aplikacji (z dysków zdalnych są najpierw pobierane). Pliki upuszczone na konsolę SSH są wysyłane do jej bieżącego folderu.</li>
<li><b>Pasek narzędzi:</b> rząd przycisków pod menu można pokazać lub ukryć w Konfiguracja > Pokaż pasek narzędzi.</li>
<li><b>Okna dialogowe w osobnych oknach:</b> jak w Total Commanderze okno dialogowe można wynieść poza główne okno. Można to wyłączyć w Konfiguracja > Konfiguracja..., dział „Wyświetlanie”.</li>
<li><b>Języki interfejsu:</b> angielski, rosyjski, ukraiński, białoruski, polski, portugalski, hiszpański i niemiecki (Konfiguracja > Język...). Menu, okna dialogowe, przyciski i ta pomoc podążają za językiem; nazwy plików nigdy nie są tłumaczone.</li>
</ul>`,
    },
    {
      id: 'keys', t: 'Skróty klawiszowe',
      h: '',
    },
    {
      id: 'config', t: 'Konfiguracja i aktualizacje',
      h: `<ul>
<li><b>Konfiguracja...</b> zawiera grupy opcji (wyświetlanie, operacje, edytor, język, narzędzia). <b>Skróty klawiszowe...</b> pozwalają przypisać każdemu poleceniu inne klawisze, <b>Edytor...</b> ustawia edytor, <b>Język...</b> zmienia język (okno programu uruchamia się ponownie).</li>
<li><b>Sprawdź aktualizacje...</b> (menu „Konfiguracja”): program szuka też nowej wersji kilka sekund po uruchomieniu i proponuje jej instalację. W Windows nowy program przenośny zastępuje stary plik po sprawdzeniu SHA-256; w Linuksie robi tak nowy AppImage; na Macu wewnątrz programu uruchamia się jednowierszowy instalator. Wersję można pominąć.</li>
<li><b>Indeks plików...</b> i <b>Synchronizacja ustawień...</b> (menu „Konfiguracja”) opisano w osobnych rozdziałach.</li>
<li><b>O programie</b> > <b>O programie Alternate Commander...</b> pokazuje Twoją wersję i nowości ostatniego wydania. Jest tam przełącznik <b>Tryb programisty</b>: otwiera okno ze szczegółowym dziennikiem synchronizacji, aktualizacji i pracy z archiwami, co pomaga przy zgłaszaniu problemu.</li>
</ul>
<p>Ustawienia, ulubione i zapisane połączenia są przechowywane w folderze danych programu (nazywa się <code>Commander</code> i leży w folderze danych aplikacji Twojego użytkownika). Przenośny program dla Windows trzyma je obok siebie w <code>Commander-data</code>. Zapisane hasła są przechowywane w postaci zaszyfrowanej, zob. „Hasła, prywatność i bezpieczeństwo”.</p>`,
    },
    {
      id: 'platforms', t: 'Windows, macOS i Linux',
      h: `<h3>Windows</h3>
<p>Windows 10 / 11, 64-bitowy. Program przenośny nie wymaga instalacji. Wersje nie są jeszcze podpisane cyfrowo, więc SmartScreen może ostrzec przy pierwszym uruchomieniu: wybierz <b>Więcej informacji</b> i <b>Uruchom mimo to</b>. Instalacja przez Scoop: <code>scoop bucket add powervac https://github.com/powervac/scoop-bucket</code> i <code>scoop install alternate-commander</code>.</p>
<h3>macOS</h3>
<p>Apple Silicon i Intel. Najprościej: <code>curl -fsSL https://altcom.cc/install-mac.sh | bash</code> w Terminalu (omija też komunikat „uszkodzona” dla niepodpisanych aplikacji) albo <code>brew install --cask powervac/tap/alternate-commander</code>. Jeśli macOS pisze, że aplikacja jest uszkodzona: <code>xattr -cr /Applications/Commander.app</code>.</p>
<ul>
<li><b>Ctrl to Cmd, a Alt to Option</b> we wszystkich skrótach tej pomocy, z wyjątkiem <kbd>Ctrl+Q</kbd> (szybki podgląd) i klawiszy konsoli SSH, które pozostają Ctrl. <kbd>Cmd+A</kbd> zaznacza wszystkie pliki, <kbd>Cmd+W</kbd> zamyka kartę, <kbd>Cmd+M</kbd> to zmiana nazw wielu plików, <kbd>Cmd+Q</kbd> kończy program.</li>
<li>Klawisze F wymagają <kbd>Fn</kbd> albo włącz „Używaj klawiszy F1, F2 itd. jako standardowych klawiszy funkcyjnych” w Ustawieniach systemowych > Klawiatura. Przyciski na dole okna i menu robią to samo.</li>
<li>Przy pierwszym odczycie Dokumentów, Pobranych lub Biurka macOS prosi o zgodę. Udziały sieciowe są na liście dysków w <code>/Volumes</code>.</li>
</ul>
<h3>Linux</h3>
<p>x86_64. <code>curl -fsSL https://altcom.cc/install-linux.sh | bash</code> instaluje program w <code>~/Applications</code> i dodaje go do menu aplikacji; albo pobierz AppImage i nadaj mu <code>chmod +x</code>. Jeśli system nie ma pęku kluczy, zapisane hasła chroni plik klucza programu.</p>`,
    },
    {
      id: 'security', t: 'Hasła, prywatność i bezpieczeństwo',
      h: `<ul>
<li><b>Zapisane hasła</b> są opcjonalne („Zapamiętaj hasło”) i przechowywane zaszyfrowane przez system operacyjny (Windows DPAPI, Pęk kluczy macOS, keyring Linuksa). Są wysyłane tylko do serwera, z którym się łączysz.</li>
<li><b>Logowanie do chmury</b> odbywa się w Twojej przeglądarce; program przechowuje tylko token odświeżania. Pliki idą bezpośrednio między tym komputerem a usługą i nigdy nie przechodzą przez serwer tego programu.</li>
<li><b>SSH</b> ufa kluczowi hosta przy pierwszym połączeniu i ostrzega o jego zmianie. <b>FTPS</b> i <b>HTTPS</b> sprawdzają certyfikat serwera; „Zezwól na niezaufany certyfikat” wyłącza tę kontrolę dla jednego połączenia, używaj tylko dla znanego serwera.</li>
<li>Adresy <b>zwykłego FTP</b> i WebDAV przez <b>http://</b> wysyłają hasło bez szyfrowania.</li>
<li>Strumieniowanie multimediów z serwerów nasłuchuje tylko na tym komputerze (127.0.0.1) i wymaga losowego klucza tworzonego przy każdym uruchomieniu.</li>
<li>Program sprawdza aktualizacje na <code>altcom.cc</code> i pobiera tylko pliki o zgodnej sumie SHA-256.</li>
<li>Synchronizacja ustawień z hasłami: użyj hasła zip (zob. „Synchronizacja ustawień”).</li>
</ul>`,
    },
    {
      id: 'trouble', t: 'Rozwiązywanie problemów i pytania',
      h: `<h3>Nie mogę połączyć się z serwerem NAS, SSH, FTP lub WebDAV</h3>
<p>Przeczytaj komunikat w oknie połączenia, w którym są wymienione zwykłe przyczyny. „Connection refused” oznacza zły port lub zatrzymaną usługę, „did not answer in time” zaporę lub zły adres, „Login failed” zły login lub hasło. „The server certificate is not trusted”: serwer używa certyfikatu samopodpisanego; jeśli mu ufasz, zaznacz „Zezwól na niezaufany certyfikat”. W przypadku QuickConnect daj mu kilka sekund; jeśli nadal się nie udaje, spróbuj adresu lokalnego z portem.</p>
<h3>Połączenie FTP pokazuje listę, ale pliki się nie przesyłają</h3>
<p>Program używa trybu pasywnego; zapora blokująca porty pasywnych połączeń danych zatrzymuje transfer. Spróbuj raz „Zwykły FTP”, aby sprawdzić, czy winny jest TLS, albo poproś administratora o otwarcie zakresu portów pasywnych.</p>
<h3>Film lub piosenka się nie odtwarza</h3>
<p>Formaty nieznane silnikowi konwertuje wbudowany ffmpeg; jeśli plik jest uszkodzony lub używa bardzo rzadkiego kodeka, podgląd o tym poinformuje. Na wolnym komputerze daj dużemu filmowi chwilę na start.</p>
<h3>Klawisze nie działają w macOS</h3>
<p>Zob. „Windows, macOS i Linux”: klawisze F wymagają Fn, a Ctrl w tej pomocy oznacza Cmd.</p>
<h3>Język programu jest nieprawidłowy</h3>
<p>Konfiguracja > Język... Jeśli synchronizacja ustawień jest włączona, język innego komputera mógł zostać przejęty: zmień go jeszcze raz.</p>
<h3>Okno dialogowe zniknęło lub jest na złym ekranie</h3>
<p>Okna dialogowe są osobnymi oknami; zamknij okno klawiszem Esc i otwórz ponownie albo wyłącz to ustawienie w Konfiguracja > Konfiguracja..., dział „Wyświetlanie”.</p>
<h3>Zgłaszanie problemu lub prośba o funkcję</h3>
<p>Użyj formularza na <a href="#" data-u="https://altcom.cc/#requests">altcom.cc</a> albo otwórz zgłoszenie na <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander/issues">GitHubie</a>. Włącz <b>Tryb programisty</b> w oknie „O programie”, powtórz problem i dołącz wiersze dziennika do zgłoszenia.</p>`,
    },
    {
      id: 'about', t: 'O programie',
      h: `<p><b>Alternate Commander</b> to bezpłatny menedżer plików z otwartym kodem i dwoma panelami dla Windows, macOS i Linuksa, w stylu Total Commandera. To niezależny projekt, niezwiązany z Total Commanderem ani Ghisler Software.</p>
<ul>
<li>Strona: <a href="#" data-u="https://altcom.cc">altcom.cc</a>; nowości każdej wersji: <a href="#" data-u="https://altcom.cc/changelog.html">lista zmian</a>.</li>
<li>Kod źródłowy i zgłoszenia: <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander">github.com/powervac/Alternate-Total-Commander</a> (licencja MIT).</li>
<li>Zbudowany na Electronie. Składniki zewnętrzne: emulator ZX Spectrum Unreal Speccy Portable (GPL-3.0), ffmpeg i 7-Zip do konwersji i archiwów, xterm.js dla konsoli SSH, ssh2 i basic-ftp dla połączeń oraz czcionka Inter. Pełna lista jest w README projektu.</li>
</ul>
<p>Twoją wersję i sprawdzanie aktualizacji znajdziesz w <b>O programie > O programie Alternate Commander...</b>.</p>`,
    },
  ],
};
