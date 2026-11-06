'use strict';
// Dropbox and Google Drive as remote "disks". Both classes have the SAME interface as the Synology / SSH clients
// (list, mkdir, rename, remove, download, upload, openDownload, logout), so every remote-panel feature works for them.
// Sign-in is OAuth 2 with PKCE in the system browser; the program keeps only a refresh token (encrypted by the caller).
//
// The API addresses can be replaced with environment variables (used by the tests with a local mock server).

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const posix = path.posix;
const DBX = {
  api: process.env.COMMANDER_DBX_API || 'https://api.dropboxapi.com',
  content: process.env.COMMANDER_DBX_CONTENT || 'https://content.dropboxapi.com',
  auth: process.env.COMMANDER_DBX_AUTH || 'https://www.dropbox.com',
};
const GGL = {
  api: process.env.COMMANDER_GDRIVE_API || 'https://www.googleapis.com',
  token: process.env.COMMANDER_GOOGLE_TOKEN || 'https://oauth2.googleapis.com/token',
  auth: process.env.COMMANDER_GOOGLE_AUTH || 'https://accounts.google.com/o/oauth2/v2/auth',
};

// ------------------------------------------------------------------ http helpers
function request(urlStr, { method = 'GET', headers = {}, body = null, timeout = 30000, onReq } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      { protocol: u.protocol, hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method, headers, timeout, agent: false },
      resolve
    );
    req.on('timeout', () => req.destroy(new Error('Connection timed out')));
    req.on('error', reject);
    if (onReq) onReq(req);
    if (body && typeof body.pipe === 'function') body.pipe(req);
    else req.end(body || undefined);
  });
}
async function readAll(res, limit = 64 * 1024 * 1024) {
  const chunks = [];
  let n = 0;
  for await (const c of res) {
    n += c.length;
    if (n > limit) throw new Error('Response is too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
async function jsonReq(url, opts) {
  const res = await request(url, opts);
  const buf = await readAll(res);
  let data = null;
  try {
    data = buf.length ? JSON.parse(buf.toString('utf8')) : null;
  } catch {
    data = { raw: buf.toString('utf8').slice(0, 300) };
  }
  return { status: res.statusCode, data, headers: res.headers };
}
const form = (o) => new URLSearchParams(o).toString();
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pkce = () => {
  const verifier = b64u(crypto.randomBytes(32));
  return { verifier, challenge: b64u(crypto.createHash('sha256').update(verifier).digest()) };
};
const ioError = (message, status) => Object.assign(new Error(message), { status });

/** pipe a response body into a file, counting bytes */
function saveTo(res, dest, onData) {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(dest);
    res.on('data', (c) => onData && onData(c.length));
    res.on('error', (e) => { ws.destroy(); reject(e); });
    res.on('aborted', () => { ws.destroy(); reject(new Error('Download was interrupted')); });
    ws.on('error', reject);
    ws.on('close', resolve);
    res.pipe(ws);
  });
}

// ================================================================== Dropbox
class Dropbox {
  constructor() {
    this.type = 'dropbox';
    this.base = 'Dropbox';
    this.access = '';
    this.expires = 0;
    this.refreshToken = '';
    this.appKey = '';
  }

  /**
   * one-button sign-in: browser opens, the user approves, the answer returns to a loopback address (it must be listed once in the
   * app's "Redirect URIs" in the Dropbox App Console: http://127.0.0.1:53682). Resolves with the refresh token.
   */
  static async signIn({ appKey, openUrl }) {
    if (!appKey) throw new Error('This program has no Dropbox app key yet.');
    const { verifier, challenge } = pkce();
    const { code, redirect } = await loopbackCode({
      port: +process.env.COMMANDER_OAUTH_PORT || 53682,
      openUrl,
      what: 'Dropbox',
      buildUrl: (redirectUri, state) =>
        `${DBX.auth}/oauth2/authorize?` + form({ client_id: appKey, response_type: 'code', redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: 'S256', token_access_type: 'offline', state }),
    });
    const d = new Dropbox();
    d.appKey = appKey;
    await d.tokenRequest({ code, grant_type: 'authorization_code', code_verifier: verifier, client_id: appKey, redirect_uri: redirect });
    if (!d.refreshToken) throw new Error('Dropbox did not return a refresh token.');
    return { refreshToken: d.refreshToken };
  }

  async tokenRequest(params) {
    const r = await jsonReq(`${DBX.api}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(params) });
    if (r.status !== 200 || !r.data || !r.data.access_token) {
      const why = r.data && (r.data.error_description || r.data.error);
      throw new Error('Dropbox sign-in failed' + (why ? ': ' + why : ` (HTTP ${r.status})`));
    }
    this.access = r.data.access_token;
    this.expires = Date.now() + ((r.data.expires_in || 14400) - 60) * 1000;
    if (r.data.refresh_token) this.refreshToken = r.data.refresh_token;
  }

  async connect({ appKey, refreshToken, code, verifier }) {
    if (!appKey) throw new Error('Enter the app key of your Dropbox app.');
    this.appKey = appKey;
    if (code) await this.tokenRequest({ code: String(code).trim(), grant_type: 'authorization_code', code_verifier: verifier, client_id: appKey });
    else if (refreshToken) {
      this.refreshToken = refreshToken;
      await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: appKey });
    } else throw new Error('Sign in first.');
    const me = await this.rpc('users/get_current_account');
    this.base = 'Dropbox';
    return { refreshToken: this.refreshToken, account: (me.name && me.name.display_name) || me.email || '' };
  }

  async token() {
    if (!this.access || Date.now() > this.expires) await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: this.refreshToken, client_id: this.appKey });
    return this.access;
  }

  /** run fn(token); one retry with a fresh token after a 401 */
  async authed(fn) {
    try {
      return await fn(await this.token());
    } catch (e) {
      if (e.status !== 401) throw e;
      this.access = '';
      return fn(await this.token());
    }
  }

  async rpc(endpoint, body) {
    return this.authed(async (t) => {
      const headers = { Authorization: `Bearer ${t}` };
      let payload;
      if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
      const r = await jsonReq(`${DBX.api}/2/${endpoint}`, { method: 'POST', headers, body: payload });
      if (r.status === 200) return r.data || {};
      throw ioError(dropboxMessage(r), r.status);
    });
  }

  async list(folder) {
    const p = !folder || folder === '/' ? '' : folder;
    let r = await this.rpc('files/list_folder', { path: p, limit: 2000, include_deleted: false });
    const out = [];
    for (;;) {
      for (const e of r.entries || []) {
        if (e['.tag'] === 'deleted') continue;
        const isDir = e['.tag'] === 'folder';
        out.push({ name: e.name, isDir, size: isDir ? -1 : e.size || 0, mtime: Date.parse(e.server_modified || e.client_modified || '') || 0 });
      }
      if (!r.has_more) break;
      r = await this.rpc('files/list_folder/continue', { cursor: r.cursor });
    }
    return out;
  }

  async mkdir(parent, name) {
    await this.rpc('files/create_folder_v2', { path: posix.join(parent || '/', name), autorename: false });
  }

  async rename(p, newName) {
    await this.rpc('files/move_v2', { from_path: p, to_path: posix.join(posix.dirname(p), newName), autorename: false });
  }

  async remove(paths) {
    for (const p of paths) await this.rpc('files/delete_v2', { path: p });
  }

  async download(remotePath, dest, { onData, onReq } = {}) {
    const res = await this.authed(async (t) => {
      const r = await request(`${DBX.content}/2/files/download`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Dropbox-API-Arg': headerArg({ path: remotePath }) }, timeout: 60000, onReq });
      if (r.statusCode !== 200) {
        const buf = await readAll(r);
        throw ioError(dropboxMessage({ status: r.statusCode, data: tryJson(buf) }), r.statusCode);
      }
      return r;
    });
    await saveTo(res, dest, onData);
  }

  async upload(localFile, destFolder, name, overwrite, { onData, onReq } = {}) {
    const target = posix.join(destFolder || '/', name);
    const mode = overwrite ? 'overwrite' : 'add';
    const st = await fs.promises.stat(localFile);
    const CHUNK = 8 * 1024 * 1024;
    if (st.size <= 100 * 1024 * 1024) {
      const t = await this.token();
      const body = fs.createReadStream(localFile);
      body.on('data', (c) => onData && onData(c.length));
      const res = await request(`${DBX.content}/2/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Dropbox-API-Arg': headerArg({ path: target, mode, autorename: false, mute: true }), 'Content-Type': 'application/octet-stream', 'Content-Length': st.size },
        body,
        timeout: 600000,
        onReq,
      });
      const buf = await readAll(res);
      if (res.statusCode !== 200) throw ioError(dropboxMessage({ status: res.statusCode, data: tryJson(buf) }), res.statusCode);
      return;
    }
    // big file: an upload session in 8 MB pieces
    const fh = await fs.promises.open(localFile, 'r');
    try {
      let offset = 0;
      let sessionId = '';
      const post = async (endpoint, arg, buf) => {
        const t = await this.token();
        const res = await request(`${DBX.content}/2/${endpoint}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}`, 'Dropbox-API-Arg': headerArg(arg), 'Content-Type': 'application/octet-stream', 'Content-Length': buf.length },
          body: buf,
          timeout: 600000,
          onReq,
        });
        const b = await readAll(res);
        if (res.statusCode !== 200) throw ioError(dropboxMessage({ status: res.statusCode, data: tryJson(b) }), res.statusCode);
        return tryJson(b);
      };
      const commit = { path: target, mode, autorename: false, mute: true };
      let finished = false;
      while (offset < st.size) {
        const len = Math.min(CHUNK, st.size - offset);
        const buf = Buffer.alloc(len);
        await fh.read(buf, 0, len, offset);
        const last = offset + len >= st.size;
        if (!sessionId) sessionId = (await post('files/upload_session/start', { close: false }, buf)).session_id;
        else if (!last) await post('files/upload_session/append_v2', { cursor: { session_id: sessionId, offset }, close: false }, buf);
        else {
          await post('files/upload_session/finish', { cursor: { session_id: sessionId, offset }, commit }, buf);
          finished = true;
        }
        offset += len;
        if (onData) onData(len);
      }
      // (the file is bigger than 100 MB here, so the first piece is never the last; this only guards odd sizes)
      if (!finished && sessionId) await post('files/upload_session/finish', { cursor: { session_id: sessionId, offset }, commit }, Buffer.alloc(0));
    } finally {
      await fh.close();
    }
  }

  /** for the local streaming proxy: Dropbox hands out a temporary direct link that supports Range */
  async openDownload(remotePath, range) {
    const r = await this.rpc('files/get_temporary_link', { path: remotePath });
    const res = await request(r.link, { headers: range ? { Range: range } : {}, timeout: 30000 });
    if (res.statusCode !== 200 && res.statusCode !== 206) { res.resume(); throw ioError(`HTTP ${res.statusCode}`, res.statusCode); }
    return res;
  }

  async logout() {
    this.access = '';
  }
}

