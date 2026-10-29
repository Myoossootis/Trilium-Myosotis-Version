// Theme selection via native Appearance; real isolated Trilium renderer, no model calls.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const palettes=JSON.parse(fs.readFileSync('customizations/themes/palettes.json','utf8'));
const token=fs.readFileSync('C:/Users/杜锦鸿/Desktop/api.txt','utf8').replace(/^\uFEFF/,'').trim();
async function api(method,path,body){const r=await fetch('http://127.0.0.1:37841/etapi'+path,{method,headers:{Authorization:token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert(r.ok,path+' '+r.status);return r.status===204?null:r.json();}
function rgb(hex){return 'rgb('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')';}
function luminance(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);}
function contrast(a,b){let x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
(async()=>{
 for(const p of palettes){const c=p.colors;assert(contrast(c.text,c.surface)>=7,p.id+' text contrast');assert(contrast(c.muted,c.surface)>=4.5,p.id+' muted contrast');assert(contrast(c.accent,c.onAccent)>=4.5,p.id+' primary contrast');}
 const browser=await chromium.connectOverCDP('http://127.0.0.1:37842');
 const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('trilium-app:'));
 const created=[],textId='ThmTxt'+Date.now().toString(36),codeId='ThmCode'+Date.now().toString(36);let originalTheme;
 async function ready(){await page.locator('#kb-workspace-navigation').waitFor({state:'attached'});if(await page.locator('#kb-workspace-rail').isVisible())await page.locator('#kb-workspace-rail [data-command="showLeftPane"]').click();await page.locator('#kb-workspace-tools').waitFor();}
 async function choose(name,id){
  await page.locator('#kb-workspace-tools [data-command="showOptions"]').click();await page.locator('.options-dialog.show').waitFor();
  if(await page.locator('.options-dialog.show button[id^="theme-"]').isHidden())await page.locator('.ts-native-toggle').click();
  await page.locator('.options-dialog.show button[id^="theme-"]').click();
  const choices=page.locator('.dropdown-menu.show');await choices.getByText(name,{exact:true}).click();
  await page.waitForFunction(id=>document.body.dataset.themeId===id,id);
  await page.locator('.options-dialog.show .btn-close').click();
 }
 async function open(id,selector){await page.evaluate(async id=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab(id,'root');},id);await page.locator(selector+':visible').first().waitFor({timeout:30000});}
 async function color(selector,property,expected){await page.waitForFunction(({selector,property,expected})=>[...document.querySelectorAll(selector)].some(e=>e.getBoundingClientRect().height>0 && getComputedStyle(e)[property]===expected),{selector,property,expected},{timeout:8000});}
 try{
  await page.reload();await ready();originalTheme=await page.evaluate(()=>document.body.dataset.themeId);
  for(const [id,type,mime,content] of [[textId,'text','text/html','<h2>主题验证</h2><p>只读测试正文与链接 <a href="https://example.com">参考链接</a></p><blockquote>引用</blockquote><table><tr><th>名称</th></tr><tr><td>正常数据</td></tr></table><pre><code>const value = 42;</code></pre>'],[codeId,'code','application/javascript','// Theme preview\nconst value = 42;']]){
   await api('POST','/create-note',{noteId:id,parentNoteId:'ThmStudioRoot',title:'临时主题测试 '+id,type,mime,content});created.push(id);
  }
  for(const p of palettes){
   await choose(p.name,p.id);
   const c=p.colors;
   await color('#left-pane','backgroundColor',rgb(c.sidebar));
   await open('KbHubHome001','.knowledge-hub');await color('.knowledge-hub','backgroundColor',rgb(c.surface));await color('.knowledge-hub','color',rgb(c.text));
   await color('.kh-primary','backgroundColor',rgb(c.accent));await color('.kh-primary','color',rgb(c.onAccent));
   await page.screenshot({path:'E:/EricDictionary/tmp/theme-studio/'+p.id+'.png'});
   await open('e3e7d52e13a9','.hardware-library');await color('.hardware-library','backgroundColor',rgb(c.page));await color('.hardware-library','color',rgb(c.text));
   await open('HmeDashboard','.eric-home-dashboard');await color('.hp-card','backgroundColor',rgb(c.surface));
   const hero=await page.locator('.hp-hero:visible').first().evaluate(e=>getComputedStyle(e).backgroundImage);assert(hero.includes('linear-gradient(120deg'),'hero uses selected palette');
   await open('HwQuizBoard01','.hw-quiz');await color('.hw-quiz','backgroundColor',rgb(c.page));await color('.hw-quiz','color',rgb(c.text));
   await open('MyoQuestBoard','.myo-quests');await color('.myo-quests','color',rgb(c.text));
   await open('MyoPomoBoard','.myo-pomodoro');await color('.myo-pomodoro','color',rgb(c.text));
   await open('0e50f559e1a3','.myo-market');await color('.mm-card','backgroundColor',rgb(c.surface));
   await open(textId,'.note-detail-editable-text.visible');await color('.note-detail-editable-text.visible .ck-content','color',rgb(c.text));
   await open(codeId,'.note-detail-code.visible');await color('.note-detail-code.visible .cm-editor','backgroundColor',rgb(c.surface));
   const chat=await page.locator('#trilium-dsh-chat').evaluate(e=>{const root=e.shadowRoot;return {accent:getComputedStyle(root.querySelector('.ds')).getPropertyValue('--blue').trim(),paper:getComputedStyle(root.querySelector('.launch')).backgroundColor};});assert.equal(chat.accent,c.accent);assert.equal(chat.paper,rgb(c.surface));
   await page.locator('#kb-workspace-tools [data-command="showOptions"]').click();await page.locator('.options-dialog.show').waitFor();await color('.options-dialog.show .modal-content','backgroundColor',rgb(c.surface));await color('.options-dialog.show .options-page-header','backgroundColor',rgb(c.surface));await color('.options-dialog.show .modal-sidebar','backgroundColor',rgb(c.sidebar));await page.locator('.options-dialog.show .btn-close').click();
   console.log('PASS: '+p.name+' native settings, sidebar, hub, hardware, home, quiz, quests, timer, market, text/code editor and chat');
  }
  await page.reload();await ready();assert.equal(await page.evaluate(()=>document.body.dataset.themeId),palettes.at(-1).id);
  for(const key of ['slate','forest','paper','ocean','mist']){
   const p=palettes.find(p=>p.key===key&&p.mode==='light');await choose(p.name,p.id);
   await page.locator('#kb-workspace-tools [data-action="theme"]').click();await page.waitForFunction(id=>document.body.dataset.themeId===id,'studio-'+key+'-dark');
   await page.locator('#kb-workspace-tools [data-action="theme"]').click();await page.waitForFunction(id=>document.body.dataset.themeId===id,p.id);
  }
  console.log('PASS: persisted native selection; each day/night pair retains palette');
  await choose('Codex 风格应用界面','codex-ui');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--ts-accent').trim()),'','new palette tokens unloaded on exit');
  console.log('PASS: choosing original theme unloads all studio overrides');
 }finally{
  for(const id of created)await api('DELETE','/notes/'+id);
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
