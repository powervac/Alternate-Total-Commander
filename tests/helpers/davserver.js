'use strict';
// A small in-memory WebDAV server for the tests (PROPFIND, GET with Range, PUT, MKCOL, DELETE, MOVE, OPTIONS) that can be bent in every
// way the client has to survive: Basic / Digest login, redirects, other XML dialects, failing methods, cut connections, slow answers.
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

class MockDav {
  /**
   * opts.base      path prefix of the DAV root on the server, e.g. '/dav' ('' = the server root)
   * opts.auth      'none' | 'basic' | 'digest'; credentials test / secret
   * opts.xml       'd' (d:), 'D' (D:), 'none' (default namespace), 'ns0'
   * opts.href      'path' | 'absolute'
   */
  constructor(opts = {}) {
    this.base = opts.base || '';
    this.auth = opts.auth || 'none';
    this.xml = opts.xml || 'd';
    this.href = opts.href || 'path';
    this.noRange = !!opts.noRange;
    this.tls = opts.tls || null; // { key, cert } for HTTPS
    this.qop = opts.qop !== false; // Digest with qop=auth (false: the old RFC 2069 form)
    this.reset();
  }

  reset() {
    this.files = new Map([['/', { dir: true, mtime: Date.UTC(2026, 0, 1) }]]);
    this.log = []; // { method, path, headers }
    this.hooks = []; // (req, res, ctx) => true when the hook answered
    this.nonces = new Set();
    this.digestOk = 0; // Digest answers that were correct
    this.digestBad = 0;
    this.lastNc = 0;
  }

  /** helpers to prepare the state */
  mkdir(p) { this.files.set(p, { dir: true, mtime: Date.UTC(2026, 0, 2) }); return this; }
  put(p, data, mtime = Date.UTC(2026, 2, 3, 4, 5, 6)) { this.files.set(p, { dir: false, data: Buffer.from(data), mtime }); return this; }
  /** answer the next request(s) of this method with a fixed status: on('PUT', 507) */
  on(method, fn, times = 1) {
    this.hooks.push({ method, times, fn: typeof fn === 'number' ? (_q, res) => { res.writeHead(fn); res.end(); return true; } : fn });
    return this;
  }

  async start() {
    const handler = (req, res) => this._handle(req, res).catch((e) => { try { res.writeHead(500); res.end(String(e)); } catch { /* gone */ } });
    this.server = this.tls ? https.createServer(this.tls, handler) : http.createServer(handler);
    this.sockets = new Set();
    this.server.on('connection', (s) => { this.sockets.add(s); s.on('close', () => this.sockets.delete(s)); });
    await new Promise((r) => this.server.listen(0, '127.0.0.1', r));
    this.port = this.server.address().port;
    this.url = `${this.tls ? 'https' : 'http'}://127.0.0.1:${this.port}${this.base}/`;
    return this;
  }

  async stop() {
    for (const s of this.sockets) s.destroy();
    await new Promise((r) => this.server.close(r));
  }

  // ------------------------------------------------------------ internals
  _challenge(res) {
    if (this.auth === 'digest') {
      const nonce = crypto.randomBytes(8).toString('hex');
      this.nonces.add(nonce);
      res.writeHead(401, { 'WWW-Authenticate': `Digest realm="mock", nonce="${nonce}"${this.qop ? ', qop="auth"' : ''}, opaque="op123", algorithm=MD5` });
    } else res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="mock"' });
    res.end();
  }

