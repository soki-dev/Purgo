const crypto = require('crypto');
const { getSettings, updateSettings } = require('./settingsStore');

// Kein Schutz vor einem versierten Angreifer mit Zugriff auf denselben Windows-Account
// (das wäre auf einem lokalen Ein-Nutzer-Tool ohnehin nicht sinnvoll durchsetzbar) –
// dient als bewusste zusätzliche Bestätigungs-Hürde vor riskanten Aktionen, ähnlich
// Neox' Tamper-Schutz.
function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

function isPinEnabled() {
  return !!getSettings().security.pinEnabled;
}

function setPin(pin) {
  updateSettings({ security: { pinEnabled: true, pinHash: hashPin(pin) } });
  return { ok: true };
}

function clearPin() {
  updateSettings({ security: { pinEnabled: false, pinHash: null } });
  return { ok: true };
}

function verifyPin(pin) {
  const settings = getSettings();
  return !!settings.security.pinHash && settings.security.pinHash === hashPin(pin);
}

module.exports = { isPinEnabled, setPin, clearPin, verifyPin };
