'use strict';
// Interface languages. The program text is English in the code; the visible strings are translated here by an exact match
// (menus, dialogs, buttons, labels, tooltips). File names and other data are never translated. Columns of R:
//   en | ru | uk | be | pl | pt | es | de
// Messages with numbers or file names (some errors, progress texts) stay in English.
const LANGS = [['en', 'English'], ['ru', 'Русский'], ['pl', 'Polski'], ['pt', 'Português'], ['es', 'Español'], ['de', 'Deutsch'], ['be', 'Беларуская'], ['uk', 'Українська']];
const I18N_COLS = ['ru', 'uk', 'be', 'pl', 'pt', 'es', 'de'];
const I18N_ROWS = [
  // ---- top menu
  ['Files', 'Файлы', 'Файли', 'Файлы', 'Pliki', 'Arquivos', 'Archivos', 'Dateien'],
  ['Mark', 'Выделение', 'Виділення', 'Вылучэнне', 'Zaznacz', 'Marcar', 'Marcar', 'Markieren'],
  ['Commands', 'Команды', 'Команди', 'Каманды', 'Polecenia', 'Comandos', 'Comandos', 'Befehle'],
  ['Net', 'Сеть', 'Мережа', 'Сетка', 'Sieć', 'Rede', 'Red', 'Netz'],
  ['Show', 'Вид', 'Вигляд', 'Выгляд', 'Widok', 'Exibir', 'Ver', 'Ansicht'],
  ['Configuration', 'Настройки', 'Налаштування', 'Налады', 'Konfiguracja', 'Configuração', 'Configuración', 'Konfiguration'],
  ['Start', 'Старт', 'Старт', 'Старт', 'Start', 'Iniciar', 'Inicio', 'Start'],
  // ---- Files menu
  ['View', 'Просмотр', 'Перегляд', 'Прагляд', 'Podgląd', 'Visualizar', 'Ver', 'Anzeigen'],
  ['Edit', 'Правка', 'Редагування', 'Праўка', 'Edytuj', 'Editar', 'Editar', 'Bearbeiten'],
  ['Edit New File...', 'Создать и править файл...', 'Створити і редагувати файл...', 'Стварыць і правіць файл...', 'Edytuj nowy plik...', 'Editar novo arquivo...', 'Editar archivo nuevo...', 'Neue Datei bearbeiten...'],
  ['Open With Default Application', 'Открыть программой по умолчанию', 'Відкрити програмою за замовчуванням', 'Адкрыць праграмай па змаўчанні', 'Otwórz w domyślnej aplikacji', 'Abrir com o aplicativo padrão', 'Abrir con la aplicación predeterminada', 'Mit Standardanwendung öffnen'],
  ['Run in ZX Spectrum Emulator', 'Запустить в эмуляторе ZX Spectrum', 'Запустити в емуляторі ZX Spectrum', 'Запусціць у эмулятары ZX Spectrum', 'Uruchom w emulatorze ZX Spectrum', 'Executar no emulador ZX Spectrum', 'Ejecutar en el emulador ZX Spectrum', 'Im ZX-Spectrum-Emulator starten'],
  ['Change Attributes...', 'Изменить атрибуты...', 'Змінити атрибути...', 'Змяніць атрыбуты...', 'Zmień atrybuty...', 'Alterar atributos...', 'Cambiar atributos...', 'Attribute ändern...'],
  ['Pack...', 'Упаковать...', 'Запакувати...', 'Запакаваць...', 'Pakuj...', 'Compactar...', 'Comprimir...', 'Packen...'],
  ['Unpack Specific Files...', 'Распаковать файлы...', 'Розпакувати файли...', 'Распакаваць файлы...', 'Rozpakuj pliki...', 'Descompactar arquivos...', 'Descomprimir archivos...', 'Dateien entpacken...'],
  ['Test Archive(s)', 'Проверить архив(ы)', 'Перевірити архів(и)', 'Праверыць архіў(ы)', 'Testuj archiwa', 'Testar arquivo(s)', 'Probar archivo(s)', 'Archiv(e) prüfen'],
  ['Compare By Content...', 'Сравнить по содержимому...', 'Порівняти за вмістом...', 'Параўнаць па змесціве...', 'Porównaj zawartość...', 'Comparar por conteúdo...', 'Comparar por contenido...', 'Nach Inhalt vergleichen...'],
  ['Properties...', 'Свойства...', 'Властивості...', 'Уласцівасці...', 'Właściwości...', 'Propriedades...', 'Propiedades...', 'Eigenschaften...'],
  ['Calculate Occupied Space...', 'Подсчитать занятое место...', 'Підрахувати зайняте місце...', 'Падлічыць занятае месца...', 'Oblicz zajęte miejsce...', 'Calcular espaço ocupado...', 'Calcular espacio ocupado...', 'Belegten Platz berechnen...'],
  ['Multi-Rename Tool...', 'Групповое переименование...', 'Групове перейменування...', 'Групавое перайменаванне...', 'Zmiana nazw wielu plików...', 'Renomear em massa...', 'Renombrar varios...', 'Mehrfach umbenennen...'],
  ['Rename (Shift+F6)', 'Переименовать (Shift+F6)', 'Перейменувати (Shift+F6)', 'Перайменаваць (Shift+F6)', 'Zmień nazwę (Shift+F6)', 'Renomear (Shift+F6)', 'Renombrar (Shift+F6)', 'Umbenennen (Shift+F6)'],
  ['Edit Comment...', 'Правка комментария...', 'Редагувати коментар...', 'Правіць каментарый...', 'Edytuj komentarz...', 'Editar comentário...', 'Editar comentario...', 'Kommentar bearbeiten...'],
  ['Split File...', 'Разбить файл...', 'Розбити файл...', 'Разбіць файл...', 'Podziel plik...', 'Dividir arquivo...', 'Dividir archivo...', 'Datei teilen...'],
  ['Combine Files...', 'Склеить файлы...', 'Склеїти файли...', 'Склеіць файлы...', 'Połącz pliki...', 'Combinar arquivos...', 'Combinar archivos...', 'Dateien zusammenfügen...'],
  ['Encode File (MIME, UUE)...', 'Кодировать файл (MIME, UUE)...', 'Кодувати файл (MIME, UUE)...', 'Кадзіраваць файл (MIME, UUE)...', 'Koduj plik (MIME, UUE)...', 'Codificar arquivo (MIME, UUE)...', 'Codificar archivo (MIME, UUE)...', 'Datei kodieren (MIME, UUE)...'],
  ['Decode File (MIME, UUE)...', 'Декодировать файл (MIME, UUE)...', 'Декодувати файл (MIME, UUE)...', 'Дэкадзіраваць файл (MIME, UUE)...', 'Dekoduj plik (MIME, UUE)...', 'Decodificar arquivo (MIME, UUE)...', 'Decodificar archivo (MIME, UUE)...', 'Datei dekodieren (MIME, UUE)...'],
  ['Create Checksum File(s)...', 'Создать файлы контрольных сумм...', 'Створити файли контрольних сум...', 'Стварыць файлы кантрольных сум...', 'Utwórz pliki sum kontrolnych...', 'Criar arquivos de checksum...', 'Crear archivos de suma de verificación...', 'Prüfsummendateien erstellen...'],
  ['Verify Checksums...', 'Проверить контрольные суммы...', 'Перевірити контрольні суми...', 'Праверыць кантрольныя сумы...', 'Sprawdź sumy kontrolne...', 'Verificar checksums...', 'Verificar sumas de verificación...', 'Prüfsummen überprüfen...'],
  ['Quit', 'Выход', 'Вихід', 'Выхад', 'Zakończ', 'Sair', 'Salir', 'Beenden'],
  // ---- Mark menu
  ['Select Group...', 'Выделить группу...', 'Виділити групу...', 'Вылучыць групу...', 'Zaznacz grupę...', 'Selecionar grupo...', 'Seleccionar grupo...', 'Gruppe auswählen...'],
  ['Unselect Group...', 'Снять выделение с группы...', 'Зняти виділення з групи...', 'Зняць вылучэнне з групы...', 'Odznacz grupę...', 'Desmarcar grupo...', 'Deseleccionar grupo...', 'Gruppe abwählen...'],
  ['Select All', 'Выделить все', 'Виділити все', 'Вылучыць усё', 'Zaznacz wszystko', 'Selecionar tudo', 'Seleccionar todo', 'Alles auswählen'],
  ['Unselect All', 'Снять все выделение', 'Зняти все виділення', 'Зняць усё вылучэнне', 'Odznacz wszystko', 'Desmarcar tudo', 'Deseleccionar todo', 'Alles abwählen'],
  ['Invert Selection', 'Инвертировать выделение', 'Інвертувати виділення', 'Інвертаваць вылучэнне', 'Odwróć zaznaczenie', 'Inverter seleção', 'Invertir selección', 'Auswahl umkehren'],
  ['Select All With Same Extension', 'Выделить все с тем же расширением', 'Виділити всі з тим самим розширенням', 'Вылучыць усе з тым жа пашырэннем', 'Zaznacz wszystkie z tym samym rozszerzeniem', 'Selecionar todos com a mesma extensão', 'Seleccionar todos con la misma extensión', 'Alle mit gleicher Endung auswählen'],
  ['Compare Directories', 'Сравнить каталоги', 'Порівняти каталоги', 'Параўнаць каталогі', 'Porównaj katalogi', 'Comparar diretórios', 'Comparar directorios', 'Verzeichnisse vergleichen'],
  ['Copy Selected Names To Clipboard', 'Копировать имена выделенных в буфер', 'Копіювати імена виділених у буфер', 'Капіраваць імёны вылучаных у буфер', 'Kopiuj zaznaczone nazwy do schowka', 'Copiar nomes selecionados', 'Copiar nombres seleccionados', 'Gewählte Namen kopieren'],
  ['Copy Names With Path To Clipboard', 'Копировать имена с путями в буфер', 'Копіювати імена з шляхами в буфер', 'Капіраваць імёны з шляхамі ў буфер', 'Kopiuj nazwy ze ścieżkami do schowka', 'Copiar nomes com caminho', 'Copiar nombres con ruta', 'Namen mit Pfad kopieren'],
  // ---- Commands / Net / Show / Config
  ['Synchronize Dirs...', 'Синхронизировать каталоги...', 'Синхронізувати каталоги...', 'Сінхранізаваць каталогі...', 'Synchronizuj katalogi...', 'Sincronizar diretórios...', 'Sincronizar directorios...', 'Verzeichnisse synchronisieren...'],
  ['Directory Hotlist', 'Избранные папки', 'Обрані теки', 'Абраныя папкі', 'Ulubione katalogi', 'Diretórios favoritos', 'Directorios favoritos', 'Verzeichnis-Favoriten'],
  ['Music Player: Play / Pause', 'Плеер: воспроизведение / пауза', 'Плеєр: відтворення / пауза', 'Плэер: прайграванне / паўза', 'Odtwarzacz: odtwarzaj / pauza', 'Player: reproduzir / pausar', 'Reproductor: reproducir / pausa', 'Player: Wiedergabe / Pause'],
  ['Music Player: Next Track', 'Плеер: следующий трек', 'Плеєр: наступний трек', 'Плэер: наступны трэк', 'Odtwarzacz: następny utwór', 'Player: próxima faixa', 'Reproductor: pista siguiente', 'Player: nächster Titel'],
  ['Music Player: Previous Track', 'Плеер: предыдущий трек', 'Плеєр: попередній трек', 'Плэер: папярэдні трэк', 'Odtwarzacz: poprzedni utwór', 'Player: faixa anterior', 'Reproductor: pista anterior', 'Player: vorheriger Titel'],
  ['Music Player: Stop', 'Плеер: стоп', 'Плеєр: стоп', 'Плэер: стоп', 'Odtwarzacz: stop', 'Player: parar', 'Reproductor: detener', 'Player: Stopp'],
  ['Go Back', 'Назад', 'Назад', 'Назад', 'Wstecz', 'Voltar', 'Atrás', 'Zurück'],
  ['Go Forward', 'Вперёд', 'Вперед', 'Наперад', 'Dalej', 'Avançar', 'Adelante', 'Vorwärts'],
  ['Source<->Target', 'Источник<->Приёмник', 'Джерело<->Приймач', 'Крыніца<->Прыёмнік', 'Źródło<->Cel', 'Origem<->Destino', 'Origen<->Destino', 'Quelle<->Ziel'],
  ['Target=Source', 'Приёмник=Источник', 'Приймач=Джерело', 'Прыёмнік=Крыніца', 'Cel=Źródło', 'Destino=Origem', 'Destino=Origen', 'Ziel=Quelle'],
  ['Synology NAS...', 'Synology NAS...', 'Synology NAS...', 'Synology NAS...', 'Synology NAS...', 'Synology NAS...', 'Synology NAS...', 'Synology NAS...'],
  ['SSH server...', 'SSH-сервер...', 'SSH-сервер...', 'SSH-сервер...', 'Serwer SSH...', 'Servidor SSH...', 'Servidor SSH...', 'SSH-Server...'],
  ['SSH: Console / File List', 'SSH: консоль / список файлов', 'SSH: консоль / список файлів', 'SSH: кансоль / спіс файлаў', 'SSH: konsola / lista plików', 'SSH: console / lista de arquivos', 'SSH: consola / lista de archivos', 'SSH: Konsole / Dateiliste'],
  ['Disconnect (NAS / SSH)', 'Отключиться (NAS / SSH)', 'Від’єднатися (NAS / SSH)', 'Адключыцца (NAS / SSH)', 'Rozłącz (NAS / SSH)', 'Desconectar (NAS / SSH)', 'Desconectar (NAS / SSH)', 'Trennen (NAS / SSH)'],
  ['Left drive list', 'Список дисков слева', 'Список дисків ліворуч', 'Спіс дыскаў злева', 'Lista dysków po lewej', 'Lista de unidades à esquerda', 'Lista de unidades izquierda', 'Laufwerksliste links'],
  ['Right drive list', 'Список дисков справа', 'Список дисків праворуч', 'Спіс дыскаў справа', 'Lista dysków po prawej', 'Lista de unidades à direita', 'Lista de unidades derecha', 'Laufwerksliste rechts'],
  ['FTP Connect...', 'FTP-соединение...', 'FTP-з’єднання...', 'FTP-злучэнне...', 'Połączenie FTP...', 'Conexão FTP...', 'Conexión FTP...', 'FTP-Verbindung...'],
  ['Quick View Panel', 'Панель быстрого просмотра', 'Панель швидкого перегляду', 'Панэль хуткага прагляду', 'Panel szybkiego podglądu', 'Painel de visualização rápida', 'Panel de vista rápida', 'Schnellansicht-Panel'],
  ['Thumbnails', 'Миниатюры', 'Мініатюри', 'Мініяцюры', 'Miniatury', 'Miniaturas', 'Miniaturas', 'Vorschaubilder'],
  ['New Folder Tab', 'Новая вкладка', 'Нова вкладка', 'Новая ўкладка', 'Nowa karta', 'Nova aba', 'Nueva pestaña', 'Neuer Tab'],
  ['Close Tab', 'Закрыть вкладку', 'Закрити вкладку', 'Закрыць укладку', 'Zamknij kartę', 'Fechar aba', 'Cerrar pestaña', 'Tab schließen'],
  ['Next Tab', 'Следующая вкладка', 'Наступна вкладка', 'Наступная ўкладка', 'Następna karta', 'Próxima aba', 'Pestaña siguiente', 'Nächster Tab'],
  ['Previous Tab', 'Предыдущая вкладка', 'Попередня вкладка', 'Папярэдняя ўкладка', 'Poprzednia karta', 'Aba anterior', 'Pestaña anterior', 'Vorheriger Tab'],
  ['Name', 'Имя', 'Ім’я', 'Імя', 'Nazwa', 'Nome', 'Nombre', 'Name'],
  ['Extension', 'Расширение', 'Розширення', 'Пашырэнне', 'Rozszerzenie', 'Extensão', 'Extensión', 'Erweiterung'],
  ['Time', 'Время', 'Час', 'Час', 'Czas', 'Hora', 'Hora', 'Zeit'],
  ['Size', 'Размер', 'Розмір', 'Памер', 'Rozmiar', 'Tamanho', 'Tamaño', 'Größe'],
  ['Reread Source', 'Обновить', 'Оновити', 'Абнавіць', 'Odśwież', 'Atualizar', 'Actualizar', 'Aktualisieren'],
  ['Check for Updates...', 'Проверить обновления...', 'Перевірити оновлення...', 'Праверыць абнаўленні...', 'Sprawdź aktualizacje...', 'Verificar atualizações...', 'Buscar actualizaciones...', 'Nach Updates suchen...'],
  ['Show toolbar', 'Показать панель инструментов', 'Показати панель інструментів', 'Паказаць панэль інструментаў', 'Pokaż pasek narzędzi', 'Mostrar barra de ferramentas', 'Mostrar barra de herramientas', 'Symbolleiste anzeigen'],
  ['Options...', 'Параметры...', 'Параметри...', 'Параметры...', 'Opcje...', 'Opções...', 'Opciones...', 'Optionen...'],
  ['Language...', 'Язык...', 'Мова...', 'Мова...', 'Język...', 'Idioma...', 'Idioma...', 'Sprache...'],
  ['Open Home Folder', 'Открыть домашнюю папку', 'Відкрити домашню теку', 'Адкрыць хатнюю папку', 'Otwórz folder domowy', 'Abrir pasta pessoal', 'Abrir carpeta personal', 'Home-Ordner öffnen'],
  // ---- panel header / F keys / status
  ['Ext', 'Расш', 'Розш', 'Пашыр', 'Rozsz', 'Ext', 'Ext', 'Erw'],
  ['Date', 'Дата', 'Дата', 'Дата', 'Data', 'Data', 'Fecha', 'Datum'],
  ['Attr', 'Атр', 'Атр', 'Атр', 'Atr', 'Attr', 'Atrib', 'Attr'],
  ['F3 View', 'F3 Просмотр', 'F3 Перегляд', 'F3 Прагляд', 'F3 Podgląd', 'F3 Ver', 'F3 Ver', 'F3 Ansicht'],
  ['F4 Edit', 'F4 Правка', 'F4 Редагув.', 'F4 Праўка', 'F4 Edycja', 'F4 Editar', 'F4 Editar', 'F4 Bearb.'],
  ['F5 Copy', 'F5 Копия', 'F5 Копія', 'F5 Копія', 'F5 Kopiuj', 'F5 Copiar', 'F5 Copiar', 'F5 Kopieren'],
  ['F6 Move', 'F6 Перенос', 'F6 Перенос', 'F6 Перанос', 'F6 Przenieś', 'F6 Mover', 'F6 Mover', 'F6 Versch.'],
  ['F7 NewFolder', 'F7 Папка', 'F7 Тека', 'F7 Папка', 'F7 Katalog', 'F7 Pasta', 'F7 Carpeta', 'F7 Ordner'],
  ['F8 Delete', 'F8 Удалить', 'F8 Видалити', 'F8 Выдаліць', 'F8 Usuń', 'F8 Excluir', 'F8 Borrar', 'F8 Löschen'],
  ['Alt+F4 Exit', 'Alt+F4 Выход', 'Alt+F4 Вихід', 'Alt+F4 Выхад', 'Alt+F4 Wyjście', 'Alt+F4 Sair', 'Alt+F4 Salir', 'Alt+F4 Beenden'],
  // ---- common dialogs
  ['OK', 'ОК', 'ОК', 'ОК', 'OK', 'OK', 'Aceptar', 'OK'],
  ['Cancel', 'Отмена', 'Скасувати', 'Адмена', 'Anuluj', 'Cancelar', 'Cancelar', 'Abbrechen'],
  ['Yes', 'Да', 'Так', 'Так', 'Tak', 'Sim', 'Sí', 'Ja'],
  ['No', 'Нет', 'Ні', 'Не', 'Nie', 'Não', 'No', 'Nein'],
  ['Close', 'Закрыть', 'Закрити', 'Закрыць', 'Zamknij', 'Fechar', 'Cerrar', 'Schließen'],
  ['Save', 'Сохранить', 'Зберегти', 'Захаваць', 'Zapisz', 'Salvar', 'Guardar', 'Speichern'],
  ['Delete', 'Удалить', 'Видалити', 'Выдаліць', 'Usuń', 'Excluir', 'Eliminar', 'Löschen'],
  ['Rename', 'Переименовать', 'Перейменувати', 'Перайменаваць', 'Zmień nazwę', 'Renomear', 'Renombrar', 'Umbenennen'],
  ['Overwrite', 'Заменить', 'Замінити', 'Замяніць', 'Zastąp', 'Substituir', 'Sobrescribir', 'Überschreiben'],
  ['Skip existing', 'Пропустить существующие', 'Пропустити наявні', 'Прапусціць існуючыя', 'Pomiń istniejące', 'Ignorar existentes', 'Omitir existentes', 'Vorhandene überspringen'],
  ['Confirm overwrite', 'Подтверждение замены', 'Підтвердження заміни', 'Пацвярджэнне замены', 'Potwierdź zastąpienie', 'Confirmar substituição', 'Confirmar sobrescritura', 'Überschreiben bestätigen'],
  ['Error', 'Ошибка', 'Помилка', 'Памылка', 'Błąd', 'Erro', 'Error', 'Fehler'],
  ['New folder', 'Новая папка', 'Нова тека', 'Новая папка', 'Nowy folder', 'Nova pasta', 'Nueva carpeta', 'Neuer Ordner'],
  ['Enter new directory name:', 'Введите имя нового каталога:', 'Введіть ім’я нового каталогу:', 'Увядзіце імя новага каталога:', 'Podaj nazwę nowego katalogu:', 'Digite o nome do novo diretório:', 'Introduzca el nombre del nuevo directorio:', 'Name des neuen Verzeichnisses:'],
  ['Rename/Move', 'Переименовать / Переместить', 'Перейменувати / Перемістити', 'Перайменаваць / Перамясціць', 'Zmień nazwę / Przenieś', 'Renomear / Mover', 'Renombrar / Mover', 'Umbenennen / Verschieben'],
  ['Pack files', 'Упаковка файлов', 'Пакування файлів', 'Пакаванне файлаў', 'Pakowanie plików', 'Compactar arquivos', 'Comprimir archivos', 'Dateien packen'],
  ['Unpack files', 'Распаковка файлов', 'Розпакування файлів', 'Распакаванне файлаў', 'Rozpakowanie plików', 'Descompactar arquivos', 'Descomprimir archivos', 'Dateien entpacken'],
  ['Upload', 'Отправка', 'Відправлення', 'Адпраўка', 'Wysyłanie', 'Enviando', 'Subiendo', 'Hochladen'],
  ['Pack', 'Упаковка', 'Пакування', 'Пакаванне', 'Pakowanie', 'Compactar', 'Comprimir', 'Packen'],
  ['Unpack', 'Распаковка', 'Розпакування', 'Распакаванне', 'Rozpakowanie', 'Descompactar', 'Descomprimir', 'Entpacken'],
  ['Archive', 'Архив', 'Архів', 'Архіў', 'Archiwum', 'Arquivo', 'Archivo', 'Archiv'],
  ['Properties', 'Свойства', 'Властивості', 'Уласцівасці', 'Właściwości', 'Propriedades', 'Propiedades', 'Eigenschaften'],
  ['Mask (e.g. *.jpg;*.png):', 'Маска (напр. *.jpg;*.png):', 'Маска (напр. *.jpg;*.png):', 'Маска (напр. *.jpg;*.png):', 'Maska (np. *.jpg;*.png):', 'Máscara (ex.: *.jpg;*.png):', 'Máscara (p. ej. *.jpg;*.png):', 'Maske (z. B. *.jpg;*.png):'],
  // ---- editor / viewer
  ['Edit new file', 'Новый файл', 'Новий файл', 'Новы файл', 'Nowy plik', 'Novo arquivo', 'Archivo nuevo', 'Neue Datei'],
  ['File name:', 'Имя файла:', 'Ім’я файлу:', 'Імя файла:', 'Nazwa pliku:', 'Nome do arquivo:', 'Nombre de archivo:', 'Dateiname:'],
  ['Open externally', 'Открыть во внешней программе', 'Відкрити у зовнішній програмі', 'Адкрыць у знешняй праграме', 'Otwórz zewnętrznie', 'Abrir externamente', 'Abrir externamente', 'Extern öffnen'],
  ['Save as UTF-8', 'Сохранить как UTF-8', 'Зберегти як UTF-8', 'Захаваць як UTF-8', 'Zapisz jako UTF-8', 'Salvar como UTF-8', 'Guardar como UTF-8', 'Als UTF-8 speichern'],
  ['Save with "?"', 'Сохранить с «?»', 'Зберегти з «?»', 'Захаваць з «?»', 'Zapisz z „?”', 'Salvar com "?"', 'Guardar con "?"', 'Mit „?“ speichern'],
  ['Save anyway', 'Всё равно сохранить', 'Все одно зберегти', 'Усё роўна захаваць', 'Zapisz mimo to', 'Salvar mesmo assim', 'Guardar de todos modos', 'Trotzdem speichern'],
  ['Go to line', 'Перейти к строке', 'Перейти до рядка', 'Перайсці да radka', 'Idź do wiersza', 'Ir para a linha', 'Ir a la línea', 'Gehe zu Zeile'],
  ['Line number:', 'Номер строки:', 'Номер рядка:', 'Нумар радка:', 'Numer wiersza:', 'Número da linha:', 'Número de línea:', 'Zeilennummer:'],
  ['Encoding', 'Кодировка', 'Кодування', 'Кадыроўка', 'Kodowanie', 'Codificação', 'Codificación', 'Kodierung'],
  ['Find next', 'Найти далее', 'Знайти далі', 'Знайсці далей', 'Znajdź następny', 'Localizar próximo', 'Buscar siguiente', 'Weitersuchen'],
  ['Replace', 'Заменить', 'Замінити', 'Замяніць', 'Zamień', 'Substituir', 'Reemplazar', 'Ersetzen'],
  ['Replace all', 'Заменить все', 'Замінити все', 'Замяніць усё', 'Zamień wszystko', 'Substituir tudo', 'Reemplazar todo', 'Alle ersetzen'],
  ['Mode', 'Режим', 'Режим', 'Рэжым', 'Tryb', 'Modo', 'Modo', 'Modus'],
  ['Auto', 'Авто', 'Авто', 'Аўта', 'Auto', 'Auto', 'Auto', 'Auto'],
  ['Image', 'Изображение', 'Зображення', 'Выява', 'Obraz', 'Imagem', 'Imagen', 'Bild'],
  ['Text', 'Текст', 'Текст', 'Тэкст', 'Tekst', 'Texto', 'Texto', 'Text'],
  ['Document', 'Документ', 'Документ', 'Дакумент', 'Dokument', 'Documento', 'Documento', 'Dokument'],
  // ---- file tools
  ['Calculate Occupied Space', 'Подсчёт занятого места', 'Підрахунок зайнятого місця', 'Падлік занятага месца', 'Obliczanie zajętego miejsca', 'Espaço ocupado', 'Espacio ocupado', 'Belegter Platz'],
  ['Edit Comment', 'Комментарий', 'Коментар', 'Каментарый', 'Komentarz', 'Comentário', 'Comentario', 'Kommentar'],
  ['Change Attributes', 'Изменение атрибутов', 'Зміна атрибутів', 'Змяненне атрыбутаў', 'Zmiana atrybutów', 'Alterar atributos', 'Cambiar atributos', 'Attribute ändern'],
  ['Create Checksum File(s)', 'Создание файлов контрольных сумм', 'Створення файлів контрольних сум', 'Стварэнне файлаў кантрольных сум', 'Tworzenie plików sum kontrolnych', 'Criar arquivos de checksum', 'Crear archivos de suma de verificación', 'Prüfsummendateien erstellen'],
  ['Verify Checksums', 'Проверка контрольных сумм', 'Перевірка контрольних сум', 'Праверка кантрольных сум', 'Sprawdzanie sum kontrolnych', 'Verificar checksums', 'Verificar sumas de verificación', 'Prüfsummen prüfen'],
  ['Split File', 'Разбиение файла', 'Розбиття файлу', 'Разбіццё файла', 'Dzielenie pliku', 'Dividir arquivo', 'Dividir archivo', 'Datei teilen'],
  ['Combine Files', 'Склейка файлов', 'Склеювання файлів', 'Склейка файлаў', 'Łączenie plików', 'Combinar arquivos', 'Combinar archivos', 'Dateien zusammenfügen'],
  ['Encode File', 'Кодирование файла', 'Кодування файлу', 'Кадзіраванне файла', 'Kodowanie pliku', 'Codificar arquivo', 'Codificar archivo', 'Datei kodieren'],
  ['Decode File', 'Декодирование файла', 'Декодування файлу', 'Дэкадзіраванне файла', 'Dekodowanie pliku', 'Decodificar arquivo', 'Decodificar archivo', 'Datei dekodieren'],
  ['Compare By Content', 'Сравнение по содержимому', 'Порівняння за вмістом', 'Параўнанне па змесціве', 'Porównanie zawartości', 'Comparar por conteúdo', 'Comparar por contenido', 'Nach Inhalt vergleichen'],
  ['Next difference', 'Следующее отличие', 'Наступна відмінність', 'Наступнае адрозненне', 'Następna różnica', 'Próxima diferença', 'Siguiente diferencia', 'Nächster Unterschied'],
  ['Algorithm:', 'Алгоритм:', 'Алгоритм:', 'Алгарытм:', 'Algorytm:', 'Algoritmo:', 'Algoritmo:', 'Algorithmus:'],
  ['Target folder:', 'Папка назначения:', 'Тека призначення:', 'Папка прызначэння:', 'Folder docelowy:', 'Pasta de destino:', 'Carpeta de destino:', 'Zielordner:'],
  ['Part size:', 'Размер части:', 'Розмір частини:', 'Памер часткі:', 'Rozmiar części:', 'Tamanho da parte:', 'Tamaño de la parte:', 'Teilgröße:'],
  ['presets', 'шаблоны', 'шаблони', 'шаблоны', 'wzorce', 'predefinições', 'preajustes', 'Vorgaben'],
  ['Format:', 'Формат:', 'Формат:', 'Фармат:', 'Format:', 'Formato:', 'Formato:', 'Format:'],
  ['Updating', 'Обновление', 'Оновлення', 'Абнаўленне', 'Aktualizacja', 'Atualizando', 'Actualizando', 'Aktualisierung'],
  ['Update', 'Обновление', 'Оновлення', 'Абнаўленне', 'Aktualizacja', 'Atualização', 'Actualización', 'Update'],
  ['Update available', 'Доступно обновление', 'Доступне оновлення', 'Даступна абнаўленне', 'Dostępna aktualizacja', 'Atualização disponível', 'Actualización disponible', 'Update verfügbar'],
  ['Update now', 'Обновить сейчас', 'Оновити зараз', 'Абнавіць зараз', 'Aktualizuj teraz', 'Atualizar agora', 'Actualizar ahora', 'Jetzt aktualisieren'],
  ['Later', 'Позже', 'Пізніше', 'Пазней', 'Później', 'Mais tarde', 'Más tarde', 'Später'],
  ['Skip this version', 'Пропустить эту версию', 'Пропустити цю версію', 'Прапусціць гэту версію', 'Pomiń tę wersję', 'Ignorar esta versão', 'Omitir esta versión', 'Diese Version überspringen'],
  ['Check for Updates', 'Проверка обновлений', 'Перевірка оновлень', 'Праверка абнаўленняў', 'Sprawdzanie aktualizacji', 'Verificar atualizações', 'Buscar actualizaciones', 'Nach Updates suchen'],
  ['ZX Spectrum emulator', 'Эмулятор ZX Spectrum', 'Емулятор ZX Spectrum', 'Эмулятар ZX Spectrum', 'Emulator ZX Spectrum', 'Emulador ZX Spectrum', 'Emulador ZX Spectrum', 'ZX-Spectrum-Emulator'],
  ['bytes', 'байт', 'байт', 'байт', 'bajtów', 'bytes', 'bytes', 'Bytes'],
  ['kbytes', 'Кбайт', 'Кбайт', 'Кбайт', 'KB', 'KB', 'KB', 'KB'],
  ['Mbytes', 'Мбайт', 'Мбайт', 'Мбайт', 'MB', 'MB', 'MB', 'MB'],
  ['Gbytes', 'Гбайт', 'Гбайт', 'Гбайт', 'GB', 'GB', 'GB', 'GB'],
  // ---- hotlist / multi-rename
  ['Rename entry', 'Переименование записи', 'Перейменування запису', 'Перайменаванне запісу', 'Zmiana nazwy wpisu', 'Renomear entrada', 'Renombrar entrada', 'Eintrag umbenennen'],
  ['No favourite folders yet.', 'Избранных папок пока нет.', 'Обраних тек поки немає.', 'Абраных папак пакуль няма.', 'Brak ulubionych folderów.', 'Ainda não há pastas favoritas.', 'Aún no hay carpetas favoritas.', 'Noch keine Favoriten.'],
  ['Add current dir', 'Добавить текущий каталог', 'Додати поточний каталог', 'Дадаць бягучы каталог', 'Dodaj bieżący katalog', 'Adicionar diretório atual', 'Añadir directorio actual', 'Aktuelles Verzeichnis hinzufügen'],
  ['Configure...', 'Настроить...', 'Налаштувати...', 'Наладзіць...', 'Konfiguruj...', 'Configurar...', 'Configurar...', 'Konfigurieren...'],
  ['Import from Total Commander', 'Импорт из Total Commander', 'Імпорт з Total Commander', 'Імпарт з Total Commander', 'Importuj z Total Commander', 'Importar do Total Commander', 'Importar de Total Commander', 'Aus Total Commander importieren'],
  ['Save settings', 'Сохранение настроек', 'Збереження налаштувань', 'Захаванне налад', 'Zapis ustawień', 'Salvar configurações', 'Guardar ajustes', 'Einstellungen speichern'],
  ['Name of the settings:', 'Имя настроек:', 'Назва налаштувань:', 'Назва налад:', 'Nazwa ustawień:', 'Nome das configurações:', 'Nombre de los ajustes:', 'Name der Einstellungen:'],
  ['Multi-Rename Tool', 'Групповое переименование', 'Групове перейменування', 'Групавое перайменаванне', 'Zmiana nazw wielu plików', 'Renomear em massa', 'Renombrar varios', 'Mehrfach umbenennen'],
  ['Rename mask: file name', 'Маска имени файла', 'Маска імені файлу', 'Маска імя файла', 'Maska nazwy pliku', 'Máscara do nome', 'Máscara del nombre', 'Namensmaske'],
  ['Search & Replace', 'Поиск и замена', 'Пошук і заміна', 'Пошук і замена', 'Znajdź i zamień', 'Localizar e substituir', 'Buscar y reemplazar', 'Suchen & Ersetzen'],
  ['Search for:', 'Искать:', 'Шукати:', 'Шукаць:', 'Szukaj:', 'Procurar:', 'Buscar:', 'Suchen nach:'],
  ['Replace with:', 'Заменить на:', 'Замінити на:', 'Замяніць на:', 'Zamień na:', 'Substituir por:', 'Reemplazar con:', 'Ersetzen durch:'],
  ['Define counter [C]', 'Счётчик [C]', 'Лічильник [C]', 'Лічыльнік [C]', 'Licznik [C]', 'Contador [C]', 'Contador [C]', 'Zähler [C]'],
  ['Start at:', 'Начать с:', 'Почати з:', 'Пачаць з:', 'Zacznij od:', 'Começar em:', 'Empezar en:', 'Beginnen bei:'],
  ['Step by:', 'Шаг:', 'Крок:', 'Крок:', 'Krok:', 'Passo:', 'Paso:', 'Schritt:'],
  ['Digits:', 'Цифр:', 'Цифр:', 'Лічбаў:', 'Cyfr:', 'Dígitos:', 'Dígitos:', 'Stellen:'],
  ['Upper/lowercase:', 'Регистр:', 'Регістр:', 'Рэгістр:', 'Wielkość liter:', 'Maiúsculas/minúsculas:', 'Mayúsculas/minúsculas:', 'Groß-/Kleinschreibung:'],
  ['Unchanged', 'Без изменений', 'Без змін', 'Без змен', 'Bez zmian', 'Inalterado', 'Sin cambios', 'Unverändert'],
  ['UPPERCASE', 'ЗАГЛАВНЫЕ', 'ВЕЛИКІ', 'ВЯЛІКІЯ', 'WIELKIE', 'MAIÚSCULAS', 'MAYÚSCULAS', 'GROSSBUCHSTABEN'],
  ['lowercase', 'строчные', 'малі', 'малыя', 'małe', 'minúsculas', 'minúsculas', 'Kleinbuchstaben'],
  ['First letter upper', 'Первая буква заглавная', 'Перша літера велика', 'Першая літара вялікая', 'Pierwsza litera wielka', 'Primeira letra maiúscula', 'Primera letra mayúscula', 'Erster Buchstabe groß'],
  ['Each Word Upper', 'Каждое Слово С Заглавной', 'Кожне Слово З Великої', 'Кожнае Слова З Вялікай', 'Każde Słowo Wielką', 'Cada Palavra Maiúscula', 'Cada Palabra En Mayúscula', 'Jedes Wort Groß'],
  ['Save settings...', 'Сохранить настройки...', 'Зберегти налаштування...', 'Захаваць налады...', 'Zapisz ustawienia...', 'Salvar configurações...', 'Guardar ajustes...', 'Einstellungen speichern...'],
  ['Load settings...', 'Загрузить настройки...', 'Завантажити налаштування...', 'Загрузіць налады...', 'Wczytaj ustawienia...', 'Carregar configurações...', 'Cargar ajustes...', 'Einstellungen laden...'],
  ['Old name', 'Старое имя', 'Старе ім’я', 'Старое імя', 'Stara nazwa', 'Nome antigo', 'Nombre anterior', 'Alter Name'],
  ['New name', 'Новое имя', 'Нове ім’я', 'Новае імя', 'Nowa nazwa', 'Novo nome', 'Nombre nuevo', 'Neuer Name'],
  ['Location', 'Расположение', 'Розташування', 'Размяшчэнне', 'Lokalizacja', 'Local', 'Ubicación', 'Ort'],
  ['Start!', 'Старт!', 'Старт!', 'Старт!', 'Start!', 'Iniciar!', '¡Iniciar!', 'Start!'],
  ['Undo', 'Отменить', 'Скасувати дію', 'Адрабіць', 'Cofnij', 'Desfazer', 'Deshacer', 'Rückgängig'],
  ['Result list', 'Список результата', 'Список результату', 'Спіс выніку', 'Lista wyników', 'Lista de resultados', 'Lista de resultados', 'Ergebnisliste'],
  ['Reset', 'Сброс', 'Скинути', 'Скід', 'Resetuj', 'Redefinir', 'Restablecer', 'Zurücksetzen'],
  ['Match case', 'С учётом регистра', 'З урахуванням регістру', 'З улікам рэгістру', 'Uwzględnij wielkość liter', 'Diferenciar maiúsculas', 'Coincidir mayúsculas', 'Groß-/Kleinschreibung'],
  // ---- connections
  ['Select the private key file', 'Выберите файл закрытого ключа', 'Виберіть файл закритого ключа', 'Абярыце файл закрытага ключа', 'Wybierz plik klucza prywatnego', 'Selecione o arquivo da chave privada', 'Seleccione el archivo de clave privada', 'Datei mit dem privaten Schlüssel wählen'],
  ['Delete connection', 'Удалить подключение', 'Видалити підключення', 'Выдаліць падключэнне', 'Usuń połączenie', 'Excluir conexão', 'Eliminar conexión', 'Verbindung löschen'],
  ['Name:', 'Имя:', 'Ім’я:', 'Імя:', 'Nazwa:', 'Nome:', 'Nombre:', 'Name:'],
  ['Address:', 'Адрес:', 'Адреса:', 'Адрас:', 'Adres:', 'Endereço:', 'Dirección:', 'Adresse:'],
  ['Host:', 'Хост:', 'Хост:', 'Хост:', 'Host:', 'Host:', 'Host:', 'Host:'],
  ['Port:', 'Порт:', 'Порт:', 'Порт:', 'Port:', 'Porta:', 'Puerto:', 'Port:'],
  ['Open as:', 'Открывать как:', 'Відкривати як:', 'Адкрываць як:', 'Otwórz jako:', 'Abrir como:', 'Abrir como:', 'Öffnen als:'],
  ['Disk (file list) - Ctrl+O shows the console', 'Диск (список файлов) - Ctrl+O показывает консоль', 'Диск (список файлів) - Ctrl+O показує консоль', 'Дыск (спіс файлаў) - Ctrl+O паказвае кансоль', 'Dysk (lista plików) - Ctrl+O pokazuje konsolę', 'Disco (lista de arquivos) - Ctrl+O mostra o console', 'Disco (lista de archivos) - Ctrl+O muestra la consola', 'Laufwerk (Dateiliste) - Strg+O zeigt die Konsole'],
  ['Console - Ctrl+O shows the file list', 'Консоль - Ctrl+O показывает список файлов', 'Консоль - Ctrl+O показує список файлів', 'Кансоль - Ctrl+O паказвае спіс файлаў', 'Konsola - Ctrl+O pokazuje listę plików', 'Console - Ctrl+O mostra a lista de arquivos', 'Consola - Ctrl+O muestra la lista de archivos', 'Konsole - Strg+O zeigt die Dateiliste'],
  ['User:', 'Пользователь:', 'Користувач:', 'Карыстальнік:', 'Użytkownik:', 'Usuário:', 'Usuario:', 'Benutzer:'],
  ['Key file:', 'Файл ключа:', 'Файл ключа:', 'Файл ключа:', 'Plik klucza:', 'Arquivo de chave:', 'Archivo de clave:', 'Schlüsseldatei:'],
  ['Password:', 'Пароль:', 'Пароль:', 'Пароль:', 'Hasło:', 'Senha:', 'Contraseña:', 'Passwort:'],
  ['App key:', 'Ключ приложения:', 'Ключ застосунку:', 'Ключ праграмы:', 'Klucz aplikacji:', 'Chave do aplicativo:', 'Clave de la aplicación:', 'App-Schlüssel:'],
  ['Client ID:', 'ID клиента:', 'ID клієнта:', 'ID кліента:', 'ID klienta:', 'ID do cliente:', 'ID de cliente:', 'Client-ID:'],
  ['Client secret:', 'Секрет клиента:', 'Секрет клієнта:', 'Сакрэт кліента:', 'Sekret klienta:', 'Segredo do cliente:', 'Secreto del cliente:', 'Client-Secret:'],
  ['Use a different account', 'Другой аккаунт', 'Інший акаунт', 'Іншы акаўнт', 'Użyj innego konta', 'Usar outra conta', 'Usar otra cuenta', 'Anderes Konto verwenden'],
  ['Settings and setup help...', 'Настройки и справка...', 'Налаштування і довідка...', 'Налады і даведка...', 'Ustawienia i pomoc...', 'Configurações e ajuda...', 'Ajustes y ayuda...', 'Einstellungen und Hilfe...'],
  ['Connect', 'Подключиться', 'Підключитися', 'Падключыцца', 'Połącz', 'Conectar', 'Conectar', 'Verbinden'],
  ['New', 'Новое', 'Нове', 'Новае', 'Nowe', 'Novo', 'Nuevo', 'Neu'],
  ['Sign in with Google', 'Войти через Google', 'Увійти через Google', 'Увайсці праз Google', 'Zaloguj przez Google', 'Entrar com o Google', 'Iniciar sesión con Google', 'Mit Google anmelden'],
  ['Sign in with Dropbox', 'Войти через Dropbox', 'Увійти через Dropbox', 'Увайсці праз Dropbox', 'Zaloguj przez Dropbox', 'Entrar com o Dropbox', 'Iniciar sesión con Dropbox', 'Mit Dropbox anmelden'],
  ['Player', 'Плеер', 'Плеєр', 'Плэер', 'Odtwarzacz', 'Player', 'Reproductor', 'Player'],
  // ---- find files
  ['Find Files', 'Поиск файлов', 'Пошук файлів', 'Пошук файлаў', 'Szukaj plików', 'Localizar arquivos', 'Buscar archivos', 'Dateien suchen'],
  ['General', 'Общие', 'Загальні', 'Агульныя', 'Ogólne', 'Geral', 'General', 'Allgemein'],
  ['Advanced', 'Дополнительно', 'Додатково', 'Дадаткова', 'Zaawansowane', 'Avançado', 'Avanzado', 'Erweitert'],
  ['Load/Save', 'Загрузка / сохранение', 'Завантаження / збереження', 'Загрузка / захаванне', 'Wczytaj / zapisz', 'Carregar / salvar', 'Cargar / guardar', 'Laden / Speichern'],
  ['Search in:', 'Искать в:', 'Шукати в:', 'Шукаць у:', 'Szukaj w:', 'Procurar em:', 'Buscar en:', 'Suchen in:'],
  ['Panels', 'Панели', 'Панелі', 'Панэлі', 'Panele', 'Painéis', 'Paneles', 'Panels'],
  ['Depth', 'Глубина', 'Глибина', 'Глыбіня', 'Głębokość', 'Profundidade', 'Profundidad', 'Tiefe'],
  ['Attributes:', 'Атрибуты:', 'Атрибути:', 'Атрыбуты:', 'Atrybuty:', 'Atributos:', 'Atributos:', 'Attribute:'],
  ['click: yes / no / any', 'щелчок: да / нет / любой', 'клік: так / ні / будь-який', 'клік: так / не / любы', 'kliknij: tak / nie / dowolny', 'clique: sim / não / qualquer', 'clic: sí / no / cualquiera', 'Klick: ja / nein / egal'],
  ['Find duplicate files:', 'Искать дубликаты:', 'Шукати дублікати:', 'Шукаць дублікаты:', 'Szukaj duplikatów:', 'Procurar duplicados:', 'Buscar duplicados:', 'Duplikate suchen:'],
  ['Save current', 'Сохранить текущее', 'Зберегти поточне', 'Захаваць бягучае', 'Zapisz bieżące', 'Salvar atual', 'Guardar actual', 'Aktuelle speichern'],
  ['Load', 'Загрузить', 'Завантажити', 'Загрузіць', 'Wczytaj', 'Carregar', 'Cargar', 'Laden'],
  ['Folder', 'Папка', 'Тека', 'Папка', 'Folder', 'Pasta', 'Carpeta', 'Ordner'],
  ['Start search', 'Начать поиск', 'Почати пошук', 'Пачаць пошук', 'Rozpocznij szukanie', 'Iniciar busca', 'Iniciar búsqueda', 'Suche starten'],
  ['Go to file', 'Перейти к файлу', 'Перейти до файлу', 'Перайсці да файла', 'Przejdź do pliku', 'Ir para o arquivo', 'Ir al archivo', 'Zur Datei springen'],
  ['all (unlimited)', 'все (без ограничений)', 'усі (без обмежень)', 'усе (без абмежаванняў)', 'wszystkie (bez limitu)', 'todos (ilimitado)', 'todos (sin límite)', 'alle (unbegrenzt)'],
  ['current dir only', 'только текущая папка', 'лише поточна тека', 'толькі бягучая папка', 'tylko bieżący katalog', 'somente o diretório atual', 'solo el directorio actual', 'nur aktuelles Verzeichnis'],
  ['Find text', 'Искать текст', 'Шукати текст', 'Шукаць тэкст', 'Znajdź tekst', 'Procurar texto', 'Buscar texto', 'Text suchen'],
  ['Whole words only', 'Только слова целиком', 'Лише слова цілком', 'Толькі словы цалкам', 'Tylko całe słowa', 'Somente palavras inteiras', 'Solo palabras completas', 'Nur ganze Wörter'],
  ['Case sensitive', 'С учётом регистра', 'З урахуванням регістру', 'З улікам рэгістру', 'Uwzględnij wielkość liter', 'Diferenciar maiúsculas', 'Distinguir mayúsculas', 'Groß-/Kleinschreibung'],
  ['Find files NOT containing the text', 'Файлы, НЕ содержащие текст', 'Файли, що НЕ містять текст', 'Файлы, якія НЕ ўтрымліваюць тэкст', 'Pliki NIE zawierające tekstu', 'Arquivos que NÃO contêm o texto', 'Archivos que NO contienen el texto', 'Dateien, die den Text NICHT enthalten'],
  ['Only in selected items', 'Только в выделенном', 'Лише у виділеному', 'Толькі ў вылучаным', 'Tylko w zaznaczonych', 'Somente nos itens selecionados', 'Solo en los seleccionados', 'Nur in ausgewählten Elementen'],
  ['Search in zip archives (names and text)', 'Искать в zip-архивах (имена и текст)', 'Шукати в zip-архівах (імена і текст)', 'Шукаць у zip-архівах (імёны і тэкст)', 'Szukaj w archiwach zip (nazwy i tekst)', 'Procurar em arquivos zip (nomes e texto)', 'Buscar en archivos zip (nombres y texto)', 'In ZIP-Archiven suchen (Namen und Text)'],
  ['Skip binary files (video, images, programs)', 'Пропускать бинарные файлы (видео, картинки, программы)', 'Пропускати бінарні файли (відео, картинки, програми)', 'Прапускаць бінарныя файлы (відэа, выявы, праграмы)', 'Pomijaj pliki binarne (wideo, obrazy, programy)', 'Ignorar arquivos binários (vídeo, imagens, programas)', 'Omitir archivos binarios (vídeo, imágenes, programas)', 'Binärdateien überspringen (Video, Bilder, Programme)'],
  ['Read only', 'Только чтение', 'Лише читання', 'Толькі чытанне', 'Tylko do odczytu', 'Somente leitura', 'Solo lectura', 'Schreibgeschützt'],
  ['Hidden', 'Скрытый', 'Прихований', 'Схаваны', 'Ukryty', 'Oculto', 'Oculto', 'Versteckt'],
  ['Directory', 'Каталог', 'Каталог', 'Каталог', 'Katalog', 'Diretório', 'Directorio', 'Verzeichnis'],
  ['same name', 'одинаковое имя', 'однакове ім’я', 'аднолькавае імя', 'ta sama nazwa', 'mesmo nome', 'mismo nombre', 'gleicher Name'],
  ['same size', 'одинаковый размер', 'однаковий розмір', 'аднолькавы памер', 'ten sam rozmiar', 'mesmo tamanho', 'mismo tamaño', 'gleiche Größe'],
  ['same contents', 'одинаковое содержимое', 'однаковий вміст', 'аднолькавае змесціва', 'ta sama zawartość', 'mesmo conteúdo', 'mismo contenido', 'gleicher Inhalt'],
  ['Date between:', 'Дата между:', 'Дата між:', 'Дата паміж:', 'Data od-do:', 'Data entre:', 'Fecha entre:', 'Datum zwischen:'],
  ['Not older than:', 'Не старше:', 'Не старіше:', 'Не старэй:', 'Nie starsze niż:', 'Não mais antigo que:', 'No más antiguo que:', 'Nicht älter als:'],
  ['Older than:', 'Старше:', 'Старіше:', 'Старэй:', 'Starsze niż:', 'Mais antigo que:', 'Más antiguo que:', 'Älter als:'],
  ['File size:', 'Размер файла:', 'Розмір файлу:', 'Памер файла:', 'Rozmiar pliku:', 'Tamanho do arquivo:', 'Tamaño de archivo:', 'Dateigröße:'],
  // ---- synchronize / misc
  ['Synchronize', 'Синхронизация', 'Синхронізація', 'Сінхранізацыя', 'Synchronizacja', 'Sincronizar', 'Sincronizar', 'Synchronisieren'],
  ['Synchronize Dirs', 'Синхронизация каталогов', 'Синхронізація каталогів', 'Сінхранізацыя каталогаў', 'Synchronizacja katalogów', 'Sincronizar diretórios', 'Sincronizar directorios', 'Verzeichnisse synchronisieren'],
  ['Synchronize Directories', 'Синхронизация каталогов', 'Синхронізація каталогів', 'Сінхранізацыя каталогаў', 'Synchronizacja katalogów', 'Sincronizar diretórios', 'Sincronizar directorios', 'Verzeichnisse synchronisieren'],
  ['Copy', 'Копировать', 'Копіювати', 'Капіраваць', 'Kopiuj', 'Copiar', 'Copiar', 'Kopieren'],
  ['Compare', 'Сравнить', 'Порівняти', 'Параўнаць', 'Porównaj', 'Comparar', 'Comparar', 'Vergleichen'],
  ['Press Compare.', 'Нажмите «Сравнить».', 'Натисніть «Порівняти».', 'Націсніце «Параўнаць».', 'Naciśnij „Porównaj”.', 'Pressione Comparar.', 'Pulse Comparar.', 'Auf „Vergleichen“ klicken.'],
  // ---- toolbar tooltips
  ['Reread source', 'Обновить', 'Оновити', 'Абнавіць', 'Odśwież', 'Atualizar', 'Actualizar', 'Aktualisieren'],
  ['Go back', 'Назад', 'Назад', 'Назад', 'Wstecz', 'Voltar', 'Atrás', 'Zurück'],
  ['Go forward', 'Вперёд', 'Вперед', 'Наперад', 'Dalej', 'Avançar', 'Adelante', 'Vorwärts'],
  ['Parent folder', 'Родительская папка', 'Батьківська тека', 'Бацькоўская папка', 'Folder nadrzędny', 'Pasta superior', 'Carpeta superior', 'Übergeordneter Ordner'],
  ['Home folder', 'Домашняя папка', 'Домашня тека', 'Хатняя папка', 'Folder domowy', 'Pasta pessoal', 'Carpeta personal', 'Home-Ordner'],
  ['Swap panels', 'Поменять панели', 'Поміняти панелі', 'Памяняць панэлі', 'Zamień panele', 'Trocar painéis', 'Intercambiar paneles', 'Panels tauschen'],
  ['Target = Source', 'Приёмник = Источник', 'Приймач = Джерело', 'Прыёмнік = Крыніца', 'Cel = Źródło', 'Destino = Origem', 'Destino = Origen', 'Ziel = Quelle'],
  ['New tab', 'Новая вкладка', 'Нова вкладка', 'Новая ўкладка', 'Nowa karta', 'Nova aba', 'Nueva pestaña', 'Neuer Tab'],
  ['Quick view panel', 'Панель быстрого просмотра', 'Панель швидкого перегляду', 'Панэль хуткага прагляду', 'Panel szybkiego podglądu', 'Painel de visualização rápida', 'Panel de vista rápida', 'Schnellansicht-Panel'],
  ['Thumbnail view', 'Режим миниатюр', 'Режим мініатюр', 'Рэжым мініяцюр', 'Widok miniatur', 'Modo de miniaturas', 'Vista de miniaturas', 'Vorschaubilder-Ansicht'],
  ['Directory hotlist', 'Избранные папки', 'Обрані теки', 'Абраныя папкі', 'Ulubione katalogi', 'Diretórios favoritos', 'Directorios favoritos', 'Verzeichnis-Favoriten'],
  ['Synology NAS', 'Synology NAS', 'Synology NAS', 'Synology NAS', 'Synology NAS', 'Synology NAS', 'Synology NAS', 'Synology NAS'],
  ['SSH server (console + files)', 'SSH-сервер (консоль + файлы)', 'SSH-сервер (консоль + файли)', 'SSH-сервер (кансоль + файлы)', 'Serwer SSH (konsola + pliki)', 'Servidor SSH (console + arquivos)', 'Servidor SSH (consola + archivos)', 'SSH-Server (Konsole + Dateien)'],
  ['Music player: play the audio files of this folder / pause', 'Плеер: играть аудиофайлы этой папки / пауза', 'Плеєр: грати аудіофайли цієї теки / пауза', 'Плэер: іграць аўдыёфайлы гэтай папкі / паўза', 'Odtwarzacz: odtwórz pliki audio z folderu / pauza', 'Player: reproduzir os áudios desta pasta / pausar', 'Reproductor: reproducir los audios de esta carpeta / pausa', 'Player: Audiodateien dieses Ordners abspielen / Pause'],
  ['Find files', 'Поиск файлов', 'Пошук файлів', 'Пошук файлаў', 'Szukaj plików', 'Localizar arquivos', 'Buscar archivos', 'Dateien suchen'],
  ['Compare directories', 'Сравнить каталоги', 'Порівняти каталоги', 'Параўнаць каталогі', 'Porównaj katalogi', 'Comparar diretórios', 'Comparar directorios', 'Verzeichnisse vergleichen'],
  ['Synchronize directories', 'Синхронизировать каталоги', 'Синхронізувати каталоги', 'Сінхранізаваць каталогі', 'Synchronizuj katalogi', 'Sincronizar diretórios', 'Sincronizar directorios', 'Verzeichnisse synchronisieren'],
  ['Multi-rename tool', 'Групповое переименование', 'Групове перейменування', 'Групавое перайменаванне', 'Zmiana nazw wielu plików', 'Renomear em massa', 'Renombrar varios', 'Mehrfach umbenennen'],
  ['Select all', 'Выделить все', 'Виділити все', 'Вылучыць усё', 'Zaznacz wszystko', 'Selecionar tudo', 'Seleccionar todo', 'Alles auswählen'],
  ['Pack files (zip)', 'Упаковать файлы (zip)', 'Запакувати файли (zip)', 'Запакаваць файлы (zip)', 'Spakuj pliki (zip)', 'Compactar arquivos (zip)', 'Comprimir archivos (zip)', 'Dateien packen (zip)'],
  ['Unpack archive', 'Распаковать архив', 'Розпакувати архів', 'Распакаваць архіў', 'Rozpakuj archiwum', 'Descompactar arquivo', 'Descomprimir archivo', 'Archiv entpacken'],
  // ---- hints and short messages
  ['Ready.', 'Готово.', 'Готово.', 'Гатова.', 'Gotowe.', 'Pronto.', 'Listo.', 'Bereit.'],
  ['text, regular expression or hex bytes (de ad be ef)', 'текст, регулярное выражение или hex-байты (de ad be ef)', 'текст, регулярний вираз або hex-байти (de ad be ef)', 'тэкст, рэгулярны выраз або hex-байты (de ad be ef)', 'tekst, wyrażenie regularne lub bajty hex (de ad be ef)', 'texto, expressão regular ou bytes hex (de ad be ef)', 'texto, expresión regular o bytes hex (de ad be ef)', 'Text, regulärer Ausdruck oder Hex-Bytes (de ad be ef)'],
  ['Hex', 'Hex', 'Hex', 'Hex', 'Hex', 'Hex', 'Hex', 'Hex'],
  ['Stay signed in on this computer (saved, encrypted by the system)', 'Оставаться в системе на этом компьютере (хранится в зашифрованном виде)', 'Залишатися в системі на цьому комп’ютері (зберігається зашифрованим)', 'Заставацца ў сістэме на гэтым кампутары (захоўваецца зашыфраваным)', 'Pozostań zalogowany na tym komputerze (zaszyfrowane przez system)', 'Permanecer conectado neste computador (criptografado pelo sistema)', 'Mantener la sesión en este equipo (cifrada por el sistema)', 'Auf diesem Computer angemeldet bleiben (vom System verschlüsselt)'],
  ['Remember the password (encrypted by the system)', 'Запомнить пароль (хранится в зашифрованном виде)', 'Запам’ятати пароль (зберігається зашифрованим)', 'Запомніць пароль (захоўваецца зашыфраваным)', 'Zapamiętaj hasło (zaszyfrowane przez system)', 'Lembrar a senha (criptografada pelo sistema)', 'Recordar la contraseña (cifrada por el sistema)', 'Passwort merken (vom System verschlüsselt)'],
  ['Allow an untrusted certificate (self-signed)', 'Разрешить недоверенный сертификат (самоподписанный)', 'Дозволити недовірений сертифікат (самопідписаний)', 'Дазволіць недаверлівы сертыфікат (самападпісаны)', 'Zezwól na niezaufany certyfikat (z podpisem własnym)', 'Permitir certificado não confiável (autoassinado)', 'Permitir certificado no confiable (autofirmado)', 'Nicht vertrauenswürdiges Zertifikat erlauben (selbstsigniert)'],
  ['Process subfolders (apply to everything inside)', 'Обрабатывать вложенные папки (применить ко всему внутри)', 'Обробляти вкладені теки (застосувати до всього всередині)', 'Апрацоўваць укладзеныя папкі (прымяніць да ўсяго ўнутры)', 'Przetwarzaj podfoldery (zastosuj do całej zawartości)', 'Processar subpastas (aplicar a tudo dentro)', 'Procesar subcarpetas (aplicar a todo el contenido)', 'Unterordner einbeziehen (auf alles darin anwenden)'],
  ['Change date and time:', 'Изменить дату и время:', 'Змінити дату і час:', 'Змяніць дату і час:', 'Zmień datę i czas:', 'Alterar data e hora:', 'Cambiar fecha y hora:', 'Datum und Uhrzeit ändern:'],
  ['Create a separate checksum file for each file', 'Отдельный файл контрольной суммы для каждого файла', 'Окремий файл контрольної суми для кожного файлу', 'Асобны файл кантрольнай сумы для кожнага файла', 'Osobny plik sumy kontrolnej dla każdego pliku', 'Criar um arquivo de checksum para cada arquivo', 'Crear un archivo de suma por cada archivo', 'Eigene Prüfsummendatei für jede Datei'],
  ['Archive', 'Архив', 'Архів', 'Архіў', 'Archiwum', 'Arquivo', 'Archivo', 'Archiv'],
  ['System', 'Системный', 'Системний', 'Сістэмны', 'Systemowy', 'Sistema', 'Sistema', 'System'],
  ['Read-only', 'Только чтение', 'Лише читання', 'Толькі чытанне', 'Tylko do odczytu', 'Somente leitura', 'Solo lectura', 'Schreibgeschützt'],
  ['Disk', 'Диск', 'Диск', 'Дыск', 'Dysk', 'Disco', 'Disco', 'Laufwerk'],
  ['Import from WinSCP...', 'Импорт из WinSCP...', 'Імпорт з WinSCP...', 'Імпарт з WinSCP...', 'Importuj z WinSCP...', 'Importar do WinSCP...', 'Importar de WinSCP...', 'Aus WinSCP importieren...'],
  ['Import from WinSCP', 'Импорт из WinSCP', 'Імпорт з WinSCP', 'Імпарт з WinSCP', 'Import z WinSCP', 'Importar do WinSCP', 'Importar de WinSCP', 'Import aus WinSCP'],
  ['Import', 'Импорт', 'Імпорт', 'Імпарт', 'Importuj', 'Importar', 'Importar', 'Importieren'],
  ['Choose WinSCP.ini...', 'Выбрать WinSCP.ini...', 'Вибрати WinSCP.ini...', 'Выбраць WinSCP.ini...', 'Wybierz WinSCP.ini...', 'Escolher WinSCP.ini...', 'Elegir WinSCP.ini...', 'WinSCP.ini wählen...'],
  ['Settings in Dropbox...', 'Настройки в Dropbox...', 'Налаштування в Dropbox...', 'Налады ў Dropbox...', 'Ustawienia w Dropbox...', 'Configurações no Dropbox...', 'Ajustes en Dropbox...', 'Einstellungen in Dropbox...'],
  ['Settings in Dropbox', 'Настройки в Dropbox', 'Налаштування в Dropbox', 'Налады ў Dropbox', 'Ustawienia w Dropbox', 'Configurações no Dropbox', 'Ajustes en Dropbox', 'Einstellungen in Dropbox'],
  ['Dropbox account:', 'Аккаунт Dropbox:', 'Акаунт Dropbox:', 'Акаўнт Dropbox:', 'Konto Dropbox:', 'Conta do Dropbox:', 'Cuenta de Dropbox:', 'Dropbox-Konto:'],
  ['Keep the settings in Dropbox (sync at start and after changes)', 'Хранить настройки в Dropbox (синхронизация при запуске и после изменений)', 'Зберігати налаштування в Dropbox (синхронізація при запуску і після змін)', 'Захоўваць налады ў Dropbox (сінхранізацыя пры запуску і пасля змен)', 'Przechowuj ustawienia w Dropbox (synchronizacja przy starcie i po zmianach)', 'Manter as configurações no Dropbox (sincronizar ao iniciar e após alterações)', 'Mantener los ajustes en Dropbox (sincronizar al iniciar y tras cambios)', 'Einstellungen in Dropbox halten (Sync beim Start und nach Änderungen)'],
  ['Also keep passwords, logins and SSH key files (encrypted with a passphrase)', 'Хранить и пароли, входы и файлы SSH-ключей (шифруются парольной фразой)', 'Зберігати і паролі, входи та файли SSH-ключів (шифруються парольною фразою)', 'Захоўваць і паролі, уваходы і файлы SSH-ключоў (шыфруюцца парольнай фразай)', 'Przechowuj też hasła, logowania i pliki kluczy SSH (szyfrowane frazą)', 'Manter também senhas, logins e arquivos de chave SSH (criptografados com uma frase)', 'Guardar también contraseñas, accesos y archivos de clave SSH (cifrados con una frase)', 'Auch Passwörter, Logins und SSH-Schlüsseldateien halten (mit Passphrase verschlüsselt)'],
  ['Passphrase:', 'Парольная фраза:', 'Парольна фраза:', 'Парольная фраза:', 'Fraza hasła:', 'Frase secreta:', 'Frase de contraseña:', 'Passphrase:'],
  ['Sync now', 'Синхронизировать', 'Синхронізувати', 'Сінхранізаваць', 'Synchronizuj teraz', 'Sincronizar agora', 'Sincronizar ahora', 'Jetzt synchronisieren'],
];

