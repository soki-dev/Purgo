const { parentPort, workerData } = require('worker_threads');
const { scanDuplicates } = require('../duplicateFinder');

scanDuplicates(workerData.rootPath, workerData.excludedPaths || [], (progress) => {
  parentPort.postMessage({ type: 'progress', ...progress });
})
  .then((groups) => {
    parentPort.postMessage({ type: 'done', groups });
  })
  .catch((err) => {
    parentPort.postMessage({ type: 'error', error: err.message });
  });
