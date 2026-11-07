// Pro Tracker 3.x / Vortex Tracker II compiled (.pt3). TurboSound modules play the first chip only.
function parsePT3(b) {
  if (b.length < 202) throw new Error('PT3: файл слишком короткий');
  const id = String.fromCharCode(...b.subarray(0, 13));
  if (!/^(ProTracker 3\.|Vortex Tracker II)/i.test(id) && !/ProTracker|Vortex/i.test(String.fromCharCode(...b.subarray(0, 30)))) throw new Error('PT3: нет сигнатуры');
  const sub = b[13], ver = (sub >= 48 && sub <= 57) ? sub - 48 : 6;
  const m = { version: ver, title: ayStr(b, 30, 32), author: ayStr(b, 66, 32), mode: b[98], table: b[99], tempo: b[100], loop: b[102],
    pos: [], samples: [], orns: [], patOff: u16(b, 103) };
  if (m.title && m.author) m.title += ' - ' + m.author;
  for (let i = 201; i < b.length && b[i] !== 0xff; i++) {
    if (b[i] % 3) throw new Error('PT3: неверная позиция');
    m.pos.push(b[i] / 3);
  }
  if (!m.pos.length) throw new Error('PT3: пустой список позиций');
  for (let i = 0; i < 32; i++) {
    const o = u16(b, 105 + i * 2);
    if (!o || o + 2 > b.length) { m.samples[i] = null; continue; }
    const loop = b[o], size = b[o + 1], lines = [];
    for (let j = 0; j < size; j++) {
      const q = o + 2 + ((j * 4) & 255), v = b[q] || 0, k = b[q + 1] || 0;
      const noe = (v & 62) >> 1;
      lines.push({
        env: v & 1, noiseOrEnvOff: noe & 16 ? noe - 32 : noe, volSlide: (v & 128) ? ((v & 64) ? 1 : -1) : 0,
        level: k & 15, toneMask: (k >> 4) & 1, keepNE: (k >> 5) & 1, keepTone: (k >> 6) & 1, noiseMask: (k >> 7) & 1,
        toneOff: s16(b, q + 2)
      });
    }
    m.samples[i] = { loop: Math.min(loop, size), lines };
  }
  for (let i = 0; i < 16; i++) {
    const o = u16(b, 169 + i * 2);
    if (!o || o + 2 > b.length) { m.orns[i] = null; continue; }
    const loop = b[o], size = b[o + 1], lines = [];
    for (let j = 0; j < size; j++) lines.push(s8(b[o + 2 + (j & 255)] || 0));
    m.orns[i] = { loop: Math.min(loop, size), lines };
  }
  return m;
}

