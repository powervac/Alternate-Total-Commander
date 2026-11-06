'use strict';
// Settings kept in Dropbox: /Commander/settings.json (connections without passwords, favourites, presets, language ...).
// The renderer decides what goes into the file and how two copies are merged; this module only reads and writes it with the
// Dropbox login that is saved (encrypted by the system) in one of the program's connections.
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { Dropbox } = require('./cloud');

const FOLDER = 'Commander';
const FILE = 'settings.json';

async function client(appKey, token) {
  const d = new Dropbox();
  await d.connect({ appKey, refreshToken: token });
  return d;
}
const tmpName = () => path.join(os.tmpdir(), `commander-settings-${process.pid}-${Date.now()}.json`);

/** -> { text } | { empty: true } */
async function pull(appKey, token) {
  const d = await client(appKey, token);
  const tmp = tmpName();
  try {
    await d.download(`/${FOLDER}/${FILE}`, tmp, {});
    return { text: await fsp.readFile(tmp, 'utf8') };
  } catch (err) {
    if (/not.?found|path\/not_found|does not exist/i.test(String(err && err.message))) return { empty: true };
    throw err;
  } finally {
    fsp.rm(tmp, { force: true }).catch(() => {});
  }
}

async function push(appKey, token, text) {
  const d = await client(appKey, token);
  try { await d.mkdir('/', FOLDER); } catch { /* the folder exists */ }
  const tmp = tmpName();
  try {
    await fsp.writeFile(tmp, text, 'utf8');
    await d.upload(tmp, `/${FOLDER}`, FILE, true, {});
    return { ok: true };
  } finally {
    fsp.rm(tmp, { force: true }).catch(() => {});
  }
}

module.exports = { pull, push };
