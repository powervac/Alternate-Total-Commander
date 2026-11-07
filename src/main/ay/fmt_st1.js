// Sound Tracker 1.x uncompiled song (.st1): fixed 64-row pattern grid, converted to STC channel streams and
// played by the STC engine.
function createST1(b) {
  const HDR = 3009, PAT = 576;
  if (b.length < HDR + PAT) throw new Error('ST1: файл слишком короткий');
  const tempo = b[3007], patSize = b[3008], len = b[2462] + 1;
  if (!tempo || !patSize || patSize > 64) throw new Error('ST1: неверный заголовок');
  const m = { tempo, title: '', pos: [], samples: {}, orns: {}, pats: {} };
  for (let i = 0; i < 15; i++) {
    const o = i * 130, lines = [];
    for (let j = 0; j < 32; j++) {
      const nz = b[o + 32 + j], eff = ((b[o + 64 + j * 2] | (b[o + 65 + j * 2] << 8)) << 16) >> 16;
      lines.push({ level: b[o + j] & 15, noise: nz & 31, noiseMask: (nz >> 7) & 1, envMask: (nz >> 6) & 1, effect: (eff & 0x1000) ? (eff & 0xfff) : -(eff & 0xfff) });
    }
    const loop = Math.min(b[o + 128], 32);
    m.samples[i + 1] = { loop, limit: Math.min(loop + b[o + 129], 32), lines };
  }
  for (let i = 0; i < 17; i++) m.orns[i] = Array.from(b.subarray(2463 + i * 32, 2463 + i * 32 + 32), s8);
  const maxPats = 1 + Math.floor((b.length - HDR - PAT) / PAT) + 0;
  for (let i = 0; i < len; i++) {
    const pat = b[1950 + i * 2] - 1; if (pat < 0 || pat > 31) throw new Error('ST1: неверный номер паттерна');
    m.pos.push({ pat, trans: s8(b[1951 + i * 2]) });
  }
  const HALF = [-1, -1, 9, 10, 11, -1, 0, 1, 2, 3, 4, -1, 5, 6, 7, 8];
  const out = []; const emit = a => { const o = out.length; out.push(...a); return o; };
  for (const p of new Set(m.pos.map(x => x.pat))) {
    const streams = [[], [], []], st = [0, 1, 2].map(() => ({ smp: 0, envT: 0, envV: 0 }));
    for (let row = 0; row < patSize; row++) {
      for (let c = 0; c < 3; c++) {
        const s = streams[c];
        if (p >= maxPats) { s.push(0x81); continue; }
        const q = HDR + p * PAT + row * 9 + c * 3, n = b[q], es = b[q + 1], eo = b[q + 2];
        const rest = n & 128, hasNote = n & 0x78, empty = !rest && !hasNote && es === 0;
        if (empty) { s.push(0x81); continue; }
        if (rest) { s.push(0x80); continue; }
        if (!hasNote || HALF[(n & 0x78) >> 3] < 0) { s.push(0x81); continue; }
        const smp = es >> 4, eff = es & 15, str = st[c];
        if (smp && smp !== str.smp) s.push(0x60 + smp);
        str.smp = smp;
        if (eff === 15) { s.push(0x70 + (eo & 15)); str.envT = 0; }
        else if ([8, 10, 12, 13, 14].includes(eff)) {
          if (eff !== str.envT || eo !== str.envV) { str.envT = eff; str.envV = eo; s.push(0x80 + eff, eo); }
        } else if (eff === 1) { s.push(0x82); str.envT = 0; }
        s.push(HALF[(n & 0x78) >> 3] + 12 * (n & 7));
      }
    }
    m.pats[p] = streams.map((s, c) => emit(s.concat(c === 0 ? [0xff] : [0xff])));
  }
  const buf = new Uint8Array(out.length + 1); buf.set(out);
  return new STCPlayer(buf, m);
}
FORMATS.push({ name: 'Sound Tracker 1 (ST1)', exts: ['st1', 's'], create: b => createST1(b) });
