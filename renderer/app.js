function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso) {
  if (!iso) return 'nie';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDetailValue(key, value) {
  if (value == null) return '';
  if (typeof value === 'number' && /bytes/i.test(key)) return formatBytes(value);
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderDetailContent(details) {
  const wrap = el('div', 'history-detail');
  if (details === undefined || details === null) {
    wrap.appendChild(el('div', 'item-desc', 'Keine weiteren Details gespeichert.'));
    return wrap;
  }
  const rows = Array.isArray(details) ? details : [details];
  for (const row of rows) {
    if (row && typeof row === 'object') {
      const line = Object.entries(row)
        .filter(([k]) => k !== 'ok')
        .map(([k, v]) => `${k}: ${formatDetailValue(k, v)}`)
        .join(' · ');
      wrap.appendChild(el('div', 'item-desc', line || JSON.stringify(row)));
    } else {
      wrap.appendChild(el('div', 'item-desc', String(row)));
    }
  }
  return wrap;
}

async function requirePinIfEnabled(actionLabel) {
  const settings = await window.purgo.getSettings();
  if (!settings.security.pinEnabled) return true;

  const pin = await showPrompt(`PIN erforderlich für: ${actionLabel}`, { inputType: 'password', title: 'PIN eingeben' });
  if (pin === null) return false;

  const valid = await window.purgo.verifyPin(pin);
  if (!valid) {
    toast('Falsche PIN.', 'error');
    return false;
  }
  return true;
}

// ---------- Navigation ----------
const VIEW_LOADERS = {
  settings: () => loadSettingsView(),
  history: () => loadHistoryFullList()
};

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
    if (VIEW_LOADERS[btn.dataset.view]) VIEW_LOADERS[btn.dataset.view]();
  });
});

document.querySelectorAll('.subtabs:not(#history-filters) .subtab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const group = btn.closest('.subtabs');
    group.querySelectorAll('.subtab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.subview').forEach((v) => v.classList.remove('active'));
    document.getElementById(`subview-${btn.dataset.subtab}`).classList.add('active');
  });
});

// ---------- Dashboard ----------
async function loadDashboard() {
  const diskList = document.getElementById('disk-list');
  diskList.innerHTML = '';
  diskList.appendChild(el('div', 'empty-hint', 'Lade Systeminformationen…'));

  const info = await window.purgo.getSystemInfo();

  document.getElementById('health-score-value').textContent = info.healthScore;
  document.getElementById('meta-hostname').textContent = info.hostname;
  document.getElementById('meta-platform').textContent = info.platform;

  const ring = document.getElementById('health-ring');
  const ringColor = info.healthScore >= 70 ? '#3ddc97' : info.healthScore >= 40 ? '#f0b429' : '#ef5a6f';
  ring.style.borderColor = ringColor;

  document.getElementById('bar-cpu').style.width = `${info.cpuLoad}%`;
  document.getElementById('value-cpu').textContent = `${info.cpuLoad}%`;
  document.getElementById('bar-ram').style.width = `${info.memory.usedPercent}%`;
  document.getElementById('value-ram').textContent =
    `${info.memory.usedPercent}% (${formatBytes(info.memory.totalBytes - info.memory.freeBytes)} / ${formatBytes(info.memory.totalBytes)})`;

  diskList.innerHTML = '';
  if (info.disks.length === 0) {
    diskList.appendChild(el('div', 'empty-hint', 'Keine Laufwerksdaten verfügbar.'));
  }
  for (const disk of info.disks) {
    const row = el('div', 'disk-row');
    row.appendChild(el('div', null, disk.drive));
    const barWrap = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${disk.usedPercent}%`;
    if (disk.usedPercent >= 90) fill.style.background = 'linear-gradient(90deg, #a13d4d, #ef5a6f)';
    barWrap.appendChild(fill);
    row.appendChild(barWrap);
    row.appendChild(el('div', 'item-size', `${disk.usedPercent}% belegt`));
    diskList.appendChild(row);
  }

  checkDiskWarning(info.disks);
  await loadHistoryPanel();
}

document.getElementById('dashboard-refresh').addEventListener('click', loadDashboard);

document.getElementById('quick-clean-btn').addEventListener('click', async () => {
  const btn = document.getElementById('quick-clean-btn');
  btn.disabled = true;
  btn.textContent = 'Räume auf…';
  try {
    const result = await window.purgo.quickClean();
    toast(`Fertig. ${formatBytes(result.freedBytes)} freigegeben (${result.itemCount} Kategorien).`, 'success');
    await loadDashboard();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Jetzt aufräumen';
  }
});

async function loadHistoryPanel() {
  const totals = await window.purgo.getHistoryTotals();
  document.getElementById('lifetime-stat').textContent = formatBytes(totals.totalFreedBytes);

  const entries = await window.purgo.listHistory(8);
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (entries.length === 0) {
    list.appendChild(el('div', 'empty-hint', 'Noch keine Aktionen.'));
    return;
  }
  for (const entry of entries) {
    const row = el('div', 'item-row');
    const main = el('div', 'item-main');
    main.appendChild(el('div', 'item-label', entry.summary || entry.type));
    main.appendChild(el('div', 'item-desc', formatDate(entry.timestamp)));
    row.appendChild(main);
    if (entry.freedBytes) row.appendChild(el('div', 'item-size', formatBytes(entry.freedBytes)));
    list.appendChild(row);
  }
}

window.purgo.onHistoryUpdated(() => {
  loadHistoryPanel();
});

// ---------- Historie (volle Seite) ----------
let historyFilter = 'all';

document.querySelectorAll('#history-filters .subtab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#history-filters .subtab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    historyFilter = btn.dataset.filter;
    loadHistoryFullList();
  });
});

async function loadHistoryFullList() {
  const list = document.getElementById('history-full-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Lade…'));

  const entries = await window.purgo.listHistory(200, historyFilter === 'all' ? null : historyFilter);
  list.innerHTML = '';
  if (entries.length === 0) {
    list.appendChild(el('div', 'empty-hint', 'Keine Einträge für diesen Filter.'));
    return;
  }

  for (const entry of entries) {
    const row = el('div', 'item-row history-row');

    const header = el('div', 'history-row-header');
    const main = el('div', 'item-main');
    main.appendChild(el('div', 'item-label', entry.summary || entry.type));
    main.appendChild(el('div', 'item-desc', `${formatDate(entry.timestamp)} · ${entry.category || ''}`));
    header.appendChild(main);
    if (entry.freedBytes) header.appendChild(el('div', 'item-size', formatBytes(entry.freedBytes)));
    row.appendChild(header);

    let detailNode = null;
    row.addEventListener('click', () => {
      if (detailNode) {
        detailNode.remove();
        detailNode = null;
        return;
      }
      detailNode = renderDetailContent(entry.details);
      row.appendChild(detailNode);
    });

    list.appendChild(row);
  }
}

document.getElementById('history-export-btn').addEventListener('click', async () => {
  const savedPath = await window.purgo.exportHistory();
  if (savedPath) toast(`Verlauf exportiert nach: ${savedPath}`, 'success');
});

document.getElementById('history-clear-btn').addEventListener('click', async () => {
  const confirmed = await showConfirm('Den kompletten Verlauf unwiderruflich löschen?', { danger: true, confirmLabel: 'Löschen' });
  if (!confirmed) return;
  await window.purgo.clearHistory();
  toast('Verlauf gelöscht.', 'success');
  loadHistoryFullList();
  loadHistoryPanel();
});

// ---------- Junk Cleaner ----------
let junkItems = [];

function renderJunkList() {
  const list = document.getElementById('junk-list');
  list.innerHTML = '';
  if (junkItems.length === 0) {
    list.appendChild(el('div', 'empty-hint', 'Keine Junk-Dateien gefunden. Sieht sauber aus!'));
    updateJunkSummary();
    return;
  }

  for (const item of junkItems) {
    const row = el('div', 'item-row');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox';
    checkbox.checked = item.defaultChecked;
    checkbox.dataset.id = item.id;
    checkbox.addEventListener('change', updateJunkSummary);
    row.appendChild(checkbox);

    const main = el('div', 'item-main');
    main.appendChild(el('div', 'item-label', item.label));
    main.appendChild(el('div', 'item-desc', `${item.description} · ${item.fileCount} Dateien`));
    row.appendChild(main);

    row.appendChild(el('span', `badge risk-${item.risk}`, item.risk === 'safe' ? 'sicher' : 'prüfen'));
    row.appendChild(el('div', 'item-size', formatBytes(item.sizeBytes)));

    list.appendChild(row);
  }
  updateJunkSummary();
}

function getSelectedIds(listId) {
  return Array.from(document.querySelectorAll(`#${listId} .checkbox:checked`)).map((cb) => cb.dataset.id);
}

function updateJunkSummary() {
  const selectedIds = getSelectedIds('junk-list');
  const selectedItems = junkItems.filter((i) => selectedIds.includes(i.id));
  const totalSize = selectedItems.reduce((sum, i) => sum + i.sizeBytes, 0);
  const summaryBar = document.getElementById('junk-summary');
  const summaryText = document.getElementById('junk-summary-text');
  const cleanBtn = document.getElementById('junk-clean-btn');

  if (selectedItems.length === 0) {
    summaryBar.hidden = true;
    cleanBtn.disabled = true;
    return;
  }
  summaryBar.hidden = false;
  summaryText.textContent = `${selectedItems.length} Kategorie(n) ausgewählt · ${formatBytes(totalSize)} werden freigegeben`;
  cleanBtn.disabled = false;
}

document.getElementById('junk-scan-btn').addEventListener('click', async () => {
  const btn = document.getElementById('junk-scan-btn');
  btn.disabled = true;
  btn.textContent = 'Scanne…';
  const list = document.getElementById('junk-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Scan läuft…'));
  try {
    junkItems = await window.purgo.scanJunk();
    renderJunkList();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan starten';
  }
});

