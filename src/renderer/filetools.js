'use strict';
// Dialogs of the Files menu: Change Attributes, Properties, Calculate Occupied Space, Edit Comment, Create / Verify Checksums,
// Split / Combine, Encode / Decode, Compare By Content, Test Archive(s). Engine: main/filetools.js.
// Uses helpers from app.js (A, O, P, esc, fmtNum, fmtDate, store, dialog, msg, openModal, modalCount, needLocal, panels, api).

const ftFull = (p, it) => P.join(p.dir, it.name);
const ftPaths = (p) => p.targets().map((i) => ftFull(p, i));
const ftBytes = (n) => (n >= 1024 ** 3 ? (n / 1024 ** 3).toFixed(2) + ' GB' : n >= 1024 ** 2 ? (n / 1024 ** 2).toFixed(2) + ' MB' : n >= 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' bytes');
const ftBig = (n) => `${fmtNum(n)} bytes${n >= 1024 ? ' (' + ftBytes(n) + ')' : ''}`;
/** folder of the other panel (the usual target); falls back to this panel's folder */
const ftOtherDir = () => { const o = O(); return o && !o.arc && !o.rem ? o.realDir() : A().realDir(); };
const ftNewId = () => Date.now() + Math.floor(Math.random() * 1000);

/** a small window with a message and a Cancel button for a long operation; cancel() stops the job in main */
function ftBusy(title, text, jobId) {
  const box = document.createElement('div');
  box.className = 'dlg';
  box.innerHTML = `<div class="dlg-title">${esc(title)}</div><div class="dlg-body"><div class="dlg-text">${esc(text)}</div></div><div class="dlg-btns"><button class="primary">Cancel</button></div>`;
  let closed = false;
  const close = openModal(box);
  const stop = () => { if (!closed) api.cancelOp(jobId); };
  box.querySelector('button').onclick = stop;
  box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); stop(); } });
  box.querySelector('button').focus();
  return { close: () => { if (!closed) { closed = true; close(); } } };
}

/** run fn(jobId) behind a busy window */
async function ftWithBusy(title, text, fn) {
  const id = ftNewId();
  const w = ftBusy(title, text, id);
  try { return await fn(id); } finally { w.close(); }
}

/** a form window: fields is HTML, returns the box and a promise-like helper */
function ftForm(title, bodyHtml, okLabel = 'OK') {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'dlg ft';
    box.innerHTML = `<div class="dlg-title">${esc(title)}</div><div class="dlg-body">${bodyHtml}</div><div class="dlg-btns"><button class="ft-ok primary">${esc(okLabel)}</button><button class="ft-cancel">Cancel</button></div>`;
    let close;
    const finish = (ok) => { const r = ok ? box : null; close(); resolve(r); };
    box.querySelector('.ft-ok').onclick = () => { box.__ok = true; finish(true); };
    box.querySelector('.ft-cancel').onclick = () => finish(false);
    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      else if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement) && !(document.activeElement instanceof HTMLSelectElement)) { e.preventDefault(); box.__ok = true; finish(true); }
    });
    close = openModal(box);
    const first = box.querySelector('input:not([type=checkbox]),select');
    (first || box.querySelector('.ft-ok')).focus();
  });
}

// ---------------------------------------------------------------- Change Attributes
async function ftAttributes() {
  if (modalCount > 0) return;
  const p = A();
  if (needLocal('Change Attributes', p)) return;
  const files = ftPaths(p);
  if (!files.length) return;
  const cur = await api.ftAttrsGet({ files });
  if (cur.error) return msg('Change Attributes', cur.error);
  const tri = (k, label, on) => `<label class="ft-chk"><input type="checkbox" class="ft-a-${k}"${on ? '' : ' disabled'}> ${label}</label>`;
  const dt = new Date(cur.mtime);
  const pad = (n) => String(n).padStart(2, '0');
  const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  const box = await ftForm('Change Attributes',
    `<div class="dlg-text">${files.length === 1 ? esc(P.basename(files[0])) : files.length + ' items'}</div>` +
    '<div class="ft-grid">' + tri('archive', 'Archive', cur.windows) + tri('ro', 'Read-only', true) + tri('hidden', 'Hidden', cur.windows || cur.mac) + tri('system', 'System', cur.windows) + '</div>' +
    '<div class="ft-line"><label class="ft-chk"><input type="checkbox" class="ft-setdate"> Change date and time:</label><input type="datetime-local" class="ft-date" value="' + local + '"></div>' +
    '<label class="ft-chk"><input type="checkbox" class="ft-rec"> Process subfolders (apply to everything inside)</label>');
  if (!box) return;
  const q = (s) => box.querySelector(s);
  // untouched tri-state boxes stay "leave as it is"
  const flags = {};
  for (const k of ['archive', 'ro', 'hidden', 'system']) flags[k] = q('.ft-a-' + k).disabled ? null : q('.ft-a-' + k).checked;
  const res = await api.ftAttrsSet({ files, recursive: q('.ft-rec').checked, flags: { ...flags, mtime: q('.ft-setdate').checked ? new Date(q('.ft-date').value).getTime() : null } });
  await Promise.all(panels.map((x) => x.refresh()));
  if (res.errors && res.errors.length) msg('Change Attributes', res.errors.slice(0, 8).join('\n'));
}

