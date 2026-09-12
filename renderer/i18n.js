// Übersetzt nur die statische Oberfläche (Navigation, Überschriften, Hinweistexte,
// Buttons). Von Scan-Engines gelieferte Kategorie-Namen/Beschreibungen kommen aktuell
// fest auf Deutsch aus dem Hauptprozess und werden hier bewusst nicht übersetzt –
// das wäre ein größerer Umbau der Backend-Module.
const TRANSLATIONS = {
  de: {
    'nav.dashboard': 'Dashboard',
    'nav.cleaner': 'Cleaner',
    'nav.registry': 'Registry',
    'nav.startup': 'Autostart & Programme',
    'nav.duplicates': 'Duplikate',
    'nav.space': 'Speicherplatz',
    'nav.drivers': 'Treiber',
    'nav.services': 'Dienste',
    'nav.history': 'Historie',
    'nav.settings': 'Einstellungen',

    'admin.bannerText': 'Purgo läuft ohne Administrator-Rechte – manche Registry- und Programm-Aktionen können fehlschlagen.',
    'admin.relaunch': 'Als Administrator neu starten',

    'dashboard.title': 'Dashboard',
    'dashboard.refresh': 'Aktualisieren',
    'dashboard.health': 'System-Health',
    'dashboard.hostname': 'Rechnername',
    'dashboard.platform': 'System',
    'dashboard.quickClean': 'Jetzt aufräumen',
    'dashboard.quickCleanHint': 'Bereinigt nur als „sicher“ eingestufte Kategorien in einem Schritt.',
    'dashboard.cpu': 'CPU-Auslastung',
    'dashboard.ram': 'Arbeitsspeicher',
    'dashboard.disks': 'Laufwerke',
    'dashboard.lifetime': 'Bisher freigegeben',
    'dashboard.recentActions': 'Letzte Aktionen',
    'dashboard.noActions': 'Noch keine Aktionen.',

    'common.loading': 'Lade Systeminformationen…',
    'common.startScan': 'Scan starten',
    'common.cleanSelected': 'Ausgewählte bereinigen',
    'common.noScanYet': 'Noch kein Scan durchgeführt.',
    'common.deleteSelected': 'Ausgewählte löschen',
    'common.pickFolder': 'Ordner wählen…',

    'cleaner.title': 'Junk-Cleaner',
    'cleaner.hint': 'Vorschau-Modus: Es wird zuerst nur angezeigt, was gelöscht würde. Erst nach Klick auf „Ausgewählte bereinigen“ wird wirklich etwas gelöscht. Cookie-, Verlaufs- und Autofill-Kategorien benötigen einen geschlossenen Browser, sonst schlägt das Löschen fehl.',

    'registry.title': 'Registry-Cleaner',
    'registry.hint': 'Nur nachweislich verwaiste Einträge werden gemeldet (Ziel existiert nicht mehr). Vor jeder Löschung wird automatisch ein .reg-Backup angelegt.',

    'startup.title': 'Autostart & Programme',
    'startup.tabAutostart': 'Autostart',
    'startup.tabPrograms': 'Installierte Programme',
    'startup.tabResidue': 'Programm-Reste',
    'startup.tabPerformance': 'Performance-Modus',
    'startup.loadPrograms': 'Programme laden',
    'startup.searchPlaceholder': 'Programm suchen…',
    'startup.noProgramsYet': 'Noch keine Liste geladen.',
    'startup.residueHint': 'Ordner unter „Program Files“, die keinem Eintrag in der Programme-Liste zugeordnet werden können. Kann auch portable Programme fälschlich melden – vor dem Löschen prüfen.',

    'duplicates.title': 'Duplikat-Finder',
    'duplicates.hint': 'Dateien werden per Inhalts-Hash verglichen (nicht nur Name/Größe). Pro Gruppe bleibt mindestens eine Kopie erhalten – die erste Datei ist immer vorausgewählt zum Behalten.',
    'duplicates.noFolder': 'Kein Ordner ausgewählt.',
    'duplicates.pickFirst': 'Wähle zuerst einen Ordner aus.',

    'space.title': 'Speicherplatz-Analyzer',
    'space.hint': 'Zeigt die größten Ordner und Dateien einer Ebene. Auf einen Ordner klicken, um hineinzugehen.',
    'space.pickToStart': 'Wähle einen Ordner aus, um zu starten.',

    'drivers.title': 'Treiber-Check',
    'drivers.hint': 'Es gibt keine offizielle Online-Datenbank für „aktuelle“ Treiber. Purgo zeigt daher das Alter des installierten Treibers und verlinkt auf eine Hersteller-Suche – automatisch heruntergeladen oder installiert wird nichts.',

    'performance.hint': 'Energieplan wechseln und sichtbare Hintergrund-Apps manuell beenden, um kurzfristig Leistung freizugeben (z.B. vor dem Spielen). Nichts davon läuft automatisch im Hintergrund.',
    'performance.currentPlan': 'Aktueller Energieplan',
    'performance.balanced': 'Ausbalanciert',
    'performance.highPerformance': 'Höchstleistung',
    'performance.backgroundApps': 'Sichtbare Hintergrund-Apps',

    'services.title': 'Windows-Dienste',
    'services.load': 'Dienste laden',
    'services.searchPlaceholder': 'Dienst suchen…',
    'services.hint': 'Vorsicht: Manche Dienste sind für Windows kritisch. Im Zweifel den Namen vorher recherchieren, bevor du ihn stoppst oder deaktivierst.',
    'services.noneYet': 'Noch keine Liste geladen.',

    'history.title': 'Historie',
    'history.export': 'Als CSV exportieren',
    'history.clear': 'Verlauf löschen',
    'history.hint': 'Protokolliert alle Scans und Aktionen von Purgo. Es werden die letzten 200 Einträge aufbewahrt.',
    'history.filterAll': 'Alle',
    'history.filterScan': 'Scans',
    'history.filterClean': 'Bereinigungen',
    'history.filterProgram': 'Programme',
    'history.filterSettings': 'Einstellungen',
    'history.empty': 'Noch keine Aktionen.',

    'settings.title': 'Einstellungen',
    'settings.design': 'Design',
    'settings.theme': 'Erscheinungsbild',
    'settings.themeDark': 'Dunkel',
    'settings.themeLight': 'Hell',
    'settings.themeSystem': 'System',
    'settings.accent': 'Akzentfarbe',
    'settings.behavior': 'Verhalten',
    'settings.tray': 'In den Tray minimieren',
    'settings.trayDesc': 'Beim Schließen des Fensters läuft Purgo im Hintergrund weiter (Symbol im Infobereich der Taskleiste) statt beendet zu werden.',
    'settings.language': 'Sprache',
    'settings.languageHint': 'Übersetzt die Oberfläche. Scan-Ergebnisse und Beschreibungen aus dem Backend bleiben aktuell auf Deutsch.',
    'settings.scheduler': 'Geplante Reinigung',
    'settings.schedulerEnable': 'Automatische Reinigung aktivieren',
    'settings.schedulerDesc': 'Bereinigt regelmäßig automatisch die als „sicher“ eingestuften Junk-Kategorien, solange Purgo (auch im Tray) läuft.',
    'settings.frequency': 'Häufigkeit',
    'settings.daily': 'Täglich',
    'settings.weekly': 'Wöchentlich',
    'settings.security': 'Sicherheit',
    'settings.pin': 'PIN für riskante Aktionen',
    'settings.pinDesc': 'Fragt vor Registry-Bereinigung, Deinstallation und dem Löschen von Programm-Resten eine zuvor festgelegte PIN ab.',
    'settings.pinChange': 'PIN ändern',
    'settings.updates': 'Updates',
    'settings.checkUpdate': 'Nach Updates suchen',
    'settings.updateHint': 'Benötigt ein konfiguriertes Release-Repository. In diesem Prototyp ist dafür noch kein echtes Repository hinterlegt.',
    'settings.excludeList': 'Ausschlussliste',
    'settings.excludeHint': 'Ordner hier drin werden von Junk-Scan und Duplikat-Finder komplett ignoriert.',
    'settings.excludeAdd': 'Ordner hinzufügen…',
    'settings.excludeEmpty': 'Keine Ausschlüsse konfiguriert.'
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.cleaner': 'Cleaner',
    'nav.registry': 'Registry',
    'nav.startup': 'Startup & Programs',
    'nav.duplicates': 'Duplicates',
    'nav.space': 'Disk Space',
    'nav.drivers': 'Drivers',
    'nav.services': 'Services',
    'nav.history': 'History',
    'nav.settings': 'Settings',

    'admin.bannerText': 'Purgo is running without administrator rights – some registry and program actions may fail.',
    'admin.relaunch': 'Restart as administrator',

    'dashboard.title': 'Dashboard',
    'dashboard.refresh': 'Refresh',
    'dashboard.health': 'System Health',
    'dashboard.hostname': 'Hostname',
    'dashboard.platform': 'System',
    'dashboard.quickClean': 'Clean now',
    'dashboard.quickCleanHint': 'Cleans only categories marked as "safe" in one step.',
    'dashboard.cpu': 'CPU usage',
    'dashboard.ram': 'Memory',
    'dashboard.disks': 'Drives',
    'dashboard.lifetime': 'Freed so far',
    'dashboard.recentActions': 'Recent actions',
    'dashboard.noActions': 'No actions yet.',

    'common.loading': 'Loading system info…',
    'common.startScan': 'Start scan',
    'common.cleanSelected': 'Clean selected',
    'common.noScanYet': 'No scan run yet.',
    'common.deleteSelected': 'Delete selected',
    'common.pickFolder': 'Choose folder…',

    'cleaner.title': 'Junk Cleaner',
    'cleaner.hint': 'Preview mode: shows what would be deleted first. Nothing is deleted until you click "Clean selected". Cookie, history and autofill categories require the browser to be closed, otherwise deletion fails.',

    'registry.title': 'Registry Cleaner',
    'registry.hint': 'Only entries that are provably orphaned are reported (target no longer exists). A .reg backup is created automatically before every deletion.',

    'startup.title': 'Startup & Programs',
    'startup.tabAutostart': 'Startup',
    'startup.tabPrograms': 'Installed Programs',
    'startup.tabResidue': 'Leftover Files',
    'startup.tabPerformance': 'Performance Mode',
    'startup.loadPrograms': 'Load programs',
    'startup.searchPlaceholder': 'Search program…',
    'startup.noProgramsYet': 'No list loaded yet.',
    'startup.residueHint': 'Folders under "Program Files" that can\'t be matched to an entry in the program list. May also flag portable apps incorrectly – review before deleting.',

    'duplicates.title': 'Duplicate Finder',
    'duplicates.hint': 'Files are compared by content hash (not just name/size). One copy per group is always kept – the first file is pre-selected to keep.',
    'duplicates.noFolder': 'No folder selected.',
    'duplicates.pickFirst': 'Choose a folder first.',

    'space.title': 'Disk Space Analyzer',
    'space.hint': 'Shows the largest folders and files at one level. Click a folder to drill in.',
    'space.pickToStart': 'Choose a folder to get started.',

    'drivers.title': 'Driver Check',
    'drivers.hint': 'There is no official online database for "current" drivers. Purgo shows the age of the installed driver instead and links to a manufacturer search – nothing is downloaded or installed automatically.',

    'performance.hint': 'Switch power plan and manually close visible background apps to free up performance briefly (e.g. before gaming). None of this runs automatically in the background.',
    'performance.currentPlan': 'Current power plan',
    'performance.balanced': 'Balanced',
    'performance.highPerformance': 'High performance',
    'performance.backgroundApps': 'Visible background apps',

    'services.title': 'Windows Services',
    'services.load': 'Load services',
    'services.searchPlaceholder': 'Search service…',
    'services.hint': 'Careful: some services are critical to Windows. When in doubt, look up the name before stopping or disabling it.',
    'services.noneYet': 'No list loaded yet.',

    'history.title': 'History',
    'history.export': 'Export as CSV',
    'history.clear': 'Clear history',
    'history.hint': 'Logs every scan and action Purgo performs. The last 200 entries are kept.',
    'history.filterAll': 'All',
    'history.filterScan': 'Scans',
    'history.filterClean': 'Cleanups',
    'history.filterProgram': 'Programs',
    'history.filterSettings': 'Settings',
    'history.empty': 'No actions yet.',

    'settings.title': 'Settings',
    'settings.design': 'Design',
    'settings.theme': 'Appearance',
    'settings.themeDark': 'Dark',
    'settings.themeLight': 'Light',
    'settings.themeSystem': 'System',
    'settings.accent': 'Accent color',
    'settings.behavior': 'Behavior',
    'settings.tray': 'Minimize to tray',
    'settings.trayDesc': 'Closing the window keeps Purgo running in the background (tray icon) instead of quitting.',
    'settings.language': 'Language',
    'settings.languageHint': 'Translates the interface. Scan results and descriptions from the backend are currently German only.',
    'settings.scheduler': 'Scheduled cleaning',
    'settings.schedulerEnable': 'Enable automatic cleaning',
    'settings.schedulerDesc': 'Regularly cleans the categories marked as "safe" automatically while Purgo (including in the tray) is running.',
    'settings.frequency': 'Frequency',
    'settings.daily': 'Daily',
    'settings.weekly': 'Weekly',
    'settings.security': 'Security',
    'settings.pin': 'PIN for risky actions',
    'settings.pinDesc': 'Asks for a previously set PIN before registry cleanup, uninstalling programs, or deleting leftover files.',
    'settings.pinChange': 'Change PIN',
    'settings.updates': 'Updates',
    'settings.checkUpdate': 'Check for updates',
    'settings.updateHint': 'Requires a configured release repository. This prototype does not have a real one set up yet.',
    'settings.excludeList': 'Exclusion list',
    'settings.excludeHint': 'Folders in here are completely ignored by the junk scan and duplicate finder.',
    'settings.excludeAdd': 'Add folder…',
    'settings.excludeEmpty': 'No exclusions configured.'
  }
};

const I18N_STORAGE_KEY = 'purgo.language';

function getCurrentLanguage() {
  try {
    return localStorage.getItem(I18N_STORAGE_KEY) || 'de';
  } catch {
    return 'de';
  }
}

function applyLanguage(lang) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.de;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) el.innerHTML = dict[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (dict[key]) el.placeholder = dict[key];
  });

  document.documentElement.lang = lang;

  try {
    localStorage.setItem(I18N_STORAGE_KEY, lang);
  } catch {
    // localStorage kann in seltenen Fällen blockiert sein, Sprache gilt dann nur für diese Sitzung
  }
}

// Dieses Script steht am Ende von <body>, der restliche DOM ist zu diesem
// Zeitpunkt bereits geparst – kein Warten auf DOMContentLoaded nötig.
applyLanguage(getCurrentLanguage());
