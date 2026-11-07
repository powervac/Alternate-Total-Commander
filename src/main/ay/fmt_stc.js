// Sound Tracker Compiled (.stc), Sound Tracker 1.x
const ST_TABLE = [
0xef8,0xe10,0xd60,0xc80,0xbd8,0xb28,0xa88,0x9f0,0x960,0x8e0,0x858,0x7e0,
0x77c,0x708,0x6b0,0x640,0x5ec,0x594,0x544,0x4f8,0x4b0,0x470,0x42c,0x3f0,
0x3be,0x384,0x358,0x320,0x2f6,0x2ca,0x2a2,0x27c,0x258,0x238,0x216,0x1f8,
0x1df,0x1c2,0x1ac,0x190,0x17b,0x165,0x151,0x13e,0x12c,0x11c,0x10b,0x0fc,
0x0ef,0x0e1,0x0d6,0x0c8,0x0bd,0x0b2,0x0a8,0x09f,0x096,0x08e,0x085,0x07e,
0x077,0x070,0x06b,0x064,0x05e,0x059,0x054,0x04f,0x04b,0x047,0x042,0x03f,
0x03b,0x038,0x035,0x032,0x02f,0x02c,0x02a,0x027,0x025,0x023,0x021,0x01f,
0x01d,0x01c,0x01a,0x019,0x017,0x016,0x015,0x013,0x012,0x011,0x010,0x00f];

const ST_EMPTY_SAMPLE = { loop: 0, limit: 0, lines: Array.from({ length: 32 }, () => ({ level: 0, noise: 0, noiseMask: 1, envMask: 1, effect: 0 })) };
const ST_EMPTY_ORN = new Array(32).fill(0);

function parseSTC(b) {
  if (b.length < 128) throw new Error('STC: файл слишком короткий');
  const m = { tempo: b[0], title: '', pos: [], samples: {}, orns: {}, pats: {} };
  const posOff = u16(b, 1), ornOff = u16(b, 3), patOff = u16(b, 5);
  if (!m.tempo || posOff + 3 > b.length || ornOff > b.length || patOff > b.length) throw new Error('STC: неверный заголовок');
  const id = ayStr(b, 7, 18);
  m.title = /^(SONG BY|SOUND TRACKER|S\.T\.|S\.W\.|STU SONG)/.test(id) ? '' : id;
  for (let i = 0; i < 16; i++) {
    const o = 27 + i * 99; if (o + 99 > b.length) break;
    const num = b[o], lines = [];
    for (let j = 0; j < 32; j++) {
      const q = o + 1 + j * 3, h = b[q], n = b[q + 1], l = b[q + 2];
      const eff = ((h & 240) * 16) + l;
      lines.push({ level: h & 15, effect: (n & 32) ? eff : -eff, noise: n & 31, noiseMask: (n & 128) ? 1 : 0, envMask: (n & 64) ? 1 : 0 });
    }
    const loop = Math.min(b[o + 97], 32), limit = Math.min(b[o + 97] + b[o + 98], 32);
    if (!(num in m.samples)) m.samples[num] = { loop, limit, lines };
  }
  for (let i = 0; i < 16; i++) {
    const o = ornOff + i * 33; if (o + 33 > b.length) break;
    const num = b[o]; if (!(num in m.orns)) m.orns[num] = Array.from(b.subarray(o + 1, o + 33), s8);
  }
  const len = b[posOff] + 1;
  for (let i = 0; i < len; i++) {
    const o = posOff + 1 + i * 2; if (o + 2 > b.length) break;
    if (b[o] < 1 || b[o] > 32) throw new Error('STC: неверный номер паттерна');
    m.pos.push({ pat: b[o], trans: s8(b[o + 1]) });
  }
  if (!m.pos.length) throw new Error('STC: пустой список позиций');
  for (let i = 0; i < 32; i++) {
    const o = patOff + i * 7; if (o + 7 > b.length) break;
    if (b[o] < 1 || b[o] > 32) break;
    if (!(b[o] in m.pats)) m.pats[b[o]] = [u16(b, o + 1), u16(b, o + 3), u16(b, o + 5)];
  }
  for (const p of m.pos) if (!m.pats[p.pat]) m.pats[p.pat] = null;
  return m;
}

