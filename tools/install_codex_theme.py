#!/usr/bin/env python3
"""Install the switchable Codex theme in a local Trilium database.

Only the theme note, its stylesheet/labels/branch, and (with --activate) the
theme preference are written. Restart Trilium afterwards to reload its cache.
The normal installer uses ETAPI; this local fallback works without an API token.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TITLE = "Codex 风格应用界面"
THEME = "codex-ui"


def install(database: Path, activate: bool, backup: bool) -> dict:
    database = database.resolve(strict=True)
    css = (ROOT / "trilium-codex-ui.css").read_text(encoding="utf-8")
    now = dt.datetime.now().astimezone()
    local = now.isoformat(sep=" ", timespec="milliseconds")
    utc = now.astimezone(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    connection = sqlite3.connect(database, timeout=15)
    backup_path = None
    try:
        if backup:
            backup_dir = database.parent / "backup"
            backup_dir.mkdir(exist_ok=True)
            backup_path = backup_dir / f"before-codex-ui-{now:%Y%m%d-%H%M%S-%f}.db"
            with sqlite3.connect(backup_path) as destination:
                connection.backup(destination)

        connection.execute("BEGIN IMMEDIATE")
        matches = connection.execute(
            "SELECT noteId,type,mime,isProtected FROM notes WHERE isDeleted=0 AND title=?", (TITLE,)
        ).fetchall()
        if len(matches) > 1:
            raise RuntimeError("Multiple Codex theme notes found; refusing to choose one.")
        if matches and matches[0][1:] != ("code", "text/css", 0):
            raise RuntimeError("The existing note with this title is not an unprotected CSS theme.")
        note_id = matches[0][0] if matches else "MyoCodexUI01"
        if not matches and connection.execute(
            "SELECT 1 FROM notes WHERE noteId=?", (note_id,)
        ).fetchone():
            raise RuntimeError("Theme note ID is already used by another note.")

        # Use a dedicated blob so updating the theme cannot alter a shared blob.
        blob_id = "MyoCodexCss1"
        if connection.execute(
            "SELECT 1 FROM notes WHERE blobId=? AND noteId<>?", (blob_id, note_id)
        ).fetchone():
            raise RuntimeError("Theme blob ID is referenced by another note.")
        connection.execute(
            "INSERT INTO blobs (blobId,content,dateModified,utcDateModified,textRepresentation) "
            "VALUES (?,?,?,?,?) ON CONFLICT(blobId) DO UPDATE SET "
            "content=excluded.content,dateModified=excluded.dateModified,"
            "utcDateModified=excluded.utcDateModified,textRepresentation=excluded.textRepresentation",
            (blob_id, css, local, utc, css),
        )
        connection.execute(
            "INSERT INTO notes (noteId,title,isProtected,type,mime,blobId,isDeleted,deleteId,"
            "dateCreated,dateModified,utcDateCreated,utcDateModified) "
            "VALUES (?,?,0,'code','text/css',?,0,NULL,?,?,?,?) "
            "ON CONFLICT(noteId) DO UPDATE SET blobId=excluded.blobId,"
            "dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified",
            (note_id, TITLE, blob_id, local, local, utc, utc),
        )

        # The old appCss registration made the style global and unswitchable.
        connection.execute(
            "UPDATE attributes SET isDeleted=1,utcDateModified=? "
            "WHERE noteId=? AND type='label' AND name='appCss' AND isDeleted=0",
            (utc, note_id),
        )
        for index, (name, value) in enumerate(
            [("appTheme", THEME), ("appThemeBase", "next-light"),
             ("homeInternal", ""), ("iconClass", "bx bx-palette")], start=1
        ):
            attribute = connection.execute(
                "SELECT attributeId FROM attributes WHERE noteId=? AND type='label' "
                "AND name=? AND isDeleted=0", (note_id, name)
            ).fetchone()
            if attribute:
                connection.execute(
                    "UPDATE attributes SET value=?,utcDateModified=? WHERE attributeId=?",
                    (value, utc, attribute[0]),
                )
            else:
                connection.execute(
                    "INSERT INTO attributes (attributeId,noteId,type,name,value,position,"
                    "utcDateModified,isDeleted,deleteId,isInheritable) "
                    "VALUES (?,?,'label',?,?,?,?,0,NULL,0)",
                    (f"MyoCodexA{index:03d}", note_id, name, value, index * 10, utc),
                )
        if not connection.execute(
            "SELECT 1 FROM branches WHERE noteId=? AND isDeleted=0", (note_id,)
        ).fetchone():
            parent = connection.execute(
                "SELECT noteId FROM notes WHERE isDeleted=0 AND title IN "
                "('Myosotis 程序组件','🎨 主题与外观') ORDER BY title LIMIT 1"
            ).fetchone()
            parent_id = parent[0] if parent else "root"
            position = connection.execute(
                "SELECT COALESCE(MAX(notePosition),0)+10 FROM branches WHERE parentNoteId=?",
                (parent_id,),
            ).fetchone()[0]
            connection.execute(
                "INSERT INTO branches (branchId,noteId,parentNoteId,notePosition,prefix,"
                "isExpanded,isDeleted,deleteId,utcDateModified) VALUES (?,?,?,?,NULL,0,0,NULL,?)",
                ("MyoCodexBr01", note_id, parent_id, position, utc),
            )
        previous = connection.execute("SELECT value FROM options WHERE name='theme'").fetchone()
        if activate:
            connection.execute(
                "INSERT INTO options (name,value,isSynced,utcDateModified) VALUES ('theme',?,0,?) "
                "ON CONFLICT(name) DO UPDATE SET value=excluded.value,utcDateModified=excluded.utcDateModified",
                (THEME, utc),
            )
        connection.commit()
        return {"noteId": note_id, "theme": THEME, "activated": activate,
                "previousTheme": previous[0] if previous else None,
                "backup": str(backup_path) if backup_path else None,
                "restartRequired": True}
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path,
                        default=Path.home() / "AppData/Roaming/trilium-data/document.db")
    parser.add_argument("--activate", action="store_true")
    parser.add_argument("--no-backup", action="store_true", help="For disposable seed/test databases only")
    args = parser.parse_args()
    print(json.dumps(install(args.db, args.activate, not args.no_backup), ensure_ascii=False))


if __name__ == "__main__":
    main()
