'use strict';
// FTP client (src/main/ftpclient.js), the parts that need no server: the contract with basic-ftp (what is asked of it), the error texts,
// the range limiter, the queue and the keep-alive timer, the date table. The library is replaced by a recording stand-in.
// (tests/TEST_METHODS.md, FTPU-*)
const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const ftp = require('basic-ftp');
const { Ftpfs, explain, limitStream, parseRawDate } = require('../src/main/ftpclient');

const rejects = (p, re) => assert.rejects(p, (e) => { assert.match(e.message, re); return true; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** a stand-in for basic-ftp's Client: records every call */
function fakeClient(over = {}) {
  const calls = [];
  const c = {
    closed: false,
    calls,
    close() { calls.push(['close']); this.closed = true; },
    async pwd() { calls.push(['pwd']); return over.pwd === undefined ? '/home' : over.pwd; },
    async cd(p) { calls.push(['cd', p]); if (over.cdFails && over.cdFails.includes(p)) throw new Error('550 not a directory'); },
    async list(p) { calls.push(['list', p]); return over.entries || []; },
    async ensureDir(p) { calls.push(['ensureDir', p]); if (over.ensureFails) throw new Error('550 denied'); },
    async send(x) { calls.push(['send', x]); },
    ...over.methods,
  };
  return c;
}

describe('FTP contract with basic-ftp', () => {
  let seen; let sends; let closes; let pwdAnswer;
  beforeEach(() => {
    seen = []; sends = []; closes = 0; pwdAnswer = '/';
    mock.method(ftp.Client.prototype, 'access', async function (o) { seen.push({ o, timeout: this.ftp.timeout, verbose: this.ftp.verbose }); });
    mock.method(ftp.Client.prototype, 'pwd', async () => pwdAnswer);
    mock.method(ftp.Client.prototype, 'send', async (x) => { sends.push(x); });
    mock.method(ftp.Client.prototype, 'close', () => { closes++; });
  });
  afterEach(() => mock.restoreAll());
  const connect = (o = {}) => { const c = new Ftpfs(); return c.connect({ host: 'ftp.example.com', ...o }).then((r) => [c, r]); };

  it('FTPU-A1 plain FTP: port 21, no TLS, the login as given', async () => {
    await connect({ user: 'bob', pass: 'pw', security: 'none' });
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0].o, { host: 'ftp.example.com', port: 21, user: 'bob', password: 'pw', secure: false, secureOptions: undefined });
  });

  it('FTPU-A2 explicit TLS (also the default for any other value): secure = true, port 21, the certificate is checked for this host name', async () => {
    await connect({ user: 'u', pass: 'p', security: 'explicit' });
    await connect({ user: 'u', pass: 'p' });
    await connect({ user: 'u', pass: 'p', security: 'something' });
    for (const s of seen) {
      assert.equal(s.o.secure, true);
      assert.equal(s.o.port, 21);
      assert.deepEqual(s.o.secureOptions, { rejectUnauthorized: true, servername: 'ftp.example.com' });
    }
  });

  it('FTPU-A3 implicit TLS: secure = "implicit", port 990', async () => {
    await connect({ user: 'u', pass: 'p', security: 'implicit' });
    assert.equal(seen[0].o.secure, 'implicit');
    assert.equal(seen[0].o.port, 990);
  });

  it('FTPU-A4 "allow an untrusted certificate" switches the check off, only for TLS', async () => {
    await connect({ security: 'explicit', insecure: true });
    assert.equal(seen[0].o.secureOptions.rejectUnauthorized, false);
    await connect({ security: 'implicit', insecure: true });
    assert.equal(seen[1].o.secureOptions.rejectUnauthorized, false);
    await connect({ security: 'none', insecure: true });
    assert.equal(seen[2].o.secureOptions, undefined);
  });

  it('FTPU-A5 a given port (number or text) wins; 0 / empty / text fall back to the default of the mode', async () => {
    for (const [port, security, want] of [[2121, 'none', 2121], ['2121', 'none', 2121], [0, 'none', 21], ['', 'implicit', 990], ['x', 'explicit', 21], [undefined, 'implicit', 990], [65535, 'implicit', 65535]]) {
      seen.length = 0;
      await connect({ port, security });
      assert.equal(seen[0].o.port, want, `${port} ${security}`);
    }
  });

  it('FTPU-A6 no user = anonymous with "anonymous@"; a user without a password has an empty one; a password is kept', async () => {
    await connect({ security: 'none' });
    assert.deepEqual([seen[0].o.user, seen[0].o.password], ['anonymous', 'anonymous@']);
    await connect({ user: 'bob', security: 'none' });
    assert.deepEqual([seen[1].o.user, seen[1].o.password], ['bob', '']);
    await connect({ pass: 'x@y', security: 'none' });
    assert.deepEqual([seen[2].o.user, seen[2].o.password], ['anonymous', 'x@y']);
  });

  it('FTPU-A7 the timeout of the connection: a positive number (or text of one); everything else is 30 s', async () => {
    for (const [given, want] of [[undefined, 30000], [0, 30000], [-1, 30000], ['abc', 30000], ['', 30000], [250, 250], ['250', 250], [0.5, 0.5], [120000, 120000]]) {
      seen.length = 0;
      await connect({ security: 'none', timeout: given });
      assert.equal(seen[0].timeout, want, String(given));
    }
  });

  it('FTPU-A8 the library is not verbose (it would print the commands, and the login, to the console)', async () => {
    const log = mock.method(console, 'log', () => {});
    try { await connect({ security: 'none', user: 'u', pass: 'secret' }); } finally { log.mock.restore(); }
    assert.equal(seen[0].verbose, false);
    assert.equal(log.mock.callCount(), 0);
  });

  it('FTPU-A9 home: the answer of PWD with / instead of \\ ; empty means /', async () => {
    for (const [pwd, want] of [['/home/user', '/home/user'], ['\\home\\user', '/home/user'], ['', '/'], [undefined, '/'], ['C:\\a\\b', 'C:/a/b']]) {
      pwdAnswer = pwd;
      const [c, r] = await connect({ security: 'none' });
      assert.deepEqual(r, { home: want });
      assert.equal(c.home, want);
    }
  });

  it('FTPU-A10 commands after the login are sent in order; the endpoint and the address of the connection', async () => {
    const [c] = await connect({ user: 'bob', pass: 'x', security: 'none', port: 2121, cmds: ['TYPE A', 'SITE X'] });
    assert.deepEqual(sends, ['TYPE A', 'SITE X']);
    assert.equal(c.endpoint, 'ftp.example.com:2121');
    assert.equal(c.base, 'ftp://bob@ftp.example.com:2121');
    const [d] = await connect({ security: 'implicit' });
    assert.equal(d.endpoint, 'ftp.example.com');
    assert.equal(d.base, 'ftps://anonymous@ftp.example.com');
    const [e] = await connect({ security: 'explicit', user: 'u' });
    assert.equal(e.base, 'ftps://u@ftp.example.com');
  });

  it('FTPU-A11 a refused command closes the connection and names the command', async () => {
    mock.method(ftp.Client.prototype, 'send', async (x) => { if (x === 'BAD') throw new Error('502 no'); });
    closes = 0;
    await rejects(connect({ security: 'none', cmds: ['OK', 'BAD', 'NEVER'] }), /The command "BAD" was refused: 502 no/);
    assert.ok(closes >= 1);
  });

  it('FTPU-A12 a failed login closes the client; the explicit TLS handshake against a server without TLS has its own message', async () => {
    for (const code of ['500 Syntax', '501 Bad', '502 Command not supported', '503 x', '504 y']) {
      mock.method(ftp.Client.prototype, 'access', async () => { throw new Error(code); });
      closes = 0;
      await rejects(connect({ security: 'explicit' }), /does not support FTP over TLS.*Plain FTP/s);
      assert.ok(closes >= 1, code);
    }
    for (const [security, code] of [['none', '502 Command not supported'], ['implicit', '502 Command not supported'], ['explicit', '505 Version'], ['explicit', '530 Login incorrect']]) {
      mock.method(ftp.Client.prototype, 'access', async () => { throw new Error(code); });
      await assert.rejects(connect({ security }), (e) => { assert.ok(!/does not support FTP over TLS/.test(e.message), `${security} ${code}: ${e.message}`); return true; });
    }
  });

  it('FTPU-A13 keep-alive: the interval is the number of seconds, not shorter than MIN_KEEP_S; nothing for 0 / empty / text / negative', async () => {
    const delays = [];
    mock.method(globalThis, 'setInterval', (fn, ms) => { delays.push(ms); return { fake: true }; });
    mock.method(globalThis, 'clearInterval', () => {});
    try {
      for (const [keep, want] of [[12, 12000], [3, 10000], ['45', 45000], [10, 10000], [10.5, 10500], [3600, 3600000]]) {
        delays.length = 0;
        const [c] = await connect({ security: 'none', keep });
        assert.deepEqual(delays, [want], String(keep));
        assert.deepEqual(c.timer, { fake: true });
      }
      for (const keep of [0, '', 'abc', -3, undefined, null]) {
        delays.length = 0;
        const [c] = await connect({ security: 'none', keep });
        assert.deepEqual(delays, [], String(keep));
        assert.equal(c.timer, null);
      }
      Ftpfs.MIN_KEEP_S = 0.5;
      delays.length = 0;
      await connect({ security: 'none', keep: 0.2 });
      assert.deepEqual(delays, [500]);
      Ftpfs.MIN_KEEP_S = 10;
      assert.equal(Ftpfs.MIN_KEEP_S, 10);
    } finally { Ftpfs.MIN_KEEP_S = 10; mock.restoreAll(); }
  });
});

