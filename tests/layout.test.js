'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { clampSplit, PANEL_MIN_PX } = require('../src/renderer/layout');

test('the border keeps both panels usable', () => {
  assert.strictEqual(clampSplit(0.5, 1000), 0.5);
  assert.strictEqual(clampSplit(0.3, 1000), 0.3);
  assert.strictEqual(clampSplit(0.01, 1000), PANEL_MIN_PX / 1000);
  assert.strictEqual(clampSplit(0.99, 1000), 1 - PANEL_MIN_PX / 1000);
});

test('a narrow window and bad values give equal or sane panels', () => {
  assert.strictEqual(clampSplit(0.9, 200), 0.5);
  assert.strictEqual(clampSplit(NaN, 1000), 0.5);
  assert.strictEqual(clampSplit(0.01, 0), 0.1);
  assert.strictEqual(clampSplit(0.01, 100000), 0.1);
});

test('thumbnail size stays in its limits, in steps of 8', () => {
  const { clampThumb, THUMB_MIN, THUMB_MAX, THUMB_DEFAULT } = require('../src/renderer/layout');
  assert.strictEqual(clampThumb(10), THUMB_MIN);
  assert.strictEqual(clampThumb(5000), THUMB_MAX);
  assert.strictEqual(clampThumb(117), 120);
  for (const bad of [null, undefined, 'x', NaN, 0, -5]) assert.strictEqual(clampThumb(bad), THUMB_DEFAULT, String(bad));
});

test('bigger boxes and sharper screens ask for bigger pictures', () => {
  const { thumbRequest } = require('../src/renderer/layout');
  assert.strictEqual(thumbRequest(112, 1), 192);
  assert.strictEqual(thumbRequest(200, 1), 384);
  assert.strictEqual(thumbRequest(200, 2), 768);
  assert.strictEqual(thumbRequest(112, undefined), 192);
});
