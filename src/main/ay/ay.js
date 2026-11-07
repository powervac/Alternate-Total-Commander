// Format registry: each fmt_*.js / pt2.js pushes {name, exts, create(bytes, ext)->player}
const FORMATS = [];
// AY-3-8910/8912 emulator + frame renderer. Players expose: {title, frame(regs)->bool}
// frame() fills regs[0..13]; regs[13]=255 means "no write to envelope shape".
const AY_CLOCK = 1773400, FRAME_RATE = 50, SAMPLE_RATE = 44100;
const AY_VOL = [0,0.0137,0.0205,0.0291,0.0423,0.0618,0.0847,0.1369,0.1691,0.2647,0.3527,0.4499,0.5704,0.6873,0.8482,1];

class AYChip {
  constructor(clock = AY_CLOCK, rate = SAMPLE_RATE) {
    this.step = clock / 8 / rate; this.acc = 0;
    this.tc = [0,0,0]; this.to = [0,0,0]; this.nc = 0; this.lfsr = 1; this.nout = 1;
    this.ec = 0; this.evol = 0; this.edir = 0; this.ehold = true; this.shape = 0;
    this.r = new Uint8Array(16);
    this.fxRate = rate;
    this.sid = [null, null, null]; this.drum = [null, null, null]; this.sync = null;
    this.pan = [[0.7,0.3],[0.5,0.5],[0.3,0.7]];
  }
  write(regs) {
    for (let i = 0; i < 13; i++) this.r[i] = regs[i];
    this.r[1] &= 15; this.r[3] &= 15; this.r[5] &= 15; this.r[6] &= 31;
    if (regs[13] !== 255) {
      const s = regs[13] & 15; this.shape = s; this.ec = 0; this.ehold = false;
      if (s & 4) { this.evol = 0; this.edir = 1; } else { this.evol = 15; this.edir = -1; }
    }
  }
  // --- YM5/6 special effects (SID voice, digi-drum, sync-buzzer); driven per frame by the player
  restartEnv() {
    this.ec = 0; this.ehold = false;
    if (this.shape & 4) { this.evol = 0; this.edir = 1; } else { this.evol = 15; this.edir = -1; }
  }
  applyFx(list) {
    this.sid = [null, null, null]; this.sync = null;
    for (const e of list) {
      if (e.type === 'sid') this.sid[e.voice] = { step: e.freq / (2 * this.fxRate), phase: 0, vol: e.vol };
      else if (e.type === 'drum') this.drum[e.voice] = { data: e.data, pos: 0, step: e.freq / this.fxRate, val: 0 };
      else if (e.type === 'sync') { this.sync = { step: e.freq / (2 * this.fxRate), phase: 0 }; this.shape = e.shape & 15; this.restartEnv(); }
    }
  }
  fxSample() {
    for (let v = 0; v < 3; v++) {
      const d = this.drum[v];
      if (d) { d.val = d.data[d.pos | 0] / 255; d.pos += d.step; if (d.pos >= d.data.length) this.drum[v] = null; }
      const s = this.sid[v];
      if (s) { s.phase += s.step; if (s.phase >= 1) s.phase -= 1; s.level = s.phase >= 0.5 ? s.vol : 0; }
    }
    const y = this.sync;
    if (y) { y.phase += y.step; if (y.phase >= 0.5) { y.phase -= 0.5; this.restartEnv(); } }
  }
  envStep() {
    if (this.ehold) return;
    const s = this.shape, C = s & 8, AL = s & 2, H = s & 1;
    this.evol += this.edir;
    if (this.evol < 0 || this.evol > 15) {
      if (!C) { this.evol = 0; this.ehold = true; }
      else if (H) { this.ehold = true; this.evol = AL ? (this.edir > 0 ? 0 : 15) : (this.edir > 0 ? 15 : 0); }
      else if (AL) { this.edir = -this.edir; this.evol = this.edir > 0 ? 0 : 15; }
      else this.evol = this.edir > 0 ? 0 : 15;
    }
  }
  // one chip tick (clock/8)
  tick(out) {
    const r = this.r;
    for (let c = 0; c < 3; c++) {
      let p = r[c*2] | (r[c*2+1] << 8); if (p < 1) p = 1;
      if (++this.tc[c] >= p) { this.tc[c] = 0; this.to[c] ^= 1; }
    }
    const np = r[6] || 1;
    if (++this.nc >= np * 2) {
      this.nc = 0;
      const b = (this.lfsr ^ (this.lfsr >> 3)) & 1;
      this.lfsr = (this.lfsr >> 1) | (b << 16); this.nout = this.lfsr & 1;
    }
    const ep = (r[11] | (r[12] << 8)) || 1;
    if (++this.ec >= ep * 2) { this.ec = 0; this.envStep(); }
    const mix = r[7];
    for (let c = 0; c < 3; c++) {
      const d = this.drum[c];
      if (d) { out[c] += d.val; continue; } // digi-drum replaces the voice (tone/noise gates bypassed)
      const t = this.to[c] | ((mix >> c) & 1);
      const n = this.nout | ((mix >> (c + 3)) & 1);
      if (t & n) {
        const a = r[8 + c], sd = this.sid[c];
        out[c] += AY_VOL[sd ? sd.level | 0 : (a & 16) ? this.evol : (a & 15)];
      }
    }
  }
  render(L, R, off, n) {
    const o = [0,0,0], pan = this.pan;
    for (let i = 0; i < n; i++) {
      this.fxSample();
      this.acc += this.step; const k = this.acc | 0; this.acc -= k;
      o[0] = o[1] = o[2] = 0;
      for (let j = 0; j < k; j++) this.tick(o);
      const a = o[0]/k, b = o[1]/k, c = o[2]/k;
      L[off+i] = (a*pan[0][0] + b*pan[1][0] + c*pan[2][0]) * 0.6;
      R[off+i] = (a*pan[0][1] + b*pan[1][1] + c*pan[2][1]) * 0.6;
    }
  }
}

