#!/usr/bin/env node
'use strict';
// Writes src/renderer/dark.css from src/renderer/style.css: every colour of the light style gets its dark counterpart (the hue stays, the lightness is
// mirrored according to what the colour is used for: a background, a text or a line). Run it after changing colours in style.css:
//   node tools/make-dark.js
// The theme itself is chosen in the program (Configuration > Dark Mode: On / Off / System); the main process sets nativeTheme, so that
// "@media (prefers-color-scheme: dark)" is true in every window. Hand-made corrections are in HAND below.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'renderer', 'style.css');
const OUT = path.join(__dirname, '..', 'src', 'renderer', 'dark.css');

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, Math.min(1, s), l];
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}

/** kind: 'bg' | 'text' | 'line' */
function dark(rgb, kind) {
  let [h, s, l] = rgbToHsl(...rgb);
  const vivid = s > 0.4;
  if (kind === 'bg') {
    if (l < 0.45) return rgb; // dark already (terminal, picture viewer, accents)
    if (vivid) { l = 0.17 + (1 - l) * 0.9; s *= 0.6; } else { l = 0.11 + (1 - l) * 0.55; s *= 0.5; }
    l = Math.min(l, 0.58);
  } else if (kind === 'text') {
    if (l >= 0.62) return rgb; // light text on a dark or coloured place
    l = vivid ? Math.max(0.68, 0.95 - l * 0.55) : 0.9 - l * 0.45;
    s = vivid ? Math.min(1, s * 0.95) : s * 0.5;
  } else {
    if (l > 0.5) { l = 0.22 + (1 - l) * 0.4; s *= 0.5; } else if (l < 0.35) { l = 0.55; s *= 0.5; } else return rgb;
  }
  return hslToRgb(h, s, l);
}

const NAMED = { white: [255, 255, 255], black: [0, 0, 0], silver: [192, 192, 192], gray: [128, 128, 128], grey: [128, 128, 128], red: [255, 0, 0], navy: [0, 0, 128] };
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|(?<![-\w])(?:white|black|silver|gray|grey|red|navy)(?![-\w(])/g;
const hex2 = (n) => n.toString(16).padStart(2, '0');

function convertColor(token, kind) {
  let rgb, alpha = '';
  if (token[0] === '#') {
    let x = token.slice(1);
    if (x.length === 3 || x.length === 4) x = [...x].map((c) => c + c).join('');
    if (x.length !== 6 && x.length !== 8) return token;
    rgb = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
    alpha = x.slice(6);
  } else if (token.startsWith('rgb')) {
    const parts = token.slice(token.indexOf('(') + 1, -1).split(/[,/ ]+/).filter(Boolean);
    rgb = parts.slice(0, 3).map(Number);
    const a = parts[3];
    if (rgb.some((v) => !Number.isFinite(v))) return token;
    const out = dark(rgb, kind);
    return a === undefined ? `rgb(${out.join(', ')})` : `rgba(${out.join(', ')}, ${a})`;
  } else rgb = NAMED[token];
  return '#' + dark(rgb, kind).map(hex2).join('') + alpha;
}

function kindOf(prop) {
  if (prop.startsWith('--')) return /line|border/.test(prop) ? 'line' : /bg|face|path|back/.test(prop) ? 'bg' : 'text';
  if (prop === 'color' || prop === 'fill' || prop === 'stroke' || prop === 'caret-color' || prop === '-webkit-text-fill-color') return 'text';
  if (prop.startsWith('background')) return 'bg';
  if (prop.startsWith('border') || prop.startsWith('outline') || prop === 'column-rule') return 'line';
  return null; // shadows and everything else stay
}

/** split "a: b; c: url(data:...;x)" into declarations (a ';' inside brackets or quotes does not split) */
function declarations(body) {
  const out = [];
  let depth = 0, quote = '', cur = '';
  for (const ch of body) {
    if (quote) { if (ch === quote) quote = ''; } else if (ch === '"' || ch === "'") quote = ch; else if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === ';' && !depth && !quote) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((d) => d.trim()).filter(Boolean);
}

/** top level blocks: [{ head, body }] */
function blocks(css) {
  const out = [];
  let i = 0, start = 0, depth = 0, head = '', quote = '';
  for (; i < css.length; i++) {
    const ch = css[i];
    if (quote) { if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') { if (!depth) { head = css.slice(start, i).trim(); start = i + 1; } depth++; }
    else if (ch === '}') { depth--; if (!depth) { out.push({ head, body: css.slice(start, i) }); start = i + 1; } }
    else if (ch === ';' && !depth) start = i + 1; // @import and the like
  }
  return out;
}

// every colour declaration is written again, also the ones that stay as they are: then the order of the rules decides as in the light style
function convert(css) {
  let out = '';
  for (const b of blocks(css)) {
    if (/^@(font-face|keyframes|-webkit-keyframes)/.test(b.head)) continue;
    if (b.head.startsWith('@')) { const inner = convert(b.body); if (inner) out += `${b.head} {\n${inner}}\n`; continue; }
    const keep = [];
    for (const d of declarations(b.body)) {
      const c = d.indexOf(':');
      if (c < 0) continue;
      const prop = d.slice(0, c).trim(), value = d.slice(c + 1).trim(), kind = kindOf(prop);
      if (!kind || /url\(/.test(value)) continue;
      COLOR.lastIndex = 0;
      if (!COLOR.test(value) && !/\b(transparent|none|inherit|currentColor)\b|var\(/i.test(value)) continue;
      keep.push(`${prop}: ${value.replace(COLOR, (t) => convertColor(t, kind))}`);
    }
    if (keep.length) out += `${b.head} { ${keep.join('; ')}; }\n`;
  }
  return out;
}

// what the rules of style.css do not say: the standard look of a window and of the form controls
const HAND_FIRST = `:root { color-scheme: dark; }
html, body { background-color: #1e1f22; color: #dcdde0; }
input, select, textarea { background-color: #26272b; color: #e4e5e8; border-color: #4a4c52; }
button { color: #e4e5e8; }
::-webkit-scrollbar-thumb { background-color: #4a4c52; }
`;
const HAND_LAST = `#toolbar svg, .toolbar svg { filter: brightness(1.55) saturate(.9); }
.list img.ic, .th-img img { filter: none; }
`;

const css = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const body = HAND_FIRST + convert(css) + HAND_LAST;
fs.writeFileSync(OUT, '/* GENERATED by tools/make-dark.js from style.css: do not edit, change the generator and run it again. */\n@media (prefers-color-scheme: dark) {\n' + body + '}\n');
console.log('dark.css written:', body.split('\n').length, 'lines');
