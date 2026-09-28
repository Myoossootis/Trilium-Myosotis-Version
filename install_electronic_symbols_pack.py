from __future__ import annotations

import json
import argparse
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parent
PACK = ROOT / "electronic-symbols-font-20260918"
SOURCE_MANIFEST = ROOT / "vendor-electronic-symbols-20260918" / "manifest.json"
DEFAULT_DB_PATH = Path(
    os.getenv("TRILIUM_DB", Path.home() / "AppData" / "Roaming" / "trilium-data" / "document.db")
)
OLD_LABEL = "es-test"
PACK_LABEL = "electronic-symbols"
NOTE_TITLE = "Electronic Symbols 电路符号（全部）"


def timestamps() -> tuple[str, str]:
    local_now = datetime.now(ZoneInfo("Asia/Shanghai"))
    utc_now = local_now.astimezone(timezone.utc)
    local = local_now.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + "+0800"
    utc = utc_now.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    return local, utc


def main() -> None:
    parser = argparse.ArgumentParser(description="Replace the existing Trilium electronic icon pack.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="Trilium document.db path")
    parser.add_argument("--pack", type=Path, default=PACK, help="Generated icon-pack directory")
    parser.add_argument(
        "--manifest",
        type=Path,
        default=SOURCE_MANIFEST,
        help="Upstream manifest used to verify the generated pack",
    )
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    icon_json = (args.pack / "icon-pack.json").read_text(encoding="utf-8")
    font_bytes = (args.pack / "electronic-symbols-stroke-outline.woff2").read_bytes()
    icon_count = len(json.loads(icon_json).get("icons", {}))
    if icon_count != len(manifest):
        raise RuntimeError(f"icon-pack.json has {icon_count} icons, manifest has {len(manifest)}")

    db = sqlite3.connect(args.db)
    db.execute("PRAGMA busy_timeout=10000")
    try:
        rows = db.execute(
            "SELECT noteId, value FROM attributes "
            "WHERE type='label' AND name='iconPack' AND isDeleted=0 "
            "AND value IN (?, ?)",
            (PACK_LABEL, OLD_LABEL),
        ).fetchall()
        if len(rows) > 1 and any(value == PACK_LABEL for _, value in rows):
            raise RuntimeError(f"multiple electronic icon-pack notes found: {rows}")
        if rows:
            note_id, old_value = rows[0]
        else:
            raise RuntimeError("the existing es-test icon pack note was not found")

        blob_id = db.execute(
            "SELECT blobId FROM notes WHERE noteId=? AND isDeleted=0", (note_id,)
        ).fetchone()
        attachment = db.execute(
            "SELECT attachmentId, blobId FROM attachments "
            "WHERE ownerId=? AND role='file' AND isDeleted=0 "
            "ORDER BY position LIMIT 1",
            (note_id,),
        ).fetchone()
        attr_id = db.execute(
            "SELECT attributeId FROM attributes WHERE noteId=? AND type='label' "
            "AND name='iconPack' AND isDeleted=0 LIMIT 1",
            (note_id,),
        ).fetchone()
        if not blob_id or not attachment or not attr_id:
            raise RuntimeError(f"icon pack note {note_id} is incomplete")

        local, utc = timestamps()
        db.execute("BEGIN IMMEDIATE")
        db.execute(
            "UPDATE blobs SET content=?, dateModified=?, utcDateModified=? WHERE blobId=?",
            (icon_json, local, utc, blob_id[0]),
        )
        db.execute(
            "UPDATE blobs SET content=?, dateModified=?, utcDateModified=? WHERE blobId=?",
            (sqlite3.Binary(font_bytes), local, utc, attachment[1]),
        )
        db.execute(
            "UPDATE notes SET title=?, dateModified=?, utcDateModified=? WHERE noteId=?",
            (NOTE_TITLE, local, utc, note_id),
        )
        db.execute(
            "UPDATE attributes SET value=?, utcDateModified=? WHERE attributeId=?",
            (PACK_LABEL, utc, attr_id[0]),
        )
        db.execute(
            "UPDATE attachments SET title=?, dateModified=?, utcDateModified=? WHERE attachmentId=?",
            ("electronic-symbols.woff2", local, utc, attachment[0]),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print(json.dumps({
        "noteId": note_id,
        "oldLabel": old_value,
        "label": PACK_LABEL,
        "icons": icon_count,
        "fontBytes": len(font_bytes),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
