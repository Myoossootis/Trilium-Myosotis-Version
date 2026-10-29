"""Install the knowledge hub and unified native navigation through ETAPI."""
from __future__ import annotations

import argparse
from contextlib import closing
import datetime as dt
import json
from pathlib import Path
import sqlite3
import sys

from apply_customizations import Etapi, EtapiError, existing_attribute
from build_knowledge_workspace import component_source

ROOT = Path(__file__).resolve().parents[1]
HARDWARE, PROGRAMS, HUB, WIKI, GROUP = 'e3e7d52e13a9', '0e50f559e1a3', 'KbHubHome001', 'KbWikiFolder1', 'KbWikiRoot01'
LIBRARIES = [HARDWARE, '79483c47e0d0']
COMPONENTS = [
    ('KbWikiSvc001', '知识库与 Wiki 服务', 'application/javascript;env=backend', 'customizations/backend/knowledge-wiki-service.js'),
    ('KbWikiUI0001', '知识库与 Wiki 界面', 'text/jsx', 'customizations/frontend/knowledge-wiki.jsx'),
    ('KbWikiCSS001', '知识库与 Wiki 样式', 'text/css', 'customizations/frontend/knowledge-wiki.css'),
    ('KbWikiNav001', '知识库统一左侧导航', 'application/javascript;env=frontend', 'customizations/frontend/knowledge-navigation.js'),
    ('KbWikiNavCSS', '知识库统一导航样式', 'text/css', 'customizations/frontend/knowledge-navigation.css'),
    ('KbLibReturn1', '子库返回导航', 'application/javascript;env=frontend', 'customizations/frontend/knowledge-library-return.js'),
    ('KbManageUI01', '知识库右键管理', 'application/javascript;env=frontend', 'customizations/frontend/knowledge-management.js'),
    ('KbManageCSS1', '知识库右键管理样式', 'text/css', 'customizations/frontend/knowledge-management.css'),
    ('KbManageSvc1', '知识库管理服务', 'application/javascript;env=backend', 'customizations/backend/knowledge-management-service.js'),
    ('MyoHardwareUI', '硬件知识库首页界面', 'text/jsx', 'customizations/frontend/hardware-library.jsx'),
]


def maybe(api, note_id):
    try:
        return api.get_note(note_id)
    except EtapiError as error:
        if 'HTTP 404' not in str(error):
            raise
        return None


