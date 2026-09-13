const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIN_SIZE_BYTES = 4096; // Dateien unter 4 KB bringen kaum Platzgewinn und erzeugen nur Rauschen

// Kein settingsStore-Import hier: dieses Modul läuft auch in einem worker_threads-Worker,
// wo Electrons app-Modul nicht verfügbar ist. Ausschlüsse werden daher als einfache
// Pfad-Liste übergeben statt selbst aus den Settings gelesen.
function isExcludedPath(targetPath, excludedPaths) {
  if (!excludedPaths || excludedPaths.length === 0) return false;
  const normalizedTarget = path.normalize(targetPath).toLowerCase();
  return excludedPaths.some((p) => normalizedTarget.startsWith(path.normalize(p).toLowerCase()));
}

function listFilesRecursive(rootPath, excludedPaths) {
  const files = [];

  function walk(p) {
    if (isExcludedPath(p, excludedPaths)) return;
    let entries;
    try {
      entries = fs.readdirSync(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(p, entry.name);
      if (entry.isSymbolicLink()) continue;
      try {
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          if (isExcludedPath(full, excludedPaths)) continue;
          const size = fs.statSync(full).size;
          if (size >= MIN_SIZE_BYTES) files.push({ path: full, size });
        }
      } catch {
        // locked/inaccessible, skip
      }
    }
  }

  walk(rootPath);
  return files;
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function scanDuplicates(rootPath, excludedPaths = [], onProgress) {
  const files = listFilesRecursive(rootPath, excludedPaths);

  const bySize = new Map();
  for (const file of files) {
    if (!bySize.has(file.size)) bySize.set(file.size, []);
    bySize.get(file.size).push(file.path);
  }

  const candidateGroups = Array.from(bySize.entries()).filter(([, paths]) => paths.length >= 2);
  const total = candidateGroups.reduce((sum, [, paths]) => sum + paths.length, 0);
  let processed = 0;

  const groups = [];
  for (const [size, paths] of candidateGroups) {
    const byHash = new Map();
    for (const filePath of paths) {
      try {
        const hash = await hashFile(filePath);
        if (!byHash.has(hash)) byHash.set(hash, []);
        byHash.get(hash).push(filePath);
      } catch {
        // file became unreadable mid-scan, skip it
      }
      processed += 1;
      if (onProgress) onProgress({ processed, total });
    }

    for (const [hash, matchingPaths] of byHash.entries()) {
      if (matchingPaths.length < 2) continue;
      groups.push({
        id: hash,
        sizeBytes: size,
        files: matchingPaths,
        wastedBytes: size * (matchingPaths.length - 1)
      });
    }
  }

  return groups.sort((a, b) => b.wastedBytes - a.wastedBytes);
}

function deleteFiles(paths) {
  const results = [];
  for (const filePath of paths) {
    try {
      const size = fs.statSync(filePath).size;
      fs.unlinkSync(filePath);
      results.push({ path: filePath, ok: true, freedBytes: size });
    } catch (err) {
      results.push({ path: filePath, ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = { scanDuplicates, deleteFiles, listFilesRecursive };
