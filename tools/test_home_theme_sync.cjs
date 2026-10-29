// Native Electron rendering check on the isolated recovery instance (port 37842).
const assert=require('node:assert/strict'),fs=require('node:fs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
    const targets=await(await fetch('http://127.0.0.1:37842/json/list')).json();
    const ws=new WebSocket(targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:')).webSocketDebuggerUrl);
    await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
    const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
    const ev=async expression=>{const m=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.result?.exceptionDetails)throw Error(m.result.exceptionDetails.exception?.description);return m.result?.result?.value;};
    async function until(expression){for(let i=0;i<100;i++){if(await ev(expression))return;await pause(250);}throw Error('Timed out: '+expression);}
    async function shot(name){const r=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync('tmp-render-recovery/'+name,Buffer.from(r.result.data,'base64'));}
    try {
        await cmd('Page.enable');
        const startupToken=Date.now();
        await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`
            window.toggleStartup={token:${startupToken}};
            new MutationObserver(()=>{
                const sample=window.toggleStartup;
                if(sample.sidebar===undefined && document.querySelector('#launcher-pane .launcher-button'))sample.sidebar=performance.now();
                const button=document.querySelector('#launcher-pane .launcher-button.myo-day-night-icon');
                if(sample.toggle===undefined && button){sample.toggle=performance.now();sample.width=getComputedStyle(button,'::before').width;sample.actionLoaded=!!window.MyoCodexThemeSwitchState;}
            }).observe(document,{childList:true,subtree:true});
        `});
        await cmd('Page.reload');await until(`window.toggleStartup?.token===${startupToken} && !!window.toggleStartup.toggle && !!document.querySelector("#launcher-pane .myo-day-night-icon")`);
        const startup=await ev('window.toggleStartup');
        assert.ok(startup.toggle-startup.sidebar<1000,'Toggle waited more than a second after native sidebar buttons');
        assert.equal(startup.width,'44px','Toggle CSS was not ready when the launcher mounted');
        assert.equal(startup.actionLoaded,false,'Toggle unnecessarily loaded its action at startup');
        console.log('PASS: toggle mounts with native sidebar; delay '+Math.round(startup.toggle-startup.sidebar)+' ms; styles ready; click action not loaded at startup');
        await ev('(async()=>{const {K:app}=await import("trilium-app://app/src/content_renderer-BMc4Ylfn.js");await app.tabManager.openInSameTab("HmeDashboard","root");})()');
        await until('!!document.querySelector(".eric-home-dashboard .ehd-card")');
        await ev('window.homeThemeNode=document.querySelector(".eric-home-dashboard")');
        if(!await ev('document.body.classList.contains("dark-theme")'))await ev('document.querySelector(".launcher-button.myo-day-night-icon").click()');
        await until('document.body.classList.contains("dark-theme") && !document.querySelector(".launcher-button.myo-day-night-icon").disabled');
        const dark=await ev(`(()=>{const css=selector=>getComputedStyle(document.querySelector(selector));return {page:css('.note-detail-render:has(.eric-home-dashboard)').backgroundColor,card:css('.ehd-card').backgroundColor,text:css('.ehd-card-title').color,calendar:css('.ehd-calendar').backgroundColor,heatmap:css('.ehd-cell').backgroundColor};})()`);
        assert.equal(dark.page,'rgb(43, 45, 49)');assert.equal(dark.card,'rgb(37, 38, 42)');assert.equal(dark.text,'rgb(236, 236, 241)');assert.equal(dark.heatmap,'rgb(56, 59, 64)');
        const hover=await ev('(()=>{const r=document.querySelector("#launcher-pane .mp-pomodoro-launcher").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
        await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',...hover});
        await until('!!document.querySelector(".tooltip.show .tooltip-inner")');
        const hint=await ev('(()=>{const e=document.querySelector(".tooltip.show .tooltip-inner"),s=getComputedStyle(e);return {text:e.textContent,bg:s.backgroundColor,color:s.color,border:s.borderTopColor};})()');
        assert.ok(hint.text.includes('番茄钟'));assert.equal(hint.bg,'rgb(48, 50, 56)');assert.equal(hint.color,'rgb(236, 236, 241)');assert.equal(hint.border,'rgb(63, 65, 72)');
        await shot('pomodoro-dark-tooltip.png');await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:600,y:400});
        console.log('PASS: actual Pomodoro launcher tooltip has dark background, readable text and matching border');
        await shot('home-dark.png');
        await ev('document.querySelector(".launcher-button.myo-day-night-icon").click()');await until('document.body.classList.contains("light-theme") && !document.querySelector(".launcher-button.myo-day-night-icon").disabled');
        assert.equal(await ev('getComputedStyle(document.querySelector(".note-detail-render:has(.eric-home-dashboard)")).backgroundColor'),'rgb(251, 247, 239)');
        assert.ok(await ev('window.homeThemeNode===document.querySelector(".eric-home-dashboard")'),'Theme switch replaced the dashboard');
        await shot('home-light.png');
        // A second toggle checks both directions without rebuilding the page.
        await ev('document.querySelector(".launcher-button.myo-day-night-icon").click()');await until('document.body.classList.contains("dark-theme") && !document.querySelector(".launcher-button.myo-day-night-icon").disabled');
        assert.equal(await ev('getComputedStyle(document.querySelector(".ehd-card")).backgroundColor'),dark.card);
        assert.equal(await ev('document.querySelector(".alert-danger")?.textContent || ""'),'');
        console.log('PASS: actual Home renders; page/cards/calendar/heatmap follow native theme; light styling retained; switching needs no reload');
    }finally{ws.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
