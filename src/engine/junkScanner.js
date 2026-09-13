const fs = require('fs');
const path = require('path');
const { runPowerShell } = require('./powershell');
const { CATEGORY_DEFS, firefoxProfilesDir, firefoxLocalProfilesDir } = require('./junkCategories');
const { getSettings, isExcluded } = require('./settingsStore');

function dirStats(dirPath, settings) {
  let size = 0;
  let count = 0;

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
      try {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          if (isExcluded(full, settings)) continue;
          size += fs.statSync(full).size;
          count += 1;
        }
      } catch {
        // locked or inaccessible, skip it
      }
    }
  }

  walk(dirPath);
  return { size, count };
}

async function getRecycleBinStats() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $shell = New-Object -ComObject Shell.Application
    $bin = $shell.Namespace(10)
    $items = $bin.Items()
    $total = 0
    foreach ($item in $items) {
      try { $total += $item.ExtendedProperty("Size") } catch {}
    }
    [PSCustomObject]@{ size = $total; count = $items.Count } | ConvertTo-Json -Compress
  `;
  try {
    const out = await runPowerShell(script);
    const parsed = JSON.parse(out.trim() || '{}');
    return { size: Number(parsed.size) || 0, count: Number(parsed.count) || 0 };
  } catch {
    return { size: 0, count: 0 };
  }
}

// Gibt Profil-NAMEN zurück (nicht volle Pfade), da Firefox denselben Profilnamen
// sowohl im Roaming- als auch im Local-Ordner verwendet - siehe resolveFirefoxProfileBase.
function listFirefoxProfiles() {
  try {
    return fs.readdirSync(firefoxProfilesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function resolveFirefoxProfileBase(base) {
  return base === 'local' ? firefoxLocalProfilesDir : firefoxProfilesDir;
}

function statTarget(targetPath, fileKind, settings) {
  if (isExcluded(targetPath, settings)) return { size: 0, count: 0 };
  if (fileKind === 'dir') {
    if (!fs.existsSync(targetPath)) return { size: 0, count: 0 };
    return dirStats(targetPath, settings);
  }
  try {
    const st = fs.statSync(targetPath);
    return { size: st.size, count: 1 };
  } catch {
    return { size: 0, count: 0 };
  }
}

async function scanJunk() {
  const settings = getSettings();
  const items = [];

  for (const def of CATEGORY_DEFS) {
    if (def.kind === 'firefox-profile') {
      const profiles = listFirefoxProfiles();
      let totalSize = 0;
      let totalCount = 0;
      const base = resolveFirefoxProfileBase(def.base);
      for (const profile of profiles) {
        const target = path.join(base, profile, def.relativeTarget);
        const { size, count } = statTarget(target, def.fileKind, settings);
        totalSize += size;
        totalCount += count;
      }
      if (totalCount > 0) {
        items.push({
          id: def.id,
          label: def.label,
          description: def.description,
          path: `Firefox-Profile/${def.relativeTarget}`,
          risk: def.risk,
          defaultChecked: def.defaultChecked,
          sizeBytes: totalSize,
          fileCount: totalCount
        });
      }
      continue;
    }

    if (isExcluded(def.path, settings)) continue;
    const { size, count } = statTarget(def.path, def.kind, settings);
    if (count === 0) continue;
    items.push({
      id: def.id,
      label: def.label,
      description: def.description,
      path: def.path,
      risk: def.risk,
      defaultChecked: def.defaultChecked,
      sizeBytes: size,
      fileCount: count
    });
  }

  const recycleBin = await getRecycleBinStats();
  if (recycleBin.count > 0) {
    items.push({
      id: 'recycle-bin',
      label: 'Papierkorb',
      description: 'Endgültig gelöschte Dateien aus dem Papierkorb entfernen.',
      path: 'RecycleBin',
      risk: 'safe',
      defaultChecked: true,
      sizeBytes: recycleBin.size,
      fileCount: recycleBin.count
    });
  }

  return items;
}

module.exports = { scanJunk, dirStats, listFirefoxProfiles, resolveFirefoxProfileBase };
