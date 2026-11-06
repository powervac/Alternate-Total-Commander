'use strict';
// `api` is exposed as a global by preload.js (contextBridge)
const P = api.path;
const isMac = api.platform === 'darwin';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtNum = (n) => Math.floor(n).toLocaleString('en-US');
const fmtK = (b) => fmtNum(b / 1024);
const pad = (n) => String(n).padStart(2, '0');
function fmtDate(ms) {
  const d = new Date(ms);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function splitExt(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? [name.slice(0, i), name.slice(i + 1)] : [name, ''];
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} if (typeof onStoreSet === 'function') onStoreSet(k); }, // onStoreSet: settings sync (settingsync.js)
};

// ------------------------------------------------------------------ icons
const FOLDER_ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M1 3h5l1.5 1.5H15V13H1z" fill="#e8b73c"/><path d="M1 6h14v7H1z" fill="#f7d774"/></svg>');
const UP_ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M1 3h5l1.5 1.5H15V13H1z" fill="#e8b73c"/><path d="M8 5l4 4H9.5v3h-3V9H4z" fill="#fff" stroke="#8a6d00" stroke-width=".6"/></svg>');
const FILE_ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M3 1h7l3 3v11H3z" fill="#fff" stroke="#7a7a7a"/><path d="M10 1v3h3" fill="none" stroke="#7a7a7a"/></svg>');
const UNIQUE_ICON_EXT = new Set(['exe', 'lnk', 'ico', 'url', 'app', 'dmg', 'icns']);
const iconCache = new Map(); // key -> dataURL | Promise
function iconKey(name, ext) {
  return UNIQUE_ICON_EXT.has(ext.toLowerCase()) ? 'f:' + name : 'e:' + ext.toLowerCase();
}
function requestIcon(key, fullPath) {
  if (iconCache.has(key)) return;
  iconCache.set(key, null);
  api.icon(fullPath).then((url) => {
    if (!url) return;
    iconCache.set(key, url);
    document.querySelectorAll('img.ic').forEach((img) => {
      if (img.dataset.ik === key) img.src = url;
    });
  });
}

// ------------------------------------------------------------------ thumbnails (grid view)
const thumbCache = new Map(); // "path|mtime|size" -> dataURL | null
const thumbQueue = [];
let thumbBusy = 0;
function thumbLoad(panel, cell) {
  const it = panel.view[+cell.dataset.i];
  if (!it) return;
  const file = P.join(panel.dir, it.name);
  const key = `${file}|${it.mtime}|${it.size}`;
  thumbQueue.push({ panel, cell, it, file, key });
  thumbPump();
}
function thumbPump() {
  while (thumbBusy < 3 && thumbQueue.length) {
    const job = thumbQueue.shift();
    if (!job.cell.isConnected) continue; // scrolled away / re-rendered
    thumbBusy++;
    const done = (url) => {
      thumbBusy--;
      if (url && job.cell.isConnected && job.panel.view[+job.cell.dataset.i] === job.it) {
        const img = job.cell.querySelector('img.th');
        const box = job.cell.querySelector('.th-box');
        if (img) { img.src = url; if (box) box.classList.add('real'); }
      }
      thumbPump();
    };
    if (thumbCache.has(job.key)) done(thumbCache.get(job.key));
    else api.thumb({ file: job.file, size: 192, key: job.key }).then((u) => { thumbCache.set(job.key, u); done(u); }, () => done(null));
  }
}

// ------------------------------------------------------------------ dialogs
let modalCount = 0;
function openModal(box) {
  const root = $('#modal-root');
  root.appendChild(box);
  root.classList.add('open');
  modalCount++;
  return () => {
    box.remove();
    modalCount--;
    if (!root.children.length) root.classList.remove('open'); // the dim layer depends on dialogs only (the editor also counts in modalCount)
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
  };
}
/** buttons: [{label, value, primary?, cancel?}] -> {value, input} */
/** letter of a key by its position on the keyboard, so shortcuts also work with a Russian (or any other) layout: Ctrl+С = Ctrl+C */
const keyLetter = (e) => (/^Key[A-Z]$/.test(e.code || '') ? e.code.slice(3).toLowerCase() : String(e.key).toLowerCase());

