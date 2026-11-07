// Pro Sound Creator (.psc)
function parsePSC(b) {
  if (b.length < 256) throw new Error('PSC: файл слишком короткий');
  const hasId = String.fromCharCode(...b.subarray(0, 5)) === 'PSC V' && String.fromCharCode(...b.subarray(9, 25)) === ' COMPILATION OF ';
  const vs = String.fromCharCode(...b.subarray(5, 9));
  const vers = /^\d\.\d\d$/.test(vs) ? 100 * +vs[0] + 10 * +vs[2] + +vs[3] : 0;
  const samplesStart = u16(b, 69), posOff = u16(b, 71), tempo = b[73], ornTable = u16(b, 74);
  if (!tempo || posOff + 8 > b.length || ornTable + 2 > b.length) throw new Error('PSC: неверный заголовок');
  const isNew = vers === 0 || vers >= 103;
  const ornBase = isNew ? ornTable : 0, smpBase = isNew ? 76 : 0;
  const m = { tempo, title: hasId ? ayStr(b, 25, 20) : '', pos: [], loop: 0, samples: {}, orns: {}, pats: [] };
  if (hasId) { const au = ayStr(b, 49, 20); if (au && /BY/i.test(ayStr(b, 45, 4))) m.title += ' - ' + au; }
  const seen = new Map();
  for (let o = posOff; o + 8 <= b.length; o += 8) {
    if (b[o + 1] === 0xff) { m.loop = Math.min(b[o], Math.max(0, m.pos.length - 1)); break; }
    const key = b.subarray(o + 1, o + 8).join(',');
    let idx = seen.get(key);
    if (idx === undefined) { idx = m.pats.length; seen.set(key, idx); m.pats.push({ size: b[o + 1], offs: [u16(b, o + 2), u16(b, o + 4), u16(b, o + 6)] }); }
    m.pos.push(idx);
  }
  if (!m.pos.length) throw new Error('PSC: пустой список позиций');
  const sample = addr => {
    const lines = [];
    for (let i = 0; i < 32; i++) {
      const q = addr + i * 6; if (q + 6 > b.length) break;
      const flags = b[q + 4], lvl = b[q + 3];
      lines.push({ tone: s16(b, q), adding: s8(b[q + 2]), level: lvl & 15, toneMask: flags & 1, noiseMask: (flags >> 3) & 1,
        env: !(flags & 16), vd: ((flags & 2) ? 1 : 0) - ((flags & 4) ? 1 : 0), lb: !(flags & 128), le: !(flags & 64) });
      if (!(flags & 32)) break;
    }
    return lines;
  };
  const ornament = addr => {
    const lines = [];
    for (let i = 0; i < 32; i++) {
      const q = addr + i * 2; if (q + 2 > b.length) break;
      const a = b[q];
      lines.push({ noise: a & 31, note: s8(b[q + 1]), lb: !(a & 128), le: !(a & 64) });
      if (!(a & 32)) break;
    }
    return lines;
  };
  const maxSmp = Math.floor((ornTable - 76) / 2), maxOrn = Math.floor((samplesStart - ornTable) / 2);
  for (let i = 0; i < Math.min(32, Math.max(0, maxSmp)); i++) {
    const a = smpBase + u16(b, 76 + i * 2); if (a < b.length) m.samples[i] = sample(a);
  }
  for (let i = 0; i < Math.min(32, Math.max(0, maxOrn)); i++) {
    const a = ornBase + u16(b, ornTable + i * 2); if (a < b.length) m.orns[i] = ornament(a);
  }
  return m;
}

class PSCIter {
  constructor(lines) { this.set(lines || []); this.pos = lines && lines.length || 0; this.brk = false; this.loopPos = 0; }
  set(lines) { this.lines = lines || []; }
  reset() { this.pos = 0; this.brk = false; }
  disable() { this.pos = this.lines.length; }
  get() { return this.pos < this.lines.length ? this.lines[this.pos] : null; }
  next() {
    const l = this.lines[this.pos];
    if (l.lb) this.loopPos = this.pos;
    if (l.le) { if (!this.brk) this.pos = this.loopPos; else { this.brk = false; this.pos++; } }
    else this.pos++;
  }
}

