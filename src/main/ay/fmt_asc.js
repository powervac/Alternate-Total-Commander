// ASC Sound Master (.asc)
function parseASC(b) {
  if (b.length < 40) throw new Error('ASC: файл слишком короткий');
  const tryHdr = ver => {
    const o = ver === 1 ? 2 : 1;
    const patOff = u16(b, o), smpOff = u16(b, o + 2), ornOff = u16(b, o + 4), len = b[o + 6];
    const hdrSize = o + 7 + len;
    if (!len || (patOff !== hdrSize && patOff !== hdrSize + 63)) return null;
    if (smpOff + 64 > b.length || ornOff + 64 > b.length || patOff + 6 > b.length) return null;
    return { tempo: b[0], loop: ver === 1 ? b[1] : 0, patOff, smpOff, ornOff, len, posOff: o + 7, hasId: patOff === hdrSize + 63, hdrSize };
  };
  const h = tryHdr(1) || tryHdr(0);
  if (!h) throw new Error('ASC: неверный заголовок');
  const m = { loop: h.loop, tempo: h.tempo || 3, title: '', pos: Array.from(b.subarray(h.posOff, h.posOff + h.len)), samples: [], orns: [], pats: {} };
  if (h.hasId) {
    const id = String.fromCharCode(...b.subarray(h.hdrSize, h.hdrSize + 19));
    if (id === 'ASM COMPILATION OF ') { m.title = ayStr(b, h.hdrSize + 19, 20); const au = ayStr(b, h.hdrSize + 43, 20); if (au) m.title += ' - ' + au; }
  }
  const sx = v => ((v << 27) >> 27); // 5-bit signed
  const lines = (base, off, step, max, rd) => {
    const out = { loop: 0, limit: -1, lines: [] };
    for (let i = 0; i < max; i++) {
      const q = base + off + i * step; if (q + step > b.length) break;
      const l = rd(q); out.lines.push(l.line);
      if (l.begin) out.loop = i; if (l.end) out.limit = i;
      if (l.fin) break;
    }
    if (out.limit < 0) out.limit = Math.max(0, out.lines.length - 1);
    return out;
  };
  for (let i = 0; i < 32; i++) {
    const off = u16(b, h.smpOff + i * 2);
    m.samples[i] = lines(h.smpOff, off, 3, 150, q => {
      const a = b[q], t = s8(b[q + 1]), c = b[q + 2], cmd = (c & 6) >> 1;
      return { begin: a & 128, end: a & 64, fin: a & 32, line: { adding: sx(a & 31), tone: t, level: c >> 4, noiseMask: (c >> 3) & 1, toneMask: c & 1,
        env: cmd === 1, volSlide: cmd === 2 ? -1 : cmd === 3 ? 1 : 0 } };
    });
  }
  for (let i = 0; i < 32; i++) {
    const off = u16(b, h.ornOff + i * 2);
    m.orns[i] = lines(h.ornOff, off, 2, 30, q => {
      const a = b[q];
      return { begin: a & 128, end: a & 64, fin: a & 32, line: { noise: sx(a & 31), note: s8(b[q + 1]) } };
    });
  }
  for (const p of new Set(m.pos)) {
    const o = h.patOff + p * 6; if (o + 6 > b.length) throw new Error('ASC: неверный номер паттерна');
    m.pats[p] = [0, 1, 2].map(k => h.patOff + u16(b, o + k * 2));
  }
  return m;
}