function dialog({ title, text, input, buttons }) {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'dlg';
    box.innerHTML =
      `<div class="dlg-title">${esc(title)}</div><div class="dlg-body"><div class="dlg-text">${esc(text || '')}</div>` +
      (input !== undefined ? '<input class="dlg-input" spellcheck="false">' : '') +
      '</div><div class="dlg-btns"></div>';
    const inp = $('.dlg-input', box);
    if (inp) inp.value = input;
    const primary = buttons.find((b) => b.primary) || buttons[0];
    const cancel = buttons.find((b) => b.cancel) || buttons[buttons.length - 1];
    let close;
    const done = (b) => { close(); resolve({ value: b.value, input: inp ? inp.value : undefined }); };
    for (const b of buttons) {
      const el = document.createElement('button');
      el.textContent = b.label;
      if (b === primary) el.className = 'primary';
      el.onclick = () => done(b);
      $('.dlg-btns', box).appendChild(el);
    }
    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const hot = buttons.find((b) => b.key && b.key === e.key);
      if (hot) { e.preventDefault(); done(hot); }
      else if (e.key === 'Escape') { e.preventDefault(); done(cancel); }
      else if (e.key === 'Enter' && (!(e.target instanceof HTMLButtonElement))) { e.preventDefault(); done(primary); }
      else if (e.key === 'Tab') {
        const f = [...box.querySelectorAll('input,button')];
        const i = f.indexOf(document.activeElement);
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        e.preventDefault();
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target instanceof HTMLButtonElement) {
        const f = [...box.querySelectorAll('button')];
        const i = f.indexOf(document.activeElement);
        f[(i + (e.key === 'ArrowLeft' ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    close = openModal(box);
    if (inp) {
      inp.focus();
      // select the name part only when the value ends with a *.* mask: select all
      inp.select();
    } else {
      $('button.primary', box).focus();
    }
  });
}
const msg = (title, text) => dialog({ title, text, buttons: [{ label: 'OK', value: 'ok', primary: true }] });

function progressDialog(title, onCancel, onBackground, onPause) {
  let box, close, timer, closed = false, paused = false;
  const t0 = Date.now();
  let lastT = t0, lastDone = 0, speed = 0; // bytes per second, smoothed
  const mb = (n) => (n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' G' : (n / 1048576).toFixed(1) + ' M');
  const rate = (n) => (n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' G/s' : (n / 1048576).toFixed(1) + ' M/s');
  const secs = (n) => (n >= 3600 ? Math.floor(n / 3600) + ' h ' + Math.floor((n % 3600) / 60) + ' min' : n >= 60 ? Math.floor(n / 60) + ' min ' + Math.round(n % 60) + ' s' : Math.round(n) + ' s');
  const show = () => {
    if (closed) return;
    box = document.createElement('div');
    box.className = 'dlg pg';
    box.innerHTML =
      `<div class="dlg-title">${esc(title)}</div><div class="dlg-body"><div class="dlg-text pg-head">&nbsp;</div>` +
      '<div class="pg-paths"><div>From: <span class="pg-from"></span></div><div>To: <span class="pg-to"></span></div></div>' +
      '<div class="pg-line"><div class="bar"><i class="pg-f"></i></div><span class="pg-fp">0 %</span></div>' +
      '<div class="pg-line"><div class="bar bar2"><i class="pg-t"></i></div><span class="pg-tp">0 %</span></div>' +
      '<div class="pg-row"><span class="pg-n"></span><span class="pg-size"></span><span class="pg-speed"></span></div></div>' +
      `<div class="dlg-btns">${onPause ? '<button class="pg-pause" style="display:none">Pause</button>' : ''}<button class="primary pg-cancel">Cancel</button>${onBackground ? '<button class="pg-bg">Background</button>' : ''}</div>`;
    const btn = $('.pg-cancel', box);
    if (onBackground) $('.pg-bg', box).onclick = () => onBackground();
    if (onPause) {
      const pb = $('.pg-pause', box);
      pb.onclick = () => { paused = !paused; pb.textContent = paused ? 'Resume' : 'Pause'; onPause(paused); };
    }
    btn.onclick = () => { onCancel(); btn.disabled = true; btn.textContent = 'Cancelling...'; };
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') btn.click(); });
    close = openModal(box);
    btn.focus();
  };
  timer = setTimeout(show, 250);
  return {
    update(p) {
      const now = Date.now();
      if (now - lastT >= 500) {
        const inst = ((p.done - lastDone) * 1000) / (now - lastT);
        speed = speed ? speed * 0.6 + inst * 0.4 : inst;
        lastT = now; lastDone = p.done;
      }
      if (!box) return;
      const pct = p.total ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
      const fpct = p.ftotal ? Math.min(100, Math.round((p.fdone / p.ftotal) * 100)) : pct;
      $('.pg-head', box).textContent = `${title.replace(/ .*/, '')}: ${paused ? 'paused' : speed > 0 ? (speed / 1024).toFixed(0).replace(/\B(?=(\d{3})+$)/g, ',') + ' kbytes/s' : ''}${paused ? '' : ', ' + secs((now - t0) / 1000)}`;
      $('.pg-from', box).textContent = p.from || p.current || '';
      $('.pg-to', box).textContent = p.to || '';
      $('.pg-f', box).style.width = fpct + '%';
      $('.pg-fp', box).textContent = fpct + ' %';
      $('.pg-t', box).style.width = pct + '%';
      $('.pg-tp', box).textContent = pct + ' %';
      $('.pg-n', box).textContent = p.nt ? `${p.n} / ${p.nt}` : '';
      $('.pg-size', box).textContent = `${mb(p.done)} / ${mb(p.total)}` + (speed > 0 && p.total > p.done && !paused ? `   (${secs((p.total - p.done) / speed)} left)` : '');
      $('.pg-speed', box).textContent = speed > 0 && !paused ? rate(speed) : '';
      const pb = $('.pg-pause', box);
      if (pb && p.pausable) pb.style.display = '';
    },
    close() {
      closed = true;
      clearTimeout(timer);
      if (close) close();
    },
  };
}

// ------------------------------------------------------------------ panel
let panels = [];
let active = 0;
let qvIdx = null; // index of the panel that currently shows the Ctrl+Q quick view (see quickview.js)
let drives = [];
let places = []; // Home, Desktop, Documents, Downloads... (shown in the Alt+F1 / Alt+F2 list)
const A = () => panels[active];
const O = () => panels[1 - active];
const ROW_H = 20;

class Panel {
  constructor(idx, el) {
    this.idx = idx;
    this.el = el;
    this.dir = '';
    this.arc = null; // {file, inner} while browsing inside a zip
    this.rem = null; // {id, name, path} while browsing a Synology NAS
    this.lastLocal = ''; // last local folder (where "up" from the NAS root goes)
    this.items = [];
    this.view = [];
    this.cursor = 0;
    this.sel = new Set();
    this.sortKey = store.get(`sortKey${idx}`, 'name');
    this.sortRev = store.get(`sortRev${idx}`, false);
    this.thumbs = store.get(`thumbs${idx}`, false);
    this.dirSizes = new Map(); // full path of a folder -> total size of its files (calculated with Space), cleared by a reread
    this.hist = [];
    this.hi = -1;
    this.lastDirOnDrive = new Map();
    el.innerHTML =
      '<div class="top"><button class="drive" tabindex="-1"></button><select class="sshmode" tabindex="-1" hidden><option value="console">Console</option><option value="files">File manager</option></select><span class="space"></span></div>' +
      '<div class="tabs"></div>' +
      '<div class="pathbar"></div>' +
      '<div class="colhead"><div data-k="name">Name</div><div data-k="ext">Ext</div><div data-k="size" class="r">Size</div><div data-k="time">Date</div><div data-k="attr">Attr</div></div>' +
      '<div class="list"></div><div class="qvbox"></div><div class="termbox"></div><div class="status"></div>';
    this.consoleOn = false; // SSH panel showing the console instead of the file list
    this.qv = false;
    this.$drive = $('.drive', el);
    this.$space = $('.space', el);
    this.$mode = $('.sshmode', el);
    this.$mode.onchange = () => { const v = this.$mode.value; this.focus(); if (typeof sshSetMode === 'function') sshSetMode(this, v); };
    this.$path = $('.pathbar', el);
    this.$list = $('.list', el);
    this.$status = $('.status', el);
    this.$head = $('.colhead', el);
    this.$tabs = $('.tabs', el);
    this.$qv = $('.qvbox', el);
    this.$term = $('.termbox', el);
    this.tabs = [null]; // saved state of every tab; the live (active) one is rebuilt by tabState()
    this.ti = 0;

    this.$tabs.addEventListener('mousedown', (e) => {
      const t = e.target.closest('.tab');
      if (!t) return;
      e.preventDefault();
      this.focus();
      const i = +t.dataset.i;
      if (e.button === 1) this.closeTab(i);
      else if (e.button === 0) this.switchTab(i);
    });
    this.$tabs.addEventListener('dblclick', (e) => {
      const t = e.target.closest('.tab');
      if (t) this.closeTab(+t.dataset.i);
    });

    this.$drive.onmousedown = (e) => e.preventDefault();
    this.$drive.onclick = () => openDrivePicker(this);
    this.$head.onclick = (e) => {
      const k = e.target.closest('[data-k]')?.dataset.k;
      if (k) { this.focus(); this.setSort(k, true); }
    };
    this.$list.addEventListener('mousedown', (e) => {
      const row = e.target.closest('.row');
      if (!row) return;
      this.focus();
      const i = +row.dataset.i;
      if (e.button === 2) {
        this.setCursor(i);
        this.toggleSel(i, false);
        e.preventDefault();
      } else if (e.button === 0) {
        this.setCursor(i);
        if (e.ctrlKey || (isMac && e.metaKey)) this.toggleSel(i, false);
      }
    });
    this.$list.addEventListener('dblclick', (e) => {
      if (e.target.closest('.row')) this.enter();
    });
    this.$list.addEventListener('contextmenu', (e) => e.preventDefault());
    this.$path.onmousedown = () => this.focus();
    this.$status.onmousedown = () => this.focus();
  }

  focus() {
    if (this.qv) return; // the quick view panel never takes the focus
    active = this.idx;
    panels.forEach((p) => p.el.classList.toggle('active', p === this));
    $('#cmdprompt').textContent = this.dir + '>';
  }

  cur() { return this.view[this.cursor]; }

  /** items operated on: selection, or the item under the cursor */
  targets() {
    if (this.consoleOn) return []; // the list is hidden behind the console
    if (this.sel.size) return this.items.filter((i) => this.sel.has(i.name));
    const c = this.cur();
    return c && !c.up ? [c] : [];
  }

  /** remote folder that uploads go to: the console's current directory while the console is shown */
  uploadDir() { return this.consoleOn && typeof sshCwd === 'function' ? sshCwd(this) : this.rem.path; }

  /** real folder on disk: the panel's folder, or the folder that holds the open archive */
  realDir() { return this.arc ? (this.arc.remote ? this.lastLocal || api.home : P.dirname(this.arc.file)) : this.rem ? this.lastLocal || api.home : this.dir; }

  /** location snapshot: {dir}, {arc:{file,inner}} or {rem:{id,name,path}} */
  snap() { return this.arc ? { arc: { ...this.arc } } : this.rem ? { rem: { ...this.rem } } : { dir: this.dir }; }
  go(nav, opts) {
    if (nav.rem) return this.loadRem(nav.rem, nav.rem.path, opts);
    return nav.arc ? this.loadArc(nav.arc.file, nav.arc.inner, { ...opts, remote: nav.arc.remote }) : this.load(nav.dir, opts);
  }

  /** key of a location (folder, archive folder, remote folder) for the remembered scroll position */
  static navKey(nav) { return nav.arc ? 'a:' + nav.arc.file + '|' + (nav.arc.inner || '') : nav.rem ? 'r:' + nav.rem.id + '|' + nav.rem.path : 'd:' + nav.dir; }

  _commit(res, dir, arc, nav, opts, rem = null) {
    // remember where the view of the folder we are leaving stood: scroll position and the file under the cursor
    if (!this.posMap) this.posMap = new Map();
    if (this.view && this.view.length) { const c = this.cur(); this.posMap.set(Panel.navKey(this.snap()), { top: this.$list.scrollTop, name: c && !c.up ? c.name : undefined }); }
    const keepSel = opts.keepSel ? new Set(this.sel) : null;
    this.arc = arc;
    this.rem = rem;
    if (!rem && !(arc && arc.remote)) this.lastLocal = arc ? P.dirname(arc.file) : dir;
    // leaving the SSH server (another disk, a favourite folder ...): the console must not stay on top of the new list
    if (this.consoleOn && !(rem && rem.type === 'sftp')) sshShowList(this);
    this.dir = dir;
    this.items = res.items;
    this.sel = new Set();
    if (keepSel) for (const i of this.items) if (keepSel.has(i.name)) this.sel.add(i.name);
    if (opts.push !== false) {
      this.hist = this.hist.slice(0, this.hi + 1);
      this.hist.push(nav);
      this.hi = this.hist.length - 1;
    }
    this.rebuild(opts.focusName);
    // coming back to a folder (Backspace / back): the list stands where it stood, the folder we came from is at the same place on the screen
    if (opts.focusName !== undefined && opts.restoreTop !== false) {
      const saved = this.posMap.get(Panel.navKey(nav));
      if (saved) { this.$list.scrollTop = saved.top; this.scrollToCursor(); }
    }
    this.updateHeader();
    store.set(`dir${this.idx}`, this.realDir());
    if (active === this.idx) $('#cmdprompt').textContent = this.dir + '>';
    this.renderTabs();
    return true;
  }

  // ---------------------------------------------------------------- tabs
  tabState() {
    const c = this.cur();
    return { nav: this.snap(), focus: c && !c.up ? c.name : undefined, sortKey: this.sortKey, sortRev: this.sortRev, hist: this.hist, hi: this.hi };
  }

  tabTitle(nav) {
    if (nav.rem) return nav.rem.path === '/' ? nav.rem.name : nav.rem.path.split('/').pop() || nav.rem.name;
    let p = nav.arc ? (nav.arc.inner ? nav.arc.inner.split('/').pop() : P.basename(nav.arc.file)) : P.basename(nav.dir);
    if (!p) p = nav.dir; // drive root
    return p;
  }

  renderTabs() {
    const list = this.tabs.map((t, i) => (i === this.ti ? this.snap() : t.nav));
    this.$tabs.classList.toggle('on', list.length > 1);
    this.$tabs.innerHTML = list
      .map((nav, i) => `<div class="tab${i === this.ti ? ' active' : ''}" data-i="${i}" title="${esc(nav.arc ? nav.arc.file : nav.rem ? nav.rem.name + ':' + nav.rem.path : nav.dir)}">${esc(this.tabTitle(nav))}</div>`)
      .join('');
    const real = list.map((n) => (n.arc ? P.dirname(n.arc.file) : n.rem ? api.home : n.dir)); // NAS tabs are not restored
    store.set(`tabs${this.idx}`, { ti: this.ti, list: real });
  }

  /** new tab = a copy of the current one, placed right after it, and made active */
  newTab(nav) {
    const cur = this.tabState();
    this.tabs[this.ti] = cur;
    this.tabs.splice(this.ti + 1, 0, { ...cur, hist: [...cur.hist] });
    this.ti++;
    this.renderTabs();
    if (nav) return this.go(nav);
  }

  async applyTab(n) {
    const t = this.tabs[n];
    this.ti = n;
    this.sortKey = t.sortKey;
    this.sortRev = t.sortRev;
    this.hist = t.hist;
    this.hi = t.hi;
    const ok = await this.go(t.nav, { push: t.hist.length === 0, focusName: t.focus });
    if (!ok) await this.load(api.home);
    this.renderTabs();
  }

  async switchTab(n) {
    const len = this.tabs.length;
    n = ((n % len) + len) % len;
    if (n === this.ti) return;
    this.tabs[this.ti] = this.tabState();
    await this.applyTab(n);
  }

  async closeTab(i = this.ti) {
    if (this.tabs.length < 2) return;
    if (i === this.ti) {
      this.tabs.splice(i, 1);
      await this.applyTab(Math.min(i, this.tabs.length - 1));
    } else {
      this.tabs[this.ti] = this.tabState();
      this.tabs.splice(i, 1);
      if (i < this.ti) this.ti--;
      this.renderTabs();
    }
  }

  async load(dir, opts = {}) {
    const res = await api.list(dir);
    if (res.error) { await msg('Error', res.error); return false; }
    return this._commit(res, res.dir, null, { dir: res.dir }, opts);
  }

  /** browse a zip archive like a folder (read-only). inner = path inside the archive, '/'-separated */
  async loadArc(file, inner, opts = {}) {
    const res = await api.zipList({ archive: file, inner });
    if (res.error) { await msg('Error', res.error); return false; }
    // an archive that was downloaded from a NAS / SSH server keeps a pointer to its origin (read-only, shown with the remote path)
    const remote = opts.remote || (this.arc && this.arc.file === file ? this.arc.remote : undefined);
    const arc = remote ? { file, inner, remote } : { file, inner };
    const shown = remote ? `${remote.name}:${remote.path}${inner ? '/' + inner : ''}` : inner ? P.join(file, ...inner.split('/')) : file;
    return this._commit(res, shown, arc, { arc }, opts);
  }

  /** browse a Synology NAS (File Station) or an SSH server (SFTP). conn = {id, name, type: 'nas'|'sftp'}; rpath '/' or '/dir/sub' */
  async loadRem(conn, rpath = '/', opts = {}) {
    const res = await api.nasList({ id: conn.id, path: rpath });
    if (res.error) {
      if ((conn.type === 'dropbox' || conn.type === 'gdrive') && /sign in again|no longer valid/i.test(res.error)) {
        // the saved cloud login was revoked or has too few rights: forget it and offer the one-button sign-in again
        liveConns.delete(conn.id);
        api.nasDisconnect({ id: conn.id });
        const all = nasLoad();
        const rec = all.find((c) => c.id === conn.id);
        if (rec) { rec.pw = ''; nasSave(all); }
        await openConnections(conn.id, conn.type);
        return false;
      }
      await msg(remTitle(conn.type), res.error);
      return false;
    }
    const rem = { id: conn.id, name: conn.name, type: conn.type || 'nas', path: rpath };
    return this._commit(res, `${conn.name}:${rpath}`, null, { rem }, opts, rem);
  }

  /**
   * Space: select / unselect the item under the cursor and STAY on it (Insert selects and moves down).
   * A folder also gets the total size of all its files, subfolders included, shown in the Size column.
   */
  async spaceSelect() {
    const it = this.cur();
    if (!it || it.up) return;
    const wasSel = this.sel.has(it.name);
    this.toggleSel(this.cursor, false);
    if (!it.isDir || wasSel || this.arc || this.rem || this.thumbs) return;
    const dir = this.dir;
    const full = P.join(dir, it.name);
    if (this.dirSizes.has(full)) return;
    const cell = () => { const i = this.view.findIndex((v) => v.name === it.name); const r = this.dir === dir && i >= 0 ? this.rowEl(i) : null; return r && r.children[2]; };
    const c0 = cell();
    if (c0) c0.textContent = '...';
    const r = await api.ftSpace({ paths: [full], id: Date.now() + Math.floor(Math.random() * 1000) });
    if (r.error) { const c = cell(); if (c) c.innerHTML = '&lt;DIR&gt;'; return; }
    this.dirSizes.set(full, r.bytes);
    const c1 = cell();
    if (c1) c1.textContent = fmtNum(r.bytes);
    this.updateStatus();
  }

  refresh() {
    this.dirSizes.clear();
    const c = this.cur();
    return this.go(this.snap(), { push: false, focusName: c && c.name, keepSel: true });
  }

  setSort(key, toggle) {
    if (toggle && this.sortKey === key) this.sortRev = !this.sortRev;
    else { this.sortKey = key; this.sortRev = false; }
    store.set(`sortKey${this.idx}`, this.sortKey);
    store.set(`sortRev${this.idx}`, this.sortRev);
    const c = this.cur();
    this.rebuild(c && c.name);
  }

  rebuild(focusName) {
    const k = this.sortKey;
    const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    const ext = (n) => splitExt(n)[1].toLowerCase();
    const cmp = {
      name: byName,
      ext: (a, b) => ext(a.name).localeCompare(ext(b.name)) || byName(a, b),
      time: (a, b) => a.mtime - b.mtime || byName(a, b),
      size: (a, b) => (a.isDir && b.isDir ? byName(a, b) : a.size - b.size || byName(a, b)),
      attr: byName,
    }[k] || byName;
    const rev = this.sortRev ? -1 : 1;
    const dirs = this.items.filter((i) => i.isDir).sort((a, b) => rev * cmp(a, b));
    const files = this.items.filter((i) => !i.isDir).sort((a, b) => rev * cmp(a, b));
    const hasParent = this.arc || this.rem ? true : P.dirname(this.dir) !== this.dir;
    this.view = [...(hasParent ? [{ name: '..', isDir: true, up: true, size: -1, mtime: 0 }] : []), ...dirs, ...files];
    let idx = focusName ? this.view.findIndex((i) => i.name === focusName) : -1;
    if (idx < 0) idx = Math.min(this.cursor, this.view.length - 1);
    if (focusName === undefined) idx = 0;
    this.cursor = Math.max(0, idx);
    this.render();
  }

  attrOf(it) {
    if (it.up) return '----';
    return (it.ro ? 'r' : '-') + (it.isDir ? '-' : 'a') + (it.hidden ? 'h' : '-') + '-';
  }

  /** thumbnail view (Ctrl+Shift+F4): a grid of big pictures instead of the detail list */
  setThumbs(on) {
    this.thumbs = !!on;
    store.set(`thumbs${this.idx}`, this.thumbs);
    this.render();
  }
  /** number of cells in one grid row */
  thumbCols() {
    const cells = this.$list.children;
    if (!cells.length) return 1;
    const top = cells[0].offsetTop;
    let n = 0;
    while (n < cells.length && cells[n].offsetTop === top) n++;
    return Math.max(1, n);
  }

  renderThumbs() {
    const cells = [];
    this.view.forEach((it, i) => {
      const [base, ext] = it.isDir ? [it.name, ''] : splitExt(it.name);
      const src = it.up ? UP_ICON : it.isDir ? FOLDER_ICON : FILE_ICON;
      const cls = `row thumb${this.sel.has(it.name) ? ' sel' : ''}${i === this.cursor ? ' cur' : ''}`;
      cells.push(
        `<div class="${cls}" data-i="${i}" title="${esc(it.name)}"><div class="th-box${it.isDir || it.up ? ' icon' : ''}"><img class="th" src="${src}"></div>` +
        `<div class="th-name"><span class="n">${esc(it.up ? '[..]' : it.isDir ? '[' + base + ']' : base)}</span><span class="e">${esc(ext)}</span></div></div>`
      );
    });
    this.$list.innerHTML = cells.join('');
    if (this._io) this._io.disconnect();
    if (this.arc || this.rem) return; // thumbnails need real files
    this._io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { this._io.unobserve(en.target); thumbLoad(this, en.target); }
    }, { root: this.$list, rootMargin: '240px' });
    for (const c of this.$list.children) {
      const it = this.view[+c.dataset.i];
      if (it && !it.isDir && !it.up) this._io.observe(c);
    }
  }

  render() {
    this.$list.classList.toggle('thumbs', !!this.thumbs);
    this.$head.classList.toggle('thumbs', !!this.thumbs);
    if (this.thumbs) {
      this.renderThumbs();
      this.$head.querySelectorAll('[data-k]').forEach((h) => {
        const on = h.dataset.k === this.sortKey;
        h.classList.toggle('sorted', on);
        const label = { name: 'Name', ext: 'Ext', size: 'Size', time: 'Date', attr: 'Attr' }[h.dataset.k];
        h.textContent = (on ? (this.sortRev ? '▲ ' : '▼ ') : '') + label;
      });
      this.updateStatus();
      this.scrollToCursor();
      if (qvIdx !== null && this.idx !== qvIdx) qvSchedule();
      return;
    }
    const rows = [];
    this.view.forEach((it, i) => {
      const [base, ext] = it.isDir ? [it.name, ''] : splitExt(it.name);
      let src = FILE_ICON, ik = '';
      if (it.up) src = UP_ICON;
      else if (it.isDir) src = FOLDER_ICON;
      else {
        ik = iconKey(it.name, ext);
        src = iconCache.get(ik) || FILE_ICON;
        if (!iconCache.has(ik) && !this.arc && !this.rem) requestIcon(ik, P.join(this.dir, it.name));
      }
      rows.push(
        `<div class="row${this.sel.has(it.name) ? ' sel' : ''}${i === this.cursor ? ' cur' : ''}" data-i="${i}">` +
        `<div class="c-name"><img class="ic" data-ik="${esc(ik)}" src="${src}"><span>${esc(base)}</span></div>` +
        `<div>${esc(ext)}</div>` +
        `<div class="r">${it.isDir ? (this.dirSizes.has(P.join(this.dir, it.name)) ? fmtNum(this.dirSizes.get(P.join(this.dir, it.name))) : '&lt;DIR&gt;') : fmtNum(it.size)}</div>` +
        `<div>${it.up ? '' : fmtDate(it.mtime)}</div>` +
        `<div>${this.attrOf(it)}</div></div>`
      );
    });
    this.$list.innerHTML = rows.join('');
    this.$head.querySelectorAll('[data-k]').forEach((h) => {
      const on = h.dataset.k === this.sortKey;
      h.classList.toggle('sorted', on);
      const label = { name: 'Name', ext: 'Ext', size: 'Size', time: 'Date', attr: 'Attr' }[h.dataset.k];
      h.textContent = (on ? (this.sortRev ? '▲ ' : '▼ ') : '') + label;
    });
    this.updateStatus();
    this.scrollToCursor();
    if (qvIdx !== null && this.idx !== qvIdx) qvSchedule();
  }

  rowEl(i) { return this.$list.children[i]; }

  scrollToCursor() {
    const r = this.rowEl(this.cursor);
    if (r) r.scrollIntoView({ block: 'nearest' });
  }

  setCursor(i) {
    i = Math.max(0, Math.min(this.view.length - 1, i));
    const old = this.rowEl(this.cursor);
    if (old) old.classList.remove('cur');
    this.cursor = i;
    const r = this.rowEl(i);
    if (r) r.classList.add('cur');
    this.scrollToCursor();
    if (qvIdx !== null && this.idx !== qvIdx) qvSchedule();
  }

  move(d) { this.setCursor(this.cursor + d); }
  page() {
    if (this.thumbs) {
      const c = this.$list.children[0];
      return Math.max(1, Math.floor(this.$list.clientHeight / (c ? c.offsetHeight : 120)) - 1) * this.thumbCols();
    }
    return Math.max(1, Math.floor(this.$list.clientHeight / ROW_H) - 1);
  }

  toggleSel(i, advance = true) {
    const it = this.view[i];
    if (!it || it.up) { if (advance) this.move(1); return; }
    if (this.sel.has(it.name)) this.sel.delete(it.name); else this.sel.add(it.name);
    this.rowEl(i).classList.toggle('sel', this.sel.has(it.name));
    this.updateStatus();
    if (advance) this.move(1);
  }

  selectWhere(pred, on) {
    for (const it of this.items) {
      if (!pred(it)) continue;
      if (on) this.sel.add(it.name); else this.sel.delete(it.name);
    }
    this.view.forEach((it, i) => this.rowEl(i) && this.rowEl(i).classList.toggle('sel', this.sel.has(it.name)));
    this.updateStatus();
  }

  updateStatus() {
    if (this.qv) return; // the status bar belongs to the preview
    if (this.consoleOn) return; // ... or to the SSH console
    const files = this.items.filter((i) => !i.isDir);
    const dirs = this.items.filter((i) => i.isDir);
    const sf = files.filter((i) => this.sel.has(i.name));
    const sd = dirs.filter((i) => this.sel.has(i.name));
    const sum = (a) => a.reduce((s, i) => s + i.size, 0);
    const dsum = (a) => a.reduce((s, i) => s + (this.dirSizes.get(P.join(this.dir, i.name)) || 0), 0); // folders whose size was calculated with Space
    let t = `${fmtK(sum(sf) + dsum(sd))} k / ${fmtK(sum(files) + dsum(dirs))} k in ${sf.length} / ${files.length} file(s)`;
    if (dirs.length) t += `, ${sd.length} / ${dirs.length} dir(s)`;
    this.$status.textContent = t;
  }

  async updateHeader() {
    if (this.qv) return;
    if (this.rem) {
      const t = this.rem.type;
      this.$drive.textContent = `${REM_ICON[t] || '☁'} ${remTitle(t)} ▾`;
      this.$path.textContent = this.dir + (this.dir.endsWith('/') ? '' : '/') + '*';
      this.$path.title = this.dir;
      this.$space.textContent = t === 'sftp' ? '' : t === 'nas' ? 'Synology NAS (File Station)' : remTitle(t);
      this.$mode.hidden = t !== 'sftp'; // the console is available for SSH connections: a picklist Console / File manager
      this.$mode.value = this.consoleOn ? 'console' : 'files';
      return;
    }
    this.$mode.hidden = true;
    // drive combo
    const d = driveFor(this.dir);
    this.$drive.textContent = (d ? d.label : '?') + ' ▾';
    if (d) this.lastDirOnDrive.set(d.path, this.realDir());
    const sep = P.sep;
    this.$path.textContent = (this.dir.endsWith(sep) ? this.dir : this.dir + sep) + '*.*';
    this.$path.title = this.dir;
    const sp = await api.space(this.realDir());
    this.$space.textContent = sp ? `${fmtK(sp.free)} k of ${fmtK(sp.total)} k free` : '';
  }

  async enter() {
    const it = this.cur();
    if (!it) return;
    if (it.up) return this.goUp();
    if (this.rem) {
      const full = remJoin(this.rem.path, it.name);
      if (it.isDir) return this.loadRem(this.rem, full);
      if (isArc(it.name)) return openRemoteArchive(this, it); // a zip on the NAS / SSH server opens like a folder
      if (isAudioFile(it.name)) return playerStart(this, it);
      if (isDocFile(it.name)) return openViewer(); // our own document viewer
      const t = await api.nasTemp({ id: this.rem.id, path: full });
      if (t.error) return msg('NAS', t.error);
      if (isSpeccyFile(it.name)) return openEmulator(t.file);
      const err = await api.open(t.file);
      if (err) msg('Error', err);
      return;
    }
    if (this.arc) {
      const { file, inner } = this.arc;
      if (it.isDir) return this.loadArc(file, inner ? inner + '/' + it.name : it.name);
      if (isAudioFile(it.name)) return playerStart(this, it);
      if (isDocFile(it.name)) return openViewer();
      if (isSpeccyFile(it.name)) { const t = await api.zipTemp({ archive: file, inner, name: it.name }); return t.error ? msg('Archive', t.error) : openEmulator(t.file); }
      const err = await api.zipOpen({ archive: file, inner, name: it.name });
      if (err) msg('Error', err);
      return;
    }
    const full = P.join(this.dir, it.name);
    if (it.isDir) return this.load(full);
    if (isArc(it.name)) return this.loadArc(full, '');
    if (isAudioFile(it.name)) return playerStart(this, it); // music: our player (F3 = viewer, Alt+Enter-like: "Open With Default Application" in Files menu)
    if (isSpeccyFile(it.name)) return openEmulator(full); // .trd .scl .tap ...: the built-in ZX Spectrum emulator
    if (isDocFile(it.name)) return openViewer(); // docx / xlsx / pptx / odf: built-in viewer, no Office required (Files > Open With Default Application for the system one)
    const err = await api.open(full);
    if (err) msg('Error', err);
  }

  goUp() {
    if (this.rem) {
      const { path } = this.rem;
      if (path === '/') return this.load(this.lastLocal || api.home); // leave the NAS
      const i = path.lastIndexOf('/');
      return this.loadRem(this.rem, i <= 0 ? '/' : path.slice(0, i), { focusName: path.slice(i + 1) });
    }
    if (this.arc) {
      const { file, inner, remote } = this.arc;
      if (inner) {
        const i = inner.lastIndexOf('/');
        return this.loadArc(file, i < 0 ? '' : inner.slice(0, i), { focusName: inner.slice(i + 1) });
      }
      if (remote) {
        // out of an archive that came from the NAS / SSH server: back into its folder there
        const i = remote.path.lastIndexOf('/');
        return this.loadRem({ id: remote.id, name: remote.name, type: remote.type }, i <= 0 ? '/' : remote.path.slice(0, i), { focusName: remote.path.slice(i + 1) });
      }
      return this.load(P.dirname(file), { focusName: P.basename(file) });
    }
    const par = P.dirname(this.dir);
    if (par === this.dir) return;
    return this.load(par, { focusName: P.basename(this.dir) });
  }

  back(d) {
    const n = this.hi + d;
    if (n < 0 || n >= this.hist.length) return;
    this.hi = n;
    // back / forward: the cursor returns to the file it stood on in that folder
    if (!this.posMap) this.posMap = new Map();
    if (this.view && this.view.length) { const c = this.cur(); this.posMap.set(Panel.navKey(this.snap()), { top: this.$list.scrollTop, name: c && !c.up ? c.name : undefined }); }
    const saved = this.posMap.get(Panel.navKey(this.hist[n]));
    return this.go(this.hist[n], { push: false, focusName: saved && saved.name ? saved.name : P.basename(this.dir) });
  }
}