document.getElementById('junk-clean-btn').addEventListener('click', async () => {
  const ids = getSelectedIds('junk-list');
  if (ids.length === 0) return;
  const confirmed = await showConfirm(`${ids.length} Kategorie(n) wirklich bereinigen? Dateien werden dauerhaft gelöscht.`, { danger: true, confirmLabel: 'Bereinigen' });
  if (!confirmed) return;

  const btn = document.getElementById('junk-clean-btn');
  btn.disabled = true;
  btn.textContent = 'Bereinige…';
  try {
    const results = await window.purgo.cleanJunk(ids);
    const freed = results.reduce((sum, r) => sum + (r.freedBytes || 0), 0);
    toast(`Fertig. ${formatBytes(freed)} freigegeben.`, 'success');
    junkItems = await window.purgo.scanJunk();
    renderJunkList();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ausgewählte bereinigen';
  }
});

// ---------- Registry Cleaner ----------
let registryItems = [];

function renderRegistryList() {
  const list = document.getElementById('registry-list');
  list.innerHTML = '';
  if (registryItems.length === 0) {
    list.appendChild(el('div', 'empty-hint', 'Keine verwaisten Registry-Einträge gefunden.'));
    updateRegistrySummary();
    return;
  }

  for (const item of registryItems) {
    const row = el('div', 'item-row');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox';
    checkbox.checked = item.defaultChecked;
    checkbox.dataset.id = item.id;
    checkbox.addEventListener('change', updateRegistrySummary);
    row.appendChild(checkbox);

    const main = el('div', 'item-main');
    main.appendChild(el('div', 'item-label', `${item.label} · ${item.category}`));
    main.appendChild(el('div', 'item-desc', item.description));
    row.appendChild(main);

    row.appendChild(el('span', `badge risk-${item.risk}`, 'prüfen'));
    list.appendChild(row);
  }
  updateRegistrySummary();
}

function updateRegistrySummary() {
  const ids = getSelectedIds('registry-list');
  document.getElementById('registry-clean-btn').disabled = ids.length === 0;
}

document.getElementById('registry-scan-btn').addEventListener('click', async () => {
  const btn = document.getElementById('registry-scan-btn');
  btn.disabled = true;
  btn.textContent = 'Scanne…';
  const list = document.getElementById('registry-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Scan läuft…'));
  try {
    registryItems = await window.purgo.scanRegistry();
    renderRegistryList();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan starten';
  }
});

document.getElementById('registry-clean-btn').addEventListener('click', async () => {
  const ids = getSelectedIds('registry-list');
  if (ids.length === 0) return;
  const confirmed = await showConfirm(`${ids.length} Registry-Eintrag/Einträge löschen? Es wird vorher automatisch ein .reg-Backup angelegt.`, { danger: true, confirmLabel: 'Löschen' });
  if (!confirmed) return;

  const allowed = await requirePinIfEnabled('Registry-Bereinigung');
  if (!allowed) return;

  const selected = registryItems.filter((i) => ids.includes(i.id));
  const btn = document.getElementById('registry-clean-btn');
  btn.disabled = true;
  btn.textContent = 'Bereinige…';
  try {
    const results = await window.purgo.cleanRegistry(selected);
    const ok = results.filter((r) => r.ok).length;
    toast(`${ok} von ${results.length} Einträgen bereinigt. Backups liegen im Anwendungsdatenordner unter registry-backups.`, 'success');
    registryItems = await window.purgo.scanRegistry();
    renderRegistryList();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ausgewählte bereinigen';
  }
});

// ---------- Autostart ----------
let startupItems = [];

