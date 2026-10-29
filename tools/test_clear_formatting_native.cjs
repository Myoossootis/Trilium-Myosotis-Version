// Actual isolated editor model, synthetic note only; verify semantic content and native undo.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const token=fs.readFileSync('C:/Users/杜锦鸿/Desktop/api.txt','utf8').replace(/^\uFEFF/,'').trim(),base='http://127.0.0.1:37841/etapi';
async function api(method,path,body,type='application/json'){const r=await fetch(base+path,{method,headers:{Authorization:token,'Content-Type':type},body:body===undefined?undefined:type==='text/plain'?body:JSON.stringify(body)});assert(r.ok,method+' '+path+' '+r.status);return r.status===204?null:(r.headers.get('content-type')||'').includes('json')?r.json():r.text();}
const fixture='<h2 id="keep-heading" style="color:#dd0000;text-align:center;margin-left:40px">标题与结构</h2><p id="keep-paragraph" class="copied-text" style="font-size:24px;color:#dd0000;background-color:#ffff00;line-height:3;margin:20px;padding:12px;text-indent:2em"><strong>粗体文字</strong> <em>斜体文字</em> <a href="https://example.com/reference#anchor">保留链接</a> <span style="font-family:Georgia;color:#008800">绿色文字</span> <span class="math-tex">\\(x^2+1\\)</span></p><ol start="4"><li><strong>编号项目</strong><ol><li>嵌套项目</li></ol></li><li>第二项目</li></ol><figure class="table"><table style="background-color:#ffff00;border:3px solid #ff0000;width:80%"><tbody><tr><td colspan="2" style="background-color:#00ff00;padding:20px"><p><strong>合并单元格</strong></p></td></tr><tr><td><p>单元格一</p></td><td><p>单元格二</p></td></tr></tbody></table></figure><p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=" alt="保留图片" width="12" height="12"></p><pre><code class="language-javascript">const answer = 42;</code></pre>';
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:37842'),page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(12000);await page.setViewportSize({width:1400,height:900});let id;
 const open=async id=>{await page.waitForFunction(async()=>!!(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K.tabManager);await page.evaluate(async id=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab(id,'root');},id);await page.locator('.note-detail-editable-text.visible .ck-content').filter({hasText:'标题与结构'}).waitFor();await page.evaluate(()=>window.__formatEditor=document.querySelector('.note-detail-editable-text.visible .ck-content').ckeditorInstance);};
 const selectAll=()=>page.evaluate(()=>{const e=window.__formatEditor;e.model.change(w=>w.setSelection(e.model.document.getRoot(),'in'));});
 const data=()=>page.evaluate(()=>window.__formatEditor.getData());
 const reset=()=>page.evaluate(fixture=>window.__formatEditor.setData(fixture),fixture);
 const structure=()=>page.evaluate(()=>{const d=new DOMParser().parseFromString(window.__formatEditor.getData(),'text/html');return {text:d.body.textContent,headings:[...d.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(e=>[e.tagName,e.textContent,e.id]),links:[...d.querySelectorAll('a')].map(e=>[e.getAttribute('href'),e.textContent]),lists:[...d.querySelectorAll('ol,ul,li')].map(e=>[e.tagName,e.getAttribute('start'),e.getAttribute('reversed'),e.parentElement.tagName,e.textContent]),tables:[...d.querySelectorAll('table,tr,td,th')].map(e=>[e.tagName,e.getAttribute('colspan'),e.getAttribute('rowspan'),e.textContent]),images:[...d.querySelectorAll('img')].map(e=>[e.getAttribute('src'),e.getAttribute('alt')]),math:[...d.querySelectorAll('.math-tex')].map(e=>e.textContent),code:[...d.querySelectorAll('pre code')].map(e=>[e.textContent,e.className]),anchors:[...d.querySelectorAll('[id]')].map(e=>e.id)};});
 try{
  id=(await api('POST','/create-note',{parentNoteId:'root',title:'清除格式隔离验收',type:'text',content:fixture})).note.noteId;
  await open(id);
  if(await page.locator('.eric-format-normalize:visible').count()){
   await selectAll();await page.locator('.eric-format-normalize:visible').evaluate(e=>e.click());assert((await data()).includes('<strong>'));assert((await data()).includes('color:'));console.log('REPRODUCED old spacing cleanup leaves bold/color/font formatting');
  }
  await api('PUT','/notes/NxEditorUtil1/content',fs.readFileSync('customizations/frontend/note-editor-utilities.js','utf8'),'text/plain');
  await page.reload();await page.waitForFunction(()=>window.TriliumKnowledgeManagement&&window.TriliumModules);await open(id);await reset();await page.locator('.eric-clear-formatting:visible').waitFor();
  assert.equal(await page.locator('.eric-auto-indent-toggle,.eric-format-normalize').count(),0);assert.equal(await page.locator('.eric-clear-formatting:visible').count(),1);
  const before=await data(),semantic=await structure();assert(semantic.math.length>0);assert(semantic.images.length>0);assert(before.includes('color:'));assert(before.includes('<strong>'));
  await selectAll();await page.locator('.eric-clear-formatting:visible').click();
  const after=await data();assert.deepEqual(await structure(),semantic);assert(!/<(?:strong|em|s|u|sub|sup)(?:>|\s)/.test(after),after);assert(!/style=/.test(after),after);assert(!after.includes('copied-text'));
  await page.evaluate(()=>window.__formatEditor.execute('undo'));assert.equal(await data(),before);
  await page.evaluate(()=>window.__formatEditor.execute('redo'));assert.equal(await data(),after);
  console.log('PASS whole-note cleanup removes text/block/table appearance, retains heading/list/table/link/image/math/code/anchor structure; one-step undo and redo');
  await reset();const paragraphBefore=await data();
  await page.evaluate(()=>{const e=window.__formatEditor,p=e.model.document.getRoot().getChild(1);e.model.change(w=>w.setSelection(p,1));});
  await page.locator('.eric-clear-formatting:visible').click();let paragraphAfter=await data();assert(!paragraphAfter.includes('<strong>粗体文字</strong>'));assert(paragraphAfter.includes('<strong>编号项目</strong>'));
  await page.evaluate(()=>window.__formatEditor.execute('undo'));assert.equal(await data(),paragraphBefore);
  await reset();await page.evaluate(()=>{const e=window.__formatEditor,p=e.model.document.getRoot().getChild(1);e.model.change(w=>w.setSelection(w.createRange(w.createPositionAt(p,1),w.createPositionAt(p,3))));});
  await page.locator('.eric-clear-formatting:visible').click();const partial=await data();assert(partial.includes('<strong>粗</strong>体文<strong>字</strong>'),partial);assert(partial.includes('<strong>编号项目</strong>'));
  console.log('PASS no selection affects current paragraph only; partial selection retains surrounding inline formatting and other paragraphs');
  await reset();const readOnly=await data();await page.evaluate(()=>window.__formatEditor.enableReadOnlyMode('format-test'));await page.locator('.eric-clear-formatting:visible').click();assert.equal(await data(),readOnly);await page.evaluate(()=>window.__formatEditor.disableReadOnlyMode('format-test'));
  await reset();await selectAll();await page.locator('.eric-clear-formatting:visible').click();const once=await data();await page.locator('.eric-clear-formatting:visible').click();assert.equal(await data(),once);
  console.log('PASS read-only guard and idempotent cleanup; no user notes touched');
  fs.mkdirSync('output/note-formatting',{recursive:true});const cdp=await page.context().newCDPSession(page);fs.writeFileSync('output/note-formatting/clear-formatting.png',Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:338,height:760,deviceScaleFactor:1,mobile:false});await page.waitForTimeout(200);
  const button=page.locator('.eric-clear-formatting:visible');await button.click();assert.equal(await data(),once);
  const rect=await button.boundingBox(),width=await page.evaluate(()=>innerWidth);assert(rect.x>=0&&rect.x+rect.width<=width+1,JSON.stringify({rect,width}));
  fs.writeFileSync('output/note-formatting/clear-formatting-narrow.png',Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  await cdp.send('Emulation.clearDeviceMetricsOverride');console.log('PASS narrow toolbar keeps the single cleanup action reachable');

 }finally{
  await page.evaluate(()=>{window.__formatEditor?.disableReadOnlyMode('format-test');delete window.__formatEditor;}).catch(()=>{});
  await page.evaluate(async()=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab('HmeDashboard','root');}).catch(()=>{});
  if(id)await api('DELETE','/notes/'+id);await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
