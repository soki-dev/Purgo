const { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog, Notification } = require('electron');
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
const { getSettings, updateSettings, resetSettings } = require('./src/engine/settingsStore');
const { addEntry, listHistory, getTotals, clearHistory, toCsv, getDailyTrend } = require('./src/engine/historyStore');
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
const { getBootTimeHistory } = require('./src/engine/bootTime');
const { listPendingUpdates } = require('./src/engine/windowsUpdate');
const { getDiskHealth } = require('./src/engine/diskHealth');
const { isRegistered: isContextMenuRegistered, registerContextMenu, unregisterContextMenu } = require('./src/engine/contextMenu');
const { isTaskRegistered, registerScheduledTask, unregisterScheduledTask } = require('./src/engine/taskScheduler');
const { listAllExtensions, setExtensionEnabled } = require('./src/engine/browserExtensions');
const { trimAllProcesses } = require('./src/engine/memoryCleaner');
const { buildReportHtml } = require('./src/engine/reportBuilder');
const { listRestorePoints, createRestorePoint, restoreToPoint } = require('./src/engine/restorePoints');
const { getBitLockerStatus, getFirewallStatus, getDiagnosticDataLevel } = require('./src/engine/securityStatus');
const { listConnections, flushDns, resetWinsock } = require('./src/engine/networkTools');

let mainWindow;
let tray;
let isQuitting = false;

function formatBytesSimple(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function notify(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, icon: path.join(__dirname, 'assets', 'icon.png') }).show();
}

function extractArgValue(argv, flag) {
  const idx = argv.indexOf(flag);
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : null;
}

function hasFlag(argv, flag) {
  return argv.includes(flag);
}

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

