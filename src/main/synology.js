'use strict';
// Minimal Synology DSM "File Station" Web API client (DSM 6 / 7) with QuickConnect address resolving.
// Uses only Node's http/https so it can stream big files, report progress and be cancelled.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PassThrough } = require('stream');

class SynoError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const AUTH_ERRORS = {
  400: 'Wrong user name or password',
  401: 'Account is disabled',
  402: 'Permission denied',
  403: '2-step verification code is required',
  404: 'The 2-step verification code is wrong',
  406: '2-step verification is enforced for this account',
  407: 'This IP address is blocked',
  408: 'The password has expired',
  409: 'The password has expired',
  410: 'The password must be changed first',
};
const COMMON_ERRORS = {
  100: 'Unknown error',
  101: 'Invalid parameter',
  102: 'The API does not exist',
  103: 'The method does not exist',
  104: 'The API version is not supported',
  105: 'No permission',
  106: 'Session timed out',
  107: 'Session interrupted by a duplicate login',
  119: 'Session not found',
  400: 'Invalid parameter or file operation error',
  401: 'Unknown error of the file operation',
  402: 'System is too busy',
  403: 'Invalid user for the file operation',
  407: 'Operation not permitted',
  408: 'No such file or directory',
  409: 'Non-supported file system',
  410: 'Failed to connect to a network file system',
  411: 'Read-only file system',
  412: 'Filename too long',
  413: 'Disk quota exceeded',
  414: 'File or folder already exists',
  415: 'Disk is full',
  416: 'No such folder or file',
  418: 'Not allowed to access this file or folder',
};

/** low level request: resolves with the IncomingMessage */
function open(urlStr, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + u.search,
        method: opts.method || 'GET',
        headers: opts.headers || {},
        rejectUnauthorized: !opts.insecure,
        timeout: opts.timeout || 20000,
        agent: false,
      },
      resolve
    );
    req.on('timeout', () => req.destroy(new Error('Connection timed out')));
    req.on('error', reject);
    if (opts.onReq) opts.onReq(req);
    if (opts.body && typeof opts.body.pipe === 'function') opts.body.pipe(req);
    else req.end(opts.body || undefined);
  });
}

