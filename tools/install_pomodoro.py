"""Install independent Pomodoro components in an offline Trilium database."""
import datetime as dt
import json
import sqlite3
from pathlib import Path
from contextlib import closing
from plugin_groups import create_folder

ROOT = Path(__file__).resolve().parents[1]

def install(path):
    path=Path(path).resolve(strict=True)
    now=dt.datetime.now().astimezone()
    local=now.isoformat(sep=' ',timespec='milliseconds')
    utc=now.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    backup=path.parent/'backup'/f'before-pomodoro-{now:%Y%m%d-%H%M%S-%f}.db'
    backup.parent.mkdir(exist_ok=True)
    specs=[item for item in json.loads((ROOT/'customizations-manifest.json').read_text(encoding='utf-8'))['notes'] if item.get('group')=='番茄钟']
    with closing(sqlite3.connect(path)) as db, db:
        with closing(sqlite3.connect(backup)) as snapshot: db.backup(snapshot)
        db.execute('BEGIN IMMEDIATE')
        roots=db.execute("select noteId from notes where title in ('系统与插件','Myosotis 程序组件') and type in ('text','render') and isDeleted=0").fetchall()
        if len(roots)!=1: raise RuntimeError('Expected exactly one program component root')
        parent=roots[0][0]
        groups=db.execute("select n.noteId from notes n join branches b on b.noteId=n.noteId where n.title='番茄钟' and n.type='text' and n.isDeleted=0 and b.isDeleted=0 and b.parentNoteId=?",(parent,)).fetchall()
        if len(groups)>1: raise RuntimeError('Duplicate timer groups')
        group=groups[0][0] if groups else 'MyoPomoGroup'
        if not groups: create_folder(db,group,'番茄钟',parent,'MyoPomoGroupBr',local,utc)
        if not db.execute("select 1 from notes where noteId='_lbVisibleLaunchers' and isDeleted=0").fetchone(): raise RuntimeError('Native launch bar missing')
        ids={item['key']:item['noteId'] for item in specs}
        for item in specs:
            note_id=item['noteId']
            old=db.execute('select title,type,isDeleted,isProtected from notes where noteId=?',(note_id,)).fetchone()
            if old and old!=(item['title'],item['type'],0,0): raise RuntimeError(f'Component ID collision: {note_id}')
            content=(ROOT/item['path']).read_text(encoding='utf-8') if item['path'] else ''
            blob_id=note_id+'B' if content else 'z4PhNX7vuL3xVChQ1m2A'
            if content:
                if db.execute('select 1 from notes where blobId=? and noteId<>?',(blob_id,note_id)).fetchone(): raise RuntimeError('Shared component blob')
                db.execute('insert into blobs(blobId,content,dateModified,utcDateModified,textRepresentation) values(?,?,?,?,?) on conflict(blobId) do update set content=excluded.content,textRepresentation=excluded.textRepresentation,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified',(blob_id,content,local,utc,content))
            db.execute('insert into notes(noteId,title,type,mime,isProtected,blobId,isDeleted,dateCreated,dateModified,utcDateCreated,utcDateModified) values(?,?,?,?,0,?,0,?,?,?,?) on conflict(noteId) do update set blobId=excluded.blobId,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified',(note_id,item['title'],item['type'],item.get('mime','text/html'),blob_id,local,local,utc,utc))
            parent_id=item.get('parentNoteId',group)
            if not db.execute('select 1 from branches where noteId=? and parentNoteId=? and isDeleted=0',(note_id,parent_id)).fetchone():
                db.execute('insert into branches(branchId,noteId,parentNoteId,notePosition,isExpanded,isDeleted,utcDateModified) values(?,?,?,?,0,0,?)',(note_id+'Br',note_id,parent_id,item.get('notePosition',10),utc))
            attrs=[('label',name,value) for name,value in item.get('labels',[])]+[('relation',name,ids[target]) for name,target in item.get('relations',[])]
            for i,(kind,name,value) in enumerate(attrs):
                if db.execute("select 1 from attributes where noteId=? and type=? and name=? and isDeleted=0",(note_id,kind,"myoDisabled_"+name)).fetchone():name="myoDisabled_"+name
                found=db.execute('select attributeId from attributes where noteId=? and type=? and name=? and isDeleted=0',(note_id,kind,name)).fetchall()
                if len(found)>1: raise RuntimeError('Duplicate component attribute')
                if found: db.execute('update attributes set value=?,utcDateModified=? where attributeId=?',(value,utc,found[0][0]))
                else: db.execute('insert into attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) values(?,?,?,?,?,?,0,0,?)',(note_id+'Attr'+str(i),note_id,kind,name,value,10+i,utc))
    return {'installed':'番茄钟','backup':str(backup)}

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db',type=Path,required=True)
    print(json.dumps(install(parser.parse_args().db),ensure_ascii=False))
