const fs = require('fs');
const path = require('path');
const os = require('os');

const chromeUserData = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
const edgeUserData = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data');
const firefoxProfilesDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function listChromiumExtensions(userDataDir, browserLabel) {
  const extRoot = path.join(userDataDir, 'Default', 'Extensions');
  const prefs = readJsonSafe(path.join(userDataDir, 'Default', 'Preferences'));
  const settings = (prefs && prefs.extensions && prefs.extensions.settings) || {};

  const results = [];
  if (!fs.existsSync(extRoot)) return results;

  let ids;
  try {
    ids = fs.readdirSync(extRoot);
  } catch {
    return results;
  }

  for (const id of ids) {
    const idDir = path.join(extRoot, id);
    let versions;
    try {
      versions = fs.readdirSync(idDir).filter((v) => {
        try {
          return fs.statSync(path.join(idDir, v)).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      continue;
    }
    if (versions.length === 0) continue;

    const versionDir = path.join(idDir, versions[versions.length - 1]);
    const manifest = readJsonSafe(path.join(versionDir, 'manifest.json'));
    if (!manifest) continue;

    const state = settings[id] ? settings[id].state : undefined;
    // manifest.name kann ein i18n-Platzhalter wie "__MSG_extName__" sein, dessen echter
    // Text in einer separaten _locales-Datei liegt - für den Prototyp zeigen wir dann die ID.
    const name = manifest.name && !manifest.name.startsWith('__MSG_') ? manifest.name : id;

    results.push({
      id,
      browser: browserLabel,
      name,
      version: manifest.version || versions[versions.length - 1],
      enabled: state === undefined ? true : state === 1,
      userDataDir
    });
  }

  return results;
}

function setChromiumExtensionState(userDataDir, id, enabled) {
  const prefsFile = path.join(userDataDir, 'Default', 'Preferences');
  const backupFile = `${prefsFile}.purgo-backup`;
  const prefs = readJsonSafe(prefsFile);
  if (!prefs) throw new Error('Preferences-Datei nicht lesbar. Ist der Browser vollständig geschlossen?');

  if (!fs.existsSync(backupFile)) fs.copyFileSync(prefsFile, backupFile);

  prefs.extensions = prefs.extensions || {};
  prefs.extensions.settings = prefs.extensions.settings || {};
  prefs.extensions.settings[id] = prefs.extensions.settings[id] || {};
  prefs.extensions.settings[id].state = enabled ? 1 : 0;

  fs.writeFileSync(prefsFile, JSON.stringify(prefs), 'utf8');
  return { ok: true };
}

function listFirefoxExtensions() {
  const results = [];
  let profiles;
  try {
    profiles = fs.readdirSync(firefoxProfilesDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return results;
  }

  for (const profile of profiles) {
    const data = readJsonSafe(path.join(firefoxProfilesDir, profile.name, 'extensions.json'));
    if (!data || !Array.isArray(data.addons)) continue;

    for (const addon of data.addons) {
      if (addon.type !== 'extension') continue;
      results.push({
        id: addon.id,
        browser: 'Firefox',
        name: (addon.defaultLocale && addon.defaultLocale.name) || addon.id,
        version: addon.version || '',
        enabled: addon.active !== false,
        profile: profile.name
      });
    }
  }

  return results;
}

function listAllExtensions() {
  return [
    ...listChromiumExtensions(chromeUserData, 'Chrome'),
    ...listChromiumExtensions(edgeUserData, 'Edge'),
    ...listFirefoxExtensions()
  ].sort((a, b) => a.name.localeCompare(b.name));
}

function setExtensionEnabled(extension, enabled) {
  if (extension.browser === 'Chrome' || extension.browser === 'Edge') {
    return setChromiumExtensionState(extension.userDataDir, extension.id, enabled);
  }
  throw new Error('Aktivieren/Deaktivieren wird für Firefox-Erweiterungen aktuell nicht unterstützt - bitte über about:addons ändern.');
}

module.exports = { listAllExtensions, setExtensionEnabled };
