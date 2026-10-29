"""Install the optional note enhancement package and its minimal workspace adapter."""
import argparse
from contextlib import closing
import datetime as dt
import json
from pathlib import Path
import sqlite3
from apply_customizations import Etapi, EtapiError
from build_knowledge_workspace import component_source

ROOT=Path(__file__).resolve().parents[1]
GROUP='NxExperience1'
COMPONENTS=[
    ('NxExpUI0001','笔记增强控制','application/javascript;env=frontend','customizations/frontend/note-experience.js','widget'),
    ('NxExpSvc001','笔记增强全文搜索服务','application/javascript;env=backend','customizations/backend/note-experience-service.js',None),
    ('NxExpCSS001','笔记增强样式','text/css','customizations/frontend/note-experience.css','appCss'),
]
ADAPTERS=[('KbWikiUI0001','knowledge-wiki.jsx'),('MyoHardwareUI','hardware-library.jsx')]
def install(api,data_dir,backup=True):
    api.get_note('0e50f559e1a3')
    def maybe(id):
        try:return api.get_note(id)
        except EtapiError as e:
            if 'HTTP 404' not in str(e):raise
    existing=maybe(GROUP)
    if existing and (existing['title']!='笔记增强插件' or existing['type']!='text' or existing['isProtected']):raise RuntimeError('Plugin root ID collision')
    before={}
    for id,title,mime,path,label in COMPONENTS:
        note=maybe(id)
        if note and (note['type']!='code' or note['title']!=title or note['mime']!=mime or note['isProtected']):raise RuntimeError('Component ID collision: '+id)
        if note:before[id]={'note':note,'content':api.request('GET','/notes/'+id+'/content',accept='text/plain')}
    for id,file in ADAPTERS:
        note=api.get_note(id)
        if note['type']!='code' or note['mime']!='text/jsx' or note['isProtected']:raise RuntimeError('Workspace component mismatch: '+id)
        before[id]={'note':note,'content':api.request('GET','/notes/'+id+'/content',accept='text/plain')}
    registry=api.request('GET','/notes/MyoMarketData/content')
    if registry.get('version')!=1 or not isinstance(registry.get('revision'),int) or not isinstance(registry.get('plugins'),list):raise RuntimeError('Invalid plugin registry')
    backup_dir=None
    if backup:
        backup_dir=ROOT/'backups'/('note-experience-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f'));backup_dir.mkdir()
        with closing(sqlite3.connect((Path(data_dir)/'document.db').resolve().as_uri()+'?mode=ro',uri=True)) as src,closing(sqlite3.connect(backup_dir/'document.db')) as dst:src.backup(dst)
        (backup_dir/'before.json').write_text(json.dumps({'components':before,'registry':registry},ensure_ascii=False,indent=2),encoding='utf-8')
    if not existing:api.create_note({'noteId':GROUP,'parentNoteId':'0e50f559e1a3','title':'笔记增强插件','type':'text','content':'<p>笔记体验增强的统一扩展入口。当前提供知识库全文检索、命中片段与正文定位；后续增强继续加入此插件。可在插件市场开启或关闭，关闭不会删除笔记。</p>'})
    def label(id,name):
        note=api.get_note(id)
        if not any(a['noteId']==id and a['type']=='label' and a['name']==name for a in note['attributes']):api.add_attribute(id,{'type':'label','name':name,'value':'','isInheritable':False})
    label(GROUP,'homeInternal')
    disabled=any(a['name']=='myoDisabled_widget' for a in before.get('NxExpUI0001',{}).get('note',{}).get('attributes',[]))
    for id,title,mime,path,activation in COMPONENTS:
        content=(ROOT/path).read_text(encoding='utf-8')
        if id not in before:api.create_note({'noteId':id,'parentNoteId':GROUP,'title':title,'type':'code','mime':mime,'content':content})
        elif before[id]['content']!=content:api.put_content(id,content)
        label(id,'homeInternal')
        if activation:label(id,('myoDisabled_' if disabled else '')+activation)
        assert api.request('GET','/notes/'+id+'/content',accept='text/plain')==content
    for id,file in ADAPTERS:
        content=component_source(id,ROOT/'customizations/frontend'/file)
        if before[id]['content']!=content:api.put_content(id,content)
        assert api.request('GET','/notes/'+id+'/content',accept='text/plain')==content
    registry=api.request('GET','/notes/MyoMarketData/content')
    if registry.get('version')!=1 or not isinstance(registry.get('revision'),int) or not isinstance(registry.get('plugins'),list):raise RuntimeError('Plugin registry changed incompatibly')
    definition={'id':GROUP,'name':'笔记增强','roots':[GROUP],'category':'阅读与导航','icon':'bx bx-search-alt','description':'知识库完整正文搜索、命中片段和原文定位。后续笔记体验增强统一加入本插件。','version':'1.0.0','entry':GROUP}
    entry=next((p for p in registry['plugins'] if p['id']==GROUP),None)
    if entry:entry.update(definition)
    else:registry['plugins'].append(definition)
    registry['revision']+=1;api.put_content('MyoMarketData',json.dumps(registry,ensure_ascii=False,indent=2))
    from plugin_catalog import refresh_catalog
    refresh_catalog(api)
    return {'installed':'笔记增强','toggle':'插件市场 → 笔记增强','backup':str(backup_dir) if backup_dir else None}
if __name__=='__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8');parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:37840/etapi');parser.add_argument('--data-dir',required=True);parser.add_argument('--skip-backup',action='store_true');args=parser.parse_args()
    if args.skip_backup and args.url.rstrip('/')=='http://127.0.0.1:37840/etapi':parser.error('Main instance requires a backup')
    api=Etapi(args.url,Path('C:/Users/杜锦鸿/Desktop/api.txt').read_text(encoding='utf-8-sig').strip())
    print(json.dumps(install(api,args.data_dir,not args.skip_backup),ensure_ascii=False))
