'use strict';
// The drive / favorites bar: a row of buttons above each panel (Show > Drive / Favorites Bar, off until it is switched on).
// It holds the disks, "up", "home" and the user's own folders with a short label (2-3 letters are enough: UD, NM ...), a description and a path
// that may use ~, $HOME, ${NAME} or %NAME%. The tooltip shows the description and the path; the right mouse button adds, edits, removes and
// moves a favorite. The same favorites are listed in the drive list (Alt+F1 / Alt+F2). Every system has its own list, as the Ctrl+D hotlist does.
// Uses helpers from app.js (panels, drives, driveFor, switchDrive, driveIcon, store, api, esc, P, msg, modalCount), filetools.js (ftForm), hotlist.js (favGo, hotSame).

const FAV_TITLE = 'Favorites';

// the built-in icons (16x16, their own colours, readable in the light and the dark theme); the names are FAV_ICON_NAMES of favini.js
const favSvg = (body) => '<svg class="fv-ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' + body + '</svg>';
const FAV_ICONS = {
  folder: '<path d="M1.5 4h4.5l1.5 1.8h7v7.7h-13z" fill="#f2c14e" stroke="#a87b16"/>',
  home: '<path d="M1.5 8 8 2.2 14.5 8H13v6H9.5v-3.8h-3V14H3V8z" fill="#5aa9e6" stroke="#2470a8"/>',
  documents: '<path d="M3.5 1.5h6l3 3v10h-9z" fill="#f4f6f8" stroke="#5b6b7c"/><path d="M5.5 6.5h5M5.5 9h5M5.5 11.5h3" stroke="#3d7fc4" fill="none"/>',
  downloads: '<path d="M6 2h4v5h3l-5 5-5-5h3z" fill="#4caf6a" stroke="#2c7a45"/><path d="M2.5 14h11" stroke="#2c7a45" stroke-width="1.6" fill="none"/>',
  pictures: '<rect x="1.5" y="2.5" width="13" height="11" rx="1" fill="#bfe2f7" stroke="#3b7ca8"/><path d="M2 12.5 6 8l3 3 2-2 3 3.5z" fill="#4d9e52"/><circle cx="11" cy="5.5" r="1.4" fill="#f5b321"/>',
  music: '<path d="M6 3.5 13.5 2v8" stroke="#8e5bd0" stroke-width="1.7" fill="none"/><path d="M6 3.5V12" stroke="#8e5bd0" stroke-width="1.7" fill="none"/><ellipse cx="4.3" cy="12.2" rx="2.3" ry="1.8" fill="#8e5bd0"/><ellipse cx="11.8" cy="10.4" rx="2.3" ry="1.8" fill="#8e5bd0"/>',
  video: '<rect x="1.5" y="3.5" width="13" height="9" rx="1.5" fill="#e05a5a" stroke="#9c2f2f"/><path d="M6.5 5.8 10.8 8l-4.3 2.2z" fill="#fff"/>',
  desktop: '<rect x="1.5" y="2.5" width="13" height="9" rx="1" fill="#5aa9e6" stroke="#2c5f86"/><path d="M5.5 14h5M8 11.5V14" stroke="#7a8591" stroke-width="1.4" fill="none"/>',
  drive: '<rect x="1.5" y="5" width="13" height="6.5" rx="1.2" fill="#d9dde3" stroke="#6b7480"/><rect x="3" y="8.6" width="6" height="1.4" fill="#7a8591"/><circle cx="12" cy="9.3" r=".9" fill="#3d8bd9"/>',
  usb: '<rect x="4.5" y="6" width="7" height="8.5" rx="1" fill="#4a90d9" stroke="#245a8c"/><rect x="5.8" y="1.5" width="4.4" height="4.5" fill="#d9dde3" stroke="#6b7480"/><path d="M7 3h.8M8.8 3h.8" stroke="#444"/>',
  network: '<circle cx="8" cy="8" r="6.2" fill="#bfe2f7" stroke="#2e7d9e"/><path d="M2 8h12M8 2c-4 4-4 8 0 12 4-4 4-8 0-12" stroke="#2e7d9e" fill="none"/>',
  server: '<rect x="2.5" y="2" width="11" height="5" rx="1" fill="#cdd3da" stroke="#5b6b7c"/><rect x="2.5" y="9" width="11" height="5" rx="1" fill="#cdd3da" stroke="#5b6b7c"/><circle cx="11" cy="4.5" r="1" fill="#2e9e44"/><circle cx="11" cy="11.5" r="1" fill="#2e9e44"/>',
  cloud: '<path d="M4.5 12.5a3 3 0 0 1-.3-6 4 4 0 0 1 7.6-.4 3.2 3.2 0 0 1-.3 6.4z" fill="#a9d3f5" stroke="#3478b0"/>',
  code: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="#34404e" stroke="#7a8a9c"/><path d="M6 6 4 8l2 2M10 6l2 2-2 2" stroke="#7ee08a" stroke-width="1.4" fill="none"/>',
  game: '<rect x="1.5" y="5" width="13" height="7" rx="3.5" fill="#7d6bd6" stroke="#4b3c99"/><path d="M5 7v3M3.5 8.5h3" stroke="#fff" stroke-width="1.2"/><circle cx="10.5" cy="7.8" r=".9" fill="#fff"/><circle cx="12" cy="9.6" r=".9" fill="#fff"/>',
  star: '<path d="m8 1.5 2 4.3 4.6.5-3.4 3.2.9 4.6L8 11.8 3.9 14.1l.9-4.6L1.4 6.3 6 5.8z" fill="#f5c21b" stroke="#a87b00"/>',
  temp: '<circle cx="8" cy="8.5" r="5.8" fill="#f4f6f8" stroke="#d9822b" stroke-width="1.4"/><path d="M8 5v3.5l2.6 1.6" stroke="#d9822b" stroke-width="1.5" fill="none"/>',
  trash: '<path d="M4 5h8l-.8 9.5H4.8z" fill="#b8c0c9" stroke="#56616d"/><path d="M2.5 4.5h11M6 4.5V2.5h4v2M6.5 7v5M9.5 7v5" stroke="#56616d" fill="none"/>',
};

