// Register-dump formats: YM2!/YM3!/YM3b/YM5!/YM6! (optionally LHA-packed) and VTX (ay/ym)
class DumpPlayer {
  // frames: function(f, regs) filling 14 registers; clock/rate from the file
  constructor(count, getFrame, info) {
    this.count = count; this.getFrame = getFrame; this.f = 0;
    this.title = info.title || ''; this.drums = info.drums; this.ver = info.ver || 0; this.tmp = new Uint8Array(16); this.clock = info.clock; this.frameRate = info.rate; this.tempo = 0; this.loopFrame = info.loop;
  }
  loopBack() {
    if (this.loopFrame == null || this.loopFrame >= this.count) return false;
    this.f = this.loopFrame; return true;
  }
  frame(regs) {
    if (this.f >= this.count) return false;
    const t = this.tmp; t.fill(0);
    this.getFrame(this.f++, t);
    if (this.ver === 2) { this.madmax(t, regs); return true; }
    for (let i = 0; i < 14; i++) regs[i] = t[i];
    if (this.ver >= 5) this.fx = this.effects(t);
    return true;
  }
  // YM2! (Mad Max): R11 is the envelope period, R13 is forced to shape 10; bit 7 of R10 starts a built-in digi-drum on voice C
  madmax(t, regs) {
    for (let i = 0; i < 11; i++) regs[i] = t[i];
    if (t[13] !== 0xff) { regs[11] = t[11]; regs[12] = 0; regs[13] = 10; }
    this.fx = [];
    if (t[10] & 0x80) {
      regs[7] |= 0x24;
      const num = t[10] & 0x7f, smp = madmaxSamples()[num];
      if (smp && t[12]) this.fx.push({ type: 'drum', voice: 2, freq: (2457600 / 4) / t[12], data: smp });
    }
  }
  // YM5/YM6 special effects encoded in the high bits of R1/R3/R6/R8/R14/R15 (as in ST-Sound)
  effects(t) {
    const MFP = [0, 4, 10, 16, 50, 64, 100, 200], list = [];
    const drum = (voice, prediv, count) => {
      const nd = t[8 + voice] & 31, d = this.drums[nd], pc = prediv * count;
      if (d && d.length && pc) list.push({ type: 'drum', voice, freq: 2457600 / pc, data: d });
    };
    if (this.ver === 6) {
      for (const [cr, pr, nr] of [[1, 6, 14], [3, 8, 15]]) {
        const code = t[cr] & 0xf0, prediv = MFP[(t[pr] >> 5) & 7], count = t[nr];
        if (!(code & 0x30)) continue;
        const voice = ((code & 0x30) >> 4) - 1, pc = prediv * count;
        switch (code & 0xc0) {
          case 0x00: if (pc) list.push({ type: 'sid', voice, freq: 2457600 / pc, vol: t[8 + voice] & 15 }); break;
          case 0x40: drum(voice, prediv, count); break;
          case 0xc0: if (pc) list.push({ type: 'sync', freq: 2457600 / pc, shape: t[8 + voice] & 15 }); break;
          // 0x80 (sinus SID) is not implemented by ST-Sound either
        }
      }
    } else {
      let code = (t[1] >> 4) & 3;
      if (code) { const voice = code - 1, pc = MFP[(t[6] >> 5) & 7] * t[14]; if (pc) list.push({ type: 'sid', voice, freq: 2457600 / pc, vol: t[8 + voice] & 15 }); }
      code = (t[3] >> 4) & 3;
      if (code) drum(code - 1, MFP[(t[8] >> 5) & 7], t[15]);
    }
    return list;
  }
}
const beU32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const leU32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const cstr = (b, o) => { let e = o; while (e < b.length && b[e]) e++; return [String.fromCharCode(...b.subarray(o, e)).trim(), e + 1]; };

