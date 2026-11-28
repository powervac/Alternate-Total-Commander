'use strict';
// A database of the files of a server (Synology NAS, SSH, FTP, WebDAV, Dropbox, Google Drive): the folders are walked once through the
// connection, names, sizes and dates are kept in one gzip file per connection, and searches are answered from it without asking the server.
// (Disks of the computer, network drives with a letter included, have the File index instead: fileindex.js.)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { promisify } = require('util');
const { makeFilters } = require('./searchengine');

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

const clean = (dir) => (dir && dir !== '/' ? dir.replace(/\/+$/, '') : '/');

/**
 * Searches the database with the parameters of Find Files (searchengine.js): masks, regexName, roots (folders of the server),
 * depth (-1 = all), dateFrom / dateTo / notOlder / older, size, attrs.dir / attrs.hidden, dups.name / dups.size.
 * Text inside files and the read-only attribute are not in the database.
 */
function search(data, p = {}, { limit = 100000 } = {}) {
  const f = makeFilters(p);
  const attrs = p.attrs || {};
  const depth = p.depth === undefined || p.depth === null ? -1 : p.depth;
  const roots = (p.roots && p.roots.length ? p.roots : ['/']).map(clean);
  // every folder of the database once: is it inside a search folder (and not too deep, not excluded)?
  const dirOk = data.dirs.map((d) => roots.some((r) => {
    if (d !== r && !d.startsWith(r === '/' ? '/' : r + '/')) return false;
    const parts = d.slice(r === '/' ? 0 : r.length).split('/').filter(Boolean);
    return (depth < 0 || parts.length <= depth) && !parts.some((x) => f.dirExcluded(x));
  }));
  const dups = p.dups && (p.dups.name || p.dups.size) ? p.dups : null;
  let found = [];
  let total = 0;
  for (const [di, name, size, mtime, isDirFlag] of data.entries) {
    if (!dirOk[di]) continue;
    const isDir = !!isDirFlag;
    if (isDir) { if (f.hasSize || dups || attrs.dir === false || f.dirExcluded(name)) continue; }
    else if (attrs.dir === true) continue;
    if (attrs.hidden !== undefined && attrs.hidden !== null && attrs.hidden !== name.startsWith('.')) continue;
    if (!f.nameOk(name) || !f.dateOk(mtime) || (!isDir && !f.sizeOk(size))) continue;
    total++;
    if (dups || found.length < limit) found.push({ dir: data.dirs[di], name, size, mtime, isDir });
  }
  let groups = 0;
  if (dups) {
    const byKey = new Map();
    for (const it of found) {
      const k = (dups.name ? it.name.toLowerCase() : '') + '|' + (dups.size ? it.size : '');
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(it);
    }
    found = [];
    total = 0;
    for (const g of byKey.values()) {
      if (g.length < 2) continue;
      groups++;
      total += g.length;
      for (const it of g) if (found.length < limit) { it.group = groups; found.push(it); }
    }
  }
  return { items: found, total, groups };
}

module.exports = { crawl, save, load, remove, search, summary, fileOf };