function renderStartupList() {
  const list = document.getElementById('startup-list');
  list.innerHTML = '';
  if (startupItems.length === 0) {
    list.appendChild(el('div', 'empty-hint', 'Keine Autostart-Einträge gefunden.'));
    return;
  }

  for (const item of startupItems) {
    const row = el('div', 'item-row');

    const label = document.createElement('label');
    label.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = item.enabled;
    input.addEventListener('change', async () => {
      input.disabled = true;
      try {
        await window.purgo.toggleStartup(item, input.checked);
        item.enabled = input.checked;
      } catch (err) {
        input.checked = !input.checked;
        toast(`Konnte Status nicht ändern: ${err.message || err}`, 'error');
      } finally {
        input.disabled = false;
      }
    });
    label.appendChild(input);
    label.appendChild(el('span', 'switch-slider'));
    row.appendChild(label);

    const main = el('div', 'item-main');
    main.appendChild(el('div', 'item-label', item.name));
    main.appendChild(el('div', 'item-desc', item.resolvedPath || item.command));
    row.appendChild(main);

    if (!item.exists) {
      row.appendChild(el('span', 'badge risk-low', 'Ziel fehlt'));
    } else {
      const impactBadge = el('span', `badge ${item.impact === 'hoch' ? 'outdated' : item.impact === 'mittel' ? 'risk-medium' : 'risk-safe'}`, `Auswirkung: ${item.impact}`);
      impactBadge.title = 'Heuristik aus Dateigröße/Signatur, keine gemessene Bootzeit.';
      row.appendChild(impactBadge);
      row.appendChild(el('span', 'badge', item.signed ? 'signiert' : 'unsigniert'));
      row.appendChild(el('span', 'badge', formatBytes(item.sizeBytes)));
    }
    row.appendChild(el('span', 'badge', item.hive));

    const removeBtn = el('button', 'btn btn-small btn-danger', 'Entfernen');
    removeBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm(`Autostart-Eintrag "${item.name}" endgültig entfernen?`, { danger: true, confirmLabel: 'Entfernen' });
      if (!confirmed) return;
      try {
        await window.purgo.removeStartup(item);
        startupItems = await window.purgo.scanStartup();
        renderStartupList();
      } catch (err) {
        toast(`Konnte Eintrag nicht entfernen: ${err.message || err}`, 'error');
      }
    });
    row.appendChild(removeBtn);

    list.appendChild(row);
  }
}

document.getElementById('startup-scan-btn').addEventListener('click', async () => {
  const btn = document.getElementById('startup-scan-btn');
  btn.disabled = true;
  btn.textContent = 'Scanne…';
  const list = document.getElementById('startup-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Scan läuft…'));
  try {
    startupItems = await window.purgo.scanStartup();
    renderStartupList();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan starten';
  }
});

// ---------- Programs ----------
let programItems = [];

function renderProgramsList(filter) {
  const list = document.getElementById('programs-list');
  list.innerHTML = '';
  const query = (filter || '').toLowerCase();
  const filtered = programItems.filter((p) => p.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    list.appendChild(el('div', 'empty-hint', 'Keine Programme gefunden.'));
    return;
  }

  for (const program of filtered) {
    const row = el('div', 'item-row');

    const main = el('div', 'item-main');
    main.appendChild(el('div', 'item-label', program.name));
    main.appendChild(el('div', 'item-desc', `${program.publisher || 'Unbekannter Hersteller'} · ${program.version || 'keine Version'}`));
    row.appendChild(main);

    if (program.lastUsed) {
      const daysAgo = Math.floor((Date.now() - new Date(program.lastUsed).getTime()) / (1000 * 60 * 60 * 24));
      const badgeClass = daysAgo > 180 ? 'badge risk-medium' : 'badge';
      row.appendChild(el('span', badgeClass, `zuletzt vor ${daysAgo} Tagen`));
    } else {
      row.appendChild(el('span', 'badge', 'Nutzung unbekannt'));
    }

    row.appendChild(el('div', 'item-size', formatBytes(program.sizeBytes)));

    const uninstallBtn = el('button', 'btn btn-small btn-danger', 'Deinstallieren');
    uninstallBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm(`"${program.name}" deinstallieren? Der Deinstaller des Herstellers wird gestartet.`, { danger: true, confirmLabel: 'Deinstallieren' });
      if (!confirmed) return;

      const allowed = await requirePinIfEnabled(`Deinstallation von ${program.name}`);
      if (!allowed) return;

      uninstallBtn.disabled = true;
      uninstallBtn.textContent = 'Läuft…';
      try {
        await window.purgo.uninstallProgram(program);
        programItems = await window.purgo.listPrograms();
        renderProgramsList(document.getElementById('programs-search').value);
      } catch (err) {
        toast(`Deinstallation fehlgeschlagen oder abgebrochen: ${err.message || err}`, 'error');
        uninstallBtn.disabled = false;
        uninstallBtn.textContent = 'Deinstallieren';
      }
    });
    row.appendChild(uninstallBtn);

    list.appendChild(row);
  }
}

document.getElementById('programs-scan-btn').addEventListener('click', async () => {
  const btn = document.getElementById('programs-scan-btn');
  btn.disabled = true;
  btn.textContent = 'Lade…';
  const list = document.getElementById('programs-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Lade Programmliste…'));
  try {
    programItems = await window.purgo.listPrograms();
    renderProgramsList(document.getElementById('programs-search').value);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Programme laden';
  }
});

document.getElementById('programs-search').addEventListener('input', (e) => {
  renderProgramsList(e.target.value);
});

// ---------- Software-Reste ----------
let residueItems = [];

function renderResidueList() {
  const list = document.getElementById('residue-list');
  list.innerHTML = '';
  if (residueItems.length === 0) {
    list.appendChild(el('div', 'empty-hint', 'Keine verwaisten Ordner gefunden.'));
    updateResidueSummary();
    return;
  }

  for (const item of residueItems) {
    const row = el('div', 'item-row');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox';
    checkbox.checked = item.defaultChecked;
    checkbox.dataset.id = item.id;
    checkbox.addEventListener('change', updateResidueSummary);
    row.appendChild(checkbox);

    const main = el('div', 'item-main');
    main.appendChild(el('div', 'item-label', item.label));
    main.appendChild(el('div', 'item-desc', item.path));
    row.appendChild(main);

    row.appendChild(el('span', 'badge risk-medium', 'prüfen'));
    row.appendChild(el('div', 'item-size', formatBytes(item.sizeBytes)));

    list.appendChild(row);
  }
  updateResidueSummary();
}

function updateResidueSummary() {
  const ids = getSelectedIds('residue-list');
  document.getElementById('residue-clean-btn').disabled = ids.length === 0;
}

document.getElementById('residue-scan-btn').addEventListener('click', async () => {
  const btn = document.getElementById('residue-scan-btn');
  btn.disabled = true;
  btn.textContent = 'Scanne…';
  const list = document.getElementById('residue-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Scan läuft, das kann etwas dauern…'));
  try {
    residueItems = await window.purgo.scanResidue();
    renderResidueList();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan starten';
  }
});

document.getElementById('residue-clean-btn').addEventListener('click', async () => {
  const ids = getSelectedIds('residue-list');
  if (ids.length === 0) return;
  const confirmed = await showConfirm(`${ids.length} Ordner endgültig löschen? Das kann nicht rückgängig gemacht werden.`, { danger: true, confirmLabel: 'Löschen' });
  if (!confirmed) return;

  const allowed = await requirePinIfEnabled('Programm-Reste löschen');
  if (!allowed) return;

  const btn = document.getElementById('residue-clean-btn');
  btn.disabled = true;
  btn.textContent = 'Lösche…';
  try {
    const results = await window.purgo.deleteResidue(ids);
    const ok = results.filter((r) => r.ok).length;
    toast(`${ok} von ${results.length} Ordnern gelöscht.`, 'success');
    residueItems = await window.purgo.scanResidue();
    renderResidueList();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ausgewählte löschen';
  }
});

