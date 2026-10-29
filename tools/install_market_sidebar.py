"""Expose the plugin market through a launcher; hide only its tree row."""
import datetime as dt
import json
import sqlite3
from contextlib import closing
from pathlib import Path
from apply_customizations import EtapiError, existing_attribute

ROOT=Path(__file__).resolve().parents[1]
LAUNCHER='al_MyoMarketEntry'

def install_live(api,root_id):
    root=api.get_note(root_id)
    if root['type']!='render' or not any(a['name']=='renderNote' and a['value']=='MyoMarketUI01' for a in root['attributes']):raise RuntimeError('Expected installed plugin market')
    api.get_note('_userHidden');api.get_note('_lbVisibleLaunchers')
    if not existing_attribute(root,'label','keepCurrentHoisting',''):
        api.add_attribute(root_id,{'type':'label','name':'keepCurrentHoisting','value':'','isInheritable':True})
    backup=ROOT/'backups'/('market-sidebar-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f'));backup.mkdir(parents=True)
    branches=[api.request('GET','/branches/'+id) for id in root['parentBranchIds']]
    (backup/'before-root.json').write_text(json.dumps({'note':root,'branches':branches},ensure_ascii=False,indent=2),encoding='utf8')
    try:launcher=api.get_note(LAUNCHER)
    except EtapiError as error:
        if 'HTTP 404' not in str(error):raise
        launcher=None
    if launcher:
        if launcher['type']!='launcher' or launcher['title']!='系统与插件':raise RuntimeError('Launcher ID collision')
    else:
        api.create_note({'noteId':LAUNCHER,'parentNoteId':'_lbVisibleLaunchers','title':'系统与插件','type':'launcher','content':'','notePosition':124})
    launcher=api.get_note(LAUNCHER)
    for kind,name,value in [('label','launcherType','note'),('label','iconClass','bx bx-briefcase'),('relation','target',root_id),('relation','hoistedNote','root')]:
        if not existing_attribute(launcher,kind,name,value):
            if any(a['type']==kind and a['name']==name for a in launcher['attributes']):raise RuntimeError('Unexpected launcher binding')
            api.add_attribute(LAUNCHER,{'type':kind,'name':name,'value':value,'isInheritable':False})
    # _hidden is excluded by native startup/appCss searches; retain normal storage.
    classes=[a for a in root['attributes'] if a['type']=='label' and a['name']=='cssClass' and a['noteId']==root_id]
    if classes:
        value=' '.join(dict.fromkeys((classes[0]['value']+' myo-system-components').split()))
        api.request('PATCH','/attributes/'+classes[0]['attributeId'],body={'value':value,'isInheritable':False})
    else:api.add_attribute(root_id,{'type':'label','name':'cssClass','value':'myo-system-components','isInheritable':False})
    if 'root' not in root['parentNoteIds']:api.request('POST','/branches',body={'noteId':root_id,'parentNoteId':'root','notePosition':70,'isExpanded':False})
    for branch in branches:
        if branch['parentNoteId']=='_userHidden':api.request('DELETE','/branches/'+branch['branchId'])
    actual=api.get_note(root_id)
    assert 'root' in actual['parentNoteIds'] and '_userHidden' not in actual['parentNoteIds']
    assert actual['childNoteIds']==root['childNoteIds']
    assert api.request('GET','/notes/'+root_id+'/content',accept='text/plain') is not None
    return {'installed':'native plugin market sidebar entry','rootId':root_id,'backup':str(backup),'childrenPreserved':len(root['childNoteIds'])}

def install(path):
    path=Path(path).resolve(strict=True);now=dt.datetime.now().astimezone();local=now.isoformat(sep=' ',timespec='milliseconds');utc=now.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    backup=path.parent/'backup'/f'before-market-sidebar-{now:%Y%m%d-%H%M%S-%f}.db';backup.parent.mkdir(exist_ok=True)
    with closing(sqlite3.connect(path)) as db,db:
        with closing(sqlite3.connect(backup)) as snapshot:db.backup(snapshot)
        roots=db.execute("select noteId from notes where title in ('系统与插件','Myosotis 程序组件') and type in ('text','render') and isDeleted=0").fetchall()
        if len(roots)!=1:raise RuntimeError('Expected one program root')
        root=roots[0][0]
        for id in ['_userHidden','_lbVisibleLaunchers']:
            if not db.execute('select 1 from notes where noteId=? and isDeleted=0',(id,)).fetchone():raise RuntimeError('Native hidden folder/launchbar missing')
        old=db.execute('select type,title,isDeleted from notes where noteId=?',(LAUNCHER,)).fetchone()
        if old and old!=('launcher','系统与插件',0):raise RuntimeError('Launcher ID collision')
        if not old:db.execute("insert into notes(noteId,title,type,mime,isProtected,blobId,isDeleted,dateCreated,dateModified,utcDateCreated,utcDateModified) values(?,?,'launcher','',0,'z4PhNX7vuL3xVChQ1m2A',0,?,?,?,?)",(LAUNCHER,'系统与插件',local,local,utc,utc))
        if not db.execute("select 1 from attributes where noteId=? and name='keepCurrentHoisting' and isDeleted=0",(root,)).fetchone():
            db.execute('insert into attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) values(?,?,\'label\',\'keepCurrentHoisting\',\'\',50,0,1,?)',(root+'KeepTree',root,utc))
        for kind,name,value in [('label','launcherType','note'),('label','iconClass','bx bx-briefcase'),('relation','target',root),('relation','hoistedNote','root')]:
            found=db.execute('select attributeId,value from attributes where noteId=? and type=? and name=? and isDeleted=0',(LAUNCHER,kind,name)).fetchall()
            if found and (len(found)!=1 or found[0][1]!=value):raise RuntimeError('Unexpected launcher binding')
            if not found:db.execute('insert into attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) values(?,?,?,?,?,10,0,0,?)',(LAUNCHER+name,LAUNCHER,kind,name,value,utc))
        classes=db.execute("select attributeId,value from attributes where noteId=? and type='label' and name='cssClass' and isDeleted=0",(root,)).fetchall()
        if classes:
            value=' '.join(dict.fromkeys((classes[0][1]+' myo-system-components').split()))
            db.execute('update attributes set value=?,isInheritable=0,utcDateModified=? where attributeId=?',(value,utc,classes[0][0]))
        else:db.execute("insert into attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) values(?,?,'label','cssClass','myo-system-components',60,0,0,?)",(root+'TreeClass',root,utc))
        for id,parent,position in [(LAUNCHER,'_lbVisibleLaunchers',124),(root,'root',70)]:
            if not db.execute('select 1 from branches where noteId=? and parentNoteId=? and isDeleted=0',(id,parent)).fetchone():
                old=db.execute('select branchId from branches where noteId=? and parentNoteId=?',(id,parent)).fetchone()
                if old:db.execute('update branches set isDeleted=0,isExpanded=0,notePosition=?,utcDateModified=? where branchId=?',(position,utc,old[0]))
                else:db.execute('insert into branches(branchId,noteId,parentNoteId,notePosition,isExpanded,isDeleted,utcDateModified) values(?,?,?,?,0,0,?)',(id+'Sidebar'+parent,id,parent,position,utc))
        db.execute('update branches set isDeleted=1,utcDateModified=? where noteId=? and parentNoteId=? and isDeleted=0',(utc,root,'_userHidden'))
    return {'installed':'native plugin market sidebar entry','backup':str(backup)}
