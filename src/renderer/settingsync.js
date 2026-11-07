'use strict';
// Settings sync: the same connections, favourites, presets and language on every computer (Configuration > Settings sync...): kept in Dropbox, Google Drive or a folder.
// The file /Commander/settings.json holds the synced keys with the time of each change; two copies are merged key by key, the newer wins.
// Passwords and logins go into the file only when you choose so, encrypted with a passphrase (AES-256-GCM, key from PBKDF2) on this computer;
// the Dropbox login itself is not synced: sign in to Dropbox once on each computer.
// Uses helpers from app.js (store, dialog, msg, esc) and filetools.js (ftForm); nas.js (nasLoad, connType).

const SYNC_KEYS = ['nas', 'hotlist', 'hotlistTcDone', 'hotlist_darwin', 'hotlist_linux', 'hotlistTcDone_darwin', 'hotlistTcDone_linux', 'mrPresets', 'searchTemplates', 'searchHistory', 'search2', 'cloudApp', 'toolbar', 'lang',
  'colw0', 'colw1', 'sortKey0', 'sortKey1', 'sortRev0', 'sortRev1', 'thumbs0', 'thumbs1', 'hotkeys', 'showHidden', 'dirBrackets', 'dirSort', 'confirmDelete', 'useTrash'];
const SYNC_RELOAD = new Set(['lang', 'toolbar', 'sortKey0', 'sortKey1', 'sortRev0', 'sortRev1', 'thumbs0', 'thumbs1']); // keys the page reads only at start
const syncRaw = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const syncWrite = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } };
let syncApplying = false;
let syncTimer = null;
let syncBusy = 0; // the time a sync started (0: none is running); a sync that has been "running" for 2 minutes is considered hung
let syncWarned = false;

const syncCfg = () => syncRaw('syncCfg', { on: false, connId: '', last: 0, secrets: true, encrypt: true });
const syncMeta = () => syncRaw('syncMeta', {});

/** called by store.set (app.js) for every saved setting */
function onStoreSet(k) {
  if (syncApplying || !SYNC_KEYS.includes(k)) return;
  const m = syncMeta();
  m[k] = Date.now();
  syncWrite('syncMeta', m);
  if (syncCfg().on) syncSchedule();
}

function syncSchedule(ms = 15000) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(true), ms);
}

/** the value of a key as it goes into the file: no passwords, no logins */
function syncExport(k, v) {
  if (k === 'nas' && Array.isArray(v)) return v.map((c) => { const x = { ...c }; delete x.pw; delete x.sec; return x; });
  if (k === 'cloudApp' && v && typeof v === 'object') { const o = {}; for (const [kind, c] of Object.entries(v)) { const x = { ...c }; delete x.sec; o[kind] = x; } return o; }
  return v;
}
/** the value of a key coming from the file: keep the secrets this computer already has */
function syncImport(k, remote) {
  if (k === 'nas' && Array.isArray(remote)) {
    const local = syncRaw('nas', []);
    const secrets = new Map((Array.isArray(local) ? local : []).map((c) => [c.id, { pw: c.pw, sec: c.sec }]));
    return remote.map((c) => { const s = secrets.get(c.id); return s ? { ...c, pw: s.pw || '', sec: s.sec || '' } : { ...c, pw: '', sec: '' }; });
  }
  if (k === 'cloudApp' && remote && typeof remote === 'object') {
    const local = syncRaw('cloudApp', {});
    const o = {};
    for (const [kind, c] of Object.entries(remote)) o[kind] = { ...c, sec: (local[kind] && local[kind].sec) || '' };
    return o;
  }
  return remote;
}

// ---------------------------------------------------------------- the password of the zip (kept on this computer, protected by the system)
const syncPassGet = async () => { const e = syncRaw('syncPassEnc', ''); if (!e) return ''; const r = await api.nasCrypt({ text: e, decrypt: true }); return r.text || ''; };
const syncPassSet = async (p) => { const r = await api.nasCrypt({ text: p }); if (r.text) syncWrite('syncPassEnc', r.text); return !!r.text; };

