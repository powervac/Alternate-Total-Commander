'use strict';
// The .ini file of the favorites bar (src/renderer/favini.js): what is written can be read again, and a file written by hand is understood.
const test = require('node:test');
const assert = require('node:assert/strict');
const { FAV_ICON_NAMES, favIconOk, favIniWrite, favIniParse, favIniMerge } = require('../src/renderer/favini.js');

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('write and read give the same list', () => {
  const list = [
    { label: 'UD', name: 'User Documents', path: '$HOME/Documents', icon: 'documents' },
    { label: '', name: '', path: '\\\\server\\share', icon: PNG },
    { label: 'NM', name: 'Media = a;b [c]', path: '/mnt/media #1', conn: { id: 'c1', type: 'nas', name: 'My NAS' } },
  ];
  assert.deepEqual(favIniParse(favIniWrite(list)), list);
});

test('a file written by hand: BOM, comments, quotes, other sections, any case', () => {
  const ini = '﻿# own file\n[Settings]\nPath=/not/this\n\n[favorite]\n  LABEL = UD \n Path="/home/me/My Documents"\n; comment\nnonsense\n=nothing\n[Favourite 2]\nLabel=A123456789012345\nPath=~\n[Favorite3]\nLabel=no path\n';
  assert.deepEqual(favIniParse(ini), [
    { label: 'UD', name: '', path: '/home/me/My Documents' },
    { label: 'A12345678901', name: '', path: '~' },
  ]);
  assert.deepEqual(favIniParse(''), []);
  assert.deepEqual(favIniParse(null), []);
});

test('Mac line ends and values with line breaks', () => {
  assert.equal(favIniParse('[Favorite1]\rPath=/a\r').length, 1);
  const text = favIniWrite([{ label: 'a\nb', name: 'x\r\n[Favorite9]\r\nPath=/evil', path: '/p' }]);
  const back = favIniParse(text);
  assert.equal(back.length, 1);
  assert.equal(back[0].path, '/p');
});

test('only built-in names and small PNG pictures are icons', () => {
  for (const n of FAV_ICON_NAMES) assert.equal(favIconOk(n), n);
  assert.equal(favIconOk(PNG), PNG);
  for (const bad of ['', undefined, 'nope', 'javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,AA"><script>', 'https://x/y.png', 'data:image/png;base64,' + 'A'.repeat(30000)]) {
    assert.equal(favIconOk(bad), '', String(bad).slice(0, 40));
  }
  assert.equal(favIniParse('[Favorite1]\nPath=/a\nIcon=<img>\n')[0].icon, undefined);
});

test('merge does not double what is there', () => {
  const have = [{ label: 'A', path: '/a' }];
  const r = favIniMerge(have, [{ label: 'A', path: '/a' }, { label: 'B', path: '/a' }, { label: 'B', path: '/a' }, { label: 'A', path: '/a', conn: { id: 'x' } }]);
  assert.equal(r.added, 2);
  assert.equal(r.list.length, 3);
  assert.equal(have.length, 1);
});
