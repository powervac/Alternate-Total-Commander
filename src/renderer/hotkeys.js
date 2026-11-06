'use strict';
// Hotkeys: every operation is a command with default keys; Configuration > Hotkeys... lets you give it other keys.
// The overrides live in store 'hotkeys' ({ commandId: ['Ctrl+Shift+X', ...] }). app.js asks hkDispatch(e) first for every key press.
// Uses helpers from app.js (A, O, panels, store, openModal, modalCount, esc, msg, dialog, isMac).

const HK_MOD = isMac ? 'Cmd' : 'Ctrl'; // how "mod" is written for the user; the program treats Ctrl (and Cmd on macOS) as one modifier

// [id, group, label, default keys, run]. "Ctrl" is Ctrl on Windows and Cmd/Ctrl on macOS.
const HK_COMMANDS = [
  ['view', 'Files', 'View (F3)', ['F3'], () => openViewer()],
  ['edit', 'Files', 'Edit (F4)', ['F4'], () => openEditor()],
  ['newfile', 'Files', 'Edit new file', ['Shift+F4'], () => newFileEdit()],
  ['copy', 'Files', 'Copy', ['F5'], () => copyMove('copy')],
  ['move', 'Files', 'Move', ['F6'], () => copyMove('move')],
  ['rename', 'Files', 'Rename', ['F2', 'Shift+F6'], () => copyMove('move', { renameOnly: true })],
  ['mkdir', 'Files', 'New folder', ['F7'], () => makeDir()],
  ['delete', 'Files', 'Delete (to the Recycle Bin)', ['F8', 'Delete'], () => deleteSel(false)],
  ['deleteperm', 'Files', 'Delete permanently', ['Shift+F8', 'Shift+Delete'], () => deleteSel(true)],
  ['props', 'Files', 'Properties', ['Alt+Enter'], () => ftProperties()],
  ['pack', 'Files', 'Pack files', ['Alt+F5'], () => packSel()],
  ['unpack', 'Files', 'Unpack archive', ['Alt+F9'], () => unpackSel()],
  ['testarc', 'Files', 'Test archives', ['Alt+Shift+F9'], () => ftTestArchives()],
  ['multirename', 'Files', 'Multi-rename tool', [HK_MOD + '+M'], () => openMultiRename()],
  ['calcspace', 'Files', 'Calculate occupied space', [HK_MOD + '+L'], () => ftCalcSpace()],
  ['comment', 'Files', 'File comment', ['Ctrl+Z'], () => ftComment()],
  ['quit', 'Files', 'Exit', ['Alt+F4'], () => api.quit()],

  ['select', 'Selection', 'Select the file and go down', ['Insert'], () => A().toggleSel(A().cursor)],
  ['spaceselect', 'Selection', 'Select in place (folders: calculate size)', ['Space'], () => A().spaceSelect()],
  ['selectall', 'Selection', 'Select all', [HK_MOD + '+A', HK_MOD + '+Num+'], () => A().selectWhere(() => true, true)],
  ['selectgroup', 'Selection', 'Select a group', ['Num+'], () => selectGroup(true)],
  ['unselectgroup', 'Selection', 'Unselect a group', ['Num-'], () => selectGroup(false)],
  ['selectsameext', 'Selection', 'Select files with the same extension', ['Alt+Num+'], () => selectSameExt()],
  ['unselectall', 'Selection', 'Unselect all', [HK_MOD + '+Num-'], () => A().selectWhere(() => true, false)],
  ['invert', 'Selection', 'Invert the selection', ['Num*'], () => { const p = A(); p.items.forEach((i) => (p.sel.has(i.name) ? p.sel.delete(i.name) : p.sel.add(i.name))); p.render(); }],

  ['switchpanel', 'Panels', 'Other panel', ['Tab'], () => { if (qvIdx === null) O().focus(); }],
  ['swap', 'Panels', 'Swap panels', [HK_MOD + '+U'], () => swapPanels()],
  ['refresh', 'Panels', 'Reread the folder', [HK_MOD + '+R'], () => A().refresh()],
  ['goup', 'Panels', 'Parent folder', ['Backspace'], () => A().goUp()],
  ['back', 'Panels', 'Back', ['Alt+Left'], () => A().back(-1)],
  ['forward', 'Panels', 'Forward', ['Alt+Right'], () => A().back(1)],
  ['leftdrives', 'Panels', 'Left drive list', ['Alt+F1'], () => openDrivePicker(panels[0])],
  ['rightdrives', 'Panels', 'Right drive list', ['Alt+F2'], () => openDrivePicker(panels[1])],
  ['quickview', 'Panels', 'Quick view panel', ['Ctrl+Q'], () => qvToggle()],
  ['thumbs', 'Panels', 'Thumbnail view', [HK_MOD + '+Shift+F4'], () => A().setThumbs(!A().thumbs)],
  ['sortname', 'Panels', 'Sort by name', [HK_MOD + '+F3'], () => A().setSort('name')],
  ['sortext', 'Panels', 'Sort by extension', [HK_MOD + '+F4'], () => A().setSort('ext')],
  ['sorttime', 'Panels', 'Sort by date', [HK_MOD + '+F5'], () => A().setSort('time')],
  ['sortsize', 'Panels', 'Sort by size', [HK_MOD + '+F6'], () => A().setSort('size')],

  ['newtab', 'Tabs', 'New tab', [HK_MOD + '+T'], () => A().newTab()],
  ['closetab', 'Tabs', 'Close tab', [HK_MOD + '+W'], () => A().closeTab()],
  ['nexttab', 'Tabs', 'Next tab', ['Ctrl+Tab'], () => A().switchTab(A().ti + 1)],
  ['prevtab', 'Tabs', 'Previous tab', ['Ctrl+Shift+Tab'], () => A().switchTab(A().ti - 1)],
  ['opentab', 'Tabs', 'Open the folder under the cursor in a new tab', [HK_MOD + '+Up'], () => openInNewTab(A())],

  ['search', 'Tools', 'Find files', ['Alt+F7'], () => openSearch()],
  ['compare', 'Tools', 'Compare directories', ['Shift+F2'], () => compareDirectories()],
  ['cmdname', 'Tools', 'File name under the cursor into the command line', [HK_MOD + '+Enter'], () => cmdInsert(false)],
  ['cmdpath', 'Tools', 'Full path of the file into the command line', [HK_MOD + '+Shift+Enter'], () => cmdInsert(true)],
  ['hotlist', 'Tools', 'Directory hotlist', [HK_MOD + '+D'], () => openHotlist()],
  ['menu', 'Tools', 'Open the menu', ['F9', 'F10'], () => openMenu(0)],
  ['nas', 'Tools', 'Synology NAS connection', [HK_MOD + '+F'], () => openConnections(undefined, 'nas')],
  ['ssh', 'Tools', 'SSH server connection', [HK_MOD + '+Shift+F'], () => openConnections(undefined, 'ssh')],
  ['console', 'Tools', 'SSH: console / file list', [HK_MOD + '+O'], () => sshToggleConsole(A())],
  ['playpause', 'Tools', 'Music player: play / pause', [isMac ? 'Alt+Space' : 'Ctrl+Space'], () => playerToggle()],
  ['nexttrack', 'Tools', 'Music player: next track', [HK_MOD + '+Shift+Right'], () => playerStep(1)],
  ['prevtrack', 'Tools', 'Music player: previous track', [HK_MOD + '+Shift+Left'], () => playerStep(-1)],
];
/** menu items (by their text) that are commands: their menu line shows the current keys */
const HK_MENU_IDS = {
  'View': 'view', 'Edit': 'edit', 'Edit New File...': 'newfile', 'Pack...': 'pack', 'Unpack Specific Files...': 'unpack', 'Test Archive(s)': 'testarc',
  'Properties...': 'props', 'Calculate Occupied Space...': 'calcspace', 'Multi-Rename Tool...': 'multirename', 'Rename (Shift+F6)': 'rename',
  'Edit Comment...': 'comment', 'Quit': 'quit', 'Select Group...': 'selectgroup', 'Unselect Group...': 'unselectgroup', 'Select All': 'selectall',
  'Unselect All': 'unselectall', 'Invert Selection': 'invert', 'Select All With Same Extension': 'selectsameext', 'Compare Directories': 'compare',
  'Search...': 'search', 'Directory Hotlist': 'hotlist', 'Music Player: Play / Pause': 'playpause', 'Music Player: Next Track': 'nexttrack',
  'Music Player: Previous Track': 'prevtrack', 'Go Back': 'back', 'Go Forward': 'forward', 'Source<->Target': 'swap', 'Synology NAS...': 'nas',
  'SSH server...': 'ssh', 'SSH: Console / File List': 'console', 'Left drive list': 'leftdrives', 'Right drive list': 'rightdrives',
  'Quick View Panel': 'quickview', 'Thumbnails': 'thumbs', 'New Folder Tab': 'newtab', 'Close Tab': 'closetab', 'Next Tab': 'nexttab',
  'Previous Tab': 'prevtab', 'Name': 'sortname', 'Extension': 'sortext', 'Time': 'sorttime', 'Size': 'sortsize', 'Reread Source': 'refresh',
};
const HK_BY_ID = new Map(HK_COMMANDS.map((c) => [c[0], c]));

