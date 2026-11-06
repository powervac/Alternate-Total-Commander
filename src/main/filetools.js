'use strict';
// Tools of the Files menu (main process): attributes, properties, occupied space, checksums, split / combine, compare by content,
// test archive, encode / decode (MIME, UUE), file comments (descript.ion). Same behaviour on Windows and macOS, no external programs
// except `attrib` (Windows) and `chflags` (macOS) for the hidden / system flags.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const yauzl = require('yauzl');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// ------------------------------------------------------------------ crc32
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
class Crc32 {
  constructor() { this.c = 0xffffffff; }
  update(buf) { let c = this.c; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); this.c = c; return this; }
  digest() { return ((this.c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0'); }
}
function makeHasher(algo) {
  if (algo === 'crc32') { const h = new Crc32(); return { update: (b) => h.update(b), digest: () => h.digest() }; }
  const h = crypto.createHash(algo);
  return { update: (b) => h.update(b), digest: () => h.digest('hex') };
}
async function hashFile(file, algo, ctx) {
  const h = makeHasher(algo);
  const fh = await fsp.open(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(1 << 20);
    for (;;) {
      if (ctx && ctx.cancel) return null;
      const { bytesRead } = await fh.read(buf, 0, buf.length, null);
      if (!bytesRead) break;
      h.update(buf.subarray(0, bytesRead));
    }
  } finally {
    await fh.close();
  }
  return h.digest();
}

// ------------------------------------------------------------------ helpers
async function walk(paths, ctx, onFile, onDir) {
  const stack = [...paths];
  while (stack.length) {
    if (ctx && ctx.cancel) return;
    const p = stack.pop();
    let st;
    try { st = await fsp.lstat(p); } catch { continue; }
    if (st.isDirectory()) {
      if (onDir) onDir(p, st);
      let names = [];
      try { names = await fsp.readdir(p); } catch { /* unreadable */ }
      for (const n of names) stack.push(path.join(p, n));
    } else if (st.isFile() || st.isSymbolicLink()) onFile(p, st);
  }
}
const run = (cmd, args) => new Promise((res) => execFile(cmd, args, { windowsHide: true }, (err, stdout) => res({ err, stdout: String(stdout || '') })));

// ------------------------------------------------------------------ attributes
async function getFlags(file) {
  file = path.resolve(file);
  const st = await fsp.stat(file);
  const out = { ro: !(st.mode & 0o200), hidden: path.basename(file).startsWith('.'), archive: false, system: false };
  if (isWin) {
    const r = await run('attrib', [file]);
    const line = r.stdout.split(/\r?\n/).find((l) => l.toLowerCase().includes(file.toLowerCase())) || '';
    const flags = line.slice(0, Math.max(0, line.toLowerCase().indexOf(file.toLowerCase()))).toUpperCase();
    out.ro = flags.includes('R'); out.hidden = flags.includes('H'); out.archive = flags.includes('A'); out.system = flags.includes('S');
  } else if (isMac) {
    const r = await run('ls', ['-ldO', file]);
    out.hidden = out.hidden || /\bhidden\b/.test(r.stdout);
  }
  return { ...out, mtime: st.mtimeMs, atime: st.atimeMs, birthtime: st.birthtimeMs, isDir: st.isDirectory(), size: st.size };
}
async function setFlags(file, f) {
  file = path.resolve(file);
  if (isWin) {
    const a = [];
    for (const [k, c] of [['ro', 'R'], ['hidden', 'H'], ['archive', 'A'], ['system', 'S']]) if (f[k] === true) a.push('+' + c); else if (f[k] === false) a.push('-' + c);
    if (a.length) {
      // clear S / H last-first so that attrib accepts the change on protected files
      const r = await run('attrib', [...a, file]);
      if (r.err) throw new Error('attrib failed for ' + path.basename(file));
    }
  } else {
    if (f.ro !== null && f.ro !== undefined) {
      const st = await fsp.stat(file);
      await fsp.chmod(file, f.ro ? st.mode & ~0o222 : st.mode | 0o200);
    }
    if (isMac && f.hidden !== null && f.hidden !== undefined) await run('chflags', [f.hidden ? 'hidden' : 'nohidden', file]);
  }
  if (f.mtime != null) { const d = new Date(f.mtime); await fsp.utimes(file, d, d); }
}

// ------------------------------------------------------------------ checksum files
const EXT_ALGO = { md5: 'md5', sha1: 'sha1', sha256: 'sha256', sha512: 'sha512', sfv: 'crc32', crc: 'crc32' };
function parseChecksumFile(text, algo) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    let m;
    if (algo === 'crc32') { if ((m = /^(.+?)\s+([0-9a-fA-F]{8})$/.exec(line))) out.push({ name: m[1], hash: m[2].toLowerCase() }); }
    else if ((m = /^([0-9a-fA-F]{32,128})\s+[* ]?(.+)$/.exec(line))) out.push({ name: m[2], hash: m[1].toLowerCase() });
  }
  return out;
}

