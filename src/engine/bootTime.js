const { runPowerShell, parseJsonSafe } = require('./powershell');

// Windows protokolliert die tatsächliche Boot-Dauer bei jedem Start als Event 100 im
// "Diagnostics-Performance"-Betriebsprotokoll (BootTimeInMs) - echte Messwerte statt
// einer Schätzung.
const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$events = Get-WinEvent -LogName 'Microsoft-Windows-Diagnostics-Performance/Operational' -FilterXPath "*[System[(EventID=100)]]" -MaxEvents 10
$out = @()
foreach ($e in $events) {
  $bootTime = $e.Properties[0].Value
  $out += [PSCustomObject]@{ timestamp = $e.TimeCreated.ToString('o'); bootTimeMs = $bootTime }
}
$out | ConvertTo-Json -Compress
`;

async function getBootTimeHistory() {
  const raw = parseJsonSafe(await runPowerShell(SCRIPT));
  return raw
    .filter((e) => e && e.bootTimeMs)
    .map((e) => ({ timestamp: e.timestamp, bootTimeMs: Number(e.bootTimeMs) }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

module.exports = { getBootTimeHistory };
