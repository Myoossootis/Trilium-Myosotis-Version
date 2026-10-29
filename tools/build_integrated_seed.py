"""Build a public seed from explicitly owned program components, never a DB copy.

The old public seed supplies only schema and default options/built-ins. All live
text bodies, histories, credentials, imported question banks and media are omitted.
"""
import argparse,base64,datetime as dt,hashlib,json,re,secrets,sqlite3
from contextlib import closing
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
STAMP=dt.datetime.now(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
ICON_IDS={'d2f0bfd5f559','98c29f22ec52','aa8f08eda918','3a0a85176fed','BRxYkbVuMDrY','1dCU3fYq2Mal'}
PLACEHOLDERS={
 'root':('根笔记','text'), '_hidden':('隐藏的笔记','text'),
 '0e50f559e1a3':('系统与插件','render'),'HmeDashboard':('工作台','render'),
 'KbHubHome001':('知识库','render'),'e3e7d52e13a9':('硬件工程师知识库','render'),
 '79483c47e0d0':('学术知识库','text'),'KbWikiFolder1':('主题 Wiki','text'),'tPEhNqMKFiVJ':('硬件知识图谱','noteMap'),
 'eae485474234':('工作台资料','text'),'e6856b492955':('待整理资料','text'),
 'ZrxUIJf75kFS':('ToDo 清单','render'),'52Z91MOBH5g9':('进行中','text'),
 'IXeWPMzNDeCF':('待办','text'),'VRagMKcXpZ6N':('已完成','text'),'G1dMogAOtW5i':('归档','text')}

def connect(path):
 c=sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row;return c
def content(c,id):
 row=c.execute('SELECT content FROM notes JOIN blobs USING(blobId) WHERE noteId=?',(id,)).fetchone()
 return row[0] if row else b''
def insert(c,table,row):
 keys=list(row);c.execute('INSERT OR REPLACE INTO '+table+'('+','.join(keys)+') VALUES('+','.join('?' for _ in keys)+')',[row[k] for k in keys])

def build(source,template,target):
 if target.exists():raise ValueError('Output exists; choose a new output path')
 target.parent.mkdir(parents=True,exist_ok=True)
 with closing(connect(source)) as src,closing(connect(template)) as base,closing(sqlite3.connect(target)) as out:
  base.backup(out);out.execute('PRAGMA foreign_keys=OFF')
  registry=json.loads(content(src,'MyoMarketData'));assert registry['catalogVersion']==2
  owned={id for p in registry['plugins'] for id in p.get('componentIds',[])}
  pending=['MyoMarketRoot']
  while pending:
   id=pending.pop()
   if id in owned:continue
   owned.add(id);pending.extend(r[0] for r in src.execute('SELECT noteId FROM branches WHERE parentNoteId=? AND isDeleted=0',(id,)))
  # Imported banks/PDFs/images are personal content even though nested in a plugin.
  owned={id for id in owned if not re.match(r'^(HwQuizBank|HwQuizPDF|HwQImg)',id)}
  ids=owned|set(PLACEHOLDERS)|{id for p in registry['plugins'] for id in p.get('entries',[])}
  builtin={r['noteId'] for r in base.execute("SELECT noteId FROM notes WHERE noteId GLOB '_*' AND isDeleted=0")}
  ids|=builtin
  # Native launcher actions are required for custom workspace shortcuts.
  launchers=set()
  for n in src.execute("SELECT noteId FROM notes WHERE type='launcher' AND isDeleted=0"):
   targets=[a[0] for a in src.execute("SELECT value FROM attributes WHERE noteId=? AND type='relation' AND name IN ('script','target') AND isDeleted=0",(n[0],))]
   if targets and all(t in ids for t in targets):launchers.add(n[0])
  ids|=launchers
  for table in ['notes','blobs','branches','attributes','attachments','revisions','recent_notes','sessions','etapi_tokens','entity_changes','user_data']:
   out.execute('DELETE FROM '+table)
  for id in sorted(ids):
   origin=base if id in builtin else src
   row=origin.execute('SELECT * FROM notes WHERE noteId=? AND isDeleted=0',(id,)).fetchone()
   if not row:raise ValueError('Missing program component '+id)
   note=dict(row);body=content(origin,id)
   if id in PLACEHOLDERS:note['title'],note['type']=PLACEHOLDERS[id]
   if note['isProtected']:raise ValueError('Protected program component '+id)
   if note['type'] in ('text','book','render','noteMap'):body=''
   if note['mime']=='application/json' and id not in ICON_IDS:body='{}'
   if id=='DsChatRoot1':note['title']='DeepSeek 右侧助手'
   if id=='YGnqVPxFxrkz':body=json.dumps({'layout':'logicalStructure','root':{'data':{'text':'思维导图'},'children':[]},'theme':{'template':'default'},'view':{}})
   # Trilium distinguishes the canonical empty blob from an unsynced stub.
   blob='z4PhNX7vuL3xVChQ1m2A' if not body else 'seed'+hashlib.sha256(id.encode()).hexdigest()[:24]
   insert(out,'blobs',dict(blobId=blob,content=body.encode('utf8') if isinstance(body,str) else body,textRepresentation=None,dateModified=STAMP,utcDateModified=STAMP))
   note.update(blobId=blob,isDeleted=0,deleteId=None,dateCreated=STAMP,dateModified=STAMP,utcDateCreated=STAMP,utcDateModified=STAMP)
   insert(out,'notes',note)
   for a in origin.execute('SELECT * FROM attributes WHERE noteId=? AND isDeleted=0',(id,)):
    a=dict(a)
    if a['type']=='relation' and a['value'] not in ids:continue
    # Labels on real workspace folders can contain personal metadata. Keep only behavior.
    if id in PLACEHOLDERS and a['name'] not in {'iconClass','cssClass','renderNote','runOnNoteContentChange','homeInternal','hideChildrenOverview','todo','view','groupBy','sort','workspace','query','attribute','todoInProgress','todoBacklog','todoDone','todoArchive','mapRootNoteId','mapType'}:continue
    if re.search(r'token|secret|password|apiKey|sourcePath',a['name'],re.I):continue
    if a['name'] in {'homeGreetingName','homeCountdownTitle','homeCountdownDate'}:continue
    a.update(utcDateModified=STAMP,deleteId=None);insert(out,'attributes',a)
  for origin in [base,src]:
   for row in origin.execute('SELECT * FROM branches WHERE isDeleted=0'):
    a=dict(row)
    if a['noteId'] not in ids or a['parentNoteId'] not in ids:continue
    if origin is base and a['noteId'] not in builtin:continue
    if origin is src and a['noteId'] in builtin:continue
    a.update(prefix=None,isExpanded=0,utcDateModified=STAMP,deleteId=None);insert(out,'branches',a)
  def branch(id,parent,position=10):
   out.execute('DELETE FROM branches WHERE noteId=?',(id,));insert(out,'branches',dict(branchId='seedbr'+hashlib.sha256(id.encode()).hexdigest()[:24],noteId=id,parentNoteId=parent,notePosition=position,prefix=None,isExpanded=0,isDeleted=0,deleteId=None,utcDateModified=STAMP))
  for id,parent in {'root':'none','_hidden':'root','0e50f559e1a3':'root','HmeDashboard':'root','KbHubHome001':'root','e3e7d52e13a9':'KbHubHome001','79483c47e0d0':'KbHubHome001','KbWikiFolder1':'KbHubHome001','KbGraphNote1':'KbHubHome001','eae485474234':'HmeDashboard','e6856b492955':'eae485474234','ZrxUIJf75kFS':'root',**{i:'ZrxUIJf75kFS' for i in ['52Z91MOBH5g9','IXeWPMzNDeCF','VRagMKcXpZ6N','G1dMogAOtW5i']}}.items():branch(id,parent)
  for id in ids-{'root'}:
   if not out.execute('SELECT 1 FROM branches WHERE noteId=?',(id,)).fetchone():branch(id,'0e50f559e1a3')
  branch('tPEhNqMKFiVJ','e3e7d52e13a9')
  for id in (owned|builtin)-set(PLACEHOLDERS):
   if not out.execute("SELECT 1 FROM attributes WHERE noteId=? AND name='homeInternal' AND isDeleted=0",(id,)).fetchone():
    insert(out,'attributes',dict(attributeId='seedattr'+hashlib.sha256(id.encode()).hexdigest()[:24],noteId=id,type='label',name='homeInternal',value='',position=999,utcDateModified=STAMP,isDeleted=0,deleteId=None,isInheritable=0))
  for a in src.execute('SELECT * FROM attachments WHERE isDeleted=0'):
   a=dict(a)
   if a['ownerId'] not in ICON_IDS or not a['mime'].startswith('font/'):continue
   b=dict(src.execute('SELECT * FROM blobs WHERE blobId=?',(a['blobId'],)).fetchone());insert(out,'blobs',b);insert(out,'attachments',a)
  def put(id,value):
   value=json.dumps(value,ensure_ascii=False) if not isinstance(value,str) else value
   out.execute('UPDATE blobs SET content=?,textRepresentation=NULL WHERE blobId=(SELECT blobId FROM notes WHERE noteId=?)',(value.encode('utf8'),id))
  for p in registry['plugins']:
   if 'componentIds' in p:p['componentIds']=[i for i in p['componentIds'] if i in ids]
  registry['revision']=0;put('MyoMarketData',registry)
  put('HmHomeData01',{'version':1,'revision':0,'layout':None})
  put('MyoQuestData',{'version':1,'revision':0,'tasks':[],'events':[],'products':[],'categories':[]})
  put('NtStyleCfg01',{'version':1,'enabled':True,'style':'reading'})
  put('KbNavData001',{'version':1,'revision':0,'pinned':[i for i in ['al_HwQuiz01','al_MyoQuestEntry','al_MyoPomoEntry'] if i in launchers]})
  for id in ['HwPersonalReq01','HwPersonalLog01','HwEnrichReq01','HwEnrichLog01']:put(id,{'version':1})
  question={'id':'custom_demo-001','number':1,'stem':'理想电阻两端电压不变，阻值变为原来的两倍时，电流如何变化？','type':'single','options':[{'key':'A','text':'变为原来的一半'},{'key':'B','text':'变为原来的两倍'}],'answer':['A'],'answerSource':'示例题','explanation':'由欧姆定律 I = U / R，电压不变时电流与电阻成反比。','images':[],'pages':[],'ocr':False}
  bank={'id':'custom_demo','title':'入门示例题库','questions':[question],'sourceName':'整合包原创示例','sourceNoteId':None}
  # The service adds customBanks at read time; the stored index contains only
  # imported immutable banks. Listing the demo twice makes session IDs invalid.
  put('HwQuizIndex01',{'version':1,'banks':[]})
  put('HwQuizState01',{'version':1,'revision':0,'records':{},'sessions':{},'events':[],'overrides':{},'customBanks':{'custom_demo':bank}})
  def demo(id,title,parent,body):
   blob='seed'+hashlib.sha256(id.encode()).hexdigest()[:24]
   insert(out,'blobs',dict(blobId=blob,content=body.encode('utf8'),textRepresentation=None,dateModified=STAMP,utcDateModified=STAMP))
   insert(out,'notes',dict(noteId=id,title=title,isProtected=0,type='text',mime='text/html',blobId=blob,isDeleted=0,deleteId=None,dateCreated=STAMP,dateModified=STAMP,utcDateCreated=STAMP,utcDateModified=STAMP));branch(id,parent);ids.add(id)
  demo('SeedCircuit01','基础电路','e3e7d52e13a9','<p>从元件、公式与实际应用开始建立知识链接。</p>')
  demo('SeedResistor1','电阻与欧姆定律','SeedCircuit01','<h2>欧姆定律</h2><p>电压、电流与电阻满足 U = I × R。</p><p>这是一篇整合包示例笔记。可以右键建立子笔记、移动专题，或在知识库搜索正文。</p>')
  # Only schema/default UI settings come from the already-public template.
  for name, in out.execute('SELECT name FROM options').fetchall():
   if re.search(r'password|encrypted|recovery|^mfa|secret|token|llmProviders|pdfSignatures|syncServerHost|syncProxy|customSearchEngine|lastSync',name,re.I):out.execute('DELETE FROM options WHERE name=?',(name,))
  opts={'documentId':base64.b64encode(secrets.token_bytes(16)).decode(),'documentSecret':base64.b64encode(secrets.token_bytes(16)).decode(),'initialized':'true','theme':'studio-paper-light','newLayout':'true','locale':'zh','zoomFactor':'1','leftPaneWidth':'18','rightPaneWidth':'30','rightPaneVisible':'false','leftPaneVisible':'true','aiEnabled':'false','mcpEnabled':'false','openNoteContexts':json.dumps([{'ntxId':'seedhome','mainNtxId':None,'notePath':'root/HmeDashboard','hoistedNoteId':'root','active':True,'viewScope':{'viewMode':'default'},'pinned':False}])}
  opts.update(locale='cn',languages='["cn"]',syncServerHost='',syncProxy='',llmProviders='[]',pdfSignatures='[]',lastSyncedPush='0',lastSyncedPull='0')
  for k,v in opts.items():insert(out,'options',dict(name=k,value=v,isSynced=0,utcDateModified=STAMP))
  out.commit();assert out.execute('PRAGMA quick_check').fetchone()[0]=='ok'
  for t in ['revisions','recent_notes','sessions','etapi_tokens','entity_changes','user_data']:assert out.execute('SELECT count(*) FROM '+t).fetchone()[0]==0,t
  assert not out.execute("SELECT 1 FROM notes WHERE noteId LIKE 'HwQuizBank%' OR noteId LIKE 'HwQuizPDF%' OR noteId LIKE 'HwQImg%'").fetchone()
  clean=target.with_suffix('.vacuum.db');out.execute('VACUUM INTO ?',(str(clean),))
 target.unlink();clean.replace(target)
 return {'notes':len(ids),'features':len([p for p in registry['plugins'] if not p.get('core')]),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--template',type=Path,default=ROOT/'trilium-seed-data/document.db');p.add_argument('--output',type=Path,required=True);a=p.parse_args();print(json.dumps(build(a.source,a.template,a.output)))
