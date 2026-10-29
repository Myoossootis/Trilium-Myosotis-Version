"""Install optional note typography without changing any existing note content."""
import argparse
import datetime as dt
import json
import sqlite3
from pathlib import Path
from contextlib import closing
from apply_customizations import Etapi, EtapiError

ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = [
    ('NtStyleCfg01', '笔记排版设置', 'application/json', None, None),
    ('NtStyleUI001', '笔记排版控制', 'application/javascript;env=frontend', 'note-typography.js', 'widget'),
    ('NtStyleCSS01', '笔记排版样式', 'text/css', 'note-typography.css', 'appCss'),
]
UPDATED = [('HmStartHome1', 'Home 启动页', 'trilium-home-startup.js')]

def install(api, data_dir):
    api.get_note('ThmStudioRoot')
    before = {}
    for id, title, mime, source, label in COMPONENTS:
        try:
            note = api.get_note(id)
        except EtapiError as error:
            if 'HTTP 404' not in str(error):
                raise
            continue
        if note['title'] != title or note['mime'] != mime or note['type'] != 'code' or note['isProtected']:
            raise RuntimeError('Component ID collision: ' + id)
        content = api.request('GET', '/notes/' + id + '/content', accept='text/plain')
        before[id] = {'note': note, 'content': json.dumps(content) if isinstance(content, dict) else content}
    updates=list(UPDATED)
    try:
        api.get_note('NxEditorUtil1')
        updates.append(('NxEditorUtil1','笔记编辑与标题辅助','customizations/frontend/note-editor-utilities.js'))
    except EtapiError as error:
        if 'HTTP 404' not in str(error):raise
    for id, title, path in updates:
        note = api.get_note(id)
        if note['title'] != title or note['type'] != 'code' or note['isProtected']:
            raise RuntimeError('Expected startup component: ' + id)
        before[id] = {'note': note, 'content': api.request('GET', '/notes/' + id + '/content', accept='text/plain')}
    backup = ROOT / 'backups' / ('note-typography-' + dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    backup.mkdir(parents=True)
    with closing(sqlite3.connect((Path(data_dir) / 'document.db').resolve().as_uri() + '?mode=ro', uri=True)) as source, closing(sqlite3.connect(backup / 'document.db')) as target:
        source.backup(target)
    (backup / 'before.json').write_text(json.dumps(before, ensure_ascii=False, indent=2), encoding='utf-8')
    for id, title, mime, source, label in COMPONENTS:
        # Do not reset the user's enable/style preference on reinstall.
        content = (ROOT / 'customizations/frontend' / source).read_text(encoding='utf-8') if source else before.get(id, {}).get('content', json.dumps({'version': 1, 'enabled': True, 'style': 'reading'}))
        if id not in before:
            api.create_note({'noteId': id, 'parentNoteId': 'ThmStudioRoot', 'title': title, 'type': 'code', 'mime': mime, 'content': content})
        elif before[id]['content'] != content:
            api.put_content(id, content)
        note = api.get_note(id)
        for name in filter(None, ['homeInternal', label]):
            if any(a['noteId']==id and a['type']=='label' and a['name']=='myoDisabled_'+name for a in note['attributes']):continue
            if not any(a['noteId'] == id and a['type'] == 'label' and a['name'] == name for a in note['attributes']):
                api.add_attribute(id, {'type': 'label', 'name': name, 'value': '', 'isInheritable': False})
        actual = api.request('GET', '/notes/' + id + '/content', accept='text/plain')
        assert actual == (json.loads(content) if source is None else content)
    for id, title, path in updates:
        content = (ROOT / path).read_text(encoding='utf-8')
        if before[id]['content'] != content:
            api.put_content(id, content)
        assert api.request('GET', '/notes/' + id + '/content', accept='text/plain') == content
    from plugin_catalog import refresh_catalog
    refresh_catalog(api)
    return {'installed': '笔记排版', 'settings': '设置 → 外观 → 笔记排版', 'backup': str(backup)}

if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:37840/etapi')
    parser.add_argument('--data-dir', required=True)
    args = parser.parse_args()
    api = Etapi(args.url, Path('C:/Users/杜锦鸿/Desktop/api.txt').read_text(encoding='utf-8-sig').strip())
    print(json.dumps(install(api, args.data_dir), ensure_ascii=False))
