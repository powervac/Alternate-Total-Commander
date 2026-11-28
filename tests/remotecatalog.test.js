'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cat = require('../src/main/remotecatalog');

const f = (name, size = 1) => ({ name, isDir: false, size, mtime: 1000 });
const d = (name, extra) => ({ name, isDir: true, size: -1, mtime: 1000, ...extra });
const TREE = {
  '/': [d('photo'), d('docs'), d('@eaDir'), d('link', { link: true }), f('root.txt')],
  '/photo': [f('Summer.HEIC', 50), f('summer.jpg', 70), d('2025'), d('#recycle')],
  '/photo/2025': [f('winter.jpg'), f('note.tmp')],
  '/docs': [f('отчёт.docx')],
};
const server = (tree = TREE, asked = []) => ({
  list: async (p) => { asked.push(p); if (!(p in tree)) throw new Error('no such folder'); return tree[p]; },
});

test('walks all folders, skips the service folders of a NAS and does not follow links', async () => {
  const asked = [];
  const w = await cat.crawl(server(TREE, asked), '/');
  assert.deepStrictEqual(asked.sort(), ['/', '/docs', '/photo', '/photo/2025']);
  assert.ok(!w.entries.some((e) => e[1] === '@eaDir' || e[1] === '#recycle'));
  assert.ok(w.entries.some((e) => e[1] === 'link'));
  assert.strictEqual(w.partial, false);
  assert.strictEqual(w.failed, 0);
});

test('a folder that cannot be read is skipped; the first one is an error', async () => {
  const broken = { ...TREE };
  delete broken['/docs'];
  const w = await cat.crawl(server(broken), '/');
  assert.strictEqual(w.failed, 1);
  assert.ok(w.entries.some((e) => e[1] === 'winter.jpg'));
  await assert.rejects(cat.crawl(server(broken), '/nothing'), /no such folder/);
});

test('a lost connection ends the walk with the error', async () => {
  const many = { '/': Array.from({ length: 40 }, (_x, i) => d('d' + i)) };
  await assert.rejects(cat.crawl(server(many), '/', { maxFailures: 5 }), /no such folder/);
});

test('stop and the size limit give a database marked as not complete', async () => {
  let n = 0;
  const w = await cat.crawl(server(), '/', { parallel: 1, cancelled: () => n++ > 1 });
  assert.strictEqual(w.partial, true);
  assert.strictEqual((await cat.crawl(server(), '/', { maxEntries: 3 })).entries.length, 3);
});

test('saved, loaded, searched and deleted', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cattest-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.strictEqual(await cat.load(dir, 'nas-1'), null);
  const info = await cat.save(dir, 'nas-1', await cat.crawl(server(), '/'), 'My NAS');
  assert.ok(info.count > 5 && info.root === '/' && info.built > 0);
  const data = await cat.load(dir, 'nas-1');
  const names = (q) => cat.search(data, { masks: q.mask, roots: q.under ? [q.under] : undefined }).items.map((x) => x.dir + ' ' + x.name).sort();
  assert.deepStrictEqual(names({ mask: 'summer' }), ['/photo Summer.HEIC', '/photo summer.jpg']);
  assert.deepStrictEqual(names({ mask: '*.jpg' }), ['/photo summer.jpg', '/photo/2025 winter.jpg']);
  assert.deepStrictEqual(names({ mask: '*.jpg', under: '/photo/2025' }), ['/photo/2025 winter.jpg']);
  assert.deepStrictEqual(names({ mask: '*.jpg | 2025/' }), ['/photo summer.jpg']);
  assert.deepStrictEqual(names({ mask: 'отч' }), ['/docs отчёт.docx']);
  const limited = cat.search(data, { masks: '' }, { limit: 2 });
  assert.ok(limited.items.length === 2 && limited.total === data.entries.length);
  // another connection has its own file; a damaged one counts as none
  assert.strictEqual(await cat.load(dir, 'nas-2'), null);
  fs.writeFileSync(cat.fileOf(dir, 'nas-2'), 'not gzip');
  assert.strictEqual(await cat.load(dir, 'nas-2'), null);
  await cat.remove(dir, 'nas-1');
  assert.strictEqual(await cat.load(dir, 'nas-1'), null);
});

test('a name with an extension is a whole file name, a word means "contains"', () => {
  const { parseMasks } = require('../src/main/searchengine');
  const ok = (mask, name) => parseMasks(mask).inc.some((r) => r.test(name));
  assert.ok(ok('103.jpg', '103.JPG'));
  assert.ok(!ok('103.jpg', 'DSC06103.JPG'));
  assert.ok(!ok('103.jpg', '103.jpg.bak'));
  assert.ok(ok('*103.jpg', 'DSC06103.JPG'));
  assert.ok(ok('103', 'DSC06103.JPG'));
  assert.ok(ok('0.1.943', 'Setup 0.1.943.exe'));
  assert.ok(ok('Dr. Smith', 'letter to Dr. Smith.txt'));
});

test('the filters of Find Files work on the database', () => {
  const day = 864e5;
  const now = Date.now();
  const data = {
    root: '/', dirs: ['/', '/photo', '/photo/2025', '/node_modules'],
    entries: [
      [0, 'photo', -1, now, 1], [1, '2025', -1, now, 1], [0, '.hidden.txt', 5, now, 0],
      [1, '103.jpg', 100, now - 400 * day, 0], [1, 'DSC06103.JPG', 5000000, now, 0],
      [2, '103.jpg', 100, now, 0], [3, 'x.js', 1, now, 0],
    ],
  };
  const got = (p) => cat.search(data, p).items.map((x) => x.dir + ' ' + x.name).sort();
  assert.deepStrictEqual(got({ masks: '103.jpg' }), ['/photo 103.jpg', '/photo/2025 103.jpg']);
  assert.deepStrictEqual(got({ masks: '*103.jpg', size: { op: '>', value: 1, unit: 'mb' } }), ['/photo DSC06103.JPG']);
  assert.deepStrictEqual(got({ masks: '*.jpg', notOlder: { n: 1, unit: 'year' } }), ['/photo DSC06103.JPG', '/photo/2025 103.jpg']);
  assert.deepStrictEqual(got({ masks: '*.jpg', older: { n: 1, unit: 'year' } }), ['/photo 103.jpg']);
  assert.deepStrictEqual(got({ masks: '*.jpg', dateFrom: now - day, dateTo: now + day, roots: ['/photo/2025/'] }), ['/photo/2025 103.jpg']);
  assert.deepStrictEqual(got({ masks: '*', roots: ['/photo'], depth: 0 }), ['/photo 103.jpg', '/photo 2025', '/photo DSC06103.JPG']);
  assert.deepStrictEqual(got({ masks: '*|node_modules/', attrs: { dir: false } }).filter((x) => x.includes('x.js')), []);
  assert.deepStrictEqual(got({ attrs: { dir: true } }), ['/ photo', '/photo 2025']);
  assert.deepStrictEqual(got({ attrs: { hidden: true } }), ['/ .hidden.txt']);
  const dup = cat.search(data, { dups: { name: true, size: true } });
  assert.deepStrictEqual([dup.groups, dup.total, dup.items.map((x) => x.group)], [1, 2, [1, 1]]);
});
