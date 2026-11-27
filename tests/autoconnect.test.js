'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { autoDelay, autoIsRefused, autoCanConnect, AUTO_DELAYS } = require('../src/renderer/autoconnect');
const { within, macVolumes, existsSoon } = require('../src/main/volumes');

test('the pauses between tries grow and stop growing', () => {
  assert.strictEqual(autoDelay(1), AUTO_DELAYS[0]);
  assert.ok(autoDelay(3) > autoDelay(2));
  assert.strictEqual(autoDelay(99), AUTO_DELAYS[AUTO_DELAYS.length - 1]);
  assert.strictEqual(autoDelay(0), AUTO_DELAYS[0]);
});

test('a refused login is not repeated, a network trouble is', () => {
  assert.ok(autoIsRefused('Wrong user name or password', 400, 'nas'));
  assert.ok(autoIsRefused('2-step verification code required', 403, 'nas'));
  for (const e of ['Login failed: wrong user name or password.', 'All configured authentication methods failed', '530 Login incorrect.', 'Please sign in again']) assert.ok(autoIsRefused(e, undefined, 'ssh'), e);
  for (const e of ['Cannot reach the NAS: Connection timed out', 'connect ECONNREFUSED 192.168.1.2:22', 'getaddrinfo ENOTFOUND host', 'The server does not answer.']) assert.ok(!autoIsRefused(e, undefined, 'nas'), e);
  assert.ok(!autoIsRefused('The server answered 404', 404, 'webdav'), 'the codes of Synology count only for a NAS');
});

test('only a saved login (or none needed) connects by itself', () => {
  assert.ok(autoCanConnect({ pw: 'x' }, 'nas'));
  assert.ok(!autoCanConnect({ user: 'a' }, 'nas'));
  assert.ok(autoCanConnect({ keyPath: 'k' }, 'ssh'));
  assert.ok(autoCanConnect({ user: '' }, 'webdav') && autoCanConnect({ user: 'anonymous' }, 'ftp'));
  assert.ok(!autoCanConnect({ user: 'bob' }, 'ftp') && !autoCanConnect({}, 'dropbox'));
});

test('a question to a disk that does not answer ends in time', async () => {
  const never = new Promise(() => {});
  assert.strictEqual(await within(never, 30, 'gave up'), 'gave up');
  assert.strictEqual(await within(Promise.resolve(5), 30, 0), 5);
  await assert.rejects(within(Promise.reject(new Error('no')), 30, 0), /no/);
  assert.strictEqual(await existsSoon({ access: () => never }, '/Volumes/dead', 30), false);
  assert.strictEqual(await existsSoon(fs.promises, os.tmpdir()), true);
  assert.strictEqual(await existsSoon(fs.promises, path.join(os.tmpdir(), 'not-there-12345')), false);
});

test('the Mac disk list asks the volumes nothing and leaves out the startup disk', async () => {
  const entry = (name, link) => ({ name, isSymbolicLink: () => !!link });
  const asked = [];
  const fake = {
    readdir: async (p) => { asked.push('readdir ' + p); return [entry('Macintosh HD', true), entry('NAS share'), entry('Other link', true), entry('Dead link', true)]; },
    readlink: async (p) => { asked.push('readlink ' + p); if (p.endsWith('Dead link')) return new Promise(() => {}); return p.endsWith('Macintosh HD') ? '/' : '/mnt/x'; },
  };
  const list = await macVolumes(fake, '/Volumes', 30);
  assert.deepStrictEqual(list.map((v) => v.label), ['NAS share', 'Other link', 'Dead link']);
  assert.ok(!asked.some((a) => a === 'readdir /Volumes/NAS share'));
  // even /Volumes itself not answering gives an empty list instead of a hang
  assert.deepStrictEqual(await macVolumes({ readdir: () => new Promise(() => {}) }, '/Volumes', 30), []);
});
