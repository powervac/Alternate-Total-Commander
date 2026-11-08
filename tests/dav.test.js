'use strict';
// WebDAV client (src/main/davclient.js) against the in-memory server of tests/helpers/davserver.js.
// Method: black box through the public interface (connect, list, exists, mkdir/mkdirp, rename, remove, download, upload, openDownload,
// logout); every expectation is checked twice, in the result and in what the server really received (tests/TEST_METHODS.md, DAV-*).
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const http = require('http');
const { Davfs } = require('../src/main/davclient');
const { MockDav } = require('./helpers/davserver');
const { makeCert } = require('./helpers/cert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdr-dav-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const local = (name, data) => { const f = path.join(tmp, name); if (data !== undefined) fs.writeFileSync(f, data); return f; };
const readAll = (s) => new Promise((res, rej) => { const a = []; s.on('data', (c) => a.push(c)); s.on('end', () => res(Buffer.concat(a))); s.on('error', rej); });
const rejects = (p, re) => assert.rejects(p, (e) => { assert.match(e.message, re); return true; });
const sorted = (l) => [...l].sort((a, b) => a.name.localeCompare(b.name));

async function connect(server, o = {}) {
  const c = new Davfs();
  await c.connect({ url: server.url, user: 'test', pass: 'secret', ...o });
  return c;
}

describe('DAV connect', () => {
  let s;
  before(async () => { s = await new MockDav({ base: '/remote.php/dav/files/me' }).start(); });
  after(() => s.stop());
  beforeEach(() => s.reset());

  it('DAV-C1 connects, verifies the folder with PROPFIND Depth 0 and reports home "/"', async () => {
    const c = new Davfs();
    const r = await c.connect({ url: s.url, user: 'test', pass: 'secret' });
    assert.deepEqual(r, { home: '/' });
    assert.equal(c.type, 'webdav');
    assert.equal(c.endpoint, `127.0.0.1:${s.port}`);
    assert.equal(c.base, `http://127.0.0.1:${s.port}/remote.php/dav/files/me`);
    assert.equal(s.log.length, 1);
    assert.equal(s.log[0].method, 'PROPFIND');
    assert.equal(s.log[0].headers.depth, '0');
    assert.match(s.log[0].headers['content-type'], /xml/);
    assert.match(s.log[0].body.toString(), /propfind/);
  });

  it('DAV-C2 the base path of the address is the root of the panel (no trailing slash needed)', async () => {
    s.mkdir('/docs').put('/docs/a.txt', 'A');
    const c = await connect(s, { url: s.url.replace(/\/$/, '') });
    assert.deepEqual((await c.list('/docs')).map((x) => x.name), ['a.txt']);
    assert.equal(s.log.at(-1).url, '/remote.php/dav/files/me/docs/');
  });

  it('DAV-C3 an address without a scheme is tried as https; a plain http server then explains itself', async () => {
    await rejects(new Davfs().connect({ url: `127.0.0.1:${s.port}/remote.php/dav/files/me/`, user: 'test', pass: 'secret' }), /does not speak HTTPS.*http:\/\//);
  });

  it('DAV-C4 an invalid address is refused before any request', async () => {
    await rejects(new Davfs().connect({ url: 'https://::::' }), /address is not valid/);
    await rejects(new Davfs().connect({ url: '' }), /address is not valid/);
    assert.equal(s.log.length, 0);
  });

  it('DAV-C5 maps the answer of the server at connect time', async () => {
    const cases = [[401, /Login failed/], [404, /not found on the server \(404\)/], [405, /does not speak WebDAV/], [501, /does not speak WebDAV/], [403, /answered 403/], [500, /answered 500/]];
    for (const [code, re] of cases) {
      s.reset(); s.on('PROPFIND', code, 5);
      await rejects(new Davfs().connect({ url: s.url, user: 'test', pass: 'secret' }), re);
    }
  });

  it('DAV-C6 "connection refused" and "host not found" are explained', async () => {
    const srv = net.createServer().listen(0, '127.0.0.1');
    await new Promise((r) => srv.on('listening', r));
    const port = srv.address().port;
    await new Promise((r) => srv.close(r));
    await rejects(new Davfs().connect({ url: `http://127.0.0.1:${port}/` }), /Connection refused/);
    await rejects(new Davfs().connect({ url: 'http://no-such-host.invalid/', timeout: 8000 }), /Host not found/);
  });

  it('DAV-C7 a server that never answers gives "did not answer in time" after the timeout', async () => {
    s.on('PROPFIND', () => true); // swallows the request
    const t = Date.now();
    await rejects(new Davfs().connect({ url: s.url, timeout: 300 }), /did not answer in time/);
    assert.ok(Date.now() - t < 3000);
  });

  it('DAV-C8 the user may be empty (public WebDAV): no Authorization header is sent', async () => {
    const c = new Davfs();
    await c.connect({ url: s.url });
    await c.list('/');
    assert.ok(s.log.every((q) => q.headers.authorization === undefined));
  });
});

describe('DAV HTTPS', () => {
  const tls = makeCert();
  let s;
  before(async () => { if (tls) s = await new MockDav({ tls }).start(); });
  after(async () => { if (s) await s.stop(); });

  it('DAV-S1 an untrusted certificate is refused with an explanation', { skip: !tls }, async () => {
    await rejects(new Davfs().connect({ url: s.url }), /certificate is not trusted/);
  });
  it('DAV-S2 "Allow an untrusted certificate" lets it through and the panel works', { skip: !tls }, async () => {
    s.put('/x.txt', 'xx');
    const c = new Davfs();
    await c.connect({ url: s.url, insecure: true });
    assert.deepEqual((await c.list('/')).map((e) => e.name), ['x.txt']);
  });
});

describe('DAV login', () => {
  it('DAV-A1 Basic: the login is sent with the very first request', async () => {
    const s = await new MockDav({ auth: 'basic' }).start();
    try {
      const c = await connect(s);
      await c.list('/');
      assert.equal(s.log[0].headers.authorization, 'Basic ' + Buffer.from('test:secret').toString('base64'));
      assert.ok(s.log.every((q) => q.headers.authorization));
    } finally { await s.stop(); }
  });

  it('DAV-A2 a wrong password gives "Login failed" and does not loop forever', async () => {
    for (const auth of ['basic', 'digest']) {
      const s = await new MockDav({ auth }).start();
      try {
        await rejects(new Davfs().connect({ url: s.url, user: 'test', pass: 'WRONG' }), /Login failed/);
        assert.ok(s.log.length <= 4, `${auth}: ${s.log.length} requests`);
      } finally { await s.stop(); }
    }
  });

  it('DAV-A3 Digest (qop=auth): answers the challenge, all later requests are authorised without a second challenge', async () => {
    const s = await new MockDav({ auth: 'digest' }).start();
    try {
      const c = await connect(s);
      s.mkdir('/d');
      await c.list('/'); await c.list('/d'); await c.exists('/d');
      assert.ok(s.digestOk >= 4);
      assert.equal(s.digestBad, 0);
      assert.equal(s.log.filter((q) => q.headers.authorization && /^Digest/.test(q.headers.authorization)).length, s.digestOk);
    } finally { await s.stop(); }
  });

  it('DAV-A4 Digest: the nonce counter nc is hexadecimal, 8 digits and grows with every request', async () => {
    const s = await new MockDav({ auth: 'digest' }).start();
    try {
      const c = await connect(s);
      for (let i = 0; i < 20; i++) await c.exists('/');
      const ncs = s.log.map((q) => /nc=([0-9a-f]+)/.exec(q.headers.authorization || '')).filter(Boolean).map((m) => m[1]);
      assert.ok(ncs.length >= 20);
      assert.ok(ncs.every((x) => x.length === 8));
      assert.equal(ncs[0], '00000001');
      assert.ok(ncs.includes('0000000a'), 'nc 10 must be written as 0000000a');
      assert.equal(parseInt(ncs.at(-1), 16), ncs.length);
    } finally { await s.stop(); }
  });

  it('DAV-A5 Digest without qop (RFC 2069) works too', async () => {
    const s = await new MockDav({ auth: 'digest', qop: false }).start();
    try {
      const c = await connect(s);
      s.put('/f.txt', 'hello');
      assert.equal((await c.list('/')).length, 1);
      assert.equal(s.digestBad, 0);
      assert.ok(s.log.every((q) => !q.headers.authorization || !/qop=/.test(q.headers.authorization)));
    } finally { await s.stop(); }
  });

  it('DAV-A6 Digest: an upload (a stream body that cannot be repeated) gets the challenge from a cheap OPTIONS first', async () => {
    const s = await new MockDav({ auth: 'digest' }).start();
    try {
      const c = await new Davfs();
      // connect() already did the challenge; forget it, as a fresh session of a server that expired the nonce would
      await c.connect({ url: s.url, user: 'test', pass: 'secret' });
      c.digest = null;
      s.log.length = 0;
      await c.upload(local('up-digest.txt', 'payload'), '/', 'd.txt', true, {}); // overwrite: no exists() before, so only OPTIONS can fetch the challenge
      assert.equal(s.files.get('/d.txt').data.toString(), 'payload');
      const methods = s.log.map((q) => q.method);
      assert.ok(methods.indexOf('OPTIONS') >= 0 && methods.indexOf('OPTIONS') < methods.lastIndexOf('PUT'));
    } finally { await s.stop(); }
  });

  it('DAV-A7 logout forgets the login', async () => {
    const s = await new MockDav({ auth: 'basic' }).start();
    try {
      const c = await connect(s);
      await c.logout();
      assert.equal(c.user, '');
      assert.equal(c.pass, '');
      await rejects(c.list('/'), /Login failed/);
    } finally { await s.stop(); }
  });
});

describe('DAV list / exists', () => {
  let s;
  before(async () => { s = await new MockDav({ base: '/dav' }).start(); });
  after(() => s.stop());
  beforeEach(() => s.reset());

  it('DAV-L1 lists names, folders, sizes and dates; the folder itself is not in its list', async () => {
    s.mkdir('/docs').put('/a.txt', '12345', Date.UTC(2025, 5, 6, 7, 8, 9)).put('/docs/b.bin', Buffer.alloc(300));
    const c = await connect(s);
    const root = sorted(await c.list('/'));
    assert.deepEqual(root, [
      { name: 'a.txt', isDir: false, size: 5, mtime: Date.UTC(2025, 5, 6, 7, 8, 9) },
      { name: 'docs', isDir: true, size: -1, mtime: Date.UTC(2026, 0, 2) },
    ]);
    const docs = await c.list('/docs');
    assert.deepEqual(docs.map((x) => [x.name, x.size, x.isDir]), [['b.bin', 300, false]]);
    assert.deepEqual(await c.list('/docs/'), docs);
  });

  it('DAV-L2 the folder list is asked with a trailing slash and Depth 1; the root as "/"', async () => {
    s.mkdir('/docs');
    const c = await connect(s);
    s.log.length = 0;
    await c.list('/docs');
    await c.list('/');
    await c.list('');
    await c.list(undefined);
    assert.deepEqual(s.log.map((q) => q.url), ['/dav/docs/', '/dav/', '/dav/', '/dav/']);
    assert.ok(s.log.every((q) => q.headers.depth === '1' && q.method === 'PROPFIND'));
  });

  for (const xml of ['d', 'D', 'none', 'ns0']) {
    for (const href of ['path', 'absolute']) {
      it(`DAV-L3 reads the multistatus written as "${xml}" with ${href} hrefs`, async () => {
        const t = await new MockDav({ xml, href, base: '/dav' }).start();
        try {
          t.mkdir('/sub').put('/f.txt', 'abc');
          const c = await connect(t);
          assert.deepEqual(sorted(await c.list('/')).map((x) => [x.name, x.isDir, x.size]), [['f.txt', false, 3], ['sub', true, -1]]);
        } finally { await t.stop(); }
      });
    }
  }

  it('DAV-L4 names with spaces, #, ?, %, &, +, Cyrillic, emoji and brackets survive the XML and URL encoding', async () => {
    const names = ['a b.txt', 'c#d.txt', 'e?f.txt', '100%.txt', 'x&y.txt', 'p+q.txt', 'Привет мир.txt', 'f[1].txt', '日本語.txt', "it's.txt"];
    names.forEach((n) => s.put('/' + n, n));
    const c = await connect(s);
    assert.deepEqual((await c.list('/')).map((x) => x.name).sort(), [...names].sort());
  });

  it('DAV-L5 a response that has only failed properties (404) is skipped, one with a 200 part is kept', async () => {
    const c = await connect(s);
    s.on('PROPFIND', (_q, res) => {
      res.writeHead(207, { 'Content-Type': 'application/xml' });
      res.end('<d:multistatus xmlns:d="DAV:">' +
        '<d:response><d:href>/dav/</d:href><d:propstat><d:prop/><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>' +
        '<d:response><d:href>/dav/gone.txt</d:href><d:propstat><d:prop><d:getcontentlength/></d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat></d:response>' +
        '<d:response><d:href>/dav/mixed.txt</d:href><d:propstat><d:prop><d:getcontentlength>7</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat><d:propstat><d:prop><d:foo/></d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat></d:response>' +
        '</d:multistatus>');
      return true;
    });
    assert.deepEqual((await c.list('/')).map((x) => [x.name, x.size]), [['mixed.txt', 7]]);
  });

  it('DAV-L6 odd properties: no length = 0, bad date = 0, a collection ignores a length, <responsedescription> is not a response', async () => {
    const c = await connect(s);
    s.on('PROPFIND', (_q, res) => {
      res.writeHead(207, { 'Content-Type': 'application/xml' });
      res.end('<D:multistatus xmlns:D="DAV:">' +
        '<D:response><D:href>/dav/</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>' +
        '<D:response><D:href>/dav/nolen.txt</D:href><D:propstat><D:prop><D:getlastmodified>not a date</D:getlastmodified></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat><D:responsedescription>fine</D:responsedescription></D:response>' +
        '<D:response><D:href>/dav/dir/</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype><D:getcontentlength>999</D:getcontentlength></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>' +
        '</D:multistatus>');
      return true;
    });
    assert.deepEqual(sorted(await c.list('/')), [{ name: 'dir', isDir: true, size: -1, mtime: 0 }, { name: 'nolen.txt', isDir: false, size: 0, mtime: 0 }]);
  });

  it('DAV-L7 an empty folder gives an empty list; a missing one gives "Not found"', async () => {
    s.mkdir('/empty');
    const c = await connect(s);
    assert.deepEqual(await c.list('/empty'), []);
    await rejects(c.list('/missing'), /Not found on the server \(404\)/);
  });

  it('DAV-L8 a list of 600 entries is read completely', async () => {
    for (let i = 0; i < 600; i++) s.put(`/f${i}.txt`, 'x');
    const c = await connect(s);
    assert.equal((await c.list('/')).length, 600);
  });

  it('DAV-L9 exists: true for a file and a folder, false for a missing one, false when the server fails', async () => {
    s.mkdir('/d').put('/d/f.txt', 'x');
    const c = await connect(s);
    assert.equal(await c.exists('/d'), true);
    assert.equal(await c.exists('/d/f.txt'), true);
    assert.equal(await c.exists('/nothing'), false);
    s.on('PROPFIND', 500);
    assert.equal(await c.exists('/d'), false);
  });
});

describe('DAV create / rename / delete', () => {
  let s;
  before(async () => { s = await new MockDav({ base: '/dav' }).start(); });
  after(() => s.stop());
  beforeEach(() => s.reset());

  it('DAV-M1 mkdir makes a folder with MKCOL on a path with a trailing slash', async () => {
    const c = await connect(s);
    await c.mkdir('/', 'new');
    assert.equal(s.files.get('/new').dir, true);
    const q = s.log.find((x) => x.method === 'MKCOL');
    assert.equal(q.url, '/dav/new/');
  });

  it('DAV-M2 mkdirp creates every missing parent, from the top down, and nothing that exists', async () => {
    s.mkdir('/a');
    const c = await connect(s);
    s.log.length = 0;
    await c.mkdirp('/a/b/c');
    assert.deepEqual(s.log.filter((x) => x.method === 'MKCOL').map((x) => x.path), ['/a/b', '/a/b/c']);
    s.log.length = 0;
    await c.mkdirp('/a/b/c');
    assert.equal(s.log.filter((x) => x.method === 'MKCOL').length, 0);
    await c.mkdirp('/');
    await c.mkdirp('');
    assert.equal(s.log.filter((x) => x.method === 'MKCOL').length, 0);
  });

  it('DAV-M3 mkdir of an existing folder is fine (405 is accepted), 409 / 403 / 507 are errors with a readable text', async () => {
    const c = await connect(s);
    s.on('MKCOL', 405); s.on('PROPFIND', 404); // the folder is invisible to exists(), but MKCOL says it is there
    await c.mkdir('/', 'x');
    for (const [code, re] of [[409, /does not exist on the server \(409\)/], [403, /refused \(403\)/], [507, /no space left \(507\)/], [423, /locked/]]) {
      s.on('MKCOL', code);
      await rejects(c.mkdir('/', 'y' + code), re);
    }
  });

  it('DAV-R1 rename uses MOVE with an absolute, encoded Destination and Overwrite: F', async () => {
    s.put('/old name.txt', 'data').mkdir('/d').put('/d/in.txt', 'in');
    const c = await connect(s);
    s.log.length = 0;
    await c.rename('/old name.txt', 'new name#1.txt');
    const q = s.log.find((x) => x.method === 'MOVE');
    assert.equal(q.url, '/dav/old%20name.txt');
    assert.equal(q.headers.destination, `http://127.0.0.1:${s.port}/dav/new%20name%231.txt`);
    assert.equal(q.headers.overwrite, 'F');
    assert.equal(s.files.has('/old name.txt'), false);
    assert.equal(s.files.get('/new name#1.txt').data.toString(), 'data');
    await c.rename('/d/in.txt', 'out.txt');
    assert.equal(s.files.get('/d/out.txt').data.toString(), 'in');
    await c.rename('/d', 'dd');
    assert.equal(s.files.get('/dd/out.txt').data.toString(), 'in');
  });

  it('DAV-R2 renaming onto an existing name is refused (412), a missing source is "Not found"', async () => {
    s.put('/a.txt', 'a').put('/b.txt', 'b');
    const c = await connect(s);
    await rejects(c.rename('/a.txt', 'b.txt'), /answered 412/);
    assert.equal(s.files.get('/b.txt').data.toString(), 'b');
    await rejects(c.rename('/zzz.txt', 'q.txt'), /Not found on the server \(404\)/);
  });

  it('DAV-D1 remove deletes files and whole folders, several at once, and a missing one is not an error', async () => {
    s.put('/a.txt', 'a').mkdir('/d').put('/d/x.txt', 'x').mkdir('/d/e').put('/d/e/y.txt', 'y');
    const c = await connect(s);
    await c.remove(['/a.txt', '/d', '/already-gone']);
    assert.deepEqual([...s.files.keys()], ['/']);
    assert.deepEqual(s.log.filter((x) => x.method === 'DELETE').map((x) => x.path), ['/a.txt', '/d', '/already-gone']);
  });

  it('DAV-D2 delete errors are readable: 403, 423, 405, 507, and the message of the server when it sends one', async () => {
    s.put('/a.txt', 'a');
    const c = await connect(s);
    for (const [code, re] of [[403, /refused \(403\)/], [423, /locked on the server \(423\)/], [405, /does not allow DELETE here \(405\)/], [507, /no space left \(507\)/], [207, /answered 207/]]) {
      s.on('DELETE', code);
      await rejects(c.remove(['/a.txt']), re);
    }
    s.on('DELETE', (_q, res) => { res.writeHead(500, { 'Content-Type': 'application/xml' }); res.end('<s:error xmlns:s="x"><s:message>disk on fire &amp; smoking</s:message></s:error>'); return true; });
    await rejects(c.remove(['/a.txt']), /answered 500: disk on fire & smoking/);
    assert.equal(s.files.has('/a.txt'), true);
  });
});

describe('DAV download', () => {
  let s;
  before(async () => { s = await new MockDav({ base: '/dav' }).start(); });
  after(() => s.stop());
  beforeEach(() => s.reset());

  it('DAV-G1 downloads a binary file byte for byte and reports every byte to onData', async () => {
    const data = crypto.randomBytes(1_500_000);
    s.put('/big.bin', data);
    const c = await connect(s);
    let n = 0;
    const dest = local('dl-big.bin');
    await c.download('/big.bin', dest, { onData: (k) => { n += k; } });
    assert.ok(fs.readFileSync(dest).equals(data));
    assert.equal(n, data.length);
  });

  it('DAV-G2 an empty file, and a name that needs encoding', async () => {
    s.put('/ü ö #.txt', '');
    const c = await connect(s);
    const dest = local('dl-empty.txt');
    await c.download('/ü ö #.txt', dest);
    assert.equal(fs.readFileSync(dest).length, 0);
    assert.equal(s.log.at(-1).url, '/dav/%C3%BC%20%C3%B6%20%23.txt');
  });

  it('DAV-G3 a missing file: "Not found", and no file is left behind', async () => {
    const c = await connect(s);
    const dest = path.join(tmp, 'dl-missing.txt');
    await rejects(c.download('/nope.txt', dest), /Not found on the server \(404\)/);
    assert.equal(fs.existsSync(dest), false);
  });

  it('DAV-G4 a connection that breaks in the middle is an error ("interrupted") and the half file is removed', async () => {
    s.put('/cut.bin', Buffer.alloc(100000, 7));
    const c = await connect(s);
    s.on('GET', (_q, res) => { res.writeHead(200, { 'Content-Length': 100000 }); res.write(Buffer.alloc(4000, 7)); setTimeout(() => res.socket.destroy(), 30); return true; });
    const dest = path.join(tmp, 'dl-cut.bin');
    await rejects(c.download('/cut.bin', dest), /interrupted|aborted|socket|ECONNRESET/i);
    assert.equal(fs.existsSync(dest), false);
  });

  it('DAV-G5 onReq gives a handle that cancels the transfer; the half file is removed', async () => {
    s.put('/slow.bin', Buffer.alloc(10_000_000, 1));
    s.on('GET', (_q, res) => {
      res.writeHead(200, { 'Content-Length': 10_000_000 });
      const iv = setInterval(() => { if (!res.write(Buffer.alloc(50000, 1))) return; }, 5);
      res.on('close', () => clearInterval(iv));
      return true;
    });
    const c = await connect(s);
    let handle; let got = 0;
    const dest = path.join(tmp, 'dl-cancel.bin');
    const p = c.download('/slow.bin', dest, { onReq: (h) => { handle = h; }, onData: (k) => { got += k; if (got > 100000 && handle) { const h = handle; handle = null; h.destroy(); } } });
    await assert.rejects(p);
    assert.equal(fs.existsSync(dest), false);
    assert.ok(got < 10_000_000);
  });
});

describe('DAV upload', () => {
  let s;
  before(async () => { s = await new MockDav({ base: '/dav' }).start(); });
  after(() => s.stop());
  beforeEach(() => s.reset());

  it('DAV-U1 uploads a file: content, Content-Length, the modification time (X-OC-Mtime) and onData', async () => {
    const f = local('up1.bin', crypto.randomBytes(300000));
    fs.utimesSync(f, new Date(Date.UTC(2024, 1, 3, 4, 5, 6)), new Date(Date.UTC(2024, 1, 3, 4, 5, 6)));
    const c = await connect(s);
    let n = 0;
    await c.upload(f, '/', 'up.bin', false, { onData: (k) => { n += k; } });
    assert.ok(s.files.get('/up.bin').data.equals(fs.readFileSync(f)));
    assert.equal(n, 300000);
    const q = s.log.find((x) => x.method === 'PUT');
    assert.equal(q.headers['content-length'], '300000');
    assert.equal(q.headers['x-oc-mtime'], String(Math.floor(Date.UTC(2024, 1, 3, 4, 5, 6) / 1000)));
  });

  it('DAV-U2 an empty file and a name with special characters', async () => {
    const c = await connect(s);
    await c.upload(local('up-empty.txt', ''), '/', 'ä b#c.txt', false, {});
    assert.equal(s.files.get('/ä b#c.txt').data.length, 0);
    assert.equal(s.log.find((x) => x.method === 'PUT').url, '/dav/%C3%A4%20b%23c.txt');
  });

  it('DAV-U3 the destination folders are created, parents first', async () => {
    const c = await connect(s);
    await c.upload(local('up3.txt', 'x'), '/p/q/r', 'f.txt', false, {});
    assert.deepEqual(s.log.filter((x) => x.method === 'MKCOL').map((x) => x.path), ['/p', '/p/q', '/p/q/r']);
    assert.equal(s.files.get('/p/q/r/f.txt').data.toString(), 'x');
  });

  it('DAV-U4 overwrite=false refuses an existing file and changes nothing; overwrite=true replaces it', async () => {
    s.put('/f.txt', 'old');
    const c = await connect(s);
    const f = local('up4.txt', 'new');
    await rejects(c.upload(f, '/', 'f.txt', false, {}), /already exists/);
    assert.equal(s.files.get('/f.txt').data.toString(), 'old');
    assert.equal(s.log.filter((x) => x.method === 'PUT').length, 0);
    await c.upload(f, '/', 'f.txt', true, {});
    assert.equal(s.files.get('/f.txt').data.toString(), 'new');
  });

  it('DAV-U5 the answer of the server decides: 201, 204 and 200 are success; 507, 403, 409, 423, 500 are readable errors', async () => {
    const c = await connect(s);
    const f = local('up5.txt', 'z');
    for (const code of [200, 201, 204]) { s.on('PUT', code); await c.upload(f, '/', 'ok.txt', true, {}); }
    for (const [code, re] of [[507, /no space left/], [403, /refused \(403\)/], [409, /does not exist on the server \(409\)/], [423, /locked/], [500, /answered 500/]]) {
      s.on('PUT', code);
      await rejects(c.upload(f, '/', 'bad.txt', true, {}), re);
    }
  });

  it('DAV-U6 onReq gives a handle that aborts the upload', async () => {
    const f = local('up6.bin', Buffer.alloc(8_000_000, 3));
    const c = await connect(s);
    let handle;
    s.on('PUT', (req) => { req.on('data', () => {}); return true; }); // never answers
    const p = c.upload(f, '/', 'big.bin', true, { onReq: (h) => { handle = h; }, onData: () => { if (handle) { const h = handle; handle = null; h.destroy(); } } });
    await assert.rejects(p);
  });
});

describe('DAV streaming read (openDownload)', () => {
  let s;
  before(async () => { s = await new MockDav({ base: '/dav' }).start(); });
  after(() => s.stop());
  beforeEach(() => s.reset());
  const data = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251));

  it('DAV-P1 a Range request comes back as 206 with the same bytes and the headers a player needs', async () => {
    s.put('/m.mp3', data);
    const c = await connect(s);
    const r = await c.openDownload('/m.mp3', 'bytes=100-199');
    assert.equal(r.statusCode, 206);
    assert.equal(r.headers['content-length'], '100');
    assert.equal(r.headers['content-range'], 'bytes 100-199/1000');
    assert.equal(r.headers['accept-ranges'], 'bytes');
    assert.equal(r.headers['content-type'], 'application/octet-stream');
    assert.deepEqual(Object.keys(r.headers).sort(), ['accept-ranges', 'content-length', 'content-range', 'content-type']);
    assert.ok((await readAll(r)).equals(data.subarray(100, 200)));
    assert.equal(s.log.at(-1).headers.range, 'bytes=100-199');
  });

  it('DAV-P2 without Range: 200 and the whole file; a suffix range works', async () => {
    s.put('/m.mp3', data);
    const c = await connect(s);
    const r = await c.openDownload('/m.mp3');
    assert.equal(r.statusCode, 200);
    assert.ok((await readAll(r)).equals(data));
    assert.equal(s.log.at(-1).headers.range, undefined);
    const t = await c.openDownload('/m.mp3', 'bytes=-10');
    assert.equal(t.statusCode, 206);
    assert.ok((await readAll(t)).equals(data.subarray(990)));
  });

  it('DAV-P3 a server without Range support answers 200 and the client passes that on honestly', async () => {
    const t = await new MockDav({ noRange: true }).start();
    try {
      t.put('/m.mp3', data);
      const c = await connect(t);
      const r = await c.openDownload('/m.mp3', 'bytes=5-9');
      assert.equal(r.statusCode, 200);
      assert.equal((await readAll(r)).length, 1000);
    } finally { await t.stop(); }
  });

  it('DAV-P4 a missing file or a refusal is an error', async () => {
    const c = await connect(s);
    await rejects(c.openDownload('/none.mp3'), /Not found on the server \(404\)/);
    s.put('/x', 'x'); s.on('GET', 403);
    await rejects(c.openDownload('/x'), /refused \(403\)/);
  });
});

