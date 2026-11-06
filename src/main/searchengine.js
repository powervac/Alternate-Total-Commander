'use strict';
// Find Files engine (Alt+F7). Pure Node, no OS tools, same behaviour on Windows and macOS.
//   names     : several masks (a;b), exclusion after "|" (name or "dir/"), regular expression, "contains" without wildcards
//   scope     : several folders, only the selected items, depth limit, zip archives (names inside)
//   content   : plain / whole word / case / regular expression / hex, ANSI / DOS / UTF-8 / UTF-16, "not containing",
//               text inside docx / xlsx / pptx / odf; the first hit gives the line number and a snippet
//   filters   : date between, not older / older than, size, attributes
//   duplicates: same name / same size / same contents (sha1)
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const docview = require('./docview');

const UNIT_MS = { minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 };
const SIZE_UNIT = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
const POOL = 6; // files whose contents are read at the same time
const CHUNK = 1 << 20;
const MAX_LINE = 1 << 16;
const ZIP_MAX = 64 * 1024 * 1024; // largest zip entry read for a text search

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ------------------------------------------------------------------ names
function maskToRegex(mask) {
  let m = mask.trim();
  if (!m) return null;
  if (m === '*.*') m = '*'; // like Total Commander: all files, also those without an extension
  const wild = /[*?]/.test(m);
  const body = escRe(m).replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
  return new RegExp(wild ? '^' + body + '$' : body, 'i'); // no wildcard = "name contains"
}
/** "*.js;*.ts|node_modules/;*.min.js" -> { inc: [re], exFile: [re], exDir: [re] } */
function parseMasks(masks, asRegex) {
  const [incPart, ...exParts] = String(masks || '').split('|');
  const exPart = exParts.join('|');
  const out = { inc: [], exFile: [], exDir: [] };
  if (asRegex) {
    const re = (s) => { try { return new RegExp(s, 'i'); } catch { throw new Error('Bad regular expression in the name: ' + s); } };
    if (incPart.trim()) out.inc.push(re(incPart.trim()));
    if (exPart.trim()) out.exFile.push(re(exPart.trim()));
    return out;
  }
  for (const t of incPart.split(';')) { const r = maskToRegex(t); if (r) out.inc.push(r); }
  for (const t of exPart.split(';')) {
    const s = t.trim();
    if (!s) continue;
    if (/[\\/]$/.test(s)) out.exDir.push(maskToRegex(s.replace(/[\\/]+$/, '')));
    else out.exFile.push(maskToRegex(s));
  }
  return out;
}

// ------------------------------------------------------------------ content
function lineMatcher(text, o) {
  if (o.regex) {
    let re;
    const flags = (o.caseSens ? '' : 'i');
    try { re = new RegExp(text, flags + 'u'); } catch { try { re = new RegExp(text, flags); } catch { throw new Error('Bad regular expression: ' + text); } }
    if (o.whole) re = new RegExp('(?<![\\p{L}\\p{N}_])(?:' + re.source + ')(?![\\p{L}\\p{N}_])', flags + 'u');
    return (line) => re.test(line);
  }
  if (o.whole) {
    const re = new RegExp('(?<![\\p{L}\\p{N}_])' + escRe(text) + '(?![\\p{L}\\p{N}_])', (o.caseSens ? '' : 'i') + 'u');
    return (line) => re.test(line);
  }
  if (o.caseSens) return (line) => line.includes(text);
  const low = text.toLowerCase();
  return (line) => line.toLowerCase().includes(low);
}
const snip = (line) => { const t = line.trim(); return t.length > 160 ? t.slice(0, 160) + '...' : t; };

/** search a string (already decoded text): returns { line, snippet } or null */
function searchString(str, match) {
  const lines = str.split(/\r\n|\n|\r/);
  for (let i = 0; i < lines.length; i++) if (match(lines[i])) return { line: i + 1, snippet: snip(lines[i]) };
  return null;
}

