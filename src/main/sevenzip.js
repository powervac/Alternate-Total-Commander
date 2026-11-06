'use strict';
// Archives other than zip: 7z, tar, cab, tar.gz / tgz, tar.bz2, tar.xz, single-file gz / bz2 / xz / lzma (through the 7za binary of the 7zip-bin package) and RAR
// (through node-unrar-js, extraction only). Browsing: list the entries, extract chosen names (read-only, like zip browsing). Also: unpack a whole archive
// with progress, and pack into 7z / tar / tar.gz / tar.bz2 / tar.xz / gz / bz2 / xz.

const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');

let bin = require('7zip-bin').path7za.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
try { fs.chmodSync(bin, 0o755); } catch { /* read-only install: hope it is already executable */ }

const EXT = /\.(7z|tar|cab|tgz|tbz2?|txz|gz|bz2|xz|lzma|rar|tar\.(gz|bz2|xz))$/i;
const isRar = (f) => /\.rar$/i.test(f);
const SINGLE = /\.(gz|bz2|xz|lzma)$/i; // one compressed file (a tar inside is the .tar.* / .tgz case, handled by inner())
const WRAPPED = /\.(tgz|tbz2?|txz|tar\.(gz|bz2|xz))$/i; // a tar inside a compressed file: unwrapped first
const isSevenArchive = (f) => EXT.test(f);

function run(args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd, windowsHide: true });
    const out = [];
    let err = '';
    p.stdout.on('data', (c) => out.push(c));
    p.stderr.on('data', (c) => (err += c));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code > 1) return reject(new Error((err || Buffer.concat(out).toString()).trim().split('\n').slice(-2).join(' ') || '7za exited with code ' + code));
      resolve(Buffer.concat(out).toString('utf8'));
    });
  });
}


/** a .tar.gz / .tgz / .tar.bz2 / .tar.xz is read through a pipe: the first 7za unpacks the compression layer to its output, the second reads the tar from its input.
 *  Nothing is written to disk (the old way wrote the whole .tar into the temp folder: gigabytes of the system disk for a big archive). */
function pipeTwo(archive, args2, onPct, hold) {
  return new Promise((resolve, reject) => {
    const p1 = spawn(bin, ['x', '-so', '-bsp2', '-bso0', '-spd', archive], { windowsHide: true });
    const p2 = spawn(bin, args2, { windowsHide: true });
    const out = [];
    let e1 = '', e2 = '', buf = '', d1 = null, d2 = null;
    if (hold) hold.kill = () => { try { p1.kill(); } catch { /* gone */ } try { p2.kill(); } catch { /* gone */ } };
    p1.stdout.pipe(p2.stdin);
    p2.stdin.on('error', () => { /* the reader ended early: its own error is reported */ });
    p1.stderr.on('data', (c) => { const x = c.toString('latin1'); e1 += x; if (onPct) { buf += x; const m = buf.match(/(\d{1,3})%/g); if (m) onPct(Math.min(100, parseInt(m[m.length - 1], 10))); if (buf.length > 4096) buf = buf.slice(-256); } });
    p2.stderr.on('data', (c) => (e2 += c));
    p2.stdout.on('data', (c) => out.push(c));
    const msg = (x, code) => new Error((x || '7za exited with code ' + code).trim().split('\n').slice(-2).join(' '));
    const finish = () => {
      if (d1 === null || d2 === null) return;
      if (d2 > 1) return reject(msg(e2, d2));
      if (d1 > 1 && !hold) return reject(msg(e1, d1));
      resolve(Buffer.concat(out).toString('utf8'));
    };
    p1.on('error', reject);
    p2.on('error', reject);
    p1.on('close', (c) => { d1 = c; finish(); });
    p2.on('close', (c) => { d2 = c; finish(); });
  });
}

const unwrapped = new Map(); // archive -> { sig, tar }
/** a .tar.gz is two layers: unpack the outer one into a temp folder once and work with the .tar inside */
async function inner(archive) {
  if (!WRAPPED.test(archive)) return archive;
  const st = await fsp.stat(archive);
  const sig = st.mtimeMs + ':' + st.size;
  const c = unwrapped.get(archive);
  if (c && c.sig === sig && fs.existsSync(c.tar)) return c.tar;
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'commander-zip-'));
  await run(['x', '-y', '-spd', '-o' + dir, archive]);
  const names = (await fsp.readdir(dir)).filter((n) => /\.tar$/i.test(n));
  const tar = names.length ? path.join(dir, names[0]) : path.join(dir, (await fsp.readdir(dir))[0] || '');
  unwrapped.set(archive, { sig, tar });
  return tar;
}

