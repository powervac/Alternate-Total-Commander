'use strict';
// Ctrl+M "Multi-Rename Tool". Uses helpers from app.js (A, P, esc, splitExt, openModal, modalCount, msg, api, isMac).

const mrFold = (s) => (isMac || api.platform === 'win32' ? s.toLowerCase() : s);
const MR_BAD = /[\\/:*?"<>|\u0000-\u001f]/;

/** [N1-3] style slice: "" whole, "a" one char, "a-b" range, "a-" to the end, "a,l" start+length */
function mrSlice(str, spec) {
  if (!spec) return str;
  let m;
  if ((m = /^(\d+)$/.exec(spec))) return str.charAt(+m[1] - 1);
  if ((m = /^(\d+)-(\d*)$/.exec(spec))) return str.slice(Math.max(0, +m[1] - 1), m[2] ? +m[2] : undefined);
  if ((m = /^(\d+),(\d+)$/.exec(spec))) return str.substr(Math.max(0, +m[1] - 1), +m[2]);
  return null; // unknown form
}

function mrExpand(mask, f) {
  const d = new Date(f.mtime);
  const p2 = (n) => String(n).padStart(2, '0');
  return mask.replace(/\[([^\]]*)\]/g, (whole, inner) => {
    if (inner === 'YMD') return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    if (inner === 'hms') return `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    const m = /^([A-Za-z])(.*)$/.exec(inner);
    if (!m) return whole;
    const [, c, spec] = m;
    if (c === 'N' || c === 'E') {
      const r = mrSlice(c === 'N' ? f.base : f.ext, spec);
      return r === null ? whole : r;
    }
    if (spec) return whole;
    switch (c) {
      case 'C': return f.counter;
      case 'P': return f.parent;
      case 'Y': return String(d.getFullYear());
      case 'y': return p2(d.getFullYear() % 100);
      case 'M': return p2(d.getMonth() + 1);
      case 'D': return p2(d.getDate());
      case 'h': return p2(d.getHours());
      case 'm': return p2(d.getMinutes());
      case 's': return p2(d.getSeconds());
      case 'd': return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
      case 't': return `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
      default: return whole;
    }
  });
}

