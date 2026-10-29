"""Install a hardware library render page while preserving its content and tree."""
import datetime as dt
import json
import sqlite3
from contextlib import closing
from pathlib import Path
from apply_customizations import EtapiError, existing_attribute
from install_plugin_market import registry_for
from plugin_groups import create_folder
from build_knowledge_workspace import component_source

ROOT=Path(__file__).resolve().parents[1]
LIBRARY='e3e7d52e13a9'
GROUP='MyoHardwareHome'
COMPONENTS=[
    ('MyoHardwareSvc','硬件知识库索引服务','application/javascript;env=backend','customizations/backend/hardware-library-service.js'),
    ('MyoHardwareUI','硬件知识库首页界面','text/jsx','customizations/frontend/hardware-library.jsx'),
    ('MyoHardwareCSS','硬件知识库首页样式','text/css','customizations/frontend/hardware-library.css')]

def install_live(api):
    def note(id):
        try:return api.get_note(id)
        except EtapiError as error:
            if 'HTTP 404' not in str(error):raise
    library=note(LIBRARY)
    if not library or library['type'] not in ('text','render') or library['isProtected']:raise RuntimeError('Expected accessible hardware library')
    if any(a['name']=='renderNote' and a['value']!='MyoHardwareUI' for a in library['attributes']):raise RuntimeError('Library already has a different render view')
    programs='0e50f559e1a3';api.get_note(programs)
    backup=ROOT/'backups'/('hardware-library-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f'));backup.mkdir(parents=True)
    original=api.request('GET',f'/notes/{LIBRARY}/content',accept='text/plain')
    (backup/'before-library.json').write_text(json.dumps({'note':library,'content':original},ensure_ascii=False,indent=2),encoding='utf8')
    previous=api.request('GET','/notes/MyoMarketData/content')
    (backup/'before-registry.json').write_text(json.dumps(previous,ensure_ascii=False,indent=2),encoding='utf8')
    if not note(GROUP):api.create_note({'noteId':GROUP,'parentNoteId':programs,'title':'硬件知识库首页','type':'text','content':'专题导航、知识索引、阅读预览与本地收藏。','notePosition':85})
    if not existing_attribute(api.get_note(GROUP),'label','homeInternal',''):api.add_attribute(GROUP,{'type':'label','name':'homeInternal','value':'','isInheritable':False})
    for id,title,mime,path in COMPONENTS:
        old=note(id);content=component_source(id,ROOT/path)
        if old:
            if old['type']!='code' or old['title']!=title or old['isProtected']:raise RuntimeError('Component ID collision: '+id)
            (backup/(id+'.txt')).write_text(api.request('GET',f'/notes/{id}/content',accept='text/plain'),encoding='utf8')
            api.put_content(id,content)
        else:api.create_note({'noteId':id,'parentNoteId':GROUP,'title':title,'type':'code','mime':mime,'content':content})
        actual=api.get_note(id)
        for label in ['homeInternal']+(['appCss'] if id=='MyoHardwareCSS' else []):
            if any(a['name']=='myoDisabled_'+label for a in actual['attributes']):label='myoDisabled_'+label
            if not existing_attribute(actual,'label',label,''):api.add_attribute(id,{'type':'label','name':label,'value':'','isInheritable':False})
        assert api.request('GET',f'/notes/{id}/content',accept='text/plain')==content
    for kind,name,value in [('relation','renderNote','MyoHardwareUI'),('label','hideChildrenOverview','')]:
        if existing_attribute(library,kind,'myoDisabled_'+name,value):continue
        if not existing_attribute(library,kind,name,value):api.add_attribute(LIBRARY,{'type':kind,'name':name,'value':value,'isInheritable':False})
    api.request('PATCH',f'/notes/{LIBRARY}',body={'type':'render','mime':'text/html'})
    actual=api.get_note(LIBRARY)
    assert actual['childNoteIds']==library['childNoteIds'] and actual['parentNoteIds']==library['parentNoteIds']
    assert api.request('GET',f'/notes/{LIBRARY}/content',accept='text/plain')==original
    api.put_content('MyoMarketData',json.dumps(registry_for(note,programs,previous),ensure_ascii=False,indent=2))
    return {'installed':'hardware library homepage','backup':str(backup),'treeAndContentPreserved':True}