/** the HTML of an icon of a favorite ('' when it has none); only what favIconOk lets through is drawn */
function favIconHtml(icon) {
  const ok = favIconOk(icon);
  if (!ok) return '';
  return FAV_ICONS[ok] ? favSvg(FAV_ICONS[ok]) : `<img class="fv-ic" src="${ok}" alt="" width="16" height="16">`;
}

/** an own picture file (PNG, SVG, ICO, JPG ...: for example one of the icon theme in /usr/share/icons) -> a 32x32 PNG kept with the favorite */
async function favPicture(file) {
  const r = await api.viewRead({ file, max: 4 * 1024 * 1024 });
  if (r.error) throw new Error(r.error);
  if (r.size > 4 * 1024 * 1024) throw new Error('The picture is larger than 4 MB');
  const type = /\.svg$/i.test(file) ? 'image/svg+xml' : /\.ico$/i.test(file) ? 'image/x-icon' : '';
  const url = URL.createObjectURL(new Blob([r.data], type ? { type } : undefined));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('This file is not a picture that can be shown')); img.src = url; });
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const w = img.naturalWidth || 32, h = img.naturalHeight || 32, k = Math.min(32 / w, 32 / h);
    c.getContext('2d').drawImage(img, (32 - w * k) / 2, (32 - h * k) / 2, w * k, h * k);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
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
    list.map((f, i) => `<button class="fb-fav${same(f) ? ' on' : ''}" data-fav="${i}" tabindex="-1" title="${esc((f.name ? f.name + '\n' : '') + (f.conn ? f.conn.name + ': ' : '') + f.path)}">${favIconHtml(f.icon)}${f.label ? `<span>${esc(f.label)}</span>` : favIconHtml(f.icon) ? '' : '?'}</button>`).join('') +
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
  let icon = favIconOk(old.icon);
  const box = await ftForm(index >= 0 ? 'Edit favorite' : 'Add favorite',
    `<div class="nas-row"><label>Button label:</label><input type="text" class="fv-label" maxlength="12" value="${esc(old.label)}" placeholder="UD"></div>` +
    `<div class="nas-row"><label>Description:</label><input type="text" class="fv-name" value="${esc(old.name || '')}"></div>` +
    `<div class="nas-row"><label>Folder:</label><input type="text" class="fv-path" value="${esc(old.path)}"${old.conn ? ' readonly' : ''}></div>` +
    '<div class="nas-row fv-icons-row"><label>Icon:</label><div class="fv-icons">' +
    '<button type="button" class="fv-pick" data-icon="" title="No icon">\u2013</button>' +
    FAV_ICON_NAMES.map((n) => `<button type="button" class="fv-pick" data-icon="${n}" title="${n}">${favSvg(FAV_ICONS[n])}</button>`).join('') +
    '<span class="fv-own"></span><button type="button" class="fv-file">Image file...</button></div></div>' +
    '<div class="dlg-text s-hint">With an icon the label may stay empty.</div>' +
    `<div class="dlg-text s-hint">${old.conn ? esc('A folder of ' + old.conn.name) : esc(win ? 'The path may use ~ and %NAME% (for example %USERPROFILE%\\Documents); a network folder is \\\\server\\share.' : 'The path may use ~, $HOME and ${NAME}, for example $HOME/Documents.')}</div>`, 'OK', (b) => {
    const mark = () => {
      b.querySelectorAll('.fv-pick').forEach((x) => x.classList.toggle('on', x.dataset.icon === icon));
      const own = icon.startsWith('data:');
      b.querySelector('.fv-own').innerHTML = own ? `<button type="button" class="fv-pick on" title="Own picture">${favIconHtml(icon)}</button>` : '';
    };
    b.querySelector('.fv-icons').addEventListener('click', async (e) => {
      const pick = e.target.closest('.fv-pick');
      if (pick && pick.dataset.icon !== undefined) { icon = pick.dataset.icon; mark(); }
      if (!e.target.closest('.fv-file')) return;
      const file = await api.openFileDialog({ title: 'Image file', defaultPath: api.platform === 'linux' ? '/usr/share/icons' : undefined });
      if (!file) return;
      try { icon = favIconOk(await favPicture(file)); mark(); } catch (err) { b.querySelector('.fv-own').textContent = err.message; }
    });
    mark();
  });
  if (!box) return;
  const label = box.querySelector('.fv-label').value.trim();
  const name = box.querySelector('.fv-name').value.trim();
  const path = box.querySelector('.fv-path').value.trim();
  if (!path) return msg(FAV_TITLE, 'The folder is empty: nothing was saved.');
  const entry = { label: label || (icon ? '' : favAutoLabel(name || P.basename(path) || path)), name, path };
  if (icon) entry.icon = icon;
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

