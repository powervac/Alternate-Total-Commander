// ZXAYEMUL (.ay): Z80 code driving a ZX Spectrum 128 AY chip. Beeper/digital tricks are not emulated.
const AY_FRAME_T = 70908;

class AYFilePlayer {
  constructor(b) {
    if (String.fromCharCode(...b.subarray(0, 8)) !== 'ZXAYEMUL') throw new Error('AY: нет сигнатуры ZXAYEMUL');
    const rel = o => { const v = ((b[o] << 8) | b[o + 1]) << 16 >> 16; return v ? o + v : 0; };
    const be = o => (b[o] << 8) | b[o + 1];
    const maxTrack = b[16], first = b[17], tracks = rel(18);
    if (!tracks || tracks + (maxTrack + 1) * 4 > b.length) throw new Error('AY: нет списка песен');
    const song = Math.min(first, maxTrack);
    const nameP = rel(tracks + song * 4), data = rel(tracks + song * 4 + 2);
    if (!data || data + 14 > b.length) throw new Error('AY: нет данных песни');
    const strAt = o => { if (!o) return ''; let e = o; while (e < b.length && b[e]) e++; return String.fromCharCode(...b.subarray(o, e)).trim(); };
    const author = strAt(rel(12));
    this.title = [strAt(nameP), author].filter(Boolean).join(' - ');
    const points = rel(data + 10), blocks = rel(data + 12);
    if (!points || points + 6 > b.length || !blocks) throw new Error('AY: нет точек входа');
    const mem = new Uint8Array(65536);
    mem.fill(0xc9, 0, 0x100); mem.fill(0xff, 0x100, 0x4000);
    let bp = blocks, addr = be(bp);
    if (!addr) throw new Error('AY: нет блоков данных');
    let init = be(points + 2); if (!init) init = addr;
    const play = be(points + 4);
    do {
      bp += 2; let len = be(bp); bp += 2;
      const src = rel(bp); bp += 2;
      if (addr + len > 65536) len = 65536 - addr;
      if (src + len > b.length) len = Math.max(0, b.length - src);
      mem.set(b.subarray(src, src + len), addr);
      if (bp + 6 > b.length) break;
      addr = be(bp);
    } while (addr);
    const passive = [0xf3, 0xcd, 0, 0, 0xed, 0x5e, 0xfb, 0x76, 0x18, 0xfa];
    const active = [0xf3, 0xcd, 0, 0, 0xed, 0x56, 0xfb, 0x76, 0xcd, 0, 0, 0x18, 0xf7];
    mem.set(play ? active : passive, 0);
    if (play) { mem[9] = play & 255; mem[10] = play >> 8; }
    mem[2] = init & 255; mem[3] = init >> 8; mem[0x38] = 0xfb;
    this.ay = new Uint8Array(16); this.sel = 0; this.w13 = false;
    const self = this;
    this.beeper = { start: 0, ev: [] }; this.beepLevel = 0;
    this.cpu = new Z80(mem, {
      out(port, v) {
        if (!(port & 1)) { const l = (v >> 4) & 1; if (l !== self.beepLevel) { self.beepLevel = l; self.beeper.ev.push([Math.max(0, self.cpu.t), l]); } }
        if ((port & 0xc002) === 0xc000) self.sel = v & 15;
        else if ((port & 0xc002) === 0x8000) { if (self.sel < 14) self.ay[self.sel] = v; if (self.sel === 13) self.w13 = true; }
      },
      in(port) { return (port & 0xc002) === 0xc000 ? self.ay[self.sel] : 0xff; }
    });
    const c = this.cpu, hi = b[data + 8], lo = b[data + 9];
    c.a = c.b = c.d = c.h = c.a2 = c.b2 = c.d2 = c.h2 = hi;
    c.f = c.c = c.e = c.l = c.f2 = c.c2 = c.e2 = c.l2 = lo;
    c.ix = c.iy = (hi << 8) | lo; c.sp = be(points); c.pc = 0;
    const len = be(data + 4); this.maxFrames = len > 0 ? len : 180 * 50; this.n = 0;
    this.clock = 1773400; this.frameRate = 50;
  }
  frame(regs) {
    if (this.n++ >= this.maxFrames) return false;
    const c = this.cpu; c.t -= AY_FRAME_T; if (c.t < 0) c.t = 0;
    this.w13 = false; this.beeper = { start: this.beepLevel, ev: [] };
    let pending = true;
    while (c.t < AY_FRAME_T) {
      if (pending) { if (c.interrupt()) pending = false; else if (c.t > 48) pending = false; }
      c.step();
    }
    for (let i = 0; i < 13; i++) regs[i] = this.ay[i];
    if (this.w13) regs[13] = this.ay[13];
    return true;
  }
}
FORMATS.push({ name: 'ZX AY (ZXAYEMUL)', exts: ['ay'], create: b => new AYFilePlayer(b) });
