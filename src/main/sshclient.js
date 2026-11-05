'use strict';
// SSH connection: SFTP file access (same interface as the Synology client, so the NAS panel code works unchanged)
// plus an interactive shell for the console view.

const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const posix = path.posix;
const wrap = (fn) => new Promise((resolve, reject) => fn((err, res) => (err ? reject(err) : resolve(res))));

class Sshfs {
  constructor() {
    this.client = null;
    this.sftp = null;
    this.shell = null;
    this.base = '';
    this.type = 'sftp';
    this.home = '/';
  }

  /**
   * opts: host, port, user, pass, keyPath, passphrase, verifyHost(host, port, fingerprint) -> Promise<boolean>, onClose()
   * Auth: private key, else password (also answers keyboard-interactive), else the ssh agent.
   */
  async connect(opts) {
    const { host, port = 22, user, pass, keyPath, passphrase } = opts;
    if (!host) throw new Error('Enter the host name or address');
    if (!user) throw new Error('Enter the user name');
    const cfg = {
      host,
      port: +port || 22,
      username: user,
      readyTimeout: 25000,
      keepaliveInterval: 15000,
      keepaliveCountMax: 4,
      hostHash: 'sha256',
      tryKeyboard: !!pass,
    };
    if (keyPath) {
      try {
        cfg.privateKey = fs.readFileSync(keyPath);
      } catch (e) {
        throw new Error('Cannot read the key file: ' + e.message);
      }
      if (passphrase) cfg.passphrase = passphrase;
    } else if (pass) cfg.password = pass;
    else throw new Error('Enter the password, or choose a key file.');
    this.client = new Client();
    this.endpoint = `${host}:${cfg.port}`;
    let verifyError = null;
    cfg.hostVerifier = (hex, cb) => {
      const fp = 'SHA256:' + Buffer.from(hex, 'hex').toString('base64').replace(/=+$/, '');
      Promise.resolve(opts.verifyHost ? opts.verifyHost(host, cfg.port, fp) : true).then(
        (ok) => { if (!ok) verifyError = new Error('The host key was not trusted, connection cancelled.'); cb(!!ok); },
        (e) => { verifyError = e; cb(false); }
      );
    };
    this.client.on('keyboard-interactive', (_n, _i, _l, prompts, finish) => finish(prompts.map(() => pass || '')));
    // ssh2 may emit several 'error' events for one failure; a permanent listener keeps any of them from becoming an uncaught exception
    let pendingReject = null;
    this.client.on('error', (e) => {
      if (pendingReject) { const r = pendingReject; pendingReject = null; r(verifyError || explain(e)); }
    });
    this.client.on('close', () => { if (opts.onClose) opts.onClose(); });
    await new Promise((resolve, reject) => {
      pendingReject = reject;
      this.client.once('ready', () => { pendingReject = null; resolve(); });
      try {
        this.client.connect(cfg);
      } catch (e) {
        pendingReject = null;
        reject(explain(e));
      }
    });
    this.sftp = await wrap((cb) => this.client.sftp(cb));
    this.home = await wrap((cb) => this.sftp.realpath('.', cb)).catch(() => '/');
    this.base = `${user}@${this.endpoint}`;
    return { home: this.home };
  }

  // ------------------------------------------------------------ files (same shape as the Synology client)
  async list(folder) {
    const dir = folder || '/';
    const entries = await wrap((cb) => this.sftp.readdir(dir, cb));
    const out = [];
    for (const e of entries) {
      if (e.filename === '.' || e.filename === '..') continue;
      let a = e.attrs;
      let isDir = a.isDirectory();
      if (a.isSymbolicLink && a.isSymbolicLink()) {
        try {
          a = await wrap((cb) => this.sftp.stat(posix.join(dir, e.filename), cb)); // follow the link
          isDir = a.isDirectory();
        } catch { /* dangling link: show as a file */ }
      }
      out.push({ name: e.filename, isDir, size: isDir ? -1 : a.size || 0, mtime: (a.mtime || 0) * 1000 });
    }
    return out;
  }

  async exists(p) {
    try {
      await wrap((cb) => this.sftp.stat(p, cb));
      return true;
    } catch {
      return false;
    }
  }

  async mkdirp(dir) {
    if (!dir || dir === '/' || (await this.exists(dir))) return;
    await this.mkdirp(posix.dirname(dir));
    await wrap((cb) => this.sftp.mkdir(dir, cb));
  }

  async mkdir(parent, name) {
    await this.mkdirp(posix.join(parent, name));
  }

  async rename(p, newName) {
    await wrap((cb) => this.sftp.rename(p, posix.join(posix.dirname(p), newName), cb));
  }