// kinds of remote panels (panel.rem.type) and of saved connection records (record.type)
const REM_TITLE = { nas: 'NAS', sftp: 'SSH', dropbox: 'Dropbox', gdrive: 'Google Drive' };
const remTitle = (t) => REM_TITLE[t] || 'NAS';
const REM_ICON = { nas: '☁', sftp: '⌨', dropbox: '❖', gdrive: '▲' };
const RECORD_REM = { nas: 'nas', ssh: 'sftp', dropbox: 'dropbox', gdrive: 'gdrive' }; // saved record kind -> panel type
const REC_ICON = { nas: '☁', ssh: '⌨', dropbox: '❖', gdrive: '▲' };

/** NAS paths always use '/' */
const remJoin = (base, name) => (base === '/' ? '' : base.replace(/\/+$/, '')) + '/' + name;

function driveFor(dir) {
  const fold = (s) => (api.platform === 'win32' ? s.toLowerCase() : s);
  const d = fold(dir);
  let best = null;
  for (const x of drives) {
    const r = fold(x.path);
    if (d.startsWith(r) && (!best || r.length > fold(best.path).length)) best = x;
  }
  return best;
}

// ------------------------------------------------------------------ drive picker
/** Switch panel to a drive. If the other panel is already on that drive, open the same folder. */
function switchDrive(p, d) {
  const o = panels[1 - p.idx];
  const target = driveFor(o.realDir()) === d ? o.realDir() : p.lastDirOnDrive.get(d.path) || d.path;
  p.focus();
  return p.load(target);
}

