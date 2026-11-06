const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const { spawn } = require('child_process');
const sevenzip = require('./sevenzip');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 700,
    minHeight: 400,
    backgroundColor: '#ffffff',
    title: 'Commander',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'), // window icon (Windows/Linux); macOS uses the app bundle icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });
  win.webContents.on('console-message', (_e, lvl, m, l, src) => console.log('[renderer]', m, src + ':' + l));
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // dev helpers: COMMANDER_SHOT=<png path> takes a screenshot and quits;
  // COMMANDER_SCRIPT=<js file> is executed in the page before the shot.
  if (process.env.COMMANDER_SHOT) {
    win.webContents.on('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 1200));
      if (process.env.COMMANDER_SCRIPT) {
        try {
          await win.webContents.executeJavaScript(fs.readFileSync(process.env.COMMANDER_SCRIPT, 'utf8'));
        } catch (e) {
          console.error('script error', e);
        }
        await new Promise((r) => setTimeout(r, 800));
      }
      win.show(); win.focus(); await new Promise((r) => setTimeout(r, 500));
      const img = await win.webContents.capturePage();
      console.log('captured', img.getSize());
      fs.writeFileSync(process.env.COMMANDER_SHOT, img.toPNG());
      app.quit();
    });
  }
  if (process.env.COMMANDER_DEV) win.webContents.openDevTools({ mode: 'detach' });
}

// a stray network error (SSH, NAS, ffmpeg pipes ...) must never pop up Electron's "JavaScript error in the main process" box
process.on('uncaughtException', (err) => {
  console.error('[main] uncaught exception:', err && err.stack ? err.stack : err);
});