/** plaintext secrets of this computer: { "<connection id>": {pw, sec}, "cloudApp:<kind>": {sec} } */
async function syncSecretsCollect() {
  const out = {};
  const dec = async (e) => (e ? (await api.nasCrypt({ text: e, decrypt: true })).text || '' : '');
  const nas = syncRaw('nas', []);
  for (const c of Array.isArray(nas) ? nas : []) { const pw = await dec(c.pw), sec = await dec(c.sec); if (pw || sec) out[c.id] = { pw, sec }; }
  const app = syncRaw('cloudApp', {}) || {};
  for (const [kind, c] of Object.entries(app)) { const sec = await dec(c && c.sec); if (sec) out['cloudApp:' + kind] = { sec }; }
  // SSH private key files: their text goes into the same encrypted block (the sync file itself holds only the path of this computer)
  for (const c of Array.isArray(nas) ? nas : []) {
    if (c.type !== 'ssh' || !c.keyPath) continue;
    const k = await api.keysRead({ path: c.keyPath });
    if (!k.error && k.b64) out['key:' + c.id] = { name: k.name, b64: k.b64 };
  }
  return out;
}
/** put the secrets of a snapshot into this computer (encrypted for it): all of them, or only where this computer has none */
async function syncSecretsApply(secrets, all) {
  const enc = async (t) => (t ? (await api.nasCrypt({ text: t })).text || '' : '');
  const nas = syncRaw('nas', []);
  let filled = 0;
  if (Array.isArray(nas)) {
    for (const c of nas) {
      const s = secrets[c.id];
      if (!s) continue;
      if (all || !c.pw) { const e = await enc(s.pw); if (e && e !== c.pw) { c.pw = e; filled++; } }
      if (all || !c.sec) { const e = await enc(s.sec); if (e && e !== c.sec) { c.sec = e; filled++; } }
    }
    // key files: written into the program's key folder, the connection points to the local copy (the path of the other computer is useless here)
    for (const c of nas) {
      const kf = secrets['key:' + c.id];
      if (!kf || c.type !== 'ssh') continue;
      const have = c.keyPath ? await api.stat(c.keyPath) : { exists: false };
      if (all || !have.exists) {
        const w = await api.keysWrite({ id: c.id, name: kf.name, b64: kf.b64 });
        if (!w.error && w.path !== c.keyPath) { c.keyPath = w.path; filled++; }
      }
    }
    syncWrite('nas', nas);
  }
  const app = syncRaw('cloudApp', {}) || {};
  for (const [kind, c] of Object.entries(app)) {
    const s = secrets['cloudApp:' + kind];
    if (s && c && (all || !c.sec)) { const e = await enc(s.sec); if (e) { c.sec = e; filled++; } }
  }
  syncWrite('cloudApp', app);
  return filled;
}

async function syncSnapshot() {
  const meta = syncMeta();
  const data = {};
  const m = {};
  for (const k of SYNC_KEYS) {
    const v = syncRaw(k, undefined);
    if (v === undefined) continue;
    data[k] = syncExport(k, v);
    m[k] = meta[k] || 0;
  }
  return { format: 1, updated: Date.now(), device: (navigator.platform || '') + ' ' + (api.platform || ''), meta: m, data };
}

/** merge a remote snapshot into this computer; force: take everything the file has, whatever the times say. returns { applied: [keys], pushNeeded } */
function syncMerge(remote, force) {
  const meta = syncMeta();
  const applied = [];
  let pushNeeded = false;
  syncApplying = true;
  try {
    for (const k of SYNC_KEYS) {
      const rts = (remote.meta && remote.meta[k]) || 0;
      const has = remote.data && Object.prototype.hasOwnProperty.call(remote.data, k);
      const local = syncRaw(k, undefined);
      const lts = meta[k] || 0;
      // the list of connections is merged by id (not replaced by the newer side): a computer that only added one connection must not wipe the others
      if (k === 'nas' && has && !force && Array.isArray(remote.data.nas) && Array.isArray(local)) {
        const byId = new Map(local.map((c) => [c.id, c]));
        let changed = false;
        for (const rc of remote.data.nas) {
          const lc = byId.get(rc.id);
          if (!lc) { byId.set(rc.id, { ...rc, pw: '', sec: '' }); changed = true; }
          else if (rts > lts) { byId.set(rc.id, { ...rc, pw: lc.pw || '', sec: lc.sec || '' }); changed = true; }
        }
        if (changed) { syncWrite('nas', [...byId.values()]); applied.push(k); }
        if ([...byId.keys()].some((id) => !remote.data.nas.some((r) => r.id === id))) pushNeeded = true;
        meta[k] = Math.max(rts, lts);
        continue;
      }
      if (has && (force || rts > lts)) { syncWrite(k, syncImport(k, remote.data[k])); meta[k] = rts; applied.push(k); }
      else if (local !== undefined && (!has || lts > rts)) pushNeeded = true;
    }
    syncWrite('syncMeta', meta);
  } finally { syncApplying = false; }
  return { applied, pushNeeded };
}