def install(api, db_path, backup=True):
    libraries = [api.get_note(note_id) for note_id in LIBRARIES]
    if any(note['type'] not in ('text','render','book') or note['isProtected'] for note in libraries):
        raise RuntimeError('Expected the accessible existing academic and hardware libraries')
    api.get_note(PROGRAMS)
    for note_id, title, expected in [(HUB,'知识库','render'),(WIKI,'主题 Wiki','text'),(GROUP,'知识库与 Wiki 插件','text'),('KbGraphNote1','知识关系图谱','noteMap')]:
        note = maybe(api,note_id)
        if note and (note['title'] != title or note['type'] != expected or note['isProtected']):
            raise RuntimeError('Note ID is already occupied: '+note_id)
    for note_id,title,mime,path in COMPONENTS:
        note = maybe(api,note_id)
        if note and (note['title'] != title or note['type'] != 'code' or note['isProtected']):
            raise RuntimeError('Component ID is already occupied: '+note_id)
        if not (ROOT / path).is_file():
            raise RuntimeError('Missing component file: '+path)
    hardware_style=api.get_note('MyoHardwareCSS')
    if hardware_style['type']!='code' or hardware_style['mime']!='text/css' or hardware_style['title']!='硬件知识库首页样式' or hardware_style['isProtected']:
        raise RuntimeError('Expected the existing accessible hardware stylesheet')
    toggle_style=api.get_note('MyoCodexFlipCSS')
    if toggle_style['type']!='code' or toggle_style['mime']!='text/css' or toggle_style['title']!='Codex 日夜切换样式' or toggle_style['isProtected']:
        raise RuntimeError('Expected the existing accessible day/night stylesheet')
    config=maybe(api,'KbNavData001')
    if config:
        if config['type']!='code' or config['mime']!='application/json' or config['title']!='知识库导航配置' or config['isProtected']:
            raise RuntimeError('Navigation configuration ID is occupied')
        state=api.request('GET','/notes/KbNavData001/content')
        if state.get('version')!=1 or not isinstance(state.get('revision'),int) or not isinstance(state.get('pinned'),list):
            raise RuntimeError('Navigation configuration is incompatible')
    previous = api.request('GET','/notes/MyoMarketData/content')
    if previous.get('version') != 1 or not isinstance(previous.get('revision'),int) or not isinstance(previous.get('plugins'),list):
        raise RuntimeError('Plugin market registry is incompatible')
    originals = {note['noteId']:{'note':note,'content':api.request('GET',f"/notes/{note['noteId']}/content",accept='text/plain'),'branches':[api.request('GET','/branches/'+branch_id) for branch_id in note['parentBranchIds']]} for note in libraries}
    previous_hub=maybe(api,HUB)
    disabled=bool(previous_hub and any(attr['name']=='myoDisabled_renderNote' for attr in previous_hub['attributes']))
    backup_dir = None
    if backup:
        backup_dir = ROOT/'backups'/f'knowledge-wiki-{dt.datetime.now():%Y%m%d-%H%M%S-%f}'
        backup_dir.mkdir(parents=True)
        source_path = Path(db_path).resolve(strict=True)
        with closing(sqlite3.connect(source_path.as_uri()+'?mode=ro',uri=True)) as source, closing(sqlite3.connect(backup_dir/'document.db')) as target:
            source.backup(target)
        (backup_dir/'before-navigation.json').write_text(json.dumps({'libraries':originals,'market':previous},ensure_ascii=False,indent=2),encoding='utf-8')

    def create(note_id,parent,title,kind,mime='',content=''):
        if not maybe(api,note_id):
            api.create_note({'noteId':note_id,'parentNoteId':parent,'title':title,'type':kind,'mime':mime,'content':content})
        return api.get_note(note_id)

    def attr(note_id,kind,name,value=''):
        note=api.get_note(note_id)
        if existing_attribute(note,kind,'myoDisabled_'+name,value):
            return
        if disabled and name in ('appCss','run','renderNote','widget'):
            name='myoDisabled_'+name
        if not existing_attribute(note,kind,name,value):
            conflicts=[a for a in note['attributes'] if a['noteId']==note_id and a['type']==kind and a['name']==name and a['value']!=value]
            if conflicts:
                raise RuntimeError('Unexpected attribute on '+note_id+': '+name)
            api.add_attribute(note_id,{'type':kind,'name':name,'value':value,'isInheritable':False})

    create(GROUP,PROGRAMS,'知识库与 Wiki 插件','text',content='<p>知识库导航、来源检索与 Wiki 整理。</p>')
    attr(GROUP,'label','homeInternal')
    create('KbNavData001',GROUP,'知识库导航配置','code','application/json',json.dumps({'version':1,'revision':0,'pinned':['al_HwQuiz01','al_MyoQuestEntry','al_MyoPomoEntry']}))
    attr('KbNavData001','label','homeInternal')
    for note_id,title,mime,path in COMPONENTS:
        create(note_id,GROUP,title,'code',mime)
        content=component_source(note_id,ROOT/path)
        if api.request('GET',f'/notes/{note_id}/content',accept='text/plain')!=content:
            api.put_content(note_id,content)
        attr(note_id,'label','homeInternal')
        if mime=='text/css':
            attr(note_id,'label','appCss')
        if note_id=='KbWikiNav001':
            # Native widgets render with the desktop layout; startup scripts run later.
            for old in api.get_note(note_id)['attributes']:
                if old['noteId']==note_id and old['type']=='label' and old['name'] in ('run','myoDisabled_run') and old['value']=='frontendStartup':
                    api.request('DELETE','/attributes/'+old['attributeId'])
            attr(note_id,'label','widget')
        if note_id in ('KbLibReturn1','KbManageUI01'):
            attr(note_id,'label','widget')
    hardware_css=(ROOT/'customizations/frontend/hardware-library.css').read_text(encoding='utf-8')
    if api.request('GET','/notes/MyoHardwareCSS/content',accept='text/plain')!=hardware_css:
        api.put_content('MyoHardwareCSS',hardware_css)
    toggle_css=(ROOT/'customizations/frontend/codex-theme-toggle.css').read_text(encoding='utf-8')
    if api.request('GET','/notes/MyoCodexFlipCSS/content',accept='text/plain')!=toggle_css:
        api.put_content('MyoCodexFlipCSS',toggle_css)
    create(HUB,'root','知识库','render','text/html')
    attr(HUB,'relation','renderNote','KbWikiUI0001')
    attr(HUB,'label','hideChildrenOverview')
    create(WIKI,HUB,'主题 Wiki','text',content='<p>从现有笔记整理的主题知识。</p>')
    create('KbGraphNote1',HUB,'知识关系图谱','noteMap')
    attr('KbGraphNote1','label','mapRootNoteId',HUB)
    attr('KbGraphNote1','label','mapType','link')

    # The original note and all children stay intact. Create the new branch first.
    for position,note_id in enumerate(LIBRARIES):
        note=api.get_note(note_id)
        if HUB not in note['parentNoteIds']:
            api.request('POST','/branches',body={'noteId':note_id,'parentNoteId':HUB,'notePosition':10+position})
        note=api.get_note(note_id)
        if HUB not in note['parentNoteIds']:
            raise RuntimeError('New library branch was not created; original root branch retained')
        for branch_id in note['parentBranchIds']:
            branch=api.request('GET','/branches/'+branch_id)
            if branch.get('parentNoteId') == 'root':
                api.request('DELETE','/branches/'+branch_id)

    registry=api.request('GET','/notes/MyoMarketData/content')
    entry=next((p for p in registry['plugins'] if p.get('id')==GROUP),None)
    definition={'id':GROUP,'name':'知识库与 Wiki','roots':[GROUP],'category':'阅读与导航','icon':'bx bx-library','description':'统一左侧导航、自定义快捷工具、学术与硬件子库及 Wiki 整理。','entry':HUB,'version':'1.3.0'}
    if entry:
        entry.update(definition)
    else:
        registry['plugins'].append(definition)
    registry['revision']+=1
    api.put_content('MyoMarketData',json.dumps(registry,ensure_ascii=False,indent=2))

    from plugin_catalog import refresh_catalog
    refresh_catalog(api)
    for note_id,original in originals.items():
        actual=api.get_note(note_id)
        if HUB not in actual['parentNoteIds'] or 'root' in actual['parentNoteIds']:
            raise RuntimeError('Library relocation did not complete: '+note_id)
        if set(actual['childNoteIds']) != set(original['note']['childNoteIds']) or api.request('GET',f'/notes/{note_id}/content',accept='text/plain') != original['content']:
            raise RuntimeError('Library contents changed unexpectedly; restore from backup')
    return {'installed':'知识库与 Wiki','hub':HUB,'libraries':LIBRARIES,'wiki':WIKI,'backup':str(backup_dir) if backup_dir else None}


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:37840/etapi')
    parser.add_argument('--token-file',type=Path,default=Path('C:/Users/杜锦鸿/Desktop/api.txt'))
    parser.add_argument('--data-dir',type=Path,required=True)
    parser.add_argument('--skip-backup',action='store_true')
    args=parser.parse_args()
    if args.skip_backup and args.url.rstrip('/')=='http://127.0.0.1:37840/etapi':
        parser.error('The active instance always requires a backup')
    sys.stdout.reconfigure(encoding='utf-8')
    api=Etapi(args.url,args.token_file.read_text(encoding='utf-8-sig').strip())
    print(json.dumps(install(api,args.data_dir/'document.db',not args.skip_backup),ensure_ascii=False))
