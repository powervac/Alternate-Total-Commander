#!/usr/bin/env node
'use strict';
// Mutation testing for the plain-JavaScript files of this project (no framework, no bundler).
//
//   node tools/mutate.js                     all targets of tests/mutation.config.json
//   node tools/mutate.js davclient           only the targets whose file name contains "davclient"
//   node tools/mutate.js --list              count the mutants, run nothing
//   node tools/mutate.js --workers 6 --sample 40 --seed 7   a random sample of 40 mutants per file
//
// How it works: the file is cut into tokens with acorn; every operator, literal, condition or return value of the kinds listed in OPERATORS
// becomes one mutant (the file with that single change). Each mutant runs the tests of its target (`node --test`) in a private copy of
// src/main + tests, so mutants run in parallel and the real files are never touched. A mutant that makes a test fail (or hang) is KILLED,
// one that passes all tests SURVIVED = the tests do not notice that change. Survivors are either a gap in the tests (write a test) or an
// EQUIVALENT mutant (the change does not alter the behaviour): those are listed with a reason in tests/mutation-equivalent.json and left
// out of the score. Score = killed / (killed + survived). Report: tests/mutation-report.json.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'tests', 'mutation.config.json');
const EQUIV = path.join(ROOT, 'tests', 'mutation-equivalent.json');
const REPORT = path.join(ROOT, 'tests', 'mutation-report.json');

// ---------------------------------------------------------------- mutants
const RELATIONAL = { '<': ['<=', '>='], '<=': ['<', '>'], '>': ['>=', '<='], '>=': ['>', '<'] };
const EQUALITY = { '==': '!=', '!=': '==', '===': '!==', '!==': '===' };
const VALUE_END = new Set(['name', 'num', 'string', 'regexp', ')', ']', '`', 'this', 'true', 'false', 'null', 'super']);

/** all mutants of a source text: [{ start, end, to, op, from, line, col }] (replace src[start, end) by `to`) */
function mutantsOf(src) {
  const toks = [...acorn.tokenizer(src, { ecmaVersion: 'latest', locations: true })];
  const out = [];
  const add = (t, start, end, to, op) => out.push({ start, end, to, op, from: src.slice(start, end), line: t.loc.start.line, col: t.loc.start.column + 1 });
  const label = (t) => (t ? t.type.label : '');
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const prev = toks[i - 1];
    const next = toks[i + 1];
    const l = label(t);
    const v = t.value;
    if (l === '+/-') {
      if (prev && VALUE_END.has(label(prev))) add(t, t.start, t.end, v === '+' ? '-' : '+', 'arith');
    } else if (l === '*') add(t, t.start, t.end, '/', 'arith');
    else if (l === '/') add(t, t.start, t.end, '*', 'arith');
    else if (l === '%') add(t, t.start, t.end, '*', 'arith');
    else if (l === '++/--') add(t, t.start, t.end, v === '++' ? '--' : '++', 'incdec');
    else if (l === '</>/<=/>=' && RELATIONAL[v]) { for (const to of RELATIONAL[v]) add(t, t.start, t.end, to, 'relational'); }
    else if (l === '==/!=/===/!==' && EQUALITY[v]) add(t, t.start, t.end, EQUALITY[v], 'equality');
    else if (l === '&&') add(t, t.start, t.end, '||', 'logical');
    else if (l === '||') add(t, t.start, t.end, '&&', 'logical');
    else if (l === '!/~' && v === '!') add(t, t.start, t.end, '', 'not');
    else if (l === 'true') add(t, t.start, t.end, 'false', 'boolean');
    else if (l === 'false') add(t, t.start, t.end, 'true', 'boolean');
    else if (l === 'num') {
      const n = Number(src.slice(t.start, t.end).replace(/_/g, ''));
      if (Number.isFinite(n) && /^\d+$/.test(src.slice(t.start, t.end))) {
        add(t, t.start, t.end, String(n + 1), 'number');
        if (n === 1) add(t, t.start, t.end, '0', 'number');
      }
    } else if (l === 'string') {
      const eq = (x) => x && label(x) === '==/!=/===/!==';
      const errMsg = prev && label(prev) === '(' && toks[i - 2] && toks[i - 2].type.label === 'name' && /Error$/.test(toks[i - 2].value);
      if (eq(prev) || eq(next) || errMsg) {
        const q = src[t.start];
        if (v !== '__mutant__') add(t, t.start, t.end, q + '__mutant__' + q, errMsg ? 'message' : 'string');
      }
    } else if (l === 'name' && v === 'await' && !(prev && label(prev) === '.') && next && !/^(:|\))$/.test(label(next))) {
      add(t, t.start, t.end, '', 'await');
    } else if (l === 'if' && next && label(next) === '(') {
      let depth = 0;
      let j = i + 1;
      for (; j < toks.length; j++) {
        if (label(toks[j]) === '(') depth++;
        else if (label(toks[j]) === ')' && --depth === 0) break;
      }
      if (j < toks.length) {
        const a = next.end; const b = toks[j].start;
        const cond = src.slice(a, b).trim();
        if (cond !== 'true') add(t, a, b, 'true', 'if-true');
        if (cond !== 'false') add(t, a, b, 'false', 'if-false');
      }
    } else if (l === 'return' && next && label(next) !== ';' && label(next) !== '}') {
      let depth = 0;
      let j = i + 1;
      for (; j < toks.length; j++) {
        const lj = label(toks[j]);
        if (lj === '(' || lj === '[' || lj === '{' || lj === '${') depth++;
        else if (lj === ')' || lj === ']' || lj === '}') { if (--depth < 0) break; } else if (lj === ';' && depth === 0) break;
      }
      const a = next.start; const b = toks[j] ? toks[j].start : src.length;
      if (src.slice(a, b).trim() !== 'undefined') add(t, a, b, 'undefined', 'return');
    }
  }
  // a mutant that is not valid JavaScript is no mutant; identical texts are counted once
  const seen = new Set();
  const valid = [];
  for (const m of out) {
    const text = src.slice(0, m.start) + m.to + src.slice(m.end);
    if (seen.has(text)) continue;
    seen.add(text);
    try { new vm.Script('(function (exports, require, module, __filename, __dirname) {' + text + '\n})'); } catch { continue; }
    valid.push(m);
  }
  return valid;
}

