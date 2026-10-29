// Native Electron acceptance checks on the isolated snapshot (never port 37840).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://127.0.0.1:37841/etapi';
const token = fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, '').trim();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(method, route, body, plain = false) {
    const response = await fetch(base + route, { method, headers: { Authorization: token, 'Content-Type': plain ? 'text/plain; charset=utf-8' : 'application/json' }, body: body === undefined ? undefined : plain ? body : JSON.stringify(body) });
    const text = await response.text();
    if (!response.ok) throw Error(`${method} ${route}: ${response.status} ${text.slice(0, 120)}`);
    return plain ? text : text ? JSON.parse(text) : null;
}
(async () => {
    const targets = await (await fetch('http://127.0.0.1:37842/json/list')).json();
    const target = targets.find(target => target.type === 'page' && target.url.startsWith('trilium-app:'));
    assert(target, 'Isolated Trilium desktop must be running');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => ws.onopen = resolve);
    let serial = 0; const pending = new Map();
    ws.onmessage = event => { const message = JSON.parse(event.data); if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } };
    const cmd = (method, params = {}) => new Promise(resolve => { const id = ++serial; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async expression => { const message = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (message.result?.exceptionDetails) throw Error(message.result.exceptionDetails.exception?.description); return message.result?.result?.value; };
    const until = async expression => { for (let count = 0; count < 100; count++) { if (await ev(expression)) return; await pause(180); } throw Error('Timed out: ' + expression); };
    const rect = selector => ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,left:r.left,top:r.top,width:r.width,height:r.height};})()`);
    async function click(selector) { await ev(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`); const r = await rect(selector); await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y }); await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 }); await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 }); await pause(80); }
    async function button(text, scope = '.eric-home-dashboard') { await ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope)}+' button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Button missing: '+${JSON.stringify(text)});e.click();})()`); await pause(100); }
    async function drag(from, to, cancel = false) { await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', ...from }); await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', ...from, button: 'left', clickCount: 1 }); for (let i = 1; i <= 12; i++) { await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + (to.x - from.x) * i / 12, y: from.y + (to.y - from.y) * i / 12, button: 'left', buttons: 1 }); } if (cancel) { await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }); await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }); } await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', ...to, button: 'left', clickCount: 1 }); await pause(160); }
    const initial = JSON.parse(await api('GET', '/notes/HmHomeData01/content', undefined, true));
    const original = initial.layout.pages.find(p => p.id === initial.layout.activePageId).widgets;
    const { arrangeWidgets } = new Function(fs.readFileSync('trilium-home-layout.js', 'utf8'))();
    const fingerprint = JSON.stringify(original);
    for (let mask = 0; mask < (1 << original.length); mask++) {
        const subset = original.filter((_, i) => mask & (1 << i));
        const arranged = arrangeWidgets(subset);
        assert.deepEqual(arranged.map(w => w.id).sort(), subset.map(w => w.id).sort());
        assert.deepEqual(arrangeWidgets(arranged), arranged);
        for (const w of arranged) { assert(Number.isInteger(w.w) && w.w >= 1 && w.w <= 12); assert(w.h >= 2); assert.deepEqual(w.config, subset.find(s => s.id === w.id).config); }
    }
    assert.equal(JSON.stringify(original), fingerprint);
    console.log('PASS 1,024 widget subsets: complete, immutable, idempotent arrangements');
    fs.mkdirSync('output/home-pages', { recursive: true });
    const ready = `!!document.querySelector('.hp-grid>.hp-card') && [...document.querySelectorAll('.hp-button')].some(e=>e.textContent.includes('编辑布局')&&!e.disabled)`;
    const reload = async () => { await cmd('Page.reload'); await pause(1100); await until(ready); };
    const geometry = () => ev(`Object.fromEntries([...document.querySelectorAll('.hp-grid>.hp-card')].map(e=>{const r=e.getBoundingClientRect();return [e.dataset.kind,{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}]}))`);
    const near = (a,b) => assert(Math.abs(a-b)<2, `${a} != ${b}`);
    const aligned = async () => {
        const g = await geometry();
        near(g.tasks.top,g.recent.top); near(g.tasks.bottom,g.recent.bottom);
        near(g.tasks.top,g.pomodoro.top); near(g.tasks.bottom,g.stats.bottom);
        near(g.stats.top-g.pomodoro.bottom,16);
        near(g.quicklinks.top,g.calendar.top); near(g.quicklinks.bottom,g.calendar.bottom);
        near(g.quicklinks.top,g.countdown.top); near(g.quicklinks.bottom,g.quote.bottom);
        near(g.quote.top-g.countdown.bottom,16);
        near(g.contributions.width,g.hero.width); near(g.contributions.top-g.calendar.bottom,16);
        assert.equal(g.workbench, undefined);
    };
    try {
        await cmd('Emulation.setDeviceMetricsOverride',{width:1600,height:1600,deviceScaleFactor:1,mobile:false});
        await reload();
        await ev(`(async()=>{window.homeTestApp=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await window.homeTestApp.tabManager.openInSameTab('HmeDashboard','root');})()`);
        await until(ready); await pause(500);
        await aligned();
        let saved = JSON.parse(await api('GET','/notes/HmHomeData01/content',undefined,true));
        let page = saved.layout.pages.find(p=>p.id===saved.layout.activePageId);
        assert.equal(page.arrangementVersion,1);
        assert.deepEqual(page.widgets.map(w=>w.id).sort(),original.map(w=>w.id).sort());
        assert.equal(page.widgets.length,10);
        assert.deepEqual((await api('GET','/notes/eae485474234')).childNoteIds.sort(), ['KThC5jtnOOCu','ZrxUIJf75kFS','vSL4REvviPe2','e6856b492955'].sort());
        console.log('PASS native automatic migration, aligned bands and unchanged original notes');
        const revision = saved.revision;
        await reload(); await aligned();
        assert.equal(JSON.parse(await api('GET','/notes/HmHomeData01/content',undefined,true)).revision,revision);
        await button('编辑布局');
        await click('.hp-card[data-kind="pomodoro"] button[aria-label="增加宽度"]');
        assert.equal(await ev(`document.querySelector('.hp-card[data-kind="pomodoro"]').style.getPropertyValue('--hp-card-w')`),'5');
        await button('完成'); await until(`!document.querySelector('.hp-root.is-editing')`);
        await reload();
        assert.equal(await ev(`document.querySelector('.hp-card[data-kind="pomodoro"]').style.getPropertyValue('--hp-card-w')`),'5');
        await button('编辑布局'); await button('自动整理'); await aligned(); await button('取消');
        assert.equal(await ev(`document.querySelector('.hp-card[data-kind="pomodoro"]').style.getPropertyValue('--hp-card-w')`),'5');
        await button('编辑布局'); await button('自动整理'); await button('完成');
        await until(`!document.querySelector('.hp-root.is-editing')`); await reload(); await aligned();
        console.log('PASS manual sizing persists; arrange/cancel/save/reload preserves the removed card choice');
        const capture = async name => { const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); fs.writeFileSync(path.join('output/home-pages',name),Buffer.from(shot.result.data,'base64')); };
        await capture('home-pages-tidy-native.png');
        await ev(`document.querySelector('.myo-day-night-icon').click()`); await pause(300); await aligned();
        await capture('home-pages-tidy-other-theme.png');
        await ev(`document.querySelector('.myo-day-night-icon').click()`);
        await cmd('Emulation.setDeviceMetricsOverride',{width:800,height:1100,deviceScaleFactor:1,mobile:false}); await pause(300);
        const narrow=await ev(`(()=>{const root=document.querySelector('.hp-root');return {overflow:root.scrollWidth-root.clientWidth,widths:[...document.querySelectorAll('.hp-grid>.hp-card')].map(e=>e.getBoundingClientRect().width)}})()`);
        assert(narrow.overflow<=1); assert(Math.max(...narrow.widths)-Math.min(...narrow.widths)<2);
        console.log('PASS both native themes and narrow single-column layout');
    } finally { await cmd('Emulation.clearDeviceMetricsOverride'); ws.close(); }
})().catch(error=>{console.error(error);process.exit(1)});
