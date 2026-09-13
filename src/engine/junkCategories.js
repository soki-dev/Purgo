const os = require('os');
const path = require('path');
const fs = require('fs');

function firstExistingPath(candidates) {
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

const chromeUserData = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default');
const edgeUserData = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default');

// Firefox verteilt sein Profil auf zwei Orte: das "roaming" Profil (AppData\Roaming)
// enthält die eigentlichen Nutzerdaten (Cookies, Formularverlauf, Lesezeichen, ...),
// das "lokale" Profil (AppData\Local) nur performance-kritischen Cache, der bewusst
// nicht mit dem Nutzerprofil wandert. Beide Ordner nutzen denselben Profilnamen.
const firefoxProfilesDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
const firefoxLocalProfilesDir = path.join(os.homedir(), 'AppData', 'Local', 'Mozilla', 'Firefox', 'Profiles');

// kind:
//  'dir'               -> path ist ein Ordner, dessen INHALT rekursiv gelöscht wird
//  'file'              -> path ist genau eine Datei
//  'firefox-profile'   -> relativeTarget wird in jedem Firefox-Profilordner gesucht (fileKind: 'dir' | 'file');
//                         base: 'roaming' (Standard, echte Nutzerdaten) oder 'local' (nur Cache)
//
// risk: 'safe' = standardmäßig angehakt, 'medium' = Nutzer muss bewusst aktivieren
const CATEGORY_DEFS = [
  {
    id: 'user-temp',
    label: 'Benutzer-Temp-Dateien',
    description: 'Temporäre Dateien aus %TEMP%, die Programme zurückgelassen haben.',
    kind: 'dir',
    path: os.tmpdir(),
    risk: 'safe',
    defaultChecked: true
  },
  {
    id: 'windows-temp',
    label: 'Windows-Temp-Dateien',
    description: 'Temporäre Systemdateien unter C:\\Windows\\Temp.',
    kind: 'dir',
    path: 'C:\\Windows\\Temp',
    risk: 'safe',
    defaultChecked: true
  },
  {
    id: 'chrome-cache',
    label: 'Chrome-Cache',
    description: 'Zwischengespeicherte Webseitendaten von Google Chrome.',
    kind: 'dir',
    path: path.join(chromeUserData, 'Cache'),
    risk: 'safe',
    defaultChecked: true
  },
  {
    id: 'edge-cache',
    label: 'Edge-Cache',
    description: 'Zwischengespeicherte Webseitendaten von Microsoft Edge.',
    kind: 'dir',
    path: path.join(edgeUserData, 'Cache'),
    risk: 'safe',
    defaultChecked: true
  },
  {
    id: 'firefox-cache',
    label: 'Firefox-Cache',
    description: 'Zwischengespeicherte Webseitendaten von Mozilla Firefox.',
    kind: 'firefox-profile',
    fileKind: 'dir',
    base: 'local',
    relativeTarget: 'cache2',
    risk: 'safe',
    defaultChecked: true
  },
  {
    id: 'windows-update-cache',
    label: 'Windows-Update-Downloads',
    description: 'Bereits installierte Windows-Update-Pakete, die noch als Download-Cache herumliegen.',
    kind: 'dir',
    path: 'C:\\Windows\\SoftwareDistribution\\Download',
    risk: 'medium',
    defaultChecked: false
  },
  {
    id: 'chrome-cookies',
    label: 'Chrome-Cookies',
    description: 'Meldet dich auf Webseiten ab. Chrome muss geschlossen sein.',
    kind: 'file',
    path: firstExistingPath([
      path.join(chromeUserData, 'Network', 'Cookies'),
      path.join(chromeUserData, 'Cookies')
    ]),
    risk: 'medium',
    defaultChecked: false
  },
  {
    id: 'chrome-history',
    label: 'Chrome-Verlauf & Downloads-Liste',
    description: 'Browserverlauf und die Liste heruntergeladener Dateien (nicht die Dateien selbst). Chrome muss geschlossen sein.',
    kind: 'file',
    path: path.join(chromeUserData, 'History'),
    risk: 'medium',
    defaultChecked: false
  },
  {
    id: 'chrome-autofill',
    label: 'Chrome-Autofill-Daten',
    description: 'Gespeicherte Formular- und Zahlungs-Metadaten. Chrome muss geschlossen sein.',
    kind: 'file',
    path: path.join(chromeUserData, 'Web Data'),
    risk: 'medium',
    defaultChecked: false
  },
  {
    id: 'edge-cookies',
    label: 'Edge-Cookies',
    description: 'Meldet dich auf Webseiten ab. Edge muss geschlossen sein.',
    kind: 'file',
    path: firstExistingPath([
      path.join(edgeUserData, 'Network', 'Cookies'),
      path.join(edgeUserData, 'Cookies')
    ]),
    risk: 'medium',
    defaultChecked: false
  },
  {
    id: 'edge-history',
    label: 'Edge-Verlauf & Downloads-Liste',
    description: 'Browserverlauf und die Liste heruntergeladener Dateien (nicht die Dateien selbst). Edge muss geschlossen sein.',
    kind: 'file',
    path: path.join(edgeUserData, 'History'),
    risk: 'medium',
    defaultChecked: false
  },
  {
    id: 'edge-autofill',
    label: 'Edge-Autofill-Daten',
    description: 'Gespeicherte Formular- und Zahlungs-Metadaten. Edge muss geschlossen sein.',
    kind: 'file',
    path: path.join(edgeUserData, 'Web Data'),
    risk: 'medium',
    defaultChecked: false
  },
  {
    id: 'firefox-cookies',
    label: 'Firefox-Cookies',
    description: 'Meldet dich auf Webseiten ab. Firefox muss geschlossen sein.',
    kind: 'firefox-profile',
    fileKind: 'file',
    base: 'roaming',
    relativeTarget: 'cookies.sqlite',
    risk: 'medium',
    defaultChecked: false
  },
  {
    id: 'firefox-autofill',
    label: 'Firefox-Formular-Autofill',
    description: 'Gespeicherte Formulareingaben (Suchfeld-Verlauf etc.). Firefox muss geschlossen sein. Der Seitenverlauf wird bei Firefox bewusst nicht angeboten, da er zusammen mit den Lesezeichen in einer Datei liegt.',
    kind: 'firefox-profile',
    fileKind: 'file',
    base: 'roaming',
    relativeTarget: 'formhistory.sqlite',
    risk: 'medium',
    defaultChecked: false
  }
];

module.exports = { CATEGORY_DEFS, firefoxProfilesDir, firefoxLocalProfilesDir };
