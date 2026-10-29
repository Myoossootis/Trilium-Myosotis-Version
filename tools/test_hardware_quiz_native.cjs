const assert=require('node:assert/strict'),fs=require('node:fs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const targets=await(await fetch('http://127.0.0.1:37842/json/list')).json();
 const page=targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:'));assert.ok(page);
 const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
 const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const m=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.exceptionDetails)throw Error(m.exceptionDetails.exception?.description || m.exceptionDetails.text);return m.result.value;};
 const until=async expression=>{for(let i=0;i<120;i++){if(await ev(expression))return;await pause(200);}throw Error('timeout '+expression+' '+await ev('document.querySelector(".alert-danger")?.textContent || document.querySelector(".hq-error")?.textContent || ""'));};
 try{
  await cmd('Page.reload');await until('!!document.querySelector("#launcher-pane .bx-book-open")');
  await ev('(async()=>{window.quizContext=(await import("trilium-app://app/src/content_renderer-BMc4Ylfn.js")).K;})()');
  await ev('window.quizContext.tabManager.openInSameTab("HwQuizBoard01","root")');await until('!!document.querySelector(".hq-option")');
  assert.equal(await ev('document.querySelector(".hq-header h1").textContent'),'通用刷题');
  assert.equal(await ev('document.querySelector(".hq-error")?.textContent || ""'),'');assert.equal(await ev('document.querySelector(".hq-feedback")'),null);
  await ev('document.querySelectorAll(".hq-option")[1].click()');await until('!document.querySelector(".hq-submit button").disabled');await ev('document.querySelector(".hq-submit button").click()');await until('document.querySelector(".hq-feedback")?.textContent.includes("已加入错题本")');
  await ev('document.querySelector(".hq-question-top button").click()');await until('document.querySelector(".hq-question-top button").textContent.includes("已收藏")');
  for(const tab of [3,0,2,0]){
   await ev('document.querySelectorAll(".hq-tabs button")['+tab+'].click()');await until('document.querySelectorAll(".hq-tabs button")['+tab+'].classList.contains("active") && !document.querySelectorAll(".hq-tabs button")['+tab+'].disabled');
   assert.equal(await ev('document.querySelectorAll(".hq-tabs .active").length'),1);
   if(tab===0)assert.equal(await ev('document.querySelector("select[aria-label=练习模式]").value'),'sequential');
  }
  await ev('document.querySelectorAll(".hq-tabs button")[1].click()');await until('document.querySelectorAll(".hq-bank").length===28');
  await ev('document.querySelectorAll(".hq-bank")[20].click()');await until('document.querySelector(".hq-self-input")');await until('[...document.querySelectorAll(".hq-figure")].every(i=>i.complete && i.naturalWidth>0)');
  await ev('document.querySelector(".hq-submit button").click()');await until('document.querySelector(".hq-feedback")?.textContent.includes("暂无参考答案")');await ev('document.querySelector(".hq-feedback button").click()');await until('document.querySelector(".hq-feedback")?.textContent.includes("自评：已掌握")');
  // Source PDF route and binary note must be readable on the real application origin.
  assert.ok(await ev('(async()=>{const r=await fetch("api/notes/HwQuizPDF01/download");return r.ok && (await r.arrayBuffer()).byteLength>10000;})()'));
  await ev('document.querySelector("select[aria-label=选择题库]").value="hw01";document.querySelector("select[aria-label=选择题库]").dispatchEvent(new Event("change",{bubbles:true}))');await until('!!document.querySelector(".hq-option")');
  const shot=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync('tmp/quiz/quiz-trilium-native.png',Buffer.from(shot.data,'base64'));
  assert.ok(await ev('!!document.querySelector(".launcher-button.bx-book-open")'));
  await ev('document.querySelector(".launcher-button.bx-book-open").click()');await until('quizContext.tabManager.getActiveContext().noteId==="HwQuizBoard01"');
  const launchers=await ev('[...document.querySelectorAll("#launcher-pane .launcher-button")].map(e=>({classes:e.className,title:e.title,tooltip:e.getAttribute("data-bs-original-title")}))');
  const quizPosition=launchers.findIndex(e=>e.classes.includes('bx-book-open')),questPosition=launchers.findIndex(e=>e.classes.includes('bx-task')),recentPosition=launchers.findIndex(e=>e.classes.includes('bx-history'));
  assert.ok(quizPosition>=0 && quizPosition+1===questPosition,'quiz entry must be directly above 人升');
  assert.equal(recentPosition+1,quizPosition,'quiz entry must be directly below 最近修改');
  await ev('[...document.querySelectorAll(".hq-header button")].find(b=>b.textContent==="导入题库").click()');await until('!!document.querySelector(".hq-import")');await ev('[...document.querySelectorAll(".hq-import button")].find(b=>b.textContent==="填入示例").click()');await until('document.querySelector(".hq-import textarea").value.includes("我的题库")');await ev('[...document.querySelectorAll(".hq-import button")].find(b=>b.textContent==="导入并开始刷题").click()');await until('document.querySelector(".hq-stem")?.textContent.includes("1 + 1")');
  await ev('document.querySelectorAll(".hq-option")[1].click()');await until('!document.querySelector(".hq-submit button").disabled');await ev('document.querySelector(".hq-submit button").click()');await until('document.querySelector(".hq-feedback")?.textContent.includes("回答正确")');
  await cmd('Page.reload');await until('document.querySelector(".hq-feedback")?.textContent.includes("回答正确")');
  console.log('PASS real Trilium regression: exclusive navigation, ordered sidebar, arbitrary bank import, grading and resumed progress');
  console.log('PASS real Trilium: native render, launcher, backend grading, 28 banks, image route, original PDF and self-grade');
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
