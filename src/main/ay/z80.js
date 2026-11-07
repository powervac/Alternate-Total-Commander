// Compact Z80 core (documented opcodes + common undocumented ones), approximate T-states.
const Z_S = 0x80, Z_Z = 0x40, Z_Y = 0x20, Z_H = 0x10, Z_X = 0x08, Z_P = 0x04, Z_N = 0x02, Z_C = 0x01;
const Z_PAR = new Uint8Array(256), Z_SZP = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let p = 1; for (let b = 0; b < 8; b++) if (i & (1 << b)) p ^= 1;
  Z_PAR[i] = p ? Z_P : 0; Z_SZP[i] = (i & (Z_S | Z_Y | Z_X)) | (i ? 0 : Z_Z) | Z_PAR[i];
}

class Z80 {
  constructor(mem, io) {
    this.m = mem; this.io = io; this.t = 0; this.rom = 0;
    this.a = 0; this.f = 0; this.b = 0; this.c = 0; this.d = 0; this.e = 0; this.h = 0; this.l = 0;
    this.a2 = 0; this.f2 = 0; this.b2 = 0; this.c2 = 0; this.d2 = 0; this.e2 = 0; this.h2 = 0; this.l2 = 0;
    this.ix = 0; this.iy = 0; this.sp = 0xffff; this.pc = 0; this.i = 0; this.r = 0;
    this.iff1 = 0; this.iff2 = 0; this.im = 0; this.halted = false; this.eiDelay = false;
  }
  rd(a) { this.t += 3; return this.m[a & 0xffff]; }
  wr(a, v) { this.t += 3; a &= 0xffff; if (a >= this.rom) this.m[a] = v; } // addresses below 'rom' are read-only
  rd16(a) { return this.rd(a) | (this.rd(a + 1) << 8); }
  wr16(a, v) { this.wr(a, v & 255); this.wr(a + 1, v >> 8); }
  fetch() { this.t += 4; this.r = (this.r & 0x80) | ((this.r + 1) & 0x7f); const v = this.m[this.pc]; this.pc = (this.pc + 1) & 0xffff; return v; }
  imm8() { const v = this.rd(this.pc); this.pc = (this.pc + 1) & 0xffff; return v; }
  imm16() { const l = this.imm8(); return l | (this.imm8() << 8); }
  push(v) { this.sp = (this.sp - 1) & 0xffff; this.wr(this.sp, v >> 8); this.sp = (this.sp - 1) & 0xffff; this.wr(this.sp, v & 255); }
  pop() { const l = this.rd(this.sp); this.sp = (this.sp + 1) & 0xffff; const h = this.rd(this.sp); this.sp = (this.sp + 1) & 0xffff; return l | (h << 8); }
  get bc() { return (this.b << 8) | this.c; } set bc(v) { this.b = v >> 8 & 255; this.c = v & 255; }
  get de() { return (this.d << 8) | this.e; } set de(v) { this.d = v >> 8 & 255; this.e = v & 255; }
  get hl() { return (this.h << 8) | this.l; } set hl(v) { this.h = v >> 8 & 255; this.l = v & 255; }
  get af() { return (this.a << 8) | this.f; } set af(v) { this.a = v >> 8 & 255; this.f = v & 255; }