function createYM(src) {
  let b = lhaUnwrap(src) || src;
  const sig = String.fromCharCode(...b.subarray(0, 4));
  let count, get, info = { clock: 2000000, rate: 50, title: '' };
  if (sig === 'MIX1') return createMIX1(b);
  if (sig === 'YMT1' || sig === 'YMT2') return createYMT(b, sig);
  if (sig === 'YM2!' || sig === 'YM3!' || sig === 'YM3b') {
    if (sig === 'YM2!') info.ver = 2;
    const tail = sig === 'YM3b' ? 4 : 0;
    if (tail) info.loop = beU32(b, b.length - 4);
    count = Math.floor((b.length - 4 - tail) / 14);
    get = (f, r) => { for (let i = 0; i < 14; i++) r[i] = b[4 + i * count + f]; };
  } else if (sig === 'YM5!' || sig === 'YM6!') {
    if (String.fromCharCode(...b.subarray(4, 12)) !== 'LeOnArD!') throw new Error('YM: неверная сигнатура');
    count = beU32(b, 12); const attrs = beU32(b, 16), nS = (b[20] << 8) | b[21];
    info.clock = beU32(b, 22); info.rate = (b[26] << 8) | b[27] || 50; info.loop = beU32(b, 28);
    let o = 34 + ((b[32] << 8) | b[33]);
    const drums = [], VOLT = [62, 161, 265, 377, 580, 774, 1155, 1575, 2260, 3088, 4570, 6233, 9330, 13187, 21220, 32767];
    for (let i = 0; i < nS; i++) {
      const sz = beU32(b, o), d = new Uint8Array(b.subarray(o + 4, o + 4 + sz));
      if (attrs & 4) for (let j = 0; j < d.length; j++) d[j] = VOLT[d[j] & 15] >> 7;
      drums.push(d); o += 4 + sz;
    }
    info.drums = drums; info.ver = sig === 'YM6!' ? 6 : 5;
    let s; [s, o] = cstr(b, o); info.title = s;
    let au; [au, o] = cstr(b, o); if (au) info.title += ' - ' + au;
    [s, o] = cstr(b, o);
    const interleaved = attrs & 1, base = o;
    if (base + count * 16 > b.length) count = Math.floor((b.length - base) / 16);
    get = interleaved ? (f, r) => { for (let i = 0; i < 16; i++) r[i] = b[base + i * count + f]; }
                      : (f, r) => { for (let i = 0; i < 16; i++) r[i] = b[base + f * 16 + i]; };
  } else throw new Error('YM: неизвестная сигнатура ' + sig);
  if (info.clock < 100000 || info.clock > 10000000) info.clock = 2000000;
  if (count < 1) throw new Error('YM: нет данных');
  return new DumpPlayer(count, get, info);
}

function createVTX(b) {
  const id = String.fromCharCode(b[0], b[1]);
  if (id !== 'ay' && id !== 'ym') throw new Error('VTX: неверная сигнатура');
  const info = { clock: leU32(b, 5), rate: b[9] || 50, title: '', loop: b[3] | (b[4] << 8) };
  const size = leU32(b, 12);
  let o = 16, t, au;
  [t, o] = cstr(b, o); [au, o] = cstr(b, o); [, o] = cstr(b, o); [, o] = cstr(b, o); [, o] = cstr(b, o);
  info.title = au ? t + ' - ' + au : t;
  if (info.clock < 100000 || info.clock > 10000000) info.clock = 1773400;
  if (size < 14 || size > 14 * 100 * 3600) throw new Error('VTX: неверный размер');
  const d = lh5Decode(b, o, size), count = Math.floor(size / 14);
  return new DumpPlayer(count, (f, r) => { for (let i = 0; i < 14; i++) r[i] = d[i * count + f]; }, info);
}
FORMATS.push({ name: 'Vortex Tracker VTX', exts: ['vtx'], create: b => createVTX(b) });
FORMATS.push({ name: 'YM (Atari ST / AY dump)', exts: ['ym'], create: b => createYM(b) });

// ---- sample-based YM flavours: rendered directly to PCM (no AY emulation) ----
class PCMPlayer {
  constructor(title, render) { this.title = title; this._render = render; this.frameRate = 50; }
  renderPCM(opts) {
    const loops = Math.max(1, opts.loops || 1), out = this._render(loops, (opts.maxSeconds || 1800) * SAMPLE_RATE, opts.speed || 1, opts.pitch || 1);
    return { L: out, R: out, rate: SAMPLE_RATE, frames: Math.round(out.length / SAMPLE_RATE * 50), frameRate: 50 };
  }
}
function readNt(b, o) { let e = o; while (e < b.length && b[e]) e++; return [String.fromCharCode(...b.subarray(o, e)).trim(), e + 1]; }

// MIX1: list of PCM blocks (start, length, repeats, replay frequency)
function createMIX1(b) {
  if (String.fromCharCode(...b.subarray(4, 12)) !== 'LeOnArD!') throw new Error('MIX1: неверная сигнатура');
  const attr = beU32(b, 12), size = beU32(b, 16), nb = beU32(b, 20);
  if (nb < 1 || nb > 10000) throw new Error('MIX1: неверное число блоков');
  let o = 24; const blocks = [];
  for (let i = 0; i < nb; i++, o += 12) blocks.push({ start: beU32(b, o), len: beU32(b, o + 4), rep: Math.min(32, (b[o + 8] << 8) | b[o + 9]), freq: (b[o + 10] << 8) | b[o + 11] });
  let name, author, comment;
  [name, o] = readNt(b, o); [author, o] = readNt(b, o); [comment, o] = readNt(b, o);
  const raw = b.subarray(o, o + size), signed = !!(attr & 1);
  const smp = i => signed ? ((raw[i] << 24) >> 24) : ((raw[i] ^ 0x80) << 24 >> 24);
  const title = [name, author].filter(Boolean).join(' - ');
  return new PCMPlayer(title, (loops, maxN, speed, pitch) => {
    const chunks = []; let total = 0;
    for (let lp = 0; lp < loops && total < maxN; lp++) {
      for (const bl of blocks) {
        if (!bl.freq || !bl.len || bl.start + bl.len > raw.length) continue;
        const pr = speed * pitch, n = Math.floor(bl.len * SAMPLE_RATE / (bl.freq * pr)), step = bl.freq * pr / SAMPLE_RATE;
        for (let r = 0; r < Math.max(1, bl.rep) && total < maxN; r++) {
          const a = new Float32Array(n);
          for (let i = 0; i < n; i++) { const p = i * step, k = p | 0, f = p - k, s0 = smp(bl.start + k), s1 = k + 1 < bl.len ? smp(bl.start + k + 1) : s0; a[i] = (s0 + (s1 - s0) * f) / 128 * 0.9; }
          chunks.push(a); total += n;
        }
      }
    }
    const out = new Float32Array(total); let p = 0; for (const c of chunks) { out.set(c, p); p += c.length; }
    return out;
  });
}

