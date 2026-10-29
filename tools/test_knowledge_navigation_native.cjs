// Native navigation regression on the isolated 37841/37842 instance; no model calls.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const token=fs.readFileSync('C:/Users/杜锦鸿/Desktop/api.txt','utf8').replace(/^\uFEFF/,'').trim();
async function note(id){const r=await fetch('http://127.0.0.1:37841/etapi/notes/'+id,{headers:{Authorization:token}});assert(r.ok);return r.json();}
(async()=>{
    const browser=await chromium.connectOverCDP('http://127.0.0.1:37842');
    const page=browser.contexts()[0].pages().find(page=>page.url().startsWith('trilium-app:'));
    assert(page);
    async function ready(){await page.locator('#kb-workspace-navigation').waitFor({timeout:30000});await page.waitForFunction(()=>document.body.classList.contains('kb-workspace-nav'));}
    async function single(){assert.equal(await page.locator('#kb-workspace-navigation').count(),1);assert.equal(await page.locator('.kh-sidebar').count(),0);assert.equal(await page.locator('#launcher-pane').evaluate(e=>getComputedStyle(e).display),'none');assert(await page.locator('#left-pane').isVisible());}
    const nav=page.locator('#kb-workspace-navigation');
    await page.context().addInitScript(()=>{
        window.kwStartup={samples:[],firstHeader:null};
        const timer=setInterval(()=>{
            const rail=document.querySelector('#launcher-pane'),header=document.querySelector('#kb-workspace-navigation');
            if(rail && rail.getBoundingClientRect().width>0 && getComputedStyle(rail).display!=='none')window.kwStartup.samples.push(Math.round(performance.now()));
            if(header && !window.kwStartup.firstHeader)window.kwStartup.firstHeader=Math.round(performance.now());
            if(performance.now()>8000)clearInterval(timer);
        },16);
    });
    async function layout(){
        const issues=await page.evaluate(()=>{
            const issues=[],pane=document.querySelector('#left-pane');
            const visible=e=>e.getBoundingClientRect().height>0 && getComputedStyle(e).display!=='none';
            const children=[...pane.children].filter(visible).map(e=>({id:e.id||e.className,r:e.getBoundingClientRect()}));
            for(let i=1;i<children.length;i++)if(children[i-1].r.bottom>children[i].r.top+1)issues.push('side regions overlap: '+children[i].id);
            const footer=pane.querySelector('#kb-workspace-tools').getBoundingClientRect();
            if(footer.bottom>pane.getBoundingClientRect().bottom+1)issues.push('footer below pane');
            for(const e of pane.querySelectorAll('#kb-workspace-tools button'))if(e.scrollWidth>e.clientWidth+1)issues.push('footer label clipped');
            const rows=[...pane.querySelectorAll('.fancytree-node')].filter(visible);
            for(let i=1;i<rows.length;i++)if(rows[i-1].getBoundingClientRect().bottom>rows[i].getBoundingClientRect().top+1)issues.push('tree rows overlap');
            for(const e of rows){const r=e.getBoundingClientRect(),t=e.querySelector('.fancytree-title').getBoundingClientRect();if(t.top<r.top-1 || t.bottom>r.bottom+1)issues.push('tree title outside row');}
            return issues;
        });
        assert.deepEqual(issues,[]);
    }
    const getOrder=()=>page.locator('.kw-shortcut').evaluateAll(nodes=>nodes.map(n=>n.dataset.tool));
    const saved=async()=>{await page.waitForFunction(()=>document.querySelector('#kb-workspace-navigation')?.dataset.saving==='false');};
    const originalConfig=await (await fetch('http://127.0.0.1:37841/etapi/notes/KbNavData001/content',{headers:{Authorization:token}})).text();
    try{
        for(let i=0;i<3;i++){
            await page.reload();await ready();await single();await layout();
            const startup=await page.evaluate(()=>window.kwStartup);
            assert.deepEqual(startup.samples,[],'native launcher flashed before the replacement');
            console.log('PASS: startup without old-layout flash; navigation at '+startup.firstHeader+'ms');
        }
        await page.setViewportSize({width:1440,height:1000});
        await nav.locator('[data-action="tools"]').click();
        const input=page.locator('.kw-tool-choices input[value="_lbJumpTo"]');await input.check();await saved();await page.keyboard.press('Escape');
        const before=await getOrder();
        await page.locator('.kw-shortcut').last().dragTo(page.locator('.kw-shortcut').first(),{targetPosition:{x:60,y:3}});await saved();
        const dragged=[before.at(-1),...before.slice(0,-1)];assert.deepEqual(await getOrder(),dragged);
        await page.reload();await ready();assert.deepEqual(await getOrder(),dragged);
        await page.locator('.kw-shortcut[data-tool="_lbJumpTo"]').click();await page.locator('.modal.show').waitFor();await page.locator('.modal.show .btn-close').click();
        await page.locator('.kw-shortcut').first().focus();await page.keyboard.press('Alt+ArrowDown');await saved();assert.deepEqual((await getOrder()).slice(0,2),[dragged[1],dragged[0]]);
        await nav.locator('[data-action="tools"]').click();await input.uncheck();await saved();assert(!(await getOrder()).includes('_lbJumpTo'));
        // More tools than fit must scroll without squeezing search or the tree.
        for(const id of await page.locator('.kw-tool-choices input:not(:checked)').evaluateAll(ns=>ns.map(n=>n.value))){await page.locator(`.kw-tool-choices input[value="${id}"]`).check();await saved();}
        await page.keyboard.press('Escape');
        for(const size of [{width:1440,height:1000},{width:800,height:600},{width:600,height:480}]){await page.setViewportSize(size);await page.waitForTimeout(100);await layout();}
        const scroll=await page.locator('.kw-shortcut-list').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight}));assert(scroll.scroll>scroll.height);
        await nav.locator('[data-action="tools"]').click();
        assert(await page.locator('.kw-tools-menu').evaluate(e=>{const r=e.getBoundingClientRect();return !!document.elementFromPoint(r.right-8,r.top+20)?.closest('.kw-tools-menu');}),'tool menu is hidden by the content pane');
        await page.keyboard.press('Escape');
        // Restore a compact layout for the rest of the native navigation checks.
        await nav.locator('[data-action="tools"]').click();
        for(const id of await page.locator('.kw-tool-choices input:checked').evaluateAll(ns=>ns.map(n=>n.value))){await page.locator(`.kw-tool-choices input[value="${id}"]`).uncheck();await saved();}
        assert(await page.locator('.kw-empty-tools').isVisible());
        for(const id of ['al_HwQuiz01','al_MyoQuestEntry','al_MyoPomoEntry']){await page.locator(`.kw-tool-choices input[value="${id}"]`).check();await saved();}
        await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1000});
        console.log('PASS: real pointer drag, keyboard order, pin/unpin/empty list, persistence and scroll containment');
        await nav.locator('[data-note="KbHubHome001"]').click();await page.locator('.library-browser').waitFor({timeout:30000});
        const hub=await note('KbHubHome001');for(const id of ['79483c47e0d0','e3e7d52e13a9']){assert(hub.childNoteIds.includes(id));const library=await note(id);assert(library.parentNoteIds.includes('KbHubHome001'));assert(!library.parentNoteIds.includes('root'));}
        assert(await page.locator('.kw-library-label option[value="79483c47e0d0"]').count());assert(await page.locator('.kw-library-label option[value="e3e7d52e13a9"]').count());
        await page.waitForFunction(()=>[...document.querySelectorAll('#left-pane .fancytree-hide')].every(e=>e.getBoundingClientRect().height===0));
        await page.locator('.kw-library-label select').selectOption('79483c47e0d0');
        await page.waitForFunction(()=>document.querySelector('.library-browser')?.dataset.library==='79483c47e0d0');
        assert(await page.locator('.knowledge-workspace').isVisible());
        await single();
        console.log('PASS: one native sidebar, no in-page navigation, academic and hardware sublibraries');
        await nav.locator('[data-note="HmeDashboard"]').click();await page.locator('.eric-home-dashboard').waitFor({timeout:30000});
        await page.waitForFunction(()=>document.querySelector('#kb-workspace-navigation [data-view="home"]')?.getAttribute('aria-current')==='page');await single();
        await nav.locator('[data-note="KbHubHome001"]').click();await page.locator('.library-browser').waitFor({timeout:30000});
        await page.locator('#kb-workspace-directory button').click();
        await page.waitForFunction(()=>document.querySelector('#kb-workspace-directory button')?.textContent==='子库目录');
        await page.locator('#kb-workspace-directory button').click();await page.waitForFunction(()=>document.querySelector('#kb-workspace-directory button')?.textContent==='完整目录');
        await nav.locator('[data-view="graph"]').click();await page.locator('.note-detail-note-map.visible .note-map-container').waitFor({timeout:30000});
        assert((await note('KbGraphNote1')).attributes.some(a=>a.name==='mapRootNoteId'&&a.value==='KbHubHome001'));
        await nav.locator('[data-note="KbHubHome001"]').click();await page.locator('.library-browser').waitFor({timeout:30000});
        await page.locator('#kb-workspace-navigation [data-action="tools"]').click();
        await page.locator('.kw-tools-menu').waitFor({state:'visible'});const tools=await page.locator('.kw-tools-menu').innerText();assert(tools.includes('新建笔记')&&tools.includes('番茄钟')&&tools.includes('高级搜索')&&!tools.includes('切换浅色')&&!tools.includes('设置'));await page.keyboard.press('Escape');assert(await page.locator('.kw-tools-menu').isHidden());
        await page.locator('#kb-workspace-tools [data-command="showOptions"]').click();await page.locator('.options-dialog.show').waitFor();await page.locator('.options-dialog.show .btn-close').click();await page.locator('.options-dialog.show').waitFor({state:'hidden'});await nav.locator('[data-note="KbHubHome001"]').click();await page.locator('.library-browser').waitFor({timeout:30000});
        const dark=await page.evaluate(()=>document.body.classList.contains('dark-theme'));
        await page.locator('#kb-workspace-tools [data-action="theme"]').click();await page.waitForFunction(d=>document.body.classList.contains('dark-theme')!==d,dark);await single();
        await page.locator('#kb-workspace-tools [data-action="theme"]').click();await page.waitForFunction(d=>document.body.classList.contains('dark-theme')===d,dark);
        console.log('PASS: global navigation, native directory scopes, tools, settings and theme switching');
        await page.locator('#kb-workspace-tools [data-note="0e50f559e1a3"]').click();await page.locator('[data-plugin="KbWikiRoot01"]').waitFor({timeout:30000});
        const toggle=page.locator('[data-plugin="KbWikiRoot01"] [role="switch"]');await toggle.click();
        await page.waitForFunction(()=>document.querySelector('[data-plugin="KbWikiRoot01"] [role="switch"]')?.getAttribute('aria-checked')==='false');
        assert((await note('KbWikiNav001')).attributes.some(a=>a.name==='myoDisabled_widget'));
        await page.reload();await page.locator('[data-plugin="KbWikiRoot01"]').waitFor({timeout:30000});assert.equal(await page.locator('#kb-workspace-navigation').count(),0);assert(await page.locator('#launcher-pane').isVisible());
        await page.locator('[data-plugin="KbWikiRoot01"] [role="switch"]').click();
        await page.waitForFunction(()=>document.querySelector('[data-plugin="KbWikiRoot01"] [role="switch"]')?.getAttribute('aria-checked')==='true');
        await page.reload();await ready();await single();
        await page.locator('#kb-workspace-navigation [data-note="KbHubHome001"]').click();await page.locator('.library-browser').waitFor({timeout:30000});
        await page.setViewportSize({width:800,height:950});await page.waitForTimeout(300);
        const size=await page.locator('.knowledge-hub').evaluate(e=>({w:e.clientWidth,scroll:e.scrollWidth}));assert(size.scroll<=size.w+1);
        await single();
        console.log('PASS: disabling restores native navigation, re-enabling restores one sidebar, narrow layout');
    }finally{
        await fetch('http://127.0.0.1:37841/etapi/notes/KbNavData001/content',{method:'PUT',headers:{Authorization:token,'Content-Type':'text/plain'},body:originalConfig});
        await browser.close();
    }
})().catch(error=>{console.error(error);process.exit(1);});
