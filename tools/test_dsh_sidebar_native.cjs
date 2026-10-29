const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:37842'),page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(15000);
 await page.setViewportSize({width:1152,height:765});
 const calls=[],errors=[],existingUiErrors=[];page.on('pageerror',e=>{if(e.message==='No active context found'&&e.stack.includes('module.exports.check'))existingUiErrors.push(e.message);else errors.push(e.stack);});
 const selection={provider:'deepseek',model:'deepseek-chat'};
 const items=[{id:'sidebar-fixture',title:'电容与带隙基准',updatedAt:Date.now()},{id:'sidebar-other',title:'模拟电路',updatedAt:Date.now()}];
 const messages=[{id:'user-1',role:'user',text:'解释带隙基准中的温度补偿。'},{id:'assistant-1',role:'assistant',text:'## 温度补偿\n利用两种温度特性相反的电压：\n\n$$V_{BE}=\\frac{kT}{q}\\ln\\frac{I_C}{I_S}$$\n\n**PTAT 电压** 与绝对温度成正比。\n\n| 参数 | 说明 |\n|---|---|\n| VBE | 负温度系数 |\n\n```js\nconst temperatureCompensation = "test long code containment";\n```'}];
 let revision=1;
 await page.route('**/api/script/exec',async route=>{
  const body=route.request().postDataJSON();if(!body.script?.includes('async function dshChatService'))return route.continue();
  const [action,payload]=body.params;calls.push({action,payload});let result;
  switch(action){
   case 'list':result={items};break;
   case 'models':result={default:selection,groups:[{id:'deepseek',name:'DeepSeek',models:[{id:'deepseek-chat',name:'DeepSeek Chat'},{id:'deepseek-reasoner',name:'DeepSeek Reasoner'}]}]};break;
   case 'view':result={sessionId:payload.sessionId,messages,revision,running:false,hasMore:false,selection,usage:{cacheHitRate:.75,cacheReadTokens:750,inputTokens:1000,uncachedInputTokens:250,cacheWriteTokens:0}};break;
   case 'model':selection.model=payload.model;result={selected:{...selection}};break;
   case 'send':messages.push({id:'sent-'+revision,role:'user',text:payload.text});revision++;result={};break;
   case 'stop':result={};break;
   default:throw Error('Unexpected mock operation '+action);
  }
  await route.fulfill({json:{success:true,executionResult:result}});
 });
 const root=page.locator('#trilium-dsh-chat');
 const backend=async(script,params=[])=>page.evaluate(async({script,params})=>{const server=(await import('trilium-app://app/src/server-E-v8IJ6Q.js')).t;const r=await server.post('script/exec',{script,params,startNoteId:'MyoMarketSvc1',currentNoteId:'MyoMarketSvc1',transactional:!script.trim().startsWith('async ')});if(!r.success)throw Error(r.error);return r.executionResult;},{script,params});
 const openNote=id=>page.evaluate(async id=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab(id,'root');},id);
 const prev=await page.evaluate(()=>localStorage.getItem('eric.dsh-chat.ui.v1'));
 let toggled=false;
 try{
  await page.evaluate(()=>localStorage.setItem('eric.dsh-chat.ui.v1',JSON.stringify({sessionId:'sidebar-fixture',width:'680px',height:'800px'})));
  await page.reload();await page.locator('#dsh-sidebar-entry').waitFor();
  if(!await root.isVisible())await page.locator('#dsh-sidebar-entry').click();
  await root.locator('math').waitFor();assert.equal(await root.count(),1);
  assert(await root.evaluate(h=>!!h.closest('#right-pane')));assert.equal(await root.locator('.launch,.resize,.expand').count(),0);assert.equal(await root.getAttribute('popover'),null);
  assert.equal(await page.locator('#DsChatBoot1.grow').count(),1);
  assert((await root.locator('.foot-status').textContent()).includes('75.0%'));
  assert.equal(await root.locator('.model-select option').count(),2);
  assert.equal(await root.locator('.formatted table').count(),1);
  console.log('PASS native right-pane membership, full-height card, formulas, table, models and cache usage');
  await root.locator('.input').fill('保留草稿');
  await page.locator('#right-pane [role=tab][aria-label="大纲"]').click();await root.waitFor({state:'hidden'});
  await page.waitForTimeout(900);const count=calls.length;await page.waitForTimeout(1400);assert.equal(calls.length,count,'hidden tab kept polling');
  await page.locator('#dsh-sidebar-entry').click();await root.waitFor({state:'visible'});assert.equal(await root.locator('.input').inputValue(),'保留草稿');
  await page.locator('#dsh-sidebar-entry').click();await root.waitFor({state:'hidden'});await page.waitForTimeout(900);const closed=calls.length;await page.waitForTimeout(1400);assert.equal(calls.length,closed,'closed pane kept polling');
  await page.locator('#dsh-sidebar-entry').click();await root.waitFor({state:'visible'});assert.equal(await root.locator('.input').inputValue(),'保留草稿');
  await openNote('QEI95FCduo3c');assert.equal(await root.locator('.input').inputValue(),'保留草稿');
  console.log('PASS draft/history survive tab switching, pane close/open and note navigation; hidden polling paused');
  await root.locator('.history-toggle').click();await root.locator('.session').filter({hasText:'模拟电路'}).click();await root.locator('.title').filter({hasText:'模拟电路'}).waitFor();
  await root.locator('.model-select').selectOption(JSON.stringify(['deepseek','deepseek-reasoner']));
  await root.locator('.image-files').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64')});await root.locator('.attachment').waitFor();
  await root.locator('.send').click();await root.locator('.attachment').waitFor({state:'hidden'});assert(calls.some(c=>c.action==='send'&&c.payload.images.length===1&&c.payload.text==='保留草稿'));
  console.log('PASS history selection, model switch and image send UI against mocked bridge; no real model requests');
  fs.mkdirSync('output/dsh-chat',{recursive:true});
  const cdp=await page.context().newCDPSession(page);
  async function viewport(width,height){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});const actual=await page.evaluate(()=>innerWidth);await cdp.send('Emulation.setDeviceMetricsOverride',{width:Math.round(width*width/actual),height:Math.round(height*width/actual),deviceScaleFactor:1,mobile:false});await page.waitForTimeout(180);}
  await viewport(1280,850);
  await page.waitForFunction(()=>{const h=document.querySelector('#trilium-dsh-chat');return h.shadowRoot.querySelector('.compose').getBoundingClientRect().bottom<h.closest('#right-pane').getBoundingClientRect().bottom+1;},null,{timeout:5000});
  let bounds=await root.evaluate(h=>({host:h.getBoundingClientRect().toJSON(),pane:h.closest('#right-pane').getBoundingClientRect().toJSON(),log:h.shadowRoot.querySelector('.log').getBoundingClientRect().toJSON(),compose:h.shadowRoot.querySelector('.compose').getBoundingClientRect().toJSON()}));
  assert(bounds.host.height>500,JSON.stringify(bounds));assert(bounds.compose.bottom<bounds.pane.bottom+1,JSON.stringify(bounds));assert(bounds.host.width>180);
  fs.writeFileSync('output/dsh-chat/sidebar-desktop.png',Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  await page.locator('.myo-day-night-icon:visible').first().click();toggled=true;await page.waitForTimeout(250);fs.writeFileSync('output/dsh-chat/sidebar-dark.png',Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  await page.locator('.myo-day-night-icon:visible').first().click();toggled=false;
  await viewport(375,812);if(!await root.isVisible())await page.locator('#dsh-sidebar-entry').click();
  fs.writeFileSync('output/dsh-chat/sidebar-narrow.png',Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  const narrow=await root.evaluate(h=>{const c=h.shadowRoot.querySelector('.chat'),input=h.shadowRoot.querySelector('.input'),send=h.shadowRoot.querySelector('.send');return {width:innerWidth,overflow:c.scrollWidth-c.clientWidth,rect:c.getBoundingClientRect().toJSON(),input:input.getBoundingClientRect().toJSON(),send:send.getBoundingClientRect().toJSON()};});
  assert(narrow.overflow<=1,JSON.stringify(narrow));assert(narrow.rect.right<=narrow.width+1,JSON.stringify(narrow));assert(narrow.input.width>100,JSON.stringify(narrow));
  console.log('PASS desktop and 375px layout, theme switching and scroll containment');
  await viewport(1280,850);await page.reload();await page.locator('#dsh-sidebar-entry').waitFor();if(!await root.isVisible())await page.locator('#dsh-sidebar-entry').click();await root.locator('math').waitFor();assert.equal(await root.locator('.title').textContent(),'模拟电路');
  const market=fs.readFileSync('customizations/backend/plugin-market-service.js','utf8');const load=()=>backend(market,['load',{}]);const toggle=async enabled=>backend(market,['toggle',{id:'DsChatRoot1',enabled,revision:(await load()).revision}]);
  await toggle(false);await page.reload();await page.waitForFunction(()=>window.TriliumModules&&!window.TriliumModules.enabled('DsChatRoot1'));assert.equal(await page.locator('#dsh-sidebar-entry,#trilium-dsh-chat').count(),0);assert.equal(await page.evaluate(()=>!!window.TriliumDshChat),false);
  require('node:child_process').execFileSync('python',['tools/install_dsh_chat.py','--url','http://127.0.0.1:37841/etapi','--token-file','C:/Users/杜锦鸿/Desktop/api.txt','--skip-backup']);
  const activation=await backend('function(){return ["DsChatBoot1","DsChatEntry1"].map(id=>({id,active:api.getNote(id).hasLabel("widget"),disabled:api.getNote(id).hasLabel("myoDisabled_widget"),startup:api.getNote(id).hasLabel("run")}));}');
  assert(activation.every(n=>!n.active&&n.disabled&&!n.startup));console.log('PASS reinstall preserves disabled package and migrates only native widget activations');
  await toggle(true);await page.reload();await page.locator('#dsh-sidebar-entry').waitFor();if(!await root.isVisible())await page.locator('#dsh-sidebar-entry').click();await root.locator('math').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS refresh restores session, package off removes both widgets, on restores; zero DeepSeek renderer exceptions');if(existingUiErrors.length)console.log('Existing knowledge return component startup errors (outside DeepSeek): '+existingUiErrors.length);
 }finally{
  if(toggled)await page.locator('.myo-day-night-icon:visible').first().click().catch(()=>{});
  await page.evaluate(prev=>{if(prev===null)localStorage.removeItem('eric.dsh-chat.ui.v1');else localStorage.setItem('eric.dsh-chat.ui.v1',prev);},prev);
  await page.evaluate(()=>window.TriliumDshChat?.open(false)).catch(()=>{});await page.unroute('**/api/script/exec');await page.reload();await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