  _authorized(req) {
    if (this.auth === 'none') return true;
    const h = req.headers.authorization || '';
    if (this.auth === 'basic') return h === 'Basic ' + Buffer.from('test:secret').toString('base64');
    if (!/^Digest /i.test(h)) return false;
    const f = {};
    for (const m of h.slice(7).matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g)) f[m[1]] = m[2] !== undefined ? m[2] : m[3];
    const ok = f.username === 'test' && f.realm === 'mock' && this.nonces.has(f.nonce) && f.uri === req.url && f.opaque === 'op123';
    const ha1 = md5(`test:mock:secret`);
    const ha2 = md5(`${req.method}:${f.uri}`);
    const want = this.qop ? md5(`${ha1}:${f.nonce}:${f.nc}:${f.cnonce}:auth:${ha2}`) : md5(`${ha1}:${f.nonce}:${ha2}`);
    const good = ok && f.response === want && (!this.qop || (f.qop === 'auth' && parseInt(f.nc, 16) > 0));
    if (good) { this.digestOk++; this.lastNc = parseInt(f.nc || '0', 16); } else this.digestBad++;
    return good;
  }

  _path(req) {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (this.base && (p === this.base || p.startsWith(this.base + '/'))) p = p.slice(this.base.length) || '/';
    return p.length > 1 ? p.replace(/\/+$/, '') : p;
  }

  async _body(req) {
    const parts = [];
    for await (const c of req) parts.push(c);
    return Buffer.concat(parts);
  }

  async _handle(req, res) {
    const body = await this._body(req);
    const p = this._path(req);
    this.log.push({ method: req.method, path: p, url: req.url, headers: req.headers, body });
    if (!this._authorized(req)) return this._challenge(res);
    for (const h of this.hooks) {
      if (h.method === req.method && h.times > 0) { h.times--; if (h.fn(req, res, { path: p, body, server: this })) return; }
    }
    const f = this.files.get(p);
    switch (req.method) {
      case 'OPTIONS': res.writeHead(200, { DAV: '1,2', Allow: 'OPTIONS,GET,PUT,PROPFIND,MKCOL,DELETE,MOVE' }); return res.end();
      case 'PROPFIND': return this._propfind(req, res, p, f);
      case 'GET': {
        if (!f || f.dir) { res.writeHead(404); return res.end(); }
        const m = !this.noRange && /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
        if (m) {
          let a = m[1] ? +m[1] : 0; let b = m[2] ? Math.min(+m[2], f.data.length - 1) : f.data.length - 1;
          if (!m[1] && m[2]) { a = Math.max(0, f.data.length - +m[2]); b = f.data.length - 1; }
          res.writeHead(206, { 'Content-Length': b - a + 1, 'Content-Range': `bytes ${a}-${b}/${f.data.length}`, 'Content-Type': 'application/octet-stream', 'Accept-Ranges': 'bytes' });
          return res.end(f.data.subarray(a, b + 1));
        }
        res.writeHead(200, { 'Content-Length': f.data.length, 'Content-Type': 'text/plain' });
        return res.end(f.data);
      }
      case 'PUT': {
        const parent = p.replace(/\/[^/]*$/, '') || '/';
        if (!this.files.get(parent) || !this.files.get(parent).dir) { res.writeHead(409); return res.end(); }
        if (f && f.dir) { res.writeHead(405); return res.end(); }
        const existed = !!f;
        this.files.set(p, { dir: false, data: body, mtime: req.headers['x-oc-mtime'] ? +req.headers['x-oc-mtime'] * 1000 : Date.now() });
        res.writeHead(existed ? 204 : 201); return res.end();
      }
      case 'MKCOL': {
        const parent = p.replace(/\/[^/]*$/, '') || '/';
        if (f) { res.writeHead(405); return res.end(); }
        if (!this.files.get(parent) || !this.files.get(parent).dir) { res.writeHead(409); return res.end(); }
        this.files.set(p, { dir: true, mtime: Date.now() }); res.writeHead(201); return res.end();
      }
      case 'DELETE': {
        if (!f) { res.writeHead(404); return res.end(); }
        for (const k of [...this.files.keys()]) if (k === p || k.startsWith(p + '/')) this.files.delete(k);
        res.writeHead(204); return res.end();
      }
      case 'MOVE': {
        if (!f) { res.writeHead(404); return res.end(); }
        const dest = decodeURIComponent(new URL(req.headers.destination).pathname);
        const d = (this.base && dest.startsWith(this.base) ? dest.slice(this.base.length) : dest).replace(/\/+$/, '') || '/';
        if (this.files.has(d) && req.headers.overwrite === 'F') { res.writeHead(412); return res.end(); }
        for (const k of [...this.files.keys()]) if (k === p || k.startsWith(p + '/')) { this.files.set(d + k.slice(p.length), this.files.get(k)); this.files.delete(k); }
        res.writeHead(201); return res.end();
      }
      default: res.writeHead(405); return res.end();
    }
  }

  _propfind(req, res, p, f) {
    if (!f) { res.writeHead(404); return res.end(); }
    const depth = req.headers.depth === '0' ? 0 : 1;
    const pre = { d: 'd:', D: 'D:', none: '', ns0: 'ns0:' }[this.xml];
    const ns = this.xml === 'none' ? 'xmlns="DAV:"' : this.xml === 'ns0' ? 'xmlns:ns0="DAV:"' : `xmlns:${pre.slice(0, -1)}="DAV:"`;
    const entry = (path, e) => {
      const enc = path.split('/').map(encodeURIComponent).join('/') + (e.dir && path !== '/' ? '/' : '');
      const full = this.base + (enc === '/' && this.base ? '/' : enc);
      const href = this.href === 'absolute' ? `${this.tls ? 'https' : 'http'}://127.0.0.1:${this.port}${full}` : full;
      return `<${pre}response><${pre}href>${esc(href)}</${pre}href><${pre}propstat><${pre}prop>` +
        `<${pre}resourcetype>${e.dir ? `<${pre}collection/>` : ''}</${pre}resourcetype>` +
        (e.dir ? '' : `<${pre}getcontentlength>${e.data.length}</${pre}getcontentlength>`) +
        `<${pre}getlastmodified>${new Date(e.mtime).toUTCString()}</${pre}getlastmodified>` +
        `</${pre}prop><${pre}status>HTTP/1.1 200 OK</${pre}status></${pre}propstat>` +
        `<${pre}propstat><${pre}prop><${pre}quota-used-bytes/></${pre}prop><${pre}status>HTTP/1.1 404 Not Found</${pre}status></${pre}propstat></${pre}response>`;
    };
    let xml = `<?xml version="1.0" encoding="utf-8"?><${pre}multistatus ${ns}>` + entry(p, f);
    if (depth === 1 && f.dir) {
      const kids = [...this.files.keys()].filter((k) => k !== p && k.replace(/\/[^/]*$/, '') === (p === '/' ? '' : p) && k !== '/');
      for (const k of kids) xml += entry(k, this.files.get(k));
    }
    xml += `</${pre}multistatus>`;
    res.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8' });
    res.end(xml);
  }
}

module.exports = { MockDav };
