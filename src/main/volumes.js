'use strict';
// The list of disks of macOS / Linux and "does this folder exist" - without ever waiting for a disk that does not answer. A network volume
// that fell asleep or lost its server makes every call into it hang: the drive list must not ask the volumes anything, and every question
// about a path has a time limit. (The drive selection could hang on a Mac until the program was restarted.)
const path = require('path');

/** the promise, or `fallback` after ms */
function within(promise, ms, fallback) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(fallback), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * [{ path, label }] of the entries of /Volumes. Only the folder /Volumes itself is read: the kind of an entry comes with its listing, and a
 * link is read as a link. "Macintosh HD" (a link to "/") is left out, "/" is in the list already.
 */
async function macVolumes(fsp, dir = '/Volumes', ms = 1500) {
  const entries = await within(fsp.readdir(dir, { withFileTypes: true }), ms, []);
  const out = [];
  for (const e of entries) {
    const full = path.posix.join(dir, e.name);
    if (e.isSymbolicLink()) {
      const target = await within(fsp.readlink(full), ms, '').catch(() => '');
      if (target === '/') continue;
    }
    out.push({ path: full, label: e.name });
  }
  return out;
}

/** true / false; a disk that does not answer in time counts as not there */
const existsSoon = (fsp, p, ms = 1500) => within(fsp.access(p).then(() => true, () => false), ms, false);

module.exports = { within, macVolumes, existsSoon };