/** language chosen by the user (Configuration > Language...); English until a choice is made */
function i18nInitialLang() {
  try {
    const saved = JSON.parse(localStorage.getItem('lang') || 'null');
    if (saved && LANGS.some(([c]) => c === saved)) return saved;
  } catch { /* English */ }
  return 'en';
}
let LANG = i18nInitialLang();
const I18N_DICT = new Map();
if (LANG !== 'en') {
  const col = I18N_COLS.indexOf(LANG);
  if (col >= 0) for (const r of I18N_ROWS) I18N_DICT.set(r[0], r[col + 1]);
}
const I18N_WORDS = { // for the status line "n k / m k in a / b file(s), c / d dir(s)"
  ru: ['файл(ов)', 'каталог(ов)', 'в'], uk: ['файл(ів)', 'каталог(ів)', 'у'], be: ['файл(аў)', 'каталог(аў)', 'у'], pl: ['plik(ów)', 'katalog(ów)', 'w'],
  pt: ['arquivo(s)', 'diretório(s)', 'em'], es: ['archivo(s)', 'directorio(s)', 'en'], de: ['Datei(en)', 'Verz.', 'in'],
};

/** translate one visible string; strings that are not in the dictionary stay as they are */
function tr(s) {
  if (LANG === 'en' || !s) return s;
  const hit = I18N_DICT.get(s);
  if (hit !== undefined) return hit;
  const t = s.trim();
  if (t !== s) { const h = I18N_DICT.get(t); if (h !== undefined) return s.replace(t, h); }
  const m = /^([✓▼▲\s]+)(.+)$/.exec(s); // "✓  Show toolbar", "▼ Name" (the sorted column)
  if (m && I18N_DICT.has(m[2])) return m[1] + I18N_DICT.get(m[2]);
  const k = /^(.+?) (\([^()]+\))$/.exec(t); // a tooltip with its shortcut: "Reread source (Ctrl+R)"
  if (k && I18N_DICT.has(k[1])) return I18N_DICT.get(k[1]) + ' ' + k[2];
  const st = /^([\d,]+) k \/ ([\d,]+) k in (\d+) \/ (\d+) file\(s\)(?:, (\d+) \/ (\d+) dir\(s\))?$/.exec(t); // status line of a panel
  if (st && I18N_WORDS[LANG]) { const w = I18N_WORDS[LANG]; return `${st[1]} k / ${st[2]} k ${w[2]} ${st[3]} / ${st[4]} ${w[0]}${st[5] !== undefined ? `, ${st[5]} / ${st[6]} ${w[1]}` : ''}`; }
  return s;
}

