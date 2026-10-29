"""Copy this one note into an isolated test seed. Never write the personal DB."""
import sqlite3
from contextlib import closing
from pathlib import Path
from install_dictionary_table_styles import install

ROOT=Path(__file__).resolve().parents[1]
target=ROOT/'tmp-table-style/native-data/document.db'
target.parent.mkdir(parents=True,exist_ok=True)
with closing(sqlite3.connect(ROOT/'trilium-seed-data/document.db')) as seed,closing(sqlite3.connect(target)) as output:
    seed.backup(output)
with closing(sqlite3.connect(Path('C:/Users/杜锦鸿/AppData/Roaming/trilium-data/document.db').as_uri()+'?mode=ro',uri=True)) as source,closing(sqlite3.connect(target)) as output,output:
    note_id='y17XiEzjty0k'
    title,content=source.execute('SELECT n.title,b.content FROM notes n JOIN blobs b ON b.blobId=n.blobId WHERE n.noteId=? AND n.isDeleted=0 AND n.isProtected=0',(note_id,)).fetchone()
    utc='2026-10-12T12:00:00Z'
    blob='MyoTableTestBlob'
    output.execute('INSERT OR REPLACE INTO blobs(blobId,content,textRepresentation,dateModified,utcDateModified) VALUES(?,?,?,?,?)',(blob,content,content,utc,utc))
    output.execute("INSERT OR REPLACE INTO notes(noteId,title,type,mime,isProtected,blobId,isDeleted,dateCreated,dateModified,utcDateCreated,utcDateModified) VALUES(?,?,'text','text/html',0,?,0,?,?,?,?)",(note_id,title,blob,utc,utc,utc,utc))
    output.execute("INSERT OR REPLACE INTO branches(branchId,noteId,parentNoteId,notePosition,isExpanded,isDeleted,utcDateModified) VALUES('MyoTableTestBranch',?,'root',5,0,0,?)",(note_id,utc))
    for suffix,name,value in [('Class','cssClass','eric-knowledge-base'),('ReadOnly','readOnly','true')]:
        output.execute("INSERT OR REPLACE INTO attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) VALUES(?,?,'label',?,?,10,0,0,?)",('MyoTableTest'+suffix,note_id,name,value,utc))
install(target)
print('Created isolated table test database:',target)
