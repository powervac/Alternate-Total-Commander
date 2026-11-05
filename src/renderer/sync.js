'use strict';
// Mark > Compare Directories (Shift+F2) and Commands > Synchronize Dirs.
// Uses helpers from app.js (panels, A, P, esc, fmtNum, fmtDate, openModal, modalCount, msg, dialog, withProgress, api).

const SYNC_TOL = 2000;

/** Shift+F2: select, in both panels, the files that are missing in the other panel or newer / different */
function compareDirectories() {
  const [pl, pr] = panels;
  if (needLocal('Compare Directories', pl, pr)) return;
  if (pl.arc || pr.arc) return msg('Compare Directories', 'Open normal folders in both panels.');
  const fold = (s) => (isMac || api.platform === 'win32' ? s.toLowerCase() : s);
  const idx = (p) => new Map(p.items.filter((i) => !i.isDir).map((i) => [fold(i.name), i]));
  const L = idx(pl), R = idx(pr);
  const pick = (mine, other) => {
    const names = new Set();
    for (const [k, it] of mine) {
      const o = other.get(k);
      if (!o) names.add(it.name);
      else if (it.mtime - o.mtime > SYNC_TOL) names.add(it.name);
      else if (Math.abs(it.mtime - o.mtime) <= SYNC_TOL && it.size !== o.size) names.add(it.name);
    }
    return names;
  };
  const selL = pick(L, R), selR = pick(R, L);
  pl.selectWhere((i) => !i.isDir && selL.has(i.name), true);
  pr.selectWhere((i) => !i.isDir && selR.has(i.name), true);
  // unselect everything else so the result is exactly the difference
  pl.selectWhere((i) => i.isDir || !selL.has(i.name), false);
  pr.selectWhere((i) => i.isDir || !selR.has(i.name), false);
  pl.updateStatus();
  pr.updateStatus();
}

const SYNC_ARROW = { R: '→', L: '←', '': '' };
const SYNC_LABEL = { eq: '=', diff: '≠', left: '', right: '', newerL: '', newerR: '' };

