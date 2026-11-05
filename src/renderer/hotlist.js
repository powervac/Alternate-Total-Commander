'use strict';
// Ctrl+D "Directory Hotlist": favourite folders in a popup menu.
// Uses helpers from app.js (A, P, esc, store, dialog, openModal, modalCount, msg).

const hotlistLoad = () => {
  const v = store.get('hotlist', []);
  return Array.isArray(v) ? v.filter((h) => h && typeof h.path === 'string') : [];
};
const hotlistSave = (l) => store.set('hotlist', l);
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

  function render() {
    box.innerHTML =
      (list.length
        ? list
            .map(
              (h, i) =>
                `<div class="it${i === cur ? ' on' : ''}" data-i="${i}"><span class="hk">${i < 9 ? i + 1 : ''}</span>` +
                `<span class="nm">${esc(h.name)}</span><span class="pth">${esc(h.path)}</span></div>`
            )
            .join('')
        : '<div class="empty">No folders yet. Press Insert to add the current folder.</div>') +
      '<div class="hint">Enter: go &nbsp; Ins: add current folder &nbsp; Del: remove &nbsp; F2: rename &nbsp; Esc: close</div>';
    const on = box.querySelector('.it.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
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
    else if (k === 'Insert') {
      const path = panel.realDir();
      const i = list.findIndex((h) => hotSame(h.path, path));
      if (i >= 0) cur = i;
      else {
        list.push({ name: P.basename(path) || path, path });
        hotlistSave(list);
        cur = list.length - 1;
      }
      render();
    } else if (k === 'Delete') {
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
    if (it) { e.preventDefault(); go(+it.dataset.i); }
  });

  modalCount++;
  document.body.appendChild(box);
  render();
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', onOutside, true);
}