describe('FTP queue and connection handling', () => {
  const make = (client = fakeClient()) => { const c = new Ftpfs(); c.client = client; c.opts = { host: 'h' }; return c; };

  it('FTPU-Q1 a result is returned; pending counts the waiting jobs and is back to 0 afterwards, also after a failure', async () => {
    const c = make();
    const p1 = c._run(async () => 'one');
    const p2 = c._run(async () => { throw new Error('x'); });
    assert.equal(c.pending, 2);
    assert.equal(await p1, 'one');
    await assert.rejects(p2);
    await c._run(async () => 1);
    assert.equal(c.pending, 0);
  });

  it('FTPU-Q2 jobs run one at a time in the order they were asked', async () => {
    const c = make(); const log = [];
    await Promise.all([1, 2, 3].map((i) => c._run(async () => { log.push('start' + i); await sleep(15 - i * 4); log.push('end' + i); })));
    assert.deepEqual(log, ['start1', 'end1', 'start2', 'end2', 'start3', 'end3']);
  });

  it('FTPU-Q3 the job gets the client; a failed error is explained (the 550 code is removed) and the healthy client stays', async () => {
    const fake = fakeClient();
    const c = make(fake);
    await c._run(async (cl) => { assert.equal(cl, fake); });
    await rejects(c._run(async () => { throw new Error('550 gone away'); }), /^gone away$/);
    assert.equal(c.client, fake);
  });

  it('FTPU-Q4 an error that leaves the client closed drops it, so that the next job connects again', async () => {
    const fake = fakeClient();
    const c = make(fake);
    await assert.rejects(c._run(async (cl) => { cl.closed = true; throw new Error('boom'); }));
    assert.equal(c.client, null);
    assert.equal(c.pending, 0);
  });

  it('FTPU-Q5 a missing or closed client is opened again before the job; when that fails the error is explained and nothing is kept', async () => {
    const fresh = fakeClient();
    const c = make(null);
    let opened = 0;
    c._open = async () => { opened++; return fresh; };
    await c._run(async (cl) => assert.equal(cl, fresh));
    assert.equal(opened, 1);
    fresh.closed = true;
    const fresh2 = fakeClient();
    c._open = async () => { opened++; return fresh2; };
    await c._run(async (cl) => assert.equal(cl, fresh2));
    assert.equal(opened, 2);
    c.client = fakeClient(); c.client.closed = true;
    c._open = async () => { throw new Error('connect ECONNREFUSED 1.2.3.4:21'); };
    await rejects(c._run(async () => 1), /Connection refused/);
    assert.equal(c.client, null);
  });

  it('FTPU-Q6 after logout nothing runs: "The connection was closed."; the timer stops and the client is closed', async () => {
    const fake = fakeClient();
    const c = make(fake);
    const cleared = [];
    mock.method(globalThis, 'clearInterval', (t) => cleared.push(t));
    try {
      c.timer = { t: 1 };
      await c.logout();
    } finally { mock.restoreAll(); }
    assert.deepEqual(cleared, [{ t: 1 }]);
    assert.ok(fake.calls.some((x) => x[0] === 'close'));
    assert.equal(c.client, null);
    let ran = false;
    await rejects(c._run(async () => { ran = true; }), /The connection was closed/);
    assert.equal(ran, false);
  });

  it('FTPU-Q7 _drop with no client, or a client whose close() throws, is quiet', () => {
    const c = make(null);
    c._drop();
    c.client = { close() { throw new Error('x'); } };
    c._drop();
    assert.equal(c.client, null);
  });

  it('FTPU-K1 keep-alive sends NOOP only when idle, connected and not closed by us', async () => {
    const sent = [];
    const c = make();
    c._run = (fn) => { sent.push(1); return Promise.resolve(); };
    c._keepAlive(); assert.equal(sent.length, 1);
    c.pending = 1; c._keepAlive(); assert.equal(sent.length, 1);
    c.pending = 0; c.closedByUs = true; c._keepAlive(); assert.equal(sent.length, 1);
    c.closedByUs = false; c.client = null; c._keepAlive(); assert.equal(sent.length, 1);
    c.client = fakeClient(); c.client.closed = true; c._keepAlive(); assert.equal(sent.length, 1);
    c.client = fakeClient(); c._keepAlive(); assert.equal(sent.length, 2);
  });

  it('FTPU-K2 the NOOP job sends NOOP and its failure is swallowed', async () => {
    const fake = fakeClient();
    const c = make(fake);
    c._keepAlive();
    await sleep(10);
    assert.deepEqual(fake.calls.filter((x) => x[0] === 'send'), [['send', 'NOOP']]);
    fake.send = async () => { throw new Error('gone'); };
    c._keepAlive();
    await sleep(10); // no unhandled rejection
  });
});

