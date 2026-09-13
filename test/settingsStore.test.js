require('./support/mock-electron');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const settingsPath = path.join(os.tmpdir(), 'purgo-test-userdata', 'settings.json');
function reset() {
  try { fs.unlinkSync(settingsPath); } catch { /* file may not exist yet */ }
}

test('isExcluded matches path prefixes case-insensitively', () => {
  reset();
  const { isExcluded } = require('../src/engine/settingsStore');
  const settings = { excludedPaths: ['C:\\Users\\Test\\AppData\\Local\\Foo'] };
  assert.equal(isExcluded('c:\\users\\test\\appdata\\local\\foo\\bar.txt', settings), true);
  assert.equal(isExcluded('C:\\Users\\Test\\AppData\\Local\\Bar', settings), false);
});

test('updateSettings merges nested scheduler/security without clobbering siblings', () => {
  reset();
  const { updateSettings } = require('../src/engine/settingsStore');
  updateSettings({ scheduler: { enabled: true } });
  const after = updateSettings({ scheduler: { frequency: 'daily' } });
  assert.equal(after.scheduler.enabled, true);
  assert.equal(after.scheduler.frequency, 'daily');
});

test('getSettings falls back to defaults when no settings file exists', () => {
  reset();
  const { getSettings } = require('../src/engine/settingsStore');
  const settings = getSettings();
  assert.deepEqual(settings.excludedPaths, []);
  assert.equal(settings.minimizeToTray, true);
  assert.equal(settings.security.pinEnabled, false);
});

test('resetSettings wipes prior customizations back to defaults', () => {
  reset();
  const { updateSettings, resetSettings, getSettings } = require('../src/engine/settingsStore');
  updateSettings({ minimizeToTray: false, security: { pinEnabled: true, pinHash: 'abc' }, customRules: [{ id: '1' }] });
  const reset1 = resetSettings();
  assert.equal(reset1.minimizeToTray, true);
  assert.equal(reset1.security.pinEnabled, false);
  assert.deepEqual(reset1.customRules, []);
  assert.deepEqual(getSettings(), reset1);
});
