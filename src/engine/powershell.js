const { execFile } = require('child_process');

const PS_TIMEOUT_MS = 25_000;
const PS_MAX_BUFFER = 10 * 1024 * 1024;

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: PS_TIMEOUT_MS, maxBuffer: PS_MAX_BUFFER, windowsHide: true },
      (err, stdout, stderr) => {
        if (err && !stdout) return reject(err);
        resolve(stdout);
      }
    );
  });
}

function parseJsonSafe(stdout) {
  const trimmed = (stdout || '').trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function psQuote(value) {
  return String(value ?? '').replace(/'/g, "''");
}

module.exports = { runPowerShell, parseJsonSafe, psQuote };