// ---------------------------------------------------------------- Properties (Alt+Enter)
async function ftProperties() {
  if (modalCount > 0) return;
  const p = A();
  if (needLocal('Properties', p)) return;
  const it = p.cur();
  if (!it || it.up) return;
  const file = ftFull(p, it);
  const r = await ftWithBusy('Properties', 'Reading ' + it.name + ' ...', (id) => api.ftProps({ file, id }));
  if (r.error) return msg('Properties', r.error);
  const rows = [
    ['Name', r.name], ['Folder', r.dir], ['Type', r.isDir ? 'Folder' : 'File'],
    ['Size', r.isDir ? `${ftBig(r.bytes)} in ${fmtNum(r.files)} file(s), ${fmtNum(r.dirs)} folder(s)${r.cancelled ? ' (stopped)' : ''}` : ftBig(r.size)],
    ['Modified', fmtDate(r.mtime) + ' ' + new Date(r.mtime).toLocaleTimeString()], ['Created', fmtDate(r.birth) + ' ' + new Date(r.birth).toLocaleTimeString()], ['Accessed', fmtDate(r.atime) + ' ' + new Date(r.atime).toLocaleTimeString()],
    ['Attributes', [r.ro ? 'read-only' : '', r.hidden ? 'hidden' : '', r.system ? 'system' : '', r.archive ? 'archive' : ''].filter(Boolean).join(', ') || '-'],
  ];
  const cm = await api.ftCommentGet({ dir: p.dir, name: it.name });
  if (cm.comment) rows.push(['Comment', cm.comment]);
  await dialog({ title: 'Properties', text: rows.map(([k, v]) => `${k.padEnd(11)} ${v}`).join('\n'), buttons: [{ label: 'Close', value: 'ok', primary: true, cancel: true }] });
}

// ---------------------------------------------------------------- Calculate Occupied Space (Ctrl+L)
async function ftCalcSpace() {
  if (modalCount > 0) return;
  const p = A();
  if (needLocal('Calculate Occupied Space', p)) return;
  const paths = p.sel.size || (p.cur() && !p.cur().up) ? ftPaths(p) : [];
  const list = paths.length ? paths : p.view.filter((i) => !i.up).map((i) => ftFull(p, i));
  if (!list.length) return;
  const r = await ftWithBusy('Calculate Occupied Space', 'Counting ...', (id) => api.ftSpace({ paths: list, id }));
  if (r.error) return msg('Calculate Occupied Space', r.error);
  await dialog({
    title: 'Calculate Occupied Space',
    text: `${r.cancelled ? 'Stopped. So far:\n\n' : ''}Files:            ${fmtNum(r.files)}\nFolders:          ${fmtNum(r.dirs)}\nTotal size:      ${ftBig(r.bytes)}\nOn disk (4 KB clusters): ${ftBig(r.onDisk)}`,
    buttons: [{ label: 'OK', value: 'ok', primary: true, cancel: true }],
  });
}

// ---------------------------------------------------------------- Edit Comment (Ctrl+Z)
async function ftComment() {
  if (modalCount > 0) return;
  const p = A();
  if (needLocal('Edit Comment', p)) return;
  const it = p.cur();
  if (!it || it.up) return;
  const old = await api.ftCommentGet({ dir: p.dir, name: it.name });
  const d = await dialog({ title: 'Edit Comment', text: `Comment for ${it.name} (kept in descript.ion):`, input: old.comment || '', buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }] });
  if (d.value !== 'ok') return;
  const r = await api.ftCommentSet({ dir: p.dir, name: it.name, comment: (d.input || '').trim() });
  if (r.error) msg('Edit Comment', r.error);
}

