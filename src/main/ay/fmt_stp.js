// Sound Tracker Pro compiled (.stp)
const STP_ID = 'KSA SOFTWARE COMPILATION OF ';

function parseSTP(b) {
  if (b.length < 200) throw new Error('STP: файл слишком короткий');
  const m = { tempo: b[0], title: '', pos: [], samples: [], orns: [], pats: {} };
  const posOff = u16(b, 1), patOff = u16(b, 3), ornOff = u16(b, 5), smpOff = u16(b, 7);
  if (!m.tempo || posOff + 2 > b.length || patOff + 6 > b.length || ornOff + 32 > b.length || smpOff + 2 > b.length) throw new Error('STP: неверный заголовок');
  let hdr = 10;
  if (ayStr(b, 10, 28) === STP_ID.trim() || String.fromCharCode(...b.subarray(10, 38)) === STP_ID) { m.title = ayStr(b, 38, 25); hdr = 63; }
  const first = u16(b, patOff);
  if (first < hdr) throw new Error('STP: неверный указатель паттерна');
  const delta = first - hdr;
  m.loop = b[posOff + 1];
  const len = b[posOff];
  for (let i = 0; i < len; i++) {
    const o = posOff + 2 + i * 2; if (o + 2 > b.length) break;
    m.pos.push({ pat: Math.floor(b[o] / 6), trans: s8(b[o + 1]) });
  }
  if (!m.pos.length) throw new Error('STP: пустой список позиций');
  for (const p of m.pos) {
    const o = patOff + p.pat * 6; if (o + 6 > b.length) throw new Error('STP: неверный номер паттерна');
    m.pats[p.pat] = [u16(b, o) - delta, u16(b, o + 2) - delta, u16(b, o + 4) - delta];
  }
  const objLoop = (o, size, rd) => {
    const lp = s8(b[o]), sz = Math.max(0, s8(b[o + 1])), lines = [];
    for (let j = 0; j < sz; j++) lines.push(rd(o + 2, j));
    return { loop: lp < 0 ? sz : Math.min(lp, sz), lines };
  };
  for (let i = 0; i < 15; i++) {
    const o = u16(b, smpOff + i * 2) - delta; if (smpOff + i * 2 + 2 > b.length || o < 0 || o + 2 > b.length) { m.samples[i] = null; continue; }
    m.samples[i] = objLoop(o, 0, (base, j) => {
      const q = base + ((j * 4) & 255), f = b[q] || 0, n = b[q + 1] || 0;
      return { level: f & 15, toneMask: (f >> 4) & 1, noiseMask: (f >> 7) & 1, envMask: n & 1, noise: (n & 62) >> 1, vib: s16(b, q + 2) };
    });
  }
  for (let i = 0; i < 16; i++) {
    const o = u16(b, ornOff + i * 2) - delta; if (o < 0 || o + 2 > b.length) { m.orns[i] = null; continue; }
    m.orns[i] = objLoop(o, 0, (base, j) => s8(b[base + (j & 255)] || 0));
  }
  return m;
}

class STPPlayer {
  constructor(bytes) {
    this.b = bytes; this.m = parseSTP(bytes); this.title = this.m.title;
    this.tempo = this.m.tempo; this.posIdx = 0; this.quirk = 0; this.patLoaded = false; this.done = false;
    this.ch = [0, 1, 2].map(() => ({ en: false, env: false, vol: 0, note: 0, smp: 0, pis: 0, orn: 0, pio: 0, slide: 0, gliss: 0 }));
  }
  startPattern() {
    this.cur = this.m.pats[this.m.pos[this.posIdx].pat].map(o => ({ off: o, period: 0, counter: 0 }));
    this.lineCount = 0; this.patLoaded = true;
  }
  nextLine() {
    const b = this.b, cs = this.cur;
    if (this.lineCount >= 64) return false;
    if (cs[0].counter === 0 && (cs[0].off >= b.length || cs[0].off < 0 || b[cs[0].off] === 0)) return false;
    for (let c = 0; c < 3; c++) {
      const s = cs[c];
      if (s.counter) { s.counter--; continue; }
      this.parseChannel(s, this.ch[c]);
      s.counter = s.period;
    }
    this.lineCount++;
    return true;
  }
  parseChannel(s, st) {
    const b = this.b;
    while (s.off < b.length && s.off >= 0) {
      const cmd = b[s.off++];
      if (cmd === 0) continue;
      else if (cmd <= 0x60) { st.en = true; st.note = cmd - 1; st.pis = st.pio = 0; st.slide = 0; return; }
      else if (cmd <= 0x6f) { st.smp = cmd - 0x61; st.pis = 0; }
      else if (cmd <= 0x7f) { st.orn = cmd - 0x70; st.pio = 0; st.env = false; st.gliss = 0; }
      else if (cmd <= 0xbf) s.period = cmd - 0x80;
      else if (cmd <= 0xcf) {
        if (cmd !== 0xc0) { this.envType = cmd - 0xc0; this.envTone = b[s.off++]; this.envSet = true; }
        st.env = true; st.orn = 0; st.pio = 0; st.gliss = 0;
      }
      else if (cmd <= 0xdf) { st.en = false; st.pis = st.pio = 0; return; }
      else if (cmd <= 0xef) return;
      else if (cmd === 0xf0) st.gliss = s8(b[s.off++]);
      else st.vol = cmd - 0xf1;
    }
  }
  frame(regs) {
    if (this.done) return false;
    this.envSet = false;
    if (this.quirk === 0) {
      if (!this.patLoaded) this.startPattern();
      while (!this.nextLine()) {
        this.posIdx++; this.patLoaded = false;
        if (this.posIdx >= this.m.pos.length) { this.done = true; return false; }
        this.startPattern();
      }
    }
    this.quirk = (this.quirk + 1) % this.tempo;
    const trans = this.m.pos[this.posIdx].trans;
    let mixer = 0;
    for (let c = 0; c < 3; c++) {
      const st = this.ch[c];
      const smp = this.m.samples[st.smp], orn = this.m.orns[st.orn];
      if (!st.en || !smp || !smp.lines.length) { regs[8 + c] = 0; mixer |= (1 << c) | (8 << c); continue; }
      const ln = smp.lines[st.pis];
      st.slide += st.gliss;
      let lvl = ln.level - st.vol; if (lvl < 0) lvl = 0;
      regs[8 + c] = lvl | ((ln.envMask && st.env) ? 16 : 0);
      const ol = (!st.env && orn && orn.lines.length) ? orn.lines[st.pio] : 0;
      const note = Math.max(0, Math.min(95, st.note + trans + ol));
      const per = Math.max(0, Math.min(4095, ST_TABLE[note] + st.slide + ln.vib));
      regs[c * 2] = per & 255; regs[c * 2 + 1] = per >> 8;
      if (ln.toneMask) mixer |= (1 << c);
      if (ln.noiseMask) mixer |= (8 << c); else regs[6] = ln.noise;
      if (orn && orn.lines.length && ++st.pio >= orn.lines.length) st.pio = orn.loop;
      if (++st.pis >= smp.lines.length) { if (smp.loop < st.pis) st.pis = smp.loop; else st.en = false; }
    }
    regs[7] = mixer;
    if (this.envSet) { regs[11] = this.envTone; regs[12] = 0; regs[13] = this.envType; }
    return true;
  }
}
FORMATS.push({ name: 'Sound Tracker Pro (STP)', exts: ['stp'], create: b => new STPPlayer(b) });
addLoopBack(STPPlayer, m => m.loop);
