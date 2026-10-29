"""Create a disposable native test database; never mutate the live database."""
from pathlib import Path
import sqlite3
import json
ROOT=Path(__file__).resolve().parents[1]
target=ROOT/'tmp/quiz/native-learning-2'
target.mkdir(parents=True,exist_ok=True)
source=Path('C:/Users/杜锦鸿/AppData/Roaming/trilium-data/document.db')
with sqlite3.connect(f'file:{source.as_posix()}?mode=ro',uri=True) as live, sqlite3.connect(target/'document.db') as test:
    live.backup(test)
    test.execute("UPDATE options SET value='' WHERE name IN ('syncServerHost','syncServerPassword','syncProxy')")
    test.execute("UPDATE options SET value='false' WHERE name='syncEnabled'")
    test.commit()
(target/'config.ini').write_text('[General]\nnoAuthentication=true\nnoBackup=true\nnoDesktopIcon=true\n[Network]\nhost=127.0.0.1\nport=37843\nhttps=false\n[Security]\nbackendScriptingEnabled=true\nsqlConsoleEnabled=false\n',encoding='utf-8')
(target/'security.json').write_text(json.dumps({'backendScriptingEnabled':True}),encoding='utf-8')
print('Prepared isolated native test database')
