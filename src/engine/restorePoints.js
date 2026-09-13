const { runPowerShell, parseJsonSafe, psQuote } = require('./powershell');

const CREATE_TIMEOUT_MS = 60_000;

async function listRestorePoints() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    Get-ComputerRestorePoint | Select-Object SequenceNumber, Description, CreationTime, RestorePointType | ConvertTo-Json -Compress
  `;
  const raw = parseJsonSafe(await runPowerShell(script));
  return raw
    .filter((p) => p && p.SequenceNumber !== undefined)
    .map((p) => ({
      sequenceNumber: p.SequenceNumber,
      description: p.Description || '',
      createdAt: p.CreationTime || null,
      type: p.RestorePointType
    }))
    .sort((a, b) => b.sequenceNumber - a.sequenceNumber);
}

async function createRestorePoint(description) {
  // Windows lässt standardmäßig nur einen Systemschutz-Wiederherstellungspunkt pro
  // 24h zu (SystemRestorePointCreationFrequency) - ein zweiter Aufruf kurz danach
  // erzeugt schlicht keinen neuen Punkt, ohne Fehler zu werfen.
  await runPowerShell(
    `Checkpoint-Computer -Description '${psQuote(description)}' -RestorePointType MODIFY_SETTINGS`,
    CREATE_TIMEOUT_MS
  );
  return { ok: true };
}

// AUSDRÜCKLICH DISRUPTIV: Restore-Computer startet den PC sofort neu, um die
// Wiederherstellung durchzuführen. Muss in der UI entsprechend deutlich davor warnen.
async function restoreToPoint(sequenceNumber) {
  await runPowerShell(`Restore-Computer -RestorePoint ${Number(sequenceNumber)} -Confirm:$false`, CREATE_TIMEOUT_MS);
  return { ok: true };
}

module.exports = { listRestorePoints, createRestorePoint, restoreToPoint };