app.whenReady().then(() => {
  // running from source on a Mac: show our icon in the Dock instead of the Electron one
  if (isMac && app.dock && !app.isPackaged) {
    try { app.dock.setIcon(path.join(__dirname, '..', '..', 'build', 'icon.png')); } catch { /* no icon: fine */ }
  }
  if (isMac) {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu' },
      {
        // the standard Edit menu, but Select All must not grab Cmd+A: in the file panels it selects all files
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'delete' },
          { role: 'selectAll', registerAccelerator: false },
        ],
      },
      // no "Close" item here: Cmd+W must reach the page (close tab)
      // minimize without Cmd+M: that key opens Multi-Rename
      { label: 'Window', submenu: [{ label: 'Minimize', click: () => win && win.minimize() }, { role: 'zoom' }] },
    ]));
  } else {
    Menu.setApplicationMenu(null);
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

// ---------------------------------------------------------------- helpers

const fold = (p) => (isWin || isMac ? path.resolve(p).toLowerCase() : path.resolve(p));
const samePath = (a, b) => fold(a) === fold(b);
function isInside(child, parent) {
  const rel = path.relative(fold(parent), fold(child));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
async function exists(p) {
  try {
    await fsp.lstat(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- listing

ipcMain.handle('fs:list', async (_e, dir) => {
  try {
    const dirents = await fsp.readdir(dir, { withFileTypes: true });
    const items = (
      await Promise.all(
        dirents.map(async (d) => {
          const full = path.join(dir, d.name);
          try {
            const st = await fsp.stat(full);
            return {
              name: d.name,
              isDir: st.isDirectory(),
              size: st.isDirectory() ? -1 : st.size,
              mtime: st.mtimeMs,
              ro: !(st.mode & 0o200),
              hidden: d.name.startsWith('.'),
              link: d.isSymbolicLink(),
            };
          } catch {
            try {
              const st = await fsp.lstat(full); // broken symlink etc.
              return { name: d.name, isDir: false, size: st.size, mtime: st.mtimeMs, ro: false, hidden: d.name.startsWith('.'), link: true };
            } catch {
              return null;
            }
          }
        })
      )
    ).filter(Boolean);
    return { dir: path.resolve(dir), items };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('fs:space', async (_e, dir) => {
  try {
    const s = await fsp.statfs(dir);
    return { free: s.bavail * s.bsize, total: s.blocks * s.bsize };
  } catch {
    return null;
  }
});

ipcMain.handle('fs:stat', async (_e, p) => {
  try {
    const st = await fsp.stat(p);
    return { exists: true, isDir: st.isDirectory() };
  } catch {
    return { exists: false, isDir: false };
  }
});

/** standard user folders for the drive list (Alt+F1 / Alt+F2) */
ipcMain.handle('places:list', async () => {
  const out = [];
  const add = (label, p) => {
    try {
      if (p && fs.existsSync(p)) out.push({ label, path: p });
    } catch {}
  };
  add('Home', os.homedir());
  for (const [label, key] of [['Desktop', 'desktop'], ['Documents', 'documents'], ['Downloads', 'downloads'], ['Pictures', 'pictures'], ['Music', 'music'], ['Videos', 'videos']]) {
    try {
      add(label, app.getPath(key));
    } catch {}
  }
  return out;
});

/** mapped network drives (also the disconnected ones): letter -> \\server\share, from `net use` */
function netUseMap() {
  return new Promise((resolve) => {
    require('child_process').execFile('net', ['use'], { timeout: 5000, windowsHide: true, encoding: 'buffer' }, (err, stdout) => {
      const map = new Map();
      if (!err && stdout) {
        for (const line of stdout.toString('latin1').split(/\r?\n/)) {
          const m = /\b([A-Za-z]):\s+(\\\\\S+)/.exec(line);
          if (m) map.set(m[1].toUpperCase(), m[2]);
        }
      }
      resolve(map);
    });
  });
}

ipcMain.handle('drives:list', async () => {
  if (isWin) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const net = await netUseMap();
    // a dead network drive can make access() hang for a long time: give each drive 2 seconds
    const probe = (root) => Promise.race([fsp.access(root).then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), 2000))]);
    const found = await Promise.all(
      letters.map(async (l) => {
        const root = l + ':\\';
        const unc = net.get(l) || '';
        const ok = await probe(root);
        if (!ok && !unc) return null; // not there at all
        return { path: root, label: l.toLowerCase(), net: unc, off: !ok };
      })
    );
    return found.filter(Boolean);
  }
  const out = [{ path: '/', label: '/' }, { path: os.homedir(), label: '~' }];
  try {
    for (const v of await fsp.readdir('/Volumes')) out.push({ path: path.join('/Volumes', v), label: v });
  } catch {}
  return out;
});

const iconCache = new Map();
ipcMain.handle('icon:get', async (_e, p) => {
  try {
    const img = await app.getFileIcon(p, { size: 'small' });
    return img.toDataURL();
  } catch {
    return null;
  }
});

// ---------------------------------------------------------------- operations

const jobs = new Map(); // id -> ctx

async function planCopy(src, target, tasks, ctx) {
  const st = await fsp.lstat(src);
  if (st.isSymbolicLink()) {
    tasks.push({ t: 'link', src, target });
  } else if (st.isDirectory()) {
    tasks.push({ t: 'dir', src, target });
    for (const n of await fsp.readdir(src)) await planCopy(path.join(src, n), path.join(target, n), tasks, ctx);
  } else {
    tasks.push({ t: 'file', src, target, size: st.size, mtime: st.mtime, mode: st.mode });
    ctx.total += st.size;
  }
}

async function copyFileWithProgress(t, ctx) {
  const rd = await fsp.open(t.src, 'r');
  let wr;
  try {
    wr = await fsp.open(t.target, 'w');
    const buf = Buffer.allocUnsafe(1 << 20);
    let pos = 0;
    for (;;) {
      if (ctx.cancel) break;
      const { bytesRead } = await rd.read(buf, 0, buf.length, pos);
      if (!bytesRead) break;
      await wr.write(buf, 0, bytesRead);
      pos += bytesRead;
      ctx.done += bytesRead;
      ctx.current = t.src;
      ctx.tick();
    }
  } finally {
    await rd.close();
    if (wr) await wr.close();
  }
  if (ctx.cancel) {
    await fsp.rm(t.target, { force: true });
    return;
  }
  try {
    await fsp.utimes(t.target, t.mtime, t.mtime);
    await fsp.chmod(t.target, t.mode & 0o7777);
  } catch {}
}

async function execTasks(tasks, ctx, overwrite) {
  for (const t of tasks) {
    if (ctx.cancel) break;
    try {
      if (t.t === 'dir') {
        await fsp.mkdir(t.target, { recursive: true });
      } else if (samePath(t.src, t.target)) {
        throw new Error('source and target are the same');
      } else if (t.t === 'link') {
        if (await exists(t.target)) {
          if (overwrite !== 'all') {
            ctx.skipped++;
            continue;
          }
          await fsp.rm(t.target, { force: true });
        }
        await fsp.symlink(await fsp.readlink(t.src), t.target);
      } else {
        if (await exists(t.target)) {
          if (overwrite !== 'all') {
            ctx.skipped++;
            ctx.done += t.size;
            continue;
          }
        }
        await copyFileWithProgress(t, ctx);
      }
    } catch (err) {
      ctx.errors.push(`${t.src}: ${err.message}`);
    }
  }
}

const targetOf = (src, destDir, rename) => path.join(destDir, rename || path.basename(src));

ipcMain.handle('op:conflicts', async (_e, { sources, destDir, rename }) => {
  const out = [];
  for (const s of sources) {
    const t = targetOf(s, destDir, sources.length === 1 ? rename : null);
    if (await exists(t)) out.push(path.basename(t));
  }
  return out;
});

ipcMain.handle('op:run', async (e, { id, kind, sources, destDir, rename, overwrite }) => {
  const ctx = { cancel: false, done: 0, total: 0, current: '', errors: [], skipped: 0, last: 0 };
  ctx.tick = (force) => {
    const now = Date.now();
    if (!force && now - ctx.last < 80) return;
    ctx.last = now;
    e.sender.send('op:progress', { id, done: ctx.done, total: ctx.total, current: path.basename(ctx.current || '') });
  };
  jobs.set(id, ctx);
  try {
    await fsp.mkdir(destDir, { recursive: true });
    const work = [];
    for (const src of sources) {
      const target = targetOf(src, destDir, sources.length === 1 ? rename : null);
      if (samePath(src, target)) {
        ctx.errors.push(`${src}: source and target are the same`);
        continue;
      }
      if (isInside(target, src)) {
        ctx.errors.push(`${src}: cannot copy a directory into itself`);
        continue;
      }
      if (kind === 'move' && !(await exists(target))) {
        try {
          await fsp.rename(src, target);
          continue;
        } catch {
          /* different volume etc. -> copy + delete */
        }
      }
      const tasks = [];
      try {
        await planCopy(src, target, tasks, ctx);
      } catch (err) {
        ctx.errors.push(`${src}: ${err.message}`);
        continue;
      }
      work.push({ src, tasks });
    }
    for (const w of work) {
      if (ctx.cancel) break;
      const errBefore = ctx.errors.length;
      const skipBefore = ctx.skipped;
      await execTasks(w.tasks, ctx, overwrite);
      if (kind === 'move' && !ctx.cancel && ctx.errors.length === errBefore && ctx.skipped === skipBefore) {
        try {
          await fsp.rm(w.src, { recursive: true, force: true });
        } catch (err) {
          ctx.errors.push(`${w.src}: ${err.message}`);
        }
      }
    }
    ctx.tick(true);
    return { errors: ctx.errors, cancelled: ctx.cancel, skipped: ctx.skipped };
  } catch (err) {
    return { errors: [err.message], cancelled: false, skipped: 0 };
  } finally {
    jobs.delete(id);
  }
});

ipcMain.handle('op:cancel', (_e, id) => {
  const c = jobs.get(id);
  if (c) {
    c.cancel = true;
    if (c.abort) c.abort();
  }
});

// ---------------------------------------------------------------- zip

const yazl = require('yazl');
const yauzl = require('yauzl');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

function mkCtx(e, id) {
  const ctx = { cancel: false, done: 0, total: 0, current: '', errors: [], skipped: 0, last: 0, abort: null };
  ctx.tick = (force) => {
    const now = Date.now();
    if (!force && now - ctx.last < 80) return;
    ctx.last = now;
    e.sender.send('op:progress', { id, done: ctx.done, total: ctx.total, current: path.basename(ctx.current || '') });
  };
  return ctx;
}

/** Readable that opens the file only when yazl actually starts reading it (avoids EMFILE on big trees). */
class LazyFile extends Readable {
  constructor(p, onBytes, onError) {
    super();
    this.p = p;
    this.onBytes = onBytes;
    this.onError = onError;
    this.rs = null;
  }
  _read() {
    if (!this.rs) {
      const rs = (this.rs = fs.createReadStream(this.p));
      rs.on('data', (c) => {
        this.onBytes(c.length);
        if (!this.push(c)) rs.pause();
      });
      rs.on('end', () => this.push(null));
      rs.on('error', (err) => this.onError(this.p, err));
    } else {
      this.rs.resume();
    }
  }
  _destroy(err, cb) {
    if (this.rs) this.rs.destroy();
    cb(err);
  }
}

async function walkPack(abs, rel, out, ctx, skip) {
  if (skip(abs)) return;
  const st = await fsp.lstat(abs);
  if (st.isSymbolicLink()) return;
  if (st.isDirectory()) {
    out.push({ dir: true, rel, mtime: st.mtime, mode: st.mode });
    for (const n of await fsp.readdir(abs)) await walkPack(path.join(abs, n), rel + '/' + n, out, ctx, skip);
  } else if (st.isFile()) {
    out.push({ abs, rel, mtime: st.mtime, mode: st.mode });
    ctx.total += st.size;
  }
}

ipcMain.handle('zip:pack', async (e, { id, sources, archive }) => {
  const ctx = mkCtx(e, id);
  jobs.set(id, ctx);
  const tmp = archive + '.part';
  try {
    await fsp.mkdir(path.dirname(archive), { recursive: true });
    const skip = (p) => samePath(p, archive) || samePath(p, tmp);
    const entries = [];
    for (const s of sources) await walkPack(s, path.basename(s), entries, ctx, skip);

    const zip = new yazl.ZipFile();
    const out = fs.createWriteStream(tmp);
    const finished = new Promise((res, rej) => {
      out.on('close', res);
      out.on('error', rej);
      zip.outputStream.on('error', rej);
    });
    ctx.abort = () => {
      zip.outputStream.unpipe(out);
      out.destroy();
    };
    zip.outputStream.pipe(out);
    const onBytes = (n) => {
      ctx.done += n;
      ctx.tick();
    };
    const onError = (p, err) => {
      ctx.errors.push(`${p}: ${err.message}`);
      ctx.abort();
    };
    for (const en of entries) {
      if (en.dir) zip.addEmptyDirectory(en.rel, { mtime: en.mtime, mode: en.mode });
      else {
        const lf = new LazyFile(en.abs, (n) => { ctx.current = en.abs; onBytes(n); }, onError);
        zip.addReadStream(lf, en.rel, { mtime: en.mtime, mode: en.mode });
      }
    }
    zip.end();
    await finished;
    if (ctx.cancel || ctx.errors.length) {
      await fsp.rm(tmp, { force: true });
      return { cancelled: ctx.cancel, errors: ctx.errors };
    }
    await fsp.rename(tmp, archive);
    ctx.tick(true);
    return { errors: [] };
  } catch (err) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    return { errors: [err.message] };
  } finally {
    jobs.delete(id);
  }
});

/** Readable that opens an entry of an existing zip only when it is actually read. */
class LazyEntry extends Readable {
  constructor(z, en, onBytes, onError) {
    super();
    this.z = z;
    this.en = en;
    this.onBytes = onBytes;
    this.onError = onError;
    this.started = false;
    this.rs = null;
  }
  _read() {
    if (!this.started) {
      this.started = true;
      this.z.openReadStream(this.en, (err, rs) => {
        if (err) return this.onError(this.en.fileName, err);
        this.rs = rs;
        rs.on('data', (c) => {
          this.onBytes(c.length);
          if (!this.push(c)) rs.pause();
        });
        rs.on('end', () => this.push(null));
        rs.on('error', (e2) => this.onError(this.en.fileName, e2));
      });
    } else if (this.rs) {
      this.rs.resume();
    }
  }
  _destroy(err, cb) {
    if (this.rs) this.rs.destroy();
    cb(err);
  }
}

const normName = (n) => n.replace(/\\/g, '/').replace(/\/+$/, '');

/**
 * Rewrite an existing zip: drop / rename / add entries. The result is built in archive.part and
 * moved over the original only when everything succeeded.
 *   add:    [{ abs, rel }]  files or folders from disk, stored under the zip path rel
 *   remove: [name]          zip paths (files, or folders with everything inside)
 *   rename: { from, to }    zip path prefix rename
 *   mkdirs: [name]          empty folders to create
 */
ipcMain.handle('zip:modify', async (e, { id, archive, add = [], remove = [], rename = null, mkdirs = [] }) => {
  const ctx = mkCtx(e, id);
  jobs.set(id, ctx);
  const tmp = archive + '.part';
  let z;
  try {
    const r = await listZip(archive);
    z = r.z;
    const skip = (p) => samePath(p, archive) || samePath(p, tmp);
    const added = [];
    for (const a of add) await walkPack(a.abs, a.rel, added, ctx, skip);
    const addedNames = new Set(added.map((a) => normName(a.rel)));
    const removed = (n) => remove.some((x) => n === x || n.startsWith(x + '/'));

    const keep = [];
    for (const en of r.entries) {
      let name = normName(en.fileName);
      if (!name || removed(name)) continue;
      if (rename && (name === rename.from || name.startsWith(rename.from + '/'))) name = rename.to + name.slice(rename.from.length);
      if (addedNames.has(name)) continue; // replaced by a new version
      if (!isDirEntry(en) && en.isEncrypted()) throw new Error('archive contains encrypted entries');
      keep.push({ en, name });
      if (!isDirEntry(en)) ctx.total += en.uncompressedSize;
    }

    const zip = new yazl.ZipFile();
    const out = fs.createWriteStream(tmp);
    const finished = new Promise((res, rej) => {
      out.on('close', res);
      out.on('error', rej);
      zip.outputStream.on('error', rej);
    });
    ctx.abort = () => {
      zip.outputStream.unpipe(out);
      out.destroy();
    };
    zip.outputStream.pipe(out);
    const onBytes = (n) => {
      ctx.done += n;
      ctx.tick();
    };
    const onError = (p, err) => {
      ctx.errors.push(p + ': ' + err.message);
      ctx.abort();
    };
    const seen = new Set();
    const addDir = (name, o) => {
      if (seen.has(name)) return;
      seen.add(name);
      zip.addEmptyDirectory(name, o);
    };
    for (const { en, name } of keep) {
      const mode = (en.externalFileAttributes >>> 16) & 0xffff;
      const o = { mtime: en.getLastModDate() };
      if (mode) o.mode = mode;
      if (isDirEntry(en)) addDir(name, o);
      else {
        seen.add(name);
        zip.addReadStream(new LazyEntry(z, en, (n) => { ctx.current = en.fileName; onBytes(n); }, onError), name, o);
      }
    }
    for (const a of added) {
      const name = normName(a.rel);
      if (a.dir) addDir(name, { mtime: a.mtime, mode: a.mode });
      else {
        seen.add(name);
        zip.addReadStream(new LazyFile(a.abs, (n) => { ctx.current = a.abs; onBytes(n); }, onError), name, { mtime: a.mtime, mode: a.mode });
      }
    }
    for (const m of mkdirs) addDir(normName(m), {});
    zip.end();
    await finished;
    z.close();
    z = null;
    if (ctx.cancel || ctx.errors.length) {
      await fsp.rm(tmp, { force: true });
      return { cancelled: ctx.cancel, errors: ctx.errors };
    }
    await fsp.rename(tmp, archive);
    ctx.tick(true);
    return { errors: [] };
  } catch (err) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    return { errors: [err.message] };
  } finally {
    if (z) z.close();
    jobs.delete(id);
  }
});

function openZip(p) {
  return new Promise((res, rej) => yauzl.open(p, { lazyEntries: false, autoClose: false }, (err, z) => (err ? rej(err) : res(z))));
}
async function listZip(p) {
  const z = await openZip(p);
  const entries = [];
  await new Promise((res, rej) => {
    z.on('entry', (en) => entries.push(en));
    z.on('end', res);
    z.on('error', rej);
  });
  return { z, entries };
}
/** zip-slip safe target path, or null */
function safeTarget(destDir, name) {
  const n = name.replace(/\\/g, '/');
  if (n.startsWith('/') || /^[A-Za-z]:/.test(n)) return null;
  const parts = n.split('/').filter(Boolean);
  if (!parts.length || parts.some((p) => p === '..')) return null;
  const t = path.join(destDir, ...parts);
  return isInside(t, destDir) ? t : null;
}
const isDirEntry = (en) => /\/$/.test(en.fileName);

ipcMain.handle('zip:inspect', async (_e, { archive, destDir }) => {
  let z;
  try {
    const r = await listZip(archive);
    z = r.z;
    let files = 0;
    let total = 0;
    const conflicts = [];
    let conflictCount = 0;
    for (const en of r.entries) {
      if (isDirEntry(en)) continue;
      files++;
      total += en.uncompressedSize;
      const t = safeTarget(destDir, en.fileName);
      if (t && (await exists(t))) {
        conflictCount++;
        if (conflicts.length < 5) conflicts.push(en.fileName);
      }
    }
    return { files, total, conflicts, conflictCount };
  } catch (err) {
    return { error: err.message };
  } finally {
    if (z) z.close();
  }
});

/** Extract the given zip entries. mapTarget(entry) -> absolute target path or null (unsafe). */
async function extractEntries(ctx, z, entries, mapTarget, overwrite) {
  for (const en of entries) if (!isDirEntry(en)) ctx.total += en.uncompressedSize;
  for (const en of entries) {
    if (ctx.cancel) break;
    const target = mapTarget(en);
    if (!target) {
      ctx.errors.push(en.fileName + ': unsafe path, skipped');
      continue;
    }
    try {
      if (isDirEntry(en)) {
        await fsp.mkdir(target, { recursive: true });
        continue;
      }
      if (en.isEncrypted()) throw new Error('encrypted entries are not supported');
      const mode = (en.externalFileAttributes >>> 16) & 0xffff;
      if ((mode & 0o170000) === 0o120000) {
        ctx.skipped++; // symlink entry: not extracted
        continue;
      }
      if ((await exists(target)) && overwrite !== 'all') {
        ctx.skipped++;
        ctx.done += en.uncompressedSize;
        continue;
      }
      await fsp.mkdir(path.dirname(target), { recursive: true });
      const rs = await new Promise((res, rej) => z.openReadStream(en, (err, st) => (err ? rej(err) : res(st))));
      const counter = new Transform({
        transform(chunk, _enc, cb) {
          ctx.done += chunk.length;
          ctx.current = en.fileName;
          ctx.tick();
          cb(ctx.cancel ? new Error('cancelled') : null, chunk);
        },
      });
      try {
        await pipeline(rs, counter, fs.createWriteStream(target));
      } catch (err) {
        await fsp.rm(target, { force: true }).catch(() => {});
        if (ctx.cancel) break;
        throw err;
      }
      try {
        const d = en.getLastModDate();
        await fsp.utimes(target, d, d);
        if ((mode & 0o170000) === 0o100000) await fsp.chmod(target, mode & 0o7777);
      } catch {}
    } catch (err) {
      ctx.errors.push(en.fileName + ': ' + err.message);
    }
  }
}

ipcMain.handle('zip:unpack', async (e, { id, archive, destDir, overwrite }) => {
  const ctx = mkCtx(e, id);
  jobs.set(id, ctx);
  let z;
  try {
    const r = await listZip(archive);
    z = r.z;
    await fsp.mkdir(destDir, { recursive: true });
    await extractEntries(ctx, z, r.entries, (en) => safeTarget(destDir, en.fileName), overwrite);
    ctx.tick(true);
    return { errors: ctx.errors, cancelled: ctx.cancel, skipped: ctx.skipped };
  } catch (err) {
    return { errors: [path.basename(archive) + ': ' + err.message], cancelled: false, skipped: 0 };
  } finally {
    if (z) z.close();
    jobs.delete(id);
  }
});

// ---- zip as a folder (read-only browsing)

const zipCache = new Map(); // archive path -> { sig, entries: [{name, size, mtime}] }
async function zipIndex(archive) {
  const st = await fsp.stat(archive);
  const sig = st.mtimeMs + ':' + st.size;
  const c = zipCache.get(archive);
  if (c && c.sig === sig) return c.entries;
  if (sevenzip.isSevenArchive(archive)) {
    const list = await sevenzip.list(archive);
    const norm = list.map((en) => ({ name: en.dir ? en.name + '/' : en.name, size: en.size, mtime: en.mtime }));
    zipCache.set(archive, { sig, entries: norm });
    return norm;
  }
  const { z, entries } = await listZip(archive);
  z.close();
  const light = entries.map((en) => ({
    name: en.fileName.replace(/\\/g, '/'),
    size: en.uncompressedSize,
    mtime: en.getLastModDate().getTime(),
  }));
  zipCache.set(archive, { sig, entries: light });
  return light;
}

ipcMain.handle('zip:list', async (_e, { archive, inner }) => {
  try {
    const entries = await zipIndex(archive);
    const prefix = inner ? inner + '/' : '';
    const map = new Map();
    for (const en of entries) {
      if (!en.name.startsWith(prefix)) continue;
      const rest = en.name.slice(prefix.length);
      if (!rest) continue;
      const parts = rest.split('/').filter(Boolean);
      if (!parts.length) continue;
      const name = parts[0];
      const isDir = parts.length > 1 || en.name.endsWith('/');
      const prev = map.get(name);
      if (isDir) {
        const explicit = parts.length === 1;
        if (!prev || (explicit && !prev.explicit)) map.set(name, { name, isDir: true, size: -1, mtime: en.mtime, explicit });
      } else if (!prev) {
        map.set(name, { name, isDir: false, size: en.size, mtime: en.mtime });
      }
    }
    const items = [...map.values()].map((i) => ({ name: i.name, isDir: i.isDir, size: i.size, mtime: i.mtime, ro: false, hidden: false, link: false }));
    return { dir: archive, items };
  } catch (err) {
    return { error: path.basename(archive) + ': ' + err.message };
  }
});

/** 7z / tar: unpack the chosen names into a temp folder, then copy them to destDir (honouring rename / overwrite) */
async function sevenExtract(ctx, archive, inner, names, destDir, rename, overwrite) {
  const base = inner ? inner + '/' : '';
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'commander-zip-'));
  try {
    ctx.current = path.basename(archive);
    await sevenzip.extract(archive, names.map((n) => base + n), tmp);
    await fsp.mkdir(destDir, { recursive: true });
    for (const n of names) {
      if (ctx.cancel) break;
      const target = safeTarget(destDir, rename && names.length === 1 ? rename : n);
      const from = path.join(tmp, ...base.split('/').filter(Boolean), n);
      if (!target || !fs.existsSync(from)) { ctx.errors.push(n + ': not found in archive'); continue; }
      ctx.current = n;
      if (fs.existsSync(target) && overwrite === 'skip') { ctx.skipped++; continue; }
      await fsp.cp(from, target, { recursive: true, force: true });
    }
  } finally {
    fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/** extract selected top-level names (files or folders) of an archive folder into destDir */
ipcMain.handle('zip:extract', async (e, { id, archive, inner, names, destDir, rename, overwrite }) => {
  const ctx = mkCtx(e, id);
  jobs.set(id, ctx);
  if (sevenzip.isSevenArchive(archive)) {
    try { await sevenExtract(ctx, archive, inner, names, destDir, rename, overwrite); } catch (err) { ctx.errors.push(err.message); }
    ctx.tick(true);
    jobs.delete(id);
    return { errors: ctx.errors, cancelled: ctx.cancel, skipped: ctx.skipped };
  }
  let z;
  try {
    const r = await listZip(archive);
    z = r.z;
    const base = inner ? inner + '/' : '';
    const pick = new Set(names);
    const sel = r.entries.filter((en) => {
      const n = en.fileName.replace(/\\/g, '/');
      if (!n.startsWith(base)) return false;
      const first = n.slice(base.length).split('/')[0];
      return pick.has(first);
    });
    await fsp.mkdir(destDir, { recursive: true });
    const map = (en) => {
      const parts = en.fileName.replace(/\\/g, '/').slice(base.length).split('/').filter(Boolean);
      if (rename && names.length === 1) parts[0] = rename;
      return safeTarget(destDir, parts.join('/'));
    };
    await extractEntries(ctx, z, sel, map, overwrite);
    ctx.tick(true);
    return { errors: ctx.errors, cancelled: ctx.cancel, skipped: ctx.skipped };
  } catch (err) {
    return { errors: [err.message], cancelled: false, skipped: 0 };
  } finally {
    if (z) z.close();
    jobs.delete(id);
  }
});

/** extract one file of an archive into a fresh temp folder, returns its path (removed on quit) */
async function extractToTemp(archive, inner, name) {
  if (sevenzip.isSevenArchive(archive)) {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'commander-zip-'));
    const want = (inner ? inner + '/' : '') + name;
    await sevenzip.extract(archive, [want], dir);
    const target = path.join(dir, ...want.split('/'));
    if (!fs.existsSync(target)) throw new Error('not found in archive');
    return target;
  }
  let z;
  try {
    const r = await listZip(archive);
    z = r.z;
    const want = (inner ? inner + '/' : '') + name;
    const en = r.entries.find((x) => x.fileName.replace(/\\/g, '/') === want);
    if (!en) throw new Error('not found in archive');
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'commander-zip-'));
    const target = path.join(dir, path.basename(name));
    const rs = await new Promise((res, rej) => z.openReadStream(en, (err, st) => (err ? rej(err) : res(st))));
    await pipeline(rs, fs.createWriteStream(target));
    return target;
  } finally {
    if (z) z.close();
  }
}