// ---------------------------------------------------------------- Checksums
async function ftChecksumCreate() {
  if (modalCount > 0) return;
  const p = A();
  if (needLocal('Create Checksum File(s)', p)) return;
  const files = ftPaths(p);
  if (!files.length) return;
  const box = await ftForm('Create Checksum File(s)',
    `<div class="dlg-text">${files.length === 1 ? esc(P.basename(files[0])) : files.length + ' items'}</div>` +
    '<div class="ft-line"><label>Algorithm:</label><select class="ft-algo"><option value="md5">MD5 (.md5)</option><option value="sha1">SHA-1 (.sha1)</option><option value="sha256">SHA-256 (.sha256)</option><option value="crc32">CRC32 (.sfv)</option></select></div>' +
    '<label class="ft-chk"><input type="checkbox" class="ft-sep"> Create a separate checksum file for each file</label>', 'Create');
  if (!box) return;
  const algo = box.querySelector('.ft-algo').value;
  const separate = box.querySelector('.ft-sep').checked;
  const r = await ftWithBusy('Create Checksum File(s)', 'Calculating ' + algo.toUpperCase() + ' ...', (id) => api.ftChecksumCreate({ files, algo, single: !separate, id }));
  await Promise.all(panels.map((x) => x.refresh()));
  if (r.error) msg('Create Checksum File(s)', r.error);
  else if (r.cancelled) msg('Create Checksum File(s)', 'Stopped.');
  else msg('Create Checksum File(s)', 'Created:\n' + r.created.map((f) => P.basename(f)).join('\n'));
}

async function ftChecksumVerify() {
  if (modalCount > 0) return;
  const p = A();
  if (needLocal('Verify Checksums', p)) return;
  const files = ftPaths(p).filter((f) => /\.(md5|sha1|sha256|sha512|sfv)$/i.test(f));
  if (!files.length) return msg('Verify Checksums', 'Select a checksum file (.md5, .sha1, .sha256, .sha512 or .sfv) first.');
  const lines = [];
  let bad = 0;
  for (const f of files) {
    const r = await ftWithBusy('Verify Checksums', 'Checking ' + P.basename(f) + ' ...', (id) => api.ftChecksumVerify({ file: f, id }));
    if (r.error) { lines.push(`${P.basename(f)}: ${r.error}`); bad++; continue; }
    for (const x of r.results) { if (!x.ok) bad++; lines.push(`${x.ok ? 'OK       ' : x.status.padEnd(9)} ${x.name}`); }
    if (r.cancelled) lines.push('(stopped)');
  }
  const head = bad ? `${bad} problem(s) found.` : 'All files are intact.';
  await dialog({ title: 'Verify Checksums', text: head + '\n\n' + lines.slice(0, 60).join('\n') + (lines.length > 60 ? '\n...' : ''), buttons: [{ label: 'OK', value: 'ok', primary: true, cancel: true }] });
}

// ---------------------------------------------------------------- Split / Combine
const ftParseSize = (s) => {
  const m = /^\s*([\d.,]+)\s*(b|k|kb|m|mb|g|gb)?\s*$/i.exec(s || '');
  if (!m) return 0;
  const n = parseFloat(m[1].replace(',', '.'));
  const u = (m[2] || 'b').toLowerCase()[0];
  return Math.floor(n * { b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[u]);
};
async function ftSplit() {
  if (modalCount > 0) return;
  const p = A();
  if (needLocal('Split File', p)) return;
  const it = p.cur();
  if (!it || it.isDir || it.up) return msg('Split File', 'Put the cursor on a file first.');
  const box = await ftForm('Split File',
    `<div class="dlg-text">${esc(it.name)}  (${ftBig(it.size)})</div>` +
    '<div class="ft-line"><label>Target folder:</label><input class="ft-dir" spellcheck="false"></div>' +
    '<div class="ft-line"><label>Part size:</label><input class="ft-size" spellcheck="false" value="100 MB"><select class="ft-pre"><option value="">presets</option><option>1.44 MB</option><option>10 MB</option><option>100 MB</option><option>650 MB</option><option>700 MB</option><option>4 GB</option></select></div>', 'Split');
  if (!box) return;
  const dest = box.querySelector('.ft-dir').value.trim() || ftOtherDir();
  const size = ftParseSize(box.querySelector('.ft-size').value);
  const r = await ftWithBusy('Split File', 'Splitting ...', (id) => api.ftSplit({ file: ftFull(p, it), partSize: size, destDir: dest, id }));
  await Promise.all(panels.map((x) => x.refresh()));
  if (r.error) msg('Split File', r.error);
  else msg('Split File', r.cancelled ? 'Stopped.' : `Done: ${r.parts.length} part(s) in\n${dest}`);
}
async function ftCombine() {
  if (modalCount > 0) return;
  const p = A();
  if (needLocal('Combine Files', p)) return;
  const it = p.cur();
  if (!it || !/\.\d{3,4}$/.test(it.name)) return msg('Combine Files', 'Put the cursor on the first part of a split file (name.001).');
  const dest = await dialog({ title: 'Combine Files', text: `Join ${it.name} and the following parts into the folder:`, input: ftOtherDir(), buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }] });
  if (dest.value !== 'ok') return;
  const r = await ftWithBusy('Combine Files', 'Joining ...', (id) => api.ftCombine({ first: ftFull(p, it), destDir: (dest.input || '').trim() || ftOtherDir(), id }));
  await Promise.all(panels.map((x) => x.refresh()));
  if (r.error) msg('Combine Files', r.error);
  else msg('Combine Files', r.cancelled ? 'Stopped.' : `Done: ${r.parts} part(s) joined into\n${P.basename(r.out)}`);
}

