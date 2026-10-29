// Real Chromium input (pointer capture and synthesized clicks), without a CDN.
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const pomodoro=process.argv.includes('--pomodoro');
const chapter=process.argv.includes('--chapter');
const chapterRegression=process.argv.includes('--chapter-regression');
const chapterBaseline=process.argv.find(arg=>arg.startsWith('--chapter-baseline='));
const findNavigation=process.argv.includes('--find-navigation');
const marketplace=process.argv.includes('--marketplace');
const codexDark=process.argv.includes('--codex-dark');
const chromiumRoot = path.join(process.env.USERPROFILE,'AppData/Local/ms-playwright');
const chromium = fs.readdirSync(chromiumRoot).filter(name=>name.startsWith('chromium-')).map(name=>path.join(chromiumRoot,name,'chrome-win/chrome.exe')).find(name=>fs.existsSync(name));
if (!chromium) throw new Error('Local Chromium not found');
const profile = fs.mkdtempSync(path.join(root,'tmp-commission-ui/drag-browser-'));
const chrome = spawn(chromium,['--headless','--disable-gpu','--no-sandbox','--allow-file-access-from-files','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1280,1800','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
const pause = ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket, themeServer;
async function main() {
    const endpoint = await new Promise((resolve,reject)=>{
        let stderr='';const timeout=setTimeout(()=>reject(new Error('Chromium startup timed out')),15000);
        chrome.stderr.on('data',chunk=>{stderr+=chunk;const m=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});
        chrome.on('error',reject);
    });
    const port = new URL(endpoint).port;
    let targets=[];
    for(let i=0;i<50;i++){targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();if(targets.some(target=>target.type==='page'))break;await pause(100);}
    socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    let serial=0;const pending=new Map();
    socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id && pending.has(message.id)){const {resolve,reject}=pending.get(message.id);pending.delete(message.id);message.error?reject(new Error(JSON.stringify(message.error))):resolve(message.result);}};
    const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
    if(chapterBaseline){
        const database=chapterBaseline.slice('--chapter-baseline='.length);
        const previous=require('node:child_process').execFileSync('python',['-c',"import sqlite3,sys;from pathlib import Path;c=sqlite3.connect(Path(sys.argv[1]).resolve().as_uri()+'?mode=ro',uri=True);s=c.execute(\"select b.content from notes n join blobs b on n.blobId=b.blobId where n.noteId='MyoChapRail'\").fetchone()[0];sys.stdout.buffer.write(s.encode('utf-8'));c.close()",database]);
        socket.addEventListener('message',async event=>{
            const message=JSON.parse(event.data);
            if(message.method==='Fetch.requestPaused')await command('Fetch.fulfillRequest',{requestId:message.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/javascript'}],body:previous.toString('base64')});
        });
        await command('Fetch.enable',{patterns:[{urlPattern:'*chapter-preview-rail.js',requestStage:'Request'}]});
    }
    const evaluate=async expression=>{const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text+' '+JSON.stringify(result.exceptionDetails.exception));return result.result.value;};
    await command('Page.enable');
    if(chapter||chapterRegression)await command('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
    if(codexDark)themeServer=await require('./test_codex_theme_server.cjs')(root);
    await command('Page.navigate',{url:codexDark?`http://127.0.0.1:${themeServer.address().port}/tools/codex-dark-preview.html`:pathToFileURL(path.join(root,chapterRegression?'tools/chapter-rail-regression.html':marketplace?'tools/plugin-market-preview.html':findNavigation?'tools/find-navigation-preview.html':chapter?'tools/chapter-rail-preview.html':pomodoro?'tools/pomodoro-preview.html':'tools/commission-preview.html')).href});
    const deadline=Date.now()+30000;
    let status='';while(Date.now()<deadline){status=await evaluate("document.querySelector('#result')?.textContent || ''");if(/PASS|FAIL/.test(status))break;await pause(200);}
    if(chapterBaseline){assert.ok(status.startsWith('FAIL: 章节 3: 0 应为'),'Old script did not reproduce zero-position jump: '+status);console.log('PASS: original installed script reproduces the reported bug - '+status);return;}
    if (!status.startsWith('PASS')) console.error(await evaluate("JSON.stringify({error:document.querySelector('[role=alert]')?.textContent,invalid:[...document.querySelectorAll('form input,form select')].filter(e=>!e.validity.valid).map(e=>({label:e.getAttribute('aria-label'),value:e.value,message:e.validationMessage})),effects:document.querySelector('.mq-effects')?.textContent})"));
    assert.ok(status.startsWith('PASS'),status);
    if(codexDark){
        await command('Emulation.setDeviceMetricsOverride',{width:1400,height:950,deviceScaleFactor:1,mobile:false});await pause(100);
        const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,'tmp-commission-ui/codex-dark-preview.png'),Buffer.from(shot.data,'base64'));
        await command('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:false});await pause(100);assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'Dark preview overflows');
        console.log(status);return;
    }
    if(marketplace){
        await command('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});await pause(100);
        const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,'tmp-commission-ui/plugin-market-preview.png'),Buffer.from(shot.data,'base64'));
        await command('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:false});await pause(100);assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'Market narrow layout overflows');
        console.log(status);return;
    }
    if(findNavigation){console.log(status);return;}
    if(chapter||chapterRegression){
        const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,'tmp-commission-ui/chapter-right-preview.png'),Buffer.from(shot.data,'base64'));
        console.log(status);return;
    }
    if(pomodoro){
        await command('Emulation.setDeviceMetricsOverride',{width:900,height:1100,deviceScaleFactor:1,mobile:false});
        await pause(100);
        const handle=await evaluate("(()=>{const r=document.querySelector('.mp-mini-open').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
        const beforeOpen=await evaluate('window.pomoOpened');
        await command('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:0,...handle});
        await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...handle});
        await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:handle.x-30,y:handle.y-30});
        await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:230,y:240});
        await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:230,y:240});
        await pause(100);
        assert.equal(await evaluate('window.pomoOpened'),beforeOpen,'Dragging opened the main page');
        assert.ok(await evaluate("(()=>{const r=document.querySelector('#myo-pomodoro-mini').getBoundingClientRect();const saved=JSON.parse(localStorage.getItem('myosotis.pomodoro.v1')).miniPosition;return r.top<300 && saved && Math.abs(saved.x-r.left)<1 && Math.abs(saved.y-r.top)<1;})()"),'Dragged position not saved');
        await command('Emulation.setDeviceMetricsOverride',{width:375,height:1000,deviceScaleFactor:1,mobile:false});
        await pause(100);
        assert.ok(await evaluate("(()=>{const r=document.querySelector('#myo-pomodoro-mini').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;})()"),'Mini outside resized viewport');
        assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),'Pomodoro narrow layout overflows');
        await command('Emulation.setDeviceMetricsOverride',{width:900,height:1100,deviceScaleFactor:1,mobile:false});
        await evaluate('window.scrollTo(0,0)');
        const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,'tmp-commission-ui/pomodoro-preview.png'),Buffer.from(shot.data,'base64'));
        await evaluate('document.querySelector(".mp-dashboard").scrollIntoView()');await pause(100);const stats=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,'tmp-commission-ui/pomodoro-statistics-preview.png'),Buffer.from(stats.data,'base64'));
        console.log(status);return;
    }
    const navigation=await evaluate("[...document.querySelectorAll('.mq-windows button')].map(e=>e.textContent)");
    assert.equal(navigation.length,3);
    assert.equal(await evaluate("document.querySelectorAll('.mq-stats strong').length"),3);
    await command('Emulation.setDeviceMetricsOverride',{width:600,height:1300,deviceScaleFactor:1,mobile:false});
    assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),'narrow layout overflows');
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:1400,deviceScaleFactor:1,mobile:false});
    await evaluate("document.querySelector('.mq-quest-toolbar .mq-primary').click()");await pause(100);
    await evaluate('window.scrollTo(0,0)');
    const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,'tmp-commission-ui/commission-only-preview.png'),Buffer.from(shot.data,'base64'));
    console.log('PASS: same-tab navigation, generic shop and warehouse, cycles, levels and narrow layout');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{themeServer?.close();socket?.close();chrome.kill();});