describe('FTP listing helpers', () => {
  const entry = (name, o = {}) => ({ name, isDirectory: false, isSymbolicLink: false, size: 7, rawModifiedAt: 'Nov  7 22:41', ...o });
  const c = new Ftpfs();

  it('FTPU-L1 "." and ".." are dropped; the others are kept with size, folder flag and date', async () => {
    const fake = fakeClient({ entries: [entry('.', { isDirectory: true }), entry('..', { isDirectory: true }), entry('a.txt'), entry('d', { isDirectory: true, size: 4096 }), entry('...'), entry('.hidden')] });
    const l = await c._list(fake, '/x');
    assert.deepEqual(l.map((e) => e.name), ['a.txt', 'd', '...', '.hidden']);
    assert.equal(l[0].size, 7);
    assert.equal(l[1].size, -1);
    assert.equal(l[1].isDir, true);
    assert.equal(l[0].isDir, false);
    assert.ok(l[0].mtime > 0);
    assert.deepEqual(fake.calls.filter((x) => x[0] === 'cd'), []); // no entering of ordinary entries
  });

  it('FTPU-L2 the date of MLSD (a Date) wins over the raw text; no size means 0', async () => {
    const d = new Date(Date.UTC(2020, 1, 2, 3, 4, 5));
    const l = await c._list(fakeClient({ entries: [entry('m', { modifiedAt: d, rawModifiedAt: 'Nov  7 22:41' }), entry('z', { size: undefined, rawModifiedAt: '' })] }), '/');
    assert.equal(l[0].mtime, d.getTime());
    assert.equal(l[1].size, 0);
    assert.equal(l[1].mtime, 0);
  });

  it('FTPU-L3 a link is a folder when CWD into it works, a file when not; the working folder is restored either way (and a failed restore is quiet)', async () => {
    const fake = fakeClient({ entries: [entry('goodlink', { isSymbolicLink: true }), entry('badlink', { isSymbolicLink: true, size: 5 })], cdFails: ['/p/badlink', '/p'] });
    const l = await c._list(fake, '/p');
    assert.deepEqual(l.map((e) => [e.name, e.isDir, e.size]), [['goodlink', true, -1], ['badlink', false, 5]]);
    assert.deepEqual(fake.calls.filter((x) => x[0] === 'cd'), [['cd', '/p/goodlink'], ['cd', '/p'], ['cd', '/p/badlink'], ['cd', '/p']]);
  });

  it('FTPU-L4 _exists: true when the name is in the folder; false for a missing name and when the listing fails', async () => {
    const ok = fakeClient({ entries: [entry('there.txt')] });
    assert.equal(await c._exists(ok, '/d/there.txt'), true);
    assert.equal(await c._exists(ok, '/d/other.txt'), false);
    assert.deepEqual(ok.calls[0], ['list', '/d']);
    const broken = fakeClient({ methods: { list: async () => { throw new Error('x'); } } });
    assert.strictEqual(await c._exists(broken, '/d/a'), false);
  });

  it('FTPU-L5 _mkdirp: nothing for "", "/" and undefined; otherwise PWD, ensureDir, and back to where it was, even when ensureDir fails', async () => {
    for (const dir of ['', '/', undefined, null]) { const f = fakeClient(); await c._mkdirp(f, dir); assert.deepEqual(f.calls, [], String(dir)); }
    const f = fakeClient({ pwd: '/start' });
    await c._mkdirp(f, '/a/b');
    assert.deepEqual(f.calls, [['pwd'], ['ensureDir', '/a/b'], ['cd', '/start']]);
    const g = fakeClient({ pwd: '/start', ensureFails: true, cdFails: ['/start'] });
    await rejects(c._mkdirp(g, '/a/b'), /denied/);
    assert.deepEqual(g.calls.map((x) => x[0]), ['pwd', 'ensureDir', 'cd']);
  });
});

