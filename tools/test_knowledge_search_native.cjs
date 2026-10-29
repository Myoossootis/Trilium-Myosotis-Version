// Regress the layered native search surfaces in the isolated Trilium app.
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
    const browser=await chromium.connectOverCDP('http://127.0.0.1:37842');
    const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('trilium-app:'));
    const search=page.locator('#left-pane>.quick-search'),input=search.locator('input'),button=search.locator('.search-button');
    const dark=await page.evaluate(()=>document.body.classList.contains('dark-theme'));
    async function check(label){
        const state=await search.evaluate(e=>{
            const s=getComputedStyle(e),surface=getComputedStyle(e,'::before'),i=e.querySelector('input'),b=e.querySelector('.search-button'),g=b.parentElement;
            const r=e.getBoundingClientRect(),ir=i.getBoundingClientRect(),br=b.getBoundingClientRect(),gr=g.getBoundingClientRect();
            const inner=[i,b,g].map(n=>{const s=getComputedStyle(n);return {background:s.backgroundColor,border:parseFloat(s.borderTopWidth),shadow:s.boxShadow,margin:s.margin}});
            return {rootBorder:parseFloat(s.borderTopWidth),rootShadow:s.boxShadow,surfaceBorder:parseFloat(surface.borderTopWidth),surfaceColor:surface.borderTopColor,surfaceShadow:surface.boxShadow,inner,left:ir.left-r.left,right:r.right-br.right,gap:br.left-ir.right,buttonGap:gr.width-br.width,height:r.height};
        });
        assert.equal(state.rootBorder,0,label);assert.equal(state.rootShadow,'none',label);assert(state.surfaceBorder>0,label);assert.equal(state.surfaceShadow,'none',label);
        for(const inner of state.inner){assert.equal(inner.background,'rgba(0, 0, 0, 0)',label+' extra surface');assert.equal(inner.border,0,label);assert.equal(inner.shadow,'none',label);assert.equal(inner.margin,'0px',label);}
        for(const key of ['gap','buttonGap'])assert(Math.abs(state[key])<1,label+' leftover button spacing');
        assert(Math.abs(state.left-12)<1 && Math.abs(state.right-12)<1,label+' bounds');
        return state;
    }
    try{
        await page.reload();await page.locator('#kb-workspace-tools').waitFor();
        for(let theme=0;theme<2;theme++){
            for(const size of [{width:1280,height:900},{width:800,height:650},{width:600,height:650}]){
                await page.setViewportSize(size);await page.locator('#kb-workspace-navigation .kw-label').click();
                const idle=await check('idle');await input.focus();const focused=await check('input focus');assert.notEqual(idle.surfaceColor,focused.surfaceColor);assert.equal(idle.height,focused.height);
                await button.hover();await check('button hover');await button.focus();await check('button focus');
                console.log(`PASS: ${size.width}px, ${theme?'other':'initial'} theme, single surface in idle/focus/hover states`);
            }
            await page.locator('#kb-workspace-tools [data-action="theme"]').click();await page.waitForFunction(d=>document.body.classList.contains('dark-theme')!==d,theme? !dark:dark);
        }
        await page.setViewportSize({width:1280,height:900});await input.fill('电路');await input.press('Enter');await search.locator('.quick-search-item').first().waitFor({timeout:15000});await check('search results open');
        assert(await search.locator('.dropdown-menu').evaluate(e=>{const r=e.getBoundingClientRect();return !!document.elementFromPoint(r.right-8,r.top+20)?.closest('.quick-search');}));
        await input.press('Escape');await input.fill('');await page.locator('#kb-workspace-navigation .kw-label').click();
        await page.screenshot({path:'E:/EricDictionary/tmp/knowledge-ui-fixes/search-fixed-final.png'});
        console.log('PASS: Enter still searches; native results popup remains usable');
    }finally{
        if(await page.evaluate(()=>document.body.classList.contains('dark-theme'))!==dark)await page.locator('#kb-workspace-tools [data-action="theme"]').click();
        await browser.close();
    }
})().catch(error=>{console.error(error);process.exit(1);});
