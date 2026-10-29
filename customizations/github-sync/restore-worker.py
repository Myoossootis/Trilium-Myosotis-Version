"""Explicitly confirmed offline restore. Windows file sharing prevents replacing an open database."""
from __future__ import annotations
import ctypes,datetime as dt,hashlib,json,os,pathlib,re,shutil,sqlite3,subprocess,sys,time
from contextlib import closing

LOCAL_OPTIONS=set('openNoteContexts documentId documentSecret instanceId lastSyncedPush lastSyncedPull lastDailyBackupDate lastWeeklyBackupDate lastMonthlyBackupDate rightPaneWidth leftPaneWidth rightPaneVisible leftPaneVisible rightPaneSelectedTab'.split())
def encoded(value):return json.dumps(value,ensure_ascii=False,separators=(',',':')).encode('utf-8')
def digest(value):return hashlib.sha256(value.encode('utf-8') if isinstance(value,str) else value or b'').hexdigest()
def fingerprint(file):
 with closing(sqlite3.connect(pathlib.Path(file).resolve().as_uri()+'?mode=ro',uri=True)) as db:
  db.row_factory=sqlite3.Row;db.execute('BEGIN');notes=[];attrs={};branches={};attachments={}
  for a in db.execute('SELECT a.ownerId,a.title,a.mime,a.position,a.role,a.isProtected,b.content FROM attachments a LEFT JOIN blobs b ON b.blobId=a.blobId WHERE a.isDeleted=0 ORDER BY a.attachmentId'):
   attachments.setdefault(a['ownerId'],[]).append([a['title'],a['mime'],a['position'],a['role'],a['isProtected'],digest(a['content'])])
  for a in db.execute('SELECT noteId,type,name,value,isInheritable,position FROM attributes WHERE isDeleted=0 ORDER BY noteId,type,name,value,position'):
   attrs.setdefault(a['noteId'],[]).append([a['type'],a['name'],a['value'],a['isInheritable'],a['position']])
  for b in db.execute('SELECT noteId,parentNoteId,prefix,notePosition FROM branches WHERE isDeleted=0 ORDER BY noteId,parentNoteId,prefix,notePosition'):
   branches.setdefault(b['noteId'],[]).append([b['parentNoteId'],b['prefix'],b['notePosition']])
  for n in db.execute('SELECT n.noteId,n.title,n.type,n.mime,n.isProtected,b.content FROM notes n LEFT JOIN blobs b ON b.blobId=n.blobId WHERE n.isDeleted=0 ORDER BY n.noteId'):
   meta={'title':n['title'],'type':n['type'],'mime':n['mime'],'isProtected':n['isProtected'],'attributes':attrs.get(n['noteId'],[]),'branches':branches.get(n['noteId'],[]),'attachments':attachments.get(n['noteId'],[])}
   notes.append([n['noteId'],digest(encoded([meta,digest(n['content'])]))])
  settings=[dict(o) for o in db.execute('SELECT name,value,isSynced FROM options ORDER BY name') if o['name'] not in LOCAL_OPTIONS and not re.match(r'last|sync|backup|window|zoom|electron|recent',o['name'],re.I)]
  return digest(encoded([notes,settings]))
def alive(pid):
 if os.name!='nt':
  try:os.kill(pid,0);return True
  except OSError:return False
 kernel=ctypes.WinDLL('kernel32',use_last_error=True);kernel.OpenProcess.restype=ctypes.c_void_p;kernel.CloseHandle.argtypes=[ctypes.c_void_p]
 handle=kernel.OpenProcess(0x1000,False,pid)
 if not handle:return False
 code=ctypes.c_ulong()
 try:return bool(kernel.GetExitCodeProcess(ctypes.c_void_p(handle),ctypes.byref(code))) and code.value==259
 finally:kernel.CloseHandle(handle)
def exclusive(file):
 if os.name!='nt':raise RuntimeError('此恢复助手仅支持 Windows，其他系统请使用 Trilium 原生恢复。')
 import msvcrt
 kernel=ctypes.WinDLL('kernel32',use_last_error=True);kernel.CreateFileW.argtypes=[ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_ulong,ctypes.c_void_p,ctypes.c_ulong,ctypes.c_ulong,ctypes.c_void_p];kernel.CreateFileW.restype=ctypes.c_void_p
 handle=kernel.CreateFileW(str(file),0xC0000000,4,None,3,0x80,None) # Read/write, share delete only.
 if handle in (None,ctypes.c_void_p(-1).value):raise RuntimeError('数据库仍被其他进程使用，已取消恢复。')
 return os.fdopen(msvcrt.open_osfhandle(handle,os.O_RDWR|os.O_BINARY),'r+b')
def restore(job_file):
 job_file=pathlib.Path(job_file).resolve();root=job_file.parent;job=json.loads(job_file.read_text(encoding='utf-8'));moved=[];temporary=None;installed=False
 def report(**value):(root/'last-result.json').write_text(json.dumps({**value,'action':'restore','time':dt.datetime.now(dt.timezone.utc).isoformat()},ensure_ascii=False),encoding='utf-8')
 def restart():
  if job.get('testNoRestart'):return
  env={**os.environ,'TRILIUM_DATA_DIR':str(pathlib.Path(job['dbPath']).parent)};env.pop('ELECTRON_RUN_AS_NODE',None)
  subprocess.Popen([job['execPath']],cwd=str(pathlib.Path(job['execPath']).parent),env=env,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
 try:
  source=pathlib.Path(job['source']).resolve();target=pathlib.Path(job['dbPath']).resolve()
  if job.get('version')!=1 or time.time()*1000-job['createdAt']>3600000 or source!=root/'plan'/'remote.db' or target!=root.parent/'document.db':raise RuntimeError('恢复任务已过期或路径不匹配。')
  for _ in range(1800):
   if not alive(job['pid']):break
   time.sleep(1)
  if alive(job['pid']):raise RuntimeError('Trilium 仍未关闭，恢复已取消，请重新检查差异。')
  if digest(source.read_bytes())!=job['sha256']:raise RuntimeError('暂存快照已变化，已取消恢复。')
  before=digest(target.read_bytes())
  if fingerprint(target)!=job['localSignature']:raise RuntimeError('确认后本地内容又有变化，已取消恢复以保留新修改。')
  with exclusive(target) as locked:
   if digest(locked.read())!=before:raise RuntimeError('恢复前数据库再次变化，已取消恢复。')
   backup=root/'backups'/dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S-%f');backup.mkdir(parents=True)
   temporary=target.with_name(target.name+'.myosotis-restore.tmp');shutil.copyfile(source,temporary)
   if digest(temporary.read_bytes())!=job['sha256']:raise RuntimeError('恢复文件复制校验失败。')
   for suffix in ('','-wal','-shm'):
    original=pathlib.Path(str(target)+suffix)
    if original.exists():destination=backup/('document.db'+suffix);os.replace(original,destination);moved.append((original,destination))
   os.replace(temporary,target);temporary=None;installed=True
  report(ok=True,backup=str(backup));restart()
 except Exception as error:
  if not installed:
   for original,destination in reversed(moved):
    if not original.exists() and destination.exists():os.replace(destination,original)
  if temporary and temporary.exists():temporary.unlink()
  report(ok=False,message=str(error))
  if not alive(job['pid']):restart()
if __name__=='__main__':restore(sys.argv[1])
