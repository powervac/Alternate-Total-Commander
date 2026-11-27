'use strict';
// A database of the files of a server (Synology NAS, SSH, FTP, WebDAV, Dropbox, Google Drive): the folders are walked once through the
// connection, names, sizes and dates are kept in one gzip file per connection, and searches are answered from it without asking the server.
// (Disks of the computer, network drives with a letter included, have the File index instead: fileindex.js.)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { promisify } = require('util');
const { parseMasks } = require('./searchengine');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// folders of a NAS or a system that only fill a database with copies, thumbnails and deleted files
const SKIP_DIRS = new Set(['@eadir', '#recycle', '#snapshot', '@tmp', '$recycle.bin', 'system volume information', '.trash', '.trashes']);
const MAX_ENTRIES = 3000000;
const MAX_DEPTH = 64;

const join = (dir, name) => (dir === '/' ? '' : dir.replace(/\/+$/, '')) + '/' + name;

/**
 * Walks the folders below root through client.list(folder) -> [{ name, isDir, size, mtime, link }].
 * A folder that cannot be read is counted and skipped; when the connection is gone (many failures in a row) the walk ends with the error.
 */
async function crawl(client, root, { parallel = 4, onProgress = () => {}, cancelled = () => false, maxEntries = MAX_ENTRIES, maxFailures = 25 } = {}) {
  const start = root && root !== '/' ? root.replace(/\/+$/, '') : '/';
  const out = { root: start, dirs: [start], entries: [], failed: 0, partial: false };
  const queue = [{ i: 0, depth: 0 }];
  let active = 0;
  let inRow = 0;
  let fatal = null;
  const one = async ({ i, depth }) => {
    const dir = out.dirs[i];
    let items;
    try {
      items = await client.list(dir);
      inRow = 0;
    } catch (e) {
      if (i === 0) { fatal = e; return; }
      out.failed++;
      if (++inRow >= maxFailures) fatal = e;
      return;
    }
    for (const it of items) {
      if (out.entries.length >= maxEntries) { out.partial = true; return; }
      if (!it || !it.name || it.name === '.' || it.name === '..') continue;
      if (it.isDir && SKIP_DIRS.has(String(it.name).toLowerCase())) continue;
      out.entries.push([i, it.name, it.isDir ? -1 : it.size || 0, Math.round(it.mtime || 0), it.isDir ? 1 : 0]);
      // a link to a folder is listed but not followed: it may lead back and never end
      if (it.isDir && !it.link && depth < MAX_DEPTH) {
        out.dirs.push(join(dir, it.name));
        queue.push({ i: out.dirs.length - 1, depth: depth + 1 });
      }
    }
    onProgress({ files: out.entries.length, folders: out.dirs.length, current: dir });
  };
  await new Promise((resolve) => {
    let at = 0;
    const pump = () => {
      if (fatal || cancelled() || out.entries.length >= maxEntries) {
        if (!active) resolve();
        return;
      }
      while (active < parallel && at < queue.length) {
        const job = queue[at++];
        active++;
        one(job).catch((e) => { fatal = e; }).finally(() => { active--; pump(); });
      }
      if (!active && at >= queue.length) resolve();
    };
    pump();
  });
  if (fatal) throw fatal;
  if (cancelled() || queue.length && out.entries.length >= maxEntries) out.partial = true;
  return out;
}

// ------------------------------------------------------------ the file of a connection
const fileOf = (folder, key) => path.join(folder, crypto.createHash('sha1').update(String(key)).digest('hex') + '.json.gz');
const cache = new Map(); // file -> { mtimeMs, data }

async function save(folder, key, walked, name) {
  const data = { version: 1, key: String(key), name: String(name || ''), built: Date.now(), root: walked.root, failed: walked.failed, partial: walked.partial, dirs: walked.dirs, entries: walked.entries };
  await fs.promises.mkdir(folder, { recursive: true });
  const file = fileOf(folder, key);
  await fs.promises.writeFile(file + '.tmp', await gzip(Buffer.from(JSON.stringify(data)), { level: 4 }));
  await fs.promises.rename(file + '.tmp', file);
  cache.delete(file);
  return summary(data);
}

async function load(folder, key) {
  const file = fileOf(folder, key);
  const st = await fs.promises.stat(file).catch(() => null);
  if (!st) return null;
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs) return hit.data;
  let data;
  try { data = JSON.parse((await gunzip(await fs.promises.readFile(file))).toString('utf8')); } catch { return null; } // damaged: as if there is none
  if (!data || data.version !== 1 || !Array.isArray(data.entries)) return null;
  cache.clear(); // one big database in memory at a time
  cache.set(file, { mtimeMs: st.mtimeMs, data });
  return data;
}

const summary = (d) => (d ? { count: d.entries.length, folders: d.dirs.length, built: d.built, root: d.root, failed: d.failed, partial: d.partial } : null);

async function remove(folder, key) {
  const file = fileOf(folder, key);
  cache.delete(file);
  await fs.promises.rm(file, { force: true });
}

/** names like in Find Files: "*.jpg;*.heic", a word without wildcards = the name contains it, "| *.tmp" excludes. under = only below this folder */
function search(data, { mask, under = '', limit = 2000 } = {}) {
  const m = parseMasks(mask);
  const below = under && under !== '/' ? under.replace(/\/+$/, '') : '';
  const dirOk = data.dirs.map((d) => !below || d === below || d.startsWith(below + '/'));
  if (m.exDir.length) for (let i = 0; i < data.dirs.length; i++) if (dirOk[i] && data.dirs[i].slice(data.root.length).split('/').some((part) => part && m.exDir.some((r) => r.test(part)))) dirOk[i] = false;
  const items = [];
  let total = 0;
  for (const [di, name, size, mtime, isDir] of data.entries) {
    if (!dirOk[di]) continue;
    if (m.inc.length && !m.inc.some((r) => r.test(name))) continue;
    if (m.exFile.some((r) => r.test(name))) continue;
    total++;
    if (items.length < limit) items.push({ dir: data.dirs[di], name, size, mtime, isDir: !!isDir });
  }
  return { items, total };
}

module.exports = { crawl, save, load, remove, search, summary, fileOf };