/** extract one file of an archive to a temp folder and open it with the default app */
ipcMain.handle('zip:open', async (_e, { archive, inner, name }) => {
  try {
    return (await shell.openPath(await extractToTemp(archive, inner, name))) || null;
  } catch (err) {
    return err.message;
  }
});

/** same extraction, but just return the temp path (used by the viewer) */
ipcMain.handle('zip:temp', async (_e, { archive, inner, name }) => {
  try {
    return { file: await extractToTemp(archive, inner, name) };
  } catch (err) {
    return { error: err.message };
  }
});

/** a fresh empty temp folder (removed when the program quits): used to hold archives downloaded from a NAS / SSH server */
ipcMain.handle('fs:mktemp', async () => fsp.mkdtemp(path.join(os.tmpdir(), 'commander-zip-')));

/** write a whole file (editor): to a temp file first, then moved over the original */
ipcMain.handle('file:write', async (_e, { file, data }) => {
  let target = file;
  try {
    target = await fsp.realpath(file).catch(() => file); // keep symlinks intact
  } catch {}
  const tmp = target + '.cmdr-tmp';
  try {
    await fsp.writeFile(tmp, Buffer.from(data));
    try {
      const st = await fsp.stat(target);
      await fsp.chmod(tmp, st.mode & 0o7777);
    } catch {}
    await fsp.rename(tmp, target);
    return { ok: true };
  } catch (err) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    return { error: err.message };
  }
});

