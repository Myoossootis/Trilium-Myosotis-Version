"""Back up and update only the dictionary CSS program note; never user tables."""
import argparse
import datetime as dt
import sqlite3
from contextlib import closing
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def install(database,backup_only=False):
    database=database.resolve(strict=True)
    now=dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))
    utc=now.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    backup=database.parent/'backup'/f'before-table-display-{now:%Y%m%d-%H%M%S-%f}.db'
    backup.parent.mkdir(exist_ok=True)
    with closing(sqlite3.connect(database,timeout=20)) as connection,connection:
        rows=connection.execute("SELECT noteId,type,mime,isProtected FROM notes WHERE title='字典排版 · 学术与硬件' AND isDeleted=0").fetchall()
        if len(rows)!=1 or rows[0][1:]!=('code','text/css',0):raise RuntimeError('Expected one unprotected typography CSS note')
        note_id=rows[0][0]
        with closing(sqlite3.connect(backup)) as target:connection.backup(target)
        if not backup_only:
            connection.execute('BEGIN IMMEDIATE')
            blob='MyoDictionaryTableStyle'
            if connection.execute('SELECT 1 FROM notes WHERE blobId=? AND noteId<>?',(blob,note_id)).fetchone():raise RuntimeError('Shared CSS blob collision')
            css=(ROOT/'trilium-dictionary-layout.css').read_text(encoding='utf-8')
            connection.execute('INSERT INTO blobs(blobId,content,textRepresentation,dateModified,utcDateModified) VALUES(?,?,?,?,?) ON CONFLICT(blobId) DO UPDATE SET content=excluded.content,textRepresentation=excluded.textRepresentation,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified',(blob,css,css,now.isoformat(sep=' ',timespec='milliseconds'),utc))
            connection.execute('UPDATE notes SET blobId=?,dateModified=?,utcDateModified=? WHERE noteId=?',(blob,now.isoformat(sep=' ',timespec='milliseconds'),utc,note_id))
    print('CSS component:',note_id,'backup:',backup,'backupOnly:',backup_only)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db',type=Path,required=True)
    parser.add_argument('--backup-only',action='store_true')
    args=parser.parse_args();install(args.db,args.backup_only)
