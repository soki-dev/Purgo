const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_ENTRIES = 200;

function getHistoryPath() {
  return path.join(app.getPath('userData'), 'history.json');
}

function loadHistory() {
  try {
    const raw = fs.readFileSync(getHistoryPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  const file = getHistoryPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(entries, null, 2), 'utf8');
}

function addEntry(entry) {
  const entries = loadHistory();
  entries.unshift({ timestamp: new Date().toISOString(), ...entry });
  saveHistory(entries.slice(0, MAX_ENTRIES));
  return entries[0];
}

function listHistory(limit = 50, category = null) {
  const entries = loadHistory();
  const filtered = category ? entries.filter((e) => e.category === category) : entries;
  return filtered.slice(0, limit);
}

function getTotals() {
  const entries = loadHistory();
  return {
    totalRuns: entries.length,
    totalFreedBytes: entries.reduce((sum, e) => sum + (e.freedBytes || 0), 0)
  };
}

function clearHistory() {
  saveHistory([]);
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv() {
  const entries = loadHistory();
  const header = ['Zeitstempel', 'Kategorie', 'Typ', 'Zusammenfassung', 'Freigegeben (Bytes)', 'Anzahl'];
  const rows = entries.map((e) => [
    e.timestamp,
    e.category || '',
    e.type || '',
    e.summary || '',
    e.freedBytes || 0,
    e.itemCount || 0
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

module.exports = { addEntry, listHistory, getTotals, clearHistory, toCsv, csvEscape };
