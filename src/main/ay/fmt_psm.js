// Pro Sound Maker compiled (.psm)
function parsePSM(b) {
  if (b.length < 0x80) throw new Error('PSM: файл слишком короткий');
  const posOff = u16(b, 0), smpOff = u16(b, 2), ornOff = u16(b, 4), patOff = u16(b, 6);
  if (posOff < 8 || posOff + 2 > b.length || smpOff + 2 > b.length || patOff + 7 > b.length || ornOff > b.length) throw new Error('PSM: неверный заголовок');
  const m = { title: '', pos: [], samples: {}, orns: {}, pats: {} };
  let tb = 8; if (posOff - 8 >= 5 && String.fromCharCode(...b.subarray(8, 12)) === 'psm1') tb += 5;
  if (tb < posOff) m.title = ayStr(b, tb, posOff - tb);
  for (let o = posOff; o + 2 <= b.length; o += 2) {
    if (b[o] === 0xff) { if (b[o + 1] !== 0xff) m.loop = b[o + 1]; break; }
    m.pos.push({ pat: b[o], trans: s8(b[o + 1]) });
    if (m.pos.length > 255) break;
  }
  if (!m.pos.length) throw new Error('PSM: пустой список позиций');
  const sample = i => {
    const o = u16(b, smpOff + i * 2); if (!o || o + 2 > b.length) return null;
    const sz = b[o], lp = b[o + 1], n = 1 + (sz & 0x1f), lines = [];
    for (let j = 0; j < n; j++) {
      const q = o + 2 + ((j * 3) & 255), f = b[q] || 0, nh = b[q + 1] || 0, lo = b[q + 2] || 0;
      const v = ((nh & 7) << 8) | lo;
      lines.push({ level: f & 15, toneMask: (f >> 4) & 1, noiseMask: (f >> 7) & 1, noise: nh >> 3, gliss: (nh & 4) ? ((v | 0xf800) << 16) >> 16 : v });
    }
    const counter = (lp & 0xe0) >> 5, vd = (sz & 0xc0) >> 6;
    return { lines, loop: counter ? Math.min(lp & 31, n) : n, vdPeriod: counter, vdValue: (sz & 0x20) ? -vd - 1 : vd };
  };
  const ornament = i => {
    const o = u16(b, ornOff + i * 2); if (!o || o + 2 > b.length) return null;
    const n = b[o] + 1, lp = b[o + 1], lines = [];
    for (let j = 0; j < n; j++) lines.push(s8(b[o + 2 + (j & 255)] || 0));
    return { lines, loop: (lp & 128) ? Math.min(lp & 31, n) : n };
  };
  for (let i = 0; i < 15; i++) { const s = sample(i); if (s) m.samples[i] = s; }
  if (ornOff !== patOff) for (let i = 0; i < 32; i++) { const o = ornament(i); if (o) m.orns[i] = o; }
  for (const p of new Set(m.pos.map(x => x.pat))) {
    const o = patOff + p * 7; if (o + 7 > b.length) throw new Error('PSM: неверный номер паттерна');
    m.pats[p] = { tempo: b[o], offs: [u16(b, o + 1), u16(b, o + 3), u16(b, o + 5)] };
  }
  return m;
}