// Render whole module. maxSeconds guards against endless modules; opts.loops = number of plays (>1 uses the module's loop point).
// Players with chips === 2 (TurboSound) get frame(regs1, regs2) and are mixed from two AY chips.
// A player may expose `beeper` ({start, ev:[[tstate, level]...]}, tstates of a 70908-long frame) for 1-bit sound.
function renderModule(player, opts = {}) {
  if (player.renderPCM) return player.renderPCM(opts); // sample-based formats (YM MIX1 / YM-Tracker)
  const rate = (player.frameRate || FRAME_RATE) * (opts.speed || 1); // speed = tempo (replay rate), independent of pitch
  const maxFrames = (opts.maxSeconds || 1800) * rate;
  const spf = SAMPLE_RATE / rate;
  const clock = (opts.clock || player.clock || AY_CLOCK) * (opts.pitch || 1); // pitch = AY clock
  const two = player.chips === 2;
  const chips = [new AYChip(clock)]; if (two) chips.push(new AYChip(clock));
  const regs = chips.map(() => new Uint8Array(14));
  const chunksL = [], chunksR = []; let total = 0, frames = 0, carry = 0, loopsLeft = Math.max(0, (opts.loops || 1) - 1);
  let hpX = 0, hpY = 0, beepUsed = false;
  const nextFrame = () => { for (const r of regs) r[13] = 255; return player.frame(regs[0], regs[1]); };
  while (frames < maxFrames) {
    let ok = nextFrame();
    if (!ok && loopsLeft > 0 && player.loopBack && player.loopBack()) { loopsLeft--; ok = nextFrame(); }
    if (!ok) break;
    carry += spf; const n = carry | 0; carry -= n;
    const L = new Float32Array(n), R = new Float32Array(n);
    for (let c = 0; c < chips.length; c++) {
      chips[c].write(regs[c]);
      if (c === 0 && player.fx) chips[0].applyFx(player.fx);
      if (c === 0) chips[c].render(L, R, 0, n);
      else {
        const L2 = new Float32Array(n), R2 = new Float32Array(n);
        chips[c].render(L2, R2, 0, n);
        for (let i = 0; i < n; i++) { L[i] = (L[i] + L2[i]) * 0.5; R[i] = (R[i] + R2[i]) * 0.5; }
      }
    }
    const bp = player.beeper;
    if (bp) {
      beepUsed = beepUsed || bp.ev.length > 0 || bp.start;
      const ev = bp.ev, T = 70908;
      let e = 0, lvl = bp.start, cur = 0;
      for (let i = 0; i < n; i++) {
        const t0 = i * T / n, t1 = (i + 1) * T / n; let acc = 0, t = t0;
        while (e < ev.length && ev[e][0] < t1) {
          const te = Math.max(t, Math.min(t1, ev[e][0])); if (lvl) acc += te - t; t = te; lvl = ev[e][1]; e++;
        }
        if (lvl) acc += t1 - t;
        const x = acc / (t1 - t0) * 0.45;
        hpY = x - hpX + 0.997 * hpY; hpX = x; // remove DC of the 1-bit signal
        L[i] += hpY; R[i] += hpY;
      }
    }
    chunksL.push(L); chunksR.push(R); total += n; frames++;
    if (opts.onProgress && (frames & 255) === 0) opts.onProgress(frames);
  }
  const L = new Float32Array(total), R = new Float32Array(total); let p = 0;
  for (let i = 0; i < chunksL.length; i++) { L.set(chunksL[i], p); R.set(chunksR[i], p); p += chunksL[i].length; }
  return { L, R, rate: SAMPLE_RATE, frames, frameRate: rate };
}