class PT3Player {
  constructor(bytes, opts) {
    this.b = bytes; this.m = (opts && opts.model) || parsePT3(bytes); this.title = this.m.title;
    this.patMap = opts && opts.patMap; this.lead = opts && opts.lead;
    const v = this.m.version, t = this.m.table;
    const key = t === 1 ? 'st' : t === 2 ? (v <= 3 ? 'asm33' : 'asm34') : t === 3 ? (v <= 3 ? 'real33' : 'real34') : (v <= 3 ? 'pt33' : 'pt34');
    this.T = PT3_TABLES[key]; this.vol = v <= 4 ? PT3_VOL33 : PT3_VOL35;
    this.tempo = this.m.tempo || 3; this.posIdx = 0; this.quirk = 0; this.patLoaded = false; this.done = false;
    this.envBase = 0; this.envSl = { per: 0, val: 0, cnt: 0, delta: 0 }; this.noiseBase = 0; this.noiseAdd = 0;
    this.ch = [0, 1, 2].map(() => ({ en: false, env: false, note: 0, smp: 1, pis: 0, orn: 0, pio: 0, vol: 15, volSlide: 0,
      sl: { per: 0, val: 0, cnt: 0, delta: 0 }, target: -1, slDelta: 0, acc: 0, envSl: 0, noiseSl: 0, vibCnt: 0, vibOn: 0, vibOff: 0 }));
  }
  startPattern() {
    if (this.m.textPats) {
      this.textLines = this.m.textPats[this.m.pos[this.posIdx]] || []; this.lineNo = 0; this.patLoaded = true; return;
    }
    const pn = this.patMap ? this.patMap(this.m.pos[this.posIdx]) : this.m.pos[this.posIdx];
    const o = this.m.patOff + pn * 6;
    if (o + 6 > this.b.length) throw new Error('PT3: неверный указатель паттерна');
    this.cur = [0, 1, 2].map(i => ({ off: u16(this.b, o + i * 2), period: 0, counter: 0 }));
    this.lineNo = 0; this.patLoaded = true;
  }
  nextLine() {
    if (this.m.textPats) {
      if (this.lineNo >= this.textLines.length) return false;
      const ln = this.textLines[this.lineNo];
      if (this.lineNo === 0) this.noiseBase = 0;
      this.noiseBase = ln.noise;
      for (let c = 0; c < 3; c++) {
        const t = ln.ch[c], st = this.ch[c];
        if (t.smp) st.smp = t.smp;
        if (t.orn !== undefined) { st.orn = t.orn; st.pio = 0; }
        if (t.vol) st.vol = t.vol;
        if (t.tempo) this.tempo = t.tempo;
        this.applyCell(st, t.cell);
      }
      this.lineNo++;
      return true;
    }
    const b = this.b, cs = this.cur;
    if (this.lineNo >= 256) return false;
    if (cs[0].counter === 0 && (cs[0].off >= b.length || b[cs[0].off] === 0)) return false;
    if (this.lineNo === 0) this.noiseBase = 0;
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
    const b = this.b, pre = [], cmds = [];
    let note = -1, restSet = false, enabledSet = false;
    const e = { en: undefined };
    while (s.off < b.length) {
      const cmd = b[s.off++];
      if (cmd < 0x10) pre.push(cmd);
      else if (cmd < 0x20 || (cmd >= 0xb2 && cmd <= 0xbf) || cmd >= 0xf0) {
        const hasEnv = cmd >= 0x11 && cmd <= 0xbf, hasOrn = cmd >= 0xf0, hasSmp = cmd < 0xb2 || cmd > 0xbf;
        if (hasEnv) { const type = cmd - (cmd >= 0xb2 ? 0xb1 : 0x10); const tone = (b[s.off] << 8) | b[s.off + 1]; s.off += 2; cmds.push({ t: 'env', type, tone }); }
        else cmds.push({ t: 'noenv' });
        if (hasOrn) { st.orn = cmd - 0xf0; st.pio = 0; }
        if (hasSmp) { const d = b[s.off++]; st.smp = (d < 64 && !(d & 1)) ? d / 2 : 0; }
      }
      else if (cmd < 0x40) cmds.push({ t: 'noise', v: cmd - 0x20 });
      else if (cmd < 0x50) { st.orn = cmd - 0x40; st.pio = 0; }
      else if (cmd < 0xb0) { note = cmd - 0x50; break; }
      else if (cmd === 0xb0) cmds.push({ t: 'noenv' });
      else if (cmd === 0xb1) s.period = (b[s.off++] - 1) & 255;
      else if (cmd === 0xc0) { restSet = true; break; }
      else if (cmd < 0xd0) st.vol = cmd - 0xc0;
      else if (cmd === 0xd0) break;
      else if (cmd < 0xf0) st.smp = cmd - 0xd0;
    }
    // parameters of numeric commands follow the note, processed in reverse order
    const nums = [];
    for (let i = pre.length - 1; i >= 0; i--) {
      const c = pre[i];
      if (c === 1) { const per = b[s.off++]; const step = s16(b, s.off); s.off += 2; nums.push({ t: 'gliss', per, step }); }
      else if (c === 2) { const per = b[s.off++]; s.off += 2; const step = s16(b, s.off); s.off += 2; nums.push({ t: 'glissnote', per, step }); }
      else if (c === 3) nums.push({ t: 'smpoff', v: b[s.off++] });
      else if (c === 4) nums.push({ t: 'ornoff', v: b[s.off++] });
      else if (c === 5) { const on = b[s.off++], off = b[s.off++]; nums.push({ t: 'vib', on, off }); }
      else if (c === 8) { const per = b[s.off++]; const step = s16(b, s.off); s.off += 2; nums.push({ t: 'envslide', per, step }); }
      else if (c === 9) this.tempo = b[s.off++];
    }
    this.applyCell(st, { rest: restSet, note, cmds, nums });
  }
  // mirrors Vortex GetNewChannelState; shared by the binary and the text (Vortex .txt) front-ends
  applyCell(st, cell) {
    const { rest: restSet, note, cmds, nums } = cell;
    const hasGlissNote = nums.some(n => n.t === 'glissnote');
    const prevSlide = st.sl.val;
    if (restSet || note >= 0) {
      st.pis = st.pio = 0; st.volSlide = st.envSl = st.noiseSl = 0; st.sl.cnt = 0; st.sl.val = 0; st.acc = 0; st.vibCnt = 0;
      st.en = !restSet;
    }
    if (note >= 0) { if (hasGlissNote) st.glTarget = note; else st.note = note; }
    for (const c of cmds) {
      if (c.t === 'env') { this.pendEnvType = c.type; this.envSet = true; this.envBase = c.tone; st.env = true; this.envSl.val = 0; this.envSl.cnt = 0; st.pio = 0; }
      else if (c.t === 'noenv') { st.env = false; st.pio = 0; }
      else if (c.t === 'noise') this.noiseBase = c.v;
    }
    const V = this.m.version;
    for (const n of nums) {
      switch (n.t) {
        case 'gliss':
          st.sl.per = st.sl.cnt = n.per; st.sl.delta = n.step; st.target = -1; st.vibCnt = 0;
          if (st.sl.cnt === 0 && V >= 7) st.sl.cnt++;
          break;
        case 'glissnote':
          st.vibCnt = 0; st.sl.per = st.sl.cnt = n.per; st.sl.delta = Math.abs(n.step); st.target = st.glTarget;
          st.slDelta = this.T[st.target] - this.T[st.note];
          if (V >= 6) st.sl.val = prevSlide;
          if (st.slDelta - st.sl.val < 0) st.sl.delta = -st.sl.delta;
          break;
        case 'smpoff': st.pis = n.v; break;
        case 'ornoff': st.pio = n.v; break;
        case 'vib': st.vibCnt = st.vibOn = n.on; st.vibOff = n.off; st.sl.val = 0; st.sl.cnt = 0; break;
        case 'envslide': this.envSl.per = this.envSl.cnt = n.per; this.envSl.delta = n.step; break;
      }
    }
  }
  static slUpdate(s) {
    if (s.cnt && !--s.cnt) { s.val += s.delta; s.cnt = s.per; return true; }
    return false;
  }
  frame(regs) {
    if (this.done) return false;
    this.envSet = false;
    if (this.lead) {
      if (this.lead.done) { this.done = true; return false; }
      this.tempo = this.lead.tempo;
      if (this.quirk === 0) {
        if (!this.patLoaded || this.lead.posIdx !== this.posIdx) { this.posIdx = this.lead.posIdx; this.startPattern(); }
        this.nextLine(); // a shorter pattern simply keeps its previous state
      }
    } else if (this.quirk === 0) {
      if (!this.patLoaded) this.startPattern();
      while (!this.nextLine()) {
        this.posIdx++; this.patLoaded = false;
        if (this.posIdx >= this.m.pos.length) { this.done = true; return false; }
        this.startPattern();
      }
    }
    this.quirk = (this.quirk + 1) % this.tempo;
    let mixer = 0, envAddon = 0;
    const T = this.T;
    for (let c = 0; c < 3; c++) {
      const st = this.ch[c];
      if (!st.en) { regs[8 + c] = 0; mixer |= (1 << c) | (8 << c); }
      else {
        const smp = this.m.samples[st.smp], orn = this.m.orns[st.orn];
        if (!smp || !smp.lines.length) { regs[8 + c] = 0; mixer |= (1 << c) | (8 << c); }
        else {
          const ln = smp.lines[st.pis % smp.lines.length];
          const toneAddon = ln.toneOff + st.acc; if (ln.keepTone) st.acc = toneAddon;
          const ol = orn && orn.lines.length ? orn.lines[st.pio] : 0;
          const note = Math.max(0, Math.min(95, st.note + ol));
          const per = Math.max(0, Math.min(4095, T[note] + st.sl.val + toneAddon));
          regs[c * 2] = per & 255; regs[c * 2 + 1] = per >> 8;
          if (ln.toneMask) mixer |= (1 << c);
          st.volSlide = Math.max(-15, Math.min(15, st.volSlide + ln.volSlide));
          const lvl = this.vol[st.vol * 16 + Math.max(0, Math.min(15, st.volSlide + ln.level))];
          regs[8 + c] = lvl | ((st.env && !ln.env) ? 16 : 0);
          if (ln.noiseMask) {
            const ea = ln.noiseOrEnvOff + st.envSl; if (ln.keepNE) st.envSl = ea;
            envAddon += ea; mixer |= (8 << c);
          } else {
            this.noiseAdd = ln.noiseOrEnvOff + st.noiseSl; if (ln.keepNE) st.noiseSl = this.noiseAdd;
          }
          if (PT3Player.slUpdate(st.sl) && st.target >= 0) {
            if ((st.sl.delta < 0 && st.sl.val <= st.slDelta) || (st.sl.delta >= 0 && st.sl.val >= st.slDelta)) {
              st.note = st.target; st.sl.val = 0; st.sl.cnt = 0;
            }
          }
          if (++st.pis >= smp.lines.length) st.pis = smp.loop;
          if (orn && ++st.pio >= orn.lines.length) st.pio = orn.loop;
        }
      }
      if (st.vibCnt > 0 && !--st.vibCnt) { st.en = !st.en; st.vibCnt = st.en ? st.vibOn : st.vibOff; }
    }
    regs[7] = mixer;
    regs[6] = (this.noiseBase + this.noiseAdd) & 31;
    const ep = (envAddon + this.envSl.val + this.envBase) & 0xffff;
    regs[11] = ep & 255; regs[12] = ep >> 8;
    if (this.envSet) regs[13] = this.pendEnvType;
    PT3Player.slUpdate(this.envSl);
    return true;
  }
}
function createPT3(b) {
  const a = new PT3Player(b), mode = a.m.mode;
  const maxPat = Math.max(...a.m.pos);
  if (mode === 0x20 || !(mode > maxPat && mode < maxPat * 2)) return a;
  // TurboSound inside one PT3: the second chip plays mirrored pattern (mode - 1 - n)
  const second = new PT3Player(b, { patMap: n => mode - 1 - n, lead: a });
  return new TSPlayer(a, second);
}
FORMATS.push({ name: 'Pro Tracker 3 / Vortex (PT3)', exts: ['pt3'], create: b => createPT3(b) });
addLoopBack(PT3Player, m => m.loop);
