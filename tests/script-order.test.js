'use strict';
// The panels are drawn by app.js as soon as it is loaded: what it calls for that must be loaded before it.
// (0.1.936 / 0.1.937: i18n-msg.js came after app.js and the panels stayed empty on some starts.)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const scripts = (page) => [...fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', page), 'utf8').matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);

for (const [page, user] of [['index.html', 'app.js'], ['find.html', 'findshim.js']]) {
  test(page + ': the date helper is loaded before ' + user, () => {
    const list = scripts(page);
    assert.ok(list.indexOf('i18n-msg.js') >= 0 && list.indexOf('i18n-msg.js') < list.indexOf(user), list.join(' '));
  });
}

test('the panels are created only after every script of the page is loaded', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'app.js'), 'utf8');
  const init = app.slice(app.indexOf('(async function init()'));
  const wait = init.indexOf("addEventListener('DOMContentLoaded'");
  assert.ok(wait > 0 && wait < init.indexOf('new Panel('));
});
