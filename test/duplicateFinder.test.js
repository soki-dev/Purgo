require('./support/mock-electron');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { scanDuplicates } = require('../src/engine/duplicateFinder');

test('scanDuplicates groups identical files by content and ignores different ones', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'purgo-dup-test-'));
  const content = 'x'.repeat(5000); // über der 4KB-Mindestgröße
  fs.writeFileSync(path.join(dir, 'a.txt'), content);
  fs.writeFileSync(path.join(dir, 'b.txt'), content);
  fs.writeFileSync(path.join(dir, 'c.txt'), 'y'.repeat(5000));

  const groups = await scanDuplicates(dir);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].files.length, 2);
  assert.equal(groups[0].wastedBytes, 5000);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('scanDuplicates ignores files under excluded paths', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'purgo-dup-test-'));
  const sub = path.join(dir, 'excluded');
  fs.mkdirSync(sub);
  const content = 'z'.repeat(5000);
  fs.writeFileSync(path.join(dir, 'a.txt'), content);
  fs.writeFileSync(path.join(sub, 'b.txt'), content);

  const groups = await scanDuplicates(dir, [sub]);
  assert.equal(groups.length, 0);

  fs.rmSync(dir, { recursive: true, force: true });
});
