"""Canonical feature packages. Components stay in place; ownership is explicit."""
DEFINITIONS=[
    dict(id='gTC4ItLtMiD5',name='工作台',roots=['gTC4ItLtMiD5','MD9L0aUcgHSV','HmOpenHomeTab','HmStartHome1','HmWordDeltaHook','HmLayoutLib1','HmHomeSvc01','HmHomeData01'],entries=['HmeDashboard'],category='工作空间',icon='bx bx-home',description='首页卡片、拖拽布局、快速记录与修改字数统计。',aliases=['gTC4ItLtMiD5'],optionalDependencies=['TdBoardJs001','x9qOG6S641fS']),
    dict(id='KbWikiRoot01',name='知识库与 Wiki',roots=['KbWikiRoot01','MyoHardwareHome'],entries=['KbHubHome001','KbGraphNote1'],category='工作空间',icon='bx bx-library',description='统一导航、学术与硬件子库、专题浏览和 Wiki。硬件首页已合并。',aliases=['KbWikiRoot01','MyoHardwareHome'],optionalDependencies=['DsChatRoot1']),
    dict(id='NxExperience1',name='笔记增强',roots=['NxExperience1','MyoReadPos01','MyoBlockRef1','MyoChapRail','MyoFindNav1','HmAutoFormula','68f2a3f8a81c','2e293f827035','9Y5dJJ9SOWTm','NtStyleCfg01','NtStyleUI001','NtStyleCSS01','NxEditorUtil1'],entries=[],category='笔记与阅读',icon='bx bx-book-reader',description='全文定位、阅读记忆、段落引用、章节预览、公式粘贴、代码复制、图片预览及笔记排版。',aliases=['NxExperience1','MyoReadPos01','MyoBlockRef1','MyoChapRail','MyoFindNav1','HmAutoFormula','68f2a3f8a81c','2e293f827035','9Y5dJJ9SOWTm']),
    dict(id='ThmStudioRoot',name='外观与主题',roots=['ThmStudioRoot','MyoCodexUI01','MyoCodexDark1','MyoCodexSwitch','44929c42d660'],exclude=['NtStyleCfg01','NtStyleUI001','NtStyleCSS01'],entries=[],category='主题与资源',icon='bx bx-palette',description='全局配色、主题预览和日夜动画开关。关闭时切回原生主题，重开可恢复原配色。',aliases=['ThmStudioRoot','MyoCodexUI01','MyoCodexDark1','MyoCodexSwitch','44929c42d660'],managedThemes=True),
    dict(id='MyoQuestGroup',name='人升',roots=['MyoQuestGroup'],entries=['MyoQuestBoard','MyoQuestShop','MyoQuestStock'],category='专注与学习',icon='bx bx-task',description='委托、成长、奖励商店与仓库。关闭保留成长及库存数据。',aliases=['MyoQuestGroup']),
    dict(id='x9qOG6S641fS',name='番茄钟',roots=['x9qOG6S641fS'],entries=['MyoPomoBoard'],category='专注与学习',icon='bx bx-timer',description='专注计时、活动标签与统计。人升联动可选，关闭人升仍可独立计时。',aliases=['x9qOG6S641fS'],optionalDependencies=['MyoQuestGroup']),
    dict(id='hardware-quiz',name='通用刷题',roots=['HwQuizRoot01'],entries=['HwQuizBoard01'],category='专注与学习',icon='bx bx-book-open',description='题库、答题、错题与学习记录。关闭保留题库和进度。',aliases=['hardware-quiz']),
    dict(id='DsChatRoot1',name='DeepSeek 助手',roots=['DsChatRoot1'],entries=[],category='笔记与阅读',icon='deepseek-brand-icon',description='原生右侧聊天面板、DSH 本机桥接与消息排版。关闭后移除入口并阻止继续调用模型。',aliases=['DsChatRoot1']),
    dict(id='TdBoardJs001',name='任务管理',roots=['TdBoardJs001','TdBoardCss01','fp5E04FWklh8','8413f5ba9378'],entries=['ZrxUIJf75kFS'],category='工作空间',icon='bx bx-columns',description='ToDo 任务、四列看板及配套视图。关闭时工作台不再修改任务。',aliases=['TdBoardJs001','fp5E04FWklh8','8413f5ba9378']),
    dict(id='extension-views',name='拓展视图',roots=['uxB4a8BADIhe','3fc9205db633','593c1336d56c','VYCVSNsI3xEU'],entries=['uxB4a8BADIhe','3fc9205db633','593c1336d56c'],category='笔记与阅读',icon='bx bx-layout',description='时间线、标签检索、收藏夹及历史思维导图资源；不自动启动原本未启用的脚本。',aliases=['uxB4a8BADIhe','3fc9205db633','593c1336d56c','VYCVSNsI3xEU']),
    dict(id='interface-tools',name='界面小工具',roots=['MyoCalView1','MyoNewRoot1','9QpZWGgx2Q2N','XI3RJavrRKCt'],entries=[],category='工作空间',icon='bx bx-wrench',description='日历浏览与新建根笔记入口，收纳历史界面脚本；保留原有运行状态。',aliases=['MyoCalView1','MyoNewRoot1','9QpZWGgx2Q2N','XI3RJavrRKCt']),
    dict(id='icon-resources',name='图标资源',roots=['d2f0bfd5f559','189a80c2a50d','805af9cc1a99','BRxYkbVuMDrY','1dCU3fYq2Mal'],entries=[],category='主题与资源',icon='bx bx-shapes',description='Emoji、Font Awesome、Material 与电路图标包。关闭仅停用图标包注册，不改写笔记图标属性。',aliases=['d2f0bfd5f559','189a80c2a50d','805af9cc1a99']),
    dict(id='HwPersonalTools',name='资料导入工具',roots=['HwPersonalTools'],entries=[],category='数据工具',icon='bx bx-import',description='个人硬件资料的导入请求与回执。关闭停用导入事件，保留导入记录。',aliases=['HwPersonalTools']),
    dict(id='GhSyncRoot01',name='GitHub 数据库同步',roots=['GhSyncRoot01'],entries=['GhSyncView01'],category='数据工具',icon='bx bxl-github',description='私有仓库完整快照、笔记增删改对比、手动确认及关闭后恢复；启动检查可选。',aliases=['GhSyncRoot01']),
]

