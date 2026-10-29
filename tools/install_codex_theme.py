"""Install the Codex dark theme and its independent native theme shortcut."""
import datetime as dt
import json
import sqlite3
from contextlib import closing
from pathlib import Path
from apply_customizations import EtapiError, existing_attribute
from plugin_groups import create_folder
from install_plugin_market import registry_for

ROOT=Path(__file__).resolve().parents[1]
def specs():
    return [n for n in json.loads((ROOT/'customizations-manifest.json').read_text(encoding='utf8'))['notes'] if n['key'] in ('codex_dark','codex_toggle','codex_toggle_css')]

def launcher_live(api,backup):
    script=api.get_note('MyoCodexFlip')
    disabled=any(a['name']=='myoDisabled_run' for a in script['attributes'])
    # Remove the old startup hook BEFORE installing the on-click action.
    for attr in script['attributes']:
        if attr['noteId']=='MyoCodexFlip' and attr['name'] in ('run','myoDisabled_run'):
            api.remove_attribute(attr['attributeId'])
    id='al_MyoCodexTheme'
    try:old=api.get_note(id)
    except EtapiError as error:
        if 'HTTP 404' not in str(error):raise
        old=None
    if old:
        if old['type']!='launcher' or old['title']!='切换浅色 / 暗色':raise RuntimeError('Launcher ID collision')
        (backup/(id+'.json')).write_text(json.dumps(old,ensure_ascii=False,indent=2),encoding='utf8')
    else:api.create_note({'noteId':id,'parentNoteId':'_lbVisibleLaunchers','title':'切换浅色 / 暗色','type':'launcher','content':'','notePosition':180})
    actual=api.get_note(id)
    binding='myoDisabled_script' if disabled or any(a['name']=='myoDisabled_script' for a in actual['attributes']) else 'script'
    for kind,name,value in [('label','launcherType','script'),('label','iconClass','bx myo-day-night-icon'),('relation',binding,'MyoCodexFlip')]:
        if not existing_attribute(actual,kind,name,value):
            if any(a['type']==kind and a['name']==name for a in actual['attributes']):raise RuntimeError('Unexpected launcher binding')
            api.add_attribute(id,{'type':kind,'name':name,'value':value,'isInheritable':False})

def install_live(api):
    backup=ROOT/'backups'/('codex-dark-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S'))
    backup.mkdir(parents=True)
    def note(id):
        try:return api.get_note(id)
        except EtapiError as error:
            if 'HTTP 404' not in str(error):raise
    root='0e50f559e1a3'
    light=note('MyoCodexUI01')
    if not light:raise RuntimeError('Existing Codex light theme missing')
    themes=light['parentNoteIds'][0]
    ledger=api.request('GET','/notes/MyoQuestData/content',accept='text/plain')
    old_registry=api.request('GET','/notes/MyoMarketData/content')
    (backup/'market-registry.json').write_text(json.dumps(old_registry,ensure_ascii=False,indent=2),encoding='utf8')
    if not note('MyoCodexSwitch'):
        api.create_note({'noteId':'MyoCodexSwitch','parentNoteId':root,'title':'Codex 日夜切换','type':'text','content':'顶部日夜滑块：切换 Codex 浅色与暗色，保存原生外观设置。'})
    old_toggle=note('MyoCodexFlip')
    if old_toggle:(backup/'before-toggle.json').write_text(json.dumps(old_toggle,ensure_ascii=False,indent=2),encoding='utf8')
    if old_toggle:launcher_live(api,backup)
    for item in specs():
        id=item['noteId'];old=note(id);content=(ROOT/item['path']).read_text(encoding='utf8')
        if old:
            if old['title']!=item['title'] or old['type']!='code':raise RuntimeError('Component ID collision: '+id)
            (backup/(id+'.json')).write_text(json.dumps(old,ensure_ascii=False,indent=2),encoding='utf8')
            (backup/(id+'.txt')).write_text(api.request('GET',f'/notes/{id}/content',accept='text/plain'),encoding='utf8')
            api.put_content(id,content)
            if old.get('mime')!=item['mime']:api.request('PATCH','/notes/'+id,body={'mime':item['mime']})
        else:api.create_note({'noteId':id,'parentNoteId':themes if item['key']=='codex_dark' else 'MyoCodexSwitch','title':item['title'],'type':'code','mime':item['mime'],'content':content})
        actual=api.get_note(id)
        for name,value in item['labels']:
            if any(a['name']=='myoDisabled_'+name for a in actual['attributes']):name='myoDisabled_'+name
            if not existing_attribute(actual,'label',name,value):api.add_attribute(id,{'type':'label','name':name,'value':value,'isInheritable':False})
        assert api.request('GET',f'/notes/{id}/content',accept='text/plain')==content
    if not old_toggle:launcher_live(api,backup)
    api.put_content('MyoMarketData',json.dumps(registry_for(note,root,old_registry),ensure_ascii=False,indent=2))
    assert api.request('GET','/notes/MyoQuestData/content',accept='text/plain')==ledger
    return {'installed':'Codex dark + day/night shortcut','backup':str(backup),'userDataUnchanged':True}

