'use strict';
// The drive / favorites bar: a row of buttons above each panel (Show > Drive / Favorites Bar, off until it is switched on).
// It holds the disks, "up", "home" and the user's own folders with a short label (2-3 letters are enough: UD, NM ...), a description and a path
// that may use ~, $HOME, ${NAME} or %NAME%. The tooltip shows the description and the path; the right mouse button adds, edits, removes and
// moves a favorite. The same favorites are listed in the drive list (Alt+F1 / Alt+F2). Every system has its own list, as the Ctrl+D hotlist does.
// Uses helpers from app.js (panels, drives, driveFor, switchDrive, driveIcon, store, api, esc, P, msg, modalCount), filetools.js (ftForm), hotlist.js (favGo, hotSame).

const FAV_TITLE = 'Favorites';
const favKey = () => (api.platform === 'win32' ? 'favbar' : 'favbar_' + api.platform);
const favLoad = () => {
  const v = store.get(favKey(), []);
  return Array.isArray(v) ? v.filter((f) => f && typeof f.path === 'string' && typeof f.label === 'string') : [];
};
const favSave = (l) => { store.set(favKey(), l); favRenderAll(); };
const favOn = () => !!store.get('favbarOn', false);

/** a short label made of the folder name: "My Documents" -> "MD", "downloads" -> "DOW" */
function favAutoLabel(name) {
  const words = String(name).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!words.length) return '?';
  return (words.length > 1 ? words.map((w) => w[0]).join('') : words[0]).slice(0, 3).toUpperCase();
}

function favToggle() {
  store.set('favbarOn', !favOn());
  favRenderAll();
}
function favRenderAll() { if (typeof panels !== 'undefined') panels.forEach(favRender); }

function favRender(p) {
  const bar = p.el.querySelector('.favbar');
  if (!bar) return;
  bar.hidden = !favOn();
  if (bar.hidden) { bar.innerHTML = ''; bar.dataset.sig = ''; return; }
  const cur = p.rem || p.list || p.arc ? null : driveFor(p.dir);
  const list = favLoad();
  const same = (f) => (f.conn ? !!p.rem && p.rem.id === f.conn.id && p.rem.path === f.path : !p.rem && !p.arc && !p.list && !!f.full && hotSame(f.full, p.dir));
  const html =
    drives.map((d, i) => `<button class="fb-drive${d === cur ? ' on' : ''}${d.off ? ' off' : ''}" data-drive="${i}" tabindex="-1" title="${esc([d.vol || '', d.net || '', d.path].filter(Boolean).join('\n'))}">${api.platform === 'win32' ? driveIcon(d) : ''}${esc(d.label)}</button>`).join('') +
    `<button data-go="up" tabindex="-1" title="Up one level">..</button>` +
    (api.platform === 'win32' ? '<button data-go="home" tabindex="-1" title="Home folder">~</button>' : '') + // (elsewhere "~" is one of the disks already)
    (list.length ? '<span class="fb-sep"></span>' : '') +
    list.map((f, i) => `<button class="fb-fav${same(f) ? ' on' : ''}" data-fav="${i}" tabindex="-1" title="${esc((f.name ? f.name + '\n' : '') + (f.conn ? f.conn.name + ': ' : '') + f.path)}">${esc(f.label)}</button>`).join('') +
    '<button class="fb-add" data-go="add" tabindex="-1" title="Add the current folder to the favorites">+</button>';
  if (bar.dataset.sig !== html) { bar.innerHTML = html; bar.dataset.sig = html; } // unchanged: the buttons stay (a tooltip is not torn away)
}

/** a path of the user -> the real one on this computer (~, $HOME, ${NAME}, %NAME%) */
const favExpand = async (path) => (await api.expandPath(path)) || path;

async function favOpen(p, f) {
  p.focus();
  if (f.conn) return favGo(p, f, FAV_TITLE);
  const full = await favExpand(f.path);
  await favGo(p, { ...f, path: full }, FAV_TITLE);
  // remember what the path stands for, so that the button of the folder that is open is marked
  if (f.full !== full) {
    const list = favLoad();
    const i = list.findIndex((x) => x.label === f.label && x.path === f.path);
    if (i >= 0) { list[i].full = full; favSave(list); }
  } else favRender(p);
}

/** the folder that is open in a panel as a new favorite (null when it cannot be one) */
function favFromPanel(p) {
  if (p.arc || p.list) return null;
  if (p.rem) {
    const r = p.rem;
    const base = r.path === '/' ? r.name : r.path.split('/').filter(Boolean).pop() || r.name;
    return { label: favAutoLabel(base), name: `${r.name}: ${base}`, path: r.path, conn: { id: r.id, type: r.type, name: r.name } };
  }
  const dir = p.realDir();
  const base = P.basename(dir) || dir;
  return { label: favAutoLabel(base), name: base, path: dir, full: dir };
}

