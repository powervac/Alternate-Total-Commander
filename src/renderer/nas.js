'use strict';
// Connection windows, one per kind, each showing only its own saved connections:
//   Ctrl+F  Synology NAS   Ctrl+Shift+F  SSH server   Net menu: Dropbox..., Google Drive...
// Uses helpers from app.js (A, panels, store, dialog, msg, openModal, modalCount, esc, api, REM_ICON, RECORD_REM, remTitle)
// and ssh.js (console).

function nasLoad() {
  const v = store.get('nas', null);
  return Array.isArray(v) ? v : [];
}
const nasSave = (list) => store.set('nas', list);
const nasNewId = () => 'nas-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
/** record kind: 'nas' | 'ssh' | 'dropbox' | 'gdrive' (records saved before the clouds existed have no type: NAS) */
const connType = (c) => (c && RECORD_REM[c.type] ? c.type : 'nas');

function nasDefaultName(url) {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(url) ? url : 'https://' + url);
    return u.hostname.endsWith('.quickconnect.to') ? u.hostname.split('.')[0] : u.hostname;
  } catch {
    return url;
  }
}

/** connections that are open right now (id -> {id, name, type: panel type, home}); the drive list offers them to come back to */
const liveConns = new Map();

/** show an open connection in panel p again (SSH: the same console with its history) */
async function openLive(p, l) {
  p.focus();
  const ok = await p.loadRem({ id: l.id, name: l.name, type: l.type }, l.home || '/');
  if (!ok) { liveConns.delete(l.id); return; } // the session is gone
  if (l.type === 'sftp') await sshShowConsole(p);
}

/** leave the remote server in the panels that show it (after a disconnect) */
async function nasDisconnect(p = A()) {
  if (!p.rem) return;
  const id = p.rem.id;
  liveConns.delete(id);
  if (typeof sshDispose === 'function') sshDispose(id);
  await api.nasDisconnect({ id });
  for (const q of panels) if (q.rem && q.rem.id === id) await q.load(q.lastLocal || api.home);
}

const CLOUD_HELP = {
  dropbox:
    'One-time setup (free, 2 minutes):\n' +
    '1. Open the Dropbox App Console, press "Create app", choose "Scoped access", then "Full Dropbox", give it any name.\n' +
    '2. On the Permissions tab tick files.metadata.read, files.metadata.write, files.content.read, files.content.write and press Submit.\n' +
    '3. On the Settings tab copy the "App key" into the field above.\n' +
    'Then: Sign in with Dropbox (a browser page opens), approve, paste the code it shows here, press Connect.',
  gdrive:
    'One-time setup (free, 5 minutes):\n' +
    '1. In the Google Cloud Console create a project and enable the "Google Drive API" (APIs & Services > Library).\n' +
    '2. OAuth consent screen: type External, add your own Google account as a test user. To keep the login longer than 7 days press "Publish app" there (Google then shows an "unverified app" warning once; that is fine for your own use).\n' +
    '3. Credentials > Create credentials > OAuth client ID > application type "Desktop app". Copy the Client ID and Client secret into the fields above.\n' +
    'Then press Connect: your browser opens, you approve, and you are back here.',
};
const CLOUD_LINKS = {
  dropbox: ['Open the Dropbox App Console', 'https://www.dropbox.com/developers/apps'],
  gdrive: ['Open the Google Cloud Console', 'https://console.cloud.google.com/apis/credentials'],
};
const KIND_TITLE = {
  nas: 'Synology NAS (File Station / QuickConnect)',
  ssh: 'SSH server (console + files)',
  dropbox: 'Dropbox',
  gdrive: 'Google Drive',
};

/**
 * kind: 'nas' | 'ssh' | 'dropbox' | 'gdrive'. selectId (optional): a saved connection to select; its kind wins.
 */