// ---------------------------------------------------------------- Encode / Decode
async function ftEncode() {
  if (modalCount > 0) return;
  const p = A();
  if (needLocal('Encode File', p)) return;
  const files = ftPaths(p).filter((f) => true);
  const it = p.cur();
  if (!it || it.isDir || it.up) return msg('Encode File', 'Put the cursor on a file first.');
  const box = await ftForm('Encode File',
    `<div class="dlg-text">${esc(it.name)}</div><div class="ft-line"><label>Format:</label><select class="ft-kind"><option value="b64">MIME (Base64)  - .b64</option><option value="uue">UUE  - .uue</option></select></div>` +
    '<div class="ft-line"><label>Target folder:</label><input class="ft-dir" spellcheck="false"></div>', 'Encode');
  if (!box) return;
  const r = await api.ftEncode({ file: ftFull(p, it), kind: box.querySelector('.ft-kind').value, destDir: box.querySelector('.ft-dir').value.trim() || p.realDir() });
  await Promise.all(panels.map((x) => x.refresh()));
  msg('Encode File', r.error || 'Created ' + P.basename(r.out));
  void files;
}
async function ftDecode() {
  if (modalCount > 0) return;
  const p = A();
  if (needLocal('Decode File', p)) return;
  const it = p.cur();
  if (!it || it.isDir || it.up) return msg('Decode File', 'Put the cursor on an encoded file (.b64, .uue, ...) first.');
  const dest = await dialog({ title: 'Decode File', text: `Decode ${it.name} (MIME / Base64 or UUE) into the folder:`, input: ftOtherDir(), buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }] });
  if (dest.value !== 'ok') return;
  const r = await api.ftDecode({ file: ftFull(p, it), destDir: (dest.input || '').trim() || ftOtherDir() });
  await Promise.all(panels.map((x) => x.refresh()));
  msg('Decode File', r.error || 'Created ' + P.basename(r.out));
}

// ---------------------------------------------------------------- Compare By Content
async function ftCompare() {
  if (modalCount > 0) return;
  const p = A(), o = O();
  if (needLocal('Compare By Content', p)) return;
  let a, b;
  const sel = p.targets().filter((i) => !i.isDir && !i.up);
  if (sel.length === 2) [a, b] = sel.map((i) => ftFull(p, i));
  else {
    const ia = p.cur(), ib = o && !o.arc && !o.rem ? o.cur() : null;
    if (ia && ib && !ia.isDir && !ib.isDir && !ia.up && !ib.up) { a = ftFull(p, ia); b = ftFull(o, ib); }
  }
  if (!a || !b) return msg('Compare By Content', 'Select two files in one panel, or put the cursor on a file in each panel.');
  const r = await api.ftCompare({ a, b });
  if (r.error) return msg('Compare By Content', r.error);
  if (r.same) return msg('Compare By Content', `The files are identical.\n${ftBig(r.size)}`);
  if (r.binary) return msg('Compare By Content', `The files differ (binary).\nFirst difference at offset ${r.offset} (0x${r.offset.toString(16)}).\n${P.basename(a)}: ${ftBig(r.sizeA)}\n${P.basename(b)}: ${ftBig(r.sizeB)}`);
  ftDiffView(a, b, r);
}