const tryJson = (buf) => { try { return JSON.parse(buf.toString('utf8')); } catch { return { raw: buf.toString('utf8').slice(0, 200) }; } };
/** header values must be ASCII: escape everything else as \uXXXX */
const headerArg = (o) => JSON.stringify(o).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
function dropboxMessage(r) {
  const s = (r.data && (r.data.error_summary || (r.data.error && r.data.error['.tag']))) || '';
  if (r.status === 401) return 'Dropbox: the sign-in is no longer valid. Sign in again.';
  if (r.status === 429) return 'Dropbox: too many requests, try again in a moment.';
  if (/not_found/.test(s)) return 'Not found in Dropbox';
  if (/conflict|already_exists/.test(s)) return 'Already exists in Dropbox';
  if (/insufficient_space/.test(s)) return 'Your Dropbox is full';
  if (/no_permission|access_denied|missing_scope/.test(s)) return 'No permission: check the permissions of your Dropbox app (files.content.write, files.metadata.write ...)';
  return 'Dropbox: ' + (s || (r.data && r.data.raw) || `HTTP ${r.status}`);
}

// ================================================================== Google Drive
const GFOLDER = 'application/vnd.google-apps.folder';
const GEXPORT = {
  'application/vnd.google-apps.document': ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  'application/vnd.google-apps.spreadsheet': ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  'application/vnd.google-apps.presentation': ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  'application/vnd.google-apps.drawing': ['png', 'image/png'],
};

