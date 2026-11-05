'use strict';
// Alt+F7 "Find Files" dialog. Uses helpers from app.js (A, P, esc, fmtNum, fmtDate, store, openModal, modalCount).

function openSearch() {
  if (modalCount > 0) return;
  const panel = A();
  if (needLocal('Find Files', panel)) return;
  const saved = store.get('search', { mask: '*', text: '', caseSens: false, subdirs: true, archives: false });

  const box = document.createElement('div');
  box.className = 'dlg search';
  box.innerHTML =
    '<div class="dlg-title">Find Files</div>' +
    '<div class="dlg-body">' +
    '<div class="s-grid">' +
    '<label>Search for:</label><input class="s-mask" spellcheck="false" placeholder="*.txt;*.md  (no wildcard = name contains)">' +
    '<label>Search in:</label><input class="s-dir" spellcheck="false">' +
    '<label>Find text:</label><input class="s-text" spellcheck="false" placeholder="optional: text inside files">' +
    '</div>' +
    '<div class="s-opts">' +
    '<label><input type="checkbox" class="s-sub"> Subfolders</label>' +
    '<label><input type="checkbox" class="s-arc"> Names in .zip archives</label>' +
    '<label><input type="checkbox" class="s-case"> Case sensitive text</label>' +
    '</div>' +
    '<div class="s-head"><div>Name</div><div>Folder</div><div class="r">Size</div><div>Date</div></div>' +
    '<div class="s-list" tabindex="0"></div>' +
    '<div class="s-status">Ready.</div>' +
    '</div>' +
    '<div class="dlg-btns"><button class="s-start primary">Start search</button><button class="s-goto">Go to file</button><button class="s-close">Close</button></div>';

  const q = (s) => box.querySelector(s);
  const $mask = q('.s-mask'), $dir = q('.s-dir'), $text = q('.s-text');
  const $sub = q('.s-sub'), $arc = q('.s-arc'), $case = q('.s-case');
  const $list = q('.s-list'), $status = q('.s-status'), $start = q('.s-start');
  $mask.value = saved.mask;
  $text.value = saved.text;
  $dir.value = panel.realDir();
  $sub.checked = saved.subdirs;
  $arc.checked = saved.archives;
  $case.checked = saved.caseSens;

  let results = [];
  let cursor = -1;
  let runningId = 0;
  let off = null;
  let closeModal;

  const row = (r) =>
    `<div class="s-row"><div class="s-n">${esc(r.name)}</div><div class="s-f">${esc(r.dir)}</div>` +
    `<div class="r">${r.isDir ? '&lt;DIR&gt;' : fmtNum(r.size)}</div><div>${fmtDate(r.mtime)}</div></div>`;

  function mark(i) {
    const rows = $list.children;
    if (cursor >= 0 && rows[cursor]) rows[cursor].classList.remove('cur');
    cursor = Math.max(0, Math.min(results.length - 1, i));
    if (rows[cursor]) {
      rows[cursor].classList.add('cur');
      rows[cursor].scrollIntoView({ block: 'nearest' });
    }
  }

  function append(items) {
    const start = results.length;
    results.push(...items);
    $list.insertAdjacentHTML('beforeend', items.map(row).join(''));
    for (let i = start; i < results.length; i++) $list.children[i].dataset.i = i;
    if (cursor < 0 && results.length) mark(0);
  }

  function stop() {
    if (runningId) api.cancelOp(runningId);
  }

  async function start() {
    if (runningId) return stop();
    const root = $dir.value.trim();
    if (!root) return;
    const st = await api.stat(root);
    if (!st.exists || !st.isDir) { $status.textContent = 'Folder not found: ' + root; return; }
    store.set('search', { mask: $mask.value, text: $text.value, caseSens: $case.checked, subdirs: $sub.checked, archives: $arc.checked });
    results = [];
    cursor = -1;
    $list.innerHTML = '';
    const id = (runningId = Date.now());
    $start.textContent = 'Stop';
    off = api.onSearch((b) => {
      if (b.id !== id) return;
      if (b.items.length) append(b.items);
      $status.textContent = (b.cur ? 'Searching: ' + b.cur + '  -  ' : '') + results.length + ' found';
    });
    const res = await api.search({
      id,
      root,
      masks: $mask.value,
      text: $text.value,
      caseSens: $case.checked,
      subdirs: $sub.checked,
      archives: $arc.checked,
    });
    if (off) off();
    off = null;
    runningId = 0;
    $start.textContent = 'Start search';
    $status.textContent = res.error
      ? 'Error: ' + res.error
      : `${res.cancelled ? 'Stopped' : 'Done'}: ${results.length} found in ${(res.ms / 1000).toFixed(1)} s`;
    if (results.length && !res.cancelled) $list.focus();
  }

  function close() {
    stop();
    if (off) off();
    store.set('search', { mask: $mask.value, text: $text.value, caseSens: $case.checked, subdirs: $sub.checked, archives: $arc.checked });
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

  $start.onclick = start;
  q('.s-goto').onclick = gotoFile;
  q('.s-close').onclick = close;
  $list.addEventListener('mousedown', (e) => {
    const r = e.target.closest('.s-row');
    if (r) { mark(+r.dataset.i); $list.focus(); }
  });
  $list.addEventListener('dblclick', (e) => { if (e.target.closest('.s-row')) gotoFile(); });

  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    const k = e.key;
    const inList = document.activeElement === $list;
    if (k === 'Escape') { e.preventDefault(); runningId ? stop() : close(); }
    else if (k === 'Enter') {
      if (document.activeElement instanceof HTMLButtonElement) return; // let the button handle it
      e.preventDefault();
      if (inList) gotoFile(); else start();
    } else if (inList && (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp' || k === 'Home' || k === 'End')) {
      e.preventDefault();
      const page = Math.max(1, Math.floor($list.clientHeight / 18) - 1);
      mark(k === 'ArrowDown' ? cursor + 1 : k === 'ArrowUp' ? cursor - 1 : k === 'PageDown' ? cursor + page : k === 'PageUp' ? cursor - page : k === 'Home' ? 0 : results.length - 1);
    } else if (k === 'ArrowDown' && document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'text' && results.length) {
      e.preventDefault();
      $list.focus();
    }
  });

  closeModal = openModal(box);
  $mask.focus();
  $mask.select();
}
