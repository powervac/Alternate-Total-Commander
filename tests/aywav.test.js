'use strict';
// WAV writer of the chip music (src/main/aywav.js): the header fields byte by byte, the sample conversion, clipping and channel order.
// (tests/TEST_METHODS.md, WAV-*)
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { toWav } = require('../src/main/aywav');

const wav = (L, R, rate = 44100) => toWav({ L: Float32Array.from(L), R: Float32Array.from(R), rate });

describe('WAV writer', () => {
  it('WAV-H1 the header of 3 stereo samples at 44100 Hz, field by field', () => {
    const b = wav([0, 0, 0], [0, 0, 0]);
    assert.equal(b.length, 44 + 12);
    assert.equal(b.toString('ascii', 0, 4), 'RIFF');
    assert.equal(b.readUInt32LE(4), 36 + 12);
    assert.equal(b.toString('ascii', 8, 16), 'WAVEfmt ');
    assert.equal(b.readUInt32LE(16), 16);
    assert.equal(b.readUInt16LE(20), 1); // PCM
    assert.equal(b.readUInt16LE(22), 2); // stereo
    assert.equal(b.readUInt32LE(24), 44100);
    assert.equal(b.readUInt32LE(28), 44100 * 4);
    assert.equal(b.readUInt16LE(32), 4);
    assert.equal(b.readUInt16LE(34), 16);
    assert.equal(b.toString('ascii', 36, 40), 'data');
    assert.equal(b.readUInt32LE(40), 12);
  });

  it('WAV-H2 the rate of the result is written (22050, 48000) and the byte rate follows it', () => {
    for (const rate of [8000, 22050, 48000, 96000]) {
      const b = wav([0], [0], rate);
      assert.equal(b.readUInt32LE(24), rate);
      assert.equal(b.readUInt32LE(28), rate * 4);
    }
  });

  it('WAV-H3 no samples: a 44 byte file with sizes 36 and 0', () => {
    const b = wav([], []);
    assert.equal(b.length, 44);
    assert.equal(b.readUInt32LE(4), 36);
    assert.equal(b.readUInt32LE(40), 0);
  });

  it('WAV-H4 the sizes grow with the length: 1000 samples', () => {
    const b = wav(new Array(1000).fill(0), new Array(1000).fill(0));
    assert.equal(b.length, 44 + 4000);
    assert.equal(b.readUInt32LE(4), 36 + 4000);
    assert.equal(b.readUInt32LE(40), 4000);
  });

  it('WAV-S1 samples are 16-bit little endian, left first then right, truncated toward zero', () => {
    const b = wav([0, 1, -1, 0.5, -0.5, 0.25], [1, 0, 0.5, -1, 0.5, -0.25]);
    const s = [];
    for (let i = 0; i < 6; i++) s.push([b.readInt16LE(44 + i * 4), b.readInt16LE(46 + i * 4)]);
    assert.deepEqual(s, [
      [0, 32767], [32767, 0], [-32767, 16383], [16383, -32767], [-16383, 16383], [8191, -8191],
    ]);
  });

  it('WAV-S2 values beyond [-1, 1] are clipped; tiny values become 0', () => {
    const b = wav([2, -2, 100, -100, 1e-6, -1e-6], [1.0001, -1.0001, Infinity, -Infinity, 3e-5, -3e-5]);
    const L = [0, 1, 2, 3, 4, 5].map((i) => b.readInt16LE(44 + i * 4));
    const R = [0, 1, 2, 3, 4, 5].map((i) => b.readInt16LE(46 + i * 4));
    assert.deepEqual(L, [32767, -32767, 32767, -32767, 0, 0]);
    assert.deepEqual(R, [32767, -32767, 32767, -32767, 0, 0]);
  });

  it('WAV-S3 the two channels are independent (left only, right only)', () => {
    const b = wav([0.5, 0.5], [0, 0]);
    assert.equal(b.readInt16LE(46), 0);
    assert.equal(b.readInt16LE(44), 16383);
    const c = wav([0, 0], [0.5, 0.5]);
    assert.equal(c.readInt16LE(44), 0);
    assert.equal(c.readInt16LE(46), 16383);
  });

  it('WAV-S4 a plain array and a Float64Array work as well as Float32Array', () => {
    const b = toWav({ L: [0.5], R: new Float64Array([-0.5]), rate: 44100 });
    assert.equal(b.readInt16LE(44), 16383);
    assert.equal(b.readInt16LE(46), -16383);
  });

  it('WAV-S5 a sine wave survives: full scale 440 Hz for 0.1 s has the right peak and zero crossings', () => {
    const n = 4410;
    const L = Float32Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * 440 * i / 44100));
    const b = toWav({ L, R: L, rate: 44100 });
    let peak = 0; let cross = 0; let prev = 0;
    for (let i = 0; i < n; i++) {
      const v = b.readInt16LE(44 + i * 4);
      peak = Math.max(peak, Math.abs(v));
      if (prev < 0 && v >= 0) cross++;
      prev = v;
    }
    assert.ok(peak >= 32760 && peak <= 32767);
    assert.ok(cross >= 43 && cross <= 45, 'crossings ' + cross);
  });
});
