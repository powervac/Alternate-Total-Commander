'use strict';
// Settings in Dropbox: the same connections, favourites, presets and language on every computer (Configuration > Settings in Dropbox...).
// The file /Commander/settings.json holds the synced keys with the time of each change; two copies are merged key by key, the newer wins.
// Passwords and logins go into the file only when you choose so, encrypted with a passphrase (AES-256-GCM, key from PBKDF2) on this computer;
// the Dropbox login itself is not synced: sign in to Dropbox once on each computer.
// Uses helpers from app.js (store, dialog, msg, esc) and filetools.js (ftForm); nas.js (nasLoad, connType).

const SYNC_KEYS = ['nas', 'hotlist', 'hotlistTcDone', 'mrPresets', 'searchTemplates', 'searchHistory', 'search2', 'cloudApp', 'toolbar', 'lang',
  'sortKey0', 'sortKey1', 'sortRev0', 'sortRev1', 'thumbs0', 'thumbs1'];
const SYNC_RELOAD = new Set(['lang', 'toolbar', 'sortKey0', 'sortKey1', 'sortRev0', 'sortRev1', 'thumbs0', 'thumbs1']); // keys the page reads only at start
const syncRaw = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const syncWrite = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } };
let syncApplying = false;
let syncTimer = null;
let syncBusy = false;
let syncWarned = false;

const syncCfg = () => syncRaw('syncCfg', { on: false, connId: '', last: 0 });
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

// ---------------------------------------------------------------- secrets (passwords, logins) encrypted with a passphrase
const SYNC_ITER = 200000;
const syncB64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
const syncUnB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
async function syncKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function syncSeal(obj, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await syncKey(pass, salt, SYNC_ITER);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: SYNC_ITER, salt: syncB64(salt), iv: syncB64(iv), data: syncB64(data) };
}
/** -> object, or null when the passphrase does not fit */
async function syncOpen(blob, pass) {
  try {
    const key = await syncKey(pass, syncUnB64(blob.salt), blob.iter || SYNC_ITER);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: syncUnB64(blob.iv) }, key, syncUnB64(blob.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { return null; }
}
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

async function syncSnapshot(withSecrets) {
  const meta = syncMeta();
  const data = {};
  const m = {};
  for (const k of SYNC_KEYS) {
    const v = syncRaw(k, undefined);
    if (v === undefined) continue;
    data[k] = syncExport(k, v);
    m[k] = meta[k] || 0;
  }
  const snap = { format: 1, updated: Date.now(), device: (navigator.platform || '') + ' ' + (api.platform || ''), meta: m, data };
  if (withSecrets) {
    const pass = await syncPassGet();
    if (pass) snap.secrets = await syncSeal(await syncSecretsCollect(), pass);
  }
  return snap;
}

/** merge a remote snapshot into this computer; returns { applied: [keys], pushNeeded } */
function syncMerge(remote) {
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
      if (has && rts > lts) { syncWrite(k, syncImport(k, remote.data[k])); meta[k] = rts; applied.push(k); }
      else if (local !== undefined && (!has || lts > rts)) pushNeeded = true;
    }
    syncWrite('syncMeta', meta);
  } finally { syncApplying = false; }
  return { applied, pushNeeded };
}

function syncConn() {
  const cfg = syncCfg();
  const list = typeof nasLoad === 'function' ? nasLoad() : [];
  const rec = list.find((c) => c.id === cfg.connId && connType(c) === 'dropbox');
  if (!rec || !rec.pw) return null;
  const aw = (syncRaw('cloudApp', {}) || {}).dropbox || {};
  return { enc: rec.pw, appKey: rec.appKey || aw.appKey || '' };
}

