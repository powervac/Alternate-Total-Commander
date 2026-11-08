'use strict';
// WebDAV (Nextcloud, ownCloud, Synology, Apache, nginx, IIS, Box ...). Same interface as the other remote clients (rem.type 'webdav').
// Plain http / https requests: Basic and Digest login, redirects, an untrusted certificate on request, Range reads for the media proxy.

const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const path = require('path');

const posix = path.posix;
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');

class Davfs {
  constructor() {
    this.type = 'webdav';
    this.home = '/';
    this.digest = null; // { realm, nonce, qop, opaque, nc }
  }

  /** opts: { url, user, pass, insecure, timeout (ms, default 60000) } ; url = https://host[:port]/path/to/dav/ */
  async connect(opts) {
    let u;
    try { u = new URL(/^https?:\/\//i.test(opts.url || '') ? opts.url : 'https://' + (opts.url || '')); } catch { throw new Error('The address is not valid. Example: https://cloud.example.com/remote.php/dav/files/me/'); }
    if (!u.hostname) throw new Error('Enter the address of the WebDAV server');
    this.u = u;
    this.base = u.origin + u.pathname.replace(/\/+$/, '');
    this.basePath = u.pathname.replace(/\/+$/, ''); // '' for the root of the server
    this.user = opts.user || '';
    this.pass = opts.pass || '';
    this.insecure = !!opts.insecure;
    this.timeoutMs = +opts.timeout > 0 ? +opts.timeout : 60000;
    this.endpoint = u.host;
    try {
      const r = await this._request('PROPFIND', '/', { headers: { Depth: '0', 'Content-Type': 'application/xml' }, body: PROPFIND_BODY });
      const text = await readAll(r.res);
      if (r.status === 401) throw new Error('Login failed: wrong user name or password.');
      if (r.status === 404) throw new Error('The address was not found on the server (404). Check the path of the WebDAV folder.');
      if (r.status === 405 || r.status === 501) throw new Error('This address does not speak WebDAV (the server refused PROPFIND).');
      if (r.status >= 400) throw new Error(`The server answered ${r.status} ${r.res.statusMessage || ''}`.trim());
      void text;
    } catch (e) {
      throw explain(e);
    }
    return { home: '/' };
  }

  // ------------------------------------------------------------ HTTP
  _url(rpath) {
    const segs = String(rpath || '/').split('/').filter(Boolean).map(encodeURIComponent);
    return new URL(this.u.origin + this.basePath + '/' + segs.join('/') + (/\/$/.test(rpath) && segs.length ? '/' : ''));
  }

  /** one request with login and up to 5 redirects; resolves { status, headers, res (the response stream) } */
  async _request(method, rpath, { headers = {}, body = null, bodyStream = null, length = null, absUrl = null } = {}, hops = 0) {
    const url = absUrl ? new URL(absUrl) : this._url(rpath);
    const mod = url.protocol === 'http:' ? http : https;
    const h = { 'User-Agent': 'AlternateCommander', ...headers };
    // the login goes only to the server the user typed: a redirect to another host must not receive it
    const auth = url.origin === this.u.origin ? this._authHeader(method, url) : null;
    if (auth) h.Authorization = auth;
    if (body != null) h['Content-Length'] = Buffer.byteLength(body);
    else if (length != null) h['Content-Length'] = String(length);
    const result = await new Promise((resolve, reject) => {
      const req = mod.request(url, { method, headers: h, rejectUnauthorized: !this.insecure, timeout: this.timeoutMs }, (res) => resolve({ status: res.statusCode, headers: res.headers, res, req }));
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('ETIMEDOUT')));
      if (this._onReq) this._onReq(req);
      if (bodyStream) bodyStream.pipe(req);
      else req.end(body != null ? body : undefined);
    });
    // Digest login: the server sent a challenge, repeat the request once with the answer (a stream body cannot be repeated: then the caller retries)
    if (result.status === 401 && !bodyStream && this.user && hops < 2) {
      const ch = parseChallenge(result.headers['www-authenticate']);
      if (ch) {
        result.res.resume();
        this.digest = ch;
        this.basic = ch.scheme === 'basic';
        return this._request(method, rpath, { headers, body, bodyStream, length, absUrl }, hops + 1);
      }
    }
    if ([301, 302, 307, 308].includes(result.status) && result.headers.location && hops < 5 && !bodyStream) {
      result.res.resume();
      return this._request(method, rpath, { headers, body, bodyStream, length, absUrl: new URL(result.headers.location, url).href }, hops + 1);
    }
    result.url = url; // where the answer really came from (after redirects)
    return result;
  }

