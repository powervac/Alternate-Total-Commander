'use strict';
// FTP / FTPS (explicit and implicit TLS) with basic-ftp. Same interface as the Synology and SSH clients (list, mkdir, rename, remove,
// download, upload, openDownload ...), so the remote panel code works unchanged (rem.type 'ftp').
// One FTP control connection runs one command at a time: every operation goes through a queue. The streaming proxy (video / music) gets
// its own connection per stream, so playing a file never waits for the panel and the panel never waits for the player.

const fs = require('fs');
const path = require('path');
const { PassThrough, Readable, Transform } = require('stream');
const ftp = require('basic-ftp');

const posix = path.posix;

class Ftpfs {
  constructor() {
    this.type = 'ftp';
    this.client = null;
    this.opts = null;
    this.queue = Promise.resolve();
    this.closedByUs = false;
    this.home = '/';
    this.pending = 0;
    this.timer = null;
  }

  /** opts: { host, port, user, pass, security: 'none' | 'explicit' | 'implicit', insecure, keep (seconds, 0 = off), cmds (array of FTP commands sent after the login) } */
  async connect(opts) {
    const { host, security } = opts;
    if (!host) throw new Error('Enter the host name or address');
    this.opts = { ...opts, user: opts.user || 'anonymous', pass: opts.pass || (opts.user ? '' : 'anonymous@') };
    this.endpoint = `${host}${opts.port ? ':' + opts.port : ''}`;
    this.base = `${security === 'none' ? 'ftp' : 'ftps'}://${this.opts.user}@${this.endpoint}`;
    try {
      this.client = await this._open();
      this.home = ((await this.client.pwd()) || '/').replace(/\\/g, '/');
      if (+opts.keep > 0) this.timer = setInterval(() => this._keepAlive(), Math.max(10, +opts.keep) * 1000);
    } catch (e) {
      this._drop();
      throw explain(e);
    }
    return { home: this.home };
  }

  async _open() {
    const o = this.opts;
    const c = new ftp.Client(30000);
    c.ftp.verbose = false;
    const secure = o.security === 'implicit' ? 'implicit' : o.security === 'none' ? false : true;
    await c.access({
      host: o.host,
      port: +o.port || (secure === 'implicit' ? 990 : 21),
      user: o.user,
      password: o.pass,
      secure,
      secureOptions: secure ? { rejectUnauthorized: !o.insecure, servername: o.host } : undefined,
    });
    for (const cmd of o.cmds || []) { // commands after the login (like the "Send commands" box of Total Commander)
      try { await c.send(cmd); } catch (e) { c.close(); throw new Error(`The command "${cmd}" was refused: ${e.message}`); }
    }
    return c;
  }

  /** NOOP when nothing else runs, so that a server with an idle limit keeps the connection */
  _keepAlive() {
    if (this.closedByUs || this.pending || !this.client || this.client.closed) return;
    this._run((c) => c.send('NOOP')).catch(() => {});
  }

  _drop() {
    try { if (this.client) this.client.close(); } catch { /* gone */ }
    this.client = null;
  }

  /** run fn(client) after the earlier operations; a connection the server closed meanwhile is opened again first */
  _run(fn) {
    this.pending++;
    const job = this.queue.then(async () => {
      if (this.closedByUs) throw new Error('The connection was closed.');
      if (!this.client || this.client.closed) {
        try { this.client = await this._open(); } catch (e) { this._drop(); throw explain(e); }
      }
      try {
        return await fn(this.client);
      } catch (e) {
        if (this.client && this.client.closed) this._drop(); // the next operation reconnects
        throw explain(e);
      }
    });
    this.queue = job.catch(() => {}).then(() => { this.pending--; });
    return job;
  }

  // ------------------------------------------------------------ files
  async list(folder) {
    const dir = folder || '/';
    return this._run(async (c) => {
      const entries = await c.list(dir);
      const out = [];
      for (const e of entries) {
        if (e.name === '.' || e.name === '..') continue;
        let isDir = e.isDirectory;
        if (e.isSymbolicLink) { // follow the link: a folder when it can be entered
          try { await c.cd(posix.join(dir, e.name)); isDir = true; } catch { isDir = false; }
          try { await c.cd(dir); } catch { /* ignore */ }
        }
        out.push({ name: e.name, isDir, size: isDir ? -1 : e.size || 0, mtime: e.modifiedAt ? e.modifiedAt.getTime() : 0 });
      }
      return out;
    });
  }

  async exists(p) {
    const name = posix.basename(p);
    const dir = posix.dirname(p);
    try {
      return (await this.list(dir)).some((e) => e.name === name);
    } catch {
      return false;
    }
  }

  async mkdirp(dir) {
    if (!dir || dir === '/') return;
    await this._run(async (c) => {
      const here = await c.pwd();
      try { await c.ensureDir(dir); } finally { try { await c.cd(here); } catch { /* ignore */ } }
    });
  }

  async mkdir(parent, name) {
    await this.mkdirp(posix.join(parent, name));
  }

