"""Apply the category/alias plan and the 457 drafted answers into the installed quiz.

Writes (live mode only): HwQuizState01 (aliases, categoryDefs, categories, overrides for the 457 bank),
changed built-in bank notes HwQuizBankXX (teacher-confirmed fixes in customizations/data/hardware-quiz),
then rebuilds the bundle and runs upgrade_generic_quiz.upgrade() to push service/UI/CSS.

Safety: backs up document.db (sqlite online backup, read-only source) plus every touched note into
E:/EricDictionary/backups/category-merge-<ts>/ before any write. Learning records, events, sessions,
tags and question ids are never rewritten; merged duplicates are hidden through state.aliases only.

  python tools/apply_category_merge.py --offline --dry-run   # no Trilium access at all (scratch extracts)
  python tools/apply_category_merge.py --dry-run             # ETAPI read-only diff
  python tools/apply_category_merge.py                       # real apply (close the quiz window first)
"""
from pathlib import Path
import argparse, datetime as dt, hashlib, json, sqlite3, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
SCRATCH = ROOT / 'customizations/_agent_scratch'
DATA = ROOT / 'customizations/data/hardware-quiz'
USER_OWNED = ('用户确认', '用户导入答案')   # never overwrite answers the user set by hand
CONTENT = ('stem', 'options', 'answer', 'type', 'explanation', 'answerSource')   # only these are pushed to bank notes

def teacher_ids():
    import re
    log = SCRATCH / 'teacher_batchA_bank_log.md'
    return set(re.findall(r'(hw\d\d-\d+)\(', log.read_text(encoding='utf-8'))) if log.exists() else set()

def merge_bank(note, disk, scope):
    """Note content stays authoritative for sourceNoteId, images, pages (installed image note ids);
    only CONTENT fields are taken from disk, for the selected scope ('teacher' or 'all')."""
    out = json.loads(json.dumps(note, ensure_ascii=False)); d = {q['id']: q for q in disk['questions']}
    allowed = teacher_ids() if scope == 'teacher' else None; ids = []
    for q in out['questions']:
        src = d.get(q['id'])
        if not src or (allowed is not None and q['id'] not in allowed): continue
        if any(q.get(k) != src.get(k) for k in CONTENT):
            for k in CONTENT:
                if k in src: q[k] = src[k]
            ids.append(q['id'])
    return out, ids

def load_payload(path):
    p = json.loads(Path(path).read_text(encoding='utf-8'))
    assert p.get('version') == 1 and p['aliases'] and p['categories'] and p['overrides'], 'payload malformed'
    return p

def disk_banks():
    idx = json.loads((DATA / 'index.json').read_text(encoding='utf-8'))
    return {b['id']: json.loads((DATA / (b['id'] + '.json')).read_text(encoding='utf-8')) for b in idx['banks']}

def bank_diff(old, new):
    o = {q['id']: q for q in old['questions']}; n = {q['id']: q for q in new['questions']}
    changed = [i for i in n if i in o and any(o[i].get(k) != n[i].get(k) for k in CONTENT)]
    ans = [i for i in changed if o[i].get('answer') != n[i].get('answer')]
    return {'changed': len(changed), 'answerChanged': len(ans), 'added': len(set(n) - set(o)), 'removed': len(set(o) - set(n)), 'sample': changed[:5]}

def plan_state(state, payload, all_ids, force=False):
    """Pure function: returns (new_state, report). Never touches records/events/sessions/study."""
    new = json.loads(json.dumps(state, ensure_ascii=False))
    rep = {}
    old_alias = new.get('aliases') or {}
    rep['aliases'] = {'before': len(old_alias), 'after': len(payload['aliases']),
                      'added': len(set(payload['aliases']) - set(old_alias)),
                      'retargeted': sum(1 for k, v in payload['aliases'].items() if k in old_alias and old_alias[k] != v),
                      'missingIds': sorted({x for kv in payload['aliases'].items() for x in kv} - all_ids)[:20]}
    old_cat = new.get('categories') or {}
    rep['categories'] = {'before': len(old_cat), 'after': len(payload['categories']),
                         'changed': sum(1 for k, v in payload['categories'].items() if old_cat.get(k) != v),
                         'missingIds': sorted(set(payload['categories']) - all_ids)[:20],
                         'unnumberedVisible': len(all_ids - set(payload['categories']) - set(payload['aliases']))}
    new['aliases'] = dict(payload['aliases']); new['categories'] = dict(payload['categories']); new['categoryDefs'] = payload['categoryDefs']
    ov = new.setdefault('overrides', {}); applied = skipped = 0; skipped_ids = []; missing = []
    for qid, o in payload['overrides'].items():
        if qid not in all_ids: missing.append(qid); continue
        prev = ov.get(qid) or {}
        if not force and prev.get('answer') and str(prev.get('answerSource', '')).startswith(USER_OWNED):
            skipped += 1; skipped_ids.append(qid); continue
        ov[qid] = {**prev, **o}; applied += 1
    rec = state.get('records') or {}
    rep['overrides'] = {'applied': applied, 'skippedUserOwned': skipped, 'skippedIds': skipped_ids[:20], 'missingIds': missing[:20],
                        'withExistingOverride': sum(1 for q in payload['overrides'] if q in (state.get('overrides') or {})),
                        'questionsWithAttempts': sum(1 for q in payload['overrides'] if (rec.get(q) or {}).get('attempts'))}
    rep['aliasedWithRecords'] = sum(1 for a in payload['aliases'] if a in rec)
    for k in ('records', 'events', 'sessions', 'study', 'customBanks'):
        assert json.dumps(new.get(k), sort_keys=True) == json.dumps(state.get(k), sort_keys=True), k + ' must not change'
    new['revision'] = state['revision'] + 1
    return new, rep

