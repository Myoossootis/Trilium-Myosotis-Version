"""Build an independent UI prototype from local question files; no Trilium writes."""
from pathlib import Path
import json
import shutil

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'prototypes/quiz-learning'
DEST.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'customizations/data/hardware-quiz'
topics=[
    {'id':'analog','name':'模拟电路','parent':None},
    {'id':'diode','name':'二极管','parent':'analog'},
    {'id':'capacitor','name':'电容与 RC 电路','parent':'analog'},
    {'id':'amplifier','name':'放大电路','parent':'analog'},
    {'id':'digital','name':'数字电路','parent':None},
    {'id':'logic','name':'逻辑接口','parent':'digital'},
    {'id':'timing','name':'时序与总线','parent':'digital'},
    {'id':'board','name':'单板设计','parent':None},
    {'id':'power','name':'电源设计','parent':'board'},
    {'id':'signal','name':'信号完整性','parent':'board'},
]
# These tags illustrate the proposed interaction only, not actual classification.
examples={'hw01-001':['capacitor'],'hw01-002':['diode'],'hw01-003':['capacitor'],
          'hw01-005':['signal'],'hw01-006':['capacitor','timing'],'hw01-007':['timing'],
          'hw01-012':['diode'],'hw02-001':['timing'],'hw02-003':['power'],
          'hw02-005':['amplifier'],'hw02-006':['signal'],'hw02-007':['power'],
          'hw02-009':['capacitor'],'hw02-010':['power'],'hw02-011':['logic'],
          'hw03-001':['capacitor'],'hw03-002':['amplifier'],'hw03-003':['power'],
          'hw03-007':['capacitor'],'hw03-008':['logic'],'hw03-010':['power'],
          'hw04-012':['timing']}
questions=[]
banks=[]
image_dir=DEST/'images'
image_dir.mkdir(exist_ok=True)
for i in range(1,29):
    bank=json.loads((SOURCE/f'hw{i:02}.json').read_text(encoding='utf-8'))
    banks.append({'id':bank['id'],'title':bank['sourceName'],'count':len(bank['questions'])})
    for original in bank['questions']:
        q={k:original[k] for k in ['id','number','stem','type','options','answer','explanation','answerSource','pages']}
        q.update(source=bank['sourceName'],sourceId=bank['id'],tags=examples.get(q['id'],[]),images=[])
        for name in original['images']:
            source=SOURCE/'images'/name
            if source.exists():
                shutil.copy2(source,image_dir/name)
                q['images'].append('images/'+name)
        questions.append(q)
data={'questions':questions,'sources':banks,'topics':topics}
(DEST/'data.js').write_text('window.QUIZ_DEMO='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
print(f'Built prototype data: {len(questions)} questions, {len(banks)} import sources; independent example tags')
