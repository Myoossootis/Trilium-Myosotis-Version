const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
const b=await chromium.connectOverCDP('http://127.0.0.1:37842'),p=b.contexts()[0].pages()[0];p.setDefaultTimeout(8000);
try{
await p.reload();await p.waitForFunction(()=>window.TriliumNoteTypography);console.log('loaded');
await p.locator('#kb-workspace-tools [data-command="showOptions"]').evaluate(e=>e.click());await p.locator('.nt-settings').waitFor();console.log('opened');
for(const style of ['clean','study','reading']){
 await p.locator('.nt-card[data-style='+style+']').evaluate(e=>e.click());await p.waitForFunction(()=>!document.querySelector('.nt-enable input').disabled);
 await p.locator('.nt-enable input').evaluate(e=>{if(!e.checked)e.click()});await p.waitForFunction(()=>!document.querySelector('.nt-enable input').disabled);
 assert.equal(await p.evaluate(()=>document.body.dataset.noteTypography),style);console.log('PASS '+style);
}
await p.locator('.nt-enable input').evaluate(e=>e.click());await p.waitForFunction(()=>!document.querySelector('.nt-enable input').disabled);assert.equal(await p.evaluate(()=>document.body.hasAttribute('data-note-typography')),false);console.log('PASS off');
await p.reload();await p.waitForFunction(()=>window.TriliumNoteTypography);assert.equal(await p.evaluate(()=>document.body.hasAttribute('data-note-typography')),false);console.log('PASS off persisted');
await p.locator('#kb-workspace-tools [data-command="showOptions"]').evaluate(e=>e.click());await p.locator('.nt-settings').waitFor();await p.locator('.nt-enable input').evaluate(e=>e.click());await p.waitForFunction(()=>!document.querySelector('.nt-enable input').disabled);
await p.reload();await p.waitForFunction(()=>document.body.dataset.noteTypography==='reading');console.log('PASS reading persisted');
}catch(e){throw e}finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
