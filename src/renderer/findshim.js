'use strict';
// Find Files as a window of its own (find.html): the helpers that search.js expects from the main page (app.js), in a small form.
// The panels of the main window are represented by what was true when this window was opened (the context from the main window).

window.FIND_WINDOW = true;
const isMac = api.platform === 'darwin';
const P = api.path;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtNum = (n) => Math.floor(n).toLocaleString('en-US');
const pad = (n) => String(n).padStart(2, '0');
function fmtDate(ms) {
  const d = new Date(ms);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// the same storage as the main window (one origin): the settings of the search are shared
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ }
    // the keys that the settings sync carries get their change time, as in the main window
    if (['search2', 'searchTemplates', 'searchHistory'].includes(k)) {
      try { const m = JSON.parse(localStorage.getItem('syncMeta') || '{}'); m[k] = Date.now(); localStorage.setItem('syncMeta', JSON.stringify(m)); } catch { /* ignore */ }
    }
  },
};

let FIND_CTX = { dir: '', dirs: [], selected: [], panelIdx: 0, indexUsable: false };
const modalCount = 0;
const needLocal = () => false;
const indexUsable = () => !!FIND_CTX.indexUsable;
/** the search dialog fills the whole window */
function openModal(box) {
  document.getElementById('find-root').appendChild(box);
  return () => window.close();
}
/** the panels of the main window as they were when the search was opened */
const panels = [0, 1].map((i) => ({ idx: i, dir: '', arc: null, rem: null, sel: new Set(), realDir: () => (FIND_CTX.dirs[i] || FIND_CTX.dir || ''), targets: () => [] }));
function A() {
  const sel = FIND_CTX.selected || [];
  return { idx: FIND_CTX.panelIdx || 0, dir: '', arc: null, rem: null, sel: new Set(sel), realDir: () => FIND_CTX.dir, targets: () => sel.map((n) => ({ name: n })) };
}