  async removeOne(p) {
    const st = await wrap((cb) => this.sftp.lstat(p, cb));
    if (st.isDirectory()) {
      const kids = await wrap((cb) => this.sftp.readdir(p, cb));
      for (const k of kids) if (k.filename !== '.' && k.filename !== '..') await this.removeOne(posix.join(p, k.filename));
      await wrap((cb) => this.sftp.rmdir(p, cb));
    } else await wrap((cb) => this.sftp.unlink(p, cb));
  }

  async remove(paths) {
    for (const p of paths) await this.removeOne(p);
  }

  async download(remotePath, dest, { onData, onReq } = {}) {
    await new Promise((resolve, reject) => {
      const rs = this.sftp.createReadStream(remotePath);
      const ws = fs.createWriteStream(dest);
      if (onReq) onReq(rs);
      rs.on('data', (c) => onData && onData(c.length));
      rs.on('error', (e) => { ws.destroy(); reject(e); });
      rs.on('close', () => { if (!rs.readableEnded) { ws.destroy(); reject(new Error('Download was interrupted')); } });
      ws.on('error', reject);
      ws.on('close', resolve);
      rs.pipe(ws);
    });
  }

  async upload(localFile, destFolder, name, overwrite, { onData, onReq } = {}) {
    await this.mkdirp(destFolder);
    const target = posix.join(destFolder, name);
    if (!overwrite && (await this.exists(target))) throw new Error('already exists');
    await new Promise((resolve, reject) => {
      const rs = fs.createReadStream(localFile);
      const ws = this.sftp.createWriteStream(target, { flags: 'w' });
      if (onReq) onReq(ws);
      rs.on('data', (c) => onData && onData(c.length));
      rs.on('error', (e) => { ws.destroy(); reject(e); });
      ws.on('error', reject);
      ws.on('close', resolve);
      rs.pipe(ws);
    });
    try {
      const st = fs.statSync(localFile);
      await wrap((cb) => this.sftp.setstat(target, { mtime: Math.floor(st.mtimeMs / 1000), atime: Math.floor(st.atimeMs / 1000) }, cb));
    } catch { /* not important */ }
  }

  /** for the local streaming proxy (video / audio): a readable with statusCode/headers, honours a Range header */
  async openDownload(remotePath, range) {
    const st = await wrap((cb) => this.sftp.stat(remotePath, cb));
    const total = st.size;
    let start = 0;
    let end = total - 1;
    const m = range && /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      if (m[1]) start = +m[1];
      if (m[2]) end = Math.min(+m[2], total - 1);
      if (!m[1] && m[2]) { start = Math.max(0, total - +m[2]); end = total - 1; }
    }
    const s = total === 0 ? require('stream').Readable.from([]) : this.sftp.createReadStream(remotePath, { start, end });
    s.statusCode = m ? 206 : 200;
    s.headers = { 'content-length': String(Math.max(0, end - start + 1)) };
    if (m) s.headers['content-range'] = `bytes ${start}-${end}/${total}`;
    return s;
  }

  // ------------------------------------------------------------ interactive shell
  async openShell({ cols = 80, rows = 24 }, onData, onClose) {
    this.closeShell();
    const stream = await wrap((cb) => this.client.shell({ term: 'xterm-256color', cols, rows, width: 0, height: 0 }, cb));
    this.shell = stream;
    stream.on('data', (d) => onData(d));
    stream.stderr.on('data', (d) => onData(d));
    stream.on('close', () => { if (this.shell === stream) this.shell = null; onClose(); });
    return true;
  }
  writeShell(data) {
    if (this.shell) this.shell.write(data);
  }
  resizeShell(cols, rows) {
    if (this.shell) this.shell.setWindow(rows, cols, 0, 0);
  }
  closeShell() {
    if (this.shell) { try { this.shell.end(); } catch { /* ignore */ } this.shell = null; }
  }

  async logout() {
    this.closeShell();
    try { if (this.client) this.client.end(); } catch { /* ignore */ }
    this.sftp = null;
  }
}

/** friendlier messages for the usual failures */
function explain(e) {
  const m = e && e.message ? e.message : String(e);
  if (/All configured authentication methods failed/i.test(m)) return new Error('Login failed: wrong user name, password or key.');
  if (/ENOTFOUND|EAI_AGAIN/.test(m)) return new Error('Host not found: ' + m);
  if (/ECONNREFUSED/.test(m)) return new Error('Connection refused (is the SSH server running and the port right?)');
  if (/Timed out while waiting for handshake|ETIMEDOUT/i.test(m)) return new Error('The server did not answer in time.');
  if (/Encrypted private key detected|passphrase/i.test(m)) return new Error('The key is encrypted: enter its passphrase.');
  return e instanceof Error ? e : new Error(m);
}

module.exports = { Sshfs };
