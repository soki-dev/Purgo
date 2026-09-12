// Manueller Smoke-Test, kein Teil von `npm test`: startet die echte Electron-App und
// prüft nur, dass sie nicht innerhalb weniger Sekunden abstürzt. Ersetzt nicht die
// Unit-Tests unter test/, dient nur als schneller Rauch-Test nach größeren Änderungen.
const { spawn } = require('child_process');
const path = require('path');
const electronPath = require('electron');

const proc = spawn(electronPath, [path.join(__dirname, '..')], { stdio: 'inherit' });

let exited = false;
proc.on('exit', (code) => {
  exited = true;
  if (code !== 0 && code !== null) {
    console.error(`Purgo ist mit Code ${code} beendet worden.`);
    process.exitCode = 1;
  }
});

setTimeout(() => {
  if (exited) return;
  console.log('Purgo läuft nach 5 Sekunden noch – Smoke-Test ok, beende...');
  proc.kill();
}, 5000);
