"""Install only the reading-position startup script, with a SQLite snapshot backup.

Running instances load this new component after a normal restart. No user note
content, tabs, options, credentials or existing startup scripts are changed.
"""
import argparse
import datetime as dt
import json
import sqlite3
from pathlib import Path
from plugin_groups import ensure_navigation_group, group_components

ROOT = Path(__file__).resolve().parents[1]
NOTE_ID = "MyoReadPos01"
BLOB_ID = "MyoReadBlob1"
TITLE = "阅读位置记忆与恢复"


def install(path, *, note_id=NOTE_ID, blob_id=BLOB_ID, title=TITLE,
            source_path="customizations/frontend/reading-position.js", id_prefix="MyoRead",
            backup_label="reading-position"):
    NOTE_ID, BLOB_ID, TITLE = note_id, blob_id, title
    path = path.resolve(strict=True)
    source = (ROOT / source_path).read_text(encoding="utf-8")
    now = dt.datetime.now().astimezone()
    local = now.isoformat(sep=" ", timespec="milliseconds")
    utc = now.astimezone(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    backup = path.parent / "backup" / f"before-{backup_label}-{now:%Y%m%d-%H%M%S-%f}.db"
    backup.parent.mkdir(exist_ok=True)
    with sqlite3.connect(path, timeout=20) as connection:
        with sqlite3.connect(backup) as target:
            connection.backup(target)
        connection.execute("BEGIN IMMEDIATE")
        collision = connection.execute("SELECT title FROM notes WHERE noteId=?", (NOTE_ID,)).fetchone()
        if collision and collision[0] != TITLE:
            raise RuntimeError("Reading-position component ID collision")
        if connection.execute("SELECT 1 FROM notes WHERE blobId=? AND noteId<>?", (BLOB_ID, NOTE_ID)).fetchone():
            raise RuntimeError("Reading-position blob is shared; refusing to overwrite")
        connection.execute(
            "INSERT INTO blobs(blobId,content,dateModified,utcDateModified,textRepresentation) VALUES(?,?,?,?,?) "
            "ON CONFLICT(blobId) DO UPDATE SET content=excluded.content,dateModified=excluded.dateModified,"
            "utcDateModified=excluded.utcDateModified,textRepresentation=excluded.textRepresentation",
            (BLOB_ID, source, local, utc, source))
        connection.execute(
            "INSERT INTO notes(noteId,title,type,mime,isProtected,blobId,isDeleted,dateCreated,dateModified,utcDateCreated,utcDateModified) "
            "VALUES(?,?,'code','application/javascript;env=frontend',0,?,0,?,?,?,?) "
            "ON CONFLICT(noteId) DO UPDATE SET blobId=excluded.blobId,dateModified=excluded.dateModified,"
            "utcDateModified=excluded.utcDateModified,isDeleted=0",
            (NOTE_ID, TITLE, BLOB_ID, local, local, utc, utc))
        parent = ensure_navigation_group(connection, local, utc)
        if not connection.execute("SELECT 1 FROM branches WHERE noteId=? AND isDeleted=0", (NOTE_ID,)).fetchone():
            connection.execute(
                "INSERT INTO branches(branchId,noteId,parentNoteId,notePosition,isExpanded,isDeleted,utcDateModified) VALUES(?,?,?,999,0,0,?)",
                (f"{id_prefix}Br01", NOTE_ID, parent, utc))
        group_components(connection, parent, utc)
        for index, (name, value) in enumerate([("run", "frontendStartup"), ("homeInternal", "")]):
            if not connection.execute("SELECT 1 FROM attributes WHERE noteId=? AND name=? AND value=? AND isDeleted=0", (NOTE_ID, name, value)).fetchone():
                connection.execute(
                    "INSERT INTO attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) VALUES(?,?,'label',?,?,?,0,0,?)",
                    (f"{id_prefix}A{index:03d}", NOTE_ID, name, value, index * 10, utc))
    return {"installed": TITLE, "backup": str(backup), "restartRequired": True}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(install(args.db), ensure_ascii=False))
