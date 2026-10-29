"""Restore only the Electronic Symbols note, never roll back the user's database."""
import argparse
import datetime as dt
import sqlite3
from contextlib import closing
from pathlib import Path

def restore(database, snapshot):
    database=database.resolve(strict=True)
    snapshot=snapshot.resolve(strict=True)
    now=dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))
    backup=database.parent/'backup'/f'before-svg-recovery-{now:%Y%m%d-%H%M%S-%f}.db'
    backup.parent.mkdir(exist_ok=True)
    with closing(sqlite3.connect(snapshot.as_uri()+'?mode=ro',uri=True)) as previous:
        row=previous.execute("SELECT n.noteId,n.blobId,n.dateModified,n.utcDateModified FROM notes n JOIN attributes a ON a.noteId=n.noteId WHERE a.name='iconPack' AND a.type='label' AND a.value='electronic-symbols' AND a.isDeleted=0 AND n.isDeleted=0").fetchall()
        if len(row)!=1: raise RuntimeError('Expected one original pack')
        note_id,blob,modified,utc=row[0]
        with closing(sqlite3.connect(database,timeout=20)) as current,current:
            with closing(sqlite3.connect(backup)) as target:current.backup(target)
            current.execute('BEGIN IMMEDIATE')
            if not current.execute('SELECT 1 FROM blobs WHERE blobId=?',(blob,)).fetchone():raise RuntimeError('Original font manifest blob missing')
            current.execute('UPDATE notes SET blobId=?,dateModified=?,utcDateModified=? WHERE noteId=?',(blob,modified,utc,note_id))
    print('Restored only Electronic Symbols; all other notes retained. Backup:',backup)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--db',required=True,type=Path)
    p.add_argument('--snapshot',required=True,type=Path)
    a=p.parse_args();restore(a.db,a.snapshot)
