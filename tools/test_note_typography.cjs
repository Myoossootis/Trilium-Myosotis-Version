// Exercise the actual diode note in an isolated desktop instance.
const assert=require('node:assert/strict'),fs=require('node:fs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const targets=await(await fetch('http://127.0.0.1:37842/json/list')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page'&&t.url.startsWith('trilium-app:')).webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
 const cmd=(method,params={})=>new Promise(r=>{const id=++serial;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const m=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.result?.exceptionDetails)throw Error(m.result.exceptionDetails.exception?.description);return m.result?.result?.value;};
 async function until(expression){for(let i=0;i<100;i++){if(await ev(expression))return;await pause(250);}throw Error('Timed out: '+expression);}
 async function theme(dark){if(await ev('document.body.classList.contains("dark-theme")')!==dark){await ev('document.querySelector(".myo-day-night-icon").click()');}await until(`document.body.classList.contains("${dark?'dark':'light'}-theme") && !document.querySelector('.myo-day-night-icon').disabled`);}
 async function shot(name){const r=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync('tmp-render-recovery/'+name,Buffer.from(r.result.data,'base64'));}
 try {
  await cmd('Page.enable');const token=Date.now();await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.typographyTestLoad=${token}`});await cmd('Page.reload');
  await until(`window.typographyTestLoad===${token} && !!window.MyoPomodoro`);
  await ev('(async()=>{const {K:app}=await import("trilium-app://app/src/content_renderer-BMc4Ylfn.js");await app.tabManager.openInSameTab("DZmBItd05Stw","root");})()');
  await until('document.querySelector(".note-split.eric-knowledge-base .ck-content")?.textContent.includes("PN结")');
  const styles=`(()=>{const root=document.querySelector('.note-split.eric-knowledge-base'),content=root.querySelector('.ck-content'),p=content.querySelector('p'),h=content.querySelector('h2');const css=getComputedStyle(p);return {body:css.color,indent:css.textIndent,margin:css.marginLeft,heading:getComputedStyle(h).color,title:getComputedStyle(root.querySelector('.note-title')).color};})()`;
  await theme(true);
  const dark=await ev(styles);assert.equal(dark.body,'rgb(214, 223, 236)');assert.equal(dark.heading,'rgb(140, 203, 208)');assert.equal(dark.title,'rgb(195, 164, 240)');assert.equal(dark.indent,'0px');assert.equal(dark.margin,'0px');
  await shot('diode-note-dark-fixed.png');
  await theme(false);const light=await ev(styles);assert.equal(light.body,'rgb(55, 50, 62)');assert.equal(light.heading,'rgb(86, 148, 159)');assert.equal(light.indent,'0px');assert.equal(light.margin,'0px');
  // Detached from the editor model: verify all heading levels and preserve manual margins.
  await ev(`(()=>{const probe=document.createElement('div');probe.id='typography-probe';probe.className='ck-content';probe.innerHTML='<h3>H3</h3><p>Body 3</p><h4>H4</h4><p>Body 4</p><h5>H5</h5><p>Body 5</p><h6>H6</h6><p>Body 6</p><blockquote>Quote</blockquote><p style="margin-left:40px;text-indent:1em">Manual</p>';document.querySelector('.note-split.eric-knowledge-base').append(probe);})()`);
  assert.deepEqual(await ev('[...document.querySelectorAll("#typography-probe h3+p,#typography-probe h4+p,#typography-probe h5+p,#typography-probe h6+p")].map(p=>({indent:getComputedStyle(p).textIndent,margin:getComputedStyle(p).marginLeft}))'),Array(4).fill({indent:'0px',margin:'0px'}));
  assert.equal(await ev('getComputedStyle(document.querySelector("#typography-probe > p:last-child")).marginLeft'),'40px');
  await theme(true);
  const colors=await ev('[...document.querySelectorAll("#typography-probe h3,#typography-probe h4,#typography-probe h5,#typography-probe h6,#typography-probe blockquote")].map(e=>getComputedStyle(e).color)');
  assert.deepEqual(colors,['rgb(168, 191, 223)','rgb(233, 188, 123)','rgb(230, 164, 185)','rgb(197, 213, 143)','rgb(196, 211, 230)']);
  await ev('document.querySelector("#typography-probe").remove()');
  console.log('PASS: actual diode body/title/headings follow both themes; automatic paragraph indents removed; manual margins preserved; H3–H6 and quotes readable');
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
