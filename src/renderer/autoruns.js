'use strict';
// Autostart programs (toolbar button / Commands menu): what starts with the computer, in the manner of Sysinternals Autoruns.
// The list is collected by main/autoruns.js. Uses helpers from app.js (openModal, modalCount, esc, msg, dialog, fmtDate).

let autorunsBusy = false;

async function openAutoruns() {
  if (modalCount > 0 || autorunsBusy) return;
  autorunsBusy = true;
  const win = api.platform === 'win32';
  const box = document.createElement('div');
  box.className = 'dlg ar';
  const tabs = win
    ? [['all', 'Everything'], ['Logon', 'Logon'], ['Tasks', 'Scheduled tasks'], ['Services', 'Services']]
    : [['all', 'Everything'], ['Logon', 'Login items'], ['Services', 'Daemons']];
  box.innerHTML =
    '<div class="dlg-title">Autostart programs</div><div class="dlg-body">' +
    '<div class="ar-tabs">' + tabs.map((t, i) => `<button type="button" data-g="${t[0]}"${i === 0 ? ' class="on"' : ''}>${t[1]}</button>`).join('') + '</div>' +
    '<div class="ar-bar"><input class="ar-filter" spellcheck="false" placeholder="Filter by name, publisher or path">' +
    '<label class="ft-chk"><input type="checkbox" class="ar-ms" checked> Hide Microsoft and Windows entries</label></div>' +
    '<div class="ar-head"><div></div><div>Entry</div><div>Description</div><div>Publisher</div><div>Path</div><div>Date</div></div>' +
    '<div class="ar-list" tabindex="0"><div class="ar-wait">Reading the list ...</div></div>' +
    '<div class="ar-status"></div></div>' +
    '<div class="dlg-btns"><button class="ar-open">Show file</button><button class="ar-del">Delete entry</button><button class="ar-refresh">Refresh</button><button class="ar-close primary">Close</button></div>';
  const q = (s) => box.querySelector(s);
  const close = openModal(box);
  let items = [];
  let group = 'all';
  let sel = -1;
  let view = [];
  const $list = q('.ar-list'), $status = q('.ar-status');
  const isMs = (i) => /microsoft|windows/i.test(i.pub || '') || /^[a-z]:\\windows\\/i.test(i.file || '') || (i.loc || '').toLowerCase().startsWith('\\microsoft\\');

  function render() {
    const f = q('.ar-filter').value.trim().toLowerCase();
    const hideMs = q('.ar-ms').checked;
    view = items.filter((i) => (group === 'all' || i.group === group) && !(hideMs && isMs(i)) && (!f || [i.name, i.desc, i.pub, i.cmd, i.loc].some((x) => String(x || '').toLowerCase().includes(f))));
    // by place of the entry, like Autoruns: a header row for every key / folder / task folder
    const order = { Logon: 0, Tasks: 1, Services: 2 };
    view.sort((a, b) => (order[a.group] - order[b.group]) || String(a.loc).localeCompare(String(b.loc)) || String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
    let html = '';
    let lastLoc = null;
    view.forEach((i, n) => {
      const key = i.group + '|' + i.loc;
      if (key !== lastLoc) { lastLoc = key; html += `<div class="ar-loc">${esc(i.loc)}</div>`; }
      const when = i.time ? fmtDate(i.time) : '';
      html += `<div class="ar-row${i.exists ? '' : ' missing'}${n === sel ? ' on' : ''}" data-n="${n}">` +
        `<div><input type="checkbox" class="ar-en"${i.enabled ? ' checked' : ''}${i.toggle ? '' : ' disabled'}></div>` +
        `<div title="${esc(i.name)}">${esc(i.name)}</div><div title="${esc(i.desc || '')}">${esc(i.desc || '')}</div><div title="${esc(i.pub || '')}">${esc(i.pub || '')}</div>` +
        `<div title="${esc(i.cmd || '')}">${i.exists ? esc(i.file || i.cmd || '') : 'File not found: ' + esc(i.file || i.cmd || '')}</div><div>${esc(when)}</div></div>`;
    });
    $list.innerHTML = html || '<div class="ar-wait">Nothing to show.</div>';
    const missing = view.filter((i) => !i.exists).length;
    $status.textContent = `${view.length} entries${missing ? `, ${missing} with a missing file (yellow)` : ''}.` + (win ? '' : '');
  }

  async function load() {
    $list.innerHTML = '<div class="ar-wait">Reading the list ...</div>';
    $status.textContent = '';
    const r = await api.autorunsList();
    if (r.error) { $list.innerHTML = `<div class="ar-wait">${esc(r.error)}</div>`; return; }
    items = r.items || [];
    sel = -1;
    render();
  }

  const cur = () => view[sel];
  $list.addEventListener('mousedown', (e) => {
    const row = e.target.closest('.ar-row');
    if (!row) return;
    sel = +row.dataset.n;
    $list.querySelectorAll('.ar-row.on').forEach((x) => x.classList.remove('on'));
    row.classList.add('on');
  });
  // the check box: switch the entry on / off (like the Startup tab of the Task Manager)
  $list.addEventListener('change', async (e) => {
    const cb = e.target.closest('.ar-en');
    if (!cb) return;
    const row = cb.closest('.ar-row');
    const it = view[+row.dataset.n];
    const want = cb.checked;
    cb.disabled = true;
    const r = await api.autorunsAct({ op: want ? 'enable' : 'disable', toggle: it.toggle });
    cb.disabled = false;
    if (r.error) { cb.checked = !want; $status.textContent = r.error; return; }
    it.enabled = want;
    $status.textContent = `${it.name}: ${want ? 'enabled' : 'disabled'} (it takes effect at the next sign-in).`;
  });
  q('.ar-open').onclick = () => { const it = cur(); if (it && it.file) api.reveal(it.file); };
  q('.ar-del').onclick = async () => {
    const it = cur();
    if (!it) return;
    if (!it.toggle || !['run', 'startup'].includes(it.toggle.type)) { $status.textContent = 'Only entries of the Run keys and of the Startup folders can be deleted here. Tasks can be switched off with the check box.'; return; }
    box.style.visibility = 'hidden';
    const r = await dialog({ title: 'Delete entry', text: `Remove "${it.name}" from the autostart?\n${it.loc}\n${it.cmd}`, buttons: [{ label: 'Delete', value: 'yes' }, { label: 'Cancel', value: 'no', primary: true, cancel: true }] });
    box.style.visibility = '';
    if (r.value !== 'yes') return;
    const a = await api.autorunsAct({ op: 'delete', toggle: it.toggle });
    if (a.error) { $status.textContent = a.error; return; }
    items = items.filter((x) => x !== it);
    sel = -1;
    render();
    $status.textContent = `"${it.name}" was removed.`;
  };
  q('.ar-refresh').onclick = load;
  q('.ar-filter').oninput = render;
  q('.ar-ms').onchange = render;
  box.querySelectorAll('.ar-tabs button').forEach((b) => (b.onclick = () => {
    group = b.dataset.g;
    box.querySelectorAll('.ar-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    sel = -1;
    render();
  }));
  const finish = () => { autorunsBusy = false; close(); };
  q('.ar-close').onclick = finish;
  box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') finish(); });
  load();
  q('.ar-filter').focus();
}
