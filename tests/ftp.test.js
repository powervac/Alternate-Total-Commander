'use strict';
// FTP / FTPS client (src/main/ftpclient.js) against a real FTP server (ftp-srv) on localhost, tests/helpers/ftpserver.js.
// Method: black box through the public interface; what the client did is verified twice: in the result and in the command log / the files
// of the server (tests/TEST_METHODS.md, FTP-*).
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { Ftpfs, parseRawDate } = require('../src/main/ftpclient');
const { MockFtp } = require('./helpers/ftpserver');
const { makeCert } = require('./helpers/cert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdr-ftp-t-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const local = (name, data) => { const f = path.join(tmp, name); if (data !== undefined) fs.writeFileSync(f, data); return f; };
const readAll = (s) => new Promise((res, rej) => { const a = []; s.on('data', (c) => a.push(c)); s.on('end', () => res(Buffer.concat(a))); s.on('error', rej); });
const rejects = (p, re) => assert.rejects(p, (e) => { assert.match(e.message, re); return true; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) return false; await sleep(20); } return true; };
const sorted = (l) => [...l].sort((a, b) => a.name.localeCompare(b.name));
const ENOENT = /ENOENT|No such|not found|55\d|45\d/i;

const opened = [];
async function connect(s, o = {}) {
  const c = new Ftpfs();
  opened.push(c);
  await c.connect({ host: '127.0.0.1', port: s.port, user: 'test', pass: 'secret', security: 'none', ...o });
  return c;
}
afterEach(async () => { while (opened.length) await opened.pop().logout(); });

// ---------------------------------------------------------------- connect
describe('FTP connect', () => {
  let s;
  before(async () => { s = await new MockFtp({ cwd: '/' }).start(); });
  after(() => s.stop());
  afterEach(() => { s.reset(); s.clear(); });

  it('FTP-C1 logs in with USER then PASS over one connection and reports home "/"', async () => {
    const c = new Ftpfs();
    opened.push(c);
    const r = await c.connect({ host: '127.0.0.1', port: s.port, user: 'test', pass: 'secret', security: 'none' });
    assert.deepEqual(r, { home: '/' });
    assert.equal(c.type, 'ftp');
    assert.equal(c.endpoint, `127.0.0.1:${s.port}`);
    assert.equal(c.base, `ftp://test@127.0.0.1:${s.port}`);
    assert.equal(s.connects, 1);
    assert.deepEqual(s.logins, [{ username: 'test', password: 'secret' }]);
    const i = s.commands.indexOf('USER test');
    assert.ok(i >= 0 && s.commands[i + 1] === 'PASS ***');
  });

  it('FTP-C2 no user = anonymous login with "anonymous@" as the password; a given password is kept', async () => {
    // a server that checks the password of "anonymous" like any other (ftp-srv in its anonymous mode skips PASS completely)
    const t = await new MockFtp({ anonymous: false, users: { anonymous: 'anonymous@', guest: 'x' } }).start();
    try {
      const c = new Ftpfs();
      opened.push(c);
      await c.connect({ host: '127.0.0.1', port: t.port, security: 'none' });
      assert.equal(t.logins.at(-1).username, 'anonymous');
      assert.equal(t.passes.at(-1), 'anonymous@');
      assert.equal(c.base, `ftp://anonymous@127.0.0.1:${t.port}`);
      await rejects(new Ftpfs().connect({ host: '127.0.0.1', port: t.port, user: 'anonymous', pass: 'other@example.org', security: 'none' }), /Login failed/);
      assert.equal(t.passes.at(-1), 'other@example.org');
    } finally { await t.stop(); }
    // and the server in anonymous mode lets the plain "no user" through
    const c2 = new Ftpfs();
    opened.push(c2);
    await c2.connect({ host: '127.0.0.1', port: s.port, security: 'none' });
    assert.equal(s.logins.at(-1).username, 'anonymous');
  });

  it('FTP-C3 a user without a password sends an EMPTY password (and is refused by a server that wants one)', async () => {
    await rejects(new Ftpfs().connect({ host: '127.0.0.1', port: s.port, user: 'test', security: 'none' }), /Login failed/);
    assert.equal(s.commands.at(-1), 'PASS ***');
    assert.equal(s.passes.at(-1), '');
  });

  it('FTP-C4 an empty host is refused before any connection', async () => {
    await rejects(new Ftpfs().connect({ host: '', port: s.port }), /Enter the host name or address/);
    await rejects(new Ftpfs().connect({}), /Enter the host name or address/);
    assert.equal(s.connects, 0);
  });

  it('FTP-C5 a wrong password or an unknown user: "Login failed"', async () => {
    await rejects(new Ftpfs().connect({ host: '127.0.0.1', port: s.port, user: 'test', pass: 'nope', security: 'none' }), /Login failed: wrong user name or password/);
    await rejects(new Ftpfs().connect({ host: '127.0.0.1', port: s.port, user: 'nobody', pass: 'x', security: 'none' }), /Login failed/);
  });

  it('FTP-C6 a closed port: "Connection refused"', async () => {
    const srv = net.createServer().listen(0, '127.0.0.1');
    await new Promise((r) => srv.on('listening', r));
    const port = srv.address().port;
    await new Promise((r) => srv.close(r));
    await rejects(new Ftpfs().connect({ host: '127.0.0.1', port, security: 'none' }), /Connection refused/);
  });

  it('FTP-C7 a server that accepts but never speaks: "did not answer in time" after the timeout', async () => {
    const dead = net.createServer((sock) => sock.on('error', () => {})).listen(0, '127.0.0.1');
    await new Promise((r) => dead.on('listening', r));
    const t = Date.now();
    try {
      await rejects(new Ftpfs().connect({ host: '127.0.0.1', port: dead.address().port, security: 'none', timeout: 300 }), /did not answer in time/);
      assert.ok(Date.now() - t < 5000);
    } finally { dead.close(); }
  });

  it('FTP-C8 an unknown host name: "Host not found"', async () => {
    await rejects(new Ftpfs().connect({ host: 'no-such-host.invalid', security: 'none', timeout: 8000 }), /Host not found/);
  });

  it('FTP-C9 a login that starts in a subfolder gives that folder as home', async () => {
    const t = await new MockFtp({ cwd: '/home/user' }).start();
    try {
      t.mkdir('home/user');
      const c = await connect(t);
      assert.equal(c.home, '/home/user');
    } finally { await t.stop(); }
  });

  it('FTP-C10 commands after the login are sent in order, after PASS', async () => {
    await connect(s, { cmds: ['TYPE A', 'NOOP', 'TYPE A'] });
    const log = s.commands;
    const hand = log.lastIndexOf('STRU F'); // the last step of the normal login
    const i1 = log.indexOf('TYPE A', hand);
    const i2 = log.indexOf('NOOP', i1);
    const i3 = log.indexOf('TYPE A', i2);
    assert.ok(hand > log.indexOf('PASS ***'));
    assert.ok(i1 > hand && i2 > i1 && i3 > i2, log.join('|'));
  });

  it('FTP-C11 a refused command stops the connection with its name in the message, and no connection stays open', async () => {
    await rejects(new Ftpfs().connect({ host: '127.0.0.1', port: s.port, user: 'test', pass: 'secret', security: 'none', cmds: ['BOGUS x'] }), /The command "BOGUS x" was refused/);
    assert.ok(await until(() => s.conns.size === 0), 'the connection must be closed');
  });

  it('FTP-C12 an empty cmds list or undefined is fine', async () => {
    await connect(s, { cmds: [] });
    await connect(s, { cmds: undefined });
  });
});

