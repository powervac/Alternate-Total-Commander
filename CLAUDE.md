# Project notes for Claude (read this first)

Alternate Commander: an Electron two-panel file manager (Total Commander style) for Windows and macOS. Plain JavaScript, no framework, no bundler.
It was built in one long Claude Code session on Windows 11; **it has never been run on macOS** (see "macOS checklist").

## Layout

- `src/main/main.js` - Electron main process: window, all IPC (`ipcMain.handle`), file operations (copy/move with progress, delete to trash), zip (yazl/yauzl), search, sync, rename batch, Synology/SSH sessions, local streaming proxy (media), ffmpeg conversion hooks.
- `src/main/preload.js` - `contextBridge` exposes `window.api` (every IPC call; keep names in sync with main.js).
- `src/main/synology.js` - Synology DSM File Station Web API client (QuickConnect address resolving, login with 2FA, list/download/upload/mkdir/rename/delete, `openDownload` for streaming).
- `src/main/sshclient.js` - ssh2: class `Sshfs` has the **same interface as the Synology client**, so every `nas*` IPC and the remote-panel code (`panel.rem`, `rem.type` = `'nas'|'sftp'`) work for both. Plus the interactive shell.
- `src/main/cloud.js` - Dropbox and Google Drive clients (same interface again: `rem.type` `'dropbox'|'gdrive'`), OAuth with PKCE and a loopback redirect for both (Dropbox fixed port 53682, register http://127.0.0.1:53682 as Redirect URI; Google random port). App keys can ship in `src/main/oauth-defaults.json` ({"google":{"clientId","clientSecret"},"dropbox":{"appKey"}}): then the connection window shows only one sign-in button. API base URLs can be overridden with `COMMANDER_DBX_API`, `COMMANDER_DBX_CONTENT`, `COMMANDER_DBX_AUTH`, `COMMANDER_GDRIVE_API`, `COMMANDER_GOOGLE_TOKEN`, `COMMANDER_GOOGLE_AUTH`, `COMMANDER_OAUTH_PORT`, `COMMANDER_NO_BROWSER` (tests with a mock server).
- `src/main/sevenzip.js` - 7z / tar / tar.gz (tgz) / tar.bz2 / tar.xz / cab / single gz, bz2, xz archives through 7zip-bin (7za prints names in the console code page on Windows: `-sccUTF-8` is required) and RAR through node-unrar-js (extract only). Browsing is read-only like zip browsing; `unpackAll` (Alt+F9) and `pack` (Alt+F5: zip, 7z, tar, tar.gz, tar.bz2, tar.xz, gz, bz2, xz) report progress. Split / Combine (Files menu) write and read the .crc file of Total Commander.
- `src/main/docview.js` - docx/xlsx/pptx/odf -> HTML for the F3 viewer (mode "doc"), yauzl + a tiny XML parser, all text escaped; Enter on such files opens the viewer (isDocFile in app.js).
- `src/main/searchengine.js` - Alt+F7 engine (names/masks, content search in several encodings, filters, duplicates); `src/renderer/search.js` is its dialog. Directory hotlist (Ctrl+D) imports Total Commander favourites once from wincmd.ini [DirMenu] (IPC hotlist:importTC; COMMANDER_TC_INI overrides the path).
- `src/main/filetools.js` - Files menu tools (attributes, properties, space, checksums, split/combine, compare, zip test, encode/decode, descript.ion comments); dialogs in `src/renderer/filetools.js`.
- `src/main/emulator.js` + `src/renderer/emu/` - ZX Spectrum emulator (Unreal Speccy Portable, GPL-3.0) as WASM; own protocol emu://app/, host page emu/index.html defines Module.onInit/onReady; rebuilt by the build-emulator workflow. `src/main/settingsync.js` + `src/renderer/settingsync.js` - settings in Dropbox as /Commander/settings.zip (settings.json, secrets.json, keys/; optional AES-256 password via the bundled 7za, ASCII password without quotes/backslash; Retrieve / Save buttons force one direction). `src/renderer/jobqueue.js` - job queue for copy/move/pack (runJob; Background button, F2 Queue, move up/down, draggable windows). `src/main/fileindex.js` + `fileindex-worker.js` + `src/renderer/fileindex.js` - optional file name index (worker thread, gzip file in userData/file-index; Configuration > File index...); Alt+F7 uses it for name/size/date searches when the box is ticked and every folder lies inside an indexed root, otherwise the normal disk walk runs. `src/renderer/i18n.js` - interface languages (exact-match dictionary + DOM observer; lists of data are skipped).
- `src/main/transcode.js` - ffmpeg-static: probe, args, on-the-fly conversion (fragmented MP4 for video, FLAC for audio).
- `src/renderer/app.js` - the Panel class, menus, key handling, file operations UI, drive picker. Other renderer files are plain scripts sharing the global scope (load order in `index.html` matters): `search.js`, `multirename.js`, `hotlist.js`, `viewer.js`, `quickview.js`, `sync.js`, `editor.js`, `nas.js` (connection windows), `ssh.js` (xterm console), `player.js` (music), `toolbar.js`.
- Panel locations: `{dir}` local, `{arc:{file,inner}}` zip as a folder, `{rem:{id,name,type,path}}` NAS/SSH. `snap()` / `go()` / `realDir()` abstract them; `needLocal()` stops features that only work on local folders.

## Conventions and gotchas

- Everything is keyboard-first and mirrors Total Commander; Windows `Ctrl` is `Cmd` on macOS via `mod` in the key handler (some keys deliberately stay `Ctrl` on macOS, see README).
- Dialogs use `dialog()` / `openModal()` and `modalCount` (the global key handler returns while a modal is open). Overlays that handle their own keys (viewer, editor, pickers) call `modalCount++`.
- Do not store real credentials anywhere in the repo. Saved passwords are encrypted with Electron `safeStorage` in `localStorage`.
- When editing with shell heredocs, backslashes and `\n` get eaten: use the file-edit tools for code containing regexes or escapes.

## Testing without a UI

`COMMANDER_SCRIPT=<js file> COMMANDER_SHOT=<png> npx electron .` runs a script inside the page (`window.__commander` gives the panels), prints the renderer console to stdout, saves a screenshot and quits. Do not pipe the output into `Select-Object -First N` (it kills Electron before the screenshot is written). `COMMANDER_KNOWN_HOSTS=<file>` points the SSH trusted-hosts store elsewhere (use it in tests; never overwrite a user's real one).
The test runs open a visible window and share the real app's `localStorage`: clean up anything a test saved (saved connections, tabs, hotlist).
The Synology and SSH code was developed against small local mock servers (a fake File Station API and an `ssh2` server); the owner then confirmed it works with a real Synology NAS (QuickConnect) and a real SSH server on Windows.

## Release (download site total.gieldowa.keenetic.link)

The only download site is **https://altcom.cc** (the VPS 31.3.218.19, ssh port 2022, user oleg, key ~/.ssh/id_nem68; nginx in the docker container autocrash-web-1, config /etc/nginx-extra-sites/altcom.cc.conf, certificate by certbot with the renewal hook that reloads the container). Its web root is /var/www/certbot-webroot/total-mirror; `npm run release` uploads straight there (`downloads/`, `latest.json`). The old names nem68.duckdns.org (the same site, older programs ask it) and total.gieldowa.keenetic.link (the old upload site, no longer updated) are not used by the program any more. install-mac.sh on the server holds the real mac key (do not overwrite it with tools/install-mac.sh: that one has the @MACKEY@ placeholder). The ready-made app keys are served at /cfg-f43948e43a892dd3.json (an exact location in the nginx config). The product is called "Alternate Commander" on the site and in the program; file names (Alternate-Total-Commander-*), the GitHub repository and the app data folder (Commander) keep their old names.

One command does everything: `npm run release` (the next version is chosen by itself: 0.1.912 -> 0.1.913; the notes come from the commits, or give them: `npm run release -- "what is new"`; a version can be given too, `minor` makes 0.2.0, a version that is not newer becomes the next one). Without a platform flag it asks what to build (Windows / macOS / both); `--win-only` (`--no-mac`), `--mac-only` (`--no-win`), `--both` skip the question; `--dry-run` shows the steps. latest.json keeps a version per platform (`winPortable.version`, `mac.version`) so that a one-platform release does not make the other platform look for an update. `tools/release.js` bumps the version, commits and pushes, starts the "Build macOS" workflow on GitHub, builds the Windows installer and the portable exe into `dist-release/`, waits for the Mac build and downloads the dmg files, uploads everything to ~/total-site/downloads on the server as `.part` files (sha256 checked on the server, then renamed), and writes `latest.json` last ({version, notes, win, winPortable} with sha256 and size). Needs git with push rights, `gh` signed in, OpenSSH and the deploy key (env RELEASE_KEY, default H:/boosty/web/.deploy/id_gieldowa; RELEASE_HOST / RELEASE_PORT / RELEASE_DIR / RELEASE_URL override the rest). Close a running copy of the app from `dist-release/win-unpacked` before building. The dmg files are served only to curl with the key in tools/install-mac.sh (see tools/site-serve.py); the key itself lives only on the server. The program checks latest.json at start and offers the update (Configuration > Check for Updates; COMMANDER_UPDATE_URL overrides the address in tests); the portable exe replaces itself.

## macOS checklist (nothing here is verified yet)

1. `npm install && npm start` - does the window open, do the toolbar icons and fonts look right?
2. Keys: F-keys need Fn; `Cmd+A` (select all in a panel; the Edit menu's Select All has `registerAccelerator:false` for this), `Cmd+W` (close tab; the Window menu has no Close item), `Cmd+M` is multi-rename (Minimize has no accelerator), `Cmd+Q` quits, quick view is `Ctrl+Q`, player play/pause is `Option+Space`.
3. Drive list (Alt+F1/F2): `/`, home, `/Volumes/*`, standard folders; mounted network shares appear under `/Volumes`.
4. SSH console, NAS panel, ffmpeg conversion (ffmpeg-static downloads the darwin binary at install), safeStorage (Keychain prompt on first save).
5. `npm run dist:mac` on a Mac: icon, dmg, Gatekeeper (unsigned: `xattr -cr`), permission prompts for Documents/Downloads/Desktop.

## Ideas not done yet

Copy between two archives, archive integrity test, 7z/rar/tar, sync with deletions, `ssh-agent` login, SSH tunnels, Windows/macOS notarized builds.