class GDrive {
  constructor() {
    this.type = 'gdrive';
    this.base = 'Google Drive';
    this.access = '';
    this.expires = 0;
    this.refreshToken = '';
    this.clientId = '';
    this.clientSecret = '';
    this.cache = new Map(); // "/a/b" -> entry
  }

  async tokenRequest(params) {
    const r = await jsonReq(GGL.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ client_id: this.clientId, client_secret: this.clientSecret, ...params }) });
    if (r.status !== 200 || !r.data || !r.data.access_token) {
      const why = r.data && (r.data.error_description || r.data.error);
      throw new Error('Google sign-in failed' + (why ? ': ' + why : ` (HTTP ${r.status})`));
    }
    this.access = r.data.access_token;
    this.expires = Date.now() + ((r.data.expires_in || 3600) - 60) * 1000;
    if (r.data.refresh_token) this.refreshToken = r.data.refresh_token;
    return r.data;
  }

  async connect({ clientId, clientSecret, refreshToken }) {
    if (!clientId) throw new Error('Enter the client ID of your Google OAuth client.');
    this.clientId = clientId;
    this.clientSecret = clientSecret || '';
    if (!refreshToken) throw new Error('Sign in first.');
    this.refreshToken = refreshToken;
    await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
    const about = await this.api('GET', `${GGL.api}/drive/v3/about?fields=user(displayName,emailAddress)`);
    return { refreshToken: this.refreshToken, account: (about.user && (about.user.emailAddress || about.user.displayName)) || '' };
  }

  async token() {
    if (!this.access || Date.now() > this.expires) await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: this.refreshToken });
    return this.access;
  }

  async authed(fn) {
    try {
      return await fn(await this.token());
    } catch (e) {
      if (e.status !== 401) throw e;
      this.access = '';
      return fn(await this.token());
    }
  }

  /** JSON call */
  async api(method, url, json) {
    return this.authed(async (t) => {
      const headers = { Authorization: `Bearer ${t}` };
      let body;
      if (json !== undefined) { body = JSON.stringify(json); headers['Content-Type'] = 'application/json; charset=UTF-8'; }
      const r = await jsonReq(url, { method, headers, body });
      if (r.status >= 200 && r.status < 300) return r.data || {};
      throw ioError(googleMessage(r), r.status);
    });
  }

  /** all children of a folder id, as display entries */
  async children(parentId) {
    const out = [];
    let pageToken = '';
    do {
      const q = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
      const f = encodeURIComponent('nextPageToken,files(id,name,mimeType,size,modifiedTime,shortcutDetails)');
      const r = await this.api('GET', `${GGL.api}/drive/v3/files?q=${q}&fields=${f}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`);
      for (const f of r.files || []) out.push(f);
      pageToken = r.nextPageToken || '';
    } while (pageToken);
    // display names: Drive allows duplicates, a folder listing cannot
    const seen = new Set();
    return out.map((f) => {
      let id = f.id;
      let mime = f.mimeType;
      if (mime === 'application/vnd.google-apps.shortcut' && f.shortcutDetails) { id = f.shortcutDetails.targetId; mime = f.shortcutDetails.targetMimeType || mime; }
      const exp = GEXPORT[mime];
      let display = f.name;
      if (exp && !display.toLowerCase().endsWith('.' + exp[0])) display += '.' + exp[0];
      if (seen.has(display)) display = `${display} (${f.id.slice(0, 4)})`;
      seen.add(display);
      return { id, display, isDir: mime === GFOLDER, mime, exportMime: exp ? exp[1] : '', size: f.size ? +f.size : 0, mtime: Date.parse(f.modifiedTime || '') || 0 };
    });
  }

  async resolve(p) {
    if (!p || p === '/') return { id: 'root', isDir: true, mime: GFOLDER };
    const hit = this.cache.get(p);
    if (hit) return hit;
    const parentPath = posix.dirname(p);
    const parent = await this.resolve(parentPath);
    for (const k of await this.children(parent.id)) this.cache.set(posix.join(parentPath, k.display), k);
    const e = this.cache.get(p);
    if (!e) throw new Error('Not found in Google Drive: ' + p);
    return e;
  }

  async list(folder) {
    const f = await this.resolve(folder || '/');
    const base = folder || '/';
    const kids = await this.children(f.id);
    for (const k of kids) this.cache.set(posix.join(base, k.display), k);
    return kids.map((k) => ({ name: k.display, isDir: k.isDir, size: k.isDir ? -1 : k.size, mtime: k.mtime }));
  }

  /** id of a folder path, creating the missing folders */
  async mkdirp(dir) {
    if (!dir || dir === '/') return 'root';
    let cur = { id: 'root' };
    let acc = '';
    for (const seg of dir.split('/').filter(Boolean)) {
      acc += '/' + seg;
      let e;
      try { e = await this.resolve(acc); } catch { e = null; }
      if (!e) {
        const c = await this.api('POST', `${GGL.api}/drive/v3/files?supportsAllDrives=true&fields=id`, { name: seg, mimeType: GFOLDER, parents: [cur.id] });
        this.cache.clear();
        e = { id: c.id, isDir: true, mime: GFOLDER };
      }
      cur = e;
    }
    return cur.id;
  }

  async mkdir(parent, name) {
    await this.mkdirp(posix.join(parent || '/', name));
  }

  async rename(p, newName) {
    const e = await this.resolve(p);
    await this.api('PATCH', `${GGL.api}/drive/v3/files/${e.id}?supportsAllDrives=true&fields=id`, { name: newName });
    this.cache.clear();
  }

  /** to the Trash (recoverable), not forever */
  async remove(paths) {
    for (const p of paths) {
      const e = await this.resolve(p);
      await this.api('PATCH', `${GGL.api}/drive/v3/files/${e.id}?supportsAllDrives=true&fields=id`, { trashed: true });
    }
    this.cache.clear();
  }

  mediaUrl(e) {
    if (e.exportMime) return `${GGL.api}/drive/v3/files/${e.id}/export?mimeType=${encodeURIComponent(e.exportMime)}`;
    if (e.mime && e.mime.startsWith('application/vnd.google-apps.')) throw new Error('This kind of Google file (form, map, site ...) cannot be downloaded');
    return `${GGL.api}/drive/v3/files/${e.id}?alt=media&supportsAllDrives=true`;
  }

  async download(remotePath, dest, { onData, onReq } = {}) {
    const e = await this.resolve(remotePath);
    const res = await this.authed(async (t) => {
      const r = await request(this.mediaUrl(e), { headers: { Authorization: `Bearer ${t}` }, timeout: 60000, onReq });
      if (r.statusCode !== 200) {
        const buf = await readAll(r);
        throw ioError(googleMessage({ status: r.statusCode, data: tryJson(buf) }), r.statusCode);
      }
      return r;
    });
    await saveTo(res, dest, onData);
  }

  async upload(localFile, destFolder, name, overwrite, { onData, onReq } = {}) {
    const parentId = await this.mkdirp(destFolder);
    const existing = (await this.children(parentId)).find((k) => k.display === name && !k.isDir);
    if (existing && !overwrite) throw new Error('already exists');
    const st = await fs.promises.stat(localFile);
    const t = await this.token();
    const init = await request(
      existing
        ? `${GGL.api}/upload/drive/v3/files/${existing.id}?uploadType=resumable&supportsAllDrives=true&fields=id`
        : `${GGL.api}/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id`,
      {
        method: existing ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Length': st.size },
        body: JSON.stringify(existing ? {} : { name, parents: [parentId] }),
        onReq,
      }
    );
    if (init.statusCode !== 200 || !init.headers.location) {
      const buf = await readAll(init);
      throw ioError(googleMessage({ status: init.statusCode, data: tryJson(buf) }), init.statusCode);
    }
    const session = init.headers.location;
    const CHUNK = 8 * 1024 * 1024; // a multiple of 256 KiB, as the resumable protocol wants
    const fh = await fs.promises.open(localFile, 'r');
    try {
      let offset = 0;
      do {
        const len = Math.min(CHUNK, st.size - offset);
        const buf = Buffer.alloc(len);
        if (len) await fh.read(buf, 0, len, offset);
        const range = st.size === 0 ? 'bytes */0' : `bytes ${offset}-${offset + len - 1}/${st.size}`;
        const res = await request(session, { method: 'PUT', headers: { 'Content-Length': len, 'Content-Range': range }, body: buf, timeout: 600000, onReq });
        const b = await readAll(res);
        if (res.statusCode !== 200 && res.statusCode !== 201 && res.statusCode !== 308) throw ioError(googleMessage({ status: res.statusCode, data: tryJson(b) }), res.statusCode);
        offset += len;
        if (onData) onData(len);
      } while (offset < st.size);
    } finally {
      await fh.close();
    }
    this.cache.clear();
  }

  async openDownload(remotePath, range) {
    const e = await this.resolve(remotePath);
    const t = await this.token();
    const res = await request(this.mediaUrl(e), { headers: { Authorization: `Bearer ${t}`, ...(range ? { Range: range } : {}) }, timeout: 30000 });
    if (res.statusCode !== 200 && res.statusCode !== 206) { res.resume(); throw ioError(`HTTP ${res.statusCode}`, res.statusCode); }
    return res;
  }

  async logout() {
    this.access = '';
    this.cache.clear();
  }

  /** one-button sign-in: the system browser opens, the user approves, the answer returns to a loopback address. Resolves with the refresh token. */
  static async signIn({ clientId, clientSecret, openUrl }) {
    if (!clientId) throw new Error('This program has no Google app key yet.');
    const { verifier, challenge } = pkce();
    const { code, redirect } = await loopbackCode({
      port: +process.env.COMMANDER_OAUTH_PORT || 0,
      openUrl,
      what: 'Google',
      buildUrl: (redirectUri, state) =>
        `${GGL.auth}?` + form({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/drive', code_challenge: challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent', state }),
    });
    const g = new GDrive();
    g.clientId = clientId;
    g.clientSecret = clientSecret || '';
    const data = await g.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: verifier });
    if (!data.refresh_token) throw new Error('Google did not return a refresh token. Remove the access of this app at myaccount.google.com/permissions and sign in again.');
    return { refreshToken: data.refresh_token };
  }
}

