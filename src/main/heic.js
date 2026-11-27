'use strict';
// HEIC / HEIF pictures. Chromium cannot show them, so:
//   reading   - libheif (the libheif-js package, WebAssembly) in a worker thread (heic-worker.js): the viewer, thumbnails, HEIC -> JPG
//   writing   - macOS: the system's own "sips"; Windows and Linux: the bundled ffmpeg makes one HEVC picture (libx265) and the small HEIF
//               container around it is written here (ffmpeg cannot write .heic)
// EXIF data (date, camera, place) and the colour profile are carried over in both directions; the picture is stored the right way up.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Worker } = require('worker_threads');

const isHeic = (f) => /\.(heic|heif)$/i.test(String(f));
const isHeicSource = (f) => /\.(jpe?g|png)$/i.test(String(f));
const MAX_FILE = 200 * 1024 * 1024;

// ------------------------------------------------------------ decoding (worker thread, one picture at a time)
let worker = null;
let nextId = 1;
const waiting = new Map(); // id -> { resolve, reject }
let idleTimer = null;

function stopWorker() {
  clearTimeout(idleTimer);
  const w = worker;
  worker = null;
  return w ? w.terminate().catch(() => {}) : Promise.resolve();
}

function failAll(err) {
  for (const p of waiting.values()) p.reject(err);
  waiting.clear();
}

function startWorker() {
  if (worker) return worker;
  const w = new Worker(path.join(__dirname, 'heic-worker.js'));
  w.on('message', (m) => {
    const p = waiting.get(m.id);
    if (!p) return;
    waiting.delete(m.id);
    if (m.error) p.reject(new Error(m.error));
    else p.resolve({ width: m.width, height: m.height, data: Buffer.from(m.data.buffer, m.data.byteOffset, m.data.byteLength) });
    // the decoder keeps a lot of memory after a big picture: it is ended when nothing was asked for a while
    if (!waiting.size) { clearTimeout(idleTimer); idleTimer = setTimeout(stopWorker, 60000); if (idleTimer.unref) idleTimer.unref(); }
  });
  w.on('error', (e) => { if (worker === w) worker = null; failAll(e); });
  w.on('exit', () => { if (worker === w) { worker = null; failAll(new Error('The HEIC decoder stopped.')); } });
  worker = w;
  return w;
}

/** the main picture of a HEIC file as { width, height, data: BGRA } (the order Electron's nativeImage takes) */
function decode(buffer) {
  clearTimeout(idleTimer);
  return new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    const copy = new Uint8Array(buffer.length);
    copy.set(buffer);
    startWorker().postMessage({ id, data: copy }, [copy.buffer]);
  });
}

async function readHeic(file) {
  const st = await fs.promises.stat(file);
  if (st.size > MAX_FILE) throw new Error('The picture is too big.');
  return fs.promises.readFile(file);
}

// ------------------------------------------------------------ JPEG: EXIF and colour profile
const EXIF_HEAD = Buffer.from('Exif\0\0', 'latin1');
const ICC_HEAD = Buffer.from('ICC_PROFILE\0', 'latin1');

/** the APPn segments before the picture data: [{ marker, data }] */
function jpegSegments(buf) {
  const out = [];
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return out;
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) break;
    out.push({ marker, data: buf.subarray(i + 4, i + 2 + len) });
    i += 2 + len;
  }
  return out;
}

/** the TIFF block of the EXIF data of a JPEG, or null */
function jpegExif(buf) {
  const s = jpegSegments(buf).find((x) => x.marker === 0xe1 && x.data.subarray(0, 6).equals(EXIF_HEAD));
  return s ? Buffer.from(s.data.subarray(6)) : null;
}

function jpegIcc(buf) {
  const parts = jpegSegments(buf).filter((x) => x.marker === 0xe2 && x.data.subarray(0, 12).equals(ICC_HEAD));
  if (!parts.length) return null;
  parts.sort((a, b) => a.data[12] - b.data[12]);
  return Buffer.concat(parts.map((p) => p.data.subarray(14)));
}

/** where the orientation value sits in a TIFF block: { at, little } or null */
function orientationAt(tiff) {
  if (!tiff || tiff.length < 14) return null;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  if (!little && !(tiff[0] === 0x4d && tiff[1] === 0x4d)) return null;
  const u16 = (o) => (little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o) => (little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return null;
  const n = u16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > tiff.length) break;
    if (u16(e) === 0x0112) return { at: e + 8, little };
  }
  return null;
}