// containers whose text is data (file names, paths, results) and must never be translated
const I18N_SKIP = '.list, .pathbar, .tab, .s-list, .s-row, .nm, .nas-item, .xterm, .termbox, .v-line, .v-win, .e-ta, .qvbox, .df-body, .d-doc, .d-xlsx, .d-pptx, .th-name, textarea, pre, code, .dlg-input, #cmd, #cmdprompt, .v-name, .space';
function i18nNode(n) {
  if (!n) return;
  if (n.nodeType === 3) {
    const p = n.parentElement;
    if (p && p.closest(I18N_SKIP)) return;
    const v = n.nodeValue;
    if (v && v.trim()) { const r = tr(v); if (r !== v) n.nodeValue = r; }
    return;
  }
  if (n.nodeType !== 1 || n.matches(I18N_SKIP) || n.closest(I18N_SKIP)) return;
  for (const a of ['title', 'placeholder']) { const v = n.getAttribute && n.getAttribute(a); if (v) { const r = tr(v); if (r !== v) n.setAttribute(a, r); } }
  if (n.tagName === 'OPTION' || n.tagName === 'BUTTON' || n.tagName === 'LABEL') { /* text nodes below are handled by the walk */ }
  for (const c of n.childNodes) i18nNode(c);
}

if (LANG !== 'en') {
  document.documentElement.lang = LANG;
  let busy = false;
  const mo = new MutationObserver((muts) => {
    if (busy) return;
    busy = true;
    try {
      for (const m of muts) {
        if (m.type === 'characterData') i18nNode(m.target);
        else for (const n of m.addedNodes) i18nNode(n);
      }
    } finally { busy = false; }
  });
  i18nNode(document.body);
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
}