// ------------------------------------------------------------------ browser sign-in (shared by Dropbox and Google)
let activeSignIn = null; // cancel function of the sign-in that is waiting for the browser
const cancelSignIn = () => { if (activeSignIn) activeSignIn(); };
GDrive.cancelSignIn = cancelSignIn;
Dropbox.cancelSignIn = cancelSignIn;

/**
 * Start a local listener on 127.0.0.1, open buildUrl(redirect, state) in the browser and wait for the answer.
 * Resolves with { code, redirect }.
 */
async function loopbackCode({ port, openUrl, buildUrl, what }) {
  const state = b64u(crypto.randomBytes(12));
  const server = http.createServer();
  await new Promise((res, rej) => {
    server.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`${what}: the sign-in port ${port} is busy (is another sign-in running?).`) : e));
    server.listen(port, '127.0.0.1', res);
  });
  const redirect = `http://127.0.0.1:${server.address().port}`;
  try {
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Sign-in timed out (no answer from the browser within 3 minutes).')), 180000);
      if (activeSignIn) activeSignIn(); // only one sign-in at a time
      activeSignIn = () => { clearTimeout(timer); reject(new Error('Sign-in was cancelled.')); };
      server.on('request', (req, res) => {
        const u = new URL(req.url, redirect);
        if (u.searchParams.get('state') !== state && !u.searchParams.get('error')) { res.writeHead(404); return res.end(); }
        const ok = !!u.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>${ok ? 'You are signed in.' : 'Sign-in was not completed.'}</h2><p>You can close this tab and go back to the program.</p></body></html>`);
        clearTimeout(timer);
        if (ok) resolve(u.searchParams.get('code'));
        else reject(new Error(`${what} sign-in was cancelled: ` + (u.searchParams.get('error') || 'no code')));
      });
      openUrl(buildUrl(redirect, state));
    });
    return { code, redirect };
  } finally {
    activeSignIn = null;
    server.close();
  }
}

function googleMessage(r) {
  const e = r.data && r.data.error;
  const m = (e && (e.message || e.status)) || (r.data && (r.data.error_description || r.data.raw)) || '';
  if (r.status === 401) return 'Google Drive: the sign-in is no longer valid. Sign in again.';
  if (r.status === 403 && /rateLimit|quota/i.test(JSON.stringify(e || ''))) return 'Google Drive: quota or rate limit reached, try again later.';
  if (r.status === 403) return 'Google Drive: no permission. ' + m;
  if (r.status === 404) return 'Not found in Google Drive';
  return 'Google Drive: ' + (m || `HTTP ${r.status}`);
}

module.exports = { Dropbox, GDrive };
