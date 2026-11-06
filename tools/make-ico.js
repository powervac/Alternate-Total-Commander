'use strict';
// PNG files (256, 48, 32, 16 px; made from build/icon.png by the caller) -> build/icon.ico for the Windows shortcut.
// usage: node tools/make-ico.js <folder with cmdr-icon-<size>.png>
const fs = require('fs');
const path = require('path');
const dir = process.argv[2] || process.env.TEMP;
const sizes = [256, 48, 32, 16];
const pngs = sizes.map((s) => ({ s, data: fs.readFileSync(path.join(dir, `cmdr-icon-${s}.png`)) }));
const head = Buffer.alloc(6 + 16 * pngs.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
let offset = head.length;
pngs.forEach((p, i) => {
  const o = 6 + i * 16;
  head[o] = p.s >= 256 ? 0 : p.s; head[o + 1] = p.s >= 256 ? 0 : p.s; head[o + 2] = 0; head[o + 3] = 0;
  head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(p.data.length, o + 8); head.writeUInt32LE(offset, o + 12);
  offset += p.data.length;
});
fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.ico'), Buffer.concat([head, ...pngs.map((p) => p.data)]));
console.log(`build/icon.ico written: ${sizes.join(', ')} px`);