function openDrivePicker(p) {
  if (modalCount > 0) return;
  p.focus();
  const box = document.createElement('div');
  box.className = 'drivemenu';
  const r = p.$drive.getBoundingClientRect();
  box.style.left = r.left + 'px';
  box.style.top = r.bottom + 'px';
  let rows = []; // { el, drive } for disks, { el, conn } for saved NAS connections
  let sel = 0;
  let isOpen = true;

  const mark = (i) => {
    sel = Math.max(0, Math.min(rows.length - 1, i));
    rows.forEach((x, j) => x.el.classList.toggle('on', j === sel));
    rows[sel] && rows[sel].el.scrollIntoView({ block: 'nearest' });
  };

  /** (re)build the list: disks first (network drives with their \\server\share), then saved NAS connections */
  function build(keepPath) {
    box.innerHTML = '';
    rows = [];
    const add = (cls, text, data) => {
      const el = document.createElement('div');
      el.className = 'it' + (cls ? ' ' + cls : '');
      el.textContent = text;
      const i = rows.length;
      el.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); choose(i); };
      el.onmouseenter = () => mark(i);
      box.appendChild(el);
      rows.push({ el, ...data });
    };
    for (const d of drives) {
      const win = api.platform === 'win32';
      // like Total Commander: the letter, then the name of the volume (or the network share)
      let name = win ? d.vol || d.net || '' : d.path;
      if (win && d.vol && d.net) name = d.vol + '   ' + d.net;
      if (d.off) name += (name ? '   ' : '') + '(not connected)';
      add(d.off ? 'off' : '', '', { drive: d });
      const el = rows[rows.length - 1].el;
      el.innerHTML = `<span class="dl">${esc(win ? d.label : d.label)}</span><span class="dn">${esc(name)}</span>`;
    }
    const sep = () => { const s = document.createElement('div'); s.className = 'sep'; box.appendChild(s); };
    const docs = places.find((x) => /^documents$/i.test(x.label));
    if (docs) {
      add('', '', { place: docs });
      rows[rows.length - 1].el.innerHTML = '<span class="dl">*</span><span class="dn">My Documents (directory)</span>';
    }
    if (places.length) {
      sep();
      for (const pl of places) add('place', '\u2605  ' + pl.label + '   ' + pl.path, { place: pl });
    }
    // connections that are open right now: back to them without logging in again
    const live = typeof liveConns !== 'undefined' ? [...liveConns.values()] : [];
    if (live.length) {
      sep();
      for (const l of live) add('', `${REM_ICON[l.type] || '\u2601'}  ${l.name}   (connected)`, { live: l });
    }
    const conns = (typeof nasLoad === 'function' ? nasLoad() : []).filter((c) => !(typeof liveConns !== 'undefined' && liveConns.has(c.id)));
    if (conns.length) {
      sep();
      for (const c of conns) add('', `${REC_ICON[c.type] || REC_ICON.nas}  ${c.name || c.url}   ${c.url ? nasDefaultName(c.url) : remTitle(RECORD_REM[c.type] || 'nas')}`, { conn: c });
    }
    const cur = driveFor(p.realDir());
    let i = keepPath ? rows.findIndex((x) => x.drive && x.drive.path === keepPath) : rows.findIndex((x) => x.drive === cur);
    mark(i < 0 ? 0 : i);
  }

  const close = () => {
    isOpen = false;
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onOutside, true);
    box.remove();
    modalCount--;
  };
  const choose = (i) => {
    const x = rows[i];
    if (!x) return;
    close();
    p.focus();
    if (x.drive) switchDrive(p, x.drive);
    else if (x.place) p.load(x.place.path);
    else if (x.live) openLive(p, x.live);
    else openConnections(x.conn.id);
  };
  const onOutside = (e) => { if (!box.contains(e.target)) close(); };
  const onKey = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const k = e.key;
    if (k === 'Escape') close();
    else if (k === 'Enter') choose(sel);
    else if (k === 'ArrowDown') mark(sel + 1);
    else if (k === 'ArrowUp') mark(sel - 1);
    else if (k.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const l = k.toLowerCase();
      const hits = rows.map((x, i) => i).filter((i) => rows[i].drive && rows[i].drive.label.toLowerCase().startsWith(l));
      if (hits.length === 1) choose(hits[0]);
      else if (hits.length) mark(hits.find((i) => i > sel) ?? hits[0]);
    }
  };
  modalCount++;
  document.body.appendChild(box);
  build();
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', onOutside, true);
  // drives can appear later (a network drive mapped while the program is running): re-read them now
  Promise.all([api.drives(), api.places()]).then(([list, pl]) => {
    if (!isOpen) return;
    const keep = rows[sel] && rows[sel].drive ? rows[sel].drive.path : null;
    drives = list;
    places = pl;
    build(keep);
  });
}

// ------------------------------------------------------------------ file operations
const arcPrefix = (p) => (p.arc.inner ? p.arc.inner + '/' : '');

/** a zip from a NAS / SSH server is a downloaded copy: it can be browsed and extracted from, not changed */
const remoteArcMsg = () => msg('Archive', 'This archive is read-only here (a 7z/tar archive, or one downloaded from the NAS / SSH server).\nUse F5 to copy files out of it.');
const remoteArchives = new Map(); // "id|path|size|mtime" -> downloaded temp file (kept until the program exits)

/** Enter on a .zip in a NAS / SSH panel: download it (with progress) and show it as a folder */
async function openRemoteArchive(p, it) {
  const rem = p.rem;
  const rpath = remJoin(rem.path, it.name);
  const key = `${rem.id}|${rpath}|${it.size}|${it.mtime}`;
  let file = remoteArchives.get(key);
  if (!file || !(await api.stat(file)).exists) {
    const dir = await api.mkTemp();
    const res = await withProgress('Downloading archive', (jobId) =>
      api.nasDownload({ id: rem.id, jobId, base: rem.path, destDir: dir, overwrite: 'all', items: [{ name: it.name, isDir: false, size: it.size, mtime: it.mtime }] })
    );
    if (res.error) return msg('Archive', res.error);
    if (res.cancelled) return;
    if (res.errors && res.errors.length) return showErrors(res.errors);
    file = P.join(dir, it.name);
    remoteArchives.set(key, file);
  }
  return p.loadArc(file, '', { remote: { id: rem.id, name: rem.name, type: rem.type, path: rpath } });
}

