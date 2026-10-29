// Real Trilium desktop integration against the isolated copy on port 37842.
const assert=require('node:assert/strict'),fs=require('node:fs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
    const targets=await(await fetch('http://127.0.0.1:37842/json/list')).json();
    const ws=new WebSocket(targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:')).webSocketDebuggerUrl);
    await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
    const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
    const ev=async expression=>{const m=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.result?.exceptionDetails)throw Error(m.result.exceptionDetails.exception?.description);return m.result?.result?.value;};
    async function until(expression){for(let i=0;i<100;i++){if(await ev(expression))return;await pause(250);}throw Error('Timed out: '+expression+'; '+await ev('document.querySelector("[role=alert]")?.textContent'));}
    const click=expression=>ev(`${expression}.click()`);
    async function shot(name){const r=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync('tmp-render-recovery/'+name,Buffer.from(r.result.data,'base64'));}
    async function home(){await ev('window.libraryApp.tabManager.openInSameTab("e3e7d52e13a9","root")');await until('!!document.querySelector(".hl-toolbar nav button")');await click('document.querySelector(".hl-toolbar nav button:first-child")');await until('document.querySelectorAll(".hl-topic").length===13');}
    try {
        await cmd('Page.enable');await cmd('Emulation.setFocusEmulationEnabled',{enabled:true});const loadToken=Date.now();
        await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.libraryTestLoad=${loadToken}`});
        await cmd('Page.reload');
        await until(`window.libraryTestLoad===${loadToken} && !!window.MyoPomodoro && !!document.querySelector("#launcher-pane .myo-day-night-icon")`);
        await ev('(async()=>{window.libraryApp=(await import("trilium-app://app/src/content_renderer-BMc4Ylfn.js")).K;})()');
        await home();
        assert.equal(await ev('document.querySelector(".hl-error")?.textContent || ""'),'');
        await click('document.querySelector(".hl-topic-title")');
        await until('document.querySelectorAll(".hl-row").length===3');
        assert.ok(await ev('document.querySelector(".hl-breadcrumb").textContent.includes("模拟电路")'));
        await click('document.querySelector(".hl-row-link")');await until('document.querySelectorAll(".hl-row").length===13');
        await ev('document.querySelector(".hl-row-link").focus()');
        assert.ok(await ev('document.activeElement.classList.contains("hl-row-link")'),'Preview update lost keyboard focus');
        await until('document.querySelector(".hl-preview h3")?.textContent.includes("电阻")');
        await click('document.querySelector(".hl-row .hl-star")');
        await click('document.querySelector(".hl-toolbar nav button:last-child")');
        await until('document.querySelector(".hl-row-link")?.textContent.includes("电阻")');
        await click('document.querySelector(".hl-row .hl-star")');
        await until('!document.querySelector(".hl-row")');
        await click('document.querySelector(".hl-toolbar nav button:first-child")');
        await ev('(()=>{const e=document.querySelector(".hl-search input");e.value="PN";e.dispatchEvent(new Event("input",{bubbles:true}));})()');
        await until('document.querySelector(".hl-section-heading h2")?.textContent==="搜索结果"');
        assert.ok(await ev('document.querySelectorAll(".hl-row").length>0'),'Body excerpt search failed');
        await click('document.querySelector(".hl-row-link")');
        await until('window.libraryApp.tabManager.getActiveContext().noteId!=="e3e7d52e13a9"');
        await home();
        assert.ok(await ev('document.querySelector(".hl-resume-label").textContent.includes("继续上次阅读")'));
        await click('document.querySelector(".hl-filters button:last-child")');
        await until('document.querySelectorAll(".hl-topic").length===1');
        await click('document.querySelector(".hl-filters button:first-child")');
        await until('document.querySelectorAll(".hl-topic").length===13');
        if(await ev('document.body.classList.contains("dark-theme")')){
            await click('document.querySelector(".myo-day-night-icon")');await until('document.body.classList.contains("light-theme")');
        }
        await cmd('Emulation.setDeviceMetricsOverride',{width:1600,height:1050,deviceScaleFactor:1,mobile:false});
        await pause(400);await shot('hardware-library-light.png');
        const light=await ev('getComputedStyle(document.querySelector(".hardware-library")).backgroundColor');
        assert.equal(light,'rgb(246, 248, 247)');
        await click('document.querySelector(".myo-day-night-icon")');await until('document.body.classList.contains("dark-theme")');
        assert.equal(await ev('getComputedStyle(document.querySelector(".hardware-library")).backgroundColor'),'rgb(37, 38, 42)');
        await pause(400);await shot('hardware-library-dark.png');
        await cmd('Emulation.setDeviceMetricsOverride',{width:640,height:950,deviceScaleFactor:1,mobile:false});
        await pause(200);
        assert.ok(await ev('(()=>{const e=document.querySelector(".hardware-library");return e.scrollWidth<=e.clientWidth+1;})()'),'Library overflows narrow content area');
        await shot('hardware-library-narrow.png');
        await cmd('Emulation.clearDeviceMetricsOverride');
        console.log('PASS: real library data, chapters, keyboard preview, favorites, body search, same-tab opening, resume, filters, both themes and narrow layout');
    }finally{ws.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