class PSCPlayer {
  constructor(bytes) {
    this.b = bytes; this.m = parsePSC(bytes); this.title = this.m.title; this.T = PT3_TABLES.asc;
    this.tempo = this.m.tempo; this.posIdx = 0; this.quirk = 0; this.patLoaded = false; this.done = false;
    this.envTone = 0; this.noiseBase = 0;
    this.ch = [0, 1, 2].map(() => {
      const c = { smp: new PSCIter(this.m.samples[0]), orn: new PSCIter(this.m.orns[0]), slide: { sl: 0, gl: 0, steps: 0 }, vslide: { cnt: 0, per: 0, d: 0 },
        note: 0, acc: 0, vol: 0, att: 0, noiseAcc: 0, env: false };
      c.smp.disable(); c.orn.disable(); return c;
    });
  }
  startPattern() {
    const p = this.m.pats[this.m.pos[this.posIdx]];
    this.cur = p.offs.map(o => ({ off: o, period: 0, counter: 0 })); this.patSize = p.size; this.lineNo = 0; this.patLoaded = true;
  }
  nextLine() {
    if (this.lineNo >= this.patSize) return false;
    const cs = this.cur;
    for (let c = 0; c < 3; c++) {
      const s = cs[c];
      if (s.counter) { s.counter--; continue; }
      this.parseChannel(c, s, this.ch[c]);
      s.counter = s.period;
    }
    this.lineNo++;
    return true;
  }
  parseChannel(chan, s, st) {
    const b = this.b, cell = { cmds: [] };
    while (s.off < b.length) {
      const cmd = b[s.off++];
      if (cmd >= 0xc0) { s.period = cmd - 0xc0; break; }
      else if (cmd >= 0xa0) cell.orn = cmd - 0xa0;
      else if (cmd >= 0x80) cell.smp = cmd - 0x80;
      else if (cmd === 0x7d) cell.cmds.push({ t: 'brks' });
      else if (cmd === 0x7c) cell.en = false;
      else if (cmd === 0x7b) { if (chan === 1) cell.cmds.push({ t: 'noise', v: b[s.off++] }); }
      else if (cmd === 0x7a) { if (chan === 1) { const type = b[s.off++] & 15, tone = (b[s.off + 1] << 8) | b[s.off]; s.off += 2; cell.cmds.push({ t: 'env', type, tone }); } }
      else if (cmd === 0x71) { cell.cmds.push({ t: 'brko' }); s.off++; }
      else if (cmd === 0x70) {
        const v = b[s.off++]; const neg = !!(v & 64);
        cell.cmds.push({ t: 'vslide', per: neg ? (-s8(v | 128)) : v, d: neg ? -1 : 1 });
      }
      else if (cmd === 0x6f) { cell.cmds.push({ t: 'noorn' }); s.off++; }
      else if (cmd === 0x6e) this.tempo = Math.max(1, b[s.off++]);
      else if (cmd === 0x6d) cell.cmds.push({ t: 'gliss', v: b[s.off++] });
      else if (cmd === 0x6c) cell.cmds.push({ t: 'slide', v: -s8(b[s.off++]) });
      else if (cmd === 0x6b) cell.cmds.push({ t: 'slide', v: b[s.off++] });
      else if (cmd >= 0x58 && cmd <= 0x66) { cell.vol = cmd - 0x57; cell.cmds.push({ t: 'noenv' }); }
      else if (cmd === 0x57) { cell.vol = 15; cell.cmds.push({ t: 'envon' }); }
      else if (cmd <= 0x56) { cell.en = true; cell.note = cmd; }
    }
    this.applyCell(cell, st);
  }
  tone(st) { return (this.T[Math.max(0, Math.min(0x55, st.note))] + st.acc + st.slide.sl) & 0xffff; }
  applyCell(cell, dst) {
    const T = this.T, oldTone = this.tone(dst);
    const sl = dst.slide;
    if (cell.en !== undefined) {
      if (cell.en) {
        dst.smp.reset(); dst.orn.reset(); dst.vslide.cnt = 0; sl.sl = 0; dst.acc = 0; dst.noiseAcc = 0; dst.att = 0;
      } else { dst.smp.brk = false; dst.smp.disable(); dst.orn.brk = false; dst.orn.disable(); }
      sl.gl = 0;
    }
    if (cell.note !== undefined) dst.note = cell.note;
    if (cell.smp !== undefined) dst.smp.set(this.m.samples[cell.smp]);
    if (cell.orn !== undefined) dst.orn.set(this.m.orns[cell.orn]);
    if (cell.vol !== undefined) { dst.vol = cell.vol; dst.att = 0; }
    for (const c of cell.cmds) {
      switch (c.t) {
        case 'brks': dst.smp.brk = true; break;
        case 'brko': dst.orn.brk = true; break;
        case 'noorn': dst.orn.disable(); break;
        case 'env': if (c.type || c.tone) { this.pendEnv = c.type; this.envSet = true; this.envTone = c.tone; this.envToneSet = true; } else dst.env = true; break;
        case 'envon': dst.env = true; break;
        case 'noenv': dst.env = false; break;
        case 'noise': this.noiseBase = c.v; break;
        case 'gliss': {
          const sliding = oldTone - T[Math.max(0, Math.min(0x55, dst.note))];
          const ng = sliding >= 0 ? -c.v : c.v;
          sl.sl = sliding; sl.gl = ng; sl.steps = c.v ? 1 + Math.trunc(Math.abs(sliding) / c.v) : 0; break;
        }
        case 'slide': sl.gl = c.v; sl.steps = 0; break;
        case 'vslide': dst.vslide.per = dst.vslide.cnt = c.per; dst.vslide.d = c.d; break;
      }
    }
  }
  frame(regs) {
    if (this.done) return false;
    this.envSet = false; this.envToneSet = false;
    if (this.quirk === 0) {
      if (!this.patLoaded) this.startPattern();
      while (!this.nextLine()) {
        this.posIdx++; this.patLoaded = false;
        if (this.posIdx >= this.m.pos.length) { this.done = true; return false; }
        this.startPattern();
      }
      for (const c of this.ch) c.noiseAcc += this.noiseBase;
    }
    this.quirk = (this.quirk + 1) % this.tempo;
    let mixer = 0;
    for (let c = 0; c < 3; c++) {
      const st = this.ch[c], ln = st.smp.get();
      if (!ln) { regs[8 + c] = 0; mixer |= (1 << c) | (8 << c); continue; }
      st.smp.next();
      const ol = st.orn.get();
      if (ol) {
        st.noiseAcc += ol.noise; st.note += ol.note;
        if (st.note < 0) st.note += 0x56; else if (st.note > 0x55) st.note -= 0x56;
        if (st.note > 0x55) st.note = 0x55;
        st.orn.next();
      }
      st.acc = ((st.acc + ln.tone) << 16) >> 16;
      const sl = st.slide; let su = 0;
      if (sl.gl) { sl.sl += sl.gl; if (sl.steps && !--sl.steps) sl.gl = 0; su = sl.sl; }
      const per = Math.max(0, Math.min(4095, this.T[Math.max(0, Math.min(0x55, st.note))] + st.acc + su));
      regs[c * 2] = per & 255; regs[c * 2 + 1] = per >> 8;
      if (ln.toneMask) mixer |= (1 << c);
      let vs = 0; const v = st.vslide;
      if (v.cnt && !--v.cnt) { v.cnt = v.per; vs = v.d; }
      st.att += ln.vd + vs;
      const level = Math.max(0, Math.min(15, st.att + st.vol)); st.att = level - st.vol;
      const env = st.env && ln.env;
      regs[8 + c] = (((1 + level) * ln.level) >> 4) | (env ? 16 : 0);
      if (env && ln.noiseMask) { this.envTone = (this.envTone + ln.adding) & 0xffff; this.envToneSet = true; }
      else { st.noiseAcc += ln.adding; if (!ln.noiseMask) regs[6] = st.noiseAcc & 31; }
      if (ln.noiseMask) mixer |= (8 << c);
    }
    regs[7] = mixer;
    if (this.envToneSet) { regs[11] = this.envTone & 255; regs[12] = this.envTone >> 8; }
    if (this.envSet) regs[13] = this.pendEnv;
    return true;
  }
}
FORMATS.push({ name: 'Pro Sound Creator (PSC)', exts: ['psc'], create: b => new PSCPlayer(b) });
addLoopBack(PSCPlayer, m => m.loop);