/** rewrite an archive (add / remove / rename / mkdir) with progress, then refresh both panels */
async function arcModify(title, archive, payload) {
  const res = await withProgress(title, (id) => api.zipModify({ id, archive, ...payload }));
  await Promise.all(panels.map((p) => p.refresh()));
  await showErrors(res.errors);
  return res;
}
const okRes = (r) => !r.errors.length && !r.cancelled;

async function addToArchive(kind) {
  const src = A(), dst = O();
  if (arcReadOnly(dst.arc)) return remoteArcMsg();
  const items = src.targets();
  if (!items.length) return;
  const label = kind === 'copy' ? 'Copy' : 'Move';
  const what = items.length === 1 ? `"${items[0].name}"` : `${items.length} file(s)/dir(s)`;
  const r = await dialog({ title: label, text: `${label} ${what} to archive:\n${dst.dir}`, buttons: OKCANCEL });
  if (r.value !== 'ok') return;
  const listing = await api.zipList({ archive: dst.arc.file, inner: dst.arc.inner });
  const have = new Set((listing.items || []).map((i) => i.name));
  let chosen = items;
  const clash = items.filter((i) => have.has(i.name));
  if (clash.length) {
    const c = await dialog({
      title: 'Confirm overwrite',
      text: `Already exist in the archive:\n${clash.slice(0, 5).map((i) => i.name).join('\n')}${clash.length > 5 ? `\n... and ${clash.length - 5} more` : ''}`,
      buttons: [
        { label: 'Overwrite', value: 'all', primary: true },
        { label: 'Skip existing', value: 'skip' },
        { label: 'Cancel', value: 'cancel', cancel: true },
      ],
    });
    if (c.value === 'cancel') return;
    if (c.value === 'skip') chosen = items.filter((i) => !have.has(i.name));
    if (!chosen.length) return;
  }
  const prefix = arcPrefix(dst);
  const res = await arcModify('Adding to archive', dst.arc.file, {
    add: chosen.map((i) => ({ abs: P.join(src.dir, i.name), rel: prefix + i.name })),
  });
  if (kind === 'move' && okRes(res)) {
    const d = await api.del({ sources: chosen.map((i) => P.join(src.dir, i.name)), permanent: false });
    await Promise.all(panels.map((p) => p.refresh()));
    await showErrors(d.errors);
  }
}

async function renameInArc() {
  const p = A();
  if (arcReadOnly(p.arc)) return remoteArcMsg();
  const it = p.cur();
  if (!it || it.up) return;
  const r = await dialog({ title: 'Rename', text: `Rename "${it.name}" to:`, input: it.name, buttons: OKCANCEL });
  const nn = r.input && r.input.trim();
  if (r.value !== 'ok' || !nn || nn === it.name) return;
  if (/[\\/]/.test(nn)) return msg('Rename', 'The name must not contain slashes.');
  if (p.items.some((i) => i.name === nn)) return msg('Rename', `"${nn}" already exists.`);
  const pre = arcPrefix(p);
  await arcModify('Renaming', p.arc.file, { rename: { from: pre + it.name, to: pre + nn } });
}

async function deleteFromArc() {
  const p = A();
  if (arcReadOnly(p.arc)) return remoteArcMsg();
  const items = p.targets();
  if (!items.length) return;
  const what = items.length === 1 ? `"${items[0].name}"` : `${items.length} selected item(s)`;
  const r = await dialog({
    title: 'Delete',
    text: `Delete ${what} from the archive?\nThis cannot be undone.`,
    buttons: [{ label: 'Yes', value: 'yes', primary: true }, { label: 'No', value: 'no', cancel: true }],
  });
  if (r.value !== 'yes') return;
  const pre = arcPrefix(p);
  await arcModify('Deleting', p.arc.file, { remove: items.map((i) => pre + i.name) });
}

async function mkdirInArc() {
  const p = A();
  if (arcReadOnly(p.arc)) return remoteArcMsg();
  const r = await dialog({ title: 'New folder', text: 'Enter new directory name:', input: '', buttons: OKCANCEL });
  const name = r.input && r.input.trim();
  if (r.value !== 'ok' || !name) return;
  await arcModify('Creating folder', p.arc.file, { mkdirs: [arcPrefix(p) + name.replace(/\\/g, '/')] });
}

// ---------------------------------------------------------------- NAS operations
const NAS_ROOT_MSG = 'This is the list of shared folders. Open a shared folder first.';

/** F5 / F6 between two remote panels (cloud -> cloud, NAS -> Dropbox ...): into a temporary folder on this computer, from there to the target, then the folder is deleted */
async function remoteToRemote(kind) {
  const src = A(), dst = O();
  const items = src.targets();
  if (!items.length) return;
  const destPath = dst.uploadDir();
  if (destPath === '/' && dst.rem.type === 'nas') return msg('NAS', NAS_ROOT_MSG);
  const label = kind === 'copy' ? 'Copy' : 'Move';
  const what = items.length === 1 ? `"${items[0].name}"` : `${items.length} file(s)/dir(s)`;
  const where = `${dst.rem.name}:${destPath}`;
  const ok = await dialog({
    title: label,
    text: `${label} ${what} from ${src.rem.name} to ${where}?\n\nThe files go through a temporary folder on this computer, which is emptied afterwards.`,
    buttons: OKCANCEL,
  });
  if (ok.value !== 'ok') return;
  const listing = await api.nasList({ id: dst.rem.id, path: destPath });
  if (listing.error) return msg(label, listing.error);
  const have = new Set(listing.items.map((i) => i.name));
  let chosen = items;
  let overwrite = 'skip';
  const clash = items.filter((i) => have.has(i.name));
  if (clash.length) {
    const c = await dialog({
      title: 'Confirm overwrite',
      text: `Already exist in ${where}:\n${clash.slice(0, 5).map((i) => i.name).join('\n')}${clash.length > 5 ? `\n... and ${clash.length - 5} more` : ''}`,
      buttons: [{ label: 'Overwrite', value: 'all', primary: true }, { label: 'Skip existing', value: 'skip' }, { label: 'Cancel', value: 'cancel', cancel: true }],
    });
    if (c.value === 'cancel') return;
    overwrite = c.value;
    if (c.value === 'skip') chosen = items.filter((i) => !have.has(i.name));
    if (!chosen.length) return;
  }
  const srcRem = src.rem, dstRem = dst.rem, base = srcRem.path;
  const title = `${kind === 'copy' ? 'Copying' : 'Moving'} ${chosen.length === 1 ? chosen[0].name : chosen.length + ' items'} (${srcRem.name} → ${dstRem.name})`;
  const res = await runJob(title, async (id) => {
    const tmp = await api.mkTemp();
    try {
      const d = await api.nasDownload({ id: srcRem.id, jobId: id, base, destDir: tmp, overwrite: 'all', items: chosen.map((i) => ({ name: i.name, isDir: i.isDir, size: i.size, mtime: i.mtime })) });
      if (d.error) return { errors: [d.error], cancelled: false, skipped: 0 };
      if (d.cancelled || (d.errors && d.errors.length)) return d;
      const u = await api.nasUpload({ id: dstRem.id, jobId: id, sources: chosen.map((i) => P.join(tmp, i.name)), destPath, overwrite });
      if (u.error) return { errors: [u.error], cancelled: false, skipped: 0 };
      if (kind === 'move' && !u.cancelled && !(u.errors && u.errors.length) && !u.skipped) {
        const r = await api.nasDelete({ id: srcRem.id, paths: chosen.map((i) => remJoin(base, i.name)) });
        if (r.error) u.errors = [...(u.errors || []), r.error];
      }
      return u;
    } finally {
      await api.del({ sources: [tmp], permanent: true }); // the temporary copy is always removed
    }
  });
  await Promise.all(panels.map((p) => p.refresh()));
  await showErrors(res.errors || []);
}

/** F5 / F6 from a local panel into a NAS / SSH panel (for an SSH panel in console mode: into the console's current directory) */
async function uploadToRemote(kind) {
  const src = A(), dst = O();
  const items = src.targets();
  if (!items.length) return;
  return doUpload(dst, items.map((i) => ({ name: i.name, abs: P.join(src.dir, i.name) })), kind, true);
}

/** items: [{name, abs}] local files/folders -> the remote folder of panel dst */
async function doUpload(dst, items, kind, askFirst = false) {
  if (!items.length || !dst.rem) return;
  const destPath = dst.uploadDir();
  if (destPath === '/' && dst.rem.type === 'nas') return msg('NAS', NAS_ROOT_MSG);
  const where = `${dst.rem.name}:${destPath}`;
  const label = kind === 'copy' ? 'Copy' : 'Move';
  const what = items.length === 1 ? `"${items[0].name}"` : `${items.length} file(s)/dir(s)`;
  // dropping onto the console asks nothing but the overwrite question: the target is obvious
  if (askFirst) {
    const r = await dialog({ title: label, text: `${label} ${what} to ${remTitle(dst.rem.type)} folder:\n${where}`, buttons: OKCANCEL });
    if (r.value !== 'ok') return;
  }
  const listing = await api.nasList({ id: dst.rem.id, path: destPath });
  if (listing.error) return msg('Upload', listing.error);
  const have = new Set(listing.items.map((i) => i.name));
  let chosen = items;
  let overwrite = 'skip';
  const clash = items.filter((i) => have.has(i.name));
  if (clash.length) {
    const c = await dialog({
      title: 'Confirm overwrite',
      text: `Already exist in ${where}:\n${clash.slice(0, 5).map((i) => i.name).join('\n')}${clash.length > 5 ? `\n... and ${clash.length - 5} more` : ''}`,
      buttons: [
        { label: 'Overwrite', value: 'all', primary: true },
        { label: 'Skip existing', value: 'skip' },
        { label: 'Cancel', value: 'cancel', cancel: true },
      ],
    });
    if (c.value === 'cancel') return;
    overwrite = c.value;
    if (c.value === 'skip') chosen = items.filter((i) => !have.has(i.name));
    if (!chosen.length) return;
  }
  const res = await withProgress(kind === 'copy' ? 'Uploading' : 'Moving', (jobId) =>
    api.nasUpload({ id: dst.rem.id, jobId, sources: chosen.map((i) => i.abs), destPath, overwrite })
  );
  if (res.error) res.errors = [res.error];
  if (kind === 'move' && !res.error && !res.errors.length && !res.cancelled) {
    const d = await api.del({ sources: chosen.map((i) => i.abs), permanent: false });
    res.errors.push(...d.errors);
  }
  await Promise.all(panels.map((p) => p.refresh()));
  if (!res.errors.length && !res.cancelled && dst.consoleOn && typeof sshNote === 'function') {
    sshNote(dst.rem.id, `${chosen.length} item(s) uploaded to ${destPath}`);
  }
  await showErrors(res.errors || []);
}

