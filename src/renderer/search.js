'use strict';
// Alt+F7 "Find Files": tabs General / Advanced / Load-Save, results list with sorting, the first matching line of a text hit,
// duplicate groups. The engine is main/searchengine.js. Uses helpers from app.js (A, P, esc, fmtNum, fmtDate, store, openModal, modalCount, needLocal).

const SEARCH_DEFAULTS = {
  masks: '*', regexName: false, dirs: '', depth: -1, archives: false, selectedOnly: false,
  useText: false, text: '', whole: false, caseSens: false, regex: false, hex: false, not: false,
  utf8: true, ansi: true, dos: false, utf16: true, office: true, skipBinary: true,
  useDate: false, dateFrom: '', dateTo: '', useNotOlder: false, notOlderN: 1, notOlderU: 'day', useOlder: false, olderN: 1, olderU: 'day',
  useSize: false, sizeOp: '>', sizeVal: 1, sizeUnit: 'mb', attrRo: null, attrHidden: null, attrDir: null,
  dupName: false, dupSize: false, dupContent: false,
};

function openSearch() {
  if (modalCount > 0) return;
  const panel = A();
  if (needLocal('Find Files', panel)) return;
  const saved = { ...SEARCH_DEFAULTS, ...(store.get('search2', {}) || {}) };
  const history = (store.get('searchHistory', []) || []).slice(0, 30);
  const hasSel = panel.sel && panel.sel.size > 0 && !panel.arc && !panel.rem;

  const box = document.createElement('div');
  box.className = 'dlg search';
  const unitOpts = (sel) => ['minute', 'hour', 'day', 'week', 'month', 'year'].map((u) => `<option value="${u}"${u === sel ? ' selected' : ''}>${u}(s)</option>`).join('');
  box.innerHTML =
    '<div class="dlg-title">Find Files</div>' +
    '<div class="dlg-body">' +
    '<div class="s-tabs"><button data-t="g" class="on">General</button><button data-t="a">Advanced</button><button data-t="l">Load/Save</button></div>' +
    // ---------------- General
    '<div class="s-pane" data-p="g">' +
    '<div class="s-grid">' +
    '<label>Search for:</label><span class="s-line"><input class="s-mask" list="s-hist" spellcheck="false" placeholder="*.txt;*.md   exclude: *.txt|*.bak|node_modules/   (no wildcard = name contains)"><label class="s-chk"><input type="checkbox" class="s-rxn"> RegEx</label></span>' +
    '<label>Search in:</label><span class="s-line"><input class="s-dir" spellcheck="false" placeholder="folders separated by ;"><button class="s-cur" type="button" title="Folders of both panels">Panels</button></span>' +
    '<span></span><span class="s-line"><label class="s-chk"><input type="checkbox" class="s-selonly"> Only in selected items</label><label class="s-chk"><input type="checkbox" class="s-arc"> Search in zip archives (names and text)</label><label class="s-chk">Depth <select class="s-depth"></select></label></span>' +
    '</div>' +
    '<datalist id="s-hist">' + history.map((h) => `<option value="${esc(h)}">`).join('') + '</datalist>' +
    '<fieldset class="s-fs"><legend><label class="s-chk"><input type="checkbox" class="s-usetext"> Find text</label></legend>' +
    '<input class="s-text" spellcheck="false" placeholder="text, regular expression or hex bytes (de ad be ef)">' +
    '<div class="s-cols">' +
    '<div><label class="s-chk"><input type="checkbox" class="s-whole"> Whole words only</label><label class="s-chk"><input type="checkbox" class="s-case"> Case sensitive</label><label class="s-chk"><input type="checkbox" class="s-rx"> RegEx</label><label class="s-chk"><input type="checkbox" class="s-hex"> Hex</label><label class="s-chk"><input type="checkbox" class="s-not"> Find files NOT containing the text</label></div>' +
    '<div><label class="s-chk"><input type="checkbox" class="s-e-ansi"> ANSI (Windows-1251)</label><label class="s-chk"><input type="checkbox" class="s-e-dos"> ASCII (DOS, CP866)</label><label class="s-chk"><input type="checkbox" class="s-e-u16"> Unicode UTF-16</label><label class="s-chk"><input type="checkbox" class="s-e-u8"> UTF-8</label><label class="s-chk"><input type="checkbox" class="s-office"> Office XML (docx, xlsx, pptx, odt...)</label><label class="s-chk"><input type="checkbox" class="s-skipbin"> Skip binary files (video, images, programs)</label></div>' +
    '</div></fieldset></div>' +
    // ---------------- Advanced
    '<div class="s-pane" data-p="a" hidden>' +
    '<div class="s-adv">' +
    '<label class="s-chk"><input type="checkbox" class="s-usedate"> Date between:</label><span class="s-line"><input type="date" class="s-df"> and <input type="date" class="s-dt"></span>' +
    '<label class="s-chk"><input type="checkbox" class="s-usenew"> Not older than:</label><span class="s-line"><input type="number" min="1" class="s-nn"><select class="s-nu">' + unitOpts(saved.notOlderU) + '</select></span>' +
    '<label class="s-chk"><input type="checkbox" class="s-useold"> Older than:</label><span class="s-line"><input type="number" min="1" class="s-on"><select class="s-ou">' + unitOpts(saved.olderU) + '</select></span>' +
    '<label class="s-chk"><input type="checkbox" class="s-usesize"> File size:</label><span class="s-line"><select class="s-sop"><option>=</option><option>&gt;</option><option>&lt;</option><option>&gt;=</option><option>&lt;=</option></select><input type="number" min="0" class="s-sv"><select class="s-su"><option value="b">bytes</option><option value="kb">kbytes</option><option value="mb">Mbytes</option><option value="gb">Gbytes</option></select></span>' +
    '<label>Attributes:</label><span class="s-line"><label class="s-chk"><input type="checkbox" class="s-a-ro"> Read only</label><label class="s-chk"><input type="checkbox" class="s-a-hid"> Hidden</label><label class="s-chk"><input type="checkbox" class="s-a-dir"> Directory</label><span class="s-hint">click: yes / no / any</span></span>' +
    '<label>Find duplicate files:</label><span class="s-line"><label class="s-chk"><input type="checkbox" class="s-d-name"> same name</label><label class="s-chk"><input type="checkbox" class="s-d-size"> same size</label><label class="s-chk"><input type="checkbox" class="s-d-cont"> same contents</label></span>' +
    '</div></div>' +
    // ---------------- Load/Save
    '<div class="s-pane" data-p="l" hidden>' +
    '<div class="s-tpl"><div class="s-tpl-list" tabindex="0"></div><div class="s-tpl-btns"><input class="s-tpl-name" placeholder="name of the search" spellcheck="false"><button class="s-tpl-save" type="button">Save current</button><button class="s-tpl-load" type="button">Load</button><button class="s-tpl-del" type="button">Delete</button></div></div></div>' +
    // ---------------- results
    '<div class="s-head"><div data-k="name">Name</div><div data-k="dir">Folder</div><div class="r" data-k="size">Size</div><div data-k="mtime">Date</div></div>' +
    '<div class="s-list" tabindex="0"></div>' +
    '<div class="s-status">Ready.</div>' +
    '<div class="s-match"></div>' +
    '</div>' +
    '<div class="dlg-btns"><button class="s-start primary">Start search</button><button class="s-goto">Go to file</button><button class="s-close">Close</button></div>';

  const q = (s) => box.querySelector(s);
  const qa = (s) => [...box.querySelectorAll(s)];
  const $mask = q('.s-mask'), $dir = q('.s-dir'), $text = q('.s-text'), $list = q('.s-list'), $status = q('.s-status'), $start = q('.s-start'), $match = q('.s-match');
  const $depth = q('.s-depth');
  $depth.innerHTML = '<option value="-1">all (unlimited)</option><option value="0">current dir only</option>' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<option value="${n}">${n} level${n > 1 ? 's' : ''}</option>`).join('');
  q('.s-selonly').disabled = !hasSel;
  // the file index (Configuration > File index...): names, sizes and dates answered without reading the disks
  const idxOn = typeof indexUsable === 'function' && indexUsable();
  if (idxOn) {
    const row = document.createElement('label');
    row.className = 's-chk s-idxrow';
    row.innerHTML = '<input type="checkbox" class="s-useidx"> Use the file index (instant; names, size and date only)';
    q('.s-grid').appendChild(document.createElement('span'));
    q('.s-grid').appendChild(row);
    q('.s-useidx').checked = store.get('searchUseIndex', true) !== false;
    q('.s-useidx').onchange = () => store.set('searchUseIndex', q('.s-useidx').checked);
  }

  // tri-state attribute boxes: any (indeterminate) -> yes -> no -> any
  const tri = { ro: saved.attrRo, hid: saved.attrHidden, dir: saved.attrDir };
  const triBox = { ro: q('.s-a-ro'), hid: q('.s-a-hid'), dir: q('.s-a-dir') };
  const paintTri = () => { for (const k of Object.keys(tri)) { triBox[k].indeterminate = tri[k] == null; triBox[k].checked = tri[k] === true; } };
  for (const k of Object.keys(tri)) triBox[k].addEventListener('click', (e) => { e.preventDefault(); tri[k] = tri[k] == null ? true : tri[k] === true ? false : null; paintTri(); });

  /** form <-> settings object */
  function readForm() {
    return {
      masks: $mask.value, regexName: q('.s-rxn').checked, dirs: $dir.value, depth: +$depth.value, archives: q('.s-arc').checked, selectedOnly: q('.s-selonly').checked && hasSel,
      useText: q('.s-usetext').checked, text: $text.value, whole: q('.s-whole').checked, caseSens: q('.s-case').checked, regex: q('.s-rx').checked, hex: q('.s-hex').checked, not: q('.s-not').checked,
      utf8: q('.s-e-u8').checked, ansi: q('.s-e-ansi').checked, dos: q('.s-e-dos').checked, utf16: q('.s-e-u16').checked, office: q('.s-office').checked, skipBinary: q('.s-skipbin').checked,
      useDate: q('.s-usedate').checked, dateFrom: q('.s-df').value, dateTo: q('.s-dt').value,
      useNotOlder: q('.s-usenew').checked, notOlderN: +q('.s-nn').value || 1, notOlderU: q('.s-nu').value,
      useOlder: q('.s-useold').checked, olderN: +q('.s-on').value || 1, olderU: q('.s-ou').value,
      useSize: q('.s-usesize').checked, sizeOp: q('.s-sop').value, sizeVal: q('.s-sv').value === '' ? 1 : +q('.s-sv').value, sizeUnit: q('.s-su').value,
      attrRo: tri.ro, attrHidden: tri.hid, attrDir: tri.dir,
      dupName: q('.s-d-name').checked, dupSize: q('.s-d-size').checked, dupContent: q('.s-d-cont').checked,
    };
  }
  function writeForm(s) {
    $mask.value = s.masks; q('.s-rxn').checked = s.regexName; $dir.value = s.dirs || panel.realDir(); $depth.value = String(s.depth); q('.s-arc').checked = s.archives; q('.s-selonly').checked = s.selectedOnly && hasSel;
    q('.s-usetext').checked = s.useText; $text.value = s.text; q('.s-whole').checked = s.whole; q('.s-case').checked = s.caseSens; q('.s-rx').checked = s.regex; q('.s-hex').checked = s.hex; q('.s-not').checked = s.not;
    q('.s-e-u8').checked = s.utf8; q('.s-e-ansi').checked = s.ansi; q('.s-e-dos').checked = s.dos; q('.s-e-u16').checked = s.utf16; q('.s-office').checked = s.office; q('.s-skipbin').checked = s.skipBinary;
    q('.s-usedate').checked = s.useDate; q('.s-df').value = s.dateFrom; q('.s-dt').value = s.dateTo;
    q('.s-usenew').checked = s.useNotOlder; q('.s-nn').value = s.notOlderN; q('.s-nu').value = s.notOlderU;
    q('.s-useold').checked = s.useOlder; q('.s-on').value = s.olderN; q('.s-ou').value = s.olderU;
    q('.s-usesize').checked = s.useSize; q('.s-sop').value = s.sizeOp; q('.s-sv').value = s.sizeVal; q('.s-su').value = s.sizeUnit;
    tri.ro = s.attrRo; tri.hid = s.attrHidden; tri.dir = s.attrDir; paintTri();
    q('.s-d-name').checked = s.dupName; q('.s-d-size').checked = s.dupSize; q('.s-d-cont').checked = s.dupContent;
    syncEnabled();
  }
  /** grey out what the checked boxes do not use */
  function syncEnabled() {
    const t = q('.s-usetext').checked;
    for (const c of ['.s-text', '.s-whole', '.s-case', '.s-rx', '.s-hex', '.s-not', '.s-e-ansi', '.s-e-dos', '.s-e-u16', '.s-e-u8', '.s-office', '.s-skipbin']) q(c).disabled = !t;
    if (t && q('.s-hex').checked) for (const c of ['.s-whole', '.s-case', '.s-rx', '.s-e-ansi', '.s-e-dos', '.s-e-u16', '.s-e-u8', '.s-office', '.s-skipbin']) q(c).disabled = true;
    q('.s-df').disabled = q('.s-dt').disabled = !q('.s-usedate').checked;
    q('.s-nn').disabled = q('.s-nu').disabled = !q('.s-usenew').checked;
    q('.s-on').disabled = q('.s-ou').disabled = !q('.s-useold').checked;
    q('.s-sop').disabled = q('.s-sv').disabled = q('.s-su').disabled = !q('.s-usesize').checked;
    q('.s-dir').disabled = q('.s-cur').disabled = q('.s-selonly').checked;
  }
  writeForm({ ...saved, dirs: '' }); // "Search in" always starts at the current folder of the active panel
  box.addEventListener('change', syncEnabled);

  // ---------------- tabs
  const showTab = (t) => { qa('.s-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); qa('.s-pane').forEach((p) => (p.hidden = p.dataset.p !== t)); };
  qa('.s-tabs button').forEach((b) => (b.onclick = () => showTab(b.dataset.t)));

  // ---------------- results
  let results = [];
  let cursor = -1;
  let runningId = 0;
  let off = null;
  let closeModal;
  let sortKey = null, sortRev = false;
  let dupMode = false;

  const row = (r, i) =>
    `<div class="s-row${r.group ? ' g' + (r.group % 2) : ''}" data-i="${i}"><div class="s-n">${esc(r.name)}</div><div class="s-f">${esc(r.dir)}</div>` +
    `<div class="r">${r.isDir ? '&lt;DIR&gt;' : fmtNum(r.size)}</div><div>${fmtDate(r.mtime)}</div></div>`;

  function markRow(i) {
    const rows = $list.children;
    if (cursor >= 0 && rows[cursor]) rows[cursor].classList.remove('cur');
    cursor = Math.max(0, Math.min(results.length - 1, i));
    if (rows[cursor]) { rows[cursor].classList.add('cur'); rows[cursor].scrollIntoView({ block: 'nearest' }); }
    const r = results[cursor];
    $match.textContent = r && r.snippet ? (r.line ? `line ${r.line}:  ` : '') + r.snippet : '';
  }
  function append(items) {
    const start = results.length;
    results.push(...items);
    $list.insertAdjacentHTML('beforeend', items.map((r, k) => row(r, start + k)).join(''));
    if (cursor < 0 && results.length) markRow(0);
  }
  function rerender() {
    $list.innerHTML = results.map(row).join('');
    cursor = -1;
    if (results.length) markRow(0);
  }
  function sortBy(k) {
    if (dupMode) return;
    sortRev = sortKey === k ? !sortRev : false;
    sortKey = k;
    const cmp = k === 'size' || k === 'mtime' ? (a, b) => a[k] - b[k] : (a, b) => String(a[k]).localeCompare(String(b[k]), undefined, { numeric: true, sensitivity: 'base' });
    results.sort((a, b) => (sortRev ? -cmp(a, b) : cmp(a, b)));
    rerender();
    qa('.s-head > div').forEach((h) => h.classList.toggle('sorted', h.dataset.k === k));
  }
  qa('.s-head > div').forEach((h) => (h.onclick = () => sortBy(h.dataset.k)));

  const stop = () => { if (runningId) api.cancelOp(runningId); };

  /** form -> engine parameters (throws a readable message on bad input) */
  function buildParams(s) {
    const t = { whole: s.whole, caseSens: s.caseSens, regex: s.regex, hex: s.hex, not: s.not, utf8: s.utf8, ansi: s.ansi, dos: s.dos, utf16: s.utf16, office: s.office, skipBinary: s.skipBinary };
    if (s.useText && !s.hex && !(s.utf8 || s.ansi || s.dos || s.utf16 || s.office)) throw new Error('Choose at least one text encoding.');
    const day = (v, end) => (v ? new Date(v + (end ? 'T23:59:59.999' : 'T00:00:00')).getTime() : null);
    const p = {
      masks: s.masks || '*', regexName: s.regexName, depth: s.depth, archives: s.archives,
      text: s.useText ? s.text : '', t,
      dateFrom: s.useDate ? day(s.dateFrom, false) : null, dateTo: s.useDate ? day(s.dateTo, true) : null,
      notOlder: s.useNotOlder ? { n: s.notOlderN, unit: s.notOlderU } : null,
      older: s.useOlder ? { n: s.olderN, unit: s.olderU } : null,
      size: s.useSize ? { op: s.sizeOp, value: s.sizeVal, unit: s.sizeUnit } : null,
      attrs: { ro: s.attrRo, hidden: s.attrHidden, dir: s.attrDir },
      dups: s.dupName || s.dupSize || s.dupContent ? { name: s.dupName, size: s.dupSize, content: s.dupContent } : null,
    };
    p.useIndex = !!(box.querySelector('.s-useidx') && box.querySelector('.s-useidx').checked);
    if (s.selectedOnly) p.selected = panel.targets().map((i) => P.join(panel.dir, i.name));
    else p.roots = s.dirs.split(';').map((x) => x.trim()).filter(Boolean);
    return p;
  }

  async function start() {
    if (runningId) return stop();
    const s = readForm();
    let params;
    try { params = buildParams(s); } catch (e) { $status.textContent = e.message; return; }
    if (!params.selected) {
      if (!params.roots.length) { $status.textContent = 'Enter the folder to search in.'; return; }
      for (const r of params.roots) {
        const st = await api.stat(r);
        if (!st.exists || !st.isDir) { $status.textContent = 'Folder not found: ' + r; return; }
      }
    }
    store.set('search2', s);
    if (s.masks && s.masks !== '*') { const h = [s.masks, ...history.filter((x) => x !== s.masks)].slice(0, 30); store.set('searchHistory', h); }
    dupMode = !!params.dups;
    sortKey = null;
    qa('.s-head > div').forEach((h) => h.classList.remove('sorted'));
    results = [];
    cursor = -1;
    $list.innerHTML = '';
    $match.textContent = '';
    const id = (runningId = Date.now());
    $start.textContent = 'Stop';
    off = api.onSearch((b) => {
      if (b.id !== id) return;
      if (b.items.length) append(b.items);
      $status.textContent = (b.cur ? 'Searching: ' + b.cur + '  -  ' : '') + results.length + ' found';
      if (results.length >= 100000) stop();
    });
    const res = await api.search({ id, params });
    if (off) off();
    off = null;
    runningId = 0;
    $start.textContent = 'Start search';
    $status.textContent = res.error
      ? 'Error: ' + res.error
      : `${res.cancelled ? 'Stopped' : 'Done'}: ${results.length} found${res.groups ? ` in ${res.groups} group(s) of duplicates` : ''} in ${(res.ms / 1000).toFixed(res.fromIndex ? 2 : 1)} s${res.fromIndex ? ' (from the index)' : ''}` + (res.stats ? ' (' + res.stats.files + ' files in ' + res.stats.dirs + ' folders checked' + (res.stats.binary ? ', ' + res.stats.binary + ' binary skipped' : '') + ')' : '');
    if (results.length && !res.cancelled) $list.focus();
  }

  function saveState() { store.set('search2', readForm()); }
  function close() {
    stop();
    if (off) off();
    saveState();
    closeModal();
  }
  function gotoFile() {
    const r = results[cursor];
    if (!r) return;
    close();
    if (r.arc) panel.loadArc(r.arc.file, r.arc.inner, { focusName: r.name });
    else panel.load(r.dir, { focusName: r.name });
    panel.focus();
  }

  // ---------------- Load / Save
  const tplLoad = () => { const v = store.get('searchTemplates', []); return Array.isArray(v) ? v : []; };
  let tplSel = -1;
  function tplRender() {
    const l = tplLoad();
    q('.s-tpl-list').innerHTML = l.length ? l.map((t, i) => `<div class="s-tpl-it${i === tplSel ? ' on' : ''}" data-i="${i}">${esc(t.name)}</div>`).join('') : '<div class="s-hint" style="padding:8px">No saved searches yet. Fill in the form, type a name and press "Save current".</div>';
  }
  q('.s-tpl-list').addEventListener('mousedown', (e) => { const it = e.target.closest('.s-tpl-it'); if (it) { tplSel = +it.dataset.i; tplRender(); } });
  q('.s-tpl-list').addEventListener('dblclick', (e) => { if (e.target.closest('.s-tpl-it')) q('.s-tpl-load').click(); });
  q('.s-tpl-save').onclick = () => {
    const name = q('.s-tpl-name').value.trim();
    if (!name) { q('.s-tpl-name').focus(); return; }
    const l = tplLoad();
    const i = l.findIndex((t) => t.name === name);
    const entry = { name, s: readForm() };
    if (i >= 0) l[i] = entry; else l.push(entry);
    store.set('searchTemplates', l);
    tplSel = i >= 0 ? i : l.length - 1;
    tplRender();
    $status.textContent = `Saved "${name}".`;
  };
  q('.s-tpl-load').onclick = () => {
    const t = tplLoad()[tplSel];
    if (!t) return;
    writeForm({ ...SEARCH_DEFAULTS, ...t.s });
    q('.s-tpl-name').value = t.name;
    showTab('g');
    $status.textContent = `Loaded "${t.name}".`;
  };
  q('.s-tpl-del').onclick = () => {
    const l = tplLoad();
    if (tplSel < 0 || !l[tplSel]) return;
    l.splice(tplSel, 1);
    store.set('searchTemplates', l);
    tplSel = -1;
    tplRender();
  };
  tplRender();

  q('.s-cur').onclick = () => {
    const dirs = [...new Set(panels.map((p) => (p.arc || p.rem ? null : p.realDir())).filter(Boolean))];
    if (dirs.length) $dir.value = dirs.join(';');
  };

  $start.onclick = start;
  q('.s-goto').onclick = gotoFile;
  q('.s-close').onclick = close;
  $list.addEventListener('mousedown', (e) => { const r = e.target.closest('.s-row'); if (r) { markRow(+r.dataset.i); $list.focus(); } });
  $list.addEventListener('dblclick', (e) => { if (e.target.closest('.s-row')) gotoFile(); });

  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    const k = e.key;
    const inList = document.activeElement === $list;
    if (k === 'Escape') { e.preventDefault(); runningId ? stop() : close(); }
    else if (k === 'Enter') {
      const a = document.activeElement;
      if (a instanceof HTMLButtonElement || (a instanceof HTMLSelectElement) || (a && a.closest && a.closest('.s-tpl'))) return;
      e.preventDefault();
      if (inList) gotoFile(); else if (!runningId) start(); // Enter never stops a running search by accident (Esc / the Stop button do)
    } else if (inList && (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp' || k === 'Home' || k === 'End')) {
      e.preventDefault();
      const page = Math.max(1, Math.floor($list.clientHeight / 18) - 1);
      markRow(k === 'ArrowDown' ? cursor + 1 : k === 'ArrowUp' ? cursor - 1 : k === 'PageDown' ? cursor + page : k === 'PageUp' ? cursor - page : k === 'Home' ? 0 : results.length - 1);
    } else if (k === 'ArrowDown' && document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'text' && results.length && document.activeElement.list == null) {
      e.preventDefault();
      $list.focus();
    }
  });

  closeModal = openModal(box);
  showTab('g');
  $mask.focus();
  $mask.select();
}
