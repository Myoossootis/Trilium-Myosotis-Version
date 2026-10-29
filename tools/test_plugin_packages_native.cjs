// Native isolated package lifecycle matrix; no model requests or user-note writes.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const market=fs.readFileSync('customizations/backend/plugin-market-service.js','utf8');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:37842'),page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function backend(script,params=[]){const r=await page.evaluate(async({script,params})=>{const server=(await import('trilium-app://app/src/server-E-v8IJ6Q.js')).t;return server.post('script/exec',{script,params,startNoteId:'MyoMarketSvc1',currentNoteId:'MyoMarketSvc1',transactional:!script.trim().startsWith('async ')});},{script,params});if(!r.success)throw Error(r.error);return r.executionResult;}
 const call=(action,payload={})=>backend(market,[action,payload]);
 const open=async id=>page.evaluate(async id=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab(id,'root');},id);
 const reload=async()=>{await page.reload();await page.waitForFunction(()=>window.TriliumModules);await page.waitForFunction(()=>!window.TriliumModules.enabled('x9qOG6S641fS')||!!window.MyoPomodoro);await page.waitForFunction(()=>!window.TriliumModules.enabled('NxExperience1')||!!document.querySelector('#eric-sticky-heading-fix-style'));};
 const canon=a=>a.map(x=>JSON.stringify(x)).sort();
 let active=null;
 async function toggle(id,enabled){const state=await call('load');return call('toggle',{id,enabled,revision:state.revision});}
 const guards={gTC4ItLtMiD5:'trilium-home-service.js',KbWikiRoot01:'customizations/backend/knowledge-wiki-service.js',MyoQuestGroup:'customizations/backend/commission-service.js','hardware-quiz':'customizations/backend/hardware-quiz-service.js',DsChatRoot1:'customizations/backend/dsh-chat-service.js'};
 try{
  await reload();await open('0e50f559e1a3');await page.locator('.mm-card[data-plugin]').first().waitFor();
  let state=await call('load'),plugins=state.plugins.filter(p=>!p.core);assert.equal(plugins.length,14);assert(plugins.every(p=>p.canToggle));assert.equal(await page.locator('.mm-card[data-plugin]').count(),plugins.length);
  const originalAudit=await call('audit'),base=new Map(originalAudit.plugins.map(p=>[p.id,canon(p.bindings)]));
  const identities=new Map();for(const p of originalAudit.plugins)for(const a of p.bindings){const key=JSON.stringify([a.noteId,a.type,a.name,a.value]);assert(!identities.has(key)||identities.get(key)===p.id,'shared activation binding '+key);identities.set(key,p.id);}
  console.log('PASS '+plugins.length+' toggleable feature packages, no duplicate activation ownership; management infrastructure excluded from feature cards');
  const originalTheme=await backend('function(){return api.getOption("theme").value;}');
  for(const plugin of plugins){
   assert(plugin.enabled,'test fixture expects enabled package '+plugin.name);active=plugin.id;
   await toggle(plugin.id,false);const audit=await call('audit');const target=audit.plugins.find(p=>p.id===plugin.id);assert(target.bindings.length>0);assert(target.bindings.every(a=>a.name.startsWith('myoDisabled_')),plugin.name+' left active bindings');
   for(const p of audit.plugins)if(p.id!==plugin.id)assert.deepEqual(canon(p.bindings),base.get(p.id),'toggle affected '+p.id);
   if(guards[plugin.id])await assert.rejects(()=>backend(fs.readFileSync(guards[plugin.id],'utf8'),['load',{}]),/已关闭/);
   await reload();assert.equal(await page.evaluate(id=>window.TriliumModules.enabled(id),plugin.id),false);
   if(plugin.id==='NxExperience1'){assert.equal(await page.evaluate(()=>!!window.TriliumNoteExperience||!!window.TriliumNoteTypography||!!document.querySelector('#eric-sticky-heading-fix-style')),false);}
   if(plugin.id==='KbWikiRoot01'){assert.equal(await page.locator('#kb-workspace-navigation,#kb-workspace-rail').count(),0);assert.equal(await page.evaluate(()=>!!window.TriliumKnowledgeManagement),false);}
   if(plugin.id==='ThmStudioRoot'){assert.equal(await page.evaluate(()=>!!window.TriliumThemeCards),false);assert(['next-light','next-dark'].includes(await backend('function(){return api.getOption("theme").value;}')));}
   if(plugin.id==='x9qOG6S641fS'){
    await open('HmeDashboard');await page.waitForFunction(()=>document.body.textContent.includes('番茄钟已关闭'));assert.equal(await page.evaluate(()=>!!window.MyoPomodoro),false,'Home lazy loader restarted disabled timer');
   }
   if(plugin.id==='MyoQuestGroup'){await assert.rejects(()=>page.evaluate(()=>window.MyoPomodoro.loadCommissions()),/已关闭/);}
   if(plugin.id==='DsChatRoot1'){assert.equal(await page.locator('#trilium-dsh-chat').count(),0);assert.equal(await page.evaluate(()=>!!window.TriliumDshChat),false);}
   if(plugin.id==='gTC4ItLtMiD5')await page.waitForSelector('#eric-sticky-heading-fix-style',{state:'attached'});
   await toggle(plugin.id,true);active=null;assert.deepEqual(canon((await call('audit')).plugins.find(p=>p.id===plugin.id).bindings),base.get(plugin.id),'bindings not restored '+plugin.name);
   await reload();console.log('PASS '+plugin.name+' off/reload/on: isolated bindings and runtime restoration');
  }
  assert.equal(await backend('function(){return api.getOption("theme").value;}'),originalTheme);assert.deepEqual(errors,[]);
  console.log('PASS theme round-trip and zero renderer exceptions across the package lifecycle matrix');
 }finally{if(active)try{await toggle(active,true);await reload();}catch(e){console.error('Restore package',e.message);}await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
