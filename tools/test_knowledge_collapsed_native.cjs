// Native collapsed/expanded workspace checks in the isolated 37841/37842 instance.
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:37842');
 const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('trilium-app:'));
 const rail=page.locator('#kb-workspace-rail'),footer=page.locator('#kb-workspace-tools');
 const originalDark=await page.evaluate(()=>document.body.classList.contains('dark-theme'));
 async function expanded(){if(await rail.isVisible())await rail.locator('[data-command="showLeftPane"]').click();await footer.waitFor();assert(await rail.isHidden());assert(await page.locator('#launcher-pane').isHidden());}
 async function collapsed(){if(await footer.isVisible())await footer.locator('[data-command="hideLeftPane"]').click();await rail.waitFor();assert(await page.locator('#left-pane').isHidden());assert(await page.locator('#launcher-pane').isHidden());assert.equal(await page.locator('#kb-workspace-rail').count(),1);}
 async function geometry(){
   const issues=await rail.evaluate(e=>{
    const errors=[],outer=e.getBoundingClientRect(),buttons=[...e.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().height);
    for(const b of buttons){const r=b.getBoundingClientRect();if(r.left<outer.left-1 || r.right>outer.right+1)errors.push('button outside rail');}
    const groups=[...e.children].map(e=>e.getBoundingClientRect());for(let i=1;i<groups.length;i++)if(groups[i].top<groups[i-1].bottom-1)errors.push('rail groups overlap');
    const scroll=e.querySelector('.kw-rail-shortcuts'),r=scroll.getBoundingClientRect();for(const b of buttons){const a=b.getBoundingClientRect();if(!scroll.contains(b) && (a.top<outer.top-1 || a.bottom>outer.bottom+1))errors.push('fixed action clipped');}
    return errors;
   });assert.deepEqual(issues,[]);
 }
 try{
   await expanded();
   for(const size of [{width:1280,height:900},{width:800,height:600},{width:600,height:480}]){
    await page.setViewportSize(size);await expanded();
    const sizes=await footer.locator('button').evaluateAll(ns=>ns.map(e=>{const r=e.getBoundingClientRect();return {w:r.width,y:r.y,h:r.height,c:r.y+r.height/2};}));
    assert(Math.abs(sizes[0].w-sizes[1].w)<1);assert(Math.abs(sizes[0].c-sizes[2].c)<1);assert(Math.abs(sizes[1].c-sizes[3].c)<1);
    await collapsed();await geometry();console.log('PASS: aligned expanded footer and collapsed rail '+size.width+'x'+size.height);
   }
   await page.setViewportSize({width:1280,height:900});
   assert.deepEqual(await rail.locator('[data-tool]').evaluateAll(ns=>ns.map(n=>n.dataset.tool)),await page.locator('.kw-shortcut-list [data-tool]').evaluateAll(ns=>ns.map(n=>n.dataset.tool)));
   for(const [view,selector] of [['home','.eric-home-dashboard'],['knowledge','.library-browser'],['graph','.note-detail-note-map.visible .note-map-container']]){
    await rail.locator(`[data-view="${view}"]`).click();await page.locator(selector).first().waitFor({timeout:30000});await collapsed();
    await page.waitForFunction(v=>document.querySelector(`#kb-workspace-rail [data-view="${v}"]`)?.getAttribute('aria-current')==='page',view);
   }
   await rail.locator('[data-command="showOptions"]').click();await page.locator('.options-dialog.show').waitFor();await page.locator('.options-dialog.show .btn-close').click();await collapsed();
   await rail.locator('[data-note="0e50f559e1a3"]').click();await page.locator('[data-plugin="KbWikiRoot01"]').waitFor({timeout:30000});await collapsed();
   const before=await rail.locator('[data-action="theme"]').evaluate(e=>getComputedStyle(e,'::after').transform);
   await rail.locator('[data-action="theme"]').click();await page.waitForFunction(d=>document.body.classList.contains('dark-theme')!==d,originalDark);await page.waitForTimeout(600);
   const after=await rail.locator('[data-action="theme"]').evaluate(e=>getComputedStyle(e,'::after').transform);assert.notEqual(before,after);
   await page.screenshot({path:'E:/EricDictionary/tmp/sidebar-collapse/collapsed-dark.png'});
   await rail.locator('[data-action="theme"]').click();await page.waitForFunction(d=>document.body.classList.contains('dark-theme')===d,originalDark);
   await page.reload();await rail.waitFor({timeout:30000});await collapsed();await geometry();
   console.log('PASS: collapsed navigation, native settings/plugins, animated themes, order and reload');
   const toggle=page.locator('[data-plugin="KbWikiRoot01"] [role="switch"]');await toggle.click();await page.waitForFunction(()=>document.querySelector('[data-plugin="KbWikiRoot01"] [role="switch"]')?.getAttribute('aria-checked')==='false');
   await page.reload();await page.locator('[data-plugin="KbWikiRoot01"]').waitFor({timeout:30000});assert.equal(await rail.count(),0);assert(await page.locator('#launcher-pane').isVisible());
   await page.locator('[data-plugin="KbWikiRoot01"] [role="switch"]').click();await page.waitForFunction(()=>document.querySelector('[data-plugin="KbWikiRoot01"] [role="switch"]')?.getAttribute('aria-checked')==='true');
   await page.reload();await rail.waitFor({timeout:30000});await collapsed();await expanded();
   console.log('PASS: disabled plugin restores native launcher; enabling restores one new rail; expand works');
   await page.locator('#kb-workspace-navigation [data-view="knowledge"]').click();await page.locator('.library-browser').waitFor();await page.screenshot({path:'E:/EricDictionary/tmp/sidebar-collapse/expanded-final.png'});
   await collapsed();await page.screenshot({path:'E:/EricDictionary/tmp/sidebar-collapse/collapsed-final.png'});await expanded();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
