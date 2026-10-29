// Single-workspace regression on the real isolated renderer. No model calls.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const HUB='KbHubHome001',HW='e3e7d52e13a9',AC='79483c47e0d0';
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:37842'),p=b.contexts()[0].pages()[0];p.setDefaultTimeout(10000);const cdp=await p.context().newCDPSession(p),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const click=async s=>p.locator(s).evaluate(e=>e.click());
 const rawOpen=async id=>p.evaluate(async id=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab(id,'root');},id);
 const waitHub=async()=>p.waitForFunction(()=>location.hash.split('?')[0].split('/').at(-1)==='KbHubHome001'&&!!document.querySelector('.knowledge-workspace'));
 const waitLibrary=async id=>{await p.waitForFunction(id=>document.querySelector('.library-browser')?.dataset.library===id&&!!document.querySelector('.hl-layout'),id);};
 const select=async id=>{await p.locator('.kw-library-label select').selectOption(id);await waitLibrary(id);};
 const view=async name=>{await p.getByRole('button',{name,exact:true}).evaluate(e=>e.click());};
 const snapshot=async()=>p.evaluate(()=>({root:document.querySelector('.library-browser')?.dataset.library,heading:document.querySelector('.hl-folder-heading h2')?.textContent,query:document.querySelector('.hl-search input')?.value}));
 const viewport=async width=>{await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});const actual=await p.evaluate(()=>innerWidth);await cdp.send('Emulation.setDeviceMetricsOverride',{width:Math.round(width*width/actual),height:1000,deviceScaleFactor:1,mobile:false});await p.waitForTimeout(150);};
 async function shot(name){const r=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('tmp/theme-studio/'+name,Buffer.from(r.data,'base64'));}
 async function geometry(){const result=await p.locator('.knowledge-workspace').evaluate(e=>{const errors=[],outer=e.getBoundingClientRect();if(e.scrollWidth>e.clientWidth+1||outer.right>innerWidth+2)errors.push('workspace overflow');for(const q of ['.hl-toolbar','.hl-layout','.hl-row','.hl-topic','.kw-header'])for(const node of e.querySelectorAll(q)){const r=node.getBoundingClientRect();if(r.width&&node.scrollWidth>node.clientWidth+1)errors.push(q+' overflow');}return errors;});assert.deepEqual(result,[]);}
 let dark;
 try{
  await viewport(1280);await p.reload();await p.waitForFunction(()=>window.TriliumKnowledgeManagement&&window.TriliumKnowledgeWorkspaceRouter);
  await p.evaluate(()=>{localStorage.removeItem('trilium.library.browser.e3e7d52e13a9');localStorage.removeItem('trilium.library.browser.79483c47e0d0');sessionStorage.setItem('trilium.knowledge.active-library','e3e7d52e13a9');});
  await rawOpen(HUB);await p.reload();await waitLibrary(HW);await waitHub();
  assert.equal(await p.locator('.knowledge-workspace:visible').count(),1);assert.equal(await p.locator('.hl-topic-grid:visible').count(),1);assert.equal(await p.locator('.kh-topics:visible,.kh-open-library:visible,.hl-hero:visible,.hl-hub-link:visible').count(),0);
  assert.equal(await p.getByRole('button',{name:'新增专题',exact:false}).count(),1);
  await p.locator('.hl-topic-title').filter({hasText:'模拟电路'}).click();await p.locator('.hl-breadcrumb').waitFor();await waitHub();
  await p.locator('.hl-row-link').filter({hasText:'常见元器件'}).click();assert((await snapshot()).heading.includes('常见元器件'));await waitHub();
  const trail=await p.locator('.hl-breadcrumb').innerText();assert.equal((trail.match(/模拟电路/g)||[]).length,1,'topic must not be duplicated in breadcrumb');
  await click('.hl-up');assert((await snapshot()).heading.includes('模拟电路'));await click('.hl-up');await p.locator('.hl-topic').first().waitFor();
  console.log('PASS single topic grid, no duplicate Home/hero; same-page topic/folder navigation and one-level back');
  const card=p.locator('.hl-topic').first(),old=await card.locator('.hl-star').getAttribute('aria-pressed');await card.locator('.hl-star').click();const saved=await card.locator('.hl-star').getAttribute('aria-pressed');
  await select(AC);assert.equal(await p.locator('.hl-filters').count(),0);const academicTitle=await p.locator('.hl-topic-title').first().innerText();await p.locator('.hl-topic-title').first().click();assert((await snapshot()).heading.includes(academicTitle));
  await p.locator('.hl-search input').fill('PPG');await select(HW);assert.equal(await p.locator('.hl-topic').first().locator('.hl-star').getAttribute('aria-pressed'),saved);
  await p.locator('.hl-topic-title').filter({hasText:'模拟电路'}).click();await p.locator('.hl-search input').fill('电阻');await select(AC);assert.equal((await snapshot()).query,'PPG');await select(HW);assert.equal((await snapshot()).query,'电阻');
  await p.reload();await waitLibrary(HW);assert.equal((await snapshot()).query,'电阻');await p.locator('.hl-search input').fill('');assert((await snapshot()).heading.includes('模拟电路'));
  // Open original text and return to the same workspace position.
  await p.locator('.hl-row-link').filter({hasText:'常见元器件'}).click();const originalId=await p.locator('.hl-row').filter({hasText:'电阻'}).first().getAttribute('data-kb-note');await p.locator('.hl-row').filter({hasText:'电阻'}).first().locator('.hl-row-link').click();await p.locator('.note-detail-editable-text.visible').waitFor();await rawOpen(HUB);await waitLibrary(HW);assert((await snapshot()).heading.includes('常见元器件'));
  console.log('PASS per-library folder/query/favorite restoration, reload and original-note return');
  // Tree/root entries resolve to the exact same hub, without changing their note types.
  await rawOpen(AC);await waitHub();await waitLibrary(AC);await rawOpen(HW);await waitHub();await waitLibrary(HW);
  console.log('PASS academic and hardware root aliases both select the unified workspace');
  await click('.kw-tools summary');assert(await p.locator('.kw-tools button').filter({hasText:'主题 Wiki'}).isVisible());await p.locator('.kw-tools button').filter({hasText:'主题 Wiki'}).click();await p.locator('.kh-heading').waitFor();await waitHub();await click('.kh-back');await waitLibrary(HW);
  await click('.kw-tools summary');await p.locator('.kw-tools button').filter({hasText:'整理 Wiki'}).click();await p.locator('.kh-field input').waitFor();await click('.kh-back');await waitLibrary(HW);
  await click('.kw-tools summary');await p.locator('.kw-tools button').filter({hasText:'知识库提问'}).click();await p.locator('.kh-field textarea').waitFor();await click('.kh-back');await waitLibrary(HW);
  console.log('PASS optional Wiki/ask/compose tools and return without sending any model request');
  await view('专题导航');await p.locator('.hl-topic').first().waitFor();const current=await p.locator('.hl-topic').first().locator('.hl-star').getAttribute('aria-pressed');if(current!==old)await p.locator('.hl-topic').first().locator('.hl-star').click();
  const previewBefore=await p.locator('.hl-preview').innerText();if(await p.locator('.hl-recent>button').count()){await p.locator('.hl-recent>button').first().focus();assert.equal(await p.locator('.hl-preview').innerText(),previewBefore);}
  await p.locator('.hl-topic').first().scrollIntoViewIfNeeded();await p.waitForTimeout(250);await p.locator('.hl-topic').first().click({button:'right'});await p.locator('.km-menu').waitFor();assert.equal(await p.locator('.km-menu button').count(),6);await p.keyboard.press('Escape');
  dark=await p.evaluate(()=>document.body.classList.contains('dark-theme'));
  for(const mode of [false,true]){
   if(await p.evaluate(()=>document.body.classList.contains('dark-theme'))!==mode){await click('#kb-workspace-tools [data-action="theme"]');await p.waitForFunction(d=>document.body.classList.contains('dark-theme')===d,mode);}
   for(const width of [1280,800,375]){
    await viewport(width);if(width===375&&await p.locator('#kb-workspace-tools').isVisible())await click('#kb-workspace-tools [data-command="hideLeftPane"]');
    await geometry();assert.equal(await p.locator('.hl-topic-grid:visible').count(),1);await click('.kw-tools summary');const panel=await p.locator('.kw-tools>div').boundingBox();assert(panel.x>=0&&panel.x+panel.width<=await p.evaluate(()=>innerWidth),'tools menu clipped');await click('.kw-tools summary');await shot('unified-workspace-'+width+'-'+(mode?'dark':'light')+'.png');
    await p.locator('.hl-topic-title').filter({hasText:'模拟电路'}).click();await geometry();await shot('unified-folder-'+width+'-'+(mode?'dark':'light')+'.png');await click('.hl-up');
    console.log('PASS '+width+'px '+(mode?'dark':'light')+' unified cards, folder rows and controls');
   }
  }
  assert.deepEqual(errors,[]);console.log('PASS no renderer exceptions, right-click retained and recent-reading preview remains independent');
 }finally{await viewport(1280);if(dark!==undefined&&await p.evaluate(()=>document.body.classList.contains('dark-theme'))!==dark){await click('#kb-workspace-tools [data-action="theme"]');}await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
