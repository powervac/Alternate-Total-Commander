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
      re = new RegExp(o.regex ? o.search : o.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.caseSens ? 'g' : 'gi');
    } catch (e) {
      return { rows: [], error: 'Invalid regular expression' };
    }
  }
  const repl = o.regex ? o.replace : o.replace.replace(/\$/g, '$$$$');
  let counter = o.start;
  const rows = items.map((it) => {
    let s = it.name;
    if (re) s = s.replace(re, repl);
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

  const box = document.createElement('div');
  box.className = 'dlg mr';
  box.innerHTML =
    '<div class="dlg-title">Multi-Rename Tool</div>' +
    '<div class="dlg-body">' +
    '<div class="mr-grid">' +
    '<label>File name mask:</label><input class="mr-nm" spellcheck="false" value="[N]">' +
    '<label>Extension mask:</label><input class="mr-em" spellcheck="false" value="[E]">' +
    '<label>Search for:</label><input class="mr-s" spellcheck="false">' +
    '<label>Replace with:</label><input class="mr-r" spellcheck="false">' +
    '</div>' +
    '<div class="mr-opts">' +
    '<label><input type="checkbox" class="mr-re"> Regular expressions</label>' +
    '<label><input type="checkbox" class="mr-cs"> Case sensitive</label>' +
    '<label>Case: <select class="mr-case"><option value="keep">unchanged</option><option value="upper">UPPERCASE</option><option value="lower">lowercase</option><option value="first">First letter upper</option><option value="words">Each Word Upper</option></select></label>' +
    '<label>Counter: start <input type="number" class="mr-cst" value="1" min="0"> step <input type="number" class="mr-cstep" value="1"> digits <input type="number" class="mr-cd" value="1" min="1" max="10"></label>' +
    '</div>' +
    '<div class="mr-help">[N] name  [E] extension  [N1-3] chars 1..3  [N2-] from 2  [N2,3] 3 chars from 2  [C] counter  [P] folder  [Y][M][D] [h][m][s] file date/time  [d] [t]</div>' +
    '<div class="s-head"><div>Old name</div><div>New name</div></div>' +
    '<div class="s-list mr-list"></div>' +
    '<div class="s-status mr-status"></div>' +
    '</div>' +
    '<div class="dlg-btns"><button class="mr-start primary">Start!</button><button class="mr-reset">Reset</button><button class="mr-close">Close</button></div>';
  const q = (s) => box.querySelector(s);
  const $nm = q('.mr-nm'), $em = q('.mr-em'), $s = q('.mr-s'), $r = q('.mr-r');
  const $re = q('.mr-re'), $cs = q('.mr-cs'), $case = q('.mr-case');
  const $cst = q('.mr-cst'), $cstep = q('.mr-cstep'), $cd = q('.mr-cd');
  const $list = q('.mr-list'), $status = q('.mr-status'), $start = q('.mr-start');
  let rows = [];
  let closeModal;

  const LABEL = { bad: 'invalid name', dup: 'duplicate name', exists: 'already exists' };

  function recompute() {
    const o = {
      maskName: $nm.value,
      maskExt: $em.value,
      search: $s.value,
      replace: $r.value,
      regex: $re.checked,
      caseSens: $cs.checked,
      caseMode: $case.value,
      start: parseInt($cst.value, 10) || 0,
      step: parseInt($cstep.value, 10) || 0,
      digits: Math.max(1, Math.min(10, parseInt($cd.value, 10) || 1)),
    };
    const res = mrCompute(items, o, parent, others);
    rows = res.rows;
    if (res.error) {
      $list.innerHTML = '';
      $status.textContent = res.error;
      $start.disabled = true;
      return;
    }
    $list.innerHTML = rows
      .map((r) => `<div class="s-row mr-row ${r.status}"><div>${esc(r.old)}</div><div>${esc(r.name)}${LABEL[r.status] ? '  <i>(' + LABEL[r.status] + ')</i>' : ''}</div></div>`)
      .join('');
    const changed = rows.filter((r) => r.status === '').length;
    const bad = rows.filter((r) => LABEL[r.status]).length;
    $start.disabled = bad > 0 || changed === 0;
    $status.textContent = bad ? `${bad} name(s) cannot be used - fix the masks` : changed ? `${changed} of ${rows.length} will be renamed` : 'Nothing to rename yet';
  }

  async function start() {
    if ($start.disabled) return;
    const pairs = rows.filter((r) => r.status === '').map((r) => ({ from: r.old, to: r.name }));
    const keepNew = new Set(pairs.map((p) => p.to));
    const dir = panel.dir;
    closeModal();
    const res = await api.renameBatch({ dir, pairs });
    await Promise.all(panels.map((p) => p.refresh()));
    panel.sel = new Set();
    panel.selectWhere((i) => keepNew.has(i.name), true);
    if (res.errors.length) await msg('Error', res.errors.slice(0, 8).join('\n'));
  }

  function reset() {
    $nm.value = '[N]';
    $em.value = '[E]';
    $s.value = '';
    $r.value = '';
    $re.checked = false;
    $cs.checked = false;
    $case.value = 'keep';
    $cst.value = 1;
    $cstep.value = 1;
    $cd.value = 1;
    recompute();
  }

  box.addEventListener('input', recompute);
  box.addEventListener('change', recompute);
  $start.onclick = start;
  q('.mr-reset').onclick = reset;
  q('.mr-close').onclick = () => closeModal();
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    else if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) { e.preventDefault(); start(); }
  });

  closeModal = openModal(box);
  recompute();
  $nm.focus();
  $nm.setSelectionRange($nm.value.length, $nm.value.length);
}
