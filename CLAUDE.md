# Project notes for Claude (read this first)

Alternate Total Commander: an Electron two-panel file manager (Total Commander style) for Windows and macOS. Plain JavaScript, no framework, no bundler.
It was built in one long Claude Code session on Windows 11; **it has never been run on macOS** (see "macOS checklist").

## Layout

- `src/main/main.js` - Electron main process: window, all IPC (`ipcMain.handle`), file operations (copy/move with progress, delete to trash), zip (yazl/yauzl), search, sync, rename batch, Synology/SSH sessions, local streaming proxy (media), ffmpeg conversion hooks.
- `src/main/preload.js` - `contextBridge` exposes `window.api` (every IPC call; keep names in sync with main.js).
- `src/main/synology.js` - Synology DSM File Station Web API client (QuickConnect address resolving, login with 2FA, list/download/upload/mkdir/rename/delete, `openDownload` for streaming).
- `src/main/sshclient.js` - ssh2: class `Sshfs` has the **same interface as the Synology client**, so every `nas*` IPC and the remote-panel code (`panel.rem`, `rem.type` = `'nas'|'sftp'`) work for both. Plus the interactive shell.
- `src/main/cloud.js` - Dropbox and Google Drive clients (same interface again: `rem.type` `'dropbox'|'gdrive'`), OAuth with PKCE and a loopback redirect for both (Dropbox fixed port 53682, register http://127.0.0.1:53682 as Redirect URI; Google random port). App keys can ship in `src/main/oauth-defaults.json` ({"google":{"clientId","clientSecret"},"dropbox":{"appKey"}}): then the connection window shows only one sign-in button. API base URLs can be overridden with `COMMANDER_DBX_API`, `COMMANDER_DBX_CONTENT`, `COMMANDER_DBX_AUTH`, `COMMANDER_GDRIVE_API`, `COMMANDER_GOOGLE_TOKEN`, `COMMANDER_GOOGLE_AUTH`, `COMMANDER_OAUTH_PORT`, `COMMANDER_NO_BROWSER` (tests with a mock server).
- `src/main/sevenzip.js` - read-only 7z/tar/cab browsing through 7zip-bin (7za prints names in the console code page on Windows: `-sccUTF-8` is required).
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

## macOS checklist (nothing here is verified yet)

1. `npm install && npm start` - does the window open, do the toolbar icons and fonts look right?
2. Keys: F-keys need Fn; `Cmd+A` (select all in a panel; the Edit menu's Select All has `registerAccelerator:false` for this), `Cmd+W` (close tab; the Window menu has no Close item), `Cmd+M` is multi-rename (Minimize has no accelerator), `Cmd+Q` quits, quick view is `Ctrl+Q`, player play/pause is `Option+Space`.
3. Drive list (Alt+F1/F2): `/`, home, `/Volumes/*`, standard folders; mounted network shares appear under `/Volumes`.
4. SSH console, NAS panel, ffmpeg conversion (ffmpeg-static downloads the darwin binary at install), safeStorage (Keychain prompt on first save).
5. `npm run dist:mac` on a Mac: icon, dmg, Gatekeeper (unsigned: `xattr -cr`), permission prompts for Documents/Downloads/Desktop.

## Ideas not done yet

Copy between two archives, archive integrity test, 7z/rar/tar, sync with deletions, `ssh-agent` login, SSH tunnels, Windows/macOS notarized builds.
