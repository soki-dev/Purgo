const { runPowerShell, parseJsonSafe } = require('./powershell');

const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Get-PhysicalDisk | Select-Object DeviceId, FriendlyName, MediaType, HealthStatus, OperationalStatus, Size | ConvertTo-Json -Compress
`;

async function getDiskHealth() {
  const raw = parseJsonSafe(await runPowerShell(SCRIPT));
  return raw
    .filter((d) => d && d.FriendlyName)
    .map((d) => ({
      id: d.DeviceId,
      name: d.FriendlyName,
      mediaType: d.MediaType || 'Unbekannt',
      health: d.HealthStatus || 'Unbekannt',
      operationalStatus: d.OperationalStatus || 'Unbekannt',
      sizeBytes: Number(d.Size) || 0
    }));
}

module.exports = { getDiskHealth };
