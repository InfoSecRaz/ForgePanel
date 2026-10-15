const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { resolveSafePath } = require('../services/pathSafety');

const root = path.resolve('/srv/fp/server-1/data');

test('resolves paths inside the root', () => {
  assert.strictEqual(resolveSafePath(root, 'world/save.dat'), path.join(root, 'world/save.dat'));
  assert.strictEqual(resolveSafePath(root, ''), root);
  assert.strictEqual(resolveSafePath(root, '/etc/passwd'), path.join(root, 'etc/passwd'));
});

test('rejects traversal outside the root', () => {
  assert.throws(() => resolveSafePath(root, '../../etc/passwd'));
  assert.throws(() => resolveSafePath(root, 'a/../../..'));
});

test('rejects sibling directories sharing the root prefix', () => {
  assert.throws(() => resolveSafePath(root, '../data-other/x'));
});
