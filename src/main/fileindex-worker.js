'use strict';
// File name index (runs in a worker thread, so the program stays responsive): walks the chosen disks / folders, keeps name, size and date of
// every file and folder in memory (and in one gzip file on disk), and answers name searches in a fraction of a second without touching the disks.
// Messages in:  { cmd: 'load', file } | { cmd: 'build', roots, exclude, gentle } | { cmd: 'stop' } | { cmd: 'search', id, params } | { cmd: 'cancel', id }
//               { cmd: 'status' } | { cmd: 'clear' } | { cmd: 'drop', roots }
// Messages out: { type: 'status', ... } | { type: 'progress', ... } | { type: 'built', ... } | { type: 'batch', id, items } | { type: 'result', id, ... }
const { parentPort } = require('worker_threads');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const { parseMasks } = require('./searchengine');

const WIN = process.platform === 'win32';
const UNIT_MS = { minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 };
const SIZE_UNIT = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
const norm = (p) => { const q = String(p).split('\\').join('/').replace(/\/+$/, ''); return WIN ? q.toLowerCase() : q; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** the entries of one root: dirs[i] = full path of folder i; entries = parallel arrays */
class Part {
  constructor(root) {
    this.root = root;
    this.dirs = [];
    this.names = [];
    this.dir = []; // index into dirs of the folder that holds the entry
    this.size = [];
    this.mtime = [];
    this.isDir = [];
    this.built = 0;
  }
  get count() { return this.names.length; }
}

let parts = new Map(); // root -> Part
let dataFile = '';
let building = null; // { stop: bool }
const searches = new Map(); // id -> { cancel }

const post = (m) => parentPort.postMessage(m);

// ---------------------------------------------------------------- persistence
async function save() {
  if (!dataFile) return;
  await fsp.mkdir(path.dirname(dataFile), { recursive: true });
  const tmp = dataFile + '.tmp';
  await new Promise((resolve, reject) => {
    const gz = zlib.createGzip({ level: 3 });
    const out = fs.createWriteStream(tmp);
    out.on('finish', resolve);
    out.on('error', reject);
    gz.on('error', reject);
    gz.pipe(out);
    const write = (s) => (gz.write(s) ? Promise.resolve() : new Promise((r) => gz.once('drain', r)));
    (async () => {
      for (const part of parts.values()) {
        await write(JSON.stringify({ root: part.root, built: part.built, dirs: part.dirs.length, entries: part.count }) + '\n');
        let buf = '';
        for (const d of part.dirs) { buf += d + '\n'; if (buf.length > 1 << 20) { await write(buf); buf = ''; } }
        if (buf) await write(buf);
        buf = '';
        for (let i = 0; i < part.count; i++) {
          buf += `${part.dir[i]}\t${part.size[i]}\t${part.mtime[i]}\t${part.isDir[i] ? 1 : 0}\t${part.names[i]}\n`;
          if (buf.length > 1 << 20) { await write(buf); buf = ''; }
        }
        if (buf) await write(buf);
      }
      gz.end();
    })().catch(reject);
  });
  await fsp.rename(tmp, dataFile);
}

async function load(file) {
  dataFile = file;
  parts = new Map();
  if (!fs.existsSync(file)) return;
  const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  let part = null, dirsLeft = 0, entriesLeft = 0;
  try {
    for await (const line of rl) {
      if (!part || (dirsLeft === 0 && entriesLeft === 0)) {
        const h = JSON.parse(line);
        part = new Part(h.root);
        part.built = h.built;
        dirsLeft = h.dirs;
        entriesLeft = h.entries;
        parts.set(part.root, part);
        continue;
      }
      if (dirsLeft > 0) { part.dirs.push(line); dirsLeft--; continue; }
      const a = line.split('\t');
      part.dir.push(+a[0]); part.size.push(+a[1]); part.mtime.push(+a[2]); part.isDir.push(a[3] === '1' ? 1 : 0);
      part.names.push(a.slice(4).join('\t'));
      entriesLeft--;
    }
  } catch { parts = new Map(); } // damaged file: start again
}

function status() {
  const roots = [...parts.values()].map((p) => ({ root: p.root, count: p.count, folders: p.dirs.length, built: p.built }));
  return { type: 'status', roots, total: roots.reduce((n, r) => n + r.count, 0), building: !!building, file: dataFile };
}

// ---------------------------------------------------------------- building
async function buildRoot(root, exclude, gentle, progress) {
  const part = new Part(root);
  // the share of the disk that is read, as the sum of the sizes seen / the used space (only for a whole disk; a folder has no known total)
  let used = 0, bytes = 0;
  if (/^[A-Za-z]:[\\/]*$/.test(root) || root === '/') { try { const sf = await fsp.statfs(root); used = sf.bsize * (sf.blocks - sf.bfree); } catch { /* no estimate */ } }
  const pct = () => (used > 0 ? Math.min(99, Math.round((bytes / used) * 100)) : null);
  const ex = exclude.map((x) => x.toLowerCase());
  const stack = [{ dir: root, di: 0 }];
  part.dirs.push(root);
  const POOL = gentle ? 3 : 12;
  let lastTick = 0; // the first message goes out at once
  let sinceYield = 0;
  while (stack.length && !building.stop) {
    const { dir, di } = stack.pop();
    let ents;
    try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { continue; }
    const files = [];
    for (const de of ents) {
      if (de.isSymbolicLink()) continue; // links are not followed (no loops, no double entries)
      if (de.isDirectory()) {
        if (ex.includes(de.name.toLowerCase())) continue;
        const full = path.join(dir, de.name);
        part.dirs.push(full);
        stack.push({ dir: full, di: part.dirs.length - 1 });
        files.push({ de, dirIdx: part.dirs.length - 1, isDir: true, full });
      } else if (de.isFile()) files.push({ de, isDir: false, full: path.join(dir, de.name) });
    }
    // sizes and dates: stat in small groups
    for (let i = 0; i < files.length && !building.stop; i += POOL) {
      const group = files.slice(i, i + POOL);
      const sts = await Promise.all(group.map((f) => fsp.stat(f.full).catch(() => null)));
      group.forEach((f, k) => {
        const st = sts[k];
        part.names.push(f.de.name);
        part.dir.push(di);
        part.size.push(f.isDir ? -1 : st ? st.size : 0);
        if (!f.isDir && st) bytes += st.size;
        part.mtime.push(st ? Math.round(st.mtimeMs) : 0);
        part.isDir.push(f.isDir ? 1 : 0);
      });
      if (Date.now() - lastTick > 400) { lastTick = Date.now(); progress({ root, files: part.count, folders: part.dirs.length, current: dir, pct: pct() }); }
      if (gentle) { sinceYield += group.length; if (sinceYield >= 200) { sinceYield = 0; await sleep(8); } }
    }
    if (Date.now() - lastTick > 300) { lastTick = Date.now(); progress({ root, files: part.count, folders: part.dirs.length, current: dir, pct: pct() }); await sleep(0); }
  }
  part.built = Date.now();
  return part;
}

async function build(roots, exclude, gentle) {
  if (building) return;
  building = { stop: false };
  const started = Date.now();
  try {
    const keep = new Set(roots);
    for (const r of [...parts.keys()]) if (!keep.has(r)) parts.delete(r); // roots that are no longer chosen
    for (const root of roots) {
      if (building.stop) break;
      if (!fs.existsSync(root)) continue;
      const part = await buildRoot(root, exclude, gentle, (p) => post({ type: 'progress', ...p, done: [...parts.values()].reduce((n, x) => n + x.count, 0) }));
      if (building.stop) break;
      parts.set(root, part); // swapped in at once: searches see the old data until now
    }
    if (!building.stop) await save();
    post({ ...status(), type: 'built', stopped: building.stop, ms: Date.now() - started });
  } catch (e) {
    post({ type: 'error', error: e.message });
  } finally {
    building = null;
    post(status());
  }
}

// ---------------------------------------------------------------- searching
function search(id, p) {
  const ctl = { cancel: false };
  searches.set(id, ctl);
  const started = Date.now();
  const names = parseMasks(p.masks, p.regexName);
  const nameOk = (n) => (!names.inc.length || names.inc.some((r) => r.test(n))) && !names.exFile.some((r) => r.test(n));
  const now = Date.now();
  const lo = [p.dateFrom, p.notOlder ? now - p.notOlder.n * UNIT_MS[p.notOlder.unit] : null].filter((x) => x != null);
  const hi = [p.dateTo, p.older ? now - p.older.n * UNIT_MS[p.older.unit] : null].filter((x) => x != null);
  const minM = lo.length ? Math.max(...lo) : null;
  const maxM = hi.length ? Math.min(...hi) : null;
  const sz = p.size && Number.isFinite(+p.size.value) ? { op: p.size.op, v: +p.size.value * (SIZE_UNIT[p.size.unit] || 1) } : null;
  const sizeOk = (n) => !sz || (sz.op === '=' ? n === sz.v : sz.op === '>' ? n > sz.v : sz.op === '<' ? n < sz.v : sz.op === '>=' ? n >= sz.v : n <= sz.v);
  const attrs = p.attrs || {};
  const roots = (p.roots || []).map((r) => norm(r));
  const inRoots = (dirPath) => { const d = norm(dirPath); return roots.some((r) => d === r || d.startsWith(r + '/')); };
  let batch = [];
  let count = 0;
  const limit = 100000;
  const flush = () => { if (batch.length) post({ type: 'batch', id, items: batch }); batch = []; };
  let checked = 0;
  for (const part of parts.values()) {
    // folders of this part that lie inside the search folders; excluded folders ("|node_modules/") are looked up once per folder
    const dirIn = part.dirs.map((d) => inRoots(d));
    if (!dirIn.some(Boolean)) continue;
    const exDirCache = new Map();
    const dirExcluded = (di) => {
      if (!names.exDir.length) return false;
      if (exDirCache.has(di)) return exDirCache.get(di);
      const comps = part.dirs[di].split(/[\\/]/);
      const r = comps.some((c) => c && names.exDir.some((re) => re.test(c)));
      exDirCache.set(di, r);
      return r;
    };
    for (let i = 0; i < part.count; i++) {
      if ((++checked & 0x3fff) === 0 && ctl.cancel) break;
      const di = part.dir[i];
      if (!dirIn[di]) continue;
      const name = part.names[i];
      const isDir = part.isDir[i] === 1;
      if (isDir) {
        if (sz || attrs.dir === false) continue;
        if (names.exDir.length && names.exDir.some((re) => re.test(name))) continue;
      } else if (attrs.dir === true) continue;
      if (attrs.hidden != null && attrs.hidden !== name.startsWith('.')) continue;
      if (!nameOk(name)) continue;
      const m = part.mtime[i];
      if ((minM != null && m < minM) || (maxM != null && m > maxM)) continue;
      if (!isDir && !sizeOk(part.size[i])) continue;
      if (dirExcluded(di)) continue;
      batch.push({ dir: part.dirs[di], name, isDir, size: part.size[i], mtime: m });
      count++;
      if (batch.length >= 500) flush();
      if (count >= limit) break;
    }
    if (ctl.cancel || count >= limit) break;
  }
  flush();
  searches.delete(id);
  post({ type: 'result', id, count, cancelled: ctl.cancel, ms: Date.now() - started });
}

parentPort.on('message', async (m) => {
  try {
    if (m.cmd === 'load') { await load(m.file); post(status()); }
    else if (m.cmd === 'build') build(m.roots, m.exclude || [], !!m.gentle);
    else if (m.cmd === 'stop') { if (building) building.stop = true; }
    else if (m.cmd === 'search') search(m.id, m.params);
    else if (m.cmd === 'cancel') { const s = searches.get(m.id); if (s) s.cancel = true; }
    else if (m.cmd === 'status') post(status());
    else if (m.cmd === 'clear') { if (building) building.stop = true; parts = new Map(); if (dataFile) await fsp.rm(dataFile, { force: true }); post(status()); }
    else if (m.cmd === 'drop') { for (const r of m.roots) parts.delete(r); await save(); post(status()); }
  } catch (e) { post({ type: 'error', error: e.message }); }
});