// ---------------------------------------------------------------- running
function copyDir(from, to, skip = () => false) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (skip(e.name)) continue;
    const a = path.join(from, e.name); const b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b, skip); else fs.copyFileSync(a, b);
  }
}

function makeSandbox(base, i) {
  const dir = path.join(base, 'w' + i);
  copyDir(path.join(ROOT, 'src', 'main'), path.join(dir, 'src', 'main'), (n) => n === 'oauth-defaults.json');
  copyDir(path.join(ROOT, 'tests'), path.join(dir, 'tests'), (n) => /^mutation-/.test(n));
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'));
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  return dir;
}

/** runs the tests in a sandbox; resolves { ok, timedOut, spawnFailed, ms, tail }. A failed spawn (Windows is out of handles for a moment) is tried again */
async function runTests(dir, tests, timeoutMs) {
  for (let attempt = 1; ; attempt++) {
    const r = await runTestsOnce(dir, tests, timeoutMs);
    if (!r.spawnFailed || attempt >= 6) return r;
    await new Promise((res) => setTimeout(res, 500 * attempt));
  }
}

function runTestsOnce(dir, tests, timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let child;
    try {
      child = spawn(process.execPath, ['--test', ...tests], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      return resolve({ ok: false, timedOut: false, spawnFailed: true, ms: 0, tail: String(e) });
    }
    let out = '';
    const keep = (d) => { out = (out + d).slice(-4000); };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs);
    child.on('close', (code) => { clearTimeout(timer); resolve({ ok: code === 0 && !timedOut, timedOut, ms: Date.now() - t0, tail: out }); });
    child.on('error', () => { clearTimeout(timer); resolve({ ok: false, timedOut, spawnFailed: !child.pid, ms: Date.now() - t0, tail: out }); });
  });
}

function killTree(child) {
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else child.kill('SIGKILL');
  } catch { /* gone */ }
}

async function pool(items, n, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async (_, w) => { while (next < items.length) { const it = items[next++]; await fn(it, w); } }));
}

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

