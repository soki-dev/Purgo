const fs = require('fs');
const path = require('path');
const { runPowerShell } = require('./powershell');
const { CATEGORY_DEFS } = require('./junkCategories');
const { listFirefoxProfiles, resolveFirefoxProfileBase } = require('./junkScanner');
const { getSettings, isExcluded } = require('./settingsStore');

function cleanDirContents(dirPath, settings) {
  let freedBytes = 0;
  let deletedFiles = 0;
  let errors = 0;

  function walk(p) {
    if (isExcluded(p, settings)) return;
    let entries;
    try {
      entries = fs.readdirSync(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(p, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        walk(full);
        try {
          fs.rmdirSync(full);
        } catch {
          // not empty (locked file inside) or otherwise busy, leave it
        }
      } else if (entry.isFile()) {
        if (isExcluded(full, settings)) continue;
        try {
          const size = fs.statSync(full).size;
          fs.unlinkSync(full);
          freedBytes += size;
          deletedFiles += 1;
        } catch {
          errors += 1;
        }
      }
    }
  }

  walk(dirPath);
  return { freedBytes, deletedFiles, errors };
}

function cleanFile(filePath, settings) {
  if (isExcluded(filePath, settings)) return { freedBytes: 0, deletedFiles: 0, errors: 0 };
  try {
    const size = fs.statSync(filePath).size;
    fs.unlinkSync(filePath);
    return { freedBytes: size, deletedFiles: 1, errors: 0 };
  } catch {
    return { freedBytes: 0, deletedFiles: 0, errors: 1 };
  }
}

async function clean(selectedIds) {
  const settings = getSettings();
  const results = [];

  for (const id of selectedIds) {
    if (id === 'recycle-bin') {
      try {
        await runPowerShell('Clear-RecycleBin -Force -ErrorAction SilentlyContinue');
        results.push({ id, ok: true });
      } catch {
        results.push({ id, ok: false });
      }
      continue;
    }

    if (id.startsWith('custom:')) {
      const ruleId = id.slice('custom:'.length);
      const rule = (settings.customRules || []).find((r) => r.id === ruleId);
      if (!rule) {
        results.push({ id, ok: false });
        continue;
      }
      const r = rule.kind === 'file' ? cleanFile(rule.targetPath, settings) : cleanDirContents(rule.targetPath, settings);
      results.push({ id, ok: true, ...r });
      continue;
    }

    const def = CATEGORY_DEFS.find((d) => d.id === id);
    if (!def) {
      results.push({ id, ok: false });
      continue;
    }

    if (def.kind === 'firefox-profile') {
      let freedBytes = 0;
      let deletedFiles = 0;
      let errors = 0;
      const base = resolveFirefoxProfileBase(def.base);
      for (const profile of listFirefoxProfiles()) {
        const target = path.join(base, profile, def.relativeTarget);
        if (!fs.existsSync(target)) continue;
        const r = def.fileKind === 'dir' ? cleanDirContents(target, settings) : cleanFile(target, settings);
        freedBytes += r.freedBytes;
        deletedFiles += r.deletedFiles;
        errors += r.errors;
      }
      results.push({ id, ok: true, freedBytes, deletedFiles, errors });
      continue;
    }

    const r = def.kind === 'file' ? cleanFile(def.path, settings) : cleanDirContents(def.path, settings);
    results.push({ id, ok: true, ...r });
  }

  return results;
}

module.exports = { clean };
