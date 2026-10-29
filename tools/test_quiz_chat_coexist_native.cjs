const assert=require('node:assert/strict'),fs=require('node:fs');
const{chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const token=fs.readFileSync('C:/Users/杜锦鸿/Desktop/api.txt','utf8').replace(/^\uFEFF/,'').trim();
const fixture={revision:1,index:{banks:[{id:'coexist-fixture',title:'隔离并排练习',count:2,answered:2}]},questions:[{id:'coexist-1',number:1,category:'ANA',catNo:'ANA-0001',stem:'电感两端的电压与哪一项成正比？',type:'single',options:[{key:'A',text:'电流的平均值'},{key:'B',text:'电压的变化率'},{key:'C',text:'电流的变化率'}],answer:['C'],tags:[],images:[],sourceId:'coexist-fixture',source:'隔离并排练习',explanation:'电感两端的电压与电流变化率成正比。'},{id:'coexist-2',number:2,category:'ANA',catNo:'ANA-0002',stem:'电容的单位是？',type:'single',options:[{key:'A',text:'法拉'},{key:'B',text:'亨利'}],answer:['A'],tags:[],images:[],sourceId:'coexist-fixture',source:'隔离并排练习',explanation:'电容的单位是法拉。'}],study:{version:1,records:{},topics:[],tags:{},drafts:{},session:null,daily:{target:20,days:{}},schedules:{},order:'sequential'},events:[]};
(async()=>{
const browser=await chromium.connectOverCDP('http://127.0.0.1:37842'),page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(12000);await page.setViewportSize({width:1440,height:900});let revision=1,study=fixture.study;const chatCalls=[],errors=[];
page.on('pageerror',e=>{if(!(e.message==='No active context found'&&e.stack.includes('module.exports.check')))errors.push(e.stack)});
await page.route('**/api/script/exec',async route=>{
 const body=route.request().postDataJSON(),[action,payload]=body.params||[];
 if(body.script?.includes('function hardwareQuizService(')){
  assert(['studyLoad','studySave'].includes(action),'Unexpected fixture quiz operation '+action);
  if(action==='studySave'){study={...study,...payload.study,daily:{...study.daily,...payload.study.daily},records:study.records};for(const [id,r]of Object.entries(payload.study.session?.responses||{}))if(r.submitted)study.records[id]={favorite:false,attempts:1,wrong:!r.correct,lastResult:{correct:r.correct,time:Date.now()}};revision++;}
  return route.fulfill({json:{success:true,executionResult:{...fixture,revision,study}}});
 }
 if(body.script?.includes('async function dshChatService(')){
  chatCalls.push({action,payload});let result;
  if(action==='list')result={items:[{id:'coexist-chat',title:'边做题边提问',updatedAt:Date.now()}]};
  else if(action==='models')result={default:{provider:'deepseek',model:'deepseek-chat'},groups:[{id:'deepseek',name:'DeepSeek',models:[{id:'deepseek-chat',name:'DeepSeek Chat'}]}]};
  else if(action==='view')result={revision:1,messages:[{id:'r1',role:'assistant',text:'电感的电压与电流变化率成正比：\n\n$$v_L=L\\frac{di}{dt}$$'}],running:false,hasMore:false,usage:null,selection:{provider:'deepseek',model:'deepseek-chat'}};
  else if(action==='send'||action==='stop')result={};else throw Error('Unexpected chat operation '+action);
  return route.fulfill({json:{success:true,executionResult:result}});
 }
 return route.continue();
});
const prior=await page.evaluate(()=>localStorage.getItem('eric.dsh-chat.ui.v1'));
const priorWidth=await page.evaluate(async()=>{const o=(await import('trilium-app://app/src/options-DkZaOe0W.js')).t;await o.initializedPromise;const old=o.get('rightPaneWidth');await o.save('rightPaneWidth','30');return old;});
const root=page.locator('#trilium-dsh-chat'),dialog=page.locator('#study-dialog');
async function load(){await page.reload();await page.waitForFunction(()=>window.TriliumKnowledgeManagement&&window.TriliumModules);if(await page.locator('#kb-workspace-rail').isVisible())await page.locator('#kb-workspace-rail [data-command=showLeftPane]').click();await page.evaluate(async()=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab('HwQuizBoard01','root');});await page.locator('.hw-quiz #start-learning').waitFor({state:'attached'});}
async function start(){await page.locator('#start-learning').evaluate(b=>b.click());await dialog.waitFor({state:'visible'});await page.locator('#save-status').filter({hasText:'已保存'}).waitFor();}
async function put(id,file){const r=await fetch('http://127.0.0.1:37841/etapi/notes/'+id+'/content',{method:'PUT',headers:{Authorization:token,'Content-Type':'text/plain'},body:fs.readFileSync(file,'utf8')});assert(r.ok);}
try{
 await page.evaluate(()=>localStorage.setItem('eric.dsh-chat.ui.v1',JSON.stringify({sessionId:'coexist-chat'})));await load();if(!await root.isVisible())await page.locator('#dsh-sidebar-entry').click();await root.locator('math').waitFor();await start();
 if(await dialog.evaluate(d=>d.matches(':modal'))){await page.evaluate(()=>document.querySelector('#dsh-sidebar-entry').focus());assert.equal(await page.locator('#dsh-sidebar-entry').evaluate(b=>b===document.activeElement),false);console.log('REPRODUCED modal practice blocks the native DeepSeek panel');await page.locator('#close-study').click();}
 await put('HwQuizUI01','customizations/frontend/hardware-quiz.jsx');await put('HwQuizCSS01','customizations/frontend/hardware-quiz.css');
 await load();if(!await root.isVisible())await page.locator('#dsh-sidebar-entry').click();await root.locator('math').waitFor();await start();assert.equal(await dialog.evaluate(d=>d.matches(':modal')),false);
 const bounds=()=>page.evaluate(()=>({study:document.querySelector('#study-dialog').getBoundingClientRect().toJSON(),pane:document.querySelector('#right-pane').getBoundingClientRect().toJSON(),viewport:document.querySelector('.hw-quiz').closest('.note-detail-render').getBoundingClientRect().toJSON()}));
 await page.waitForTimeout(200);let rect=await bounds();assert(rect.study.right<=rect.pane.left+2,JSON.stringify(rect));assert(Math.abs(rect.study.left-rect.viewport.left)<2,JSON.stringify(rect));assert(await dialog.evaluate(d=>d.querySelector('.study-footer').getBoundingClientRect().bottom<=d.closest('.scrolling-container').getBoundingClientRect().bottom+1));
 await root.locator('.input').fill('c a b 电感为何满足这个关系？');await root.locator('.input').press('ArrowLeft');await root.locator('.input').press('ArrowRight');assert.equal(await page.locator('#study-question .option.chosen').count(),0);await root.locator('.send').click();assert(chatCalls.some(c=>c.action==='send'));assert(await dialog.isVisible());assert.equal(await page.locator('#study-question .option.chosen').count(),0);
 await root.locator('.input').fill('保留聊天草稿');await root.locator('.input').press('Escape');assert(await dialog.isVisible());
 await page.locator('#question-scroll').focus();await page.keyboard.press('c');await page.locator('[data-option=C].chosen').waitFor();await page.keyboard.press('Enter');await page.locator('.feedback-heading').filter({hasText:'回答正确'}).waitFor();assert.equal(await root.locator('.input').inputValue(),'保留聊天草稿');
 console.log('PASS side-by-side native practice/chat, actual pointer interaction, chat send, answer shortcut and Enter grading; chat keys/Escape do not answer or close practice');
 await page.locator('#dsh-sidebar-entry').click();await root.waitFor({state:'hidden'});await page.waitForTimeout(200);const wide=await dialog.boundingBox();assert(wide.width>rect.study.width+100);
 await page.locator('#dsh-sidebar-entry').click();await root.waitFor({state:'visible'});await page.waitForTimeout(200);rect=await bounds();assert(rect.study.right<=rect.pane.left+2,JSON.stringify(rect));assert.equal(await root.locator('.input').inputValue(),'保留聊天草稿');assert(await page.locator('[data-option=C].is-correct').isVisible());
 // A real native splitter drag must move the practice boundary without remounting either client.
 const gutter=page.locator('#vertical-main-container > .gutter'),g=await gutter.boundingBox();if(g){const beforeWidth=rect.study.width;await page.mouse.move(g.x+g.width/2,g.y+g.height/2);await page.mouse.down();await page.mouse.move(g.x-90,g.y+g.height/2,{steps:6});await page.mouse.up();await page.waitForTimeout(200);rect=await bounds();assert(rect.study.width<beforeWidth-40);assert(rect.study.right<=rect.pane.left+2,JSON.stringify(rect));}
 await page.locator('#tool-edit-stem').click();await page.locator('#edit-dialog').waitFor({state:'visible'});assert(await page.locator('#edit-dialog').evaluate(d=>d.matches(':modal')));await page.locator('#cancel-edit').click();
 console.log('PASS sidebar close/reopen and native splitter resizing retain answer/chat drafts; question editing still uses a real modal');
 fs.mkdirSync('output/quiz-chat',{recursive:true});const cdp=await page.context().newCDPSession(page),shot=async name=>fs.writeFileSync('output/quiz-chat/'+name+'.png',Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
 await shot('desktop');
 await page.locator('#kb-workspace-tools [data-action=theme]:visible,#kb-workspace-rail [data-action=theme]:visible').first().click();await page.waitForTimeout(400);await shot('dark');await page.locator('#kb-workspace-tools [data-action=theme]:visible,#kb-workspace-rail [data-action=theme]:visible').first().click();
 await page.locator('#question-scroll').focus();await page.keyboard.press('ArrowRight');await page.locator('#study-title').filter({hasText:'第 2 / 2'}).waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await root.isVisible());
 console.log('PASS next question and scoped Escape save/close practice while keeping chat open');
 await start();await page.locator('#dsh-sidebar-entry').click();await root.waitFor({state:'hidden'});
 if(await page.locator('#kb-workspace-tools').isVisible())await page.locator('#kb-workspace-tools [data-command=hideLeftPane]').click();
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:338,height:731,deviceScaleFactor:1,mobile:false});await page.waitForTimeout(200);
 const narrow=await dialog.evaluate(d=>({width:innerWidth,rect:d.getBoundingClientRect().toJSON(),overflow:d.scrollWidth-d.clientWidth,footer:d.querySelector('.study-footer').getBoundingClientRect().toJSON()}));assert(narrow.overflow<=1,JSON.stringify(narrow));assert(narrow.rect.right<=narrow.width+1,JSON.stringify(narrow));assert(narrow.footer.bottom<=narrow.rect.bottom+1,JSON.stringify(narrow));await shot('narrow-practice');
 await page.locator('#dsh-sidebar-entry').click();await root.waitFor({state:'visible'});await root.locator('.input').fill('窄窗口草稿');await shot('narrow-chat');await page.locator('#dsh-sidebar-entry').click();await root.waitFor({state:'hidden'});assert(await dialog.isVisible());
 await cdp.send('Emulation.clearDeviceMetricsOverride');console.log('PASS compact answer card and narrow practice/chat switching without losing either session');
 await page.locator('#question-scroll').focus();await page.keyboard.press('c');await page.locator('[data-option=C].chosen').waitFor();await page.locator('#save-status').filter({hasText:'已保存'}).waitFor();
 const navigate=id=>page.evaluate(async id=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab(id,'root');},id);
 await navigate('HmeDashboard');await dialog.waitFor({state:'detached'});await navigate('HwQuizBoard01');await page.locator('#resume-learning').waitFor({state:'attached'});await page.locator('#resume-learning').evaluate(b=>b.click());await page.locator('[data-option=C].chosen').waitFor();
 console.log('PASS leaving the quiz removes its practice surface; returning restores the saved answer draft');


 assert.deepEqual(errors,[]);
}finally{
 if(await dialog.isVisible()){await page.locator('#close-study').click().catch(()=>{});await dialog.waitFor({state:'hidden'}).catch(()=>{});}
 await page.evaluate(prior=>{if(prior===null)localStorage.removeItem('eric.dsh-chat.ui.v1');else localStorage.setItem('eric.dsh-chat.ui.v1',prior);},prior).catch(()=>{});
 await page.evaluate(()=>window.TriliumDshChat?.open(false)).catch(()=>{});
 await page.evaluate(async priorWidth=>{const o=(await import('trilium-app://app/src/options-DkZaOe0W.js')).t;await o.save('rightPaneWidth',priorWidth);},priorWidth);await page.unroute('**/api/script/exec');await page.reload();await browser.close();
}
})().catch(e=>{console.error(e);process.exit(1)});
