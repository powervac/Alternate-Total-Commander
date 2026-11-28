'use strict';
// Find Files (Alt+F7) opens a window of its own (find.html + search.js): like in Total Commander it can be taken out of the main window and put anywhere
// on the screen. This file is the main window's side: it gives the window its context and carries out what the window asks for.
// Uses helpers from app.js (A, panels, P, store, needLocal) and fileindex.js (indexUsable).

function openSearch() {
  const p = A();
  if (p.rem) return openServerSearch(p); // a server: the same window searches the database of its files
  if (needLocal('Find Files', p)) return;
  const dirs = [0, 1].map((i) => { const x = panels[i]; return x && !x.arc && !x.rem ? x.realDir() : ''; });
  const selected = p.sel && p.sel.size > 0 && !p.arc && !p.rem && !p.list ? p.targets().map((i) => P.join(p.dir, i.name)) : [];
  api.findOpen({ dir: p.realDir(), dirs, selected, panelIdx: p.idx, indexUsable: typeof indexUsable === 'function' && indexUsable() });
}

function openServerSearch(p) {
  api.findOpen({ server: { id: p.rem.id, name: p.rem.name, type: p.rem.type }, dir: p.rem.path || '/', dirs: [], selected: [], panelIdx: p.idx, indexUsable: false });
}

/** a panel-like object over a list of found files: the viewer / editor take the next / previous file from it */
function findFakePanel(list, at) {
  const items = list.map((x) => ({ srv: x.srv || null, name: x.srv ? x.label : P.join(x.dir, x.name), isDir: false, size: x.size || 0, mtime: x.mtime || 0, arc: x.arc || null, entry: x.arc ? x.name : null }));
  let i = at;
  return { dir: '', arc: null, rem: null, list: { label: 'Search result' }, view: items, cur: () => items[i], setCursor: (k) => { i = k; }, focus: () => {}, refresh: () => {} };
}

api.onFindAction(async (a) => {
  if (!a) return;
  const p = panels[a.panelIdx || 0] || A();
  if (a.type === 'goto' && a.r) {
    p.focus();
    if (a.r.srv) {
      if (!(await p.loadRem(a.r.srv.conn, a.r.dir))) return;
      const at = p.view.findIndex((i) => i.name === a.r.name);
      if (at >= 0) p.setCursor(at);
      else msg('Find Files', 'The file is not there any more: update the database.');
    } else if (a.r.arc) p.loadArc(a.r.arc.file, a.r.arc.inner, { focusName: a.r.name });
    else p.load(a.r.dir, { focusName: a.r.name });
  } else if (a.type === 'feed' && a.list) {
    p.loadList(a.list.filter((x) => x), a.label || 'Search result');
  } else if ((a.type === 'view' || a.type === 'edit') && a.list && a.list.length) {
    const fake = findFakePanel(a.list, a.index || 0);
    if (a.type === 'edit') openEditor(fake, true); else openViewer(fake, true);
  }
});