function exifOrientation(tiff) {
  const o = orientationAt(tiff);
  if (!o) return 1;
  const v = o.little ? tiff.readUInt16LE(o.at) : tiff.readUInt16BE(o.at);
  return v >= 1 && v <= 8 ? v : 1;
}

/** a copy whose orientation says "already the right way up" */
function uprightExif(tiff) {
  if (!tiff) return null;
  const out = Buffer.from(tiff);
  const o = orientationAt(out);
  if (o) { if (o.little) out.writeUInt16LE(1, o.at); else out.writeUInt16BE(1, o.at); }
  return out;
}

const segment = (marker, data) => {
  const h = Buffer.alloc(4);
  h[0] = 0xff; h[1] = marker; h.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([h, data]);
};

/** a JPEG with the EXIF block and the colour profile put in (what does not fit into one segment is left out) */
function jpegWithMeta(jpeg, { exif = null, icc = null } = {}) {
  const add = [];
  if (exif && exif.length + 6 <= 65533) add.push(segment(0xe1, Buffer.concat([EXIF_HEAD, exif])));
  if (icc && icc.length) {
    const step = 65519;
    const total = Math.ceil(icc.length / step);
    if (total <= 255) for (let k = 0; k < total; k++) add.push(segment(0xe2, Buffer.concat([ICC_HEAD, Buffer.from([k + 1, total]), icc.subarray(k * step, (k + 1) * step)])));
  }
  // after the JFIF segment, when there is one
  let at = 2;
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) at = 4 + jpeg.readUInt16BE(4);
  return Buffer.concat([jpeg.subarray(0, at), ...add, jpeg.subarray(at)]);
}

// ------------------------------------------------------------ the boxes of HEIF / MP4 files
/** [{ type, start (of the content), end }] of the boxes between from and to */
function boxes(buf, from = 0, to = buf.length) {
  const out = [];
  let i = from;
  while (i + 8 <= to) {
    let size = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    let head = 8;
    if (size === 1) { if (i + 16 > to) break; size = Number(buf.readBigUInt64BE(i + 8)); head = 16; }
    else if (size === 0) size = to - i;
    if (size < head || i + size > to) break;
    out.push({ type, start: i + head, end: i + size });
    i += size;
  }
  return out;
}
const child = (buf, box, type, skip = 0) => (box ? boxes(buf, box.start + skip, box.end).find((b) => b.type === type) || null : null);

/** the EXIF TIFF block and the ICC colour profile stored in a HEIC file (each may be null) */
function heicMeta(buf) {
  const out = { exif: null, icc: null };
  try {
    const meta = boxes(buf).find((b) => b.type === 'meta');
    if (!meta) return out;
    const colr = boxes(buf, ...(() => { const c = child(buf, child(buf, meta, 'iprp', 4), 'ipco'); return c ? [c.start, c.end] : [0, 0]; })()).find((b) => b.type === 'colr' && ['prof', 'rICC'].includes(buf.toString('latin1', b.start, b.start + 4)));
    if (colr) out.icc = Buffer.from(buf.subarray(colr.start + 4, colr.end));
    // which item is the EXIF one
    const iinf = child(buf, meta, 'iinf', 4);
    if (!iinf) return out;
    let exifId = null;
    for (const e of boxes(buf, iinf.start + (buf[iinf.start] === 0 ? 6 : 8), iinf.end)) {
      const v = buf[e.start];
      if (e.type !== 'infe' || v < 2) continue;
      const id = v === 2 ? buf.readUInt16BE(e.start + 4) : buf.readUInt32BE(e.start + 4);
      const typeAt = e.start + 4 + (v === 2 ? 2 : 4) + 2;
      if (buf.toString('latin1', typeAt, typeAt + 4) === 'Exif') { exifId = id; break; }
    }
    // where its bytes are
    const iloc = child(buf, meta, 'iloc', 4);
    if (exifId === null || !iloc) return out;
    let p = iloc.start;
    const version = buf[p];
    p += 4;
    const offSize = buf[p] >> 4, lenSize = buf[p] & 15, baseSize = buf[p + 1] >> 4, indexSize = version ? buf[p + 1] & 15 : 0;
    p += 2;
    const read = (n) => { let v = 0; for (let k = 0; k < n; k++) v = v * 256 + buf[p++]; return v; };
    const count = read(version < 2 ? 2 : 4);
    for (let i = 0; i < count && p < iloc.end; i++) {
      const id = read(version < 2 ? 2 : 4);
      const method = version ? read(2) & 15 : 0;
      read(2); // data reference
      const base = read(baseSize);
      const extents = read(2);
      const parts = [];
      for (let k = 0; k < extents; k++) {
        read(indexSize);
        const off = read(offSize), len = read(lenSize);
        parts.push([base + off, len]);
      }
      if (id !== exifId) continue;
      const idat = method === 1 ? child(buf, meta, 'idat') : null;
      if (method > 1 || (method === 1 && !idat)) break;
      const from = idat ? idat.start : 0;
      const data = Buffer.concat(parts.map(([o, l]) => buf.subarray(from + o, from + o + l)));
      if (data.length > 8) {
        const skip = 4 + data.readUInt32BE(0);
        if (skip < data.length) out.exif = Buffer.from(data.subarray(skip));
      }
      break;
    }
  } catch { /* a damaged or unusual file: no metadata */ }
  return out;
}

