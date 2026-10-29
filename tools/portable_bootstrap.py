"""First launch: create an independent database identity and start the portable app."""
import base64,json,os,secrets,shutil,sqlite3,subprocess,sys
from contextlib import closing
from pathlib import Path

def prepare(root):
 runtime=root/'trilium-portable';data=runtime/'trilium-data';db=data/'document.db'
 if not db.exists():
  data.mkdir(parents=True,exist_ok=True)
  temporary=data/'document.db.initializing'
  with temporary.open('xb') as output,(root/'trilium-seed-data/document.db').open('rb') as source:shutil.copyfileobj(source,output)
  try:
   with closing(sqlite3.connect(temporary)) as c,c:
    for name in ['documentId','documentSecret']:c.execute('UPDATE options SET value=? WHERE name=?',(base64.b64encode(secrets.token_bytes(16)).decode(),name))
    assert c.execute('PRAGMA quick_check').fetchone()[0]=='ok','Seed integrity check failed'
   temporary.replace(db)
  except Exception:
   temporary.unlink(missing_ok=True);raise
 config=data/'config.ini'
 if not config.exists():config.write_text('[General]\ninstanceName=Myosotis\n\n[Security]\nbackendScriptingEnabled=true\nsqlConsoleEnabled=false\n',encoding='utf8')
 return runtime,data,db

if __name__=='__main__':
 root=Path(__file__).resolve().parents[1]
 runtime,data,db=prepare(root)
 if '--prepare-only' not in sys.argv:
  env=os.environ.copy();env.pop('ELECTRON_RUN_AS_NODE',None)
  env.update(TRILIUM_DATA_DIR=str(data),TRILIUM_ELECTRON_DATA_DIR=str(runtime/'trilium-electron-data'),ELECTRON_NO_ATTACH_CONSOLE='1')
  subprocess.Popen([str(runtime/'trilium.exe'),*sys.argv[1:]],cwd=runtime,env=env,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
