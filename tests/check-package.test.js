'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { problems } = require('../tools/check-package');
const pkg = require('../package.json');

const good = [['src/main/main.js', 1000], ['node_modules/yauzl/index.js', 1000], ['build/icon.png', 100], ['package.json', 100]];

test('only the program passes', () => assert.deepStrictEqual(problems(good), []));

test('project files and old builds are refused', () => {
  for (const extra of ['PROJECT_NOTES.md', 'dist/old.exe', 'docs/a.png', 'tools/release.js', 'build/other.log']) {
    assert.strictEqual(problems([...good, [extra, 10]]).length, 1, extra);
  }
});

test('a package that grew too big is refused', () => {
  assert.match(problems([...good, ['node_modules/x/big.bin', 400e6]])[0], /400 MB/);
});

test('every system names what to take, not only what to leave out, and the build is checked', () => {
  for (const os of ['mac', 'win', 'linux']) {
    const files = pkg.build[os].files;
    if (files) for (const need of pkg.build.files) assert.ok(files.includes(need), `${os}: ${need}`);
  }
  assert.strictEqual(pkg.build.afterPack, 'tools/check-package.js');
});
