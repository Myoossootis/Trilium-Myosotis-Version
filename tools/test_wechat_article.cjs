// Synthetic pages only. Never opens WeChat, reads cookies, or contacts a real ETAPI.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../browser-helpers/wechat-article'),out='D:/Codex/wechat-article-v1/test';
fs.mkdirSync(out,{recursive:true});
const capture=fs.readFileSync(path.join(root,'capture.js'),'utf8').replace('new URL(location.href)',"new URL('https://mp.weixin.qq.com/s/synthetic-article')");
const fixture=`<!doctype html><meta charset="utf-8"><h1 id="activity-name">运放学习：正文测试</h1><a id="js_name">硬件学习</a><span id="publish_time">2026年10月18日</span><main id="js_content"><h2>一、负反馈</h2><p>闭环增益为 <strong>A / (1 + AF)</strong>。<span hidden>隐藏广告</span></p><p><img id="circuit" alt="反馈电路" data-src="https://mmbiz.qpic.cn/synthetic.png"><img data-src="https://mmbiz.qpic.cn/synthetic.png" alt="重复图片"></p><table><tr><th>条件</th><th>结果</th></tr><tr><td rowspan="2">负反馈</td><td>增益稳定</td></tr></table><ol><li>检查极性</li><li>计算环路增益</li></ol><pre><code>Vout = Vin * 10</code></pre><p><a href="javascript:alert(1)">坏链接</a><a href="https://example.com/reference">参考</a></p><iframe src="about:blank"></iframe><script type="text/plain">不要执行或采集此脚本</script><p style="display:none">隐藏文字</p></main><img src="data:," alt="非正文头像">`;
let captureResult;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const server=http.createServer((req,res)=>{
    if(req.url==='/fixture'){res.setHeader('content-type','text/html;charset=utf-8');res.end(fixture);return;}
    const name=new URL(req.url,'http://local').pathname.slice(1),allowed=['reader.html','reader.css','reader.js','article.js'];
    if(!allowed.includes(name)){res.writeHead(404);res.end();return;}
    res.setHeader('content-type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html;charset=utf-8');
    let text=fs.readFileSync(path.join(root,name),'utf8');
    if(name==='reader.html')text=text.replace('<script src="article.js">',`<script>window.chrome={tabs:{query:async()=>[{id:1,url:'https://mp.weixin.qq.com/s/synthetic-article'}]},permissions:{contains:async()=>true},scripting:{executeScript:async()=>[{result:${JSON.stringify(captureResult)}}]}};</script><script src="article.js">`);
    res.end(text);
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port,profile=fs.mkdtempSync(path.join(out,'profile-'));
  const exe=path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1091/chrome-win/chrome.exe');
  const child=spawn(exe,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-sandbox','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1200,1000','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});let ws;
  try {
    const endpoint=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('browser start timeout')),15000);child.stderr.on('data',d=>{log+=d;const m=log.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.once('error',reject);});
    const targets=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
    let serial=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
    const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},20000);pending.set(id,m=>{clearTimeout(timer);m.error?reject(Error(m.error.message)):resolve(m.result);});ws.send(JSON.stringify({id,method,params}));});
    const ev=async expression=>{const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||JSON.stringify(r.exceptionDetails));return r.result.value;};
    const until=async exp=>{for(let i=0;i<100;i++){if(await ev(exp))return;await sleep(50);}throw Error('timeout '+exp+' | '+await ev('document.querySelector("#status")?.textContent'));};
    await cmd('Network.enable');await cmd('Network.setBlockedURLs',{urls:['https://*']});
    await cmd('Page.navigate',{url:origin+'/fixture'});await until('!!document.querySelector("#js_content")');
    let raw=await ev(capture);assert.equal(raw.title,'运放学习：正文测试');assert.equal(raw.assets.length,1);assert.equal(raw.author,'硬件学习');assert.ok(raw.warnings.some(w=>w.includes('视频')));
    assert.ok(!JSON.stringify(raw.tree).includes('隐藏文字'));assert.ok(!JSON.stringify(raw.tree).includes('隐藏广告'));assert.ok(!JSON.stringify(raw.tree).includes('不要执行或采集'));
    await ev('document.querySelector("#js_content").hidden=true');assert.match((await ev(capture)).captureError,/正文尚未显示/);await ev('document.querySelector("#js_content").hidden=false');
    const image=await ev(`(()=>{const c=document.createElement('canvas');c.width=360;c.height=120;const x=c.getContext('2d');x.fillStyle='#f3f7f4';x.fillRect(0,0,c.width,c.height);x.fillStyle='#315e48';x.font='20px sans-serif';x.fillText('Vin → [ A / (1 + AF) ] → Vout',16,65);return c.toDataURL()})()`);
    raw.assets=[image];captureResult=raw;
    await cmd('Page.navigate',{url:origin+'/reader.html'});await until('typeof WechatArticle!=="undefined" && !!document.querySelector("#read").onclick');
    await ev('document.querySelector("#read").click()');await until('!document.querySelector("#preview").hidden');
    assert.match(await ev('document.querySelector("#status").textContent'),/1 张图片已保存/);
    assert.equal(await ev('prepared.images.length'),1);assert.ok(await ev('WechatArticle.render(prepared.article,prepared.images.map(i=>i.data)).includes("<table>")'));
    const offline=await ev('WechatArticle.documentHtml(prepared.article,prepared.images.map(i=>i.data))');
    assert.ok(offline.includes('data:image/png;base64,'));assert.ok(!offline.includes('javascript:'));assert.ok(!offline.includes('<iframe'));assert.ok(!offline.includes('<script'));
    fs.writeFileSync(path.join(out,'offline-synthetic-article.html'),offline);
    const downloadPath=path.join(profile,'downloads');fs.mkdirSync(downloadPath);
    await cmd('Browser.setDownloadBehavior',{behavior:'allow',downloadPath});await ev('document.querySelector("#download").click()');
    let downloaded;
    for(let i=0;i<100;i++){downloaded=fs.readdirSync(downloadPath).find(n=>n.endsWith('.html'));if(downloaded)break;await sleep(50);}
    assert.ok(downloaded,'HTML download must finish');assert.equal(fs.readFileSync(path.join(downloadPath,downloaded),'utf8'),offline,'actual downloaded file must contain text and all image data');
    assert.ok(!fs.existsSync(path.join(root,'trilium.js')));assert.equal(await ev('!!document.querySelector("#save") || !!document.querySelector("#token")'),false);
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));assert.deepEqual(manifest.permissions,['activeTab','scripting']);assert.ok(!manifest.host_permissions.some(p=>/localhost|127\.0\.0\.1/.test(p)));
    assert.equal(manifest.action.default_popup,'reader.html');assert.ok(!manifest.background);assert.ok(!fs.existsSync(path.join(root,'background.js')),'no click handler that opens a new tab');
    assert.equal(await ev('WechatArticle.canonical("https://mp.weixin.qq.com/s/demo?scene=1#abc")'),'https://mp.weixin.qq.com/s/demo');
    assert.equal(await ev('WechatArticle.canonical("https://mp.weixin.qq.com/s?__biz=abc&mid=22&idx=2&sn=secret&scene=1")'),'https://mp.weixin.qq.com/s?__biz=abc&mid=22&idx=2');
    for(const bad of ['https://mp.weixin.qq.com.evil.test/s/xx','http://mp.weixin.qq.com/s/xx'])assert.ok(await ev(`(()=>{try{WechatArticle.canonical(${JSON.stringify(bad)});return false;}catch{return true}})()`));
    assert.ok(await ev(`(async()=>{try{await WechatArticle.loadImage('https://evil.test/image.png');return false;}catch(e){return e.message.includes('尚未支持')}})()`));
    // Deliberate image failure must clear the previously successful save state.
    await ev(`window.goodRaw=structuredClone(prepared.article);chrome.scripting.executeScript=async()=>[{result:{...window.goodRaw,assets:['https://evil.test/image.png']}}];document.querySelector('#read').click()`);
    await until('!document.querySelector("#read").disabled');assert.equal(await ev('prepared'),null);assert.equal(await ev('document.querySelector("#download").disabled'),true);assert.equal(await ev('document.querySelector("#preview").hidden'),true);
    await ev('chrome.scripting.executeScript=async()=>[{result:window.goodRaw}];document.querySelector("#read").click()');await until('!document.querySelector("#preview").hidden');
    await ev(`document.querySelector('#status').textContent='已读取正文，1 张图片已保存。';document.querySelector('#preview-details').open=true;`);
    assert.equal(await ev('document.body.getBoundingClientRect().width'),380);
    await cmd('Emulation.setDeviceMetricsOverride',{width:380,height:600,deviceScaleFactor:1,mobile:false});
    assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth'),'popup must not overflow horizontally');
    await sleep(150);const screenshot=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'reader-preview.png'),Buffer.from(screenshot.data,'base64'));
    const report={passed:true,verification:'synthetic offline browser only; not a real WeChat article',checks:['toolbar popup configured','no new-tab background handler','380px compact popup layout','active article tab selection','DOM extraction','lazy images','hidden text excluded','typed safe rendering','self-contained HTML','actual HTML download preserves text and image bytes','image failure clears stale preview','canonical URL','no Trilium entry or token fields','no storage or localhost permissions'],preview:path.join(out,'reader-preview.png')};
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  } finally {
    if(ws)ws.close();child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));server.close();
    const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(out)+path.sep));fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