// ---------------------------------------------------------------- TLS
describe('FTP over TLS', () => {
  const tls = makeCert();
  const skip = !tls;
  let ex; let im; let plain;
  before(async () => {
    plain = await new MockFtp().start();
    if (tls) { ex = await new MockFtp({ tls }).start(); im = await new MockFtp({ tls, implicit: true }).start(); }
  });
  after(async () => { await plain.stop(); if (ex) await ex.stop(); if (im) await im.stop(); });

  it('FTP-S1 explicit TLS with a self-signed certificate is refused with the advice to tick the box', { skip }, async () => {
    await rejects(new Ftpfs().connect({ host: '127.0.0.1', port: ex.port, user: 'test', pass: 'secret', security: 'explicit' }), /certificate is not trusted.*untrusted certificate/);
  });

  it('FTP-S2 explicit TLS with "allow untrusted": the panel works, the address says ftps://, the password goes only after AUTH TLS', { skip }, async () => {
    ex.put('a.txt', 'abc');
    const c = await connect(ex, { security: 'explicit', insecure: true });
    assert.equal(c.base, `ftps://test@127.0.0.1:${ex.port}`);
    assert.deepEqual((await c.list('/')).map((x) => x.name), ['a.txt']);
    assert.ok(ex.commands.includes('AUTH TLS'));
    assert.ok(ex.commands.indexOf('AUTH TLS') < ex.commands.indexOf('USER test'));
  });

  it('FTP-S3 implicit TLS (the connection is TLS from the first byte)', { skip }, async () => {
    im.put('b.txt', 'bb');
    const c = await connect(im, { security: 'implicit', insecure: true });
    assert.equal(c.base, `ftps://test@127.0.0.1:${im.port}`);
    assert.deepEqual((await c.list('/')).map((x) => x.name), ['b.txt']);
    assert.ok(!im.commands.includes('AUTH TLS'));
    await rejects(new Ftpfs().connect({ host: '127.0.0.1', port: im.port, user: 'test', pass: 'secret', security: 'implicit' }), /certificate is not trusted/);
  });

  it('FTP-S4 implicit TLS against a plain FTP port: "does not speak TLS" with the right ports in the advice', async () => {
    await rejects(new Ftpfs().connect({ host: '127.0.0.1', port: plain.port, user: 'test', pass: 'secret', security: 'implicit' }), /does not speak TLS.*port 21.*port 990/s);
  });

  it('FTP-S5 explicit TLS against a server without TLS: "does not support FTP over TLS", the plain way is named', async () => {
    await rejects(new Ftpfs().connect({ host: '127.0.0.1', port: plain.port, user: 'test', pass: 'secret', security: 'explicit' }), /does not support FTP over TLS.*Plain FTP/);
    assert.ok(await until(() => plain.conns.size === 0), 'the half-open connection must be closed');
  });

  it('FTP-S6 a transfer works through TLS (data channel too): 1 MB up and down', { skip }, async () => {
    const c = await connect(ex, { security: 'explicit', insecure: true });
    const data = crypto.randomBytes(1_000_000);
    await c.upload(local('tls-up.bin', data), '/', 'tls.bin', false, {});
    assert.ok(ex.read('tls.bin').equals(data));
    const dest = local('tls-down.bin');
    await c.download('/tls.bin', dest);
    assert.ok(fs.readFileSync(dest).equals(data));
  });
});