// ---------- Drivers ----------
document.getElementById('drivers-scan-btn').addEventListener('click', async () => {
  const btn = document.getElementById('drivers-scan-btn');
  btn.disabled = true;
  btn.textContent = 'Scanne…';
  const list = document.getElementById('drivers-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Scan läuft…'));
  try {
    const drivers = await window.purgo.scanDrivers();
    list.innerHTML = '';
    if (drivers.length === 0) {
      list.appendChild(el('div', 'empty-hint', 'Keine Treiberdaten gefunden.'));
    }
    for (const driver of drivers) {
      const row = el('div', 'item-row');

      const main = el('div', 'item-main');
      main.appendChild(el('div', 'item-label', driver.name));
      main.appendChild(el(
        'div',
        'item-desc',
        `${driver.manufacturer || 'Unbekannt'} · Version ${driver.version} · vom ${driver.date || 'unbekannt'}`
      ));
      row.appendChild(main);

      if (driver.outdated) {
        row.appendChild(el('span', 'badge outdated', `${driver.ageYears} Jahre alt`));
      } else if (driver.ageYears !== null) {
        row.appendChild(el('span', 'badge', `${driver.ageYears} Jahre alt`));
      }

      const searchBtn = el('button', 'btn btn-small', 'Treiber suchen');
      searchBtn.addEventListener('click', () => window.purgo.openExternal(driver.searchUrl));
      row.appendChild(searchBtn);

      list.appendChild(row);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan starten';
  }
});

// ---------- Duplicate Finder ----------
let duplicateFolder = null;
let duplicateGroups = [];

document.getElementById('duplicates-pick-btn').addEventListener('click', async () => {
  const folder = await window.purgo.pickDuplicatesFolder();
  if (!folder) return;
  duplicateFolder = folder;
  document.getElementById('duplicates-path').textContent = folder;
  document.getElementById('duplicates-scan-btn').disabled = false;
});

window.purgo.onDuplicatesProgress(({ phase, processed, total }) => {
  const progress = document.getElementById('duplicates-progress');
  const label = document.getElementById('duplicates-progress-label');
  const fill = document.getElementById('duplicates-progress-fill');
  progress.hidden = false;
  const pct = total ? Math.round((processed / total) * 100) : 0;
  const phaseLabel = phase === 'similarity' ? 'Ähnlichkeitssuche' : 'Duplikat-Suche';
  label.textContent = `${phaseLabel}: ${processed} von ${total} Dateien geprüft`;
  fill.style.width = `${pct}%`;
});

let similarImageGroups = [];

