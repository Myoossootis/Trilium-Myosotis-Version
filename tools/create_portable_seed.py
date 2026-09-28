#!/usr/bin/env python3
"""Build a program-only Trilium seed database.

The source database is read only as a template.  User notes, attachments,
revisions, sessions, tokens and password material are removed; only the
custom render/code notes needed by the Myosotis build are retained.  The
result is intended to be copied into a fresh portable data directory on first
launch, not used as a backup of the author's notes.
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import secrets
import sqlite3
from pathlib import Path


ROOT_NOTE_IDS = {"root", "_hidden"}
PROGRAM_TITLES = {
    "Home 仪表盘脚本",
    "Home 仪表盘样式",
    "字典排版 · 学术与硬件",
    "ToDo 四列看板脚本",
    "ToDo 四列看板样式",
    "自动公式粘贴",
    "Home 启动页",
    "打开 Home（新标签页）",
    "列表编号样式按钮",
    "trilium-left-panel-auto-zoom.js",
    "实际修改字数统计",
    "attributeChanged",
    "branchCreated",
    "noteCreated",
    "Home",
    "ToDo清单",
}
STATUS_LABELS = ("todoInProgress", "todoBacklog", "todoDone", "todoArchive")
PROGRAM_LABELS = ("todoScripts", "collectionViews", "todoTimelineView")
PROGRAM_ROOT_ID = "MyoProgRoot01"
PROGRAM_ROOT_BLOB_ID = "MyoProgBlob01"


def utc_timestamp() -> tuple[str, str]:
    now = dt.datetime.now(dt.timezone.utc)
    return now.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + "+0000", now.strftime(
        "%Y-%m-%d %H:%M:%S.%f"
    )[:-3] + "Z"


def ids_with_label(conn: sqlite3.Connection, name: str, value: str | None = None) -> set[str]:
    sql = """
        SELECT DISTINCT n.noteId
        FROM notes n JOIN attributes a ON a.noteId = n.noteId
        WHERE n.isDeleted = 0 AND a.isDeleted = 0 AND a.type = 'label'
          AND a.name = ?
    """
    params: list[str] = [name]
    if value is not None:
        sql += " AND a.value = ?"
        params.append(value)
    return {row[0] for row in conn.execute(sql, params)}


def discover_program_ids(conn: sqlite3.Connection) -> set[str]:
    ids = set(ROOT_NOTE_IDS)
    for title in PROGRAM_TITLES:
        rows = conn.execute(
            "SELECT noteId FROM notes WHERE title = ? AND isDeleted = 0", (title,)
        )
        ids.update(row[0] for row in rows)
    for name in STATUS_LABELS + PROGRAM_LABELS:
        ids.update(ids_with_label(conn, name))
    # Keep only the task template, not user-created task instances.
    ids.update(
        row[0]
        for row in conn.execute(
            """
            SELECT n.noteId FROM notes n
            JOIN attributes a ON a.noteId = n.noteId
            WHERE n.isDeleted = 0 AND n.type = 'text'
              AND a.isDeleted = 0 AND a.type = 'label'
              AND a.name = 'template' AND a.value = ''
              AND EXISTS (
                SELECT 1 FROM attributes todo
                WHERE todo.noteId = n.noteId AND todo.isDeleted = 0
                  AND todo.type = 'label' AND todo.name = 'todoItem'
              )
            """
        )
    )
    # The electronic-symbols icon pack is a program asset, not a user note.
    ids.update(ids_with_label(conn, "iconPack", "electronic-symbols"))

    # Preserve relation targets referenced by the selected program notes.  This
    # brings in the task template, collection renderer and backend script book
    # without following arbitrary user-tree branches.
    pending = list(ids)
    while pending:
        note_id = pending.pop()
        for target, in conn.execute(
            """
            SELECT value FROM attributes
            WHERE noteId = ? AND isDeleted = 0 AND type = 'relation'
            """,
            (note_id,),
        ):
            if not target or target in ids:
                continue
            exists = conn.execute(
                "SELECT 1 FROM notes WHERE noteId = ? AND isDeleted = 0", (target,)
            ).fetchone()
            if exists:
                ids.add(target)
                pending.append(target)
    return ids


def copy_seed(source: Path, output: Path) -> set[str]:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    src = sqlite3.connect(source)
    dst = sqlite3.connect(output)
    src.backup(dst)
    src.close()
    dst.execute("PRAGMA foreign_keys = OFF")
    ids = discover_program_ids(dst)
    ids.add(PROGRAM_ROOT_ID)

    placeholders = ",".join("?" for _ in ids)
    # Delete all user content from the copied template.
    dst.execute(f"DELETE FROM notes WHERE noteId NOT IN ({placeholders})", tuple(ids))
    dst.execute(f"DELETE FROM attributes WHERE noteId NOT IN ({placeholders})", tuple(ids))
    dst.execute(
        f"DELETE FROM attributes WHERE type = 'relation' AND noteId IN ({placeholders}) "
        "AND value NOT IN (SELECT noteId FROM notes)",
        tuple(ids),
    )
    dst.execute(f"DELETE FROM attachments WHERE ownerId NOT IN ({placeholders})", tuple(ids))
    dst.execute("DELETE FROM revisions")
    dst.execute("DELETE FROM recent_notes")
    dst.execute("DELETE FROM sessions")
    dst.execute("DELETE FROM etapi_tokens")
    dst.execute("DELETE FROM entity_changes")

    # Keep only blobs referenced by the retained notes and icon attachment.
    blob_ids = {
        row[0]
        for row in dst.execute(
            "SELECT blobId FROM notes WHERE blobId IS NOT NULL"
        )
    }
    blob_ids.update(
        row[0]
        for row in dst.execute(
            "SELECT blobId FROM attachments WHERE blobId IS NOT NULL"
        )
    )
    blob_ids.add(PROGRAM_ROOT_BLOB_ID)
    blob_placeholders = ",".join("?" for _ in blob_ids)
    dst.execute(f"DELETE FROM blobs WHERE blobId NOT IN ({blob_placeholders})", tuple(blob_ids))

    date_created, utc_modified = utc_timestamp()
    dst.execute(
        """
        INSERT OR REPLACE INTO blobs
          (blobId, content, dateModified, utcDateModified, textRepresentation)
        VALUES (?, ?, ?, ?, ?)
        """,
        (PROGRAM_ROOT_BLOB_ID, "", date_created, utc_modified, None),
    )
    dst.execute(
        """
        INSERT OR REPLACE INTO notes
          (noteId, title, isProtected, type, mime, blobId, isDeleted, deleteId,
           dateCreated, dateModified, utcDateCreated, utcDateModified)
        VALUES (?, ?, 0, 'book', 'text/html', ?, 0, NULL, ?, ?, ?, ?)
        """,
        (
            PROGRAM_ROOT_ID,
            "Myosotis 程序组件",
            PROGRAM_ROOT_BLOB_ID,
            date_created,
            date_created,
            utc_modified,
            utc_modified,
        ),
    )
    dst.execute(
        """
        INSERT OR REPLACE INTO attributes
          (attributeId, noteId, type, name, value, position, utcDateModified,
           isDeleted, deleteId, isInheritable)
        VALUES ('MyoProgAttr01', ?, 'label', 'programComponents', '', 10, ?, 0, NULL, 0)
        """,
        (PROGRAM_ROOT_ID, utc_modified),
    )

    # Rebuild a small deterministic tree.  This removes all user branches and
    # leaves the program notes available without exposing the original tree.
    dst.execute("DELETE FROM branches")
    branches: list[tuple[str, str, str, int, int]] = [
        ("none_root", "root", "none", 10, 1),
        ("root__hidden", "_hidden", "root", 999999999, 0),
        ("MyoRootProgram", PROGRAM_ROOT_ID, "root", 20, 1),
    ]
    if "HmeDashboard" in ids:
        branches.append(("MyoProgramHome", "HmeDashboard", PROGRAM_ROOT_ID, 10, 0))
    if "ZrxUIJf75kFS" in ids:
        branches.append(("MyoProgramTodo", "ZrxUIJf75kFS", PROGRAM_ROOT_ID, 20, 1))
        for pos, note_id in enumerate(
            ["52Z91MOBH5g9", "IXeWPMzNDeCF", "VRagMKcXpZ6N", "G1dMogAOtW5i"],
            start=10,
        ):
            if note_id in ids:
                branches.append((f"MyoTodo{pos}", note_id, "ZrxUIJf75kFS", pos, 1))
    excluded = {"root", "_hidden", PROGRAM_ROOT_ID, "HmeDashboard", "ZrxUIJf75kFS"}
    excluded.update({"52Z91MOBH5g9", "IXeWPMzNDeCF", "VRagMKcXpZ6N", "G1dMogAOtW5i"})
    pos = 100
    for note_id in sorted(ids - excluded):
        branches.append((f"MyoProgram{pos}", note_id, PROGRAM_ROOT_ID, pos, 0))
        pos += 10
    for branch_id, note_id, parent_id, position, expanded in branches:
        dst.execute(
            """
            INSERT INTO branches
              (branchId, noteId, parentNoteId, notePosition, prefix, isExpanded,
               isDeleted, deleteId, utcDateModified)
            VALUES (?, ?, ?, ?, NULL, ?, 0, NULL, ?)
            """,
            (branch_id, note_id, parent_id, position, expanded, utc_modified),
        )

    # Remove local password/session state while keeping the normal initialized
    # database flag.  On first launch the user can set a new password if they
    # want protected notes; no password from the source machine is retained.
    empty_options = {
        "passwordDerivedKeySalt",
        "passwordVerificationHash",
        "passwordVerificationSalt",
        "encryptedDataKey",
        "encryptedRecoveryCodes",
        "mfaMethod",
        "openNoteContexts",
        "customDbBackupDir",
        "lastDailyBackupDate",
        "lastWeeklyBackupDate",
        "lastMonthlyBackupDate",
    }
    for name in empty_options:
        dst.execute("DELETE FROM options WHERE name = ?", (name,))
    now = utc_modified
    for name, value in (
        ("initialized", "true"),
        ("documentId", base64.b64encode(secrets.token_bytes(16)).decode("ascii")),
        ("documentSecret", base64.b64encode(secrets.token_bytes(16)).decode("ascii")),
        (
            "openNoteContexts",
            '[{"notePath":"root/MyoProgRoot01/HmeDashboard","active":true}]',
        ),
    ):
        dst.execute(
            "INSERT OR REPLACE INTO options (name,value,isSynced,utcDateModified) VALUES (?, ?, 0, ?)",
            (name, value, now),
        )

    # Rebuild statistics after pruning the source database.
    dst.commit()
    dst.execute("VACUUM")
    dst.execute("ANALYZE")
    dst.commit()
    dst.close()
    return ids


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    ids = copy_seed(args.source, args.output)
    print(f"created {args.output} with {len(ids)} retained source note ids")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
