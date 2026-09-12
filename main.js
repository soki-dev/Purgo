const { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { Worker } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const { getSystemInfo } = require('./src/engine/systemInfo');
const { scanJunk } = require('./src/engine/junkScanner');
const { clean } = require('./src/engine/cleaner');
const { scanRegistry } = require('./src/engine/registryScanner');
const { cleanRegistry } = require('./src/engine/registryCleaner');
const { scanStartup, setStartupEnabled, removeStartupEntry } = require('./src/engine/startupManager');
const { listPrograms, uninstallProgram } = require('./src/engine/programsManager');
const { scanDrivers } = require('./src/engine/driverScanner');
const { deleteFiles } = require('./src/engine/duplicateFinder');
const { scanResidue, deleteResidue } = require('./src/engine/residueFinder');
const { getSettings, updateSettings } = require('./src/engine/settingsStore');
const { addEntry, listHistory, getTotals, clearHistory, toCsv } = require('./src/engine/historyStore');
const { startScheduler } = require('./src/engine/scheduler');
const { isPinEnabled, setPin, clearPin, verifyPin } = require('./src/engine/security');
const { isElevated, relaunchElevated } = require('./src/engine/elevation');
const { listServices, setServiceState, setServiceStartMode } = require('./src/engine/servicesManager');
const {
  getActivePowerPlan,
  setPowerPlan,
  listBackgroundApps,
  killProcess,
  HIGH_PERFORMANCE_GUID,
  BALANCED_GUID
} = require('./src/engine/performanceMode');

let mainWindow;
let tray;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#12141a',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (event) => {
    const settings = getSettings();
    if (!isQuitting && settings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

async function runQuickClean() {
  const items = await scanJunk();
  const safeIds = items.filter((i) => i.risk === 'safe').map((i) => i.id);
  if (safeIds.length === 0) return { freedBytes: 0, itemCount: 0 };

  const results = await clean(safeIds);
  const freedBytes = results.reduce((sum, r) => sum + (r.freedBytes || 0), 0);
  addEntry({
    type: 'quick-clean',
    category: 'clean',
    summary: `Schnell-Reinigung: ${safeIds.length} Kategorien bereinigt`,
    freedBytes,
    itemCount: safeIds.length,
    details: results
  });
  return { freedBytes, itemCount: safeIds.length };
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'));
  tray.setToolTip('Purgo');

  const menu = Menu.buildFromTemplate([
    { label: 'Öffnen', click: () => mainWindow.show() },
    {
      label: 'Schnell-Scan & Bereinigen',
      click: async () => {
        const result = await runQuickClean().catch(() => null);
        if (result && mainWindow) mainWindow.webContents.send('history:updated', result);
      }
    },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
  tray.on('click', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  startScheduler((result) => {
    if (mainWindow) mainWindow.webContents.send('history:updated', result);
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- System ---
ipcMain.handle('system:getInfo', () => getSystemInfo());

// --- Junk-Cleaner ---
ipcMain.handle('junk:scan', async () => {
  const items = await scanJunk();
  const totalBytes = items.reduce((sum, i) => sum + i.sizeBytes, 0);
  addEntry({
    type: 'junk-scan',
    category: 'scan',
    summary: `Junk-Scan: ${items.length} Kategorien, ${items.length ? '' : 'nichts'} gefunden`,
    freedBytes: 0,
    itemCount: items.length,
    details: { totalBytes, categories: items.map((i) => ({ label: i.label, sizeBytes: i.sizeBytes })) }
  });
  return items;
});
ipcMain.handle('junk:clean', async (_event, ids) => {
  const results = await clean(ids);
  const freedBytes = results.reduce((sum, r) => sum + (r.freedBytes || 0), 0);
  addEntry({
    type: 'junk-clean',
    category: 'clean',
    summary: `Junk-Bereinigung: ${ids.length} Kategorien`,
    freedBytes,
    itemCount: ids.length,
    details: results
  });
  return results;
});
ipcMain.handle('junk:quickClean', () => runQuickClean());

// --- Registry-Cleaner ---
ipcMain.handle('registry:scan', async () => {
  const items = await scanRegistry();
  addEntry({
    type: 'registry-scan',
    category: 'scan',
    summary: `Registry-Scan: ${items.length} verwaiste Einträge gefunden`,
    itemCount: items.length,
    details: items.map((i) => ({ label: i.label, category: i.category }))
  });
  return items;
});
ipcMain.handle('registry:clean', async (_event, items) => {
  const results = await cleanRegistry(items);
  addEntry({
    type: 'registry-clean',
    category: 'clean',
    summary: `Registry-Bereinigung: ${items.length} Einträge`,
    freedBytes: 0,
    itemCount: items.length,
    details: results
  });
  return results;
});

// --- Autostart ---
ipcMain.handle('startup:scan', async () => {
  const items = await scanStartup();
  addEntry({
    type: 'startup-scan',
    category: 'scan',
    summary: `Autostart-Scan: ${items.length} Einträge gefunden`,
    itemCount: items.length
  });
  return items;
});
ipcMain.handle('startup:toggle', async (_event, { entry, enabled }) => {
  const result = await setStartupEnabled(entry, enabled);
  addEntry({
    type: 'startup-toggle',
    category: 'program',
    summary: `Autostart ${enabled ? 'aktiviert' : 'deaktiviert'}: ${entry.name}`,
    details: { name: entry.name, hive: entry.hive, enabled }
  });
  return result;
});
ipcMain.handle('startup:remove', async (_event, entry) => {
  const result = await removeStartupEntry(entry);
  addEntry({
    type: 'startup-remove',
    category: 'program',
    summary: `Autostart-Eintrag entfernt: ${entry.name}`,
    details: { name: entry.name, hive: entry.hive }
  });
  return result;
});

// --- Programme ---
ipcMain.handle('programs:list', async () => {
  const items = await listPrograms();
  addEntry({
    type: 'programs-scan',
    category: 'scan',
    summary: `Programme geladen: ${items.length} gefunden`,
    itemCount: items.length
  });
  return items;
});
ipcMain.handle('programs:uninstall', async (_event, program) => {
  const result = await uninstallProgram(program);
  addEntry({
    type: 'program-uninstall',
    category: 'program',
    summary: `Deinstalliert: ${program.name}`,
    details: { name: program.name, publisher: program.publisher }
  });
  return result;
});

// --- Software-Reste ---
ipcMain.handle('residue:scan', async () => {
  const items = await scanResidue();
  addEntry({
    type: 'residue-scan',
    category: 'scan',
    summary: `Reste-Scan: ${items.length} verdächtige Ordner gefunden`,
    itemCount: items.length,
    details: items.map((i) => ({ label: i.label, sizeBytes: i.sizeBytes }))
  });
  return items;
});
ipcMain.handle('residue:delete', (_event, paths) => {
  const results = deleteResidue(paths);
  addEntry({
    type: 'residue-clean',
    category: 'clean',
    summary: `Programm-Reste gelöscht: ${paths.length} Ordner`,
    freedBytes: 0,
    itemCount: paths.length,
    details: results
  });
  return results;
});

// --- Treiber ---
ipcMain.handle('drivers:scan', async () => {
  const items = await scanDrivers();
  addEntry({
    type: 'drivers-scan',
    category: 'scan',
    summary: `Treiber-Scan: ${items.filter((d) => d.outdated).length} von ${items.length} möglicherweise veraltet`,
    itemCount: items.length
  });
  return items;
});

// --- Duplikat-Finder ---
ipcMain.handle('duplicates:pickFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
ipcMain.handle('duplicates:scan', (_event, folderPath) => {
  const settings = getSettings();
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'src', 'engine', 'workers', 'duplicateWorker.js'), {
      workerData: { rootPath: folderPath, excludedPaths: settings.excludedPaths }
    });
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        if (mainWindow) mainWindow.webContents.send('duplicates:progress', msg);
      } else if (msg.type === 'done') {
        worker.terminate();
        const wastedBytes = msg.groups.reduce((sum, g) => sum + g.wastedBytes, 0);
        addEntry({
          type: 'duplicates-scan',
          category: 'scan',
          summary: `Duplikat-Scan in ${folderPath}: ${msg.groups.length} Gruppen`,
          itemCount: msg.groups.length,
          details: { folderPath, wastedBytes }
        });
        resolve(msg.groups);
      } else if (msg.type === 'error') {
        worker.terminate();
        reject(new Error(msg.error));
      }
    });
    worker.on('error', reject);
  });
});
ipcMain.handle('duplicates:delete', (_event, paths) => {
  const results = deleteFiles(paths);
  const freedBytes = results.reduce((sum, r) => sum + (r.freedBytes || 0), 0);
  addEntry({
    type: 'duplicate-clean',
    category: 'clean',
    summary: `Duplikate gelöscht: ${paths.length} Dateien`,
    freedBytes,
    itemCount: paths.length,
    details: results
  });
  return results;
});

// --- Speicherplatz-Analyzer ---
ipcMain.handle('space:pickFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
ipcMain.handle('space:list', (_event, rootPath) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'src', 'engine', 'workers', 'spaceWorker.js'), {
      workerData: { rootPath }
    });
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        if (mainWindow) mainWindow.webContents.send('space:progress', msg);
      } else if (msg.type === 'done') {
        worker.terminate();
        resolve(msg.entries);
      } else if (msg.type === 'error') {
        worker.terminate();
        reject(new Error(msg.error));
      }
    });
    worker.on('error', reject);
  });
});

