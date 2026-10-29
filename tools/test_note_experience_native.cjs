// Actual isolated Trilium: full body search, snippets, exact DOM location, toggling.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const token=fs.readFileSync('C:/Users/杜锦鸿/Desktop/api.txt','utf8').replace(/^\uFEFF/,''),base='http://127.0.0.1:37841/etapi';
async function api(method,path,body){const r=await fetch(base+path,{method,headers:{Authorization:token.trim(),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert(r.ok,method+' '+path+' '+r.status);return r.status===204?null:(r.headers.get('content-type')||'').includes('json')?r.json():r.text();}
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:37842'),page=browser.contexts()[0].pages()[0],created=[],errors=[],marker='全文体验'+Date.now();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page),click=async s=>page.locator(s).evaluate(e=>e.click());
 const open=async id=>page.evaluate(async id=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab(id,'root');},id);
 async function create(title,content,parent='e3e7d52e13a9'){const r=await api('POST','/create-note',{parentNoteId:parent,title,type:'text',content});created.push(r.note.noteId);return r.note.noteId;}
 async function search(query){await page.locator('.hl-search input').fill(query);await page.waitForFunction(q=>document.querySelector('.nx-search-summary')?.dataset.query===q,query);}
 async function marketToggle(){await open('0e50f559e1a3');const card=page.locator('[data-plugin="NxExperience1"]');await card.waitFor();await card.getByRole('switch').click();await page.locator('.mm-notice').waitFor();await page.reload();await page.waitForFunction(()=>window.TriliumKnowledgeManagement);}
 let disabled=false,initialDark=await page.evaluate(()=>document.body.classList.contains('dark-theme'));
 try{
  const repeat='重复定位'+Date.now(),same='<p>'+('相同前文。'.repeat(12))+repeat+('相同后文。'.repeat(16))+'</p>';
  const content='<p>开头摘要，不包含检索词。</p>'+Array.from({length:100},(_,i)=>'<p>背景段落 '+i+'：用于验证深处正文的位置，不能仅搜索开头摘要。</p>').join('')+'<h2>实验结论</h2><p>前文语境 '+marker+'：跨<strong>标签</strong>定位词，负载瞬态与电源回路。</p>'+Array.from({length:40},(_,i)=>'<p>后续段落 '+i+'。</p>').join('')+'<p>第二处 '+marker+'：另一个不同语境。</p><h2>第一段相同内容</h2>'+same+'<p>'+('间隔。'.repeat(100))+'</p><h2>第二段相同内容</h2>'+same;
  const id=await create('正文定位测试',content),other=await create('其他子库测试','<p>'+marker+'</p>','79483c47e0d0');
  const hidden=await create('隐藏资料','<p>'+marker+'</p>');await api('POST','/attributes',{noteId:hidden,type:'label',name:'homeInternal',value:''});
  const original=await api('GET','/notes/'+id+'/content');
  await open('KbHubHome001');await page.reload();await page.waitForFunction(()=>window.TriliumNoteExperience);await page.locator('.kw-library-label select').selectOption('e3e7d52e13a9');
  await page.getByRole('button',{name:'专题导航',exact:true}).evaluate(e=>e.click());await search(marker);
  const card=page.locator('.nx-result[data-kb-note="'+id+'"]');await card.waitFor();assert.equal(await page.locator('.nx-result').count(),1);assert((await card.innerText()).includes('前文语境'));assert.equal(await card.locator('.nx-snippet').count(),2);assert.equal(await card.locator('mark').count(),2);
  console.log('PASS complete body beyond first 220 characters, highlighted original snippets, multiple locations and sublibrary/internal-note isolation');
  await card.locator('.nx-snippet').nth(1).click();await page.locator('.note-detail-editable-text.visible').waitFor();await page.locator('.nx-location').waitFor();
  const location=await page.evaluate(()=>{const r=[...(CSS.highlights.get('nx-note-hit')||[])][0];return r?{text:r.toString(),parent:r.startContainer.parentElement.textContent,rect:r.getBoundingClientRect().toJSON(),height:innerHeight}:null;});
  assert.equal(location.text,marker);assert(location.parent.includes('第二处'));assert(location.rect.top>=0&&location.rect.bottom<location.height,JSON.stringify(location));
  assert.equal(await api('GET','/notes/'+id+'/content'),original);
  await click('.nx-location button:first-of-type');await page.locator('.nx-result').waitFor();assert.equal(await page.locator('.hl-search input').inputValue(),marker);
  console.log('PASS selected second occurrence opens original note at correct position without changing content; return restores search');
  await search('跨标签定位词');await page.locator('.nx-snippet').first().click();await page.locator('.nx-location').waitFor();assert.equal(await page.evaluate(()=>[...CSS.highlights.get('nx-note-hit')][0].toString()),'跨标签定位词');assert.equal(await api('GET','/notes/'+id+'/content'),original);
  await click('.nx-location button:first-of-type');await page.locator('.nx-search-summary').waitFor();
  console.log('PASS a match across inline formatting receives a non-persistent DOM range highlight');
  await search(repeat);await page.locator('.nx-snippet').nth(1).click();await page.locator('.nx-location').waitFor();
  assert.equal(await page.evaluate(()=>[...CSS.highlights.get('nx-note-hit')][0].startContainer.parentElement.closest('p').previousElementSibling.textContent),'第二段相同内容');
  await click('.nx-location button:first-of-type');await page.locator('.nx-search-summary').waitFor();console.log('PASS identical repeated contexts still locate the selected occurrence');
  await search('正文定位测试 '+marker);assert.equal(await page.locator('.nx-result').count(),1);await search('不存在的关键字'+marker);assert.equal(await page.locator('.nx-result').count(),0);
  const fresh='正文更新'+Date.now();await search(fresh);assert.equal(await page.locator('.nx-result').count(),0);
  const put=async content=>{const r=await fetch(base+'/notes/'+id+'/content',{method:'PUT',headers:{Authorization:token.trim(),'Content-Type':'text/plain'},body:content});assert(r.ok);};
  await put(original+'<p>'+fresh+'</p>');await page.locator('.nx-result[data-kb-note="'+id+'"]').waitFor();assert((await page.locator('.nx-results').innerText()).includes(fresh));await put(original);
  console.log('PASS current query automatically sees newly changed deep body content, without a stale search index');
  await page.locator('.hl-search input').fill(marker);await search('跨标签定位词');assert((await page.locator('.nx-results').innerText()).includes('跨标签定位词'));
  for(const dark of [false,true]){
   if(await page.evaluate(()=>document.body.classList.contains('dark-theme'))!==dark){await click('#kb-workspace-tools [data-action="theme"]');await page.waitForFunction(d=>document.body.classList.contains('dark-theme')===d,dark);}
  for(const width of [1280,375]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});const actual=await page.evaluate(()=>innerWidth);await cdp.send('Emulation.setDeviceMetricsOverride',{width:Math.round(width*width/actual),height:1000,deviceScaleFactor:1,mobile:false});
   if(width===375&&await page.locator('#kb-workspace-tools').isVisible())await click('#kb-workspace-tools [data-command="hideLeftPane"]');
   assert.deepEqual(await page.locator('.nx-search').evaluate(e=>[...e.querySelectorAll('*')].filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.className)),[]);
   const shot=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('tmp/theme-studio/note-experience-'+width+'-'+(dark?'dark':'light')+'.png',Buffer.from(shot.data,'base64'));
  }
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');console.log('PASS AND keywords, no-result and rapid-query states; desktop/narrow search result geometry in light and dark themes');
  await marketToggle();disabled=true;assert.equal(await page.evaluate(()=>!!window.TriliumNoteExperience),false);
  await open('KbHubHome001');await page.locator('.hl-search input').waitFor();await page.locator('.hl-search input').fill(marker);assert.equal(await page.locator('.nx-search').count(),0);assert.equal(await page.locator('.hl-row[data-kb-note="'+id+'"]').count(),0);
  await marketToggle();disabled=false;await page.waitForFunction(()=>window.TriliumNoteExperience);await open('KbHubHome001');await search(marker);await page.locator('.nx-result[data-kb-note="'+id+'"]').waitFor();
  assert.equal(await api('GET','/notes/'+id+'/content'),original);assert.deepEqual(errors,[]);console.log('PASS plugin market disable/reload restores old search; re-enable restores enhanced search; no renderer exceptions');
 }catch(e){console.error('UI diagnostics',await page.locator('.toast,.nx-search-status').allTextContents(),errors);throw e;}finally{
  if(disabled)try{await marketToggle();}catch(e){console.error('Restore plugin',e.message);}
  for(const id of created.reverse())try{await api('DELETE','/notes/'+id);}catch(e){console.error('Cleanup',id,e.message);}
  await cdp.send('Emulation.clearDeviceMetricsOverride');if(await page.evaluate(()=>document.body.classList.contains('dark-theme'))!==initialDark)await click('#kb-workspace-tools [data-action="theme"]');await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
