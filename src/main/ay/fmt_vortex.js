// Vortex Tracker II text module (.txt) - played by the PT3 engine
function createVortexText(b) {
  let text = ''; for (let i = 0; i < b.length; i += 8192) text += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
  text = text.replace(/^ï»¿/, '');
  const lines = text.split(/\r?\n/).map(l => l.trim());
  let li = 0;
  while (li < lines.length && !lines[li]) li++;
  if (!/^\[Module\]$/i.test(lines[li] || '')) throw new Error('Vortex: нет секции [Module]');
  li++;
  const hexv = ch => ch === '.' ? 0 : parseInt(ch, 16);
  const nib = ch => { const c = ch.toUpperCase(); if (c === '.') return 0; return c >= '0' && c <= '9' ? c.charCodeAt(0) - 48 : c.charCodeAt(0) - 55; };
  const hexN = s => { let v = 0; for (const c of s) { const d = hexv(c); if (isNaN(d)) throw new Error('Vortex: неверное число'); v = v * 16 + d; } return v; };
  const looped = str => {
    const el = str.split(','); let loop = 0; const vals = [];
    el.forEach((e, i) => { e = e.trim(); if (e[0] === 'L') { loop = i; e = e.slice(1); } vals.push(parseInt(e, 10)); });
    return { loop, vals };
  };
  const m = { version: 6, title: '', table: 0, tempo: 0, pos: [], samples: [], orns: [], textPats: {} };
  let author = '';
  for (; li < lines.length && lines[li]; li++) {
    const eq = lines[li].indexOf('='); if (eq < 0) throw new Error('Vortex: неверная строка заголовка');
    const k = lines[li].slice(0, eq).trim().toLowerCase(), v = lines[li].slice(eq + 1).trim();
    if (k === 'version') { if (!v.startsWith('3.')) throw new Error('Vortex: версия ' + v); m.version = +v.slice(2) || 0; }
    else if (k === 'title') m.title = v; else if (k === 'author') author = v;
    else if (k === 'notetable') m.table = +v; else if (k === 'speed') m.tempo = +v;
    else if (k === 'playorder') { const lp = looped(v); m.pos = lp.vals; m.loop = lp.loop; }
  }
  if (author) m.title = (m.title ? m.title + ' - ' : '') + author;
  if (!m.tempo || !m.pos.length) throw new Error('Vortex: нет темпа или порядка проигрывания');
  const NOTES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
  const parseSampleLine = str => {
    const f = str.split(/\s+/);
    if (f.length !== 4 && f.length !== 5) throw new Error('Vortex: строка сэмпла');
    const sg = c => c === '+' ? 1 : c === '-' ? -1 : (() => { throw new Error('Vortex: знак'); })();
    return { looped: f.length === 5, line: {
      toneMask: f[0][0] === 't' ? 1 : 0, noiseMask: f[0][1] === 'n' ? 1 : 0, env: f[0][2] === 'e' ? 1 : 0,
      toneOff: sg(f[1][0]) * hexN(f[1].slice(1, 4)), keepTone: f[1][4] === '^' ? 1 : 0,
      noiseOrEnvOff: sg(f[2][0]) * hexN(f[2].slice(1, 3)), keepNE: f[2][3] === '^' ? 1 : 0,
      level: hexN(f[3][0]), volSlide: f[3][1] === '_' ? 0 : sg(f[3][1]) } };
  };
  const parseChannel = (str, envBase) => {
    const f = str.trim().split(/\s+/);
    if (f.length !== 3) throw new Error('Vortex: канал паттерна');
    const t = { cell: { rest: false, note: -1, cmds: [], nums: [] } };
    const p = f[1]; if (p.length !== 4) throw new Error('Vortex: параметры ноты');
    const smp = nib(p[0]), env = hexN(p[1]), orn = hexN(p[2]), vol = hexN(p[3]);
    if (smp) t.smp = smp;
    if (env) { t.cell.cmds.push(env === 15 ? { t: 'noenv' } : { t: 'env', type: env, tone: envBase }); t.orn = orn; }
    else if (orn) t.orn = orn;
    if (vol) t.vol = vol;
    const c = f[2]; if (c.length !== 4) throw new Error('Vortex: команда');
    const code = hexN(c[0]), per = hexN(c[1]), prm = hexN(c[2] + c[3]);
    switch (code) {
      case 1: t.cell.nums.push({ t: 'gliss', per, step: prm }); break;
      case 2: t.cell.nums.push({ t: 'gliss', per, step: ((0xff00 + ((-prm) & 0xff)) << 16) >> 16 }); break;
      case 3: t.cell.nums.push({ t: 'glissnote', per, step: prm }); break;
      case 4: t.cell.nums.push({ t: 'smpoff', v: prm }); break;
      case 5: t.cell.nums.push({ t: 'ornoff', v: prm }); break;
      case 6: t.cell.nums.push({ t: 'vib', on: prm >> 4, off: prm & 15 }); break;
      case 9: t.cell.nums.push({ t: 'envslide', per, step: prm }); break;
      case 10: t.cell.nums.push({ t: 'envslide', per, step: -prm }); break;
      case 11: if (prm) t.tempo = prm; break;
    }
    const n = f[0];
    if (n === 'R--') t.cell.rest = true;
    else if (n !== '---') {
      const ix = NOTES.indexOf(n.slice(0, 2)), oct = +n[2];
      if (ix < 0 || !(oct >= 1 && oct <= 8)) throw new Error('Vortex: нота ' + n);
      t.cell.note = 12 * (oct - 1) + ix;
    }
    return t;
  };
  for (; li < lines.length; li++) {
    const h = /^\[(\w+?)(\d+)\]$/.exec(lines[li]); if (!h) continue;
    const kind = h[1].toLowerCase(), idx = +h[2]; li++;
    if (kind === 'ornament') {
      const l = looped(lines[li] || ''); m.orns[idx] = { loop: Math.min(l.loop, l.vals.length), lines: l.vals };
    } else if (kind === 'sample') {
      const out = []; let loop = -1;
      for (; li < lines.length && lines[li]; li++) { const r = parseSampleLine(lines[li]); if (r.looped) loop = out.length; out.push(r.line); }
      if (loop < 0) throw new Error('Vortex: у сэмпла нет метки цикла');
      m.samples[idx] = { loop, lines: out }; li--;
    } else if (kind === 'pattern') {
      const rows = [];
      for (; li < lines.length && lines[li]; li++) {
        const f = lines[li].split('|'); if (f.length !== 5) throw new Error('Vortex: строка паттерна');
        const envBase = hexN(f[0]);
        rows.push({ noise: hexN(f[1]), ch: [parseChannel(f[2], envBase), parseChannel(f[3], envBase), parseChannel(f[4], envBase)] });
      }
      m.textPats[idx] = rows; li--;
    }
  }
  return new PT3Player(new Uint8Array(0), { model: m });
}
FORMATS.push({ name: 'Vortex Tracker II (text)', exts: ['txt'], create: b => createVortexText(b) });