// ---------------------------------------------------------------- list / exists
describe('FTP list / exists', () => {
  let s;
  before(async () => { s = await new MockFtp({ links: { linkdir: { to: 'real', dir: true }, linkfile: { to: 'f.txt', dir: false } } }).start(); });
  after(() => s.stop());
  afterEach(() => { s.reset(); s.clear(); });

  it('FTP-L1 lists files and folders with sizes and dates; folders have size -1', async () => {
    const recent = new Date(Date.now() - 3 * 86400e3);
    const old = new Date(Date.UTC(2020, 2, 4, 5, 6, 7));
    s.put('f.txt', 'hello', recent);
    s.put('old.bin', Buffer.alloc(1234), old);
    s.mkdir('dir');
    const c = await connect(s);
    const l = sorted((await c.list('/')).filter((x) => !/^link/.test(x.name)));
    assert.deepEqual(l.map((x) => [x.name, x.isDir, x.size]), [['dir', true, -1], ['f.txt', false, 5], ['old.bin', false, 1234]]);
    const f = l.find((x) => x.name === 'f.txt');
    assert.ok(Math.abs(f.mtime - recent.getTime()) < 61000, 'minute precision: ' + (f.mtime - recent.getTime()));
    assert.equal(l.find((x) => x.name === 'old.bin').mtime, Date.UTC(2020, 2, 4)); // old files show the day only
    assert.ok(l.find((x) => x.name === 'dir').mtime > 0);
  });

  it('FTP-L2 "." and ".." are never listed; undefined, "" and "/" are the root', async () => {
    s.put('a.txt', '1');
    const c = await connect(s);
    for (const arg of ['/', '', undefined]) assert.ok((await c.list(arg)).some((x) => x.name === 'a.txt'));
    assert.ok((await c.list('/')).every((x) => x.name !== '.' && x.name !== '..'));
  });

  it('FTP-L3 names with spaces, Cyrillic, CJK and brackets', async () => {
    const names = ['a b.txt', 'Привет мир.txt', '日本語.txt', 'f[1].txt', "it's.txt", 'x&y.txt'];
    names.forEach((n) => s.put(n, n));
    const c = await connect(s);
    const got = (await c.list('/')).map((x) => x.name).filter((n) => !/^link/.test(n));
    assert.deepEqual(got.sort(), [...names].sort());
  });

  it('FTP-L4 an empty folder is an empty list; a missing one is an error', async () => {
    s.mkdir('empty');
    const c = await connect(s);
    assert.deepEqual(await c.list('/empty'), []);
    await rejects(c.list('/missing'), ENOENT);
  });

  it('FTP-L5 a listing of 300 entries is read completely', async () => {
    for (let i = 0; i < 300; i++) s.put(`big/f${i}.txt`, 'x');
    const c = await connect(s);
    assert.equal((await c.list('/big')).length, 300);
  });

  it('FTP-L6 a link to a folder is a folder, a link to a file is a file; the client enters it with CWD and returns', async () => {
    s.mkdir('real'); s.put('real/inner.txt', 'in'); s.put('f.txt', 'hello');
    const c = await connect(s);
    const l = sorted(await c.list('/'));
    const dir = l.find((x) => x.name === 'linkdir');
    const file = l.find((x) => x.name === 'linkfile');
    assert.equal(dir.isDir, true);
    assert.equal(dir.size, -1);
    assert.equal(file.isDir, false);
    assert.equal(file.size, 5);
    const cwds = s.commands.filter((x) => /^CWD /.test(x));
    assert.ok(cwds.includes('CWD /linkdir') && cwds.includes('CWD /linkfile'));
    const lastLink = s.commands.lastIndexOf('CWD /linkfile');
    assert.ok(s.commands.slice(lastLink + 1).some((x) => x === 'CWD /'), 'the working folder is restored after a link check');
  });

  it('FTP-L7 exists: true for file and folder, false for a missing name and for a missing parent', async () => {
    s.put('d/f.txt', 'x');
    const c = await connect(s);
    assert.equal(await c.exists('/d'), true);
    assert.equal(await c.exists('/d/f.txt'), true);
    assert.equal(await c.exists('/d/other.txt'), false);
    assert.equal(await c.exists('/nothing/f.txt'), false);
    assert.equal(await c.exists('/f.txt'), false);
  });
});

