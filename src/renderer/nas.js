'use strict';
// Two separate connection windows (they used to be one, which was confusing):
//   Ctrl+F        "Synology NAS"  (File Station / QuickConnect)
//   Ctrl+Shift+F  "SSH server"    (console + SFTP files)
// Each window shows only its own saved connections.
// Uses helpers from app.js (A, panels, store, dialog, msg, openModal, modalCount, esc, api) and ssh.js (console).

function nasLoad() {
  const v = store.get('nas', null);
  return Array.isArray(v) ? v : [];
}
const nasSave = (list) => store.set('nas', list);
const nasNewId = () => 'nas-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const connType = (c) => (c && c.type === 'ssh' ? 'ssh' : 'nas');

function nasDefaultName(url) {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(url) ? url : 'https://' + url);
    return u.hostname.endsWith('.quickconnect.to') ? u.hostname.split('.')[0] : u.hostname;
  } catch {
    return url;
  }
}

/** connections that are open right now (id -> {id, name, type: 'nas'|'sftp', home}); the drive list offers them to come back to */
const liveConns = new Map();

/** show an open connection in panel p again (SSH: the same console with its history) */
async function openLive(p, l) {
  p.focus();
  const ok = await p.loadRem({ id: l.id, name: l.name, type: l.type }, l.home || '/');
  if (!ok) { liveConns.delete(l.id); return; } // the session is gone
  if (l.type === 'sftp') await sshShowConsole(p);
}

/** leave the NAS / SSH server in the panels that show it (after a disconnect) */
async function nasDisconnect(p = A()) {
  if (!p.rem) return;
  const id = p.rem.id;
  liveConns.delete(id);
  if (typeof sshDispose === 'function') sshDispose(id);
  await api.nasDisconnect({ id });
  for (const q of panels) if (q.rem && q.rem.id === id) await q.load(q.lastLocal || api.home);
}

/**
 * kind: 'nas' or 'ssh'. selectId (optional): a saved connection to select; its kind wins.
 */