/** [{ name: 'dir/file', size, mtime, dir }] */
async function listRar(archive) {
  const { createExtractorFromFile } = require('node-unrar-js');
  const ex = await createExtractorFromFile({ filepath: archive });
  const { fileHeaders } = ex.getFileList();
  const out = [];
  for (const h of fileHeaders) {
    const dir = !!(h.flags && h.flags.directory);
    const t = Date.parse(h.time || '');
    out.push({ name: String(h.name).replace(/\\/g, '/'), size: dir ? -1 : h.unpSize || 0, mtime: Number.isFinite(t) ? t : 0, dir });
  }
  return out;
}

async function list(archive) {
  if (isRar(archive)) return listRar(archive);
  // -sccUTF-8: print names as UTF-8. Without it 7za on Windows writes them in the console code page and every non-ASCII letter becomes "_"
  const text = WRAPPED.test(archive)
    ? await pipeTwo(archive, ['l', '-slt', '-ba', '-spd', '-sccUTF-8', '-si', '-ttar'])
    : await run(['l', '-slt', '-ba', '-spd', '-sccUTF-8', archive]);
  const entries = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const f = {};
    for (const line of block.split(/\r?\n/)) {
      const i = line.indexOf(' = ');
      if (i > 0) f[line.slice(0, i)] = line.slice(i + 3);
    }
    if (f.Path === undefined || /(^|\/)(\._[^/]*|PaxHeader(\/.*)?)$/.test(f.Path.replace(/\\/g, '/'))) continue; // skip macOS tar junk
    const dir = /^D/.test(f.Attributes || '') || f.Folder === '+';
    const t = Date.parse((f.Modified || '').replace(' ', 'T'));
    entries.push({ name: f.Path.replace(/\\/g, '/'), size: dir ? -1 : parseInt(f.Size, 10) || 0, mtime: Number.isFinite(t) ? t : 0, dir });
  }
  // a bz2 / xz / lzma file holds one file without a name: it is named like the archive without the extension
  if (!entries.length && SINGLE.test(archive)) {
    const m = /^Size = (\d+)/m.exec(text);
    let mt = 0;
    try { mt = Math.round((await fsp.stat(archive)).mtimeMs); } catch { /* ignore */ }
    entries.push({ name: path.basename(archive).replace(SINGLE, ''), size: m ? parseInt(m[1], 10) : 0, mtime: mt, dir: false });
  }
  return entries;
}

/** extract the given archive paths (files or folders, with everything inside) into destDir, keeping their paths */
async function extractRar(archive, paths, destDir, cancelled) {
  const { createExtractorFromFile } = require('node-unrar-js');
  await fsp.mkdir(destDir, { recursive: true });
  const ex = await createExtractorFromFile({ filepath: archive, targetPath: destDir });
  const want = paths && paths.length ? paths.map((x) => String(x).replace(/\\/g, '/').replace(/\/+$/, '')) : null;
  const pick = want ? (h) => { const n = String(h.name).replace(/\\/g, '/'); return want.some((w) => n === w || n.startsWith(w + '/')); } : undefined;
  const { files } = ex.extract(pick ? { files: pick } : {});
  for (const f of files) { void f; if (cancelled && cancelled()) break; } // the files are written to destDir while the generator runs
}

async function extract(archive, paths, destDir) {
  if (isRar(archive)) return extractRar(archive, paths, destDir);
  await fsp.mkdir(destDir, { recursive: true });
  if (WRAPPED.test(archive)) { await pipeTwo(archive, ['x', '-y', '-spd', '-si', '-ttar', '-o' + destDir, '--', ...paths]); return; }
  // a single compressed file has no inner names: it is unpacked whole
  if (SINGLE.test(archive)) { await run(['x', '-y', '-spd', '-o' + destDir, '--', archive]); return; }
  await run(['x', '-y', '-spd', '-o' + destDir, '--', archive, ...paths]);
}

/** 7za with the percent of the work reported: onPct(0..100); kill() stops it. -> promise */
function runProgress(args, cwd, onPct, hold) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, ['-bsp1', '-bso0', ...args], { cwd, windowsHide: true });
    let err = '';
    let buf = '';
    if (hold) hold.kill = () => { try { p.kill(); } catch { /* gone */ } };
    p.stdout.on('data', (c) => { buf += c.toString('latin1'); const m = buf.match(/(\d{1,3})%/g); if (m && onPct) onPct(Math.min(100, parseInt(m[m.length - 1], 10))); if (buf.length > 4096) buf = buf.slice(-256); });
    p.stderr.on('data', (c) => (err += c));
    p.on('error', reject);
    p.on('close', (code) => (code > 1 ? reject(new Error((err || '7za exited with code ' + code).trim().split('\n').slice(-2).join(' '))) : resolve()));
  });
}

