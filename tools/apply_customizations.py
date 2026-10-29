#!/usr/bin/env python3
"""Install the program-only customization notes through Trilium ETAPI.

This deliberately does not import note data, attachments, revisions, or the
user's Home settings.  It creates/updates only the code/render notes listed in
``customizations-manifest.json``.  Run it after starting the target Trilium
instance and generating an ETAPI token.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "customizations-manifest.json"


class EtapiError(RuntimeError):
    pass


class Etapi:
    def __init__(self, base_url: str, token: str, dry_run: bool = False):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.dry_run = dry_run

    def request(
        self,
        method: str,
        path: str,
        *,
        body: Any = None,
        content_type: str = "application/json",
        accept: str = "application/json",
    ) -> Any:
        url = f"{self.base_url}{path}"
        data: bytes | None
        if body is None:
            data = None
        elif content_type == "application/json":
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, bytes):
            data = body
        else:
            data = str(body).encode("utf-8")
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("Authorization", self.token)
        request.add_header("Accept", accept)
        if data is not None:
            request.add_header("Content-Type", content_type)
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                raw = response.read()
                if not raw:
                    return None
                if "json" in response.headers.get_content_type() or accept == "application/json":
                    return json.loads(raw.decode("utf-8"))
                return raw.decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            raise EtapiError(f"{method} {path} -> HTTP {exc.code}: {detail[:500]}") from exc
        except urllib.error.URLError as exc:
            raise EtapiError(f"无法连接 Trilium ETAPI {url}: {exc.reason}") from exc

    def search_notes(self, title: str) -> list[dict[str, Any]]:
        if self.dry_run:
            return []
        # Exact title search is supported by current Trilium builds.  The
        # client-side filter protects against older search parser differences.
        query = urllib.parse.quote(f'note.title = "{title}"', safe="")
        result = self.request("GET", f"/notes?search={query}&includeArchivedNotes=true") or {}
        rows = result.get("results", []) if isinstance(result, dict) else result
        return [row for row in rows if row.get("title") == title and not row.get("isDeleted")]

    def create_note(self, definition: dict[str, Any]) -> dict[str, Any]:
        if self.dry_run:
            print(f"[dry-run] create {definition['type']} {definition['title']}")
            key = definition.get("key") or definition["title"].lower().replace(" ", "-")
            return {"note": {"noteId": f"dry-{key}"}}
        return self.request("POST", "/create-note", body=definition)

    def put_content(self, note_id: str, content: str) -> None:
        if self.dry_run:
            print(f"[dry-run] update content {note_id} ({len(content)} chars)")
            return
        self.request(
            "PUT",
            f"/notes/{urllib.parse.quote(note_id, safe='')}" "/content",
            body=content,
            content_type="text/plain; charset=utf-8",
            accept="text/plain",
        )

    def get_note(self, note_id: str) -> dict[str, Any]:
        if self.dry_run:
            return {"noteId": note_id, "attributes": []}
        return self.request("GET", f"/notes/{urllib.parse.quote(note_id, safe='')}")

    def add_attribute(self, note_id: str, attr: dict[str, Any]) -> None:
        if self.dry_run:
            print(f"[dry-run] {attr['type']} {attr['name']}={attr.get('value', '')} -> {note_id}")
            return
        payload = {
            "noteId": note_id,
            "type": attr["type"],
            "name": attr["name"],
            "value": attr.get("value", ""),
            "position": attr.get("position", 10),
        }
        if attr.get("isInheritable") is not None:
            payload["isInheritable"] = bool(attr["isInheritable"])
        self.request("POST", "/attributes", body=payload)

    def remove_attribute(self, attribute_id: str) -> None:
        if self.dry_run:
            print(f"[dry-run] remove attribute {attribute_id}")
            return
        self.request("DELETE", f"/attributes/{urllib.parse.quote(attribute_id, safe='')}")


def existing_attribute(note: dict[str, Any], attr_type: str, name: str, value: str) -> bool:
    return any(
        attr.get("type") == attr_type
        and attr.get("name") == name
        and str(attr.get("value", "")) == str(value)
        for attr in note.get("attributes", [])
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.getenv("TRILIUM_ETAPI_URL", "http://127.0.0.1:37840/etapi"))
    parser.add_argument("--group", help="只安装指定分组的组件（例如：学习 RPG）")
    parser.add_argument("--token", default=os.getenv("TRILIUM_ETAPI_TOKEN"))
    parser.add_argument("--parent", default="root", help="Parent note ID for the program component book")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.token and not args.dry_run:
        parser.error("请通过 --token 或 TRILIUM_ETAPI_TOKEN 提供 ETAPI token")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    api = Etapi(args.url, args.token or "dry-run", args.dry_run)

    # Keep code notes out of the user's knowledge tree.  Existing notes with
    # the same title are updated in place, so running the installer is safe and
    # idempotent on the current machine.
    program_book = next(iter(api.search_notes("系统与插件")), None) or next(iter(api.search_notes("Myosotis 程序组件")), None)
    if program_book:
        program_root_id = program_book["noteId"]
    else:
        created = api.create_note({
            "parentNoteId": args.parent,
            "title": "系统与插件",
            "type": "book",
            "content": "",
            "notePosition": 900,
        })
        program_root_id = created["note"]["noteId"]

    ids: dict[str, str] = {}
    notes = manifest.get("notes", [])
    if args.group:
        notes = [item for item in notes if item.get("group") == args.group or
                 (item.get("type") == "launcher" and any(
                     target == member.get("key")
                     for _, target in item.get("relations", [])
                     for member in manifest.get("notes", []) if member.get("group") == args.group))]
        if not notes:
            raise EtapiError(f"没有找到分组 {args.group!r}")
    groups = {}
    for title in dict.fromkeys(item.get("group") for item in notes if item.get("group")):
        matches = api.search_notes(title)
        candidates = [row for row in matches if program_root_id in
                      (row.get("parentNoteIds") or api.get_note(row["noteId"]).get("parentNoteIds", []))]
        if len(candidates) > 1:
            raise EtapiError(f"Multiple plugin groups named {title!r}")
        if candidates:
            groups[title] = candidates[0]["noteId"]
        else:
            groups[title] = api.create_note({"parentNoteId": program_root_id, "title": title,
                                            "type": "text", "content": "", "notePosition": 900})["note"]["noteId"]
    for item in notes:
        path = ROOT / item["path"] if item.get("path") else None
        content = path.read_text(encoding="utf-8") if path else ""
        if path and path.name in ('knowledge-wiki.jsx', 'hardware-library.jsx'):
            from build_knowledge_workspace import component_source
            content = component_source('KbWikiUI0001' if path.name=='knowledge-wiki.jsx' else 'MyoHardwareUI', path)
        if item.get("noteId") and not api.dry_run:
            # Launchers may be excluded from title search. Resolve fixed IDs
            # directly so reinstalls cannot create duplicate launcher branches.
            try:
                existing = api.get_note(item["noteId"])
                if existing.get("title") not in (item["title"], item.get("legacyTitle")):
                    raise EtapiError(f"组件 ID {item['noteId']!r} 已被其他笔记占用")
                matches = [existing]
            except EtapiError as exc:
                if "HTTP 404" not in str(exc):
                    raise
                matches = []
        else:
            matches = api.search_notes(item["title"])
            if item.get("noteId"):
                matches = [row for row in matches if row["noteId"] == item["noteId"]]
        if not matches and item.get("legacyTitle"):
            matches = [row for row in api.search_notes(item["legacyTitle"]) if row["noteId"] == item.get("noteId")]
        row = matches[0] if matches else None
        if row:
            note_id = row["noteId"]
            if item.get("noteId") and note_id != item["noteId"]:
                raise EtapiError(f"组件 {item['title']!r} 的 ID 不匹配，拒绝覆盖")
            if row.get("type") not in (None, item["type"]):
                raise EtapiError(
                    f"标题 {item['title']!r} 已存在但类型为 {row.get('type')!r}，拒绝覆盖"
                )
            if row.get("title") == item.get("legacyTitle"):
                api.request("PATCH", f"/notes/{urllib.parse.quote(note_id, safe='')}", body={"title": item["title"]})
            if not item.get("preserveContent"):
                api.put_content(note_id, content)
            verb = "preserved" if item.get("preserveContent") else "updated"
            print(f"{verb} {item['title']} ({note_id})")
        else:
            definition = {
                "parentNoteId": item.get("parentNoteId") or groups.get(item.get("group"), program_root_id),
                "title": item["title"],
                "type": item["type"],
                "content": content,
                "notePosition": item.get("notePosition", 10),
            }
            if item.get("mime"):
                definition["mime"] = item["mime"]
            if item.get("noteId"):
                definition["noteId"] = item["noteId"]
            created = api.create_note(definition)
            note_id = created["note"]["noteId"]
            print(f"created {item['title']} ({note_id})")
        ids[item["key"]] = note_id

    # Labels are applied after content so a rerun can repair a partially
    # imported setup without creating duplicate notes.
    for item in notes:
        note_id = ids[item["key"]]
        note = api.get_note(note_id)
        if item["key"] == "codex_ui":
            for attribute in note.get("attributes", []):
                if attribute.get("type") == "label" and attribute.get("name") == "appCss":
                    api.remove_attribute(attribute["attributeId"])
        attrs = [("label", name, value, False) for name, value in item.get("labels", [])]
        for name, target_key in item.get("relations", []):
            if target_key not in ids:
                raise EtapiError(f"relation target {target_key!r} is missing")
            attrs.append(("relation", name, ids[target_key], False))
        for index, (attr_type, name, value, inheritable) in enumerate(attrs, start=10):
            if existing_attribute(note, attr_type, name, value) or existing_attribute(note, attr_type, "myoDisabled_" + name, value):
                continue
            api.add_attribute(note_id, {
                "type": attr_type,
                "name": name,
                "value": value,
                "position": index,
                "isInheritable": inheritable,
            })

    if "commission_render" in ids and not api.dry_run:
        # Preserve old launcher notes while removing their launch-bar entries.
        # ETAPI cannot change a branch's parent: clone first, then unlink.
        for launcher_id, script_id in (("al_MyoShopEntry", "MyoShopOpen"),
                                       ("al_MyoStockEntry", "MyoStockOpen")):
            try:
                note = api.get_note(launcher_id)
            except EtapiError as exc:
                if "HTTP 404" not in str(exc):
                    raise
                continue
            if note.get("type") != "launcher" or not existing_attribute(note, "relation", "script", script_id):
                raise EtapiError(f"旧入口 {launcher_id!r} 与预期不符，拒绝移动")
            for branch_id in note.get("parentBranchIds", []):
                branch = api.request("GET", f"/branches/{branch_id}")
                if branch.get("parentNoteId") != "_lbVisibleLaunchers":
                    continue
                group_id = groups["学习 RPG"]
                if group_id not in note.get("parentNoteIds", []):
                    api.request("POST", "/branches", body={"noteId": launcher_id,
                                "parentNoteId": group_id, "notePosition": 100})
                api.request("DELETE", f"/branches/{branch_id}")
                print(f"retired launch-bar entry {launcher_id}")

    if args.group:
        print(f"{args.group} 程序组件已应用。重新打开标签页或重启 Trilium 后加载新界面及入口。")
    else:
        print("程序组件已应用。Home/ToDo 启动栏及知识库根节点关系仍需按 README 配置。")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except EtapiError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        raise SystemExit(1)