class ASCPlayer {
  constructor(bytes) {
    this.b = bytes; this.m = parseASC(bytes); this.title = this.m.title; this.T = PT3_TABLES.asc;
    this.tempo = this.m.tempo; this.posIdx = 0; this.quirk = 0; this.patLoaded = false; this.done = false; this.envTone = 0;
    this.ch = [0, 1, 2].map(() => ({ en: false, env: false, brk: false, vol: 15, volAdd: 0, vsDelay: 0, vsAdd: 0, vsCnt: 0, baseNoise: 0, noise: 0,
      note: 0, noteAdd: 0, smp: 0, curSmp: 0, pis: 0, orn: 0, curOrn: 0, pio: 0, dev: 0, steps: 0, sliding: 0, target: -1, gliss: 0 }));
    this.emptyS = { loop: 0, limit: 0, lines: [{ adding: 0, tone: 0, level: 0, noiseMask: 1, toneMask: 1, env: false, volSlide: 0 }] };
    this.emptyO = { loop: 0, limit: 0, lines: [{ noise: 0, note: 0 }] };
  }
  startPattern() {
    this.cur = this.m.pats[this.m.pos[this.posIdx]].map(o => ({ off: o, period: 0, counter: 0, envOn: false }));
    this.lineNo = 0; this.patLoaded = true;
  }
  nextLine() {
    const b = this.b, cs = this.cur;
    if (this.lineNo >= 64) return false;
    if (cs[0].counter === 0 && (cs[0].off >= b.length || b[cs[0].off] === 0xff)) return false;
    if (this.lineNo === 0) for (const c of this.ch) c.baseNoise = 0;
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
    const b = this.b, T = this.T;
    const cell = { enabled: undefined, cmds: [], orn: undefined, smp: undefined, note: undefined, vol: undefined };
    const find = t => cell.cmds.find(c => c.t === t);
    while (s.off < b.length) {
      const cmd = b[s.off++];
      if (cmd <= 0x55) {
        if (!find('brk')) cell.enabled = true;
        const sl = find('slide');
        if (sl) { sl.t = 'slidenote'; sl.target = cmd; }
        else cell.note = cmd;
        if (s.envOn) { const ec = find('env'); const tone = b[s.off++]; if (ec) ec.tone = tone; else cell.cmds.push({ t: 'env', type: -1, tone }); }
        break;
      }
      else if (cmd <= 0x5d) break;
      else if (cmd === 0x5e) { cell.cmds.push({ t: 'brk' }); break; }
      else if (cmd === 0x5f) { cell.enabled = false; break; }
      else if (cmd <= 0x9f) s.period = cmd - 0x60;
      else if (cmd <= 0xbf) cell.smp = cmd - 0xa0;
      else if (cmd <= 0xdf) cell.orn = cmd - 0xc0;
      else if (cmd === 0xe0) { cell.vol = 15; cell.cmds.push({ t: 'envon' }); s.envOn = true; }
      else if (cmd <= 0xef) { cell.vol = cmd - 0xe0; cell.cmds.push({ t: 'envoff' }); s.envOn = false; }
      else if (cmd === 0xf0) cell.cmds.push({ t: 'noise', v: b[s.off++] });
      else if (cmd <= 0xf3) { if (cmd & 1) cell.cmds.push({ t: 'contsmp' }); if (cmd & 2) cell.cmds.push({ t: 'contorn' }); }
      else if (cmd === 0xf4) this.tempo = b[s.off++];
      else if (cmd <= 0xf6) cell.cmds.push({ t: 'gliss', v: (cmd === 0xf5 ? -16 : 16) * b[s.off++] });
      else if (cmd === 0xf7 || cmd === 0xf9) {
        if (cmd === 0xf7) cell.cmds.push({ t: 'contsmp' });
        cell.cmds.push({ t: 'slide', steps: s8(b[s.off++]), useTone: cmd === 0xf7 });
      }
      else if ((cmd & 0xf9) === 0xf8) {
        const ec = find('env'); if (ec) ec.type = cmd & 15; else cell.cmds.push({ t: 'env', type: cmd & 15, tone: -1 });
      }
      else if (cmd === 0xfb) { const v = b[s.off++]; cell.cmds.push({ t: 'vslide', per: v & 31, add: (v & 32) ? -1 : 1 }); }
    }
    // apply (mirrors GetNewChannelState)
    if (cell.enabled !== undefined) st.en = cell.enabled;
    st.vsCnt = 0; st.steps = 0;
    let contS = false, contO = false, reload = false;
    for (const c of cell.cmds) {
      switch (c.t) {
        case 'env':
          if (c.type !== -1) { this.pendEnvType = c.type; this.envSet = true; }
          if (c.tone !== -1) { this.envTone = c.tone; this.envToneSet = true; }
          break;
        case 'envon': st.env = true; break;
        case 'envoff': st.env = false; break;
        case 'noise': st.baseNoise = c.v; break;
        case 'contsmp': contS = true; break;
        case 'contorn': contO = true; break;
        case 'gliss': st.gliss = c.v; st.steps = -1; break;
        case 'slide': {
          st.steps = c.steps;
          const ns = (st.sliding | 15) ^ 15;
          st.gliss = Math.trunc(-ns / (st.steps || 1)); st.sliding = st.gliss * st.steps; break;
        }
        case 'slidenote': {
          st.steps = c.steps; st.target = c.target;
          const abs = T[st.target] - T[st.note];
          const ns = abs - (c.useTone ? Math.trunc(st.sliding / 16) : 0);
          st.gliss = Math.trunc(16 * ns / (st.steps || 1)); reload = true; break;
        }
        case 'vslide': st.vsCnt = st.vsDelay = c.per; st.vsAdd = c.add; break;
        case 'brk': st.brk = true; break;
      }
    }
    if (cell.orn !== undefined) st.orn = cell.orn;
    if (cell.smp !== undefined) st.smp = cell.smp;
    if (cell.note !== undefined) { st.note = cell.note; reload = true; }
    if (reload) {
      st.noise = st.baseNoise;
      if (st.steps <= 0) st.sliding = 0;
      if (!contS) { st.curSmp = st.smp; st.pis = 0; st.volAdd = 0; st.dev = 0; st.brk = false; }
      if (!contO) { st.curOrn = st.orn; st.pio = 0; st.noteAdd = 0; }
    }
    if (cell.vol !== undefined) st.vol = cell.vol;
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
    }
    this.quirk = (this.quirk + 1) % this.tempo;
    let mixer = 0;
    for (let c = 0; c < 3; c++) {
      const st = this.ch[c];
      if (!st.en) { regs[8 + c] = 0; mixer |= (1 << c) | (8 << c); continue; }
      const smp = this.m.samples[st.curSmp] || this.emptyS, orn = this.m.orns[st.curOrn] || this.emptyO;
      const sl = smp.lines[Math.min(st.pis, smp.lines.length - 1)] || this.emptyS.lines[0];
      const ol = orn.lines[Math.min(st.pio, orn.lines.length - 1)] || this.emptyO.lines[0];
      if (st.vsCnt >= 2) st.vsCnt--;
      else if (st.vsCnt) { st.volAdd += st.vsAdd; st.vsCnt = st.vsDelay; }
      st.volAdd = Math.max(-15, Math.min(15, st.volAdd + sl.volSlide));
      st.dev += sl.tone; st.noteAdd = s8(st.noteAdd + ol.note);
      const half = Math.max(0, Math.min(0x55, s8(st.note) + st.noteAdd));
      const per = Math.max(0, Math.min(4095, this.T[half] + st.dev + Math.trunc(st.sliding / 16)));
      regs[c * 2] = per & 255; regs[c * 2 + 1] = per >> 8;
      const lv = Math.max(0, Math.min(15, st.volAdd + sl.level));
      regs[8 + c] = (((st.vol + 1) * lv) >> 4) | ((st.env && sl.env) ? 16 : 0);
      st.noise += ol.noise;
      if (sl.toneMask) mixer |= (1 << c);
      if (sl.noiseMask && sl.env) { this.envTone = (this.envTone + sl.adding) & 0xffff; this.envToneSet = true; }
      else st.noise += sl.adding;
      if (!sl.noiseMask) regs[6] = (st.noise + Math.trunc(st.sliding / 256)) & 31; else mixer |= (8 << c);
      if (st.steps !== 0) {
        if (st.steps > 0 && !--st.steps && st.target >= 0) { st.note = st.target; st.target = -1; st.sliding = st.gliss = 0; }
        st.sliding += st.gliss;
      }
      if (st.pis++ >= smp.limit) {
        if (!st.brk) st.pis = smp.loop;
        else if (st.pis >= smp.lines.length) st.en = false;
      }
      if (st.pio++ >= orn.limit) st.pio = orn.loop;
    }
    regs[7] = mixer;
    if (this.envToneSet) { regs[11] = this.envTone & 255; regs[12] = this.envTone >> 8; }
    if (this.envSet) regs[13] = this.pendEnvType;
    return true;
  }
}
FORMATS.push({ name: 'ASC Sound Master (ASC)', exts: ['asc'], create: b => new ASCPlayer(b) });
addLoopBack(ASCPlayer, m => m.loop);
