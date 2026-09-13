const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const { scanDuplicates, listFilesRecursive } = require('../duplicateFinder');
const { isImageFile, findSimilarGroups } = require('../imageSimilarity');

async function main() {
  const groups = await scanDuplicates(workerData.rootPath, workerData.excludedPaths || [], (progress) => {
    parentPort.postMessage({ type: 'progress', phase: 'duplicates', ...progress });
  });

  let similarGroups = [];
  if (workerData.includeSimilarImages) {
    const files = listFilesRecursive(workerData.rootPath, workerData.excludedPaths || []);
    const imagePaths = files.map((f) => f.path).filter((p) => isImageFile(p));
    similarGroups = await findSimilarGroups(imagePaths, (progress) => {
      parentPort.postMessage({ type: 'progress', phase: 'similarity', ...progress });
    });
  }

  parentPort.postMessage({ type: 'done', groups, similarGroups });
}

main().catch((err) => {
  parentPort.postMessage({ type: 'error', error: err.message });
});