  _authHeader(method, url) {
    if (!this.user) return null;
    const d = this.digest;
    if (d && d.scheme === 'digest') {
      d.nc = (d.nc || 0) + 1;
      const nc = d.nc.toString(16).padStart(8, '0'); // hexadecimal, as the RFC wants
      const cnonce = crypto.randomBytes(8).toString('hex');
      const uri = url.pathname + url.search;
      const ha1 = md5(`${this.user}:${d.realm}:${this.pass}`);
      const ha2 = md5(`${method}:${uri}`);
      const resp = d.qop ? md5(`${ha1}:${d.nonce}:${nc}:${cnonce}:auth:${ha2}`) : md5(`${ha1}:${d.nonce}:${ha2}`);
      return `Digest username="${this.user}", realm="${d.realm}", nonce="${d.nonce}", uri="${uri}", response="${resp}"` + (d.qop ? `, qop=auth, nc=${nc}, cnonce="${cnonce}"` : '') + (d.opaque ? `, opaque="${d.opaque}"` : '') + ', algorithm=MD5';
    }
    return 'Basic ' + Buffer.from(`${this.user}:${this.pass}`).toString('base64'); // sent at once; a Digest server answers with a challenge
  }

  async _ok(method, rpath, opts, okCodes) {
    const r = await this._request(method, rpath, opts);
    const text = await readAll(r.res);
    if (!(okCodes || [200, 201, 204, 207]).includes(r.status)) throw httpError(r.status, text, method);
    return { ...r, text };
  }

  // ------------------------------------------------------------ files
  async list(folder) {
    const dir = (folder || '/').replace(/\/+$/, '') || '/';
    const r = await this._ok('PROPFIND', dir === '/' ? '/' : dir + '/', { headers: { Depth: '1', 'Content-Type': 'application/xml' }, body: PROPFIND_BODY }, [207]);
    const here = decodeURIComponent(r.url.pathname).replace(/\/+$/, ''); // the folder itself, as the server finally answered (a redirect may have moved it)
    const out = [];
    for (const blk of r.text.split(/<(?:\w+:)?response[ >]/i).slice(1)) {
      const href = /<(?:\w+:)?href[^>]*>([\s\S]*?)<\/(?:\w+:)?href>/i.exec(blk);
      if (!href) continue;
      let p = decodeXml(href[1].trim());
      try { p = new URL(p, this.u.origin).pathname; } catch { /* a bare path */ }
      try { p = decodeURIComponent(p); } catch { /* keep */ }
      const bare = p.replace(/\/+$/, '');
      if (bare === here) continue; // the folder itself
      if (/<(?:\w+:)?status[^>]*>[^<]*\s(4\d\d|5\d\d)\s/i.test(blk) && !/\s200\s/.test(blk)) continue;
      const isDir = /<(?:\w+:)?collection\b/i.test(blk);
      const len = /<(?:\w+:)?getcontentlength[^>]*>\s*(\d+)\s*</i.exec(blk);
      const mod = /<(?:\w+:)?getlastmodified[^>]*>([^<]+)</i.exec(blk);
      const t = mod ? Date.parse(decodeXml(mod[1])) : 0;
      out.push({ name: posix.basename(bare), isDir, size: isDir ? -1 : len ? +len[1] : 0, mtime: Number.isFinite(t) ? t : 0 });
    }
    return out;
  }

  async exists(p) {
    try {
      const r = await this._request('PROPFIND', p, { headers: { Depth: '0', 'Content-Type': 'application/xml' }, body: PROPFIND_BODY });
      await readAll(r.res);
      return r.status === 207 || r.status === 200;
    } catch {
      return false;
    }
  }

  async mkdirp(dir) {
    if (!dir || dir === '/' || (await this.exists(dir))) return;
    await this.mkdirp(posix.dirname(dir));
    await this._ok('MKCOL', dir + '/', {}, [200, 201, 204, 405]); // 405: it exists already
  }

  async mkdir(parent, name) {
    await this.mkdirp(posix.join(parent, name));
  }

  async rename(p, newName) {
    const dest = this._url(posix.join(posix.dirname(p), newName)).href;
    await this._ok('MOVE', p, { headers: { Destination: dest, Overwrite: 'F' } }, [200, 201, 204]);
  }

  async remove(paths) {
    for (const p of paths) await this._ok('DELETE', p, {}, [200, 202, 204, 404]);
  }

