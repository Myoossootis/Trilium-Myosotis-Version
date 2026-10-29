// Real native Appearance settings: card selection, modes, persistence and layout.
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:37842'),p=b.contexts()[0].pages().find(p=>p.url().startsWith('trilium-app:'));
 const ready=async()=>{await p.locator('#kb-workspace-navigation').waitFor({state:'attached'});if(await p.locator('#kb-workspace-rail').isVisible())await p.locator('#kb-workspace-rail [data-command="showLeftPane"]').click();};
 const open=async()=>{await p.locator('#kb-workspace-tools [data-command="showOptions"]').click();await p.locator('.ts-settings').waitFor();};
 try{
  await p.reload();await ready();await open();assert.equal(await p.locator('.ts-theme-card').count(),5);assert.equal(await p.locator('.ts-settings').count(),1);
  assert(await p.locator('.options-dialog.show button[id^="theme-"]').isHidden());
  for(const key of ['paper','slate','forest','ocean','mist']){
   await p.locator(`.ts-theme-card[data-palette="${key}"]`).click();await p.waitForFunction(key=>document.body.dataset.themeId?.startsWith('studio-'+key+'-'),key);
   for(const mode of ['light','dark']){
    await p.locator(`.ts-mode [data-mode="${mode}"]`).click();await p.waitForFunction(id=>document.body.dataset.themeId===id,'studio-'+key+'-'+mode);
    await p.waitForFunction(()=>[...document.querySelectorAll('.ts-theme-card')].every(n=>!n.disabled));
    assert.equal(await p.locator(`.ts-theme-card[data-palette="${key}"]`).getAttribute('aria-pressed'),'true');
    assert.equal(await p.locator(`.ts-mode [data-mode="${mode}"]`).getAttribute('aria-pressed'),'true');
    assert.equal(await p.locator('.ts-theme-card[aria-pressed=true]').count(),1);
   }
  }
  console.log('PASS five preview cards, both native modes, selected state and no duplicate rows');
  await p.locator('.ts-theme-card[data-palette="paper"]').click();await p.waitForFunction(()=>document.body.dataset.themeId==='studio-paper-dark');
  await p.locator('.ts-mode [data-mode="light"]').click();await p.waitForFunction(()=>document.body.dataset.themeId==='studio-paper-light');
  await p.waitForFunction(()=>[...document.querySelectorAll('.ts-theme-card')].every(n=>!n.disabled));
  for(const size of [{width:1280,height:900},{width:800,height:700},{width:600,height:700}]){
   await p.setViewportSize(size);await p.waitForTimeout(120);
   const errors=await p.locator('.ts-settings').evaluate(e=>{
    const r=e.getBoundingClientRect(),cards=[...e.querySelectorAll('.ts-theme-card')],errors=[];
    if(e.scrollWidth>e.clientWidth+1)errors.push('panel overflow');
    for(const c of cards){const q=c.getBoundingClientRect();if(q.left<r.left-1 || q.right>r.right+1 || c.scrollWidth>c.clientWidth+1)errors.push('card overflow');}
    return errors;
   });assert.deepEqual(errors,[]);
   console.log('PASS preview card layout '+size.width+'px');
  }
  await p.setViewportSize({width:1280,height:900});
  await p.locator('.ts-native-toggle').click();assert(await p.locator('.options-dialog.show button[id^="theme-"]').isVisible());
  await p.locator('.options-dialog.show button[id^="theme-"]').click();await p.locator('.dropdown-menu.show').getByText('Codex 风格应用界面',{exact:true}).click();await p.waitForFunction(()=>document.body.dataset.themeId==='codex-ui');
  assert.equal(await p.locator('.ts-theme-card[aria-pressed=true]').count(),0);
  await p.locator('.ts-theme-card[data-palette="paper"]').click();await p.waitForFunction(()=>document.body.dataset.themeId==='studio-paper-light');
  await p.locator('.ts-native-toggle').click();
  await p.locator('.options-dialog.show .btn-close').click();await p.reload();await ready();await open();assert.equal(await p.locator('.ts-settings').count(),1);assert.equal(await p.locator('.ts-theme-card[data-palette="paper"]').getAttribute('aria-pressed'),'true');
  await p.screenshot({path:'E:/EricDictionary/tmp/theme-studio/theme-cards-final.png'});
  await p.locator('.options-dialog.show .settings-navigation-item').filter({hasText:'语言和区域'}).click();await p.locator('.ts-settings').waitFor({state:'detached'});
  await p.locator('.options-dialog.show .settings-navigation-item').filter({hasText:'外观'}).click();await p.locator('.ts-settings').waitFor();assert.equal(await p.locator('.ts-settings').count(),1);
  await p.locator('.options-dialog.show .btn-close').click();
  const dark=await p.evaluate(()=>document.body.classList.contains('dark-theme'));await p.locator('#kb-workspace-tools [data-action="theme"]').click();await p.waitForFunction(d=>document.body.classList.contains('dark-theme')!==d,dark);await open();assert.equal(await p.locator('.ts-mode [data-mode="dark"]').getAttribute('aria-pressed'),'true');
  console.log('PASS native fallback, reload persistence, settings remount and day/night synchronization');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
