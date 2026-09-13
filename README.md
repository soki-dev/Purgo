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
- **Echte Boot-Zeit-Messung** – liest die tatsächliche letzte Boot-Dauer aus dem Windows-Ereignisprotokoll (Diagnostics-Performance) statt sie zu schätzen.
- **Windows-Update-Übersicht** – zeigt ausstehende Updates an (nur Anzeige, kein automatisches Installieren, Suche kann bis zu 2 Minuten dauern).
- **Datenträger-Gesundheit** – S.M.A.R.T.-nahe Statusanzeige je Festplatte/SSD über `Get-PhysicalDisk`.
- **Warnung bei vollem Datenträger** – Dashboard-Banner plus Windows-Benachrichtigung, sobald ein Laufwerk ≥ 90% voll ist.
- **Verlaufs-Trend-Diagramm** – kleines Balkendiagramm: freigegebener Speicher der letzten 14 Tage.
- **Exportierbarer System-Health-Report** – Dashboard-Snapshot plus Verlauf als eigenständige HTML-Datei.
- **Geführter Ersteinrichtungs-Assistent** – kurze Tour beim allerersten Start (einmalig, per `localStorage`-Flag).
- **Explorer-Kontextmenü** – optionales „Mit Purgo analysieren“ im Rechtsklick-Menü von Ordnern, springt in den Speicherplatz-Analyzer. Nur in der installierten Version verfügbar, nicht im Dev-Modus.
- **Geplante Reinigung über die Windows-Aufgabenplanung** – läuft jetzt über eine native `schtasks`-Aufgabe statt eines In-App-Timers, funktioniert also auch, wenn Purgo gerade nicht offen ist. Startet dafür kurz unsichtbar mit `--scheduled-clean` und zeigt eine Benachrichtigung.
- **Einstellungen exportieren/importieren** – komplette Konfiguration (inkl. Ausschlüsse und PIN-Hash) als eine JSON-Datei sichern oder auf einen anderen Rechner übertragen.
- **„Lange nicht genutzt“ bei Programmen** – wertet den Windows-Nutzungsverlauf (UserAssist) aus, um anzuzeigen, wann ein installiertes Programm zuletzt gestartet wurde.
- **Browser-Erweiterungs-Manager** – installierte Erweiterungen aus Chrome/Edge/Firefox anzeigen; Aktivieren/Deaktivieren nur für Chrome/Edge unterstützt.
- **Ähnlichkeits-Suche im Duplikat-Finder** – optionaler Bildvergleich (average hash) erkennt auch leicht unterschiedliche/komprimierte Bilder, nicht nur exakte Duplikate.
- **Arbeitsspeicher-Cleaner** – Working-Set-Trimming per Klick (ehrlicher Hinweis: reduziert nur kurzzeitig den angezeigten Verbrauch, kein echter Speicher-Gewinn).

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
- Die Ähnlichkeits-Suche nutzt einen einfachen average-Hash (aHash), keinen vollen Perceptual-Hash-Standard – bei sehr ähnlichen, aber inhaltlich unterschiedlichen Bildern (z.B. Serienfotos) kann sie danebenliegen. Läuft zudem paarweise (O(n²)), bei sehr vielen Bildern entsprechend langsamer.
- Der Arbeitsspeicher-Cleaner reduziert nur den kurzzeitig angezeigten Verbrauch (Working-Set-Trimming); Windows lädt ausgelagerte Seiten bei Bedarf sofort wieder nach.
- Das Explorer-Kontextmenü lässt sich nur in der installierten (gepackten) Version registrieren, nicht im Dev-Modus (`npm start`).
