'use strict';
// AY-3-8910 / YM2149 chip emulator (src/main/ay/ay.js), renderModule() and the PSG register stream format (src/main/ay/fmt_psg.js).
// Method: the chip is a measuring instrument problem: tone frequency by counting edges, levels by the (known) volume table and pan,
// the envelope and the noise against independent reference models written from the data sheet (tests/TEST_METHODS.md, AY-*).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadEngine } = require('./helpers/engine');

const { AYChip, renderModule } = loadEngine(['ay.js'], ['AYChip', 'renderModule']);
const { FORMATS, TSPlayer, createTS, PSGPlayer } = loadEngine(['ay.js', 'pt2.js', 'fmt_psg.js'], ['FORMATS', 'TSPlayer', 'createTS', 'PSGPlayer']);

const CLOCK = 1773400;
const VOL = [0, 0.0137, 0.0205, 0.0291, 0.0423, 0.0618, 0.0847, 0.1369, 0.1691, 0.2647, 0.3527, 0.4499, 0.5704, 0.6873, 0.8482, 1];
const plain = (x) => JSON.parse(JSON.stringify(x)); // data from the vm context has the arrays of another realm
const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (+-${eps})`);

/** a register file: regs({ 0: lo, 1: hi, 7: mixer, 8: vol ... }), reg 13 untouched (255) unless given */
function regs(o = {}) {
  const r = new Array(14).fill(0);
  r[13] = 255;
  for (const [k, v] of Object.entries(o)) r[+k] = v;
  return r;
}
function render(o, n = 44100, chip = new AYChip()) {
  chip.write(regs(o));
  const L = new Float32Array(n); const R = new Float32Array(n);
  chip.render(L, R, 0, n);
  return { L, R, chip };
}
/** rising edges of a square wave in a signal that swings between lo and hi */
function edges(sig, lo, hi) {
  const mid = (lo + hi) / 2;
  let n = 0;
  for (let i = 1; i < sig.length; i++) if (sig[i - 1] < mid && sig[i] >= mid) n++;
  return n;
}
const tone = (ch, p) => ({ [ch * 2]: p & 255, [ch * 2 + 1]: p >> 8 });
const ALL_OFF = 0x3f; // mixer: no tone, no noise on any channel (the chip then outputs its volume as a constant)
const only = (ch) => ((0x3f & ~(1 << ch)) | 0); // tone of channel ch on, everything else off

// ---------------------------------------------------------------- tone
describe('AY tone generator', () => {
  for (const p of [20, 100, 255, 564, 1000, 4095]) {
    for (const ch of [0, 1, 2]) {
      it(`AY-T1 channel ${'ABC'[ch]}, period ${p}: ${(CLOCK / 16 / p).toFixed(1)} Hz`, () => {
        const pan = [[0.7, 0.3], [0.5, 0.5], [0.3, 0.7]][ch];
        const { L } = render({ ...tone(ch, p), 7: only(ch), [8 + ch]: 15 });
        const hi = pan[0] * 0.6;
        assert.ok(Math.abs(edges(L, 0, hi) - CLOCK / 16 / p) <= 1.5 + CLOCK / 16 / p * 0.01, `edges ${edges(L, 0, hi)}`);
        near(Math.max(...L), hi, 1e-4);
        near(Math.min(...L), 0, 1e-4);
      });
    }
  }

  it('AY-T2 the high nibble of the period is 4 bits: 0xF2 in the high register is 2', () => {
    const a = render({ ...tone(0, 0x0234), 7: only(0), 8: 15 });
    const b = render({ 0: 0x34, 1: 0xf2, 7: only(0), 8: 15 });
    assert.equal(b.chip.r[1], 2);
    assert.deepEqual(a.L, b.L);
  });

  it('AY-T3 period 0 sounds like period 1', () => {
    assert.deepEqual(render({ ...tone(0, 0), 7: only(0), 8: 15 }, 5000).L, render({ ...tone(0, 1), 7: only(0), 8: 15 }, 5000).L);
  });

  it('AY-T4 the mixer: a channel with tone off is a constant (its volume); with tone on it is a square wave', () => {
    const { L } = render({ ...tone(0, 200), 7: 0x3e, 8: 15, 9: 15, 10: 15 }); // A tone on; B and C constant
    near(Math.min(...L), (0.5 + 0.3) * 0.6, 1e-4);
    near(Math.max(...L), (0.7 + 0.5 + 0.3) * 0.6, 1e-4);
    const dc = render({ 7: ALL_OFF, 8: 15, 9: 15, 10: 15 }, 1000);
    for (let i = 0; i < 1000; i++) { near(dc.L[i], 0.9, 1e-5); near(dc.R[i], 0.9, 1e-5); }
  });

  it('AY-T5 each mixer bit belongs to its channel: bit n switches the tone of channel n', () => {
    for (let ch = 0; ch < 3; ch++) {
      const o = { 7: 0x3f & ~(1 << ch), 8: 15, 9: 15, 10: 15, ...tone(0, 300), ...tone(1, 300), ...tone(2, 300) };
      const { L } = render(o, 20000);
      const lo = ((ch !== 0 ? 0.7 : 0) + (ch !== 1 ? 0.5 : 0) + (ch !== 2 ? 0.3 : 0)) * 0.6; // the other two stay constant
      const hi = lo + [0.7, 0.5, 0.3][ch] * 0.6;
      near(Math.min(...L), lo, 1e-4);
      near(Math.max(...L), hi, 1e-4);
    }
  });

  it('AY-T6 pan: A is left, B centre, C right (levels at full volume)', () => {
    const pans = [[0.42, 0.18], [0.3, 0.3], [0.18, 0.42]];
    for (let ch = 0; ch < 3; ch++) {
      const { L, R } = render({ 7: ALL_OFF, [8 + ch]: 15 }, 100);
      near(L[50], pans[ch][0], 1e-5);
      near(R[50], pans[ch][1], 1e-5);
    }
  });

  it('AY-T7 the 16 volume steps are the table of the chip (x pan x 0.6)', () => {
    for (let v = 0; v < 16; v++) near(render({ 7: ALL_OFF, 8: v }, 100).L[50], VOL[v] * 0.42, 1e-5);
  });

  it('AY-T8 the volume register uses the low 4 bits; bits 5-7 are ignored; bit 4 selects the envelope', () => {
    near(render({ 7: ALL_OFF, 8: 0xe0 | 7 }, 100).L[50], VOL[7] * 0.42, 1e-5);
    near(render({ 7: ALL_OFF, 8: 0x10 | 7, 11: 255, 12: 255, 13: 0 }, 100).L[50], VOL[15] * 0.42, 1e-5); // envelope bit: the (slow) envelope starts at 15 and the volume 7 is not used
    near(render({ 7: ALL_OFF, 8: 0x10 | 7, 11: 255, 12: 255, 13: 4 }, 100).L[50], 0, 0.002); // shape 4 starts at 0
  });

  it('AY-T9 write() copies registers 0-12 only and masks the unused bits (1,3,5: 4 bits; 6: 5 bits)', () => {
    const c = new AYChip();
    c.write(regs({ 0: 255, 1: 255, 2: 254, 3: 0x1f, 4: 7, 5: 0xaa, 6: 0xff, 7: 0x38, 8: 9, 9: 10, 10: 11, 11: 12, 12: 13 }));
    assert.deepEqual([...c.r.slice(0, 13)], [255, 15, 254, 15, 7, 10, 31, 0x38, 9, 10, 11, 12, 13]);
    assert.equal(c.r[13], 0);
  });

  it('AY-T10 the chip clock and the sample rate set the pitch: half the clock = half the frequency', () => {
    const f = (clock, rate = 44100) => edges(render({ ...tone(0, 100), 7: only(0), 8: 15 }, rate, new AYChip(clock, rate)).L, 0, 0.42);
    assert.ok(Math.abs(f(CLOCK) - 1108) <= 3);
    assert.ok(Math.abs(f(CLOCK / 2) - 554) <= 3);
    assert.ok(Math.abs(f(CLOCK, 22050) - 1108) <= 6); // the same tone from a 22 kHz render
  });

  it('AY-T11 the constructor: defaults and given values', () => {
    const c = new AYChip();
    near(c.step, CLOCK / 8 / 44100, 1e-9);
    assert.deepEqual(plain(c.pan), [[0.7, 0.3], [0.5, 0.5], [0.3, 0.7]]);
    assert.equal(c.lfsr, 1);
    assert.equal(c.ehold, true);
    const d = new AYChip(2000000, 48000);
    near(d.step, 2000000 / 8 / 48000, 1e-9);
    assert.equal(d.fxRate, 48000);
  });

  it('AY-T12 render() fills exactly n samples from the offset and touches nothing else', () => {
    const c = new AYChip();
    c.write(regs({ 7: ALL_OFF, 8: 15 }));
    const L = new Float32Array(10).fill(-7); const R = new Float32Array(10).fill(-7);
    c.render(L, R, 3, 4);
    assert.deepEqual([...L].map((v) => v === -7), [true, true, true, false, false, false, false, true, true, true]);
    assert.deepEqual([...R].map((v) => v === -7), [...L].map((v) => v === -7));
  });
});

// ---------------------------------------------------------------- noise
describe('AY noise generator', () => {
  /** the 17-bit LFSR of the chip, from the data sheet: the sequence of output bits after each step */
  function lfsrRef(n) {
    let l = 1; const out = [];
    for (let i = 0; i < n; i++) { const b = (l ^ (l >> 3)) & 1; l = (l >> 1) | (b << 16); out.push(l & 1); }
    return out;
  }
  function noiseSeq(period, steps) {
    const c = new AYChip();
    c.write(regs({ 6: period, 7: ALL_OFF }));
    const o = [0, 0, 0]; const seq = [];
    for (let s = 0; s < steps; s++) { for (let t = 0; t < 2 * (period & 31 || 1); t++) c.tick(o); seq.push(c.nout); }
    return seq;
  }

  for (const p of [1, 2, 5, 17, 31]) {
    it(`AY-N1 noise period ${p}: the shift register steps every ${2 * p} chip ticks and follows the 17-bit LFSR`, () => {
      assert.deepEqual(noiseSeq(p, 300), lfsrRef(300));
    });
  }

  it('AY-N2 period 0 is 1; the period has 5 bits (0xE5 is 5)', () => {
    assert.deepEqual(noiseSeq(0, 100), lfsrRef(100));
    const a = new AYChip(); a.write(regs({ 6: 0xe5 }));
    assert.equal(a.r[6], 5);
  });

  it('AY-N3 noise reaches the output: only noise on channel A is a random 0 / level signal with about half ones', () => {
    const { L } = render({ 6: 3, 7: 0x37, 8: 15 }, 44100);
    const hi = 0.42;
    let ones = 0;
    for (const v of L) { assert.ok(v >= -1e-6 && v <= hi + 1e-6); if (v > hi / 2) ones++; }
    assert.ok(ones / L.length > 0.45 && ones / L.length < 0.55, `ones ${ones / L.length}`);
  });

  it('AY-N4 tone and noise together on one channel are ANDed: it is silent while either one is low', () => {
    const noiseOnly = render({ 6: 4, 7: 0x37, 8: 15 }, 30000).L;
    const both = render({ 6: 4, 7: 0x36, 8: 15, ...tone(0, 60) }, 30000).L;
    let more = 0;
    for (let i = 0; i < both.length; i++) { if (both[i] > noiseOnly[i] + 1e-4) more++; }
    assert.equal(more, 0);
    assert.ok(both.reduce((a, b) => a + b, 0) < noiseOnly.reduce((a, b) => a + b, 0) * 0.8);
  });
});

// ---------------------------------------------------------------- envelope
describe('AY envelope generator', () => {
  /** reference model from the data sheet: the volume after each step, for shape bits CONT(8) ATT(4) ALT(2) HOLD(1) */
  function envRef(shape, steps) {
    const cont = !!(shape & 8); const att = !!(shape & 4); const alt = !!(shape & 2); const hold = !!(shape & 1);
    let v = att ? 0 : 15; let dir = att ? 1 : -1; let held = false; const out = [];
    for (let i = 0; i < steps; i++) {
      if (!held) {
        v += dir;
        if (v < 0 || v > 15) {
          if (!cont) { v = 0; held = true; }
          else if (hold) { held = true; v = att !== alt ? 15 : 0; }
          else if (alt) { dir = -dir; v = dir > 0 ? 0 : 15; }
          else v = dir > 0 ? 0 : 15;
        }
      }
      out.push(v);
    }
    return out;
  }
  function envSeq(shape, steps, period = 1) {
    const c = new AYChip();
    c.write(regs({ 11: period & 255, 12: period >> 8, 13: shape }));
    const o = [0, 0, 0]; const seq = [];
    for (let s = 0; s < steps; s++) { for (let t = 0; t < 2 * (period || 1); t++) c.tick(o); seq.push(c.evol); }
    return seq;
  }

  for (let shape = 0; shape < 16; shape++) {
    it(`AY-E1 shape ${shape}: 70 steps follow the data sheet`, () => {
      assert.deepEqual(envSeq(shape, 70), envRef(shape, 70));
    });
  }

  it('AY-E2 the envelope steps every 2 x period chip ticks: periods 1, 3, 256 (high byte), 0 (= 1)', () => {
    for (const p of [1, 3, 256, 0]) {
      const c = new AYChip();
      c.write(regs({ 11: p & 255, 12: p >> 8, 13: 12 })); // shape 12: rises 0 -> 15 and repeats
      const o = [0, 0, 0];
      const every = 2 * (p || 1);
      for (let t = 0; t < every * 5; t++) { c.tick(o); assert.equal(c.evol, Math.floor((t + 1) / every), `p=${p} tick ${t + 1}`); }
    }
  });

  it('AY-E3 only writing register 13 restarts the envelope; the value 255 (not written) keeps it running; the shape has 4 bits', () => {
    const c = new AYChip();
    c.write(regs({ 11: 1, 13: 12 }));
    const o = [0, 0, 0];
    for (let t = 0; t < 12; t++) c.tick(o);
    assert.equal(c.evol, 6);
    c.write(regs({ 11: 1 })); // reg 13 = 255
    assert.equal(c.evol, 6);
    c.write(regs({ 11: 1, 13: 0x1c })); // 0x1c & 15 = 12, restarts
    assert.equal(c.shape, 12);
    assert.equal(c.evol, 0);
    assert.equal(c.ehold, false);
    c.write(regs({ 13: 0 })); // a write of the same kind of shape restarts it too
    assert.equal(c.evol, 15);
  });

  it('AY-E4 a channel with the envelope bit follows the envelope level: held 15 (shape 13) and held 0 (shape 9)', () => {
    const up = render({ 7: ALL_OFF, 8: 0x10, 11: 1, 13: 13 }, 2000);
    near(up.L[1999], VOL[15] * 0.42, 1e-5);
    near(up.L[0], 0, 0.05);
    const down = render({ 7: ALL_OFF, 8: 0x10, 11: 1, 13: 9 }, 2000);
    near(down.L[1999], 0, 1e-6);
    assert.ok(down.L[0] > 0.3);
  });

  it('AY-E5 a held envelope no longer moves', () => {
    const c = new AYChip();
    c.write(regs({ 11: 1, 13: 9 }));
    const o = [0, 0, 0];
    for (let t = 0; t < 100; t++) c.tick(o);
    assert.equal(c.ehold, true);
    assert.equal(c.evol, 0);
    for (let t = 0; t < 100; t++) c.tick(o);
    assert.equal(c.evol, 0);
  });

  it('AY-E6 the envelope runs on its own while the mixer silences the channel? (no: a tone-off channel stays at the level)', () => {
    const c = new AYChip();
    c.write(regs({ 7: ALL_OFF, 8: 0x10, 11: 1, 13: 12 }));
    const L = new Float32Array(3000); const R = new Float32Array(3000);
    c.render(L, R, 0, 3000);
    assert.ok(new Set([...L].map((v) => v.toFixed(3))).size > 8, 'the level must move through many steps');
  });
});

// ---------------------------------------------------------------- special effects of YM files
describe('AY special effects (YM SID voice, digi-drum, sync buzzer)', () => {
  it('AY-X1 a SID voice makes the channel a square wave of the given frequency, with the given level', () => {
    const c = new AYChip();
    c.write(regs({ 7: ALL_OFF }));
    c.applyFx([{ type: 'sid', voice: 0, freq: 2000, vol: 10 }]);
    const L = new Float32Array(44100); const R = new Float32Array(44100);
    c.render(L, R, 0, 44100);
    near(Math.max(...L), VOL[10] * 0.42, 1e-4);
    near(Math.min(...L), 0, 1e-4);
    // the frequency of a SID voice is the frequency of its timer: the level changes once per tick, the square wave is half of it
    assert.ok(Math.abs(edges(L, 0, VOL[10] * 0.42) - 1000) <= 3, 'edges ' + edges(L, 0, VOL[10] * 0.42));
    c.applyFx([]); // the next frame without the effect: the channel is a plain constant again
    c.write(regs({ 7: ALL_OFF, 8: 15 }));
    c.render(L, R, 0, 100);
    near(L[50], 0.42, 1e-5);
  });

  it('AY-X2 a digi-drum plays its samples (0..255 -> 0..1) one per output sample at the given rate, then the voice is normal again', () => {
    const c = new AYChip();
    c.write(regs({ 7: ALL_OFF, 9: 15 }));
    c.applyFx([{ type: 'drum', voice: 1, data: Uint8Array.from([255, 0, 51, 255]), freq: 44100 }]);
    const L = new Float32Array(8); const R = new Float32Array(8);
    c.render(L, R, 0, 8);
    near(L[0], 0.3, 1e-5);
    near(L[1], 0, 1e-5);
    near(L[2], 0.06, 1e-5);
    near(L[3], 0.3, 1e-5);
    near(L[4], VOL[15] * 0.3, 1e-5); // after the last sample the voice goes back to its own volume (B at 15 = 0.3)
    assert.equal(c.drum[1], null);
  });

  it('AY-X3 a drum at half the rate holds every sample for two outputs', () => {
    const c = new AYChip();
    c.write(regs({ 7: ALL_OFF }));
    c.applyFx([{ type: 'drum', voice: 0, data: Uint8Array.from([255, 0]), freq: 22050 }]);
    const L = new Float32Array(4); const R = new Float32Array(4);
    c.render(L, R, 0, 4);
    near(L[0], 0.42, 1e-5); near(L[1], 0.42, 1e-5); near(L[2], 0, 1e-5); near(L[3], 0, 1e-5);
  });

  it('AY-X4 a sync buzzer restarts the envelope at its frequency and takes its shape', () => {
    const c = new AYChip();
    let restarts = 0;
    const orig = c.restartEnv.bind(c);
    c.restartEnv = () => { restarts++; orig(); };
    c.write(regs({ 11: 255, 12: 255 }));
    c.applyFx([{ type: 'sync', freq: 100, shape: 0x1d }]);
    assert.equal(c.shape, 13);
    assert.equal(restarts, 1); // applying it restarts once
    const L = new Float32Array(44100); const R = new Float32Array(44100);
    c.render(L, R, 0, 44100);
    assert.ok(Math.abs(restarts - 1 - 100) <= 1, `restarts ${restarts - 1}`);
  });

  it('AY-X5 applyFx() with a new list drops the old effects', () => {
    const c = new AYChip();
    c.applyFx([{ type: 'sid', voice: 2, freq: 100, vol: 5 }, { type: 'drum', voice: 0, data: Uint8Array.from([1]), freq: 1 }, { type: 'sync', freq: 10, shape: 8 }]);
    assert.ok(c.sid[2] && c.drum[0] && c.sync);
    c.applyFx([]);
    assert.deepEqual(plain(c.sid), [null, null, null]);
    assert.equal(c.sync, null);
    assert.ok(c.drum[0], 'a drum that is still playing is not cut by the next frame');
  });
});

// ---------------------------------------------------------------- renderModule
describe('renderModule', () => {
  /** a player that sets the registers once and then plays `frames` frames */
  const player = (frames, o = {}) => {
    let f = 0;
    return {
      title: 'T', frames: 0,
      frame(r) { if (f++ >= frames) return false; for (let i = 0; i < 13; i++) r[i] = 0; Object.assign(r, o.regs || { 7: ALL_OFF, 8: 15 }); this.seen13 = r[13]; return true; },
      ...o.extra,
    };
  };

  it('AY-M1 one frame is 882 samples (44100 / 50), the result carries rate 44100, the frame count and the frame rate', () => {
    const r = renderModule(player(10));
    assert.equal(r.L.length, 8820);
    assert.equal(r.R.length, 8820);
    assert.equal(r.rate, 44100);
    assert.equal(r.frames, 10);
    assert.equal(r.frameRate, 50);
  });

  it('AY-M2 speed = tempo: a frame is shorter and the frame rate higher; pitch does not change', () => {
    const r = renderModule(player(20), { speed: 2 });
    assert.equal(r.frameRate, 100);
    assert.equal(r.L.length, 20 * 441);
    const slow = renderModule(player(10), { speed: 0.5 });
    assert.equal(slow.frameRate, 25);
    assert.equal(slow.L.length, 10 * 1764);
  });

  it('AY-M3 the player may set its own frame rate (50.0 default), fractional frames carry over: 55 Hz gives floor(N x 801.8) samples', () => {
    const p = player(1000, { extra: { frameRate: 55 } });
    const r = renderModule(p);
    assert.equal(r.frameRate, 55);
    assert.equal(r.L.length, Math.floor(1000 * 44100 / 55));
  });

  it('AY-M4 maxSeconds stops an endless module at exactly seconds x frame rate', () => {
    const r = renderModule(player(1e9), { maxSeconds: 3 });
    assert.equal(r.frames, 150);
    assert.equal(renderModule(player(1e9), { maxSeconds: 2, speed: 2 }).frames, 200);
  });

  it('AY-M5 register 13 is 255 ("not written") at the start of every frame', () => {
    const p = player(3);
    renderModule(p);
    assert.equal(p.seen13, 255);
  });

  it('AY-M6 pitch scales the chip clock: a tone is 2x higher with pitch 2; opts.clock beats player.clock beats the default', () => {
    const f = (o, extra) => edges(renderModule(player(50, { regs: { 0: 100, 7: only(0), 8: 15 }, extra }), o).L, 0, 0.42);
    const base = f({});
    assert.ok(Math.abs(base - 1108 / 2 * 1) < 600);
    assert.ok(Math.abs(f({ pitch: 2 }) / base - 2) < 0.03);
    assert.ok(Math.abs(f({}, { clock: CLOCK * 2 }) / base - 2) < 0.03);
    assert.ok(Math.abs(f({ clock: CLOCK * 4 }, { clock: CLOCK * 2 }) / base - 4) < 0.06);
    assert.ok(Math.abs(f({ clock: CLOCK * 2, pitch: 2 }) / base - 4) < 0.06);
  });

  it('AY-M7 loops: the module plays N times through loopBack(); the default is once and loopBack is not asked', () => {
    let asked = 0; let plays = 0;
    const mk = () => {
      let f = 0;
      return { frame(r) { if (f++ >= 5) return false; Object.assign(r, { 7: ALL_OFF, 8: 15 }); return true; }, loopBack() { asked++; plays++; f = 0; return true; } };
    };
    assert.equal(renderModule(mk()).frames, 5);
    assert.equal(asked, 0);
    assert.equal(renderModule(mk(), { loops: 3 }).frames, 15);
    assert.equal(asked, 2);
    asked = 0;
    const noLoop = { frame(r) { return false; } };
    assert.equal(renderModule(noLoop, { loops: 4 }).frames, 0);
    const refuses = { f: 0, frame(r) { return this.f++ < 4; }, loopBack() { return false; } };
    assert.equal(renderModule(refuses, { loops: 5 }).frames, 4);
  });

  it('AY-M8 a TurboSound player (chips = 2) drives two chips and the mix is the average', () => {
    const a = { chips: 2, frame(r1, r2) { Object.assign(r1, { 7: ALL_OFF, 8: 15 }); Object.assign(r2, { 7: ALL_OFF, 8: 0 }); return this.n++ < 3; }, n: 0 };
    const r = renderModule(a);
    near(r.L[500], 0.42 * 0.5, 1e-5);
    const b = { chips: 2, n: 0, frame(r1, r2) { Object.assign(r1, { 7: ALL_OFF, 8: 15 }); Object.assign(r2, { 7: ALL_OFF, 9: 15 }); return this.n++ < 3; } };
    near(renderModule(b).L[500], (0.42 + 0.3) * 0.5, 1e-5);
  });

  it('AY-M9 a sample based player (renderPCM) gets the options and its result is returned as it is', () => {
    const seen = [];
    const res = { L: new Float32Array(1), R: new Float32Array(1), rate: 8000 };
    const r = renderModule({ renderPCM(o) { seen.push(o); return res; } }, { loops: 2 });
    assert.equal(r, res);
    assert.equal(seen[0].loops, 2);
  });

  it('AY-M10 effects of the player (player.fx) are applied to chip 0 every frame', () => {
    const fx = [{ type: 'sid', voice: 0, freq: 1000, vol: 15 }];
    const r = renderModule(player(30, { extra: { fx } }));
    assert.ok(Math.abs(edges(r.L, 0, 0.42) - 500 * 30 / 50) <= 3, 'edges ' + edges(r.L, 0, 0.42)); // 1000 Hz timer = 500 Hz wave, for 0.6 s
  });

  it('AY-M11 onProgress is called every 256 frames with the frame count', () => {
    const seen = [];
    renderModule(player(600), { onProgress: (n) => seen.push(n) });
    assert.deepEqual(seen, [256, 512]);
  });

  it('AY-M12 a beeper (1-bit sound of the Spectrum) is added with its DC removed', () => {
    const quiet = renderModule(player(4, { regs: { 7: ALL_OFF, 8: 0 } }));
    const beep = renderModule(player(4, { regs: { 7: ALL_OFF, 8: 0 }, extra: { beeper: { start: 1, ev: [] } } }));
    assert.ok(Math.max(...quiet.L) === 0);
    assert.ok(beep.L[0] > 0.3 && beep.L[0] < 0.5);
    assert.ok(Math.abs(beep.L[beep.L.length - 1]) < 0.1 * beep.L[0], 'the DC is high-passed away');
    const toggled = renderModule(player(1, { regs: { 7: ALL_OFF, 8: 0 }, extra: { beeper: { start: 0, ev: [[35454, 1]] } } }));
    assert.ok(Math.abs(toggled.L[100]) < 1e-6 && toggled.L[600] > 0.1);
  });

  it('AY-M13 an empty module gives empty channels', () => {
    const r = renderModule(player(0));
    assert.equal(r.L.length, 0);
    assert.equal(r.frames, 0);
  });
});

// ---------------------------------------------------------------- PSG register stream
describe('PSG format', () => {
  const header = (n = 16) => { const h = Buffer.alloc(n); h.write('PSG', 0); h[3] = 0x1a; return h; };
  /** frames = array of [[reg, value], ...] ; encoded as the format wants: pairs, 0xff after each frame (not after the last one) */
  const psg = (frames, { skip, end = true, hdr = true } = {}) => {
    const parts = [hdr ? header() : Buffer.from([0x50, 0x53, 0x47, 0x1a])];
    frames.forEach((fr, i) => {
      for (const [r, v] of fr) parts.push(Buffer.from([r, v]));
      if (i < frames.length - 1) parts.push(Buffer.from([0xff]));
    });
    if (skip) parts.push(Buffer.from([0xfe, skip]));
    if (end) parts.push(Buffer.from([0xfd]));
    return Buffer.concat(parts);
  };
  const ext = (name) => FORMATS.find((f) => f.exts.includes(name));

  it('AY-F1 registered as "psg"; creates a player', () => {
    const f = ext('psg');
    assert.equal(f.name, 'PSG register stream');
    assert.ok(f.create(psg([[[0, 1]], [[1, 2]]]), 'psg') instanceof PSGPlayer);
  });

  it('AY-F2 the signature "PSG" 0x1A is required (all four bytes)', () => {
    for (let i = 0; i < 4; i++) {
      const b = psg([[[0, 1]], [[1, 2]]]);
      b[i] ^= 0x20;
      assert.throws(() => new PSGPlayer(b), /PSG/, `byte ${i}`);
    }
  });

  it('AY-F3 less than two frames is an error', () => {
    assert.throws(() => new PSGPlayer(psg([[[0, 1]]])), /PSG/);
    assert.throws(() => new PSGPlayer(header(16)), /PSG/);
  });

  it('AY-F4 frames: the register writes of each frame are applied, the registers keep their values between frames', () => {
    const p = new PSGPlayer(psg([[[0, 10], [7, 0x38]], [[0, 20]], [], [[8, 15]]]));
    const r = new Array(14).fill(0);
    r[13] = 255;
    assert.equal(p.frame(r), true);
    assert.deepEqual([r[0], r[7], r[8]], [10, 0x38, 0]);
    assert.equal(p.frame(r), true);
    assert.deepEqual([r[0], r[7], r[8]], [20, 0x38, 0]);
    assert.equal(p.frame(r), true); // an empty frame
    assert.deepEqual([r[0], r[7], r[8]], [20, 0x38, 0]);
    assert.equal(p.frame(r), true);
    assert.deepEqual([r[0], r[7], r[8]], [20, 0x38, 15]);
    assert.equal(p.frame(r), false);
    assert.equal(p.frame(r), false);
  });

  it('AY-F5 register 13 (envelope shape) is passed on only in the frame that wrote it, even if the value is the same', () => {
    const p = new PSGPlayer(psg([[[13, 9]], [[0, 1]], [[13, 9]]]));
    const r = new Array(14).fill(0);
    r[13] = 255;
    p.frame(r); assert.equal(r[13], 9);
    r[13] = 255;
    p.frame(r); assert.equal(r[13], 255);
    p.frame(r); assert.equal(r[13], 9);
  });

  it('AY-F6 0xFE n skips 4 x n empty frames', () => {
    const p = new PSGPlayer(psg([[[0, 1]], [[0, 2]]], { skip: 3, end: false }).subarray(0, undefined));
    // frames: [0,1] | [0,2] then 12 empty frames and a new (empty) frame
    assert.equal(p.frames.length, 2 + 12 + 1);
    const q = new PSGPlayer(Buffer.concat([psg([[[0, 1]], [[0, 2]]], { end: false }), Buffer.from([0xfe, 2, 0, 9, 0xfd])]));
    assert.equal(q.frames.length, 2 + 8 + 1);
    assert.deepEqual(plain(q.frames.at(-1)), [[0, 9]]);
  });

  it('AY-F7 0xFD ends the data; a byte above 15 that is not a marker ends it too; data without a header starts at byte 4', () => {
    const a = new PSGPlayer(Buffer.concat([psg([[[0, 1]], [[0, 2]]]), Buffer.from([0xff, 0, 7])]));
    assert.equal(a.frames.length, 2);
    const b = new PSGPlayer(Buffer.concat([psg([[[0, 1]], [[0, 2]]], { end: false }), Buffer.from([0x20, 0xff, 0, 7])]));
    assert.equal(b.frames.length, 2);
    const c = new PSGPlayer(Buffer.concat([Buffer.from([0x50, 0x53, 0x47, 0x1a, 0xff]), Buffer.from([0, 5, 0xff, 1, 6, 0xfd])]));
    assert.deepEqual(plain(c.frames.map((f) => f.length)), [0, 1, 1]); // 0xff at byte 4 = "no header": the first frame is empty
  });

  it('AY-F8 a register write that is cut off at the end of the data is dropped, not an error', () => {
    const b = Buffer.concat([psg([[[0, 1]], [[0, 2]]], { end: false }), Buffer.from([5])]);
    const p = new PSGPlayer(b);
    assert.deepEqual(plain(p.frames.at(-1)), [[0, 2]]);
    const c = Buffer.concat([psg([[[0, 1]], [[0, 2]]], { end: false }), Buffer.from([0xfe])]);
    assert.equal(new PSGPlayer(c).frames.length, 2);
  });

  it('AY-F9 playing a PSG through renderModule gives the notes of the file (1 s of 440 Hz-like tone)', () => {
    const p = ext('psg').create(psg([[[0, 0xfb], [1, 0], [7, 0x3e], [8, 15]], ...Array.from({ length: 49 }, () => [])]), 'psg');
    const r = renderModule(p, { maxSeconds: 5 });
    assert.equal(r.frames, 50);
    assert.ok(Math.abs(edges(r.L, 0, 0.42) - CLOCK / 16 / 0xfb) <= 2);
  });

  it('AY-F10 title and register state of a fresh player', () => {
    const p = new PSGPlayer(psg([[[0, 1]], [[0, 2]]]));
    assert.equal(p.title, '');
    assert.equal(p.f, 0);
    assert.equal(p.reg.length, 16);
  });
});

// ---------------------------------------------------------------- TurboSound
describe('TurboSound container', () => {
  const header = () => { const h = Buffer.alloc(16); h.write('PSG', 0); h[3] = 0x1a; return h; };
  const psgMod = (n) => Buffer.concat([header(), Buffer.from([0, n, 0xff, 0, n + 1, 0xfd]), Buffer.alloc(140)]);
  const ts = (m1, m2, k1 = 'psg', k2 = 'psg', size = null) => {
    const f = Buffer.alloc(16);
    f.write(k1, 0); f.writeUInt16LE(size ? size[0] : m1.length, 4); f.write(k2, 6); f.writeUInt16LE(size ? size[1] : m2.length, 10); f.write('02TS', 12);
    return Buffer.concat([m1, m2, f]);
  };

  it('AY-S1 two modules and a "02TS" footer make a TurboSound player on two chips', () => {
    const p = createTS(ts(psgMod(1), psgMod(5)));
    assert.ok(p instanceof TSPlayer);
    assert.equal(p.chips, 2);
    const r1 = new Array(14).fill(0); const r2 = new Array(14).fill(0);
    assert.equal(p.frame(r1, r2), true);
    assert.deepEqual([r1[0], r2[0]], [1, 5]);
  });

  it('AY-S2 errors: no signature, too short, wrong sizes, an unknown module type', () => {
    const good = ts(psgMod(1), psgMod(5));
    const bad = Buffer.from(good); bad.write('02TX', bad.length - 4);
    assert.throws(() => createTS(bad), /02TS/);
    assert.throws(() => createTS(Buffer.alloc(100)), /02TS/);
    assert.throws(() => createTS(ts(psgMod(1), psgMod(5), 'psg', 'psg', [psgMod(1).length + 1, psgMod(5).length])), /размеры/);
    assert.throws(() => createTS(ts(psgMod(1), psgMod(5), 'psg', 'zzz')), /zzz/);
  });

  it('AY-S3 the player: the title joins the two titles once; the frame ends when both are done; a finished chip is silenced', () => {
    const mk = (title, n) => { let f = 0; return { title, clock: 1, frameRate: 50, frame(r) { if (f++ >= n) return false; r[8] = r[9] = r[10] = 9; return true; } }; };
    const p = new TSPlayer(mk('A', 1), mk('B', 3));
    assert.equal(p.title, 'A / B');
    assert.equal(new TSPlayer(mk('A', 1), mk('A', 1)).title, 'A');
    assert.equal(new TSPlayer(mk('', 1), mk('B', 1)).title, 'B');
    const r1 = new Array(14).fill(0); const r2 = new Array(14).fill(0);
    assert.equal(p.frame(r1, r2), true);
    assert.deepEqual([r1[8], r2[8]], [9, 9]);
    assert.equal(p.frame(r1, r2), true); // A is done: silenced
    assert.deepEqual([r1[8], r1[9], r1[10]], [0, 0, 0]);
    assert.equal(r2[8], 9);
    p.frame(r1, r2);
    assert.equal(p.frame(r1, r2), false);
    assert.deepEqual([r2[8], r2[9], r2[10]], [0, 0, 0]);
  });

  it('AY-S4 loopBack: false when neither loops; otherwise the one that did not loop is marked done', () => {
    const mk = (loop) => ({ clock: 1, frameRate: 50, frame() { return true; }, loopBack: loop === undefined ? undefined : () => loop });
    assert.equal(new TSPlayer(mk(false), mk(false)).loopBack(), false);
    assert.equal(new TSPlayer(mk(undefined), mk(undefined)).loopBack(), false);
    const p = new TSPlayer(mk(true), mk(false));
    assert.equal(p.loopBack(), true);
    assert.equal(p.doneA, false);
    assert.equal(p.doneB, true);
    const q = new TSPlayer(mk(false), mk(true));
    assert.equal(q.loopBack(), true);
    assert.equal(q.doneA, true);
    assert.equal(q.doneB, false);
  });
});

// ---------------------------------------------------------------- second round: found by the mutation tests
describe('AY details (second round)', () => {
  const frames = (n, regsObj = { 7: ALL_OFF, 8: 15 }) => { let f = 0; return { frame(r) { if (f++ >= n) return false; Object.assign(r, regsObj); return true; } }; };

  it('AY-M14 the length is exact for any number of frames (an odd count too): n x 882 samples', () => {
    for (const n of [1, 2, 3, 7, 11, 25]) assert.equal(renderModule(frames(n)).L.length, n * 882, String(n));
  });

  it('AY-M15 a TurboSound mix: both channels and the first sample too (second chip rendered in step with the first)', () => {
    const mk = () => { let n = 0; return { chips: 2, frame(r1, r2) { Object.assign(r1, { 7: ALL_OFF, 8: 15 }); Object.assign(r2, { 7: ALL_OFF, 9: 15 }); return n++ < 3; } }; };
    const r = renderModule(mk());
    for (const i of [0, 1, 500, 881, 882, 2000]) {
      near(r.L[i], (0.42 + 0.3) * 0.5, 1e-5);
      near(r.R[i], (0.18 + 0.3) * 0.5, 1e-5);
    }
    assert.equal(r.L.length, 3 * 882);
  });

  it('AY-M16 the beeper (1-bit sound) is sampled by time: an event exactly between two samples, and one inside a sample', () => {
    const per = 70908 / 882;
    const mid = renderModule({ beeper: { start: 0, ev: [[35454, 1]] }, frame(r) { Object.assign(r, { 7: ALL_OFF, 8: 0 }); return this.n++ < 1; }, n: 0 });
    assert.equal(mid.L[440], 0);
    near(mid.L[441], 0.45, 1e-6);
    const inside = renderModule({ beeper: { start: 0, ev: [[441 * per + per * 0.25, 1]] }, frame(r) { Object.assign(r, { 7: ALL_OFF, 8: 0 }); return this.n++ < 1; }, n: 0 });
    assert.equal(inside.L[440], 0);
    near(inside.L[441], 0.75 * 0.45, 1e-6);
    near(inside.L[442], 0.45 - 0.75 * 0.45 + 0.997 * 0.75 * 0.45, 1e-6); // the high-pass: y = x - x(previous) + 0.997 y(previous)
    // the level before the first event, and events that switch back and forth inside one sample
    const hi = renderModule({ beeper: { start: 1, ev: [[0, 0]] }, frame(r) { Object.assign(r, { 7: ALL_OFF, 8: 0 }); return this.n++ < 1; }, n: 0 });
    assert.equal(hi.L[0], 0);
    const flick = renderModule({ beeper: { start: 0, ev: [[10, 1], [30, 0], [50, 1], [60, 0]] }, frame(r) { Object.assign(r, { 7: ALL_OFF, 8: 0 }); return this.n++ < 1; }, n: 0 });
    near(flick.L[0], ((30 - 10) + (60 - 50)) / per * 0.45, 1e-6);
  });

  it('AY-X6 an unknown kind of effect is ignored (it is not taken for a sync buzzer)', () => {
    const c = new AYChip();
    c.applyFx([{ type: 'bogus', freq: 10, shape: 5, voice: 0 }]);
    assert.equal(c.sync, null);
    assert.deepEqual(plain(c.sid), [null, null, null]);
    assert.deepEqual(plain(c.drum), [null, null, null]);
    assert.equal(c.shape, 0);
  });

  it('AY-X7 the SID and drum voices are the channels they name (voice 2 too); the LAST sample of a drum is not played (a quirk of the port: the voice is released while it is read)', () => {
    const c = new AYChip();
    c.write(regs({ 7: ALL_OFF }));
    c.applyFx([{ type: 'sid', voice: 2, freq: 44100, vol: 15 }, { type: 'drum', voice: 0, data: Uint8Array.from([255, 255]), freq: 44100 }]);
    const L = new Float32Array(4); const R = new Float32Array(4);
    c.render(L, R, 0, 4);
    near(L[0], 0.42 + 0.18, 1e-5); // drum on A (1.0 x 0.7 x 0.6) + SID on C, high in its first half (0.3 x 0.6)
    near(L[1], 0, 1e-5); // the second (last) drum sample is dropped, the SID is low
    assert.equal(c.drum[0], null);
    const d = new AYChip();
    d.write(regs({ 7: ALL_OFF }));
    d.applyFx([{ type: 'drum', voice: 0, data: Uint8Array.from([255]), freq: 44100 }]);
    d.render(L, R, 0, 2);
    near(L[0], 0, 1e-5); // a drum of one sample is never heard
  });
});

describe('PSG details (second round)', () => {
  const header = () => { const h = Buffer.alloc(16); h.write('PSG', 0); h[3] = 0x1a; return h; };
  const build = (...tail) => Buffer.concat([header(), Buffer.from(tail.flat())]);
  const frames = (b) => plain(new PSGPlayer(b).frames);

  it('AY-F11 bytes above 15 that are not markers end the data and are not taken as registers; 15 itself is a register (port B), 16 is not', () => {
    assert.deepEqual(frames(build(0, 1, 0xff, 0, 2)), [[[0, 1]], [[0, 2]]]);
    assert.deepEqual(frames(build(0, 1, 0xff, 0, 2, 0x20, 0xaa, 0xbb)), [[[0, 1]], [[0, 2]]]);
    assert.deepEqual(frames(build(0, 1, 0xff, 15, 9)), [[[0, 1]], [[15, 9]]]);
    assert.deepEqual(frames(build(0, 1, 0xff, 0, 2, 16, 7, 0, 3)), [[[0, 1]], [[0, 2]]]);
    assert.deepEqual(frames(build(0, 1, 0xff, 0, 2, 0xfc, 7, 0, 3)), [[[0, 1]], [[0, 2]]]);
  });

  it('AY-F12 the data may stop right after a register number (cut file): no crash, the half pair is dropped', () => {
    assert.deepEqual(frames(build(0, 1, 0xff, 0, 2, 5)), [[[0, 1]], [[0, 2]]]);
    assert.deepEqual(frames(build(0, 1, 0xff, 0, 2, 0xfe)), [[[0, 1]], [[0, 2]]]);
  });

  it('AY-F13 TurboSound: once both modules are done it stays done, and a finished module is not asked again', () => {
    let aCalls = 0; let bCalls = 0;
    const a = { clock: 1, frameRate: 50, title: '', frame() { aCalls++; return aCalls <= 1; } }; // asking a finished one again would say "true" again after a reset
    const b = { clock: 1, frameRate: 50, title: '', frame() { bCalls++; return bCalls <= 2; } };
    const p = new TSPlayer(a, b);
    const r1 = new Array(14).fill(0); const r2 = new Array(14).fill(0);
    const answers = [];
    for (let i = 0; i < 6; i++) answers.push(p.frame(r1, r2));
    assert.deepEqual(answers, [true, true, false, false, false, false]);
    assert.equal(aCalls, 2); // once true, once false; never again
    assert.equal(bCalls, 3);
  });

  it('AY-S5 the container needs 270 bytes: exactly 270 is fine, 269 is "no signature"', () => {
    const mod = (pad, n) => Buffer.concat([header(), Buffer.from([0, n, 0xff, 0, n + 1, 0xfd]), Buffer.alloc(pad)]);
    const ts = (m1, m2) => {
      const f = Buffer.alloc(16);
      f.write('psg', 0); f.writeUInt16LE(m1.length, 4); f.write('psg', 6); f.writeUInt16LE(m2.length, 10); f.write('02TS', 12);
      return Buffer.concat([m1, m2, f]);
    };
    const ok = ts(mod(100, 1), mod(110, 5));
    assert.equal(ok.length, 270);
    assert.ok(createTS(ok) instanceof TSPlayer);
    const short = ts(mod(100, 1), mod(109, 5));
    assert.equal(short.length, 269);
    assert.throws(() => createTS(short), /02TS/);
    assert.throws(() => createTS(ts(mod(100, 1), mod(110, 5)).subarray(0, 269)), /02TS/);
  });

  it('AY-S6 an unknown module type is named in the message', () => {
    const mod = Buffer.concat([header(), Buffer.from([0, 1, 0xff, 0, 2, 0xfd]), Buffer.alloc(110)]);
    const f = Buffer.alloc(16);
    f.write('psg', 0); f.writeUInt16LE(mod.length, 4); f.write('zzz', 6); f.writeUInt16LE(mod.length, 10); f.write('02TS', 12);
    assert.throws(() => createTS(Buffer.concat([mod, mod, f])), /TS: неподдерживаемый тип модуля zzz$/);
  });
});

// ---------------------------------------------------------------- characterisation (golden) tests
// Scripted modules with pseudo-random register values drive the whole chip (tone, noise, mixer, all envelope shapes, SID / drum / sync
// effects, two chips, the beeper, speed and pitch). The SHA-1 of the rendered samples is the reference: it was taken from the emulator
// after the unit tests above (frequency, levels, envelope, noise against independent models) had passed. Any change of the sound, even in
// the last bit, shows up here; an intended change is made by taking the new hash (and listening to the result).
describe('AY golden renderings', () => {
  const crypto = require('crypto');
  const hashOf = (r) => crypto.createHash('sha1').update(Buffer.from(r.L.buffer, r.L.byteOffset, r.L.byteLength)).update(Buffer.from(r.R.buffer, r.R.byteOffset, r.R.byteLength)).digest('hex');

  /** a module that writes pseudo-random (but fixed) registers: seed, number of frames, extras */
  function scripted(seed, n, extra = {}) {
    let x = seed >>> 0;
    const rnd = () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296;
    let f = 0;
    return {
      title: 'golden', ...extra,
      frame(...rs) {
        if (f++ >= n) return false;
        for (const r of rs.filter(Boolean)) {
          r[0] = (rnd() * 256) | 0; r[1] = (rnd() * 4) | 0; r[2] = (rnd() * 256) | 0; r[3] = (rnd() * 8) | 0; r[4] = (rnd() * 256) | 0; r[5] = (rnd() * 16) | 0;
          r[6] = (rnd() * 32) | 0; r[7] = (rnd() * 64) | 0; r[8] = (rnd() * 32) | 0; r[9] = (rnd() * 32) | 0; r[10] = (rnd() * 32) | 0;
          r[11] = (rnd() * 256) | 0; r[12] = rnd() < 0.3 ? 1 : 0;
          if (rnd() < 0.4) r[13] = (rnd() * 16) | 0;
        }
        return true;
      },
      loopBack() { return extra.loops ? (f = 0, extra.loops--, true) : false; },
    };
  }
  const FX = [{ type: 'sid', voice: 0, freq: 3000, vol: 12 }, { type: 'drum', voice: 1, data: Uint8Array.from({ length: 50 }, (_, i) => (i * 37) & 255), freq: 8000 }, { type: 'sid', voice: 2, freq: 777, vol: 9 }, { type: 'sync', freq: 200, shape: 13 }];
  const BEEP = { start: 1, ev: [[1000, 0], [5000.5, 1], [20000, 0], [40000, 1], [65000, 0]] };

  const scenes = {
    'one chip, 60 frames': () => renderModule(scripted(1, 60)),
    'two chips (TurboSound), 40 frames': () => renderModule(scripted(2, 40, { chips: 2 })),
    'effects: SID on A and C, drum on B, sync buzzer': () => renderModule(scripted(3, 40, { fx: FX })),
    'beeper': () => renderModule(scripted(4, 30, { beeper: BEEP })),
    'speed 1.25, pitch 0.8, two plays': () => renderModule(scripted(5, 12, { loops: 1 }), { speed: 1.25, pitch: 0.8, loops: 2 }),
    'another clock and a frame rate of 55': () => renderModule(scripted(6, 30, { clock: 2000000, frameRate: 55 })),
  };
  const GOLD = {
    'one chip, 60 frames': '438c6526e0c1557760d05726bece74576ea38cfa',
    'two chips (TurboSound), 40 frames': 'd99ec5e7bcf1e66208a2bd6e86159c6efc12b7fb',
    'effects: SID on A and C, drum on B, sync buzzer': '5158ff597eb4600eef9d2b41a8fd077b76aea5d4',
    'beeper': '452180063f19b91899a7bf4f88192b5839bedbe6',
    'speed 1.25, pitch 0.8, two plays': '55cd39fa009314ddb0cde142bde5c9da2591ab26',
    'another clock and a frame rate of 55': '622e81dfff11d32c878e6c60133eb7655b8ac04c',
  };
  for (const [name, make] of Object.entries(scenes)) {
    it(`AY-G1 ${name}`, () => {
      const r = make();
      assert.ok(r.L.length > 10000);
      assert.equal(hashOf(r), GOLD[name]);
    });
  }

  it('AY-G2 the golden scenes are not silent and not clipped (a sanity check of the reference itself)', () => {
    for (const [name, make] of Object.entries(scenes)) {
      const r = make();
      let peak = 0;
      for (const v of r.L) peak = Math.max(peak, Math.abs(v));
      assert.ok(peak > 0.05 && peak < 2.5, `${name}: peak ${peak}`);
      assert.ok(r.L.every(Number.isFinite) && r.R.every(Number.isFinite), `${name}: not finite`);
    }
  });
});

describe('AY details (third round)', () => {
  it('AY-X8 a sync buzzer restart puts the envelope where writing the shape register would: every one of the 16 shapes', () => {
    for (let shape = 0; shape < 16; shape++) {
      const written = new AYChip();
      written.write(regs({ 13: shape }));
      const restarted = new AYChip();
      restarted.shape = shape;
      restarted.restartEnv();
      assert.equal(restarted.evol, written.evol, `shape ${shape}: level`);
      assert.equal(restarted.edir, written.edir, `shape ${shape}: direction`);
      assert.equal(restarted.ehold, false);
      assert.equal(restarted.ec, 0);
      assert.equal(restarted.evol, shape & 4 ? 0 : 15);
      assert.equal(restarted.edir, shape & 4 ? 1 : -1);
    }
  });

  it('AY-X9 a sync buzzer at the sample rate restarts the envelope at every sample (a phase of exactly one half counts)', () => {
    const c = new AYChip();
    let restarts = 0;
    const orig = c.restartEnv.bind(c);
    c.restartEnv = () => { restarts++; orig(); };
    c.applyFx([{ type: 'sync', freq: 44100, shape: 12 }]);
    restarts = 0;
    c.write(regs({ 7: ALL_OFF }));
    const L = new Float32Array(100); const R = new Float32Array(100);
    c.render(L, R, 0, 100);
    assert.equal(restarts, 100);
  });

  it('AY-T13 the pan of every channel is used for both sides: an uneven pan table', () => {
    const c = new AYChip();
    c.pan = [[1, 0], [0.2, 0.8], [0, 1]];
    c.write(regs({ 7: ALL_OFF, 9: 15 })); // only B sounds
    const L = new Float32Array(10); const R = new Float32Array(10);
    c.render(L, R, 0, 10);
    near(L[5], 0.2 * 0.6, 1e-6);
    near(R[5], 0.8 * 0.6, 1e-6);
    const d = new AYChip();
    d.pan = [[0.9, 0.1], [0, 0], [0.4, 0.6]];
    d.write(regs({ 7: ALL_OFF, 8: 15, 10: 15 }));
    d.render(L, R, 0, 10);
    near(L[5], (0.9 + 0.4) * 0.6, 1e-6);
    near(R[5], (0.1 + 0.6) * 0.6, 1e-6);
  });
});
