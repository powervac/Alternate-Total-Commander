'use strict';
// File index (Configuration > File index...): an optional database of the names, sizes and dates of all files on the chosen disks / folders.
// While it is on, Find Files (Alt+F7) can answer name searches from the index at once, without reading the disks.
// The work is done by main/fileindex.js (a worker thread). Uses helpers from app.js (store, esc, openModal, modalCount, drives, ftBytes from filetools.js).

const INDEX_DEFAULTS = { on: false, roots: [], exclude: ['$Recycle.Bin', 'System Volume Information'], auto: 'daily', gentle: true };
const indexCfg = () => ({ ...INDEX_DEFAULTS, ...(store.get('fileIndex', {}) || {}) });
let indexState = { roots: [], total: 0, building: false, progress: null };

/** the options as the main process wants them */
const indexOpts = (c = indexCfg()) => ({ on: c.on, roots: c.roots, exclude: c.exclude, auto: c.auto, gentle: c.gentle });

async function indexStart() {
  const c = indexCfg();
  if (!c.on) return;
  const st = await api.indexInit(indexOpts(c));
  if (st && !st.error) indexState = { ...indexState, ...st };
}
api.onIndexState((s) => { indexState = { ...indexState, ...s }; if (typeof indexPaint === 'function') indexPaint(); });

/** is the index ready for searches? (used by the Find Files dialog) */
const indexUsable = () => indexCfg().on && indexState.total > 0;

