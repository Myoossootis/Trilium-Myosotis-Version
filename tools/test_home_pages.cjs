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
    const stateBefore = await api('GET', '/notes/HmHomeData01/content', undefined, true);
    const fixtures = [];
    fs.mkdirSync('output/home-pages', { recursive: true });
    async function screenshot(name) { const result = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join('output/home-pages', name), Buffer.from(result.result.data, 'base64')); }
    try {
        await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
        await cmd('Page.reload'); await pause(1100);
        await until(`!!document.querySelector('.hp-grid>.hp-card') && [...document.querySelectorAll('.hp-button')].some(e=>e.textContent.includes('编辑布局')&&!e.disabled)`);
        await ev(`(async()=>{window.homeTestApp=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;})()`);
        assert.equal(await ev(`document.querySelector('.ehd-save-status').textContent`), '');
        assert.equal(await ev(`document.querySelectorAll('.hp-grid>.hp-card').length`), 11);
        assert.equal(await ev(`document.querySelectorAll('.hp-quicklink').length`), 6);
        assert.equal((await api('GET', '/notes/eae485474234')).parentNoteIds.includes('root'), false);
        assert.deepEqual((await api('GET', '/notes/eae485474234')).childNoteIds.sort(), ['KThC5jtnOOCu', 'ZrxUIJf75kFS', 'vSL4REvviPe2', 'e6856b492955'].sort());
        console.log('PASS native render, six real tool links, merged navigation and original children preserved');

        await button('编辑布局');
        await until(`!!document.querySelector('.hp-root.is-editing')`);
        const from = await rect('.hp-card[data-kind="workbench"] .hp-card-header');
        const to = await rect('.hp-card[data-kind="tasks"] .hp-card-header');
        await drag({ x: from.left + 65, y: from.top + 20 }, { x: to.left + 8, y: to.top + 20 });
        assert.deepEqual(await ev(`[...document.querySelectorAll('.hp-grid>.hp-card')].slice(1,3).map(e=>e.dataset.kind)`), ['workbench', 'tasks']);
        const resize = await rect('.hp-card[data-kind="pomodoro"] .hp-card-resize');
        const unit = await ev(`(()=>{const s=getComputedStyle(document.querySelector('.hp-grid'));return {x:parseFloat(s.gridTemplateColumns)+parseFloat(s.columnGap),y:parseFloat(s.gridAutoRows)+parseFloat(s.rowGap)};})()`);
        await drag({ x: resize.x, y: resize.y }, { x: resize.x + unit.x, y: resize.y + unit.y });
        assert.equal(await ev(`document.querySelector('.hp-card[data-kind="pomodoro"]').style.getPropertyValue('--hp-card-w')`), '5');
        assert.equal(await ev(`document.querySelector('.hp-card[data-kind="pomodoro"]').style.getPropertyValue('--hp-card-h')`), '4');
        const again = await rect('.hp-card[data-kind="pomodoro"] .hp-card-resize');
        await drag({ x: again.x, y: again.y }, { x: again.x + unit.x, y: again.y + unit.y }, true);
        assert.equal(await ev(`document.querySelector('.hp-card[data-kind="pomodoro"]').style.getPropertyValue('--hp-card-w')`), '5');
        assert.equal(await ev(`document.querySelectorAll('.hp-resize-frame,.hp-sort-ghost').length`), 0);
        console.log('PASS actual mouse drag reorder, snap resize and Escape rollback');

        await click('.hp-card[data-kind="recent"] button[aria-label="复制组件"]');
        assert.equal(await ev(`document.querySelectorAll('.hp-grid>.hp-card').length`), 12);
        await ev(`document.querySelectorAll('.hp-card[data-kind="recent"]')[1].querySelector('button[aria-label="移除组件（保留原笔记）"]').click()`);
        await until(`document.querySelectorAll('.hp-grid>.hp-card').length===11`);
        await button('添加组件');
        await until(`!!document.querySelector('.ehd-widget-catalog')`);
        await screenshot('add-components-native.png');
        await ev(`[...document.querySelectorAll('.ehd-widget-choice')].find(e=>e.querySelector('b').textContent==='快速记录').click()`);
        await until(`!!document.querySelector('.hp-card[data-kind="capture"]')`);
        await button('完成');
        await until(`!document.querySelector('.hp-root.is-editing') && document.querySelector('.ehd-save-status').textContent==='布局已保存'`);
        let persisted = JSON.parse(await api('GET', '/notes/HmHomeData01/content', undefined, true));
        assert.equal(persisted.layout.pages[0].widgets[1].kind, 'workbench');
        assert.equal(persisted.layout.pages[0].widgets.find(w => w.kind === 'pomodoro').w, 5);
        await cmd('Page.reload'); await pause(1100);
        await until(`document.querySelectorAll('.hp-grid>.hp-card').length===12 && !!document.querySelector('.hp-card[data-kind="capture"]')`);
        assert.equal(await ev(`document.querySelector('.hp-card[data-kind="pomodoro"]').style.getPropertyValue('--hp-card-w')`), '5');
        console.log('PASS copy/remove/add components and database persistence across native page reload');

        const noteTitle = `首页验收记录 ${Date.now()}`;
        await ev(`(()=>{const e=document.querySelector('.ehd-capture textarea');e.value=${JSON.stringify(noteTitle + '\n<literal markup>')};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
        await click('.ehd-capture .hp-button');
        await until(`document.querySelector('.ehd-capture .ehd-inline-status')?.textContent.startsWith('已保存')`);
        const inbox = await api('GET', '/notes/e6856b492955');
        for (const id of inbox.childNoteIds) { const note = await api('GET', `/notes/${id}`); if (note.title === noteTitle) fixtures.push(id); }
        assert.equal(fixtures.length, 1);
        const content = await api('GET', `/notes/${fixtures[0]}/content`, undefined, true);
        assert(content.includes('&lt;literal markup&gt;'), 'Quick capture must preserve literal markup as text');

        const created = await api('POST', '/create-note', { parentNoteId: '52Z91MOBH5g9', title: '首页验收任务', type: 'text', content: '<p>Only in the isolated database.</p>' });
        const taskId = created.note.noteId; fixtures.push(taskId);
        await api('POST', '/attributes', { noteId: taskId, type: 'label', name: 'todoItem', value: '' });
        await click('.ehd-page-actions button[aria-label="刷新首页数据"]');
        await until(`[...document.querySelectorAll('.ehd-task-open')].some(e=>e.textContent.includes('首页验收任务'))`);
        await ev(`[...document.querySelectorAll('.ehd-task-row')].find(e=>e.textContent.includes('首页验收任务')).querySelector('.ehd-task-check').click()`);
        for (let i = 0; i < 60; i++) { if ((await api('GET', `/notes/${taskId}`)).parentNoteIds.includes('VRagMKcXpZ6N')) break; await pause(150); }
        assert((await api('GET', `/notes/${taskId}`)).parentNoteIds.includes('VRagMKcXpZ6N'));
        console.log('PASS capture creates an ordinary inbox note with escaped text; ToDo completion updates its real status branch');

        await ev(`window.MyoPomodoro.reset()`);
        await pause(80);
        await ev(`document.querySelector('.ehd-pomo-start').click()`);
        await until(`window.MyoPomodoro?.snapshot().status==='running'`);
        await ev(`(async()=>{window.homeTestApp=(await import('trilium-app://app/src/content_renderer-BMc4Ylfn.js')).K;await window.homeTestApp.tabManager.openInSameTab('vSL4REvviPe2','root');})()`);
        await until(`window.homeTestApp.tabManager.getActiveContext().noteId==='vSL4REvviPe2'`);
        assert.equal(await ev(`window.MyoPomodoro.snapshot().status`), 'running');
        await ev(`window.MyoPomodoro.pause();window.MyoPomodoro.reset();window.homeTestApp.tabManager.openInSameTab('HmeDashboard','root')`);
        await until(`!!document.querySelector('.eric-home-dashboard')`);
        console.log('PASS existing Pomodoro continues when navigating away from the dashboard');

        await button('编辑布局');
        await button('完成');
        await until(`!document.querySelector('.hp-root.is-editing')`);
        await ev(`document.querySelector('.hp-tab-add').click()`);
        await until(`!!document.querySelector('.ehd-modal input')`);
        await ev(`(()=>{const e=document.querySelector('.ehd-modal input');e.value='项目页';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
        await button('应用', '.ehd-modal');
        await until(`document.querySelectorAll('.hp-tab:not(.hp-tab-add)').length===2`);
        await button('添加组件');
        await ev(`[...document.querySelectorAll('.ehd-widget-choice')].find(e=>e.querySelector('b').textContent==='最近笔记').click()`);
        await button('完成');
        await until(`!document.querySelector('.hp-root.is-editing')`);
        await cmd('Page.reload'); await pause(1100);
        await until(`document.querySelector('.hp-tab.is-active')?.textContent.includes('项目页')`);
        assert.equal(await ev(`document.querySelectorAll('.hp-grid>.hp-card').length`), 1);
        await ev(`document.querySelector('.hp-tab:not(.hp-tab-add)').click()`);
        await until(`document.querySelectorAll('.hp-grid>.hp-card').length===12`);
        console.log('PASS independent pages and active page survive reload');

        await button('编辑布局');
        persisted = JSON.parse(await api('GET', '/notes/HmHomeData01/content', undefined, true));
        const concurrent = { ...persisted, revision: persisted.revision + 1 };
        await api('PUT', '/notes/HmHomeData01/content', JSON.stringify(concurrent), true);
        await button('完成');
        await until(`document.querySelector('.ehd-save-status').textContent.includes('另一窗口')`);
        assert.equal(JSON.parse(await api('GET', '/notes/HmHomeData01/content', undefined, true)).revision, concurrent.revision);
        await button('取消');
        console.log('PASS concurrent layout change is rejected without overwriting the newer state');

        await cmd('Page.reload'); await pause(1100);
        await until(`document.querySelectorAll('.hp-grid>.hp-card').length===12`);
        await ev(`document.querySelector('.eric-home-dashboard').parentElement.scrollTop=0`);
        await screenshot('home-pages-light-native.png');
        if (!await ev(`document.body.classList.contains('dark-theme')`)) await ev(`document.querySelector('.myo-day-night-icon').click()`);
        await until(`document.body.classList.contains('dark-theme')`);
        const dark = await ev(`getComputedStyle(document.querySelector('.hp-card')).backgroundColor`);
        assert.notEqual(dark, 'rgb(255, 255, 255)');
        await screenshot('home-pages-dark-native.png');
        if (await ev(`document.body.classList.contains('dark-theme')`)) await ev(`document.querySelector('.myo-day-night-icon').click()`);
        await until(`document.body.classList.contains('light-theme')`);
        await cmd('Emulation.setDeviceMetricsOverride', { width: 800, height: 1050, deviceScaleFactor: 1, mobile: false });
        await pause(180);
        const dimensions = await ev(`(()=>{const root=document.querySelector('.hp-root'),grid=document.querySelector('.hp-grid'),card=grid.querySelector('.hp-card');return {root:root.clientWidth,scroll:root.scrollWidth,grid:grid.clientWidth,card:card.getBoundingClientRect().width,tracks:getComputedStyle(grid).gridTemplateColumns.split(' ').length};})()`);
        assert(dimensions.scroll <= dimensions.root + 1);
        assert.equal(dimensions.tracks, 6);
        assert(Math.abs(dimensions.grid - dimensions.card) < 3);
        await screenshot('home-pages-narrow-native.png');
        console.log('PASS native light/dark themes and narrow note-pane single-column reflow');
        console.log('ALL HOME PAGES ACCEPTANCE CHECKS PASSED');
    } finally {
        await ev(`window.MyoPomodoro?.reset()`).catch(() => {});
        for (const id of fixtures) await api('DELETE', `/notes/${id}`).catch(() => {});
        await api('PUT', '/notes/HmHomeData01/content', stateBefore, true).catch(() => {});
        await cmd('Emulation.clearDeviceMetricsOverride').catch(() => {});
        ws.close();
    }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