class STCPlayer {
  constructor(bytes, model) {
    this.b = bytes; this.m = model || parseSTC(bytes); this.title = this.m.title;
    this.tempo = this.m.tempo; this.posIdx = 0; this.quirk = 0; this.patLoaded = false; this.done = false;
    this.envType = 0; this.envTone = 0;
    this.ch = [0, 1, 2].map(() => ({ note: 0, pos: 0, count: -1, smp: ST_EMPTY_SAMPLE, orn: ST_EMPTY_ORN, env: 0 }));
  }
  startPattern() {
    const offs = this.m.pats[this.m.pos[this.posIdx].pat];
    this.cur = offs ? offs.map(o => ({ off: o, period: 0, counter: 0 })) : null;
    this.lineCount = 0; this.patLoaded = true;
  }
  nextLine() {
    const b = this.b, cs = this.cur;
    if (!cs || this.lineCount >= 64) return false;
    if (cs[0].counter === 0 && (cs[0].off >= b.length || b[cs[0].off] === 0xff)) return false;
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
      if (cmd <= 0x5f) { st.count = 32; st.note = cmd; st.pos = 0; return; }
      else if (cmd <= 0x6f) st.smp = this.m.samples[cmd - 0x60] || ST_EMPTY_SAMPLE;
      else if (cmd <= 0x7f) { st.env = 0; st.orn = this.m.orns[cmd - 0x70] || ST_EMPTY_ORN; }
      else if (cmd === 0x80) { st.count = -1; return; }
      else if (cmd === 0x81) return;
      else if (cmd === 0x82) { st.orn = this.m.orns[0] || ST_EMPTY_ORN; st.env = 0; }
      else if (cmd <= 0x8e) { st.orn = this.m.orns[0] || ST_EMPTY_ORN; this.envType = cmd - 0x80; this.envTone = b[s.off++]; st.env = 1; }
      else s.period = (cmd + 0x100 - 0xa1) & 0xff;
    }
  }
  // cursor step (StateCursor::Next)
  static next(st, smp) {
    if (st.count < 0) return;
    st.count--; st.pos = (st.pos + 1) & 31;
    if (st.count === 0) {
      if (smp.loop) { st.pos = smp.loop & 31; st.count = smp.limit - smp.loop + 1; }
      else st.count = -1;
    }
  }
  frame(regs) {
    if (this.done) return false;
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
      const st = this.ch[c], nx = { pos: st.pos, count: st.count };
      STCPlayer.next(nx, st.smp);
      if (nx.count < 0) { regs[8 + c] = 0; mixer |= (1 << c) | (8 << c); continue; }
      const idx = (nx.pos - 1) & 31, ln = st.smp.lines[idx];
      const note = Math.max(0, Math.min(95, st.note + st.orn[idx] + trans));
      const per = Math.max(0, Math.min(4095, ST_TABLE[note] + ln.effect));
      regs[c * 2] = per & 255; regs[c * 2 + 1] = per >> 8;
      regs[8 + c] = ln.level | (st.env ? 16 : 0);
      if (ln.envMask) mixer |= (1 << c);
      if (ln.noiseMask) mixer |= (8 << c); else regs[6] = ln.noise;
    }
    regs[7] = mixer;
    if (this.envType) { regs[11] = this.envTone; regs[12] = 0; regs[13] = this.envType; }
    for (const st of this.ch) {
      STCPlayer.next(st, st.smp);
      if (st.count >= 0) { if (st.env === 2) this.envType = 0; else if (st.env === 1) { st.env = 2; this.envType = 0; } }
    }
    return true;
  }
}
FORMATS.push({ name: 'Sound Tracker Compiled (STC)', exts: ['stc'], create: b => new STCPlayer(b) });
addLoopBack(STCPlayer, () => 0);