function mrCase(s, mode) {
  if (mode === 'upper') return s.toUpperCase();
  if (mode === 'lower') return s.toLowerCase();
  if (mode === 'first') return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (mode === 'words') return s.toLowerCase().replace(/(^|[\s._\-(\[])(\S)/g, (_m, a, b) => a + b.toUpperCase());
  return s;
}

/**
 * items: [{name,isDir,mtime}], o: options, parent: folder name, others: Set of folded names that stay in the folder
 * returns { rows: [{old, name, status}], error }  status: '', 'same', 'bad', 'dup', 'exists'
 */
function mrCompute(items, o, parent, others) {
  let re = null;
  if (o.search) {
    try {
      re = new RegExp(o.regex ? o.search : o.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), (o.once ? '' : 'g') + (o.caseSens ? '' : 'i'));
    } catch (e) {
      return { rows: [], error: 'Invalid regular expression' };
    }
  }
  const repl = o.regex ? o.replace : o.replace.replace(/\$/g, '$$$$');
  let counter = o.start;
  const rows = items.map((it) => {
    let s = it.name;
    if (re) {
      if (o.inExt !== false || it.isDir) s = s.replace(re, repl);
      else { const [sb, se] = splitExt(s); s = sb.replace(re, repl) + (se ? '.' + se : ''); } // [E] unchecked: the search does not touch the extension
    }
    const [base, ext] = it.isDir ? [s, ''] : splitExt(s);
    const f = { base, ext, mtime: it.mtime, parent, counter: String(counter).padStart(o.digits, '0') };
    const nb = mrExpand(o.maskName, f);
    const ne = it.isDir ? '' : mrExpand(o.maskExt, f);
    let name = ne ? nb + '.' + ne : nb;
    name = mrCase(name, o.caseMode);
    counter += o.step;
    return { old: it.name, name, status: '' };
  });
  const seen = new Map();
  for (const r of rows) seen.set(mrFold(r.name), (seen.get(mrFold(r.name)) || 0) + 1);
  for (const r of rows) {
    if (r.name === r.old) r.status = 'same';
    else if (!r.name || r.name === '.' || r.name === '..' || MR_BAD.test(r.name) || r.name.length > 255) r.status = 'bad';
    else if (seen.get(mrFold(r.name)) > 1) r.status = 'dup';
    else if (others.has(mrFold(r.name))) r.status = 'exists';
  }
  return { rows, error: '' };
}

let mrLast = null; // { dir, pairs: [{from, to}] } of the last rename: Undo goes back

function openMultiRename() {
  if (modalCount > 0) return;
  const panel = A();
  if (needLocal('Multi-Rename', panel)) return;
  if (panel.arc) return msg('Multi-Rename', 'Renaming inside an archive is not supported here. Use Shift+F6 for single items.');
  const items = panel.targets();
  if (!items.length) return;
  const selected = new Set(items.map((i) => mrFold(i.name)));
  const others = new Set(panel.items.filter((i) => !selected.has(mrFold(i.name))).map((i) => mrFold(i.name)));
  const parent = P.basename(panel.dir) || panel.dir;
  const byName = new Map(items.map((i) => [i.name, i]));
  const presets = () => { const v = store.get('mrPresets', []); return Array.isArray(v) ? v : []; };

  const btn = (t, tok) => `<button type="button" class="mr-ins" data-t="${esc(tok)}">${esc(t)}</button>`;
  const box = document.createElement('div');
  box.className = 'dlg mr';
  box.innerHTML =
    '<div class="dlg-title">Multi-Rename Tool</div>' +
    '<div class="dlg-body">' +
    '<div class="mr-top">' +
    '<fieldset class="mr-f"><legend>Rename mask: file name</legend><input class="mr-nm" spellcheck="false" value="[N]">' +
    '<div class="mr-btns">' + btn('[N] Name', '[N]') + btn('[N#-#] Range', '[N1-3]') + btn('[C] Counter', '[C]') + btn('[YMD] Date', '[YMD]') + btn('[hms] Time', '[hms]') + btn('[P] Folder', '[P]') + '</div></fieldset>' +
    '<fieldset class="mr-f"><legend>Extension</legend><input class="mr-em" spellcheck="false" value="[E]">' +
    '<div class="mr-btns">' + btn('[E] Ext.', '[E]') + btn('[E#-#] Range', '[E1-2]') + btn('[C] Counter', '[C]') + '</div></fieldset>' +
    '<fieldset class="mr-f"><legend>Search &amp; Replace</legend>' +
    '<div class="mr-sr"><label>Search for:</label><input class="mr-s" spellcheck="false"><label>Replace with:</label><input class="mr-r" spellcheck="false"></div>' +
    '<div class="mr-chk"><label><input type="checkbox" class="mr-1x"> 1x</label><label><input type="checkbox" class="mr-ie" checked> [E]</label><label><input type="checkbox" class="mr-re"> RegEx</label><label><input type="checkbox" class="mr-cs"> Match case</label></div></fieldset>' +
    '<fieldset class="mr-f mr-cnt"><legend>Define counter [C]</legend><label>Start at: <input type="number" class="mr-cst" value="1" min="0"></label><label>Step by: <input type="number" class="mr-cstep" value="1"></label><label>Digits: <input type="number" class="mr-cd" value="1" min="1" max="10"></label></fieldset>' +
    '</div>' +
    '<div class="mr-row2"><label>Upper/lowercase: <select class="mr-case"><option value="keep">Unchanged</option><option value="upper">UPPERCASE</option><option value="lower">lowercase</option><option value="first">First letter upper</option><option value="words">Each Word Upper</option></select></label>' +
    '<span class="mr-help">[N] name  [E] ext  [N2-5] chars  [C] counter  [P] folder  [YMD] date  [hms] time</span>' +
    '<select class="mr-pre"></select><button type="button" class="mr-save">Save settings...</button></div>' +
    '<div class="s-head mr6"><div>Old name</div><div>Ext.</div><div>New name</div><div class="r">Size</div><div>Date</div><div>Location</div></div>' +
    '<div class="s-list mr-list"></div>' +
    '<div class="s-status mr-status"></div>' +
    '</div>' +
    '<div class="dlg-btns"><button class="mr-start primary">Start!</button><button class="mr-undo">Undo</button><button class="mr-result">Result list</button><button class="mr-reset">Reset</button><button class="mr-close">Close</button></div>';
  const q = (s) => box.querySelector(s);
  const $nm = q('.mr-nm'), $em = q('.mr-em'), $s = q('.mr-s'), $r = q('.mr-r');
  const $re = q('.mr-re'), $cs = q('.mr-cs'), $case = q('.mr-case'), $1x = q('.mr-1x'), $ie = q('.mr-ie');
  const $cst = q('.mr-cst'), $cstep = q('.mr-cstep'), $cd = q('.mr-cd');
  const $list = q('.mr-list'), $status = q('.mr-status'), $start = q('.mr-start'), $undo = q('.mr-undo'), $pre = q('.mr-pre');
  let rows = [];
  let lastLog = [];
  let closeModal;
  let lastMask = $nm;

  const LABEL = { bad: 'invalid name', dup: 'duplicate name', exists: 'already exists' };
  const getOpts = () => ({
    maskName: $nm.value, maskExt: $em.value, search: $s.value, replace: $r.value, regex: $re.checked, caseSens: $cs.checked, once: $1x.checked, inExt: $ie.checked,
    caseMode: $case.value, start: parseInt($cst.value, 10) || 0, step: parseInt($cstep.value, 10) || 0, digits: Math.max(1, Math.min(10, parseInt($cd.value, 10) || 1)),
  });
  const setOpts = (o) => {
    $nm.value = o.maskName; $em.value = o.maskExt; $s.value = o.search; $r.value = o.replace; $re.checked = !!o.regex; $cs.checked = !!o.caseSens; $1x.checked = !!o.once; $ie.checked = o.inExt !== false;
    $case.value = o.caseMode; $cst.value = o.start; $cstep.value = o.step; $cd.value = o.digits;
  };
  function fillPresets() {
    $pre.innerHTML = '<option value="">Load settings...</option>' + presets().map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('');
  }

  function recompute() {
    const res = mrCompute(items, getOpts(), parent, others);
    rows = res.rows;
    $undo.disabled = !mrLast || mrLast.dir !== panel.dir;
    if (res.error) {
      $list.innerHTML = '';
      $status.textContent = res.error;
      $start.disabled = true;
      return;
    }
    $list.innerHTML = rows
      .map((r) => {
        const it = byName.get(r.old);
        const [ob, oe] = it && !it.isDir ? splitExt(r.old) : [r.old, ''];
        return `<div class="s-row mr-row mr6 ${r.status}"><div>${esc(ob)}</div><div>${esc(oe)}</div><div>${esc(r.name)}${LABEL[r.status] ? '  <i>(' + LABEL[r.status] + ')</i>' : ''}</div>` +
          `<div class="r">${it && !it.isDir ? fmtNum(it.size) : '&lt;DIR&gt;'}</div><div>${it ? fmtDate(it.mtime) : ''}</div><div>${esc(panel.dir)}</div></div>`;
      })
      .join('');
    const changed = rows.filter((r) => r.status === '').length;
    const bad = rows.filter((r) => LABEL[r.status]).length;
    $start.disabled = bad > 0 || changed === 0;
    $status.textContent = bad ? `${bad} name(s) cannot be used - fix the masks` : changed ? `${changed} of ${rows.length} will be renamed` : "Please press 'Start!' to start renaming!";
    if (!bad && !changed) $status.textContent = 'Nothing to rename yet';
  }

  async function start() {
    if ($start.disabled) return;
    const pairs = rows.filter((r) => r.status === '').map((r) => ({ from: r.old, to: r.name }));
    const keepNew = new Set(pairs.map((p) => p.to));
    const dir = panel.dir;
    closeModal();
    const res = await api.renameBatch({ dir, pairs });
    mrLast = { dir, pairs: pairs.map((p) => ({ from: p.to, to: p.from })) }; // Undo = the same thing backwards
    mrLastLog = pairs.map((p) => `${p.from}  ->  ${p.to}`);
    await Promise.all(panels.map((p) => p.refresh()));
    panel.sel = new Set();
    panel.selectWhere((i) => keepNew.has(i.name), true);
    if (res.errors.length) await msg('Error', res.errors.slice(0, 8).join('\n'));
  }

  async function undo() {
    if (!mrLast || mrLast.dir !== panel.dir) return;
    const { dir, pairs } = mrLast;
    mrLast = null;
    closeModal();
    const res = await api.renameBatch({ dir, pairs });
    await Promise.all(panels.map((p) => p.refresh()));
    if (res.errors.length) await msg('Undo', res.errors.slice(0, 8).join('\n'));
  }

  function reset() {
    setOpts({ maskName: '[N]', maskExt: '[E]', search: '', replace: '', regex: false, caseSens: false, once: false, inExt: true, caseMode: 'keep', start: 1, step: 1, digits: 1 });
    recompute();
  }

  // buttons that insert a mask token into the mask field that was used last
  for (const b of box.querySelectorAll('.mr-ins')) {
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => {
      const f = lastMask;
      const s = f.selectionStart, e2 = f.selectionEnd;
      f.value = f.value.slice(0, s) + b.dataset.t + f.value.slice(e2);
      f.focus();
      f.setSelectionRange(s + b.dataset.t.length, s + b.dataset.t.length);
      recompute();
    };
  }
  $nm.addEventListener('focus', () => (lastMask = $nm));
  $em.addEventListener('focus', () => (lastMask = $em));

  q('.mr-save').onclick = async () => {
    const d = await dialog({ title: 'Save settings', text: 'Name of the settings:', input: '', buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }] });
    const name = d.input && d.input.trim();
    if (d.value !== 'ok' || !name) return;
    const l = presets().filter((p) => p.name !== name);
    l.push({ name, o: getOpts() });
    store.set('mrPresets', l);
    fillPresets();
    $pre.value = String(l.length - 1);
  };
  $pre.onchange = () => {
    const p = presets()[+$pre.value];
    if (p) { setOpts(p.o); recompute(); }
  };
  q('.mr-result').onclick = () => msg('Result list', mrLastLog.length ? mrLastLog.slice(0, 200).join('\n') : 'Nothing has been renamed yet.');
  box.addEventListener('input', recompute);
  box.addEventListener('change', (e) => { if (e.target !== $pre) recompute(); });
  $start.onclick = start;
  $undo.onclick = undo;
  q('.mr-reset').onclick = reset;
  q('.mr-close').onclick = () => closeModal();
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    else if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement) && !(document.activeElement instanceof HTMLSelectElement)) { e.preventDefault(); start(); }
  });

  closeModal = openModal(box);
  fillPresets();
  recompute();
  $nm.focus();
  $nm.setSelectionRange($nm.value.length, $nm.value.length);
}
let mrLastLog = [];