const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16BE(v); return b; };
const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0); return b; };
const box = (type, ...parts) => { const body = Buffer.concat(parts); return Buffer.concat([u32(body.length + 8), Buffer.from(type, 'latin1'), body]); };
const full = (type, version, flags, ...parts) => box(type, Buffer.from([version, 0, 0, flags]), ...parts);
const str = (s) => Buffer.from(s, 'latin1');

/** a .heic file around one HEVC picture: hvcC = the content of its configuration box, sample = the coded picture */
function muxHeic({ hvcC, sample, width, height, icc = null, exif = null }) {
  const exifItem = exif ? Buffer.concat([u32(6), EXIF_HEAD, exif]) : null;
  const ftyp = box('ftyp', str('heic'), u32(0), str('mif1'), str('heic'));
  const props = [box('hvcC', hvcC), full('ispe', 0, 0, u32(width), u32(height)), full('pixi', 0, 0, Buffer.from([3, 8, 8, 8])),
    box('colr', str('nclx'), u16(1), u16(13), u16(6), Buffer.from([0x80]))]; // sRGB colours, BT.601 matrix, full range
  if (icc) props.push(box('colr', str('prof'), icc));
  const assoc = Buffer.from(props.map((_p, i) => (i === 0 ? 0x80 : 0) | (i + 1)));
  const infe = (id, type) => full('infe', 2, 0, u16(id), u16(0), str(type), Buffer.from([0]));
  const meta = (imageAt, exifAt) => {
    const loc = (id, at, len) => Buffer.concat([u16(id), u16(0), u16(1), u32(at), u32(len)]);
    return full('meta', 0, 0,
      full('hdlr', 0, 0, u32(0), str('pict'), u32(0), u32(0), u32(0), Buffer.from([0])),
      full('pitm', 0, 0, u16(1)),
      full('iloc', 0, 0, Buffer.from([0x44, 0x00]), u16(exifItem ? 2 : 1), loc(1, imageAt, sample.length), ...(exifItem ? [loc(2, exifAt, exifItem.length)] : [])),
      full('iinf', 0, 0, u16(exifItem ? 2 : 1), infe(1, 'hvc1'), ...(exifItem ? [infe(2, 'Exif')] : [])),
      ...(exifItem ? [full('iref', 0, 0, box('cdsc', u16(2), u16(1), u16(1)))] : []),
      box('iprp', box('ipco', ...props), full('ipma', 0, 0, u32(1), u16(1), Buffer.from([props.length]), assoc)));
  };
  const imageAt = ftyp.length + meta(0, 0).length + 8;
  return Buffer.concat([ftyp, meta(imageAt, imageAt + sample.length), box('mdat', sample, ...(exifItem ? [exifItem] : []))]);
}

