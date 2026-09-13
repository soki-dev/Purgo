const { execFile } = require('child_process');
const { runPowerShell, parseJsonSafe } = require('./powershell');

const CONNECTIONS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Get-NetTCPConnection -State Established | ForEach-Object {
  $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
  [PSCustomObject]@{
    localAddress = $_.LocalAddress
    localPort = $_.LocalPort
    remoteAddress = $_.RemoteAddress
    remotePort = $_.RemotePort
    pid = $_.OwningProcess
    processName = if ($proc) { $proc.ProcessName } else { 'Unbekannt' }
  }
} | ConvertTo-Json -Compress
`;

async function listConnections() {
  const raw = parseJsonSafe(await runPowerShell(CONNECTIONS_SCRIPT));
  return raw
    .filter((c) => c && c.remoteAddress)
    .map((c) => ({
      localAddress: c.localAddress,
      localPort: c.localPort,
      remoteAddress: c.remoteAddress,
      remotePort: c.remotePort,
      pid: c.pid,
      processName: c.processName || 'Unbekannt'
    }));
}

function execFileP(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

async function flushDns() {
  await execFileP('ipconfig', ['/flushdns']);
  return { ok: true };
}

// Setzt den Winsock-Katalog zurück - behebt manche Netzwerkprobleme, braucht aber
// zwingend Admin-Rechte UND einen Neustart, um zu wirken.
async function resetWinsock() {
  await execFileP('netsh', ['winsock', 'reset']);
  return { ok: true, requiresRestart: true };
}

module.exports = { listConnections, flushDns, resetWinsock };