/** first `max` bytes of a file (viewer) */
ipcMain.handle('view:read', async (_e, { file, max }) => {
  try {
    const st = await fsp.stat(file);
    if (!st.isFile()) return { error: 'not a regular file' };
    const len = Math.min(st.size, max);
    const buf = Buffer.alloc(len);
    const fh = await fsp.open(file, 'r');
    try {
      let off = 0;
      while (off < len) {
        const { bytesRead } = await fh.read(buf, off, len - off, off);
        if (!bytesRead) break;
        off += bytesRead;
      }
      return { size: st.size, mtime: st.mtimeMs, data: buf.subarray(0, off) };
    } finally {
      await fh.close();
    }
  } catch (err) {
    return { error: err.message };
  }
});

app.on('quit', () => {
  try { transcode.killAll(); } catch {}
  try {
    for (const d of fs.readdirSync(os.tmpdir())) if (d.startsWith('commander-zip-')) fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true });
  } catch {}
});

// ---------------------------------------------------------------- Synology NAS (File Station API)

const { Syno } = require('./synology');
const { safeStorage } = require('electron');
const nasSessions = new Map(); // connection id -> Syno (kept for the whole run, creds only in memory)
const nasGet = (id) => {
  const c = nasSessions.get(id);
  if (!c) throw new Error('Not connected to the NAS. Reconnect with Ctrl+F.');
  return c;
};
const nasWrap = (fn) => async (e, a) => {
  try {
    return await fn(e, a || {});
  } catch (err) {
    return { error: err.message, code: err.code };
  }
};
const rjoin = (a, b) => (a === '/' || !a ? '' : a.replace(/\/+$/, '')) + '/' + b;

