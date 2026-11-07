'use strict';
// Utility process of aymusic.js: one process renders one chip music track (a fresh process is about 10 times faster than a second
// worker thread in the main process, which Electron slows down). The chip emulator and the decoders (src/main/ay) are plain scripts.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, 'ay');
const order = ['ay.js', 'z80.js', 'pt2.js', ...fs.readdirSync(dir).filter((f) => /^fmt_.*\.js$/.test(f)).sort()];
const engine = order.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

const glue = `
function wav(r) {
  const n = r.L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(r.rate, 24); buf.writeUInt32LE(r.rate * 4, 28);
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  const c = (v) => Math.max(-1, Math.min(1, v)) * 32767 | 0;
  for (let i = 0; i < n; i++) { buf.writeInt16LE(c(r.L[i]), 44 + i * 4); buf.writeInt16LE(c(r.R[i]), 46 + i * 4); }
  return buf;
}
process.parentPort.on('message', (e) => {
  const m = e.data;
  try {
    const t0 = Date.now();
    const f = FORMATS.find((x) => x.exts.includes(m.ext));
    if (!f) throw new Error('Unknown format: ' + m.ext);
    const player = f.create(new Uint8Array(m.bytes), m.ext);
    const r = renderModule(player, { maxSeconds: m.maxSeconds, loops: 1 });
    if (!r.L.length) throw new Error('The file has no music in it.');
    const buf = wav(r);
    process.parentPort.postMessage({ wav: buf, title: String(player.title || '').trim(), seconds: r.L.length / r.rate, format: f.name, ms: Date.now() - t0 });
  } catch (err) {
    process.parentPort.postMessage({ error: String((err && err.message) || err) });
  }
});
`;
vm.runInThisContext(engine + '\n' + glue, { filename: 'aymusic-engine.js' });
