// Real renderer + backend test of action-based deduplication. Isolated DB only.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const token=fs.readFileSync('C:/Users/杜锦鸿/Desktop/api.txt','utf8').replace(/^\uFEFF/,'').trim();
async function request(method,path,body,text=false){const r=await fetch('http://127.0.0.1:37841/etapi'+path,{method,headers:{Authorization:token,'Content-Type':text?'text/plain':'application/json'},body:body===undefined?undefined:text?body:JSON.stringify(body)});assert(r.ok,method+' '+path+' '+r.status);return r.status===204?null:text?r.text():r.json();}
(async()=>{
    const browser=await chromium.connectOverCDP('http://127.0.0.1:37842');
    const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('trilium-app:'));
    const original=await request('GET','/notes/KbNavData001/content',undefined,true),created=[];
    const order=()=>page.locator('.kw-shortcut').evaluateAll(ns=>ns.map(n=>n.dataset.tool));
    const forbidden=['_lbSettings','al_MyoMarketEntry','al_MyoCodexTheme','HmeLaunchBar','KbDupHomeT01'];
    try{
        for(const [id,title,script,icon] of [['KbDupQuizT01','刷题入口别名测试','HwQuizOpen01','bx bx-book-open'],['KbDupHomeT01','工作台入口别名测试','HmOpenHomeTab','bx bx-home-heart']]){
            await request('POST','/create-note',{noteId:id,parentNoteId:'_lbVisibleLaunchers',title,type:'launcher',mime:'',content:''});created.push(id);
            for(const [type,name,value] of [['label','launcherType','script'],['label','iconClass',icon],['relation','script',script]])await request('POST','/attributes',{noteId:id,type,name,value,isInheritable:false});
        }
        const injected={version:1,revision:JSON.parse(original).revision+10,pinned:['KbDupHomeT01','HmeLaunchBar','_lbSettings','al_MyoMarketEntry','al_MyoCodexTheme','KbDupQuizT01','al_HwQuiz01','al_MyoQuestEntry','al_MyoPomoEntry']};
        const raw=JSON.stringify(injected);await request('PUT','/notes/KbNavData001/content',raw,true);
        await page.reload();await page.locator('#kb-workspace-tools').waitFor();
        assert.deepEqual(await order(),['KbDupQuizT01','al_MyoQuestEntry','al_MyoPomoEntry']);
        assert.equal(await request('GET','/notes/KbNavData001/content',undefined,true),raw,'startup must not rewrite preferences');
        for(const id of forbidden)assert.equal(await page.locator(`.kw-tool-choices input[value="${id}"]`).count(),0);
        assert.equal(await page.locator('.kw-tool-choices input[value="al_HwQuiz01"]').count(),0,'same script must have one choice');
        assert.equal(await page.locator('.kw-tool-choices input[value="KbDupQuizT01"]').count(),1);
        assert.equal(await page.locator('#kb-workspace-tools [data-note="0e50f559e1a3"]').count(),1);
        console.log('PASS: fixed actions and script aliases merge; first chosen alias/order and stored preferences are preserved');
        await page.locator('#kb-workspace-navigation [data-action="tools"]').click();
        const choice=page.locator('.kw-tool-choices input[value="_lbRecentChanges"]');await choice.check();await page.waitForFunction(()=>document.querySelector('#kb-workspace-navigation').dataset.saving==='false');
        assert(await choice.evaluate(e=>e===document.activeElement),'checkbox must retain keyboard focus after save');
        const saved=JSON.parse(await request('GET','/notes/KbNavData001/content',undefined,true));
        assert.deepEqual(saved.pinned,['KbDupQuizT01','al_MyoQuestEntry','al_MyoPomoEntry','_lbRecentChanges']);
        await page.keyboard.press('Escape');assert(await page.locator('#kb-workspace-navigation [data-action="tools"]').evaluate(e=>e===document.activeElement));
        await page.reload();await page.locator('#kb-workspace-tools').waitFor();assert.deepEqual(await order(),saved.pinned);
        console.log('PASS: explicit save persists merged order; focus and Escape behavior; reload persistence');
    }finally{
        await request('PUT','/notes/KbNavData001/content',original,true);
        for(const id of created)await request('DELETE','/notes/'+id);
        await page.reload();await page.locator('#kb-workspace-tools').waitFor();await browser.close();
    }
})().catch(error=>{console.error(error);process.exit(1);});
