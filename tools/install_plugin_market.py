"""Install the local plugin market without changing plugin states or user data."""
import datetime as dt
import json
import sqlite3
from pathlib import Path
from contextlib import closing
from apply_customizations import Etapi, EtapiError, existing_attribute
from plugin_groups import create_folder

ROOT=Path(__file__).resolve().parents[1]
COMPONENTS=[('MyoMarketSvc1','插件市场数据服务','application/javascript;env=backend','customizations/backend/plugin-market-service.js'),('MyoMarketUI01','插件市场界面','text/jsx','customizations/frontend/plugin-market.jsx'),('MyoMarketCSS1','插件市场样式','text/css','customizations/frontend/plugin-market.css')]
DESCRIPTIONS={
    '硬件知识库首页':('阅读与导航','bx bx-book-open','专题卡片、章节导航、关键词搜索、阅读预览与收藏。',None),
    '番茄钟':('专注与学习','bx bx-timer','活动标签、专注计时、热力图与人升委托联动。','MyoPomoBoard'),
    '学习 RPG':('专注与学习','bx bx-task','学习委托、奖励商店、道具效果与人物成长。','MyoQuestBoard'),
    '阅读位置记忆与恢复':('阅读与导航','bx bx-bookmark','记住笔记阅读位置，再次打开时恢复。',None),
    '段落与标题引用':('阅读与导航','bx bx-link','为笔记段落、标题创建可跳转引用。',None),
    '章节分级预览条':('阅读与导航','bx bx-list-ul','在正文右侧预览章节，快速定位标题。',None),
    '查找结果定位修复':('阅读与导航','bx bx-search','查找上下切换时滚动到匹配文字。',None),
    '自动公式粘贴':('编辑工具','bx bx-math','粘贴数学表达式时自动转换公式。',None),
    '字典排版 · 学术与硬件':('主题与外观','bx bx-font','知识库正文、标题与段落的排版样式。',None),
    'ToDo 四列看板':('任务管理','bx bx-columns','进行中、已完成、冻结、归档四列任务看板。','ZrxUIJf75kFS'),
    'Home 仪表盘':('工作台','bx bx-home','主页仪表盘、启动入口与实际修改字数统计。',None),
}

def registry_for(get_note, root_id, previous=None):
    root=get_note(root_id)
    definitions=[];used=set()
    def available(ids):return [id for id in ids if get_note(id)]
    def add(name,ids,category=None):
        ids=available(ids)
        if not ids:return
        used.update(ids)
        group,icon,description,entry=DESCRIPTIONS.get(name,(category or '插件与组件','bx bx-extension','已安装的 '+name+' 组件。',None))
        definitions.append({'id':ids[0],'name':name,'roots':ids,'category':group,'icon':icon,'description':description,'entry':entry})
    add('Home 仪表盘',['gTC4ItLtMiD5','MD9L0aUcgHSV','HmOpenHomeTab','HmStartHome1','HmWordDeltaHook'])
    add('ToDo 四列看板',['TdBoardJs001','TdBoardCss01'])
    containers={'插件','Plugins & Components','🎨 主题与外观','📦 图标包','🧩 插件与组件','阅读与导航'}
    skip={'HmWordDeltaDat'}
    def enumerate_note(id,category=None):
        if id in used or id in skip or id.startswith('MyoMarket'):return
        note=get_note(id)
        if not note:return
        title=note['title']
        if title in containers:
            for child in note.get('childNoteIds',[]):enumerate_note(child,'主题与外观' if '主题' in title else '图标包' if '图标' in title else '阅读与导航' if title=='阅读与导航' else category)
        elif note['type'] in ('code','render','file','text','book'):
            if note['type'] in ('text','book') and not note.get('childNoteIds'):return
            if title=='番茄钟' and note['type']!='text':return
            add(title,[id],category)
    for child in root.get('childNoteIds',[]):enumerate_note(child)
    definitions.append({'id':'market','name':'插件市场','roots':['MyoMarketRoot'],'entry':root_id,'category':'系统工具','icon':'bx bx-store','description':'管理已安装插件，查看更新时间与启用状态。','locked':True,'version':'1.0.0'})
    result={'version':1,'revision':(previous or {}).get('revision',0),'rootId':root_id,'plugins':definitions,'history':(previous or {}).get('history',[])}
    if previous and previous.get('catalogVersion')==2:
        from plugin_catalog import consolidate
        existing={p['id'] for p in previous['plugins']}
        result={**previous,'plugins':previous['plugins']+[p for p in definitions if p['id'] not in existing]}
        result=consolidate(result,get_note)
    return result

