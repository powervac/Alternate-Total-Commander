'use strict';
// A long press of the right mouse button on a file (a short one still marks it, like in Total Commander) opens the context menu of the file:
//  - Windows: the menu of Explorer itself (Open with, Send to, Scan with Defender, Share ... whatever the installed programs add), shown by a helper of the main process;
//  - macOS and Linux: the system has no call for its menu, so this program shows its own with the same kind of items.
// Uses helpers from app.js (panels, active, api, P, isMac, modalCount, copyMove, deleteSel, packSel, copyNames, openViewer, openEditor, ftProperties).

const FM_HOLD_MS = 450;
let fmTimer = null;
let fmMenu = null;

function fmClose() {
  if (!fmMenu) return;
  fmMenu.remove();
  fmMenu = null;
  document.removeEventListener('mousedown', fmOutside, true);
  document.removeEventListener('keydown', fmKey, true);
  window.removeEventListener('blur', fmClose);
}
function fmOutside(e) { if (fmMenu && !fmMenu.contains(e.target)) { fmClose(); } }
function fmKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fmClose(); } }

/** the files the menu is about: the marked ones, else the one under the cursor; local files only (the others have no path on this computer) */
function fmLocalFiles(p) {
  if (p.arc || p.rem || p.list) return [];
  return p.targets().filter((i) => !i.up).map((i) => P.join(p.dir, i.name));
}

function showFileMenu(p, x, y) {
  fmClose();
  const items = p.targets();
  if (!items.length) return;
  const one = items.length === 1 ? items[0] : null;
  const local = !(p.arc || p.rem || p.list);
  const trash = api.platform === 'win32' ? 'Delete' : isMac ? 'Move to Bin' : 'Move to Trash';
  const rows = [];
  const add = (label, hint, run, on = true) => rows.push({ label, hint, run, on });
  const sep = () => rows.push({ sep: true });
  add(one && one.isDir ? 'Open' : 'Open', 'Enter', () => p.enter(), !!one);
  if (one && !one.isDir) { add('View', 'F3', () => openViewer()); add('Edit', 'F4', () => openEditor()); }
  if (local) add(isMac ? 'Show in Enclosing Folder' : 'Show in Folder', '', () => api.reveal(P.join(p.dir, (one || items[0]).name)));
  sep();
  add('Copy to...', 'F5', () => copyMove('copy'));
  add('Move to...', 'F6', () => copyMove('move'));
  sep();
  add('Rename...', 'F2', () => copyMove('move', { renameOnly: true }), !!one);
  add(isMac ? 'Compress...' : 'Compress...', 'Alt+F5', () => packSel());
  add('Copy path', '', () => copyNames(true));
  add(trash, 'F8', () => deleteSel(false));
  sep();
  add(isMac ? 'Get Info' : 'Properties', 'Alt+Enter', () => ftProperties());

  const el = document.createElement('div');
  el.className = 'fmenu';
  for (const r of rows) {
    if (r.sep) { const s = document.createElement('div'); s.className = 'fm-sep'; el.appendChild(s); continue; }
    const d = document.createElement('div');
    d.className = 'fm-item' + (r.on ? '' : ' off');
    d.innerHTML = `<span>${esc(r.label)}</span><i>${esc(r.hint)}</i>`;
    if (r.on) d.onclick = () => { fmClose(); setTimeout(r.run, 0); };
    el.appendChild(d);
  }
  document.body.appendChild(el);
  fmMenu = el;
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = Math.max(2, Math.min(x, innerWidth - w - 2)) + 'px';
  el.style.top = Math.max(2, Math.min(y, innerHeight - h - 2)) + 'px';
  setTimeout(() => {
    document.addEventListener('mousedown', fmOutside, true);
    document.addEventListener('keydown', fmKey, true);
    window.addEventListener('blur', fmClose);
  }, 0);
}

async function fmShow(p, e) {
  if (modalCount > 0) return;
  const files = fmLocalFiles(p);
  if (api.platform === 'win32' && files.length) {
    const r = await api.shellMenu({ files, x: e.screenX, y: e.screenY });
    if (r && r.error && typeof devLog === 'function') devLog('shellmenu', r.error);
    if (r && r.error) { showFileMenu(p, e.clientX, e.clientY); return; } // the Explorer menu could not be shown: the built-in one
    if (p.rem || p.arc) return;
    setTimeout(() => { try { panels.forEach((q) => { if (!q.arc && !q.rem && !q.list) q.refresh(); }); } catch { /* ignore */ } }, 200); // a command of the menu (Delete, Cut ...) may have changed the folder
    return;
  }
  showFileMenu(p, e.clientX, e.clientY);
}

document.addEventListener('mousedown', (e) => {
  clearTimeout(fmTimer);
  if (e.button !== 2) return;
  const list = e.target.closest && e.target.closest('.list');
  const row = e.target.closest && e.target.closest('.row');
  if (!list || !row) return;
  const p = panels.find((q) => q.$list === list);
  if (!p) return;
  const ev = { screenX: e.screenX, screenY: e.screenY, clientX: e.clientX, clientY: e.clientY };
  fmTimer = setTimeout(() => { fmTimer = null; fmShow(p, ev); }, FM_HOLD_MS);
}, true);
document.addEventListener('mouseup', (e) => { if (e.button === 2) clearTimeout(fmTimer); }, true);
document.addEventListener('dragstart', () => clearTimeout(fmTimer), true);