async function renameRemote() {
  const p = A();
  const it = p.cur();
  if (!it || it.up) return;
  if (p.rem.type === 'nas' && p.rem.path === '/') return msg('NAS', 'Shared folders cannot be renamed here.');
  const r = await dialog({ title: 'Rename', text: `Rename "${it.name}" to:`, input: it.name, buttons: OKCANCEL });
  const nn = r.input && r.input.trim();
  if (r.value !== 'ok' || !nn || nn === it.name) return;
  if (/[\\/]/.test(nn)) return msg('Rename', 'The name must not contain slashes.');
  const res = await api.nasRename({ id: p.rem.id, path: remJoin(p.rem.path, it.name), name: nn });
  if (res.error) return msg('NAS', res.error);
  await p.loadRem(p.rem, p.rem.path, { push: false, focusName: nn });
}

async function mkdirRemote() {
  const p = A();
  if (p.rem.type === 'nas' && p.rem.path === '/') return msg('NAS', NAS_ROOT_MSG);
  const r = await dialog({ title: 'New folder', text: 'Enter new directory name:', input: '', buttons: OKCANCEL });
  const name = r.input && r.input.trim();
  if (r.value !== 'ok' || !name) return;
  const res = await api.nasMkdir({ id: p.rem.id, parent: p.rem.path, name });
  if (res.error) return msg('NAS', res.error);
  await p.loadRem(p.rem, p.rem.path, { push: false, focusName: name.split('/')[0] });
}

async function deleteRemote() {
  const p = A();
  if (p.rem.type === 'nas' && p.rem.path === '/') return msg('NAS', 'Shared folders cannot be deleted here.');
  const items = p.targets();
  if (!items.length) return;
  const what = items.length === 1 ? `"${items[0].name}"` : `${items.length} selected item(s)`;
  const r = await dialog({
    title: 'Delete',
    text:
      p.rem.type === 'dropbox' ? `Delete ${what} from Dropbox?\nIt goes to Dropbox's deleted files (kept for 30 days).`
      : p.rem.type === 'gdrive' ? `Move ${what} to the Google Drive Trash?`
      : `Delete ${what} from the ${p.rem.type === 'sftp' ? 'server' : 'NAS'}?\nThis cannot be undone.`,
    buttons: [{ label: 'Yes', value: 'yes', primary: true }, { label: 'No', value: 'no', cancel: true }],
  });
  if (r.value !== 'yes') return;
  const res = await api.nasDelete({ id: p.rem.id, paths: items.map((i) => remJoin(p.rem.path, i.name)) });
  await Promise.all(panels.map((x) => x.refresh()));
  if (res.error) await msg('NAS', res.error);
}

/** stop a feature that cannot work with a NAS / archive panel */
function needLocal(feature, ...ps) {
  if (ps.some((p) => p.rem)) {
    msg(feature, 'This works with local folders only. Copy the files to a local folder first.');
    return true;
  }
  return false;
}

async function copyMove(kind, opts = {}) {
  const src = A(), dst = O();
  const items = src.targets();
  if (!items.length) return;
  if (src.consoleOn) return;
  if (kind === 'move' && src.arc && arcReadOnly(src.arc)) return remoteArcMsg(); // "move" would delete from the archive
  if (opts.renameOnly && src.rem) return renameRemote();
  if (opts.renameOnly && src.arc) return renameInArc();
  if (src.rem && dst.rem) return remoteToRemote(kind);
  if ((src.rem && dst.arc) || (src.arc && dst.rem)) return msg('NAS', 'Copying between a NAS and an archive is not supported.\nUse a local folder in between.');
  if (dst.rem) return uploadToRemote(kind);
  if (src.arc && dst.arc) return msg('Archive', 'Copying between two archives is not supported yet.');
  if (dst.arc) return addToArchive(kind);
  const label = kind === 'copy' ? 'Copy' : 'Move';
  const names = items.map((i) => i.name);
  let destDir, rename = null;
  let inBackground = false; // F2 Queue: no progress window, the job waits in the queue window

  if (opts.renameOnly) {
    const r = await dialog({
      title: 'Rename/Move',
      text: `Rename "${names[0]}" to:`,
      input: names[0],
      buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }],
    });
    const nn = r.input && r.input.trim();
    if (r.value !== 'ok' || !nn || nn === names[0]) return;
    destDir = src.dir;
    rename = nn;
  } else {
    const text = names.length === 1 ? `${label} "${names[0]}" to:` : `${label} ${names.length} file(s)/dir(s) to:`;
    const r = await dialog({
      title: label,
      text,
      input: P.join(dst.dir, '*.*'),
      buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'F2 Queue', value: 'queue', key: 'F2' }, { label: 'Cancel', value: 'cancel', cancel: true }],
    });
    const val = r.input && r.input.trim();
    if ((r.value !== 'ok' && r.value !== 'queue') || !val) return;
    inBackground = r.value === 'queue';
    if (/[\\/]?\*\.\*$/.test(val)) {
      destDir = P.resolve(src.realDir(), val.replace(/\*\.\*$/, '') || '.');
    } else {
      const p = P.resolve(src.realDir(), val);
      const st = await api.stat(p);
      if (st.exists && st.isDir) destDir = p;
      else if (names.length === 1) { destDir = P.dirname(p); rename = P.basename(p); }
      else destDir = p;
    }
  }

  const sources = src.arc || src.rem ? names : items.map((i) => P.join(src.dir, i.name));
  let overwrite = 'skip';
  const conflicts = await api.conflicts({ sources, destDir, rename });
  if (conflicts.length) {
    const shown = conflicts.slice(0, 5).join('\n') + (conflicts.length > 5 ? `\n... and ${conflicts.length - 5} more` : '');
    const r = await dialog({
      title: 'Confirm overwrite',
      text: `Already exist in the target folder:\n${shown}`,
      buttons: [
        { label: 'Overwrite', value: 'all', primary: true },
        { label: 'Skip existing', value: 'skip' },
        { label: 'Cancel', value: 'cancel', cancel: true },
      ],
    });
    if (r.value === 'cancel') return;
    overwrite = r.value;
  }

  const label2 = (kind === 'copy' ? 'Copying' : 'Moving') + ' ' + (names.length === 1 ? names[0] : names.length + ' items');
  const res = await runJob(label2, async (id) => {
    let r;
    if (src.rem) {
      r = await api.nasDownload({
        id: src.rem.id, jobId: id, base: src.rem.path, destDir, rename, overwrite,
        items: items.map((i) => ({ name: i.name, isDir: i.isDir, size: i.size, mtime: i.mtime })),
      });
      if (r.error) r = { errors: [r.error], cancelled: false, skipped: 0 };
    } else {
      r = src.arc
        ? await api.zipExtract({ id, archive: src.arc.file, inner: src.arc.inner, names, destDir, rename, overwrite })
        : await api.runOp({ id, kind, sources, destDir, rename, overwrite });
    }
    return r;
  }, { bg: inBackground });
  await Promise.all(panels.map((p) => p.refresh()));
  if (res.errors.length) {
    await msg('Error', res.errors.slice(0, 8).join('\n') + (res.errors.length > 8 ? `\n... and ${res.errors.length - 8} more` : ''));
  } else if (kind === 'move' && src.rem && !res.cancelled && !res.skipped) {
    // downloaded fine: remove the originals from the NAS
    const d = await api.nasDelete({ id: src.rem.id, paths: names.map((n) => remJoin(src.rem.path, n)) });
    await Promise.all(panels.map((p) => p.refresh()));
    if (d.error) await msg('NAS', d.error);
  } else if (kind === 'move' && src.arc && !res.cancelled && !res.skipped) {
    // "move" out of an archive = extracted fine, now drop the entries from the archive
    const pre = arcPrefix(src);
    await arcModify('Removing from archive', src.arc.file, { remove: names.map((n) => pre + n) });
  }
}

async function makeDir() {
  const p = A();
  if (p.rem) return mkdirRemote();
  if (p.arc) return mkdirInArc();
  const r = await dialog({
    title: 'New folder',
    text: 'Enter new directory name:',
    input: '',
    buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }],
  });
  const name = r.input && r.input.trim();
  if (r.value !== 'ok' || !name) return;
  const full = P.resolve(p.dir, name);
  const res = await api.mkdir(full);
  if (res.error) return msg('Error', res.error);
  // go to the first path component created under the current dir
  const first = full.slice(p.dir.length).replace(/^[\\/]+/, '').split(/[\\/]/)[0];
  await p.load(p.dir, { push: false, focusName: first });
  if (O().dir === p.dir) O().refresh();
}

async function deleteSel(permanent) {
  const p = A();
  if (p.rem) return deleteRemote();
  if (p.arc) return deleteFromArc();
  const items = p.targets();
  if (!items.length) return;
  const what = items.length === 1 ? `"${items[0].name}"` : `${items.length} selected item(s)`;
  const r = await dialog({
    title: 'Delete',
    text: permanent
      ? `Permanently delete ${what}?\nThis cannot be undone.`
      : `Move ${what} to the ${isMac ? 'Trash' : 'Recycle Bin'}?`,
    buttons: [{ label: 'Yes', value: 'yes', primary: true }, { label: 'No', value: 'no', cancel: true }],
  });
  if (r.value !== 'yes') return;
  const res = await api.del({ sources: items.map((i) => P.join(p.dir, i.name)), permanent });
  await Promise.all(panels.map((x) => x.refresh()));
  if (res.errors.length) msg('Error', res.errors.slice(0, 8).join('\n'));
}

const OKCANCEL = [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }];
const isZip = (n) => /\.zip$/i.test(n);
const isSevenArc = (n) => /\.(7z|tar|cab|tgz|tbz2?|txz|tar\.(gz|bz2|xz))$/i.test(n); // browsed read-only through 7za
const isDocFile = (n) => typeof V_DOC !== 'undefined' && !!V_DOC[splitExt(n)[1].toLowerCase()];
const isArc = (n) => isZip(n) || isSevenArc(n);
const arcReadOnly = (a) => !!(a.remote || isSevenArc(a.file));

/** run a main-process job with a progress dialog */
async function withProgress(title, start) {
  return runJob(title, start);
}
const showErrors = (errors) =>
  errors.length && msg('Error', errors.slice(0, 8).join('\n') + (errors.length > 8 ? `\n... and ${errors.length - 8} more` : ''));

async function packSel() {
  const src = A(), dst = O();
  if (needLocal('Pack', src, dst)) return;
  if (src.arc || dst.arc) return msg('Pack', 'Packing from or into an archive is not supported yet.');
  const items = src.targets();
  if (!items.length) return;
  const names = items.map((i) => i.name);
  const base = names.length === 1 ? (items[0].isDir ? names[0] : splitExt(names[0])[0]) : P.basename(src.dir) || 'archive';
  const r = await dialog({
    title: 'Pack files',
    text: names.length === 1 ? `Pack "${names[0]}" to archive (zip):` : `Pack ${names.length} file(s)/dir(s) to archive (zip):`,
    input: P.join(dst.dir, base + '.zip'),
    buttons: OKCANCEL,
  });
  let val = r.input && r.input.trim();
  if (r.value !== 'ok' || !val) return;
  if (!isZip(val)) val += '.zip';
  const archive = P.resolve(src.dir, val);
  const st = await api.stat(archive);
  if (st.exists) {
    if (st.isDir) return msg('Error', 'A folder with this name already exists.');
    const c = await dialog({
      title: 'Confirm overwrite',
      text: `"${P.basename(archive)}" already exists.\nOverwrite?`,
      buttons: [{ label: 'Overwrite', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }],
    });
    if (c.value !== 'ok') return;
  }
  const res = await withProgress('Packing', (id) =>
    api.zipPack({ id, sources: items.map((i) => P.join(src.dir, i.name)), archive }));
  await Promise.all(panels.map((p) => p.refresh()));
  await showErrors(res.errors);
}

