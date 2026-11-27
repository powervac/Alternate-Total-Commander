'use strict';
// The address of a Synology NAS: the local network must win over the internet, and the QuickConnect relay is the last choice
// (a NAS in the same network used to be reached through the relay, with the speed of the internet connection).
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { Syno } = require('../src/main/synology.js');

const SERVER_ID = '0123456789';
const EZID = crypto.createHash('md5').update(SERVER_ID).digest('hex');
const INFO = {
  server: { serverID: SERVER_ID, ddns: 'home.synology.me', fqdn: 'NULL', external: { ip: '203.0.113.7' }, interface: [{ ip: '192.168.1.20' }] },
  service: { port: 5001, ext_port: 15001 },
  smartdns: { lan: ['192-168-1-20.abc.direct.quickconnect.to'], external: 'abc.direct.quickconnect.to' },
};
const real = Syno.fetchJson;
let asked = [];
/** answers = function(url) -> true when the address answers like a NAS */
function fake(answers, pong = EZID) {
  asked = [];
  Syno.fetchJson = async (url) => {
    if (url.includes('/Serv.php')) return { data: INFO, url };
    asked.push(url);
    if (!answers(url)) throw new Error('Connection timed out');
    if (url.includes('pingpong')) return { data: { ezid: pong }, url };
    return { data: { success: true, data: { 'SYNO.API.Auth': { maxVersion: 6 } } }, url };
  };
}
test.afterEach(() => { Syno.fetchJson = real; });

test('a QuickConnect id: local network first, the relay last', async () => {
  fake(() => true);
  const c = await Syno.candidates('mynas');
  assert.deepStrictEqual([...new Set(c.map((x) => x.route))], ['lan', 'direct', 'relay']);
  assert.strictEqual(c[0].url, 'https://192-168-1-20.abc.direct.quickconnect.to:5001');
  assert.strictEqual(c[c.length - 1].url, 'https://mynas.quickconnect.to');
  assert.ok(c.some((x) => x.url === 'https://home.synology.me:15001' && x.route === 'direct'));
  assert.ok(!c.some((x) => x.url.includes('NULL')));
});

test('at home the local address is used even though the relay answers too', async () => {
  fake(() => true);
  const s = new Syno();
  const r = await s.findBase(await Syno.candidates('mynas'));
  assert.strictEqual(r.route, 'lan');
  assert.match(r.base, /192-168-1-20/);
  assert.ok(!asked.some((u) => u.startsWith('https://mynas.quickconnect.to')));
});

test('away from home: direct, and the relay only when nothing else answers', async () => {
  fake((u) => !u.includes('192'));
  let r = await new Syno().findBase(await Syno.candidates('mynas'));
  assert.strictEqual(r.route, 'direct');
  fake((u) => u.startsWith('https://mynas.quickconnect.to'));
  r = await new Syno().findBase(await Syno.candidates('mynas'));
  assert.strictEqual(r.route, 'relay');
});

test('nothing answers: a clear error', async () => {
  fake(() => false);
  await assert.rejects(new Syno().findBase(await Syno.candidates('mynas')), /Cannot reach the NAS/);
});

test('unchecked certificate: another device at the local address of the NAS is not used', async () => {
  const onlyBare = (u) => u.includes('//192.168.1.20') || u.startsWith('https://mynas.quickconnect.to');
  fake(onlyBare, 'somebody-else');
  const s = new Syno();
  s.insecure = true;
  assert.strictEqual((await s.findBase(await Syno.candidates('mynas'))).route, 'relay');
  fake(onlyBare);
  assert.strictEqual((await s.findBase(await Syno.candidates('mynas'))).route, 'lan');
});

test('addresses typed by hand and what counts as local', async () => {
  fake(() => true);
  assert.deepStrictEqual((await Syno.candidates('192.168.1.20')).map((c) => c.url), ['https://192.168.1.20:5001', 'http://192.168.1.20:5000', 'https://192.168.1.20']);
  assert.strictEqual((await Syno.candidates('http://nas.local:5000'))[0].route, 'lan');
  assert.strictEqual((await Syno.candidates('nas.example.com'))[0].route, 'direct');
  for (const h of ['10.0.0.5', '172.16.4.1', '172.31.255.1', '192.168.0.1', 'fd12:3456::1', '[fe80::1]', 'box.lan']) assert.ok(Syno.isLocal(h), h);
  for (const h of ['172.32.0.1', '8.8.8.8', '192.169.1.1', '10.example.com', 'example.com', '2001:db8::1']) assert.ok(!Syno.isLocal(h), h);
});
