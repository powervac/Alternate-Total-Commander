// Fast Tracker 1.x (.ftc)
function parseFTC(b) {
  if (b.length < 256) throw new Error('FTC: файл слишком короткий');
  const hasTitle = String.fromCharCode(...b.subarray(0, 8)) === 'Module: ';
  const sign = b[50];
  const m = { title: hasTitle ? ayStr(b, 8, 42) : '', table: sign === 1 ? ST_TABLE : sign === 2 ? PT3_TABLES.ftc : PT2_TABLE,
    tempo: b[69], loop: b[70], pos: [], samples: [], orns: [], pats: {} };
  const patOff = u16(b, 75);
  if (m.tempo < 3 || patOff + 6 > b.length) throw new Error('FTC: неверный заголовок');
  // base address: the pattern table ends with a 0xffff entry, pattern data follows it
  let base = 0, dataAddr = 0, found = false;
  for (let pos = patOff; pos + 6 <= b.length; pos += 6) {
    const a = u16(b, pos);
    if (a === 0xffff) { const off = pos + 2; if (dataAddr < off) throw new Error('FTC: неверная таблица паттернов'); base = dataAddr - off; found = true; break; }
    if (!dataAddr && a) dataAddr = a;
  }
  if (!found) throw new Error('FTC: нет конца таблицы паттернов');
  for (let o = 212; o + 2 <= b.length && b[o] !== 0xff; o += 2) m.pos.push({ pat: b[o], trans: s8(b[o + 1]) });
  if (!m.pos.length) throw new Error('FTC: пустой список позиций');
  const sample = i => {
    const o = u16(b, 82 + i * 2) - base; if (o < 0 || o + 3 > b.length) return null;
    const n = b[o + 2] + 1, loop = Math.min(b[o + 1], n), lines = [];
    for (let j = 0; j < n; j++) {
      const q = o + 3 + j * 5; if (q + 5 > b.length) break;
      const no = b[q], tl = b[q + 1], th = b[q + 2], lv = b[q + 3];
      lines.push({ noise: no & 31, accNoise: no & 128, noiseMask: no & 64, tone: ((th & 15) << 8) | tl, accTone: th & 128, toneMask: th & 64,
        level: lv & 15, vs: (lv & 32) ? ((lv & 16) ? -1 : 1) : 0, envAdd: s8(b[q + 4]), accEnv: lv & 128, env: lv & 64 });
    }
    return { loop, lines };
  };
  const ornament = i => {
    const o = u16(b, 146 + i * 2) - base; if (o < 0 || o + 3 > b.length) return null;
    const n = b[o + 2] + 1, loop = Math.min(b[o + 1], n), lines = [];
    for (let j = 0; j < n; j++) {
      const q = o + 3 + j * 2; if (q + 2 > b.length) break;
      lines.push({ noise: b[q] & 31, keepNoise: b[q] & 128, keepNote: b[q] & 64, note: s8(b[q + 1]) });
    }
    return { loop, lines };
  };
  for (const p of new Set(m.pos.map(x => x.pat))) {
    const o = patOff + p * 6; if (o + 6 > b.length) throw new Error('FTC: неверный номер паттерна');
    m.pats[p] = [0, 1, 2].map(k => u16(b, o + k * 2) - base);
  }
  for (let i = 0; i < 32; i++) m.samples[i] = sample(i);
  for (let i = 0; i < 33; i++) m.orns[i] = ornament(i);
  return m;
}