def install_live(api):
    roots=[n for n in api.search_notes('系统与插件') if n['type'] in ('text','render')] or api.search_notes('Myosotis 程序组件')
    if len(roots)!=1:raise RuntimeError('Expected one program root')
    root_id=roots[0]['noteId'];cache={}
    def note(id):
        if id not in cache:
            try:cache[id]=api.get_note(id)
            except EtapiError as error:
                if 'HTTP 404' not in str(error):raise
                cache[id]=None
        return cache[id]
    original=note(root_id)
    if original['type'] not in ('text','render') or original.get('isProtected'):raise RuntimeError('Program root cannot be converted')
    root_rel=[attr for attr in original.get('attributes',[]) if attr['type']=='relation' and attr['name']=='renderNote']
    if any(attr['value']!='MyoMarketUI01' for attr in root_rel):raise RuntimeError('Program root already has another render view')
    stamp=dt.datetime.now().strftime('%Y%m%d-%H%M%S')
    backup=ROOT/'backups'/('plugin-market-'+stamp);backup.mkdir(parents=True)
    snapshot={'root':original,'content':api.request('GET',f'/notes/{root_id}/content',accept='text/plain')}
    (backup/'before-root.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8')
    if not note('MyoMarketRoot'):api.create_note({'noteId':'MyoMarketRoot','parentNoteId':root_id,'title':'插件市场','type':'text','content':'本地插件市场程序组件。','notePosition':1})
    for id,title,mime,path in COMPONENTS:
        old=note(id)
        if old and (old['title']!=title or old['type']!='code'):raise RuntimeError('Component ID collision: '+id)
        content=(ROOT/path).read_text(encoding='utf-8')
        if old:
            (backup/(id+'.txt')).write_text(api.request('GET',f'/notes/{id}/content',accept='text/plain'),encoding='utf-8');api.put_content(id,content)
        else:api.create_note({'noteId':id,'parentNoteId':'MyoMarketRoot','title':title,'type':'code','mime':mime,'content':content})
        actual=api.get_note(id)
        for label in (['homeInternal','appCss'] if id=='MyoMarketCSS1' else ['homeInternal']):
            if not existing_attribute(actual,'label',label,''):api.add_attribute(id,{'type':'label','name':label,'value':'','isInheritable':False,'position':10})
        assert api.request('GET',f'/notes/{id}/content',accept='text/plain')==content
    previous=None
    if note('MyoMarketData'):
        previous=api.request('GET','/notes/MyoMarketData/content',accept='application/json')
        (backup/'before-registry.json').write_text(json.dumps(previous,ensure_ascii=False,indent=2),encoding='utf-8')
    registry=registry_for(note,root_id,previous)
    content=json.dumps(registry,ensure_ascii=False,indent=2)
    if previous is None:api.create_note({'noteId':'MyoMarketData','parentNoteId':'MyoMarketRoot','title':'插件市场配置','type':'code','mime':'application/json','content':content})
    else:api.put_content('MyoMarketData',content)
    data=api.get_note('MyoMarketData')
    if not existing_attribute(data,'label','pluginMarketData',''):api.add_attribute('MyoMarketData',{'type':'label','name':'pluginMarketData','value':'','isInheritable':False,'position':10})
    if not root_rel:api.add_attribute(root_id,{'type':'relation','name':'renderNote','value':'MyoMarketUI01','isInheritable':False,'position':30})
    if not existing_attribute(api.get_note(root_id),'label','hideChildrenOverview',''):api.add_attribute(root_id,{'type':'label','name':'hideChildrenOverview','value':'','isInheritable':False,'position':40})
    api.request('PATCH',f'/notes/{root_id}',body={'type':'render','mime':'text/html'})
    assert api.get_note(root_id)['type']=='render'
    from install_market_sidebar import install_live as install_sidebar
    install_sidebar(api,root_id)
    return {'installed':'插件市场','plugins':len(registry['plugins']),'backup':str(backup),'rootId':root_id}

