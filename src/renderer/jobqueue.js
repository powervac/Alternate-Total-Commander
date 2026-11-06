'use strict';
// Background jobs: copy / move / pack / unpack ... run one after another through a queue.
// A job started on an idle queue shows the usual progress dialog with a "Background" button; a job started while another one works waits in the
// queue (no dialog). The queue window lists the jobs, shows their progress and lets you cancel them or move them up and down.
// Both this window and every dialog can be dragged by the title. Uses helpers from app.js (progressDialog, esc, store).

const jobq = { jobs: [], seq: 0, box: null, collapsed: false };
const JOB_CANCELLED = () => ({ errors: [], cancelled: true, skipped: 0 });

/** run start(id) as a job; resolves with its result (a cancelled queued job gives { errors: [], cancelled: true }) */
function runJob(title, start, opts = {}) {
  return new Promise((resolve, reject) => {
    const idle = !jobq.jobs.length;
    const job = { key: ++jobq.seq, id: Date.now() + Math.floor(Math.random() * 1000), title, state: 'queued', done: 0, total: 0, current: '', start, resolve, reject, dlg: null, fg: idle && !opts.bg };
    jobq.jobs.push(job);
    jobPump();
    jobRender();
  });
}

function jobPump() {
  if (jobq.jobs.some((j) => j.state === 'running')) return;
  const job = jobq.jobs.find((j) => j.state === 'queued');
  if (!job) return;
  job.state = 'running';
  if (job.fg) {
    job.dlg = progressDialog(job.title, () => api.cancelOp(job.id), () => jobBackground(job), (paused) => api.pauseOp({ id: job.id, paused }));
  }
  Promise.resolve()
    .then(() => job.start(job.id))
    .then((r) => job.resolve(r), (e) => job.reject(e))
    .finally(() => {
      if (job.dlg) job.dlg.close();
      jobq.jobs = jobq.jobs.filter((j) => j !== job);
      jobRender();
      jobPump();
    });
}

function jobBackground(job) {
  if (job.dlg) { job.dlg.close(); job.dlg = null; }
  job.fg = false;
  jobRender();
}

api.onProgress((p) => {
  const job = jobq.jobs.find((j) => j.id === p.id);
  if (!job) return;
  job.done = p.done; job.total = p.total; job.current = p.current;
  if (job.dlg) job.dlg.update(p);
  jobRow(job);
});

function jobMove(job, d) {
  const i = jobq.jobs.indexOf(job);
  const j = i + d;
  if (j < 0 || j >= jobq.jobs.length) return;
  // a running job stays first: only the waiting ones are reordered
  if (jobq.jobs[j].state === 'running' || job.state === 'running') return;
  [jobq.jobs[i], jobq.jobs[j]] = [jobq.jobs[j], jobq.jobs[i]];
  jobRender();
}

function jobCancel(job) {
  if (job.state === 'running') { api.cancelOp(job.id); job.cancelling = true; jobRow(job); return; }
  jobq.jobs = jobq.jobs.filter((j) => j !== job);
  job.resolve(JOB_CANCELLED());
  jobRender();
}

const jobPct = (j) => (j.total ? Math.min(100, Math.round((j.done / j.total) * 100)) : 0);

function jobRow(job) {
  if (!jobq.box) return;
  const row = jobq.box.querySelector(`[data-k="${job.key}"]`);
  if (!row) return;
  row.querySelector('i').style.width = jobPct(job) + '%';
  row.querySelector('.jq-cur').textContent = job.cancelling ? 'Cancelling...' : job.state === 'queued' ? 'Waiting' : `${jobPct(job)} %  ${job.current || ''}`;
}

function jobRender() {
  const waiting = jobq.jobs.filter((j) => !j.fg || j.state === 'queued');
  if (!jobq.jobs.length || !waiting.length) {
    if (jobq.box) { jobq.box.remove(); jobq.box = null; }
    return;
  }
  if (!jobq.box) {
    const b = document.createElement('div');
    b.className = 'jobq';
    document.body.appendChild(b);
    jobq.box = b;
    const pos = store.get('jobqPos', null);
    if (pos) { b.style.left = Math.max(0, Math.min(pos.x, innerWidth - 80)) + 'px'; b.style.top = Math.max(0, Math.min(pos.y, innerHeight - 40)) + 'px'; }
    else { b.style.right = '16px'; b.style.bottom = '36px'; }
  }
  const b = jobq.box;
  b.classList.toggle('collapsed', jobq.collapsed);
  const rows = jobq.jobs.map((j, i) => {
    const first = i === 0 || jobq.jobs[i - 1].state === 'running';
    const last = i === jobq.jobs.length - 1;
    const mv = j.state === 'queued';
    return `<div class="jq-row" data-k="${j.key}"><div class="jq-name" title="${esc(j.title)}">${esc(j.title)}</div><div class="bar"><i style="width:${jobPct(j)}%"></i></div>` +
      `<div class="jq-line"><span class="jq-cur">${j.cancelling ? 'Cancelling...' : j.state === 'queued' ? 'Waiting' : jobPct(j) + ' %  ' + esc(j.current || '')}</span>` +
      `<button class="jq-up" title="Move up"${mv && !first ? '' : ' disabled'}>▲</button><button class="jq-dn" title="Move down"${mv && !last ? '' : ' disabled'}>▼</button>` +
      `<button class="jq-x" title="${j.state === 'running' ? 'Cancel' : 'Remove from the queue'}">✕</button></div></div>`;
  }).join('');
  b.innerHTML = `<div class="jq-title"><span>Background jobs (${jobq.jobs.length})</span><button class="jq-min" title="Collapse">${jobq.collapsed ? '▢' : '–'}</button></div><div class="jq-body">${rows}</div>`;
  b.querySelector('.jq-min').onclick = () => { jobq.collapsed = !jobq.collapsed; jobRender(); };
  b.querySelectorAll('.jq-row').forEach((row) => {
    const job = jobq.jobs.find((j) => String(j.key) === row.dataset.k);
    row.querySelector('.jq-up').onclick = () => jobMove(job, -1);
    row.querySelector('.jq-dn').onclick = () => jobMove(job, 1);
    row.querySelector('.jq-x').onclick = () => jobCancel(job);
  });
}