// ---------------------------------------------------------------- date parser
describe('FTP date parser (LIST lines)', () => {
  const now = Date.UTC(2026, 10, 7, 23, 0); // 2026-11-07 23:00 UTC
  const cases = [
    ['Nov  7 22:41', Date.UTC(2026, 10, 7, 22, 41)],
    ['Nov 07 22:41', Date.UTC(2026, 10, 7, 22, 41)],
    ['nov 7 00:00', Date.UTC(2026, 10, 7, 0, 0)],
    ['NOV 7 23:59', Date.UTC(2026, 10, 8 - 1, 23, 59) - 0],
    ['Jan  1 00:00', Date.UTC(2026, 0, 1)],
    ['Dec 31 23:59', Date.UTC(2025, 11, 31, 23, 59)],
    ['Dec  1 10:00', Date.UTC(2025, 11, 1, 10, 0)],
    ['Jan  5  2024', Date.UTC(2024, 0, 5)],
    ['Dec 31  1999', Date.UTC(1999, 11, 31)],
    ['  Nov  7 22:41  ', Date.UTC(2026, 10, 7, 22, 41)],
    ['11-07-26 10:41PM', Date.UTC(2026, 10, 7, 22, 41)],
    ['11-07-26 10:41pm', Date.UTC(2026, 10, 7, 22, 41)],
    ['01-02-03 12:00AM', Date.UTC(2003, 0, 2, 0, 0)],
    ['01-02-03 12:30PM', Date.UTC(2003, 0, 2, 12, 30)],
    ['01-02-03 01:05PM', Date.UTC(2003, 0, 2, 13, 5)],
    ['01-02-03 11:59AM', Date.UTC(2003, 0, 2, 11, 59)],
    ['12-31-69 09:00AM', Date.UTC(2069, 11, 31, 9, 0)],
    ['01-01-70 09:00AM', Date.UTC(1970, 0, 1, 9, 0)],
    ['06-15-1998 23:59', Date.UTC(1998, 5, 15, 23, 59)],
    ['06-15-98 7:05AM', Date.UTC(1998, 5, 15, 7, 5)],
  ];
  for (const [raw, want] of cases) {
    it(`FTP-T1 "${raw}" -> ${new Date(want).toISOString()}`, () => {
      const got = parseRawDate(raw, now);
      assert.equal(got, raw === 'NOV 7 23:59' ? Date.UTC(2026, 10, 7, 23, 59) : want);
    });
  }

  it('FTP-T2 a Unix date without a year is the last year when it would be more than a day in the future (boundary)', () => {
    assert.equal(parseRawDate('Nov  8 23:00', now), Date.UTC(2026, 10, 8, 23, 0)); // exactly +1 day: this year
    assert.equal(parseRawDate('Nov  8 23:01', now), Date.UTC(2025, 10, 8, 23, 1)); // +1 day and a minute: last year
    const jan = Date.UTC(2027, 0, 1, 10, 0);
    assert.equal(parseRawDate('Dec 31 23:00', jan), Date.UTC(2026, 11, 31, 23, 0));
    assert.equal(parseRawDate('Jan  1 09:00', jan), Date.UTC(2027, 0, 1, 9, 0));
  });

  it('FTP-T3 anything else is 0: empty, undefined, null, a number, a wrong month, a word, MLSD style, a time only', () => {
    for (const raw of ['', undefined, null, 12345, 'Foo 07 22:41', 'garbage', '2026-11-07T22:41:00Z', '22:41', 'Nov', 'Nov 7', '13-45-99 10:00AM x']) assert.equal(parseRawDate(raw, now), 0, String(raw));
  });

  it('FTP-T4 uses the clock when no "now" is given', () => {
    const t = new Date();
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][t.getUTCMonth()];
    const got = parseRawDate(`${mon} ${t.getUTCDate()} 00:00`);
    assert.ok(got > 0 && Math.abs(got - Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())) < 86400e3 * 366);
    assert.equal(Ftpfs.parseRawDate, parseRawDate);
  });
});

