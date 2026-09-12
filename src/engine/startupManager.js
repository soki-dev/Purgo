const fs = require('fs');
const { runPowerShell, parseJsonSafe, psQuote } = require('./powershell');

function extractExecutablePath(command) {
  if (!command) return null;
  const quoted = command.match(/^"([^"]+)"/);
  if (quoted) return quoted[1];
  const bare = command.match(/^(\S+\.exe)\b/i);
  if (bare) return bare[1];
  return command.trim();
}

const SCAN_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$out = @()
$runKeys = @(
  @{ path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; hive = 'HKCU'; approvedKey = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run' },
  @{ path = 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; hive = 'HKLM'; approvedKey = 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run' }
)
foreach ($rk in $runKeys) {
  if (Test-Path $rk.path) {
    $props = Get-ItemProperty -Path $rk.path
    $approved = $null
    if (Test-Path $rk.approvedKey) { $approved = Get-ItemProperty -Path $rk.approvedKey }
    $props.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
      $enabled = $true
      if ($approved -and $approved.PSObject.Properties[$_.Name]) {
        $bytes = $approved.($_.Name)
        if ($bytes -and $bytes.Length -gt 0 -and $bytes[0] -eq 3) { $enabled = $false }
      }
      $out += [PSCustomObject]@{
        hive = $rk.hive
        keyPath = $rk.path
        approvedKey = $rk.approvedKey
        name = $_.Name
        command = [string]$_.Value
        enabled = $enabled
      }
    }
  }
}
$out | ConvertTo-Json -Compress
`;

// Get-AuthenticodeSignature ist der einzige verlässliche Weg, eine Signatur zu prüfen,
// daher ein gebündelter PowerShell-Aufruf für alle aufgelösten Pfade statt N Einzelaufrufe.
async function getSignatureInfo(paths) {
  if (paths.length === 0) return {};
  const pathsLiteral = paths.map((p) => `'${psQuote(p)}'`).join(',');
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $paths = @(${pathsLiteral})
    $out = @()
    foreach ($p in $paths) {
      $sig = Get-AuthenticodeSignature -LiteralPath $p
      $out += [PSCustomObject]@{ path = $p; signed = ($sig.Status -eq 'Valid'); signer = $sig.SignerCertificate.Subject }
    }
    $out | ConvertTo-Json -Compress
  `;
  const raw = parseJsonSafe(await runPowerShell(script));
  const map = {};
  for (const item of raw) {
    if (item && item.path) map[item.path] = { signed: !!item.signed, signer: item.signer || null };
  }
  return map;
}

// Grobe Heuristik, KEINE gemessene Bootzeit: unsignierte oder große Programme werden
// als potenziell einflussreicher markiert. Windows misst den echten Boot-Impact über
// ETW-Traces, die uns hier nicht zur Verfügung stehen.
function estimateImpact(sizeBytes, signed, exists) {
  if (!exists) return 'unbekannt';
  if (!signed) return 'hoch';
  if (sizeBytes > 5 * 1024 * 1024) return 'mittel';
  return 'gering';
}

async function scanStartup() {
  const stdout = await runPowerShell(SCAN_SCRIPT);
  const raw = parseJsonSafe(stdout);

  const entries = raw.map((entry) => {
    const resolvedPath = extractExecutablePath(entry.command);
    const exists = resolvedPath ? fs.existsSync(resolvedPath) : false;
    return {
      id: `${entry.hive}:${entry.name}`,
      hive: entry.hive,
      keyPath: entry.keyPath,
      approvedKey: entry.approvedKey,
      name: entry.name,
      command: entry.command || '',
      resolvedPath: resolvedPath || null,
      exists,
      enabled: entry.enabled
    };
  });

  const existingPaths = [...new Set(entries.filter((e) => e.exists).map((e) => e.resolvedPath))];
  const signatureMap = await getSignatureInfo(existingPaths).catch(() => ({}));

  for (const entry of entries) {
    if (!entry.exists) {
      entry.sizeBytes = 0;
      entry.signed = null;
      entry.signer = null;
      entry.impact = 'unbekannt';
      continue;
    }
    try {
      entry.sizeBytes = fs.statSync(entry.resolvedPath).size;
    } catch {
      entry.sizeBytes = 0;
    }
    const sig = signatureMap[entry.resolvedPath] || { signed: false, signer: null };
    entry.signed = sig.signed;
    entry.signer = sig.signer;
    entry.impact = estimateImpact(entry.sizeBytes, sig.signed, entry.exists);
  }

  return entries;
}

// Windows/der Taskmanager merkt sich den An/Aus-Status in einem 12-Byte-Wert unter
// ...\Explorer\StartupApproved\Run. Byte 0 = 0x02 (aktiv) oder 0x03 (deaktiviert);
// die restlichen Bytes sind ein Zeitstempel, der von Explorer nicht ausgewertet wird,
// daher reicht 0-Füllung für unseren Zweck.
async function setStartupEnabled(entry, enabled) {
  const flag = enabled ? 2 : 3;
  const bytesLiteral = `${flag},0,0,0,0,0,0,0,0,0,0,0`;
  const script = `
    $ErrorActionPreference = 'Stop'
    if (-not (Test-Path '${psQuote(entry.approvedKey)}')) { New-Item -Path '${psQuote(entry.approvedKey)}' -Force | Out-Null }
    New-ItemProperty -Path '${psQuote(entry.approvedKey)}' -Name '${psQuote(entry.name)}' -PropertyType Binary -Value ([byte[]](${bytesLiteral})) -Force | Out-Null
  `;
  await runPowerShell(script);
  return { id: entry.id, enabled };
}

async function removeStartupEntry(entry) {
  const script = `
    $ErrorActionPreference = 'Stop'
    Remove-ItemProperty -Path '${psQuote(entry.keyPath)}' -Name '${psQuote(entry.name)}' -Force
  `;
  await runPowerShell(script);
  return { id: entry.id, removed: true };
}

module.exports = { scanStartup, setStartupEnabled, removeStartupEntry };
