// Global Tracker 1.x (.gtr)
function parseGTR(b) {
  if (b.length < 300) throw new Error('GTR: файл слишком короткий');
  const m = { tempo: b[0], version: b[4], title: ayStr(b, 7, 32), pos: [], samples: [], orns: [], pats: {} };
  const addr = u16(b, 5);
  if (!m.tempo) throw new Error('GTR: неверный заголовок');
  const len = b[293], loop = b[294];
  for (let i = 0; i < len; i++) {
    const v = b[295 + i]; if (v === undefined || v % 6 || v / 6 > 31) throw new Error('GTR: неверная позиция');
    m.pos.push(v / 6);
  }
  if (!m.pos.length) throw new Error('GTR: пустой список позиций');
  const un = o => { if (!o) return -1; if (o < addr) throw new Error('GTR: неверный адрес'); return o - addr; };
  for (let i = 0; i < 15; i++) {
    const o = un(u16(b, 39 + i * 2));
    if (o < 0 || o + 2 > b.length) { m.samples[i] = null; continue; }
    const lp = b[o], sz = b[o + 1], n = (sz ? sz : 256) / 4, lines = [];
    for (let j = 0; j < n; j++) {
      const q = o + 2 + ((j * 4) & 255), nf = b[q + 1] || 0;
      lines.push({ level: b[q] || 0, toneMask: (nf >> 5) & 1, noiseMask: (nf >> 6) & 1, envMask: (nf >> 7) & 1, noise: nf & 31, vib: (b[q + 2] || 0) | ((b[q + 3] || 0) << 8) });
    }
    m.samples[i] = { loop: Math.min(lp / 4 | 0, n), lines };
  }
  for (let i = 0; i < 16; i++) {
    const o = un(u16(b, 69 + i * 2));
    if (o < 0 || o + 2 > b.length) { m.orns[i] = null; continue; }
    const lp = b[o], sz = b[o + 1], lines = [];
    for (let j = 0; j < sz; j++) lines.push(s8(b[o + 2 + (j & 255)] || 0));
    m.orns[i] = { loop: Math.min(lp, sz), lines };
  }
  for (const p of new Set(m.pos)) {
    const o = 101 + p * 6;
    m.pats[p] = [0, 1, 2].map(k => u16(b, o + k * 2) - addr);
  }
  m.loop = loop;
  return m;
}

class GTRPlayer {
  constructor(bytes) {
    this.b = bytes; this.m = parseGTR(bytes); this.title = this.m.title; this.T = PT3_TABLES.st;
    this.tempo = this.m.tempo; this.posIdx = 0; this.quirk = 0; this.patLoaded = false; this.done = false;
    this.ch = [0, 1, 2].map(() => ({ en: false, env: false, note: 0, smp: 0, pis: 0, orn: 0, pio: 0, vol: 0 }));
  }
  startPattern() {
    this.cur = this.m.pats[this.m.pos[this.posIdx]].map(o => ({ off: o, period: 0, counter: 0 }));
    this.lineCount = 0; this.patLoaded = true;
  }
  nextLine() {
    const b = this.b, cs = this.cur;
    if (this.lineCount >= 64) return false;
    if (cs[0].counter === 0 && (cs[0].off >= b.length || cs[0].off < 0 || b[cs[0].off] === 0xff)) return false;
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
    const b = this.b, newVer = this.m.version !== 0x10;
    s.period = 0;
    while (s.off < b.length) {
      const cmd = b[s.off++];
      if (cmd <= 0x5f) { st.en = true; st.note = cmd; st.pis = st.pio = 0; return; }
      else if (cmd <= 0x6f) st.smp = cmd - 0x60;
      else if (cmd <= 0x7f) { st.orn = cmd - 0x70; st.pio = 0; if (newVer) st.env = false; }
      else if (cmd <= 0xbf) s.period = cmd - 0x80;
      else if (cmd <= 0xcf) { this.envType = cmd - 0xc0; this.envTone = b[s.off++]; this.envSet = true; st.env = true; }
      else if (cmd <= 0xdf) return;
      else if (cmd === 0xe0) { st.en = false; if (newVer) return; }
      else if (cmd <= 0xef) st.vol = 15 - (cmd - 0xe0);
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
    let mixer = 0, noise = 0;
    for (let c = 0; c < 3; c++) {
      const st = this.ch[c], smp = this.m.samples[st.smp], orn = this.m.orns[st.orn];
      if (!st.en || !smp || !smp.lines.length) { regs[8 + c] = 0; mixer |= (1 << c) | (8 << c); continue; }
      const ln = smp.lines[st.pis];
      const half = Math.max(0, Math.min(95, st.note + (orn && orn.lines.length ? orn.lines[st.pio] : 0)));
      const per = (this.T[half] + ln.vib) & 0xfff;
      regs[c * 2] = per & 255; regs[c * 2 + 1] = per >> 8;
      if (ln.toneMask) mixer |= (1 << c);
      regs[8 + c] = (Math.max(0, Math.min(255, ln.level - st.vol)) & 15) | ((st.env && ln.envMask) ? 16 : 0);
      noise |= ln.noise;
      if (ln.noiseMask) mixer |= (8 << c);
      if (++st.pis >= smp.lines.length) st.pis = smp.loop;
      if (orn && orn.lines.length && ++st.pio >= orn.lines.length) st.pio = orn.loop;
    }
    regs[7] = mixer; regs[6] = noise & 31;
    if (this.envSet) { regs[11] = this.envTone; regs[12] = 0; regs[13] = this.envType; }
    return true;
  }
}
FORMATS.push({ name: 'Global Tracker (GTR)', exts: ['gtr'], create: b => new GTRPlayer(b) });
addLoopBack(GTRPlayer, m => m.loop);
