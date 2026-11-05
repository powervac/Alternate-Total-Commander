'use strict';
// Draws build/icon.png (1024x1024): two file panels on a rounded blue tile. Run: node tools/make-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const S = 1024;
const buf = Buffer.alloc(S * S * 4);

const inRound = (x, y, x0, y0, w, h, r) => {
  if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
  const cx = Math.min(Math.max(x, x0 + r), x0 + w - r - 1);
  const cy = Math.min(Math.max(y, y0 + r), y0 + h - r - 1);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function colorAt(x, y) {
  if (!inRound(x, y, 0, 0, S, S, 200)) return null;
  let c = mix([44, 84, 144], [20, 36, 72], y / S); // tile background
  const panel = (x0) => {
    const y0 = 190, w = 400, h = 650;
    if (!inRound(x, y, x0, y0, w, h, 34)) return false;
    c = [244, 247, 251];
    if (y < y0 + 86) c = [157, 182, 212]; // path bar
    else {
      const row = Math.floor((y - (y0 + 86)) / 74);
      if (x0 < S / 2 && row === 1) c = [207, 227, 247]; // the cursor row of the left panel
      if ((y - (y0 + 86)) % 74 < 4) c = [222, 228, 238]; // row separators
      if (row >= 0 && row <= 7 && x > x0 + 36 && x < x0 + 36 + 50 && (y - (y0 + 86)) % 74 > 18 && (y - (y0 + 86)) % 74 < 54) c = [232, 183, 60]; // folder icons
      if (row >= 0 && row <= 7 && x > x0 + 110 && x < x0 + 110 + 180 - ((row * 37) % 90) && (y - (y0 + 86)) % 74 > 28 && (y - (y0 + 86)) % 74 < 44) c = [120, 135, 160]; // file names
    }
    return true;
  };
  panel(104) || panel(520);
  return c;
}

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const c = colorAt(x, y);
    const o = (y * S + x) * 4;
    if (c) { buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255; }
  }
}

// PNG encoding
function crc32(b) {
  let crc = 0xffffffff;
  for (let n = 0; n < b.length; n++) {
    let c = (crc ^ b[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) buf.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6; // 8 bit RGBA
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const out = path.join(__dirname, '..', 'build', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('wrote', out, (png.length / 1024).toFixed(0) + ' KB');