  // 8-bit register access; idx prefix: 0 none, 1 IX, 2 IY. mem operand address passed via ea
  getR(r, px) {
    switch (r) {
      case 0: return this.b; case 1: return this.c; case 2: return this.d; case 3: return this.e;
      case 4: return px === 1 ? this.ix >> 8 : px === 2 ? this.iy >> 8 : this.h;
      case 5: return px === 1 ? this.ix & 255 : px === 2 ? this.iy & 255 : this.l;
      case 7: return this.a;
    }
  }
  setR(r, v, px) {
    switch (r) {
      case 0: this.b = v; break; case 1: this.c = v; break; case 2: this.d = v; break; case 3: this.e = v; break;
      case 4: if (px === 1) this.ix = (this.ix & 255) | (v << 8); else if (px === 2) this.iy = (this.iy & 255) | (v << 8); else this.h = v; break;
      case 5: if (px === 1) this.ix = (this.ix & 0xff00) | v; else if (px === 2) this.iy = (this.iy & 0xff00) | v; else this.l = v; break;
      case 7: this.a = v; break;
    }
  }
  getRP(p, px) { switch (p) { case 0: return this.bc; case 1: return this.de; case 2: return px === 1 ? this.ix : px === 2 ? this.iy : this.hl; default: return this.sp; } }
  setRP(p, v, px) { v &= 0xffff; switch (p) { case 0: this.bc = v; break; case 1: this.de = v; break; case 2: if (px === 1) this.ix = v; else if (px === 2) this.iy = v; else this.hl = v; break; default: this.sp = v; } }
  getRP2(p, px) { return p === 3 ? this.af : this.getRP(p, px); }
  setRP2(p, v, px) { if (p === 3) this.af = v; else this.setRP(p, v, px); }
  cond(y) {
    const f = this.f;
    switch (y) { case 0: return !(f & Z_Z); case 1: return !!(f & Z_Z); case 2: return !(f & Z_C); case 3: return !!(f & Z_C);
      case 4: return !(f & Z_P); case 5: return !!(f & Z_P); case 6: return !(f & Z_S); default: return !!(f & Z_S); }
  }
  alu(y, v) {
    const a = this.a; let r;
    switch (y) {
      case 0: case 1: { const c = y === 1 ? (this.f & 1) : 0; r = a + v + c;
        this.f = (r & (Z_S | Z_Y | Z_X)) | ((r & 255) ? 0 : Z_Z) | ((a ^ v ^ r) & Z_H) | (((a ^ v ^ 0x80) & (a ^ r) & 0x80) ? Z_P : 0) | ((r >> 8) & 1); this.a = r & 255; break; }
      case 2: case 3: case 7: { const c = y === 3 ? (this.f & 1) : 0; r = a - v - c;
        this.f = (y === 7 ? (v & (Z_Y | Z_X)) : (r & (Z_Y | Z_X))) | (r & Z_S) | ((r & 255) ? 0 : Z_Z) | ((a ^ v ^ r) & Z_H) | (((a ^ v) & (a ^ r) & 0x80) ? Z_P : 0) | Z_N | ((r >> 8) & 1);
        if (y !== 7) this.a = r & 255; break; }
      case 4: this.a = a & v; this.f = Z_SZP[this.a] | Z_H; break;
      case 5: this.a = a ^ v; this.f = Z_SZP[this.a]; break;
      case 6: this.a = a | v; this.f = Z_SZP[this.a]; break;
    }
  }
  inc8(v) { const r = (v + 1) & 255; this.f = (this.f & Z_C) | (r & (Z_S | Z_Y | Z_X)) | (r ? 0 : Z_Z) | ((v & 15) === 15 ? Z_H : 0) | (v === 0x7f ? Z_P : 0); return r; }
  dec8(v) { const r = (v - 1) & 255; this.f = (this.f & Z_C) | (r & (Z_S | Z_Y | Z_X)) | (r ? 0 : Z_Z) | ((v & 15) === 0 ? Z_H : 0) | (v === 0x80 ? Z_P : 0) | Z_N; return r; }
  rot(y, v) {
    let r, c;
    switch (y) {
      case 0: c = v >> 7; r = ((v << 1) | c) & 255; break;
      case 1: c = v & 1; r = (v >> 1) | (c << 7); break;
      case 2: c = v >> 7; r = ((v << 1) | (this.f & 1)) & 255; break;
      case 3: c = v & 1; r = (v >> 1) | ((this.f & 1) << 7); break;
      case 4: c = v >> 7; r = (v << 1) & 255; break;
      case 5: c = v & 1; r = (v >> 1) | (v & 0x80); break;
      case 6: c = v >> 7; r = ((v << 1) | 1) & 255; break;
      default: c = v & 1; r = v >> 1;
    }
    this.f = Z_SZP[r] | c; return r;
  }
  add16(a, b) { const r = a + b; this.f = (this.f & (Z_S | Z_Z | Z_P)) | ((r >> 8) & (Z_Y | Z_X)) | (((a ^ b ^ r) >> 8) & Z_H) | ((r >> 16) & 1); this.t += 7; return r & 0xffff; }
  adc16(b, sub) {
    const a = this.hl, c = this.f & 1; let r;
    if (!sub) { r = a + b + c; this.f = ((r >> 8) & (Z_S | Z_Y | Z_X)) | ((r & 0xffff) ? 0 : Z_Z) | (((a ^ b ^ r) >> 8) & Z_H) | ((((a ^ b ^ 0x8000) & (a ^ r) & 0x8000)) ? Z_P : 0) | ((r >> 16) & 1); }
    else { r = a - b - c; this.f = ((r >> 8) & (Z_S | Z_Y | Z_X)) | ((r & 0xffff) ? 0 : Z_Z) | (((a ^ b ^ r) >> 8) & Z_H) | ((((a ^ b) & (a ^ r) & 0x8000)) ? Z_P : 0) | Z_N | ((r >> 16) & 1); }
    this.hl = r & 0xffff; this.t += 7;
  }
  daa() {
    let a = this.a, f = this.f, add = 0, c = f & 1;
    if ((f & Z_H) || (a & 15) > 9) add |= 6;
    if (c || a > 0x99) { add |= 0x60; c = 1; }
    const r = (f & Z_N) ? (a - add) & 255 : (a + add) & 255;
    const h = (f & Z_N) ? ((f & Z_H) && (a & 15) < 6 ? Z_H : 0) : ((a & 15) > 9 ? Z_H : 0);
    this.f = Z_SZP[r] | (f & Z_N) | h | c; this.a = r;
  }
  ea(px) { // (IX+d)/(IY+d) address
    const d = this.imm8(); this.t += 5; return ((px === 1 ? this.ix : this.iy) + ((d << 24) >> 24)) & 0xffff;
  }
  interrupt() {
    if (!this.iff1 || this.eiDelay) return false;
    this.halted = false; this.iff1 = this.iff2 = 0; this.r = (this.r + 1) & 0x7f;
    this.push(this.pc);
    if (this.im === 2) { this.pc = this.rd16((this.i << 8) | 0xff); this.t += 19 - 6 - 6; }
    else { this.pc = 0x38; this.t += 13 - 6; }
    return true;
  }
  step() {
    if (this.halted) { this.t += 4; return; }
    const wasEi = this.eiDelay; this.eiDelay = false;
    let px = 0, op = this.fetch();
    while (op === 0xdd || op === 0xfd) { px = op === 0xdd ? 1 : 2; op = this.fetch(); }
    if (op === 0xed) { px = 0; this.execED(this.fetch()); return; }
    if (op === 0xcb) {
      if (px) { const a = this.ea(px), o = this.imm8(); this.t -= 3; this.execCBmem(o, a); return; }
      this.execCB(this.fetch(), 0); return;
    }
    this.exec(op, px);
  }
  execCBmem(op, addr) {
    const x = op >> 6, y = (op >> 3) & 7, z = op & 7, v = this.rd(addr); this.t += 1;
    if (x === 1) { this.bit(y, v); this.f = (this.f & ~(Z_Y | Z_X)) | ((addr >> 8) & (Z_Y | Z_X)); return; }
    let r;
    if (x === 0) r = this.rot(y, v); else if (x === 2) r = v & ~(1 << y); else r = v | (1 << y);
    this.wr(addr, r); if (z !== 6) this.setR(z, r, 0);
  }
  bit(y, v) { const r = v & (1 << y); this.f = (this.f & Z_C) | Z_H | (r & 0x80 ? Z_S : 0) | (r ? 0 : (Z_Z | Z_P)) | (v & (Z_Y | Z_X)); }
  execCB(op) {
    const x = op >> 6, y = (op >> 3) & 7, z = op & 7;
    const v = z === 6 ? this.rd(this.hl) : this.getR(z, 0);
    if (x === 1) { this.bit(y, v); if (z === 6) this.f = (this.f & ~(Z_Y | Z_X)) | ((this.h) & (Z_Y | Z_X)); return; }
    const r = x === 0 ? this.rot(y, v) : x === 2 ? v & ~(1 << y) : v | (1 << y);
    if (z === 6) { this.t += 1; this.wr(this.hl, r); } else this.setR(z, r, 0);
  }
  exec(op, px) {
    const x = op >> 6, y = (op >> 3) & 7, z = op & 7, p = y >> 1, q = y & 1;
    if (x === 1) {
      if (op === 0x76) { this.halted = true; return; }
      if (z === 6) { const a = px ? this.ea(px) : this.hl; this.setR(y, this.rd(a), 0); }
      else if (y === 6) { const a = px ? this.ea(px) : this.hl; this.wr(a, this.getR(z, 0)); }
      else this.setR(y, this.getR(z, px), px);
      return;
    }
    if (x === 2) {
      let v; if (z === 6) { v = this.rd(px ? this.ea(px) : this.hl); } else v = this.getR(z, px);
      this.alu(y, v); return;
    }
    if (x === 0) {
      switch (z) {
        case 0:
          if (y === 0) return;
          if (y === 1) { let t; t = this.a; this.a = this.a2; this.a2 = t; t = this.f; this.f = this.f2; this.f2 = t; return; }
          if (y === 2) { const d = (this.imm8() << 24) >> 24; this.t += 1; this.b = (this.b - 1) & 255; if (this.b) { this.pc = (this.pc + d) & 0xffff; this.t += 5; } return; }
          { const d = (this.imm8() << 24) >> 24; if (y === 3 || this.cond(y - 4)) { this.pc = (this.pc + d) & 0xffff; this.t += 5; } return; }
        case 1:
          if (q === 0) this.setRP(p, this.imm16(), px); else this.setRP(2, this.add16(this.getRP(2, px), this.getRP(p, px)), px);
          return;
        case 2:
          switch (y) {
            case 0: this.wr(this.bc, this.a); return;
            case 1: this.a = this.rd(this.bc); return;
            case 2: this.wr(this.de, this.a); return;
            case 3: this.a = this.rd(this.de); return;
            case 4: { const a = this.imm16(); this.wr16(a, this.getRP(2, px)); return; }
            case 5: { const a = this.imm16(); this.setRP(2, this.rd16(a), px); return; }
            case 6: this.wr(this.imm16(), this.a); return;
            default: this.a = this.rd(this.imm16()); return;
          }
        case 3: this.t += 2; this.setRP(p, this.getRP(p, px) + (q ? -1 : 1), px); return;
        case 4: case 5: {
          const f = z === 4 ? v => this.inc8(v) : v => this.dec8(v);
          if (y === 6) { const a = px ? this.ea(px) : this.hl; const v = this.rd(a); this.t += 1; this.wr(a, f(v)); }
          else this.setR(y, f(this.getR(y, px)), px);
          return;
        }
        case 6:
          if (y === 6) { const a = px ? this.ea(px) : this.hl; const n = this.imm8(); if (px) this.t -= 3; this.wr(a, n); }
          else this.setR(y, this.imm8(), px);
          return;
        default:
          switch (y) {
            case 0: { const c = this.a >> 7; this.a = ((this.a << 1) | c) & 255; this.f = (this.f & (Z_S | Z_Z | Z_P)) | (this.a & (Z_Y | Z_X)) | c; return; }
            case 1: { const c = this.a & 1; this.a = (this.a >> 1) | (c << 7); this.f = (this.f & (Z_S | Z_Z | Z_P)) | (this.a & (Z_Y | Z_X)) | c; return; }
            case 2: { const c = this.a >> 7; this.a = ((this.a << 1) | (this.f & 1)) & 255; this.f = (this.f & (Z_S | Z_Z | Z_P)) | (this.a & (Z_Y | Z_X)) | c; return; }
            case 3: { const c = this.a & 1; this.a = (this.a >> 1) | ((this.f & 1) << 7); this.f = (this.f & (Z_S | Z_Z | Z_P)) | (this.a & (Z_Y | Z_X)) | c; return; }
            case 4: this.daa(); return;
            case 5: this.a ^= 255; this.f = (this.f & (Z_S | Z_Z | Z_P | Z_C)) | (this.a & (Z_Y | Z_X)) | Z_H | Z_N; return;
            case 6: this.f = (this.f & (Z_S | Z_Z | Z_P)) | (this.a & (Z_Y | Z_X)) | 1; return;
            default: this.f = (this.f & (Z_S | Z_Z | Z_P)) | (this.a & (Z_Y | Z_X)) | ((this.f & 1) ? Z_H : 0) | ((this.f & 1) ^ 1); return;
          }
      }
    }
    // x === 3
    switch (z) {
      case 0: this.t += 1; if (this.cond(y)) this.pc = this.pop(); return;
      case 1:
        if (q === 0) this.setRP2(p, this.pop(), px);
        else switch (p) {
          case 0: this.pc = this.pop(); return;
          case 1: { let t; t = this.b; this.b = this.b2; this.b2 = t; t = this.c; this.c = this.c2; this.c2 = t; t = this.d; this.d = this.d2; this.d2 = t;
            t = this.e; this.e = this.e2; this.e2 = t; t = this.h; this.h = this.h2; this.h2 = t; t = this.l; this.l = this.l2; this.l2 = t; return; }
          case 2: this.pc = this.getRP(2, px); return;
          default: this.sp = this.getRP(2, px); this.t += 2; return;
        }
        return;
      case 2: { const a = this.imm16(); if (this.cond(y)) this.pc = a; return; }
      case 3:
        switch (y) {
          case 0: this.pc = this.imm16(); return;
          case 2: { const n = this.imm8(); this.t += 4; this.io.out((this.a << 8) | n, this.a); return; }
          case 3: { const n = this.imm8(); this.t += 4; this.a = this.io.in((this.a << 8) | n); return; }
          case 4: { const lo = this.rd16(this.sp), v = this.getRP(2, px); this.t += 1; this.wr16(this.sp, v); this.setRP(2, lo, px); this.t += 2; return; }
          case 5: { const t = this.de; this.de = this.hl; this.hl = t; return; }
          case 6: this.iff1 = this.iff2 = 0; return;
          default: this.iff1 = this.iff2 = 1; this.eiDelay = true; return;
        }
      case 4: { const a = this.imm16(); if (this.cond(y)) { this.t += 1; this.push(this.pc); this.pc = a; } return; }
      case 5:
        if (q === 0) { this.t += 1; this.push(this.getRP2(p, px)); }
        else if (p === 0) { const a = this.imm16(); this.t += 1; this.push(this.pc); this.pc = a; }
        return;
      case 6: this.alu(y, this.imm8()); return;
      default: this.t += 1; this.push(this.pc); this.pc = y * 8; return;
    }
  }
  execED(op) {
    const x = op >> 6, y = (op >> 3) & 7, z = op & 7, p = y >> 1, q = y & 1;
    if (x === 1) {
      switch (z) {
        case 0: { const v = this.io.in(this.bc); this.f = (this.f & Z_C) | Z_SZP[v]; if (y !== 6) this.setR(y, v, 0); this.t += 4; return; }
        case 1: this.io.out(this.bc, y === 6 ? 0 : this.getR(y, 0)); this.t += 4; return;
        case 2: this.adc16(this.getRP(p, 0), q === 0); return;
        case 3: { const a = this.imm16(); if (q === 0) this.wr16(a, this.getRP(p, 0)); else this.setRP(p, this.rd16(a), 0); return; }
        case 4: { const a = this.a; this.a = 0; this.alu(2, a); return; }
        case 5: this.pc = this.pop(); this.iff1 = this.iff2; return;
        case 6: this.im = [0, 0, 1, 2, 0, 0, 1, 2][y]; return;
        default:
          switch (y) {
            case 0: this.i = this.a; this.t += 1; return;
            case 1: this.r = this.a; this.t += 1; return;
            case 2: this.a = this.i; this.f = (this.f & Z_C) | Z_SZP[this.a] & ~Z_P | (this.iff2 ? Z_P : 0); this.t += 1; return;
            case 3: this.a = this.r; this.f = (this.f & Z_C) | Z_SZP[this.a] & ~Z_P | (this.iff2 ? Z_P : 0); this.t += 1; return;
            case 4: { const v = this.rd(this.hl); this.t += 4; this.wr(this.hl, ((this.a << 4) | (v >> 4)) & 255); this.a = (this.a & 0xf0) | (v & 15); this.f = (this.f & Z_C) | Z_SZP[this.a]; return; }
            case 5: { const v = this.rd(this.hl); this.t += 4; this.wr(this.hl, ((v << 4) | (this.a & 15)) & 255); this.a = (this.a & 0xf0) | (v >> 4); this.f = (this.f & Z_C) | Z_SZP[this.a]; return; }
            default: return;
          }
      }
    }
    if (x === 2 && y >= 4 && z < 4) {
      const inc = !(y & 1), rep = y >= 6;
      let again = false;
      switch (z) {
        case 0: { const v = this.rd(this.hl); this.wr(this.de, v); this.t += 2; const n = v + this.a;
          this.hl = this.hl + (inc ? 1 : -1); this.de = this.de + (inc ? 1 : -1); this.bc = this.bc - 1;
          this.f = (this.f & (Z_S | Z_Z | Z_C)) | (n & Z_X) | ((n << 4) & Z_Y) | (this.bc ? Z_P : 0); again = !!this.bc; break; }
        case 1: { const v = this.rd(this.hl); this.t += 5; const r = (this.a - v) & 255;
          this.hl = this.hl + (inc ? 1 : -1); this.bc = this.bc - 1;
          const h = ((this.a ^ v ^ r) & Z_H) ? 1 : 0; const n = r - h;
          this.f = (this.f & Z_C) | (r & Z_S) | (r ? 0 : Z_Z) | (h ? Z_H : 0) | (n & Z_X) | ((n << 4) & Z_Y) | (this.bc ? Z_P : 0) | Z_N; again = !!this.bc && r !== 0; break; }
        case 2: { this.t += 1; const v = this.io.in(this.bc); this.wr(this.hl, v); this.b = (this.b - 1) & 255; this.hl = this.hl + (inc ? 1 : -1);
          this.f = (this.b ? 0 : Z_Z) | Z_N | (this.b & Z_S); again = !!this.b; break; }
        default: { this.t += 1; const v = this.rd(this.hl); this.b = (this.b - 1) & 255; this.io.out(this.bc, v); this.hl = this.hl + (inc ? 1 : -1);
          this.f = (this.b ? 0 : Z_Z) | Z_N | (this.b & Z_S); again = !!this.b; }
      }
      if (rep && again) { this.pc = (this.pc - 2) & 0xffff; this.t += 5; }
    }
  }
}
