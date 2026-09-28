from __future__ import annotations

import hashlib
import argparse
import json
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parent
PACK = ROOT / "electronic-symbols-font-preview-20260918"
DEFAULT_DB_PATH = Path(
    os.getenv("TRILIUM_DB", Path.home() / "AppData" / "Roaming" / "trilium-data" / "document.db")
)
PARENT_NOTE_ID = "STkg4ddM8luG"  # 08 图标包
PACK_LABEL = "es-test"


def tid(length: int = 12) -> str:
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def main() -> None:
    parser = argparse.ArgumentParser(description="Install the optional electronic symbol preview pack.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="Trilium document.db path")
    parser.add_argument("--pack", type=Path, default=PACK, help="Generated preview pack directory")
    parser.add_argument("--parent", default=PARENT_NOTE_ID, help="Parent note ID")
    parser.add_argument("--label", default=PACK_LABEL, help="iconPack label")
    args = parser.parse_args()
    icon_json = (args.pack / "icon-pack.json").read_text(encoding="utf-8")
    font_bytes = (args.pack / "electronic-symbols-stroke-outline.woff2").read_bytes()
    # Use IDs that are not present in the current database and can be traced in
    # a backup if the preview pack is later removed.
    db = sqlite3.connect(args.db)
    db.execute("PRAGMA busy_timeout=10000")
    note_id = tid()
    branch_id = tid()
    label_id = tid()
    json_blob_id = tid()
    font_blob_id = tid()
    attachment_id = tid()
    now_local = datetime.now(ZoneInfo("Asia/Shanghai"))
    now_utc = now_local.astimezone(timezone.utc)
    local = now_local.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + "+0800"
    utc = now_utc.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    title = "Electronic Symbols 字体预览 (es-test)"

    # Verify that an earlier run did not leave a duplicate pack behind.
    duplicate = db.execute(
        "SELECT noteId FROM attributes WHERE type='label' AND name='iconPack' AND value=? AND isDeleted=0",
        (args.label,),
    ).fetchone()
    if duplicate:
        raise SystemExit(f"icon pack {args.label!r} already exists on note {duplicate[0]}")

    try:
        db.execute("BEGIN IMMEDIATE")
        db.execute(
            "INSERT INTO blobs(blobId,content,dateModified,utcDateModified,textRepresentation) VALUES(?,?,?,?,NULL)",
            (json_blob_id, icon_json, local, utc),
        )
        db.execute(
            "INSERT INTO blobs(blobId,content,dateModified,utcDateModified,textRepresentation) VALUES(?,?,?,?,NULL)",
            (font_blob_id, sqlite3.Binary(font_bytes), local, utc),
        )
        db.execute(
            "INSERT INTO notes(noteId,title,isProtected,type,mime,blobId,isDeleted,deleteId,dateCreated,dateModified,utcDateCreated,utcDateModified) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (note_id, title, 0, "code", "application/json", json_blob_id, 0, None, local, local, utc, utc),
        )
        db.execute(
            "INSERT INTO branches(branchId,noteId,parentNoteId,notePosition,prefix,isExpanded,isDeleted,deleteId,utcDateModified) VALUES(?,?,?,?,?,?,?,?,?)",
            (branch_id, note_id, args.parent, 40, None, 0, 0, None, utc),
        )
        db.execute(
            "INSERT INTO attributes(attributeId,noteId,type,name,value,position,utcDateModified,isDeleted,deleteId,isInheritable) VALUES(?,?,?,?,?,?,?,?,?,?)",
            (label_id, note_id, "label", "iconPack", args.label, 10, utc, 0, None, 0),
        )
        db.execute(
            "INSERT INTO attachments(attachmentId,ownerId,role,mime,title,isProtected,position,blobId,dateModified,utcDateModified,utcDateScheduledForErasureSince,isDeleted,deleteId) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (attachment_id, note_id, "file", "font/woff2", "electronic-symbols-preview.woff2", 0, 10, font_blob_id, local, utc, None, 0, None),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(json.dumps({"noteId": note_id, "pack": args.label, "fontBytes": len(font_bytes), "sha256": hashlib.sha256(font_bytes).hexdigest()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
