// Baut den Installer und signiert ihn mit dem lokalen (selbstsignierten) Test-Zertifikat.
// Für eine ECHTE, von Windows SmartScreen vertraute Signatur wird ein Zertifikat einer
// anerkannten Zertifizierungsstelle benötigt (kostenpflichtig, mit Identitätsprüfung) -
// dieses Script demonstriert nur, dass die Signier-Pipeline funktioniert.
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const certDir = path.join(__dirname, '..', 'build', 'cert');
const certFile = path.join(certDir, 'purgo-selfsigned.pfx');
const pwFile = path.join(certDir, 'cert-password.txt');

if (!fs.existsSync(certFile) || !fs.existsSync(pwFile)) {
  console.error('Kein lokales Zertifikat gefunden. Erst ausführen: powershell -File scripts/create-self-signed-cert.ps1');
  process.exit(1);
}

const password = fs.readFileSync(pwFile, 'utf8').trim();

execFileSync('npx', ['electron-builder'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CSC_LINK: certFile, CSC_KEY_PASSWORD: password }
});