// ---------------------------------------------------------------- mkdir / rename / remove
describe('FTP create / rename / delete', () => {
  let s;
  before(async () => { s = await new MockFtp().start(); });
  after(() => s.stop());
  afterEach(() => { s.reset(); s.clear(); });

  it('FTP-M1 mkdir creates a folder, nested parents too; the working folder is the same afterwards', async () => {
    const c = await connect(s);
    await c.mkdir('/', 'new');
    assert.ok(s.has('new'));
    await c.mkdirp('/a/b/c');
    assert.ok(s.has('a/b/c'));
    await c.mkdir('/a', 'with space');
    assert.ok(s.has('a/with space'));
    assert.equal(await c._run((x) => x.pwd()), '/');
  });

  it('FTP-M2 an existing folder is fine; mkdirp("/") and "" send nothing', async () => {
    s.mkdir('x/y');
    const c = await connect(s);
    await c.mkdirp('/x/y');
    const n = s.commands.length;
    await c.mkdirp('/');
    await c.mkdirp('');
    await c.mkdirp(undefined);
    assert.equal(s.commands.length, n);
  });

  it('FTP-M3 a folder over a file is an error and the file stays', async () => {
    s.put('f.txt', 'x');
    const c = await connect(s);
    await assert.rejects(c.mkdir('/', 'f.txt'));
    assert.equal(s.read('f.txt').toString(), 'x');
  });

  it('FTP-R1 rename a file, a folder with children, a name with spaces; the parent folder is kept', async () => {
    s.put('d/in.txt', 'in'); s.put('a.txt', 'A');
    const c = await connect(s);
    await c.rename('/a.txt', 'b b.txt');
    assert.equal(s.read('b b.txt').toString(), 'A');
    assert.equal(s.has('a.txt'), false);
    await c.rename('/d/in.txt', 'out.txt');
    assert.equal(s.read('d/out.txt').toString(), 'in');
    await c.rename('/d', 'dd');
    assert.equal(s.read('dd/out.txt').toString(), 'in');
    assert.equal(s.has('d'), false);
  });

  it('FTP-R2 renaming a missing name is an error', async () => {
    const c = await connect(s);
    await rejects(c.rename('/nothing', 'x'), ENOENT);
  });

  it('FTP-D1 remove deletes a file, a whole folder tree, several paths in one call', async () => {
    s.put('a.txt', 'a'); s.put('d/x.txt', 'x'); s.put('d/e/y.txt', 'y'); s.mkdir('empty'); s.put('keep.txt', 'k');
    const c = await connect(s);
    await c.remove(['/a.txt', '/d', '/empty']);
    assert.deepEqual(s.ls(), ['keep.txt']);
    assert.ok(s.commands.includes('DELE /a.txt'));
    assert.ok(s.commands.includes('RMD /empty'));
  });

  it('FTP-D2 removing a missing path is an error and the others are not touched', async () => {
    s.put('a.txt', 'a');
    const c = await connect(s);
    await assert.rejects(c.remove(['/missing', '/a.txt']));
    assert.equal(s.has('a.txt'), true);
  });

  it('FTP-D3 a file in a sub folder is deleted by its full path', async () => {
    s.put('d/in/f.txt', 'x'); s.put('d/other.txt', 'o');
    const c = await connect(s);
    await c.remove(['/d/in/f.txt']);
    assert.deepEqual(s.ls('d/in'), []);
    assert.deepEqual(s.ls('d'), ['in', 'other.txt']);
  });
});

// ---------------------------------------------------------------- transfers
describe('FTP download / upload', () => {
  let s;
  before(async () => { s = await new MockFtp().start(); });
  after(() => s.stop());
  afterEach(() => { s.reset(); s.clear(); });

  it('FTP-G1 downloads a binary file byte for byte; onData adds up to the size', async () => {
    const data = crypto.randomBytes(1_500_000);
    s.put('big.bin', data);
    const c = await connect(s);
    let n = 0;
    const dest = local('g1.bin');
    await c.download('/big.bin', dest, { onData: (k) => { n += k; } });
    assert.ok(fs.readFileSync(dest).equals(data));
    assert.equal(n, data.length);
  });

  it('FTP-G2 an empty file and a name that needs care', async () => {
    s.put('ü ö.txt', '');
    const c = await connect(s);
    const dest = local('g2.txt');
    await c.download('/ü ö.txt', dest);
    assert.equal(fs.readFileSync(dest).length, 0);
  });

  it('FTP-G3 a missing file is an error and no file is left behind', async () => {
    const c = await connect(s);
    const dest = path.join(tmp, 'g3.bin');
    await rejects(c.download('/nope.bin', dest), ENOENT);
    assert.equal(fs.existsSync(dest), false);
  });

  it('FTP-G4 onReq gives a handle that cancels the transfer: the half file is removed and the next operation reconnects', async () => {
    s.put('huge.bin', Buffer.alloc(30_000_000, 5));
    const c = await connect(s);
    let got = 0; let gave = 0;
    const dest = path.join(tmp, 'g4.bin');
    const before = s.logins.length;
    // the handle is given before the first byte moves; the progress of basic-ftp comes twice a second, so cancel at once
    await assert.rejects(c.download('/huge.bin', dest, { onReq: (h) => { gave++; h.destroy(); }, onData: (k) => { got += k; } }));
    assert.equal(gave, 1);
    assert.equal(fs.existsSync(dest), false);
    assert.ok(got < 30_000_000);
    s.put('small.txt', 'ok');
    assert.ok((await c.list('/')).some((x) => x.name === 'small.txt'));
    assert.equal(s.logins.length, before + 1, 'one new login after the cancel');
  });

  it('FTP-U1 uploads: content, progress, an empty file, nested destination folders', async () => {
    const data = crypto.randomBytes(700_000);
    const c = await connect(s);
    let n = 0;
    await c.upload(local('u1.bin', data), '/p/q', 'up.bin', false, { onData: (k) => { n += k; } });
    assert.ok(s.read('p/q/up.bin').equals(data));
    assert.equal(n, data.length);
    await c.upload(local('u1e.txt', ''), '/', 'empty file.txt', false, {});
    assert.equal(s.read('empty file.txt').length, 0);
  });

  it('FTP-U2 overwrite=false refuses an existing file and changes nothing; overwrite=true replaces it', async () => {
    s.put('f.txt', 'old');
    const c = await connect(s);
    const f = local('u2.txt', 'new');
    await rejects(c.upload(f, '/', 'f.txt', false, {}), /already exists/);
    assert.equal(s.read('f.txt').toString(), 'old');
    assert.equal(s.commands.filter((x) => /^STOR /.test(x)).length, 0);
    await c.upload(f, '/', 'f.txt', true, {});
    assert.equal(s.read('f.txt').toString(), 'new');
  });

  it('FTP-U3 the date of the file is sent with MFMT (UTC, 14 digits); a server that refuses MFMT does not fail the upload', async () => {
    const f = local('u3.txt', 'x');
    const t = new Date(Date.UTC(2024, 1, 3, 4, 5, 6));
    fs.utimesSync(f, t, t);
    const c = await connect(s);
    await c.upload(f, '/', 'dated.txt', true, {});
    assert.ok(s.commands.includes('MFMT 20240203040506 /dated.txt'), s.commands.filter((x) => /MFMT/.test(x)).join());
    assert.equal(s.read('dated.txt').toString(), 'x');
  });

  it('FTP-U4 a name with spaces and Cyrillic; a missing local file is an error', async () => {
    const c = await connect(s);
    await c.upload(local('u4.txt', 'д'), '/', 'Мой файл 1.txt', false, {});
    assert.equal(s.read('Мой файл 1.txt').toString(), 'д');
    await assert.rejects(c.upload(path.join(tmp, 'does-not-exist.bin'), '/', 'x.bin', true, {}));
  });

  it('FTP-U5 onReq cancels an upload; the connection is usable again afterwards', async () => {
    const f = local('u5.bin', Buffer.alloc(30_000_000, 2));
    const c = await connect(s);
    await assert.rejects(c.upload(f, '/', 'cut.bin', true, { onReq: (h) => h.destroy() }));
    assert.ok(Array.isArray(await c.list('/')), 'the next operation reconnects');
    assert.ok(!s.has('cut.bin') || s.read('cut.bin').length < 30_000_000);
  });
});