/** unpack the whole archive into destDir. overwrite: 'all' | 'skip'. onPct(0..100), hold.kill() to stop */
async function unpackAll(archive, destDir, { overwrite = 'skip', onPct, hold, cancelled } = {}) {
  await fsp.mkdir(destDir, { recursive: true });
  if (isRar(archive)) { await extractRar(archive, [], destDir, cancelled); if (onPct) onPct(100); return; }
  if (WRAPPED.test(archive)) { await pipeTwo(archive, ['x', '-y', overwrite === 'all' ? '-aoa' : '-aos', '-spd', '-si', '-ttar', '-o' + destDir], onPct, hold); if (onPct) onPct(100); return; }
  await runProgress(['x', '-y', overwrite === 'all' ? '-aoa' : '-aos', '-spd', '-o' + destDir, '--', archive], undefined, onPct, hold);
}

/** pack sources (all of them in the same folder `cwd`, given by name) into archive. kind: 7z | tar | tgz | tbz2 | txz | gz | bz2 | xz */
async function pack(kind, cwd, names, archive, { onPct, hold } = {}) {
  await fsp.mkdir(path.dirname(archive), { recursive: true });
  const tmp = archive + '.part';
  await fsp.rm(tmp, { force: true });
  const type = { '7z': '7z', tar: 'tar', gz: 'gzip', bz2: 'bzip2', xz: 'xz' };
  try {
    if (kind === '7z' || kind === 'tar') {
      await runProgress(['a', '-t' + type[kind], '-y', '-spd', ...(kind === '7z' ? ['-mx=5'] : []), tmp, '--', ...names], cwd, onPct, hold);
    } else if (kind === 'gz' || kind === 'bz2' || kind === 'xz') {
      if (names.length !== 1) throw new Error('A .' + kind + ' holds one file: select one file (or pack several into a .tar.' + kind + ').');
      await runProgress(['a', '-t' + type[kind], '-y', tmp, '--', names[0]], cwd, onPct, hold);
    } else {
      // tgz / tbz2 / txz: the tar is made and compressed at the same time through a pipe (no big temporary tar on the system disk)
      const wrap = { tgz: 'gzip', tbz2: 'bzip2', txz: 'xz' }[kind];
      if (!wrap) throw new Error('Unknown archive type ' + kind);
      const tarName = path.basename(archive).replace(/\.(tgz|tbz2?|txz|tar\.(gz|bz2|xz))$/i, '') + '.tar';
      await new Promise((resolve, reject) => {
        const p1 = spawn(bin, ['a', '-ttar', '-so', '-bsp2', '-bso0', '-spd', 'x.tar', '--', ...names], { cwd, windowsHide: true });
        const p2 = spawn(bin, ['a', '-t' + wrap, '-y', '-bso0', '-bsp0', '-si' + tarName, tmp], { windowsHide: true });
        let e1 = '', e2 = '', buf = '', done1 = null, done2 = null;
        if (hold) hold.kill = () => { try { p1.kill(); } catch { /* gone */ } try { p2.kill(); } catch { /* gone */ } };
        p1.stdout.pipe(p2.stdin);
        p2.stdin.on('error', () => { /* the second one ended early: its error is reported below */ });
        p1.stderr.on('data', (c) => { const x = c.toString('latin1'); e1 += x; buf += x; const m = buf.match(/(\d{1,3})%/g); if (m && onPct) onPct(Math.min(100, parseInt(m[m.length - 1], 10))); if (buf.length > 4096) buf = buf.slice(-256); });
        p2.stderr.on('data', (c) => (e2 += c));
        p2.stdout.on('data', () => {});
        const last2 = (x, code) => new Error((x || '7za exited with code ' + code).trim().split('\n').slice(-2).join(' '));
        const finish = () => {
          if (done1 === null || done2 === null) return;
          if (done1 > 1) return reject(last2(e1, done1));
          if (done2 > 1) return reject(last2(e2, done2));
          resolve();
        };
        p1.on('error', reject);
        p2.on('error', reject);
        p1.on('close', (c) => { done1 = c; finish(); });
        p2.on('close', (c) => { done2 = c; finish(); });
      });
    }
    await fsp.rename(tmp, archive);
  } catch (e) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}

module.exports = { isSevenArchive, isRar, list, extract, run, unpackAll, pack };