// ------------------------------------------------------------------ uuencode / base64
function uuEncode(buf, name) {
  const enc = (n) => String.fromCharCode(n ? (n & 0x3f) + 32 : 96);
  let out = `begin 644 ${name}\n`;
  for (let i = 0; i < buf.length; i += 45) {
    const chunk = buf.subarray(i, i + 45);
    let line = enc(chunk.length);
    for (let j = 0; j < chunk.length; j += 3) {
      const a = chunk[j], b = chunk[j + 1] || 0, c = chunk[j + 2] || 0;
      line += enc(a >> 2) + enc(((a & 3) << 4) | (b >> 4)) + enc(((b & 15) << 2) | (c >> 6)) + enc(c & 63);
    }
    out += line + '\n';
  }
  return out + '`\nend\n';
}
function uuDecode(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^begin\s+\d+\s+/.test(l));
  if (start < 0) throw new Error('This is not a UUE file (no "begin" line)');
  const name = lines[start].replace(/^begin\s+\d+\s+/, '').trim();
  const bytes = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l === 'end') break;
    if (!l) continue;
    const dec = (ch) => (ch.charCodeAt(0) - 32) & 0x3f;
    const len = dec(l[0]);
    if (!len) continue;
    const got = [];
    for (let j = 1; j + 3 < l.length + 1 && got.length < len; j += 4) {
      const a = dec(l[j]), b = dec(l[j + 1] || ' '), c = dec(l[j + 2] || ' '), d = dec(l[j + 3] || ' ');
      got.push((a << 2) | (b >> 4), ((b & 15) << 4) | (c >> 2), ((c & 3) << 6) | d);
    }
    bytes.push(...got.slice(0, len));
  }
  return { name, data: Buffer.from(bytes) };
}

// ------------------------------------------------------------------ compare by content
function lineDiff(a, b) {
  // longest common subsequence on lines (bounded), result: [{t:'=', a, b}, {t:'-', a}, {t:'+', b}]
  const n = a.length, m = b.length;
  if (n * m > 16e6) { // too big for the exact table: line-by-line comparison
    const out = [];
    for (let i = 0; i < Math.max(n, m); i++) {
      if (a[i] === b[i]) out.push({ t: '=', a: a[i], b: b[i] });
      else { if (i < n) out.push({ t: '-', a: a[i] }); if (i < m) out.push({ t: '+', b: b[i] }); }
    }
    return out;
  }
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: '=', a: a[i], b: b[j] }); i++; j++; }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) out.push({ t: '-', a: a[i++] });
    else out.push({ t: '+', b: b[j++] });
  }
  while (i < n) out.push({ t: '-', a: a[i++] });
  while (j < m) out.push({ t: '+', b: b[j++] });
  return out;
}
const looksBinary = (buf) => { const n = Math.min(buf.length, 8192); for (let i = 0; i < n; i++) if (buf[i] === 0) return true; return false; };

