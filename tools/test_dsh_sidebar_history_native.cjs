// Read-only live DSH history verification; never send/change a model or conversation.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const {sessionId}=JSON.parse(fs.readFileSync('tmp/dsh-chat-formula-session.json','utf8'));
 const browser=await chromium.connectOverCDP('http://127.0.0.1:37842'),page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(20000);
 const previous=await page.evaluate(()=>localStorage.getItem('eric.dsh-chat.ui.v1'));
 try{
  await page.setViewportSize({width:1152,height:765});
  await page.evaluate(sessionId=>localStorage.setItem('eric.dsh-chat.ui.v1',JSON.stringify({sessionId})),sessionId);
  await page.reload();await page.locator('#dsh-sidebar-entry').waitFor();
  const root=page.locator('#trilium-dsh-chat');if(!await root.isVisible())await page.locator('#dsh-sidebar-entry').click();
  await root.locator('math').first().waitFor();
  const actual=await root.locator('.log').evaluate(log=>({formulas:log.querySelectorAll('math').length,display:log.querySelectorAll('.ds-math-display').length,errors:log.querySelectorAll('.ds-math-error').length,namespace:log.querySelector('math').namespaceURI}));
  assert.equal(actual.formulas,12);assert.equal(actual.display,3);assert.equal(actual.errors,0);assert.equal(actual.namespace,'http://www.w3.org/1998/Math/MathML');
  await root.locator('.status').filter({hasText:'已连接 DSH'}).waitFor();
  assert(await root.locator('.image-picker').isVisible());assert(await root.locator('.model-select option').count()>1);
  assert((await root.locator('.foot-status').textContent()).includes('缓存命中'));
  const cdp=await page.context().newCDPSession(page);fs.writeFileSync('output/dsh-chat/sidebar-live-history.png',Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  console.log('PASS live DSH history in native sidebar: 12 formulas / 3 display formulas, model catalog, image control, usage; no prompts or model changes');
 }finally{
  await page.evaluate(previous=>{if(previous===null)localStorage.removeItem('eric.dsh-chat.ui.v1');else localStorage.setItem('eric.dsh-chat.ui.v1',previous);},previous);
  await page.evaluate(()=>window.TriliumDshChat?.open(false)).catch(()=>{});await page.reload();await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
