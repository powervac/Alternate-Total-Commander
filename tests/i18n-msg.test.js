'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { I18N_MSG, I18N_MSG_COLS, trMsg, dateText } = require('../src/renderer/i18n-msg');

test('every message has all languages and keeps its places', () => {
  const places = (s) => (s.match(/\{#?\d\}/g) || []).map((x) => x.replace('#', '')).sort().join();
  for (const row of I18N_MSG) {
    assert.strictEqual(row.length, I18N_MSG_COLS.length + 1, row[0]);
    for (const t of row.slice(1)) assert.strictEqual(places(t), places(row[0]), `${row[0]} -> ${t}`);
  }
});

test('names and numbers go into the translation as they are', () => {
  assert.strictEqual(trMsg('Copy "a $1.txt" to:', 'de'), '„a $1.txt“ kopieren nach:');
  assert.strictEqual(trMsg('1,234 k of 5,678 k free', 'ru'), '1,234 к из 5,678 к свободно');
  assert.strictEqual(trMsg('13 bytes - utf-8', 'ru'), 'байт: 13 - utf-8');
  assert.strictEqual(trMsg('line 1 / 2   100 %', 'it'), 'riga 1 / 2   100 %');
  assert.strictEqual(trMsg('Already exist in the target folder:\na\nb', 'ru'), 'Уже есть в папке назначения:\na\nb');
});

test('the exact message wins over the general one', () => {
  assert.strictEqual(trMsg('13 bytes, showing first 5 - utf-8', 'pt'), '13 bytes, mostrando os primeiros 5 - utf-8');
  assert.strictEqual(trMsg('Move "x" to the Trash?', 'ru'), 'Переместить «x» в корзину?');
  assert.strictEqual(trMsg('Move "x" to:', 'ru'), 'Переместить «x» в:');
});

test('other text and English stay as they are', () => {
  assert.strictEqual(trMsg('readme.txt', 'ru'), null);
  assert.strictEqual(trMsg('Copy "a" to:', 'en'), null);
});

test('dates follow the language', () => {
  assert.strictEqual(dateText('27', '11', 2026, 'en'), '11/27/2026');
  assert.strictEqual(dateText('27', '11', 2026, 'ru'), '27.11.2026');
  assert.strictEqual(dateText('27', '11', 2026, 'it'), '27/11/2026');
});