/** Configuration > Language... */
function openLanguageDialog() {
  if (modalCount > 0) return;
  const box = document.createElement('div');
  box.className = 'dlg';
  box.innerHTML = `<div class="dlg-title">${esc(LANG === 'ru' ? 'Язык' : LANG === 'uk' ? 'Мова' : LANG === 'be' ? 'Мова' : LANG === 'pl' ? 'Język' : LANG === 'pt' || LANG === 'es' ? 'Idioma' : LANG === 'de' ? 'Sprache' : 'Language')}</div>` +
    '<div class="dlg-body"><div class="lang-list">' + LANGS.map(([c, n]) => `<label class="lang-it"><input type="radio" name="lang" value="${c}"${c === LANG ? ' checked' : ''}> ${esc(n)}</label>`).join('') + '</div></div>' +
    '<div class="dlg-btns"><button class="primary lang-ok">OK</button><button class="lang-cancel">Cancel</button></div>';
  let close;
  const done = (ok) => {
    const v = box.querySelector('input:checked');
    close();
    if (ok && v && v.value !== LANG) { store.set('lang', v.value); location.reload(); } // store.set also marks the language for the settings sync
  };
  box.querySelector('.lang-ok').onclick = () => done(true);
  box.querySelector('.lang-cancel').onclick = () => done(false);
  box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); done(true); } });
  close = openModal(box);
  box.querySelector('input:checked').focus();
}