/** the favorites of an .ini file (drivefavorites.ini): added to the list, or instead of it */
async function favImport(from) { // (from: a file given by a test; else the system asks)
  if (modalCount > 0) return;
  const file = from || await api.openFileDialog({ title: 'Import favorites (.ini)' });
  if (!file) return;
  const r = await api.viewRead({ file, max: 2 * 1024 * 1024 });
  if (r.error) return msg(FAV_TITLE, r.error);
  const found = favIniParse(new TextDecoder('utf-8').decode(r.data));
  if (!found.length) return msg(FAV_TITLE, 'No favorites were found in this file. A favorite is a section [Favorite1] with a line Path=...');
  for (const f of found) if (!f.conn) f.full = await favExpand(f.path);
  let how = 'add';
  if (favLoad().length) {
    const a = await dialog({ title: 'Import favorites', text: `${found.length} favorite(s) in the file.`, buttons: [{ label: 'Add to the list', value: 'add', primary: true }, { label: 'Replace the list', value: 'replace' }, { label: 'Cancel', value: 'cancel', cancel: true }] });
    how = a.value;
  }
  if (how !== 'add' && how !== 'replace') return;
  const merged = favIniMerge(how === 'replace' ? [] : favLoad(), found);
  favSave(merged.list);
  if (!favOn()) favToggle();
}

async function favExport(to) {
  if (modalCount > 0) return;
  const list = favLoad();
  if (!list.length) return msg(FAV_TITLE, 'There are no favorites to export yet.');
  const file = to || await api.saveFileDialog({ title: 'Export favorites (.ini)', defaultPath: 'drivefavorites.ini', filters: [{ name: 'INI', extensions: ['ini'] }] });
  if (!file) return;
  const r = await api.writeFile({ file, data: new TextEncoder().encode(favIniWrite(list)) });
  if (r && r.error) return msg(FAV_TITLE, r.error);
  return msg(FAV_TITLE, `${list.length} favorite(s) saved to ${file}`);
}

/** the menu of the right mouse button; index < 0: on a disk or on the empty part of the bar */
function favMenu(p, index, x, y) {
  const rows = [['Add favorite...', () => favEdit(p, -1)]];
  if (index >= 0) {
    const n = favLoad().length;
    rows.push(['Edit favorite...', () => favEdit(p, index)], ['Remove favorite', () => favRemove(index)], null,
      ['Move left', () => favMove(index, -1), index > 0], ['Move right', () => favMove(index, 1), index < n - 1]);
  }
  rows.push(null, ['Import from .ini...', () => favImport()], ['Export to .ini...', () => favExport(), favLoad().length > 0]);
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