document.getElementById('duplicates-scan-btn').addEventListener('click', async () => {
  if (!duplicateFolder) return;
  const includeSimilar = document.getElementById('duplicates-similar-toggle').checked;
  const btn = document.getElementById('duplicates-scan-btn');
  btn.disabled = true;
  btn.textContent = 'Scanne…';
  const list = document.getElementById('duplicates-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Scan läuft, das kann bei großen Ordnern dauern…'));
  document.getElementById('duplicates-progress').hidden = false;
  document.getElementById('duplicates-progress-fill').style.width = '0%';
  try {
    const result = await window.purgo.scanDuplicates(duplicateFolder, includeSimilar);
    duplicateGroups = result.groups;
    similarImageGroups = result.similarGroups || [];
    renderDuplicateGroups();
    renderSimilarImageGroups();
  } catch (err) {
    toast(`Scan fehlgeschlagen: ${err.message || err}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan starten';
    document.getElementById('duplicates-progress').hidden = true;
  }
});

function renderSimilarImageGroups() {
  const title = document.getElementById('similar-images-title');
  const list = document.getElementById('similar-images-list');
  list.innerHTML = '';

  if (similarImageGroups.length === 0) {
    title.hidden = true;
    return;
  }
  title.hidden = false;

  for (const group of similarImageGroups) {
    const groupEl = el('div', 'duplicate-group');
    const header = el('div', 'duplicate-group-header');
    header.appendChild(el('span', null, `${group.files.length} ähnliche Bilder`));
    groupEl.appendChild(header);

    group.files.forEach((filePath, index) => {
      const row = el('div', 'duplicate-file-row');
      if (index === 0) {
        row.appendChild(el('span', 'keep-badge', 'behalten'));
        row.appendChild(el('span', 'item-desc', filePath));
      } else {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox similar-checkbox';
        checkbox.dataset.path = filePath;
        row.appendChild(checkbox);
        row.appendChild(el('span', 'item-desc', filePath));
      }
      groupEl.appendChild(row);
    });

    const deleteBtn = el('button', 'btn btn-small btn-danger', 'Ausgewählte aus dieser Gruppe löschen');
    deleteBtn.addEventListener('click', async () => {
      const paths = Array.from(groupEl.querySelectorAll('.similar-checkbox:checked')).map((cb) => cb.dataset.path);
      if (paths.length === 0) return;
      const confirmed = await showConfirm(`${paths.length} Datei(en) endgültig löschen?`, { danger: true, confirmLabel: 'Löschen' });
      if (!confirmed) return;
      const results = await window.purgo.deleteDuplicates(paths);
      const freed = results.reduce((sum, r) => sum + (r.freedBytes || 0), 0);
      toast(`Fertig. ${formatBytes(freed)} freigegeben.`, 'success');
      similarImageGroups = similarImageGroups
        .map((g) => (g.id === group.id ? { ...g, files: g.files.filter((f) => !paths.includes(f)) } : g))
        .filter((g) => g.files.length > 1);
      renderSimilarImageGroups();
    });
    groupEl.appendChild(deleteBtn);

    list.appendChild(groupEl);
  }
}

function renderDuplicateGroups() {
  const list = document.getElementById('duplicates-list');
  list.innerHTML = '';

  if (duplicateGroups.length === 0) {
    list.appendChild(el('div', 'empty-hint', 'Keine Duplikate gefunden.'));
    updateDuplicatesSummary();
    return;
  }

  for (const group of duplicateGroups) {
    const groupEl = el('div', 'duplicate-group');
    const header = el('div', 'duplicate-group-header');
    header.appendChild(el('span', null, `${group.files.length} Kopien · ${formatBytes(group.sizeBytes)} je Datei`));
    header.appendChild(el('span', null, `${formatBytes(group.wastedBytes)} verschwendet`));
    groupEl.appendChild(header);

    group.files.forEach((filePath, index) => {
      const row = el('div', 'duplicate-file-row');
      if (index === 0) {
        row.appendChild(el('span', 'keep-badge', 'behalten'));
        row.appendChild(el('span', 'item-desc', filePath));
      } else {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox duplicate-checkbox';
        checkbox.checked = true;
        checkbox.dataset.path = filePath;
        checkbox.addEventListener('change', updateDuplicatesSummary);
        row.appendChild(checkbox);
        row.appendChild(el('span', 'item-desc', filePath));
      }
      groupEl.appendChild(row);
    });

    list.appendChild(groupEl);
  }
  updateDuplicatesSummary();
}

function updateDuplicatesSummary() {
  const checkboxes = Array.from(document.querySelectorAll('.duplicate-checkbox:checked'));
  const summaryBar = document.getElementById('duplicates-summary');
  const cleanBtn = document.getElementById('duplicates-clean-btn');

  if (checkboxes.length === 0) {
    summaryBar.hidden = true;
    cleanBtn.disabled = true;
    return;
  }

  let totalSize = 0;
  for (const cb of checkboxes) {
    const group = duplicateGroups.find((g) => g.files.includes(cb.dataset.path));
    if (group) totalSize += group.sizeBytes;
  }

  summaryBar.hidden = false;
  document.getElementById('duplicates-summary-text').textContent =
    `${checkboxes.length} Datei(en) ausgewählt · ${formatBytes(totalSize)} werden freigegeben`;
  cleanBtn.disabled = false;
}

document.getElementById('duplicates-clean-btn').addEventListener('click', async () => {
  const paths = Array.from(document.querySelectorAll('.duplicate-checkbox:checked')).map((cb) => cb.dataset.path);
  if (paths.length === 0) return;
  const confirmed = await showConfirm(`${paths.length} Datei(en) endgültig löschen?`, { danger: true, confirmLabel: 'Löschen' });
  if (!confirmed) return;

  const btn = document.getElementById('duplicates-clean-btn');
  btn.disabled = true;
  btn.textContent = 'Lösche…';
  try {
    const results = await window.purgo.deleteDuplicates(paths);
    const freed = results.reduce((sum, r) => sum + (r.freedBytes || 0), 0);
    toast(`Fertig. ${formatBytes(freed)} freigegeben.`, 'success');
    duplicateGroups = await window.purgo.scanDuplicates(duplicateFolder);
    renderDuplicateGroups();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ausgewählte löschen';
  }
});

// ---------- Space Analyzer ----------
let spaceBreadcrumb = [];

document.getElementById('space-pick-btn').addEventListener('click', async () => {
  const folder = await window.purgo.pickSpaceFolder();
  if (!folder) return;
  spaceBreadcrumb = [folder];
  await loadSpaceLevel(folder);
});

function renderSpaceBreadcrumb() {
  const bar = document.getElementById('space-breadcrumb');
  bar.innerHTML = '';
  spaceBreadcrumb.forEach((segment, index) => {
    if (index > 0) bar.appendChild(el('span', 'breadcrumb-sep', '›'));
    const label = segment.split(/[\\/]/).filter(Boolean).pop() || segment;
    const item = el('div', 'breadcrumb-item', label);
    item.title = segment;
    item.addEventListener('click', () => {
      spaceBreadcrumb = spaceBreadcrumb.slice(0, index + 1);
      loadSpaceLevel(segment);
    });
    bar.appendChild(item);
  });
}

window.purgo.onSpaceProgress(({ processed, total, currentName }) => {
  const progress = document.getElementById('space-progress');
  const label = document.getElementById('space-progress-label');
  const fill = document.getElementById('space-progress-fill');
  progress.hidden = false;
  const pct = total ? Math.round((processed / total) * 100) : 0;
  label.textContent = `${processed} von ${total} · ${currentName || ''}`;
  fill.style.width = `${pct}%`;
});

async function loadSpaceLevel(folderPath) {
  renderSpaceBreadcrumb();
  const list = document.getElementById('space-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Lade…'));
  document.getElementById('space-progress').hidden = false;
  document.getElementById('space-progress-fill').style.width = '0%';

  try {
    const entries = await window.purgo.listSpaceEntries(folderPath);
    document.getElementById('space-progress').hidden = true;
    list.innerHTML = '';
    if (entries.length === 0) {
      list.appendChild(el('div', 'empty-hint', 'Ordner ist leer.'));
      return;
    }
    const maxSize = Math.max(...entries.map((e) => e.sizeBytes), 1);
    for (const entryItem of entries) {
      const row = el('div', 'item-row');

      const main = el('div', 'item-main');
      main.appendChild(el('div', 'item-label', `${entryItem.isDir ? '📁' : '📄'} ${entryItem.name}`));
      const barWrap = el('div', 'bar');
      const fill = el('div', 'bar-fill');
      fill.style.width = `${Math.max(2, Math.round((entryItem.sizeBytes / maxSize) * 100))}%`;
      barWrap.appendChild(fill);
      main.appendChild(barWrap);
      row.appendChild(main);

      row.appendChild(el('div', 'item-size', formatBytes(entryItem.sizeBytes)));

      if (entryItem.isDir) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
          spaceBreadcrumb = [...spaceBreadcrumb, entryItem.path];
          loadSpaceLevel(entryItem.path);
        });
      }

      list.appendChild(row);
    }
  } catch (err) {
    document.getElementById('space-progress').hidden = true;
    list.innerHTML = '';
    list.appendChild(el('div', 'empty-hint', `Fehler: ${err.message || err}`));
  }
}

// ---------- Settings ----------
async function loadSettingsView() {
  const settings = await window.purgo.getSettings();

  document.getElementById('setting-minimize-tray').checked = settings.minimizeToTray;
  document.getElementById('setting-scheduler-enabled').checked = settings.scheduler.enabled;
  document.getElementById('setting-scheduler-frequency').value = settings.scheduler.frequency;
  document.getElementById('scheduler-last-run').textContent = `Letzter automatischer Lauf: ${formatDate(settings.scheduler.lastRun)}`;
  document.getElementById('setting-language').value = getCurrentLanguage();

  document.getElementById('setting-pin-enabled').checked = settings.security.pinEnabled;
  document.getElementById('pin-change-btn').hidden = !settings.security.pinEnabled;

  renderExcludeList(settings.excludedPaths);

  try {
    document.getElementById('setting-context-menu').checked = await window.purgo.isContextMenuRegistered();
  } catch {
    document.getElementById('setting-context-menu').checked = false;
  }

  const taskStatusEl = document.getElementById('scheduler-task-status');
  if (settings.scheduler.enabled) {
    const registered = await window.purgo.isScheduledTaskRegistered();
    taskStatusEl.textContent = registered
      ? 'Windows-Aufgabenplanung: aktive geplante Aufgabe "PurgoScheduledClean" registriert.'
      : 'Warnung: Geplante Reinigung ist aktiviert, aber keine Windows-Aufgabe gefunden. Häufigkeit einmal neu speichern.';
  } else {
    taskStatusEl.textContent = 'Windows-Aufgabenplanung: keine geplante Aufgabe aktiv.';
  }
}

function renderExcludeList(paths) {
  const list = document.getElementById('exclude-list');
  list.innerHTML = '';
  if (!paths || paths.length === 0) {
    list.appendChild(el('div', 'empty-hint', 'Keine Ausschlüsse konfiguriert.'));
    return;
  }
  for (const excludedPath of paths) {
    const row = el('div', 'item-row');
    row.appendChild(el('div', 'item-main', excludedPath));
    const removeBtn = el('button', 'btn btn-small btn-danger', 'Entfernen');
    removeBtn.addEventListener('click', async () => {
      const settings = await window.purgo.getSettings();
      const updated = settings.excludedPaths.filter((p) => p !== excludedPath);
      await window.purgo.updateSettings({ excludedPaths: updated });
      renderExcludeList(updated);
    });
    row.appendChild(removeBtn);
    list.appendChild(row);
  }
}

document.getElementById('setting-minimize-tray').addEventListener('change', async (e) => {
  await window.purgo.updateSettings({ minimizeToTray: e.target.checked });
});

document.getElementById('setting-language').addEventListener('change', (e) => {
  applyLanguage(e.target.value);
});

document.getElementById('setting-scheduler-enabled').addEventListener('change', async (e) => {
  await window.purgo.updateSettings({ scheduler: { enabled: e.target.checked } });
});

document.getElementById('setting-scheduler-frequency').addEventListener('change', async (e) => {
  await window.purgo.updateSettings({ scheduler: { frequency: e.target.value } });
});

document.getElementById('exclude-add-btn').addEventListener('click', async () => {
  const folder = await window.purgo.pickExcludeFolder();
  if (!folder) return;
  const settings = await window.purgo.getSettings();
  if (settings.excludedPaths.includes(folder)) return;
  const updated = [...settings.excludedPaths, folder];
  await window.purgo.updateSettings({ excludedPaths: updated });
  renderExcludeList(updated);
});

// ---------- PIN-Schutz ----------
document.getElementById('setting-pin-enabled').addEventListener('change', async (e) => {
  const checkbox = e.target;

  if (checkbox.checked) {
    const pin1 = await showPrompt('Neue PIN festlegen (mind. 4 Zeichen):', { inputType: 'password', title: 'PIN einrichten' });
    if (!pin1 || pin1.length < 4) {
      checkbox.checked = false;
      if (pin1 !== null) toast('PIN muss mindestens 4 Zeichen haben.', 'error');
      return;
    }
    const pin2 = await showPrompt('PIN wiederholen:', { inputType: 'password', title: 'PIN bestätigen' });
    if (pin1 !== pin2) {
      checkbox.checked = false;
      toast('PINs stimmen nicht überein.', 'error');
      return;
    }
    await window.purgo.setPin(pin1);
    toast('PIN-Schutz aktiviert.', 'success');
  } else {
    const pin = await showPrompt('Aktuelle PIN zum Deaktivieren eingeben:', { inputType: 'password', title: 'PIN erforderlich' });
    if (pin === null) {
      checkbox.checked = true;
      return;
    }
    const valid = await window.purgo.verifyPin(pin);
    if (!valid) {
      checkbox.checked = true;
      toast('Falsche PIN.', 'error');
      return;
    }
    await window.purgo.clearPin();
    toast('PIN-Schutz deaktiviert.', 'success');
  }

  document.getElementById('pin-change-btn').hidden = !checkbox.checked;
});

document.getElementById('pin-change-btn').addEventListener('click', async () => {
  const current = await showPrompt('Aktuelle PIN eingeben:', { inputType: 'password', title: 'PIN ändern' });
  if (current === null) return;
  const valid = await window.purgo.verifyPin(current);
  if (!valid) {
    toast('Falsche PIN.', 'error');
    return;
  }
  const pin1 = await showPrompt('Neue PIN (mind. 4 Zeichen):', { inputType: 'password', title: 'Neue PIN' });
  if (!pin1 || pin1.length < 4) {
    toast('PIN muss mindestens 4 Zeichen haben.', 'error');
    return;
  }
  const pin2 = await showPrompt('Neue PIN wiederholen:', { inputType: 'password', title: 'PIN bestätigen' });
  if (pin1 !== pin2) {
    toast('PINs stimmen nicht überein.', 'error');
    return;
  }
  await window.purgo.setPin(pin1);
  toast('PIN geändert.', 'success');
});

// ---------- Updates ----------
document.getElementById('update-check-btn').addEventListener('click', async () => {
  const btn = document.getElementById('update-check-btn');
  const status = document.getElementById('update-status');
  btn.disabled = true;
  status.textContent = 'Suche nach Updates…';
  try {
    const result = await window.purgo.checkForUpdate();
    if (result.ok) {
      status.textContent = result.version ? `Update gefunden: v${result.version}` : 'Suche gestartet…';
    } else {
      status.textContent = `Fehler: ${result.error}`;
    }
  } finally {
    btn.disabled = false;
  }
});

window.purgo.onUpdateStatus((status) => {
  const statusEl = document.getElementById('update-status');
  if (!statusEl) return;
  if (status.status === 'available') statusEl.textContent = `Update verfügbar: v${status.version}`;
  else if (status.status === 'not-available') statusEl.textContent = 'Du hast bereits die neueste Version.';
  else if (status.status === 'error') statusEl.textContent = `Fehler: ${status.error}`;
});

// ---------- Admin-Rechte ----------
async function checkElevation() {
  const elevated = await window.purgo.isElevated();
  document.getElementById('admin-banner').hidden = elevated;
}

document.getElementById('admin-relaunch-btn').addEventListener('click', async () => {
  const confirmed = await showConfirm('Purgo als Administrator neu starten? Die aktuelle Instanz wird beendet.', { confirmLabel: 'Neu starten' });
  if (!confirmed) return;
  try {
    await window.purgo.relaunchElevated();
  } catch (err) {
    toast(`Neustart fehlgeschlagen: ${err.message || err}`, 'error');
  }
});

// ---------- Windows-Dienste ----------
let serviceItems = [];

function renderServicesList(filter) {
  const list = document.getElementById('services-list');
  list.innerHTML = '';
  const query = (filter || '').toLowerCase();
  const filtered = serviceItems.filter(
    (s) => s.displayName.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    list.appendChild(el('div', 'empty-hint', 'Keine Dienste gefunden.'));
    return;
  }

  for (const service of filtered) {
    const row = el('div', 'item-row');

    const main = el('div', 'item-main');
    main.appendChild(el('div', 'item-label', service.displayName));
    main.appendChild(el('div', 'item-desc', service.description || service.name));
    row.appendChild(main);

    row.appendChild(el('span', `badge ${service.state === 'Running' ? 'state-running' : 'state-stopped'}`, service.state));

    const modeSelect = document.createElement('select');
    modeSelect.className = 'search-input';
    modeSelect.style.maxWidth = '130px';
    for (const mode of ['Automatic', 'Manual', 'Disabled']) {
      const option = document.createElement('option');
      option.value = mode;
      option.textContent = mode;
      if (service.startMode === mode || (mode === 'Automatic' && service.startMode === 'Auto')) option.selected = true;
      modeSelect.appendChild(option);
    }
    modeSelect.addEventListener('change', async () => {
      try {
        await window.purgo.setServiceStartMode(service.name, modeSelect.value);
        toast(`Starttyp von ${service.displayName} geändert.`, 'success');
      } catch (err) {
        toast(`Fehler: ${err.message || err}`, 'error');
      }
    });
    row.appendChild(modeSelect);

    const startBtn = el('button', 'btn btn-small', 'Start');
    startBtn.addEventListener('click', async () => {
      try {
        await window.purgo.setServiceState(service.name, 'start');
        toast(`${service.displayName} gestartet.`, 'success');
        serviceItems = await window.purgo.listServices();
        renderServicesList(document.getElementById('services-search').value);
      } catch (err) {
        toast(`Fehler: ${err.message || err}`, 'error');
      }
    });
    row.appendChild(startBtn);

    const stopBtn = el('button', 'btn btn-small btn-danger', 'Stopp');
    stopBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm(`Dienst "${service.displayName}" wirklich stoppen?`, { danger: true, confirmLabel: 'Stoppen' });
      if (!confirmed) return;
      try {
        await window.purgo.setServiceState(service.name, 'stop');
        toast(`${service.displayName} gestoppt.`, 'success');
        serviceItems = await window.purgo.listServices();
        renderServicesList(document.getElementById('services-search').value);
      } catch (err) {
        toast(`Fehler: ${err.message || err}`, 'error');
      }
    });
    row.appendChild(stopBtn);

    list.appendChild(row);
  }
}

document.getElementById('services-scan-btn').addEventListener('click', async () => {
  const btn = document.getElementById('services-scan-btn');
  btn.disabled = true;
  btn.textContent = 'Lade…';
  const list = document.getElementById('services-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Lade Dienste…'));
  try {
    serviceItems = await window.purgo.listServices();
    renderServicesList(document.getElementById('services-search').value);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Dienste laden';
  }
});

document.getElementById('services-search').addEventListener('input', (e) => {
  renderServicesList(e.target.value);
});

// ---------- Performance-Modus ----------
async function loadPowerPlan() {
  const plan = await window.purgo.getPowerPlan();
  document.getElementById('power-plan-current').textContent = plan.name || 'Unbekannt';
}

document.getElementById('power-plan-high-btn').addEventListener('click', async () => {
  await window.purgo.setPowerPlan('high');
  toast('Energieplan auf Höchstleistung gestellt.', 'success');
  loadPowerPlan();
});

document.getElementById('power-plan-balanced-btn').addEventListener('click', async () => {
  await window.purgo.setPowerPlan('balanced');
  toast('Energieplan auf Ausbalanciert gestellt.', 'success');
  loadPowerPlan();
});

document.getElementById('performance-scan-btn').addEventListener('click', async () => {
  const btn = document.getElementById('performance-scan-btn');
  btn.disabled = true;
  btn.textContent = 'Scanne…';
  const list = document.getElementById('performance-apps-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Scan läuft…'));
  try {
    const apps = await window.purgo.listBackgroundApps();
    list.innerHTML = '';
    if (apps.length === 0) {
      list.appendChild(el('div', 'empty-hint', 'Keine sichtbaren Hintergrund-Apps gefunden.'));
    }
    for (const appItem of apps) {
      const row = el('div', 'item-row');
      const main = el('div', 'item-main');
      main.appendChild(el('div', 'item-label', appItem.title || appItem.name));
      main.appendChild(el('div', 'item-desc', appItem.name));
      row.appendChild(main);
      row.appendChild(el('div', 'item-size', formatBytes(appItem.memBytes)));

      const killBtn = el('button', 'btn btn-small btn-danger', 'Beenden');
      killBtn.addEventListener('click', async () => {
        const confirmed = await showConfirm(`"${appItem.title || appItem.name}" wirklich beenden? Ungespeicherte Daten in dieser App gehen verloren.`, { danger: true, confirmLabel: 'Beenden' });
        if (!confirmed) return;
        try {
          await window.purgo.killProcess(appItem.pid, appItem.name);
          row.remove();
        } catch (err) {
          toast(`Konnte Prozess nicht beenden: ${err.message || err}`, 'error');
        }
      });
      row.appendChild(killBtn);

      list.appendChild(row);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan starten';
  }
});

// ---------- Design (Theme & Akzentfarbe) ----------
function renderAccentSwatches() {
  const container = document.getElementById('accent-swatches');
  container.innerHTML = '';
  const current = getStoredAccent();
  for (const [name, preset] of Object.entries(ACCENT_PRESETS)) {
    const swatch = document.createElement('button');
    swatch.className = `accent-swatch${name === current ? ' active' : ''}`;
    swatch.style.background = preset.accent;
    swatch.title = preset.label;
    swatch.addEventListener('click', () => {
      applyAccent(name);
      renderAccentSwatches();
    });
    container.appendChild(swatch);
  }
}

document.getElementById('setting-theme').addEventListener('change', (e) => {
  applyTheme(e.target.value);
});

// ---------- Dashboard: Datenträger-Gesundheit, Boot-Zeit, Windows-Updates, Warnung, Trend ----------
async function loadDiskHealth() {
  const list = document.getElementById('disk-health-list');
  list.innerHTML = '';
  try {
    const disks = await window.purgo.getDiskHealth();
    if (disks.length === 0) {
      list.appendChild(el('div', 'empty-hint', 'Keine Daten verfügbar.'));
      return;
    }
    for (const disk of disks) {
      const row = el('div', 'item-row');
      row.appendChild(el('div', 'item-main', disk.name));
      const badgeClass = disk.health === 'Healthy' ? 'badge risk-safe' : 'badge outdated';
      row.appendChild(el('span', badgeClass, disk.health));
      list.appendChild(row);
    }
  } catch {
    list.innerHTML = '';
    list.appendChild(el('div', 'empty-hint', 'Nicht verfügbar auf diesem System.'));
  }
}

async function loadBootTime() {
  try {
    const history = await window.purgo.getBootTimeHistory();
    if (history.length === 0) {
      document.getElementById('boot-time-value').textContent = 'Keine Daten';
      return;
    }
    const latest = history[0];
    document.getElementById('boot-time-value').textContent = `${(latest.bootTimeMs / 1000).toFixed(1)} s`;
    const recent = history.slice(0, 5).map((h) => `${(h.bootTimeMs / 1000).toFixed(1)}s`).join(' · ');
    document.getElementById('boot-time-trend').textContent = `Letzte Starts: ${recent}`;
  } catch {
    document.getElementById('boot-time-value').textContent = 'Nicht verfügbar';
  }
}

document.getElementById('windows-update-check-btn').addEventListener('click', async () => {
  const btn = document.getElementById('windows-update-check-btn');
  const result = document.getElementById('windows-update-result');
  btn.disabled = true;
  btn.textContent = 'Suche…';
  result.textContent = 'Das kann bis zu 2 Minuten dauern…';
  try {
    const updates = await window.purgo.listPendingUpdates();
    result.textContent = updates.length === 0
      ? 'Keine ausstehenden Updates.'
      : `${updates.length} ausstehende Update(s): ${updates.slice(0, 3).map((u) => u.title).join('; ')}${updates.length > 3 ? '…' : ''}`;
  } catch (err) {
    result.textContent = `Fehler: ${err.message || err}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Prüfen';
  }
});

