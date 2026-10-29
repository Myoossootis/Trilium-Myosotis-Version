// Integration check against an isolated Trilium desktop copy, never the main window.
const assert=require('node:assert/strict');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
    const targets=await(await fetch('http://127.0.0.1:37842/json/list')).json();
    const ws=new WebSocket(targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:')).webSocketDebuggerUrl);
    await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
    const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
    const ev=async expression=>{const m=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.result?.exceptionDetails)throw Error(m.result.exceptionDetails.exception?.description);return m.result?.result?.value;};
    async function until(expression){for(let i=0;i<60;i++){if(await ev(expression))return;await pause(250);}throw Error('Timed out: '+expression);}
    try {
        await until('!!document.querySelector("#launcher-pane .myo-day-night-icon") && !!window.MyoPomodoro && !!window.MyoCalendarViewOnly');
        await ev('(async()=>{window.recoveryContext=(await import("trilium-app://app/src/content_renderer-BMc4Ylfn.js")).K;})()');
        for(const [note,selector] of [['HmeDashboard','.eric-home-dashboard'],['MyoQuestBoard','.myo-quests'],['0e50f559e1a3','.myo-market'],['MyoPomoBoard','.myo-pomodoro']]) {
            await ev(`window.recoveryContext.tabManager.openInSameTab(${JSON.stringify(note)},'root')`);
            await until(`window.recoveryContext.tabManager.getActiveContext().noteId===${JSON.stringify(note)} && !!document.querySelector(${JSON.stringify(selector)})`);
            assert.equal(await ev('document.querySelector(".alert-danger")?.textContent || ""'),'');
            assert.equal(await ev('window.recoveryContext.tabManager.getActiveContext().hoistedNoteId'),'root');
            console.log('PASS rendered:',note);
        }
        assert.ok(await ev('[...document.querySelectorAll(".fancytree-node.myo-system-components")].every(e=>getComputedStyle(e.closest("li")).display==="none")'));
        const before=await ev('window.glob.theme');
        await ev('document.querySelector(".launcher-button.myo-day-night-icon").click()');
        await until(`window.glob.theme!==${JSON.stringify(before)} && !document.querySelector('.launcher-button.myo-day-night-icon').disabled`);
        await ev('document.querySelector(".launcher-button.myo-day-night-icon").click()');await until(`window.glob.theme===${JSON.stringify(before)} && !document.querySelector('.launcher-button.myo-day-night-icon').disabled`);
        console.log('PASS native theme toggle and tree-only hiding');
        await ev('document.querySelector("#launcher-pane .bx-file-blank").closest(".launcher-button").click()');
        await until('window.recoveryContext.tabManager.getActiveContext().note?.title==="新建笔记"');
        assert.deepEqual(await ev('window.recoveryContext.tabManager.getActiveContext().note.getParentNoteIds()'),['root']);
        console.log('PASS native New Note launcher creates under root');
    } finally {ws.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
