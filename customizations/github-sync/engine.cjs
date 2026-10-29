// GitHub stores immutable, compressed SQLite snapshots. No live DB replacement or Git execution.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),util=require('node:util'),cp=require('node:child_process');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),json=value=>JSON.stringify(value),CHUNK=4*1024*1024,MAX=2*1024*1024*1024;
const LOCAL_OPTIONS=new Set(['openNoteContexts','documentId','documentSecret','instanceId','lastSyncedPush','lastSyncedPull','lastDailyBackupDate','lastWeeklyBackupDate','lastMonthlyBackupDate','rightPaneWidth','leftPaneWidth','rightPaneVisible','leftPaneVisible','rightPaneSelectedTab']);
function indexDatabase(db){
 return db.transaction(()=>{
  const notes=new Map(),attachments=new Map();
  for(const a of db.prepare('SELECT a.ownerId,a.title,a.mime,a.position,a.role,a.isProtected,b.content FROM attachments a LEFT JOIN blobs b ON b.blobId=a.blobId WHERE a.isDeleted=0 ORDER BY a.attachmentId').iterate()){
   const list=attachments.get(a.ownerId)||[];list.push([a.title,a.mime,a.position,a.role,a.isProtected,hash(a.content||'')]);attachments.set(a.ownerId,list);
  }
  const attributes=new Map(),branches=new Map();
  for(const a of db.prepare('SELECT noteId,type,name,value,isInheritable,position FROM attributes WHERE isDeleted=0 ORDER BY noteId,type,name,value,position').all()){
   const list=attributes.get(a.noteId)||[];list.push([a.type,a.name,a.value,a.isInheritable,a.position]);attributes.set(a.noteId,list);
  }
  for(const b of db.prepare('SELECT noteId,parentNoteId,prefix,notePosition FROM branches WHERE isDeleted=0 ORDER BY noteId,parentNoteId,prefix,notePosition').all()){
   const list=branches.get(b.noteId)||[];list.push([b.parentNoteId,b.prefix,b.notePosition]);branches.set(b.noteId,list);
  }
  for(const n of db.prepare('SELECT n.noteId,n.title,n.type,n.mime,n.isProtected,b.content FROM notes n LEFT JOIN blobs b ON b.blobId=n.blobId WHERE n.isDeleted=0 ORDER BY n.noteId').iterate()){
   const meta={title:n.title,type:n.type,mime:n.mime,isProtected:n.isProtected,attributes:attributes.get(n.noteId)||[],branches:branches.get(n.noteId)||[],attachments:attachments.get(n.noteId)||[]};
   notes.set(n.noteId,{...meta,signature:hash(json([meta,hash(n.content||'')]))});
  }
  const settings=db.prepare('SELECT name,value,isSynced FROM options ORDER BY name').all().filter(o=>!LOCAL_OPTIONS.has(o.name)&&!/^last|^sync|^backup|^window|^zoom|^electron|^recent/i.test(o.name));
  return {notes,settings,signature:hash(json([[...notes].map(([id,n])=>[id,n.signature]),settings]))};
 })();
}
function changes(local,remote){
 const list=[];
 for(const id of new Set([...local.notes.keys(),...remote.notes.keys()])){
  const a=local.notes.get(id),b=remote.notes.get(id);if(a?.signature===b?.signature)continue;
  list.push({id,title:a?.title||b?.title,kind:!b?'added':!a?'deleted':'modified',type:a?.type||b?.type});
 }
 if(hash(json(local.settings))!==hash(json(remote.settings)))list.push({id:'@settings',title:'应用设置（敏感值不预览）',kind:'modified',type:'settings'});
 return list.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
}
class SyncEngine{
 constructor(options){Object.assign(this,options);this.dir=path.resolve(options.storeDir);this.planDir=path.join(this.dir,'plan');fs.mkdirSync(this.planDir,{recursive:true});}
 read(file,fallback){try{return JSON.parse(fs.readFileSync(path.join(this.dir,file),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error('本地同步配置损坏，请先检查 '+file);}}
 write(file,value){const target=path.join(this.dir,file),temp=target+'.tmp';fs.writeFileSync(temp,json(value),{mode:0o600});fs.renameSync(temp,target);}
 progress(phase,done=0,total=0){this.write('progress.json',{running:true,phase,done,total});}
 config(){return {version:1,repository:'',dbPath:this.activeDbPath,autoSync:false,...this.read('config.json',{})};}
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
  const response=await (this.fetch||fetch)('https://api.github.com/repos/'+this.repository(this.config().repository)+suffix,{method,headers:{Authorization:'Bearer '+this.auth,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body===undefined?undefined:json(body),signal:AbortSignal.timeout(120000)});
  if(allow404&&(response.status===404||response.status===409&&method==='GET'&&suffix.startsWith('/git/ref/heads/')))return null;
  if(!response.ok)throw Error('GitHub 请求失败（'+response.status+'）。请检查仓库权限、网络或重新检查远端。');
  return response.status===204?null:response.json();
 }
 async remote(){const repo=await this.request('GET','');if(!repo.private)throw Error('数据库含个人笔记和账户信息，只允许同步到私有仓库。');const branch=repo.default_branch||'main',ref=await this.request('GET','/git/ref/heads/'+encodeURIComponent(branch),undefined,true);return {branch,head:ref?.object.sha||null};}
 async manifest(remote){if(!remote.head)return null;const commit=await this.request('GET','/git/commits/'+remote.head),tree=await this.request('GET','/git/trees/'+commit.tree.sha+'?recursive=1');if(tree.truncated)throw Error('远端文件过多，无法可靠确认快照');const item=tree.tree.find(e=>e.path==='trilium-sync/v1/latest.json');if(!item)return null;const blob=await this.request('GET','/git/blobs/'+item.sha);const manifest=JSON.parse(Buffer.from(blob.content.replace(/\s/g,''),'base64').toString());if(manifest.version!==1||!Number.isSafeInteger(manifest.bytes)||manifest.bytes<512||manifest.bytes>MAX||!Number.isSafeInteger(manifest.compressedBytes)||manifest.compressedBytes>512*1024*1024||!Array.isArray(manifest.chunks)||!manifest.chunks.length||manifest.chunks.length>128||!/^[a-f0-9]{64}$/.test(manifest.sha256))throw Error('远端快照清单无效');return manifest;}
 async download(manifest){const chunks=[];let size=0;for(const item of manifest.chunks){if(!/^[a-f0-9]{40}$/.test(item.blob)||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('远端分块清单无效');const blob=await this.request('GET','/git/blobs/'+item.blob),data=Buffer.from(blob.content.replace(/\s/g,''),'base64');size+=data.length;if(data.length>CHUNK||size>manifest.compressedBytes||hash(data)!==item.sha256)throw Error('远端分块校验失败');chunks.push(data);}if(size!==manifest.compressedBytes)throw Error('远端快照大小不匹配');const data=await util.promisify(zlib.gunzip)(Buffer.concat(chunks),{maxOutputLength:manifest.bytes});if(data.length!==manifest.bytes||hash(data)!==manifest.sha256)throw Error('远端数据库校验失败');const target=path.join(this.planDir,'remote.db');fs.writeFileSync(target,data,{mode:0o600});const db=this.database(target);try{if(db.pragma('quick_check',{simple:true})!=='ok')throw Error('远端数据库完整性检查失败');const sourceVersion=db.prepare("SELECT value FROM options WHERE name='dbVersion'").get()?.value;const local=this.database(this.config().dbPath);try{if(sourceVersion!==local.prepare("SELECT value FROM options WHERE name='dbVersion'").get()?.value)throw Error('两端 Trilium 数据库版本不同，请先使用相同版本');}finally{local.close();}}finally{db.close();}}
 async snapshot(){const source=this.database(this.config().dbPath);try{await source.backup(path.join(this.planDir,'local.db'));}finally{source.close();}}
 index(file){const db=this.database(file);try{return indexDatabase(db);}finally{db.close();}}
 async check(){
  this.auth=await this.token();const remote=await this.remote();
  for(const name of ['plan.json','local.db']){const f=path.join(this.planDir,name);if(fs.existsSync(f))fs.unlinkSync(f);}
  this.progress('正在生成一致的 SQLite 快照');await this.snapshot();const manifest=await this.manifest(remote),cached=path.join(this.planDir,'remote.db');
  if(manifest){
   if(fs.existsSync(cached)&&fs.statSync(cached).size===manifest.bytes&&hash(fs.readFileSync(cached))===manifest.sha256){
    this.progress('使用已校验的本机远端快照缓存');const a=this.database(cached),b=this.database(this.config().dbPath);
    try{if(a.prepare("SELECT value FROM options WHERE name='dbVersion'").get()?.value!==b.prepare("SELECT value FROM options WHERE name='dbVersion'").get()?.value)throw Error('两端 Trilium 数据库版本不同，请先使用相同版本');}finally{a.close();b.close();}
   }else{this.progress('正在下载并校验远端快照');await this.download(manifest);}
  }else if(fs.existsSync(cached))fs.unlinkSync(cached);
  this.progress('正在比较笔记、目录、附件和设置');
  const local=this.index(path.join(this.planDir,'local.db')),other=manifest?this.index(path.join(this.planDir,'remote.db')):{notes:new Map(),settings:[]},diff=changes(local,other);
  const plan={id:crypto.randomUUID(),createdAt:Date.now(),configHash:hash(json(this.config())),localSignature:local.signature,localCount:local.notes.size,remoteSignature:other.signature||null,remote,manifest,changes:diff};
  fs.writeFileSync(path.join(this.planDir,'plan.json'),json(plan),{mode:0o600});
  return this.publicPlan(plan);
 }
 publicPlan(plan){return {id:plan.id,createdAt:plan.createdAt,changes:plan.changes,hasRemote:!!plan.manifest,repository:this.config().repository,localCount:plan.localCount??this.index(path.join(this.planDir,'local.db')).notes.size,remoteTime:plan.manifest?.createdAt||null};}
 plan(id){let p;try{p=JSON.parse(fs.readFileSync(path.join(this.planDir,'plan.json'),'utf8'));}catch{throw Error('请先检查差异');}if(p.id!==id||Date.now()-p.createdAt>30*60*1000||p.configHash!==hash(json(this.config())))throw Error('差异预览已过期，请重新检查');return p;}
 detail(id,noteId){const p=this.plan(id);if(!p.changes.some(e=>e.id===noteId))throw Error('条目不在差异清单中');const read=file=>{if(!fs.existsSync(file))return null;const db=this.database(file);try{if(noteId==='@settings')return db.prepare('SELECT name FROM options ORDER BY name').all().map(r=>r.name).join('\n')+'\n（设置值不显示）';const n=db.prepare('SELECT n.title,n.type,n.mime,n.isProtected,b.content FROM notes n LEFT JOIN blobs b ON n.blobId=b.blobId WHERE n.noteId=? AND n.isDeleted=0').get(noteId);if(!n)return null;const meta=db.prepare('SELECT type,name,value,isInheritable FROM attributes WHERE noteId=? AND isDeleted=0 ORDER BY type,name').all(noteId);const text=n.isProtected?'（已加密，内容不预览）':n.type==='file'?'（二进制附件，保留原文件）':Buffer.isBuffer(n.content)?n.content.toString('utf8'):n.content||'';return json({title:n.title,type:n.type,mime:n.mime,attributes:meta})+'\n\n'+text.slice(0,50000)+(text.length>50000?'\n…预览截断，实际同步使用完整数据库':'');}finally{db.close();}};return {local:read(path.join(this.planDir,'local.db')),remote:read(path.join(this.planDir,'remote.db'))};}
 async confirm(id,direction){const p=this.plan(id);if(this.index(this.config().dbPath).signature!==p.localSignature)throw Error('预览后本地又有修改，请重新检查差异');this.auth=await this.token();const remote=await this.remote();if(remote.head!==p.remote.head)throw Error('远端已有新提交，请重新检查差异');if(direction==='upload')return this.upload(p);if(direction==='restore')return this.restore(p);throw Error('请选择上传或恢复');}
 async upload(p){
  let {head,branch}=p.remote;
  if(!head){await this.request('PUT','/contents/README.md',{message:'Initialize private Trilium snapshot storage',content:Buffer.from('# Private Trilium snapshots\n\nManaged by the Myosotis GitHub database sync plugin. Restore through its verified difference preview.\n').toString('base64'),branch});head=(await this.remote()).head;}
  const raw=fs.readFileSync(path.join(this.planDir,'local.db'));if(raw.length>MAX)throw Error('数据库超过当前快照上限（2 GiB）。');
  const compressed=await util.promisify(zlib.gzip)(raw),chunks=[],tree=[];if(compressed.length>512*1024*1024)throw Error('压缩快照超过当前上限（512 MiB）。');
  for(let offset=0;offset<compressed.length;offset+=CHUNK){this.progress('正在上传快照分块',Math.floor(offset/CHUNK),Math.ceil(compressed.length/CHUNK));const data=compressed.subarray(offset,offset+CHUNK),sha256=hash(data),blob=await this.request('POST','/git/blobs',{encoding:'base64',content:data.toString('base64')});chunks.push({blob:blob.sha,sha256});tree.push({path:'trilium-sync/v1/objects/'+sha256,mode:'100644',type:'blob',sha:blob.sha});}
  this.progress('正在提交版本记录',chunks.length,chunks.length);
  const manifest={version:1,createdAt:new Date().toISOString(),bytes:raw.length,compressedBytes:compressed.length,sha256:hash(raw),fingerprint:p.localSignature,chunks};
  const blob=await this.request('POST','/git/blobs',{encoding:'utf-8',content:json(manifest)});tree.push({path:'trilium-sync/v1/latest.json',mode:'100644',type:'blob',sha:blob.sha});
  const commit=await this.request('GET','/git/commits/'+head),newTree=await this.request('POST','/git/trees',{base_tree:commit.tree.sha,tree}),newCommit=await this.request('POST','/git/commits',{message:'Trilium snapshot: '+p.changes.length+' changed entries',tree:newTree.sha,parents:[head]});
  await this.request('PATCH','/git/refs/heads/'+encodeURIComponent(branch),{sha:newCommit.sha,force:false});const result={ok:true,action:'upload',commit:newCommit.sha,time:new Date().toISOString(),bytes:raw.length};this.write('last-result.json',result);fs.unlinkSync(path.join(this.planDir,'plan.json'));return result;
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
  if(action==='saveConfig'){const old=this.config(),next={version:1,repository:this.repository(payload.repository),dbPath:path.resolve(String(payload.dbPath||this.activeDbPath)),autoSync:!!payload.autoSync};const db=this.database(next.dbPath);db.close();this.write('config.json',next);return {config:next};}
  if(action==='detail')return this.detail(payload.planId,payload.noteId);
  if(!['check','confirm'].includes(action))throw Error('不支持的同步操作');
  const lock=path.join(this.dir,'operation.lock');let fd;
  if(fs.existsSync(lock)){let previous;try{previous=JSON.parse(fs.readFileSync(lock,'utf8'));}catch{}if(previous?.pid){let alive=true;try{process.kill(previous.pid,0);}catch{alive=false;}if(!alive)fs.unlinkSync(lock);}}
  try{fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,json({pid:process.pid,createdAt:Date.now()}));}catch{throw Error('已有同步操作正在执行，请等待完成后再试。');}
  try{this.progress('正在核对 GitHub 私有仓库');return action==='check'?await this.check():await this.confirm(payload.planId,payload.direction);}finally{const current=this.read('progress.json',{});this.write('progress.json',{...current,running:false});fs.closeSync(fd);fs.unlinkSync(lock);}
 }
}
module.exports={SyncEngine,indexDatabase,changes,hash};
