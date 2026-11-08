'use strict';
// Checks the help texts of src/renderer/help (all languages against English): same sections in the same order, every section filled, the same HTML
// structure (tag counts per type and balanced tags), links between sections that point to a section, no leftovers of other scripts mixed into words.
// node tools/check-help.js   (exit code 1 when something is wrong)
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'renderer', 'help');
global.HELP_TEXT = {};
const langs = fs.readdirSync(dir).filter((f) => /^[a-z]{2}\.js$/.test(f)).map((f) => f.slice(0, 2));
for (const l of langs) require(path.join(dir, l + '.js'));

const TAGS = ['p', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'h3', 'b', 'kbd', 'code', 'a'];
const count = (h) => Object.fromEntries(TAGS.map((t) => [t, (h.match(new RegExp('<' + t + '[ >]', 'g')) || []).length]));
function balanced(h) {
  const st = [];
  for (const m of h.matchAll(/<(\/?)([a-z0-9]+)[^>]*?(\/?)>/gi)) {
    if (m[3] || ['br', 'img', 'hr'].includes(m[2])) continue;
    if (!m[1]) st.push(m[2]);
    else if (st.pop() !== m[2]) return false;
  }
  return st.length === 0;
}

let bad = 0;
const fail = (l, msg) => { bad++; console.log(`FAIL [${l}] ${msg}`); };
const en = HELP_TEXT.en;
const ids = en.sections.map((s) => s.id);
for (const l of langs) {
  const d = HELP_TEXT[l];
  if (!d) { fail(l, 'no HELP_TEXT'); continue; }
  const got = d.sections.map((s) => s.id);
  if (JSON.stringify(got) !== JSON.stringify(ids)) fail(l, `sections differ: ${got.join(',')}`);
  for (const k of Object.keys(en.ui)) if (!d.ui[k]) fail(l, `ui.${k} missing`);
  if (!/\{n\}/.test(d.ui.found) || !/\{s\}/.test(d.ui.found)) fail(l, 'ui.found needs {n} and {s}');
  for (const s of d.sections) {
    const e = en.sections.find((x) => x.id === s.id);
    if (!e) continue;
    if (!s.t) fail(l, `${s.id}: no title`);
    if (s.id === 'keys') continue; // built by the program from the command list
    if (!s.h || s.h.length < 80) fail(l, `${s.id}: empty or very short`);
    if (!balanced(s.h)) fail(l, `${s.id}: unbalanced tags`);
    const a = count(e.h), b = count(s.h);
    for (const t of TAGS) if (a[t] !== b[t]) fail(l, `${s.id}: <${t}> ${b[t]} (English ${a[t]})`);
    for (const m of s.h.matchAll(/data-go="([^"]+)"/g)) if (!ids.includes(m[1])) fail(l, `${s.id}: link to unknown section ${m[1]}`);
    for (const m of s.h.matchAll(/data-u="([^"]+)"/g)) if (!/^https:\/\//.test(m[1])) fail(l, `${s.id}: bad link ${m[1]}`);
    if (/`|\$\{/.test(s.h)) fail(l, `${s.id}: a template character is in the text`);
  }
  if (l !== 'en') {
    const all = d.sections.map((s) => s.h).join(' ').replace(/<[^>]+>/g, ' ');
    const mixed = all.match(/[A-Za-z]+[Ѐ-ӿ]+|[Ѐ-ӿ]+[A-Za-z]+/g);
    if (mixed) fail(l, 'Latin and Cyrillic letters in one word: ' + [...new Set(mixed)].slice(0, 5).join(', '));
  }
  const words = d.sections.map((s) => s.h.replace(/<[^>]+>/g, ' ')).join(' ').split(/\s+/).filter(Boolean).length;
  console.log(`${l}: ${d.sections.length} sections, ${words} words`);
}
console.log(bad ? `\n${bad} problem(s)` : '\nall help texts are consistent');
process.exit(bad ? 1 : 0);