// ---------------------------------------------------------------- streaming read
describe('FTP streaming read (openDownload)', () => {
  let s;
  const data = Buffer.from(Array.from({ length: 1000 }, (_, i) => (i * 7) % 251));
  before(async () => { s = await new MockFtp().start(); });
  after(() => s.stop());
  afterEach(() => { s.reset(); s.clear(); });

  it('FTP-P1 a range is 206 with exactly those bytes and a correct Content-Range', async () => {
    s.put('m1.mp3', data);
    const c = await connect(s);
    const r = await c.openDownload('/m1.mp3', 'bytes=100-199');
    assert.equal(r.statusCode, 206);
    assert.deepEqual(r.headers, { 'content-length': '100', 'content-range': 'bytes 100-199/1000' });
    assert.ok((await readAll(r)).equals(data.subarray(100, 200)));
  });

  it('FTP-P2 no range: 200 and the whole file; open end, suffix and single-byte ranges', async () => {
    s.put('m2.mp3', data);
    const c = await connect(s);
    const w = await c.openDownload('/m2.mp3');
    assert.equal(w.statusCode, 200);
    assert.deepEqual(w.headers, { 'content-length': '1000' });
    assert.ok((await readAll(w)).equals(data));
    const open = await c.openDownload('/m2.mp3', 'bytes=990-');
    assert.equal(open.headers['content-range'], 'bytes 990-999/1000');
    assert.ok((await readAll(open)).equals(data.subarray(990)));
    const suffix = await c.openDownload('/m2.mp3', 'bytes=-10');
    assert.equal(suffix.headers['content-range'], 'bytes 990-999/1000');
    assert.ok((await readAll(suffix)).equals(data.subarray(990)));
    const one = await c.openDownload('/m2.mp3', 'bytes=0-0');
    assert.equal(one.headers['content-length'], '1');
    assert.ok((await readAll(one)).equals(data.subarray(0, 1)));
    const big = await c.openDownload('/m2.mp3', 'bytes=-5000'); // a suffix longer than the file is the whole file
    assert.equal(big.headers['content-range'], 'bytes 0-999/1000');
    assert.equal((await readAll(big)).length, 1000);
  });

  it('FTP-P3 the end of a range beyond the file is cut to the file', async () => {
    s.put('m3.mp3', data);
    const c = await connect(s);
    const r = await c.openDownload('/m3.mp3', 'bytes=900-5000');
    assert.equal(r.statusCode, 206);
    assert.equal(r.headers['content-range'], 'bytes 900-999/1000');
    assert.equal((await readAll(r)).length, 100);
  });

  it('FTP-P4 a range that starts behind the end is 416 with "bytes */size" and no body', async () => {
    s.put('m4.mp3', data);
    const c = await connect(s);
    for (const range of ['bytes=1000-1100', 'bytes=5000-6000', 'bytes=-0']) {
      const r = await c.openDownload('/m4.mp3', range);
      assert.equal(r.statusCode, 416, range);
      assert.deepEqual(r.headers, { 'content-length': '0', 'content-range': 'bytes */1000' });
      assert.equal((await readAll(r)).length, 0);
    }
  });

  it('FTP-P5 an empty file is 200 with length 0, with or without a Range header', async () => {
    s.put('empty5.bin', '');
    const c = await connect(s);
    for (const range of [undefined, 'bytes=0-10']) {
      const r = await c.openDownload('/empty5.bin', range);
      assert.equal(r.statusCode, 200);
      assert.deepEqual(r.headers, { 'content-length': '0' });
      assert.equal((await readAll(r)).length, 0);
    }
  });

  it('FTP-P6 a missing file is an error and its own connection is closed again', async () => {
    const c = await connect(s);
    const d = s.disconnects;
    await rejects(c.openDownload('/none6.mp3'), ENOENT);
    assert.ok(await until(() => s.disconnects > d));
  });

  it('FTP-P7 it uses its OWN connection: the panel connection keeps working, and a finished range closes the extra one', async () => {
    s.put('m7.mp3', Buffer.alloc(3_000_000, 4));
    const c = await connect(s);
    const connects = s.connects;
    const r = await c.openDownload('/m7.mp3', 'bytes=0-99');
    assert.equal(s.connects, connects + 1);
    assert.equal((await readAll(r)).length, 100);
    assert.ok(await until(() => s.conns.size === 1), 'only the panel connection is left');
    assert.ok(Array.isArray(await c.list('/')));
  });

  it('FTP-P8 a player that goes away (stream destroyed) closes the extra connection', async () => {
    s.put('m8.mp3', Buffer.alloc(20_000_000, 4));
    const c = await connect(s);
    const r = await c.openDownload('/m8.mp3');
    await new Promise((res) => r.once('data', res));
    r.destroy();
    assert.ok(await until(() => s.conns.size === 1, 5000), 'the extra connection must close; open: ' + s.conns.size);
  });

  it('FTP-P9 a large range from the middle of a big file is exact', async () => {
    const big = crypto.randomBytes(2_000_000);
    s.put('big9.bin', big);
    const c = await connect(s);
    const r = await c.openDownload('/big9.bin', 'bytes=1000000-1499999');
    assert.ok((await readAll(r)).equals(big.subarray(1_000_000, 1_500_000)));
  });
});

