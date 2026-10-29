// Scoped live diagnostics for the user's requested note. No editor content writes.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const targets=await(await fetch('http://127.0.0.1:37942/json/list')).json();
 const target=targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:'));
 if(!target)throw Error('Trilium debug page unavailable');
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let serial=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
 const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,includeCommandLineAPI:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result.result.value;};
 try{
  if(process.argv.includes('--deploy')){
   const source=fs.readFileSync('customizations/frontend/chapter-preview-rail.js','utf8');
   await evaluate(`(async()=>{const server=(await import('trilium-app://app/src/server-E-v8IJ6Q.js')).t;await server.put('notes/MyoChapRail/data',{content:${JSON.stringify(source)}});return true})()`);
   await cmd('Page.reload');
   let loaded=false;
   for(let i=0;i<100;i++){await pause(150);try{loaded=await evaluate(`window.__myosotisChapterRail?.version==='visible-content-instant-v3' && [...document.querySelectorAll('.myo-chapter-rail')].some(r=>getComputedStyle(r).display!=='none')`);}catch{}if(loaded)break;}
   if(!loaded)throw Error('Updated startup script did not become active');
   console.log('PASS: program note updated through native API and v3 verified active after reload');
  }
  if(!process.argv.includes('--current'))await evaluate('(async()=>{window.chapterDebugApp=(await import("trilium-app://app/src/content_renderer-BMc4Ylfn.js")).K;await window.chapterDebugApp.tabManager.openInSameTab("PhYYiGjMcGJm","root");})()');
  await pause(1600);
  let enteredEditing=false;
  if(process.argv.includes('--edit')){
   enteredEditing=await evaluate(`(()=>{const badge=[...document.querySelectorAll('.read-only-badge')].find(e=>e.getClientRects().length);if(!badge)return false;badge.click();return true})()`);
   await pause(2200);
  }
  console.log('LAYOUT',JSON.stringify(await evaluate(`(()=>{let roots=[...document.querySelectorAll('.note-split[data-ntx-id]')];return{rail:!!window.__myosotisChapterRail,ticks:document.querySelectorAll('.myo-chapter-tick').length,roots:roots.map(root=>({id:root.dataset.ntxId,visible:!!root.getClientRects().length,content:[...root.querySelectorAll('.ck-content')].map(c=>({rects:c.getClientRects().length,height:c.getBoundingClientRect().height,headings:c.querySelectorAll('h1,h2,h3,h4,h5,h6').length,scroller:c.closest('.scrolling-container')?.className,scroll:c.closest('.scrolling-container')?.scrollTop,headTop:[...c.querySelectorAll('h2,h3')].slice(0,5).map(h=>h.getBoundingClientRect().top)}))}))};})()`)));
  console.log('GEOMETRY',JSON.stringify(await evaluate(`(()=>{const c=[...document.querySelectorAll('.note-split .ck-content')].find(c=>c.getBoundingClientRect().height>0),s=c.closest('.scrolling-container');return{zoom:getComputedStyle(document.body).zoom,behavior:getComputedStyle(s).scrollBehavior,rectHeight:s.getBoundingClientRect().height,offsetHeight:s.offsetHeight,clientHeight:s.clientHeight,contentRect:c.getBoundingClientRect().height,contentOffset:c.offsetHeight,editable:c.getAttribute('contenteditable'),active:document.activeElement?.className}})()`)));
  console.log('LIVE SCRIPT',JSON.stringify(await evaluate(`({rails:[...document.querySelectorAll('.myo-chapter-rail')].map(r=>({display:getComputedStyle(r).display,height:r.style.height,top:r.style.top})),handler:getEventListeners(document.querySelector('.myo-chapter-tick')).click?.[0]?.listener.toString()})`)));
  if(process.argv.includes('--controls'))console.log('CONTROLS',JSON.stringify(await evaluate(`[...document.querySelectorAll('button,[role="button"]')].filter(e=>e.getBoundingClientRect().height>0).map(e=>({text:e.textContent.trim().slice(0,50),title:e.getAttribute('title')||e.getAttribute('data-bs-original-title'),aria:e.getAttribute('aria-label'),class:e.className})).filter(e=>/编辑|只读|read.only|edit/i.test([e.text,e.title,e.aria,e.class].join(' ')))`)));
  if(process.argv.includes('--mouse')){
   if(process.argv.includes('--focus'))await evaluate(`[...document.querySelectorAll('.ck-content[contenteditable="true"]')].find(e=>e.getClientRects().length)?.focus()`);
   for(const index of [32,8,24,3]){
    const point=await evaluate(`(()=>{const b=[...document.querySelectorAll('.myo-chapter-rail')].find(r=>getComputedStyle(r).display!=='none').children[${index}],r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,title:b.getAttribute('aria-label')}})()`);
    await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
    await cmd('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,x:point.x,y:point.y});
    await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:point.x,y:point.y});
    const immediate=await evaluate(`(()=>{const c=[...document.querySelectorAll('.note-split .ck-content')].find(c=>c.getBoundingClientRect().height>0);return c.closest('.scrolling-container').scrollTop})()`);
    if(process.argv.includes('--verify'))assert.ok(immediate>0,'Physical mouse click did not jump immediately');
    await pause(1500);
    const position=await evaluate(`(()=>{const c=[...document.querySelectorAll('.note-split .ck-content')].find(c=>c.getBoundingClientRect().height>0),s=c.closest('.scrolling-container'),h=c.querySelectorAll('h1,h2,h3,h4,h5,h6')[${index}];return{scroll:s.scrollTop,targetTop:h.getBoundingClientRect().top,scrollerTop:s.getBoundingClientRect().top,activeTick:document.querySelector('.myo-chapter-tick[data-active]')?.getAttribute('aria-label')}})()`);
    if(process.argv.includes('--verify')){
        assert.ok(Math.abs(position.scroll-immediate)<3,'Jump was overridden after clicking');
        assert.ok(Math.abs(position.targetTop-position.scrollerTop-105)<3,'Wrong heading alignment');
        assert.equal(position.activeTick,point.title,'Wrong active chapter marker');
    }
    console.log('MOUSE',JSON.stringify({index,title:point.title,immediate,position}));
   }
  }
  if(process.argv.includes('--click')){
   const data=await evaluate(`(()=>{const root=[...document.querySelectorAll('.note-split[data-ntx-id]')].find(r=>r.getClientRects().length&&r.querySelector('.ck-content'));const c=[...root.querySelectorAll('.ck-content')].find(c=>c.getBoundingClientRect().height>0),s=c.closest('.scrolling-container');window.chapterDebugScroll=s;window.chapterDebugEvents=[];s.addEventListener('scroll',()=>window.chapterDebugEvents.push({time:performance.now(),y:s.scrollTop}),{passive:true});return{start:s.scrollTop,height:s.scrollHeight,viewport:s.clientHeight};})()`);
   console.log('BEFORE',JSON.stringify(data));
   await evaluate(`(()=>{let rail=[...document.querySelectorAll('.myo-chapter-rail')].find(r=>getComputedStyle(r).display!=='none');let buttons=[...rail.children];buttons[Math.floor(buttons.length*.6)].click()})()`);
   console.log('IMMEDIATE',await evaluate('window.chapterDebugScroll.scrollTop'));
   await pause(1000);console.log('AFTER',JSON.stringify(await evaluate('({top:window.chapterDebugScroll.scrollTop,events:window.chapterDebugEvents})')));
  }
  if(enteredEditing)await evaluate(`document.querySelector('.temporarily-editable-badge')?.click()`);
  if(process.argv.includes('--verify'))console.log('PASS: real mouse jumps immediately to four distinct chapters, remains stable and highlights the correct chapter');
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
