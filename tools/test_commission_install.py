"""Exercise the installer against a disposable copy of the sanitized seed."""
import json
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path
from install_commissions import install, EMPTY_BLOB_ID

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='commission-install-') as directory:
    path = Path(directory) / 'document.db'
    with closing(sqlite3.connect(root / 'trilium-seed-data/document.db')) as source, closing(sqlite3.connect(path)) as target:
        source.backup(target)
    install(path)
    with closing(sqlite3.connect(path)) as connection, connection:
        note_count = connection.execute('SELECT COUNT(*) FROM notes').fetchone()[0]
        blob_id = connection.execute("SELECT blobId FROM notes WHERE noteId='MyoQuestData'").fetchone()[0]
        test_data = {'version': 1, 'revision': 1, 'tasks': [{'title': 'preserve my task'}], 'events': [], 'products': [{'name':'preserve my product'}]}
        connection.execute('UPDATE blobs SET content=? WHERE blobId=?', (json.dumps(test_data), blob_id))
        connection.execute("UPDATE notes SET title='委托中心' WHERE noteId='MyoQuestBoard'")
        connection.execute("UPDATE notes SET title='学习委托' WHERE noteId='al_MyoQuestEntry'")
        # ETAPI-created native launchers have an empty MIME, unlike the seed.
        connection.execute("UPDATE notes SET mime='' WHERE noteId='al_MyoQuestEntry'")
    install(path)
    with closing(sqlite3.connect(path)) as connection, connection:
        assert connection.execute('SELECT COUNT(*) FROM notes').fetchone()[0] == note_count
        for component in ('MyoQuestBoard','al_MyoQuestEntry'):
            assert connection.execute('SELECT title FROM notes WHERE noteId=?',(component,)).fetchone()[0] == '人升'
        saved = json.loads(connection.execute('SELECT content FROM blobs WHERE blobId=?', (blob_id,)).fetchone()[0])
        assert saved == test_data, 'reinstallation overwrote personal tasks'
        assert connection.execute("SELECT COUNT(*) FROM branches WHERE noteId='al_MyoQuestEntry' AND parentNoteId='_lbVisibleLaunchers' AND isDeleted=0").fetchone()[0] == 1
        assert connection.execute("SELECT value FROM attributes WHERE noteId='MyoQuestBoard' AND name='renderNote' AND isDeleted=0").fetchone()[0] == 'MyoQuestUI01'
        for note_id in ('MyoQuestBoard', 'al_MyoQuestEntry'):
            blob_id_check, length = connection.execute('SELECT n.blobId,length(b.content) FROM notes n JOIN blobs b ON b.blobId=n.blobId WHERE n.noteId=?', (note_id,)).fetchone()
            # Mirror the native blob API: length == 0 and noncanonical ID means stubbed.
            assert not (length == 0 and blob_id_check != EMPTY_BLOB_ID), 'native UI would show content-not-synced'
        assert connection.execute("SELECT COUNT(*) FROM branches WHERE parentNoteId='_lbVisibleLaunchers' AND noteId IN ('al_MyoShopEntry','al_MyoStockEntry') AND isDeleted=0").fetchone()[0] == 0
    install(path, seed=True)
    with closing(sqlite3.connect(path)) as connection, connection:
        saved = json.loads(connection.execute('SELECT content FROM blobs WHERE blobId=?', (blob_id,)).fetchone()[0])
        assert saved['tasks'] == [] and saved['events'] == [] and saved['products'] == [], 'seed export leaked personal data'
print('PASS: native entry, render relation, repeat install, personal data preservation, clean seed')