def install(path):
    path=Path(path).resolve(strict=True);now=dt.datetime.now().astimezone()
    local=now.isoformat(sep=' ',timespec='milliseconds');utc=now.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    backup=path.parent/'backup'/f'before-codex-dark-{now:%Y%m%d-%H%M%S-%f}.db';backup.parent.mkdir(exist_ok=True)
    with closing(sqlite3.connect(path)) as db,db:
        with closing(sqlite3.connect(backup)) as snapshot:db.backup(snapshot)
        roots=db.execute("select noteId from notes where title in ('系统与插件','Myosotis 程序组件') and type in ('text','render') and isDeleted=0").fetchall()
        if len(roots)!=1:raise RuntimeError('Expected one program root')
        root=roots[0][0]
        if not db.execute("select 1 from notes where noteId='MyoCodexSwitch'").fetchone():create_folder(db,'MyoCodexSwitch','Codex 日夜切换',root,'MyoCodexSwitchBr',local,utc)
        disabled=db.execute("select 1 from attributes where noteId='MyoCodexFlip' and name='myoDisabled_run' and isDeleted=0").fetchone()
        db.execute("update attributes set isDeleted=1,utcDateModified=? where noteId='MyoCodexFlip' and name in ('run','myoDisabled_run') and isDeleted=0",(utc,))
        for item in specs():
            id=item['noteId'];content=(ROOT/item['path']).read_text(encoding='utf8');blob=id+'B'
            old=db.execute('select title,type,isProtected,isDeleted from notes where noteId=?',(id,)).fetchone()
            if old and old!=(item['title'],'code',0,0):raise RuntimeError('Component ID collision: '+id)
            if db.execute('select 1 from notes where blobId=? and noteId<>?',(blob,id)).fetchone():raise RuntimeError('Shared component blob')
            db.execute('insert into blobs(blobId,content,dateModified,utcDateModified,textRepresentation) values(?,?,?,?,?) on conflict(blobId) do update set content=excluded.content,textRepresentation=excluded.textRepresentation,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified',(blob,content,local,utc,content))
            db.execute('insert into notes(noteId,title,type,mime,isProtected,blobId,isDeleted,dateCreated,dateModified,utcDateCreated,utcDateModified) values(?,?,?,?,0,?,0,?,?,?,?) on conflict(noteId) do update set mime=excluded.mime,blobId=excluded.blobId,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified',(id,item['title'],'code',item['mime'],blob,local,local,utc,utc))
            parent=root if item['key']=='codex_dark' else 'MyoCodexSwitch'
            if not db.execute('select 1 from branches where noteId=? and parentNoteId=? and isDeleted=0',(id,parent)).fetchone():
                db.execute('insert into branches(branchId,noteId,parentNoteId,notePosition,isExpanded,isDeleted,utcDateModified) values(?,?,?,?,0,0,?)',(id+'Br',id,parent,50,utc))
            if item['key']!='codex_dark':db.execute('update branches set isDeleted=1,utcDateModified=? where noteId=? and parentNoteId=?',(utc,id,root))
            for i,(name,value) in enumerate(item['labels']):
                if db.execute('select 1 from attributes where noteId=? and name=? and isDeleted=0',(id,'myoDisabled_'+name)).fetchone():name='myoDisabled_'+name
                found=db.execute('select attributeId from attributes where noteId=? and type=? and name=? and isDeleted=0',(id,'label',name)).fetchall()
                if len(found)>1:raise RuntimeError('Duplicate attribute')
                if found:db.execute('update attributes set value=?,utcDateModified=? where attributeId=?',(value,utc,found[0][0]))
                else:db.execute('insert into attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) values(?,?,?, ?,?,?,0,0,?)',(id+'A'+str(i),id,'label',name,value,10+i,utc))
        id='al_MyoCodexTheme';blob=id+'B'
        old=db.execute('select title,type,isDeleted from notes where noteId=?',(id,)).fetchone()
        if old and old!=('切换浅色 / 暗色','launcher',0):raise RuntimeError('Launcher ID collision')
        if not old:
            db.execute('insert into blobs(blobId,content,dateModified,utcDateModified,textRepresentation) values(?,?,?,?,?)',(blob,'',local,utc,''))
            db.execute("insert into notes(noteId,title,type,mime,isProtected,blobId,isDeleted,dateCreated,dateModified,utcDateCreated,utcDateModified) values(?,?,'launcher','',0,?,0,?,?,?,?)",(id,'切换浅色 / 暗色',blob,local,local,utc,utc))
        if not db.execute('select 1 from branches where noteId=? and parentNoteId=? and isDeleted=0',(id,'_lbVisibleLaunchers')).fetchone():
            previous=db.execute('select branchId from branches where noteId=? and parentNoteId=?',(id,'_lbVisibleLaunchers')).fetchone()
            if previous:db.execute('update branches set isDeleted=0,notePosition=180,utcDateModified=? where branchId=?',(utc,previous[0]))
            else:db.execute('insert into branches(branchId,noteId,parentNoteId,notePosition,isExpanded,isDeleted,utcDateModified) values(?,?,?,180,0,0,?)',(id+'Br',id,'_lbVisibleLaunchers',utc))
        disabled=disabled or db.execute("select 1 from attributes where noteId=? and name='myoDisabled_script' and isDeleted=0",(id,)).fetchone()
        for kind,name,value in [('label','launcherType','script'),('label','iconClass','bx myo-day-night-icon'),('relation','myoDisabled_script' if disabled else 'script','MyoCodexFlip')]:
            found=db.execute('select attributeId,value from attributes where noteId=? and type=? and name=? and isDeleted=0',(id,kind,name)).fetchall()
            if found and (len(found)!=1 or found[0][1]!=value):raise RuntimeError('Unexpected launcher binding')
            if not found:db.execute('insert into attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) values(?,?,?,?,?,10,0,0,?)',(id+name,id,kind,name,value,utc))
    return {'installed':'Codex dark + day/night shortcut','backup':str(backup)}
