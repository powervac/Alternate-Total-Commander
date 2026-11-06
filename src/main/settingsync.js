'use strict';
// Settings kept in one zip: Dropbox or Google Drive (/Commander/settings.zip) or a folder on this computer (settings.zip). The zip holds
//   settings.json   connections without passwords, favourites, presets, language ... (the renderer decides what goes in and how copies merge)
//   secrets.json    passwords and logins (optional)
//   keys/<id>__<name>  the SSH private key files (optional)
// The zip can be protected with a password (AES-256, opens in 7-Zip / WinRAR too); without a password it is a plain zip.
// An older /Commander/settings.json is still read when there is no zip yet. This module reads and writes the file with the Dropbox
// login that is saved (encrypted by the system) in one of the program's connections.
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { Dropbox, GDrive } = require('./cloud');
const { run } = require('./sevenzip');

const FOLDER = 'Commander';
const ZIP = 'settings.zip';
const OLD = 'settings.json';

/** a plain folder on this computer (or on a USB stick / a synced folder): the same few calls as the cloud clients */
class LocalStore {
  constructor(dir) { this.dir = dir; }
  async download(remote, dest) {
    try { await fsp.copyFile(path.join(this.dir, path.basename(remote)), dest); } catch (e) { if (e.code === 'ENOENT') throw new Error('not found'); throw e; }
  }
  async mkdir() { await fsp.mkdir(this.dir, { recursive: true }); }
  async upload(local, _folder, name) {
    await fsp.mkdir(this.dir, { recursive: true });
    const tmp = path.join(this.dir, name + '.part');
    await fsp.copyFile(local, tmp);
    await fsp.rename(tmp, path.join(this.dir, name));
  }
}

/** st: { kind: 'dropbox', appKey, token } | { kind: 'gdrive', clientId, clientSecret, token } | { kind: 'local', dir } */
async function client(st) {
  if (st.kind === 'local') {
    if (!st.dir || !path.isAbsolute(st.dir)) throw new Error('Choose the folder for the settings file.');
    return new LocalStore(st.dir);
  }
  if (st.kind === 'gdrive') {
    const g = new GDrive();
    await g.connect({ clientId: st.clientId, clientSecret: st.clientSecret, refreshToken: st.token });
    return g;
  }
  const d = new Dropbox();
  await d.connect({ appKey: st.appKey, refreshToken: st.token });
  return d;
}
const tmpDir = () => fsp.mkdtemp(path.join(os.tmpdir(), 'commander-settings-'));
const rmQuiet = (p) => fsp.rm(p, { recursive: true, force: true }).catch(() => {});
const notFound = (err) => /not.?found|path\/not_found|does not exist/i.test(String(err && err.message));
/** the zip tool takes the password on its command line: plain keyboard characters only, no quotes or backslash */
const PW_OK = /^[ -~]+$/;
const checkPw = (p) => { if (p && (!PW_OK.test(p) || /["\\]/.test(p))) throw new Error('The password for the zip may contain only Latin letters, digits and symbols (no quotes and no backslash).'); };
const safe = (n) => String(n || 'key').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);

/** -> { text, secrets } | { empty: true } | { needPassword: true } | { wrongPassword: true } */
async function pull(st, password) {
  checkPw(password);
  const d = await client(st);
  const dir = await tmpDir();
  try {
    const zip = path.join(dir, ZIP);
    try {
      await d.download(`/${FOLDER}/${ZIP}`, zip, {});
    } catch (err) {
      if (!notFound(err)) throw err;
      // no zip yet: the older plain file
      try {
        await d.download(`/${FOLDER}/${OLD}`, path.join(dir, OLD), {});
        return { text: await fsp.readFile(path.join(dir, OLD), 'utf8'), secrets: null, legacy: true };
      } catch (e2) {
        if (notFound(e2)) return { empty: true };
        throw e2;
      }
    }
    const enc = /Encrypted = \+/.test(await run(['l', '-slt', zip]).catch(() => ''));
    if (enc && !password) return { needPassword: true };
    const out = path.join(dir, 'x');
    try {
      await run(['x', '-y', '-spd', '-bd', '-o' + out, ...(enc ? ['-p' + password] : []), zip]);
    } catch (e) {
      if (enc) return { wrongPassword: true };
      throw e;
    }
    const text = await fsp.readFile(path.join(out, 'settings.json'), 'utf8');
    let secrets = null;
    try { secrets = JSON.parse(await fsp.readFile(path.join(out, 'secrets.json'), 'utf8')); } catch { /* none */ }
    try {
      for (const f of await fsp.readdir(path.join(out, 'keys'))) {
        const m = /^(.+?)__(.+)$/.exec(f);
        if (!m) continue;
        secrets = secrets || {};
        secrets['key:' + m[1]] = { name: m[2], b64: (await fsp.readFile(path.join(out, 'keys', f))).toString('base64') };
      }
    } catch { /* no keys */ }
    return { text, secrets, encrypted: enc };
  } finally {
    rmQuiet(dir);
  }
}

/** text = settings.json; secrets = object or null; password '' = plain zip */
async function push(st, text, secrets, password) {
  checkPw(password);
  const d = await client(st);
  const dir = await tmpDir();
  try {
    const src = path.join(dir, 'src');
    await fsp.mkdir(path.join(src, 'keys'), { recursive: true });
    await fsp.writeFile(path.join(src, 'settings.json'), text, 'utf8');
    const rest = {};
    let anyKey = false;
    for (const [k, v] of Object.entries(secrets || {})) {
      if (k.startsWith('key:')) {
        anyKey = true;
        await fsp.writeFile(path.join(src, 'keys', `${safe(k.slice(4))}__${safe(v.name)}`), Buffer.from(String(v.b64), 'base64'));
      } else rest[k] = v;
    }
    if (secrets) await fsp.writeFile(path.join(src, 'secrets.json'), JSON.stringify(rest), 'utf8');
    if (!anyKey) await fsp.rmdir(path.join(src, 'keys'));
    const zip = path.join(dir, ZIP);
    const args = ['a', '-tzip', '-y', '-bd', '-mx=5'];
    if (password) args.push('-mem=AES256', '-p' + password);
    args.push(zip, '.' + path.sep + '*');
    await run(args, src);
    try { await d.mkdir('/', FOLDER); } catch { /* the folder exists */ }
    await d.upload(zip, `/${FOLDER}`, ZIP, true, {});
    return { ok: true };
  } finally {
    rmQuiet(dir);
  }
}

module.exports = { pull, push };