async function unpackSel() {
  const src = A(), dst = O();
  if (needLocal('Unpack', src, dst)) return;
  const archives = src.arc
    ? [{ name: P.basename(src.arc.file), full: src.arc.file }]
    : src.targets().filter((i) => !i.isDir && isZip(i.name));
  if (dst.arc) return msg('Unpack', 'Unpacking into an archive is not supported.');
  if (!archives.length) return msg('Unpack', 'Select (or put the cursor on) a .zip archive.');
  const r = await dialog({
    title: 'Unpack files',
    text: archives.length === 1 ? `Unpack all files from "${archives[0].name}" to:` : `Unpack all files from ${archives.length} archives to:`,
    input: P.join(dst.dir, '*.*'),
    buttons: OKCANCEL,
  });
  const val = r.input && r.input.trim();
  if (r.value !== 'ok' || !val) return;
  const destDir = P.resolve(src.realDir(), val.replace(/\*\.\*$/, '') || '.');
  const allErrors = [];
  for (const a of archives) {
    const archive = a.full || P.join(src.dir, a.name);
    const info = await api.zipInspect({ archive, destDir });
    if (info.error) { allErrors.push(`${a.name}: ${info.error}`); continue; }
    let overwrite = 'skip';
    if (info.conflictCount) {
      const more = info.conflictCount > info.conflicts.length ? `\n... and ${info.conflictCount - info.conflicts.length} more` : '';
      const c = await dialog({
        title: 'Confirm overwrite',
        text: `${a.name}: already exist in the target folder:\n${info.conflicts.join('\n')}${more}`,
        buttons: [
          { label: 'Overwrite', value: 'all', primary: true },
          { label: 'Skip existing', value: 'skip' },
          { label: 'Cancel', value: 'cancel', cancel: true },
        ],
      });
      if (c.value === 'cancel') break;
      overwrite = c.value;
    }
    const res = await withProgress('Unpacking', (id) => api.zipUnpack({ id, archive, destDir, overwrite }));
    allErrors.push(...res.errors);
    if (res.cancelled) break;
  }
  await Promise.all(panels.map((p) => p.refresh()));
  await showErrors(allErrors);
}

async function openCurrent() {
  const it = A().cur();
  if (!it || it.up) return;
  if (A().arc || A().rem) return A().enter();
  const err = await api.open(P.join(A().dir, it.name));
  if (err) msg('Error', err);
}