describe('DAV redirects', () => {
  let a; let b;
  before(async () => { a = await new MockDav({ base: '/dav', auth: 'basic' }).start(); b = await new MockDav({ base: '/dav' }).start(); });
  after(async () => { await a.stop(); await b.stop(); });
  beforeEach(() => { a.reset(); b.reset(); });

  for (const code of [301, 302, 307, 308]) {
    it(`DAV-X1 a ${code} redirect of a read is followed (relative Location), the method is kept`, async () => {
      a.put('/real/f.txt', 'x'); a.mkdir('/real');
      const c = await connect(a);
      a.on('PROPFIND', (req, res) => { if (req.url === '/dav/') { res.writeHead(code, { Location: '/dav/real/' }); res.end(); return true; } return false; }, 1);
      assert.deepEqual((await c.list('/')).map((x) => x.name), ['f.txt']);
      assert.equal(a.log.at(-1).method, 'PROPFIND');
    });
  }

  it('DAV-X2 an endless redirect stops after 5 hops with the status of the server', async () => {
    const c = await connect(a);
    a.on('GET', (req, res) => { res.writeHead(302, { Location: req.url }); res.end(); return true; }, 50);
    await rejects(c.download('/loop.txt', local('loop.txt')), /answered 302/);
    assert.ok(a.log.filter((q) => q.method === 'GET').length <= 7);
  });

  it('DAV-X3 an upload (a stream body) is not replayed on a redirect: the error shows the status', async () => {
    const c = await connect(a);
    a.on('PUT', (req, res) => { res.writeHead(307, { Location: '/dav/elsewhere.txt' }); res.end(); return true; });
    await rejects(c.upload(local('x3.txt', 'z'), '/', 'f.txt', true, {}), /answered 307/);
    assert.equal(a.log.filter((q) => q.method === 'PUT').length, 1);
  });

  it('DAV-X4 a redirect to ANOTHER server does not carry the login there (security)', async () => {
    b.put('/dav-file.txt', 'secret data');
    const c = await connect(a);
    a.on('GET', (_q, res) => { res.writeHead(302, { Location: `http://127.0.0.1:${b.port}/dav/dav-file.txt` }); res.end(); return true; });
    const dest = local('x4.txt');
    await c.download('/anything.txt', dest);
    assert.equal(fs.readFileSync(dest, 'utf8'), 'secret data');
    assert.equal(b.log.length, 1);
    assert.equal(b.log[0].headers.authorization, undefined);
  });

  it('DAV-X5 a redirect to the same server keeps the login', async () => {
    a.put('/t.txt', 'ok');
    const c = await connect(a);
    a.on('GET', (_q, res) => { res.writeHead(302, { Location: `http://127.0.0.1:${a.port}/dav/t.txt` }); res.end(); return true; });
    await c.download('/x.txt', local('x5.txt'));
    assert.ok(a.log.filter((q) => q.method === 'GET').every((q) => q.headers.authorization));
  });
});

