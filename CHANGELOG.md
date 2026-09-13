# Changelog

## v0.5.1
- Bugfix: Der Ersteinrichtungs-Assistent blieb nach dem ersten Abschluss bei jedem weiteren Start leer und blockierend im Vordergrund hängen (Skip/Weiter reagierten nicht). Ursache: `.admin-banner` und `.modal-backdrop` setzten `display: flex` fest und überschrieben damit die Browser-Standardregel für das `hidden`-Attribut. Fix: globale `[hidden] { display: none !important; }`-Regel ergänzt.

## v0.5.0
- Eigener Autostart-Umschalter für Purgo selbst
- "Zurücksetzen"-Button (Einstellungen, Verlauf, PIN) mit PIN-Abfrage falls aktiv
- Neue Ansicht „Sicherheit“: System-Wiederherstellungspunkte verwalten, BitLocker-Status, Firewall-Status, Windows-Diagnosedaten-Stufe
- Neue Ansicht „Netzwerk“: aktive Verbindungen je Prozess, DNS-Cache leeren, Winsock zurücksetzen
- Eigene Bereinigungsregeln (selbst definierte Ordner/Dateien als Junk-Kategorie)
- Kommandozeilen-/Silent-Modus für Scans und Schnell-Reinigung (Ergebnis als JSON-Datei)
- Automatischer (stiller) Update-Check beim Start, zusätzlich zum manuellen Button
- Neue Ansicht „Info“ mit Changelog und Kurzerklärungen zu jedem Modul
- Barrierefreiheits-Verbesserungen: Fokus-Rückgabe und ARIA-Attribute bei Dialogen/Toasts, dekorative Icons als `aria-hidden` markiert

## v0.4.0
- Echte Boot-Zeit-Messung aus dem Windows-Ereignisprotokoll
- Windows-Update-Übersicht, Datenträger-Gesundheit (S.M.A.R.T.-nah), Warnung bei vollem Datenträger
- Verlaufs-Trend-Diagramm und exportierbarer System-Health-Report auf dem Dashboard
- Explorer-Kontextmenü „Mit Purgo analysieren“
- Geplante Reinigung über die native Windows-Aufgabenplanung statt In-App-Timer
- Einstellungen exportieren/importieren
- „Lange nicht genutzt“-Anzeige bei Programmen (UserAssist)
- Browser-Erweiterungs-Manager (Chrome/Edge/Firefox)
- Ähnlichkeits-Suche im Duplikat-Finder (Bildvergleich)
- Arbeitsspeicher-Cleaner (Working-Set-Trimming)
- Bugfix: Firefox-Cookie-/Autofill-Kategorien zeigten auf den falschen Profilordner

## v0.3.0
- Admin-Rechte-Erkennung mit Ein-Klick-Neustart als Administrator
- Duplikat-Finder und Speicherplatz-Analyzer laufen in Worker-Threads mit Fortschrittsanzeige
- Windows-Dienste-Manager
- Performance-Modus (Energieplan wechseln, Hintergrund-Apps beenden)
- Theming (Dunkel/Hell/System, 5 Akzentfarben)
- 12 automatisierte Unit-Tests, Smoke-Test-Skript
- Selbstsigniertes Test-Zertifikat + Signier-Pipeline
- Git-Repo initialisiert, GitHub-Actions-Release-Workflow vorbereitet

## v0.2.0
- Eigene Toasts/Dialoge statt Browser-Popups
- Volle Historien-Seite mit Filter, CSV-Export, Detailansicht
- PIN-Schutz für riskante Aktionen
- Weitere Registry-Kategorien (Font-Reste, MUI-Cache)
- Mehrsprachigkeit (Deutsch/Englisch)
- Auto-Update-Grundgerüst (electron-updater)

## v0.1.0
- Erster Prototyp: Dashboard, Junk-Cleaner, Registry-Cleaner, Autostart- & Programm-Manager, Software-Reste-Finder, Duplikat-Finder, Speicherplatz-Analyzer, Treiber-Check, Tray-Integration, geplante Reinigung, Logo/Icon-Set, NSIS-Installer
