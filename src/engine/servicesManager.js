const { runPowerShell, parseJsonSafe, psQuote } = require('./powershell');

const LIST_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Get-CimInstance Win32_Service |
  Select-Object Name, DisplayName, State, StartMode, Description |
  ConvertTo-Json -Compress
`;

async function listServices() {
  const raw = parseJsonSafe(await runPowerShell(LIST_SCRIPT));
  return raw
    .filter((s) => s && s.Name)
    .map((s) => ({
      name: s.Name,
      displayName: s.DisplayName || s.Name,
      state: s.State || 'Unknown',
      startMode: s.StartMode || 'Unknown',
      description: s.Description || ''
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function setServiceState(name, action) {
  const quoted = psQuote(name);
  if (action === 'start') {
    await runPowerShell(`Start-Service -Name '${quoted}' -ErrorAction Stop`);
  } else if (action === 'stop') {
    await runPowerShell(`Stop-Service -Name '${quoted}' -Force -ErrorAction Stop`);
  } else if (action === 'restart') {
    await runPowerShell(`Restart-Service -Name '${quoted}' -Force -ErrorAction Stop`);
  } else {
    throw new Error(`Unbekannte Aktion: ${action}`);
  }
  return { ok: true };
}

// mode: 'Automatic' | 'Manual' | 'Disabled'
async function setServiceStartMode(name, mode) {
  await runPowerShell(`Set-Service -Name '${psQuote(name)}' -StartupType ${mode} -ErrorAction Stop`);
  return { ok: true };
}

module.exports = { listServices, setServiceState, setServiceStartMode };