let indexPaint = null;
async function openIndexDialog() {
  if (modalCount > 0) return;
  const c = indexCfg();
  const fresh = await api.indexStatus();
  if (fresh) indexState = { ...indexState, ...fresh };
  const win = api.platform === 'win32';
  const driveRows = drives.filter((d) => !d.off).map((d) => {
    const on = c.roots.some((r) => r.toLowerCase() === d.path.toLowerCase());
    return `<label class="ft-chk"><input type="checkbox" class="ix-drive" value="${esc(d.path)}"${on ? ' checked' : ''}> ${esc(win ? d.label + ':' : d.label)} ${esc(d.vol || d.net || (win ? '' : d.path))}</label>`;
  }).join('');
  const driveSet = new Set(drives.map((d) => d.path.toLowerCase()));
  const extra = c.roots.filter((r) => !driveSet.has(r.toLowerCase())).join(';');
  const box = document.createElement('div');
  box.className = 'dlg ix';
  box.innerHTML =
    '<div class="dlg-title">File index</div><div class="dlg-body">' +
    '<div class="dlg-text">The program walks through the chosen disks once, remembers the names, sizes and dates of all files and folders, and then Find Files (Alt+F7) finds them at once without reading the disks. The names are kept in one file on this computer.</div>' +
    `<label class="ft-chk"><input type="checkbox" class="ix-on"${c.on ? ' checked' : ''}> <b>Keep an index of the files</b></label>` +
    '<div class="ix-sec">Index these disks:</div>' + (driveRows || '<div class="s-hint">No disks found.</div>') +
    '<div class="ft-line"><label>Other folders:</label><input class="ix-extra" spellcheck="false" placeholder="folders separated by ;"></div>' +
    '<div class="ft-line"><label>Skip folders named:</label><input class="ix-ex" spellcheck="false" placeholder="names separated by ;"></div>' +
    '<div class="ft-line"><label>Update the index:</label><select class="ix-auto"><option value="daily">once a day, when the program starts</option><option value="start">at every start</option><option value="manual">only when I press the button</option></select></div>' +
    `<label class="ft-chk"><input type="checkbox" class="ix-gentle"${c.gentle ? ' checked' : ''}> Gentle mode: slower scan that keeps the disks and the computer free for other work</label>` +
    '<div class="ix-state dlg-text">&nbsp;</div><div class="bar ix-bar" style="display:none"><i></i></div>' +
    '</div><div class="dlg-btns"><button class="ix-now">Update now</button><button class="ix-stop">Stop</button><button class="ix-del">Delete the index</button><button class="ix-ok primary">OK</button><button class="ix-cancel">Cancel</button></div>';
  const q = (s) => box.querySelector(s);
  q('.ix-extra').value = extra;
  q('.ix-ex').value = c.exclude.join(';');
  q('.ix-auto').value = c.auto;
  const close = openModal(box);
  const read = () => ({
    on: q('.ix-on').checked,
    roots: [...[...box.querySelectorAll('.ix-drive:checked')].map((x) => x.value), ...q('.ix-extra').value.split(';').map((x) => x.trim()).filter(Boolean)],
    exclude: q('.ix-ex').value.split(';').map((x) => x.trim()).filter(Boolean),
    auto: q('.ix-auto').value,
    gentle: q('.ix-gentle').checked,
  });
  const fmt = (n) => Number(n).toLocaleString();
  indexPaint = () => {
    const s = indexState;
    const st = q('.ix-state');
    if (!st) return;
    const bar = q('.ix-bar');
    q('.ix-now').disabled = !!s.building;
    q('.ix-stop').disabled = !s.building;
    bar.style.display = s.building ? '' : 'none';
    if (s.building) {
      const pr = s.progress || {};
      st.textContent = pr.root ? `Scanning ${pr.root}: ${fmt((pr.done || 0) + (pr.files || 0))} items found so far   (${pr.current || ''})` : 'Starting the scan ...';
      const pctv = pr.pct == null ? null : Math.min(99, Math.round(((s.roots ? 0 : 0) + pr.pct)));
      st.textContent = pr.root ? `Scanning ${pr.root}${pctv != null ? '  ' + pctv + ' %' : ''}: ${fmt((pr.done || 0) + (pr.files || 0))} items found so far   (${pr.current || ''})` : 'Starting the scan ...';
      const fill = bar.firstElementChild;
      if (pctv != null) { fill.className = ''; fill.style.width = pctv + '%'; } else fill.className = 'ix-run';
    } else if (s.error) st.textContent = 'Error: ' + s.error;
    else if (s.total) st.textContent = `In the index: ${fmt(s.total)} files and folders (${(s.roots || []).map((r) => r.root + ' ' + fmt(r.count) + ', ' + new Date(r.built).toLocaleString()).join('; ')})`;
    else st.textContent = 'The index is empty.';
  };
  indexPaint();
  const finish = () => { indexPaint = null; close(); };
  const apply = async () => {
    const n = read();
    store.set('fileIndex', n);
    if (!n.on) { await api.indexOff(); indexState = { roots: indexState.roots, total: indexState.total, building: false, progress: null }; }
    return n;
  };
  q('.ix-now').onclick = async () => {
    const n = read();
    if (!n.roots.length) { q('.ix-state').textContent = 'Choose at least one disk or folder.'; return; }
    n.on = true;
    q('.ix-on').checked = true;
    store.set('fileIndex', n);
    indexState = { ...indexState, building: true, progress: null };
    indexPaint();
    await api.indexBuild(indexOpts(n));
  };
  q('.ix-stop').onclick = () => api.indexStop();
  q('.ix-del').onclick = async () => { await api.indexClear(); indexState = { roots: [], total: 0, building: false, progress: null }; indexPaint(); };
  q('.ix-ok').onclick = async () => {
    const n = await apply();
    finish();
    if (n.on && n.roots.length && !indexState.building) {
      const missing = n.roots.some((r) => !(indexState.roots || []).find((x) => x.root.toLowerCase() === r.toLowerCase()));
      if (missing || !indexState.total) await api.indexBuild(indexOpts(n)); // first run (or a new disk): start scanning in the background
      else await api.indexInit(indexOpts(n));
    }
  };
  q('.ix-cancel').onclick = finish;
  box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') finish(); });
}

// start-up: load the index and refresh it when it is due
setTimeout(() => indexStart(), 4000);