async function main() {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
  const list = args.includes('--list');
  const workers = +opt('workers', 4);
  const sample = +opt('sample', 0);
  const seed = +opt('seed', 1);
  const filters = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && ['workers', 'sample', 'seed'].includes(args[i - 1].slice(2))));
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const equivalent = fs.existsSync(EQUIV) ? JSON.parse(fs.readFileSync(EQUIV, 'utf8')) : [];
  const targets = config.targets.filter((t) => !filters.length || filters.some((f) => t.file.includes(f)));
  if (!targets.length) { console.error('No target matches ' + filters.join(', ')); process.exit(2); }

  const plan = targets.map((t) => {
    const src = fs.readFileSync(path.join(ROOT, t.file), 'utf8');
    let ms = mutantsOf(src).map((m, i) => ({ ...m, id: `${t.file}#${i}`, file: t.file, target: t, snippet: src.split('\n')[m.line - 1].trim().slice(0, 140) }));
    if (sample && ms.length > sample) { const r = rng(seed); ms = ms.map((m) => [r(), m]).sort((a, b) => a[0] - b[0]).slice(0, sample).map((x) => x[1]).sort((a, b) => a.start - b.start); }
    return { target: t, src, mutants: ms };
  });
  if (list) {
    for (const p of plan) {
      const by = {};
      for (const m of p.mutants) by[m.op] = (by[m.op] || 0) + 1;
      console.log(`${p.target.file}: ${p.mutants.length} mutants`, JSON.stringify(by));
    }
    return;
  }

  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdr-mut-'));
  const boxes = [];
  for (let i = 0; i < workers; i++) boxes.push(makeSandbox(base, i));
  const results = [];
  const started = Date.now();
  try {
    for (const p of plan) {
      const t = p.target;
      // the baseline must pass, twice (a flaky test would make every survivor and every kill meaningless)
      for (let k = 0; k < 2; k++) {
        const b = await runTests(boxes[0], t.tests, (t.timeoutSec || 120) * 1000);
        if (!b.ok) { console.error(`BASELINE FAILS for ${t.file}:\n${b.tail}`); process.exit(3); }
        p.baseMs = Math.max(p.baseMs || 0, b.ms);
      }
      const limit = Math.max(15000, p.baseMs * 5);
      console.log(`\n${t.file}: ${p.mutants.length} mutants, baseline ${(p.baseMs / 1000).toFixed(1)} s, timeout ${(limit / 1000).toFixed(0)} s, ${workers} workers`);
      let done = 0;
      const file = path.join('src', 'main', path.relative(path.join('src', 'main'), t.file));
      await pool(p.mutants, workers, async (m, w) => {
        const box = boxes[w];
        const target = path.join(box, file);
        fs.writeFileSync(target, p.src.slice(0, m.start) + m.to + p.src.slice(m.end));
        const r = await runTests(box, t.tests, limit);
        fs.writeFileSync(target, p.src);
        const eq = equivalent.find((e) => e.file === m.file && e.line === m.line && (!e.op || e.op === m.op) && (e.to === undefined || e.to === m.to) && (!e.col || e.col === m.col));
        m.status = r.ok ? (eq ? 'equivalent' : 'survived') : r.spawnFailed ? 'error' : r.timedOut ? 'timeout' : 'killed';
        if (eq && r.ok) m.reason = eq.reason;
        m.ms = r.ms;
        results.push(m);
        if (++done % 25 === 0 || done === p.mutants.length) process.stdout.write(`  ${done}/${p.mutants.length}  survivors so far: ${p.mutants.filter((x) => x.status === 'survived').length}\r`);
      });
      process.stdout.write('\n');
      for (const m of p.mutants.filter((x) => x.status === 'survived').sort((a, b) => a.line - b.line)) console.log(`  SURVIVOR ${m.line}:${m.col} [${m.op}] ${m.from} -> ${m.to || '(removed)'}  | ${m.snippet}`);
      const bad = p.mutants.filter((x) => x.status === 'error').length;
      if (bad) console.log(`  ${bad} mutants could not be run (the system refused to start the tests): run again`);
    }
  } finally {
    for (const b of boxes) { try { fs.rmSync(b, { recursive: true, force: true, maxRetries: 3 }); } catch { /* in use */ } }
    try { fs.rmSync(base, { recursive: true, force: true }); } catch { /* in use */ }
  }

  // ---------------------------------------------------------------- report
  const rep = { date: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000), workers, sample: sample || null, files: {} };
  console.log('\nfile'.padEnd(34) + 'mutants  killed  timeout  survived  equiv  error  score');
  let tk = 0; let ts = 0;
  for (const p of plan) {
    const ms = results.filter((m) => m.file === p.target.file);
    const c = (s) => ms.filter((m) => m.status === s).length;
    const killed = c('killed') + c('timeout');
    const survived = c('survived');
    const score = killed + survived ? killed / (killed + survived) : 1;
    tk += killed; ts += survived;
    console.log(p.target.file.padEnd(33) + String(ms.length).padStart(7) + String(c('killed')).padStart(8) + String(c('timeout')).padStart(9) + String(survived).padStart(10) + String(c('equivalent')).padStart(7) + String(c('error')).padStart(7) + `  ${(score * 100).toFixed(1)}%`);
    rep.files[p.target.file] = {
      mutants: ms.length, killed: c('killed'), timeout: c('timeout'), survived, equivalent: c('equivalent'), error: c('error'), score: +(score * 100).toFixed(1),
      survivors: ms.filter((m) => m.status === 'survived').sort((a, b) => a.line - b.line).map((m) => ({ line: m.line, col: m.col, op: m.op, from: m.from, to: m.to, code: m.snippet })),
      equivalents: ms.filter((m) => m.status === 'equivalent').sort((a, b) => a.line - b.line).map((m) => ({ line: m.line, op: m.op, from: m.from, to: m.to, reason: m.reason })),
    };
  }
  rep.total = { killed: tk, survived: ts, score: tk + ts ? +((tk / (tk + ts)) * 100).toFixed(1) : 100 };
  console.log(`\nTOTAL ${tk} killed, ${ts} survived, score ${rep.total.score}%  (${rep.seconds} s)`);
  if (!sample && !filters.length) fs.writeFileSync(REPORT, JSON.stringify(rep, null, 2) + '\n');
  else fs.writeFileSync(path.join(os.tmpdir(), 'mutation-report-partial.json'), JSON.stringify(rep, null, 2) + '\n');
  for (const p of plan) {
    const s = rep.files[p.target.file].survivors;
    if (!s.length) continue;
    console.log(`\nSURVIVORS ${p.target.file} (${s.length}):`);
    for (const m of s) console.log(`  ${m.line}:${m.col}  [${m.op}] ${m.from} -> ${m.to || '(removed)'}   | ${m.code}`);
  }
  process.exit(ts ? 1 : 0);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(2); });
module.exports = { mutantsOf };
