const { execFile } = require('child_process');
const path = require('path');
const { app } = require('electron');

// "net session" gibt ohne Admin-Rechte einen Fehler zurück, mit Admin-Rechten
// Ausgabe (oder zumindest keinen Zugriffsfehler) - klassischer, schneller Trick
// ohne PowerShell-Overhead.
function isElevated() {
  return new Promise((resolve) => {
    execFile('net', ['session'], { windowsHide: true }, (err) => resolve(!err));
  });
}

function psQuote(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function relaunchElevated() {
  const exePath = process.execPath;
  const args = app.isPackaged ? [] : [path.resolve(__dirname, '..', '..')];
  const argList = args.map((a) => `'${psQuote(a)}'`).join(',');
  const script = args.length
    ? `Start-Process -FilePath '${psQuote(exePath)}' -ArgumentList @(${argList}) -Verb RunAs`
    : `Start-Process -FilePath '${psQuote(exePath)}' -Verb RunAs`;

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true },
      (err) => {
        if (err) return reject(err);
        app.quit();
        resolve({ ok: true });
      }
    );
  });
}

module.exports = { isElevated, relaunchElevated };
