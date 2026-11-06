'use strict';
// Configuration dialog in the style of Total Commander: the list of sections on the left, the page with its groups on the right, OK / Cancel / Apply.
// (Configuration > Configuration...). The values live in the store under their own keys; pages return what they changed from read().
// Uses helpers from app.js (store, esc, panels, modalCount, openModal, msg), hotkeys.js (hkMount), options.js (editorCfg), i18n.js (LANGS, LANG).

const CFG_DEFAULTS = { showHidden: true, dirBrackets: false, dirSort: 'like', confirmDelete: true, useTrash: true, updateAuto: true, thumbsDefault: false };
const cfgGet = (k) => { const v = store.get(k, undefined); return v === undefined ? CFG_DEFAULTS[k] : v; };

/** [id, indent level, title] for the list on the left */
const CFG_TREE = [
  ['display', 0, 'Display'],
  ['operation', 0, 'Operation'],
  ['copydelete', 1, 'Copy/Delete'],
  ['editor', 1, 'Editor'],
  ['hotkeys', 1, 'Hotkeys'],
  ['language', 0, 'Language'],
  ['tools', 0, 'Tools'],
  ['index', 1, 'File index'],
  ['sync', 1, 'Settings sync'],
  ['updates', 1, 'Updates'],
];

function openConfig(page) {
  if (modalCount > 0) return;
  const box = document.createElement('div');
  box.className = 'dlg cfg';
  const chk = (cls, label, on, extra = '') => `<label class="ft-chk"><input type="checkbox" class="${cls}"${on ? ' checked' : ''}${extra}> ${label}</label>`;
  const fs = (title, inner) => `<fieldset class="cfg-fs"><legend>${title}</legend>${inner}</fieldset>`;
  const link = (cls, label) => `<div class="ft-line"><button type="button" class="${cls}">${label}</button></div>`;
  const c = editorCfg();
  const win = api.platform === 'win32';
  const trashName = isMac ? 'the Trash' : 'the Recycle Bin';

  const pages = {
    display: fs('File display',
      chk('cf-showHidden', 'Show hidden files (names that start with a dot)', cfgGet('showHidden')) +
      chk('cf-dirBrackets', 'Show square brackets [ ] around directories', cfgGet('dirBrackets'))) +
      fs('Windows', chk('cf-dlgWindows', 'Open dialogs (copy, delete, settings ...) in their own windows that can be moved out of the program window', store.get('dlgWindows', true) !== false)) +
      fs('Sorting directories',
        `<div class="ft-line"><label class="ft-chk"><input type="radio" name="cf-dirSort" value="name"${cfgGet('dirSort') === 'name' ? ' checked' : ''}> Always by name</label>` +
        `<label class="ft-chk"><input type="radio" name="cf-dirSort" value="like"${cfgGet('dirSort') !== 'name' ? ' checked' : ''}> Like files (also by time, extension)</label></div>`),
    operation: fs('Operation', '<div class="dlg-text">Choose a section on the left: copying and deleting, the editor, the hotkeys.</div>'),
    copydelete: fs('Delete',
      chk('cf-confirmDelete', 'Ask before deleting files', cfgGet('confirmDelete')) +
      chk('cf-useTrash', `F8 / Delete move files to ${trashName} (otherwise they are deleted for good)`, cfgGet('useTrash')) +
      '<div class="s-hint">Shift+F8 always deletes for good and always asks.</div>'),
    editor: fs('Editor (F4, Shift+F4)',
      `<label class="ft-chk"><input type="radio" name="cf-ed" class="cf-ed-builtin" value="builtin"${c.mode === 'builtin' ? ' checked' : ''}> The built-in editor</label>` +
      `<label class="ft-chk"><input type="radio" name="cf-ed" class="cf-ed-external" value="external"${c.mode === 'external' ? ' checked' : ''}> This program:</label>` +
      '<div class="ft-line"><label>Program:</label><input class="cf-exe" spellcheck="false" placeholder="' + (win ? 'C:\\Program Files\\Notepad++\\notepad++.exe' : '/Applications/Sublime Text.app') + '"><button type="button" class="cf-browse">Browse...</button></div>' +
      '<div class="ft-line"><label>Arguments:</label><input class="cf-args" spellcheck="false"></div>' +
      '<div class="s-hint">%F is the file name; without %F the file is added at the end. Files inside archives and on NAS / SSH servers are always edited in the built-in editor, because it writes them back.</div>'),
    hotkeys: fs('Hotkeys', '<div class="cf-hk">' + HK_BODY + '</div>'),
    language: fs('Language', '<div class="lang-list">' + LANGS.map(([code, n]) => `<label class="lang-it"><input type="radio" name="cf-lang" value="${code}"${code === LANG ? ' checked' : ''}> ${esc(n)}</label>`).join('') + '</div><div class="s-hint">The program restarts its window when the language changes.</div>'),
    tools: fs('Tools', '<div class="dlg-text">Choose a section on the left: the file index, the sync of the settings, the updates.</div>'),
    index: fs('File index', '<div class="dlg-text">An optional database of the names, sizes and dates of the files on your disks: Find Files (Alt+F7) then answers at once without reading the disks.</div>' + link('cf-open-index', 'Open the file index settings...')),
    sync: fs('Settings sync', '<div class="dlg-text">Keep the connections, favourites, hotkeys, presets and the language the same on all computers: in Dropbox, Google Drive or a folder.</div>' + link('cf-open-sync', 'Open the settings sync...')),
    updates: fs('Updates',
      chk('cf-updateAuto', 'Look for a new version when the program starts', cfgGet('updateAuto')) +
      link('cf-check', 'Check for updates now...')),
  };

  box.innerHTML =
    '<div class="dlg-title">Configuration</div><div class="cfg-wrap">' +
    '<div class="cfg-tree">' + CFG_TREE.map(([id, lvl, t]) => `<div class="cfg-it lvl${lvl}" data-p="${id}">${esc(t)}</div>`).join('') + '</div>' +
    '<div class="cfg-right"><div class="cfg-title"></div><div class="cfg-pages">' + Object.entries(pages).map(([id, h]) => `<div class="cfg-page" data-p="${id}" hidden>${h}</div>`).join('') + '</div></div></div>' +
    '<div class="dlg-btns"><button class="cfg-ok primary">OK</button><button class="cfg-cancel">Cancel</button><button class="cfg-apply" disabled>Apply</button></div>';
  const q = (s) => box.querySelector(s);
  const qa = (s) => [...box.querySelectorAll(s)];
  const close = openModal(box);
  let dirty = false;
  const touch = () => { dirty = true; q('.cfg-apply').disabled = false; };

  const show = (id) => {
    qa('.cfg-page').forEach((p) => (p.hidden = p.dataset.p !== id));
    qa('.cfg-it').forEach((i) => i.classList.toggle('on', i.dataset.p === id));
    q('.cfg-title').textContent = (CFG_TREE.find((t) => t[0] === id) || [])[2] || '';
    store.set('cfgPage', id);
  };
  qa('.cfg-it').forEach((i) => (i.onmousedown = (e) => { e.preventDefault(); show(i.dataset.p); }));
  show(page || store.get('cfgPage', 'display'));

  // external editor fields
  q('.cf-exe').value = c.exe || '';
  q('.cf-args').value = c.args || '"%F"';
  q('.cf-browse').onclick = async () => {
    const f = await api.openFileDialog({ title: 'Choose the editor program', defaultPath: win ? 'C:\\Program Files' : '/Applications' });
    if (f) { q('.cf-exe').value = f; q('.cf-ed-external').checked = true; touch(); }
  };
  hkMount(q('.cf-hk'), null);
  box.addEventListener('input', (e) => { if (!e.target.closest('.cf-hk')) touch(); });
  box.addEventListener('change', (e) => { if (!e.target.closest('.cf-hk')) touch(); });

  /** the other dialogs open after this one has closed */
  const then = (fn) => () => { close(); setTimeout(fn, 50); };
  q('.cf-open-index').onclick = then(() => openIndexDialog());
  q('.cf-open-sync').onclick = then(() => openSyncDialog());
  q('.cf-check').onclick = then(() => checkForUpdates(false));

  const apply = () => {
    store.set('showHidden', q('.cf-showHidden').checked);
    store.set('dirBrackets', q('.cf-dirBrackets').checked);
    store.set('dlgWindows', q('.cf-dlgWindows').checked);
    store.set('dirSort', (box.querySelector('input[name="cf-dirSort"]:checked') || {}).value || 'like');
    store.set('confirmDelete', q('.cf-confirmDelete').checked);
    store.set('useTrash', q('.cf-useTrash').checked);
    store.set('updateAuto', q('.cf-updateAuto').checked);
    const exe = q('.cf-exe').value.trim().replace(/^"(.*)"$/, '$1');
    const wantExt = q('.cf-ed-external').checked && !!exe;
    store.set('editorCfg', { mode: wantExt ? 'external' : 'builtin', exe, args: q('.cf-args').value.trim() || '"%F"' });
    panels.forEach((p) => p.rebuild(p.cur() && !p.cur().up ? p.cur().name : undefined));
    dirty = false;
    q('.cfg-apply').disabled = true;
    const lang = (box.querySelector('input[name="cf-lang"]:checked') || {}).value;
    if (lang && lang !== LANG) { store.set('lang', lang); location.reload(); return false; } // store.set also marks the language for the settings sync
    return true;
  };
  q('.cfg-apply').onclick = () => { apply(); };
  q('.cfg-ok').onclick = () => { if (apply()) close(); };
  q('.cfg-cancel').onclick = () => close();
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.target.closest('.cf-hk')) { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Escape' || e.target.closest('.cf-hk')) e.stopPropagation(); // the keys of the dialog stay in the dialog
  });
  box.tabIndex = -1;
  box.focus();
}

