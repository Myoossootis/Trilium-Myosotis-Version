const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{createHarness}=require('./test_hardware_quiz.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/quiz'),harness=createHarness();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await require('../tmp-commission-ui/node_modules/esbuild').build({stdin:{contents:"import {render} from 'preact'; import Quiz from './customizations/frontend/hardware-quiz.jsx'; render(<Quiz/>,document.getElementById('app'));",resolveDir:root,loader:'jsx'},bundle:true,outfile:path.join(out,'browser.js'),jsx:'automatic',jsxImportSource:'preact',nodePaths:[path.join(root,'tmp-commission-ui/node_modules')],plugins:[{name:'hooks',setup(b){b.onResolve({filter:/^trilium:preact$/},()=>({path:'hooks',namespace:'trilium'}));b.onLoad({filter:/.*/,namespace:'trilium'},()=>({contents:"export {useState,useEffect,useRef} from 'preact/hooks';",resolveDir:path.join(root,'tmp-commission-ui')}));}}]});
 const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f8f9fa;--main-background-color:#fff;--main-text-color:#303238;--main-border-color:#dedfe3;--accented-background-color:#f6f6f8} body.dark{background:#202126;--main-background-color:#27282e;--main-text-color:#e6e7eb;--main-border-color:#414249;--accented-background-color:#303138}${fs.readFileSync(path.join(root,'customizations/frontend/hardware-quiz.css'),'utf8')}</style><div id="app"></div><script>window.api={getNote:async()=>({getContent:async()=>''}),runOnBackend:async(_,args)=>{const r=await fetch('/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});const j=await r.json();if(j.error)throw Error(j.error);return j;},activateNote:async id=>{window.openedSource=id}};</script><script src="/browser.js"></script>`;
 const server=http.createServer((req,res)=>{if(req.url==='/run'){let text='';req.on('data',d=>text+=d);req.on('end',()=>{res.setHeader('content-type','application/json');try{res.end(JSON.stringify(harness.run(...JSON.parse(text))));}catch(e){res.end(JSON.stringify({error:e.message}));}});return;}if(req.url==='/browser.js'){res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(path.join(out,'browser.js')));return;}if(req.url.startsWith('/api/images/')){const id=decodeURIComponent(req.url.split('/')[3]);const p=path.join(root,'customizations/data/hardware-quiz/images',id);if(fs.existsSync(p)){res.setHeader('content-type','image/png');res.end(fs.readFileSync(p));}else{res.statusCode=404;res.end();}return;}res.setHeader('content-type','text/html; charset=utf-8');res.end(html);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=path.join(process.env.USERPROFILE,'AppData/Local/ms-playwright');const exe=fs.readdirSync(base).filter(n=>n.startsWith('chromium-')).map(n=>path.join(base,n,'chrome-win/chrome.exe')).find(fs.existsSync);assert.ok(exe);
 const chrome=spawn(exe,['--headless','--disable-gpu','--no-sandbox','--remote-debugging-port=0','--user-data-dir='+fs.mkdtempSync(path.join(out,'browser-profile-')),'--window-size=1440,1000','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});let ws;
 try{
  const endpoint=await new Promise((resolve,reject)=>{let s='';const timer=setTimeout(()=>reject(Error('browser timeout')),15000);chrome.stderr.on('data',d=>{s+=d;const m=s.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
  const targets=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
  const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
  const ev=async expression=>{const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await ev(expression))return;await pause(100);}throw Error('timeout '+expression);};
  await cmd('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await until('!!document.querySelector(".hq-option")');
  assert.equal(await ev('document.querySelector(".hq-feedback")'),null);assert.ok(!await ev('document.querySelector(".hq-stem").textContent.includes("（A）")'));
  await ev('document.querySelectorAll(".hq-option")[1].click()');await until('!document.querySelector(".hq-submit button").disabled');await ev('document.querySelector(".hq-submit button").click()');await until('document.querySelector(".hq-feedback")?.textContent.includes("已加入错题本")');
  await ev('document.querySelector(".hq-question-top button").click()');await until('document.querySelector(".hq-question-top button").textContent.includes("已收藏")');
  for(const tab of [3,0,2,0]){
   await ev('document.querySelectorAll(".hq-tabs button")['+tab+'].click()');
   await until('document.querySelectorAll(".hq-tabs button")['+tab+'].classList.contains("active") && !document.querySelectorAll(".hq-tabs button")['+tab+'].disabled');
   assert.equal(await ev('document.querySelectorAll(".hq-tabs .active").length'),1,'exactly one navigation item should be active');
   if(tab===0)assert.equal(await ev('document.querySelector("select[aria-label=练习模式]").value'),'sequential','practice tab leaves favorites/wrong mode');
  }
  await cmd('Page.reload');await until('document.querySelector(".hq-feedback")?.textContent.includes("已加入错题本")');
  const shot=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'quiz-desktop.png'),Buffer.from(shot.data,'base64'));
  await ev('document.querySelectorAll(".hq-tabs button")[1].click()');await until('document.querySelectorAll(".hq-bank").length===28');
  await ev('document.querySelectorAll(".hq-bank")[20].click()');await until('!!document.querySelector(".hq-self-input")');await until('[...document.querySelectorAll(".hq-figure")].every(i=>i.complete && i.naturalWidth>0)');
  await ev('document.querySelector(".hq-self-input textarea").value="测试思路";document.querySelector(".hq-self-input textarea").dispatchEvent(new Event("input",{bubbles:true}));document.querySelector(".hq-submit button").click()');await until('document.querySelector(".hq-feedback")?.textContent.includes("暂无参考答案")');
  await ev('[...document.querySelectorAll(".hq-feedback button")].find(b=>b.textContent==="加入错题本").click()');await until('document.querySelector(".hq-feedback")?.textContent.includes("自评：待巩固")');
  await ev('[...document.querySelectorAll(".hq-header button")].find(b=>b.textContent==="导入题库").click()');await until('!!document.querySelector(".hq-import")');
  await ev('[...document.querySelectorAll(".hq-import button")].find(b=>b.textContent==="填入示例").click()');
  await until('document.querySelector(".hq-import textarea").value.includes("我的题库")');
  await ev('[...document.querySelectorAll(".hq-import button")].find(b=>b.textContent==="导入并开始刷题").click()');
  await until('document.querySelector(".hq-stem")?.textContent.includes("1 + 1")');
  assert.equal(await ev('document.querySelectorAll(".hq-tabs .active").length'),1);assert.equal(await ev('document.querySelector(".hq-source a")'),null,'JSON bank must not show a broken PDF link');
  await ev('document.querySelectorAll(".hq-option")[1].click()');await until('!document.querySelector(".hq-submit button").disabled');await ev('document.querySelector(".hq-submit button").click()');await until('document.querySelector(".hq-feedback")?.textContent.includes("回答正确")');
  await cmd('Page.reload');await until('document.querySelector(".hq-feedback")?.textContent.includes("回答正确")');
  await ev('document.querySelectorAll(".hq-tabs button")[1].click()');await until('document.querySelectorAll(".hq-bank").length===29');
  await ev('document.querySelectorAll(".hq-bank")[28].click()');await until('document.querySelector(".hq-map button") && !document.querySelector(".hq-map button").disabled');
  await ev('document.querySelectorAll(".hq-map button")[3].click()');await until('document.querySelector(".hq-self-input")');
  await ev('document.querySelector(".hq-submit button").click()');await until('document.querySelector(".hq-feedback")?.textContent.includes("暂无参考答案")');await ev('document.querySelector(".hq-feedback button").click()');await until('document.querySelector(".hq-feedback")?.textContent.includes("自评：已掌握")');
  await ev('document.body.classList.add("dark")');await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});await pause(200);
  assert.ok(await ev('document.documentElement.scrollWidth<=window.innerWidth'),'mobile overflow');const shot2=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'quiz-mobile.png'),Buffer.from(shot2.data,'base64'));
  console.log('PASS browser: answers hidden, wrong-book, favorites, resumed progress, 28 banks, original image self-grade, dark/mobile layout');
  console.log('PASS browser regression: exclusive tabs, practice returns from favorites/wrong, generic bank import/resume, 29 banks and text self-grade');
 }finally{ws?.close();chrome.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