let lastDiskWarningDrive = null;

function checkDiskWarning(disks) {
  const critical = disks.find((d) => d.usedPercent >= 90);
  const banner = document.getElementById('disk-warning-banner');
  if (!critical) {
    banner.hidden = true;
    lastDiskWarningDrive = null;
    return;
  }
  document.getElementById('disk-warning-text').textContent =
    `Laufwerk ${critical.drive} ist zu ${critical.usedPercent}% voll – Zeit für eine Bereinigung.`;
  banner.hidden = false;
  if (lastDiskWarningDrive !== critical.drive) {
    lastDiskWarningDrive = critical.drive;
    try {
      new Notification('Purgo – Speicherplatz knapp', { body: `Laufwerk ${critical.drive} ist zu ${critical.usedPercent}% voll.` });
    } catch {
      // Benachrichtigungen evtl. vom System blockiert, Banner reicht dann als Hinweis
    }
  }
}

async function loadTrendChart() {
  const container = document.getElementById('trend-chart');
  container.innerHTML = '';
  const trend = await window.purgo.getHistoryTrend(14);
  const max = Math.max(...trend.map((t) => t.freedBytes), 1);
  const width = 560;
  const height = 90;
  const barWidth = width / trend.length;

  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'trend-chart-svg');

  trend.forEach((point, index) => {
    const barHeight = Math.max(2, (point.freedBytes / max) * (height - 10));
    const rect = document.createElementNS(svgNs, 'rect');
    rect.setAttribute('x', index * barWidth + 2);
    rect.setAttribute('y', height - barHeight);
    rect.setAttribute('width', Math.max(2, barWidth - 4));
    rect.setAttribute('height', barHeight);
    rect.setAttribute('fill', point.freedBytes > 0 ? 'var(--accent)' : 'var(--border)');
    const title = document.createElementNS(svgNs, 'title');
    title.textContent = `${point.date}: ${formatBytes(point.freedBytes)}`;
    rect.appendChild(title);
    svg.appendChild(rect);
  });

  container.appendChild(svg);
}

