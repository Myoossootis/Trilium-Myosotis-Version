"""Deploy only three quiz program notes, verify user data, and package the manual browser helper."""
from pathlib import Path
import datetime as dt
import hashlib
import json
import shutil
import zipfile
from apply_customizations import Etapi

ROOT = Path(__file__).resolve().parents[1]
WORK = Path('D:/Codex/nowcoder-visible-v1')
COMPONENTS = {'HwQuizSvc01':'customizations/backend/hardware-quiz-service.js', 'HwQuizUI01':'customizations/frontend/hardware-quiz.jsx', 'HwQuizCSS01':'customizations/frontend/hardware-quiz.css'}

def main():
    backup = Path((WORK/'latest-backup.txt').read_text(encoding='utf-8'))
    baseline = json.loads((backup/'baseline.json').read_text(encoding='utf-8'))
    api = Etapi('http://127.0.0.1:37840/etapi',Path('C:/Users/杜锦鸿/Desktop/api.txt').read_text(encoding='utf-8-sig').strip())
    def content(note):
        value=api.request('GET',f'/notes/{note}/content',accept='text/plain')
        return value if isinstance(value,str) else json.dumps(value,ensure_ascii=False)
    def digest(value):return hashlib.sha256(value.encode()).hexdigest()
    old={id:content(id) for id in COMPONENTS}
    prior=WORK/'deployment-report.json'
    expected=json.loads(prior.read_text(encoding='utf-8'))['programHashes'] if prior.exists() else {id:baseline[id]['sha'] for id in COMPONENTS}
    for id,value in old.items():
        if digest(value)!=expected[id]:raise RuntimeError(f'{id} changed since baseline; stop without overwriting')
    if prior.exists():
        followup=backup/('program-before-followup-'+dt.datetime.now().strftime('%H%M%S'));followup.mkdir()
        for id,value in old.items():(followup/(id+'.txt')).write_text(value,encoding='utf-8')
    index=json.loads(content('HwQuizIndex01'))
    preserve=['HwQuizState01','HwQuizIndex01',*[f"HwQuizBank{b['id'][2:]}" for b in index['banks']]]
    before={id:digest(content(id)) for id in preserve}
    (backup/'preserved-data-hashes.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
    changed=[]
    try:
        for id,file in COMPONENTS.items():
            source=(ROOT/file).read_text(encoding='utf-8')
            api.put_content(id,source);changed.append(id)
            if content(id)!=source:raise RuntimeError(f'{id} readback failed')
        after={id:digest(content(id)) for id in preserve}
        if before!=after:raise RuntimeError('User data changed during deployment; inspect before claiming preservation')
    except Exception:
        for id in reversed(changed):api.put_content(id,old[id])
        raise
    target=Path('D:/Codex/plugins/nowcoder-visible-v0.1.0');target.mkdir(parents=True,exist_ok=True)
    files=['manifest.json','popup.html','popup.css','capture.js','format.js','popup.js','使用说明.md']
    for name in files:shutil.copy2(ROOT/'browser-helpers/nowcoder-visible'/name,target/name)
    archive=WORK/'牛客当前题目助手-v0.1.0.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for name in files:z.write(target/name,'nowcoder-visible-v0.1.0/'+name)
    report={'deployedAt':dt.datetime.now().astimezone().isoformat(),'updatedProgramNotes':list(COMPONENTS),'preservedDataNotes':len(preserve),'userDataUnchanged':before==after,'backup':str(backup),'helperFolder':str(target),'zip':str(archive),'programHashes':{id:digest(content(id)) for id in COMPONENTS},'helperHashes':{name:hashlib.sha256((target/name).read_bytes()).hexdigest() for name in files},'verification':'Offline DOM/popup/rendered-import tests passed; authenticated Nowcoder layout and loaded browser extension require user-page acceptance.'}
    (WORK/'deployment-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
