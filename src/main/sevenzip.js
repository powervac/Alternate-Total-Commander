'use strict';
// Read-only access to 7z / tar / cab (and tar.gz / tgz / tar.bz2 / tar.xz) archives through the 7za binary of the 7zip-bin package.
// Same idea as zip browsing: list the entries, extract chosen names. RAR is not supported by this 7za build.

const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');

let bin = require('7zip-bin').path7za.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
try { fs.chmodSync(bin, 0o755); } catch { /* read-only install: hope it is already executable */ }

const EXT = /\.(7z|tar|cab|tgz|tbz2?|txz|tar\.(gz|bz2|xz))$/i;
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
async function list(archive) {
  const file = await inner(archive);
  // -sccUTF-8: print names as UTF-8. Without it 7za on Windows writes them in the console code page and every non-ASCII letter becomes "_"
  const text = await run(['l', '-slt', '-ba', '-spd', '-sccUTF-8', file]);
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
  return entries;
}

/** extract the given archive paths (files or folders, with everything inside) into destDir, keeping their paths */
async function extract(archive, paths, destDir) {
  const file = await inner(archive);
  await fsp.mkdir(destDir, { recursive: true });
  await run(['x', '-y', '-spd', '-o' + destDir, '--', file, ...paths]);
}

module.exports = { isSevenArchive, list, extract };
