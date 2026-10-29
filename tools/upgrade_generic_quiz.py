"""Upgrade the installed quiz in place without replacing banks or study records."""
from pathlib import Path
import argparse
import datetime as dt
import hashlib
import json
import sqlite3
from apply_customizations import Etapi

ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = {
    'HwQuizSvc01': ('通用刷题数据服务', 'customizations/backend/hardware-quiz-service.js'),
    'HwQuizUI01': ('通用刷题界面', 'customizations/frontend/hardware-quiz.jsx'),
    'HwQuizCSS01': ('通用刷题样式', 'customizations/frontend/hardware-quiz.css'),
    'HwQuizOpen01': ('打开通用刷题', 'customizations/frontend/open-hardware-quiz.js'),
}

def upgrade(api):
    info = api.request('GET', '/app-info')
    dbpath = Path(info['dataDirectory']) / 'document.db'
    backup = ROOT / 'backups' / ('generic-quiz-' + dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    backup.mkdir(parents=True)
    with sqlite3.connect(f'file:{dbpath.as_posix()}?mode=ro', uri=True) as source, sqlite3.connect(backup / 'document.db') as dest:
        source.backup(dest)
    def content(id):
        value = api.request('GET', f'/notes/{id}/content', accept='text/plain')
        return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    preserved = {id: content(id) for id in ['HwQuizState01', 'MyoQuestData']}
    index = json.loads(content('HwQuizIndex01'))
    bank_hashes = {b['id']: hashlib.sha256(content('HwQuizBank' + b['id'][2:]).encode()).hexdigest() for b in index['banks']}
    ids = [*COMPONENTS, 'HwQuizRoot01', 'HwQuizBoard01', 'al_HwQuiz01', 'HwQuizState01', 'HwQuizIndex01', 'MyoMarketData', 'MyoQuestData']
    for id in ids:
        (backup / (id + '.json')).write_text(json.dumps(api.get_note(id), ensure_ascii=False, indent=2), encoding='utf-8')
        (backup / (id + '.txt')).write_text(content(id), encoding='utf-8')
    sidebar = [api.request('GET', '/branches/' + id) for id in api.get_note('_lbVisibleLaunchers')['childBranchIds']]
    (backup / 'sidebar.json').write_text(json.dumps(sidebar, ensure_ascii=False, indent=2), encoding='utf-8')
    for id, (title, path) in COMPONENTS.items():
        api.put_content(id, (ROOT / path).read_text(encoding='utf-8'))
        api.request('PATCH', '/notes/' + id, body={'title': title})
    for id, title in [('HwQuizRoot01', '通用刷题插件'), ('HwQuizBoard01', '通用刷题'), ('al_HwQuiz01', '通用刷题'), ('HwQuizState01', '通用刷题学习记录'), ('HwQuizIndex01', '刷题题库目录')]:
        api.request('PATCH', '/notes/' + id, body={'title': title})
    api.put_content('HwQuizRoot01', '<p>通用题库、学习记录、原始资料与刷题程序组件。支持导入任意科目的自定义题库。</p>')
    for id in ['HwQuizBoard01', 'al_HwQuiz01']:
        attr = next(a for a in api.get_note(id)['attributes'] if a['name'] == 'iconClass' and a['type'] == 'label')
        api.request('PATCH', '/attributes/' + attr['attributeId'], body={'value': 'bx bx-book-open'})
    recent = next(b for b in sidebar if b['noteId'] == '_lbRecentChanges')
    quest = next(b for b in sidebar if b['noteId'] == 'al_MyoQuestEntry')
    quiz = next(b for b in sidebar if b['noteId'] == 'al_HwQuiz01')
    if quest['notePosition'] - recent['notePosition'] < 2:
        raise RuntimeError('侧栏位置没有空位，需重新排序')
    position = (quest['notePosition'] + recent['notePosition']) // 2
    api.request('PATCH', '/branches/' + quiz['branchId'], body={'notePosition': position})
    api.request('POST', '/refresh-note-ordering/_lbVisibleLaunchers')
    actual = api.request('GET', '/branches/' + quiz['branchId'])
    assert recent['notePosition'] < actual['notePosition'] < quest['notePosition'], actual
    market = json.loads(content('MyoMarketData'))
    plugin = next(p for p in market['plugins'] if p['id'] == 'hardware-quiz')
    plugin.update(name='通用刷题', icon='bx bx-book-open', description='知识点归类、每日刷题、薄弱点优先与知识保温，支持弹窗练习、草稿续答、错题和收藏。', version='2.0.0')
    market['revision'] += 1
    api.put_content('MyoMarketData', json.dumps(market, ensure_ascii=False))
    for id, previous in preserved.items():
        assert hashlib.sha256(content(id).encode()).digest() == hashlib.sha256(previous.encode()).digest(), id + ' was changed'
    for id, previous in bank_hashes.items():
        assert hashlib.sha256(content('HwQuizBank' + id[2:]).encode()).hexdigest() == previous, id + ' was changed'
    return {'updated': True, 'backup': str(backup), 'launcherPosition': actual['notePosition'], 'learningRecordsPreserved': True, 'originalBanksPreserved': len(bank_hashes)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:37840/etapi')
    parser.add_argument('--token-file', type=Path, default=Path('C:/Users/杜锦鸿/Desktop/api.txt'))
    args = parser.parse_args()
    api = Etapi(args.url, args.token_file.read_text(encoding='utf-8-sig').strip())
    print(json.dumps(upgrade(api), ensure_ascii=False))
