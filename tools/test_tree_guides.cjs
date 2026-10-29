// Verify guide placement and native tree interaction in the isolated desktop.
const assert=require('node:assert/strict'),fs=require('node:fs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const targets=await(await fetch('http://127.0.0.1:37842/json/list')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:')).webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
 const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const m=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.result?.exceptionDetails)throw Error(m.result.exceptionDetails.exception?.description);return m.result?.result?.value;};
 async function until(expression){for(let i=0;i<100;i++){if(await ev(expression))return;await pause(200);}throw Error('Timed out: '+expression);}
 async function theme(dark){if(await ev('document.body.classList.contains("dark-theme")')!==dark)await ev('document.querySelector(".myo-day-night-icon").click()');await until(`document.body.classList.contains('${dark?'dark':'light'}-theme') && !document.querySelector('.myo-day-night-icon').disabled`);}
 async function open(id){await ev(`(async()=>{const {K:app}=await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js');await app.tabManager.openInSameTab('${id}','root');})()`);await until('!!document.querySelector("#left-pane .fancytree-active")');}
 const styles=`(()=>{const n=document.querySelector('#left-pane .fancytree-active'),ul=n.parentElement.parentElement,p=getComputedStyle(ul,'::before');return {width:p.width,offset:p.left,parentArrow:ul.previousElementSibling.querySelector('.fancytree-expander')?.getBoundingClientRect().x,pointer:p.pointerEvents,color:p.backgroundColor,group:ul.getBoundingClientRect().x,row:n.getBoundingClientRect().x,accentCount:[...document.querySelectorAll('#left-pane ul ul')].filter(u=>u.matches(':has(>li>.fancytree-active)')).length};})()`;
 try {
  await cmd('Page.enable');const nonce=Date.now();await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.treeGuideTestLoad=${nonce}`});await cmd('Page.reload');
  await until(`window.treeGuideTestLoad===${nonce} && !!window.MyoPomodoro`);
  await open('DZmBItd05Stw');await until('document.querySelector("#left-pane .fancytree-active .fancytree-title")?.textContent.includes("二极管")');
  const colors=[];
  for(const dark of [false,true]){
   await theme(dark);const s=await ev(styles);assert.equal(s.width,'1px');assert.equal(s.offset,'19.5px');assert.equal(s.pointer,'none');assert.equal(s.accentCount,1);assert(Math.abs(s.group+19.5+0.5-(s.parentArrow+12))<0.6);colors.push(s.color);
   const normal=await ev(`(()=>{const u=[...document.querySelectorAll('#left-pane ul ul')].find(u=>u.getBoundingClientRect().height>0&&!u.matches(':has(>li>.fancytree-active)'));return getComputedStyle(u,'::before').backgroundColor;})()`);assert.notEqual(normal,s.color);
   const shot=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync('tmp-render-recovery/tree-guides-'+(dark?'dark':'light')+'.png',Buffer.from(shot.result.data,'base64'));
  }
  assert.notEqual(colors[0],colors[1]);
  // Collapse and re-expand the current parent with the actual native expander.
  await ev(`document.querySelector('#left-pane .fancytree-active').parentElement.parentElement.parentElement.querySelector(':scope > .fancytree-node > .fancytree-expander').click()`);
  await until(`document.querySelector('#left-pane .fancytree-active').getBoundingClientRect().height===0`);
  await ev(`document.querySelector('#left-pane .fancytree-active').parentElement.parentElement.parentElement.querySelector(':scope > .fancytree-node > .fancytree-expander').click()`);
  await until(`document.querySelector('#left-pane .fancytree-active').getBoundingClientRect().height>0`);
  await open('XCySs7cEMGuN');await until('document.querySelector("#left-pane .fancytree-active .fancytree-title")?.textContent.includes("模拟电路")');assert.equal((await ev(styles)).accentCount,1);
  console.log(JSON.stringify({passed:true,themes:colors,nativeCollapseExpand:true,selectionGuideFollows:true}));
 } finally {ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