/** stream a file through one text decoder and look for a matching line */
async function searchFileDecoded(file, label, match, ctx) {
  const dec = new TextDecoder(label);
  const fh = await fsp.open(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(CHUNK);
    let carry = '';
    let lineNo = 0;
    for (;;) {
      if (ctx.cancelled()) return null;
      const { bytesRead } = await fh.read(buf, 0, CHUNK, null);
      const str = carry + dec.decode(bytesRead ? buf.subarray(0, bytesRead) : new Uint8Array(0), { stream: !!bytesRead });
      const parts = str.split(/\r\n|\n|\r/);
      carry = bytesRead ? parts.pop() : '';
      if (carry.length > MAX_LINE) { parts.push(carry); carry = ''; }
      for (const p of parts) { lineNo++; if (match(p)) return { line: lineNo, snippet: snip(p) }; }
      if (!bytesRead) { if (carry) { lineNo++; if (match(carry)) return { line: lineNo, snippet: snip(carry) }; } return null; }
    }
  } finally {
    await fh.close();
  }
}

/** all decoders over ONE read of the file (big videos are read once, not once per encoding) */
async function searchFileMulti(file, labels, match, ctx) {
  const st = labels.map((label) => ({ dec: new TextDecoder(label), carry: '', lineNo: 0 }));
  const fh = await fsp.open(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(CHUNK);
    for (;;) {
      if (ctx.cancelled()) return null;
      const { bytesRead } = await fh.read(buf, 0, CHUNK, null);
      const last = !bytesRead;
      for (const s of st) {
        const str = s.carry + s.dec.decode(last ? new Uint8Array(0) : buf.subarray(0, bytesRead), { stream: !last });
        const parts = str.split(/\r\n|\n|\r/);
        s.carry = last ? '' : parts.pop();
        if (s.carry.length > MAX_LINE) { parts.push(s.carry); s.carry = ''; }
        if (last && !parts.length) continue;
        for (const p of parts) { s.lineNo++; if (match(p)) return { line: s.lineNo, snippet: snip(p) }; }
      }
      if (last) return null;
    }
  } finally {
    await fh.close();
  }
}

/**
 * Fast rejection for a plain ASCII needle: native latin1 / utf-16 views of every chunk are compared, no line splitting.
 * true = the file certainly does not contain the text (any of UTF-8, ANSI, DOS, UTF-16 LE/BE).
 */
async function quickMiss(file, needle, caseSens, ctx) {
  const n = caseSens ? needle : needle.toLowerCase();
  const fh = await fsp.open(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(CHUNK + 64);
    let carry = 0;
    for (;;) {
      if (ctx.cancelled()) return false;
      const { bytesRead } = await fh.read(buf, carry, CHUNK, null);
      if (!bytesRead) return true;
      const view = buf.subarray(0, carry + bytesRead);
      const forms = [view.toString('latin1'), view.toString('utf16le'), view.subarray(1).toString('utf16le')];
      for (const f of forms) if ((caseSens ? f : f.toLowerCase()).includes(n)) return false;
      carry = Math.min(view.length, needle.length * 2 + 2);
      view.copy(buf, 0, view.length - carry);
    }
  } finally {
    await fh.close();
  }
}

async function searchFileHex(file, needle, ctx) {
  const fh = await fsp.open(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(CHUNK);
    let carry = Buffer.alloc(0);
    let base = 0;
    for (;;) {
      if (ctx.cancelled()) return null;
      const { bytesRead } = await fh.read(buf, 0, CHUNK, null);
      if (!bytesRead) return null;
      const data = Buffer.concat([carry, buf.subarray(0, bytesRead)]);
      const i = data.indexOf(needle);
      if (i >= 0) return { line: 0, snippet: 'offset ' + (base - carry.length + i).toString(16).padStart(8, '0') };
      carry = Buffer.from(data.subarray(Math.max(0, data.length - needle.length + 1)));
      base += bytesRead;
    }
  } finally {
    await fh.close();
  }
}

const htmlToText = (h) => h.replace(/<\/(p|h\d|tr|div|section|li)>|<br>/gi, '\n').replace(/<\/t[dh]>/gi, '\t').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&bull;/g, '*').replace(/&emsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/** NUL bytes that do not look like UTF-16 text = binary data */
function isBinaryBytes(b, bytesRead) {
  if (bytesRead >= 2 && ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff))) return false;
  let zero = 0, even = 0, odd = 0;
  for (let i = 0; i < bytesRead; i++) if (b[i] === 0) { zero++; if (i % 2) odd++; else even++; }
  if (!zero) return false;
  const pairs = bytesRead / 2;
  return !((odd > pairs * 0.3 && even < pairs * 0.05) || (even > pairs * 0.3 && odd < pairs * 0.05));
}

