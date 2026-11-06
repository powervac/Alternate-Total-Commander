'use strict';
// SSH private key files: a protected folder of the program (userData/ssh-keys) that holds copies of imported keys (WinSCP import) and keys
// restored from the settings sync. Nothing leaves this folder unencrypted: the sync puts the key text into the passphrase-encrypted block.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const MAX_KEY = 64 * 1024;

/** what kind of key file is this, and can the SSH library use it? */
function inspect(text) {
  const t = String(text);
  const ppk = /^PuTTY-User-Key-File-(\d+): (\S+)/.exec(t);
  if (ppk) {
    const ver = +ppk[1], algo = ppk[2];
    // version 2 and 3 of RSA, ed25519 and ECDSA keys are converted by the program (ppk.js); DSA only in the old version 2 that the SSH library reads itself
    const supported = require('./ppk').SUPPORTED.includes(algo) || (ver === 2 && algo === 'ssh-dss');
    return { format: 'ppk' + ver, supported, reason: supported ? '' : `The key type ${algo} is not supported: convert it to OpenSSH format with PuTTYgen (Conversions > Export OpenSSH key)` };
  }
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)) return { format: 'openssh/pem', supported: true, reason: '' };
  return { format: 'unknown', supported: false, reason: 'This does not look like a private key file' };
}

const safeName = (n) => String(n || 'key').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'key';

async function dir(app) {
  const d = path.join(app.getPath('userData'), 'ssh-keys');
  await fsp.mkdir(d, { recursive: true, mode: 0o700 });
  return d;
}

/** write key text into the key folder (a name unique per connection id); returns { path, name, ...inspect } */
async function save(app, id, name, text) {
  const d = await dir(app);
  const file = path.join(d, `${safeName(id)}__${safeName(name)}`);
  await fsp.writeFile(file, text, { mode: 0o600 });
  try { await fsp.chmod(file, 0o600); } catch { /* windows */ }
  return { path: file, name: safeName(name), ...inspect(text) };
}

async function readKey(file) {
  const st = await fsp.stat(file);
  if (!st.isFile() || st.size > MAX_KEY) throw new Error('Not a key file');
  return fsp.readFile(file, 'utf8');
}

function register(ipcMain, app) {
  const handle = (name, fn) => ipcMain.handle(name, async (_e, a) => { try { return await fn(a || {}); } catch (err) { return { error: err.message }; } });
  // copy a key file into the program's key folder
  handle('keys:store', async ({ path: p, id }) => save(app, id || crypto.randomBytes(4).toString('hex'), path.basename(p), await readKey(p)));
  // the text of a key file (for the encrypted sync block)
  handle('keys:read', async ({ path: p }) => { const text = await readKey(p); return { name: path.basename(p), b64: Buffer.from(text, 'utf8').toString('base64'), ...inspect(text) }; });
  // restore a key from the sync block
  handle('keys:write', async ({ id, name, b64 }) => save(app, id, name, Buffer.from(String(b64), 'base64').toString('utf8')));
  handle('keys:inspect', async ({ path: p }) => inspect(await readKey(p)));
}

module.exports = { register, inspect };
