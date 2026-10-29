// End-to-end against the isolated Trilium on 37841/37842 only.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const token=fs.readFileSync('C:/Users/杜锦鸿/Desktop/api.txt','utf8').replace(/^\uFEFF/,'').trim();
const base='http://127.0.0.1:37841/etapi';
async function etapi(method,path,body,plain=false){
    const r=await fetch(base+path,{method,headers:{Authorization:token,'Content-Type':plain?'text/plain; charset=utf-8':'application/json'},body:body===undefined?undefined:plain?body:JSON.stringify(body)});
    const t=await r.text();if(!r.ok)throw Error(`${method} ${path}: ${r.status} ${t.slice(0,200)}`);return plain?t:t?JSON.parse(t):null;
}
async function open(page,id){await page.evaluate(async id=>{window.kbTestApp=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await window.kbTestApp.tabManager.openInSameTab(id,'root');},id);}
(async()=>{
    const marker='KBTEST'+Date.now(), sourceTitle=marker+' synthetic source', wikiTitle=marker+' Wiki';
    const fixture=await etapi('POST','/create-note',{parentNoteId:'e3e7d52e13a9',title:sourceTitle,type:'text',content:`<p>${marker}: The resistance in this synthetic test is 17 ohms.</p>`});
    const fixtureId=fixture.note.noteId;
    const browser=await chromium.connectOverCDP('http://127.0.0.1:37842');
    const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('trilium-app:'));
    assert(page,'Isolated Trilium must be running');
    try{
        await open(page,'KbHubHome001');await page.locator('.knowledge-hub').waitFor({timeout:30000});
        await page.locator('.kw-library-label select').selectOption('e3e7d52e13a9');await page.locator('.library-browser').waitFor({timeout:30000});
        assert((await etapi('GET','/notes/e3e7d52e13a9')).parentNoteIds.includes('KbHubHome001'));
        await page.locator('.kw-library-label select').selectOption('e3e7d52e13a9');await page.locator('.hardware-library').waitFor({timeout:30000});
        await open(page,'KbHubHome001');await page.locator('.library-browser').waitFor({timeout:30000});
        console.log('PASS: real hardware sublibrary and existing hardware view');
        await page.locator('.kw-tools summary').click();await page.locator('.kw-tools button').filter({hasText:'知识库提问'}).click();
        await page.locator('.kh-field textarea').fill(marker);
        await page.getByRole('button',{name:'检索相关笔记'}).click();
        await page.locator('.kh-source').filter({hasText:sourceTitle}).waitFor({timeout:30000});
        assert.equal(await page.locator('.kh-source input:checked').count(),1);
        await page.locator('.kw-tools summary').click();await page.locator('.kw-tools button').filter({hasText:'整理 Wiki'}).click();
        await page.locator('.kh-field input').fill(wikiTitle);
        await page.getByRole('button',{name:'生成 Wiki 草稿'}).click();
        console.log('WAIT: synthetic DSH model response');
        await page.locator('.kh-draft').waitFor({timeout:180000});
        const draft=await page.locator('.kh-draft').inputValue();assert(draft.trim().length>0);
        await page.locator('.kh-draft').fill("## Fixture\n\n**17 ohms**\n\n- example\n\n\\(R=17\\Omega\\)\n\n```\n\\(literal\\)\n```\n\n<script>alert('bad')</script>");
        await page.getByRole('button',{name:'保存为 Wiki'}).click();
        await page.locator('.kh-wiki-detail').waitFor({timeout:30000});
        const wikiFolder=await etapi('GET','/notes/KbWikiFolder1');
        const wikiNotes=await Promise.all(wikiFolder.childNoteIds.map(id=>etapi('GET',`/notes/${id}`)));
        const wikiId=wikiNotes.find(note=>note.title===wikiTitle)?.noteId;assert(wikiId);
        const html=await etapi('GET',`/notes/${wikiId}/content`,undefined,true);
        assert(html.includes(`href="#root/${fixtureId}"`),'Native source link missing');
        assert(html.includes('reference-link'),'Native reference-link class missing');
        assert(html.includes('<strong>17 ohms</strong>'),'Markdown was not converted to editable text');
        assert(html.includes('math-tex') && html.includes('R=17'),'Formula was not converted to native Trilium math');
        assert(html.includes('literal'),'Code content was lost');
        assert(!/<script\b/i.test(html),'Unsafe model HTML was not sanitized');
        assert((await page.locator('.kh-wiki-detail aside').innerText()).includes(marker));
        assert(await page.locator('.kh-wiki-detail .kh-paper math').count(),'Wiki preview did not render its formula');
        let linked=false;
        for(let i=0;i<20;i++){const n=await etapi('GET',`/notes/${wikiId}`);linked=n.attributes.some(a=>a.name==='internalLink'&&a.value===fixtureId);if(linked)break;await page.waitForTimeout(250);}
        assert(linked,'Native backlink indexing missing');
        console.log('PASS: source search, actual DSH generation, save, source links and native backlink indexing');
        await page.locator('.kw-tools summary').click();await page.locator('.kw-tools button').filter({hasText:'知识库提问'}).click();
        await page.locator('.kh-field textarea').fill('根据所选来源告诉我电阻数值。');
        await page.getByRole('button',{name:'向 DeepSeek 提问'}).click();
        await page.locator('.kh-answer.kh-formatted').waitFor({timeout:180000});
        const firstAnswer=await page.locator('.kh-answer').innerText();assert(firstAnswer.trim());
        await page.locator('.kh-field textarea').fill('继续追问：这个数字的单位是什么？');
        await page.getByRole('button',{name:'向 DeepSeek 提问'}).click();
        await page.waitForFunction(first=>{const x=document.querySelector('.kh-answer');return x && x.innerText!==first && !document.querySelector('.kh-progress');},firstAnswer,{timeout:180000});
        console.log('PASS: actual DSH knowledge answer, formatted display and follow-up');
        await open(page,'0e50f559e1a3');await page.locator('.myo-market').waitFor({timeout:30000});
        const card=page.locator('[data-plugin="KbWikiRoot01"]');await card.waitFor();const toggle=card.getByRole('switch');
        assert.equal(await toggle.getAttribute('aria-checked'),'true');await toggle.click();
        await page.waitForFunction(()=>document.querySelector('[data-plugin="KbWikiRoot01"] [role="switch"]')?.getAttribute('aria-checked')==='false');
        const disabled=await etapi('GET','/notes/KbHubHome001');assert(disabled.attributes.some(a=>a.name==='myoDisabled_renderNote'));
        await toggle.click();await page.waitForFunction(()=>document.querySelector('[data-plugin="KbWikiRoot01"] [role="switch"]')?.getAttribute('aria-checked')==='true');
        const enabled=await etapi('GET','/notes/KbHubHome001');assert(enabled.attributes.some(a=>a.name==='renderNote'));
        assert((await etapi('GET','/notes/KbWikiFolder1')).childNoteIds.includes(wikiId));
        console.log('PASS: market disable/enable with Wiki and hardware data preserved');
        const other=await etapi('POST','/create-note',{parentNoteId:'KbHubHome001',title:marker+' second library',type:'text',content:'<p>Test library.</p>'});
        await etapi('POST','/create-note',{parentNoteId:other.note.noteId,title:marker+' only here',type:'text',content:'<p>Second library fixture.</p>'});
        await open(page,'KbHubHome001');await page.locator('.knowledge-hub').waitFor({timeout:30000});
        await page.reload();await page.locator('.kw-library-label select').waitFor();
        const second=page.locator('.kw-library-label option').filter({hasText:marker+' second library'});await second.waitFor({timeout:30000});
        await page.locator('.kw-library-label select').selectOption(other.note.noteId);
        await page.waitForFunction(id=>document.querySelector('.library-browser')?.dataset.library===id,other.note.noteId,{timeout:30000});
        await page.locator('.kw-tools summary').click();await page.locator('.kw-tools button').filter({hasText:'知识库提问'}).click();
        await page.locator('.kh-field textarea').fill(marker);await page.getByRole('button',{name:'检索相关笔记'}).click();
        await page.locator('.kh-source').filter({hasText:marker+' only here'}).waitFor({timeout:30000});
        assert.equal(await page.locator('.kh-source').filter({hasText:sourceTitle}).count(),0,'Search leaked another library');
        console.log('PASS: additional sublibrary discovery and scoped search');
    }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
