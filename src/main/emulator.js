'use strict';
// ZX Spectrum emulator window: Unreal Speccy Portable (GPL-3.0) compiled to WebAssembly, files in src/renderer/emu/.
// It runs from its own protocol emu://app/ (a WebAssembly page cannot be loaded from file://). A game / disk / tape is handed to it
// through emu://app/files/<id>/<name>, which the program's exported OpenFile() downloads and starts (.trd .scl .tap .tzx .z80 .sna ...).
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const EMU_DIR = path.join(__dirname, '..', 'renderer', 'emu');
const MAIN_PAGE = 'index.html'; // our host page; it loads unreal_speccy_portable.js / .wasm / .data
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png' };

const files = new Map(); // id -> absolute path of a file given to the emulator
let win = null;

/** must run before the app is ready */
function registerScheme(protocol) {
  protocol.registerSchemesAsPrivileged([{ scheme: 'emu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
}

function handleProtocol(protocol) {
  protocol.handle('emu', async (req) => {
    try {
      const u = new URL(req.url);
      const p = decodeURIComponent(u.pathname);
      if (p.startsWith('/files/')) {
        const id = p.split('/')[2];
        const f = files.get(id);
        if (!f) return new Response('not found', { status: 404 });
        return new Response(await fsp.readFile(f), { headers: { 'content-type': 'application/octet-stream' } });
      }
      const rel = p === '/' ? '/' + MAIN_PAGE : p;
      const full = path.normalize(path.join(EMU_DIR, rel));
      if (!full.startsWith(EMU_DIR + path.sep)) return new Response('forbidden', { status: 403 });
      const data = await fsp.readFile(full);
      return new Response(data, { headers: { 'content-type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream' } });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
}

const available = () => fs.existsSync(path.join(EMU_DIR, MAIN_PAGE));

/** wait until the emulator program runs, then give it the file */
async function startFile(w, url) {
  for (let i = 0; i < 60 && !w.isDestroyed(); i++) {
    let ready = false;
    try { ready = await w.webContents.executeJavaScript('window.__emuReady === true'); } catch { /* page not ready */ } // set by Module.onReady() of the host page
    if (ready) {
      if (w.isDestroyed()) return false;
      await w.webContents.executeJavaScript(`window.openInEmulator(${JSON.stringify(url)})`);
      if (process.env.COMMANDER_EMU_SHOT) { // test helper: screenshot of the emulator window a few seconds after the file started
        await new Promise((r) => setTimeout(r, 5000));
        const img = await w.webContents.capturePage();
        fs.writeFileSync(process.env.COMMANDER_EMU_SHOT, img.toPNG());
        console.log('[emu] shot saved');
      }
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function open(file, BrowserWindow) {
  if (!available()) return { error: 'The ZX Spectrum emulator is not part of this build.' };
  const st = await fsp.stat(file);
  if (!st.isFile()) return { error: 'Not a file' };
  const id = crypto.randomBytes(6).toString('hex');
  files.set(id, file);
  const safe = path.basename(file).replace(/[^A-Za-z0-9._-]/g, '_') || 'file';
  const url = `emu://app/files/${id}/${safe}`;
  if (win && !win.isDestroyed()) {
    win.setTitle('ZX Spectrum - ' + path.basename(file));
    win.focus();
    await win.webContents.executeJavaScript(`window.openInEmulator(${JSON.stringify(url)})`);
    return { ok: true };
  }
  win = new BrowserWindow({ width: 1040, height: 800, title: 'ZX Spectrum - ' + path.basename(file), backgroundColor: '#000000', autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true } });
  win.setMenuBarVisibility(false);
  win.on('page-title-updated', (e) => e.preventDefault());
  win.on('closed', () => { win = null; files.clear(); });
  const w = win;
  if (process.env.COMMANDER_EMU_SHOT) {
    w.webContents.on('console-message', (_e, _l, m) => console.log('[emu page]', String(m).slice(0, 200)));
    w.webContents.on('did-fail-load', (_e, code, desc, u) => console.log('[emu] load failed', code, desc, u));
  }
  w.loadURL('emu://app/');
  w.webContents.once('did-finish-load', () => { startFile(w, url); });
  return { ok: true };
}

module.exports = { registerScheme, handleProtocol, open, available };
