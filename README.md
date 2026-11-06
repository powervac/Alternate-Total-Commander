# Alternate Total Commander

An **unofficial**, open-source two-panel file manager in the style of Total Commander, for **Windows and macOS**
(built with Electron). It is a personal project and is **not affiliated with, endorsed by or connected to Total Commander / Ghisler Software**.

> **Status:** developed and tested on Windows 11. macOS support is prepared (key mapping, packaging, drive list) but **has not been tested on a Mac yet** - bug reports are welcome.

*Кратко по-русски:* двухпанельный файловый менеджер в духе Total Commander для Windows и macOS: zip как папка, Synology NAS (QuickConnect), SSH-консоль + SFTP, просмотр (текст, hex, картинки, PDF, видео, аудио), редактор, музыкальный плеер, поиск, синхронизация папок, вкладки, групповое переименование. Запуск: `npm install`, затем `npm start` (Windows: `start.bat`, macOS: `./start-mac.command`).

## Features

- **Two panels**, tabs per panel, history, drive list with network drives and standard folders (Alt+F1 / Alt+F2), directory hotlist, quick view panel, toolbar.
- **File operations** with progress and cancel: copy, move, rename, new folder, delete (to the Recycle Bin / Trash), multi-rename tool, compare and synchronize folders, search (names, text in files, names inside zip).
- **Archives:** pack and unpack zip; open a zip like a folder and edit it in place (add, delete, rename, new folder). A zip on a NAS / SSH server opens as a read-only folder (it is downloaded to a temporary copy; files can be copied out of it).
- **Synology NAS** (File Station API, works through **QuickConnect**): browse, copy both ways, create, rename, delete, view/edit, stream video and music.
- **Dropbox and Google Drive** as remote disks (Net menu > Dropbox... / Google Drive..., also in the Alt+F1 / Alt+F2 list): browse, copy both ways, create, rename, delete, view/edit, stream video and music. They use the official APIs with OAuth sign-in in your browser, so **no desktop client is needed**. You create your own free API app once (see "Cloud drives" below).
- **SSH servers** (password or key file): the panel shows an interactive **console** (xterm.js); files copied (F5) or dropped into the console are uploaded to the console's current folder. Ctrl+O switches to an SFTP file list.
- **Viewer (F3):** text with automatic encoding detection (UTF-8/16, Windows-1251, CP866...), hex, images, PDF, video and audio. Formats Chromium cannot play (HEVC, AVI, WMV, AC3 sound, APE, WavPack, ALAC, AIFF...) are converted on the fly by a bundled **ffmpeg**.
- **Editor (F4):** keeps encoding, BOM and line endings; find/replace; works on files inside zip archives and on a NAS / SSH server.
- **Music player:** Enter on an audio file plays the folder in the background (mp3, FLAC, WAV, OGG, AAC; lossless formats through ffmpeg), media keys supported.

## Run

Requirements: [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm start
```

- Windows: double-click `start.bat`.
- macOS: `./start-mac.command` (run `chmod +x start-mac.command` once) or `npm start`.

## Build installers

```bash
npm run pack        # unpacked app in dist/ (quick check)
npm run dist:win    # Windows installer (run on Windows)
npm run dist:mac    # .dmg + .zip for Apple Silicon and Intel (run on a Mac)
```

macOS builds must be made on a Mac. The app is not signed or notarized: if macOS says it is damaged or from an unidentified developer, right-click > Open, or run `xattr -cr /Applications/Commander.app`.
The first time the app reads Documents, Downloads or Desktop, macOS asks for permission.

## Keyboard (Windows | macOS)

`Ctrl` becomes `Cmd` and `Alt` becomes `Option` on macOS, except where noted.

| Keys | Action |
|---|---|
| Tab | switch panel |
| Enter / Backspace | open / go up |
| Space, Insert | select and move down |
| Num +, Num -, Num *, Ctrl+A | select group, unselect group, invert, select all |
| F3 / F4 / Shift+F4 | view / edit / edit new file |
| F5 / F6 / Shift+F6 | copy / move / rename |
| F7 / F8 (Shift+F8) | new folder / delete (permanently) |
| Alt+F1 / Alt+F2 | drive list of the left / right panel |
| Alt+F5 / Alt+F9 | pack / unpack |
| Alt+F7 | find files |
| Shift+F2 | compare folders |
| Ctrl+R / Ctrl+U | reread / swap panels |
| Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+Up | new tab, close tab, next tab, open folder in new tab |
| Ctrl+Q (Ctrl on macOS too) | quick view panel |
| Ctrl+D | directory hotlist |
| Ctrl+M | multi-rename |
| Ctrl+F / Ctrl+Shift+F | Synology NAS / SSH server connections |
| Ctrl+O | SSH panel: console <-> file list |
| Ctrl+Space (macOS: Option+Space), Ctrl+Shift+Left/Right | music player: play/pause, previous/next track |

**macOS notes:** the F-keys need `Fn` (or enable "Use F1, F2, etc. keys as standard function keys" in System Settings > Keyboard); the buttons at the bottom of the window and the menus do the same. Mac keyboards have no Insert or numeric keypad: use Space and the Mark menu.

## Cloud drives (Dropbox, Google Drive)

Dropbox and Google require every program to identify itself with its own API key. Builds that contain the key (file `src/main/oauth-defaults.json`, format: `{"google":{"clientId":"...","clientSecret":"..."},"dropbox":{"appKey":"..."}}`) show just one button: *Sign in with Google* / *Sign in with Dropbox*. Without it, create your own key once (free); the window shows the steps. The key is remembered for all accounts.

**Dropbox:** [App Console](https://www.dropbox.com/developers/apps) > Create app > Scoped access > Full Dropbox. Permissions: `files.metadata.read`, `files.metadata.write`, `files.content.read`, `files.content.write` > Submit. Copy the **App key** into Net > Dropbox..., add the Redirect URI `http://127.0.0.1:53682` (Settings tab), press *Sign in with Dropbox* and approve in the browser.

**Google Drive:** [Cloud Console](https://console.cloud.google.com/apis/credentials): create a project, enable the *Google Drive API*, configure the OAuth consent screen (External; add yourself as a test user, or press *Publish app* so the login does not expire after 7 days), then Credentials > OAuth client ID > *Desktop app*. Copy the **Client ID** and **Client secret** into Net > Google Drive... and press *Connect*; the browser opens and you approve.

Notes: only a refresh token is stored (encrypted with the system keychain, optional "Stay signed in"); your files never pass through any server except Dropbox / Google. Google documents (Docs, Sheets, Slides) appear with an extra `.docx` / `.xlsx` / `.pptx` and are exported when copied. Deleting in Dropbox goes to its deleted files, in Google Drive to the Trash.

## Security notes

- Saved passwords are optional and encrypted with the operating system (Windows DPAPI / macOS Keychain, Electron `safeStorage`). Nothing is sent anywhere except to the server you connect to.
- SSH uses trust-on-first-use host keys (stored in the app data folder); a changed key is reported.
- The local streaming proxy used for NAS media listens only on `127.0.0.1` and requires a random per-run token.

## Third-party software

[Electron](https://www.electronjs.org), [ssh2](https://github.com/mscdex/ssh2), [xterm.js](https://xtermjs.org), [yauzl](https://github.com/thejoshwolfe/yauzl) / [yazl](https://github.com/thejoshwolfe/yazl), and [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) (downloads an FFmpeg build at install time; FFmpeg is LGPL/GPL, see its license). No FFmpeg binary is stored in this repository.

## License

MIT, see [LICENSE](LICENSE).