ipcMain.handle('nas:connect', nasWrap(async (_e, { id, url, user, pass, otp, insecure }) => {
  if (!user) throw new Error('Enter the user name');
  const c = new Syno();
  await c.connect({ url, user, pass, otp, insecure });
  const old = nasSessions.get(id);
  if (old) old.logout();
  nasSessions.set(id, c);
  return { ok: true, base: c.base };
}));

ipcMain.handle('nas:disconnect', nasWrap(async (_e, { id }) => {
  const c = nasSessions.get(id);
  nasSessions.delete(id);
  if (c) await c.logout();
  return { ok: true };
}));

ipcMain.handle('nas:list', nasWrap(async (_e, { id, path: p }) => ({ items: await nasGet(id).list(p) })));
ipcMain.handle('nas:mkdir', nasWrap(async (_e, { id, parent, name }) => { await nasGet(id).mkdir(parent, name); return { ok: true }; }));
ipcMain.handle('nas:rename', nasWrap(async (_e, { id, path: p, name }) => { await nasGet(id).rename(p, name); return { ok: true }; }));
ipcMain.handle('nas:delete', nasWrap(async (_e, { id, paths }) => { await nasGet(id).remove(paths); return { ok: true }; }));

/** download one remote file into a fresh temp folder (viewer / editor / open) */
ipcMain.handle('nas:temp', nasWrap(async (_e, { id, path: p }) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'commander-zip-'));
  const target = path.join(dir, p.split('/').pop());
  await nasGet(id).download(p, target);
  return { file: target };
}));

/** upload a single local file (editor save) */
ipcMain.handle('nas:put', nasWrap(async (_e, { id, localFile, destFolder, name }) => {
  await nasGet(id).upload(localFile, destFolder, name, true);
  return { ok: true };
}));

