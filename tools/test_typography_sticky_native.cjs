// Regression in the isolated real Trilium (37841/37842): typography and frozen headings.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const token=fs.readFileSync('C:/Users/杜锦鸿/Desktop/api.txt','utf8').replace(/^\uFEFF/,'').trim();
const note='QEI95FCduo3c';
const content=async()=>{const r=await fetch('http://127.0.0.1:37841/etapi/notes/'+note+'/content',{headers:{Authorization:token}});assert(r.ok);return r.text();};
(async()=>{
 const before=await content(),b=await chromium.connectOverCDP('http://127.0.0.1:37842'),p=b.contexts()[0].pages()[0];p.setDefaultTimeout(10000);
 const cdp=await p.context().newCDPSession(p);
 const viewport=async width=>{await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});const actual=await p.evaluate(()=>innerWidth);await cdp.send('Emulation.setDeviceMetricsOverride',{width:Math.round(width*width/actual),height:900,deviceScaleFactor:1,mobile:false});};
 async function jump(){
  await p.evaluate(()=>{const c=[...document.querySelectorAll('.ck-content')].find(e=>e.getBoundingClientRect().height>0),s=c.closest('.scrolling-container');s.dispatchEvent(new CustomEvent('myosotis-reference-jump',{bubbles:true}));s.scrollTo({top:0,behavior:'instant'});});
  await p.waitForTimeout(80);
  await p.evaluate(()=>{const c=[...document.querySelectorAll('.ck-content')].find(e=>e.getBoundingClientRect().height>0),s=c.closest('.scrolling-container'),h=[...c.querySelectorAll('h2')].find(e=>e.textContent.includes('1.3'));s.scrollTo({top:h.getBoundingClientRect().top-s.getBoundingClientRect().top+300,behavior:'instant'});});
  await p.waitForTimeout(150);
 }
 async function geometry(){return p.evaluate(()=>{const c=[...document.querySelectorAll('.ck-content')].find(e=>e.getBoundingClientRect().height>0),h2=[...c.querySelectorAll('h2')].find(e=>e.textContent.includes('1.3')),h3=[...c.querySelectorAll('h3')].find(e=>e.textContent.includes('1.3.')&&getComputedStyle(e).position==='sticky'),a=h2.getBoundingClientRect(),b=h3.getBoundingClientRect();return {width:c.clientWidth,parent:c.parentElement.clientWidth,h2Height:a.height,h2Bottom:a.bottom,h3Top:b.top,offset:getComputedStyle(h3).top,viewport:innerWidth};});}
 try{
  await viewport(1280);await p.reload();await p.waitForFunction(()=>document.querySelector('#eric-sticky-heading-fix-style'));
  await p.evaluate(async id=>{const app=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await app.tabManager.openInSameTab(id,'root');},note);
  await p.waitForFunction(()=>[...document.querySelectorAll('.ck-content')].some(c=>c.getBoundingClientRect().height>0&&c.textContent.includes('1.3 参数')));
  for(const style of ['clean','study','reading','off']){
   await p.evaluate(style=>{if(style==='off')delete document.body.dataset.noteTypography;else document.body.dataset.noteTypography=style;},style);await p.waitForTimeout(180);await jump();const g=await geometry();
   assert(g.h3Top>=g.h2Bottom-.5,style+' overlap '+JSON.stringify(g));assert(g.h3Top<=g.h2Bottom+2,style+' excess gap');if(style!=='off')assert(g.width>800,style+' still narrow');console.log('PASS '+style+' '+JSON.stringify(g));
  }
  await p.evaluate(()=>{document.body.dataset.noteTypography='reading';const style=document.createElement('style');style.id='test-wrap-heading';style.textContent='.note-split.eric-knowledge-base .ck-content h2{max-width:130px!important}';document.head.append(style);});await p.waitForTimeout(200);await jump();
  const wrap=await geometry();assert(wrap.h2Height>70);assert(wrap.h3Top>=wrap.h2Bottom-.5,'wrapped H2 overlap');console.log('PASS wrapped H2 dynamic height '+JSON.stringify(wrap));
  await p.evaluate(()=>document.querySelector('#test-wrap-heading').remove());await jump();
  // A following H2 must retire the previous H3 even when its own section has no H3.
  await p.evaluate(()=>{const c=[...document.querySelectorAll('.ck-content')].find(e=>e.getBoundingClientRect().height>0),s=c.closest('.scrolling-container'),h=[...c.querySelectorAll('h2')].find(e=>e.textContent.includes('1.4'));s.scrollTo({top:s.scrollTop+h.getBoundingClientRect().top-s.getBoundingClientRect().top+250,behavior:'instant'});});await p.waitForTimeout(150);
  assert(await p.evaluate(()=>[...document.querySelectorAll('.ck-content h3')].filter(e=>e.textContent.includes('1.3')).every(e=>getComputedStyle(e).position==='static')));console.log('PASS previous chapter H3 retired');
  for(const width of [1280,375]){
   if(width===375)await p.locator('#kb-workspace-tools [data-command="hideLeftPane"]').evaluate(e=>e.click());
   await viewport(width);await p.waitForTimeout(150);await jump();const g=await geometry();assert(g.h3Top>=g.h2Bottom-.5,JSON.stringify(g));
   const shot=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('tmp/theme-studio/typography-width-fix-'+width+'.png',Buffer.from(shot.data,'base64'));console.log('PASS rendered width '+width+' '+JSON.stringify(g));
  }
  assert.equal(await content(),before);console.log('PASS original note HTML unchanged');
 }finally{await viewport(1280);await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
