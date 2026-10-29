// Real Electron/Trilium integration test, using only a disposable seed database.
const assert=require('node:assert/strict'),fs=require('node:fs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const targets=await(await fetch('http://127.0.0.1:37942/json/list')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:')).webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
 const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const m=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.result?.exceptionDetails)throw Error(m.result.exceptionDetails.exception?.description);return m.result?.result?.value;};
 const until=async expression=>{for(let i=0;i<60;i++){if(await ev(expression))return;await pause(250);}throw Error('Timed out: '+expression);};
 try{
  await until('!!window.glob?.iconRegistry');
  assert.equal(await ev('window.glob.iconRegistry.sources.find(s=>s.prefix==="electronic-symbols").icons.length'),116);
  assert.ok(await ev('window.glob.iconPackCss.includes("mask-image:")'));
  await ev('(async()=>{window.svgTestContext=(await import("trilium-app://app/src/content_renderer-BMc4Ylfn.js")).K;await window.svgTestContext.tabManager.openInSameTab("BRxYkbVuMDrY","root");})()');
  await until('document.querySelector("iframe.icon-pack-frame")?.contentDocument?.querySelectorAll(".ip-cell").length===116');
  const preview=await ev('(()=>{let d=document.querySelector("iframe.icon-pack-frame").contentDocument,e=d.querySelector(".ip-glyph"),s=d.defaultView.getComputedStyle(e,"::before");return{mask:s.maskImage,width:s.width,height:s.height}})()');
  assert.ok(preview.mask.startsWith('url("data:image/svg+xml,'));assert.notEqual(preview.width,'0px');assert.notEqual(preview.height,'0px');
  await until('!!document.querySelector("button.note-icon.electronic-symbols")');
  const title=await ev('(()=>{const e=document.querySelector("button.note-icon.electronic-symbols"),s=getComputedStyle(e,"::before");return{mask:s.maskImage,width:s.width,height:s.height,color:s.backgroundColor,position:s.position,z:s.zIndex}})()');
  assert.ok(title.mask.startsWith('url("data:image/svg+xml,'));assert.ok(parseFloat(title.width)>10);assert.ok(parseFloat(title.height)>10);
  assert.notEqual(title.color,'rgba(0, 0, 0, 0)');console.log('PASS real title circle:',title.width,title.height,title.position,title.z);
  await ev('(()=>{let e=document.createElement("span");e.id="native-svg-check";e.className="electronic-symbols transistor-com-mosfet-n";e.style.fontSize="32px";document.body.append(e)})()');
  assert.ok(await ev('getComputedStyle(document.querySelector("#native-svg-check"),"::before").maskImage.startsWith("url(\\\"data:image/svg+xml,")'));
  const shot=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync('tmp-svg-icons/native-electron.png',Buffer.from(shot.result.data,'base64'));
  console.log('PASS: actual Electron boot, 116 native registry icons, isolated pack preview, SVG class rendering');
 }finally{ws.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
