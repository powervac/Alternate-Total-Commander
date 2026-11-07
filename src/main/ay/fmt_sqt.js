// SQ-Tracker compiled (.sqt)
function parseSQT(b) {
  if (b.length < 256) throw new Error('SQT: файл слишком короткий');
  const smpOff = u16(b, 2), ornOff = u16(b, 4), patOff = u16(b, 6), posOff = u16(b, 8);
  const delta = smpOff - 10;
  if (delta < 0 || posOff < delta || patOff < delta || ornOff < delta) throw new Error('SQT: неверный заголовок');
  const m = { title: '', samples: {}, orns: {}, pats: {}, pos: [] };
  // positions: C, B, A (2 bytes each) + tempo
  const chan = o => ({ pat: b[o] & 127, fx: !!(b[o] & 128), trans: ((t => t < 9 ? t : -(t - 9) - 1)(b[o + 1] >> 4)), att: b[o + 1] & 15 });
  const loopOff = u16(b, 10) - delta; m.loop = 0;
  for (let o = posOff - delta; o + 7 <= b.length; o += 7) {
    if (o === loopOff) m.loop = m.pos.length;
    const C = chan(o), B = chan(o + 2), A = chan(o + 4);
    if (!C.pat || !B.pat || !A.pat) break;
    m.pos.push({ ch: [A, B, C], tempo: b[o + 6] });
  }
  if (!m.pos.length) throw new Error('SQT: пустой список позиций');
  const sample = i => {
    const ea = smpOff + i * 2 - delta; if (ea + 2 > b.length) return null;
    const o = u16(b, ea) - delta; if (o < 0 || o + 98 > b.length) return null;
    const lines = [];
    for (let j = 0; j < 32; j++) {
      const q = o + 2 + j * 3, v = b[q], f = b[q + 1], d = b[q + 2];
      const dv = d | ((f & 15) << 8);
      lines.push({ level: v & 15, noise: ((v & 240) >> 3) | ((f & 128) >> 7), enNoise: (f >> 5) & 1, enTone: (f >> 6) & 1, dev: (f & 16) ? dv : -dv });
    }
    const loop = Math.min(b[o], 32);
    return { loop, limit: Math.min(loop + b[o + 1], 32), lines };
  };
  const ornament = i => {
    const ea = ornOff + i * 2 - delta; if (ea + 2 > b.length) return null;
    const o = u16(b, ea) - delta; if (o < 0 || o + 34 > b.length) return null;
    const loop = Math.min(b[o], 32);
    return { loop, limit: Math.min(loop + b[o + 1], 32), lines: Array.from(b.subarray(o + 2, o + 34), s8) };
  };
  // decode one channel pattern into per-row cells
  const decode = idx => {
    const ea = patOff + idx * 2 - delta; if (ea + 2 > b.length) throw new Error('SQT: неверный паттерн');
    const o = u16(b, ea) - delta; if (o < 0 || o >= b.length) throw new Error('SQT: неверный паттерн');
    const size = b[o], rows = [];
    let cur = o + 1, counter = 0, lastNote = 0, lastStart = 0, repeat = false;
    const effect = (cell, code, param) => {
      switch (code - 1) {
        case 0: cell.cmds.push({ t: 'att', v: param & 15, g: false }); break;
        case 1: cell.cmds.push({ t: 'attadd', v: s8(param), g: false }); break;
        case 2: cell.cmds.push({ t: 'att', v: param, g: true }); break;
        case 3: cell.cmds.push({ t: 'attadd', v: s8(param), g: true }); break;
        case 4: cell.tempo = (param & 31) ? (param & 31) : 32; break;
        case 5: cell.cmds.push({ t: 'tempoadd', v: param }); break;
        case 6: cell.cmds.push({ t: 'gliss', v: -param }); break;
        case 7: cell.cmds.push({ t: 'gliss', v: param }); break;
        default: cell.cmds.push({ t: 'env', type: (code - 1) & 15, v: param });
      }
    };
    const params = (cell, start) => {
      let c = start; const cmd = b[c++];
      if (cmd & 128) {
        const s = (cmd >> 1) & 31; if (s) { cell.enabled = true; cell.sample = s; }
        if (cmd & 64) {
          const p = b[c++]; const orn = (p >> 4) | ((cmd & 1) << 4); if (orn) cell.orn = orn;
          if (p & 15) effect(cell, p & 15, b[c++]);
        }
      } else effect(cell, cmd, b[c++]);
      return c;
    };
    const parseNote = (cell, c) => {
      const cmd = b[c];
      if (cmd < 0x80) params(cell, c + 1); else { cell.enabled = true; cell.sample = cmd & 31; }
    };
    for (let row = 0; row < size && cur < b.length + 8; row++) {
      const cell = { cmds: [] };
      let has = false;
      if (counter) {
        counter--;
        if (repeat) { parseNote(cell, lastStart); has = true; }
      } else {
        repeat = false;
        const cmd = b[cur++]; has = true;
        if (cmd <= 0x5f) { lastNote = cmd; lastStart = cur - 1; cell.note = cmd; cur = params(cell, cur); }
        else if (cmd <= 0x6e) effect(cell, cmd - 0x60, b[cur++]);
        else if (cmd === 0x6f) cell.enabled = false;
        else if (cmd <= 0x7f) { cell.enabled = false; effect(cell, cmd - 0x6f, b[cur++]); }
        else if (cmd <= 0x9f) {
          const add = cmd & 15; lastNote += (cmd & 16) ? -add : add; cell.note = lastNote; parseNote(cell, lastStart);
        }
        else if (cmd <= 0xbf) {
          counter = cmd & 15;
          if (cmd & 16) { repeat = repeat || counter !== 0; parseNote(cell, lastStart); }
        }
        else { lastStart = cur - 1; cell.enabled = true; cell.sample = cmd & 31; }
      }
      rows.push(has ? cell : null);
    }
    return rows;
  };
  const cache = {};
  for (const p of m.pos) for (const c of p.ch) {
    if (!(c.pat in cache)) cache[c.pat] = decode(c.pat);
    if (!(c.pat in m.pats)) m.pats[c.pat] = cache[c.pat];
  }
  for (let i = 1; i <= 26; i++) { const s = sample(i); if (s) m.samples[i] = s; const o = ornament(i); if (o) m.orns[i] = o; }
  return m;
}

