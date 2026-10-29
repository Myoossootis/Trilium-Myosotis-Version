"""Update only the knowledge browsing UI components, keeping notes/tree/preferences intact."""
import argparse
import datetime as dt
import json
import sqlite3
from contextlib import closing
from pathlib import Path
from apply_customizations import Etapi, EtapiError
from build_knowledge_workspace import component_source

ROOT=Path(__file__).resolve().parents[1]
COMPONENTS=[
    ('KbWikiUI0001','知识库与 Wiki 界面','text/jsx','knowledge-wiki.jsx'),
    ('KbWikiCSS001','知识库与 Wiki 样式','text/css','knowledge-wiki.css'),
    ('MyoHardwareUI','硬件知识库首页界面','text/jsx','hardware-library.jsx'),
    ('MyoHardwareCSS','硬件知识库首页样式','text/css','hardware-library.css'),
    ('KbLibReturn1','子库返回导航','application/javascript;env=frontend','knowledge-library-return.js'),
    ('KbManageUI01','知识库右键管理','application/javascript;env=frontend','knowledge-management.js'),
    ('KbManageCSS1','知识库右键管理样式','text/css','knowledge-management.css'),
    ('KbManageSvc1','知识库管理服务','application/javascript;env=backend','../backend/knowledge-management-service.js'),
    ('KbWikiSvc001','知识库与 Wiki 服务','application/javascript;env=backend','../backend/knowledge-wiki-service.js'),
]
def install(api,data_dir):
    originals={}
    group=api.get_note('KbWikiRoot01')
    disabled=any(a['name']=='myoDisabled_renderNote' for a in api.get_note('KbHubHome001')['attributes'])
    for id,title,mime,path in COMPONENTS:
        try:note=api.get_note(id)
        except EtapiError as error:
            if id not in ('KbLibReturn1','KbManageUI01','KbManageCSS1','KbManageSvc1') or 'HTTP 404' not in str(error):raise
            continue
        if note['title']!=title or note['type']!='code' or note['mime']!=mime or note['isProtected']:raise RuntimeError('Component ID collision: '+id)
        originals[id]={'note':note,'content':api.request('GET','/notes/'+id+'/content',accept='text/plain')}
    backup=ROOT/'backups'/('knowledge-browsing-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f'));backup.mkdir(parents=True)
    with closing(sqlite3.connect((Path(data_dir)/'document.db').resolve().as_uri()+'?mode=ro',uri=True)) as source,closing(sqlite3.connect(backup/'document.db')) as target:source.backup(target)
    (backup/'before.json').write_text(json.dumps(originals,ensure_ascii=False,indent=2),encoding='utf-8')
    for id,title,mime,path in COMPONENTS:
        content=component_source(id,ROOT/'customizations/frontend'/path)
        if id not in originals:
            api.create_note({'noteId':id,'parentNoteId':group['noteId'],'title':title,'type':'code','mime':mime,'content':content})
            labels=['homeInternal']
            if id in ('KbLibReturn1','KbManageUI01'):labels.append('myoDisabled_widget' if disabled else 'widget')
            if mime=='text/css':labels.append('myoDisabled_appCss' if disabled else 'appCss')
            for name in labels:
                api.add_attribute(id,{'type':'label','name':name,'value':'','isInheritable':False})
        elif originals[id]['content']!=content:api.put_content(id,content)
        assert api.request('GET','/notes/'+id+'/content',accept='text/plain')==content
    return {'updated':'知识库浏览与子库导航','backup':str(backup),'components':len(COMPONENTS)}

if __name__=='__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:37840/etapi');parser.add_argument('--data-dir',required=True);args=parser.parse_args()
    api=Etapi(args.url,Path('C:/Users/杜锦鸿/Desktop/api.txt').read_text(encoding='utf-8-sig').strip())
    print(json.dumps(install(api,args.data_dir),ensure_ascii=False))
