const fs = require('fs');
const path = require('path');

// Ermittelt die Größe jedes direkten Kindelements (Datei oder Ordner) unter rootPath.
// Für Ordner wird rekursiv summiert, aber nur eine Ebene tief zurückgegeben – der Nutzer
// klickt sich in der UI Ebene für Ebene weiter runter (schneller als ein kompletter
// Voraus-Scan des ganzen Baums und für einen Prototyp ausreichend).
function sizeOfDir(dirPath) {
  let total = 0;
  function walk(p) {
    let entries;
    try {
      entries = fs.readdirSync(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(p, entry.name);
      try {
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          total += fs.statSync(full).size;
        }
      } catch {
        // locked/inaccessible, skip
      }
    }
  }
  walk(dirPath);
  return total;
}

// onProgress läuft (wie das ganze Modul) auch in einem worker_threads-Worker, daher
// nur einfache serialisierbare Objekte über den Callback reichen.
async function listEntries(rootPath, onProgress) {
  let dirents;
  try {
    dirents = fs.readdirSync(rootPath, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Ordner kann nicht gelesen werden: ${err.message}`);
  }

  const candidates = dirents.filter((e) => !e.isSymbolicLink() && (e.isDirectory() || e.isFile()));
  const total = candidates.length;
  let processed = 0;

  const entries = [];
  for (const entry of candidates) {
    const full = path.join(rootPath, entry.name);
    try {
      if (entry.isDirectory()) {
        entries.push({ name: entry.name, path: full, isDir: true, sizeBytes: sizeOfDir(full) });
      } else {
        entries.push({ name: entry.name, path: full, isDir: false, sizeBytes: fs.statSync(full).size });
      }
    } catch {
      // locked/inaccessible, skip
    }
    processed += 1;
    if (onProgress) onProgress({ processed, total, currentName: entry.name });
  }

  return entries.sort((a, b) => b.sizeBytes - a.sizeBytes);
}

module.exports = { listEntries };