/** "Ctrl+Shift+F5" for a key press (null for a bare modifier key). Ctrl and Cmd are one "Ctrl" (the same as `mod` in app.js). */
function hkCombo(e) {
  const k = e.key;
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock'].includes(k)) return null;
  let name;
  if (e.code === 'NumpadAdd') name = 'Num+';
  else if (e.code === 'NumpadSubtract') name = 'Num-';
  else if (e.code === 'NumpadMultiply') name = 'Num*';
  else if (e.code === 'NumpadDivide') name = 'Num/';
  else if (k === ' ') name = 'Space';
  else if (k.startsWith('Arrow')) name = k.slice(5);
  else if (/^Key[A-Z]$/.test(e.code || '')) name = e.code.slice(3); // by the position on the keyboard: also with a Russian layout
  else if (/^Digit\d$/.test(e.code || '')) name = e.code.slice(5);
  else if (k.length === 1) name = k.toUpperCase();
  else name = k; // F1..F12, Enter, Delete, Insert, Home, End, PageUp, PageDown, Backspace, Tab, Escape
  const mods = [];
  if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  return [...mods, name].join('+');
}

/** the combos of a command as the user sees them (Cmd on a Mac) */
const hkShow = (combo) => (isMac ? combo.replace(/^Ctrl\+/, 'Cmd+').replace(/\+Ctrl\+/, '+Cmd+') : combo);
const hkNorm = (c) => String(c).replace(/^Cmd\+/, 'Ctrl+').replace(/\+Cmd\+/, '+Ctrl+').replace(/\+Cmd$/, '+Ctrl');

