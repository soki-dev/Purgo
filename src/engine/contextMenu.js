const { execFile } = require('child_process');
const { app } = require('electron');

const MENU_LABEL = 'Mit Purgo analysieren';
const KEY_DIR = 'HKCU\\Software\\Classes\\Directory\\shell\\Purgo';
const KEY_BACKGROUND = 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\Purgo';

function execFileP(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

function getExePath() {
  if (!app.isPackaged) return null;
  return process.execPath;
}

async function isRegistered() {
  return new Promise((resolve) => {
    execFile('reg.exe', ['query', KEY_DIR], { windowsHide: true }, (err) => resolve(!err));
  });
}

async function registerContextMenu() {
  const exe = getExePath();
  if (!exe) {
    throw new Error('Das Kontextmenü kann nur in der installierten Version registriert werden, nicht im Entwicklungsmodus.');
  }

  await execFileP('reg.exe', ['add', KEY_DIR, '/ve', '/d', MENU_LABEL, '/f']);
  await execFileP('reg.exe', ['add', KEY_DIR, '/v', 'Icon', '/d', exe, '/f']);
  await execFileP('reg.exe', ['add', `${KEY_DIR}\\command`, '/ve', '/d', `"${exe}" --analyze-path "%1"`, '/f']);

  await execFileP('reg.exe', ['add', KEY_BACKGROUND, '/ve', '/d', MENU_LABEL, '/f']);
  await execFileP('reg.exe', ['add', KEY_BACKGROUND, '/v', 'Icon', '/d', exe, '/f']);
  await execFileP('reg.exe', ['add', `${KEY_BACKGROUND}\\command`, '/ve', '/d', `"${exe}" --analyze-path "%V"`, '/f']);

  return { ok: true };
}

async function unregisterContextMenu() {
  await execFileP('reg.exe', ['delete', KEY_DIR, '/f']).catch(() => {});
  await execFileP('reg.exe', ['delete', KEY_BACKGROUND, '/f']).catch(() => {});
  return { ok: true };
}

module.exports = { isRegistered, registerContextMenu, unregisterContextMenu };