// YMT1/YMT2 (YM-Tracker): N sample voices driven by a 4-byte-per-voice score
function createYMT(b, sig) {
  if (String.fromCharCode(...b.subarray(4, 12)) !== 'LeOnArD!') throw new Error('YMT: неверная сигнатура');
  const nVoice = (b[12] << 8) | b[13], rate = (b[14] << 8) | b[15] || 50, nFrame = beU32(b, 16), loop = beU32(b, 20), nDrum = (b[24] << 8) | b[25];
  let attr = beU32(b, 26), o = 30, name, author, comment;
  if (!nVoice || nVoice > 8 || !nFrame) throw new Error('YMT: неверный заголовок');
  [name, o] = readNt(b, o); [author, o] = readNt(b, o); [comment, o] = readNt(b, o);
  const drums = [];
  for (let i = 0; i < nDrum; i++) {
    const size = (b[o] << 8) | b[o + 1]; let rep = size; o += 2;
    if (sig === 'YMT2') { rep = (b[o] << 8) | b[o + 1]; o += 4; }
    drums.push({ data: b.subarray(o, o + size), rep: Math.min(rep, size) }); o += size;
  }
  let shift = 0; if (sig === 'YMT2') { shift = (attr >>> 28) & 15; attr &= 0x0fffffff; }
  const lines = nFrame * nVoice, step = 4 * nVoice;
  if (o + lines * 4 > b.length) throw new Error('YMT: не хватает данных');
  let score = b.subarray(o, o + lines * 4);
  if (attr & 1) { const d = new Uint8Array(lines * 4); for (let c = 0; c < step; c++) for (let f = 0; f < nFrame; f++) d[f * step + c] = score[c * nFrame + f]; score = d; }
  const title = [name, author].filter(Boolean).join(' - '), scale = Math.floor(256 / nVoice);
  return new PCMPlayer(title, (loops, maxN, speed, pitch) => {
    const spf = Math.max(1, Math.floor(SAMPLE_RATE / (rate * speed))), voices = Array.from({ length: nVoice }, () => ({ run: false, pos: 0, freq: 0, vol: 0, loop: false, d: null, rep: 0 }));
    const out = []; let total = 0, frame = 0, lp = 0;
    while (total < maxN) {
      if (frame >= nFrame) { if (++lp >= loops) break; frame = loop < nFrame ? loop : 0; }
      for (let v = 0; v < nVoice; v++) {
        const q = (frame * nVoice + v) * 4, V = voices[v], freq = (score[q + 2] << 8) | score[q + 3];
        V.freq = freq;
        if (freq) {
          V.vol = score[q + 1] & 63; V.loop = !!(score[q + 1] & 0x40);
          const n = score[q]; if (n !== 0xff && drums[n]) { V.run = true; V.d = drums[n].data; V.rep = drums[n].rep; V.pos = 0; }
        } else V.run = false;
      }
      const fr = new Float32Array(spf);
      for (const V of voices) {
        if (!V.run || !V.d || !V.d.length) continue;
        const inc = V.freq * (1 << shift) * pitch / SAMPLE_RATE, size = V.d.length, g = scale * V.vol / 64 / 32768;
        for (let i = 0; i < spf; i++) {
          const k = V.pos | 0, f = V.pos - k, s0 = V.d[k] - 128, s1 = k + 1 < size ? V.d[k + 1] - 128 : s0;
          fr[i] += (s0 + (s1 - s0) * f) * g;
          V.pos += inc;
          if (V.pos >= size) { if (V.loop && V.rep) V.pos -= V.rep; else { V.run = false; break; } }
        }
      }
      out.push(fr); total += spf; frame++;
    }
    const res = new Float32Array(total); let p = 0; for (const c of out) { res.set(c, p); p += c.length; }
    return res;
  });
}