ipcMain.handle('nas:download', nasWrap(async (e, { id, jobId, base, items, destDir, rename, overwrite }) => {
  const c = nasGet(id);
  const ctx = mkCtx(e, jobId);
  jobs.set(jobId, ctx);
  let cur = null;
  ctx.abort = () => cur && cur.destroy();
  try {
    await fsp.mkdir(destDir, { recursive: true });
    const tasks = [];
    const plan = async (remote, target, it) => {
      if (ctx.cancel) return;
      if (it.isDir) {
        tasks.push({ dir: true, target });
        for (const ch of await c.list(remote)) await plan(rjoin(remote, ch.name), path.join(target, ch.name), ch);
      } else {
        tasks.push({ remote, target, mtime: it.mtime });
        ctx.total += it.size > 0 ? it.size : 0;
      }
    };
    for (const it of items) await plan(rjoin(base, it.name), path.join(destDir, items.length === 1 && rename ? rename : it.name), it);
    for (const t of tasks) {
      if (ctx.cancel) break;
      try {
        if (t.dir) { await fsp.mkdir(t.target, { recursive: true }); continue; }
        if ((await exists(t.target)) && overwrite !== 'all') { ctx.skipped++; continue; }
        const part = t.target + '.cmdr-part';
        ctx.current = t.remote;
        await fsp.mkdir(path.dirname(t.target), { recursive: true });
        try {
          await c.download(t.remote, part, { onData: (n) => { ctx.done += n; ctx.tick(); }, onReq: (r) => { cur = r; } });
        } catch (err) {
          await fsp.rm(part, { force: true }).catch(() => {});
          if (ctx.cancel) break;
          throw err;
        }
        await fsp.rename(part, t.target);
        if (t.mtime > 0) { const d = new Date(t.mtime); await fsp.utimes(t.target, d, d).catch(() => {}); }
      } catch (err) {
        ctx.errors.push(path.basename(t.target) + ': ' + err.message);
      }
    }
    ctx.tick(true);
    return { errors: ctx.errors, cancelled: ctx.cancel, skipped: ctx.skipped };
  } finally {
    jobs.delete(jobId);
  }
}));

ipcMain.handle('nas:upload', nasWrap(async (e, { id, jobId, sources, destPath, overwrite }) => {
  const c = nasGet(id);
  const ctx = mkCtx(e, jobId);
  jobs.set(jobId, ctx);
  let cur = null;
  ctx.abort = () => cur && cur.destroy();
  try {
    const entries = [];
    for (const s of sources) await walkPack(s, path.basename(s), entries, ctx, () => false);
    for (const en of entries) {
      if (ctx.cancel) break;
      try {
        const i = en.rel.lastIndexOf('/');
        const parent = i < 0 ? destPath : rjoin(destPath, en.rel.slice(0, i));
        const name = en.rel.slice(i + 1);
        if (en.dir) {
          try { await c.mkdir(parent, name); } catch { /* already there, or created with the first file */ }
          continue;
        }
        ctx.current = en.abs;
        await c.upload(en.abs, parent, name, overwrite === 'all', { onData: (n) => { ctx.done += n; ctx.tick(); }, onReq: (r) => { cur = r; } });
      } catch (err) {
        if (ctx.cancel) break;
        ctx.errors.push(path.basename(en.rel) + ': ' + err.message);
      }
    }
    ctx.tick(true);
    return { errors: ctx.errors, cancelled: ctx.cancel };
  } finally {
    jobs.delete(jobId);
  }
}));