async function readBody(res, limit = 8 * 1024 * 1024) {
  const chunks = [];
  let n = 0;
  for await (const c of res) {
    n += c.length;
    if (n > limit) throw new Error('Response is too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

/** GET/POST returning parsed JSON, follows redirects (the QuickConnect relay may redirect) */
async function jsonRequest(urlStr, opts = {}, hops = 0) {
  const res = await open(urlStr, opts);
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 5) {
    res.resume();
    const next = new URL(res.headers.location, urlStr).toString();
    return jsonRequest(next, res.statusCode === 303 ? { ...opts, method: 'GET', body: null } : opts, hops + 1);
  }
  const buf = await readBody(res);
  let data;
  try {
    data = JSON.parse(buf.toString('utf8'));
  } catch {
    throw new Error(`Not a Synology API response (HTTP ${res.statusCode})`);
  }
  return { data, url: urlStr };
}

const form = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(typeof v === 'string' ? v : JSON.stringify(v)))
    .join('&');

class Syno {
  constructor() {
    this.base = '';
    this.sid = '';
    this.insecure = false;
    this.apis = {};
    this.creds = null; // kept in memory only, for transparent re-login
  }

  /** candidate base URLs for what the user typed */
  static async candidates(input, insecure) {
    let s = String(input || '').trim();
    if (!s) throw new Error('Enter the address of the NAS');
    const out = [];
    const add = (b) => { if (b && !out.includes(b)) out.push(b); };
    const hasScheme = /^https?:\/\//i.test(s);
    let u;
    try {
      u = new URL(hasScheme ? s : 'https://' + s);
    } catch {
      throw new Error('The address is not valid');
    }
    const host = u.hostname.toLowerCase();
    const qcId = /^[a-z0-9_-]+$/i.test(s.replace(/\/.*$/, '')) && !s.includes('.') ? s.replace(/\/.*$/, '') : host.endsWith('.quickconnect.to') ? host.split('.')[0] : '';
    if (qcId) {
      // 1. the QuickConnect address itself (relay / redirect)
      add(host.endsWith('.quickconnect.to') ? `https://${host}` : `https://${qcId}.quickconnect.to`);
      // 2. ask the QuickConnect servers where the NAS really is
      try {
        const region = host.endsWith('.quickconnect.to') && host.split('.').length >= 4 ? host.split('.')[1] : '';
        const servers = ['https://global.quickconnect.to/Serv.php', region ? `https://${region}.quickconnect.to/Serv.php` : ''].filter(Boolean);
        for (const srv of servers) {
          const body = JSON.stringify({ version: 1, command: 'get_server_info', stop_when_error: false, stop_when_success: false, id: 'dsm_portal_https', serverID: qcId, is_gofile: false });
          let r;
          try {
            r = await jsonRequest(srv, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, body, timeout: 8000 });
          } catch { continue; }
          const d = r.data || {};
          const server = d.server || {};
          const service = d.service || {};
          const hosts = [];
          if (server.ddns && server.ddns !== 'NULL') hosts.push(server.ddns);
          if (server.fqdn && server.fqdn !== 'NULL') hosts.push(server.fqdn);
          if (server.external && server.external.ip) hosts.push(server.external.ip);
          for (const itf of server.interface || []) if (itf.ip) hosts.push(itf.ip);
          const ports = [service.ext_port, service.port, 5001].filter((p, i, a) => p && a.indexOf(p) === i);
          for (const h of hosts) for (const p of ports) add(`https://${h}:${p}`);
          if (hosts.length) break;
        }
      } catch { /* the first candidate may still work */ }
    } else if (hasScheme || u.port) {
      add(u.origin);
    } else {
      add(`https://${host}:5001`);
      add(`http://${host}:5000`);
      add(`https://${host}`);
    }
    return out;
  }

  async probe(base) {
    const q = 'api=SYNO.API.Info&version=1&method=query&query=all';
    const { data, url } = await jsonRequest(`${base}/webapi/query.cgi?${q}`, { insecure: this.insecure, timeout: 9000 });
    if (!data.success) throw new Error('DSM did not answer the API info request');
    // after a redirect the real address of the NAS is the final one
    return { apis: data.data, base: new URL(url).origin };
  }

  async connect({ url, user, pass, otp, insecure }) {
    this.insecure = !!insecure;
    const cands = await Syno.candidates(url, insecure);
    let lastErr = null;
    for (const base of cands) {
      try {
        const info = await this.probe(base);
        this.apis = info.apis;
        this.base = base;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!this.base) throw new Error('Cannot reach the NAS' + (lastErr ? ': ' + lastErr.message : '') + (cands.length ? `\nTried: ${cands.slice(0, 4).join(', ')}` : ''));
    this.creds = { user, pass };
    await this.login(otp);
    return { base: this.base };
  }

  async login(otp) {
    const { user, pass } = this.creds;
    const v = Math.min(6, (this.apis['SYNO.API.Auth'] || {}).maxVersion || 3);
    const p = { api: 'SYNO.API.Auth', version: v, method: 'login', account: user, passwd: pass, session: 'FileStation', format: 'sid' };
    if (otp) p.otp_code = String(otp).trim();
    const r = await this.rawCall('SYNO.API.Auth', p, false);
    if (!r.success) {
      const c = r.error && r.error.code;
      throw new SynoError(AUTH_ERRORS[c] || COMMON_ERRORS[c] || `Login failed (code ${c})`, c);
    }
    this.sid = r.data.sid;
  }

  async rawCall(apiName, params, withSid = true) {
    const info = this.apis[apiName] || {};
    const p = info.path || 'entry.cgi';
    const body = form(params);
    const url = `${this.base}/webapi/${p}` + (withSid && this.sid ? `?_sid=${encodeURIComponent(this.sid)}` : '');
    const { data } = await jsonRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      body,
      insecure: this.insecure,
    });
    return data;
  }

  /** call an API; one transparent re-login when the session is gone */
  async call(apiName, method, params = {}, version = 2, retry = true) {
    const max = (this.apis[apiName] || {}).maxVersion || version;
    let r;
    // the NAS or the QuickConnect relay now and then answers 502 / 503 / 504 for a single request: try again a couple of times
    for (let attempt = 0; ; attempt++) {
      try {
        r = await this.rawCall(apiName, { api: apiName, version: Math.min(version, max), method, ...params });
        break;
      } catch (e) {
        if (attempt >= 2 || !/HTTP 50[234]/.test(String(e && e.message))) throw e;
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
      }
    }
    if (r.success) return r.data;
    const c = r.error && r.error.code;
    if (retry && [106, 107, 119].includes(c) && this.creds) {
      await this.login();
      return this.call(apiName, method, params, version, false);
    }
    throw new SynoError(COMMON_ERRORS[c] || `DSM error ${c}`, c);
  }

  // ------------------------------------------------------------ File Station
  async list(folder) {
    if (!folder || folder === '/') {
      const d = await this.call('SYNO.FileStation.List', 'list_share', { offset: 0, limit: 1000, additional: ['time'] }, 2);
      return (d.shares || []).map((s) => ({ name: s.name, isDir: true, size: -1, mtime: ((s.additional && s.additional.time && s.additional.time.mtime) || 0) * 1000 }));
    }
    const out = [];
    for (let offset = 0; ; ) {
      const d = await this.call('SYNO.FileStation.List', 'list', { folder_path: folder, offset, limit: 1000, sort_by: 'name', sort_direction: 'asc', additional: ['size', 'time'] }, 2);
      const files = d.files || [];
      for (const f of files) {
        const a = f.additional || {};
        out.push({ name: f.name, isDir: !!f.isdir, size: f.isdir ? -1 : a.size || 0, mtime: ((a.time && a.time.mtime) || 0) * 1000 });
      }
      offset += files.length;
      if (!files.length || offset >= (d.total || 0)) break;
    }
    return out;
  }

  async mkdir(parent, name) {
    await this.call('SYNO.FileStation.CreateFolder', 'create', { folder_path: [parent], name: [name], force_parent: true }, 2);
  }

  async rename(p, newName) {
    await this.call('SYNO.FileStation.Rename', 'rename', { path: [p], name: [newName] }, 2);
  }

  async remove(paths) {
    const api = 'SYNO.FileStation.Delete';
    if (((this.apis[api] || {}).maxVersion || 1) < 2) {
      await this.call(api, 'delete', { path: paths, recursive: true }, 1);
      return;
    }
    // version 2 works as a background task (start, then ask for the status): no long blocking request that a relay may cut with a 502
    const t = await this.call(api, 'start', { path: paths, recursive: true }, 2);
    if (!t || !t.taskid) return;
    const until = Date.now() + 15 * 60 * 1000;
    for (;;) {
      const d = await this.call(api, 'status', { taskid: t.taskid }, 2);
      if (d && d.finished) {
        if (d.errors && d.errors.length) throw new Error('Cannot delete: ' + (d.errors[0].path || '') + (d.errors[0].code ? ` (DSM error ${d.errors[0].code})` : ''));
        return;
      }
      if (Date.now() > until) throw new Error('Deleting takes too long, it continues on the NAS');
      await new Promise((res) => setTimeout(res, 400));
    }
  }

  /** stream a remote file to a local path; onData(n) per chunk; onReq(req) to be able to cancel */
  async download(remotePath, dest, { onData, onReq } = {}) {
    const run = async (retry) => {
      const body = form({ api: 'SYNO.FileStation.Download', version: Math.min(2, (this.apis['SYNO.FileStation.Download'] || {}).maxVersion || 2), method: 'download', path: [remotePath], mode: 'download' });
      const p = (this.apis['SYNO.FileStation.Download'] || {}).path || 'entry.cgi';
      const res = await open(`${this.base}/webapi/${p}?_sid=${encodeURIComponent(this.sid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
        body,
        insecure: this.insecure,
        timeout: 30000,
        onReq,
      });
      if (res.statusCode !== 200) { res.resume(); throw new SynoError(`HTTP ${res.statusCode}`, res.statusCode); }
      if (/json/i.test(res.headers['content-type'] || '')) {
        const j = JSON.parse((await readBody(res)).toString('utf8'));
        const c = j.error && j.error.code;
        if (retry && [106, 107, 119].includes(c) && this.creds) { await this.login(); return run(false); }
        throw new SynoError(COMMON_ERRORS[c] || `DSM error ${c}`, c);
      }
      await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(dest);
        res.on('data', (c) => onData && onData(c.length));
        res.on('error', (e) => { ws.destroy(); reject(e); });
        res.on('aborted', () => { ws.destroy(); reject(new Error('Download was interrupted')); });
        ws.on('error', reject);
        ws.on('close', resolve);
        res.pipe(ws);
      });
    };
    return run(true);
  }

  /** open a remote file for streaming (video player): returns the response, honours an HTTP Range header */
  async openDownload(remotePath, range, retry = true) {
    const info = this.apis['SYNO.FileStation.Download'] || {};
    const qs = form({ api: 'SYNO.FileStation.Download', version: Math.min(2, info.maxVersion || 2), method: 'download', path: [remotePath], mode: 'open', _sid: this.sid });
    const headers = range ? { Range: range } : {};
    const res = await open(`${this.base}/webapi/${info.path || 'entry.cgi'}?${qs}`, { headers, insecure: this.insecure, timeout: 30000 });
    if (/json/i.test(res.headers['content-type'] || '')) {
      const j = JSON.parse((await readBody(res)).toString('utf8'));
      const c = j.error && j.error.code;
      if (retry && [106, 107, 119].includes(c) && this.creds) { await this.login(); return this.openDownload(remotePath, range, false); }
      throw new SynoError(COMMON_ERRORS[c] || `DSM error ${c}`, c);
    }
    if (res.statusCode !== 200 && res.statusCode !== 206) { res.resume(); throw new SynoError(`HTTP ${res.statusCode}`, res.statusCode); }
    return res;
  }

  /** upload one local file into the remote folder `destFolder` */
  async upload(localFile, destFolder, name, overwrite, { onData, onReq } = {}) {
    const st = await fs.promises.stat(localFile);
    const boundary = '----CommanderBoundary' + crypto.randomBytes(8).toString('hex');
    const field = (n, v) => `--${boundary}\r\nContent-Disposition: form-data; name="${n}"\r\n\r\n${v}\r\n`;
    const safeName = name.replace(/["\r\n]/g, '_');
    const head = Buffer.from(
      field('path', destFolder) + field('create_parents', 'true') + field('overwrite', overwrite ? 'true' : 'false') +
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      'utf8'
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const body = new PassThrough();
    body.write(head);
    const rs = fs.createReadStream(localFile);
    rs.on('data', (c) => onData && onData(c.length));
    rs.on('error', (e) => body.destroy(e));
    rs.on('end', () => body.end(tail));
    rs.pipe(body, { end: false });
    const v = Math.min(2, (this.apis['SYNO.FileStation.Upload'] || {}).maxVersion || 2);
    const p = (this.apis['SYNO.FileStation.Upload'] || {}).path || 'entry.cgi';
    const res = await open(`${this.base}/webapi/${p}?api=SYNO.FileStation.Upload&version=${v}&method=upload&_sid=${encodeURIComponent(this.sid)}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': head.length + st.size + tail.length },
      body,
      insecure: this.insecure,
      timeout: 120000,
      onReq,
    });
    const j = JSON.parse((await readBody(res)).toString('utf8'));
    if (!j.success) {
      const c = j.error && j.error.code;
      throw new SynoError(COMMON_ERRORS[c] || `DSM error ${c}`, c);
    }
  }

  async logout() {
    try {
      if (this.sid) await this.rawCall('SYNO.API.Auth', { api: 'SYNO.API.Auth', version: 1, method: 'logout', session: 'FileStation' });
    } catch { /* ignore */ }
    this.sid = '';
    this.creds = null;
  }
}

module.exports = { Syno, SynoError };