// --- Einstellungen ---
ipcMain.handle('settings:get', () => getSettings());
ipcMain.handle('settings:update', (_event, partial) => {
  const merged = updateSettings(partial);
  const description = Object.keys(partial)
    .map((key) => (typeof partial[key] === 'object' ? `${key}: ${JSON.stringify(partial[key])}` : `${key}: ${partial[key]}`))
    .join(', ');
  addEntry({
    type: 'settings-change',
    category: 'settings',
    summary: `Einstellung geändert: ${description}`,
    details: partial
  });
  return merged;
});
ipcMain.handle('settings:pickExcludeFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// --- Sicherheit / PIN ---
ipcMain.handle('security:isEnabled', () => isPinEnabled());
ipcMain.handle('security:setPin', (_event, pin) => setPin(pin));
ipcMain.handle('security:clearPin', () => clearPin());
ipcMain.handle('security:verifyPin', (_event, pin) => verifyPin(pin));

// --- Verlauf ---
ipcMain.handle('history:list', (_event, { limit, category } = {}) => listHistory(limit, category));
ipcMain.handle('history:totals', () => getTotals());
ipcMain.handle('history:clear', () => {
  clearHistory();
  return { ok: true };
});
ipcMain.handle('history:export', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'purgo-verlauf.csv',
    filters: [{ name: 'CSV-Datei', extensions: ['csv'] }]
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, toCsv(), 'utf8');
  return result.filePath;
});

