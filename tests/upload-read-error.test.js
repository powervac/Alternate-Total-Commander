'use strict';
// A local file that cannot be read (a Dropbox file kept only in the cloud, a pulled-out stick) must end the upload with an error.
// Before, the request kept waiting for the data and the upload window hung at 0 %. A folder given as the file fails the same way: at read.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const { Davfs } = require('../src/main/davclient');
const { Syno } = require('../src/main/synology');

/** a server that reads everything and answers only when the whole body has arrived */
function server(t) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      req.on('data', () => {});
      req.on('end', () => {
        if (req.method === 'PROPFIND') { res.writeHead(207); return res.end('<d:multistatus xmlns:d="DAV:"/>'); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"success":true}');
      });
    });
    s.listen(0, '127.0.0.1', () => { t.after(() => { s.closeAllConnections(); s.close(); }); resolve(`http://127.0.0.1:${s.address().port}`); });
  });
}

const soon = (p) => Promise.race([p, new Promise((_r, reject) => setTimeout(() => reject(new Error('the upload hangs')), 4000).unref())]);
const unreadable = os.tmpdir();

test('WebDAV: an unreadable source ends the upload with its error', async (t) => {
  const c = new Davfs();
  await c.connect({ url: await server(t) });
  await assert.rejects(soon(c.upload(unreadable, '/', 'x.bin', true)), (e) => !/hangs/.test(e.message) && /EISDIR|illegal operation|read/i.test(e.message));
});

test('Synology: an unreadable source ends the upload with its error', async (t) => {
  const c = new Syno();
  c.base = await server(t);
  c.sid = 'x';
  await assert.rejects(soon(c.upload(unreadable, '/share', 'x.bin', true)), (e) => !/hangs/.test(e.message));
});
