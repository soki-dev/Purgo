# Purgo

Windows-Aufräum- und Wartungstool (CCleaner-artiger Prototyp) auf Basis von Electron.

## Features

- **Dashboard** – CPU/RAM/Disk-Auslastung, System-Health-Score, Ein-Klick-Reinigung, letzte Aktionen
- **Junk-Cleaner** – Temp-Dateien, Browser-Caches, Cookies/Verlauf/Autofill (Chrome/Edge/Firefox), Papierkorb, Windows-Update-Cache. Erst Vorschau, dann explizite Bereinigung.
- **Registry-Cleaner** – findet verwaiste `App Paths`-, Deinstallations-, Font- und MUI-Cache-Einträge. Vor jedem Löschen wird automatisch ein `.reg`-Backup unter `%APPDATA%/Purgo/registry-backups` angelegt.
- **Autostart-Manager** – listet Autostart-Einträge inkl. geschätzter Boot-Auswirkung (Heuristik aus Dateigröße/Signatur), An/Aus-Umschalten über den `StartupApproved`-Mechanismus.
- **Programm-Deinstaller** – listet installierte Programme und startet deren offiziellen Uninstaller.
- **Software-Reste-Finder** – Ordner unter Program Files, die keinem installierten Programm zugeordnet werden können.
- **Duplikat-Finder** – Hash-basierter Dateivergleich in einem gewählten Ordner, läuft in einem Worker-Thread mit Live-Fortschrittsanzeige.
- **Speicherplatz-Analyzer** – größte Ordner/Dateien pro Ebene mit Drill-down, ebenfalls in einem Worker-Thread.
- **Windows-Dienste-Manager** – Dienste anzeigen, starten/stoppen, Starttyp ändern.
- **Performance-Modus** – Energieplan wechseln (Ausbalanciert/Höchstleistung) und sichtbare Hintergrund-Apps manuell beenden.
- **Treiber-Check** – zeigt Alter der installierten Treiber, verlinkt zu einer Hersteller-Suche. Kein automatischer Download/Install.
- **Historie** – protokolliert jeden Scan und jede Aktion, filterbar, mit CSV-Export und Detailansicht. Feste Obergrenze von 200 Einträgen.
- **Tray-Integration & geplante Reinigung** – minimiert in den Infobereich, kann dort automatisch täglich/wöchentlich die sicheren Junk-Kategorien bereinigen.
- **PIN-Schutz** – optionale PIN-Abfrage vor Registry-Bereinigung, Deinstallation und dem Löschen von Programm-Resten.
- **Admin-Rechte-Erkennung** – zeigt einen Hinweis-Banner mit Ein-Klick-Neustart als Administrator, wenn Purgo ohne erhöhte Rechte läuft (relevant für manche Registry-/Dienste-Aktionen).
- **Theming** – Dunkel/Hell/System-Modus plus fünf Akzentfarben, per Klick umschaltbar.
- **Mehrsprachigkeit** – Oberfläche auf Deutsch/Englisch umschaltbar. Backend-Texte (Scan-Ergebnisse, Kategorie-Beschreibungen) sind aktuell nur auf Deutsch.
- **Auto-Update-Grundgerüst** – `electron-updater` ist verdrahtet, benötigt aber ein echtes, konfiguriertes GitHub-Release-Repository (siehe unten).

## Sicherheitsprinzip

Scans sind rein lesend. Jede destruktive Aktion (Löschen, Registry-Änderung, Deinstallation, Dienst stoppen, Prozess beenden) erfordert eine explizite Bestätigung in der UI – nichts passiert automatisch im Hintergrund, außer der optionalen geplanten Reinigung (nur „sichere“ Kategorien).

## Setup

```bash
npm install
npm start
```

## Tests

```bash
npm test    # Unit-Tests (Node's eingebauter Test-Runner, keine zusätzliche Abhängigkeit)
npm run smoke   # Manueller Rauch-Test: startet die echte App und prüft, dass sie nicht sofort abstürzt
```

Die Unit-Tests decken die reine Logik ab (Settings-Merge/Ausschlüsse, Historie inkl. CSV-Export, Duplikat-Gruppierung, Reste-Finder-Allowlist). UI und PowerShell-Interaktionen sind nicht automatisiert getestet.

## Installer bauen

```bash
npm run dist            # Unsignierter NSIS-Installer unter dist/
npm run dist:signed     # Signiert zusätzlich mit dem lokalen Test-Zertifikat (siehe unten)
```

### Code-Signatur

`scripts/create-self-signed-cert.ps1` erzeugt ein **selbstsigniertes** Test-Zertifikat unter `build/cert/` (nicht eingecheckt, siehe `.gitignore`). Das entfernt die Windows-SmartScreen-Warnung **nicht** für andere Nutzer – dafür ist ein Zertifikat einer anerkannten Zertifizierungsstelle nötig (kostenpflichtig, mit Identitätsprüfung). Es demonstriert nur, dass die Signier-Pipeline (`npm run dist:signed`) funktioniert.

### Auto-Update & CI/CD

In `package.json` unter `build.publish` müssen `owner`/`repo` durch ein echtes GitHub-Repository ersetzt werden. `.github/workflows/release.yml` baut und veröffentlicht bei jedem Tag im Format `v1.2.3` automatisch einen Release über `electron-builder --publish always`. Für ein echtes Signatur-Zertifikat in CI die Repo-Secrets `CSC_LINK` und `CSC_KEY_PASSWORD` setzen; ohne sie baut die Pipeline einfach unsigniert weiter. Das Repository braucht unter Settings → Actions → General die Berechtigung „Read and write“ für den `GITHUB_TOKEN`, damit die Pipeline Releases erstellen darf.

## Bekannte Prototyp-Grenzen

- Der Treiber-Check hat keinen Zugriff auf eine offizielle "aktuelle Version"-Datenbank und schätzt Veraltung nur über das Treiberdatum.
- Der Registry-Scan deckt bewusst nur gut verstandene, sichere Kategorien ab, um keine falsch-positiven Löschvorschläge zu produzieren.
- Firefox-Verlauf wird bewusst nicht als Cleaner-Kategorie angeboten, da er zusammen mit den Lesezeichen in derselben Datei liegt.
- Der Software-Reste-Finder kann portable, nicht über die Registry installierte Programme fälschlich als „verwaist“ melden.
- Die Autostart-„Auswirkung“ ist eine Heuristik aus Dateigröße/Signatur, keine gemessene Bootzeit.
- Der PIN-Schutz ist eine zusätzliche Bestätigungs-Hürde, kein echter Zugriffsschutz (PIN-Hash liegt lokal in `settings.json`).
- Auto-Update funktioniert erst, sobald ein echtes GitHub-Repository konfiguriert und Releases dorthin veröffentlicht wurden.
- Ohne ein kostenpflichtiges Zertifikat einer echten Zertifizierungsstelle bleibt der Installer für andere Nutzer unsigniert – SmartScreen kann warnen.