def offline(payload, force):
    """No Trilium access: reconstruct the custom-bank part of state from the read-only extracts."""
    state = {'version': 1, 'revision': 0, 'records': {}, 'sessions': {}, 'events': [], 'overrides': {}, 'customBanks': {}}
    for f in ('custom_bank_analog457.json', 'custom_bank_interview65.json'):
        b = json.loads((SCRATCH / f).read_text(encoding='utf-8'))
        state['customBanks'][b['bankId']] = {'id': b['bankId'], 'title': b['title'], 'questions': b['questions']}
        state['overrides'].update(b.get('overrides') or {})
    ids = {q['id'] for b in disk_banks().values() for q in b['questions']} | {q['id'] for b in state['customBanks'].values() for q in b['questions']}
    _, rep = plan_state(state, payload, ids, force)
    rep['mode'] = 'offline dry-run (built-in banks from disk, custom banks from extracts; real records unknown)'
    rep['bankNotes'] = 'not compared offline (needs ETAPI)'
    return rep

def live(api, payload, dry, force, skip_upgrade, scope='teacher'):
    def content(i):
        v = api.request('GET', f'/notes/{i}/content', accept='text/plain')
        return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    state_text = content('HwQuizState01'); state = json.loads(state_text)
    if state.get('version') != 1 or not isinstance(state.get('revision'), int): raise RuntimeError('HwQuizState01 格式异常')
    index = json.loads(content('HwQuizIndex01'))
    disk = disk_banks(); notes = {}; bank_rep = {}; merged_banks = {}
    for b in index['banks']:
        nid = 'HwQuizBank' + b['id'][2:]; notes[b['id']] = content(nid)
        if b['id'] in disk and scope != 'none':
            merged, changed = merge_bank(json.loads(notes[b['id']]), disk[b['id']], scope)
            if changed:
                r = bank_diff(json.loads(notes[b['id']]), merged); r['ids'] = changed
                r['withRecords'] = [i for i in changed if i in (state.get('records') or {})]
                r['shadowedByUserOverride'] = [i for i in changed if (state.get('overrides') or {}).get(i, {}).get('answer')]
                bank_rep[b['id']] = r; merged_banks[b['id']] = merged
    ids = {q['id'] for t in notes.values() for q in json.loads(t)['questions']} | {q['id'] for b in (state.get('customBanks') or {}).values() for q in b['questions']}
    new, rep = plan_state(state, payload, ids, force)
    rep['bankScope'] = scope; rep['bankNotes'] = bank_rep; rep['stateRevision'] = [state['revision'], new['revision']]
    if dry:
        rep['mode'] = 'ETAPI dry-run (read-only, nothing written)'; return rep
    if any(rep[k]['missingIds'] for k in ('aliases', 'categories')): raise RuntimeError('计划中的题目编号在已安装题库中不存在，停止')
    ts = dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f'); backup = ROOT / 'backups' / ('category-merge-' + ts); backup.mkdir(parents=True)
    info = api.request('GET', '/app-info'); dbpath = Path(info['dataDirectory']) / 'document.db'
    with sqlite3.connect(f'file:{dbpath.as_posix()}?mode=ro', uri=True) as src, sqlite3.connect(backup / 'document.db') as dst:
        src.backup(dst)
    (backup / 'HwQuizState01.txt').write_text(state_text, encoding='utf-8')
    for bid, t in notes.items(): (backup / f'HwQuizBank{bid[2:]}.txt').write_text(t, encoding='utf-8')
    (backup / 'payload.json').write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
    if content('HwQuizState01') != state_text: raise RuntimeError('学习记录在计划期间被修改，请关闭刷题窗口后重试')
    for bid in bank_rep: api.put_content('HwQuizBank' + bid[2:], json.dumps(merged_banks[bid], ensure_ascii=False))
    api.put_content('HwQuizState01', json.dumps(new, ensure_ascii=False))
    assert json.loads(content('HwQuizState01'))['revision'] == new['revision']
    rep['backup'] = str(backup)
    if not skip_upgrade:
        subprocess.run([sys.executable, str(ROOT / 'tools/build_quiz_learning_plugin.py')], check=True)
        from upgrade_generic_quiz import upgrade
        rep['upgrade'] = upgrade(api)
    rep['mode'] = 'applied'; return rep

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default='http://127.0.0.1:37840/etapi')
    ap.add_argument('--token-file', type=Path, default=Path('C:/Users/杜锦鸿/Desktop/api.txt'))
    ap.add_argument('--payload', type=Path, default=SCRATCH / 'category_merge_payload.json')
    ap.add_argument('--dry-run', action='store_true'); ap.add_argument('--offline', action='store_true')
    ap.add_argument('--force-overrides', action='store_true', help='also replace answers the user confirmed by hand')
    ap.add_argument('--skip-upgrade', action='store_true')
    ap.add_argument('--banks', choices=['none', 'teacher', 'all'], default='teacher', help='which disk edits to push into bank notes (images/sourceNoteId always kept from the note)')
    a = ap.parse_args(); payload = load_payload(a.payload)
    print('payload sha256', hashlib.sha256(a.payload.read_bytes()).hexdigest()[:16])
    if a.offline:
        if not a.dry_run: ap.error('--offline 只能与 --dry-run 一起使用')
        print(json.dumps(offline(payload, a.force_overrides), ensure_ascii=False, indent=1)); sys.exit(0)
    from apply_customizations import Etapi
    api = Etapi(a.url, a.token_file.read_text(encoding='utf-8-sig').strip())
    print(json.dumps(live(api, payload, a.dry_run, a.force_overrides, a.skip_upgrade, a.banks), ensure_ascii=False, indent=1))
