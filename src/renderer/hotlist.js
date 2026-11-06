'use strict';
// Ctrl+D "Directory Hotlist": favourite folders in a popup menu.
// Uses helpers from app.js (A, P, esc, store, dialog, openModal, modalCount, msg).

// every system has its own list: the paths of Windows do not exist on Ubuntu or macOS (Windows keeps the old key 'hotlist')
const hotlistKey = () => (api.platform === 'win32' ? 'hotlist' : 'hotlist_' + api.platform);
const hotlistLoad = () => {
  const v = store.get(hotlistKey(), []);
  return Array.isArray(v) ? v.filter((h) => h && typeof h.path === 'string') : [];
};
const hotlistSave = (l) => store.set(hotlistKey(), l);
const hotSame = (a, b) => (isMac || api.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

function openHotlist(sel = 0) {
  if (modalCount > 0) return;
  const panel = A();
  let list = hotlistLoad();
  let cur = Math.max(0, Math.min(sel, list.length - 1));

  const box = document.createElement('div');
  box.className = 'hotmenu';
  const r = panel.$path.getBoundingClientRect();
  box.style.left = Math.max(4, r.left) + 'px';
  box.style.top = r.bottom + 'px';

  let edit = false; // "Configure": show the paths and the editing keys
  function render() {
    box.innerHTML =
      (list.length
        ? list
            .map(
              (h, i) =>
                `<div class="it${i === cur ? ' on' : ''}" data-i="${i}" title="${esc(h.path)}"><span class="hk">${i < 9 ? i + 1 : ''}</span>` +
                `<span class="nm">${esc(h.name)}</span>${h.conn ? `<span class="pth">${esc(h.conn.name)}</span>` : ''}${edit ? `<span class="pth">${esc(h.path)}</span>` : ''}</div>`
            )
            .join('')
        : '<div class="empty">No favourite folders yet.</div>') +
      '<div class="sep"></div>' +
      '<div class="it act" data-act="add"><span class="hk">+</span><span class="nm2">Add current dir</span></div>' +
      '<div class="it act" data-act="cfg"><span class="hk">*</span><span class="nm2">Configure...</span></div>' +
      (edit
        ? '<div class="it act" data-act="tc"><span class="hk"></span><span class="nm2">Import from Total Commander</span></div>' +
          '<div class="hint">Enter: go &nbsp; Ins: add current folder &nbsp; Del: remove &nbsp; F2: rename &nbsp; Esc: close</div>'
        : '');
    const on = box.querySelector('.it.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }

  /** a favourite on a remote disk (Dropbox, Google Drive, NAS, SSH) remembers which saved connection it belongs to */
  const sameEntry = (h, e) => (h.conn || e.conn ? !!h.conn && !!e.conn && h.conn.id === e.conn.id && h.path === e.path : hotSame(h.path, e.path));
  function addCurrent() {
    let entry;
    if (panel.rem) {
      const r = panel.rem;
      const base = r.path === '/' ? '' : r.path.split('/').filter(Boolean).pop() || '';
      entry = { name: `${r.name}${base ? ': ' + base : ''}`, path: r.path, conn: { id: r.id, type: r.type, name: r.name } };
    } else if (panel.arc) return msg('Directory Hotlist', 'A folder inside an archive cannot be added.');
    else { const path = panel.realDir(); entry = { name: P.basename(path) || path, path }; }
    const i = list.findIndex((h) => sameEntry(h, entry));
    if (i >= 0) cur = i;
    else {
      list.push(entry);
      hotlistSave(list);
      cur = list.length - 1;
    }
    render();
  }

  /** favourites of Total Commander (wincmd.ini [DirMenu]); only entries that are not in the list yet are added */
  async function importTC(quiet) {
    const r = await api.hotlistImportTC();
    const fresh = (r.items || []).filter((x) => !list.some((h) => !h.conn && hotSame(h.path, x.path)));
    list.push(...fresh);
    if (fresh.length) hotlistSave(list);
    render();
    if (!quiet && !fresh.length) await msg('Directory Hotlist', r.file ? 'Nothing new to import from Total Commander.' : 'The Total Commander configuration (wincmd.ini) was not found.');
    return fresh.length;
  }

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onOutside, true);
    box.remove();
    modalCount--;
  };

  async function go(i) {
    const h = list[i];
    if (!h) return;
    close();
    panel.focus();
    if (h.conn) {
      // remote favourite: straight into the open connection, or open the saved connection and land in this folder after it is connected
      const live = liveConns.get(h.conn.id);
      if (live && (await panel.loadRem({ id: live.id, name: live.name, type: live.type }, h.path))) return;
      nasPendingPath = { id: h.conn.id, path: h.path };
      await openConnections(h.conn.id, h.conn.type);
      return;
    }
    const st = await api.stat(h.path);
    if (!st.exists || !st.isDir) {
      await msg('Directory Hotlist', `Folder not found:\n${h.path}`);
      return;
    }
    await panel.load(h.path);
  }

  async function rename() {
    const h = list[cur];
    if (!h) return;
    close();
    const r2 = await dialog({
      title: 'Rename entry',
      text: `Name for ${h.path}:`,
      input: h.name,
      buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }],
    });
    const nn = r2.input && r2.input.trim();
    if (r2.value === 'ok' && nn) {
      h.name = nn;
      hotlistSave(list);
    }
    openHotlist(list.indexOf(h));
  }

  const onOutside = (e) => { if (!box.contains(e.target)) close(); };
  const onKey = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const k = e.key;
    if (k === 'Escape') close();
    else if (k === 'Enter') go(cur);
    else if (k === 'ArrowDown') { cur = Math.min(list.length - 1, cur + 1); render(); }
    else if (k === 'ArrowUp') { cur = Math.max(0, cur - 1); render(); }
    else if (k === 'Home') { cur = 0; render(); }
    else if (k === 'End') { cur = Math.max(0, list.length - 1); render(); }
    else if (k === 'Insert' || k === '+') addCurrent();
    else if (k === '*') { edit = !edit; render(); }
    else if (k === 'Delete') {
      if (!list.length) return;
      list.splice(cur, 1);
      hotlistSave(list);
      cur = Math.max(0, Math.min(cur, list.length - 1));
      render();
    } else if (k === 'F2') rename();
    else if (/^[1-9]$/.test(k) && +k <= list.length) go(+k - 1);
  };

  box.addEventListener('mousedown', (e) => {
    const it = e.target.closest('.it');
    if (!it) return;
    e.preventDefault();
    const act = it.dataset.act;
    if (act === 'add') addCurrent();
    else if (act === 'cfg') { edit = !edit; render(); }
    else if (act === 'tc') importTC(false);
    else go(+it.dataset.i);
  });

  modalCount++;
  document.body.appendChild(box);
  render();
  // first use: bring the favourites over from Total Commander if there is a configuration (once)
  if (!list.length && !store.get('hotlistTcDone' + (api.platform === 'win32' ? '' : '_' + api.platform), false)) {
    store.set('hotlistTcDone' + (api.platform === 'win32' ? '' : '_' + api.platform), true);
    importTC(true);
  }
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', onOutside, true);
}