let hkCache = null;
function hkOverrides() { const v = store.get('hotkeys', {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
/** the keys of a command now: the user's own, else the defaults (normalized: "Ctrl" for Cmd) */
function hkKeys(id) {
  const o = hkOverrides();
  if (Object.prototype.hasOwnProperty.call(o, id) && Array.isArray(o[id])) return o[id].map(hkNorm);
  const c = HK_BY_ID.get(id);
  return c ? c[3].map(hkNorm) : [];
}
function hkMap() {
  if (hkCache) return hkCache;
  const m = new Map();
  for (const c of HK_COMMANDS) for (const k of hkKeys(c[0])) if (!m.has(k)) m.set(k, c);
  hkCache = m;
  return m;
}
const hkReset = () => { hkCache = null; };
/** text for menus: the first key of a command */
const hkLabel = (id) => { const k = hkKeys(id)[0]; return k ? hkShow(k) : ''; };

/** keys that edit the command line when it has text: they must not run commands then */
const HK_TEXT = new Set(['Backspace', 'Delete', 'Home', 'End', ' ', 'ArrowLeft', 'ArrowRight']);

/** called by the key handler of app.js: runs the command of this key press; true = handled */
function hkDispatch(e, typing) {
  const combo = hkCombo(e);
  if (!combo) return false;
  const cmd = hkMap().get(combo);
  if (!cmd) return false;
  if (typing && (HK_TEXT.has(e.key) || e.key.length === 1) && !e.ctrlKey && !e.metaKey && !e.altKey) return false; // the command line owns these keys while it has text
  e.preventDefault();
  try { const r = cmd[4](); if (r && typeof r.catch === 'function') r.catch((err) => console.error('hotkey ' + cmd[0], err)); } catch (err) { console.error('hotkey ' + cmd[0], err); }
  return true;
}

// ---------------------------------------------------------------- the dialog
const HK_BODY =
  '<div class="dlg-text">Choose a command, press "Add key" and then the key combination you want. A key can belong to one command only: a key that is already used is taken over after a question. Changes apply at once.</div>' +
  '<div class="hk-bar"><input class="hk-filter" spellcheck="false" placeholder="Filter commands"><button class="hk-resetall" type="button">Restore all defaults</button></div>' +
  '<div class="hk-list" tabindex="0"></div><div class="hk-status"></div>';

async function openHotkeys() {
  if (modalCount > 0) return;
  const box = document.createElement('div');
  box.className = 'dlg hk';
  box.innerHTML = '<div class="dlg-title">Hotkeys</div><div class="dlg-body">' + HK_BODY + '</div><div class="dlg-btns"><button class="hk-close primary">Close</button></div>';
  const close = openModal(box);
  hkMount(box, close);
  box.focus();
}

/** the hotkey list inside `box` (a dialog or a page of Configuration); closeFn only for the stand-alone dialog */
function hkMount(box, closeFn) {
  const q = (s) => box.querySelector(s);
  const $list = q('.hk-list'), $status = q('.hk-status');
  let capturing = null; // command id waiting for a key press

  const save = (id, keys) => {
    const o = { ...hkOverrides() };
    const def = HK_BY_ID.get(id)[3].map(hkNorm);
    if (keys.length === def.length && keys.every((k, i) => k === def[i])) delete o[id]; else o[id] = keys;
    store.set('hotkeys', o);
    hkReset();
  };
  const owner = (combo, except) => { for (const c of HK_COMMANDS) if (c[0] !== except && hkKeys(c[0]).includes(combo)) return c; return null; };

  function render() {
    const f = q('.hk-filter').value.trim().toLowerCase();
    let html = '';
    let group = '';
    for (const c of HK_COMMANDS) {
      if (f && !c[2].toLowerCase().includes(f) && !hkKeys(c[0]).some((k) => hkShow(k).toLowerCase().includes(f))) continue;
      if (c[1] !== group) { group = c[1]; html += `<div class="hk-group">${esc(group)}</div>`; }
      const keys = hkKeys(c[0]);
      const changed = Object.prototype.hasOwnProperty.call(hkOverrides(), c[0]);
      html += `<div class="hk-row" data-id="${c[0]}"><div class="hk-name">${esc(c[2])}${changed ? ' <span class="hk-mod">(changed)</span>' : ''}</div><div class="hk-keys">` +
        keys.map((k, i) => `<span class="hk-key">${esc(hkShow(k))}<button type="button" class="hk-del" data-i="${i}" title="Remove this key">×</button></span>`).join('') +
        (capturing === c[0] ? '<span class="hk-cap">press a key ...</span>' : '<button type="button" class="hk-add">Add key</button>') +
        (changed ? '<button type="button" class="hk-def" title="Back to the default keys">Default</button>' : '') +
        '</div></div>';
    }
    $list.innerHTML = html || '<div class="ar-wait">No commands match.</div>';
  }

  $list.addEventListener('click', (e) => {
    const row = e.target.closest('.hk-row');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest('.hk-add')) { capturing = id; $status.textContent = 'Press the new key combination (Esc cancels).'; render(); box.focus(); return; }
    const del = e.target.closest('.hk-del');
    if (del) { const keys = hkKeys(id).filter((_k, i) => i !== +del.dataset.i); save(id, keys); render(); return; }
    if (e.target.closest('.hk-def')) { const o = { ...hkOverrides() }; delete o[id]; store.set('hotkeys', o); hkReset(); render(); }
  });
  q('.hk-filter').oninput = render;
  q('.hk-resetall').onclick = async () => {
    store.set('hotkeys', {});
    hkReset();
    $status.textContent = 'All commands have their default keys again.';
    render();
  };
  if (q('.hk-close')) q('.hk-close').onclick = () => closeFn();
  box.tabIndex = -1;
  box.addEventListener('keydown', async (e) => {
    if (closeFn || capturing) e.stopPropagation(); // on a page of Configuration the dialog around it still gets Esc
    if (capturing) {
      e.preventDefault();
      if (e.key === 'Escape') { capturing = null; $status.textContent = ''; render(); return; }
      const combo = hkCombo(e);
      if (!combo) return; // only a modifier so far
      const id = capturing;
      capturing = null;
      if (['Enter', 'Escape', 'Left', 'Right', 'Up', 'Down', 'PageUp', 'PageDown', 'Home', 'End'].includes(combo)) { $status.textContent = `${hkShow(combo)} is used for moving around the list and cannot be given to a command.`; render(); return; }
      const other = owner(combo, id);
      if (other) {
        box.style.visibility = 'hidden';
        const r = await dialog({ title: 'Key already used', text: `${hkShow(combo)} belongs to "${other[2]}". Take it over for "${HK_BY_ID.get(id)[2]}"?`, buttons: [{ label: 'Take over', value: 'yes' }, { label: 'Cancel', value: 'no', primary: true, cancel: true }] });
        box.style.visibility = '';
        if (r.value !== 'yes') { $status.textContent = ''; render(); return; }
        save(other[0], hkKeys(other[0]).filter((k) => k !== combo));
      }
      const mine = hkKeys(id);
      if (!mine.includes(combo)) save(id, [...mine, combo]);
      $status.textContent = `${hkShow(combo)} now runs "${HK_BY_ID.get(id)[2]}".`;
      render();
      return;
    }
    if (closeFn && e.key === 'Escape') { e.preventDefault(); closeFn(); }
  });
  render();
}
