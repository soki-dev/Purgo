const { execFile } = require('child_process');
const path = require('path');
const { app } = require('electron');

const TASK_NAME = 'PurgoScheduledClean';

function execFileP(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

function buildCommandLine() {
  const exe = process.execPath;
  if (app.isPackaged) {
    return `"${exe}" --scheduled-clean`;
  }
  const appRoot = path.resolve(__dirname, '..', '..');
  return `"${exe}" "${appRoot}" --scheduled-clean`;
}

async function isTaskRegistered() {
  return new Promise((resolve) => {
    execFile('schtasks', ['/Query', '/TN', TASK_NAME], { windowsHide: true }, (err) => resolve(!err));
  });
}

// Läuft über die native Windows-Aufgabenplanung statt eines In-App-Timers, damit die
// geplante Reinigung auch zuverlässig ausgeführt wird, wenn Purgo selbst gerade nicht
// (auch nicht im Tray) läuft.
async function registerScheduledTask(frequency) {
  const schedule = frequency === 'daily' ? 'DAILY' : 'WEEKLY';
  await execFileP('schtasks', [
    '/Create',
    '/TN', TASK_NAME,
    '/TR', buildCommandLine(),
    '/SC', schedule,
    '/ST', '09:00',
    '/F'
  ]);
  return { ok: true };
}

async function unregisterScheduledTask() {
  await execFileP('schtasks', ['/Delete', '/TN', TASK_NAME, '/F']).catch(() => {});
  return { ok: true };
}

module.exports = { isTaskRegistered, registerScheduledTask, unregisterScheduledTask, TASK_NAME };
