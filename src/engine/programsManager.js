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

async function listPrograms() {
  const raw = parseJsonSafe(await runPowerShell(LIST_SCRIPT));
  return raw
    .filter((p) => p && p.name)
    .map((p) => ({
      id: p.keyPath,
      name: p.name,
      version: p.version || '',
      publisher: p.publisher || '',
      sizeBytes: p.sizeKb ? Number(p.sizeKb) * 1024 : 0,
      uninstallString: p.uninstallString,
      installLocation: p.installLocation || null
    }))
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