  async rename(p, newName) {
    await this._run((c) => c.rename(p, posix.join(posix.dirname(p), newName)));
  }

  async removeOne(p) {
    const name = posix.basename(p);
    const dir = posix.dirname(p);
    const kind = (await this.list(dir)).find((e) => e.name === name);
    if (kind && kind.isDir) await this._run((c) => c.removeDir(p));
    else await this._run((c) => c.remove(p));
  }

  async remove(paths) {
    for (const p of paths) await this.removeOne(p);
  }

  /** a transfer of one file; cancel (destroy) closes the control connection, the next operation opens a new one */
  _transfer(c, onData, onReq, run) {
    let last = 0;
    c.trackProgress((info) => { if (onData && info.bytes > last) { onData(info.bytes - last); last = info.bytes; } });
    if (onReq) onReq({ destroy: () => { try { c.close(); } catch { /* gone */ } } });
    return run().finally(() => { try { c.trackProgress(); } catch { /* closed */ } });
  }

  async download(remotePath, dest, { onData, onReq } = {}) {
    await this._run(async (c) => {
      try {
        await this._transfer(c, onData, onReq, () => c.downloadTo(dest, remotePath));
      } catch (e) {
        try { fs.unlinkSync(dest); } catch { /* not created */ }
        throw e;
      }
    });
  }

  async upload(localFile, destFolder, name, overwrite, { onData, onReq } = {}) {
    await this.mkdirp(destFolder);
    const target = posix.join(destFolder, name);
    if (!overwrite && (await this.exists(target))) throw new Error('already exists');
    await this._run(async (c) => {
      await this._transfer(c, onData, onReq, () => c.uploadFrom(localFile, target));
      try { // keep the date of the file when the server knows MFMT
        const t = fs.statSync(localFile).mtime;
        const z = (n, w = 2) => String(n).padStart(w, '0');
        const stamp = `${t.getUTCFullYear()}${z(t.getUTCMonth() + 1)}${z(t.getUTCDate())}${z(t.getUTCHours())}${z(t.getUTCMinutes())}${z(t.getUTCSeconds())}`;
        await c.send(`MFMT ${stamp} ${target}`);
      } catch { /* not supported: not important */ }
    });
  }

  /** for the local streaming proxy (video / audio): a readable with statusCode/headers, honours a Range header; own connection */
  async openDownload(remotePath, range) {
    const own = await this._open();
    let total;
    try {
      total = await own.size(remotePath);
    } catch (e) {
      own.close();
      throw explain(e);
    }
    let start = 0;
    let end = total - 1;
    const m = range && /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      if (m[1]) start = +m[1];
      if (m[2]) end = Math.min(+m[2], total - 1);
      if (!m[1] && m[2]) { start = Math.max(0, total - +m[2]); end = total - 1; }
    }
    const length = Math.max(0, end - start + 1);
    let s;
    if (total === 0 || length === 0) {
      own.close();
      s = Readable.from([]);
    } else {
      const pt = new PassThrough();
      let left = length;
      const cut = new Transform({
        transform(chunk, _enc, cb) {
          if (left <= 0) return cb();
          const part = chunk.length > left ? chunk.subarray(0, left) : chunk;
          left -= part.length;
          cb(null, part);
          if (left <= 0) own.close(); // the wanted range is complete: stop the transfer
        },
      });
      const limited = pt.pipe(cut);
      limited.on('close', () => own.close()); // the player went away
      own.downloadTo(pt, remotePath, start).then(() => pt.end(), () => pt.end());
      s = limited;
    }
    s.statusCode = m ? 206 : 200;
    s.headers = { 'content-length': String(length) };
    if (m) s.headers['content-range'] = `bytes ${start}-${end}/${total}`;
    return s;
  }

  async logout() {
    this.closedByUs = true;
    if (this.timer) clearInterval(this.timer);
    this._drop();
  }
}

/** friendlier messages for the usual failures */
function explain(e) {
  const m = e && e.message ? e.message : String(e);
  if (/ENOTFOUND|EAI_AGAIN/.test(m)) return new Error('Host not found: ' + m);
  if (/ECONNREFUSED/.test(m)) return new Error('Connection refused (is the FTP server running and the port right?)');
  if (/ETIMEDOUT|timeout/i.test(m)) return new Error('The server did not answer in time.');
  if (/^530|Login (incorrect|authentication failed)|User cannot log in/i.test(m)) return new Error('Login failed: wrong user name or password.');
  if (/self[- ]signed|unable to verify|CERT_|certificate/i.test(m)) return new Error('The server certificate is not trusted. Tick "Allow an untrusted certificate" if you trust this server.');
  if (/wrong version number|EPROTO/i.test(m)) return new Error('The server does not speak TLS on this port: try "Plain FTP" or "FTP over TLS (explicit)" with port 21 (implicit TLS is port 990).');
  if (/^550/.test(m)) return new Error(m.replace(/^550\s*/, '') || 'The server refused: no such file or no permission.');
  return e instanceof Error ? e : new Error(m);
}

module.exports = { Ftpfs };