function ftDiffView(a, b, r) {
  const box = document.createElement('div');
  box.className = 'viewer';
  let n = 0;
  const rowsHtml = r.diff.map((d, i) => {
    if (d.t === '=') { n++; return `<div class="df-r"><div class="df-n">${n}</div><div class="df-l">${esc(d.a)}</div><div class="df-l">${esc(d.b)}</div></div>`; }
    if (d.t === '-') return `<div class="df-r del" data-d="1"><div class="df-n"></div><div class="df-l">${esc(d.a)}</div><div class="df-l"></div></div>`;
    return `<div class="df-r add" data-d="1"><div class="df-n"></div><div class="df-l"></div><div class="df-l">${esc(d.b)}</div></div>`;
  });
  const changes = r.diff.filter((d) => d.t !== '=').length;
  box.innerHTML =
    `<div class="v-bar"><span class="v-name">Compare By Content</span><span class="v-info">${changes} different line(s)${r.truncated ? ' (first 20000 shown)' : ''}</span><span class="v-sp"></span><button class="df-next" title="Next difference (F7)">Next difference</button><button class="v-x">Close</button></div>` +
    `<div class="df-head"><div></div><div>${esc(a)}</div><div>${esc(b)}</div></div><div class="df-body">${rowsHtml.join('')}</div>` +
    '<div class="v-foot"><span class="v-hint">Esc close &nbsp; F7 / n next difference &nbsp; red = only in the left file, green = only in the right file</span></div>';
  document.body.appendChild(box);
  modalCount++;
  const body = box.querySelector('.df-body');
  const diffs = [...body.querySelectorAll('[data-d]')];
  let at = -1;
  const next = () => { if (!diffs.length) return; at = (at + 1) % diffs.length; diffs[at].scrollIntoView({ block: 'center' }); };
  const close = () => { document.removeEventListener('keydown', onKey, true); box.remove(); modalCount--; };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'F7' || e.key.toLowerCase() === 'n') { e.preventDefault(); e.stopPropagation(); next(); }
  };
  document.addEventListener('keydown', onKey, true);
  box.querySelector('.v-x').onclick = close;
  box.querySelector('.df-next').onclick = next;
  next();
}

// ---------------------------------------------------------------- Test Archive(s)
async function ftTestArchives() {
  if (modalCount > 0) return;
  const p = A();
  if (needLocal('Test Archive(s)', p)) return;
  const files = ftPaths(p).filter((f) => /\.(zip|jar|docx|xlsx|pptx|odt|ods|odp|apk)$/i.test(f));
  if (!files.length) return msg('Test Archive(s)', 'Select one or more zip archives first.');
  const lines = [];
  let problems = 0;
  for (const f of files) {
    const r = await ftWithBusy('Test Archive(s)', 'Testing ' + P.basename(f) + ' ...', (id) => api.ftTestArchive({ file: f, id }));
    if (r.error) { lines.push(`${P.basename(f)}: ${r.error}`); problems++; }
    else if (r.bad.length) { problems++; lines.push(`${P.basename(f)}: ${r.bad.length} bad file(s)`, ...r.bad.slice(0, 8).map((x) => '    ' + x)); }
    else lines.push(`${P.basename(f)}: OK (${r.files} file(s))`);
  }
  await dialog({ title: 'Test Archive(s)', text: (problems ? `${problems} archive(s) have problems.` : 'All archives are fine.') + '\n\n' + lines.join('\n'), buttons: [{ label: 'OK', value: 'ok', primary: true, cancel: true }] });
}