def consolidate(registry,get_note):
    previous={p['id']:p for p in registry['plugins']};result=[];owners={};consumed={'market'}
    def descendants(id,seen):
        if id in seen:return
        note=get_note(id)
        if not note or note.get('isDeleted'):return
        seen.add(id)
        for child in note.get('childNoteIds',[]):descendants(child,seen)
    for spec in DEFINITIONS:
        ids=set()
        for root in spec['roots']:descendants(root,ids)
        ids.difference_update(spec.get('exclude',[]))
        if not ids:continue
        for id in ids:
            if id in owners:raise RuntimeError(f'Component belongs to two plugins: {id}: {owners[id]} / {spec["id"]}')
            owners[id]=spec['id']
        old=previous.get(spec['id'],{})
        state=old.get('enabled') if registry.get('catalogVersion')==2 else None
        if not isinstance(state,bool):
            state=any(not a['name'].startswith('myoDisabled_') and a['type']=='label' and a['name'] in ('run','widget','appCss','iconPack','appTheme') for id in ids for a in get_note(id).get('attributes',[]) if a['noteId']==id)
            state=state or any(a['type']=='relation' and a['name'] in ('renderNote','script','runOnNoteContentChange','runOnAttributeChange') for id in ids for a in get_note(id).get('attributes',[]) if a['noteId']==id)
        definition={**old,**{k:v for k,v in spec.items() if k not in ('exclude','aliases')},'componentIds':sorted(ids),'enabled':state,'version':'2.0.0'}
        definition['entry']=(spec['entries'] or spec['roots'])[0];result.append(definition);consumed.add(spec['id']);consumed.update(spec['aliases']);consumed.update(ids)
    # Preserve unrelated third-party packages instead of losing them on migration.
    for plugin in registry['plugins']:
        if plugin['id'] not in consumed:result.append(plugin)
    result.append({**previous.get('market',{}),'id':'market','name':'插件管理器','roots':['MyoMarketRoot'],'entry':registry['rootId'],'core':True,'locked':True,'version':'2.0.0','description':'系统管理入口，保留以便重新开启功能插件。'})
    return {**registry,'catalogVersion':2,'plugins':result}

def refresh_catalog(api):
    """Keep an already consolidated installation canonical after component updates."""
    import json
    from apply_customizations import EtapiError
    registry=api.request('GET','/notes/MyoMarketData/content')
    if registry.get('catalogVersion')!=2:return
    cache={}
    def get(id):
        if id not in cache:
            try:cache[id]=api.get_note(id)
            except EtapiError as error:
                if 'HTTP 404' not in str(error):raise
                cache[id]=None
        return cache[id]
    updated=consolidate(registry,get)
    if updated!=registry:
        updated['revision']+=1;api.put_content('MyoMarketData',json.dumps(updated,ensure_ascii=False,indent=2))