function openConnections(selectId, kind) {
  if (modalCount > 0) return;
  const all = nasLoad(); // every saved record of all kinds
  const sel = selectId && all.find((c) => c.id === selectId);
  kind = sel ? connType(sel) : kind || 'nas';
  const ssh = kind === 'ssh';
  const cloud = kind === 'dropbox' || kind === 'gdrive';
  let list = all.filter((c) => connType(c) === kind); // what this window shows
  let cur = (sel && connType(sel) === kind ? sel : null) || list[0] || null;
  const saveAll = () => nasSave([...all.filter((c) => connType(c) !== kind), ...list]);
  let pending = null; // Dropbox: { verifier } between "Sign in" and "Connect"

  const box = document.createElement('div');
  box.className = 'dlg nas';
  const row = (ks, html) => `<div class="nas-row" data-k="${ks}">${html}</div>`;
  box.innerHTML =
    `<div class="dlg-title">${esc(KIND_TITLE[kind])}</div>` +
    '<div class="dlg-body"><div class="nas-wrap"><div class="nas-list"></div>' +
    '<div class="nas-form">' +
    row('nas ssh dropbox gdrive', '<label>Name:</label><input class="n-name" spellcheck="false">') +
    row('nas ssh', `<label>${ssh ? 'Host:' : 'Address:'}</label><input class="n-url" spellcheck="false" placeholder="${ssh ? 'server name or IP address' : 'https://id.region.quickconnect.to  or  nas.local:5001'}">`) +
    row('ssh', '<label>Port:</label><input class="n-port" spellcheck="false" placeholder="22">') +
    row('nas ssh', '<label>User:</label><input class="n-user" spellcheck="false" autocomplete="off">') +
    row('ssh', '<label>Key file:</label><span class="n-keyrow"><input class="n-key" spellcheck="false" placeholder="optional: private key (OpenSSH / PEM)"><button class="n-browse" type="button">Browse...</button></span>') +
    row('nas ssh', '<label class="n-pass-label">Password:</label><input class="n-pass" type="password" autocomplete="off">') +
    row('nas', '<label>2-step code:</label><input class="n-otp" spellcheck="false" autocomplete="off" placeholder="only if 2-step verification is on">') +
    row('nas', '<span></span><label class="n-chk"><input type="checkbox" class="n-insecure"> Allow an untrusted certificate (self-signed)</label>') +
    row('dropbox', '<label>App key:</label><input class="n-appkey" spellcheck="false" autocomplete="off">') +
    row('dropbox', '<label>Sign in:</label><span class="n-keyrow"><button class="n-signin" type="button">Sign in with Dropbox</button><input class="n-code" spellcheck="false" autocomplete="off" placeholder="paste the code from the browser here"></span>') +
    row('gdrive', '<label>Client ID:</label><input class="n-clientid" spellcheck="false" autocomplete="off">') +
    row('gdrive', '<label>Client secret:</label><input class="n-secret" type="password" autocomplete="off">') +
    row('gdrive', '<span></span><button class="n-signin" type="button">Sign in again</button>') +
    row('nas ssh dropbox gdrive', `<span></span><label class="n-chk"><input type="checkbox" class="n-remember"> ${cloud ? 'Stay signed in on this computer (the login is saved, encrypted by the system)' : 'Remember the password (encrypted by the system)'}</label>`) +
    '</div></div>' +
    (cloud ? `<div class="nas-help"><button class="n-link" type="button">${CLOUD_LINKS[kind][0]}</button><div class="n-help-text"></div></div>` : '') +
    '<div class="nas-status"></div></div>' +
    '<div class="dlg-btns"><button class="n-connect primary">Connect</button><button class="n-save">Save</button><button class="n-new">New</button><button class="n-del">Delete</button><button class="n-close">Close</button></div>';
  for (const r of box.querySelectorAll('.nas-row')) r.hidden = !r.dataset.k.split(' ').includes(kind);
  const q = (s) => box.querySelector(s);
  const $list = q('.nas-list'), $status = q('.nas-status');
  const $name = q('.n-name'), $url = q('.n-url'), $port = q('.n-port'), $user = q('.n-user');
  const $key = q('.n-key'), $pass = q('.n-pass'), $otp = q('.n-otp'), $insecure = q('.n-insecure'), $remember = q('.n-remember');
  const $appkey = q('.n-appkey'), $code = q('.n-code'), $clientid = q('.n-clientid'), $secret = q('.n-secret');
  const buttons = box.querySelectorAll('.dlg-btns button');
  let closeModal;
  if (cloud) q('.n-help-text').textContent = CLOUD_HELP[kind];

  const applyPassLabel = () => { if (ssh) q('.n-pass-label').textContent = $key.value.trim() ? 'Key passphrase:' : 'Password:'; };

  function renderList() {
    $list.innerHTML = list.length
      ? list.map((c, i) => `<div class="nas-item${c === cur ? ' on' : ''}" data-i="${i}">${esc(c.name || nasDefaultName(c.url || ''))}</div>`).join('')
      : `<div class="nas-empty">No saved ${esc(KIND_TITLE[kind].split(' (')[0])} connections yet.<br>Fill in the form and press Connect or Save.</div>`;
  }
  function fill() {
    const c = cur || { name: '', url: '', user: '', insecure: false, remember: cloud, pw: '' };
    $name.value = c.name || '';
    if ($url) $url.value = c.url || '';
    if ($port) $port.value = c.port || '';
    if ($user) $user.value = c.user || '';
    if ($key) $key.value = c.keyPath || '';
    if ($pass) { $pass.value = ''; $pass.placeholder = c.pw ? '(saved)' : ''; }
    if ($otp) $otp.value = '';
    if ($insecure) $insecure.checked = !!c.insecure;
    if ($appkey) $appkey.value = c.appKey || '';
    if ($code) { $code.value = ''; $code.placeholder = c.pw ? '(signed in - no code needed)' : 'paste the code from the browser here'; }
    if ($clientid) $clientid.value = c.clientId || '';
    if ($secret) { $secret.value = ''; $secret.placeholder = c.sec ? '(saved)' : ''; }
    $remember.checked = !!c.remember;
    pending = null;
    applyPassLabel();
  }
  const setStatus = (t, bad) => { $status.textContent = t; $status.classList.toggle('bad', !!bad); };

  /** values of the form as a connection record (id reused when editing) */
  function formConn() {
    const url = $url ? $url.value.trim() : '';
    return {
      id: cur ? cur.id : nasNewId(),
      type: kind,
      name: $name.value.trim() || (url ? nasDefaultName(url) : KIND_TITLE[kind].split(' (')[0]),
      url,
      port: $port ? $port.value.trim() : '',
      user: $user ? $user.value.trim() : '',
      keyPath: $key ? $key.value.trim() : '',
      insecure: $insecure ? $insecure.checked : false,
      appKey: $appkey ? $appkey.value.trim() : '',
      clientId: $clientid ? $clientid.value.trim() : '',
      sec: cur ? cur.sec : '',
      remember: $remember.checked,
      pw: cur ? cur.pw : '',
    };
  }

  const decrypt = async (enc) => (enc ? (await api.nasCrypt({ text: enc, decrypt: true })).text || '' : '');
  const encrypt = async (text) => (text ? (await api.nasCrypt({ text })).text || '' : '');

  /** store the connection; secret = the password, or the cloud refresh token */
  async function persist(conn, secret) {
    if (conn.remember && secret) {
      const enc = await encrypt(secret);
      if (enc) conn.pw = enc;
      else { conn.pw = ''; conn.remember = false; setStatus('The system cannot encrypt secrets here, so the login was not saved.', true); }
    } else if (!conn.remember) conn.pw = '';
    if (kind === 'gdrive' && $secret.value) conn.sec = await encrypt($secret.value); // Google client secret
    const i = list.findIndex((c) => c.id === conn.id);
    if (i >= 0) list[i] = conn; else list.push(conn);
    cur = conn;
    saveAll();
    renderList();
  }

  async function save() {
    const conn = formConn();
    if (!(conn.url || conn.appKey || conn.clientId)) return setStatus(ssh ? 'Enter the host name or address.' : kind === 'nas' ? 'Enter the address of the NAS.' : 'Enter the app key / client ID first.', true);
    await persist(conn, ssh || kind === 'nas' ? $pass.value : '');
    fill();
    setStatus('Saved.');
  }

  /** Dropbox: open the sign-in page (the code it shows goes into the "code" field) */
  async function dropboxSignIn() {
    const appKey = $appkey.value.trim();
    if (!appKey) { $appkey.focus(); return setStatus('Enter the app key of your Dropbox app first.', true); }
    const r = await api.cloudDropboxStart({ appKey });
    if (r.error) return setStatus(r.error, true);
    pending = { verifier: r.verifier };
    setStatus('A browser page was opened. Approve the access, copy the code Dropbox shows, paste it into the field and press Connect.');
    $code.focus();
  }

  /** the refresh token this connection should use, or null if the user must sign in */
  async function cloudCredentials(conn, forceSignIn) {
    if (kind === 'dropbox') {
      if (!conn.appKey) { $appkey.focus(); setStatus('Enter the app key of your Dropbox app.', true); return null; }
      const code = $code.value.trim();
      if (code) {
        if (!pending) { setStatus('Press "Sign in with Dropbox" first, then paste the code.', true); return null; }
        return { appKey: conn.appKey, code, verifier: pending.verifier };
      }
      const saved = forceSignIn ? '' : await decrypt(cur && cur.pw);
      if (saved) return { appKey: conn.appKey, refreshToken: saved };
      setStatus('Press "Sign in with Dropbox", approve in the browser, paste the code here and press Connect.', true);
      return null;
    }
    // Google
    if (!conn.clientId) { $clientid.focus(); setStatus('Enter the client ID of your Google OAuth client.', true); return null; }
    const clientSecret = $secret.value || (await decrypt(cur && cur.sec));
    const saved = forceSignIn ? '' : await decrypt(cur && cur.pw);
    if (saved) return { clientId: conn.clientId, clientSecret, refreshToken: saved };
    setStatus('Waiting for you in the browser: sign in to Google and press Allow ...');
    const r = await api.cloudGoogleSignIn({ clientId: conn.clientId, clientSecret });
    if (r.error) { setStatus(r.error, true); return null; }
    return { clientId: conn.clientId, clientSecret, refreshToken: r.refreshToken };
  }

  async function connect(forceSignIn = false) {
    const conn = formConn();
    let res;
    let secret = '';
    buttons.forEach((b) => (b.disabled = true));
    try {
      if (cloud) {
        const creds = await cloudCredentials(conn, forceSignIn);
        if (!creds) return;
        setStatus('Connecting...');
        res = await api.cloudConnect({ id: conn.id, kind, ...creds });
        if (!res.error) secret = res.refreshToken;
      } else {
        if (!conn.url) return setStatus(ssh ? 'Enter the host name or address.' : 'Enter the address of the NAS.', true);
        if (!conn.user) { $user.focus(); return setStatus('Enter the user name.', true); }
        let pass = $pass.value;
        if (!pass && cur && cur.pw) pass = await decrypt(cur.pw);
        if (!pass && !ssh) { $pass.focus(); return setStatus('Enter the password.', true); }
        if (ssh && !pass && !conn.keyPath) { $pass.focus(); return setStatus('Enter the password, or choose a key file.', true); }
        setStatus(ssh ? 'Connecting...' : 'Connecting... (QuickConnect can take a few seconds)');
        secret = pass;
        res = ssh
          ? await api.sshConnect({ id: conn.id, host: conn.url.replace(/^ssh:\/\//i, ''), port: conn.port, user: conn.user, pass: conn.keyPath ? '' : pass, keyPath: conn.keyPath, passphrase: conn.keyPath ? pass : '' })
          : await api.nasConnect({ id: conn.id, url: conn.url, user: conn.user, pass, otp: $otp.value.trim(), insecure: conn.insecure });
      }
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
    if (!res) return;
    if (res.error) {
      setStatus(res.error, true);
      if (res.code === 403 || res.code === 406) $otp && $otp.focus();
      else if (!cloud && (res.code === 400 || res.code === 404)) $pass.select();
      return;
    }
    await persist(conn, secret);
    closeModal();
    const type = RECORD_REM[kind];
    liveConns.set(conn.id, { id: conn.id, name: conn.name, type, home: ssh ? res.home || '/' : '/' });
    const p = A();
    p.focus();
    if (ssh) {
      // an SSH server opens as a console; Ctrl+O switches to the file list
      if (await p.loadRem({ id: conn.id, name: conn.name, type }, res.home || '/')) await sshShowConsole(p);
    } else await p.loadRem({ id: conn.id, name: conn.name, type }, '/');
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
  if ($key) $key.addEventListener('input', applyPassLabel);
  if (ssh) {
    q('.n-browse').onclick = async () => {
      const f = await api.openFileDialog({ title: 'Select the private key file', defaultPath: api.home + (api.platform === 'win32' ? '\\.ssh' : '/.ssh') });
      if (f) { $key.value = f; applyPassLabel(); }
    };
  }
  if (cloud) {
    q('.n-link').onclick = () => api.openUrl(CLOUD_LINKS[kind][1]);
    q('.n-signin').onclick = () => (kind === 'dropbox' ? dropboxSignIn() : connect(true));
  }
  q('.n-connect').onclick = () => connect();
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
  (cloud ? (cur ? $code || $secret : $name) : cur && !cur.user ? $user : cur ? $pass : $name).focus();
}
