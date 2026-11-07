'use strict';
// 16-bit stereo PCM WAV file from the float channels of renderModule() ({ L, R, rate }); samples are clipped to [-1, 1].

function toWav(r) {
  const n = r.L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); // size of the fmt chunk
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // channels
  buf.writeUInt32LE(r.rate, 24);
  buf.writeUInt32LE(r.rate * 4, 28); // bytes per second
  buf.writeUInt16LE(4, 32); // bytes per frame
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  const clip = (v) => (Math.max(-1, Math.min(1, v)) * 32767) | 0;
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(clip(r.L[i]), 44 + i * 4);
    buf.writeInt16LE(clip(r.R[i]), 46 + i * 4);
  }
  return buf;
}

module.exports = { toWav };