/** the HEVC configuration, the coded picture and its size out of a one-picture MP4 made by ffmpeg */
function mp4Picture(buf) {
  const top = boxes(buf);
  let node = top.find((b) => b.type === 'moov');
  for (const t of ['trak', 'mdia', 'minf', 'stbl']) node = child(buf, node, t);
  const stsd = child(buf, node, 'stsd');
  const entry = stsd ? boxes(buf, stsd.start + 8, stsd.end)[0] : null;
  const hvcC = entry ? boxes(buf, entry.start + 78, entry.end).find((b) => b.type === 'hvcC') : null;
  const stsz = child(buf, node, 'stsz');
  const stco = child(buf, node, 'stco');
  if (!hvcC || !stsz || !stco) throw new Error('ffmpeg did not make an HEVC picture.');
  const size = buf.readUInt32BE(stsz.start + 4) || buf.readUInt32BE(stsz.start + 12);
  const at = buf.readUInt32BE(stco.start + 8);
  return { hvcC: Buffer.from(buf.subarray(hvcC.start, hvcC.end)), sample: Buffer.from(buf.subarray(at, at + size)), width: buf.readUInt16BE(entry.start + 24), height: buf.readUInt16BE(entry.start + 26) };
}

// ------------------------------------------------------------ writing
const clampQuality = (q) => (Number.isFinite(+q) && +q > 0 ? Math.min(100, Math.max(1, Math.round(+q))) : 90);
/** the quality of the dialog (1..100) as the CRF of x265 (smaller = better) */
const crfOf = (q) => Math.min(45, Math.max(10, Math.round(51 - clampQuality(q) * 0.37)));
// how the picture has to be turned so that it needs no orientation mark
const TURN = { 2: 'hflip', 3: 'hflip,vflip', 4: 'vflip', 5: 'transpose=0', 6: 'transpose=1', 7: 'transpose=3', 8: 'transpose=2' };

function run(cmd, args, hold) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    if (hold) hold.kill = () => p.kill();
    let err = '';
    p.stderr.on('data', (d) => { if (err.length < 20000) err += d; });
    p.stdout.on('data', () => {});
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim().split('\n').slice(-2).join(' ') || `${path.basename(cmd)} ended with code ${code}`))));
  });
}

/** make a HEIC file (as bytes) of a JPG or PNG with the bundled ffmpeg. An odd width or height loses its last line (HEVC 4:2:0). */
async function encodeHeic(ffmpeg, source, { quality, hold } = {}) {
  const input = await readHeic(source);
  const isJpeg = input[0] === 0xff && input[1] === 0xd8;
  const exif = isJpeg ? jpegExif(input) : null;
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'commander-zip-'));
  try {
    const out = path.join(dir, 'picture.mp4');
    const turn = TURN[exifOrientation(exif)];
    const filters = [turn, 'crop=trunc(iw/2)*2:trunc(ih/2)*2', 'scale=out_color_matrix=bt601:out_range=full', 'format=yuv420p'].filter(Boolean).join(',');
    await run(ffmpeg, ['-v', 'error', '-nostdin', '-y', '-noautorotate', '-i', source, '-frames:v', '1', '-vf', filters, '-c:v', 'libx265', '-preset', 'medium',
      '-x265-params', `crf=${crfOf(quality)}:range=full:colormatrix=smpte170m:log-level=error`, '-tag:v', 'hvc1', '-color_range', 'pc', '-f', 'mp4', out], hold);
    const picture = mp4Picture(await fs.promises.readFile(out));
    return muxHeic({ ...picture, icc: isJpeg ? jpegIcc(input) : null, exif: uprightExif(exif) });
  } finally {
    fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** JPG / PNG -> HEIC file at target (which must not exist) */
async function toHeicFile(source, target, { quality, ffmpeg, hold, platform = process.platform } = {}) {
  if (platform === 'darwin') {
    const part = target + '.part.heic';
    try {
      await run('/usr/bin/sips', ['-s', 'format', 'heic', '-s', 'formatOptions', String(clampQuality(quality)), source, '--out', part], hold);
      await fs.promises.copyFile(part, target, fs.constants.COPYFILE_EXCL);
    } finally {
      await fs.promises.rm(part, { force: true });
    }
    return;
  }
  if (!ffmpeg) throw new Error('ffmpeg is not installed.');
  await fs.promises.writeFile(target, await encodeHeic(ffmpeg, source, { quality, hold }), { flag: 'wx' });
}

module.exports = { isHeic, isHeicSource, decode, stopWorker, readHeic, jpegExif, jpegIcc, exifOrientation, uprightExif, jpegWithMeta, heicMeta, muxHeic, mp4Picture, encodeHeic, toHeicFile, clampQuality, crfOf };
