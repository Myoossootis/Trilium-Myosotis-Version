// Regression: native/ETAPI child creation must update a mounted knowledge workspace.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const token=fs.readFileSync('C:/Users/杜锦鸿/Desktop/api.txt','utf8').replace(/^\uFEFF/,'').trim(),base='http://127.0.0.1:37841/etapi';
async function api(method,path,body){const r=await fetch(base+path,{method,headers:{Authorization:token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert(r.ok,method+' '+path+' '+r.status);return r.status===204?null:r.json();}
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:37842'),p=browser.contexts()[0].pages()[0],created=[],marker='子笔记同步测试'+Date.now();
 p.setDefaultTimeout(8000);
 const click=async s=>p.locator(s).evaluate(e=>e.click());
 async function create(parent,title){const r=await api('POST','/create-note',{parentNoteId:parent,title,type:'text',content:'<p>正文与子笔记共存。</p>'});created.push(r.note.noteId);return r.note.noteId;}
 async function open(id){await p.evaluate(async id=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab(id,'root');},id);}
 const row=id=>p.locator('.hl-row[data-kb-note="'+id+'"]:visible');
 const cdp=await p.context().newCDPSession(p);
 async function checkLayout(kind){
  for(const width of [1280,375]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});const actual=await p.evaluate(()=>innerWidth);
   await cdp.send('Emulation.setDeviceMetricsOverride',{width:Math.round(width*width/actual),height:1000,deviceScaleFactor:1,mobile:false});
   if(width===375&&await p.locator('#kb-workspace-tools').isVisible())await click('#kb-workspace-tools [data-command="hideLeftPane"]');
   const errors=await p.locator('.library-browser').evaluate(e=>[...e.querySelectorAll('.hl-row,.hl-section-heading,.hl-folder-actions')].filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className));assert.deepEqual(errors,[]);
   const shot=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('tmp/theme-studio/parent-original-'+kind+'-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');
 }
 try{
  const parent=await create('jojpvXGPUjoH',marker+'父笔记');
  await open('KbHubHome001');await p.reload();await p.waitForFunction(()=>window.TriliumKnowledgeManagement);
  await p.locator('.kw-library-label select').selectOption('e3e7d52e13a9');
  await p.getByRole('button',{name:'专题导航',exact:true}).evaluate(e=>e.click());
  await p.locator('.hl-topic-title').filter({hasText:'模拟电路'}).click();await p.locator('.hl-row-link').filter({hasText:'常见元器件'}).click();
  await row(parent).waitFor();assert.equal(await row(parent).locator('.hl-row-meta').innerText(),'笔记');
  const child=await create(parent,marker+'子笔记');
  await p.waitForFunction(id=>document.querySelector('.hl-row[data-kb-note="'+id+'"] .hl-row-meta')?.textContent==='1 个子项',parent,{timeout:5000});
  assert.equal(await row(parent).locator('.hl-source').count(),1,'parent with children needs a direct original-note entry');
  await checkLayout('rows');
  await row(parent).locator('.hl-source').click();await p.locator('.note-detail-editable-text.visible').waitFor();
  assert((await p.evaluate(()=>location.hash)).includes(parent));
  await open('KbHubHome001');await row(parent).waitFor();
  await row(parent).locator('.hl-row-link').click();await row(child).waitFor();
  assert.equal(await p.locator('.hl-folder-heading h2').innerText(),marker+'父笔记');assert((await p.evaluate(()=>location.hash)).includes('KbHubHome001'));
  await checkLayout('header');
  await click('.hl-folder-actions .hl-source');await p.locator('.note-detail-editable-text.visible').waitFor();
  assert((await p.evaluate(()=>location.hash)).includes(parent));
  await open('KbHubHome001');await row(child).waitFor();
  console.log('PASS original parent text opens directly from both the row and child-list header, with position restored');
  await click('.hl-up');await row(parent).waitFor();
  console.log('PASS native child creation updates existing parent and opens children in place; one-level return preserved');
  await api('PATCH','/notes/'+child,{title:marker+'已改名'});await row(parent).locator('.hl-row-link').click();
  await p.waitForFunction(({id,title})=>document.querySelector('.hl-row[data-kb-note="'+id+'"] b')?.textContent===title,{id:child,title:marker+'已改名'});
  await api('DELETE','/notes/'+child);await row(child).waitFor({state:'detached'});created.splice(created.indexOf(child),1);
  await click('.hl-up');await p.waitForFunction(id=>document.querySelector('.hl-row[data-kb-note="'+id+'"] .hl-row-meta')?.textContent==='笔记',parent);
  console.log('PASS native rename/delete refresh child list and parent child count without manual refresh');
  await row(parent).locator('.hl-row-link').click();await p.locator('.note-detail-editable-text.visible').waitFor();
  await open('KbHubHome001');await row(parent).waitFor();await row(parent).scrollIntoViewIfNeeded();await p.waitForTimeout(250);await row(parent).click({button:'right'});await p.locator('.km-menu').waitFor();assert.equal(await p.locator('.km-menu button').count(),6);await p.keyboard.press('Escape');
  console.log('PASS leaf still opens original text; existing right-click actions preserved');
  await row(parent).locator('.hl-row-link').click();await p.locator('.note-detail-editable-text.visible').waitFor();
  const hiddenChild=await create(parent,marker+'离开期间新增');await p.waitForTimeout(400);
  await open('KbHubHome001');await p.waitForFunction(id=>document.querySelector('.hl-row[data-kb-note="'+id+'"] .hl-row-meta')?.textContent==='1 个子项',parent);
  await row(parent).locator('.hl-row-link').click();await row(hiddenChild).waitFor();
  console.log('PASS returning from editor refreshes a cached workspace after native changes while hidden');
 }finally{
  for(const id of created.reverse())try{await api('DELETE','/notes/'+id);}catch(e){console.error('Fixture cleanup',id,e.message);}
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