// ---------------------------------------------------------------- updates
/** silent = the check made at start-up: say nothing unless a newer version exists */
async function checkForUpdates(silent) {
  if (modalCount > 0) return;
  const r = await api.updateCheck();
  if (r.error) { if (!silent) msg('Check for Updates', 'Could not check for updates: ' + r.error); return; }
  if (!r.newer) { if (!silent) msg('Check for Updates', `You have the latest version (${r.current}).`); return; }
  if (silent && store.get('updateSkip', '') === r.latest) return; // "Skip this version" was chosen
  const notes = r.info && r.info.notes ? '\n\n' + r.info.notes : '';
  const how = r.platform === 'darwin' ? 'A Terminal window will open and install the new version.' : 'The installer is downloaded and started; the program restarts by itself.';
  const d = await dialog({
    title: 'Update available',
    text: `Version ${r.latest} is available (you have ${r.current}).${notes}\n\n${how}`,
    buttons: [{ label: 'Update now', value: 'go', primary: true }, { label: 'Later', value: 'later', cancel: true }, { label: 'Skip this version', value: 'skip' }],
  });
  if (d.value === 'skip') { store.set('updateSkip', r.latest); return; }
  if (d.value !== 'go') return;
  const box = document.createElement('div');
  box.className = 'dlg';
  box.innerHTML = '<div class="dlg-title">Updating</div><div class="dlg-body"><div class="dlg-text up-text">Downloading ...</div></div>';
  const close = openModal(box);
  const off = api.onUpdateProgress((p) => {
    const t = box.querySelector('.up-text');
    if (t && p.total) t.textContent = `Downloading ... ${Math.floor((p.done / p.total) * 100)} %  (${ftBytes(p.done)} of ${ftBytes(p.total)})`;
  });
  const res = await api.updateInstall({ info: r.info });
  off();
  if (res.error) { close(); msg('Update', res.error); return; }
  box.querySelector('.up-text').textContent = res.terminal ? 'Follow the Terminal window ...' : 'Installing the new version, the program restarts ...';
  if (res.terminal) setTimeout(close, 2500);
}

// ---------------------------------------------------------------- ZX Spectrum emulator (Unreal Speccy Portable)
const SPECCY_EXT = new Set(['trd', 'scl', 'tap', 'tzx', 'z80', 'sna', 'szx', 'fdi', 'td0', 'udi', 'csw', 'hob']);
const isSpeccyFile = (n) => SPECCY_EXT.has(splitExt(n)[1].toLowerCase());
async function openEmulator(file) {
  const r = await api.emuOpen({ file });
  if (r && r.error) msg('ZX Spectrum emulator', r.error);
}

// ---------------------------------------------------------------- import of WinSCP sessions (Net > Import from WinSCP...)
async function openWinscpImport(iniPath) {
  if (modalCount > 0) return;
  const r = await api.winscpList({ iniPath });
  if (r.error) return msg('Import from WinSCP', r.error);
  if (!r.sessions.length) {
    const d = await dialog({ title: 'Import from WinSCP', text: 'No WinSCP sessions were found (registry and WinSCP.ini).\nIf you use a portable WinSCP, choose its WinSCP.ini file.', buttons: [{ label: 'Choose WinSCP.ini...', value: 'pick', primary: true }, { label: 'Cancel', value: 'no', cancel: true }] });
    if (d.value !== 'pick') return;
    const f = await api.openFileDialog({ title: 'Select WinSCP.ini', defaultPath: api.home });
    return f ? openWinscpImport(f) : undefined;
  }
  const have = (nasLoad() || []).filter((c) => connType(c) === 'ssh');
  const exists = (s) => have.some((c) => (c.url || '').toLowerCase() === s.host.toLowerCase() && (c.user || '') === s.user && String(c.port || 22) === String(s.port));
  const rows = r.sessions.map((s, i) => {
    const dup = exists(s);
    return `<label class="ft-chk wsc-row"><input type="checkbox" data-i="${i}"${s.importable && !dup ? ' checked' : ''}${s.importable ? '' : ' disabled'}> <b>${esc(s.name)}</b> <span class="s-hint">${esc(s.user)}@${esc(s.host)}:${s.port} - ${esc(s.protocol)}${dup ? ' (already added)' : ''}${s.importable ? '' : ' (not supported)'}</span></label>`;
  }).join('');
  const box = await ftForm('Import from WinSCP', `<div class="dlg-text">${r.sessions.length} session(s) found (${esc(r.source === 'registry' ? 'registry' : r.source)}). Passwords are not imported: enter them at the first connection.</div><div class="wsc-list">${rows}</div>`, 'Import');
  if (!box) return;
  const chosen = [...box.querySelectorAll('input[type=checkbox]:checked')].map((c) => r.sessions[+c.dataset.i]);
  if (!chosen.length) return;
  const list = nasLoad();
  for (const s of chosen) list.push({ id: nasNewId(), type: 'ssh', name: s.name, url: s.host, port: String(s.port), user: s.user, keyPath: s.keyFile, openAs: 'files', insecure: false, appKey: '', clientId: '', sec: '', remember: false, pw: '' });
  nasSave(list);
  msg('Import from WinSCP', `${chosen.length} connection(s) added to Net > SSH server... (the key files are used as they are, passwords are asked at the first connection).`);
}
