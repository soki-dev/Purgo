const { contextBridge, ipcRenderer } = require('electron');

function on(channel, callback) {
  const listener = (event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('purgo', {
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),
  getBootTimeHistory: () => ipcRenderer.invoke('system:getBootTimeHistory'),
  getDiskHealth: () => ipcRenderer.invoke('system:getDiskHealth'),
  listPendingUpdates: () => ipcRenderer.invoke('system:listPendingUpdates'),

  scanJunk: () => ipcRenderer.invoke('junk:scan'),
  cleanJunk: (ids) => ipcRenderer.invoke('junk:clean', ids),
  quickClean: () => ipcRenderer.invoke('junk:quickClean'),

  scanRegistry: () => ipcRenderer.invoke('registry:scan'),
  cleanRegistry: (items) => ipcRenderer.invoke('registry:clean', items),

  scanStartup: () => ipcRenderer.invoke('startup:scan'),
  toggleStartup: (entry, enabled) => ipcRenderer.invoke('startup:toggle', { entry, enabled }),
  removeStartup: (entry) => ipcRenderer.invoke('startup:remove', entry),

  listPrograms: () => ipcRenderer.invoke('programs:list'),
  uninstallProgram: (program) => ipcRenderer.invoke('programs:uninstall', program),

  scanResidue: () => ipcRenderer.invoke('residue:scan'),
  deleteResidue: (paths) => ipcRenderer.invoke('residue:delete', paths),

  scanDrivers: () => ipcRenderer.invoke('drivers:scan'),

  pickDuplicatesFolder: () => ipcRenderer.invoke('duplicates:pickFolder'),
  scanDuplicates: (folderPath, includeSimilarImages) => ipcRenderer.invoke('duplicates:scan', { folderPath, includeSimilarImages }),
  deleteDuplicates: (paths) => ipcRenderer.invoke('duplicates:delete', paths),

  pickSpaceFolder: () => ipcRenderer.invoke('space:pickFolder'),
  listSpaceEntries: (rootPath) => ipcRenderer.invoke('space:list', rootPath),
  onDuplicatesProgress: (cb) => on('duplicates:progress', cb),
  onSpaceProgress: (cb) => on('space:progress', cb),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial) => ipcRenderer.invoke('settings:update', partial),
  pickExcludeFolder: () => ipcRenderer.invoke('settings:pickExcludeFolder'),
  exportSettings: () => ipcRenderer.invoke('settings:export'),
  importSettings: () => ipcRenderer.invoke('settings:import'),

  isPinEnabled: () => ipcRenderer.invoke('security:isEnabled'),
  setPin: (pin) => ipcRenderer.invoke('security:setPin', pin),
  clearPin: () => ipcRenderer.invoke('security:clearPin'),
  verifyPin: (pin) => ipcRenderer.invoke('security:verifyPin', pin),

  listHistory: (limit, category) => ipcRenderer.invoke('history:list', { limit, category }),
  getHistoryTotals: () => ipcRenderer.invoke('history:totals'),
  getHistoryTrend: (days) => ipcRenderer.invoke('history:trend', days),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  exportHistory: () => ipcRenderer.invoke('history:export'),
  onHistoryUpdated: (cb) => on('history:updated', cb),

  exportReport: () => ipcRenderer.invoke('report:export'),

  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  onUpdateStatus: (cb) => on('update:status', cb),

  isElevated: () => ipcRenderer.invoke('elevation:isElevated'),
  relaunchElevated: () => ipcRenderer.invoke('elevation:relaunch'),

  listServices: () => ipcRenderer.invoke('services:list'),
  setServiceState: (name, action) => ipcRenderer.invoke('services:setState', { name, action }),
  setServiceStartMode: (name, mode) => ipcRenderer.invoke('services:setStartMode', { name, mode }),

  getPowerPlan: () => ipcRenderer.invoke('performance:getPowerPlan'),
  setPowerPlan: (mode) => ipcRenderer.invoke('performance:setPowerPlan', mode),
  listBackgroundApps: () => ipcRenderer.invoke('performance:listBackgroundApps'),
  killProcess: (pid, name) => ipcRenderer.invoke('performance:killProcess', { pid, name }),
  trimMemory: () => ipcRenderer.invoke('performance:trimMemory'),

  isContextMenuRegistered: () => ipcRenderer.invoke('contextMenu:isRegistered'),
  registerContextMenu: () => ipcRenderer.invoke('contextMenu:register'),
  unregisterContextMenu: () => ipcRenderer.invoke('contextMenu:unregister'),

  isScheduledTaskRegistered: () => ipcRenderer.invoke('scheduler:isTaskRegistered'),

  listExtensions: () => ipcRenderer.invoke('extensions:list'),
  setExtensionEnabled: (extension, enabled) => ipcRenderer.invoke('extensions:setEnabled', { extension, enabled }),

  onAnalyzePath: (cb) => on('shell:analyzePath', cb),

  getSelfStartup: () => ipcRenderer.invoke('selfStartup:get'),
  setSelfStartup: (enabled) => ipcRenderer.invoke('selfStartup:set', enabled),
  resetAll: () => ipcRenderer.invoke('app:resetAll'),
  getChangelog: () => ipcRenderer.invoke('app:getChangelog'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  pickCustomRuleFolder: () => ipcRenderer.invoke('customRules:pickFolder'),
  pickCustomRuleFile: () => ipcRenderer.invoke('customRules:pickFile'),

  listRestorePoints: () => ipcRenderer.invoke('security:listRestorePoints'),
  createRestorePoint: (description) => ipcRenderer.invoke('security:createRestorePoint', description),
  restoreToPoint: (sequenceNumber) => ipcRenderer.invoke('security:restoreToPoint', sequenceNumber),
  getBitLockerStatus: () => ipcRenderer.invoke('security:getBitLockerStatus'),
  getFirewallStatus: () => ipcRenderer.invoke('security:getFirewallStatus'),
  getDiagnosticDataLevel: () => ipcRenderer.invoke('security:getDiagnosticDataLevel'),

  listConnections: () => ipcRenderer.invoke('network:listConnections'),
  flushDns: () => ipcRenderer.invoke('network:flushDns'),
  resetWinsock: () => ipcRenderer.invoke('network:resetWinsock'),

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
});
