"""Install the native quiz through ETAPI; preserve learning records and snapshot first."""
from pathlib import Path
import json, hashlib, datetime as dt, sqlite3, argparse
from apply_customizations import Etapi, EtapiError, existing_attribute

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'customizations/data/hardware-quiz'
LEGACY_TITLES={'HwQuizRoot01':'硬件刷题插件','HwQuizSvc01':'硬件刷题数据服务','HwQuizUI01':'硬件刷题界面','HwQuizCSS01':'硬件刷题样式','HwQuizOpen01':'打开硬件刷题','HwQuizIndex01':'硬件题库目录','HwQuizState01':'硬件刷题学习记录','HwQuizBoard01':'硬件刷题','al_HwQuiz01':'硬件刷题'}
def install(token_path, base_url):
    key=token_path.read_text(encoding='utf-8-sig').strip()
    api=Etapi(base_url,key)
    info=api.request('GET','/app-info')
    roots=api.search_notes('系统与插件')
    if len(roots)!=1:raise RuntimeError('预期存在唯一的系统与插件入口')
    parent=roots[0]['noteId']
    backup=ROOT/'backups'/('hardware-quiz-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S'))
    backup.mkdir(parents=True)
    dbpath=Path(info['dataDirectory'].replace('\\\\','\\'))/'document.db'
    with sqlite3.connect(f'file:{dbpath.as_posix()}?mode=ro',uri=True) as src, sqlite3.connect(backup/'document.db') as dest: src.backup(dest)
    def get(id):
        try:return api.get_note(id)
        except EtapiError as e:
            if 'HTTP 404' not in str(e):raise
            return None
    def put(id,title,kind,mime,content,parent_id,preserve=False):
        old=get(id)
        if old:
            if old['title'] not in (title,LEGACY_TITLES.get(id)) or old['type']!=kind or old.get('isProtected'):raise RuntimeError('插件标识冲突：'+id)
            previous=api.request('GET',f'/notes/{id}/content',accept='text/plain') if kind not in ('file','image') else None
            if previous is not None:(backup/(id+'.txt')).write_text(previous if isinstance(previous,str) else json.dumps(previous,ensure_ascii=False),encoding='utf-8')
            if not preserve:api.put_content(id,content)
            if old['title']!=title:api.request('PATCH','/notes/'+id,body={'title':title})
        else:api.create_note({'noteId':id,'parentNoteId':parent_id,'title':title,'type':kind,'mime':mime,'content':content})
        return get(id)
    def attr(id,kind,name,value=''):
        n=get(id)
        disabled=next((a for a in n.get('attributes',[]) if a['type']==kind and a['name']=='myoDisabled_'+name),None)
        if disabled:return
        if not existing_attribute(n,kind,name,value):
            same=[a for a in n.get('attributes',[]) if a['type']==kind and a['name']==name]
            if same:
                if id in ('HwQuizBoard01','al_HwQuiz01') and name=='iconClass' and len(same)==1 and same[0]['value']=='bx bx-chip':
                    api.request('PATCH','/attributes/'+same[0]['attributeId'],body={'value':value});return
                raise RuntimeError('已有属性与安装目标冲突：'+id+'/'+name)
            api.add_attribute(id,{'type':kind,'name':name,'value':value,'isInheritable':False})
    def binary(id,title,kind,mime,path,parent_id):
        old=get(id)
        if old:
            if old['title']!=title or old['type']!=kind:raise RuntimeError('文件标识冲突：'+id)
        else:api.create_note({'noteId':id,'parentNoteId':parent_id,'title':title,'type':kind,'mime':mime,'content':''})
        api.request('PUT',f'/notes/{id}/content',body=path.read_bytes(),content_type='application/octet-stream',accept='text/plain')
    put('HwQuizRoot01','通用刷题插件','text','text/html','<p>通用题库、学习记录、原始资料与程序组件。</p>',parent)
    attr('HwQuizRoot01','label','homeInternal')
    components=[('HwQuizSvc01','通用刷题数据服务','application/javascript;env=backend','customizations/backend/hardware-quiz-service.js'),
        ('HwQuizUI01','通用刷题界面','text/jsx','customizations/frontend/hardware-quiz.jsx'),
        ('HwQuizCSS01','通用刷题样式','text/css','customizations/frontend/hardware-quiz.css'),
        ('HwQuizOpen01','打开通用刷题','application/javascript;env=frontend','customizations/frontend/open-hardware-quiz.js')]
    for id,title,mime,path in components:
        put(id,title,'code',mime,(ROOT/path).read_text(encoding='utf-8'),'HwQuizRoot01');attr(id,'label','homeInternal')
    attr('HwQuizCSS01','label','appCss')
    index=json.loads((DATA/'index.json').read_text(encoding='utf-8'))
    for definition in index['banks']:
        id=definition['id'];num=id[2:]
        bank=json.loads((DATA/(id+'.json')).read_text(encoding='utf-8'))
        bank['sourceNoteId']='HwQuizPDF'+num
        binary(bank['sourceNoteId'],bank['sourceName'],'file','application/pdf',Path(bank['sourcePath']),'HwQuizRoot01')
        for q in bank['questions']:
            images=[]
            for filename in q['images']:
                image_id='HwQImg'+hashlib.sha256(filename.encode()).hexdigest()[:20]
                binary(image_id,filename,'image','image/png',DATA/'images'/filename,'HwQuizRoot01');images.append(image_id)
            q['images']=images
        put('HwQuizBank'+num,'硬件题库 '+bank['title'],'code','application/json',json.dumps(bank,ensure_ascii=False),'HwQuizRoot01')
        attr('HwQuizBank'+num,'label','homeInternal')
        print('IMPORTED',id,len(bank['questions']),flush=True)
    put('HwQuizIndex01','刷题题库目录','code','application/json',json.dumps(index,ensure_ascii=False),'HwQuizRoot01')
    attr('HwQuizIndex01','label','homeInternal')
    initial={'version':1,'revision':0,'records':{},'sessions':{},'events':[],'overrides':{}}
    put('HwQuizState01','通用刷题学习记录','code','application/json',json.dumps(initial),'HwQuizRoot01',preserve=True)
    attr('HwQuizState01','label','homeInternal');attr('HwQuizState01','label','hardwareQuizData')
    put('HwQuizBoard01','通用刷题','render','text/html','','HwQuizRoot01');attr('HwQuizBoard01','relation','renderNote','HwQuizUI01');attr('HwQuizBoard01','label','iconClass','bx bx-book-open');attr('HwQuizBoard01','label','homeInternal')
    put('al_HwQuiz01','通用刷题','launcher','text/html','','_lbVisibleLaunchers');attr('al_HwQuiz01','label','launcherType','script');attr('al_HwQuiz01','label','iconClass','bx bx-book-open');attr('al_HwQuiz01','relation','script','HwQuizOpen01')
    launch=get('al_HwQuiz01')
    for branchid in launch.get('branchIds',[]):
        branch=api.request('GET','/branches/'+branchid)
        if branch['parentNoteId']=='_lbVisibleLaunchers':api.request('PATCH','/branches/'+branchid,body={'notePosition':57})
    api.request('POST','/refresh-note-ordering/_lbVisibleLaunchers')
    market=api.request('GET','/notes/MyoMarketData/content',accept='text/plain')
    if isinstance(market,str):market=json.loads(market)
    (backup/'market.json').write_text(json.dumps(market,ensure_ascii=False,indent=2),encoding='utf-8')
    plugin=next((p for p in market['plugins'] if p.get('id')=='hardware-quiz'),None)
    if not plugin:
        plugin={'id':'hardware-quiz','roots':['HwQuizRoot01'],'entry':'HwQuizBoard01','category':'专注与学习','locked':False};market['plugins'].append(plugin)
    plugin.update(name='通用刷题',icon='bx bx-book-open',description='知识点归类、每日刷题、薄弱点优先与知识保温，支持弹窗练习、草稿续答、错题和收藏。',version='2.0.0')
    market['revision']+=1;api.put_content('MyoMarketData',json.dumps(market,ensure_ascii=False))
    verification={'installed':True,'banks':len(index['banks']),'questions':sum(b['count'] for b in index['banks']),'referenceAnswers':sum(b['answered'] for b in index['banks']),'backup':str(backup),'noteId':'HwQuizBoard01'}
    (DATA/'installation.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2),encoding='utf-8')
    return verification

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--token-file',type=Path,default=Path('C:/Users/杜锦鸿/Desktop/api.txt'));parser.add_argument('--url',default='http://127.0.0.1:37840/etapi');args=parser.parse_args()
    print(json.dumps(install(args.token_file,args.url),ensure_ascii=False))
