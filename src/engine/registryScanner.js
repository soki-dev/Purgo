const { runPowerShell, parseJsonSafe } = require('./powershell');

// Beide Scans sind bewusst konservativ: Es werden nur Einträge gemeldet, deren
// Ziel (Programmdatei bzw. Installationsordner UND Deinstaller) nachweislich
// nicht mehr existiert. Keine Heuristiken, keine Ratespiele.

const APP_PATHS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$out = @()
$roots = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths'
)
foreach ($root in $roots) {
  if (Test-Path $root) {
    Get-ChildItem $root | ForEach-Object {
      $target = (Get-ItemProperty -Path $_.PSPath).'(default)'
      if ($target -and -not (Test-Path -LiteralPath $target)) {
        $keyPath = ($_.Name -replace '^HKEY_LOCAL_MACHINE', 'HKLM' -replace '^HKEY_CURRENT_USER', 'HKCU')
        $out += [PSCustomObject]@{ name = $_.PSChildName; target = $target; keyPath = $keyPath }
      }
    }
  }
}
$out | ConvertTo-Json -Compress
`;

const ORPHAN_UNINSTALL_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$out = @()
$roots = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
foreach ($root in $roots) {
  Get-ItemProperty -Path $root | ForEach-Object {
    if ($_.DisplayName -and -not $_.SystemComponent) {
      $loc = $_.InstallLocation
      $uninstallStr = $_.UninstallString
      $locMissing = [string]::IsNullOrWhiteSpace($loc) -or -not (Test-Path -LiteralPath $loc)
      $exePath = $null
      if ($uninstallStr -match '"([^"]+\\.exe)"') { $exePath = $matches[1] }
      elseif ($uninstallStr -match '(\\S+\\.exe)') { $exePath = $matches[1] }
      $uninstallMissing = -not $exePath -or -not (Test-Path -LiteralPath $exePath)
      if ($loc -and $locMissing -and $uninstallStr -and $uninstallMissing) {
        $keyPath = ($_.PSPath -replace '.*Registry::', '' -replace '^HKEY_LOCAL_MACHINE', 'HKLM' -replace '^HKEY_CURRENT_USER', 'HKCU')
        $out += [PSCustomObject]@{ name = $_.DisplayName; target = $loc; keyPath = $keyPath }
      }
    }
  }
}
$out | ConvertTo-Json -Compress
`;

const ORPHAN_FONTS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$out = @()
$fontsKey = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'
if (Test-Path $fontsKey) {
  $fontsDir = [Environment]::GetFolderPath('Fonts')
  $props = Get-ItemProperty -Path $fontsKey
  $props.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
    $fileName = [string]$_.Value
    if (-not $fileName) { return }
    $fullPath = if ([System.IO.Path]::IsPathRooted($fileName)) { $fileName } else { Join-Path $fontsDir $fileName }
    if (-not (Test-Path -LiteralPath $fullPath)) {
      $out += [PSCustomObject]@{ name = $_.Name; target = $fullPath; keyPath = 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts' }
    }
  }
}
$out | ConvertTo-Json -Compress
`;

const ORPHAN_MUICACHE_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$out = @()
$key = 'HKCU:\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache'
if (Test-Path $key) {
  $props = Get-ItemProperty -Path $key
  $props.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
    $exePath = $_.Name -replace '\\.FriendlyAppName$', '' -replace '\\.ApplicationCompany$', ''
    if ($exePath -match '\\.exe$' -and -not (Test-Path -LiteralPath $exePath)) {
      $out += [PSCustomObject]@{ name = $_.Name; target = $exePath; keyPath = 'HKCU\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache' }
    }
  }
}
$out | Sort-Object name -Unique | ConvertTo-Json -Compress
`;

async function scanRegistry() {
  const items = [];

  try {
    const raw = parseJsonSafe(await runPowerShell(APP_PATHS_SCRIPT));
    for (const entry of raw) {
      if (!entry || !entry.keyPath) continue;
      items.push({
        id: `app-path:${entry.keyPath}`,
        category: 'App Paths',
        label: entry.name,
        description: `Verweist auf nicht mehr vorhandene Datei: ${entry.target}`,
        keyPath: entry.keyPath,
        risk: 'low',
        defaultChecked: false
      });
    }
  } catch {
    // scan best-effort
  }

  try {
    const raw = parseJsonSafe(await runPowerShell(ORPHAN_UNINSTALL_SCRIPT));
    for (const entry of raw) {
      if (!entry || !entry.keyPath) continue;
      items.push({
        id: `uninstall:${entry.keyPath}`,
        category: 'Verwaiste Deinstallations-Einträge',
        label: entry.name,
        description: 'Installationsordner und Deinstallations-Programm existieren beide nicht mehr.',
        keyPath: entry.keyPath,
        risk: 'low',
        defaultChecked: false
      });
    }
  } catch {
    // scan best-effort
  }

  try {
    const raw = parseJsonSafe(await runPowerShell(ORPHAN_FONTS_SCRIPT));
    for (const entry of raw) {
      if (!entry || !entry.keyPath || !entry.name) continue;
      items.push({
        id: `font:${entry.name}`,
        category: 'Font-Reste',
        label: entry.name,
        description: `Registrierter Font verweist auf nicht mehr vorhandene Datei: ${entry.target}`,
        keyPath: entry.keyPath,
        valueName: entry.name,
        risk: 'low',
        defaultChecked: false
      });
    }
  } catch {
    // scan best-effort
  }

  try {
    const raw = parseJsonSafe(await runPowerShell(ORPHAN_MUICACHE_SCRIPT));
    for (const entry of raw) {
      if (!entry || !entry.keyPath || !entry.name) continue;
      items.push({
        id: `muicache:${entry.name}`,
        category: 'MUI-Cache-Reste',
        label: entry.target,
        description: 'Zwischengespeicherter Anzeigename für eine nicht mehr vorhandene Programmdatei.',
        keyPath: entry.keyPath,
        valueName: entry.name,
        risk: 'low',
        defaultChecked: false
      });
    }
  } catch {
    // scan best-effort
  }

  return items;
}

module.exports = { scanRegistry };
