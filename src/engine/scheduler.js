const cron = require('node-cron');
const { getSettings, updateSettings } = require('./settingsStore');
const { scanJunk } = require('./junkScanner');
const { clean } = require('./cleaner');
const { addEntry } = require('./historyStore');

const FREQUENCY_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000
};

let task = null;

// Die App läuft nicht rund um die Uhr als Dienst, sondern nur während sie (ggf. im
// Tray) offen ist. Statt eines festen Uhrzeit-Cronjobs wird deshalb stündlich geprüft,
// ob seit dem letzten Lauf mehr Zeit vergangen ist als die eingestellte Frequenz erlaubt.
async function runScheduledCleanIfDue() {
  const settings = getSettings();
  if (!settings.scheduler.enabled) return null;

  const intervalMs = FREQUENCY_MS[settings.scheduler.frequency] || FREQUENCY_MS.weekly;
  const lastRun = settings.scheduler.lastRun ? new Date(settings.scheduler.lastRun).getTime() : 0;
  if (Date.now() - lastRun < intervalMs) return null;

  const items = await scanJunk();
  const safeIds = items.filter((i) => i.risk === 'safe').map((i) => i.id);

  let freedBytes = 0;
  if (safeIds.length > 0) {
    const results = await clean(safeIds);
    freedBytes = results.reduce((sum, r) => sum + (r.freedBytes || 0), 0);
    addEntry({ type: 'scheduled-clean', freedBytes, itemCount: safeIds.length });
  }

  updateSettings({ scheduler: { ...settings.scheduler, lastRun: new Date().toISOString() } });
  return { freedBytes, itemCount: safeIds.length };
}

function startScheduler(onAutoClean) {
  if (task) return;

  task = cron.schedule('0 * * * *', async () => {
    const result = await runScheduledCleanIfDue().catch(() => null);
    if (result && onAutoClean) onAutoClean(result);
  });

  // Direkt beim Start prüfen, damit ein überfälliger Lauf nicht erst auf den
  // nächsten stündlichen Cron-Tick warten muss.
  runScheduledCleanIfDue()
    .then((result) => {
      if (result && onAutoClean) onAutoClean(result);
    })
    .catch(() => {});
}

module.exports = { startScheduler, runScheduledCleanIfDue };
