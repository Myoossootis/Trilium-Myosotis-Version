// Executed only by Node's Worker API, never on Electron's window/main thread.
const {parentPort,workerData}=require('node:worker_threads');
const moduleBox={exports:{}};
new Function('require','module','exports',workerData.engineSource)(require,moduleBox,moduleBox.exports);
const Database=require(workerData.databaseModule);
const engine=new moduleBox.exports.SyncEngine({...workerData.options,Database,engineSource:workerData.engineSource,workerSource:workerData.restoreSource});
engine.handle(workerData.action,workerData.payload||{})
 .then(result=>parentPort.postMessage({result}))
 .catch(error=>parentPort.postMessage({error:error.message}))
 .finally(()=>parentPort.close());
