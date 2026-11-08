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

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/**
 * The date of a LIST line (the only thing most servers give): "Nov  7 22:41" / "Nov  7  2024" (Unix) or "11-07-26 10:41PM" (DOS), as a time in ms.
 * The server's time zone is not known: the time is taken as UTC. A Unix line without a year is the current year, or the last one when that
 * would be more than a day in the future (what ls does). 0 when the text is not a date.
 */
function parseRawDate(raw, now = Date.now()) {
  const t = String(raw || '').trim();
  let m = /^([A-Za-z]{3})\s+(\d{1,2})\s+(?:(\d{4})|(\d{1,2}):(\d{2}))$/.exec(t);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon === undefined) return 0;
    const day = +m[2];
    if (m[3]) return Date.UTC(+m[3], mon, day);
    let ms = Date.UTC(new Date(now).getUTCFullYear(), mon, day, +m[4], +m[5]);
    if (ms > now + 86400000) ms = Date.UTC(new Date(now).getUTCFullYear() - 1, mon, day, +m[4], +m[5]);
    return ms;
  }
  m = /^(\d{2})-(\d{2})-(\d{2}|\d{4}) (\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(t);
  if (m) {
    const y = m[3].length === 4 ? +m[3] : +m[3] < 70 ? 2000 + +m[3] : 1900 + +m[3];
    let h = +m[4];
    if (m[6]) h = (h % 12) + (m[6].toUpperCase() === 'PM' ? 12 : 0);
    return Date.UTC(y, +m[1] - 1, +m[2], h, +m[5]);
  }
  return 0;
}

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

  /** opts: { host, port, user, pass, security: 'none' | 'explicit' | 'implicit', insecure, keep (seconds, 0 = off), cmds (array of FTP commands sent after the login), timeout (ms, default 30000) } */
  async connect(opts) {
    const { host, security } = opts;
    if (!host) throw new Error('Enter the host name or address');
    this.opts = { ...opts, user: opts.user || 'anonymous', pass: opts.pass || (opts.user ? '' : 'anonymous@') };
    this.endpoint = `${host}${opts.port ? ':' + opts.port : ''}`;
    this.base = `${security === 'none' ? 'ftp' : 'ftps'}://${this.opts.user}@${this.endpoint}`;
    try {
      this.client = await this._open();
      this.home = ((await this.client.pwd()) || '/').replace(/\\/g, '/');
      if (+opts.keep > 0) this.timer = setInterval(() => this._keepAlive(), Math.max(Ftpfs.MIN_KEEP_S, +opts.keep) * 1000);
    } catch (e) {
      this._drop();
      throw explain(e);
    }
    return { home: this.home };
  }

  async _open() {
    const o = this.opts;
    const c = new ftp.Client(+o.timeout > 0 ? +o.timeout : 30000);
    c.ftp.verbose = false;
    const secure = o.security === 'implicit' ? 'implicit' : o.security === 'none' ? false : true;
    try {
      await c.access({
        host: o.host,
        port: +o.port || (secure === 'implicit' ? 990 : 21),
        user: o.user,
        password: o.pass,
        secure,
        secureOptions: secure ? { rejectUnauthorized: !o.insecure, servername: o.host } : undefined,
      });
    } catch (e) {
      c.close();
      // explicit TLS: a server that has no TLS answers the AUTH command with 500 ... 504
      if (secure === true && /^50[0-4]\b/.test(String(e && e.message))) throw new Error('The server does not support FTP over TLS. Choose "Plain FTP (not encrypted)" if you accept that.');
      throw e;
    }
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
      try {
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
      } finally {
        this.pending--; // before the caller sees the result: "pending" is exactly the number of jobs waiting or running
      }
    });
    this.queue = job.catch(() => {});
    return job;
  }

  // ------------------------------------------------------------ files
  // Every public operation is ONE job of the queue (the helpers _list, _exists ... work on the client of that job), so that an upload,
  // which looks, creates folders and then sends, cannot be interleaved with another operation that was asked in between.
  async _list(c, dir) {
    const entries = await c.list(dir);
    const out = [];
    for (const e of entries) {
      if (e.name === '.' || e.name === '..') continue;
      let isDir = e.isDirectory;
      if (e.isSymbolicLink) { // follow the link: a folder when it can be entered
        try { await c.cd(posix.join(dir, e.name)); isDir = true; } catch { isDir = false; }
        try { await c.cd(dir); } catch { /* ignore */ }
      }
      out.push({ name: e.name, isDir, size: isDir ? -1 : e.size || 0, mtime: e.modifiedAt ? e.modifiedAt.getTime() : parseRawDate(e.rawModifiedAt) });
    }
    return out;
  }

  async _exists(c, p) {
    try {
      return (await this._list(c, posix.dirname(p))).some((e) => e.name === posix.basename(p));
    } catch {
      return false;
    }
  }

  async _mkdirp(c, dir) {
    if (!dir || dir === '/') return;
    const here = await c.pwd();
    try { await c.ensureDir(dir); } finally { try { await c.cd(here); } catch { /* ignore */ } }
  }

  list(folder) {
    return this._run((c) => this._list(c, folder || '/'));
  }

  exists(p) {
    return this._run((c) => this._exists(c, p));
  }

  async mkdirp(dir) {
    await this._run((c) => this._mkdirp(c, dir));
  }

  async mkdir(parent, name) {
    await this.mkdirp(posix.join(parent, name));
  }

  async rename(p, newName) {
    await this._run((c) => c.rename(p, posix.join(posix.dirname(p), newName)));
  }

  async remove(paths) {
    await this._run(async (c) => {
      for (const p of paths) {
        const kind = (await this._list(c, posix.dirname(p))).find((e) => e.name === posix.basename(p));
        if (kind && kind.isDir) await c.removeDir(p);
        else await c.remove(p);
      }
    });
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
    const target = posix.join(destFolder, name);
    await this._run(async (c) => {
      await this._mkdirp(c, destFolder);
      if (!overwrite && (await this._exists(c, target))) throw new Error('already exists');
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
      // no SIZE (or an answer that is not a number, as for an empty file on some servers): ask the listing of the folder
      try {
        const hit = (await this._list(own, posix.dirname(remotePath))).find((x) => x.name === posix.basename(remotePath) && !x.isDir);
        if (!hit) throw e;
        total = hit.size;
      } catch {
        own.close();
        throw explain(e);
      }
    }
    let start = 0;
    let end = total - 1;
    let m = total > 0 && range && /bytes=(\d*)-(\d*)/.exec(range); // an empty file has no ranges: 200 and nothing
    if (m && m[1] && m[2] && +m[2] < +m[1]) m = null; // an invalid range (last byte before the first) is ignored, as the RFC says: the whole file
    if (m) {
      if (m[1]) start = +m[1];
      if (m[2]) end = Math.min(+m[2], total - 1);
      if (!m[1] && m[2]) { start = Math.max(0, total - +m[2]); end = total - 1; }
    }
    const length = Math.max(0, end - start + 1);
    let s;
    if (m && start >= total) { // the range starts behind the end of the file: 416 Range Not Satisfiable
      own.close();
      s = Readable.from([]);
      s.statusCode = 416;
      s.headers = { 'content-length': '0', 'content-range': `bytes */${total}` };
      return s;
    }
    if (total === 0) {
      own.close();
      s = Readable.from([]);
    } else {
      const pt = new PassThrough();
      const limited = pt.pipe(limitStream(length, () => own.close())); // the wanted range is complete: stop the transfer
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

/** passes the first `length` bytes of what is written to it, drops the rest, and calls onDone() once, when the last wanted byte has passed */
function limitStream(length, onDone) {
  let left = length;
  return new Transform({
    transform(chunk, _enc, cb) {
      if (left <= 0) return cb();
      const part = chunk.length > left ? chunk.subarray(0, left) : chunk;
      left -= part.length;
      cb(null, part);
      if (left <= 0) onDone();
    },
  });
}

Ftpfs.MIN_KEEP_S = 10; // the shortest keep-alive interval (tests lower it)
Ftpfs.parseRawDate = parseRawDate;

/** friendlier messages for the usual failures */
function explain(e) {
  const m = e && e.message ? e.message : String(e);
  if (/ENOTFOUND|EAI_AGAIN/.test(m)) return new Error('Host not found: ' + m);
  if (/ECONNREFUSED/.test(m)) return new Error('Connection refused (is the FTP server running and the port right?)');
  if (/ETIMEDOUT|timeout/i.test(m)) return new Error('The server did not answer in time.');
  if (/^53\d|^501\b.*pass|Login (incorrect|authentication failed)|User cannot log in/i.test(m)) return new Error('Login failed: wrong user name or password.');
  if (/self[- ]signed|unable to verify|CERT_|certificate/i.test(m)) return new Error('The server certificate is not trusted. Tick "Allow an untrusted certificate" if you trust this server.');
  if (/wrong version number|EPROTO/i.test(m)) return new Error('The server does not speak TLS on this port: try "Plain FTP" or "FTP over TLS (explicit)" with port 21 (implicit TLS is port 990).');
  if (/^550/.test(m)) return new Error(m.replace(/^550\s*/, '') || 'The server refused: no such file or no permission.');
  return e instanceof Error ? e : new Error(m);
}

module.exports = { Ftpfs, parseRawDate, explain, limitStream };
