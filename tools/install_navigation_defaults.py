"""Keep the portable seed's root-note creation and browsing-only calendar in sync."""
import datetime as dt
import json
import sqlite3
from pathlib import Path
from contextlib import closing
ROOT=Path(__file__).resolve().parents[1]

def install(path):
    path=Path(path).resolve(strict=True);now=dt.datetime.now().astimezone();local=now.isoformat(sep=' ',timespec='milliseconds');utc=now.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    backup=path.parent/'backup'/f'before-navigation-defaults-{now:%Y%m%d-%H%M%S-%f}.db';backup.parent.mkdir(exist_ok=True)
    keys={'calendar_view_only','create_root_note','commission_open','pomodoro_open','codex_toggle','codex_toggle_css'}
    notes=[n for n in json.loads((ROOT/'customizations-manifest.json').read_text(encoding='utf8'))['notes'] if n['key'] in keys or n.get('noteId') in ('MyoQuestOpen','MyoPomoOpen')]
    with closing(sqlite3.connect(path)) as db,db:
        with closing(sqlite3.connect(backup)) as snapshot:db.backup(snapshot)
        root=db.execute("select noteId from notes where title in ('系统与插件','Myosotis 程序组件') and type in ('text','render') and isDeleted=0").fetchone()[0]
        def attr(id,kind,name,value,inherit=0):
            found=db.execute('select attributeId from attributes where noteId=? and type=? and name=? and isDeleted=0',(id,kind,name)).fetchone()
            if found:db.execute('update attributes set value=?,isInheritable=?,utcDateModified=? where attributeId=?',(value,inherit,utc,found[0]))
            else:db.execute('insert into attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) values(?,?,?,?,?,50,0,?,?)',(id+'Nav'+name,id,kind,name,value,inherit,utc))
        for item in notes:
            id=item['noteId'];content=(ROOT/item['path']).read_text(encoding='utf8');blob=id+'B'
            old=db.execute('select title,type from notes where noteId=?',(id,)).fetchone()
            if old and old!=(item['title'],'code'):raise RuntimeError('Component ID collision')
            db.execute('insert into blobs(blobId,content,dateModified,utcDateModified,textRepresentation) values(?,?,?,?,?) on conflict(blobId) do update set content=excluded.content,textRepresentation=excluded.textRepresentation,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified',(blob,content,local,utc,content))
            db.execute('insert into notes(noteId,title,type,mime,isProtected,blobId,isDeleted,dateCreated,dateModified,utcDateCreated,utcDateModified) values(?,?,?,?,0,?,0,?,?,?,?) on conflict(noteId) do update set mime=excluded.mime,blobId=excluded.blobId,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified',(id,item['title'],'code',item['mime'],blob,local,local,utc,utc))
            if not old:
                parent='MyoReadNav01' if db.execute("select 1 from notes where noteId='MyoReadNav01'").fetchone() else root
                db.execute('insert into branches(branchId,noteId,parentNoteId,notePosition,isExpanded,isDeleted,utcDateModified) values(?,?,?,70,0,0,?)',(id+'NavBr',id,parent,utc))
            for name,value in item['labels']:
                if db.execute('select 1 from attributes where noteId=? and name=? and isDeleted=0',(id,'myoDisabled_'+name)).fetchone():name='myoDisabled_'+name
                attr(id,'label',name,value)
        attr('_lbNewNote','label','launcherType','script');attr('_lbNewNote','relation','script','MyoNewRoot1')
        attr(root,'label','keepCurrentHoisting','',1)
        for id in ['MyoQuestBoard','MyoPomoBoard']:attr(id,'label','keepCurrentHoisting','')
    return {'installed':'navigation defaults','backup':str(backup)}