const SYNC_KINDS = { dropbox: 'Dropbox', gdrive: 'Google Drive', local: 'a folder on this computer' };
/** the connection that holds the settings -> what the main process needs ({ kind, ... }); null when it is not usable */
async function syncConn() {
  const cfg = syncCfg();
  const kind = cfg.target || 'dropbox';
  if (kind === 'local') return cfg.localDir ? { kind, dir: cfg.localDir } : null;
  const list = typeof nasLoad === 'function' ? nasLoad() : [];
  const rec = list.find((c) => c.id === cfg.connId && connType(c) === kind);
  if (!rec || !rec.pw) return null;
  const aw = (syncRaw('cloudApp', {}) || {})[kind] || {};
  if (kind === 'dropbox') return { kind, enc: rec.pw, appKey: rec.appKey || aw.appKey || '' };
  const shipped = ((await api.cloudDefaults()) || {}).google || {};
  const clientId = rec.clientId || aw.clientId || shipped.clientId || '';
  return { kind, enc: rec.pw, clientId, encSecret: rec.sec || aw.sec || '', clientSecret: rec.sec || aw.sec ? '' : shipped.clientSecret || '' };
}
/** "Dropbox", "Google Drive" or "the folder ..." for messages */
const syncWhere = () => { const c = syncCfg(); return c.target === 'local' ? 'the folder ' + (c.localDir || '') : SYNC_KINDS[c.target || 'dropbox']; };
const syncFile = () => (syncCfg().target === 'local' ? 'settings.zip' : '/Commander/settings.zip');

const SYNC_T = 'Settings sync';
/**
 * mode 'sync': pull, merge, push when this computer has newer settings (quiet: no message unless something failed)
 * mode 'pull': Retrieve settings - take what the file has
 * mode 'push': Save settings - write what this computer has
 */