document.getElementById('report-export-btn').addEventListener('click', async () => {
  const savedPath = await window.purgo.exportReport();
  if (savedPath) toast(`Bericht exportiert nach: ${savedPath}`, 'success');
});

// ---------- Browser-Erweiterungen ----------
let extensionItems = [];

function renderExtensionsList() {
  const list = document.getElementById('extensions-list');
  list.innerHTML = '';
  if (extensionItems.length === 0) {
    list.appendChild(el('div', 'empty-hint', 'Keine Erweiterungen gefunden.'));
    return;
  }
  for (const extension of extensionItems) {
    const row = el('div', 'item-row');
    const main = el('div', 'item-main');
    main.appendChild(el('div', 'item-label', extension.name));
    main.appendChild(el('div', 'item-desc', `${extension.browser} · v${extension.version}`));
    row.appendChild(main);

    const label = document.createElement('label');
    label.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = extension.enabled;
    input.disabled = extension.browser === 'Firefox';
    input.addEventListener('change', async () => {
      input.disabled = true;
      try {
        await window.purgo.setExtensionEnabled(extension, input.checked);
        extension.enabled = input.checked;
        toast(`${extension.name} ${input.checked ? 'aktiviert' : 'deaktiviert'}.`, 'success');
      } catch (err) {
        input.checked = !input.checked;
        toast(`Fehler: ${err.message || err}`, 'error');
      } finally {
        input.disabled = extension.browser === 'Firefox';
      }
    });
    label.appendChild(input);
    label.appendChild(el('span', 'switch-slider'));
    row.appendChild(label);

    list.appendChild(row);
  }
}

