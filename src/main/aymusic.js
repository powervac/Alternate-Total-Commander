'use strict';
// ZX Spectrum / Atari ST / CPC chip music (AY-3-8910, YM2149): pt3, pt2, pt1, stc, st1, st3, stp, sqt, asc, psc, psm, ftc, gtr, ay, ayc,
// psg, tsd, vtx, ym, vortex text. The decoders and the chip emulator (src/main/ay, from the pt2player project) are plain scripts with the
// registry FORMATS and renderModule(player, opts); each track is rendered in its own utility process (aymusic-proc.js), so a long track never freezes the window.
// The player of the renderer asks for a whole track and gets a WAV (16-bit, stereo, 44.1 kHz) that the audio element plays and seeks.
const path = require('path');
const { utilityProcess } = require('electron');

/** extensions the music player takes (txt = Vortex text modules and sna = snapshots are left out on purpose: too ambiguous / heavy) */
const AY_EXTS = ['pt3', 'pt2', 'pt1', 'stc', 'st1', 'st3', 'stp', 'sqt', 'asc', 'psc', 'psm', 'ftc', 'gtr', 'ay', 'ayc', 'psg', 'tsd', 'vtx', 'ym'];

const MAX_SECONDS = 900; // an endless module stops here (900 s of stereo 16-bit = 160 MB of WAV)

// One process per track: a second worker thread in the main process rendered up to 10 times slower in Electron; a fresh process is fast
// every time (about 1 s per 2 minutes of music).
const running = new Set();

/** bytes: Buffer of the module; ext: lower case extension. Resolves { wav: Buffer, title, seconds, format } or { error } */
function render(bytes, ext) {
  return new Promise((resolve) => {
    if (!AY_EXTS.includes(ext)) return resolve({ error: 'Not a chip music format: ' + ext });
    let done = false;
    let child;
    const finish = (r) => { if (!done) { done = true; running.delete(child); try { child.kill(); } catch { /* gone */ } resolve(r); } };
    try { child = utilityProcess.fork(path.join(__dirname, 'aymusic-proc.js'), [], { serviceName: 'Chip music decoder' }); } catch (e) { return resolve({ error: e.message }); }
    running.add(child);
    child.on('message', (m) => finish(m.error ? { error: m.error } : { wav: Buffer.from(m.wav), title: m.title, seconds: m.seconds, format: m.format, ms: m.ms }));
    child.on('exit', () => finish({ error: 'The music decoder stopped.' }));
    child.postMessage({ bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), ext, maxSeconds: MAX_SECONDS });
  });
}

function shutdown() {
  for (const c of running) { try { c.kill(); } catch { /* gone */ } }
  running.clear();
}

module.exports = { AY_EXTS, render, shutdown };
