require('./support/mock-electron');
const test = require('node:test');
const assert = require('node:assert/strict');
const { ALLOWLIST } = require('../src/engine/residueFinder');

test('allowlist protects known Windows infrastructure folders', () => {
  assert.equal(ALLOWLIST.has('common files'), true);
  assert.equal(ALLOWLIST.has('windowsapps'), true);
  assert.equal(ALLOWLIST.has('windows defender'), true);
});

test('allowlist does not blanket-allow arbitrary vendor folder names', () => {
  assert.equal(ALLOWLIST.has('some random leftover app'), false);
});
