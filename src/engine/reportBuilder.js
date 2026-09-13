function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function buildReportHtml({ systemInfo, totals, recentHistory, diskHealth }) {
  const generatedAt = new Date().toLocaleString('de-DE');

  const diskRows = (systemInfo.disks || [])
    .map((d) => `<tr><td>${escapeHtml(d.drive)}</td><td>${d.usedPercent}%</td><td>${formatBytes(d.totalBytes)}</td></tr>`)
    .join('');

  const healthRows = (diskHealth || [])
    .map((d) => `<tr><td>${escapeHtml(d.name)}</td><td>${escapeHtml(d.health)}</td><td>${escapeHtml(d.mediaType)}</td></tr>`)
    .join('');

  const historyRows = (recentHistory || [])
    .map((e) => `<tr><td>${new Date(e.timestamp).toLocaleString('de-DE')}</td><td>${escapeHtml(e.summary || e.type)}</td><td>${formatBytes(e.freedBytes || 0)}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Purgo System-Health-Report</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #12141a; color: #e8eaf0; padding: 32px; }
  h1 { color: #3ddc97; }
  h2 { border-bottom: 1px solid #2a2f3f; padding-bottom: 6px; margin-top: 32px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #2a2f3f; font-size: 13px; }
  th { color: #8b90a3; font-weight: 600; }
  .score { font-size: 42px; font-weight: 700; color: #3ddc97; }
  .meta { color: #8b90a3; font-size: 12px; }
</style>
</head>
<body>
  <h1>Purgo &ndash; System-Health-Report</h1>
  <div class="meta">Erstellt am ${escapeHtml(generatedAt)} &middot; ${escapeHtml(systemInfo.hostname)} &middot; ${escapeHtml(systemInfo.platform)}</div>

  <h2>System-Health</h2>
  <div class="score">${systemInfo.healthScore} / 100</div>
  <p>CPU-Auslastung: ${systemInfo.cpuLoad}% &middot; Arbeitsspeicher: ${systemInfo.memory.usedPercent}%</p>

  <h2>Laufwerke</h2>
  <table><tr><th>Laufwerk</th><th>Belegt</th><th>Gesamtgröße</th></tr>${diskRows || '<tr><td colspan="3">Keine Daten</td></tr>'}</table>

  ${diskHealth && diskHealth.length ? `<h2>Datenträger-Gesundheit</h2><table><tr><th>Datenträger</th><th>Status</th><th>Typ</th></tr>${healthRows}</table>` : ''}

  <h2>Bisher freigegeben</h2>
  <p>${formatBytes(totals.totalFreedBytes)} über ${totals.totalRuns} protokollierte Aktionen.</p>

  <h2>Letzte Aktionen</h2>
  <table><tr><th>Zeitpunkt</th><th>Aktion</th><th>Freigegeben</th></tr>${historyRows || '<tr><td colspan="3">Keine Einträge</td></tr>'}</table>
</body>
</html>`;
}

module.exports = { buildReportHtml };
