const sharp = require('sharp');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tiff']);
const HASH_SIZE = 8; // 8x8 Graustufen-Raster -> 64-Bit-Hash (average hash / aHash)
const SIMILARITY_THRESHOLD = 6; // Hamming-Distanz; niedriger = strenger, 0 = praktisch identisch

// Bewusst kein exakter Perceptual-Hash-Standard (pHash/DCT), sondern der einfachere
// aHash: gut genug, um leicht komprimierte/skalierte Varianten desselben Bildes zu
// erkennen, ohne eine zusätzliche DSP-Bibliothek zu brauchen. Kann bei sehr ähnlichen,
// aber inhaltlich unterschiedlichen Bildern (z.B. Serienfotos) auch danebenliegen.
function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function computeHash(filePath) {
  const { data } = await sharp(filePath)
    .resize(HASH_SIZE, HASH_SIZE, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (const value of data) sum += value;
  const avg = sum / data.length;

  let hash = 0n;
  for (const value of data) {
    hash = (hash << 1n) | (value > avg ? 1n : 0n);
  }
  return hash;
}

function hammingDistance(a, b) {
  let x = a ^ b;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

async function findSimilarGroups(filePaths, onProgress) {
  const hashes = [];
  let processed = 0;

  for (const filePath of filePaths) {
    try {
      const hash = await computeHash(filePath);
      hashes.push({ path: filePath, hash });
    } catch {
      // nicht lesbares/unterstütztes Bildformat, überspringen
    }
    processed += 1;
    if (onProgress) onProgress({ processed, total: filePaths.length });
  }

  const used = new Set();
  const groups = [];
  for (let i = 0; i < hashes.length; i++) {
    if (used.has(i)) continue;
    const cluster = [hashes[i]];
    for (let j = i + 1; j < hashes.length; j++) {
      if (used.has(j)) continue;
      if (hammingDistance(hashes[i].hash, hashes[j].hash) <= SIMILARITY_THRESHOLD) {
        cluster.push(hashes[j]);
        used.add(j);
      }
    }
    if (cluster.length > 1) {
      used.add(i);
      groups.push({ id: `similar-${i}`, files: cluster.map((c) => c.path) });
    }
  }

  return groups;
}

module.exports = { isImageFile, findSimilarGroups };