// Local streaming proxy: lets <video>/<audio> play a NAS file (with seeking) without downloading it first.
// Only reachable on 127.0.0.1 and only with a random token that the renderer gets from `nas:streamUrl`.
const nasToken = require('crypto').randomBytes(16).toString('hex');
let nasProxy = null;
let nasProxyPort = 0;
const MIME = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', ogv: 'video/ogg', avi: 'video/x-msvideo',
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', opus: 'audio/ogg',
};
const transcode = require('./transcode');
const tcPreps = new Map(); // prepared conversions: id -> { input, info }
function ensureNasProxy() {
  return new Promise((resolve) => {
    if (nasProxy) return resolve(nasProxyPort);
    nasProxy = require('http').createServer(async (req, res) => {
      try {
        const u = new URL(req.url, 'http://x');
        const parts = u.pathname.split('/');
        if (parts[1] === nasToken && parts[2] === 'tc') {
          // on-the-fly conversion through ffmpeg (see transcode.js)
          const prep = tcPreps.get(parts[3]);
          if (!prep) { res.writeHead(404); return res.end(); }
          const child = transcode.start(prep.input, prep.info, parseFloat(u.searchParams.get('t')) || 0, prep.audioOnly);
          res.writeHead(200, { 'Content-Type': prep.audioOnly ? 'audio/flac' : prep.info.hasVideo ? 'video/mp4' : 'audio/mp4', 'Cache-Control': 'no-store' });
          child.stdout.pipe(res);
          child.stderr.on('data', () => {});
          res.on('close', () => child.kill());
          return;
        }
        if (parts[1] !== nasToken || parts[2] !== 'nas') { res.writeHead(403); return res.end(); }
        const c = nasSessions.get(decodeURIComponent(parts[3] || ''));
        const rp = u.searchParams.get('p');
        if (!c || !rp) { res.writeHead(404); return res.end(); }
        const up = await c.openDownload(rp, req.headers.range);
        const h = { 'Content-Type': MIME[rp.split('.').pop().toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
        for (const k of ['content-length', 'content-range']) if (up.headers[k]) h[k] = up.headers[k];
        res.writeHead(up.statusCode === 206 ? 206 : 200, h);
        up.pipe(res);
        res.on('close', () => up.destroy());
      } catch (err) {
        if (!res.headersSent) res.writeHead(502);
        res.end(String(err.message));
      }
    });
    nasProxy.listen(0, '127.0.0.1', () => {
      nasProxyPort = nasProxy.address().port;
      resolve(nasProxyPort);
    });
  });
}
/** probe a media source (local path or http URL) and register it for conversion; returns the base URL of the converted stream */
ipcMain.handle('media:prepare', nasWrap(async (_e, { kind, value, audioOnly }) => {
  const info = await transcode.probe(value);
  const id = require('crypto').randomBytes(8).toString('hex');
  tcPreps.set(id, { input: value, info, audioOnly: !!audioOnly });
  if (tcPreps.size > 50) tcPreps.delete(tcPreps.keys().next().value);
  const port = await ensureNasProxy();
  return { id, url: `http://127.0.0.1:${port}/${nasToken}/tc/${id}`, ...info };
}));
ipcMain.handle('media:ffmpeg', () => transcode.available());

ipcMain.handle('nas:streamUrl', nasWrap(async (_e, { id, path: p }) => {
  nasGet(id);
  const port = await ensureNasProxy();
  return { url: `http://127.0.0.1:${port}/${nasToken}/nas/${encodeURIComponent(id)}?p=${encodeURIComponent(p)}` };
}));

// ---------------------------------------------------------------- SSH / SFTP (files like the NAS panel + an interactive console)

const { Sshfs } = require('./sshclient');
// COMMANDER_KNOWN_HOSTS: use another file for the trusted SSH host keys (like ssh's UserKnownHostsFile; handy for tests)
const knownHostsFile = () => process.env.COMMANDER_KNOWN_HOSTS || path.join(app.getPath('userData'), 'known_hosts.json');
const readKnownHosts = () => {
  try {
    return JSON.parse(fs.readFileSync(knownHostsFile(), 'utf8'));
  } catch {
    return {};
  }
};

/** trust on first use: remember the host key fingerprint; a changed key needs an explicit decision */
async function verifyHost(host, port, fp) {
  const known = readKnownHosts();
  const key = `${host}:${port}`;
  if (known[key] === fp) return true;
  const w = win && !win.isDestroyed() ? win : undefined;
  if (known[key]) {
    const r = await dialog.showMessageBox(w, {
      type: 'warning',
      title: 'Host key changed',
      message: `WARNING: the host key of ${key} has CHANGED.`,
      detail: `Known: ${known[key]}\nNow:   ${fp}\n\nThe server may have been reinstalled, or someone may be intercepting the connection.`,
      buttons: ['Cancel', 'Trust the new key'],
      defaultId: 0,
      cancelId: 0,
    });
    if (r.response !== 1) return false;
  } else {
    const r = await dialog.showMessageBox(w, {
      type: 'question',
      title: 'New SSH host',
      message: `Trust the host ${key}?`,
      detail: `Its key fingerprint is:\n${fp}\n\nCompare it with the fingerprint of your server if you can.`,
      buttons: ['Trust and connect', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    });
    if (r.response !== 0) return false;
  }
  known[key] = fp;
  fs.mkdirSync(path.dirname(knownHostsFile()), { recursive: true });
  fs.writeFileSync(knownHostsFile(), JSON.stringify(known, null, 2));
  return true;
}

ipcMain.handle('ssh:connect', nasWrap(async (e, { id, host, port, user, pass, keyPath, passphrase }) => {
  const c = new Sshfs();
  await c.connect({
    host, port, user, pass, keyPath, passphrase, verifyHost,
    onClose: () => {
      if (nasSessions.get(id) === c) {
        nasSessions.delete(id);
        if (!e.sender.isDestroyed()) e.sender.send('ssh:closed', { id, connection: true });
      }
    },
  });
  const old = nasSessions.get(id);
  if (old) old.logout();
  nasSessions.set(id, c);
  return { ok: true, home: c.home, base: c.base };
}));

ipcMain.handle('ssh:shell', nasWrap(async (e, { id, cols, rows }) => {
  const c = nasGet(id);
  if (c.type !== 'sftp') throw new Error('This connection has no console.');
  await c.openShell(
    { cols, rows },
    (d) => { if (!e.sender.isDestroyed()) e.sender.send('ssh:data', { id, data: d }); },
    () => { if (!e.sender.isDestroyed()) e.sender.send('ssh:closed', { id }); }
  );
  return { ok: true };
}));
ipcMain.handle('ssh:write', (_e, { id, data }) => {
  const c = nasSessions.get(id);
  if (c && c.writeShell) c.writeShell(typeof data === 'string' ? data : Buffer.from(data));
});
ipcMain.handle('ssh:resize', (_e, { id, cols, rows }) => {
  const c = nasSessions.get(id);
  if (c && c.resizeShell) c.resizeShell(cols, rows);
});
ipcMain.handle('dialog:openFile', async (_e, { title, defaultPath }) => {
  const r = await dialog.showOpenDialog(win, { title, defaultPath, properties: ['openFile', 'showHiddenFiles'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('nas:crypt', nasWrap(async (_e, { text, decrypt }) => {
  if (!safeStorage.isEncryptionAvailable()) return { unavailable: true };
  if (decrypt) return { text: safeStorage.decryptString(Buffer.from(text, 'base64')) };
  return { text: safeStorage.encryptString(text).toString('base64') };
}));

// ---------------------------------------------------------------- compare / synchronize folders

const SYNC_TOL = 2000; // ms: FAT/zip timestamps are only accurate to 2 seconds

async function walkTree(root, rel, side, map, subdirs, ctx) {
  let ents;
  try {
    ents = await fsp.readdir(rel ? path.join(root, ...rel.split('/')) : root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of ents) {
    if (ctx.cancel) return;
    if (d.isSymbolicLink()) continue;
    const r = rel ? rel + '/' + d.name : d.name;
    let st;
    try {
      st = await fsp.stat(path.join(root, ...r.split('/')));
    } catch {
      continue;
    }
    const key = isWin || isMac ? r.toLowerCase() : r;
    const e = map.get(key) || { rel: r, l: null, r: null };
    e[side] = { size: st.isDirectory() ? -1 : st.size, mtime: st.mtimeMs, isDir: st.isDirectory() };
    if (side === 'l') e.rel = r;
    map.set(key, e);
    ctx.current = r;
    ctx.tick();
    if (st.isDirectory() && subdirs) await walkTree(root, r, side, map, subdirs, ctx);
  }
}

async function sameContent(a, b) {
  const fa = await fsp.open(a, 'r');
  const fb = await fsp.open(b, 'r');
  try {
    const ba = Buffer.allocUnsafe(1 << 20);
    const bb = Buffer.allocUnsafe(1 << 20);
    for (;;) {
      const [x, y] = await Promise.all([fa.read(ba, 0, ba.length, null), fb.read(bb, 0, bb.length, null)]);
      if (x.bytesRead !== y.bytesRead) return false;
      if (!x.bytesRead) return true;
      if (Buffer.compare(ba.subarray(0, x.bytesRead), bb.subarray(0, y.bytesRead)) !== 0) return false;
    }
  } finally {
    await fa.close();
    await fb.close();
  }
}

ipcMain.handle('sync:compare', async (e, { id, left, right, subdirs, byContent }) => {
  const ctx = mkCtx(e, id);
  jobs.set(id, ctx);
  try {
    const map = new Map();
    await walkTree(left, '', 'l', map, subdirs, ctx);
    await walkTree(right, '', 'r', map, subdirs, ctx);
    const rows = [];
    for (const en of map.values()) {
      if (ctx.cancel) break;
      const { l, r } = en;
      let state;
      if (l && r) {
        if (l.isDir && r.isDir) continue; // same folder on both sides: only its content matters
        if (l.isDir !== r.isDir) state = 'diff';
        else {
          const dt = l.mtime - r.mtime;
          if (Math.abs(dt) <= SYNC_TOL) state = l.size === r.size ? 'eq' : 'diff';
          else if (byContent && l.size === r.size && (await sameContent(path.join(left, ...en.rel.split('/')), path.join(right, ...en.rel.split('/'))))) state = 'eq';
          else state = dt > 0 ? 'newerL' : 'newerR';
        }
      } else state = l ? 'left' : 'right';
      rows.push({ rel: en.rel, isDir: !!((l && l.isDir) || (r && r.isDir)), l, r, state });
    }
    rows.sort((a, b) => a.rel.toLowerCase().localeCompare(b.rel.toLowerCase()));
    return { rows, cancelled: ctx.cancel };
  } catch (err) {
    return { rows: [], error: err.message };
  } finally {
    jobs.delete(id);
  }
});

/** actions: [{ rel, isDir, dir: 'R' (left->right) | 'L' (right->left) }] */
ipcMain.handle('sync:run', async (e, { id, left, right, actions }) => {
  const ctx = mkCtx(e, id);
  jobs.set(id, ctx);
  try {
    const jobsList = [];
    for (const a of actions) {
      const parts = a.rel.split('/');
      if (parts.some((p) => !p || p === '..')) {
        ctx.errors.push(a.rel + ': bad path');
        continue;
      }
      const from = a.dir === 'R' ? left : right;
      const to = a.dir === 'R' ? right : left;
      jobsList.push({ src: path.join(from, ...parts), dst: path.join(to, ...parts), isDir: a.isDir });
    }
    for (const j of jobsList) {
      if (j.isDir) continue;
      try {
        ctx.total += (await fsp.stat(j.src)).size;
      } catch {}
    }
    for (const j of jobsList) {
      if (ctx.cancel) break;
      try {
        if (j.isDir) {
          await fsp.mkdir(j.dst, { recursive: true });
          continue;
        }
        const st = await fsp.stat(j.src);
        await fsp.mkdir(path.dirname(j.dst), { recursive: true });
        const t = { src: j.src, target: j.dst, size: st.size, mtime: st.mtime, mode: st.mode };
        try {
          await copyFileWithProgress(t, ctx);
        } catch (err) {
          if (err.code !== 'EPERM' && err.code !== 'EACCES') throw err;
          await fsp.chmod(j.dst, 0o666); // read-only target: make it writable once and retry
          await copyFileWithProgress(t, ctx);
        }
      } catch (err) {
        ctx.errors.push(path.basename(j.src) + ': ' + err.message);
      }
    }
    ctx.tick(true);
    return { errors: ctx.errors, cancelled: ctx.cancel };
  } catch (err) {
    return { errors: [err.message], cancelled: false };
  } finally {
    jobs.delete(id);
  }
});

// ---------------------------------------------------------------- batch rename

/**
 * Rename many items of one folder. Chains (a->b, b->c) and case-only renames on a
 * case-insensitive disk are handled by going through temporary names first.
 */
ipcMain.handle('fs:renameBatch', async (_e, { dir, pairs }) => {
  const errors = [];
  const from = new Set(pairs.map((p) => fold(path.join(dir, p.from))));
  const needTemp = pairs.some((p) => from.has(fold(path.join(dir, p.to))));
  const staged = [];
  let n = 0;
  const stamp = Date.now().toString(36);
  for (const p of pairs) {
    const src = path.join(dir, p.from);
    const dst = path.join(dir, p.to);
    try {
      if (needTemp) {
        const tmp = path.join(dir, `.${stamp}_${n++}.mr-tmp`);
        await fsp.rename(src, tmp);
        staged.push({ tmp, src, dst });
      } else {
        if (await exists(dst)) throw new Error('target already exists');
        await fsp.rename(src, dst);
      }
    } catch (err) {
      errors.push(`${p.from}: ${err.message}`);
    }
  }
  for (const s of staged) {
    try {
      if ((await exists(s.dst)) && !samePath(s.dst, s.src) && !from.has(fold(s.dst))) throw new Error('target already exists');
      await fsp.rename(s.tmp, s.dst);
    } catch (err) {
      errors.push(`${path.basename(s.src)}: ${err.message}`);
      try {
        await fsp.rename(s.tmp, s.src); // best effort: put the original name back
      } catch {}
    }
  }
  return { errors };
});

// ---------------------------------------------------------------- search

function maskToRegex(mask) {
  const m = mask.trim();
  if (!m) return /^.*$/;
  const wild = /[*?]/.test(m);
  const body = m.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(wild ? '^' + body + '$' : body, 'i'); // no wildcard = "contains"
}

/** does the file contain the text (UTF-8, UTF-16 and Windows-1251 are tried)? */
async function fileContains(file, text, caseSens, ctx) {
  const needle = caseSens ? text : text.toLowerCase();
  const keep = Math.max(needle.length * 4, 16);
  const dec1251 = new TextDecoder('windows-1251');
  const fh = await fsp.open(file, 'r');
  try {
    const chunk = Buffer.allocUnsafe(1 << 20);
    let carry = Buffer.alloc(0);
    for (;;) {
      if (ctx.cancel) return false;
      const { bytesRead } = await fh.read(chunk, 0, chunk.length, null);
      if (!bytesRead) return false;
      const data = Buffer.concat([carry, chunk.subarray(0, bytesRead)]);
      const views = [data.toString('utf8'), data.toString('utf16le'), data.subarray(1).toString('utf16le'), dec1251.decode(data)];
      for (const v of views) if ((caseSens ? v : v.toLowerCase()).includes(needle)) return true;
      carry = Buffer.from(data.subarray(Math.max(0, data.length - keep)));
    }
  } finally {
    await fh.close();
  }
}

ipcMain.handle('search:run', async (e, { id, root, masks, text, caseSens, subdirs, archives }) => {
  const ctx = { cancel: false };
  jobs.set(id, ctx);
  const started = Date.now();
  const matchers = String(masks || '*').split(';').map(maskToRegex);
  const nameOk = (n) => matchers.some((r) => r.test(n));
  let batch = [];
  let lastFlush = Date.now();
  let count = 0;
  const flush = (cur) => {
    e.sender.send('search:batch', { id, items: batch, cur });
    batch = [];
    lastFlush = Date.now();
  };
  const push = (it) => {
    batch.push(it);
    count++;
    if (batch.length >= 50 || Date.now() - lastFlush > 150) flush();
  };
  try {
    const queue = [root];
    for (let head = 0; head < queue.length && !ctx.cancel; head++) {
      const dir = queue[head];
      if (Date.now() - lastFlush > 150) flush(dir);
      let ents;
      try {
        ents = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const d of ents) {
        if (ctx.cancel) break;
        const full = path.join(dir, d.name);
        try {
          if (d.isDirectory()) {
            if (!text && nameOk(d.name)) {
              const st = await fsp.stat(full);
              push({ dir, name: d.name, isDir: true, size: -1, mtime: st.mtimeMs });
            }
            if (subdirs) queue.push(full);
            continue;
          }
          if (!d.isFile()) continue;
          if (nameOk(d.name)) {
            if (!text || (await fileContains(full, text, caseSens, ctx))) {
              const st = await fsp.stat(full);
              push({ dir, name: d.name, isDir: false, size: st.size, mtime: st.mtimeMs });
            }
          }
          if (archives && !text && /\.zip$/i.test(d.name)) {
            const { z, entries } = await listZip(full);
            z.close();
            for (const en of entries) {
              const n = normName(en.fileName);
              if (!n || isDirEntry(en)) continue;
              const i = n.lastIndexOf('/');
              const base = n.slice(i + 1);
              if (!nameOk(base)) continue;
              const inner = i < 0 ? '' : n.slice(0, i);
              push({
                dir: inner ? path.join(full, ...inner.split('/')) : full,
                name: base,
                isDir: false,
                size: en.uncompressedSize,
                mtime: en.getLastModDate().getTime(),
                arc: { file: full, inner },
              });
            }
          }
        } catch {
          /* unreadable entry: skip */
        }
      }
    }
    flush('');
    return { count, cancelled: ctx.cancel, ms: Date.now() - started };
  } catch (err) {
    return { count, error: err.message, cancelled: ctx.cancel, ms: Date.now() - started };
  } finally {
    jobs.delete(id);
  }
});

ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('shell:reveal', (_e, p) => shell.showItemInFolder(p));
