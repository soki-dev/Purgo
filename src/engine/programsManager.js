const { execFile } = require('child_process');
const { runPowerShell, parseJsonSafe } = require('./powershell');

const LIST_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$roots = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
$out = @()
foreach ($root in $roots) {
  Get-ItemProperty -Path $root | ForEach-Object {
    if ($_.DisplayName -and -not $_.SystemComponent -and $_.UninstallString) {
      $out += [PSCustomObject]@{
        name = $_.DisplayName
        version = $_.DisplayVersion
        publisher = $_.Publisher
        sizeKb = $_.EstimatedSize
        uninstallString = $_.UninstallString
        installLocation = $_.InstallLocation
        keyPath = ($_.PSPath -replace '.*Registry::', '')
      }
    }
  }
}
$out | Sort-Object name -Unique | ConvertTo-Json -Compress
`;

// UserAssist protokolliert pro gestartetem Programm Ausführungszähler + letzten
// Startzeitpunkt, ROT13-verschlüsselt im Wertnamen. Offiziell undokumentiert, aber
// seit Windows 7 stabiles Format: Byte 4 = Ausführungszähler (UInt32),
// Byte 60 = letzter Start als FILETIME (Int64).
const USERASSIST_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
function Decode-Rot13($s) {
  -join ($s.ToCharArray() | ForEach-Object {
    if ($_ -match '[a-zA-Z]') {
      $o = if ([char]::IsUpper($_)) { 65 } else { 97 }
      [char]((([int]$_ - $o + 13) % 26) + $o)
    } else { $_ }
  })
}
$out = @()
$root = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\UserAssist'
if (Test-Path $root) {
  Get-ChildItem $root | ForEach-Object {
    $countKey = Join-Path $_.PSPath 'Count'
    if (Test-Path $countKey) {
      $props = Get-ItemProperty -Path $countKey
      $props.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
        $decodedPath = Decode-Rot13 $_.Name
        $bytes = $_.Value
        if ($bytes -and $bytes.Length -ge 68 -and $decodedPath -match '\\.exe$') {
          $lastRunFileTime = [BitConverter]::ToInt64($bytes, 60)
          if ($lastRunFileTime -gt 0) {
            $lastRun = [DateTime]::FromFileTime($lastRunFileTime)
            $out += [PSCustomObject]@{ path = $decodedPath; lastRun = $lastRun.ToString('o') }
          }
        }
      }
    }
  }
}
$out | ConvertTo-Json -Compress
`;

async function getLastRunMap() {
  const raw = parseJsonSafe(await runPowerShell(USERASSIST_SCRIPT).catch(() => '[]'));
  const map = new Map();
  for (const entry of raw) {
    if (!entry || !entry.path) continue;
    const dir = entry.path.slice(0, entry.path.lastIndexOf('\\')).toLowerCase();
    const existing = map.get(dir);
    const lastRun = new Date(entry.lastRun);
    if (!existing || lastRun > existing) map.set(dir, lastRun);
  }
  return map;
}

async function listPrograms() {
  const raw = parseJsonSafe(await runPowerShell(LIST_SCRIPT));
  const lastRunMap = await getLastRunMap();

  return raw
    .filter((p) => p && p.name)
    .map((p) => {
      let lastUsed = null;
      if (p.installLocation) {
        const normalizedInstall = p.installLocation.toLowerCase().replace(/\\+$/, '');
        for (const [dir, lastRun] of lastRunMap.entries()) {
          if (dir.startsWith(normalizedInstall)) {
            if (!lastUsed || lastRun > lastUsed) lastUsed = lastRun;
          }
        }
      }
      return {
        id: p.keyPath,
        name: p.name,
        version: p.version || '',
        publisher: p.publisher || '',
        sizeBytes: p.sizeKb ? Number(p.sizeKb) * 1024 : 0,
        uninstallString: p.uninstallString,
        installLocation: p.installLocation || null,
        lastUsed: lastUsed ? lastUsed.toISOString() : null
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function uninstallProgram(program) {
  return new Promise((resolve, reject) => {
    // uninstallString ist die vom Installer selbst hinterlegte Befehlszeile
    // (z.B. msiexec /X{GUID} oder ein setup.exe /uninstall). Wir starten sie
    // 1:1 über cmd.exe, damit Quoting/Flags wie vom Hersteller vorgesehen greifen.
    execFile('cmd.exe', ['/c', program.uninstallString], { windowsHide: true, timeout: 5 * 60_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve({ ok: true });
    });
  });
}

module.exports = { listPrograms, uninstallProgram };
