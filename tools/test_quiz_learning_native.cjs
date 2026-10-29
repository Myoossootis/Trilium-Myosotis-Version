const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/quiz');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const targets=await(await fetch('http://127.0.0.1:37842/json/list')).json();
 const page=targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:'));assert.ok(page);
 const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
 const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const m=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.exceptionDetails)throw Error(m.exceptionDetails.exception?.description || m.exceptionDetails.text);return m.result.value;};
 const until=async expression=>{for(let i=0;i<120;i++){if(await ev(expression))return;await pause(150);}throw Error('timeout '+expression+' '+await ev('document.querySelector(".hw-quiz-error")?.textContent || document.querySelector(".alert-danger")?.textContent || ""'));};
 try{
  await cmd('Page.reload');await pause(1000);await until('!!document.querySelector("#launcher-pane .bx-book-open")');
  await ev('(async()=>{window.quizContext=(await import("trilium-app://app/src/content_renderer-BMc4Ylfn.js")).K;})()');
  await ev('window.quizContext.tabManager.openInSameTab("HwQuizBoard01","root")');await until('document.querySelectorAll(".hw-quiz .question-row").length===16');
  assert.equal(await ev('document.querySelectorAll("input[data-topic]").length'),1,'real questions must not receive demo labels');
  assert.equal(await ev('document.querySelector("#study-dialog").open'),false);
  await ev('document.querySelector("#question-order").value="sequential";document.querySelector("#start-learning").click()');await until('document.querySelector("#study-dialog").open');
  assert.ok(await ev('(()=>{const d=document.querySelector("#study-dialog"),r=d.getBoundingClientRect(),clip=d.closest(".scrolling-container").getBoundingClientRect();return !d.matches(":modal")&&r.left>=clip.left-1&&r.right<=clip.right+1&&r.bottom<=clip.bottom+1})()'));
  await ev('document.querySelector("[data-option=B]").click()');await until('document.querySelector("#save-status").textContent==="已保存"');
  await ev('document.querySelector("#close-study").click()');await until('!document.querySelector("#study-dialog").open');
  await cmd('Page.reload');await pause(1000);await until('!!document.querySelector("#resume-learning")');await ev('document.querySelector("#resume-learning").click()');await until('document.querySelector("[data-option=B]").classList.contains("chosen")');
  await ev('document.querySelector("#primary-study-action").click()');await until('document.querySelector(".feedback-heading")?.textContent.includes("回答错误") && document.querySelector("#save-status").textContent==="已保存"');
  assert.ok(await ev('document.querySelector("[data-option=A]").classList.contains("is-correct")&&document.querySelector("[data-option=B]").classList.contains("is-wrong")'));
  await ev('document.querySelector(".favorite-toggle").click()');await until('document.querySelector("#save-status").textContent==="已保存"');
  const shot=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'learning-native-feedback.png'),Buffer.from(shot.data,'base64'));
  await ev('document.querySelector("#close-study").click()');await until('!document.querySelector("#study-dialog").open');
  for(const tab of ['favorites','wrong','all']){await ev('document.querySelector("[data-tab='+tab+']").click()');assert.equal(await ev('document.querySelectorAll("#library-tabs .active").length'),1);}
  await ev('document.querySelector("#add-topic").click();document.querySelector("#topic-name").value="电路";document.querySelector("#topic-form").requestSubmit()');await until('document.querySelectorAll("input[data-topic]").length===2');
  await until('!document.querySelector("#topic-dialog").open');await ev('document.querySelector("#add-topic").click();document.querySelector("#topic-name").value="二极管";document.querySelector("#topic-parent").selectedIndex=1;document.querySelector("#topic-form").requestSubmit()');await until('document.querySelectorAll("input[data-topic]").length===3');
  await ev('document.querySelectorAll("input[data-select]")[0].click();document.querySelectorAll("input[data-select]")[1].click();document.querySelector("#batch-tag").click();document.querySelectorAll("#tag-options input")[1].click();document.querySelector("#save-tags").click()');await until('document.querySelector("#save-status").textContent==="已保存"');
  await ev('document.querySelectorAll("input[data-topic]")[0].click()');await until('document.querySelector("#pool-count").textContent==="2 道题"');assert.ok(await ev('document.querySelectorAll("input[data-topic]")[1].checked'));
  await ev('document.querySelectorAll("input[data-topic]")[1].click()');assert.equal(await ev('document.querySelector("#start-learning").disabled'),true);assert.equal(await ev('document.querySelectorAll("input[data-topic]")[0].indeterminate'),true);
  await ev('document.querySelector("[data-all]").click();document.querySelector("#daily-button").click();document.querySelector("#daily-target").value=37;document.querySelector("#daily-form").requestSubmit()');await until('document.querySelector("#study-dialog").open');assert.equal(await ev('document.querySelectorAll("#answer-map button").length'),36);
  await ev('document.querySelector("#close-study").click()');await until('!document.querySelector("#study-dialog").open');
  await ev('document.querySelector("#manage-button").click();document.querySelector("#import-bank").click();document.querySelector("#import-content").value=JSON.stringify({title:"通用测试",questions:[{stem:"MULTI_TEST",type:"multi",options:["甲","乙","丙"],answer:"AC"},{stem:"SELF_TEST",type:"self",explanation:"参考要点"}]});document.querySelector("#import-form").requestSubmit()');await until('document.querySelector("#pool-count").textContent==="1405 道题"');
  await ev('document.querySelector("#question-search").value="MULTI_TEST";document.querySelector("#question-search").dispatchEvent(new Event("input"));document.querySelector("[data-practice]").click();document.querySelector("[data-option=A]").click();document.querySelector("[data-option=C]").click();document.querySelector("#question-scroll").focus()');
  await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await until('document.querySelector(".feedback-heading")?.textContent.includes("回答正确") && document.querySelector("#save-status").textContent==="已保存"');
  await ev('document.querySelector("#close-study").click()');await until('!document.querySelector("#study-dialog").open');
  await ev('document.querySelector("#question-search").value="SELF_TEST";document.querySelector("#question-search").dispatchEvent(new Event("input"));document.querySelector("[data-practice]").click();document.querySelector("#self-response").value="未提交思路";document.querySelector("#self-response").dispatchEvent(new Event("input"))');await until('document.querySelector("#save-status").textContent==="已保存"');
  await ev('document.querySelector("#close-study").click()');await until('!document.querySelector("#study-dialog").open');await cmd('Page.reload');await pause(1000);await until('!!document.querySelector("#resume-learning")');await ev('document.querySelector("#resume-learning").click()');await until('document.querySelector("#self-response")?.value==="未提交思路"');
  await ev('document.querySelector("#primary-study-action").click()');await until('!!document.querySelector("[data-grade=true]")');await ev('document.querySelector("[data-grade=true]").click()');await until('document.querySelector(".feedback-heading").textContent.includes("自评：已掌握")&&document.querySelector("#save-status").textContent==="已保存"');
  assert.equal(await ev('document.querySelector(".hw-quiz-error")?.textContent || ""'),'');
  await ev('document.querySelector("#close-study").click()');await until('!document.querySelector("#study-dialog").open');
  await ev('document.querySelector("#question-search").value="hw19-scan-001";document.querySelector("#question-search").dispatchEvent(new Event("input"));document.querySelector("[data-practice=hw19-scan-001]").click()');await until('document.querySelector(".question-figure")?.complete && document.querySelector(".question-figure").naturalWidth>0');
  await ev('document.querySelector("#close-study").click()');await until('!document.querySelector("#study-dialog").open');
  await ev('document.querySelector("#question-search").value="hw01-001";document.querySelector("#question-search").dispatchEvent(new Event("input"));document.querySelector("[data-practice=hw01-001]").click();document.querySelector("[data-edit]").click();document.querySelector("#edit-answer").value="AC";document.querySelector("#edit-type").value="multi";document.querySelector("#edit-explanation").value="测试解析";document.querySelector("#edit-form").requestSubmit()');await until('!document.querySelector("#edit-dialog").open && document.querySelector(".type-badge").textContent==="多选题"');
  await ev('document.querySelector("[data-option=A]").click();document.querySelector("[data-option=C]").click();document.querySelector("#primary-study-action").click()');await until('document.querySelector(".feedback-heading").textContent.includes("回答正确")&&document.querySelector("#save-status").textContent==="已保存"');
  assert.equal(await ev('document.querySelector(".explanation").textContent'),'测试解析');
  console.log('PASS formal browser: native practice viewport, drafts after reload, red/green answers, exclusive collection tabs, cascaded multi-tags, daily goals, arbitrary import, keyboard multi-select and text self-grade');

  assert.ok(await ev('(async()=>{const r=await fetch("api/notes/HwQuizPDF01/download");return r.ok && (await r.arrayBuffer()).byteLength>10000;})()'));
  const launchers=await ev('[...document.querySelectorAll("#launcher-pane .launcher-button")].map(e=>e.className)');
  const quiz=launchers.findIndex(e=>e.includes('bx-book-open')),quest=launchers.findIndex(e=>e.includes('bx-task')),recent=launchers.findIndex(e=>e.includes('bx-history'));assert.equal(quiz,recent+1);assert.equal(quest,quiz+1);
  const nativeShot=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'learning-native.png'),Buffer.from(nativeShot.data,'base64'));
  console.log('PASS native Trilium: real render/backend persistence, original PDF, sidebar below recent changes and above 人升');
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
