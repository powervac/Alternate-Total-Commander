'use strict';
// Main-process side of the file name index: owns the worker thread (fileindex-worker.js), keeps its last status and forwards progress to the window.
// Options come from the renderer ({ on, roots[], exclude[], auto: 'start'|'daily'|'manual', gentle }), the index itself lives in userData/file-index/index.gz.
const path = require('path');
const { Worker } = require('worker_threads');

const WIN = process.platform === 'win32';
const norm = (p) => { const q = String(p).split('\\').join('/').replace(/\/+$/, ''); return WIN ? q.toLowerCase() : q; };

let worker = null;
let dataFile = '';
let last = { roots: [], total: 0, building: false };
let progress = null; // last progress message while building
let notify = () => {}; // (channel, payload) -> window
const searches = new Map(); // id -> { emit, resolve }
let loadedWaiters = [];

function start(userData, send) {
  if (send) notify = send;
  if (worker) return;
  dataFile = path.join(userData, 'file-index', 'index.gz');
  worker = new Worker(path.join(__dirname, 'fileindex-worker.js'));
  worker.on('message', (m) => {
    if (m.type === 'status' || m.type === 'built') {
      last = { roots: m.roots, total: m.total, building: m.building };
      if (m.type === 'built') progress = null;
      notify('index:state', { ...last, progress, stopped: m.stopped, ms: m.ms, built: m.type === 'built' });
      const w = loadedWaiters; loadedWaiters = []; w.forEach((r) => r());
    } else if (m.type === 'progress') {
      progress = m;
      notify('index:state', { ...last, building: true, progress });
    } else if (m.type === 'batch') {
      const s = searches.get(m.id);
      if (s) s.emit(m.items);
    } else if (m.type === 'result') {
      const s = searches.get(m.id);
      searches.delete(m.id);
      if (s) s.resolve(m);
    } else if (m.type === 'error') notify('index:state', { ...last, error: m.error });
  });
  worker.on('error', (e) => notify('index:state', { ...last, error: e.message }));
  worker.on('exit', () => { worker = null; for (const s of searches.values()) s.resolve({ count: 0, cancelled: true, ms: 0 }); searches.clear(); });
  worker.postMessage({ cmd: 'load', file: dataFile });
}

function stopWorker() {
  if (worker) { worker.postMessage({ cmd: 'stop' }); const w = worker; setTimeout(() => w.terminate(), 400); worker = null; }
  last = { ...last, building: false };
  progress = null;
}

const ready = () => new Promise((r) => { if (last.roots.length || !worker) return r(); loadedWaiters.push(r); setTimeout(r, 15000); });

async function init(userData, send, cfg) {
  start(userData, send);
  await ready();
  const old = last.roots.length ? Math.min(...last.roots.map((r) => r.built || 0)) : 0;
  const missing = cfg.roots.some((r) => !last.roots.find((x) => norm(x.root) === norm(r)));
  const age = Date.now() - old;
  if (cfg.roots.length && !last.building && (missing || cfg.auto === 'start' || (cfg.auto === 'daily' && age > 20 * 3600 * 1000))) build(cfg);
  return last;
}

function build(cfg) {
  if (!worker || !cfg.roots.length) return;
  last = { ...last, building: true };
  worker.postMessage({ cmd: 'build', roots: cfg.roots, exclude: cfg.exclude || [], gentle: cfg.gentle !== false });
}

const stop = () => worker && worker.postMessage({ cmd: 'stop' });
const getStatus = () => ({ ...last, progress });
function clear() { if (worker) worker.postMessage({ cmd: 'clear' }); }

/** can this search be answered from the index? (names, sizes and dates only; every folder inside an indexed root) */
function canServe(p) {
  if (!worker || !last.total) return false;
  if (p.text || p.dups || p.selected || p.archives || (p.depth != null && p.depth >= 0)) return false;
  if (p.attrs && p.attrs.ro != null) return false;
  const roots = (p.roots || []).filter(Boolean);
  if (!roots.length) return false;
  const idx = last.roots.map((r) => norm(r.root));
  return roots.every((r) => { const d = norm(r); return idx.some((i) => d === i || d.startsWith(i + '/')); });
}

/** -> Promise<{ count, cancelled, ms }>; emit(items) per batch */
function search(id, params, emit) {
  return new Promise((resolve) => {
    searches.set(id, { emit, resolve });
    worker.postMessage({ cmd: 'search', id, params });
  });
}
const cancel = (id) => worker && worker.postMessage({ cmd: 'cancel', id });

module.exports = { init, start, build, stop, stopWorker, getStatus, clear, canServe, search, cancel };
