const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_SETTINGS = {
  excludedPaths: [],
  minimizeToTray: true,
  autoCheckUpdates: true,
  scheduler: {
    enabled: false,
    frequency: 'weekly', // 'daily' | 'weekly'
    lastRun: null
  },
  security: {
    pinEnabled: false,
    pinHash: null
  },
  customRules: [] // { id, label, targetPath, kind: 'dir' | 'file', risk: 'safe' | 'medium', defaultChecked }
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  const file = getSettingsPath();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  const file = getSettingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2), 'utf8');
}

function getSettings() {
  return loadSettings();
}

function updateSettings(partial) {
  const current = loadSettings();
  const merged = {
    ...current,
    ...partial,
    scheduler: { ...current.scheduler, ...(partial.scheduler || {}) },
    security: { ...current.security, ...(partial.security || {}) }
  };
  saveSettings(merged);
  return merged;
}

function isExcluded(targetPath, settings) {
  const excluded = (settings || loadSettings()).excludedPaths;
  const normalizedTarget = path.normalize(targetPath).toLowerCase();
  return excluded.some((p) => normalizedTarget.startsWith(path.normalize(p).toLowerCase()));
}

function resetSettings() {
  saveSettings({ ...DEFAULT_SETTINGS });
  return { ...DEFAULT_SETTINGS };
}

module.exports = { getSettings, updateSettings, isExcluded, getSettingsPath, resetSettings, DEFAULT_SETTINGS };
