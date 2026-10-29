"""Install the DSH native right-pane client; preserve user notes and DSH history."""
from __future__ import annotations
import argparse
import datetime as dt
import json
from pathlib import Path
import sqlite3
import sys
from apply_customizations import Etapi, existing_attribute

ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = [
    ('DsChatIcon01', 'DeepSeek 官方鲸鱼图标', 'customizations/assets/deepseek/whale.svg', 'image/svg+xml', []),
    ('DsChatFmt01', 'DeepSeek 消息排版与公式', 'customizations/frontend/dsh-chat-format.bundle.js', 'application/javascript;env=frontend', []),
    ('DsChatBoot1', 'DeepSeek 悬浮聊天', 'customizations/frontend/dsh-chat.js', 'application/javascript;env=frontend', [('label', 'widget', '')]),
    ('DsChatEntry1', 'DeepSeek 侧栏入口', 'customizations/frontend/dsh-chat-entry.js', 'application/javascript;env=frontend', [('label', 'widget', '')]),
    ('DsChatSvc01', 'DeepSeek 本机桥接服务', 'customizations/backend/dsh-chat-service.js', 'application/javascript;env=backend', []),
]

def install(api, skip_backup=False):
    backup = None
    if not skip_backup:
        info = api.request('GET', '/app-info')
        backup = ROOT / 'backups' / f'dsh-chat-{dt.datetime.now():%Y%m%d-%H%M%S-%f}'
        backup.mkdir(parents=True)
        source = sqlite3.connect(f"file:{(Path(info['dataDirectory']) / 'document.db').as_posix()}?mode=ro", uri=True)
        target = sqlite3.connect(backup / 'document.db')
        try: source.backup(target)
        finally: source.close(); target.close()
    try:
        root = api.get_note('DsChatRoot1')
        if root['title'] not in ('DeepSeek 悬浮聊天插件','DeepSeek 右侧助手'): raise RuntimeError('Plugin note ID occupied')
    except Exception as e:
        if 'HTTP 404' not in str(e): raise
        parent = api.get_note('gTC4ItLtMiD5')['parentNoteIds'][0]
        api.create_note({'noteId': 'DsChatRoot1', 'parentNoteId': parent, 'title': 'DeepSeek 悬浮聊天插件', 'type': 'text', 'content': '<p>原生右侧面板中的 DeepSeek 助手。对话和密钥由本机 DSH 管理。</p>'})
    root = api.get_note('DsChatRoot1')
    if not existing_attribute(root, 'label', 'homeInternal', ''): api.add_attribute('DsChatRoot1', {'type': 'label', 'name': 'homeInternal', 'value': ''})
    def icon(note_id):
        note=api.get_note(note_id)
        icons=[a for a in note['attributes'] if a['noteId']==note_id and a['type']=='label' and a['name']=='iconClass']
        if icons:
            for a in icons:api.request('PATCH','/attributes/'+a['attributeId'],body={'value':'deepseek-brand-icon'})
        else:api.add_attribute(note_id,{'type':'label','name':'iconClass','value':'deepseek-brand-icon'})
    icon('DsChatRoot1')
    catalog = api.request('GET', '/notes/MyoMarketData/content')
    if isinstance(catalog, str): catalog = json.loads(catalog)
    enabled = next((p.get('enabled', True) for p in catalog.get('plugins', []) if p['id'] == 'DsChatRoot1'), True)
    for note_id, title, filename, mime, attributes in COMPONENTS:
        try:
            note = api.get_note(note_id)
            if note['type'] != 'code' or note['title'] != title: raise RuntimeError(f'Plugin note ID occupied: {note_id}')
            if backup:
                (backup / f'{note_id}.js').write_text(api.request('GET', f'/notes/{note_id}/content', accept='text/plain'), encoding='utf-8')
        except Exception as e:
            if 'HTTP 404' not in str(e): raise
            api.create_note({'noteId': note_id, 'parentNoteId': 'DsChatRoot1', 'title': title, 'type': 'code', 'mime': mime, 'content': ''})
        api.put_content(note_id, (ROOT / filename).read_text(encoding='utf-8'))
        note = api.get_note(note_id)
        if note['mime'] != mime: api.request('PATCH', f'/notes/{note_id}', body={'mime': mime})
        if note_id == 'DsChatBoot1':
            # Migrate the existing entry in place, including an already disabled package.
            for attr in note['attributes']:
                if attr['type'] == 'label' and attr['name'] in ('run', 'myoDisabled_run') and attr['value'] == 'frontendStartup': api.remove_attribute(attr['attributeId'])
        for kind, name, value in attributes + [('label', 'homeInternal', '')]:
            if not existing_attribute(note, kind, name, value) and not existing_attribute(note, kind, 'myoDisabled_'+name, value): api.add_attribute(note_id, {'type': kind, 'name': 'myoDisabled_'+name if name == 'widget' and not enabled else name, 'value': value})
        icon(note_id)
    from plugin_catalog import refresh_catalog
    refresh_catalog(api)
    return {'installed': 'DSH native right pane', 'backup': str(backup) if backup else None}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:37840/etapi')
    parser.add_argument('--token-file', type=Path, required=True)
    parser.add_argument('--skip-backup', action='store_true')
    args = parser.parse_args()
    if args.skip_backup and args.url == 'http://127.0.0.1:37840/etapi': parser.error('Main instance requires backup')
    sys.stdout.reconfigure(encoding='utf-8')
    api = Etapi(args.url, args.token_file.read_text(encoding='utf-8-sig').strip())
    print(json.dumps(install(api, args.skip_backup), ensure_ascii=False))
