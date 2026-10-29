// Read-only diagnosis of the currently visible native title; no note updates.
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const targets=await(await fetch('http://127.0.0.1:37942/json/list')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:')).webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();
 ws.onmessage=e=>{let m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
 const send=(method,params)=>new Promise(r=>{let n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
 try{
 const evaluated=await send('Runtime.evaluate',{returnByValue:true,expression:'[...document.querySelectorAll("button.note-icon.electronic-symbols")].filter(e=>e.getBoundingClientRect().height>0).map(e=>{let s=getComputedStyle(e,"::before"),r=e.getBoundingClientRect();return{icon:e.className,width:s.width,height:s.height,mask:s.maskImage.startsWith("url(\\\"data:image/svg+xml,"),color:s.backgroundColor,z:s.zIndex,clip:{x:Math.max(0,r.x-8),y:Math.max(0,r.y-8),width:Math.min(360,innerWidth-r.x),height:80,scale:1}}})'});
 if(evaluated.result?.exceptionDetails)throw Error(evaluated.result.exceptionDetails.text);
 const icons=evaluated.result.result.value;
 assert.ok(icons.length,'No visible electronic SVG title icon');
 for(const icon of icons){assert.ok(icon.mask);assert.ok(parseFloat(icon.width)>10&&parseFloat(icon.height)>10);assert.notEqual(icon.color,'rgba(0, 0, 0, 0)');}
 const screenshot=await send('Page.captureScreenshot',{format:'png'});
 fs.writeFileSync('tmp-svg-icons/live-title.png',Buffer.from(screenshot.result.data,'base64'));
 console.log('PASS: visible live title SVG has mask, dimensions and nontransparent color',JSON.stringify(icons.map(({mask,width,height,color})=>({mask,width,height,color}))));
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
