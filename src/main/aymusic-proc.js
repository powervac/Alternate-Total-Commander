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
process.parentPort.on('message', (e) => {
  const m = e.data;
  try {
    const t0 = Date.now();
    const f = FORMATS.find((x) => x.exts.includes(m.ext));
    if (!f) throw new Error('Unknown format: ' + m.ext);
    const player = f.create(new Uint8Array(m.bytes), m.ext);
    const r = renderModule(player, { maxSeconds: m.maxSeconds, loops: 1 });
    if (!r.L.length) throw new Error('The file has no music in it.');
    const buf = toWav(r);
    process.parentPort.postMessage({ wav: buf, title: String(player.title || '').trim(), seconds: r.L.length / r.rate, format: f.name, ms: Date.now() - t0 });
  } catch (err) {
    process.parentPort.postMessage({ error: String((err && err.message) || err) });
  }
});
`;
globalThis.toWav = require('./aywav').toWav;
vm.runInThisContext(engine + '\n' + glue, { filename: 'aymusic-engine.js' });
