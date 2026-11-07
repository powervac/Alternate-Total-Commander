// Pro Tracker 1.x (.pt1)
function parsePT1(b) {
  if (b.length < 256) throw new Error('PT1: файл слишком короткий');
  const m = { tempo: b[0], loop: b[2], title: ayStr(b, 69, 30), pos: [], samples: [], orns: [], pats: {} };
  if (m.tempo < 2 || m.tempo > 15 || !b[1]) throw new Error('PT1: неверный заголовок');
  const patOff = u16(b, 67);
  for (let i = 99; i < b.length && b[i] !== 0xff; i++) { if (b[i] > 31) throw new Error('PT1: неверная позиция'); m.pos.push(b[i]); }
  if (!m.pos.length || m.pos.length > 255) throw new Error('PT1: неверный список позиций');
  if (patOff !== 99 + m.pos.length + 1) throw new Error('PT1: неверный адрес паттернов');
  for (let i = 0; i < 16; i++) {
    const o = u16(b, 3 + i * 2);
    if (!o || o + 2 > b.length) { m.samples[i] = null; continue; }
    const size = b[o], loop = b[o + 1], lines = [];
    for (let j = 0; j < size; j++) {
      const q = o + 2 + ((j * 3) & 255), h = b[q] || 0, n = b[q + 1] || 0, l = b[q + 2] || 0, v = ((h & 0xf0) << 4) | l;
      lines.push({ level: h & 15, noiseOff: (n >> 7) & 1, toneOff: (n >> 6) & 1, noise: n & 31, vib: (n & 32) ? v : -v });
    }
    m.samples[i] = { loop: Math.min(loop, size), lines };
  }
  for (let i = 0; i < 16; i++) {
    const o = u16(b, 35 + i * 2);
    if (!o || o >= b.length) { m.orns[i] = null; continue; }
    const lines = []; for (let j = 0; j < 64; j++) lines.push(s8(b[o + j] || 0));
    m.orns[i] = lines;
  }
  for (const p of new Set(m.pos)) {
    const o = patOff + p * 6; if (o + 6 > b.length) throw new Error('PT1: неверный указатель паттерна');
    m.pats[p] = [u16(b, o), u16(b, o + 2), u16(b, o + 4)];
  }
  return m;
}

class PT1Player {
  constructor(bytes) {
    this.b = bytes; this.m = parsePT1(bytes); this.title = this.m.title;
    this.tempo = this.m.tempo; this.posIdx = 0; this.quirk = 0; this.patLoaded = false; this.done = false;
    this.ch = [0, 1, 2].map(() => ({ en: false, env: false, note: 0, smp: 0, pis: 0, orn: 0, vol: 15 }));
  }
  startPattern() {
    this.cur = this.m.pats[this.m.pos[this.posIdx]].map(o => ({ off: o, period: 0, counter: 0 }));
    this.patLoaded = true; this.lineCount = 0;
  }
  nextLine() {
    const b = this.b, cs = this.cur;
    if (this.lineCount >= 64) return false;
    if (cs[0].counter === 0 && (cs[0].off >= b.length || b[cs[0].off] === 0)) return false;
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
    while (s.off < b.length) {
      const cmd = b[s.off++];
      if (cmd <= 0x5f) { st.en = true; st.note = cmd; st.pis = 0; return; }
      else if (cmd <= 0x6f) st.smp = cmd - 0x60;
      else if (cmd <= 0x7f) st.orn = cmd - 0x70;
      else if (cmd === 0x80) { st.en = false; return; }
      else if (cmd === 0x81) st.env = false;
      else if (cmd <= 0x8f) { this.envType = cmd - 0x81; this.envPer = u16(b, s.off); s.off += 2; st.env = true; this.envSet = true; }
      else if (cmd === 0x90) return;
      else if (cmd <= 0xa0) this.tempo = Math.max(1, cmd - 0x91);
      else if (cmd <= 0xb0) st.vol = cmd - 0xa1;
      else s.period = cmd - 0xb1;
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
    let mixer = 0;
    for (let c = 0; c < 3; c++) {
      const st = this.ch[c];
      const smp = this.m.samples[st.smp], orn = this.m.orns[st.orn];
      if (!st.en || !smp || !smp.lines.length) { regs[8 + c] = 0; mixer |= (1 << c) | (8 << c); continue; }
      const ln = smp.lines[st.pis];
      const half = Math.max(0, Math.min(95, st.note + (orn ? orn[st.pis & 63] : 0)));
      const per = Math.max(0, Math.min(4095, PT2_TABLE[half] + ln.vib + (half === 46 ? 1 : 0)));
      regs[c * 2] = per & 255; regs[c * 2 + 1] = per >> 8;
      if (ln.toneOff) mixer |= (1 << c);
      const v = st.vol;
      regs[8 + c] = (((v * 17 + (v > 7 ? 1 : 0)) * ln.level + 128) >> 8) | (st.env ? 16 : 0);
      if (!ln.noiseOff) regs[6] = ln.noise; else mixer |= (8 << c);
      if (++st.pis >= smp.lines.length) st.pis = smp.loop;
    }
    regs[7] = mixer;
    if (this.envSet) { regs[11] = this.envPer & 255; regs[12] = this.envPer >> 8; regs[13] = this.envType; }
    return true;
  }
}
FORMATS.push({ name: 'Pro Tracker 1 (PT1)', exts: ['pt1'], create: b => new PT1Player(b) });
addLoopBack(PT1Player, m => m.loop);
