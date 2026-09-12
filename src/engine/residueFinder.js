const fs = require('fs');
const path = require('path');
const { runPowerShell, parseJsonSafe } = require('./powershell');

// Ordner, die niemals als "verwaist" vorgeschlagen werden, auch wenn sie keiner
// Registry-Installationsangabe zugeordnet werden können (Windows-eigene Infrastruktur).
const ALLOWLIST = new Set([
  'common files',
  'windowsapps',
  'modifiablewindowsapps',
  'windows defender',
  'windows defender advanced threat protection',
  'windows mail',
  'windows media player',
  'windows multimedia platform',
  'windows nt',
  'windows photo viewer',
  'windows portable devices',
  'windows security',
  'windows sidebar',
  'internet explorer',
  'msbuild',
  'reference assemblies',
  'dvd maker',
  'uninstall information',
  'microsoft',
  'microsoft.net',
  'package cache',
  'containers'
]);

const INSTALL_LOCATIONS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$roots = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
$out = @()
foreach ($root in $roots) {
  Get-ItemProperty -Path $root | ForEach-Object {
    if ($_.InstallLocation) { $out += $_.InstallLocation }
  }
}
$out | Sort-Object -Unique | ConvertTo-Json -Compress
`;

function dirSize(dirPath) {
  let size = 0;
  function walk(p) {
    let entries;
    try {
      entries = fs.readdirSync(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(p, entry.name);
      try {
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) size += fs.statSync(full).size;
      } catch {
        // locked/inaccessible, skip
      }
    }
  }
  walk(dirPath);
  return size;
}

const PROGRAM_FILES_ROOTS = [
  process.env['ProgramFiles'] || 'C:\\Program Files',
  process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
].filter((v, i, arr) => v && arr.indexOf(v) === i);

async function scanResidue() {
  const rawLocations = parseJsonSafe(await runPowerShell(INSTALL_LOCATIONS_SCRIPT));
  const knownLocations = rawLocations
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => path.normalize(v).toLowerCase().replace(/\\+$/, ''));

  const items = [];

  for (const root of PROGRAM_FILES_ROOTS) {
    if (!fs.existsSync(root)) continue;
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const lowerName = entry.name.toLowerCase();
      if (ALLOWLIST.has(lowerName)) continue;

      const full = path.join(root, entry.name);
      const normalizedFull = path.normalize(full).toLowerCase().replace(/\\+$/, '');
      const isKnown = knownLocations.some(
        (loc) => loc === normalizedFull || loc.startsWith(`${normalizedFull}\\`)
      );
      if (isKnown) continue;

      const sizeBytes = dirSize(full);
      items.push({
        id: full,
        label: entry.name,
        description: `Kein Eintrag in der Programme-Liste gefunden, der auf ${full} verweist. Vor dem Löschen manuell prüfen.`,
        path: full,
        risk: 'medium',
        defaultChecked: false,
        sizeBytes
      });
    }
  }

  return items.sort((a, b) => b.sizeBytes - a.sizeBytes);
}

function deleteResidue(paths) {
  const results = [];
  for (const targetPath of paths) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      results.push({ path: targetPath, ok: true });
    } catch (err) {
      results.push({ path: targetPath, ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = { scanResidue, deleteResidue, ALLOWLIST };
