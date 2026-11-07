// Pro Tracker 2.x (.pt2)
const PT2_TABLE = [
0xef8,0xe10,0xd60,0xc80,0xbd8,0xb28,0xa88,0x9f0,0x960,0x8e0,0x858,0x7e0,
0x77c,0x708,0x6b0,0x640,0x5ec,0x594,0x544,0x4f8,0x4b0,0x470,0x42c,0x3fd,
0x3be,0x384,0x358,0x320,0x2f6,0x2ca,0x2a2,0x27c,0x258,0x238,0x216,0x1f8,
0x1df,0x1c2,0x1ac,0x190,0x17b,0x165,0x151,0x13e,0x12c,0x11c,0x10a,0x0fc,
0x0ef,0x0e1,0x0d6,0x0c8,0x0bd,0x0b2,0x0a8,0x09f,0x096,0x08e,0x085,0x07e,
0x077,0x070,0x06b,0x064,0x05e,0x059,0x054,0x04f,0x04b,0x047,0x042,0x03f,
0x03b,0x038,0x035,0x032,0x02f,0x02c,0x02a,0x027,0x025,0x023,0x021,0x01f,
0x01d,0x01c,0x01a,0x019,0x017,0x016,0x015,0x013,0x012,0x011,0x010,0x00f];

function ayStr(b, o, n) {
  let s = '';
  for (let i = 0; i < n && o + i < b.length; i++) { const c = b[o + i]; s += c >= 32 && c < 127 ? String.fromCharCode(c) : ' '; }
  return s.trim();
}
const u16 = (b, o) => (b[o] | (b[o + 1] << 8));
const s8 = v => (v << 24) >> 24;
// Position-list trackers restart from the module's loop position (used when 'repeats' > 1)
function addLoopBack(cls, loopOf) {
  cls.prototype.loopBack = function () {
    const l = loopOf(this.m);
    if (l == null || !this.m.pos.length) return false;
    this.done = false; this.posIdx = Math.max(0, Math.min(l, this.m.pos.length - 1)); this.patLoaded = false; this.quirk = 0;
    return true;
  };
}
const s16 = (b, o) => ((b[o] | (b[o + 1] << 8)) << 16) >> 16;

function parsePT2(b) {
  if (b.length < 132) throw new Error('PT2: файл слишком короткий');
  const m = { tempo: b[0], loop: b[2], title: ayStr(b, 101, 30), pos: [], samples: [], orns: [], pats: {} };
  for (let i = 131; i < b.length && b[i] !== 0xff; i++) m.pos.push(b[i]);
  if (!m.pos.length) throw new Error('PT2: пустой список позиций');
  const patOff = u16(b, 99);
  for (let i = 0; i < 32; i++) {
    const o = u16(b, 3 + i * 2);
    if (!o || o + 2 > b.length) { m.samples[i] = null; continue; }
    const size = b[o], loop = b[o + 1], lines = [];
    for (let j = 0; j < size; j++) {
      const q = o + 2 + j * 3;
      const n = b[q] || 0, h = b[q + 1] || 0, l = b[q + 2] || 0;
      const v = ((h & 15) << 8) | l;
      lines.push({ noiseOff: n & 1, toneOff: (n >> 1) & 1, noise: n >> 3, level: h >> 4, vib: (n & 4) ? v : -v });
    }
    m.samples[i] = { loop: Math.min(loop, size), lines };
  }
  for (let i = 0; i < 16; i++) {
    const o = u16(b, 67 + i * 2);
    if (!o || o + 2 > b.length) { m.orns[i] = null; continue; }
    const size = b[o], loop = b[o + 1], lines = [];
    for (let j = 0; j < size; j++) lines.push(s8(b[o + 2 + j] || 0));
    m.orns[i] = { loop: Math.min(loop, size), lines };
  }
  for (const p of new Set(m.pos)) {
    const o = patOff + p * 6;
    if (o + 6 > b.length) throw new Error('PT2: неверный указатель паттернов');
    m.pats[p] = [u16(b, o), u16(b, o + 2), u16(b, o + 4)];
  }
  return m;
}

