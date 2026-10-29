from pathlib import Path
from tempfile import TemporaryDirectory
from contextlib import closing
import sqlite3
from install_pomodoro import install

with TemporaryDirectory() as tmp:
    target=Path(tmp)/'document.db'
    with closing(sqlite3.connect('trilium-seed-data/document.db')) as source, closing(sqlite3.connect(target)) as db:
        source.backup(db)
    with closing(sqlite3.connect(target)) as db:
        before=db.execute("select b.content from notes n join blobs b on b.blobId=n.blobId where n.noteId='MyoQuestData'").fetchone()[0]
    install(target)
    install(target)
    with closing(sqlite3.connect(target)) as db:
        assert before==db.execute("select b.content from notes n join blobs b on b.blobId=n.blobId where n.noteId='MyoQuestData'").fetchone()[0]
        assert db.execute("select count(*) from branches where noteId='al_MyoPomoEntry' and parentNoteId='_lbVisibleLaunchers' and isDeleted=0").fetchone()[0]==1
        assert db.execute("select value from attributes where noteId='MyoPomoBoard' and name='renderNote' and isDeleted=0").fetchone()[0]=='MyoPomoUI01'
        assert db.execute("select value from attributes where noteId='MyoPomoRun1' and name='run' and isDeleted=0").fetchone()[0]=='frontendStartup'
print('PASS: repeat offline install, startup service, native launcher and preserved commission data')