// ------------------------------------------------------------------ zip test
function testZip(file, ctx) {
  return new Promise((resolve) => {
    yauzl.open(file, { lazyEntries: true, autoClose: true }, (err, z) => {
      if (err) return resolve({ error: err.message });
      const res = { files: 0, bad: [], total: 0 };
      z.on('error', (e) => resolve({ error: e.message }));
      z.on('end', () => resolve(res));
      z.on('entry', (en) => {
        if (ctx.cancel) { z.close(); return resolve({ ...res, cancelled: true }); }
        if (/\/$/.test(en.fileName)) return z.readEntry();
        res.total++;
        z.openReadStream(en, (e2, s) => {
          if (e2) { res.bad.push(`${en.fileName}: ${e2.message}`); return z.readEntry(); }
          const crc = new Crc32();
          let n = 0;
          s.on('data', (d) => { crc.update(d); n += d.length; });
          s.on('error', (e3) => { res.bad.push(`${en.fileName}: ${e3.message}`); z.readEntry(); });
          s.on('end', () => {
            if (parseInt(crc.digest(), 16) !== en.crc32) res.bad.push(`${en.fileName}: CRC error`);
            else if (n !== en.uncompressedSize) res.bad.push(`${en.fileName}: size mismatch`);
            else res.files++;
            z.readEntry();
          });
        });
      });
      z.readEntry();
    });
  });
}

