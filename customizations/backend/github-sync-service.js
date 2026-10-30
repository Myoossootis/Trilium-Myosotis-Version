async function githubDatabaseSyncService(action,payload={}){
 if(api.getNote('MyoMarketData')?.getJsonContent()?.plugins.find(p=>p.id==='GhSyncRoot01')?.enabled===false)throw Error('GitHub 数据库同步插件已关闭。');
 const require=process.mainModule.require.bind(process.mainModule),path=require('path'),fs=require('fs'),crypto=require('crypto');
 const dataDir=api.getAppInfo().dataDirectory,dir=path.join(dataDir,'myosotis-github-sync');
 fs.mkdirSync(dir,{recursive:true});
 const runtime=globalThis.__myosotisGithubSyncRuntime||= {session:crypto.randomUUID(),workers:new Map()};
 const read=(name,fallback)=>{try{return JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error('本地同步记录损坏：'+name);}};
 const write=(name,value)=>{const file=path.join(dir,name),tmp=file+'.tmp-'+crypto.randomUUID();fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600});fs.renameSync(tmp,file);};
 function cleanupLock(id){const lock=read('operation.lock',null);if(lock?.jobId===id)fs.unlinkSync(path.join(dir,'operation.lock'));}
 function currentJob(){
  let job=read('background-job.json',null);
  if(job?.running&&(!runtime.workers.has(dir)||job.session!==runtime.session)){
   cleanupLock(job.id);job={...job,running:false,error:'上次同步已中断，请重新检查差异。'};write('background-job.json',job);
  }
  return job?{...job,progress:read('progress.json',null)}:null;
 }
 // Polling and initial rendering never compile the engine or load SQLite.
 if(action==='load')return {config:{version:1,repository:'',dbPath:path.join(dataDir,'document.db'),autoSync:false,...read('config.json',{})},activeDbPath:path.join(dataDir,'document.db'),lastResult:read('last-result.json',null),progress:read('progress.json',null),activeJob:currentJob()};
 if(action==='job'){const job=currentJob();if(job?.id!==payload.id)throw Error('同步任务已更换，请重新打开同步页面。');return job;}
 if(action==='cancel'){
  const job=currentJob(),slot=runtime.workers.get(dir);
  if(!job?.running)return job;
  if(job.id!==payload.id||!slot||slot.id!==job.id)throw Error('同步任务已更换。');
  if(job.operation!=='check')throw Error('上传或恢复确认阶段不能中断，请等待完成。');
  slot.cancelling=true;await slot.worker.terminate();slot.finish({error:'检查已取消。',cancelled:true});return currentJob();
 }
 const current=currentJob();
 if(action==='begin'){
  if(!['check','confirm'].includes(payload.operation))throw Error('不支持的后台同步操作。');
  if(current?.running){if(current.operation==='check'&&payload.operation==='check')return {id:current.id,operation:current.operation};throw Error('已有同步任务正在执行。');}
 }else if(!['saveConfig','detail'].includes(action))throw Error('不支持的同步操作。');
 else if(current?.running)throw Error('同步运行中，暂时不能修改设置或读取旧预览。');
 const source=api.getNote('GhSyncEngine1').getContent(),restoreSource=api.getNote('GhSyncRestore1').getContent(),threadSource=api.getNote('GhSyncWorker1').getContent();
 const resourceDir=process.resourcesPath||path.join(path.dirname(process.execPath),'resources');
 const operation=action==='begin'?payload.operation:action,id=crypto.randomUUID();
 const options={activeDbPath:path.join(dataDir,'document.db'),storeDir:dir,modulePath:path.join(resourceDir,'app.asar','package.json'),operationId:id};
 const makeWorker=()=>new(require('worker_threads').Worker)(threadSource,{eval:true,resourceLimits:{maxOldGenerationSizeMb:256},workerData:{engineSource:source,restoreSource,databaseModule:path.join(resourceDir,'app.asar','node_modules','better-sqlite3'),options,action:operation,payload:action==='begin'?payload.input||{}:payload}});
 if(action!=='begin')return new Promise((resolve,reject)=>{
  const worker=makeWorker();let complete=false;
  worker.once('message',message=>{complete=true;void worker.terminate();message.error?reject(Error(message.error)):resolve(message.result);});
  worker.once('error',reject);worker.once('exit',()=>{if(!complete)reject(Error('同步工作线程提前退出。'));});
 });
 const base={id,pid:process.pid,session:runtime.session,operation,startedAt:Date.now()};
 write('background-job.json',{...base,running:true});write('progress.json',{running:true,phase:'正在启动同步工作线程',done:0,total:0});
 let worker;
 try{worker=makeWorker();}catch(error){write('background-job.json',{...base,running:false,error:error.message});throw error;}
 const slot={id,worker,cancelling:false,finish:message=>{
  if(runtime.workers.get(dir)!==slot)return;
  try{
   cleanupLock(id);
   if(message.cancelled)fs.rmSync(path.join(dir,'plan','plan.json'),{force:true});
   write('background-job.json',{...base,running:false,finishedAt:Date.now(),...message});
   const progress=read('progress.json',{});write('progress.json',{...progress,running:false,...(message.cancelled?{phase:'检查已取消'}:{})});
  }catch(error){console.error('GitHub 同步状态保存失败：'+error.message);}
  finally{runtime.workers.delete(dir);void worker.terminate();}
 }};
 runtime.workers.set(dir,slot);
 worker.once('message',message=>{if(!slot.cancelling)slot.finish(message);});
 worker.once('error',error=>{if(!slot.cancelling)slot.finish({error:error.message});});
 worker.once('exit',code=>{if(!slot.cancelling&&runtime.workers.get(dir)===slot)slot.finish({error:'同步工作线程提前退出（'+code+'）。'});});
 return {id,operation};
}
