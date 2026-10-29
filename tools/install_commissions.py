"""Install the independent commission board and native launch-bar entry.

Program code is updated, but existing task/ledger data is NEVER overwritten.
Uses a SQLite snapshot backup before changes; normal restart is required.
"""
import argparse
import datetime as dt
import json
import sqlite3
from contextlib import closing
from pathlib import Path
from plugin_groups import create_folder

ROOT = Path(__file__).resolve().parents[1]
EMPTY = {'version': 1, 'revision': 0, 'tasks': [], 'events': [], 'products': [], 'categories': []}
# Trilium distinguishes its canonical empty blob from unsynced blob stubs.
EMPTY_BLOB_ID = 'z4PhNX7vuL3xVChQ1m2A'


def install(path, *, seed=False):
    path = path.resolve(strict=True)
    now = dt.datetime.now().astimezone()
    local = now.isoformat(sep=' ', timespec='milliseconds')
    utc = now.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    backup = path.parent / 'backup' / f'before-commissions-{now:%Y%m%d-%H%M%S-%f}.db'
    backup.parent.mkdir(exist_ok=True)
    with closing(sqlite3.connect(path, timeout=20)) as connection, connection:
        with closing(sqlite3.connect(backup)) as target:
            connection.backup(target)
        connection.execute('BEGIN IMMEDIATE')
        parents = connection.execute("SELECT noteId FROM notes WHERE title='系统与插件' AND type IN ('text','render') AND isDeleted=0").fetchall()
        if not parents:
            parents = connection.execute("SELECT noteId FROM notes WHERE title='Myosotis 程序组件' AND type IN ('text','render') AND isDeleted=0").fetchall()
        if len(parents) > 1:
            raise RuntimeError('Multiple program folders found')
        if parents:
            parent = parents[0][0]
        else:
            parent = 'MyoPluginRoot'
            create_folder(connection, parent, '系统与插件', 'root', 'MyoPluginRootBr', local, utc)
        groups = connection.execute(
            "SELECT n.noteId FROM notes n JOIN branches b ON b.noteId=n.noteId WHERE n.title='学习 RPG' "
            "AND n.isDeleted=0 AND b.isDeleted=0 AND b.parentNoteId=?", (parent,)).fetchall()
        if len(groups) > 1:
            raise RuntimeError('Multiple learning RPG folders found')
        group = groups[0][0] if groups else 'MyoQuestGroup'
        if not groups:
            create_folder(connection, group, '学习 RPG', parent, 'MyoQuestGroupBr', local, utc)

        def put(note_id, title, kind, mime, content, parent_id, preserve=False):
            old = connection.execute('SELECT title,type,mime,isDeleted,isProtected,blobId FROM notes WHERE noteId=?', (note_id,)).fetchone()
            legacy_title = {'MyoQuestBoard': '委托中心', 'al_MyoQuestEntry': '学习委托'}.get(note_id)
            compatible_type = old and old[1] == kind and (old[2] == mime or (kind == 'launcher' and old[2] == ''))
            if old and (old[0] not in (title, legacy_title) or not compatible_type or old[3] or old[4]):
                raise RuntimeError(f'Component ID collision or unavailable note: {note_id}')
            if not (old and preserve):
                blob_id = EMPTY_BLOB_ID if content == '' else note_id + 'B'
                if content != '' and connection.execute('SELECT 1 FROM notes WHERE blobId=? AND noteId<>?', (blob_id, note_id)).fetchone():
                    raise RuntimeError(f'Shared component blob: {note_id}')
                if content == '':
                    canonical = connection.execute('SELECT length(content) FROM blobs WHERE blobId=?', (EMPTY_BLOB_ID,)).fetchone()
                    if not canonical or canonical[0] != 0:
                        raise RuntimeError('Trilium canonical empty blob is missing or invalid')
                else:
                    connection.execute(
                        'INSERT INTO blobs(blobId,content,dateModified,utcDateModified,textRepresentation) VALUES(?,?,?,?,?) '
                        'ON CONFLICT(blobId) DO UPDATE SET content=excluded.content,dateModified=excluded.dateModified,'
                        'utcDateModified=excluded.utcDateModified,textRepresentation=excluded.textRepresentation',
                        (blob_id, content, local, utc, content))
                connection.execute(
                    'INSERT INTO notes(noteId,title,type,mime,isProtected,blobId,isDeleted,dateCreated,dateModified,utcDateCreated,utcDateModified) '
                    'VALUES(?,?,?,?,0,?,0,?,?,?,?) ON CONFLICT(noteId) DO UPDATE SET title=excluded.title,blobId=excluded.blobId,'
                    'dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified',
                    (note_id, title, kind, mime, blob_id, local, local, utc, utc))
            if not connection.execute('SELECT 1 FROM branches WHERE noteId=? AND parentNoteId=? AND isDeleted=0', (note_id, parent_id)).fetchone():
                connection.execute('INSERT INTO branches(branchId,noteId,parentNoteId,notePosition,isExpanded,isDeleted,utcDateModified) VALUES(?,?,?,100,0,0,?)',
                                   (note_id + 'Br', note_id, parent_id, utc))

        def attr(note_id, kind, name, value, suffix):
            if connection.execute("SELECT 1 FROM attributes WHERE noteId=? AND type=? AND name=? AND isDeleted=0",(note_id,kind,"myoDisabled_"+name)).fetchone():name="myoDisabled_"+name
            old = connection.execute('SELECT attributeId,value FROM attributes WHERE noteId=? AND type=? AND name=? AND isDeleted=0', (note_id, kind, name)).fetchall()
            if len(old) > 1:
                raise RuntimeError(f'Duplicate component attribute: {name}')
            if old:
                if old[0][1] != value:
                    connection.execute('UPDATE attributes SET value=?,utcDateModified=? WHERE attributeId=?', (value, utc, old[0][0]))
            else:
                connection.execute("INSERT INTO attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) VALUES(?,?,?,?,?,10,0,0,?)",
                                   (note_id + suffix, note_id, kind, name, value, utc))

        specs = [
            ('MyoQuestSvc1', '委托数据服务', 'application/javascript;env=backend', 'customizations/backend/commission-service.js'),
            ('MyoQuestUI01', '委托中心界面', 'text/jsx', 'customizations/frontend/commission-board.jsx'),
            ('MyoQuestCSS1', '委托中心样式', 'text/css', 'customizations/frontend/commission-board.css'),
            ('MyoQuestOpen', '打开委托中心', 'application/javascript;env=frontend', 'customizations/frontend/open-commissions.js'),
        ]
        for note_id, title, mime, file in specs:
            put(note_id, title, 'code', mime, (ROOT / file).read_text(encoding='utf-8'), group)
            attr(note_id, 'label', 'homeInternal', '', 'Internal')
        attr('MyoQuestCSS1', 'label', 'appCss', '', 'AppCss')
        put('MyoQuestData', '委托与奖励数据', 'code', 'application/json', json.dumps(EMPTY), group, preserve=not seed)
        attr('MyoQuestData', 'label', 'commissionData', '', 'Data')
        attr('MyoQuestData', 'label', 'homeInternal', '', 'Internal')
        windows = [
            ('MyoQuestBoard', '人升', 'bx bx-task', 'al_MyoQuestEntry', 'MyoQuestOpen'),
        ]
        for note_id, title, icon, _, _ in windows:
            put(note_id, title, 'render', 'text/html', '', group)
            attr(note_id, 'relation', 'renderNote', 'MyoQuestUI01', 'Renderer')
            attr(note_id, 'label', 'iconClass', icon, 'Icon')
            attr(note_id, 'label', 'homeInternal', '', 'Internal')
        # Retire only the two launchers introduced by the separate-tab design.
        connection.execute(
            "UPDATE branches SET parentNoteId=?,utcDateModified=? WHERE parentNoteId='_lbVisibleLaunchers' "
            "AND noteId IN ('al_MyoShopEntry','al_MyoStockEntry') AND isDeleted=0",
            (group, utc))
        if not connection.execute("SELECT 1 FROM notes WHERE noteId='_lbVisibleLaunchers' AND isDeleted=0").fetchone():
            raise RuntimeError('Native launch bar not found; refusing incomplete installation')
        # Place it just before the first spacer, leaving all existing entries alone.
        spacer = connection.execute(
            "SELECT MIN(b.notePosition) FROM branches b JOIN attributes a ON a.noteId=b.noteId "
            "WHERE b.parentNoteId='_lbVisibleLaunchers' AND b.isDeleted=0 AND a.isDeleted=0 "
            "AND a.name='builtinWidget' AND a.value='spacer'").fetchone()[0]
        position = max(1, spacer - len(windows)) if spacer is not None else 90
        for offset, (_, title, icon, launcher_id, script_id) in enumerate(windows):
            put(launcher_id, title, 'launcher', 'text/html', '', '_lbVisibleLaunchers')
            attr(launcher_id, 'label', 'launcherType', 'script', 'Type')
            attr(launcher_id, 'relation', 'script', script_id, 'Script')
            attr(launcher_id, 'label', 'iconClass', icon, 'Icon')
            connection.execute('UPDATE branches SET notePosition=?,utcDateModified=? WHERE noteId=? AND parentNoteId=? AND isDeleted=0',
                               (position + offset, utc, launcher_id, '_lbVisibleLaunchers'))
    return {'installed': '人升', 'entry': '左侧导航栏', 'backup': str(backup), 'existingDataPreserved': True, 'restartRequired': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    print(json.dumps(install(parser.parse_args().db), ensure_ascii=False))
