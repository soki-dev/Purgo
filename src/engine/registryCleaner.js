const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getBackupDir() {
  const dir = path.join(app.getPath('userData'), 'registry-backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function execFileP(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, timeout: 15_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

// Jeder Eintrag wird vor dem Löschen als .reg-Datei gesichert, damit sich eine
// versehentliche Bereinigung per Doppelklick auf die Backup-Datei rückgängig
// machen lässt.
async function cleanRegistry(items) {
  const backupDir = getBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const results = [];

  for (const item of items) {
    const safeName = item.label.replace(/[^a-z0-9]/gi, '_').slice(0, 40) || 'eintrag';
    const backupFile = path.join(backupDir, `${timestamp}_${safeName}.reg`);
    try {
      await execFileP('reg.exe', ['export', item.keyPath, backupFile, '/y']);
      if (item.valueName) {
        await execFileP('reg.exe', ['delete', item.keyPath, '/v', item.valueName, '/f']);
      } else {
        await execFileP('reg.exe', ['delete', item.keyPath, '/f']);
      }
      results.push({ id: item.id, ok: true, backupFile, keyPath: item.keyPath, valueName: item.valueName || null });
    } catch (err) {
      results.push({ id: item.id, ok: false, error: err.message });
    }
  }

  return results;
}

module.exports = { cleanRegistry, getBackupDir };