def install(path):
    path=Path(path).resolve(strict=True);now=dt.datetime.now().astimezone()
    local=now.isoformat(sep=' ',timespec='milliseconds');utc=now.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    backup=path.parent/'backup'/f'before-hardware-library-{now:%Y%m%d-%H%M%S-%f}.db';backup.parent.mkdir(exist_ok=True)
    with closing(sqlite3.connect(path)) as db,db:
        with closing(sqlite3.connect(backup)) as target:db.backup(target)
        programs=db.execute("select noteId from notes where title in ('系统与插件','Myosotis 程序组件') and type in ('text','render') and isDeleted=0").fetchall()
        if len(programs)!=1:raise RuntimeError('Expected one program root')
        if not db.execute('select 1 from notes where noteId=?',(GROUP,)).fetchone():create_folder(db,GROUP,'硬件知识库首页',programs[0][0],GROUP+'Br',local,utc)
        def attr(id,kind,name,value):
            found=db.execute('select attributeId,value from attributes where noteId=? and type=? and name=? and isDeleted=0',(id,kind,name)).fetchall()
            if found and (len(found)!=1 or found[0][1]!=value):raise RuntimeError('Unexpected component binding')
            if not found:
                key=id+'HL'+name
                db.execute('insert into attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) values(?,?,?,?,?,20,0,0,?) on conflict(attributeId) do update set isDeleted=0,value=excluded.value,utcDateModified=excluded.utcDateModified',(key,id,kind,name,value,utc))
        for id,title,mime,relative in COMPONENTS:
            old=db.execute('select title,type,isProtected,isDeleted from notes where noteId=?',(id,)).fetchone()
            if old and old!=(title,'code',0,0):raise RuntimeError('Component ID collision')
            blob=id+'B';content=component_source(id,ROOT/relative)
            if db.execute('select 1 from notes where blobId=? and noteId<>?',(blob,id)).fetchone():raise RuntimeError('Shared component blob')
            db.execute('insert into blobs(blobId,content,dateModified,utcDateModified,textRepresentation) values(?,?,?,?,?) on conflict(blobId) do update set content=excluded.content,textRepresentation=excluded.textRepresentation,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified',(blob,content,local,utc,content))
            db.execute('insert into notes(noteId,title,type,mime,isProtected,blobId,isDeleted,dateCreated,dateModified,utcDateCreated,utcDateModified) values(?,?,?,?,0,?,0,?,?,?,?) on conflict(noteId) do update set mime=excluded.mime,blobId=excluded.blobId,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified',(id,title,'code',mime,blob,local,local,utc,utc))
            if not db.execute('select 1 from branches where noteId=? and parentNoteId=? and isDeleted=0',(id,GROUP)).fetchone():
                db.execute('insert into branches(branchId,noteId,parentNoteId,notePosition,isExpanded,isDeleted,utcDateModified) values(?,?,?,30,0,0,?)',(id+'Br',id,GROUP,utc))
            for name in ['homeInternal']+(['appCss'] if id=='MyoHardwareCSS' else []):
                if db.execute('select 1 from attributes where noteId=? and name=? and isDeleted=0',(id,'myoDisabled_'+name)).fetchone():name='myoDisabled_'+name
                attr(id,'label',name,'')
        attr(GROUP,'label','homeInternal','')
        library=db.execute('select type,isProtected from notes where noteId=? and isDeleted=0',(LIBRARY,)).fetchone()
        # A distributable contains program code, never a fabricated copy of personal notes.
        if library:
            if library[0] not in ('text','render') or library[1]:raise RuntimeError('Expected accessible library')
            name='myoDisabled_renderNote' if db.execute("select 1 from attributes where noteId=? and name='myoDisabled_renderNote' and isDeleted=0",(LIBRARY,)).fetchone() else 'renderNote'
            attr(LIBRARY,'relation',name,'MyoHardwareUI');attr(LIBRARY,'label','hideChildrenOverview','')
            db.execute("update notes set type='render',mime='text/html',dateModified=?,utcDateModified=? where noteId=?",(local,utc,LIBRARY))
        market=db.execute("select n.blobId,b.content from notes n join blobs b on b.blobId=n.blobId where n.noteId='MyoMarketData' and n.isDeleted=0").fetchone()
        if market:
            def get_note(id):
                row=db.execute('select title,type from notes where noteId=? and isDeleted=0',(id,)).fetchone()
                if row:return {'noteId':id,'title':row[0],'type':row[1],'childNoteIds':[r[0] for r in db.execute('select noteId from branches where parentNoteId=? and isDeleted=0 order by notePosition',(id,))]}
            content=json.dumps(registry_for(get_note,programs[0][0],json.loads(market[1])),ensure_ascii=False,indent=2)
            db.execute('update blobs set content=?,textRepresentation=?,dateModified=?,utcDateModified=? where blobId=?',(content,content,local,utc,market[0]))
    return {'installed':'hardware library homepage components','backup':str(backup)}