def install(path):
    path=Path(path).resolve(strict=True);now=dt.datetime.now().astimezone();local=now.isoformat(sep=' ',timespec='milliseconds');utc=now.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    backup=path.parent/'backup'/f'before-plugin-market-{now:%Y%m%d-%H%M%S-%f}.db';backup.parent.mkdir(exist_ok=True)
    with closing(sqlite3.connect(path)) as db,db:
        with closing(sqlite3.connect(backup)) as target:db.backup(target)
        roots=db.execute("select noteId from notes where title in ('系统与插件','Myosotis 程序组件') and type in ('text','render') and isDeleted=0").fetchall()
        if len(roots)!=1:raise RuntimeError('Expected one program root')
        root_id=roots[0][0]
        if not db.execute("select 1 from notes where noteId='MyoMarketRoot'").fetchone():create_folder(db,'MyoMarketRoot','插件市场',root_id,'MyoMarketRootBr',local,utc)
        def put(id,title,mime,content):
            old=db.execute('select title,type from notes where noteId=?',(id,)).fetchone()
            if old and old!=(title,'code'):raise RuntimeError('Component ID collision: '+id)
            blob=id+'B'
            db.execute('insert into blobs(blobId,content,dateModified,utcDateModified,textRepresentation) values(?,?,?,?,?) on conflict(blobId) do update set content=excluded.content,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified,textRepresentation=excluded.textRepresentation',(blob,content,local,utc,content))
            db.execute("insert into notes(noteId,title,type,mime,isProtected,blobId,isDeleted,dateCreated,dateModified,utcDateCreated,utcDateModified) values(?,?,'code',?,0,?,0,?,?,?,?) on conflict(noteId) do update set blobId=excluded.blobId,dateModified=excluded.dateModified,utcDateModified=excluded.utcDateModified",(id,title,mime,blob,local,local,utc,utc))
            if not db.execute('select 1 from branches where noteId=? and parentNoteId=? and isDeleted=0',(id,'MyoMarketRoot')).fetchone():db.execute('insert into branches(branchId,noteId,parentNoteId,notePosition,isExpanded,isDeleted,utcDateModified) values(?,?,?,10,0,0,?)',(id+'Br',id,'MyoMarketRoot',utc))
        def attribute(id,kind,name,value):
            if not db.execute('select 1 from attributes where noteId=? and type=? and name=? and isDeleted=0',(id,kind,name)).fetchone():db.execute('insert into attributes(attributeId,noteId,type,name,value,position,isDeleted,isInheritable,utcDateModified) values(?,?,?,?,?,10,0,0,?)',(id+'Market'+name,id,kind,name,value,utc))
        for id,title,mime,source in COMPONENTS:
            put(id,title,mime,(ROOT/source).read_text(encoding='utf-8'));attribute(id,'label','homeInternal','')
        attribute('MyoMarketCSS1','label','appCss','')
        def note(id):
            row=db.execute('select noteId,title,type from notes where noteId=? and isDeleted=0',(id,)).fetchone()
            if not row:return None
            return {'noteId':row[0],'title':row[1],'type':row[2],'childNoteIds':[x[0] for x in db.execute('select noteId from branches where parentNoteId=? and isDeleted=0',(id,))]}
        previous=db.execute("select b.content from notes n join blobs b on b.blobId=n.blobId where n.noteId='MyoMarketData'").fetchone()
        registry=registry_for(note,root_id,json.loads(previous[0]) if previous else None)
        put('MyoMarketData','插件市场配置','application/json',json.dumps(registry,ensure_ascii=False,indent=2));attribute('MyoMarketData','label','pluginMarketData','')
        attribute(root_id,'relation','renderNote','MyoMarketUI01')
        attribute(root_id,'label','hideChildrenOverview','')
        db.execute("update notes set type='render',mime='text/html' where noteId=?",(root_id,))
    from install_market_sidebar import install as install_sidebar
    install_sidebar(path)
    return {'installed':'插件市场','plugins':len(registry['plugins']),'backup':str(backup)}

if __name__=='__main__':
    import argparse,os
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--db',type=Path);parser.add_argument('--live',action='store_true');args=parser.parse_args()
    if args.live:result=install_live(Etapi('http://127.0.0.1:37840/etapi',os.environ['TRILIUM_ETAPI_TOKEN']))
    elif args.db:result=install(args.db)
    else:parser.error('Choose --live or --db')
    print(json.dumps(result,ensure_ascii=False))