class SQTPlayer {
  constructor(bytes) {
    this.b = bytes; this.m = parseSQT(bytes); this.title = this.m.title; this.T = PT3_TABLES.sqt;
    this.tempo = 3; this.posIdx = 0; this.row = -1; this.quirk = 0; this.done = false; this.newPos = true;
    this.ch = [0, 1, 2].map(() => ({ note: 0, att: 0, trans: 0, smp: null, tick: 0, pos: 0, orn: null, otick: 0, opos: 0, env: false, sliding: 0, gliss: 0 }));
  }
  frame(regs) {
    if (this.done) return false;
    this.envSet = false;
    if (this.quirk === 0) {
      this.row++;
      let pos = this.m.pos[this.posIdx];
      if (this.newPos || this.row >= this.m.pats[pos.ch[2].pat].length) {
        if (!this.newPos) { this.posIdx++; this.row = 0; }
        if (this.posIdx >= this.m.pos.length) { this.done = true; return false; }
        pos = this.m.pos[this.posIdx]; this.row = 0; this.newPos = false;
        this.curTempo = pos.tempo;
        for (let c = 0; c < 3; c++) { this.ch[c].att = pos.ch[c].att; this.ch[c].trans = pos.ch[c].trans; }
      }
      this.newLine(pos);
    }
    this.quirk = (this.quirk + 1) % this.tempo;
    let mixer = 0;
    for (let c = 2; c >= 0; c--) mixer |= this.synth(c, regs);
    regs[7] = mixer;
    if (this.envSet) { regs[11] = this.envV; regs[12] = 0; regs[13] = this.envT; }
    return true;
  }
  newLine(pos) {
    let tempo = this.curTempo;
    for (let c = 2; c >= 0; c--) {
      const cell = this.m.pats[pos.ch[c].pat][this.row]; if (!cell) continue;
      const fx = pos.ch[c].fx, st = this.ch[c];
      if (fx && cell.tempo) tempo = cell.tempo;
      if (cell.enabled === false) { st.smp = null; st.orn = null; }
      if (cell.note !== undefined) st.note = cell.note;
      if (cell.sample !== undefined) {
        st.smp = this.m.samples[cell.sample] || null; st.tick = 32; st.pos = 0; st.orn = null; st.env = false; st.gliss = 0;
      }
      if (cell.orn !== undefined) { st.orn = this.m.orns[cell.orn] || null; st.otick = 32; st.opos = 0; }
      for (const k of cell.cmds) {
        switch (k.t) {
          case 'env': this.envT = k.type; this.envV = k.v; this.envSet = true; st.env = true; break;
          case 'gliss': st.gliss = k.v; st.sliding = 0; break;
          case 'att': if (fx) { if (k.g) for (const x of this.ch) x.att = k.v; else st.att = k.v; } break;
          case 'attadd': if (fx) { if (k.g) for (const x of this.ch) x.att = (x.att + k.v) & 15; else st.att = (st.att + k.v) & 15; } break;
          case 'tempoadd': if (fx) tempo = (tempo + k.v) & 31; break;
        }
      }
    }
    this.curTempo = tempo; this.tempo = tempo || 32;
  }
  synth(c, regs) {
    const st = this.ch[c];
    if (!st.smp) { regs[8 + c] = 0; return (1 << c) | (8 << c); }
    const smp = st.smp, ln = smp.lines[st.pos++ & 31];
    let mixer = 0;
    regs[8 + c] = Math.max(0, ln.level - st.att) | ((ln.level === 0 && st.env) ? 16 : 0);
    if (ln.enNoise) regs[6] = ln.noise; else mixer |= (8 << c);
    if (!ln.enTone) mixer |= (1 << c);
    let note = st.note;
    const orn = st.orn;
    if (orn) {
      note += orn.lines[st.opos++ & 31];
      st.otick = (st.otick - 1) >>> 0;
      if (!st.otick) {
        if (orn.loop !== 32) { st.opos = orn.loop; st.otick = (orn.limit - st.opos) >>> 0; }
        else { st.opos = smp.loop; st.otick = (smp.limit - st.opos) >>> 0; }
      }
    }
    note += st.trans;
    const per = Math.max(0, Math.min(4095, this.T[Math.max(0, Math.min(95, note))] + ln.dev + (st.gliss ? st.sliding : 0)));
    regs[c * 2] = per & 255; regs[c * 2 + 1] = per >> 8;
    st.tick = (st.tick - 1) >>> 0;
    if (!st.tick) {
      st.pos = smp.loop; st.tick = (smp.limit - st.pos) >>> 0;
      if (st.pos === 32) { st.smp = null; st.orn = null; }
    }
    st.sliding += st.gliss;
    return mixer;
  }
}
FORMATS.push({ name: 'SQ-Tracker (SQT)', exts: ['sqt'], create: b => new SQTPlayer(b) });
SQTPlayer.prototype.loopBack = function () {
  this.done = false; this.posIdx = Math.min(this.m.loop, this.m.pos.length - 1); this.row = -1; this.newPos = true; this.quirk = 0;
  return true;
};
