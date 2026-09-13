const { runPowerShell, parseJsonSafe } = require('./powershell');

// Get-BitLockerVolume braucht das BitLocker-PowerShell-Modul, das auf Windows Home
// fehlen kann - dann einfach eine leere Liste statt eines Fehlers zurückgeben.
async function getBitLockerStatus() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    try {
      Get-BitLockerVolume | Select-Object MountPoint, VolumeStatus, ProtectionStatus | ConvertTo-Json -Compress
    } catch { '[]' }
  `;
  const raw = parseJsonSafe(await runPowerShell(script));
  return raw
    .filter((v) => v && v.MountPoint)
    .map((v) => ({
      mountPoint: v.MountPoint,
      status: v.VolumeStatus || 'Unbekannt',
      protectionOn: v.ProtectionStatus === 1
    }));
}

async function getFirewallStatus() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    Get-NetFirewallProfile | Select-Object Name, Enabled | ConvertTo-Json -Compress
  `;
  const raw = parseJsonSafe(await runPowerShell(script));
  return raw.map((p) => ({ profile: p.Name, enabled: !!p.Enabled }));
}

// Windows fasst die Diagnosedaten-Stufe intern weiter in dieser Registry-Zahl
// zusammen, auch wenn die Einstellungen-App inzwischen nur noch "Erforderlich"/
// "Optional" anzeigt. Nur lesend - Ändern erfolgt bewusst über die echte
// Einstellungen-App (ms-settings:), nicht per Registry-Hack, da das je nach
// Windows-Version/Gruppenrichtlinie unterschiedlich verankert ist.
const TELEMETRY_LEVELS = {
  0: 'Sicherheit (nur Enterprise/Server)',
  1: 'Erforderlich',
  2: 'Optional (älteres Windows)',
  3: 'Vollständig (älteres Windows)'
};

async function getDiagnosticDataLevel() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $path = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DataCollection'
    if (Test-Path $path) {
      $value = (Get-ItemProperty -Path $path -Name AllowTelemetry -ErrorAction SilentlyContinue).AllowTelemetry
      [PSCustomObject]@{ level = $value } | ConvertTo-Json -Compress
    } else { '{}' }
  `;
  const raw = parseJsonSafe(await runPowerShell(script));
  const entry = raw[0];
  if (!entry || entry.level === undefined) return { level: null, label: 'Unbekannt' };
  return { level: entry.level, label: TELEMETRY_LEVELS[entry.level] || `Stufe ${entry.level}` };
}

module.exports = { getBitLockerStatus, getFirewallStatus, getDiagnosticDataLevel };