/** text condition on data that is already in memory (an entry of a zip) */
function bufferCheck(buf, t, matcher, hexNeedle) {
  let hit = null;
  if (t.hex) {
    const i = buf.indexOf(hexNeedle);
    if (i >= 0) hit = { line: 0, snippet: 'offset ' + i.toString(16).padStart(8, '0') };
  } else if (!(t.skipBinary && isBinaryBytes(buf, Math.min(buf.length, 8192)))) {
    const labels = [];
    if (t.utf8) labels.push('utf-8');
    if (t.ansi) labels.push('windows-1251');
    if (t.dos) labels.push('ibm866');
    if (t.utf16) labels.push('utf-16le', 'utf-16be');
    for (const l of labels) { hit = searchString(new TextDecoder(l).decode(buf), matcher); if (hit) break; }
  }
  if (t.not) return { ok: !hit };
  return hit ? { ok: true, ...hit } : { ok: false };
}

/** first 8 KB of a file */
async function isBinaryFile(file) {
  let fh;
  try {
    fh = await fsp.open(file, 'r');
    const b = Buffer.alloc(8192);
    const { bytesRead } = await fh.read(b, 0, 8192, 0);
    if (bytesRead >= 2 && ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff))) return false; // UTF-16 BOM
    let zero = 0, even = 0, odd = 0;
    for (let i = 0; i < bytesRead; i++) if (b[i] === 0) { zero++; if (i % 2) odd++; else even++; }
    if (!zero) return false;
    const pairs = bytesRead / 2;
    if ((odd > pairs * 0.3 && even < pairs * 0.05) || (even > pairs * 0.3 && odd < pairs * 0.05)) return false; // UTF-16 without BOM
    return true;
  } catch {
    return false;
  } finally {
    if (fh) await fh.close();
  }
}

/** does the file satisfy the text condition? -> { ok, line?, snippet? } */
async function contentCheck(file, ext, t, matcher, hexNeedle, ctx) {
  let hit = null;
  if (t.hex) hit = await searchFileHex(file, hexNeedle, ctx);
  else {
    const labels = [];
    if (t.utf8) labels.push('utf-8');
    if (t.ansi) labels.push('windows-1251');
    if (t.dos) labels.push('ibm866');
    if (t.utf16) labels.push('utf-16le', 'utf-16be');
    const plainAscii = t.text && !t.regex && !t.whole && /^[\x20-\x7e]+$/.test(t.text);
    const office = t.office && docview.SUPPORTED.has(ext);
    // videos, images, executables ... are skipped (like ripgrep); Hex mode and the Office option still look into them
    const skip = t.skipBinary && (await isBinaryFile(file));
    if (skip && ctx.stats) ctx.stats.binary++;
    if (labels.length && !skip && !(plainAscii && (await quickMiss(file, t.text, t.caseSens, ctx)))) hit = await searchFileMulti(file, labels, matcher, ctx);
    if (!hit && office) {
      const r = await docview.render(file, ext);
      if (r.html) hit = searchString(htmlToText(r.html), matcher);
    }
  }
  if (t.not) return { ok: !hit };
  return hit ? { ok: true, ...hit } : { ok: false };
}

// ------------------------------------------------------------------ duplicates
function hashFile(file, ctx) {
  return new Promise((resolve) => {
    const h = crypto.createHash('sha1');
    const s = fs.createReadStream(file);
    s.on('data', (d) => { if (ctx.cancelled()) s.destroy(); else h.update(d); });
    s.on('error', () => resolve(null));
    s.on('close', () => resolve(ctx.cancelled() ? null : h.digest('hex')));
  });
}

// ------------------------------------------------------------------ main
/**
 * p: { roots[], selected[]|null, masks, regexName, depth(-1 = unlimited), archives, text, t:{whole,caseSens,regex,hex,not,utf8,ansi,dos,utf16,office},
 *      dateFrom, dateTo, notOlder:{n,unit}, older:{n,unit}, size:{op,value,unit}, attrs:{ro,hidden,dir}, dups:{name,size,content} }
 * hooks: { emit(items, cur), cancelled(), zipEntries(file) }
 */
