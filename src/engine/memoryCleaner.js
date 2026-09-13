const { runPowerShell } = require('./powershell');

// Working-Set-Trimming über die klassische psapi.dll-Funktion EmptyWorkingSet.
// EHRLICHER HINWEIS: Das reduziert nur kurzzeitig den ANGEZEIGTEN Speicherverbrauch,
// nicht den tatsächlichen Speicherbedarf - Windows lädt ausgelagerte Seiten bei Bedarf
// sofort wieder nach. Viele "RAM-Cleaner" überschätzen den echten Nutzen davon bewusst;
// wir tun das hier nicht.
const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -Name Mem -Namespace Purgo -MemberDefinition '[DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr hProcess);'
$before = (Get-Process | Measure-Object WorkingSet64 -Sum).Sum
Get-Process | ForEach-Object {
  try { [Purgo.Mem]::EmptyWorkingSet($_.Handle) | Out-Null } catch {}
}
Start-Sleep -Milliseconds 300
$after = (Get-Process | Measure-Object WorkingSet64 -Sum).Sum
[PSCustomObject]@{ beforeBytes = $before; afterBytes = $after } | ConvertTo-Json -Compress
`;

async function trimAllProcesses() {
  const out = await runPowerShell(SCRIPT);
  try {
    const parsed = JSON.parse(out.trim());
    const beforeBytes = Number(parsed.beforeBytes) || 0;
    const afterBytes = Number(parsed.afterBytes) || 0;
    return { beforeBytes, afterBytes, reducedBytes: Math.max(0, beforeBytes - afterBytes) };
  } catch {
    return { beforeBytes: 0, afterBytes: 0, reducedBytes: 0 };
  }
}

module.exports = { trimAllProcesses };