// ---------------------------------------------------------------- dragging windows by their title
// the queue window: grabbed by its title (the box is rebuilt on every change, so the handler sits on the document)
document.addEventListener('mousedown', (e) => {
  const t = e.target.closest && e.target.closest('.jq-title');
  if (!t || !jobq.box) return;
  if (e.target.closest('button')) return;
  e.preventDefault();
  const el = jobq.box, r = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
  const move = (ev) => {
    el.style.left = Math.max(0, Math.min(r.left + ev.clientX - sx, innerWidth - 80)) + 'px';
    el.style.top = Math.max(0, Math.min(r.top + ev.clientY - sy, innerHeight - 30)) + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
  };
  const up = () => {
    document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
    const q = el.getBoundingClientRect();
    store.set('jobqPos', { x: Math.round(q.left), y: Math.round(q.top) });
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
});

// every dialog: drag by its title. The pointer is captured by the title, so the drag always ends with the button (even when it is released outside the window),
// and the dialog can never leave the screen: it is kept inside the window (a double click on the title puts it back in the middle).
function dlgPlace(el, dx, dy, base) {
  const minL = base.w <= innerWidth ? 0 : innerWidth - base.w, maxL = base.w <= innerWidth ? innerWidth - base.w : 0;
  const L = Math.max(minL, Math.min(base.left0 + dx, maxL));
  const maxT = base.h <= innerHeight ? innerHeight - base.h : innerHeight - 40; // too tall: at least the title bar stays on the screen
  const T = Math.max(0, Math.min(base.top0 + dy, maxT));
  el.dataset.dx = L - base.left0;
  el.dataset.dy = T - base.top0;
  el.style.transform = `translate(${L - base.left0}px, ${T - base.top0}px)`;
}
const dlgBase = (el) => { const r = el.getBoundingClientRect(); return { left0: r.left - (+el.dataset.dx || 0), top0: r.top - (+el.dataset.dy || 0), w: r.width, h: r.height }; };

document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest && e.target.closest('.dlg-title');
  if (!t || e.button !== 0) return;
  const el = t.closest('.dlg');
  if (!el) return;
  e.preventDefault();
  const base = dlgBase(el);
  const sx = e.clientX, sy = e.clientY;
  const ox = +el.dataset.dx || 0, oy = +el.dataset.dy || 0;
  try { t.setPointerCapture(e.pointerId); } catch { /* the pointer is gone */ }
  const move = (ev) => {
    if (ev.buttons === 0) return end(); // the button was released somewhere we did not see
    dlgPlace(el, ox + ev.clientX - sx, oy + ev.clientY - sy, base);
  };
  const end = () => {
    t.removeEventListener('pointermove', move);
    t.removeEventListener('pointerup', end);
    t.removeEventListener('pointercancel', end);
    t.removeEventListener('lostpointercapture', end);
  };
  t.addEventListener('pointermove', move);
  t.addEventListener('pointerup', end);
  t.addEventListener('pointercancel', end);
  t.addEventListener('lostpointercapture', end);
});
document.addEventListener('dblclick', (e) => {
  const t = e.target.closest && e.target.closest('.dlg-title');
  const el = t && t.closest('.dlg');
  if (el) { el.dataset.dx = 0; el.dataset.dy = 0; el.style.transform = ''; }
});
// the window became smaller: dialogs that were moved are pulled back inside
window.addEventListener('resize', () => {
  document.querySelectorAll('.dlg').forEach((el) => {
    if (el.dataset.dx === undefined && el.dataset.dy === undefined) return;
    dlgPlace(el, +el.dataset.dx || 0, +el.dataset.dy || 0, dlgBase(el));
  });
});