const globToRe = (g) =>
  new RegExp('^' + g.split(';').map((s) => s.trim()).filter(Boolean)
    .map((s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')).join('|') + '$', 'i');

async function selectGroup(on) {
  const r = await dialog({
    title: on ? 'Select group' : 'Unselect group',
    text: 'Mask (e.g. *.jpg;*.png):',
    input: '*.*',
    buttons: [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }],
  });
  if (r.value !== 'ok' || !r.input.trim()) return;
  const mask = r.input.trim() === '*.*' ? '*' : r.input.trim();
  const re = globToRe(mask);
  A().selectWhere((i) => !i.isDir && re.test(i.name), on);
}

function copyNames(withPath) {
  const p = A();
  const t = p.targets().map((i) => (withPath ? P.join(p.dir, i.name) : i.name));
  navigator.clipboard.writeText(t.join('\n')).catch(() => {});
}

function swapPanels() {
  const [a, b] = panels;
  const sa = a.snap(), sb = b.snap();
  a.go(sb);
  b.go(sa);
}

const soon = () => msg('Commander', 'Not implemented yet.');

// ------------------------------------------------------------------ menu
const M = isMac ? 'Cmd' : 'Ctrl';
const MENUS = [
  ['Files', [
    { l: 'View', k: 'F3', f: () => openViewer() },
    { l: 'Edit', k: 'F4', f: () => openEditor() },
    { l: 'Edit New File...', k: 'Shift+F4', f: () => newFileEdit() },
    { l: 'Open With Default Application', f: () => openCurrent() },
    { l: 'Run in ZX Spectrum Emulator', f: () => { const p = A(), it = p.cur(); if (it && !it.isDir && !it.up && !p.arc && !p.rem) openEmulator(P.join(p.dir, it.name)); } },
    { l: 'Change Attributes...', f: () => ftAttributes() },
    { l: 'Pack...', k: 'Alt+F5', f: () => packSel() },
    { l: 'Unpack Specific Files...', k: 'Alt+F9', f: () => unpackSel() },
    { l: 'Test Archive(s)', k: 'Alt+Shift+F9', f: () => ftTestArchives() },
    { l: 'Compare By Content...', f: () => ftCompare() },
    '-',
    { l: 'Properties...', k: 'Alt+Enter', f: () => ftProperties() },
    { l: 'Calculate Occupied Space...', k: M + '+L', f: () => ftCalcSpace() },
    { l: 'Multi-Rename Tool...', k: M + '+M', f: () => openMultiRename() },
    { l: 'Rename (Shift+F6)', k: 'Shift+F6', f: () => copyMove('move', { renameOnly: true }) },
    { l: 'Edit Comment...', k: 'Ctrl+Z', f: () => ftComment() },
    '-',
    { l: 'Split File...', f: () => ftSplit() },
    { l: 'Combine Files...', f: () => ftCombine() },
    { l: 'Encode File (MIME, UUE)...', f: () => ftEncode() },
    { l: 'Decode File (MIME, UUE)...', f: () => ftDecode() },
    { l: 'Create Checksum File(s)...', f: () => ftChecksumCreate() },
    { l: 'Verify Checksums...', f: () => ftChecksumVerify() },
    '-',
    { l: 'Quit', k: 'Alt+F4', f: () => api.quit() },
  ]],
  ['Mark', [
    { l: 'Select Group...', k: 'Num +', f: () => selectGroup(true) },
    { l: 'Unselect Group...', k: 'Num -', f: () => selectGroup(false) },
    { l: 'Select All', k: M + '+A', f: () => A().selectWhere(() => true, true) },
    { l: 'Unselect All', k: M + '+Num -', f: () => A().selectWhere(() => true, false) },
    { l: 'Invert Selection', k: 'Num *', f: () => A().items.forEach((i) => A().sel.has(i.name) ? A().sel.delete(i.name) : A().sel.add(i.name)) || A().render() },
    { l: 'Select All With Same Extension', k: 'Alt+Num +', f: () => selectSameExt() },
    '-',
    { l: 'Compare Directories', k: 'Shift+F2', f: () => compareDirectories() },
    '-',
    { l: 'Copy Selected Names To Clipboard', f: () => copyNames(false) },
    { l: 'Copy Names With Path To Clipboard', f: () => copyNames(true) },
  ]],
  ['Commands', [
    { l: 'Search...', k: 'Alt+F7', f: () => openSearch() },
    { l: 'Synchronize Dirs...', f: () => openSync() },
    { l: 'Directory Hotlist', k: M + '+D', f: () => openHotlist() },
    { l: 'Music Player: Play / Pause', k: isMac ? 'Option+Space' : 'Ctrl+Space', f: () => playerToggle() },
    { l: 'Music Player: Next Track', k: M + '+Shift+Right', f: () => playerStep(1) },
    { l: 'Music Player: Previous Track', k: M + '+Shift+Left', f: () => playerStep(-1) },
    { l: 'Music Player: Stop', f: () => playerStop() },
    '-',
    { l: 'Go Back', k: 'Alt+Left', f: () => A().back(-1) },
    { l: 'Go Forward', k: 'Alt+Right', f: () => A().back(1) },
    '-',
    { l: 'Source<->Target', k: M + '+U', f: swapPanels },
    { l: 'Target=Source', f: () => O().go(A().snap()) },
  ]],
  ['Net', [
    { l: 'Synology NAS...', k: M + '+F', f: () => openConnections(undefined, 'nas') },
    { l: 'SSH server...', k: M + '+Shift+F', f: () => openConnections(undefined, 'ssh') },
    { l: 'Import from WinSCP...', f: () => openWinscpImport() },
    { l: 'Dropbox...', f: () => openConnections(undefined, 'dropbox') },
    { l: 'Google Drive...', f: () => openConnections(undefined, 'gdrive') },
    { l: 'SSH: Console / File List', k: M + '+O', f: () => sshToggleConsole(A()) },
    { l: 'Open in PuTTY', f: () => openInPutty() },
    { l: 'Disconnect (NAS / SSH)', f: () => nasDisconnect() },
    '-',
    { l: 'Left drive list', k: 'Alt+F1', f: () => openDrivePicker(panels[0]) },
    { l: 'Right drive list', k: 'Alt+F2', f: () => openDrivePicker(panels[1]) },
    '-',{ l: 'FTP Connect...', k: M + '+F', f: soon, dis: true }]],
  ['Show', [
    { l: 'Quick View Panel', k: 'Ctrl+Q', f: () => qvToggle() },
    { l: 'Thumbnails', k: M + '+Shift+F4', f: () => A().setThumbs(!A().thumbs) },
    '-',
    { l: 'New Folder Tab', k: M + '+T', f: () => A().newTab() },
    { l: 'Close Tab', k: M + '+W', f: () => A().closeTab() },
    { l: 'Next Tab', k: 'Ctrl+Tab', f: () => A().switchTab(A().ti + 1) },
    { l: 'Previous Tab', k: 'Ctrl+Shift+Tab', f: () => A().switchTab(A().ti - 1) },
    '-',
    { l: 'Name', k: M + '+F3', f: () => A().setSort('name') },
    { l: 'Extension', k: M + '+F4', f: () => A().setSort('ext') },
    { l: 'Time', k: M + '+F5', f: () => A().setSort('time') },
    { l: 'Size', k: M + '+F6', f: () => A().setSort('size') },
    '-',
    { l: 'Reread Source', k: M + '+R', f: () => A().refresh() },
  ]],
  ['Configuration', [
    { l: () => (document.body.classList.contains('no-toolbar') ? '    Show toolbar' : '✓  Show toolbar'), f: () => toggleToolbar() },
    '-',
    { l: 'Check for Updates...', f: () => checkForUpdates(false) },
    { l: 'File index (fast search)...', f: () => openIndexDialog() },
    { l: 'Language...', f: () => openLanguageDialog() },
    { l: 'Settings in Dropbox...', f: () => openSyncDialog() },
    { l: 'Options...', f: soon, dis: true },
  ]],
  ['Start', [{ l: 'Open Home Folder', f: () => A().load(api.home) }]],
];

/** Ctrl+Up: open the folder (or archive) under the cursor in a new tab */
async function openInNewTab(p) {
  const it = p.cur();
  if (!it || it.up || p.arc || p.rem) return p.newTab();
  const full = P.join(p.dir, it.name);
  if (it.isDir) return p.newTab({ dir: full });
  if (isArc(it.name)) return p.newTab({ arc: { file: full, inner: '' } });
  return p.newTab();
}

function selectSameExt() {
  const c = A().cur();
  if (!c || c.up || c.isDir) return;
  const e = splitExt(c.name)[1].toLowerCase();
  A().selectWhere((i) => !i.isDir && splitExt(i.name)[1].toLowerCase() === e, true);
}

let menuOpen = -1, dropdownEl = null;
function closeMenu() {
  if (dropdownEl) dropdownEl.remove();
  dropdownEl = null;
  menuOpen = -1;
  document.querySelectorAll('#menubar .mi').forEach((m) => m.classList.remove('open'));
}
function openMenu(i) {
  closeMenu();
  menuOpen = i;
  const mi = $('#menubar').children[i];
  mi.classList.add('open');
  const dd = document.createElement('div');
  dd.className = 'dropdown';
  dd.style.left = mi.offsetLeft + 'px';
  for (const it of MENUS[i][1]) {
    if (it === '-') { dd.insertAdjacentHTML('beforeend', '<div class="sep"></div>'); continue; }
    const el = document.createElement('div');
    el.className = 'it' + (it.dis ? ' dis' : '');
    el.innerHTML = `<span>${esc(typeof it.l === 'function' ? it.l() : it.l)}</span><span class="k">${esc(it.k || '')}</span>`;
    el.onclick = (e) => {
      e.stopPropagation();
      if (it.dis) return;
      closeMenu();
      it.f();
    };
    dd.appendChild(el);
  }
  $('#menubar').appendChild(dd);
  dropdownEl = dd;
}
function buildMenu() {
  const bar = $('#menubar');
  MENUS.forEach(([label], i) => {
    const el = document.createElement('div');
    el.className = 'mi';
    el.textContent = label;
    el.onclick = (e) => { e.stopPropagation(); menuOpen === i ? closeMenu() : openMenu(i); };
    el.onmouseenter = () => { if (menuOpen >= 0 && menuOpen !== i) openMenu(i); };
    bar.appendChild(el);
  });
  document.addEventListener('mousedown', (e) => { if (menuOpen >= 0 && !e.target.closest('#menubar')) closeMenu(); });
}

// ------------------------------------------------------------------ F-keys bar
const FKEYS = [
  ['F3 View', () => openViewer()],
  ['F4 Edit', () => openEditor()],
  ['F5 Copy', () => copyMove('copy')],
  ['F6 Move', () => copyMove('move')],
  ['F7 NewFolder', () => makeDir()],
  ['F8 Delete', () => deleteSel(false)],
  ['Alt+F4 Exit', () => api.quit()],
];
function buildFkeys() {
  for (const [label, fn] of FKEYS) {
    const b = document.createElement('button');
    b.textContent = label;
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = fn;
    $('#fkeys').appendChild(b);
  }
}

// ------------------------------------------------------------------ keyboard
const cmdEl = $('#cmd');
async function runCommand() {
  const c = cmdEl.value.trim();
  if (!c) return;
  cmdEl.value = '';
  cmdEl.blur();
  const err = await api.run(c, A().realDir());
  if (err) msg('Error', err);
}

document.addEventListener('keydown', async (e) => {
  if (modalCount > 0) return;
  const k = e.key;
  if (menuOpen >= 0) {
    if (k === 'Escape') { closeMenu(); e.preventDefault(); }
    return;
  }
  // focus inside the SSH console: every key belongs to the remote shell, except Ctrl+O (back to the file list)
  if (e.target instanceof Element && e.target.closest('.termbox')) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && keyLetter(e) === 'o') { e.preventDefault(); sshToggleConsole(A()); }
    return;
  }
  const mod = e.ctrlKey || (isMac && e.metaKey);
  const p = A();
  const typing = cmdEl.value !== '';

  // function keys
  if (/^F\d+$/.test(k)) {
    e.preventDefault();
    if (k === 'F2' && e.shiftKey) { compareDirectories(); return; }
    if ((k === 'F1' || k === 'F2') && e.altKey) {
      // Alt+F1 / Alt+F2: drive list of the left / right panel
      openDrivePicker(panels[k === 'F1' ? 0 : 1]);
      return;
    }
    if (k === 'F4' && mod && e.shiftKey) { p.setThumbs(!p.thumbs); return; } // Ctrl+Shift+F4: thumbnail view of the panel
    if (k === 'F3' || k === 'F4') {
      if (mod && k === 'F3') p.setSort('name');
      else if (mod && k === 'F4') p.setSort('ext');
      else if (k === 'F4' && e.altKey) api.quit();
      else if (k === 'F3') openViewer();
      else if (e.shiftKey) newFileEdit();
      else openEditor();
    } else if (k === 'F5') {
      if (mod) p.setSort('time');
      else if (e.altKey) packSel();
      else copyMove('copy');
    } else if (k === 'F6') {
      if (mod) p.setSort('size');
      else if (e.shiftKey) copyMove('move', { renameOnly: true });
      else copyMove('move');
    } else if (k === 'F7') {
      if (e.altKey) openSearch(); else makeDir();
    } else if (k === 'F8') deleteSel(e.shiftKey);
    else if (k === 'F9' && e.altKey && e.shiftKey) ftTestArchives();
    else if (k === 'F9' && e.altKey) unpackSel();
    else if (k === 'F9' || k === 'F10') openMenu(0);
    return;
  }

  // music player: Ctrl+Space pause/play, Ctrl+Shift+Left/Right previous/next track
  // (macOS: Ctrl+Space belongs to the system input-source switch, so Option+Space is used there)
  if ((isMac ? e.altKey && !e.ctrlKey && !e.metaKey : e.ctrlKey) && k === ' ') { e.preventDefault(); playerToggle(); return; }
  if (mod && e.shiftKey && (k === 'ArrowRight' || k === 'ArrowLeft')) { e.preventDefault(); playerStep(k === 'ArrowRight' ? 1 : -1); return; }

  switch (k) {
    case 'Tab':
      e.preventDefault();
      if (e.ctrlKey) p.switchTab(p.ti + (e.shiftKey ? -1 : 1));
      else if (qvIdx === null) O().focus();
      return;
    case 'Escape': cmdEl.value = ''; return;
    case 'ArrowUp':
    case 'ArrowDown':
      e.preventDefault();
      if (e.altKey) return;
      if (mod && k === 'ArrowUp') { openInNewTab(p); return; } // Ctrl+Up: folder under the cursor in a new tab
      if (e.shiftKey) p.toggleSel(p.cursor, false);
      p.move((k === 'ArrowUp' ? -1 : 1) * (p.thumbs ? p.thumbCols() : 1)); // in the thumbnail grid up / down jump a whole row
      return;
    case 'ArrowLeft':
    case 'ArrowRight':
      if (e.altKey) { e.preventDefault(); p.back(k === 'ArrowLeft' ? -1 : 1); }
      else if (p.thumbs && !typing && !mod) { e.preventDefault(); if (e.shiftKey) p.toggleSel(p.cursor, false); p.move(k === 'ArrowLeft' ? -1 : 1); }
      return;
    case 'PageUp': e.preventDefault(); p.move(-p.page()); return;
    case 'PageDown': e.preventDefault(); p.move(p.page()); return;
    case 'Home': if (!typing) { e.preventDefault(); p.setCursor(0); } return;
    case 'End': if (!typing) { e.preventDefault(); p.setCursor(p.view.length - 1); } return;
    case 'Enter':
      e.preventDefault();
      if (e.altKey && !typing) ftProperties(); // Alt+Enter: properties
      else if (typing) runCommand(); else p.enter();
      return;
    case 'Backspace': if (!typing) { e.preventDefault(); p.goUp(); } return;
    case 'Delete': if (!typing) { e.preventDefault(); deleteSel(e.shiftKey); } return;
    case 'Insert': e.preventDefault(); p.toggleSel(p.cursor); return;
    case ' ': if (!typing) { e.preventDefault(); p.spaceSelect(); } return; // select in place (+ folder size); Insert selects and goes down
  }
  if (e.code === 'NumpadAdd') { e.preventDefault(); e.altKey ? selectSameExt() : mod ? p.selectWhere(() => true, true) : selectGroup(true); return; }
  if (e.code === 'NumpadSubtract') { e.preventDefault(); mod ? p.selectWhere(() => true, false) : selectGroup(false); return; }
  if (e.code === 'NumpadMultiply') {
    e.preventDefault();
    p.items.forEach((i) => (p.sel.has(i.name) ? p.sel.delete(i.name) : p.sel.add(i.name)));
    p.render();
    return;
  }
  if (mod) {
    const l = keyLetter(e);
    if (l === 'r') { e.preventDefault(); p.refresh(); }
    else if (l === 'u') { e.preventDefault(); swapPanels(); }
    else if (l === 'a') { e.preventDefault(); p.selectWhere(() => true, true); }
    else if (l === 'q' && e.ctrlKey) { e.preventDefault(); qvToggle(); }
    else if (l === 'f') { e.preventDefault(); openConnections(undefined, e.shiftKey ? 'ssh' : 'nas'); } // Ctrl+F = Synology NAS, Ctrl+Shift+F = SSH server
    else if (l === 'o') { e.preventDefault(); sshToggleConsole(A()); }
    else if (l === 'm') { e.preventDefault(); openMultiRename(); }
    else if (l === 'l') { e.preventDefault(); ftCalcSpace(); }
    else if (l === 'z' && e.ctrlKey) { e.preventDefault(); ftComment(); }
    else if (l === 'd') { e.preventDefault(); openHotlist(); }
    else if (l === 't') { e.preventDefault(); p.newTab(); }
    else if (l === 'w') { e.preventDefault(); p.closeTab(); }
    return;
  }
  // printable character -> command line
  if (k.length === 1 && !e.altKey && document.activeElement !== cmdEl) cmdEl.focus();
});

// ------------------------------------------------------------------ init
(async function init() {
  buildMenu();
  buildFkeys();
  drives = await api.drives();
  places = await api.places();
  panels = [new Panel(0, $('#p0')), new Panel(1, $('#p1'))];
  const startDir = (i) => store.get(`dir${i}`, null) || api.home;
  for (const i of [1, 0]) {
    const p = panels[i];
    const saved = store.get(`tabs${i}`, null);
    if (saved && Array.isArray(saved.list) && saved.list.length > 1) {
      // restore the tabs of the previous session
      p.tabs = saved.list.map((d) => ({ nav: { dir: d }, focus: undefined, sortKey: p.sortKey, sortRev: p.sortRev, hist: [], hi: -1 }));
      await p.applyTab(Math.min(Math.max(0, saved.ti | 0), p.tabs.length - 1));
    } else {
      const ok = await p.load(startDir(i));
      if (!ok) await p.load(api.home);
    }
  }
  panels[0].focus();
  window.__commander = { panels, A, O };
  // a quiet check for a newer version a few seconds after start (not while a test script drives the window)
  if (typeof checkForUpdates === 'function') setTimeout(() => checkForUpdates(true), 6000);
})();

/** Net > Open in PuTTY: the SSH server of the active panel (or of the other panel) in a PuTTY window */
async function openInPutty() {
  const exe = await api.puttyFind();
  if (!exe) return msg('PuTTY', 'PuTTY was not found on this computer. Install it from putty.org and try again.');
  const p = A().rem && A().rem.type === 'sftp' ? A() : panels.find((x) => x.rem && x.rem.type === 'sftp');
  if (!p) return msg('PuTTY', 'Connect to an SSH server first (Net > SSH server...): this opens that server in PuTTY.');
  const c = nasLoad().find((x) => x.id === p.rem.id);
  if (!c) return msg('PuTTY', 'The connection is not saved, so its address is not known. Save it in Net > SSH server... first.');
  const r = await api.puttyOpen({ host: String(c.url || '').replace(/^ssh:\/\//i, ''), port: c.port, user: c.user, keyPath: c.keyPath });
  if (r && r.error) msg('PuTTY', r.error);
}