class PSMPlayer {
  constructor(bytes) {
    this.b = bytes; this.m = parsePSM(bytes); this.title = this.m.title; this.T = PT3_TABLES.psm;
    this.tempo = 3; this.posIdx = 0; this.quirk = 0; this.patLoaded = false; this.done = false;
    this.stubS = { lines: [{ level: 0, toneMask: 1, noiseMask: 1, noise: 0, gliss: 0 }], loop: 1, vdPeriod: 0, vdValue: 0 };
    this.stubO = { lines: [], loop: 0 };
    this.ch = [0, 1, 2].map(() => ({ en: false, env: { reinit: false, type: 0, note: null, tone: null }, note: 0,
      smp: this.m.samples[0] || this.stubS, sp: 0, loops: 0, sFin: false, orn: this.m.orns[0] || this.stubO, op: 0, oFin: false, oKeep: false,
      vd: 0, bvd: 0, slide: 0 }));
  }
  startPattern() {
    const p = this.m.pats[this.m.pos[this.posIdx].pat];
    this.tempo = Math.max(1, p.tempo);
    this.cur = p.offs.map(o => ({ off: o, period: 0, counter: 0, note: 48 })); this.lineNo = 0; this.patLoaded = true;
  }
  nextLine() {
    const b = this.b, cs = this.cur;
    if (this.lineNo >= 64) return false;
    for (let c = 0; c < 3; c++) if (!cs[c].counter && (cs[c].off >= b.length || b[cs[c].off] >= 0xfc)) return false;
    for (let c = 0; c < 3; c++) {
      const s = cs[c];
      if (s.counter) { s.counter--; continue; }
      this.parseChannel(s, this.ch[c]);
      s.counter = s.period;
    }
    this.lineNo++;
    return true;
  }
  parseChannel(s, st) {
    const b = this.b, cell = { cmds: [] };
    while (s.off < b.length) {
      const cmd = b[s.off++];
      if (cmd <= 0x5f) {
        s.note = s.note >= cmd ? s.note - cmd : (s.note + 0x60 - cmd) & 0xff;
        cell.note = s.note & 0x7f; cell.en = true;
        if (s.note & 0x80) cell.en = false;
        break;
      }
      else if (cmd === 0x60) { cell.en = false; break; }
      else if (cmd <= 0x6f) cell.smp = cmd - 0x61;
      else if (cmd <= 0x8f) cell.orn = cmd - 0x70;
      else if (cmd === 0x90) break;
      else if (cmd <= 0x9f) cell.vol = cmd - 0x90;
      else if (cmd === 0xa0) cell.cmds.push({ t: 'noorn' });
      else if (cmd <= 0xb0) { const p = cmd - 0xa1; cell.cmds.push({ t: 'env', type: 8 + ((p & 3) << 1), tone: -1, note: 3 * (p & 12) }); }
      else if (cmd <= 0xb7) { const pt = b[s.off++]; cell.cmds.push({ t: 'env', type: cmd - 0xa9, tone: pt >= 0xf1 ? 256 * (pt & 15) : pt, note: -1 }); }
      else if (cmd <= 0xf8) s.period = cmd - 0xb8;
      else if (cmd === 0xf9) continue;
      else if (cmd <= 0xfb) cell.cmds.push({ t: 'reinit', v: cmd === 0xfb });
      else break;
    }
    this.apply(cell, st);
  }
  envOn(e) { return e.note !== null || e.tone !== null; }
  apply(cell, d) {
    const trans = this.m.pos[this.posIdx].trans;
    if (this.lineNo === 0) d.env.reinit = false;
    if (cell.en !== undefined) d.en = cell.en;
    if (cell.smp !== undefined) d.smp = this.m.samples[cell.smp] || this.stubS;
    if (cell.orn !== undefined) { d.orn = this.m.orns[cell.orn] || this.stubO; d.op = 0; d.oFin = d.oKeep = false; d.env.note = d.env.tone = null; d.env.reinit = false; }
    if (cell.vol !== undefined) d.bvd = cell.vol;
    for (const c of cell.cmds) {
      switch (c.t) {
        case 'env':
          d.env.type = c.type;
          if (c.tone !== -1) { this.pendEnv = c.type; this.envSet = true; this.envTone = c.tone; d.env.tone = c.tone; d.env.note = null; }
          else if (c.note !== -1) { d.env.note = c.note; d.env.tone = null; d.env.reinit = true; }
          break;
        case 'noorn': d.oFin = d.oKeep = true; d.op = 0; d.env.note = d.env.tone = null; break;
        case 'reinit': d.env.reinit = c.v; d.orn = this.stubO; break;
      }
    }
    if (cell.note !== undefined) {
      d.note = cell.note + trans; d.vd = d.bvd; d.sp = 0; d.sFin = false; d.slide = 0; d.loops = 1; d.op = 0; d.oFin = d.oKeep;
      if (d.env.reinit && this.envOn(d.env)) {
        this.pendEnv = d.env.type; this.envSet = true;
        if (d.env.note !== null) {
          let en = d.note + d.env.note; if (en >= 0x60) en -= 0x60; else if (en >= 0x30) en -= 0x30;
          const idx = (en & 0x7f) + 0x30;
          this.envTone = (idx < this.T.length ? this.T[idx] : 0) & 0xff;
        } else this.envTone = d.env.tone;
      }
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
      const d = this.ch[c], smp = d.smp, orn = d.orn;
      const hasEnv = this.envOn(d.env);
      const sl = smp.lines[Math.min(d.sp, smp.lines.length - 1)];
      const ol = (hasEnv || d.oFin || !orn.lines.length) ? 0 : orn.lines[Math.min(d.op, orn.lines.length - 1)];
      d.slide += sl.gliss;
      const half = Math.max(0, Math.min(95, d.note + ol));
      const per = Math.max(0, Math.min(4095, this.T[half] + d.slide));
      regs[c * 2] = per & 255; regs[c * 2 + 1] = per >> 8;
      let level = (sl.level | (hasEnv ? 16 : 0)) + d.vd - 15;
      if (!d.en || level < 0) level = 0;
      regs[8 + c] = (level & 15) | ((level & 16) ? 16 : 0);
      if (sl.toneMask) mixer |= (1 << c);
      if (!sl.noiseMask && d.en) { if (level) regs[6] = sl.noise; else mixer |= (8 << c); } else mixer |= (8 << c);
      if (!d.sFin && ++d.sp >= smp.lines.length) {
        if (smp.loop < smp.lines.length) {
          d.sp = smp.loop;
          if (!--d.loops) { d.loops = smp.vdPeriod; d.vd = Math.max(0, Math.min(15, d.vd + smp.vdValue)); }
        } else { d.en = false; d.sFin = true; }
      }
      if (!d.oFin && ++d.op >= orn.lines.length) { if (orn.loop < orn.lines.length) d.op = orn.loop; else d.oFin = true; }
    }
    regs[7] = mixer;
    if (this.envSet) { regs[11] = this.envTone & 255; regs[12] = (this.envTone >> 8) & 255; regs[13] = this.pendEnv; }
    return true;
  }
}
FORMATS.push({ name: 'Pro Sound Maker (PSM)', exts: ['psm'], create: b => new PSMPlayer(b) });
addLoopBack(PSMPlayer, m => m.loop || 0);
