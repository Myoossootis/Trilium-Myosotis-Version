// Geometry checks in the actual isolated Trilium renderer; no model calls.
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
    const browser=await chromium.connectOverCDP('http://127.0.0.1:37842');
    const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('trilium-app:'));
    const output='E:/EricDictionary/tmp/knowledge-ui-fixes/';
    async function cards(selector){
        const overlaps=await page.locator(selector).evaluateAll(nodes=>{
            const rows=nodes.filter(e=>e.getBoundingClientRect().height).map(e=>({text:e.textContent.slice(0,30),r:e.getBoundingClientRect()})),errors=[];
            for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
                const a=rows[i].r,b=rows[j].r;
                if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)errors.push([rows[i].text,rows[j].text]);
            }
            return errors;
        });assert.deepEqual(overlaps,[],selector+' overlaps');
    }
    async function width(selector){assert(await page.locator(selector).evaluate(e=>e.scrollWidth<=e.clientWidth+1),selector+' overflows horizontally');}
    const sizes=[{width:1440,height:1000},{width:1024,height:768},{width:800,height:600},{width:600,height:650}];
    const dark=await page.evaluate(()=>document.body.classList.contains('dark-theme'));
    try{
        await page.reload();await page.locator('#kb-workspace-tools').waitFor();
        for(let theme=0;theme<2;theme++){
            for(const size of sizes){
                await page.setViewportSize(size);
                await page.locator('#kb-workspace-navigation [data-view="home"]').click();await page.locator('.hp-grid>.hp-card').first().waitFor();await cards('.hp-grid>.hp-card');await width('.eric-home-dashboard');
                await page.locator('#kb-workspace-navigation [data-view="knowledge"]').click();await page.locator('.library-browser').waitFor();
                await width('.knowledge-hub');await page.getByRole('button',{name:'专题导航',exact:true}).click();await cards('.hl-topic');
                await page.locator('.kw-tools summary').click();await page.locator('.kw-tools button').filter({hasText:'知识库提问'}).click();await page.locator('.kh-source-picker').waitFor();await width('.knowledge-hub');await cards('.kh-workarea>div,.kh-workarea>aside');
                await page.locator('.kh-back').click();await page.locator('.kw-library-label select').selectOption('e3e7d52e13a9');await page.getByRole('button',{name:'专题导航',exact:true}).click();await page.locator('.hardware-library').waitFor();
                await width('.hardware-library');await cards('.hl-topic');await cards('.hl-toolbar,.hl-filters,.hl-layout');
                assert.equal(await page.locator('.hl-hero:visible').count(),0,'duplicate hero removed');
                if(size.width===600)await page.screenshot({path:output+`narrow-theme-${theme}.png`});
                console.log(`PASS: ${size.width}x${size.height}, ${theme?'other':'initial'} theme: workbench, hub, source panel, hardware cards`);
            }
            await page.locator('#kb-workspace-tools [data-action="theme"]').click();await page.waitForFunction(d=>document.body.classList.contains('dark-theme')!==d,theme? !dark:dark);
        }
        await page.setViewportSize({width:1440,height:1000});
        const search=page.locator('#left-pane .quick-search input');await search.fill('电路');await search.press('Enter');
        await page.locator('.quick-search-item').first().waitFor({timeout:15000});
        await cards('.quick-search-item');
        assert(await page.locator('#left-pane .quick-search .dropdown-menu').evaluate(e=>{const r=e.getBoundingClientRect();return !!document.elementFromPoint(r.right-10,r.top+20)?.closest('.quick-search');}),'native search popup is covered by the note pane');
        await search.fill('');await page.keyboard.press('Escape');
        await page.locator('#kb-workspace-navigation [data-view="knowledge"]').click();await page.locator('.library-browser').waitFor();await page.screenshot({path:output+'knowledge-final.png'});
        await page.locator('#kb-workspace-navigation [data-action="tools"]').click();await page.screenshot({path:output+'custom-tools-final.png'});
        console.log('PASS: native search results do not overlap; search and custom-tool popups stay above content');
    }finally{
        if(await page.evaluate(()=>document.body.classList.contains('dark-theme'))!==dark)await page.locator('#kb-workspace-tools [data-action="theme"]').click();
        await browser.close();
    }
})().catch(error=>{console.error(error);process.exit(1);});
