'use strict';
// A real FTP server (ftp-srv) on localhost for the tests, with: a log of every command line the client sent, a count of the connections,
// explicit or implicit TLS (self-signed, tests/helpers/cert.js), a way to cut every connection, and fake symbolic links in the listing
// (ftp-srv itself never shows "l" entries, but many Unix servers do).
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

// ftp-srv formats its LIST lines in one helper module: wrap it before ftp-srv loads it, so that entries flagged as links get an "l" line
const statPath = require.resolve('ftp-srv/src/helpers/file-stat');
const origStat = require(statPath);
require.cache[statPath].exports = function (stat, format) {
  const line = origStat(stat, format);
  if (stat.symlinkTo && typeof line === 'string' && line.startsWith('d')) return 'l' + line.slice(1).replace(/ (\S+)$/, ` $1 -> ${stat.symlinkTo}`);
  if (stat.symlinkTo && typeof line === 'string') return 'l' + line.slice(1).replace(/ (\S+)$/, ` $1 -> ${stat.symlinkTo}`);
  return line;
};
const FtpSrv = require('ftp-srv');
const bunyan = require('bunyan');

const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

class MockFtp {
  /**
   * opts.tls       { key, cert } -> FTP over TLS (explicit, or implicit with opts.implicit)
   * opts.users     { name: password }; opts.anonymous (default true)
   * opts.cwd       the directory the login starts in (relative to the root)
   * opts.links     { name: { to: 'real-dir' | 'real-file', dir: true|false } }: fake symbolic links shown in the root listing
   */
  constructor(opts = {}) {
    this.opts = opts;
    this.root = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdr-ftp-'));
    this.users = opts.users || { test: 'secret' };
    this.reset();
  }

  reset() {
    this.commands = []; // every command line, in order, over all connections: 'USER test'
    this.logins = []; // { username, password }
    this.passes = []; // the real PASS arguments (the command log hides them)
    this.connects = 0;
    this.disconnects = 0;
    this.conns = new Set();
  }

  async start() {
    const port = await freePort();
    const base = 20000 + Math.floor(Math.random() * 30000);
    const proto = this.opts.tls && this.opts.implicit ? 'ftps' : 'ftp';
    this.server = new FtpSrv({
      url: `${proto}://127.0.0.1:${port}`,
      anonymous: this.opts.anonymous !== false,
      pasv_url: '127.0.0.1',
      pasv_min: base,
      pasv_max: base + 200,
      tls: this.opts.tls || false,
      greeting: ['mock ftp'],
      log: bunyan.createLogger({ name: 'ftp', level: 'fatal' }),
    });
    this.server.on('login', ({ connection, username, password }, ok, no) => {
      this.logins.push({ username, password });
      const good = (username === 'anonymous' && this.opts.anonymous !== false) || this.users[username] === password;
      if (!good) return no(new Error('bad login'));
      const FileSystem = require('ftp-srv/src/fs');
      const fsys = this.opts.links ? this._linkFs(FileSystem, connection) : undefined;
      return ok({ root: this.root, cwd: this.opts.cwd, fs: fsys });
    });
    this.server.on('connect', ({ connection }) => { this.connects++; this.conns.add(connection); });
    this.server.on('disconnect', ({ connection }) => { this.disconnects++; this.conns.delete(connection); });
    this.server.on('client-error', () => {});
    // every command line: the server emits no event for it, so listen on the command socket of each connection
    this.server.on('connect', ({ connection }) => {
      connection.commandSocket.on('data', (d) => {
        for (const line of String(d).split(/\r?\n/).filter(Boolean)) {
          if (/^PASS /.test(line)) this.passes.push(line.slice(5));
          this.commands.push(line.replace(/^PASS .*/, 'PASS ***'));
        }
      });
    });
    await this.server.listen();
    this.port = port;
    return this;
  }

  /** a file system that adds fake links to the listing of the root and lets CWD enter the ones that point to a folder */
  _linkFs(FileSystem, connection) {
    const links = this.opts.links;
    const real = this.root;
    class LinkFs extends FileSystem {
      list(p = '.') {
        return super.list(p).then((entries) => {
          const rel = path.posix.normalize(String(p).startsWith('/') ? String(p) : this.cwd + '/' + p);
          if (rel !== '/') return entries; // the links live in the root only
          for (const [name, l] of Object.entries(links)) {
            const target = path.join(real, l.to);
            let st;
            try { st = fs.statSync(target); } catch { continue; }
            st.name = name;
            st.symlinkTo = l.to;
            entries.push(st);
          }
          return entries;
        });
      }
      chdir(p = '.') {
        const name = String(p).replace(/^\/+/, '');
        if (links[name]) {
          if (!links[name].dir) return Promise.reject(new Error('Not a directory'));
          return super.chdir('/' + links[name].to);
        }
        return super.chdir(p);
      }
    }
    return new LinkFs(connection, { root: this.root, cwd: this.opts.cwd });
  }

  /** put a file / folder into the root of the server */
  put(rel, data, mtime) {
    const f = path.join(this.root, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, data);
    if (mtime) fs.utimesSync(f, mtime, mtime);
    return f;
  }
  mkdir(rel) { fs.mkdirSync(path.join(this.root, rel), { recursive: true }); return this; }
  read(rel) { return fs.readFileSync(path.join(this.root, rel)); }
  has(rel) { return fs.existsSync(path.join(this.root, rel)); }
  /** the names in a folder of the server */
  ls(rel = '') { return fs.readdirSync(path.join(this.root, rel)).sort(); }
  clear() { // a file the server still reads cannot be deleted on Windows for a moment: retry, then leave it (tests use their own names)
    for (const n of fs.readdirSync(this.root)) { try { fs.rmSync(path.join(this.root, n), { recursive: true, force: true, maxRetries: 5, retryDelay: 40 }); } catch { /* in use */ } }
  }

  /** cut every connection (the way a server with an idle limit, or a network failure, does) */
  dropAll() { for (const c of this.conns) { try { c.commandSocket.destroy(); } catch { /* gone */ } } }

  async stop() {
    this.dropAll();
    await this.server.close();
    try { fs.rmSync(this.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 40 }); } catch { /* in use */ }
  }
}

module.exports = { MockFtp, freePort };