// ---------------------------------------------------------------- second round: found by the mutation tests
describe('DAV details (second round)', () => {
  let s;
  before(async () => { s = await new MockDav({ base: '/dav' }).start(); });
  after(() => s.stop());
  beforeEach(() => s.reset());

  it('DAV-C9 the timeout option: a positive number is used, 0 / negative / text / nothing mean 60 s', async () => {
    // (a tiny timeout makes the connect itself fail: only the value that was taken is looked at)
    for (const [given, want] of [[undefined, 60000], [0, 60000], [-5, 60000], ['abc', 60000], [0.5, 0.5], [1, 1], ['500', 500], [300, 300], [120000, 120000]]) {
      const c = new Davfs();
      await c.connect({ url: s.url, user: 'test', pass: 'secret', timeout: given }).catch(() => {});
      assert.equal(c.timeoutMs, want, String(given));
    }
  });

  it('DAV-C10 the text of an unexpected status is "The server answered <code> <reason>"', async () => {
    for (const [code, text] of [[400, 'The server answered 400 Bad Request'], [403, 'The server answered 403 Forbidden'], [500, 'The server answered 500 Internal Server Error'], [503, 'The server answered 503 Service Unavailable']]) {
      s.reset(); s.on('PROPFIND', code, 5);
      await assert.rejects(new Davfs().connect({ url: s.url, user: 'test', pass: 'secret' }), (e) => { assert.equal(e.message, text); return true; });
    }
    s.reset(); s.on('PROPFIND', (_q, res) => { res.writeHead(499, ''); res.end(); return true; }, 5); // a status without a reason phrase
    await assert.rejects(new Davfs().connect({ url: s.url }), (e) => { assert.equal(e.message, 'The server answered 499'); return true; });
    s.reset(); s.on('PROPFIND', 399, 5); // below 400 is not an error of the probe
    await new Davfs().connect({ url: s.url });
  });

  it('DAV-A8 an endless wrong password stops after exactly 3 requests (Basic and Digest)', async () => {
    for (const auth of ['basic', 'digest']) {
      const t = await new MockDav({ auth }).start();
      try {
        await assert.rejects(new Davfs().connect({ url: t.url, user: 'test', pass: 'WRONG' }), /Login failed/);
        assert.equal(t.log.filter((q) => q.method === 'PROPFIND').length, 3, auth);
      } finally { await t.stop(); }
    }
  });

  it('DAV-A9 Digest: the client nonce is 8 random bytes (16 hex digits), new for every request', async () => {
    const t = await new MockDav({ auth: 'digest' }).start();
    try {
      const c = await connect(t);
      for (let i = 0; i < 5; i++) await c.exists('/');
      const nonces = t.log.map((q) => /cnonce="([^"]*)"/.exec(q.headers.authorization || '')).filter(Boolean).map((m) => m[1]);
      assert.ok(nonces.length >= 5);
      assert.ok(nonces.every((x) => /^[0-9a-f]{16}$/.test(x)), nonces.join());
      assert.equal(new Set(nonces).size, nonces.length);
    } finally { await t.stop(); }
  });

  it('DAV-A10 a server that answers 401 WITHOUT a challenge is not retried: one request, "Login failed"', async () => {
    s.on('PROPFIND', (_q, res) => { res.writeHead(401); res.end(); return true; }, 9);
    await assert.rejects(new Davfs().connect({ url: s.url, user: 'test', pass: 'secret' }), /Login failed/);
    assert.equal(s.log.filter((q) => q.method === 'PROPFIND').length, 1);
  });

  it('DAV-A11 a Basic server that wants the login once more (a proxy, an expired session) is answered with Basic again, and so are later requests', async () => {
    const t = await new MockDav({ auth: 'basic', base: '/dav' }).start();
    try {
      const c = await connect(t);
      t.put('/a.txt', 'a');
      t.on('PROPFIND', (_q, res) => { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="again"' }); res.end(); return true; });
      assert.deepEqual((await c.list('/')).map((x) => x.name), ['a.txt']);
      await c.exists('/a.txt');
      assert.ok(t.log.every((q) => !q.headers.authorization || /^Basic /.test(q.headers.authorization)), 'never Digest to a Basic server');
    } finally { await t.stop(); }
  });

  it('DAV-A12 an anonymous upload sends no OPTIONS; with a Basic login the OPTIONS goes before the upload', async () => {
    const a = new Davfs();
    await a.connect({ url: s.url });
    await a.upload(local('anon.txt', 'x'), '/', 'anon.txt', true, {});
    assert.equal(s.log.filter((q) => q.method === 'OPTIONS').length, 0);
    const t = await new MockDav({ auth: 'basic' }).start();
    try {
      const c = await connect(t);
      await c.upload(local('basic.txt', 'x'), '/', 'b.txt', true, {});
      assert.equal(t.log.filter((q) => q.method === 'OPTIONS').length, 1);
      assert.ok(t.log.findIndex((q) => q.method === 'OPTIONS') < t.log.findIndex((q) => q.method === 'PUT'));
    } finally { await t.stop(); }
  });

  it('DAV-X6 an endless redirect is followed exactly 5 times: 6 requests in all', async () => {
    const c = await connect(s);
    s.on('GET', (req, res) => { res.writeHead(302, { Location: req.url }); res.end(); return true; }, 50);
    await assert.rejects(c.download('/loop.txt', local('loop2.txt')), /answered 302/);
    assert.equal(s.log.filter((q) => q.method === 'GET').length, 6);
  });

  it('DAV-L10 a server that does not repeat the folder itself in its answer lists all children', async () => {
    const c = await connect(s);
    s.on('PROPFIND', (_q, res) => {
      res.writeHead(207, { 'Content-Type': 'application/xml' });
      res.end('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/first.txt</d:href><d:propstat><d:prop><d:getcontentlength>1</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>' +
        '<d:response><d:href>/dav/second.txt</d:href><d:propstat><d:prop><d:getcontentlength>2</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>');
      return true;
    });
    assert.deepEqual((await c.list('/')).map((x) => [x.name, x.size]), [['first.txt', 1], ['second.txt', 2]]);
  });

  it('DAV-L11 a response without an href is ignored', async () => {
    const c = await connect(s);
    s.on('PROPFIND', (_q, res) => {
      res.writeHead(207, { 'Content-Type': 'application/xml' });
      res.end('<d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>' +
        '<d:response><d:href>/dav/ok.txt</d:href><d:propstat><d:prop/><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>');
      return true;
    });
    assert.deepEqual((await c.list('/')).map((x) => x.name), ['ok.txt']);
  });

  it('DAV-L12 a file with no date has mtime 0; a date is read exactly (to the second)', async () => {
    s.put('/dated.txt', 'x', Date.UTC(2023, 4, 6, 7, 8, 9));
    const c = await connect(s);
    assert.equal((await c.list('/')).find((x) => x.name === 'dated.txt').mtime, Date.UTC(2023, 4, 6, 7, 8, 9));
    s.on('PROPFIND', (_q, res) => {
      res.writeHead(207, { 'Content-Type': 'application/xml' });
      res.end('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/</d:href></d:response><d:response><d:href>/dav/nodate.txt</d:href><d:propstat><d:prop><d:getcontentlength>3</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>');
      return true;
    });
    assert.deepEqual(await c.list('/'), [{ name: 'nodate.txt', isDir: false, size: 3, mtime: 0 }]);
  });

  it('DAV-E1 exists: a plain 200 answer to PROPFIND counts as "there"; a broken connection is exactly false', async () => {
    s.put('/x.txt', 'x');
    const c = await connect(s);
    s.on('PROPFIND', 200);
    assert.equal(await c.exists('/x.txt'), true);
    s.on('PROPFIND', (req) => { req.socket.destroy(); return true; });
    assert.strictEqual(await c.exists('/x.txt'), false);
    s.on('PROPFIND', 404);
    assert.strictEqual(await c.exists('/x.txt'), false);
  });

  it('DAV-M4 the answers that mean "done": MKCOL 200 / 201 / 204 / 405, MOVE 200 / 201 / 204, DELETE 200 / 202 / 204 / 404; the others are errors', async () => {
    const c = await connect(s);
    s.put('/f.txt', 'x');
    for (const code of [200, 201, 204, 405]) { s.on('MKCOL', code); await c.mkdir('/', 'd' + code); }
    for (const code of [202, 203, 205, 301]) { s.on('MKCOL', code); await assert.rejects(c.mkdir('/', 'e' + code), new RegExp(`answered ${code}`)); }
    for (const code of [200, 201, 204]) { s.on('MOVE', code); await c.rename('/f.txt', 'g.txt'); }
    for (const code of [202, 205, 207]) { s.on('MOVE', code); await assert.rejects(c.rename('/f.txt', 'h.txt'), new RegExp(`answered ${code}`)); }
    for (const code of [200, 202, 204, 404]) { s.on('DELETE', code); await c.remove(['/f.txt']); }
    for (const code of [201, 203, 205]) { s.on('DELETE', code); await assert.rejects(c.remove(['/f.txt']), new RegExp(`answered ${code}`)); }
  });

  it('DAV-G6 the message of the server in a failed GET / PUT is shown (download, streaming, upload)', async () => {
    const c = await connect(s);
    const boom = (req, res) => { res.writeHead(500, { 'Content-Type': 'application/xml' }); res.end('<s:error xmlns:s="x"><s:message>quota &lt;exceeded&gt;</s:message></s:error>'); return true; };
    s.on('GET', boom); await assert.rejects(c.download('/a.txt', local('g6.txt')), /answered 500: quota <exceeded>/);
    s.on('GET', boom); await assert.rejects(c.openDownload('/a.txt'), /answered 500: quota <exceeded>/);
    s.on('PUT', boom); await assert.rejects(c.upload(local('g6u.txt', 'x'), '/', 'u.txt', true, {}), /answered 500: quota <exceeded>/);
  });

  it('DAV-G7 onReq is called with the request as soon as it starts (and again with a handle when the body starts); destroying it while the server is silent ends the download', async () => {
    s.put('/ok.txt', 'hello');
    const c = await connect(s);
    const calls = [];
    await c.download('/ok.txt', local('g7.txt'), { onReq: (h) => calls.push(h) });
    assert.equal(calls.length, 2);
    assert.ok(calls.every((h) => typeof h.destroy === 'function'));
    s.on('GET', () => true); // a server that never answers
    let handle;
    const p = c.download('/ok.txt', local('g7b.txt'), { onReq: (h) => { handle = h; } });
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(handle, 'the handle is there before the server answers');
    handle.destroy();
    await assert.rejects(p);
  });

  it('DAV-P5 only the headers a player needs are passed on; absent ones are not invented', async () => {
    s.put('/m.mp3', 'abc');
    const c = await connect(s);
    s.on('GET', (_q, res) => { res.writeHead(200, { 'Content-Length': 3, 'X-Secret': 'no', 'Set-Cookie': 'a=b' }); res.end('abc'); return true; });
    const r = await c.openDownload('/m.mp3');
    assert.deepEqual(Object.keys(r.headers), ['content-length']);
    assert.equal((await readAll(r)).toString(), 'abc');
  });
});

// ---------------------------------------------------------------- the texts of the errors, without a server
describe('DAV error texts', () => {
  const { explain, httpError } = require('../src/main/davclient');
  const e = (m) => explain(new Error(m)).message;

  const cases = [
    ['getaddrinfo ENOTFOUND cloud.example', /^Host not found: getaddrinfo ENOTFOUND cloud\.example$/],
    ['getaddrinfo EAI_AGAIN x', /^Host not found: /],
    ['connect ECONNREFUSED 127.0.0.1:80', /^Connection refused \(is the server running and the port right\?\)$/],
    ['ETIMEDOUT', /^The server did not answer in time\.$/],
    ['Request timeout', /^The server did not answer in time\.$/],
    ['self-signed certificate', /^The server certificate is not trusted\. Tick "Allow an untrusted certificate" if you trust this server\.$/],
    ['self signed certificate in certificate chain', /not trusted/],
    ['unable to verify the first certificate', /not trusted/],
    ['CERT_HAS_EXPIRED', /not trusted/],
    ["Hostname/IP does not match certificate's altnames", /not trusted/],
    ['error:0A00010B:SSL routines::wrong version number', /^The server does not speak HTTPS on this port: try http:\/\/ in the address\.$/],
    ['write EPROTO', /does not speak HTTPS/],
    ['something else entirely', /^something else entirely$/],
  ];
  for (const [msg, re] of cases) it(`DAV-Z1 "${msg}"`, () => assert.match(e(msg), re));

  it('DAV-Z2 other kinds of input: a string, nothing, an object with a message; an unknown Error is returned as the same object', () => {
    assert.match(explain('ECONNREFUSED x').message, /^Connection refused/);
    assert.equal(explain(undefined).message, 'undefined');
    assert.equal(explain(null).message, 'null');
    assert.equal(explain({ message: 'ETIMEDOUT' }).message, 'The server did not answer in time.');
    assert.equal(explain({ message: '' }).message, '[object Object]');
    const own = new Error('whatever');
    assert.equal(explain(own), own);
    assert.equal(explain('plain').message, 'plain');
  });

  it('DAV-Z3 the first rule that fits wins (a refused connection that also says "timeout", a certificate message with EPROTO)', () => {
    assert.match(e('ECONNREFUSED after timeout'), /Connection refused/);
    assert.match(e('ENOTFOUND ECONNREFUSED'), /Host not found/);
    assert.match(e('certificate EPROTO'), /not trusted/);
  });

  const status = [
    [401, /^Login failed: wrong user name or password\.$/],
    [403, /^The server refused \(403\): no permission for this\.$/],
    [404, /^Not found on the server \(404\)\.$/],
    [405, /^The server does not allow PUT here \(405\)\.$/],
    [409, /^The folder does not exist on the server \(409\)\.$/],
    [423, /^The file is locked on the server \(423\)\.$/],
    [507, /^The server has no space left \(507\)\.$/],
    [500, /^The server answered 500$/],
    [418, /^The server answered 418$/],
    [207, /^The server answered 207$/],
  ];
  for (const [code, re] of status) it(`DAV-Z4 status ${code}`, () => assert.match(httpError(code, '', 'PUT').message, re));

  it('DAV-Z5 the message element of the answer (any prefix, entities decoded) is appended; text without one is not', () => {
    assert.equal(httpError(500, '<s:error><s:message>disk &amp; &lt;quota&gt; &quot;full&quot; &apos;x&apos; &#65;</s:message></s:error>', 'GET').message, 'The server answered 500: disk & <quota> "full" \'x\' A');
    assert.equal(httpError(500, '<message>plain</message>', 'GET').message, 'The server answered 500: plain');
    assert.equal(httpError(500, '<d:MESSAGE>upper</d:MESSAGE>', 'GET').message, 'The server answered 500: upper');
    assert.equal(httpError(500, 'no xml here', 'GET').message, 'The server answered 500');
    assert.equal(httpError(500, undefined, 'GET').message, 'The server answered 500');
    assert.equal(httpError(404, '<s:message>ignored for known codes</s:message>', 'GET').message, 'Not found on the server (404).');
  });
});
