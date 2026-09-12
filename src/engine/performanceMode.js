const { execFile } = require('child_process');
const { runPowerShell, parseJsonSafe } = require('./powershell');

// GUIDs der eingebauten Windows-Energiesparpläne (auf jedem Windows gleich).
const HIGH_PERFORMANCE_GUID = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const BALANCED_GUID = '381b4222-f694-41f0-9685-ff5bb260df2e';

function execFileP(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

async function getActivePowerPlan() {
  const out = await execFileP('powercfg', ['/getactivescheme']);
  const match = out.match(/GUID:\s*([\w-]+)\s+\(([^)]+)\)/);
  return match ? { guid: match[1], name: match[2] } : { guid: null, name: out.trim() };
}

async function setPowerPlan(guid) {
  await execFileP('powercfg', ['/setactive', guid]);
  return { ok: true };
}

// Nur Prozesse mit sichtbarem Fenster – keine Systemdienste/Hintergrundprozesse,
// damit hier nichts automatisch "aufgeräumt" wird, was der Nutzer nicht selbst sieht.
const VISIBLE_APPS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and $_.Id -ne $PID } |
  Select-Object Id, ProcessName, MainWindowTitle, @{n='Mem';e={$_.WorkingSet64}} |
  ConvertTo-Json -Compress
`;

async function listBackgroundApps() {
  const raw = parseJsonSafe(await runPowerShell(VISIBLE_APPS_SCRIPT));
  return raw.map((p) => ({
    pid: p.Id,
    name: p.ProcessName,
    title: p.MainWindowTitle,
    memBytes: p.Mem || 0
  }));
}

function killProcess(pid) {
  return new Promise((resolve, reject) => {
    execFile('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve({ ok: true });
    });
  });
}

module.exports = {
  getActivePowerPlan,
  setPowerPlan,
  listBackgroundApps,
  killProcess,
  HIGH_PERFORMANCE_GUID,
  BALANCED_GUID
};