function openSync() {
  if (modalCount > 0) return;
  const [pl, pr] = panels;
  if (needLocal('Synchronize Dirs', pl, pr)) return;
  if (pl.arc || pr.arc) return msg('Synchronize Dirs', 'Open normal folders (not archives) in both panels.');
  const left = pl.dir, right = pr.dir;
  const fold = (s) => (isMac || api.platform === 'win32' ? s.toLowerCase() : s);
  if (fold(left) === fold(right)) return msg('Synchronize Dirs', 'Both panels show the same folder.');

  const box = document.createElement('div');
  box.className = 'dlg sync';
  box.innerHTML =
    '<div class="dlg-title">Synchronize Directories</div>' +
    '<div class="dlg-body">' +
    '<div class="sy-paths"><div class="sy-l"></div><div class="sy-r"></div></div>' +
    '<div class="sy-opts">' +
    '<label><input type="checkbox" class="sy-sub" checked> Subdirs</label>' +
    '<label><input type="checkbox" class="sy-content"> By content</label>' +
    '<span class="sy-sep"></span>' +
    '<label><input type="checkbox" class="sy-f" data-s="left" checked> Left only</label>' +
    '<label><input type="checkbox" class="sy-f" data-s="right" checked> Right only</label>' +
    '<label><input type="checkbox" class="sy-f" data-s="newerL" checked> Left newer</label>' +
    '<label><input type="checkbox" class="sy-f" data-s="newerR" checked> Right newer</label>' +
    '<label><input type="checkbox" class="sy-f" data-s="diff" checked> Different</label>' +
    '<label><input type="checkbox" class="sy-f" data-s="eq"> Equal</label>' +
    '</div>' +
    '<div class="s-head sy-row"><div>Name</div><div class="r">Size</div><div>Date</div><div class="c">Copy</div><div class="r">Size</div><div>Date</div></div>' +
    '<div class="s-list sy-list"></div>' +
    '<div class="s-status sy-status">Press Compare.</div>' +
    '</div>' +
    '<div class="dlg-btns"><button class="sy-cmp primary">Compare</button><button class="sy-go" disabled>Synchronize</button><button class="sy-close">Close</button></div>';
  const q = (s) => box.querySelector(s);
  q('.sy-l').textContent = left;
  q('.sy-r').textContent = right;
  const $list = q('.sy-list'), $status = q('.sy-status'), $cmp = q('.sy-cmp'), $go = q('.sy-go');
  let rows = [];
  let closeModal;

  const defaultAct = (s) => (s === 'left' || s === 'newerL' ? 'R' : s === 'right' || s === 'newerR' ? 'L' : '');
  const canR = (r) => !!r.l;
  const canL = (r) => !!r.r;
  const sizeOf = (x, isDir) => (!x ? '' : isDir ? '<DIR>' : fmtNum(x.size));
  const dateOf = (x) => (x ? fmtDate(x.mtime) : '');

  function visible() {
    const on = new Set([...box.querySelectorAll('.sy-f')].filter((c) => c.checked).map((c) => c.dataset.s));
    return rows.map((r, i) => ({ r, i })).filter((x) => on.has(x.r.state));
  }

  function render() {
    const vis = visible();
    const shown = vis.slice(0, 5000);
    $list.innerHTML = shown
      .map(({ r, i }) => {
        const label = r.act ? SYNC_ARROW[r.act] : SYNC_LABEL[r.state];
        const cls = r.act === 'R' ? 'toR' : r.act === 'L' ? 'toL' : '';
        return (
          `<div class="s-row sy-row" data-i="${i}"><div class="sy-n">${esc(r.rel)}${r.isDir ? '/' : ''}</div>` +
          `<div class="r">${sizeOf(r.l, r.isDir)}</div><div>${dateOf(r.l)}</div>` +
          `<div class="c sy-act ${cls}" title="click to change direction">${label}</div>` +
          `<div class="r">${sizeOf(r.r, r.isDir)}</div><div>${dateOf(r.r)}</div></div>`
        );
      })
      .join('');
    updateStatus(vis.length > shown.length ? ` (first ${shown.length} of ${vis.length} shown)` : '');
  }

  function updateStatus(extra = '') {
    const toR = rows.filter((r) => r.act === 'R').length;
    const toL = rows.filter((r) => r.act === 'L').length;
    $status.textContent = `${rows.filter((r) => r.state !== 'eq').length} difference(s) found. Will copy: ${toR} to the right, ${toL} to the left.${extra}`;
    $go.disabled = !(toR + toL);
  }

  async function compare() {
    $cmp.disabled = true;
    $go.disabled = true;
    const res = await withProgress('Comparing', (id) =>
      api.syncCompare({ id, left, right, subdirs: q('.sy-sub').checked, byContent: q('.sy-content').checked })
    );
    $cmp.disabled = false;
    if (res.error) { $status.textContent = 'Error: ' + res.error; return; }
    rows = res.rows.map((r) => ({ ...r, act: defaultAct(r.state) })); // equal rows get no action by default
    render();
    if (res.cancelled) $status.textContent = 'Comparison was cancelled. ' + $status.textContent;
    else if (!res.rows.some((r) => r.state !== 'eq')) $status.textContent = 'The folders are identical.';
  }

  async function synchronize() {
    const acts = rows.filter((r) => r.act);
    if (!acts.length) return;
    const toR = acts.filter((r) => r.act === 'R');
    const toL = acts.filter((r) => r.act === 'L');
    const over = acts.filter((r) => (r.act === 'R' ? r.r : r.l) && !r.isDir).length;
    const c = await dialog({
      title: 'Synchronize',
      text:
        `Copy ${toR.length} item(s) to the right and ${toL.length} item(s) to the left?` +
        (over ? `\n${over} existing file(s) will be overwritten.` : ''),
      buttons: [{ label: 'Start', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }],
    });
    if (c.value !== 'ok') return;
    const res = await withProgress('Synchronizing', (id) =>
      api.syncRun({ id, left, right, actions: acts.map((r) => ({ rel: r.rel, isDir: r.isDir, dir: r.act })) })
    );
    await Promise.all(panels.map((p) => p.refresh()));
    if (res.errors.length) await msg('Error', res.errors.slice(0, 8).join('\n'));
    await compare();
  }

  $list.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('.sy-act');
    if (!cell) return;
    const r = rows[+cell.closest('.s-row').dataset.i];
    const order = ['R', 'L', ''].filter((a) => a === '' || (a === 'R' ? canR(r) : canL(r)));
    r.act = order[(order.indexOf(r.act) + 1) % order.length];
    render();
  });
  box.addEventListener('change', (e) => { if (e.target.classList.contains('sy-f')) render(); });
  $cmp.onclick = compare;
  $go.onclick = synchronize;
  q('.sy-close').onclick = () => closeModal();
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
  });

  closeModal = openModal(box);
  $cmp.focus();
  compare();
}
