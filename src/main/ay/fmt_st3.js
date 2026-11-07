// Sound Tracker 3.x (.st3) - uses the Sound Tracker 1.x player engine (STCPlayer)
function parseST3(b) {
  if (b.length < 0x180) throw new Error('ST3: файл слишком короткий');
  const tempo = b[0], posOff = u16(b, 1), smpOff = u16(b, 3), ornOff = u16(b, 5), patOff = u16(b, 7);
  if (!tempo || posOff + 3 > b.length || smpOff + 3 > b.length || ornOff + 3 > b.length || patOff + 6 > b.length) throw new Error('ST3: неверный заголовок');
  const m = { tempo, title: '', pos: [], samples: {}, orns: {}, pats: {} };
  if (String.fromCharCode(...b.subarray(9, 37)) === 'KSA SOFTWARE COMPILATION OF ') m.title = ayStr(b, 37, 27);
  const len = b[posOff];
  for (let i = 0; i < len; i++) {
    const o = posOff + 1 + i * 2; if (o + 2 > b.length) break;
    if (b[o + 1] % 6) throw new Error('ST3: неверная позиция');
    m.pos.push({ pat: b[o + 1] / 6, trans: s8(b[o]) });
  }
  if (!m.pos.length) throw new Error('ST3: пустой список позиций');
  const sc = b[smpOff];
  for (let i = 0; i < Math.min(sc, 16); i++) {
    const o = u16(b, smpOff + 1 + i * 2); if (o + 130 > b.length) continue;
    const lines = [];
    for (let j = 0; j < 32; j++) {
      const q = o + 2 + j * 4, lm = b[q + 2];
      lines.push({ effect: s16(b, q), level: lm & 15, noiseMask: (lm >> 7) & 1, envMask: (lm >> 4) & 1, noise: b[q + 3] });
    }
    m.samples[i] = { loop: Math.min(b[o], 32), limit: Math.min(b[o] + b[o + 1], 32), lines };
  }
  const oc = b[ornOff];
  for (let i = 0; i < Math.min(oc, 16); i++) {
    const o = u16(b, ornOff + 1 + i * 2); if (o + 32 > b.length) continue;
    m.orns[i] = Array.from(b.subarray(o, o + 32), s8);
  }
  for (const p of new Set(m.pos.map(x => x.pat))) {
    const o = patOff + p * 6; if (o + 6 > b.length) throw new Error('ST3: неверный номер паттерна');
    m.pats[p] = [u16(b, o), u16(b, o + 2), u16(b, o + 4)];
  }
  return m;
}
FORMATS.push({ name: 'Sound Tracker 3 (ST3)', exts: ['st3'], create: b => new STCPlayer(b, parseST3(b)) });
