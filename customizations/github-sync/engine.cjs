// GitHub stores immutable compressed SQLite blocks; complete versions reuse unchanged blocks.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),util=require('node:util'),cp=require('node:child_process');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),json=value=>JSON.stringify(value),CHUNK=4*1024*1024,MAX=2*1024*1024*1024;
const BLOCK=1024*1024,TREE_BATCH=4*1024*1024;
const gitBlobHash=text=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(text)).update(Buffer.from([0])).update(text).digest('hex');
function validateManifest(m,legacyOnly=false){
 const fail=()=>{throw Error('远端快照清单无效或格式不兼容，请更新同步插件');};
 if(!m||!Number.isSafeInteger(m.bytes)||m.bytes<512||m.bytes>MAX||!/^[a-f0-9]{64}$/.test(m.sha256)||!Array.isArray(m.chunks))fail();
 if(m.version===1){
  if(!Number.isSafeInteger(m.compressedBytes)||m.compressedBytes<1||m.compressedBytes>512*1024*1024||!m.chunks.length||m.chunks.length>128||m.chunks.some(c=>!c||!/^[a-f0-9]{40}$/.test(c.blob)||!/^[a-f0-9]{64}$/.test(c.sha256)))fail();
 }else if(m.version===2&&!legacyOnly){
  if(m.blockSize!==BLOCK||m.chunks.length!==Math.ceil(m.bytes/BLOCK))fail();
  if(m.base)validateManifest(m.base,true);
  for(let i=0;i<m.chunks.length;i++){
   const c=m.chunks[i],size=Math.min(BLOCK,m.bytes-i*BLOCK);
   if(!c||!/^[a-f0-9]{64}$/.test(c.sha256)||c.bytes!==size)fail();
   if(c.blob){if(!/^[a-f0-9]{40}$/.test(c.blob)||!Number.isSafeInteger(c.compressedBytes)||c.compressedBytes<1||c.compressedBytes>BLOCK+65536||c.baseOffset!==undefined)fail();}
   else if(!m.base||!Number.isSafeInteger(c.baseOffset)||c.baseOffset<0||c.baseOffset%BLOCK!==0||c.baseOffset+c.bytes>m.base.bytes)fail();
  }
 }else fail();
 return m;
}
const {pipeline}=require('node:stream/promises'),{Readable,Transform}=require('node:stream');
async function hashFile(file){const digest=crypto.createHash('sha256');for await(const bytes of fs.createReadStream(file,{highWaterMark:1024*1024}))digest.update(bytes);return digest.digest('hex');}
async function readChunk(file,offset,size){const data=Buffer.alloc(size);let read=0;while(read<size){const result=await file.read(data,read,size-read,offset+read);if(!result.bytesRead)throw Error('压缩快照读取不完整');read+=result.bytesRead;}return data;}
async function blockIndex(file){const input=await fs.promises.open(file,'r'),bytes=(await input.stat()).size,blocks=new Map(),digest=crypto.createHash('sha256');try{for(let offset=0;offset<bytes;offset+=BLOCK){const raw=await readChunk(input,offset,Math.min(BLOCK,bytes-offset));digest.update(raw);blocks.set(hash(raw),{offset,bytes:raw.length});}}finally{await input.close();}return {blocks,bytes,sha256:digest.digest('hex')};}
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
 async manifest(remote){
  if(!remote.head)return null;
  const commit=await this.request('GET','/git/commits/'+remote.head),parts=['trilium-sync','v1','latest.json'];let sha=commit.tree.sha,item;
  for(let i=0;i<parts.length;i++){
   const tree=await this.request('GET','/git/trees/'+sha);if(tree.truncated)throw Error('远端目录过大，无法可靠确认同步清单');
   // Also accept flat trees from the local protocol test transport.
   item=tree.tree.find(e=>e.path===parts.join('/'))||tree.tree.find(e=>e.path===parts[i]);if(!item)return null;
   if(item.path===parts.join('/')||i===parts.length-1)break;
   if(item.type!=='tree')throw Error('远端同步目录无效');sha=item.sha;
  }
  const blob=await this.request('GET','/git/blobs/'+item.sha);
  return validateManifest(JSON.parse(Buffer.from(blob.content.replace(/\s/g,''),'base64').toString()));
 }
 validateRemote(file,checkVersion=true){
  const db=this.database(file),local=checkVersion?this.database(this.config().dbPath):null;
  try{
   if(db.pragma('quick_check',{simple:true})!=='ok')throw Error('远端数据库完整性检查失败');
   if(checkVersion&&db.prepare("SELECT value FROM options WHERE name='dbVersion'").get()?.value!==local.prepare("SELECT value FROM options WHERE name='dbVersion'").get()?.value)throw Error('两端 Trilium 数据库版本不同，请先使用相同版本');
  }finally{db.close();local?.close();}
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
 async download(manifest){return manifest.version===2?this.downloadIncremental(manifest):this.downloadLegacy(manifest);}
 async downloadLegacy(manifest,target=path.join(this.planDir,'remote.db'),checkVersion=true){
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
  const tmp=target+'.downloading',digest=crypto.createHash('sha256');let size=0;
  const limit=new Transform({transform(bytes,encoding,callback){size+=bytes.length;if(size>manifest.bytes)return callback(Error('远端数据库大小超出清单'));digest.update(bytes);callback(null,bytes);}});
  async function* compressed(){for(const file of files)for await(const bytes of fs.createReadStream(file))yield bytes;}
  this.progress('正在解压并校验数据库');
  try{
   await pipeline(Readable.from(compressed()),zlib.createGunzip(),limit,fs.createWriteStream(tmp,{mode:0o600}));
   if(size!==manifest.bytes||digest.digest('hex')!==manifest.sha256)throw Error('远端数据库校验失败');
   this.validateRemote(tmp,checkVersion);for(const suffix of ['-wal','-shm'])await fs.promises.unlink(target+suffix).catch(()=>{});await fs.promises.rename(tmp,target);
  }catch(error){await fs.promises.unlink(tmp).catch(()=>{});throw error;}
 }
 async legacyBase(manifest){
  const dir=path.join(this.dir,'bases');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,manifest.sha256+'.db');
  if(fs.existsSync(file)&&fs.statSync(file).size===manifest.bytes&&await hashFile(file)===manifest.sha256)return file;
  const current=path.join(this.planDir,'remote.db');
  if(fs.existsSync(current)&&fs.statSync(current).size===manifest.bytes&&await hashFile(current)===manifest.sha256){
   const tmp=file+'.copying';await fs.promises.copyFile(current,tmp);if(await hashFile(tmp)!==manifest.sha256)throw Error('旧版基线复制校验失败');await fs.promises.rename(tmp,file);
  }else await this.downloadLegacy(manifest,file,false);
  return file;
 }
 async downloadIncremental(manifest){
  const target=path.join(this.planDir,'remote.db');
  const previous=fs.existsSync(target)?await blockIndex(target):{blocks:new Map()};
  const baseFile=manifest.chunks.some(c=>!c.blob&&!previous.blocks.has(c.sha256))?await this.legacyBase(manifest.base):null;
  const objects=path.join(this.dir,'objects-v2');fs.mkdirSync(objects,{recursive:true});
  const unique=[...new Map(manifest.chunks.filter(c=>c.blob&&!previous.blocks.has(c.sha256)).map(c=>[c.sha256,c])).values()];let done=0;
  await parallel(unique,3,async c=>{
   const file=path.join(objects,c.sha256+'.raw');
   if(!fs.existsSync(file)||fs.statSync(file).size!==c.bytes||await hashFile(file)!==c.sha256){
    const blob=await this.request('GET','/git/blobs/'+c.blob),text=Buffer.from(blob.content.replace(/\s/g,''),'base64').toString('ascii');
    if(text.length>2*(BLOCK+65536)||! /^[A-Za-z0-9+/]+={0,2}$/.test(text))throw Error('远端增量块编码无效');
    const compressed=Buffer.from(text,'base64');if(compressed.length!==c.compressedBytes)throw Error('远端增量块大小不匹配');
    const raw=await util.promisify(zlib.gunzip)(compressed,{maxOutputLength:c.bytes});
    if(raw.length!==c.bytes||hash(raw)!==c.sha256)throw Error('远端增量块校验失败');
    const tmp=file+'.tmp-'+crypto.randomUUID();await fs.promises.writeFile(tmp,raw,{mode:0o600});await fs.promises.rename(tmp,file);this.downloadedChunks=(this.downloadedChunks||0)+1;
   }
   this.progress('正在下载变化的数据块',++done,unique.length);
  });
  const tmp=target+'.downloading',digest=crypto.createHash('sha256');let size=0;
  const base=baseFile?await fs.promises.open(baseFile,'r'):null;
  let old=fs.existsSync(target)?await fs.promises.open(target,'r'):null;
  async function* blocks(){for(const c of manifest.chunks){const known=previous.blocks.get(c.sha256);const data=known&&known.bytes===c.bytes?await readChunk(old,known.offset,c.bytes):c.blob?await fs.promises.readFile(path.join(objects,c.sha256+'.raw')):await readChunk(base,c.baseOffset,c.bytes);if(data.length!==c.bytes||hash(data)!==c.sha256)throw Error('增量数据块校验失败');yield data;}}
  const verify=new Transform({transform(data,encoding,callback){size+=data.length;digest.update(data);callback(null,data);}});
  this.progress('正在组装并校验增量版本');
  try{
   await pipeline(Readable.from(blocks()),verify,fs.createWriteStream(tmp,{mode:0o600}));
   if(size!==manifest.bytes||digest.digest('hex')!==manifest.sha256)throw Error('增量数据库完整校验失败');
   this.validateRemote(tmp);await old?.close();old=null;for(const suffix of ['-wal','-shm'])await fs.promises.unlink(target+suffix).catch(()=>{});await fs.promises.rename(tmp,target);
  }catch(error){await fs.promises.unlink(tmp).catch(()=>{});throw error;}
  finally{await base?.close();await old?.close();}
 }
 async prepareIncremental(previous){
  this.progress('正在计算增量数据块');
  const stage=path.join(this.planDir,'delta');fs.mkdirSync(stage,{recursive:true});
  for(const entry of fs.readdirSync(stage,{withFileTypes:true}))if(entry.isFile()&&/^[a-f0-9]{64}\.gz64$/.test(entry.name))fs.unlinkSync(path.join(stage,entry.name));
  let base=previous?.version===1?previous:previous?.base||null,known=new Map();
  if(previous?.version===1){
   const old=await blockIndex(path.join(this.planDir,'remote.db'));
   if(old.sha256!==previous.sha256){fs.rmSync(path.join(this.dir,'remote-index.json'),{force:true});throw Error('远端暂存数据已变化，请重新检查差异');}
   known=new Map([...old.blocks].map(([sha,p])=>[sha,{sha256:sha,bytes:p.bytes,baseOffset:p.offset}]));
  }else if(previous)known=new Map(previous.chunks.map(c=>[c.sha256,c]));
  const input=await fs.promises.open(path.join(this.planDir,'local.db'),'r'),bytes=(await input.stat()).size,digest=crypto.createHash('sha256'),chunks=[],objects=new Map();let uploadBytes=0,compressedBytes=0,reused=0,last=0;
  try{for(let offset=0;offset<bytes;offset+=BLOCK){
   const raw=await readChunk(input,offset,Math.min(BLOCK,bytes-offset));digest.update(raw);const sha256=hash(raw),old=known.get(sha256);
   if(old&&old.bytes===raw.length){chunks.push({...old});reused++;}
   else if(objects.has(sha256))chunks.push({...objects.get(sha256).chunk});
   else{
    const compressed=await util.promisify(zlib.gzip)(raw),text=compressed.toString('base64'),blob=gitBlobHash(text),chunk={sha256,bytes:raw.length,blob,compressedBytes:compressed.length};
    compressedBytes+=compressed.length;if(compressedBytes>512*1024*1024)throw Error('本次新增压缩数据超过 512 MiB 上限');
    await fs.promises.writeFile(path.join(stage,sha256+'.gz64'),text,{mode:0o600});objects.set(sha256,{chunk,textBytes:text.length});chunks.push(chunk);uploadBytes+=text.length;
   }
   if(Date.now()-last>250){last=Date.now();this.progress('正在准备变化的数据块',chunks.length,Math.ceil(bytes/BLOCK));}
  }}finally{await input.close();}
  if(chunks.every(c=>c.blob))base=null;
  const manifest={version:2,blockSize:BLOCK,bytes,sha256:digest.digest('hex'),fingerprint:null,chunks,...(base?{base}:{})};
  validateManifest(manifest);
  return {nextManifest:manifest,newObjects:[...objects.values()].map(o=>o.chunk),transfer:{format:'incremental-v2',totalBlocks:chunks.length,reusedBlocks:reused,uploadObjects:objects.size,uploadBytes,manifestBytes:Buffer.byteLength(json(manifest)),databaseBytes:bytes,migrating:previous?.version===1}};
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
  const delta=diff.length?await this.prepareIncremental(manifest):{transfer:{format:'incremental-v2',uploadObjects:0,uploadBytes:0,manifestBytes:0,databaseBytes:fs.statSync(path.join(this.planDir,'local.db')).size}};
  const plan={id:crypto.randomUUID(),createdAt:Date.now(),configHash:hash(json(this.config())),localSignature:local.signature,localCount:local.notes.size,remoteSignature:other.signature||null,remote,manifest,changes:diff,...delta,metrics:{elapsedMs:Date.now()-started,remoteIndexReused:indexReused,downloadedChunks:this.downloadedChunks}};
  fs.writeFileSync(path.join(this.planDir,'plan.json'),json(plan),{mode:0o600});
  return this.publicPlan(plan);
 }
 publicPlan(plan){return {id:plan.id,createdAt:plan.createdAt,changes:plan.changes,hasRemote:!!plan.manifest,repository:this.config().repository,localCount:plan.localCount??this.index(path.join(this.planDir,'local.db')).notes.size,remoteTime:plan.manifest?.createdAt||null,metrics:plan.metrics,transfer:plan.transfer};}
 plan(id){let p;try{p=JSON.parse(fs.readFileSync(path.join(this.planDir,'plan.json'),'utf8'));}catch{throw Error('请先检查差异');}if(p.id!==id||Date.now()-p.createdAt>30*60*1000||p.configHash!==hash(json(this.config())))throw Error('差异预览已过期，请重新检查');return p;}
 detail(id,noteId){const p=this.plan(id);if(!p.changes.some(e=>e.id===noteId))throw Error('条目不在差异清单中');const read=file=>{if(!fs.existsSync(file))return null;const db=this.database(file);try{if(noteId==='@settings')return db.prepare('SELECT name FROM options ORDER BY name').all().map(r=>r.name).join('\n')+'\n（设置值不显示）';const n=db.prepare('SELECT n.title,n.type,n.mime,n.isProtected,b.content FROM notes n LEFT JOIN blobs b ON n.blobId=b.blobId WHERE n.noteId=? AND n.isDeleted=0').get(noteId);if(!n)return null;const meta=db.prepare('SELECT type,name,value,isInheritable FROM attributes WHERE noteId=? AND isDeleted=0 ORDER BY type,name').all(noteId);const text=n.isProtected?'（已加密，内容不预览）':n.type==='file'?'（二进制附件，保留原文件）':Buffer.isBuffer(n.content)?n.content.toString('utf8'):n.content||'';return json({title:n.title,type:n.type,mime:n.mime,attributes:meta})+'\n\n'+text.slice(0,50000)+(text.length>50000?'\n…预览截断，实际同步使用完整数据库':'');}finally{db.close();}};return {local:read(path.join(this.planDir,'local.db')),remote:read(path.join(this.planDir,'remote.db'))};}
 async confirm(id,direction){const p=this.plan(id);if(this.index(this.config().dbPath).signature!==p.localSignature)throw Error('预览后本地又有修改，请重新检查差异');this.auth=await this.token();const remote=await this.remote();if(remote.head!==p.remote.head)throw Error('远端已有新提交，请重新检查差异');if(direction==='upload')return this.upload(p);if(direction==='restore')return this.restore(p);throw Error('请选择上传或恢复');}
 async upload(p){
  if(!p.changes.length)return {ok:true,action:'noop',message:'没有内容变化，无需上传。',uploadedObjects:0,uploadedBytes:0};
  if(!p.nextManifest||!Array.isArray(p.newObjects))throw Error('同步格式已更新，请重新检查差异后确认');
  const manifest=validateManifest({...p.nextManifest,createdAt:new Date().toISOString(),fingerprint:p.localSignature});
  let {head,branch}=p.remote;
  if(!head){await this.request('PUT','/contents/README.md',{message:'Initialize private Trilium incremental storage',content:Buffer.from('# Private Trilium backups\n\nManaged by the Myosotis incremental sync plugin. Compare and confirm changes before upload or restore.\n').toString('base64'),branch});head=(await this.remote()).head;}
  const parent=await this.request('GET','/git/commits/'+head);let treeSha=parent.tree.sha,batch=[],batchBytes=0,uploaded=0;
  const flush=async()=>{
   if(!batch.length)return;
   this.progress('正在提交变化的数据块',uploaded,p.newObjects.length);
   const next=await this.request('POST','/git/trees',{base_tree:treeSha,tree:batch.map(e=>({path:e.path,mode:'100644',type:'blob',content:e.content}))});
   for(const entry of batch){const saved=next.tree?.find(e=>e.path===entry.path);if(saved&&saved.sha!==entry.sha)throw Error('GitHub 增量对象校验失败');}
   treeSha=next.sha;uploaded+=batch.length;batch=[];batchBytes=0;
   this.progress('正在提交变化的数据块',uploaded,p.newObjects.length);
  };
  for(const c of p.newObjects){
   if(!/^[a-f0-9]{64}$/.test(c.sha256)||!/^[a-f0-9]{40}$/.test(c.blob))throw Error('增量预览对象无效，请重新检查');
   const content=await fs.promises.readFile(path.join(this.planDir,'delta',c.sha256+'.gz64'),'ascii');
   if(content.length>2*(BLOCK+65536)||gitBlobHash(content)!==c.blob)throw Error('暂存增量块已变化，请重新检查差异');
   if(batchBytes+content.length>TREE_BATCH)await flush();
   batch.push({path:'trilium-sync/v2/objects/'+c.sha256,sha:c.blob,content});batchBytes+=content.length;
  }
  await flush();
  const manifestText=json(manifest),manifestTree=await this.request('POST','/git/trees',{base_tree:treeSha,tree:[{path:'trilium-sync/v1/latest.json',mode:'100644',type:'blob',content:manifestText}]});
  const commit=await this.request('POST','/git/commits',{message:'Trilium incremental: '+p.changes.length+' changed entries; '+uploaded+' new blocks',tree:manifestTree.sha,parents:[head]});
  await this.request('PATCH','/git/refs/heads/'+encodeURIComponent(branch),{sha:commit.sha,force:false});
  const result={ok:true,action:'upload',format:'incremental-v2',commit:commit.sha,time:new Date().toISOString(),bytes:manifest.bytes,databaseBytes:manifest.bytes,uploadedObjects:uploaded,uploadedBytes:p.transfer.uploadBytes,manifestBytes:Buffer.byteLength(manifestText),reusedBlocks:p.transfer.reusedBlocks,totalBlocks:manifest.chunks.length};
  this.write('last-result.json',result);fs.unlinkSync(path.join(this.planDir,'plan.json'));
  // Warming a local cache must not turn a successful remote commit into an error.
  try{
   const target=path.join(this.planDir,'remote.db'),tmp=target+'.uploaded';await fs.promises.copyFile(path.join(this.planDir,'local.db'),tmp);
   for(const suffix of ['-wal','-shm'])await fs.promises.unlink(target+suffix).catch(()=>{});
   await fs.promises.rename(tmp,target);this.cacheRemote(manifest,this.index(target));
  }catch{result.cacheWarm=false;}
  return result;
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
