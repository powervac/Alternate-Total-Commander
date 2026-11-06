'use strict';
// Connection windows, one per kind, each showing only its own saved connections:
//   Ctrl+F  Synology NAS   Ctrl+Shift+F  SSH server   Net menu: Dropbox..., Google Drive...
// The cloud windows are meant to be ONE button ("Sign in with Google" / "Sign in with Dropbox"): when the app key of the service
// is known (shipped in src/main/oauth-defaults.json, or entered once) everything else is hidden.
// Uses helpers from app.js (A, panels, store, dialog, msg, openModal, modalCount, esc, api, RECORD_REM) and ssh.js (console).

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
/** set by a remote favourite (Ctrl+D) whose connection was not open: after it connects, go to this folder instead of the root */
let nasPendingPath = null;

/** show an open connection in panel p again (SSH: the same console with its history) */
async function openLive(p, l) {
  p.focus();
  const ok = await p.loadRem({ id: l.id, name: l.name, type: l.type }, l.home || '/');
  if (!ok) { liveConns.delete(l.id); return; } // the session is gone
  if (l.type === 'sftp' && l.openAs === 'console') await sshShowConsole(p);
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
    'This program needs its own Dropbox "app key" once (free, 2 minutes). Anyone who gets a build that already contains the key sees only the button.\n' +
    '1. Open the Dropbox App Console, press "Create app", choose "Scoped access", then "Full Dropbox", give it any name.\n' +
    '2. Permissions tab: tick files.metadata.read, files.metadata.write, files.content.read, files.content.write and press Submit.\n' +
    '3. Settings tab: under "Redirect URIs" add   http://127.0.0.1:53682   and press Add. Copy the "App key" into the field above.\n' +
    'Then press "Sign in with Dropbox": your browser opens, you press Allow, and you are back here.',
  gdrive:
    'This program needs its own Google "Client ID" once (free, 5 minutes). Anyone who gets a build that already contains it sees only the button.\n' +
    '1. In the Google Cloud Console create a project and enable the "Google Drive API" (APIs & Services > Library).\n' +
    '2. OAuth consent screen: type External, add your own Google account as a test user. Press "Publish app" there so the login does not expire after 7 days (Google then shows an "unverified app" notice once; that is fine).\n' +
    '3. Credentials > Create credentials > OAuth client ID > application type "Desktop app". Copy the Client ID and Client secret into the fields above.\n' +
    'Then press "Sign in with Google": your browser opens, you press Allow, and you are back here.',
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
async function openConnections(selectId, kind) {
  if (modalCount > 0) return;
  const all = nasLoad(); // every saved record of all kinds
  const sel = selectId && all.find((c) => c.id === selectId);
  kind = sel ? connType(sel) : kind || 'nas';
  const ssh = kind === 'ssh';
  const cloud = kind === 'dropbox' || kind === 'gdrive';
  // app keys of the cloud services: shipped defaults (oauth-defaults.json) or what the user entered once (shared by all accounts of the kind)
  const shipped = cloud ? ((await api.cloudDefaults()) || {})[kind === 'gdrive' ? 'google' : 'dropbox'] || {} : {};
  const appWide = () => (store.get('cloudApp', {}) || {})[kind] || {};
  if (modalCount > 0) return;
  let list = all.filter((c) => connType(c) === kind); // what this window shows
  let cur = (sel && connType(sel) === kind ? sel : null) || list[0] || null;
  const saveAll = () => nasSave([...all.filter((c) => connType(c) !== kind), ...list]);

  const box = document.createElement('div');
  box.className = 'dlg nas';
  const row = (ks, html) => `<div class="nas-row" data-k="${ks}">${html}</div>`;
  const signInLabel = kind === 'gdrive' ? '<span class="g-logo">G</span> Sign in with Google' : 'Sign in with Dropbox';
  box.innerHTML =
    `<div class="dlg-title">${esc(KIND_TITLE[kind])}</div>` +
    '<div class="dlg-body"><div class="nas-wrap"><div class="nas-list"></div>' +
    '<div class="nas-form">' +
    row('nas ssh dropbox gdrive', '<label>Name:</label><input class="n-name" spellcheck="false">') +
    row('nas ssh', `<label>${ssh ? 'Host:' : 'Address:'}</label><input class="n-url" spellcheck="false" placeholder="${ssh ? 'server name or IP address' : 'https://id.region.quickconnect.to  or  nas.local:5001'}">`) +
    row('ssh', '<label>Port:</label><input class="n-port" spellcheck="false" placeholder="22">') +
    row('ssh', '<label>Open as:</label><select class="n-openas"><option value="files">Disk (file list) - Ctrl+O shows the console</option><option value="console">Console - Ctrl+O shows the file list</option></select>') +
    row('nas ssh', '<label>User:</label><input class="n-user" spellcheck="false" autocomplete="off">') +
    row('ssh', '<label>Key file:</label><span class="n-keyrow"><input class="n-key" spellcheck="false" placeholder="optional: private key (OpenSSH / PEM)"><button class="n-browse" type="button">Browse...</button></span>') +
    row('nas ssh', '<label class="n-pass-label">Password:</label><input class="n-pass" type="password" autocomplete="off">') +
    row('nas', '<label>2-step code:</label><input class="n-otp" spellcheck="false" autocomplete="off" placeholder="only if 2-step verification is on">') +
    row('nas', '<span></span><label class="n-chk"><input type="checkbox" class="n-insecure"> Allow an untrusted certificate (self-signed)</label>') +
    row('dropbox', '<label>App key:</label><input class="n-appkey" spellcheck="false" autocomplete="off">') +
    row('gdrive', '<label>Client ID:</label><input class="n-clientid" spellcheck="false" autocomplete="off">') +
    row('gdrive', '<label>Client secret:</label><input class="n-secret" type="password" autocomplete="off">') +
    row('dropbox gdrive', `<span></span><button class="n-signin n-bigbtn ${kind === 'gdrive' ? 'n-google' : 'n-dropbox'}" type="button">${signInLabel}</button>`) +
    row('dropbox gdrive', '<span></span><button class="n-switch n-link" type="button">Use a different account</button>') +
    row('nas ssh dropbox gdrive', `<span></span><label class="n-chk"><input type="checkbox" class="n-remember"> ${cloud ? 'Stay signed in on this computer (saved, encrypted by the system)' : 'Remember the password (encrypted by the system)'}</label>`) +
    '</div></div>' +
    (cloud ? `<div class="nas-help"><button class="n-adv" type="button">Settings and setup help...</button><div class="n-helpbody"><button class="n-link" type="button">${CLOUD_LINKS[kind][0]}</button><div class="n-help-text"></div></div></div>` : '') +
    '<div class="nas-status"></div></div>' +
    '<div class="dlg-btns"><button class="n-connect primary">Connect</button><button class="n-save">Save</button><button class="n-new">New</button><button class="n-del">Delete</button><button class="n-close">Close</button></div>';
  for (const r of box.querySelectorAll('.nas-row')) r.hidden = !r.dataset.k.split(' ').includes(kind);
  const q = (s) => box.querySelector(s);
  const $list = q('.nas-list'), $status = q('.nas-status');
  const $name = q('.n-name'), $url = q('.n-url'), $port = q('.n-port'), $user = q('.n-user');
  const $openas = q('.n-openas');
  const $key = q('.n-key'), $pass = q('.n-pass'), $otp = q('.n-otp'), $insecure = q('.n-insecure'), $remember = q('.n-remember');
  const $appkey = q('.n-appkey'), $clientid = q('.n-clientid'), $secret = q('.n-secret');
  const buttons = box.querySelectorAll('.dlg-btns button');
  let closeModal;
  let closed = false;
  let busy = false; // connecting / waiting for the browser
  let showAdvanced = false; // cloud: show the app key fields, the name and the setup help
  if (cloud) q('.n-help-text').textContent = CLOUD_HELP[kind];
  /** Close stays usable while connecting; it also cancels a pending browser sign-in */
  const closeWindow = () => {
    if (closed) return;
    closed = true;
    nasPendingPath = null; // a remote favourite that was not connected after all
    if (cloud) api.cloudCancelSignIn();
    closeModal();
  };
  const setBusy = (on) => { busy = on; buttons.forEach((b) => (b.disabled = on && !b.classList.contains('n-close'))); };

  const applyPassLabel = () => { if (ssh) q('.n-pass-label').textContent = $key.value.trim() ? 'Key passphrase:' : 'Password:'; };

  // ---- cloud windows: the simple view is only the sign-in button
  const keysKnown = () => (kind === 'dropbox' ? !!$appkey.value.trim() : !!$clientid.value.trim());
  const hideRow = (el, on) => { if (el) el.closest('.nas-row').hidden = on; };
  function applyCloudUi() {
    if (!cloud) return;
    const simple = keysKnown() && !showAdvanced;
    const saved = !!(cur && cur.pw);
    for (const el of [$appkey, $clientid, $secret]) hideRow(el, simple);
    hideRow($name, simple);
    hideRow($remember, simple);
    hideRow(q('.n-switch'), !saved); // "Use a different account" only makes sense when there is a login to replace
    // simple view: a saved login -> "Connect"; nothing saved -> the big sign-in button
    q('.n-signin').closest('.nas-row').hidden = simple && saved;
    q('.n-connect').hidden = simple && !saved;
    for (const b of [q('.n-save'), q('.n-new'), q('.n-del')]) b.hidden = simple;
    $list.hidden = simple;
    q('.n-helpbody').hidden = simple;
    q('.n-adv').textContent = simple ? 'Settings and setup help...' : keysKnown() ? 'Hide settings' : 'Settings and setup help...';
    q('.n-adv').hidden = !keysKnown() && !showAdvanced ? false : false;
    q('.nas-wrap').style.display = simple && !cur ? 'block' : '';
  }

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
    if ($openas) $openas.value = c.openAs === 'console' ? 'console' : 'files';
    if ($pass) { $pass.value = ''; $pass.placeholder = c.pw ? '(saved)' : ''; }
    if ($otp) $otp.value = '';
    if ($insecure) $insecure.checked = !!c.insecure;
    if ($appkey) $appkey.value = c.appKey || appWide().appKey || shipped.appKey || '';
    if ($clientid) $clientid.value = c.clientId || appWide().clientId || shipped.clientId || '';
    if ($secret) { $secret.value = ''; $secret.placeholder = c.sec || appWide().sec || shipped.clientSecret ? '(saved)' : ''; }
    $remember.checked = !!c.remember;
    applyPassLabel();
    applyCloudUi();
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
      openAs: $openas ? $openas.value : 'files',
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
    if (kind === 'gdrive') {
      if ($secret.value) conn.sec = await encrypt($secret.value); // Google client secret
      else if (!conn.sec) conn.sec = appWide().sec || '';
    }
    if (cloud) {
      // the app key is shared by all accounts of this service: asked once, remembered
      const aw = store.get('cloudApp', {}) || {};
      aw[kind] = kind === 'dropbox' ? { appKey: conn.appKey } : { clientId: conn.clientId, sec: conn.sec };
      store.set('cloudApp', aw);
    }
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

  /** no app key yet: show the fields and the short setup guide instead of a bare error */
  function needKeys() {
    showAdvanced = true;
    applyCloudUi();
    (kind === 'gdrive' ? $clientid : $appkey).focus();
    setStatus(
      kind === 'gdrive'
        ? 'One-time step: Google needs this program\'s "Client ID". Follow the short guide below, paste the Client ID and secret above, then press the button again.'
        : 'One-time step: Dropbox needs this program\'s "App key". Follow the short guide below, paste the key above, then press the button again.',
      true
    );
    return null;
  }

  /** what main needs to connect: a saved login, or a fresh browser sign-in (one click) */
  async function cloudCredentials(conn, forceSignIn, switchAccount) {
    const saved = forceSignIn ? '' : await decrypt(cur && cur.pw);
    if (kind === 'dropbox') {
      if (!conn.appKey) return needKeys();
      if (saved) return { appKey: conn.appKey, refreshToken: saved };
      setStatus('Your browser is opening: sign in to Dropbox and press Allow ...');
      const r = await api.cloudDropboxSignIn({ appKey: conn.appKey, switchAccount });
      if (r.error) { setStatus(r.error, true); return null; }
      return { appKey: conn.appKey, refreshToken: r.refreshToken };
    }
    if (!conn.clientId) return needKeys();
    const clientSecret = $secret.value || (await decrypt(cur && cur.sec)) || (await decrypt(appWide().sec)) || shipped.clientSecret || '';
    if (saved) return { clientId: conn.clientId, clientSecret, refreshToken: saved };
    setStatus('Your browser is opening: sign in to Google and press Allow ...');
    const r = await api.cloudGoogleSignIn({ clientId: conn.clientId, clientSecret, switchAccount });
    if (r.error) { setStatus(r.error, true); return null; }
    return { clientId: conn.clientId, clientSecret, refreshToken: r.refreshToken };
  }

  async function connect(forceSignIn = false, switchAccount = false) {
    const conn = formConn();
    let res;
    let secret = '';
    if (busy) return;
    setBusy(true);
    try {
      if (cloud) {
        const creds = await cloudCredentials(conn, forceSignIn, switchAccount);
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
      if (!closed) setBusy(false);
    }
    if (closed) {
      // the window was closed meanwhile: do not open anything, drop a session that was just established
      if (res && !res.error) api.nasDisconnect({ id: conn.id });
      return;
    }
    if (!res) return;
    if (res.error) {
      // a saved login that the service no longer accepts: go straight to a fresh sign-in instead of a dead end
      if (cloud && !forceSignIn && cur && cur.pw && /sign in again|no longer valid/i.test(res.error)) {
        setStatus('Your saved sign-in expired. Signing in again...');
        return connect(true, switchAccount);
      }
      setStatus(res.error, true);
      if (res.code === 403 || res.code === 406) $otp && $otp.focus();
      else if (!cloud && (res.code === 400 || res.code === 404)) $pass.select();
      return;
    }
    await persist(conn, secret);
    closed = true;
    closeModal();
    const type = RECORD_REM[kind];
    liveConns.set(conn.id, { id: conn.id, name: conn.name, type, home: ssh ? res.home || '/' : '/', openAs: conn.openAs });
    const p = A();
    p.focus();
    const want = nasPendingPath && nasPendingPath.id === conn.id ? nasPendingPath.path : null;
    nasPendingPath = null;
    if (ssh) {
      // "Disk": the file list of the server; "Console": the console first. Ctrl+O switches between them either way
      const home = want || res.home || '/';
      if (await p.loadRem({ id: conn.id, name: conn.name, type }, home) && conn.openAs === 'console') await sshShowConsole(p);
    } else if (!(want && want !== '/' && (await p.loadRem({ id: conn.id, name: conn.name, type }, want)))) await p.loadRem({ id: conn.id, name: conn.name, type }, '/');
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
    q('.n-signin').onclick = () => connect(true);
    q('.n-switch').onclick = () => connect(true, true);
    q('.n-adv').onclick = () => { showAdvanced = !showAdvanced; applyCloudUi(); };
    for (const el of [$appkey, $clientid]) el.addEventListener('input', applyCloudUi);
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
  q('.n-close').onclick = closeWindow;
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeWindow(); }
    else if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) { e.preventDefault(); connect(); }
  });

  closeModal = openModal(box);
  renderList();
  fill();
  // simple cloud view: put the focus on the one button that matters
  if (cloud && keysKnown() && !showAdvanced) (cur && cur.pw ? q('.n-connect') : q('.n-signin')).focus();
  else (cloud ? $name : cur && !cur.user ? $user : cur ? $pass : $name).focus();
}