async function run(p, hooks) {
  const started = Date.now();
  const stats = { dirs: 0, files: 0, binary: 0 };
  const ctx = { cancelled: hooks.cancelled, stats };
  const names = parseMasks(p.masks, p.regexName);
  const nameOk = (n) => (!names.inc.length || names.inc.some((r) => r.test(n))) && !names.exFile.some((r) => r.test(n));
  const dirExcluded = (n) => names.exDir.some((r) => r.test(n));
  const text = p.text || '';
  const t = p.t || {};
  const dups = p.dups && (p.dups.name || p.dups.size || p.dups.content) ? p.dups : null;
  let matcher = null, hexNeedle = null;
  if (text) {
    if (t.hex) {
      const hx = text.replace(/[\s,]|0x/gi, '');
      if (!/^([0-9a-f]{2})+$/i.test(hx)) throw new Error('Hex search needs pairs of hex digits, for example: de ad be ef');
      hexNeedle = Buffer.from(hx, 'hex');
    } else matcher = lineMatcher(text, t);
  }
  const now = Date.now();
  const lo = [p.dateFrom, p.notOlder ? now - p.notOlder.n * UNIT_MS[p.notOlder.unit] : null].filter((x) => x != null);
  const hi = [p.dateTo, p.older ? now - p.older.n * UNIT_MS[p.older.unit] : null].filter((x) => x != null);
  const minM = lo.length ? Math.max(...lo) : null;
  const maxM = hi.length ? Math.min(...hi) : null;
  const sz = p.size && Number.isFinite(+p.size.value) ? { op: p.size.op, v: +p.size.value * (SIZE_UNIT[p.size.unit] || 1) } : null;
  const attrs = p.attrs || {};
  const sizeOk = (n) => !sz || (sz.op === '=' ? n === sz.v : sz.op === '>' ? n > sz.v : sz.op === '<' ? n < sz.v : sz.op === '>=' ? n >= sz.v : n <= sz.v);
  const dateOk = (m) => (minM == null || m >= minM) && (maxM == null || m <= maxM);
  const attrOk = (name, st, isDir) => {
    const ro = !(st.mode & 0o200), hidden = name.startsWith('.');
    return (attrs.ro == null || attrs.ro === ro) && (attrs.hidden == null || attrs.hidden === hidden) && (attrs.dir == null || attrs.dir === isDir);
  };
  const needContent = !!text;

  let batch = [];
  let last = Date.now();
  let count = 0;
  const flush = (cur) => { hooks.emit(batch, cur); batch = []; last = Date.now(); };
  const push = (it) => { batch.push(it); count++; if (batch.length >= 50 || Date.now() - last > 150) flush(); };
  const cand = []; // duplicate candidates
  const slots = new Set();
  const submit = async (fn) => {
    while (slots.size >= POOL) await Promise.race(slots);
    const pr = fn().catch(() => {}).finally(() => slots.delete(pr));
    slots.add(pr);
  };

  async function handleFile(dir, name, st) {
    const full = path.join(dir, name);
    const item = { dir, name, isDir: false, size: st.size, mtime: st.mtimeMs };
    if (needContent) {
      const r = await contentCheck(full, path.extname(name).slice(1).toLowerCase(), { ...t, text }, matcher, hexNeedle, ctx);
      if (!r.ok) return;
      if (r.line !== undefined) { item.line = r.line; item.snippet = r.snippet; }
    }
    if (dups) cand.push(item); else push(item);
  }

  async function visitFile(dir, name, st) {
    if (!nameOk(name) || !sizeOk(st.size) || !dateOk(st.mtimeMs) || !attrOk(name, st, false)) return;
    if (needContent) await submit(() => handleFile(dir, name, st)); else await handleFile(dir, name, st);
  }

  const seen = new Set();
  async function walk(root, selectedFile) {
    const queue = [{ dir: root, d: 0 }];
    for (let head = 0; head < queue.length && !ctx.cancelled(); head++) {
      const { dir, d } = queue[head];
      // the real path decides whether a folder was visited: links / junctions are followed, loops are not
      const key = (await fsp.realpath(dir).catch(() => path.resolve(dir))).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      stats.dirs++;
      if (Date.now() - last > 150) flush(dir);
      let ents;
      try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { continue; }
      for (const de of ents) {
        if (ctx.cancelled()) break;
        const full = path.join(dir, de.name);
        try {
          let isDir = de.isDirectory(), isFile = de.isFile();
          if (de.isSymbolicLink()) { const t2 = await fsp.stat(full); isDir = t2.isDirectory(); isFile = t2.isFile(); } // link or junction: what does it point to?
          if (isDir) {
            if (dirExcluded(de.name)) continue;
            if (!needContent && !dups && !(sz) && nameOk(de.name)) {
              const st = await fsp.stat(full);
              if (dateOk(st.mtimeMs) && attrOk(de.name, st, true) && (attrs.dir !== false)) push({ dir, name: de.name, isDir: true, size: -1, mtime: st.mtimeMs });
            }
            if (p.depth < 0 || d < p.depth) queue.push({ dir: full, d: d + 1 });
            continue;
          }
          if (!isFile) continue;
          stats.files++;
          if (attrs.dir === true) continue;
          const nameMatches = nameOk(de.name);
          if (nameMatches) await visitFile(dir, de.name, await fsp.stat(full));
          if (p.archives && needContent && !dups && /\.zip$/i.test(de.name)) {
            // text inside the files of a zip: each entry is read into memory (entries over 64 MB are skipped)
            await hooks.zipEach(full, async (en, read) => {
              if (ctx.cancelled() || !nameOk(en.name) || !sizeOk(en.size) || !dateOk(en.mtime)) return;
              stats.files++;
              if (en.size > ZIP_MAX) return;
              const buf = await read();
              if (!buf) return;
              const r = bufferCheck(buf, { ...t, text }, matcher, hexNeedle);
              if (!r.ok) return;
              push({ dir: en.inner ? path.join(full, ...en.inner.split('/')) : full, name: en.name, isDir: false, size: en.size, mtime: en.mtime, arc: { file: full, inner: en.inner }, line: r.line, snippet: r.snippet });
            });
          }
          if (p.archives && !needContent && !dups && /\.zip$/i.test(de.name)) {
            for (const en of await hooks.zipEntries(full)) {
              if (!nameOk(en.name) || !sizeOk(en.size) || !dateOk(en.mtime)) continue;
              push({ dir: en.inner ? path.join(full, ...en.inner.split('/')) : full, name: en.name, isDir: false, size: en.size, mtime: en.mtime, arc: { file: full, inner: en.inner } });
            }
          }
        } catch { /* unreadable entry: skip */ }
      }
    }
  }

  const roots = (p.roots || []).filter(Boolean);
  if (p.selected && p.selected.length) {
    for (const sp of p.selected) {
      if (ctx.cancelled()) break;
      try {
        const st = await fsp.stat(sp);
        if (st.isDirectory()) await walk(sp);
        else await visitFile(path.dirname(sp), path.basename(sp), st);
      } catch { /* skip */ }
    }
  } else for (const r of roots) { if (ctx.cancelled()) break; await walk(r); }
  await Promise.all(slots);

  let groups = 0;
  if (dups && !ctx.cancelled()) {
    flush('Comparing ...');
    const byKey = new Map();
    for (const c of cand) {
      const k = (dups.name ? c.name.toLowerCase() : '') + '|' + (dups.size || dups.content ? c.size : '');
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(c);
    }
    const emitGroup = (g) => { if (g.length < 2) return; groups++; for (const it of g) { it.group = groups; push(it); } };
    for (const g of byKey.values()) {
      if (ctx.cancelled()) break;
      if (g.length < 2) continue;
      if (!dups.content) { emitGroup(g); continue; }
      const byHash = new Map();
      await Promise.all(g.map((it) => submit(async () => {
        const h = await hashFile(path.join(it.dir, it.name), ctx);
        if (h) { if (!byHash.has(h)) byHash.set(h, []); byHash.get(h).push(it); }
      })));
      await Promise.all(slots);
      for (const gg of byHash.values()) emitGroup(gg);
    }
  }
  flush('');
  return { count, groups, stats, cancelled: ctx.cancelled(), ms: Date.now() - started };
}

module.exports = { run, parseMasks, lineMatcher, searchString };
