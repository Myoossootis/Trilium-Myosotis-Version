// GitHub stores immutable, compressed SQLite snapshots. No live DB replacement or Git execution.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),util=require('node:util'),cp=require('node:child_process');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),json=value=>JSON.stringify(value),CHUNK=4*1024*1024,MAX=2*1024*1024*1024;
const {pipeline}=require('node:stream/promises'),{Readable,Transform}=require('node:stream');
async function hashFile(file){const digest=crypto.createHash('sha256');for await(const bytes of fs.createReadStream(file,{highWaterMark:1024*1024}))digest.update(bytes);return digest.digest('hex');}
async function readChunk(file,offset,size){const data=Buffer.alloc(size);let read=0;while(read<size){const result=await file.read(data,read,size-read,offset+read);if(!result.bytesRead)throw Error('压缩快照读取不完整');read+=result.bytesRead;}return data;}
async function parallel(items,limit,fn){let next=0,error;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(!error&&next<items.length){const i=next++;try{await fn(items[i],i);}catch(e){error||=e;}}}));if(error)throw error;}
const LOCAL_OPTIONS=new Set(['openNoteContexts','documentId','documentSecret','instanceId','lastSyncedPush','lastSyncedPull','lastDailyBackupDate','lastWeeklyBackupDate','lastMonthlyBackupDate','rightPaneWidth','leftPaneWidth','rightPaneVisible','leftPaneVisible','rightPaneSelectedTab']);
function indexDatabase(db){
 return db.transaction(()=>{
  const notes=new Map(),attachments=new Map(),blobHashes=new Map(),readBlob=db.prepare('SELECT content FROM blobs WHERE blobId=?');
  const blobHash=id=>{if(!blobHashes.has(id))blobHashes.set(id,hash(readBlob.get(id)?.content||''));return blobHashes.get(id);};
  // Revision-owned attachments do not belong to any live note. Sorting joined
  // blob contents can spill gigabytes of historical data to SQLite temp files.
  for(const a of db.prepare('SELECT a.ownerId,a.title,a.mime,a.position,a.role,a.isProtected,a.blobId FROM attachments a JOIN notes n ON n.noteId=a.ownerId AND n.isDeleted=0 WHERE a.isDeleted=0 ORDER BY a.attachmentId').iterate()){
   const list=attachments.get(a.ownerId)||[];list.push([a.title,a.mime,a.position,a.role,a.isProtected,blobHash(a.blobId)]);attachments.set(a.ownerId,list);
  }
  const attributes=new Map(),branches=new Map();
  for(const a of db.prepare('SELECT noteId,type,name,value,isInheritable,position FROM attributes WHERE isDeleted=0 ORDER BY noteId,type,name,value,position').all()){
   const list=attributes.get(a.noteId)||[];list.push([a.type,a.name,a.value,a.isInheritable,a.position]);attributes.set(a.noteId,list);
  }
  for(const b of db.prepare('SELECT noteId,parentNoteId,prefix,notePosition FROM branches WHERE isDeleted=0 ORDER BY noteId,parentNoteId,prefix,notePosition').all()){
   const list=branches.get(b.noteId)||[];list.push([b.parentNoteId,b.prefix,b.notePosition]);branches.set(b.noteId,list);
  }
  for(const n of db.prepare('SELECT noteId,title,type,mime,isProtected,blobId FROM notes WHERE isDeleted=0 ORDER BY noteId').iterate()){
   const meta={title:n.title,type:n.type,mime:n.mime,isProtected:n.isProtected,attributes:attributes.get(n.noteId)||[],branches:branches.get(n.noteId)||[],attachments:attachments.get(n.noteId)||[]};
   notes.set(n.noteId,{...meta,signature:hash(json([meta,blobHash(n.blobId)]))});
  }
  const settings=db.prepare('SELECT name,value,isSynced FROM options ORDER BY name').all().filter(o=>!LOCAL_OPTIONS.has(o.name)&&!/^last|^sync|^backup|^window|^zoom|^electron|^recent/i.test(o.name));
  return {notes,settings,settingsHash:hash(json(settings)),signature:hash(json([[...notes].map(([id,n])=>[id,n.signature]),settings]))};
 })();
}
function changes(local,remote){
 const list=[];
 for(const id of new Set([...local.notes.keys(),...remote.notes.keys()])){
  const a=local.notes.get(id),b=remote.notes.get(id);if(a?.signature===b?.signature)continue;
  list.push({id,title:a?.title||b?.title,kind:!b?'added':!a?'deleted':'modified',type:a?.type||b?.type});
 }
 if((local.settingsHash||hash(json(local.settings)))!==(remote.settingsHash||hash(json(remote.settings))))list.push({id:'@settings',title:'应用设置（敏感值不预览）',kind:'modified',type:'settings'});
 return list.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
}
class SyncEngine{
 constructor(options){Object.assign(this,options);this.dir=path.resolve(options.storeDir);this.planDir=path.join(this.dir,'plan');fs.mkdirSync(this.planDir,{recursive:true});}
 read(file,fallback){try{return JSON.parse(fs.readFileSync(path.join(this.dir,file),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error('本地同步配置损坏，请先检查 '+file);}}
 write(file,value){const target=path.join(this.dir,file),temp=target+'.tmp';fs.writeFileSync(temp,json(value),{mode:0o600});fs.renameSync(temp,target);}
 progress(phase,done=0,total=0){this.write('progress.json',{running:true,phase,done,total});}
 pendingRestore(){const job=this.read('restore-job.json',null),last=this.read('last-result.json',null);return !!(job?.pid===process.pid&&Date.now()-job.createdAt<3600000&&!(last?.action==='restore'&&Date.parse(last.time)>=job.createdAt));}
 recoverLock(){const file=path.join(this.dir,'operation.lock');if(!fs.existsSync(file))return;const previous=this.read('operation.lock',null);if(previous?.pid){try{process.kill(previous.pid,0);}catch{fs.unlinkSync(file);}}}
 config(){return this.runningConfig||{version:1,repository:'',dbPath:this.activeDbPath,autoSync:false,...this.read('config.json',{})};}
 repository(value){const match=String(value||'').trim().match(/^(?:https:\/\/github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);if(!match)throw Error('请输入 GitHub 仓库地址或 owner/repository');return match[1]+'/'+match[2];}
 database(file){const db=new this.Database(file,{readonly:true,fileMustExist:true});try{db.pragma('trusted_schema = OFF');for(const table of ['notes','blobs','attributes','branches','attachments','options'])if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))throw Error('不是 Trilium 数据库');return db;}catch(e){db.close();throw e;}}
 async token(){
  if(this.testToken)return this.testToken;
  const bundled=path.join(path.dirname(process.execPath),'myosotis-tools','gh.exe');
  const command=this.ghPath|| (fs.existsSync(bundled)?bundled:null);
  try{const args=command?['auth','token']:process.platform==='win32'?['/d','/s','/c','gh auth token']:['auth','token'];const file=command||(process.platform==='win32'?'cmd.exe':'gh');const {stdout}=await util.promisify(cp.execFile)(file,args,{windowsHide:true,timeout:15000,maxBuffer:65536});if(!stdout.trim())throw Error();return stdout.trim();}
  catch{throw Error('尚未登录 GitHub。请使用随包工具或终端运行 gh auth login；不用向插件粘贴密钥。');}
 }
 async request(method,suffix,body,allow404=false){
  // Pace content-generating requests below GitHub's secondary burst limit.
  // Synthetic test transports use testToken and never contact GitHub.
  if(method!=='GET'&&!this.testToken){const now=Date.now(),wait=Math.max(0,(this.nextWriteAt||0)-now);this.nextWriteAt=Math.max(now,this.nextWriteAt||0)+800;if(wait)await new Promise(resolve=>setTimeout(resolve,wait));}
  const response=await (this.fetch||fetch)('https://api.github.com/repos/'+this.repository(this.config().repository)+suffix,{method,headers:{Authorization:'Bearer '+this.auth,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body===undefined?undefined:json(body),signal:AbortSignal.timeout(120000)});
  if(allow404&&(response.status===404||response.status===409&&method==='GET'&&suffix.startsWith('/git/ref/heads/')))return null;
  if(!response.ok){if(response.status===429||response.headers?.get('x-ratelimit-remaining')==='0')throw Error('GitHub 请求已限流，请稍后再检查并重试。');throw Error('GitHub 请求失败（'+response.status+'）。请检查仓库权限、网络或重新检查远端。');}
  return response.status===204?null:response.json();
 }
 async remote(){const repo=await this.request('GET','');if(!repo.private)throw Error('数据库含个人笔记和账户信息，只允许同步到私有仓库。');const branch=repo.default_branch||'main',ref=await this.request('GET','/git/ref/heads/'+encodeURIComponent(branch),undefined,true);return {branch,head:ref?.object.sha||null};}
 async manifest(remote){if(!remote.head)return null;const commit=await this.request('GET','/git/commits/'+remote.head),tree=await this.request('GET','/git/trees/'+commit.tree.sha+'?recursive=1');if(tree.truncated)throw Error('远端文件过多，无法可靠确认快照');const item=tree.tree.find(e=>e.path==='trilium-sync/v1/latest.json');if(!item)return null;const blob=await this.request('GET','/git/blobs/'+item.sha);const manifest=JSON.parse(Buffer.from(blob.content.replace(/\s/g,''),'base64').toString());if(manifest.version!==1||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<512||manifest.bytes>MAX||!Number.isSafeInteger(manifest.compressedBytes)||manifest.compressedBytes<1||manifest.compressedBytes>512*1024*1024||!Array.isArray(manifest.chunks)||!manifest.chunks.length||manifest.chunks.length>128||manifest.chunks.some(c=>!/^[a-f0-9]{40}$/.test(c.blob)||!/^[a-f0-9]{64}$/.test(c.sha256))||!/^[a-f0-9]{64}$/.test(manifest.sha256))throw Error('远端快照清单无效');return manifest;}
 validateRemote(file){
  const db=this.database(file),local=this.database(this.config().dbPath);
  try{
   if(db.pragma('quick_check',{simple:true})!=='ok')throw Error('远端数据库完整性检查失败');
   if(db.prepare("SELECT value FROM options WHERE name='dbVersion'").get()?.value!==local.prepare("SELECT value FROM options WHERE name='dbVersion'").get()?.value)throw Error('两端 Trilium 数据库版本不同，请先使用相同版本');
  }finally{db.close();local.close();}
 }
 cachedRemote(manifest){
  const file=path.join(this.planDir,'remote.db');let cached;try{cached=this.read('remote-index.json',null);}catch{return null;}
  if(!fs.existsSync(file)||!cached)return null;
  const {checksum,...data}=cached,stat=fs.statSync(file);
  if(checksum!==hash(json(data))||data.version!==1||data.sha256!==manifest.sha256||data.size!==manifest.bytes||data.size!==stat.size||data.mtime!==stat.mtimeMs)return null;
  if(!Array.isArray(data.notes)||data.notes.some(n=>!Array.isArray(n)||typeof n[0]!=='string'||!/^[a-f0-9]{64}$/.test(n[1]?.signature))||!/^[a-f0-9]{64}$/.test(data.signature)||!/^[a-f0-9]{64}$/.test(data.settingsHash))return null;
  // Schema versions are checked even when the verified snapshot/index is reused.
  const remote=this.database(file),local=this.database(this.config().dbPath);
  try{if(remote.prepare("SELECT value FROM options WHERE name='dbVersion'").get()?.value!==local.prepare("SELECT value FROM options WHERE name='dbVersion'").get()?.value)throw Error('两端 Trilium 数据库版本不同，请先使用相同版本');}finally{remote.close();local.close();}
  return {notes:new Map(data.notes),settingsHash:data.settingsHash,signature:data.signature};
 }
 cacheRemote(manifest,index){
  const stat=fs.statSync(path.join(this.planDir,'remote.db'));
  const data={version:1,sha256:manifest.sha256,size:stat.size,mtime:stat.mtimeMs,notes:[...index.notes].map(([id,n])=>[id,{title:n.title,type:n.type,signature:n.signature}]),settingsHash:index.settingsHash,signature:index.signature};
  this.write('remote-index.json',{...data,checksum:hash(json(data))});
 }
 async download(manifest){
  const objects=path.join(this.dir,'objects');fs.mkdirSync(objects,{recursive:true});let done=0;
  await parallel(manifest.chunks,3,async item=>{
   if(!/^[a-f0-9]{40}$/.test(item.blob)||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('远端分块清单无效');
   const file=path.join(objects,item.sha256),stat=fs.existsSync(file)&&fs.statSync(file);
   if(!stat||stat.size>CHUNK||await hashFile(file)!==item.sha256){
    const blob=await this.request('GET','/git/blobs/'+item.blob),data=Buffer.from(blob.content.replace(/\s/g,''),'base64');
    if(data.length>CHUNK||hash(data)!==item.sha256)throw Error('远端分块校验失败');
    const tmp=file+'.tmp-'+crypto.randomUUID();await fs.promises.writeFile(tmp,data,{mode:0o600});await fs.promises.rename(tmp,file);
    this.downloadedChunks=(this.downloadedChunks||0)+1;
   }
   this.progress('正在下载并校验远端分块',++done,manifest.chunks.length);
  });
  const files=manifest.chunks.map(item=>path.join(objects,item.sha256));
  if(files.reduce((n,f)=>n+fs.statSync(f).size,0)!==manifest.compressedBytes)throw Error('远端快照大小不匹配');
  const target=path.join(this.planDir,'remote.db'),tmp=target+'.downloading',digest=crypto.createHash('sha256');let size=0;
  const limit=new Transform({transform(bytes,encoding,callback){size+=bytes.length;if(size>manifest.bytes)return callback(Error('远端数据库大小超出清单'));digest.update(bytes);callback(null,bytes);}});
  async function* compressed(){for(const file of files)for await(const bytes of fs.createReadStream(file))yield bytes;}
  this.progress('正在解压并校验数据库');
  try{
   await pipeline(Readable.from(compressed()),zlib.createGunzip(),limit,fs.createWriteStream(tmp,{mode:0o600}));
   if(size!==manifest.bytes||digest.digest('hex')!==manifest.sha256)throw Error('远端数据库校验失败');
   this.validateRemote(tmp);for(const suffix of ['-wal','-shm'])await fs.promises.unlink(target+suffix).catch(()=>{});await fs.promises.rename(tmp,target);
  }catch(error){await fs.promises.unlink(tmp).catch(()=>{});throw error;}
 }
 async snapshot(){
  if(fs.statSync(this.config().dbPath).size>MAX)throw Error('数据库超过当前快照上限（2 GiB）。');
  const source=this.database(this.config().dbPath);let last=0;
  try{await source.backup(path.join(this.planDir,'local.db'),{progress:info=>{if(Date.now()-last>250){last=Date.now();this.progress('正在生成一致的 SQLite 快照',info.totalPages-info.remainingPages,info.totalPages);}return 1024;}});}finally{source.close();}
 }
 index(file){const db=this.database(file);try{return indexDatabase(db);}finally{db.close();}}
 async check(){
  const started=Date.now();this.downloadedChunks=0;
  this.auth=await this.token();const remote=await this.remote();
  for(const name of ['plan.json','local.db','local.db-wal','local.db-shm']){const f=path.join(this.planDir,name);if(fs.existsSync(f))fs.unlinkSync(f);}
  this.progress('正在生成一致的 SQLite 快照');await this.snapshot();const manifest=await this.manifest(remote),cached=path.join(this.planDir,'remote.db');
  let other=manifest?this.cachedRemote(manifest):null;const indexReused=!!other;
  if(manifest){
   if(other)this.progress('复用已校验的远端快照和索引');
   else if(fs.existsSync(cached)&&fs.statSync(cached).size===manifest.bytes&&await hashFile(cached)===manifest.sha256)this.validateRemote(cached);
   else{this.progress('正在下载并校验远端快照');await this.download(manifest);}
  }else if(fs.existsSync(cached))fs.unlinkSync(cached);
  this.progress('正在比较笔记、目录、附件和设置');
  const local=this.index(path.join(this.planDir,'local.db'));
  if(!other){other=manifest?this.index(cached):{notes:new Map(),settings:[]};if(manifest)this.cacheRemote(manifest,other);}
  const diff=changes(local,other);
  const plan={id:crypto.randomUUID(),createdAt:Date.now(),configHash:hash(json(this.config())),localSignature:local.signature,localCount:local.notes.size,remoteSignature:other.signature||null,remote,manifest,changes:diff,metrics:{elapsedMs:Date.now()-started,remoteIndexReused:indexReused,downloadedChunks:this.downloadedChunks}};
  fs.writeFileSync(path.join(this.planDir,'plan.json'),json(plan),{mode:0o600});
  return this.publicPlan(plan);
 }
 publicPlan(plan){return {id:plan.id,createdAt:plan.createdAt,changes:plan.changes,hasRemote:!!plan.manifest,repository:this.config().repository,localCount:plan.localCount??this.index(path.join(this.planDir,'local.db')).notes.size,remoteTime:plan.manifest?.createdAt||null,metrics:plan.metrics};}
 plan(id){let p;try{p=JSON.parse(fs.readFileSync(path.join(this.planDir,'plan.json'),'utf8'));}catch{throw Error('请先检查差异');}if(p.id!==id||Date.now()-p.createdAt>30*60*1000||p.configHash!==hash(json(this.config())))throw Error('差异预览已过期，请重新检查');return p;}
 detail(id,noteId){const p=this.plan(id);if(!p.changes.some(e=>e.id===noteId))throw Error('条目不在差异清单中');const read=file=>{if(!fs.existsSync(file))return null;const db=this.database(file);try{if(noteId==='@settings')return db.prepare('SELECT name FROM options ORDER BY name').all().map(r=>r.name).join('\n')+'\n（设置值不显示）';const n=db.prepare('SELECT n.title,n.type,n.mime,n.isProtected,b.content FROM notes n LEFT JOIN blobs b ON n.blobId=b.blobId WHERE n.noteId=? AND n.isDeleted=0').get(noteId);if(!n)return null;const meta=db.prepare('SELECT type,name,value,isInheritable FROM attributes WHERE noteId=? AND isDeleted=0 ORDER BY type,name').all(noteId);const text=n.isProtected?'（已加密，内容不预览）':n.type==='file'?'（二进制附件，保留原文件）':Buffer.isBuffer(n.content)?n.content.toString('utf8'):n.content||'';return json({title:n.title,type:n.type,mime:n.mime,attributes:meta})+'\n\n'+text.slice(0,50000)+(text.length>50000?'\n…预览截断，实际同步使用完整数据库':'');}finally{db.close();}};return {local:read(path.join(this.planDir,'local.db')),remote:read(path.join(this.planDir,'remote.db'))};}
 async confirm(id,direction){const p=this.plan(id);if(this.index(this.config().dbPath).signature!==p.localSignature)throw Error('预览后本地又有修改，请重新检查差异');this.auth=await this.token();const remote=await this.remote();if(remote.head!==p.remote.head)throw Error('远端已有新提交，请重新检查差异');if(direction==='upload')return this.upload(p);if(direction==='restore')return this.restore(p);throw Error('请选择上传或恢复');}
 async upload(p){
  let {head,branch}=p.remote;
  const local=path.join(this.planDir,'local.db'),compressedFile=local+'.gz',bytes=fs.statSync(local).size;
  if(bytes>MAX)throw Error('数据库超过当前快照上限（2 GiB）。');
  this.progress('正在压缩数据库');const digest=crypto.createHash('sha256');let compressedBytes=0;
  const input=new Transform({transform(chunk,encoding,callback){digest.update(chunk);callback(null,chunk);}});
  const limit=new Transform({transform(chunk,encoding,callback){compressedBytes+=chunk.length;if(compressedBytes>512*1024*1024)return callback(Error('压缩快照超过当前上限（512 MiB）。'));callback(null,chunk);}});
  await pipeline(fs.createReadStream(local),input,zlib.createGzip(),limit,fs.createWriteStream(compressedFile,{mode:0o600}));
  const sha256=digest.digest('hex'),chunks=[],tree=[],known=new Map((p.manifest?.chunks||[]).map(c=>[c.sha256,c.blob]));let done=0,reused=0;
  if(!head){await this.request('PUT','/contents/README.md',{message:'Initialize private Trilium snapshot storage',content:Buffer.from('# Private Trilium snapshots\n\nManaged by the Myosotis GitHub database sync plugin. Restore through its verified difference preview.\n').toString('base64'),branch});head=(await this.remote()).head;}
  const file=await fs.promises.open(compressedFile,'r'),offsets=Array.from({length:Math.ceil(compressedBytes/CHUNK)},(_,i)=>i*CHUNK);
  try{await parallel(offsets,3,async(offset,i)=>{
   const data=await readChunk(file,offset,Math.min(CHUNK,compressedBytes-offset)),chunkHash=hash(data);let blob=known.get(chunkHash);
   if(blob)reused++;else blob=(await this.request('POST','/git/blobs',{encoding:'base64',content:data.toString('base64')})).sha;
   chunks[i]={blob,sha256:chunkHash};tree[i]={path:'trilium-sync/v1/objects/'+chunkHash,mode:'100644',type:'blob',sha:blob};this.progress('正在上传或复用快照分块',++done,offsets.length);
  });}finally{await file.close();}
  this.progress('正在提交版本记录',chunks.length,chunks.length);
  const manifest={version:1,createdAt:new Date().toISOString(),bytes,compressedBytes,sha256,fingerprint:p.localSignature,chunks};
  const blob=await this.request('POST','/git/blobs',{encoding:'utf-8',content:json(manifest)});tree.push({path:'trilium-sync/v1/latest.json',mode:'100644',type:'blob',sha:blob.sha});
  const commit=await this.request('GET','/git/commits/'+head),newTree=await this.request('POST','/git/trees',{base_tree:commit.tree.sha,tree}),newCommit=await this.request('POST','/git/commits',{message:'Trilium snapshot: '+p.changes.length+' changed entries',tree:newTree.sha,parents:[head]});
  await this.request('PATCH','/git/refs/heads/'+encodeURIComponent(branch),{sha:newCommit.sha,force:false});const result={ok:true,action:'upload',commit:newCommit.sha,time:new Date().toISOString(),bytes,reusedChunks:reused,uploadedChunks:chunks.length-reused};this.write('last-result.json',result);fs.unlinkSync(path.join(this.planDir,'plan.json'));await fs.promises.unlink(compressedFile).catch(()=>{});return result;
 }
 restore(p){
  if(!p.manifest)throw Error('远端还没有数据库快照');if(path.resolve(this.config().dbPath).toLowerCase()!==path.resolve(this.activeDbPath).toLowerCase())throw Error('请在目标数据库对应的 Trilium 实例中执行恢复');
  const python=this.pythonPath||path.join(path.dirname(process.execPath),'myosotis-tools','python','python.exe');if(!fs.existsSync(python))throw Error('尚未安装随包恢复助手，请重新运行插件安装器。');
  const worker=path.join(this.dir,'restore-worker.py');fs.writeFileSync(worker,this.workerSource);
  const job={version:1,pid:process.pid,dbPath:this.activeDbPath,source:path.join(this.planDir,'remote.db'),sha256:p.manifest.sha256,localSignature:p.localSignature,execPath:process.execPath,modulePath:this.modulePath,createdAt:Date.now()};this.write('restore-job.json',job);
  const child=cp.spawn(python,[worker,path.join(this.dir,'restore-job.json')],{cwd:path.dirname(process.execPath),env:{...process.env},detached:true,stdio:'ignore',windowsHide:true});child.once('error',()=>this.write('last-result.json',{ok:false,action:'restore',message:'恢复助手启动失败，请重新安装后重试。'}));child.unref();return {ok:true,action:'restore',closeRequired:true,message:'已安排恢复。请正常关闭 Trilium；退出后核验、备份并恢复，再自动重新打开。若关闭前再次修改笔记，将取消恢复。'};
 }
 async handle(action,payload={}){
  if(action==='load')return {config:this.config(),activeDbPath:this.activeDbPath,lastResult:this.read('last-result.json',null),progress:this.read('progress.json',null)};
  if(action==='saveConfig'){this.recoverLock();if(fs.existsSync(path.join(this.dir,'operation.lock')))throw Error('同步运行中，暂时不能修改仓库或数据库位置');const old=this.config(),next={version:1,repository:this.repository(payload.repository),dbPath:path.resolve(String(payload.dbPath||this.activeDbPath)),autoSync:!!payload.autoSync};const db=this.database(next.dbPath);db.close();if(json(old)!==json(next))this.write('config.json',next);return {config:next};}
  if(action==='detail')return this.detail(payload.planId,payload.noteId);
  if(!['check','confirm'].includes(action))throw Error('不支持的同步操作');
  if(this.pendingRestore())throw Error('已确认恢复，请先正常退出 Trilium 完成恢复；暂时不能重建或覆盖恢复快照。');
  const lock=path.join(this.dir,'operation.lock');let fd;
  this.recoverLock();
  try{fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,json({pid:process.pid,createdAt:Date.now(),jobId:this.operationId||null}));}catch{throw Error('已有同步操作正在执行，请等待完成后再试。');}
  this.runningConfig=this.config();
  try{this.progress('正在核对 GitHub 私有仓库');return action==='check'?await this.check():await this.confirm(payload.planId,payload.direction);}finally{delete this.runningConfig;const current=this.read('progress.json',{});this.write('progress.json',{...current,running:false});fs.closeSync(fd);fs.unlinkSync(lock);}
 }
}
module.exports={SyncEngine,indexDatabase,changes,hash};