describe('FTP transfers (progress, ranges)', () => {
  it('FTPU-T1 _transfer reports the NEW bytes of every progress report (not the running total), never 0, and hands out a handle', async () => {
    const c = new Ftpfs();
    const got = []; let handler; let progressOff = 0;
    const fake = { trackProgress(h) { if (h) handler = h; else progressOff++; }, close() { fake.closed = true; } };
    let handle;
    await c._transfer(fake, (n) => got.push(n), (h) => { handle = h; }, async () => { handler({ bytes: 100 }); handler({ bytes: 100 }); handler({ bytes: 250 }); handler({ bytes: 250 }); handler({ bytes: 400 }); });
    assert.deepEqual(got, [100, 150, 150]);
    assert.equal(progressOff, 1, 'the progress tracking is switched off afterwards');
    handle.destroy();
    assert.equal(fake.closed, true);
    fake.close = () => { throw new Error('gone'); };
    handle.destroy(); // quiet
  });

  it('FTPU-T2 _transfer without callbacks works; a failing transfer still switches the tracking off and rejects', async () => {
    const c = new Ftpfs();
    let off = 0;
    const fake = { trackProgress(h) { if (!h) off++; } };
    await c._transfer(fake, undefined, undefined, async () => 'x');
    await assert.rejects(c._transfer(fake, undefined, undefined, async () => { throw new Error('bad'); }), /bad/);
    assert.equal(off, 2);
  });

  const feed = (stream, chunks) => new Promise((resolve) => {
    const out = [];
    stream.on('data', (d) => out.push(Buffer.from(d)));
    stream.on('end', () => resolve(Buffer.concat(out)));
    let i = 0;
    const next = () => { if (i < chunks.length) stream.write(Buffer.from(chunks[i++]), next); else stream.end(); };
    next();
  });

  it('FTPU-R1 limitStream passes exactly `length` bytes over chunk borders, drops the rest, and calls onDone once at the last wanted byte', async () => {
    let done = 0; let doneAt = -1; let passed = 0;
    const s = limitStream(12, () => { done++; doneAt = passed; });
    s.on('data', (d) => { passed += d.length; });
    const result = await feed(s, [Buffer.alloc(5, 1), Buffer.alloc(10, 2), Buffer.alloc(20, 3), Buffer.alloc(4, 4)]);
    assert.equal(result.length, 12);
    assert.deepEqual([...result], [...Buffer.alloc(5, 1), ...Buffer.alloc(7, 2)]);
    assert.equal(done, 1);
    assert.equal(doneAt, 12);
  });

  it('FTPU-R2 onDone comes exactly when the last byte has passed (not one byte early, not on the next chunk); an exact chunk fits; the stream does not stall after the end', async () => {
    const events = [];
    const s = limitStream(10, () => events.push('done'));
    s.on('data', (d) => events.push(d.length));
    await new Promise((r) => s.write(Buffer.alloc(9), r));
    assert.deepEqual(events, [9]);
    await new Promise((r) => s.write(Buffer.alloc(1), r));
    assert.deepEqual(events, [9, 1, 'done']);
    const written = await new Promise((r) => { let cbs = 0; s.write(Buffer.alloc(100), () => { cbs++; r(cbs); }); });
    assert.equal(written, 1, 'a chunk after the end is accepted (and dropped), so that nobody waits for it');
    assert.deepEqual(events, [9, 1, 'done']);
    const exact = limitStream(8, () => events.push('done2'));
    exact.on('data', () => {});
    await new Promise((r) => exact.write(Buffer.alloc(8), r));
    assert.ok(events.includes('done2'));
  });

  it('FTPU-R3 limitStream(0) passes nothing', async () => {
    const s = limitStream(0, () => {});
    assert.equal((await feed(s, [Buffer.alloc(3)])).length, 0);
  });
});