class FTCPlayer {
  constructor(bytes) {
    this.b = bytes; this.m = parseFTC(bytes); this.title = this.m.title; this.T = this.m.table;
    this.tempo = this.m.tempo; this.posIdx = 0; this.quirk = 0; this.patLoaded = false; this.done = false; this.trans = 0;
    this.stubS = { loop: 0, lines: [{ noise: 0, accNoise: 0, noiseMask: 1, tone: 0, accTone: 0, toneMask: 1, level: 0, vs: 0, envAdd: 0, accEnv: 0, env: 0 }] };
    this.stubO = { loop: 0, lines: [{ noise: 0, keepNoise: 0, keepNote: 0, note: 0 }] };
    this.ch = [0, 1, 2].map(() => ({ note: 0, env: 0, envOn: false, vol: 15, vslide: 0, noise: 0,
      smp: this.m.samples[0] || this.stubS, sp: 0, sOff: true, orn: this.m.orns[0] || this.stubO, op: 0,
      noteAcc: 0, noiseAcc: 0, sNoiseAcc: 0, toneAcc: 0, envAcc: 0, toneAddon: 0, sl: { s: 0, g: 0, d: 0 } }));
  }
  startPattern() {
    this.cur = this.m.pats[this.m.pos[this.posIdx].pat].map(o => ({ off: o, period: 0, counter: 0 }));
    this.lineNo = 0; this.patLoaded = true;
  }
  nextLine() {
    const b = this.b, cs = this.cur;
    if (this.lineNo >= 64) return false;
    if (cs[0].counter === 0 && (cs[0].off >= b.length || cs[0].off < 0 || b[cs[0].off] === 0xff)) return false;
    if (this.lineNo === 0) this.trans = this.m.pos[this.posIdx].trans;
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
      if (cmd <= 0x1f) cell.smp = cmd;
      else if (cmd <= 0x2f) cell.vol = cmd - 0x20;
      else if (cmd === 0x30) { cell.en = false; s.period = 0; break; }
      else if (cmd <= 0x3e) { cell.cmds.push({ t: 'env', type: cmd - 0x30, tone: u16(b, s.off) }); s.off += 2; }
      else if (cmd === 0x3f) cell.cmds.push({ t: 'envoff' });
      else if (cmd <= 0x5f) { s.period = cmd - 0x40; break; }
      else if (cmd <= 0xcb) {
        cell.en = true;
        const sn = cell.cmds.find(c => c.t === 'slidenote');
        if (sn) sn.target = cmd - 0x60; else cell.note = cmd - 0x60;
        s.period = 0; break;
      }
      else if (cmd <= 0xec) cell.orn = cmd - 0xcc;
      else if (cmd === 0xed) { cell.cmds.push({ t: 'slide', v: s16(b, s.off) }); s.off += 2; }
      else if (cmd === 0xee) cell.cmds.push({ t: 'slidenote', step: b[s.off++], target: -1 });
      else if (cmd === 0xef) cell.cmds.push({ t: 'noise', v: b[s.off++] });
      else this.tempo = Math.max(1, b[s.off++]);
    }
    this.apply(cell, st);
  }
  apply(cell, d) {
    const T = this.T, tr = this.trans;
    if (cell.en !== undefined) {
      if (cell.en) d.sp = 0, d.sOff = false; else d.sOff = true;
      d.sNoiseAcc = 0; d.vslide = 0; d.noiseAcc = 0; d.noteAcc = 0; d.op = 0; d.toneAcc = 0; d.envAcc = 0; d.sl = { s: 0, g: 0, d: 0 };
    }
    if (cell.note !== undefined) d.note = cell.note + tr;
    if (cell.smp !== undefined) d.smp = this.m.samples[cell.smp] || this.stubS;
    if (cell.orn !== undefined) { d.orn = this.m.orns[cell.orn] || this.stubO; d.op = 0; d.noiseAcc = 0; d.noteAcc = 0; }
    if (cell.vol !== undefined) d.vol = cell.vol;
    for (const c of cell.cmds) {
      switch (c.t) {
        case 'env': this.pendEnv = c.type; this.envSet = true; d.env = c.tone; d.envOn = true; break;
        case 'envoff': d.envOn = false; break;
        case 'noise': d.noise = c.v; break;
        case 'slide': d.sl.g = c.v; break;
        case 'slidenote': {
          const clampN = n => T[Math.max(0, Math.min(95, n))];
          const slide = clampN(d.note) - clampN(c.target);
          d.sl.s = slide; d.sl.g = slide >= 0 ? -c.step : c.step; d.sl.d = slide >= 0 ? -1 : 1;
          d.note = c.target + tr; break;
        }
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
      const d = this.ch[c];
      const ol = d.orn.lines[Math.min(d.op, d.orn.lines.length - 1)];
      d.noteAcc = d.noteAcc + ol.note; const noteAddon = d.noteAcc; if (!ol.keepNote) d.noteAcc -= ol.note;
      d.noiseAcc = d.noiseAcc + ol.noise; const noiseAddon = d.noiseAcc; if (!ol.keepNoise) d.noiseAcc -= ol.noise;
      if (++d.op >= d.orn.lines.length) d.op = d.orn.loop;
      const sl = (!d.sOff && d.sp < d.smp.lines.length) ? d.smp.lines[d.sp] : null;
      if (sl) {
        const sn = d.sNoiseAcc + sl.noise; if (sl.accNoise) d.sNoiseAcc = sn;
        if (sl.noiseMask) mixer |= (8 << c); else regs[6] = (d.noise + noiseAddon + sn) & 31;
        const ta = d.toneAcc + sl.tone; if (sl.accTone) d.toneAcc = ta; d.toneAddon = ta;
        if (sl.toneMask) mixer |= (1 << c);
        d.vslide += sl.vs;
        const vol = Math.max(0, Math.min(15, sl.level + d.vslide));
        const lv = ((d.vol * 17 + (d.vol > 7 ? 1 : 0)) * vol + 128) >> 8;
        const ea = d.envAcc + sl.envAdd; if (sl.accEnv) d.envAcc = ea;
        let amp = lv;
        if (sl.env && d.envOn) { amp |= 16; this.envTone = (d.env - ea) & 0xffff; this.envToneSet = true; }
        regs[8 + c] = amp;
        if (++d.sp >= d.smp.lines.length) d.sp = d.smp.loop;
      } else { regs[8 + c] = 0; mixer |= (1 << c) | (8 << c); }
      const g = d.sl; g.s += g.g;
      if ((g.d > 0 && g.s >= 0) || (g.d < 0 && g.s < 0)) { g.s = 0; g.g = 0; }
      const per = Math.max(0, Math.min(4095, this.T[Math.max(0, Math.min(95, d.note + noteAddon))] + d.toneAddon + g.s));
      regs[c * 2] = per & 255; regs[c * 2 + 1] = per >> 8;
    }
    regs[7] = mixer;
    if (this.envToneSet) { regs[11] = this.envTone & 255; regs[12] = this.envTone >> 8; this.envToneSet = false; }
    if (this.envSet) regs[13] = this.pendEnv;
    return true;
  }
}
FORMATS.push({ name: 'Fast Tracker (FTC)', exts: ['ftc'], create: b => new FTCPlayer(b) });
addLoopBack(FTCPlayer, m => m.loop);
