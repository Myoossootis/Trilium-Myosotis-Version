const fs=require('node:fs');
(async()=>{
 const targets=await(await fetch('http://127.0.0.1:37842/json/list')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:')).webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
 const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
 const expression=process.argv[2]||`(()=>{const tree=document.querySelector('#left-pane .fancytree-container');return {html:tree?.outerHTML.slice(0,18000),uls:[...tree.querySelectorAll('ul')].slice(0,8).map(el=>({padding:getComputedStyle(el).padding,margin:getComputedStyle(el).margin,position:getComputedStyle(el).position,rect:el.getBoundingClientRect().toJSON()}))};})()`;
 const result=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});console.log(JSON.stringify(result.result,null,2));
 if(process.argv[3]){const r=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.argv[3],Buffer.from(r.result.data,'base64'));}
 ws.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
