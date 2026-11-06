'use strict';
// Toolbar under the menu. Icons are simple inline SVGs (20x20, stroke based).
// Uses helpers from app.js (A, O, panels, api, store, openMenu helpers) and the feature files loaded before this one.

const TB_ICONS = {
  thumbs: '<rect x="3" y="3" width="6" height="6"/><rect x="11" y="3" width="6" height="6"/><rect x="3" y="11" width="6" height="6"/><rect x="11" y="11" width="6" height="6"/>',
  refresh: '<path d="M16 10a6 6 0 1 1-2-4.5"/><path d="M16 3.5V7.5h-4"/>',
  back: '<path d="M12 4l-6 6 6 6"/>',
  forward: '<path d="M8 4l6 6-6 6"/>',
  up: '<path d="M4 12l6-6 6 6"/><path d="M10 6v10"/>',
  home: '<path d="M3 10l7-6.5 7 6.5"/><path d="M5 9v7.5h3.5v-4h3v4H15V9"/>',
  swap: '<path d="M4 7h11l-3-3"/><path d="M16 13H5l3 3"/>',
  targetsource: '<path d="M3 10h10"/><path d="M10 6l4 4-4 4"/><path d="M17 4v12"/>',
  newtab: '<path d="M3 8h14v9H3z"/><path d="M3 8V5h5l2 3"/><path d="M10 10.5v4M8 12.5h4"/>',
  quickview: '<path d="M2 10c3-5 13-5 16 0-3 5-13 5-16 0z"/><circle cx="10" cy="10" r="2.2"/>',
  hotlist: '<path d="M10 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.3l5-.7z"/>',
  find: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.3 12.3L17 17"/>',
  compare: '<path d="M3 4h6v12H3zM11 4h6v12h-6z"/><path d="M5 8h2M13 8h2M5 12h2M13 12h2"/>',
  sync: '<path d="M4 8.5a6 6 0 0 1 10.5-2.5L16 4.5"/><path d="M16 4v4h-4"/><path d="M16 11.5a6 6 0 0 1-10.5 2.5L4 15.5"/><path d="M4 16v-4h4"/>',
  multirename: '<path d="M3 5h7M3 10h5M3 15h7"/><path d="M11.5 15.5l.5-2.5 5-5 2 2-5 5z"/>',
  pack: '<path d="M4 8h12v8.5H4z"/><path d="M4 8l2-4h8l2 4"/><path d="M10 10v4M8 12.2l2 2 2-2"/>',
  unpack: '<path d="M4 8h12v8.5H4z"/><path d="M4 8l2-4h8l2 4"/><path d="M10 14v-4M8 11.8l2-2 2 2"/>',
  selectall: '<path d="M3.5 3.5h13v13h-13z"/><path d="M6.5 10l2.5 2.8 4.5-5.6"/>',
  newfolder: '<path d="M2 5.5h5.5l2 2H18V16H2z"/><path d="M10 9.5v4.5M7.8 11.8h4.4"/>',
  nas: '<path d="M5.5 15.5h9a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 5.4 7.6 4 4 0 0 0 5.5 15.5z"/>',
  ssh: '<path d="M3 4.5h14v11H3z"/><path d="M6 8l3 2-3 2M10.5 12.5H14"/>',
  music: '<path d="M8 15V5l8-2v10"/><circle cx="6" cy="15" r="2"/><circle cx="14" cy="13" r="2"/>',
};

// [icon, tooltip, shortcut, handler]  ('-' = separator)
const TB_ITEMS = [
  ['refresh', 'Reread source', 'Ctrl+R', () => A().refresh()],
  ['back', 'Go back', 'Alt+Left', () => A().back(-1)],
  ['forward', 'Go forward', 'Alt+Right', () => A().back(1)],
  ['up', 'Parent folder', 'Backspace', () => A().goUp()],
  ['home', 'Home folder', '', () => A().load(api.home)],
  '-',
  ['swap', 'Swap panels', 'Ctrl+U', () => swapPanels()],
  ['targetsource', 'Target = Source', '', () => O().go(A().snap())],
  ['newtab', 'New tab', 'Ctrl+T', () => A().newTab()],
  ['quickview', 'Quick view panel', 'Ctrl+Q', () => qvToggle(), 'qv'],
  ['thumbs', 'Thumbnail view', 'Ctrl+Shift+F4', () => A().setThumbs(!A().thumbs)],
  ['hotlist', 'Directory hotlist', 'Ctrl+D', () => openHotlist()],
  ['nas', 'Synology NAS', 'Ctrl+F', () => openConnections(undefined, 'nas')],
  ['ssh', 'SSH server (console + files)', 'Ctrl+Shift+F', () => openConnections(undefined, 'ssh')],
  ['music', 'Music player: play the audio files of this folder / pause', isMac ? 'Option+Space' : 'Ctrl+Space', () => playerButton(), 'pl'],
  '-',
  ['find', 'Find files', 'Alt+F7', () => openSearch()],
  ['compare', 'Compare directories', 'Shift+F2', () => compareDirectories()],
  ['sync', 'Synchronize directories', '', () => openSync()],
  ['multirename', 'Multi-rename tool', 'Ctrl+M', () => openMultiRename()],
  '-',
  ['newfolder', 'New folder', 'F7', () => makeDir()],
  ['selectall', 'Select all', 'Ctrl+A', () => A().selectWhere(() => true, true)],
  ['pack', 'Pack files (zip)', 'Alt+F5', () => packSel()],
  ['unpack', 'Unpack archive', 'Alt+F9', () => unpackSel()],
];

function buildToolbar() {
  const bar = document.getElementById('toolbar');
  for (const it of TB_ITEMS) {
    if (it === '-') {
      const s = document.createElement('span');
      s.className = 'tb-sep';
      bar.appendChild(s);
      continue;
    }
    const [icon, tip, key, fn, toggle] = it;
    const b = document.createElement('button');
    b.className = 'tb-btn i-' + icon;
    if (toggle) b.dataset.toggle = toggle;
    b.title = key ? `${tip} (${key})` : tip;
    b.innerHTML = `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">${TB_ICONS[icon]}</svg>`;
    b.onmousedown = (e) => e.preventDefault(); // keep the keyboard focus where it is
    b.onclick = () => fn();
    bar.appendChild(b);
  }
  applyToolbarVisibility(store.get('toolbar', true));
}

function applyToolbarVisibility(on) {
  document.body.classList.toggle('no-toolbar', !on);
}

function toggleToolbar() {
  const on = document.body.classList.contains('no-toolbar'); // currently hidden -> show
  store.set('toolbar', on);
  applyToolbarVisibility(on);
}

/** keep toggle buttons (quick view) in sync with the state */
function toolbarSync() {
  document.querySelectorAll('#toolbar .tb-btn[data-toggle="qv"]').forEach((b) => b.classList.toggle('on', qvIdx !== null));
  const playing = typeof pl !== 'undefined' && pl.queue.length > 0 && pl.el && !pl.el.paused;
  document.querySelectorAll('#toolbar .tb-btn[data-toggle="pl"]').forEach((b) => b.classList.toggle('on', !!playing));
}

buildToolbar();
