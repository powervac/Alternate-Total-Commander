'use strict';
// Import of WinSCP sessions (src/main/winscp.js): the INI parser, the registry reader (the output of `reg query` is faked) and list().
// Method: table driven; every field of a session is checked for the normal value, the default and a damaged value (tests/TEST_METHODS.md, WSC-*).
const { describe, it, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const winscp = require('../src/main/winscp');
const { parseIni } = winscp;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdr-wsc-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const ini = (...sections) => sections.map(([name, kv]) => `[Sessions\\${name}]\r\n` + Object.entries(kv).map(([k, v]) => `${k}=${v}`).join('\r\n') + '\r\n').join('\r\n');
const one = (kv, name = 'srv') => parseIni(ini([name, kv]))[0];

describe('WinSCP INI parser: protocols', () => {
  const cases = [
    // FSProtocol, kind, importable, protocol name, default port
    [0, 'ssh', true, 'SCP', 22],
    [1, 'ssh', true, 'SFTP', 22],
    [2, 'ssh', true, 'SFTP', 22],
    [5, 'ftp', true, 'FTP', 21],
    [6, 'webdav', true, 'WebDAV', 80],
    [7, 'ssh', false, 'S3', 22],
    [8, 'ssh', false, 'protocol 8', 22],
    [99, 'ssh', false, 'protocol 99', 22],
  ];
  for (const [proto, kind, importable, name, port] of cases) {
    it(`WSC-P1 FSProtocol ${proto}: kind ${kind}, importable ${importable}, "${name}", default port ${port}`, () => {
      const s = one({ HostName: 'h.example.com', UserName: 'u', FSProtocol: proto });
      assert.equal(s.kind, kind);
      assert.equal(s.importable, importable);
      assert.equal(s.protocol, name);
      assert.equal(s.port, port);
    });
  }

  it('WSC-P2 no FSProtocol at all is SFTP (the old default of WinSCP)', () => {
    const s = one({ HostName: 'h' });
    assert.equal(s.protocol, 'SFTP');
    assert.equal(s.kind, 'ssh');
    assert.equal(s.importable, true);
  });

  it('WSC-P3 WebDAV: the default port is 443 with TLS (Ftps > 0) and 80 without', () => {
    assert.equal(one({ HostName: 'h', FSProtocol: 6, Ftps: 1 }).port, 443);
    assert.equal(one({ HostName: 'h', FSProtocol: 6, Ftps: 2 }).port, 443);
    assert.equal(one({ HostName: 'h', FSProtocol: 6, Ftps: 0 }).port, 80);
    assert.equal(one({ HostName: 'h', FSProtocol: 6 }).port, 80);
  });
});

describe('WinSCP INI parser: fields', () => {
  it('WSC-F1 host, user, port, key file and remote folder are read', () => {
    const s = one({ HostName: 'ftp.example.com', UserName: 'bob', PortNumber: 2121, FSProtocol: 5, Ftps: 3, RemoteDirectory: '/pub/data', PublicKeyFile: 'C:%5Ckeys%5Cid.ppk' });
    assert.deepEqual(s, {
      name: 'srv', host: 'ftp.example.com', port: 2121, user: 'bob', keyFile: 'C:\\keys\\id.ppk', protocol: 'FTP',
      kind: 'ftp', ftps: 3, dir: '/pub/data', importable: true,
    });
  });

  it('WSC-F2 a missing user, key, folder and Ftps are empty / zero; a user name is kept as written', () => {
    const s = one({ HostName: 'h' });
    assert.equal(s.user, '');
    assert.equal(s.keyFile, '');
    assert.equal(s.dir, '');
    assert.equal(s.ftps, 0);
    assert.equal(one({ HostName: 'h', UserName: 'DOM\\bob' }).user, 'DOM\\bob');
  });

  const ports = [
    ['2222', 2222], ['1', 1], ['65535', 65535], ['65536', 22], ['0', 22], ['-5', 22], ['abc', 22], ['', 22], ['22.9', 22], [' 2200 ', 2200], ['99999', 22],
  ];
  for (const [raw, want] of ports) {
    it(`WSC-F3 PortNumber "${raw}" -> ${want}`, () => {
      assert.equal(one({ HostName: 'h', PortNumber: raw }).port, want);
    });
  }

  it('WSC-F4 Ftps: a number is kept, a damaged value is 0', () => {
    assert.equal(one({ HostName: 'h', FSProtocol: 5, Ftps: 1 }).ftps, 1);
    assert.equal(one({ HostName: 'h', FSProtocol: 5, Ftps: 3 }).ftps, 3);
    assert.equal(one({ HostName: 'h', FSProtocol: 5, Ftps: 'x' }).ftps, 0);
  });

  it('WSC-F5 key file path: only %XX is decoded ("+" stays, a lower case hex works)', () => {
    assert.equal(one({ HostName: 'h', PublicKeyFile: 'C:%5cdir%20x%5Ck+1.ppk' }).keyFile, 'C:\\dir x\\k+1.ppk');
    assert.equal(one({ HostName: 'h', PublicKeyFile: '/home/me/.ssh/id' }).keyFile, '/home/me/.ssh/id');
    assert.equal(one({ HostName: 'h', PublicKeyFile: '%zz' }).keyFile, '%zz');
  });

  it('WSC-F6 a session without a host is not importable', () => {
    assert.equal(one({ UserName: 'u' }).importable, false);
    assert.equal(one({ HostName: '', UserName: 'u' }).importable, false);
    assert.equal(one({ HostName: 'x', UserName: 'u' }).importable, true);
  });
});

describe('WinSCP INI parser: names and structure', () => {
  const names = [
    ['plain', 'plain'],
    ['My%20Server', 'My Server'],
    ['%D0%A1%D0%B5%D1%80%D0%B2%D0%B5%D1%80', 'Сервер'],
    ['Folder/Sub/server', 'Folder / Sub / server'],
    ['Folder%2FSub%2Fserver', 'Folder / Sub / server'],
    ['a+b', 'a+b'],
    ['100%25', '100%'],
    ['bad%zzname', 'bad%zzname'],
    ['x%2By', 'x+y'],
  ];
  for (const [raw, want] of names) {
    it(`WSC-N1 session name "${raw}" -> "${want}"`, () => {
      assert.equal(one({ HostName: 'h' }, raw).name, want);
    });
  }

  it('WSC-N2 "Default Settings" (also written Default%20Settings, any case) is not a session', () => {
    const r = parseIni(ini(['Default Settings', { HostName: 'x' }], ['Default%20Settings', { HostName: 'x' }], ['default settings', { HostName: 'x' }], ['real', { HostName: 'h' }], ['Default Settings 2', { HostName: 'y' }]));
    assert.deepEqual(r.map((x) => x.name), ['real', 'Default Settings 2']);
  });

  it('WSC-N3 sessions keep their order; other sections and keys of other sections are ignored', () => {
    const text = [
      '[Configuration]', 'HostName=not-a-session',
      '[Sessions\\b]', 'HostName=hb', '[Configuration\\Interface]', 'HostName=ignored2',
      '[Sessions\\a]', 'HostName=ha', 'UserName=ua',
      '[Sessions\\c]', 'HostName=hc',
    ].join('\r\n');
    assert.deepEqual(parseIni(text).map((x) => [x.name, x.host, x.user]), [['b', 'hb', ''], ['a', 'ha', 'ua'], ['c', 'hc', '']]);
  });

  it('WSC-N4 line endings (LF, CRLF), a BOM, blanks around lines, comments and key=value with "=" inside the value', () => {
    const text = '\uFEFF  [Sessions\\one]  \n HostName = h1 \n Note=a=b=c\n; comment\n\n[Sessions\\two]\nHostName=h2\r\n';
    const r = parseIni(text);
    assert.deepEqual(r.map((x) => x.name), ['one', 'two']);
    assert.equal(r[0].host, 'h1'); // blanks around the value (a hand-edited file) are not part of it
    assert.equal(r[1].host, 'h2');
  });

  it('WSC-N5 empty text, text without sessions, a key before any section: no sessions, no error', () => {
    assert.deepEqual(parseIni(''), []);
    assert.deepEqual(parseIni('HostName=orphan\r\n[Other]\r\nHostName=x'), []);
    assert.deepEqual(parseIni('[Sessions\\]'), []);
  });

  it('WSC-N6 a repeated key: the last one wins', () => {
    assert.equal(one({ HostName: 'first' }).host, 'first');
    assert.equal(parseIni('[Sessions\\x]\nHostName=first\nHostName=second')[0].host, 'second');
  });
});

describe('WinSCP list()', () => {
  const realExec = cp.execFile;
  const saved = { APPDATA: process.env.APPDATA, USERPROFILE: process.env.USERPROFILE };
  afterEach(() => {
    cp.execFile = realExec;
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    delete require.cache[require.resolve('../src/main/winscp')];
  });
  const fresh = (execFile) => { cp.execFile = execFile; delete require.cache[require.resolve('../src/main/winscp')]; return require('../src/main/winscp'); };
  const REG = [
    'HKEY_CURRENT_USER\\Software\\Martin Prikryl\\WinSCP 2\\Sessions\\Default%20Settings',
    '    HostName    REG_SZ    ',
    '',
    'HKEY_CURRENT_USER\\Software\\Martin Prikryl\\WinSCP 2\\Sessions\\My%20Server',
    '    HostName    REG_SZ    my host.example.com',
    '    PortNumber    REG_DWORD    0x16',
    '    FSProtocol    REG_DWORD    0x2',
    '    UserName    REG_SZ    root',
    '    PublicKeyFile    REG_SZ    C:%5Ckeys%5Cid.ppk',
    '',
    'HKEY_CURRENT_USER\\Software\\Martin Prikryl\\WinSCP 2\\Sessions\\Folder%2FFtp',
    '    HostName    REG_SZ    ftp.example.com',
    '    FSProtocol    REG_DWORD    0x5',
    '    Ftps    REG_DWORD    0x3',
    '    PortNumber    REG_DWORD    0x7e9',
    '',
    'HKEY_CURRENT_USER\\Software\\Martin Prikryl\\WinSCP 2\\Sessions\\My%20Workspace/0000',
    '    Note    REG_SZ    a workspace entry has no host',
    '',
  ].join('\r\n');
  const win = process.platform === 'win32';

  it('WSC-R1 reads the sessions of the registry (REG_SZ and REG_DWORD hex), skips "Default Settings" and entries without a host', { skip: !win }, async () => {
    let args;
    const w = fresh((cmd, a, opts, cb) => { args = [cmd, a, opts]; cb(null, Buffer.from(REG)); });
    const r = await w.list();
    assert.equal(r.source, 'registry');
    assert.deepEqual(r.sessions.map((s) => [s.name, s.host, s.port, s.user, s.protocol, s.keyFile]), [
      ['My Server', 'my host.example.com', 22, 'root', 'SFTP', 'C:\\keys\\id.ppk'],
      ['Folder / Ftp', 'ftp.example.com', 2025, '', 'FTP', ''],
    ]);
    assert.equal(r.sessions[1].ftps, 3);
    assert.equal(args[0], 'reg');
    assert.deepEqual(args[1], ['query', 'HKCU\\Software\\Martin Prikryl\\WinSCP 2\\Sessions', '/s']);
    assert.equal(args[2].windowsHide, true);
    assert.equal(args[2].encoding, 'buffer');
    assert.equal(args[2].timeout, 8000); // reg.exe must not hang the dialog
    assert.equal(args[2].maxBuffer, 16 * 1024 * 1024); // a big list of sessions fits
  });

  it('WSC-R7 on macOS and Linux there is no registry: reg.exe is not started', async () => {
    let called = 0;
    const w = fresh((c, a, o, cb) => { called++; cb(null, Buffer.from(REG)); });
    const real = Object.getOwnPropertyDescriptor(process, 'platform');
    const empty = fs.mkdtempSync(path.join(tmp, 'np-'));
    process.env.APPDATA = empty; process.env.USERPROFILE = empty;
    try {
      for (const platform of ['linux', 'darwin']) {
        Object.defineProperty(process, 'platform', { value: platform });
        assert.deepEqual(await w.list(), { source: null, sessions: [] });
      }
    } finally { Object.defineProperty(process, 'platform', real); }
    assert.equal(called, 0);
  });

  it('WSC-R8 a failed reg.exe (an error, even with some output) and an empty or missing output are "no registry"', { skip: !win }, async () => {
    const empty = fs.mkdtempSync(path.join(tmp, 'e8-'));
    process.env.APPDATA = empty; process.env.USERPROFILE = empty;
    for (const answer of [[new Error('exit code 1'), Buffer.from(REG)], [null, null], [null, undefined], [null, Buffer.alloc(0)], [new Error('x'), null]]) {
      const w = fresh((c, a, o, cb) => cb(...answer));
      assert.deepEqual(await w.list(), { source: null, sessions: [] }, String(answer[0]));
    }
  });

  it('WSC-R2 the registry wins over WinSCP.ini files; an explicit iniPath wins over both and does not touch the registry', { skip: !win }, async () => {
    fs.writeFileSync(path.join(tmp, 'x.ini'), ini(['from-file', { HostName: 'f' }]));
    let called = 0;
    const w = fresh((c, a, o, cb) => { called++; cb(null, Buffer.from(REG)); });
    const viaIni = await w.list(path.join(tmp, 'x.ini'));
    assert.equal(called, 0);
    assert.equal(viaIni.source, path.join(tmp, 'x.ini'));
    assert.deepEqual(viaIni.sessions.map((s) => s.name), ['from-file']);
    assert.equal((await w.list()).source, 'registry');
    assert.equal(called, 1);
  });

  it('WSC-R3 no registry (error or empty output): APPDATA\\WinSCP.ini first, then Documents\\WinSCP.ini of the profile, else nothing', { skip: !win }, async () => {
    const appdata = fs.mkdtempSync(path.join(tmp, 'ad-'));
    const profile = fs.mkdtempSync(path.join(tmp, 'pr-'));
    fs.mkdirSync(path.join(profile, 'Documents'));
    process.env.APPDATA = appdata;
    process.env.USERPROFILE = profile;
    const w = fresh((c, a, o, cb) => cb(new Error('not found'), Buffer.alloc(0)));
    assert.deepEqual(await w.list(), { source: null, sessions: [] });
    fs.writeFileSync(path.join(profile, 'Documents', 'WinSCP.ini'), ini(['doc', { HostName: 'd' }]));
    let r = await w.list();
    assert.equal(r.source, path.join(profile, 'Documents', 'WinSCP.ini'));
    assert.deepEqual(r.sessions.map((s) => s.name), ['doc']);
    fs.writeFileSync(path.join(appdata, 'WinSCP.ini'), ini(['app', { HostName: 'a' }]));
    r = await w.list();
    assert.equal(r.source, path.join(appdata, 'WinSCP.ini'));
    // an APPDATA file without sessions is passed over
    fs.writeFileSync(path.join(appdata, 'WinSCP.ini'), '[Configuration]\r\nx=1\r\n');
    assert.equal((await w.list()).source, path.join(profile, 'Documents', 'WinSCP.ini'));
    const w2 = fresh((c, a, o, cb) => cb(null, Buffer.alloc(0))); // an empty answer is "no registry" too
    assert.equal((await w2.list()).source, path.join(profile, 'Documents', 'WinSCP.ini'));
  });

  it('WSC-R4 a missing APPDATA / USERPROFILE is not a crash', { skip: !win }, async () => {
    delete process.env.APPDATA; delete process.env.USERPROFILE;
    const w = fresh((c, a, o, cb) => cb(new Error('x'), null));
    assert.deepEqual(await w.list(), { source: null, sessions: [] });
  });

  it('WSC-R5 an iniPath that does not exist is an error (main.js shows it)', async () => {
    await assert.rejects(winscp.list(path.join(tmp, 'missing.ini')), /ENOENT/);
  });

  it('WSC-R6 an iniPath file is read as UTF-8 with its non-ASCII names', async () => {
    fs.writeFileSync(path.join(tmp, 'u.ini'), '\uFEFF' + ini(['Сервер%201', { HostName: 'хост.example.com', UserName: 'ю' }]), 'utf8');
    const r = await winscp.list(path.join(tmp, 'u.ini'));
    assert.deepEqual(r.sessions.map((s) => [s.name, s.host, s.user]), [['Сервер 1', 'хост.example.com', 'ю']]);
  });
});