async function syncNow(quiet, mode = 'sync') {
  if (syncBusy && Date.now() - syncBusy < 120000) { if (!quiet) msg(SYNC_T, 'A synchronisation is still running (started automatically). Wait a minute and try again.'); return; }
  const c = await syncConn();
  if (!c || (c.kind === 'dropbox' && !c.appKey) || (c.kind === 'gdrive' && !c.clientId)) { if (!quiet) msg(SYNC_T, 'Choose where the settings go: open Configuration > Settings sync..., pick Dropbox / Google Drive (signed in under Net) or a folder.'); return; }
  syncBusy = Date.now();
  devLog('sync', `start: mode=${mode} quiet=${quiet} target=${syncCfg().target || 'dropbox'} encrypt=${syncCfg().encrypt} secrets=${syncCfg().secrets} connection=${c.kind}`);
  try {
    const cfg0 = syncCfg();
    const withSecrets = !!cfg0.secrets;
    const pass = cfg0.encrypt ? await syncPassGet() : '';
    if (cfg0.encrypt && !pass) { if (!quiet || !syncWarned) { syncWarned = true; msg(SYNC_T, 'The password of the zip is not available on this computer, so nothing was sent (a plain file would not be protected). Open Configuration > Settings sync..., enter the password again and press Save.'); } return; }
    let result = { applied: [], pushNeeded: true };
    let note = '';
    let remoteHasSecrets = false;
    let remoteEnc = false;
    let remoteExists = false;
    let remoteInfo = '';
    let pushed = null; // what went into the zip: { pw, keys }
    if (mode !== 'push') {
      devLog('sync', `password of the zip: ${pass ? 'known (' + pass.length + ' chars)' : 'not set'}`);
      const r = await api.settingsCloud({ action: 'pull', ...c, password: pass });
      devLog('sync', 'pull answer: ' + JSON.stringify({ error: r.error, needPassword: r.needPassword, wrongPassword: r.wrongPassword, empty: r.empty, encrypted: r.encrypted, legacy: r.legacy, textLength: r.text ? r.text.length : 0, secrets: r.secrets ? Object.keys(r.secrets).length : 0 }));
      if (r.error) { if (!quiet) msg(SYNC_T, r.error); return; }
      if (r.needPassword || r.wrongPassword) {
        const t = r.needPassword ? 'The settings file is protected by a password. Open Configuration > Settings sync..., tick "Protect the zip with a password" and enter it.' : 'The password does not fit the settings file. Open Configuration > Settings sync... and enter the same password as on the other computer.';
        if (!quiet || !syncWarned) { syncWarned = true; msg(SYNC_T, t); }
        return;
      }
      if (r.text) {
        let remote;
        try { remote = JSON.parse(r.text); } catch { if (!quiet) msg(SYNC_T, 'The settings file is damaged.'); return; }
        remoteExists = true;
        remoteInfo = `the file was written by "${remote.device || '?'}" on ${remote.updated ? new Date(remote.updated).toLocaleString() : '?'} and holds ${Object.keys(remote.data || {}).length} settings (${Object.keys(remote.data || {}).join(', ') || 'none'})`;
        result = syncMerge(remote, mode === 'pull');
        devLog('sync', `merge: applied [${result.applied.join(', ')}], this computer has newer data: ${result.pushNeeded}; the file holds [${Object.keys(remote.data || {}).join(', ')}]; connections in the file: ${Array.isArray(remote.data && remote.data.nas) ? remote.data.nas.map((c) => (c.type || 'nas') + ':' + (c.name || '?')).join(', ') || 'none' : 'no nas key'}`);
        remoteEnc = !!r.encrypted;
        remoteHasSecrets = !!r.secrets;
        if (withSecrets && r.secrets) {
          const filled = await syncSecretsApply(r.secrets, mode === 'pull' || result.applied.includes('nas'));
          if (filled) note = `\n${filled} password / login / key value(s) were restored.`;
        }
        if (r.legacy) result.pushNeeded = true; // an old settings.json: write the zip
      } else if (mode === 'pull') { msg(SYNC_T, `There are no settings in ${syncWhere()} yet (${syncFile()}).`); return; }
    }
    // the zip is rewritten when this computer has newer data, or when its content / protection differs from what is chosen here
    const stale = remoteExists && result.applied.length === 0 && (withSecrets !== remoteHasSecrets || !!cfg0.encrypt !== remoteEnc);
    const mustPush = mode === 'push' || (mode === 'sync' && (result.pushNeeded || (withSecrets && !remoteHasSecrets) || stale));
    if (mustPush) {
      const secrets = withSecrets ? await syncSecretsCollect() : null;
      if (secrets) { const ks = Object.keys(secrets); pushed = { keys: ks.filter((k) => k.startsWith('key:')).length, pw: ks.filter((k) => !k.startsWith('key:') && secrets[k].pw).length }; }
      const p = await api.settingsCloud({ action: 'push', ...c, text: JSON.stringify(await syncSnapshot()), secrets, password: pass });
      if (p.error) { if (!quiet) msg(SYNC_T, p.error); return; }
    }
    const cfg = syncCfg();
    cfg.last = Date.now();
    syncWrite('syncCfg', cfg);
    const reloading = result.applied.some((k) => SYNC_RELOAD.has(k)); // the page reads these keys at start: it reloads, and the message is shown after that
    if (reloading && quiet) { location.reload(); return; }
    if (quiet) return;
    const say = (title, text) => { if (reloading) { try { sessionStorage.setItem('syncMsg', text); } catch { /* ignore */ } } else msg(title, text); };
    const how = (cfg0.encrypt ? 'protected with a password' : 'no password') + (!withSecrets ? ', WITHOUT passwords and keys (the option is off in this window)' : pushed ? `, with ${pushed.pw} password(s) and ${pushed.keys} key file(s)` : ', with passwords and keys');
    if (mode === 'push') say(SYNC_T, `Saved to ${syncWhere()}: ${syncFile()} (${how}).`);
    else if (mode === 'pull') say(SYNC_T, `Retrieved from ${syncWhere()}: ${result.applied.length ? result.applied.join(', ') : 'nothing new'}.` + (remoteInfo ? String.fromCharCode(10) + remoteInfo + '.' : '') + note);
    else say(SYNC_T, (result.applied.length ? `Updated from ${syncWhere()}: ${result.applied.join(', ')}.${mustPush ? '\nYour newer settings were uploaded too.' : ''}` : mustPush ? `Your settings were uploaded to ${syncWhere()} (${syncFile()}, ${how}).` : 'Everything is up to date.') + note);
    if (reloading) location.reload();
  } catch (err) {
    if (!quiet) msg(SYNC_T, 'Synchronisation failed: ' + ((err && err.message) || err));
  } finally { syncBusy = 0; }
}

