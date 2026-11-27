'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { errorText } = require('../src/main/errortext');
const { Davfs } = require('../src/main/davclient');

test('an error never comes out empty', () => {
  assert.strictEqual(errorText(new Error('boom')), 'boom');
  const both = Object.assign(new Error(''), { code: 'ECONNREFUSED', errors: [new Error('connect ECONNREFUSED ::1:1'), new Error('connect ECONNREFUSED 127.0.0.1:1')] });
  assert.strictEqual(errorText(both), 'connect ECONNREFUSED ::1:1');
  assert.strictEqual(errorText(Object.assign(new Error(''), { code: 'ETIMEDOUT' })), 'ETIMEDOUT');
  for (const e of [new Error(''), {}, undefined, null]) assert.ok(errorText(e).length > 0);
});

test('a server that is not there is an error with a text', async () => {
  await assert.rejects(new Davfs().connect({ url: 'http://localhost:1', timeout: 8000 }), (e) => e.message.length > 0 && /refused|ECONNREFUSED|answer/i.test(e.message));
});