describe('FTP error texts (explain)', () => {
  const e = (m) => explain(new Error(m)).message;
  const cases = [
    ['getaddrinfo ENOTFOUND nohost', /^Host not found: getaddrinfo ENOTFOUND nohost$/],
    ['getaddrinfo EAI_AGAIN x', /^Host not found: /],
    ['connect ECONNREFUSED 127.0.0.1:21', /^Connection refused \(is the FTP server running and the port right\?\)$/],
    ['connect ETIMEDOUT', /^The server did not answer in time\.$/],
    ['Timeout (control socket)', /^The server did not answer in time\.$/],
    ['530 Login incorrect', /^Login failed: wrong user name or password\.$/],
    ['530', /^Login failed/],
    ['532 need account', /^Login failed/],
    ['539 x', /^Login failed/],
    ['501 Must provide password', /^Login failed/],
    ['Login incorrect', /^Login failed/],
    ['Login authentication failed', /^Login failed/],
    ['User cannot log in', /^Login failed/],
    ['self-signed certificate', /^The server certificate is not trusted\. Tick "Allow an untrusted certificate" if you trust this server\.$/],
    ['self signed certificate in certificate chain', /not trusted/],
    ['unable to verify the first certificate', /not trusted/],
    ['CERT_HAS_EXPIRED', /not trusted/],
    ['Hostname/IP does not match certificate\'s altnames', /not trusted/],
    ['error:0A00010B:SSL routines::wrong version number', /^The server does not speak TLS on this port: try "Plain FTP" or "FTP over TLS \(explicit\)" with port 21 \(implicit TLS is port 990\)\.$/],
    ['write EPROTO', /does not speak TLS/],
    ['550 Permission denied', /^Permission denied$/],
    ['550 No such file or directory.', /^No such file or directory\.$/],
    ['550', /^The server refused: no such file or no permission\.$/],
    ['550   ', /^The server refused: no such file or no permission\.$/],
    ['451 Local error', /^451 Local error$/],
    ['something else entirely', /^something else entirely$/],
  ];
  for (const [msg, re] of cases) it(`FTPU-E1 "${msg}"`, () => assert.match(e(msg), re));

  it('FTPU-E2 other kinds of input: a string, nothing, an object with a message, a message that is empty; an unknown Error comes back as the same object', () => {
    assert.equal(explain('ECONNREFUSED x').message.slice(0, 18), 'Connection refused');
    assert.equal(explain(undefined).message, 'undefined');
    assert.equal(explain(null).message, 'null');
    assert.equal(explain({ message: 'ETIMEDOUT' }).message, 'The server did not answer in time.');
    assert.equal(explain({ message: '' }).message, '[object Object]');
    const own = new Error('whatever');
    assert.equal(explain(own), own);
    assert.ok(explain('plain text') instanceof Error);
    assert.equal(explain('plain text').message, 'plain text');
  });

  it('FTPU-E3 the 550 rule wants 550 at the start of the text: a 550 inside stays, the first rule that fits wins', () => {
    assert.equal(e('error 550 denied'), 'error 550 denied');
    assert.match(e('550 certificate problem'), /not trusted/);
    assert.match(e('530 timeout'), /did not answer/);
  });
});

