const { parentPort, workerData } = require('worker_threads');
const { listEntries } = require('../spaceAnalyzer');

listEntries(workerData.rootPath, (progress) => {
  parentPort.postMessage({ type: 'progress', ...progress });
})
  .then((entries) => {
    parentPort.postMessage({ type: 'done', entries });
  })
  .catch((err) => {
    parentPort.postMessage({ type: 'error', error: err.message });
  });
