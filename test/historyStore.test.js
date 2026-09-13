require('./support/mock-electron');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const historyPath = path.join(os.tmpdir(), 'purgo-test-userdata', 'history.json');
function reset() {
  try { fs.unlinkSync(historyPath); } catch { /* file may not exist yet */ }
}

test('addEntry + listHistory roundtrip, newest first, category filter', () => {
  reset();
  const { addEntry, listHistory } = require('../src/engine/historyStore');
  addEntry({ type: 'junk-scan', category: 'scan', summary: 'Test-Scan', itemCount: 3 });
  addEntry({ type: 'junk-clean', category: 'clean', summary: 'Test-Clean', freedBytes: 1024 });

  const all = listHistory(10);
  assert.equal(all.length, 2);
  assert.equal(all[0].type, 'junk-clean');

  const scansOnly = listHistory(10, 'scan');
  assert.equal(scansOnly.length, 1);
  assert.equal(scansOnly[0].type, 'junk-scan');
});

test('clearHistory empties the log', () => {
  reset();
  const { addEntry, clearHistory, listHistory } = require('../src/engine/historyStore');
  addEntry({ type: 'junk-scan', category: 'scan', summary: 'x' });
  clearHistory();
  assert.equal(listHistory(10).length, 0);
});

test('csvEscape quotes values containing commas, quotes or newlines', () => {
  const { csvEscape } = require('../src/engine/historyStore');
  assert.equal(csvEscape('simple'), 'simple');
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('has "quotes"'), '"has ""quotes"""');
  assert.equal(csvEscape('line1\nline2'), '"line1\nline2"');
});

test('toCsv produces a header row plus one row per entry', () => {
  reset();
  const { addEntry, toCsv } = require('../src/engine/historyStore');
  addEntry({ type: 'junk-clean', category: 'clean', summary: 'Test', freedBytes: 512, itemCount: 1 });
  const lines = toCsv().split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /Zeitstempel/);
  assert.match(lines[1], /junk-clean/);
});

test('getDailyTrend returns one bucket per day covering today, freed bytes on the right day', () => {
  reset();
  const { addEntry, getDailyTrend } = require('../src/engine/historyStore');
  addEntry({ type: 'junk-clean', category: 'clean', summary: 'Test', freedBytes: 2048 });

  const trend = getDailyTrend(7);
  assert.equal(trend.length, 7);
  const today = new Date().toISOString().slice(0, 10);
  const todayBucket = trend.find((t) => t.date === today);
  assert.ok(todayBucket);
  assert.equal(todayBucket.freedBytes, 2048);
  assert.equal(trend[trend.length - 1].date, today);
});
