const { runPowerShell, parseJsonSafe } = require('./powershell');

const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Get-CimInstance Win32_PnPSignedDriver |
  Where-Object { $_.DeviceName -and $_.DriverVersion } |
  Select-Object DeviceName, DeviceClass, Manufacturer, DriverVersion, DriverDate, DriverProviderName |
  ConvertTo-Json -Compress
`;

const OUTDATED_THRESHOLD_YEARS = 3;

function parseDriverDate(wmiDate) {
  if (!wmiDate) return null;
  const dotNetDate = typeof wmiDate === 'string' && wmiDate.match(/\/Date\((\d+)\)\//);
  if (dotNetDate) return new Date(Number(dotNetDate[1]));
  const d = new Date(wmiDate);
  return isNaN(d.getTime()) ? null : d;
}

// Es gibt keine offizielle, freie Online-Datenbank für "aktuelle" Treiberversionen.
// Der Prototyp meldet daher nur das Alter des installierten Treibers und verlinkt
// auf eine Hersteller-Suche statt einen (potenziell falschen) Direktlink zu raten.
async function scanDrivers() {
  const raw = parseJsonSafe(await runPowerShell(SCRIPT));
  const now = new Date();
  const seen = new Set();
  const drivers = [];

  for (const entry of raw) {
    if (!entry.DeviceName || seen.has(entry.DeviceName)) continue;
    seen.add(entry.DeviceName);

    const driverDate = parseDriverDate(entry.DriverDate);
    const ageYears = driverDate ? (now - driverDate) / (1000 * 60 * 60 * 24 * 365) : null;
    const outdated = ageYears !== null && ageYears >= OUTDATED_THRESHOLD_YEARS;
    const manufacturer = entry.Manufacturer || entry.DriverProviderName || '';
    const searchQuery = encodeURIComponent(`${manufacturer} ${entry.DeviceName} driver download`.trim());

    drivers.push({
      id: `${entry.DeviceName}:${entry.DriverVersion}`,
      name: entry.DeviceName,
      deviceClass: entry.DeviceClass || 'Unbekannt',
      manufacturer,
      version: entry.DriverVersion,
      date: driverDate ? driverDate.toISOString().slice(0, 10) : null,
      ageYears: ageYears !== null ? Math.round(ageYears * 10) / 10 : null,
      outdated,
      searchUrl: `https://www.google.com/search?q=${searchQuery}`
    });
  }

  return drivers.sort((a, b) => (b.ageYears || 0) - (a.ageYears || 0));
}

module.exports = { scanDrivers };