// ---------------------------------------------------------------- queue, reconnect, keep-alive, logout
describe('FTP session behaviour', () => {
  let s;
  before(async () => { s = await new MockFtp().start(); });
  after(() => s.stop());
  afterEach(() => { s.reset(); s.clear(); Ftpfs.MIN_KEEP_S = 10; });

  it('FTP-Q1 operations started at the same time run one after another in the order they were asked', async () => {
    const c = await connect(s);
    const f = local('q1.txt', 'queued');
    const results = await Promise.all([c.mkdir('/', 'a'), c.upload(f, '/a', 'x.txt', false, {}), c.list('/a'), c.rename('/a/x.txt', 'y.txt'), c.list('/a'), c.exists('/a/y.txt')]);
    assert.deepEqual(results[2].map((x) => x.name), ['x.txt']);
    assert.deepEqual(results[4].map((x) => x.name), ['y.txt']);
    assert.equal(results[5], true);
    assert.equal(c.pending, 0);
  });

  it('FTP-Q2 ten lists, an upload and a download in parallel all succeed on ONE connection', async () => {
    s.put('d.bin', crypto.randomBytes(400_000)); s.put('a.txt', 'a');
    const c = await connect(s);
    const connects = s.connects;
    const jobs = [];
    for (let i = 0; i < 10; i++) jobs.push(c.list('/'));
    jobs.push(c.upload(local('q2.bin', crypto.randomBytes(300_000)), '/', 'u.bin', true, {}));
    jobs.push(c.download('/d.bin', local('q2d.bin')));
    const r = await Promise.all(jobs);
    assert.ok(r.slice(0, 10).every((l) => l.length >= 2));
    assert.equal(s.connects, connects);
    assert.ok(s.read('u.bin').length === 300_000);
  });

  it('FTP-Q3 a failing operation does not stop the ones behind it', async () => {
    const c = await connect(s);
    const [a, b, d] = await Promise.allSettled([c.list('/missing'), c.mkdir('/', 'ok'), c.list('/')]);
    assert.equal(a.status, 'rejected');
    assert.equal(b.status, 'fulfilled');
    assert.equal(d.status, 'fulfilled');
    assert.equal(c.pending, 0);
  });

  it('FTP-X1 a connection the server dropped is opened again by the next operation (login and commands repeated)', async () => {
    s.put('a.txt', 'a');
    const c = await connect(s, { cmds: ['TYPE A'] });
    const logins = s.logins.length;
    s.dropAll();
    assert.ok(await until(() => s.conns.size === 0));
    assert.deepEqual((await c.list('/')).map((x) => x.name), ['a.txt']);
    assert.equal(s.logins.length, logins + 1);
    assert.equal(s.commands.filter((x) => x === 'TYPE A').length, 2);
  });

  it('FTP-X2 when the reconnect fails the error is explained, and the next try works once the server is back', async () => {
    const t = await new MockFtp().start();
    const c = await connect(t);
    const port = t.port;
    t.dropAll();
    await t.server.close();
    await rejects(c.list('/'), /Connection refused|did not answer|closed|ECONN|ECONNRESET/i);
    assert.equal(c.client, null);
    fs.rmSync(t.root, { recursive: true, force: true });
    void port;
  });

  it('FTP-X3 after logout every operation is refused', async () => {
    const c = await connect(s);
    await c.logout();
    await rejects(c.list('/'), /The connection was closed/);
    await rejects(c.mkdir('/', 'x'), /The connection was closed/);
    assert.ok(await until(() => s.conns.size === 0));
  });

  it('FTP-K1 keep-alive sends NOOP now and then while idle', async () => {
    Ftpfs.MIN_KEEP_S = 0.05;
    const c = await connect(s, { keep: 0.05 });
    assert.ok(c.timer);
    assert.ok(await until(() => s.commands.filter((x) => x === 'NOOP').length >= 3, 3000), 'NOOPs: ' + s.commands.filter((x) => x === 'NOOP').length);
  });

  it('FTP-K2 no keep-alive when the interval is empty, 0 or not a number; and none after logout', async () => {
    for (const keep of [undefined, 0, '', 'abc', -5]) {
      const c = await connect(s, { keep });
      assert.equal(c.timer, null, String(keep));
    }
    Ftpfs.MIN_KEEP_S = 0.05;
    const c = await connect(s, { keep: 0.05 });
    await sleep(200);
    await c.logout();
    const n = s.commands.filter((x) => x === 'NOOP').length;
    await sleep(300);
    assert.equal(s.commands.filter((x) => x === 'NOOP').length, n);
  });

  it('FTP-K3 the interval has a lower limit (MIN_KEEP_S): 0.01 s asks for MIN_KEEP_S, not for 10 ms', async () => {
    Ftpfs.MIN_KEEP_S = 0.25;
    await connect(s, { keep: 0.01 });
    await sleep(600);
    const n = s.commands.filter((x) => x === 'NOOP').length;
    assert.ok(n >= 1 && n <= 4, 'NOOPs: ' + n);
  });

  it('FTP-K4 no NOOP while another operation is queued, and none on a connection the server closed (no silent reconnect)', async () => {
    Ftpfs.MIN_KEEP_S = 0.05;
    const c = await connect(s, { keep: 0.05 });
    c.pending = 1; // busy
    await sleep(300);
    assert.equal(s.commands.filter((x) => x === 'NOOP').length, 0);
    c.pending = 0;
    await until(() => s.commands.includes('NOOP'));
    s.dropAll();
    await until(() => s.conns.size === 0);
    const logins = s.logins.length;
    await sleep(300);
    assert.equal(s.logins.length, logins);
  });
});

