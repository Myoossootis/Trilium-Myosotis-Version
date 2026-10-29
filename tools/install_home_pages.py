"""Install the modular Home Pages dashboard through ETAPI, preserving user notes."""
from __future__ import annotations

import argparse
from contextlib import closing
import datetime as dt
import json
from pathlib import Path
import sqlite3
import sys

from apply_customizations import Etapi, existing_attribute

ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = [
    ("gTC4ItLtMiD5", "Home 仪表盘脚本", "trilium-home-dashboard.js", "text/jsx"),
    ("MD9L0aUcgHSV", "Home 仪表盘样式", "trilium-home-dashboard.css", "text/css"),
    ("HmLayoutLib1", "首页拖拽布局引擎", "trilium-home-layout.js", "application/javascript"),
    ("HmHomeSvc01", "首页布局服务", "trilium-home-service.js", "application/javascript;env=backend"),
]


def install(api: Etapi, *, merge_workbench: bool = False, backup: bool = True) -> dict:
    home = api.get_note("HmeDashboard")
    workbench = api.get_note("eae485474234")
    if home["type"] != "render" or workbench["type"] != "text":
        raise RuntimeError("Expected existing Home render note and workbench folder")
    info = api.request("GET", "/app-info")
    backup_dir = None
    if backup:
        backup_dir = ROOT / "backups" / f"before-home-pages-install-{dt.datetime.now():%Y%m%d-%H%M%S-%f}"
        backup_dir.mkdir(parents=True)
        source_path = Path(info["dataDirectory"]) / "document.db"
        with closing(sqlite3.connect(f"file:{source_path.as_posix()}?mode=ro", uri=True)) as source:
            with closing(sqlite3.connect(backup_dir / "document.db")) as target:
                source.backup(target)
        (backup_dir / "navigation.json").write_text(json.dumps([home, workbench], ensure_ascii=False, indent=2), encoding="utf-8")
    # Keep new code beside the existing Home code, never amongst content notes.
    parent = api.get_note("gTC4ItLtMiD5")["parentNoteIds"][0]

    def attribute(note_id: str, kind: str, name: str, value: str = "") -> None:
        note = api.get_note(note_id)
        if existing_attribute(note, kind, name, value):
            return
        old = [item for item in note.get("attributes", []) if item["type"] == kind and item["name"] == name and item["noteId"] == note_id]
        if old:
            api.request("PATCH", f"/attributes/{old[0]['attributeId']}", body={"value": value})
        else:
            api.add_attribute(note_id, {"type": kind, "name": name, "value": value})

    for note_id, title, file_name, mime in COMPONENTS:
        try:
            note = api.get_note(note_id)
            if note["type"] != "code" or note["title"] != title:
                raise RuntimeError(f"Component ID occupied: {note_id}")
        except Exception as error:
            if "HTTP 404" not in str(error):
                raise
            api.create_note({"noteId": note_id, "parentNoteId": parent, "title": title, "type": "code", "mime": mime, "content": ""})
        api.put_content(note_id, (ROOT / file_name).read_text(encoding="utf-8"))
        attribute(note_id, "label", "homeInternal")
        if mime == "text/css":
            attribute(note_id, "label", "appCss")
    try:
        data = api.get_note("HmHomeData01")
        if data["type"] != "code" or not any(a["name"] == "homeLayoutData" for a in data.get("attributes", [])):
            raise RuntimeError("Layout data ID is occupied")
    except Exception as error:
        if "HTTP 404" not in str(error):
            raise
        api.create_note({"noteId": "HmHomeData01", "parentNoteId": parent, "title": "首页布局数据", "type": "code", "mime": "application/json", "content": json.dumps({"version": 1, "revision": 0, "layout": None})})
        attribute("HmHomeData01", "label", "homeLayoutData")
        attribute("HmHomeData01", "label", "homeInternal")
    attribute("HmeDashboard", "relation", "renderNote", "gTC4ItLtMiD5")
    if merge_workbench:
        # Add the new parent before removing the old branch, preserving every child and note ID.
        if "HmeDashboard" not in workbench["parentNoteIds"]:
            api.request("POST", "/branches", body={"noteId": "eae485474234", "parentNoteId": "HmeDashboard", "notePosition": 10})
        for branch_id in workbench.get("parentBranchIds", []):
            branch = api.request("GET", f"/branches/{branch_id}")
            if branch.get("parentNoteId") == "root":
                api.request("DELETE", f"/branches/{branch_id}")
        api.request("PATCH", "/notes/eae485474234", body={"title": "工作台资料"})
        api.request("PATCH", "/notes/HmeDashboard", body={"title": "工作台"})
        try:
            launcher = api.get_note("HmeLaunchBar")
            if launcher["type"] == "launcher" and existing_attribute(launcher, "relation", "script", "HmOpenHomeTab"):
                api.request("PATCH", "/notes/HmeLaunchBar", body={"title": "工作台"})
        except Exception as error:
            if "HTTP 404" not in str(error):
                raise
    return {"installed": "Home Pages", "url": api.base_url, "backup": str(backup_dir) if backup_dir else None, "merged": merge_workbench}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:37840/etapi")
    parser.add_argument("--token-file", type=Path, required=True)
    parser.add_argument("--merge-workbench", action="store_true")
    parser.add_argument("--skip-backup", action="store_true", help="For an isolated disposable test instance only")
    args = parser.parse_args()
    if args.skip_backup and args.url == "http://127.0.0.1:37840/etapi":
        parser.error("The active instance always requires a backup")
    sys.stdout.reconfigure(encoding="utf-8")
    client = Etapi(args.url, args.token_file.read_text(encoding="utf-8-sig").strip())
    print(json.dumps(install(client, merge_workbench=args.merge_workbench, backup=not args.skip_backup), ensure_ascii=False))