// --- Auto-Update ---
autoUpdater.autoDownload = false;

ipcMain.handle('update:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, version: result?.updateInfo?.version || null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

autoUpdater.on('update-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update:status', { status: 'available', version: info.version });
});
autoUpdater.on('update-not-available', () => {
  if (mainWindow) mainWindow.webContents.send('update:status', { status: 'not-available' });
});
autoUpdater.on('error', (err) => {
  if (mainWindow) mainWindow.webContents.send('update:status', { status: 'error', error: err.message });
});

// --- Admin-Rechte ---
ipcMain.handle('elevation:isElevated', () => isElevated());
ipcMain.handle('elevation:relaunch', () => relaunchElevated());

// --- Windows-Dienste ---
ipcMain.handle('services:list', () => listServices());
ipcMain.handle('services:setState', async (_event, { name, action }) => {
  const result = await setServiceState(name, action);
  addEntry({
    type: 'service-state-change',
    category: 'program',
    summary: `Dienst ${name}: ${action}`,
    details: { name, action }
  });
  return result;
});
ipcMain.handle('services:setStartMode', async (_event, { name, mode }) => {
  const result = await setServiceStartMode(name, mode);
  addEntry({
    type: 'service-startmode-change',
    category: 'program',
    summary: `Dienst ${name}: Starttyp auf ${mode} gesetzt`,
    details: { name, mode }
  });
  return result;
});

// --- Performance-Modus ---
ipcMain.handle('performance:getPowerPlan', () => getActivePowerPlan());
ipcMain.handle('performance:setPowerPlan', async (_event, mode) => {
  const guid = mode === 'high' ? HIGH_PERFORMANCE_GUID : BALANCED_GUID;
  const result = await setPowerPlan(guid);
  addEntry({
    type: 'power-plan-change',
    category: 'program',
    summary: `Energieplan gewechselt: ${mode === 'high' ? 'Höchstleistung' : 'Ausbalanciert'}`,
    details: { mode }
  });
  return result;
});
ipcMain.handle('performance:listBackgroundApps', () => listBackgroundApps());
ipcMain.handle('performance:killProcess', async (_event, { pid, name }) => {
  const result = await killProcess(pid);
  addEntry({
    type: 'process-killed',
    category: 'program',
    summary: `Prozess beendet: ${name || pid}`,
    details: { pid, name }
  });
  return result;
});

// --- Shell ---
ipcMain.handle('shell:openExternal', (_event, url) => shell.openExternal(url));