class PT2Player {
  constructor(bytes) {
    this.b = bytes; this.m = parsePT2(bytes); this.title = this.m.title;
    this.tempo = this.m.tempo || 3; this.posIdx = 0; this.quirk = 0; this.patLoaded = false;
    this.ch = [0, 1, 2].map(() => ({ en: false, env: false, note: 0, smp: 1, pis: 0, orn: 0, pio: 0, vol: 15,
      noiseAdd: 0, sliding: 0, gliss: 0, target: -1, pendingNoteGliss: false }));
    this.cur = null; this.done = false;
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
      if (cmd === 0) continue;
      else if (cmd >= 0xe1) { st.smp = cmd - 0xe0; st.pis = 0; }
      else if (cmd === 0xe0) { st.en = false; st.sliding = st.gliss = 0; st.target = -1; st.pis = st.pio = 0; return; }
      else if (cmd >= 0x80) {
        const note = cmd - 0x80;
        st.en = true; st.pis = st.pio = 0;
        if (st.pendingNoteGliss) { st.target = note; st.pendingNoteGliss = false; }
        else { st.note = note; st.sliding = 0; st.gliss = 0; st.target = -1; }
        return;
      }
      else if (cmd === 0x7f) st.env = false;
      else if (cmd >= 0x71) { this.envType = cmd - 0x70; this.envPer = u16(b, s.off); s.off += 2; st.env = true; this.envSet = true; }
      else if (cmd === 0x70) return;
      else if (cmd >= 0x60) { st.orn = cmd - 0x60; st.pio = 0; }
      else if (cmd >= 0x20) s.period = cmd - 0x20;
      else if (cmd >= 0x10) st.vol = cmd - 0x10;
      else if (cmd === 0x0f) this.tempo = b[s.off++];
      else if (cmd === 0x0e) { st.gliss = s8(b[s.off++]); st.target = -1; }
      else if (cmd === 0x0d) { st.sliding = 0; st.gliss = s8(b[s.off++]); st.pendingNoteGliss = true; s.off += 2; }
      else if (cmd === 0x0c) st.gliss = 0;
      else st.noiseAdd = s8(b[s.off++]);
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
      if (!st.en) { regs[8 + c] = 0; mixer |= (1 << c) | (8 << c); continue; }
      const smp = this.m.samples[st.smp], orn = this.m.orns[st.orn];
      const sl = smp && smp.lines.length ? smp.lines[st.pis] : { noiseOff: 1, toneOff: 1, noise: 0, level: 0, vib: 0 };
      const ol = orn && orn.lines.length ? orn.lines[st.pio] : 0;
      const note = Math.max(0, Math.min(95, st.note + ol));
      const per = Math.max(0, Math.min(4095, PT2_TABLE[note] + st.sliding + sl.vib));
      regs[c * 2] = per & 255; regs[c * 2 + 1] = per >> 8;
      if (sl.toneOff) mixer |= (1 << c);
      const v = st.vol, lvl = ((v * 17 + (v > 7 ? 1 : 0)) * sl.level) >> 8;
      regs[8 + c] = lvl | (st.env ? 16 : 0);
      if (!sl.noiseOff) regs[6] = (sl.noise + st.noiseAdd) & 31; else mixer |= (8 << c);
      if (st.target >= 0) {
        const real = (PT2_TABLE[st.target] - PT2_TABLE[st.note]) - (st.sliding + st.gliss);
        if ((st.gliss > 0 && real <= 0) || (st.gliss < 0 && real >= 0)) { st.note = st.target; st.target = -1; st.sliding = st.gliss = 0; }
      }
      st.sliding += st.gliss;
      if (smp && ++st.pis >= smp.lines.length) st.pis = smp.loop;
      if (orn && ++st.pio >= orn.lines.length) st.pio = orn.loop;
    }
    regs[7] = mixer;
    if (this.envSet) { regs[11] = this.envPer & 255; regs[12] = this.envPer >> 8; regs[13] = this.envType; }
    return true;
  }
}

FORMATS.push({ name: 'Pro Tracker 2', exts: ['pt2'], create: b => new PT2Player(b) });
addLoopBack(PT2Player, m => m.loop);
