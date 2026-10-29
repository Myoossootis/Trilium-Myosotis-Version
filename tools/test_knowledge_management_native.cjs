// Real isolated UI CRUD on synthetic notes only, plus direct topic navigation.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const token=fs.readFileSync('C:/Users/杜锦鸿/Desktop/api.txt','utf8').replace(/^\uFEFF/,'').trim(),base='http://127.0.0.1:37841/etapi',root='e3e7d52e13a9';
async function deleted(id){const r=await fetch(base+'/notes/'+id,{headers:{Authorization:token}});return r.status===404||(r.ok&&(await r.json()).isDeleted===true);}
async function api(method,path,body){const r=await fetch(base+path,{method,headers:{Authorization:token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert(r.ok,method+' '+path+' '+r.status);return r.status===204?null:r.json();}
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:37842'),p=b.contexts()[0].pages()[0];p.setDefaultTimeout(10000);const cdp=await p.context().newCDPSession(p),created=[],marker='管理测试'+Date.now();
 const click=async s=>p.locator(s).evaluate(e=>e.click());
 async function create(title,parent=root,content='<p>隔离测试正文，不涉及正式笔记。</p>'){const r=await api('POST','/create-note',{parentNoteId:parent,title,type:'text',content});created.push(r.note.noteId);return r.note.noteId;}
 async function open(id,selector){if(id===root)id='KbHubHome001';await p.evaluate(async id=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab(id,'root');},id);await p.locator(selector).first().waitFor();if(id==='KbHubHome001'){await p.locator('.kw-library-label select').selectOption(root);await p.waitForFunction(root=>document.querySelector('.library-browser')?.dataset.library===root,root);}}
 const node=id=>p.locator('[data-kb-note="'+id+'"]:visible').first();
 async function search(text){await p.locator('.hl-search input').fill(text);await p.waitForTimeout(120);}
 async function menu(id,action){await p.waitForFunction(()=>!document.querySelector('.nx-search-status'));await p.waitForTimeout(400);await node(id).scrollIntoViewIfNeeded();await p.waitForTimeout(250);await node(id).click({button:'right'});await p.locator('.km-menu').waitFor();await click('.km-menu [data-action="'+action+'"]');if(!['open','copy'].includes(action))await p.locator('.km-dialog').waitFor();}
 async function submit(){await click('.km-dialog .km-submit');await p.locator('.km-dialog').waitFor({state:'detached'});}
 async function cancel(){await click('.km-dialog .km-cancel');await p.locator('.km-dialog').waitFor({state:'detached'});}
 async function shot(name){const s=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('tmp/theme-studio/'+name,Buffer.from(s.data,'base64'));}
 try{
  const a=await create(marker+'来源专题'),target=await create(marker+'目标专题'),child=await create(marker+'子笔记',a),nested=await create(marker+'子层级',child);
  await p.reload();await p.waitForFunction(()=>window.TriliumKnowledgeManagement);await p.evaluate(()=>localStorage.removeItem('trilium.library.browser.'+'e3e7d52e13a9'));await open('KbHubHome001','.hl-topic');
  await p.locator('.hl-topic-title').filter({hasText:'模拟电路'}).click();await p.locator('.hl-breadcrumb').waitFor();
  assert.equal(await p.locator('.kh-note-list:visible').count(),0);assert((await p.locator('.hl-section-heading h2').innerText()).includes('模拟电路'));await p.locator('.hl-row-link').filter({hasText:'常见元器件'}).click();await click('.hl-up');assert((await p.locator('.hl-section-heading h2').innerText()).includes('模拟电路'));await click('.hl-up');assert.equal(await p.locator('.hl-breadcrumb').count(),0);
  console.log('PASS direct hub topic → existing sublibrary chapter, folder navigation and one-level back');
  await search(marker);await node(child).waitFor();await menu(child,'rename');await p.locator('.km-dialog input[name=title]').fill(marker+'已改名');await submit();assert.equal((await api('GET','/notes/'+child)).title,marker+'已改名');
  console.log('PASS right-click rename persists to native note');
  await menu(child,'child');await p.locator('.km-dialog .km-fields input').fill(marker+'新建问题');await submit();await p.locator('.note-detail-editable-text.visible').waitFor();
  let n=await api('GET','/notes/'+child);const newChild=n.childNoteIds.find(id=>id!==nested);assert(newChild);created.push(newChild);assert.equal((await api('GET','/notes/'+newChild)).title,marker+'新建问题');
  await open(root,'.hardware-library');await search(marker);await menu(child,'move');assert.equal(await p.locator('.km-dialog select[name=target] option[value="'+a+'"]').count(),1);assert.equal(await p.locator('.km-dialog select[name=target] option[value="'+child+'"]').count(),0);
  await p.locator('.km-dialog select[name=target]').selectOption(target);await submit();n=await api('GET','/notes/'+child);assert(n.parentNoteIds.includes(target)&&!n.parentNoteIds.includes(a));assert(n.childNoteIds.includes(nested)&&n.childNoteIds.includes(newChild));
  console.log('PASS create child opens editor; change topic preserves note ID, content and children');
  // Reject stale writes after another native change.
  await menu(child,'rename');await api('PATCH','/notes/'+child,{title:marker+'外部修改'});await p.locator('.km-dialog .km-fields input').fill(marker+'不应覆盖');await click('.km-dialog .km-submit');await p.waitForFunction(()=>document.querySelector('.km-error')?.textContent.includes('变化'));assert.equal((await api('GET','/notes/'+child)).title,marker+'外部修改');await cancel();
  await click('.hl-refresh');await p.waitForTimeout(150);
  await menu(child,'move');await p.locator('.km-dialog select[name=target]').selectOption('new');await p.locator('.km-dialog input[name=topic]').fill(marker+'新专题');await submit();n=await api('GET','/notes/'+child);const newTopic=n.parentNoteIds[0];created.push(newTopic);assert.equal((await api('GET','/notes/'+newTopic)).title,marker+'新专题');assert((await api('GET','/notes/'+newTopic)).parentNoteIds.includes(root));
  console.log('PASS stale rename rejected; new topic and move complete together');
  await menu(child,'delete');assert((await p.locator('.km-description').innerText()).includes('2 篇子笔记'));await cancel();assert(!(await api('GET','/notes/'+child)).isDeleted);
  // Another clone protects the note at the other location when removing this branch.
  await api('POST','/branches',{noteId:child,parentNoteId:a});await click('.hl-refresh');await p.waitForTimeout(150);const shownParent=await node(child).getAttribute('data-kb-parent');await menu(child,'delete');assert((await p.locator('.km-description').innerText()).includes('其他归属位置保留'));await submit();n=await api('GET','/notes/'+child);assert(!n.isDeleted&&n.parentNoteIds.length===1&&n.parentNoteIds[0]===(shownParent===a?newTopic:a),JSON.stringify({shownParent,n}));assert(!(await api('GET','/notes/'+nested)).isDeleted);
  await click('.hl-refresh');await p.waitForTimeout(150);await menu(child,'delete');await submit();assert(await deleted(child));assert(await deleted(nested));assert(await deleted(newChild));
  console.log('PASS delete cancel, clone branch protection and confirmed descendant deletion');
  await click('.hl-search input');await search('');await p.getByRole('button',{name:'专题导航',exact:true}).evaluate(e=>e.click());await p.locator('.hl-create[data-kb-create="'+root+'"]').click();await p.locator('.km-dialog .km-fields input').fill(marker+'工具栏专题');await submit();const rootNote=await api('GET','/notes/'+root);let added;for(const id of rootNote.childNoteIds){if(!created.includes(id)){const n=await api('GET','/notes/'+id);if(n.title===marker+'工具栏专题'){added=id;created.push(id);break;}}}assert(added);await search(marker);await node(added).waitFor();await node(added).locator('button').first().focus();await p.keyboard.press('Shift+F10');await p.locator('.km-menu').waitFor();await p.keyboard.press('ArrowDown');assert.equal(await p.locator('.km-menu button:focus').getAttribute('data-action'),'child');await p.keyboard.press('Escape');await p.locator('.km-menu').waitFor({state:'detached'});
  for(const width of [1280,375]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});const actual=await p.evaluate(()=>innerWidth);await cdp.send('Emulation.setDeviceMetricsOverride',{width:Math.round(width*width/actual),height:900,deviceScaleFactor:1,mobile:false});if(width===375&&await p.locator('#kb-workspace-tools').isVisible())await click('#kb-workspace-tools [data-command="hideLeftPane"]');
   await node(added).evaluate(e=>e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:innerWidth-5,clientY:innerHeight-5})));await p.locator('.km-menu').waitFor();const m=await p.locator('.km-menu').boundingBox();assert(m.x>=0&&m.y>=0&&m.x+m.width<=await p.evaluate(()=>innerWidth));await shot('knowledge-context-'+width+'.png');await click('.km-menu [data-action="move"]');await p.locator('.km-dialog').waitFor();const d=await p.locator('.km-dialog').boundingBox();assert(d.x>=0&&d.x+d.width<=await p.evaluate(()=>innerWidth));await shot('knowledge-dialog-'+width+'.png');await cancel();
  }
  console.log('PASS one toolbar create entry, keyboard menu, clamped menu and native modal at desktop/narrow width');
 }finally{
  for(const id of created.reverse())try{if(!await deleted(id))await api('DELETE','/notes/'+id);}catch(e){console.error('Fixture cleanup',id,e.message);}
  await cdp.send('Emulation.clearDeviceMetricsOverride');await b.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