async function openSyncDialog() {
  if (modalCount > 0) return;
  const cfg = syncCfg();
  const all = nasLoad() || [];
  const accounts = (kind) => all.filter((c) => connType(c) === kind);
  const opts = (kind) => accounts(kind).map((c) => `<option value="${esc(c.id)}"${c.id === cfg.connId ? ' selected' : ''}>${esc(c.name)}${c.pw ? '' : ' (not signed in on this computer)'}</option>`).join('');
  const last = cfg.last ? new Date(cfg.last).toLocaleString() : 'never';
  const target = cfg.target || 'dropbox';
  const box = await ftForm(SYNC_T,
    '<div class="dlg-text">Keep connections, favourites, presets and the language in one zip file, so that every computer has the same: in Dropbox or Google Drive (/Commander/settings.zip), or in a folder on this computer (a USB stick, a folder that another program synchronizes).\nLast sync: ' + esc(last) + '</div>' +
    `<div class="ft-line"><label>Keep it in:</label><select class="sy-target"><option value="dropbox"${target === 'dropbox' ? ' selected' : ''}>Dropbox</option><option value="gdrive"${target === 'gdrive' ? ' selected' : ''}>Google Drive</option><option value="local"${target === 'local' ? ' selected' : ''}>A folder on this computer</option></select></div>` +
    `<div class="ft-line sy-acc"><label>Account:</label><select class="sy-conn"></select></div>` +
    `<div class="ft-line sy-loc"><label>Folder:</label><input class="sy-dir" spellcheck="false" placeholder="for example D:\\Backup\\Commander"><button class="sy-browse" type="button">Browse...</button></div>` +
    `<label class="ft-chk"><input type="checkbox" class="sy-on"${cfg.on ? ' checked' : ''}> Keep the settings there (sync at start and after changes)</label>` +
    `<label class="ft-chk"><input type="checkbox" class="sy-sec"${cfg.secrets ? ' checked' : ''}> Put passwords, logins and SSH key files into the zip too</label>` +
    `<label class="ft-chk"><input type="checkbox" class="sy-enc"${cfg.encrypt ? ' checked' : ''}> Protect the zip with a password (AES-256)</label>` +
    '<div class="ft-line"><label>Password:</label><input type="password" class="sy-pass" autocomplete="off" placeholder="' + (syncRaw('syncPassEnc', '') ? '(saved on this computer)' : 'the same on every computer') + '"></div>' +
    '<div class="s-hint">Without a password the zip is a plain file: anyone who can open that place can read the passwords and keys in it. With a password it also opens in 7-Zip / WinRAR. A forgotten password cannot be recovered.</div>' +
    '<div class="ft-line sy-btns"><button class="sy-pull" type="button">Retrieve settings</button><button class="sy-push" type="button">Save settings</button></div>', 'Sync now',
    (b) => {
      const sel = b.querySelector('.sy-target'), conn = b.querySelector('.sy-conn');
      b.querySelector('.sy-dir').value = cfg.localDir || '';
      const paint = () => {
        const k = sel.value;
        b.querySelector('.sy-acc').hidden = k === 'local';
        b.querySelector('.sy-loc').hidden = k !== 'local';
        if (k !== 'local') conn.innerHTML = opts(k) || '<option value="">(none: sign in under Net first)</option>';
      };
      sel.onchange = paint;
      paint();
      b.querySelector('.sy-browse').onclick = async () => {
        const f = await api.openFileDialog({ title: 'Folder for the settings file', defaultPath: b.querySelector('.sy-dir').value || api.home, folder: true });
        if (f) b.querySelector('.sy-dir').value = f;
      };
      for (const k of ['pull', 'push']) b.querySelector('.sy-' + k).onclick = () => { b.__mode = k; b.querySelector('.ft-ok').click(); };
    });
  if (!box) return;
  const mode = box.__mode || 'sync';
  const kind = box.querySelector('.sy-target').value;
  const localDir = box.querySelector('.sy-dir').value.trim();
  const connId = box.querySelector('.sy-conn').value;
  if (kind === 'local' && !localDir) return msg(SYNC_T, 'Choose the folder for the settings file.');
  if (kind !== 'local' && !connId) return msg(SYNC_T, `Sign in to ${SYNC_KINDS[kind]} first (Net menu), then come back here.`);
  const wantSecrets = box.querySelector('.sy-sec').checked;
  const typed = box.querySelector('.sy-pass').value;
  const wantEnc = box.querySelector('.sy-enc').checked || !!typed; // a typed password is meant to be used: the box is ticked for you
  if (wantSecrets && !wantEnc && mode !== 'pull') {
    const ok = await ftForm(SYNC_T, '<div class="dlg-text">You put passwords and SSH keys into the zip, but the zip is NOT protected by a password.\nAnyone who can open ' + esc(SYNC_KINDS[kind]) + ' (or the folder) can read them.\n\nPress "Add a password" to go back and protect it, or "Send without a password".</div>', 'Send without a password', (b) => {
      const cancel = b.querySelector('.ft-cancel');
      cancel.textContent = 'Add a password';
      cancel.classList.add('primary');
      b.querySelector('.ft-ok').classList.remove('primary');
    });
    if (!ok) return openSyncDialog();
  }
  if (wantEnc && !typed && !syncRaw('syncPassEnc', '')) return msg(SYNC_T, 'Enter a password for the zip (the same on every computer), or untick the protection.');
  if (typed && (!/^[ -~]+$/.test(typed) || /["\\]/.test(typed))) return msg(SYNC_T, 'The password for the zip may contain only Latin letters, digits and symbols (no quotes and no backslash).');
  if (typed && !(await syncPassSet(typed))) return msg(SYNC_T, 'The system cannot store the password safely on this computer.');
  const next = { on: box.querySelector('.sy-on').checked, target: kind, connId: kind === 'local' ? cfg.connId : connId, localDir, last: cfg.last, secrets: wantSecrets, encrypt: wantEnc };
  if (mode === 'pull' && !(await ftForm(SYNC_T, `<div class="dlg-text">Replace the settings of this computer (connections, favourites, presets, language ...) with those from ${esc(SYNC_KINDS[kind])}${kind === 'local' ? ' (' + esc(localDir) + ')' : ''}?</div>`, 'Retrieve'))) return;
  syncWrite('syncCfg', next);
  if (!next.on && mode === 'sync') return msg(SYNC_T, 'Sync is off. The settings stay on this computer only.');
  await syncNow(false, mode);
}

// a quiet pull a few seconds after start
setTimeout(() => { if (syncCfg().on) syncNow(true); }, 9000);

// the answer of a sync that reloaded the page
setTimeout(() => { try { const m = sessionStorage.getItem('syncMsg'); if (m) { sessionStorage.removeItem('syncMsg'); msg(SYNC_T, m); } } catch { /* ignore */ } }, 1200);
