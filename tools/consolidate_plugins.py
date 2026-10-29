"""Consolidate feature packages and install isolated activation boundaries."""
import argparse
from contextlib import closing
import datetime as dt
import json
from pathlib import Path
import sqlite3
from apply_customizations import Etapi,EtapiError
from plugin_catalog import consolidate

ROOT=Path(__file__).resolve().parents[1]
UPDATED={
 'MyoMarketSvc1':'customizations/backend/plugin-market-service.js',
 'MyoMarketUI01':'customizations/frontend/plugin-market.jsx',
 'MyoMarketCSS1':'customizations/frontend/plugin-market.css',
 'HmStartHome1':'trilium-home-startup.js',
 'gTC4ItLtMiD5':'trilium-home-dashboard.js',
 'HmHomeSvc01':'trilium-home-service.js',
 'MyoQuestSvc1':'customizations/backend/commission-service.js',
 'HwQuizSvc01':'customizations/backend/hardware-quiz-service.js',
 'KbWikiSvc001':'customizations/backend/knowledge-wiki-service.js',
 'MyoHardwareSvc':'customizations/backend/hardware-library-service.js',
 'KbManageSvc1':'customizations/backend/knowledge-management-service.js',
 'DsChatSvc01':'customizations/backend/dsh-chat-service.js',
 'MyoPomoRun1':'customizations/frontend/pomodoro-runtime.js',
 'KbWikiNav001':'customizations/frontend/knowledge-navigation.js',
}
NEW=[('MyoModuleUI01','插件状态与依赖控制','MyoMarketRoot','customizations/frontend/plugin-module-state.js','widget'),('NxEditorUtil1','笔记编辑与标题辅助','NxExperience1','customizations/frontend/note-editor-utilities.js','run')]
def install(api,data_dir,backup=True):
 cache={}
 def get(id):
  if id not in cache:
   try:cache[id]=api.get_note(id)
   except EtapiError as e:
    if 'HTTP 404' not in str(e):raise
    cache[id]=None
  return cache[id]
 registry=api.request('GET','/notes/MyoMarketData/content')
 if registry.get('version')!=1 or not isinstance(registry.get('revision'),int):raise RuntimeError('Invalid plugin registry')
 original={}
 for id,path in UPDATED.items():
  n=get(id)
  if not n or n['type']!='code' or n['isProtected']:raise RuntimeError('Expected accessible code component: '+id)
  if not (ROOT/path).is_file():raise RuntimeError('Missing source '+path)
  original[id]={'note':n,'content':api.request('GET','/notes/'+id+'/content',accept='text/plain')}
 for id,title,parent,path,label in NEW:
  n=get(id)
  if n and (n['title']!=title or n['type']!='code' or n['isProtected']):raise RuntimeError('Component collision: '+id)
  if n:original[id]={'note':n,'content':api.request('GET','/notes/'+id+'/content',accept='text/plain')}
 # Validate all current ownership before any mutation.
 consolidate(registry,get)
 backup_dir=None
 if backup:
  backup_dir=ROOT/'backups'/('plugin-consolidation-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f'));backup_dir.mkdir()
  with closing(sqlite3.connect((Path(data_dir)/'document.db').resolve().as_uri()+'?mode=ro',uri=True)) as src,closing(sqlite3.connect(backup_dir/'document.db')) as dst:src.backup(dst)
  (backup_dir/'before.json').write_text(json.dumps({'registry':registry,'components':original},ensure_ascii=False,indent=2),encoding='utf-8')
 def label(id,name,value=''):
  if not any(a['noteId']==id and a['type']=='label' and a['name']==name and a['value']==value for a in api.get_note(id)['attributes']):api.add_attribute(id,{'type':'label','name':name,'value':value,'isInheritable':False})
 note_enabled=next((p.get('enabled') for p in registry['plugins'] if p['id']=='NxExperience1'),True)
 if registry.get('catalogVersion')!=2:note_enabled=any(a['noteId']=='HmStartHome1' and a['name']=='run' and a['value']=='frontendStartup' for a in get('HmStartHome1')['attributes'])
 for id,title,parent,path,activation in NEW:
  content=(ROOT/path).read_text(encoding='utf-8')
  if not get(id):api.create_note({'noteId':id,'parentNoteId':parent,'title':title,'type':'code','mime':'application/javascript;env=frontend','content':content})
  elif original[id]['content']!=content:api.put_content(id,content)
  label(id,'homeInternal')
  owned=api.get_note(id)['attributes'];value='frontendStartup' if activation=='run' else ''
  if not any(a['noteId']==id and a['type']=='label' and a['name'] in (activation,'myoDisabled_'+activation) and a['value']==value for a in owned):label(id,('myoDisabled_' if id=='NxEditorUtil1' and not note_enabled else '')+activation,value)
  cache.pop(id,None);cache.pop(parent,None)
 for id,path in UPDATED.items():
  content=(ROOT/path).read_text(encoding='utf-8')
  if original[id]['content']!=content:api.put_content(id,content)
  assert api.request('GET','/notes/'+id+'/content',accept='text/plain')==content
 latest=api.request('GET','/notes/MyoMarketData/content')
 if latest['revision']!=registry['revision']:raise RuntimeError('Plugin settings changed during migration; source updates saved, retry consolidation')
 result=consolidate(latest,get);result['revision']+=1
 api.put_content('MyoMarketData',json.dumps(result,ensure_ascii=False,indent=2))
 return {'before':len(registry['plugins']),'feature_plugins':len([p for p in result['plugins'] if not p.get('core')]),'names':[p['name'] for p in result['plugins'] if not p.get('core')],'backup':str(backup_dir) if backup_dir else None}
if __name__=='__main__':
 import sys
 sys.stdout.reconfigure(encoding='utf-8');p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:37840/etapi');p.add_argument('--data-dir',required=True);p.add_argument('--skip-backup',action='store_true');a=p.parse_args()
 if a.skip_backup and a.url.rstrip('/')=='http://127.0.0.1:37840/etapi':p.error('Main instance requires a backup')
 api=Etapi(a.url,Path('C:/Users/杜锦鸿/Desktop/api.txt').read_text(encoding='utf-8-sig').strip());print(json.dumps(install(api,a.data_dir,not a.skip_backup),ensure_ascii=False))