// ------------------------------------------------------------------ IPC
function register(ipcMain, jobs) {
  const handle = (name, fn) => ipcMain.handle(name, async (e, a) => { try { return await fn(a || {}, e); } catch (err) { return { error: err.message }; } });
  const job = (id) => { const ctx = { cancel: false }; if (id) jobs.set(id, ctx); return ctx; };
  const done = (id) => { if (id) jobs.delete(id); };

  handle('ft:attrsGet', async ({ files }) => {
    const all = await Promise.all(files.map(getFlags));
    const tri = (k) => (all.every((x) => x[k] === all[0][k]) ? all[0][k] : null);
    return { ro: tri('ro'), hidden: tri('hidden'), archive: tri('archive'), system: tri('system'), mtime: all[0].mtime, count: all.length, windows: isWin, mac: isMac };
  });
  handle('ft:attrsSet', async ({ files, flags, recursive }) => {
    const errors = [];
    const targets = [];
    for (const f of files) {
      targets.push(f);
      if (recursive) { try { if ((await fsp.stat(f)).isDirectory()) await walk([f], null, (p) => targets.push(p), (p) => { if (p !== f) targets.push(p); }); } catch { /* skip */ } }
    }
    for (const t of targets) { try { await setFlags(t, flags); } catch (err) { errors.push(`${path.basename(t)}: ${err.message}`); } }
    return { errors, count: targets.length };
  });

  handle('ft:props', async ({ file, id }) => {
    const ctx = job(id);
    try {
      const st = await fsp.lstat(file);
      const info = await getFlags(file).catch(() => ({}));
      const r = { name: path.basename(file), dir: path.dirname(file), isDir: st.isDirectory(), size: st.size, mtime: st.mtimeMs, atime: st.atimeMs, birth: st.birthtimeMs, ro: info.ro, hidden: info.hidden, archive: info.archive, system: info.system, files: 0, dirs: 0, bytes: st.isDirectory() ? 0 : st.size };
      if (st.isDirectory()) await walk([file], ctx, (_p, s) => { r.files++; r.bytes += s.size; }, (p) => { if (p !== file) r.dirs++; });
      r.cancelled = ctx.cancel;
      return r;
    } finally { done(id); }
  });

  handle('ft:space', async ({ paths, id }) => {
    const ctx = job(id);
    const r = { files: 0, dirs: 0, bytes: 0, onDisk: 0 };
    const CL = 4096;
    try {
      await walk(paths, ctx, (_p, s) => { r.files++; r.bytes += s.size; r.onDisk += Math.ceil(s.size / CL) * CL; }, () => { r.dirs++; });
      r.cancelled = ctx.cancel;
      return r;
    } finally { done(id); }
  });

  handle('ft:checksumCreate', async ({ files, algo, single, id }) => {
    const ctx = job(id);
    try {
      const list = [];
      await walk(files, ctx, (p) => list.push(p));
      if (!list.length) return { error: 'No files to process' };
      const ext = algo === 'crc32' ? 'sfv' : algo;
      const lines = new Map(); // output file -> lines
      for (const f of list) {
        if (ctx.cancel) break;
        const h = await hashFile(f, algo, ctx);
        if (h === null) break;
        const dir = path.dirname(f);
        const out = single ? path.join(dir, path.basename(files.length === 1 ? files[0] : dir) + '.' + ext) : f + '.' + ext;
        const rel = path.basename(f);
        if (!lines.has(out)) lines.set(out, []);
        lines.get(out).push(algo === 'crc32' ? `${rel} ${h}` : `${h} *${rel}`);
      }
      if (ctx.cancel) return { cancelled: true };
      for (const [out, l] of lines) await fsp.writeFile(out, l.join('\r\n') + '\r\n');
      return { created: [...lines.keys()] };
    } finally { done(id); }
  });

  handle('ft:checksumVerify', async ({ file, id }) => {
    const ctx = job(id);
    try {
      const algo = EXT_ALGO[path.extname(file).slice(1).toLowerCase()];
      if (!algo) return { error: 'Unknown checksum file type (use .md5, .sha1, .sha256, .sha512 or .sfv)' };
      const entries = parseChecksumFile(await fsp.readFile(file, 'utf8'), algo);
      if (!entries.length) return { error: 'The checksum file has no entries' };
      const dir = path.dirname(file);
      const res = [];
      for (const en of entries) {
        if (ctx.cancel) break;
        const p = path.resolve(dir, en.name);
        try {
          const h = await hashFile(p, algo, ctx);
          res.push({ name: en.name, ok: h === en.hash, status: h === en.hash ? 'OK' : 'MISMATCH' });
        } catch { res.push({ name: en.name, ok: false, status: 'missing' }); }
      }
      return { results: res, algo, cancelled: ctx.cancel };
    } finally { done(id); }
  });

  // CRC32 of the whole file, the way Total Commander writes it into the .crc file of a split file
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crcUpdate = (crc, buf, len) => { let c = crc; for (let i = 0; i < len; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return c >>> 0; };

  // split: name.001, name.002 ... and name.crc (filename=, size=, crc32=) like Total Commander
  handle('ft:split', async ({ file, partSize, destDir, id }) => {
    const ctx = job(id);
    try {
      const st = await fsp.stat(file);
      if (!(partSize > 0)) return { error: 'Enter the bytes per file' };
      const total = Math.ceil(st.size / partSize);
      if (total > 9999) return { error: 'That would make more than 9999 parts' };
      await fsp.mkdir(destDir, { recursive: true });
      const base = path.join(destDir, path.basename(file));
      const rs = await fsp.open(file, 'r');
      const parts = [];
      let crc = 0xffffffff;
      try {
        const buf = Buffer.allocUnsafe(Math.min(partSize, 4 << 20));
        for (let i = 1; i <= total; i++) {
          if (ctx.cancel) return { cancelled: true, parts };
          const out = `${base}.${String(i).padStart(3, '0')}`;
          const ws = await fsp.open(out, 'w');
          try {
            let left = Math.min(partSize, st.size - (i - 1) * partSize);
            while (left > 0) {
              const { bytesRead } = await rs.read(buf, 0, Math.min(buf.length, left), null);
              if (!bytesRead) break;
              crc = crcUpdate(crc, buf, bytesRead);
              await ws.write(buf, 0, bytesRead);
              left -= bytesRead;
            }
          } finally { await ws.close(); }
          parts.push(out);
        }
      } finally { await rs.close(); }
      const crcHex = ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
      await fsp.writeFile(base + '.crc', `filename=${path.basename(file)}\r\nsize=${st.size}\r\ncrc32=${crcHex}\r\n`, 'latin1');
      return { parts };
    } finally { done(id); }
  });

  // combine: the first part (name.001, or any numbered part, or name.crc) and all the parts with ascending names; the .crc file gives the name and is checked
  handle('ft:combine', async ({ first, destDir, id }) => {
    const ctx = job(id);
    try {
      let m = /^(.*)\.(\d{3,4})$/.exec(first);
      let base;
      if (m) base = m[1];
      else if (/\.crc$/i.test(first)) base = first.replace(/\.crc$/i, '');
      else return { error: 'Choose a part of the split file (name.001) or its name.crc' };
      const width = m ? m[2].length : 3;
      const start = 1; // always from the first part
      let want = null;
      try {
        const txt = await fsp.readFile(base + '.crc', 'latin1');
        want = {};
        for (const line of txt.split(/\r?\n/)) { const k = /^(\w+)=(.*)$/.exec(line.trim()); if (k) want[k[1].toLowerCase()] = k[2].trim(); }
      } catch { want = null; }
      const outName = (want && want.filename && !/[\\/]/.test(want.filename)) ? want.filename : path.basename(base);
      const out = path.join(destDir, outName);
      if (fs.existsSync(out)) return { error: `${outName} already exists in the target folder` };
      await fsp.mkdir(destDir, { recursive: true });
      const ws = await fsp.open(out, 'w');
      let n = 0, size = 0;
      let crc = 0xffffffff;
      try {
        for (let i = start; ; i++) {
          if (ctx.cancel) { await ws.close(); await fsp.rm(out, { force: true }); return { cancelled: true }; }
          const p = `${base}.${String(i).padStart(width, '0')}`;
          let rs;
          try { rs = await fsp.open(p, 'r'); } catch { break; }
          try {
            const buf = Buffer.allocUnsafe(4 << 20);
            for (;;) { const { bytesRead } = await rs.read(buf, 0, buf.length, null); if (!bytesRead) break; crc = crcUpdate(crc, buf, bytesRead); size += bytesRead; await ws.write(buf, 0, bytesRead); }
          } finally { await rs.close(); }
          n++;
        }
      } finally { try { await ws.close(); } catch { /* closed above */ } }
      if (!n) { await fsp.rm(out, { force: true }); return { error: `The first part ${path.basename(base)}.${'1'.padStart(width, '0')} was not found next to the chosen one` }; }
      let check = '';
      if (want) {
        const hex = ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
        if (want.size && +want.size !== size) check = `The size (${size}) does not match the .crc file (${want.size}): a part is missing or damaged.`;
        else if (want.crc32 && want.crc32.toUpperCase() !== hex) check = `The checksum (${hex}) does not match the .crc file (${want.crc32.toUpperCase()}): a part is damaged.`;
        else check = 'The size and the checksum agree with the .crc file.';
      }
      return { out, parts: n, check };
    } finally { done(id); }
  });

  handle('ft:compare', async ({ a, b }) => {
    const [sa, sb] = await Promise.all([fsp.stat(a), fsp.stat(b)]);
    if (sa.size === sb.size) {
      const [ha, hb] = await Promise.all([hashFile(a, 'sha1'), hashFile(b, 'sha1')]);
      if (ha === hb) return { same: true, size: sa.size };
    }
    const LIM = 16 * 1024 * 1024;
    if (sa.size > LIM || sb.size > LIM) {
      // too big to show: report the first differing byte
      const fa = await fsp.open(a, 'r'), fb = await fsp.open(b, 'r');
      try {
        const ba = Buffer.allocUnsafe(1 << 20), bb = Buffer.allocUnsafe(1 << 20);
        let off = 0;
        for (;;) {
          const x = await fa.read(ba, 0, ba.length, off), y = await fb.read(bb, 0, bb.length, off);
          const n = Math.min(x.bytesRead, y.bytesRead);
          for (let i = 0; i < n; i++) if (ba[i] !== bb[i]) return { same: false, binary: true, offset: off + i, sizeA: sa.size, sizeB: sb.size };
          if (x.bytesRead !== y.bytesRead) return { same: false, binary: true, offset: off + n, sizeA: sa.size, sizeB: sb.size };
          if (!x.bytesRead) return { same: false, binary: true, offset: off, sizeA: sa.size, sizeB: sb.size };
          off += n;
        }
      } finally { await fa.close(); await fb.close(); }
    }
    const [da, db] = await Promise.all([fsp.readFile(a), fsp.readFile(b)]);
    if (looksBinary(da) || looksBinary(db)) {
      let i = 0;
      const n = Math.min(da.length, db.length);
      while (i < n && da[i] === db[i]) i++;
      return { same: false, binary: true, offset: i, sizeA: da.length, sizeB: db.length };
    }
    const la = da.toString('utf8').split(/\r?\n/), lb = db.toString('utf8').split(/\r?\n/);
    const diff = lineDiff(la, lb);
    return { same: false, binary: false, diff: diff.slice(0, 20000), truncated: diff.length > 20000, sizeA: da.length, sizeB: db.length };
  });

  handle('ft:testArchive', async ({ file, id }) => {
    const ctx = job(id);
    try {
      if (!/\.zip$/i.test(file)) return { error: 'Only zip archives can be tested here' };
      return await testZip(file, ctx);
    } finally { done(id); }
  });

  handle('ft:encode', async ({ file, kind, destDir }) => {
    const data = await fsp.readFile(file);
    const name = path.basename(file);
    if (kind === 'uue') { const out = path.join(destDir, name + '.uue'); await fsp.writeFile(out, uuEncode(data, name)); return { out }; }
    const b64 = data.toString('base64').replace(/(.{76})/g, '$1\r\n');
    const out = path.join(destDir, name + '.b64');
    await fsp.writeFile(out, b64 + '\r\n');
    return { out };
  });
  handle('ft:decode', async ({ file, destDir }) => {
    const text = await fsp.readFile(file, 'utf8');
    if (/^begin\s+\d+\s+/m.test(text)) {
      const { name, data } = uuDecode(text);
      const out = path.join(destDir, path.basename(name));
      await fsp.writeFile(out, data);
      return { out };
    }
    const clean = text.replace(/-----(BEGIN|END)[^-]*-----/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
    if (!clean) return { error: 'Nothing to decode' };
    const base = path.basename(file).replace(/\.(b64|mime|txt|eml)$/i, '') || 'decoded';
    const out = path.join(destDir, base === path.basename(file) ? base + '.bin' : base);
    await fsp.writeFile(out, Buffer.from(clean, 'base64'));
    return { out };
  });

  // comments in descript.ion (the format of Total Commander and many other file managers)
  const ionFile = (dir) => path.join(dir, 'descript.ion');
  const ionRead = async (dir) => {
    const map = new Map();
    try {
      for (const line of (await fsp.readFile(ionFile(dir), 'utf8')).split(/\r?\n/)) {
        const m = /^("([^"]+)"|(\S+))\s+(.*)$/.exec(line);
        if (m) map.set(m[2] || m[3], m[4]);
      }
    } catch { /* no file yet */ }
    return map;
  };
  handle('ft:commentGet', async ({ dir, name }) => ({ comment: (await ionRead(dir)).get(name) || '' }));
  handle('ft:commentSet', async ({ dir, name, comment }) => {
    const map = await ionRead(dir);
    if (comment) map.set(name, comment.replace(/[\r\n]+/g, ' ')); else map.delete(name);
    if (!map.size) { await fsp.rm(ionFile(dir), { force: true }); return { ok: true }; }
    await fsp.writeFile(ionFile(dir), [...map].map(([k, v]) => `${/\s/.test(k) ? `"${k}"` : k} ${v}`).join('\r\n') + '\r\n');
    return { ok: true };
  });
}

module.exports = { register, Crc32, uuEncode, uuDecode, lineDiff, parseChecksumFile };