/** pull, merge, push when this computer has newer settings. quiet: no message unless something failed */
async function syncNow(quiet) {
  if (syncBusy) return;
  const c = syncConn();
  if (!c || !c.appKey) { if (!quiet) msg('Settings in Dropbox', 'Sign in to Dropbox first (Net > Dropbox...) and choose that connection here.'); return; }
  syncBusy = true;
  try {
    const r = await api.settingsCloud({ action: 'pull', appKey: c.appKey, enc: c.enc });
    if (r.error) { if (!quiet) msg('Settings in Dropbox', r.error); return; }
    let result = { applied: [], pushNeeded: true };
    const withSecrets = !!syncCfg().secrets;
    let secretNote = '';
    if (r.text) {
      let remote;
      try { remote = JSON.parse(r.text); } catch { if (!quiet) msg('Settings in Dropbox', 'The settings file in Dropbox is damaged.'); return; }
      result = syncMerge(remote);
      if (withSecrets && remote.secrets) {
        const pass = await syncPassGet();
        const plain = pass ? await syncOpen(remote.secrets, pass) : null;
        if (!plain) {
          secretNote = '\nThe passphrase for passwords does not match the one used on the other computer: passwords were not restored. Open Settings in Dropbox... and enter the same passphrase.';
          if (quiet && !syncWarned) { syncWarned = true; msg('Settings in Dropbox', secretNote.trim()); } // once per session, also for the quiet check at start
        } else {
          const filled = await syncSecretsApply(plain, result.applied.includes('nas'));
          if (filled) secretNote = `\n${filled} password / login value(s) were restored.`;
        }
      }
    }
    if (result.pushNeeded || (withSecrets && !(r.text && JSON.parse(r.text).secrets))) {
      const p = await api.settingsCloud({ action: 'push', appKey: c.appKey, enc: c.enc, text: JSON.stringify(await syncSnapshot(withSecrets)) });
      if (p.error) { if (!quiet) msg('Settings in Dropbox', p.error); return; }
    }
    const cfg = syncCfg();
    cfg.last = Date.now();
    syncWrite('syncCfg', cfg);
    if (result.applied.some((k) => SYNC_RELOAD.has(k))) { location.reload(); return; }
    if (!quiet) msg('Settings in Dropbox', (result.applied.length ? `Updated from Dropbox: ${result.applied.join(', ')}.${result.pushNeeded ? '\nYour newer settings were uploaded too.' : ''}` : result.pushNeeded ? 'Your settings were uploaded to Dropbox (/Commander/settings.json).' : 'Everything is up to date.') + secretNote);
  } finally { syncBusy = false; }
}

async function openSyncDialog() {
  if (modalCount > 0) return;
  const list = (nasLoad() || []).filter((c) => connType(c) === 'dropbox');
  const cfg = syncCfg();
  if (!list.length) return msg('Settings in Dropbox', 'Add Dropbox first: Net > Dropbox... > Sign in with Dropbox. Then come back here.');
  const opts = list.map((c) => `<option value="${esc(c.id)}"${c.id === cfg.connId ? ' selected' : ''}>${esc(c.name)}${c.pw ? '' : ' (not signed in on this computer)'}</option>`).join('');
  const last = cfg.last ? new Date(cfg.last).toLocaleString() : 'never';
  const box = await ftForm('Settings in Dropbox',
    '<div class="dlg-text">Keep connections, favourites, presets and the language in Dropbox (/Commander/settings.json), so that every computer has the same.\nPasswords and logins stay on each computer. Last sync: ' + esc(last) + '</div>' +
    `<div class="ft-line"><label>Dropbox account:</label><select class="sy-conn">${opts}</select></div>` +
    `<label class="ft-chk"><input type="checkbox" class="sy-on"${cfg.on ? ' checked' : ''}> Keep the settings in Dropbox (sync at start and after changes)</label>` +
    `<label class="ft-chk"><input type="checkbox" class="sy-sec"${cfg.secrets ? ' checked' : ''}> Also keep passwords, logins and SSH key files (encrypted with a passphrase)</label>` +
    '<div class="ft-line"><label>Passphrase:</label><input type="password" class="sy-pass" autocomplete="off" placeholder="' + (syncRaw('syncPassEnc', '') ? '(saved on this computer)' : 'the same on every computer') + '"></div>' +
    '<div class="s-hint">The passwords are encrypted here before they go to Dropbox. If you forget the passphrase they cannot be recovered; use a long one.</div>', 'Sync now');
  if (!box) return;
  const wantSecrets = box.querySelector('.sy-sec').checked;
  const typed = box.querySelector('.sy-pass').value;
  if (wantSecrets && !typed && !syncRaw('syncPassEnc', '')) return msg('Settings in Dropbox', 'Enter a passphrase for the passwords (the same on every computer).');
  if (typed && !(await syncPassSet(typed))) return msg('Settings in Dropbox', 'The system cannot store the passphrase safely on this computer, so the passwords are not synced.');
  const next = { on: box.querySelector('.sy-on').checked, connId: box.querySelector('.sy-conn').value, last: cfg.last, secrets: wantSecrets };
  syncWrite('syncCfg', next);
  if (!next.on) return msg('Settings in Dropbox', 'Sync is off. The settings stay on this computer only.');
  await syncNow(false);
}

// a quiet pull a few seconds after start
setTimeout(() => { if (syncCfg().on) syncNow(true); }, 9000);