// ---------------------------------------------------------------- second round: found by the mutation tests
describe('FTP details (second round)', () => {
  let s;
  before(async () => { s = await new MockFtp().start(); });
  after(() => s.stop());
  afterEach(() => { s.reset(); s.clear(); });

  it('FTP-L8 ordinary files and folders are not entered with CWD; only links are', async () => {
    s.put('f.txt', 'x'); s.mkdir('d');
    const c = await connect(s);
    await c.list('/');
    assert.equal(s.commands.filter((x) => /^CWD /.test(x)).length, 0);
  });

  it('FTP-P10 a file of ONE byte still has ranges: bytes=0-0 is 206 with "bytes 0-0/1"', async () => {
    s.put('one.bin', 'Z');
    const c = await connect(s);
    const r = await c.openDownload('/one.bin', 'bytes=0-0');
    assert.equal(r.statusCode, 206);
    assert.deepEqual(r.headers, { 'content-length': '1', 'content-range': 'bytes 0-0/1' });
    assert.equal((await readAll(r)).toString(), 'Z');
    const whole = await c.openDownload('/one.bin');
    assert.equal(whole.statusCode, 200);
    assert.equal((await readAll(whole)).toString(), 'Z');
  });

  it('FTP-P11 when SIZE does not work (an empty file on this server) the size comes from the listing of the SAME file, not from another one', async () => {
    s.put('sizes/a-full.bin', 'seven!!');
    s.put('sizes/z-empty.bin', '');
    s.mkdir('sizes/m-folder');
    const c = await connect(s);
    const r = await c.openDownload('/sizes/z-empty.bin');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.headers, { 'content-length': '0' });
    assert.equal((await readAll(r)).length, 0);
    await rejects(c.openDownload('/sizes/m-folder'), /.+/); // a folder is not a file
    await rejects(c.openDownload('/sizes/missing.bin'), ENOENT);
  });

  it('FTP-P12 a range whose last byte is before its first is invalid and ignored: the whole file, 200', async () => {
    s.put('r.bin', Buffer.from('0123456789'));
    const c = await connect(s);
    const r = await c.openDownload('/r.bin', 'bytes=7-3');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.headers, { 'content-length': '10' });
    assert.equal((await readAll(r)).toString(), '0123456789');
    const ok = await c.openDownload('/r.bin', 'bytes=3-3'); // the same first and last byte is a valid range
    assert.equal(ok.statusCode, 206);
    assert.equal((await readAll(ok)).toString(), '3');
  });

  it('FTP-P13 open ended ranges: bytes=4- is the rest, and a range is read from the right place', async () => {
    s.put('o.bin', Buffer.from('abcdefghij'));
    const c = await connect(s);
    const r = await c.openDownload('/o.bin', 'bytes=4-');
    assert.equal(r.statusCode, 206);
    assert.equal(r.headers['content-range'], 'bytes 4-9/10');
    assert.equal((await readAll(r)).toString(), 'efghij');
    const mid = await c.openDownload('/o.bin', 'bytes=2-5');
    assert.equal((await readAll(mid)).toString(), 'cdef');
  });
});