/** the editor of one favorite; index < 0: a new one */
async function favEdit(p, index) {
  if (modalCount > 0) return;
  const list = favLoad();
  const old = index >= 0 ? list[index] : favFromPanel(p) || { label: '', name: '', path: '' };
  if (!old) return;
  const win = api.platform === 'win32';
  const box = await ftForm(index >= 0 ? 'Edit favorite' : 'Add favorite',
    `<div class="nas-row"><label>Button label:</label><input type="text" class="fv-label" maxlength="12" value="${esc(old.label)}" placeholder="UD"></div>` +
    `<div class="nas-row"><label>Description:</label><input type="text" class="fv-name" value="${esc(old.name || '')}"></div>` +
    `<div class="nas-row"><label>Folder:</label><input type="text" class="fv-path" value="${esc(old.path)}"${old.conn ? ' readonly' : ''}></div>` +
    `<div class="dlg-text s-hint">${old.conn ? esc('A folder of ' + old.conn.name) : esc(win ? 'The path may use ~ and %NAME% (for example %USERPROFILE%\\Documents); a network folder is \\\\server\\share.' : 'The path may use ~, $HOME and ${NAME}, for example $HOME/Documents.')}</div>`);
  if (!box) return;
  const label = box.querySelector('.fv-label').value.trim();
  const name = box.querySelector('.fv-name').value.trim();
  const path = box.querySelector('.fv-path').value.trim();
  if (!path) return msg(FAV_TITLE, 'The folder is empty: nothing was saved.');
  const entry = { label: label || favAutoLabel(name || P.basename(path) || path), name, path };
  if (old.conn) entry.conn = old.conn;
  else entry.full = await favExpand(path);
  const next = favLoad();
  if (index >= 0 && index < next.length) next[index] = entry;
  else next.push(entry);
  favSave(next);
  if (!favOn()) favToggle();
}

function favRemove(index) {
  const l = favLoad();
  l.splice(index, 1);
  favSave(l);
}
function favMove(index, by) {
  const l = favLoad();
  const j = index + by;
  if (j < 0 || j >= l.length) return;
  [l[index], l[j]] = [l[j], l[index]];
  favSave(l);
}

/** the menu of the right mouse button; index < 0: on a disk or on the empty part of the bar */
function favMenu(p, index, x, y) {
  const rows = [['Add favorite...', () => favEdit(p, -1)]];
  if (index >= 0) {
    const n = favLoad().length;
    rows.push(['Edit favorite...', () => favEdit(p, index)], ['Remove favorite', () => favRemove(index)], null,
      ['Move left', () => favMove(index, -1), index > 0], ['Move right', () => favMove(index, 1), index < n - 1]);
  }
  rows.push(null, ['Hide this bar', () => favToggle()]);
  fmPopup(rows.map((r) => (r ? { label: r[0], hint: '', run: r[1], on: r[2] !== false } : { sep: true })), x, y);
}

document.addEventListener('mousedown', (e) => {
  const bar = e.target.closest && e.target.closest('.favbar');
  if (!bar) return;
  e.preventDefault(); // the keyboard focus stays in the file list
}, true);
document.addEventListener('click', async (e) => {
  const bar = e.target.closest && e.target.closest('.favbar');
  const b = bar && e.target.closest('button');
  if (!b || modalCount > 0) return;
  const p = panels.find((q) => q.el.contains(bar));
  if (!p) return;
  if (b.dataset.drive !== undefined) { const d = drives[+b.dataset.drive]; if (d) switchDrive(p, d); }
  else if (b.dataset.fav !== undefined) { const f = favLoad()[+b.dataset.fav]; if (f) favOpen(p, f); }
  else if (b.dataset.go === 'up') { p.focus(); p.goUp(); }
  else if (b.dataset.go === 'home') { p.focus(); p.load(api.home); }
  else if (b.dataset.go === 'add') { p.focus(); favEdit(p, -1); }
});
document.addEventListener('contextmenu', (e) => {
  const bar = e.target.closest && e.target.closest('.favbar');
  if (!bar || modalCount > 0) return;
  e.preventDefault();
  const p = panels.find((q) => q.el.contains(bar));
  if (!p) return;
  const b = e.target.closest('button');
  favMenu(p, b && b.dataset.fav !== undefined ? +b.dataset.fav : -1, e.clientX, e.clientY);
});
setTimeout(favRenderAll, 800); // after the panels and the list of disks are there
