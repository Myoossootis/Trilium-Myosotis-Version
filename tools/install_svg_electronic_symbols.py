"""Switch Electronic Symbols to its original SVGs without changing icon IDs."""
import argparse
import datetime as dt
import json
import sqlite3
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def build():
    original = json.loads((ROOT / 'electronic-symbols-font-20260918/icon-pack.json').read_text(encoding='utf-8'))
    sources = json.loads((ROOT / 'electronic-symbols-font-20260918/source-manifest.json').read_text(encoding='utf-8'))
    icons = {}
    for item in sources:
        icon = original['icons'][item['id']]
        svg = (ROOT / 'vendor-electronic-symbols-20260918' / item['svg']).read_text(encoding='utf-8')
        icons[item['id']] = {'svg': svg, 'terms': icon['terms']}
    if icons.keys() != original['icons'].keys():
        raise RuntimeError('SVG/font icon IDs do not match')
    return {'format': 'svg', 'version': 1, 'icons': icons}

def install(path):
    path = path.resolve(strict=True)
    payload = json.dumps(build(), ensure_ascii=False)
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))
    utc = now.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    backup = path.parent / 'backup' / f'before-svg-icons-{now:%Y%m%d-%H%M%S-%f}.db'
    backup.parent.mkdir(exist_ok=True)
    with closing(sqlite3.connect(path,timeout=20)) as conn, conn:
        with closing(sqlite3.connect(backup)) as target: conn.backup(target)
        conn.execute('BEGIN IMMEDIATE')
        rows = conn.execute("SELECT n.noteId,n.blobId,n.type,n.mime,n.isProtected FROM notes n JOIN attributes a ON a.noteId=n.noteId WHERE a.name='iconPack' AND a.type='label' AND a.value='electronic-symbols' AND a.isDeleted=0 AND n.isDeleted=0").fetchall()
        if len(rows)!=1: raise RuntimeError('Expected exactly one Electronic Symbols pack')
        note_id, old_blob, kind, mime, protected = rows[0]
        if protected or kind not in ('code','file') or mime!='application/json': raise RuntimeError('Unavailable SVG pack note')
        # Dedicated blob avoids changing revisions or other notes sharing the old content.
        blob = 'MyoElectronicSvgBlob'
        if conn.execute('SELECT 1 FROM notes WHERE blobId=? AND noteId<>?',(blob,note_id)).fetchone(): raise RuntimeError('SVG blob ID collision')
        conn.execute('INSERT INTO blobs(blobId,content,textRepresentation,dateModified,utcDateModified) VALUES(?,?,?,?,?) ON CONFLICT(blobId) DO UPDATE SET content=excluded.content,textRepresentation=excluded.textRepresentation,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified',(blob,payload,payload,now.isoformat(sep=' ',timespec='milliseconds'),utc))
        conn.execute('UPDATE notes SET blobId=?,dateModified=?,utcDateModified=? WHERE noteId=?',(blob,now.isoformat(sep=' ',timespec='milliseconds'),utc,note_id))
    return {'noteId':note_id,'format':'svg','icons':len(build()['icons']),'backup':str(backup),'fontFallbackPreserved':True}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db',type=Path)
    parser.add_argument('--build',type=Path,help='Generate the SVG manifest asset only')
    args=parser.parse_args()
    if args.build:
        args.build.parent.mkdir(parents=True,exist_ok=True)
        args.build.write_text(json.dumps(build(),ensure_ascii=False,indent=2),encoding='utf-8')
    if args.db: print(json.dumps(install(args.db),ensure_ascii=False))
