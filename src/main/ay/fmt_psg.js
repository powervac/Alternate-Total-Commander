// PSG register stream (.psg) and TurboSound containers (.ts: two modules + '02TS' footer, or PT3 with Mode != 0)
class PSGPlayer {
  constructor(b) {
    if (b[0] !== 0x50 || b[1] !== 0x53 || b[2] !== 0x47 || b[3] !== 0x1a) throw new Error('PSG: нет сигнатуры');
    this.frames = []; // each: array of [reg, value]
    let cur = [], o = b[4] === 0xff ? 4 : 16;
    this.frames.push(cur);
    while (o < b.length) {
      const r = b[o++];
      if (r === 0xff) { cur = []; this.frames.push(cur); }
      else if (r === 0xfe) { if (o >= b.length) break; const n = 4 * b[o++]; for (let i = 0; i < n; i++) this.frames.push([]); cur = []; this.frames.push(cur); }
      else if (r === 0xfd) break;
      else if (r <= 15) { if (o >= b.length) break; cur.push([r, b[o++]]); }
      else break;
    }
    if (this.frames.length < 2) throw new Error('PSG: нет данных');
    this.f = 0; this.title = ''; this.reg = new Uint8Array(16);
  }
  frame(regs) {
    if (this.f >= this.frames.length) return false;
    for (const [r, v] of this.frames[this.f++]) { this.reg[r] = v; if (r === 13) this.w13 = true; }
    for (let i = 0; i < 13; i++) regs[i] = this.reg[i];
    if (this.w13) { regs[13] = this.reg[13]; this.w13 = false; }
    return true;
  }
}
FORMATS.push({ name: 'PSG register stream', exts: ['psg'], create: b => new PSGPlayer(b) });

// two players running in lockstep on two AY chips
class TSPlayer {
  constructor(a, b) {
    this.a = a; this.b = b; this.chips = 2; this.clock = a.clock; this.frameRate = a.frameRate;
    this.title = [a.title, b.title].filter((t, i, ar) => t && ar.indexOf(t) === i).join(' / ');
    this.doneA = this.doneB = false;
  }
  loopBack() {
    const a = this.a.loopBack && this.a.loopBack(), b = this.b.loopBack && this.b.loopBack();
    if (!a && !b) return false;
    this.doneA = !a; this.doneB = !b; return true;
  }
  frame(r1, r2) {
    let okA = false, okB = false;
    if (!this.doneA) { okA = this.a.frame(r1); if (!okA) this.doneA = true; }
    if (!this.doneB) { okB = this.b.frame(r2); if (!okB) this.doneB = true; }
    if (this.doneA) { r1[8] = r1[9] = r1[10] = 0; }
    if (this.doneB) { r2[8] = r2[9] = r2[10] = 0; }
    return okA || okB;
  }
}

function createTS(b) {
  const n = b.length;
  if (n < 270 || String.fromCharCode(...b.subarray(n - 4)) !== '02TS') throw new Error('TS: нет подписи 02TS');
  const s1 = u16(b, n - 16 + 4), s2 = u16(b, n - 16 + 10);
  if (s1 + s2 !== n - 16) throw new Error('TS: неверные размеры модулей');
  const kind = o => String.fromCharCode(...b.subarray(o, o + 3)).toLowerCase();
  const mk = (data, ext) => {
    const f = FORMATS.find(x => x.exts.includes(ext));
    if (!f) throw new Error('TS: неподдерживаемый тип модуля ' + ext);
    return f.create(data, ext);
  };
  const p1 = mk(b.subarray(0, s1), kind(n - 16)), p2 = mk(b.subarray(s1, s1 + s2), kind(n - 16 + 6));
  return new TSPlayer(p1, p2);
}
FORMATS.push({ name: 'TurboSound (2 × AY)', exts: ['ts', 'tsd'], create: b => createTS(b) });