describe('FTP date table', () => {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  it('FTPU-D1 every month name maps to its month (lower and upper case)', () => {
    MON.forEach((m, i) => {
      assert.equal(parseRawDate(`${m} 10  2020`), Date.UTC(2020, i, 10), m);
      assert.equal(parseRawDate(`${m.toUpperCase()} 10  2020`), Date.UTC(2020, i, 10));
      assert.equal(parseRawDate(`${m.toLowerCase()} 10 2020`), Date.UTC(2020, i, 10));
    });
  });

  it('FTPU-D2 the "one day in the future" rule is exact to the millisecond', () => {
    const noon = Date.UTC(2026, 10, 8, 23, 0); // the date "Nov 8 23:00" of the current year
    assert.equal(parseRawDate('Nov  8 23:00', noon - 86400000), noon); // exactly one day ahead: this year
    assert.equal(parseRawDate('Nov  8 23:00', noon - 86400001), Date.UTC(2025, 10, 8, 23, 0)); // one millisecond more: last year
    assert.equal(parseRawDate('Nov  8 23:00', noon - 86399999), noon);
  });

  it('FTPU-D3 a day and a time are numbers: 1 and 31, 00:00 and 23:59, single digit hour', () => {
    const now = Date.UTC(2026, 11, 31, 23, 59);
    assert.equal(parseRawDate('Jan  1 00:00', now), Date.UTC(2026, 0, 1, 0, 0));
    assert.equal(parseRawDate('Dec 31 23:59', now), Date.UTC(2026, 11, 31, 23, 59));
    assert.equal(parseRawDate('Mar  5 7:05', now), Date.UTC(2026, 2, 5, 7, 5));
  });
});
