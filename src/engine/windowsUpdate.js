const { runPowerShell, parseJsonSafe } = require('./powershell');

// Die Windows-Update-Suche über die COM-API kann echt lange dauern (30-90s je nach
// System), daher ein eigenes, deutlich längeres Timeout statt des Standardwerts.
const UPDATE_SEARCH_TIMEOUT_MS = 120_000;

const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
try {
  $session = New-Object -ComObject Microsoft.Update.Session
  $searcher = $session.CreateUpdateSearcher()
  $result = $searcher.Search("IsInstalled=0 and IsHidden=0")
  $out = @()
  foreach ($update in $result.Updates) {
    $out += [PSCustomObject]@{
      title = $update.Title
      description = $update.Description
      sizeBytes = $update.MaxDownloadSize
      severity = $update.MsrcSeverity
      kb = ($update.KBArticleIDs -join ', ')
    }
  }
  $out | ConvertTo-Json -Compress
} catch {
  '[]'
}
`;

async function listPendingUpdates() {
  const stdout = await runPowerShell(SCRIPT, UPDATE_SEARCH_TIMEOUT_MS);
  const raw = parseJsonSafe(stdout);
  return raw
    .filter((u) => u && u.title)
    .map((u) => ({
      title: u.title,
      description: u.description || '',
      sizeBytes: Number(u.sizeBytes) || 0,
      severity: u.severity || 'Nicht bewertet',
      kb: u.kb || ''
    }));
}

module.exports = { listPendingUpdates, UPDATE_SEARCH_TIMEOUT_MS };
