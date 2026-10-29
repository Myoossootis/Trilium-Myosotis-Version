// Test the actual capacitive pressure-sensor note, without changing its content.
const fs=require('node:fs'),assert=require('node:assert/strict');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const targets=await(await fetch('http://127.0.0.1:37942/json/list')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:')).webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
 const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result.result.value;};
 const until=async expression=>{for(let i=0;i<100;i++){if(await ev(expression))return;await wait(150);}throw Error('Timed out: '+expression);};
 const selector=`[...document.querySelectorAll('.note-split.eric-knowledge-base .ck-content')].find(e=>e.getBoundingClientRect().height>0)`;
 const stats=`(()=>{const c=${selector};return{editable:c?.getAttribute('contenteditable'),tables:[...c.querySelectorAll('table')].map(t=>{const cell=t.querySelector('td,th'),s=getComputedStyle(cell);return{wrapper:t.parentElement.tagName,width:t.getBoundingClientRect().width,contentWidth:c.getBoundingClientRect().width,border:s.borderTopWidth,borderColor:s.borderTopColor,padding:s.paddingTop,header:getComputedStyle(t.querySelector('th')||cell).backgroundColor,rows:t.rows.length,columns:t.rows[0]?.cells.length}})}})()`;
 try{
  await until(`!!window.__myosotisChapterRail && !!document.querySelector('.note-split[data-ntx-id]')`);
  await ev('(async()=>{const app=(await import("trilium-app://app/src/content_renderer-BMc4Ylfn.js")).K;await app.tabManager.openInSameTab("y17XiEzjty0k","root");})()');
  await until(`${selector}?.querySelectorAll('table').length>0`);
  await wait(700);
  console.log('BEFORE',JSON.stringify(await ev(stats)));
  if(process.argv.includes('--preview')||process.argv.includes('--deploy')||process.argv.includes('--verify')){
   const css=fs.readFileSync('trilium-dictionary-layout.css','utf8');
   if(process.argv.includes('--deploy')){
    await ev(`(async()=>{const server=(await import('trilium-app://app/src/server-E-v8IJ6Q.js')).t;await server.put('notes/9Y5dJJ9SOWTm/data',{content:${JSON.stringify(css)}})})()`);
    const reloadToken=Date.now();
    await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.tableTestReload=${reloadToken}`});
    await cmd('Page.reload');
    await until(`window.tableTestReload===${reloadToken} && !!window.__myosotisChapterRail && !!document.querySelector('.note-split[data-ntx-id]')`);
    // appCss updates can independently request a second renderer reload.
    // Wait for the app's own startup; never import modules into an unbootstrapped page.
    await wait(1600);
    await until(`!!window.__myosotisChapterRail && !!document.querySelector('.note-split[data-ntx-id]')`);
    await until(`${selector}?.querySelectorAll('table').length===7`);await wait(1000);
    await until(`${selector}?.querySelectorAll('table').length===7`);
    assert.equal(await ev(`!!document.getElementById('myo-table-style-fix')`),false,'Temporary preview stylesheet survived reload');
   }else if(process.argv.includes('--preview'))await ev(`(()=>{let style=document.getElementById('myo-table-style-fix');if(!style){style=document.createElement('style');style.id='myo-table-style-fix';document.head.append(style)}style.textContent=${JSON.stringify(css)}})()`);
   const first=await ev(stats);assert.ok(first.tables.length>0);
   const validate=data=>{for(const t of data.tables){assert.ok(parseFloat(t.border)>0,'Border missing');assert.ok(parseFloat(t.padding)>=6,'Cell padding missing');assert.ok(t.width>300,'Table too narrow');assert.notEqual(t.header,'rgba(0, 0, 0, 0)','Header background missing');}};
   validate(first);console.log('PASS read-only:',JSON.stringify(first));
   if(process.argv.includes('--modes')){
    const switched=await ev(`(()=>{const badge=[...document.querySelectorAll('.read-only-badge')].find(e=>e.getClientRects().length);if(!badge)return false;badge.click();return true})()`);
    if(switched){
     await until(`${selector}?.getAttribute('contenteditable')==='true'`);await wait(500);
     const edited=await ev(stats);validate(edited);assert.equal(edited.tables.length,first.tables.length);
     assert.ok(edited.tables.every((t,i)=>t.rows===first.tables[i].rows && t.columns===first.tables[i].columns));
     console.log('PASS real editing mode:',edited.tables.length,'tables with borders/padding and unchanged row/column counts');
     await ev(`document.querySelector('.temporarily-editable-badge')?.click()`);
     await until(`${selector}?.getAttribute('contenteditable')!=='true'`);await wait(300);validate(await ev(stats));
    }else throw Error('Read-only mode toggle unavailable');
   }
   // The rendered DOM has bare tables; reproduce the editor's figure wrapper in
   // an external, detached-from-model probe to compare both selector structures.
   const wrapped=await ev(`(()=>{const host=document.createElement('div');host.className='note-split eric-knowledge-base';host.id='table-style-probe';host.innerHTML='<div class="ck-content"><figure class="table"><table><tr><th>表头</th><th>参数</th></tr><tr><td>值</td><td>内容</td></tr></table></figure></div>';document.body.append(host);const cell=host.querySelector('td'),s=getComputedStyle(cell);const result={border:s.borderTopWidth,padding:s.paddingTop};host.remove();return result})()`);
   assert.equal(wrapped.border,first.tables[0].border);assert.equal(wrapped.padding,first.tables[0].padding);
   // Ensure dark-theme contrast without changing the user's theme preference.
   const dark=await ev(`(()=>{const was=document.body.classList.contains('dark-theme');document.body.classList.add('dark-theme');const c=${selector},th=c.querySelector('th'),s=getComputedStyle(th),result={background:s.backgroundColor,text:s.color,border:s.borderTopColor};if(!was)document.body.classList.remove('dark-theme');return result})()`);
   assert.notEqual(dark.background,'rgb(248, 249, 251)');assert.notEqual(dark.text,'rgb(0, 0, 0)');console.log('PASS figure wrapper and dark-theme:',JSON.stringify(dark));
   await ev(`(()=>{const c=${selector},table=[...c.querySelectorAll('table')].find(t=>t.textContent.includes('课件比较项'))||c.querySelector('table'),s=c.closest('.scrolling-container');s.dispatchEvent(new CustomEvent('myosotis-reference-jump',{bubbles:true,detail:{noteId:'y17XiEzjty0k'}}));s.scrollTo({top:Math.max(0,s.scrollTop+table.getBoundingClientRect().top-s.getBoundingClientRect().top-120),behavior:'instant'})})()`);
   await wait(150);const shot=await cmd('Page.captureScreenshot',{format:'png'});fs.mkdirSync('tmp-table-style',{recursive:true});fs.writeFileSync('tmp-table-style/readonly-fixed.png',Buffer.from(shot.result.data,'base64'));
  }
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
