"""Install the optional GitHub snapshot plugin without touching personal notes or credentials."""
from pathlib import Path
import argparse,datetime as dt,json,sys
from apply_customizations import Etapi,EtapiError
ROOT=Path(__file__).resolve().parents[1]
COMPONENTS=[
 ('GhSyncSvc001','GitHub 同步服务','application/javascript;env=backend','customizations/backend/github-sync-service.js',None),
 ('GhSyncEngine1','GitHub 快照与差异引擎','application/javascript;env=backend','customizations/github-sync/engine.cjs',None),
 ('GhSyncRestore1','GitHub 关闭后恢复助手','text/x-python','customizations/github-sync/restore-worker.py',None),
 ('GhSyncUI0001','GitHub 同步界面','text/jsx','customizations/frontend/github-sync.jsx',None),
 ('GhSyncCSS001','GitHub 同步样式','text/css','customizations/frontend/github-sync.css','appCss'),
 ('GhSyncBoot01','GitHub 启动检查','application/javascript;env=frontend','customizations/frontend/github-sync-startup.js','widget')]
def install(api):
 registry=api.request('GET','/notes/MyoMarketData/content');enabled=next((p['enabled'] for p in registry['plugins'] if p['id']=='GhSyncRoot01'),True)
 original={}
 def get(id):
  try:return api.get_note(id)
  except EtapiError as e:
   if 'HTTP 404' not in str(e):raise
   return None
 for id in ['GhSyncRoot01','GhSyncView01']+[c[0] for c in COMPONENTS]:
  n=get(id)
  if n:original[id]={'note':n,'content':api.request('GET','/notes/'+id+'/content',accept='text/plain')}
 backup=ROOT/'backups'/('github-sync-install-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f'));backup.mkdir()
 (backup/'before.json').write_text(json.dumps(original,ensure_ascii=False,indent=2),encoding='utf-8')
 if not get('GhSyncRoot01'):api.create_note({'noteId':'GhSyncRoot01','parentNoteId':api.get_note('DsChatRoot1')['parentNoteIds'][0],'title':'GitHub 数据库同步插件','type':'text','content':'<p>私有 GitHub 仓库快照、差异确认及关闭后安全恢复。</p>'})
 def attr(id,kind,name,value=''):
  n=api.get_note(id)
  if not any(a['noteId']==id and a['type']==kind and a['name'] in [name,'myoDisabled_'+name] and a['value']==value for a in n['attributes']):api.add_attribute(id,{'type':kind,'name':name if enabled or name=='homeInternal' else 'myoDisabled_'+name,'value':value})
 attr('GhSyncRoot01','label','homeInternal')
 for id,title,mime,file,label in COMPONENTS:
  n=get(id)
  if n and (n['title']!=title or n['type']!='code' or n['isProtected']):raise RuntimeError('Component ID collision: '+id)
  content=(ROOT/file).read_text(encoding='utf-8')
  if not n:api.create_note({'noteId':id,'parentNoteId':'GhSyncRoot01','title':title,'type':'code','mime':mime,'content':content})
  else:
   api.put_content(id,content)
   if n['mime']!=mime:api.request('PATCH','/notes/'+id,body={'mime':mime})
  attr(id,'label','homeInternal')
  if label:attr(id,'label',label)
 if not get('GhSyncView01'):api.create_note({'noteId':'GhSyncView01','parentNoteId':'GhSyncRoot01','title':'GitHub 数据库同步','type':'render','content':'','mime':'text/html'})
 attr('GhSyncView01','relation','renderNote','GhSyncUI0001');attr('GhSyncView01','label','iconClass','bx bxl-github')
 from plugin_catalog import refresh_catalog
 refresh_catalog(api)
 return {'installed':'GitHub database sync','entry':'GhSyncView01','backup':str(backup)}
if __name__=='__main__':
 sys.stdout.reconfigure(encoding='utf-8');p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:37840/etapi');p.add_argument('--token-file',type=Path,required=True);a=p.parse_args();print(json.dumps(install(Etapi(a.url,a.token_file.read_text(encoding='utf-8-sig').strip())),ensure_ascii=False))