document.getElementById('extensions-scan-btn').addEventListener('click', async () => {
  const btn = document.getElementById('extensions-scan-btn');
  btn.disabled = true;
  btn.textContent = 'Lade…';
  const list = document.getElementById('extensions-list');
  list.innerHTML = '';
  list.appendChild(el('div', 'empty-hint', 'Lade Erweiterungen…'));
  try {
    extensionItems = await window.purgo.listExtensions();
    renderExtensionsList();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Erweiterungen laden';
  }
});

// ---------- Arbeitsspeicher-Cleaner ----------
document.getElementById('memory-trim-btn').addEventListener('click', async () => {
  const btn = document.getElementById('memory-trim-btn');
  btn.disabled = true;
  btn.textContent = 'Läuft…';
  try {
    const result = await window.purgo.trimMemory();
    document.getElementById('memory-trim-result').textContent =
      `Angezeigter Verbrauch: ${formatBytes(result.beforeBytes)} → ${formatBytes(result.afterBytes)}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Jetzt ausführen';
  }
});

// ---------- Settings: Kontextmenü, Aufgabenplanung, Backup ----------
document.getElementById('setting-context-menu').addEventListener('change', async (e) => {
  const checkbox = e.target;
  try {
    if (checkbox.checked) {
      await window.purgo.registerContextMenu();
      toast('Kontextmenü-Eintrag hinzugefügt.', 'success');
    } else {
      await window.purgo.unregisterContextMenu();
      toast('Kontextmenü-Eintrag entfernt.', 'success');
    }
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    toast(`Fehler: ${err.message || err}`, 'error');
  }
});

document.getElementById('settings-export-btn').addEventListener('click', async () => {
  const savedPath = await window.purgo.exportSettings();
  if (savedPath) toast(`Einstellungen exportiert nach: ${savedPath}`, 'success');
});

document.getElementById('settings-import-btn').addEventListener('click', async () => {
  const confirmed = await showConfirm('Einstellungen aus einer Datei importieren? Bestehende Einstellungen werden überschrieben.', { confirmLabel: 'Importieren' });
  if (!confirmed) return;
  try {
    const merged = await window.purgo.importSettings();
    if (merged) {
      toast('Einstellungen importiert.', 'success');
      loadSettingsView();
    }
  } catch (err) {
    toast(`Import fehlgeschlagen: ${err.message || err}`, 'error');
  }
});

// ---------- Explorer-Integration: Sprung in den Speicherplatz-Analyzer ----------
window.purgo.onAnalyzePath((targetPath) => {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelector('[data-view="space"]').classList.add('active');
  document.getElementById('view-space').classList.add('active');
  spaceBreadcrumb = [targetPath];
  loadSpaceLevel(targetPath);
});

// ---------- Onboarding-Assistent ----------
const ONBOARDING_STEPS = [
  { title: 'Willkommen bei Purgo! 🧹', message: 'Kurzer Rundgang durch die wichtigsten Funktionen, dauert nur eine Minute. Du kannst jederzeit überspringen.' },
  { title: 'Dashboard', message: 'Hier siehst du den System-Health-Score auf einen Blick und kannst mit „Jetzt aufräumen“ sichere Junk-Kategorien in einem Klick bereinigen.' },
  { title: 'Vorsicht bei Registry & Programm-Resten', message: 'Der Registry-Cleaner und der Software-Reste-Finder zeigen dir erst eine Vorschau. Prüfe Funde dort im Zweifel, bevor du löschst – ein Backup wird zwar automatisch angelegt, aber sicher ist sicher.' },
  { title: 'PIN-Schutz verfügbar', message: 'Falls gewünscht, kannst du in den Einstellungen eine PIN für riskante Aktionen (Registry, Deinstallation, Reste löschen) aktivieren.' },
  { title: 'Tray & geplante Reinigung', message: 'Purgo kann in den Infobereich minimieren und dort automatisch nach Zeitplan aufräumen – ebenfalls in den Einstellungen konfigurierbar. Los geht\'s!' }
];

function showOnboardingStep(index) {
  const step = ONBOARDING_STEPS[index];
  document.getElementById('onboarding-title').textContent = step.title;
  document.getElementById('onboarding-message').textContent = step.message;
  const nextBtn = document.getElementById('onboarding-next-btn');
  nextBtn.textContent = index === ONBOARDING_STEPS.length - 1 ? 'Los geht\'s' : 'Weiter';
}

function initOnboarding() {
  let completed = false;
  try {
    completed = localStorage.getItem('purgo.onboardingCompleted') === 'true';
  } catch {
    completed = false;
  }
  if (completed) return;

  let step = 0;
  const overlay = document.getElementById('onboarding-overlay');
  overlay.hidden = false;
  showOnboardingStep(step);

  function finish() {
    overlay.hidden = true;
    try {
      localStorage.setItem('purgo.onboardingCompleted', 'true');
    } catch {
      // Ohne localStorage taucht der Assistent beim nächsten Start erneut auf, kein Blocker
    }
  }

  document.getElementById('onboarding-skip-btn').addEventListener('click', finish, { once: true });
  document.getElementById('onboarding-next-btn').addEventListener('click', function onNext() {
    step += 1;
    if (step >= ONBOARDING_STEPS.length) {
      finish();
      document.getElementById('onboarding-next-btn').removeEventListener('click', onNext);
    } else {
      showOnboardingStep(step);
    }
  });
}

// ---------- Init ----------
checkElevation();
loadPowerPlan();
renderAccentSwatches();
document.getElementById('setting-theme').value = getStoredTheme();
loadDiskHealth();
loadBootTime();
loadTrendChart();
initOnboarding();
loadDashboard();
