'use strict';
// Import of WinSCP sessions: from the Windows registry (HKCU\Software\Martin Prikryl\WinSCP 2\Sessions) or from a WinSCP.ini file.
// Only the connection data is read (host, port, user, key file, protocol). Saved passwords are NOT imported.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// FSProtocol of WinSCP: 0 SCP, 1 SFTP (or SCP), 2 SFTP only, 5 FTP, 6 WebDAV, 7 S3 ...
const PROTO_NAME = { 0: 'SCP', 1: 'SFTP', 2: 'SFTP', 5: 'FTP', 6: 'WebDAV', 7: 'S3' };

function decodeName(s) {
  try { return decodeURIComponent(s.replace(/\+/g, '%2B')); } catch { return s; }
}

function toSession(name, v) {
  const proto = v.FSProtocol === undefined ? 1 : +v.FSProtocol;
  const s = {
    name: decodeName(name).replace(/\//g, ' / '),
    host: v.HostName || '',
    port: v.PortNumber ? +v.PortNumber : proto === 5 ? 21 : proto === 6 ? (+v.Ftps ? 443 : 80) : 22,
    user: v.UserName || '',
    keyFile: (v.PublicKeyFile || '').replace(/%([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16))),
    protocol: PROTO_NAME[proto] || 'protocol ' + proto,
    kind: proto === 5 ? 'ftp' : proto === 6 ? 'webdav' : 'ssh', // what the connection becomes in the program
    ftps: +v.Ftps || 0, // WinSCP: 0 none, 1 implicit TLS, 2 / 3 explicit TLS
    dir: decodeName(v.RemoteDirectory || ''),
    importable: proto === 0 || proto === 1 || proto === 2 || proto === 5 || proto === 6,
  };
  if (!s.host) s.importable = false;
  return s;
}

function parseIni(text) {
  const out = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const sec = /^\[Sessions\\(.+)\]$/.exec(line);
    if (sec) { cur = { name: sec[1], v: {} }; out.push(cur); continue; }
    if (/^\[/.test(line)) { cur = null; continue; }
    const kv = /^([^=]+)=(.*)$/.exec(line);
    if (cur && kv) cur.v[kv[1].trim()] = kv[2];
  }
  return out.filter((s) => !/^Default( |%20)Settings$/i.test(s.name)).map((s) => toSession(s.name, s.v));
}

function readRegistry() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    execFile('reg', ['query', 'HKCU\\Software\\Martin Prikryl\\WinSCP 2\\Sessions', '/s'], { timeout: 8000, windowsHide: true, encoding: 'buffer', maxBuffer: 16 << 20 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const sessions = [];
      let cur = null;
      for (const line of Buffer.from(stdout).toString('utf8').split(/\r?\n/)) {
        const key = /^HKEY_CURRENT_USER\\.*\\WinSCP 2\\Sessions\\(.+)$/.exec(line);
        if (key) { cur = { name: key[1], v: {} }; sessions.push(cur); continue; }
        const val = /^\s+(\S+)\s+REG_(\w+)\s+(.*)$/.exec(line);
        if (val && cur) cur.v[val[1]] = val[2] === 'DWORD' ? String(parseInt(val[3], 16)) : val[3];
      }
      resolve(sessions.filter((s) => s.v.HostName !== undefined && !/^Default( |%20)Settings$/i.test(s.name)).map((s) => toSession(s.name, s.v)));
    });
  });
}

/** sessions from the registry; when it has none (portable WinSCP), from WinSCP.ini next to the user's profile or from iniPath */
async function list(iniPath) {
  if (iniPath) return { source: iniPath, sessions: parseIni(await fs.promises.readFile(iniPath, 'utf8')) };
  const reg = await readRegistry();
  if (reg.length) return { source: 'registry', sessions: reg };
  const cands = [process.env.APPDATA && path.join(process.env.APPDATA, 'WinSCP.ini'), process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'Documents', 'WinSCP.ini')].filter(Boolean);
  for (const f of cands) {
    try { const sessions = parseIni(await fs.promises.readFile(f, 'utf8')); if (sessions.length) return { source: f, sessions }; } catch { /* next */ }
  }
  return { source: null, sessions: [] };
}

module.exports = { list, parseIni };