// CLI-Modus deckt bewusst nur lesende Scans plus die bereits als sicher geltende
// Schnell-Reinigung ab - riskantere Aktionen (Registry löschen, Programme
// deinstallieren, ...) bleiben der UI mit ihren Bestätigungs-/PIN-Abfragen
// vorbehalten und werden hier nicht scriptbar gemacht.
async function runCliCommand(command) {
  switch (command) {
    case 'scan-junk':
      return scanJunk();
    case 'quick-clean':
      return runQuickClean();
    case 'scan-registry':
      return scanRegistry();
    case 'scan-startup':
      return scanStartup();
    default:
      throw new Error(`Unbekannter CLI-Befehl: ${command}. Verfügbar: scan-junk, quick-clean, scan-registry, scan-startup`);
  }
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

// --- Single Instance: nötig, damit Explorer-Kontextmenü-Klicks und geplante
// Aufgabenplanungs-Läufe eine bereits laufende Instanz ansprechen statt eine zweite
// App-Instanz zu starten. ---
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', async (_event, argv) => {
    const analyzePath = extractArgValue(argv, '--analyze-path');
    if (analyzePath && mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('shell:analyzePath', analyzePath);
      return;
    }
    if (hasFlag(argv, '--scheduled-clean')) {
      const result = await runQuickClean().catch(() => null);
      if (result) {
        notify('Purgo – Geplante Reinigung', `${formatBytesSimple(result.freedBytes)} freigegeben.`);
        if (mainWindow) mainWindow.webContents.send('history:updated', result);
      }
    }
  });

  app.whenReady().then(async () => {
    const cliCommand = extractArgValue(process.argv, '--cli');
    if (cliCommand) {
      // Headless Silent-Modus für Skripte: kein Fenster, Ergebnis geht in eine
      // JSON-Datei statt stdout, weil gepackte Windows-GUI-Apps standardmäßig
      // keine Konsole zum Aufrufer haben.
      const outPath = extractArgValue(process.argv, '--out') || path.join(app.getPath('userData'), 'cli-result.json');
      try {
        const result = await runCliCommand(cliCommand);
        fs.writeFileSync(outPath, JSON.stringify({ ok: true, command: cliCommand, result }, null, 2), 'utf8');
      } catch (err) {
        fs.writeFileSync(outPath, JSON.stringify({ ok: false, command: cliCommand, error: err.message }, null, 2), 'utf8');
      }
      app.quit();
      return;
    }

    if (hasFlag(process.argv, '--scheduled-clean')) {
      // Von der Windows-Aufgabenplanung ausgelöst, während Purgo nicht lief: läuft
      // komplett unsichtbar, zeigt nur eine Benachrichtigung und beendet sich danach.
      const result = await runQuickClean().catch(() => null);
      if (result) notify('Purgo – Geplante Reinigung', `${formatBytesSimple(result.freedBytes)} freigegeben.`);
      app.quit();
      return;
    }

    createWindow();
    createTray();

    const analyzePath = extractArgValue(process.argv, '--analyze-path');
    mainWindow.webContents.once('did-finish-load', () => {
      if (analyzePath) mainWindow.webContents.send('shell:analyzePath', analyzePath);
      if (getSettings().autoCheckUpdates) autoUpdater.checkForUpdates().catch(() => {});
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- System ---
ipcMain.handle('system:getInfo', () => getSystemInfo());
ipcMain.handle('system:getBootTimeHistory', () => getBootTimeHistory());
ipcMain.handle('system:getDiskHealth', () => getDiskHealth());
ipcMain.handle('system:listPendingUpdates', () => listPendingUpdates());

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
ipcMain.handle('duplicates:scan', (_event, { folderPath, includeSimilarImages }) => {
  const settings = getSettings();
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'src', 'engine', 'workers', 'duplicateWorker.js'), {
      workerData: { rootPath: folderPath, excludedPaths: settings.excludedPaths, includeSimilarImages }
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
          summary: `Duplikat-Scan in ${folderPath}: ${msg.groups.length} Gruppen${msg.similarGroups.length ? `, ${msg.similarGroups.length} ähnliche Bilder-Gruppen` : ''}`,
          itemCount: msg.groups.length,
          details: { folderPath, wastedBytes }
        });
        resolve({ groups: msg.groups, similarGroups: msg.similarGroups });
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
ipcMain.handle('settings:update', async (_event, partial) => {
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

  if (partial.scheduler) {
    if (merged.scheduler.enabled) {
      await registerScheduledTask(merged.scheduler.frequency).catch((err) => {
        console.error('Konnte geplante Aufgabe nicht registrieren:', err.message);
      });
    } else {
      await unregisterScheduledTask().catch(() => {});
    }
  }

  return merged;
});
ipcMain.handle('settings:pickExcludeFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
ipcMain.handle('settings:export', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'purgo-settings.json',
    filters: [{ name: 'JSON-Datei', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, JSON.stringify(getSettings(), null, 2), 'utf8');
  return result.filePath;
});
ipcMain.handle('settings:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON-Datei', extensions: ['json'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const raw = fs.readFileSync(result.filePaths[0], 'utf8');
  const imported = JSON.parse(raw);
  return updateSettings(imported);
});

// --- Sicherheit / PIN ---
ipcMain.handle('security:isEnabled', () => isPinEnabled());
ipcMain.handle('security:setPin', (_event, pin) => setPin(pin));
ipcMain.handle('security:clearPin', () => clearPin());
ipcMain.handle('security:verifyPin', (_event, pin) => verifyPin(pin));

// --- Verlauf ---
ipcMain.handle('history:list', (_event, { limit, category } = {}) => listHistory(limit, category));
ipcMain.handle('history:totals', () => getTotals());
ipcMain.handle('history:trend', (_event, days) => getDailyTrend(days));
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

// --- System-Health-Report ---
ipcMain.handle('report:export', async () => {
  const [systemInfo, totals, recentHistory, diskHealth] = await Promise.all([
    getSystemInfo(),
    Promise.resolve(getTotals()),
    Promise.resolve(listHistory(20)),
    getDiskHealth().catch(() => [])
  ]);
  const html = buildReportHtml({ systemInfo, totals, recentHistory, diskHealth });

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'purgo-health-report.html',
    filters: [{ name: 'HTML-Datei', extensions: ['html'] }]
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, html, 'utf8');
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
ipcMain.handle('performance:trimMemory', async () => {
  const result = await trimAllProcesses();
  addEntry({
    type: 'memory-trim',
    category: 'program',
    summary: 'Arbeitsspeicher-Cleaner ausgeführt',
    details: result
  });
  return result;
});

// --- Explorer-Kontextmenü ---
ipcMain.handle('contextMenu:isRegistered', () => isContextMenuRegistered());
ipcMain.handle('contextMenu:register', () => registerContextMenu());
ipcMain.handle('contextMenu:unregister', () => unregisterContextMenu());

// --- Windows-Aufgabenplanung ---
ipcMain.handle('scheduler:isTaskRegistered', () => isTaskRegistered());

// --- Browser-Erweiterungen ---
ipcMain.handle('extensions:list', () => listAllExtensions());
ipcMain.handle('extensions:setEnabled', async (_event, { extension, enabled }) => {
  const result = await setExtensionEnabled(extension, enabled);
  addEntry({
    type: 'extension-toggle',
    category: 'program',
    summary: `Erweiterung ${enabled ? 'aktiviert' : 'deaktiviert'}: ${extension.name} (${extension.browser})`,
    details: { name: extension.name, browser: extension.browser, enabled }
  });
  return result;
});

// --- Purgo-Selbstverwaltung ---
ipcMain.handle('selfStartup:get', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('selfStartup:set', (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
  return { ok: true };
});
ipcMain.handle('app:resetAll', async () => {
  await unregisterScheduledTask().catch(() => {});
  clearHistory();
  const settings = resetSettings();
  return settings;
});
ipcMain.handle('app:getChangelog', () => {
  try {
    return fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf8');
  } catch {
    return '';
  }
});
ipcMain.handle('app:getVersion', () => app.getVersion());

// --- Eigene Bereinigungsregeln ---
ipcMain.handle('customRules:pickFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
ipcMain.handle('customRules:pickFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// --- Sicherheit ---
ipcMain.handle('security:listRestorePoints', () => listRestorePoints());
ipcMain.handle('security:createRestorePoint', async (_event, description) => {
  const result = await createRestorePoint(description);
  addEntry({ type: 'restore-point-create', category: 'program', summary: `Wiederherstellungspunkt erstellt: ${description}` });
  return result;
});
ipcMain.handle('security:restoreToPoint', async (_event, sequenceNumber) => {
  addEntry({ type: 'restore-point-restore', category: 'program', summary: `Wiederherstellung auf Punkt #${sequenceNumber} gestartet` });
  return restoreToPoint(sequenceNumber);
});
ipcMain.handle('security:getBitLockerStatus', () => getBitLockerStatus());
ipcMain.handle('security:getFirewallStatus', () => getFirewallStatus());
ipcMain.handle('security:getDiagnosticDataLevel', () => getDiagnosticDataLevel());

// --- Netzwerk ---
ipcMain.handle('network:listConnections', () => listConnections());
ipcMain.handle('network:flushDns', async () => {
  const result = await flushDns();
  addEntry({ type: 'dns-flush', category: 'program', summary: 'DNS-Cache geleert' });
  return result;
});
ipcMain.handle('network:resetWinsock', async () => {
  const result = await resetWinsock();
  addEntry({ type: 'winsock-reset', category: 'program', summary: 'Winsock zurückgesetzt (Neustart erforderlich)' });
  return result;
});

// --- Shell ---
ipcMain.handle('shell:openExternal', (_event, url) => shell.openExternal(url));