function openConnections(selectId, kind) {
  if (modalCount > 0) return;
  const all = nasLoad(); // every saved record of both kinds
  const sel = selectId && all.find((c) => c.id === selectId);
  kind = sel ? connType(sel) : kind || 'nas';
  const ssh = kind === 'ssh';
  let list = all.filter((c) => connType(c) === kind); // what this window shows
  let cur = (sel && connType(sel) === kind ? sel : null) || list[0] || null;
  const saveAll = () => nasSave([...all.filter((c) => connType(c) !== kind), ...list]);

  const box = document.createElement('div');
  box.className = 'dlg nas' + (ssh ? ' is-ssh' : '');
  box.innerHTML =
    `<div class="dlg-title">${ssh ? 'SSH server (console + files)' : 'Synology NAS (File Station / QuickConnect)'}</div>` +
    '<div class="dlg-body"><div class="nas-wrap"><div class="nas-list"></div>' +
    '<div class="nas-form">' +
    '<div class="nas-row"><label>Name:</label><input class="n-name" spellcheck="false"></div>' +
    `<div class="nas-row"><label>${ssh ? 'Host:' : 'Address:'}</label><input class="n-url" spellcheck="false" placeholder="${ssh ? 'server name or IP address' : 'https://id.region.quickconnect.to  or  nas.local:5001'}"></div>` +
    '<div class="nas-row only-ssh"><label>Port:</label><input class="n-port" spellcheck="false" placeholder="22"></div>' +
    '<div class="nas-row"><label>User:</label><input class="n-user" spellcheck="false" autocomplete="off"></div>' +
    '<div class="nas-row only-ssh"><label>Key file:</label><span class="n-keyrow"><input class="n-key" spellcheck="false" placeholder="optional: private key (OpenSSH / PEM)"><button class="n-browse" type="button">Browse...</button></span></div>' +
    '<div class="nas-row"><label class="n-pass-label">Password:</label><input class="n-pass" type="password" autocomplete="off"></div>' +
    '<div class="nas-row only-nas"><label>2-step code:</label><input class="n-otp" spellcheck="false" autocomplete="off" placeholder="only if 2-step verification is on"></div>' +
    '<div class="nas-row only-nas"><span></span><label class="n-chk"><input type="checkbox" class="n-insecure"> Allow an untrusted certificate (self-signed)</label></div>' +
    '<div class="nas-row"><span></span><label class="n-chk"><input type="checkbox" class="n-remember"> Remember the password (encrypted by the system)</label></div>' +
    '</div></div><div class="nas-status"></div></div>' +
    '<div class="dlg-btns"><button class="n-connect primary">Connect</button><button class="n-save">Save</button><button class="n-new">New</button><button class="n-del">Delete</button><button class="n-close">Close</button></div>';
  const q = (s) => box.querySelector(s);
  const $list = q('.nas-list'), $status = q('.nas-status');
  const $name = q('.n-name'), $url = q('.n-url'), $port = q('.n-port'), $user = q('.n-user');
  const $key = q('.n-key'), $pass = q('.n-pass'), $otp = q('.n-otp'), $insecure = q('.n-insecure'), $remember = q('.n-remember');
  const buttons = box.querySelectorAll('.dlg-btns button');
  let closeModal;

  const applyPassLabel = () => { q('.n-pass-label').textContent = ssh && $key.value.trim() ? 'Key passphrase:' : 'Password:'; };

  function renderList() {
    $list.innerHTML = list.length
      ? list.map((c, i) => `<div class="nas-item${c === cur ? ' on' : ''}" data-i="${i}">${esc(c.name || nasDefaultName(c.url))}</div>`).join('')
      : `<div class="nas-empty">No saved ${ssh ? 'SSH servers' : 'NAS connections'} yet.<br>Fill in the form and press Connect or Save.</div>`;
  }
  function fill() {
    const c = cur || { name: '', url: '', user: '', insecure: false, remember: false, pw: '' };
    $name.value = c.name || '';
    $url.value = c.url || '';
    $port.value = c.port || '';
    $user.value = c.user || '';
    $key.value = c.keyPath || '';
    $pass.value = '';
    $pass.placeholder = c.pw ? '(saved)' : '';
    $otp.value = '';
    $insecure.checked = !!c.insecure;
    $remember.checked = !!c.remember;
    applyPassLabel();
  }
  const setStatus = (t, bad) => { $status.textContent = t; $status.classList.toggle('bad', !!bad); };

  /** values of the form as a connection record (id reused when editing) */
  function formConn() {
    const url = $url.value.trim();
    return {
      id: cur ? cur.id : nasNewId(),
      type: kind,
      name: $name.value.trim() || nasDefaultName(url),
      url,
      port: $port.value.trim(),
      user: $user.value.trim(),
      keyPath: $key.value.trim(),
      insecure: $insecure.checked,
      remember: $remember.checked,
      pw: cur ? cur.pw : '',
    };
  }

  /** store the connection (and the password when asked to) */
  async function persist(conn, pass) {
    if (conn.remember && pass) {
      const r = await api.nasCrypt({ text: pass });
      if (r.text) conn.pw = r.text;
      else { conn.pw = ''; conn.remember = false; setStatus('The system cannot encrypt passwords here, so the password was not saved.', true); }
    } else if (!conn.remember) conn.pw = '';
    const i = list.findIndex((c) => c.id === conn.id);
    if (i >= 0) list[i] = conn; else list.push(conn);
    cur = conn;
    saveAll();
    renderList();
  }

  async function save() {
    const conn = formConn();
    if (!conn.url) return setStatus(ssh ? 'Enter the host name or address.' : 'Enter the address of the NAS.', true);
    await persist(conn, $pass.value);
    fill();
    setStatus('Saved.');
  }

  async function connect() {
    const conn = formConn();
    if (!conn.url) return setStatus(ssh ? 'Enter the host name or address.' : 'Enter the address of the NAS.', true);
    if (!conn.user) { $user.focus(); return setStatus('Enter the user name.', true); }
    let pass = $pass.value;
    if (!pass && cur && cur.pw) {
      const d = await api.nasCrypt({ text: cur.pw, decrypt: true });
      pass = d.text || '';
    }
    if (!pass && !ssh) { $pass.focus(); return setStatus('Enter the password.', true); }
    if (ssh && !pass && !conn.keyPath) { $pass.focus(); return setStatus('Enter the password, or choose a key file.', true); }
    buttons.forEach((b) => (b.disabled = true));
    setStatus(ssh ? 'Connecting...' : 'Connecting... (QuickConnect can take a few seconds)');
    let res;
    if (ssh) {
      res = await api.sshConnect({
        id: conn.id,
        host: conn.url.replace(/^ssh:\/\//i, ''),
        port: conn.port,
        user: conn.user,
        pass: conn.keyPath ? '' : pass,
        keyPath: conn.keyPath,
        passphrase: conn.keyPath ? pass : '',
      });
    } else {
      res = await api.nasConnect({ id: conn.id, url: conn.url, user: conn.user, pass, otp: $otp.value.trim(), insecure: conn.insecure });
    }
    buttons.forEach((b) => (b.disabled = false));
    if (res.error) {
      setStatus(res.error, true);
      if (res.code === 403 || res.code === 406) $otp.focus();
      else if (res.code === 400 || res.code === 404) $pass.select();
      return;
    }
    await persist(conn, pass);
    closeModal();
    liveConns.set(conn.id, { id: conn.id, name: conn.name, type: ssh ? 'sftp' : 'nas', home: ssh ? res.home || '/' : '/' });
    const p = A();
    p.focus();
    if (ssh) {
      // an SSH server opens as a console; Ctrl+O switches to the file list
      if (await p.loadRem({ id: conn.id, name: conn.name, type: 'sftp' }, res.home || '/')) await sshShowConsole(p);
    } else await p.loadRem({ id: conn.id, name: conn.name, type: 'nas' }, '/');
  }

  $list.addEventListener('mousedown', (e) => {
    const it = e.target.closest('.nas-item');
    if (!it) return;
    cur = list[+it.dataset.i];
    renderList();
    fill();
    setStatus('');
  });
  $list.addEventListener('dblclick', (e) => { if (e.target.closest('.nas-item')) connect(); });
  $key.addEventListener('input', applyPassLabel);
  q('.n-browse').onclick = async () => {
    const f = await api.openFileDialog({ title: 'Select the private key file', defaultPath: api.home + (api.platform === 'win32' ? '\\.ssh' : '/.ssh') });
    if (f) { $key.value = f; applyPassLabel(); }
  };
  q('.n-connect').onclick = connect;
  q('.n-save').onclick = save;
  q('.n-new').onclick = () => { cur = null; renderList(); fill(); setStatus(''); $name.focus(); };
  q('.n-del').onclick = async () => {
    if (!cur) return;
    const c = cur;
    const d = await dialog({
      title: 'Delete connection',
      text: `Delete the saved connection "${c.name}"?`,
      buttons: [{ label: 'Delete', value: 'yes', primary: true }, { label: 'Cancel', value: 'no', cancel: true }],
    });
    if (d.value !== 'yes') return;
    list = list.filter((x) => x !== c);
    saveAll();
    cur = list[0] || null;
    renderList();
    fill();
  };
  q('.n-close').onclick = () => closeModal();
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    else if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) { e.preventDefault(); connect(); }
  });

  closeModal = openModal(box);
  renderList();
  fill();
  (cur && !cur.user ? $user : cur ? $pass : $name).focus();
}
