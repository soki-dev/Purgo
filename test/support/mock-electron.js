// Engine-Module importieren `electron` für app.getPath(). Außerhalb des echten
// Electron-Prozesses liefert `require('electron')` nur einen Pfad-String zur
// Electron-Binary – kein {app, ...}-Objekt. Dieser Mock ersetzt den Require-Cache-
// Eintrag, BEVOR irgendein Engine-Modul geladen wird, damit Tests mit `node --test`
// ganz ohne echten Electron-Prozess laufen.
const path = require('path');
const os = require('os');
const fs = require('fs');

const testUserData = path.join(os.tmpdir(), 'purgo-test-userdata');
fs.mkdirSync(testUserData, { recursive: true });

const electronPath = require.resolve('electron');
require.cache[electronPath] = {
  id: electronPath,
  filename: electronPath,
  loaded: true,
  exports: {
    app: {
      getPath: () => testUserData,
      isPackaged: false
    }
  }
};

module.exports = { testUserData };
