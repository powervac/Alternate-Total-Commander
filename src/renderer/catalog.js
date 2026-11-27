'use strict';
// Net > Server File Database... (also Alt+F7 on a panel with a server): the database of the files of the server in the active panel -
// build or update it once, then search it at once, without asking the server again. The work is done in main/remotecatalog.js.
// Uses helpers from app.js (A, P, esc, store, dialog, msg, openModal, modalCount, fmtDate, fmtNum, remJoin).

const catParent = (p) => { const i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); };

async function openCatalog() {
  if (modalCount > 0) return;
  const panel = A();
  if (!panel.rem) {
    return msg('Server File Database', 'Open a server in the active panel first: a Synology NAS, SSH, FTP, WebDAV, Dropbox or Google Drive.\nDisks of this computer, also network drives with a letter, are indexed in Configuration > File index.');
  }
  const conn = { id: panel.rem.id, name: panel.rem.name, type: panel.rem.type };
  const here = panel.rem.path || '/';
  const box = document.createElement('div');
  box.className = 'dlg cat';
  box.innerHTML =
    `<div class="dlg-title">Server File Database</div><div class="dlg-body">` +
    `<div class="cat-name">${esc(conn.name)}</div><div class="cat-state">&nbsp;</div>` +
    `<div class="cat-line"><label>Folder to scan:</label><input class="cat-root" spellcheck="false" value="${esc(here)}"><button class="cat-build" type="button">Scan now</button><button class="cat-stop" type="button" disabled>Stop</button><button class="cat-del" type="button" disabled>Delete the database</button></div>` +
    '<div class="cat-line"><label>Search for:</label><input class="cat-mask" spellcheck="false" placeholder="*.jpg;*.heic   or a part of the name"><button class="cat-find primary" type="button" disabled>Search</button></div>' +
    '<div class="cat-list" tabindex="0"></div><div class="cat-count">&nbsp;</div>' +
    '</div><div class="dlg-btns"><button class="cat-go" disabled>Go to file</button><button class="cat-close">Close</button></div>';
  const q = (s) => box.querySelector(s);
  const $state = q('.cat-state'), $list = q('.cat-list'), $count = q('.cat-count'), $mask = q('.cat-mask'), $root = q('.cat-root');
  let info = null;
  let building = null; // the id of the running scan
  let items = [];
  let sel = -1;
  let closed = false;
  const close = openModal(box);
  const finish = () => { if (closed) return; closed = true; if (building) api.cancelOp(building); off(); close(); };

  const paint = () => {
    q('.cat-build').disabled = !!building;
    q('.cat-stop').disabled = !building;
    q('.cat-del').disabled = !!building || !info;
    q('.cat-find').disabled = !info;
    q('.cat-build').textContent = info ? 'Update' : 'Scan now';
    if (building) return;
    $state.textContent = info
      ? `In the database: ${fmtNum(info.count)} files and folders from ${info.root}, ${fmtDate(info.built)}${info.partial ? ' (not complete)' : ''}${info.failed ? `, folders that could not be read: ${info.failed}` : ''}`
      : 'There is no database of this server yet: press Scan now. A big server takes a while; it is needed only once.';
  };
  const off = api.onCatalogProgress((p) => {
    if (!closed && p.key === conn.id && building) $state.textContent = `Scanning: ${fmtNum(p.files)} files and folders   ${p.current}`;
  });
  const row = (i) => $list.children[i];
  const mark = (i) => {
    if (row(sel)) row(sel).classList.remove('on');
    sel = Math.max(-1, Math.min(items.length - 1, i));
    if (row(sel)) { row(sel).classList.add('on'); row(sel).scrollIntoView({ block: 'nearest' }); }
    q('.cat-go').disabled = sel < 0;
  };
  const find = async () => {
    if (!info) return;
    const r = await api.catalogSearch({ key: conn.id, mask: $mask.value.trim() });
    if (closed) return;
    if (r.error) { $count.textContent = r.error; return; }
    items = r.items;
    sel = -1;
    $list.innerHTML = items.map((x, i) => `<div class="s-row cat-row" data-i="${i}" title="${esc(remJoin(x.dir, x.name))}"><span class="cat-path">${esc(remJoin(x.dir, x.name))}</span><span class="cat-size">${x.isDir ? '&lt;DIR&gt;' : fmtNum(x.size)}</span><span class="cat-date">${x.mtime ? fmtDate(x.mtime) : ''}</span></div>`).join('');
    $count.textContent = r.total > items.length ? `Found: ${fmtNum(r.total)}, the first ${fmtNum(items.length)} are shown` : `Found: ${fmtNum(r.total)}`;
    mark(items.length ? 0 : -1);
  };
  const go = async () => {
    const x = items[sel];
    if (!x) return;
    finish();
    panel.focus();
    if (!(await panel.loadRem(conn, x.dir))) return;
    const at = panel.view.findIndex((i) => i.name === x.name);
    if (at >= 0) panel.setCursor(at);
    else msg('Server File Database', 'The file is not there any more: update the database.');
  };

  q('.cat-build').onclick = async () => {
    if (building) return;
    building = 'cat-' + Date.now();
    paint();
    $state.textContent = 'Scanning ...';
    const r = await api.catalogBuild({ jobId: building, id: conn.id, key: conn.id, name: conn.name, root: $root.value.trim() || '/' });
    building = null;
    if (closed) return;
    if (r.info !== undefined) info = r.info;
    paint();
    if (r.error) $state.textContent = r.error;
    else if (r.cancelled) $state.textContent = 'Stopped. ' + (info ? 'The database was not changed.' : '');
  };
  q('.cat-stop').onclick = () => { if (building) api.cancelOp(building); };
  q('.cat-del').onclick = async () => {
    await api.catalogDelete({ key: conn.id });
    info = null;
    items = [];
    $list.innerHTML = '';
    $count.textContent = ' ';
    mark(-1);
    paint();
  };
  q('.cat-find').onclick = find;
  q('.cat-go').onclick = go;
  q('.cat-close').onclick = finish;
  $list.addEventListener('mousedown', (e) => { const r = e.target.closest('.cat-row'); if (r) mark(+r.dataset.i); });
  $list.addEventListener('dblclick', (e) => { if (e.target.closest('.cat-row')) go(); });
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    const inList = e.target === $list;
    if (e.key === 'Escape') { e.preventDefault(); finish(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); mark(sel + (e.key === 'ArrowDown' ? 1 : -1)); if (!inList) $list.focus(); }
    else if (e.key === 'Enter' && e.target === $mask) { e.preventDefault(); find(); }
    else if (e.key === 'Enter' && inList) { e.preventDefault(); go(); }
  });

  const r = await api.catalogInfo({ key: conn.id });
  info = r && r.info ? r.info : null;
  paint();
  if (info) $mask.focus();
}
