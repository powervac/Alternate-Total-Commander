// Amstrad CPC AYC: 14 independently LZ-packed register streams (1 MHz AY)
function createAYC(b) {
  if (b.length < 64) throw new Error('AYC: файл слишком короткий');
  const frames = u16(b, 0);
  if (!frames) throw new Error('AYC: нет кадров');
  const streams = [];
  let minStart = 50;
  for (let reg = 0; reg < 14; reg++) {
    const sizeHi = b[2 + reg * 3], off = u16(b, 3 + reg * 3) + reg * 3 + 4;
    if ((sizeHi !== 1 && sizeHi !== 4) || off < minStart || off >= b.length) throw new Error('AYC: неверный заголовок');
    minStart = off;
    const bufSize = sizeHi << 8, buf = new Uint8Array(bufSize), out = new Uint8Array(frames);
    let p = off, cursor = 0, produced = 0, count = frames, flag = 0x40;
    const rb = () => { if (p >= b.length) throw new Error('AYC: неожиданный конец данных'); return b[p++]; };
    while (count) {
      flag <<= 1;
      if ((flag & 0xff) === 0) { flag = rb(); flag = (flag << 1) | 1; }
      if (flag & 0x100) {
        flag &= 0xff;
        let counter = (-rb()) & 255; if (!counter) counter = 256;
        let src = rb(); if (sizeHi !== 1) src |= rb() << 8;
        if (count < counter || src >= bufSize) throw new Error('AYC: ошибка данных');
        for (count -= counter; counter; counter--) {
          const v = buf[src++]; buf[cursor++] = v; out[produced++] = v;
          if (cursor >= bufSize) cursor -= bufSize;
          if (src >= bufSize) src -= bufSize;
        }
      } else {
        count--; const v = rb(); buf[cursor++] = v; out[produced++] = v;
        if (cursor >= bufSize) cursor -= bufSize;
      }
    }
    streams.push(out);
  }
  return new DumpPlayer(frames, (f, r) => { for (let i = 0; i < 14; i++) r[i] = streams[i][f]; }, { clock: 1000000, rate: 50, title: '' });
}
FORMATS.push({ name: 'Amstrad CPC AYC', exts: ['ayc'], create: b => createAYC(b) });
