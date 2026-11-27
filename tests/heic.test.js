'use strict';
// HEIC: written with the bundled ffmpeg and our own container, read back with libheif (an independent reader of the format).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const heic = require('../src/main/heic');

let ffmpeg = null;
try { ffmpeg = require('ffmpeg-static'); } catch { /* not installed */ }
const have = !!ffmpeg && fs.existsSync(ffmpeg);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heictest-'));
test.after(async () => { await heic.stopWorker(); fs.rmSync(dir, { recursive: true, force: true }); });

/** an EXIF block with one entry: the orientation */
const exifWith = (orientation) => {
  const t = Buffer.alloc(26);
  t.write('II', 0, 'latin1'); t.writeUInt16LE(42, 2); t.writeUInt32LE(8, 4); t.writeUInt16LE(1, 8);
  t.writeUInt16LE(0x0112, 10); t.writeUInt16LE(3, 12); t.writeUInt32LE(1, 14); t.writeUInt16LE(orientation, 18);
  return t;
};
/** a JPEG of w x h: left half red, right half blue */
function jpeg(name, w, h, { exif = null, icc = null } = {}) {
  const file = path.join(dir, name);
  const r = spawnSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=red:s=${w / 2}x${h}`, '-f', 'lavfi', '-i', `color=blue:s=${w - w / 2}x${h}`, '-filter_complex', 'hstack,format=yuvj444p', '-frames:v', '1', '-q:v', '2', file]);
  assert.strictEqual(r.status, 0, String(r.stderr));
  if (exif || icc) fs.writeFileSync(file, heic.jpegWithMeta(fs.readFileSync(file), { exif, icc }));
  return file;
}
/** [r, g, b] of a pixel of a decoded (BGRA) picture */
const pixel = (img, x, y) => { const i = (y * img.width + x) * 4; return [img.data[i + 2], img.data[i + 1], img.data[i]]; };
const near = (got, want, what) => assert.ok(got.every((v, i) => Math.abs(v - want[i]) < 40), `${what}: ${got} instead of ${want}`);

test('names', () => {
  for (const n of ['a.heic', 'b.HEIF']) assert.ok(heic.isHeic(n));
  for (const n of ['a.jpg', 'heic', 'a.heic.txt']) assert.ok(!heic.isHeic(n));
  assert.ok(heic.isHeicSource('x.JPEG') && heic.isHeicSource('x.png') && !heic.isHeicSource('x.gif'));
});

test('quality becomes the CRF of x265', () => {
  assert.ok(heic.crfOf(100) < heic.crfOf(90) && heic.crfOf(90) < heic.crfOf(50));
  assert.strictEqual(heic.crfOf(undefined), heic.crfOf(90));
  assert.strictEqual(heic.clampQuality(500), 100);
});

test('EXIF and the colour profile go into a JPEG and come out again', () => {
  const base = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const icc = Buffer.alloc(150000, 7); // more than one segment
  const out = heic.jpegWithMeta(base, { exif: exifWith(6), icc });
  assert.ok(heic.jpegExif(out).equals(exifWith(6)));
  assert.ok(heic.jpegIcc(out).equals(icc));
  assert.strictEqual(heic.exifOrientation(heic.jpegExif(out)), 6);
  assert.strictEqual(heic.exifOrientation(heic.uprightExif(heic.jpegExif(out))), 1);
  assert.strictEqual(heic.exifOrientation(null), 1);
  assert.strictEqual(heic.exifOrientation(Buffer.from('garbage garbage garbage')), 1);
});

test('damaged data gives no metadata instead of an error', () => {
  for (const b of [Buffer.alloc(0), Buffer.alloc(64, 0xff), Buffer.from('....ftypheic....meta')]) assert.deepStrictEqual(heic.heicMeta(b), { exif: null, icc: null });
});

test('JPG -> HEIC -> libheif: the same picture, with EXIF and colour profile', { skip: !have }, async () => {
  const icc = Buffer.alloc(560, 0); icc.writeUInt32BE(560, 0); icc.write('mntrRGB XYZ ', 12, 'latin1'); icc.write('acsp', 36, 'latin1');
  const src = jpeg('a.jpg', 320, 200, { exif: exifWith(1), icc });
  const target = path.join(dir, 'a.heic');
  await heic.toHeicFile(src, target, { quality: 92, ffmpeg }); // the way of the system the test runs on
  const bytes = fs.readFileSync(target);
  assert.strictEqual(bytes.toString('latin1', 4, 12), 'ftypheic');
  const meta = heic.heicMeta(bytes);
  if (process.platform !== 'darwin') { // sips writes its own copy of both
    assert.ok(meta.exif && meta.exif.equals(exifWith(1)), 'EXIF kept');
    assert.ok(meta.icc && meta.icc.equals(icc), 'colour profile kept');
  }
  const img = await heic.decode(bytes);
  assert.deepStrictEqual([img.width, img.height], [320, 200]);
  near(pixel(img, 20, 100), [255, 0, 0], 'left is red');
  near(pixel(img, 300, 100), [0, 0, 255], 'right is blue');
  await assert.rejects(heic.toHeicFile(src, target, { ffmpeg }), /EEXIST/);
});

test('a photo marked as turned is stored the right way up', { skip: !have }, async () => {
  // orientation 6: shown turned 90 degrees clockwise - the left (red) side goes to the top
  const src = jpeg('turned.jpg', 320, 200, { exif: exifWith(6) });
  const bytes = await heic.encodeHeic(ffmpeg, src, { quality: 92 });
  const img = await heic.decode(bytes);
  assert.deepStrictEqual([img.width, img.height], [200, 320]);
  near(pixel(img, 100, 20), [255, 0, 0], 'top is red');
  near(pixel(img, 100, 300), [0, 0, 255], 'bottom is blue');
  assert.strictEqual(heic.exifOrientation(heic.heicMeta(bytes).exif), 1);
});

test('odd sizes lose at most one line', { skip: !have }, async () => {
  const src = path.join(dir, 'odd.jpg');
  assert.strictEqual(spawnSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=green:s=320x200', '-vf', 'format=yuvj444p,scale=323:201', '-frames:v', '1', src]).status, 0);
  const img = await heic.decode(await heic.encodeHeic(ffmpeg, src, {}));
  assert.deepStrictEqual([img.width, img.height], [322, 200]);
});

test('a file that is not HEIC gives an error, and the decoder keeps working', { skip: !have }, async () => {
  await assert.rejects(heic.decode(Buffer.from('this is not a picture at all, not even close')));
  const img = await heic.decode(await heic.encodeHeic(ffmpeg, jpeg('again.jpg', 64, 64), {}));
  assert.strictEqual(img.width, 64);
});

test('what a file really is shows in its first bytes, not in its name', () => {
  const b = (s) => Buffer.from(s, 'latin1');
  assert.strictEqual(heic.sniff(b('\xff\xd8\xff\xe0 rest')), 'jpeg');
  assert.strictEqual(heic.sniff(b('\x89PNG\r\n')), 'png');
  assert.strictEqual(heic.sniff(b('GIF89a....')), 'gif');
  assert.strictEqual(heic.sniff(b('RIFF....WEBPVP8 ')), 'webp');
  assert.strictEqual(heic.sniff(b('\0\0\0\x18ftypheic\0\0\0\0')), 'heif');
  assert.strictEqual(heic.sniff(b('hello')), null);
  assert.strictEqual(heic.sniff(Buffer.alloc(0)), null);
  assert.match(heic.describe(b('\xff\xd8\xff\xe0 rest')), /really a JPEG/);
  assert.match(heic.describe(Buffer.alloc(100)), /not a picture.*0000000000000000/);
});

test('the account of a HEIC names its kind and parts, and says when it is cut off', { skip: !have }, async () => {
  const bytes = await heic.encodeHeic(ffmpeg, jpeg('d.jpg', 64, 64), {});
  assert.match(heic.describe(bytes), /^kind heic, parts hvc1$/);
  assert.match(heic.describe(bytes.subarray(0, bytes.length - 100)), /incomplete or damaged/);
});