  async download(remotePath, dest, { onData, onReq } = {}) {
    this._onReq = onReq || null;
    let r;
    try { r = await this._request('GET', remotePath); } finally { this._onReq = null; }
    if (r.status !== 200) { const t = await readAll(r.res); throw httpError(r.status, t, 'GET'); }
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(dest);
      if (onReq) onReq({ destroy: () => { r.req.destroy(); r.res.destroy(); ws.destroy(); } });
      r.res.on('data', (c) => onData && onData(c.length));
      r.res.on('error', (e) => { ws.destroy(); reject(e); });
      r.res.on('aborted', () => { ws.destroy(); reject(new Error('Download was interrupted')); });
      r.res.on('close', () => { if (!r.res.complete) { ws.destroy(); reject(new Error('Download was interrupted')); } });
      ws.on('error', reject);
      ws.on('close', resolve);
      r.res.pipe(ws);
    }).catch((e) => { try { fs.unlinkSync(dest); } catch { /* not created */ } throw e; });
  }

  async upload(localFile, destFolder, name, overwrite, { onData, onReq } = {}) {
    await this.mkdirp(destFolder);
    const target = posix.join(destFolder, name);
    if (!overwrite && (await this.exists(target))) throw new Error('already exists');
    const st = fs.statSync(localFile);
    // a Digest server needs the challenge first: a cheap request answers it, so that the real upload (a stream) goes through at once
    if (this.user && !this.digest) { try { const w = await this._request('OPTIONS', '/'); await readAll(w.res); } catch { /* the PUT will tell */ } }
    const rs = fs.createReadStream(localFile);
    rs.on('data', (c) => onData && onData(c.length));
    this._onReq = onReq ? (req) => onReq({ destroy: () => { req.destroy(); rs.destroy(); } }) : null;
    let r;
    try {
      r = await this._request('PUT', target, { bodyStream: rs, length: st.size, headers: { 'X-OC-Mtime': String(Math.floor(st.mtimeMs / 1000)) } });
    } finally { this._onReq = null; }
    const text = await readAll(r.res);
    if (![200, 201, 204].includes(r.status)) throw httpError(r.status, text, 'PUT');
  }

  /** for the local streaming proxy (video / audio): a readable with statusCode/headers, honours a Range header */
  async openDownload(remotePath, range) {
    const r = await this._request('GET', remotePath, { headers: range ? { Range: range } : {} });
    if (![200, 206].includes(r.status)) { const t = await readAll(r.res); throw httpError(r.status, t, 'GET'); }
    const s = r.res;
    s.statusCode = r.status;
    const keep = {};
    for (const k of ['content-length', 'content-range', 'content-type', 'accept-ranges']) if (r.headers[k]) keep[k] = r.headers[k];
    s.headers = keep;
    return s;
  }

  async logout() {
    this.user = this.pass = '';
    this.digest = null;
  }
}

const PROPFIND_BODY = '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>';

function readAll(res) {
  return new Promise((resolve, reject) => {
    const parts = [];
    res.on('data', (c) => parts.push(c));
    res.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    res.on('error', reject);
    res.on('close', () => resolve(Buffer.concat(parts).toString('utf8')));
  });
}

function parseChallenge(h) {
  if (!h) return null;
  const list = Array.isArray(h) ? h : [h];
  const d = list.find((x) => /^\s*digest/i.test(x));
  if (!d) return list.some((x) => /^\s*basic/i.test(x)) ? { scheme: 'basic' } : null;
  const get = (k) => { const m = new RegExp(k + '="?([^",]+)"?', 'i').exec(d); return m ? m[1] : ''; };
  return { scheme: 'digest', realm: get('realm'), nonce: get('nonce'), opaque: get('opaque'), qop: /auth/.test(get('qop')) ? 'auth' : '', nc: 0 };
}

function httpError(status, text, method) {
  if (status === 401) return new Error('Login failed: wrong user name or password.');
  if (status === 403) return new Error('The server refused (403): no permission for this.');
  if (status === 404) return new Error('Not found on the server (404).');
  if (status === 405) return new Error(`The server does not allow ${method} here (405).`);
  if (status === 409) return new Error('The folder does not exist on the server (409).');
  if (status === 423) return new Error('The file is locked on the server (423).');
  if (status === 507) return new Error('The server has no space left (507).');
  const msg = /<(?:\w+:)?message>([^<]+)</i.exec(text || '');
  return new Error(`The server answered ${status}` + (msg ? `: ${decodeXml(msg[1])}` : ''));
}

function explain(e) {
  const m = e && e.message ? e.message : String(e);
  if (/ENOTFOUND|EAI_AGAIN/.test(m)) return new Error('Host not found: ' + m);
  if (/ECONNREFUSED/.test(m)) return new Error('Connection refused (is the server running and the port right?)');
  if (/ETIMEDOUT|timeout/i.test(m)) return new Error('The server did not answer in time.');
  if (/self[- ]signed|unable to verify|CERT_|certificate|altnames/i.test(m)) return new Error('The server certificate is not trusted. Tick "Allow an untrusted certificate" if you trust this server.');
  if (/wrong version number|EPROTO/i.test(m)) return new Error('The server does not speak HTTPS on this port: try http:// in the address.');
  return e instanceof Error ? e : new Error(m);
}

module.exports = { Davfs };
