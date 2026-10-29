// Real native Trilium + DSH test; all prompts belong to the dedicated test session.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const configuration = JSON.parse(fs.readFileSync(process.env.USERPROFILE + '/.trilium-dsh-bridge/connection.json', 'utf8'));
const original = JSON.parse(fs.readFileSync('tmp/dsh-model-original.json', 'utf8'));
const { sessionId } = JSON.parse(fs.readFileSync('tmp/dsh-chat-test-session.json', 'utf8'));
async function rpc(action, body = {}) {
    const response = await fetch('http://127.0.0.1:37846/rpc', { method: 'POST', headers: { Authorization: configuration.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
    const value = await response.json(); if (!response.ok) throw Error(value.error); return value.result;
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:37842');
    const page = browser.contexts()[0].pages().find(page => page.url().startsWith('trilium-app:'));
    assert(page, 'Use the isolated Trilium');
    const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[crypto.randomInt(30)]).join('');
    const originalWindow = page.viewportSize();
    try {
        await page.evaluate(id => localStorage.setItem('eric.dsh-chat.ui.v1', JSON.stringify({ sessionId: id })), sessionId);
        await page.reload();
        const root = page.locator('#trilium-dsh-chat'); await root.waitFor({ state: 'attached' }); await root.locator('.launch').click();
        await root.locator('.status').filter({ hasText: '已连接 DSH' }).waitFor({ timeout: 30000 });
        await page.waitForFunction(() => document.querySelector('#trilium-dsh-chat').shadowRoot.querySelector('.model-select').options.length >= 2);
        const catalog = await rpc('models');
        const alternate = catalog.groups.flatMap(group => group.models.map(model => ({ provider: group.id, model: model.id }))).find(item => item.provider === original.provider && item.model !== original.model);
        assert(alternate);
        await root.locator('.model-select').selectOption(JSON.stringify([alternate.provider, alternate.model]));
        for (let i = 0; i < 40; i++) { if ((await rpc('view', { sessionId })).selection?.model === alternate.model) break; await wait(100); }
        assert.equal((await rpc('view', { sessionId })).selection.model, alternate.model);
        await page.reload(); await root.waitFor({ state: 'attached' }); await root.locator('.launch').click();
        await page.waitForFunction(key => document.querySelector('#trilium-dsh-chat').shadowRoot.querySelector('.model-select').value === key, JSON.stringify([alternate.provider, alternate.model]));
        console.log('PASS real DSH model catalog, model change and selection persistence');
        await rpc('model', { sessionId, ...original });
        await page.waitForFunction(key => document.querySelector('#trilium-dsh-chat').shadowRoot.querySelector('.model-select').value === key, JSON.stringify([original.provider, original.model]));
        const data = await page.evaluate(code => {
            const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 320;
            const context = canvas.getContext('2d'); const pixels = context.createImageData(640, 320); let seed = 42;
            for (let i = 0; i < pixels.data.length; i += 4) { for (let channel = 0; channel < 3; channel++) { seed = (seed * 1664525 + 1013904223) >>> 0; pixels.data[i + channel] = seed >>> 24; } pixels.data[i + 3] = 255; }
            context.putImageData(pixels, 0, 0); context.fillStyle = 'white'; context.fillRect(25, 70, 590, 180);
            context.fillStyle = 'black'; context.font = 'bold 100px monospace'; context.textAlign = 'center'; context.fillText(code, 320, 192);
            return canvas.toDataURL('image/png').split(',')[1];
        }, code);
        const buffer = Buffer.from(data, 'base64'); assert(buffer.length > 64 * 1024);
        fs.writeFileSync('tmp/dsh-chat-media-fixture.png', buffer);
        // Deliberately mislabel a PNG as JPEG: rejection must retain the draft and never reach the model.
        const before = await rpc('view', { sessionId });
        await root.locator('.image-files').setInputFiles({ name: 'invalid.jpg', mimeType: 'image/jpeg', buffer });
        await root.locator('.attachment').waitFor(); await root.locator('.input').fill('格式校验测试，不应发送给模型。');
        await root.locator('.send').click(); await root.locator('.error-text').filter({ hasText: '格式不一致' }).waitFor();
        await wait(1400);
        assert((await root.locator('.error-text').textContent()).includes('格式不一致'), 'History polling must not erase a send error');
        assert.equal(await root.locator('.attachment').count(), 1);
        assert.equal(await root.locator('.input').inputValue(), '格式校验测试，不应发送给模型。');
        assert.equal((await rpc('view', { sessionId })).messages.filter(m => m.role === 'user').length, before.messages.filter(m => m.role === 'user').length);
        await root.locator('.remove-image').click();
        await root.locator('.image-files').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer });
        await root.locator('.attachment').waitFor();
        await root.locator('.input').evaluate((input, data) => {
            const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0)), transfer = new DataTransfer();
            transfer.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }));
            input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
        }, data);
        await page.waitForFunction(() => document.querySelector('#trilium-dsh-chat').shadowRoot.querySelectorAll('.attachment').length === 2);
        await root.locator('.remove-image').last().click();
        console.log('PASS image selection, simulated clipboard event, removal and failed-send draft preservation');
        await root.locator('.input').fill('请只读出图片中唯一的四位英文字母数字码，不调用任何工具。');
        await root.locator('.send').click();
        await root.locator('.message.assistant').filter({ hasText: code }).first().waitFor({ timeout: 60000 });
        const messages = (await rpc('view', { sessionId })).messages;
        assert(messages.some(message => message.role === 'user' && message.images?.length === 1));
        await page.waitForFunction(() => [...document.querySelector('#trilium-dsh-chat').shadowRoot.querySelectorAll('.chat-image')].some(image => image.complete && image.naturalWidth > 0));
        assert.equal(await root.locator('.attachment').count(), 0);
        const view = await rpc('view', { sessionId }); assert(view.usage && view.usage.inputTokens > before.usage.inputTokens);
        const label = '会话缓存命中 ' + (view.usage.cacheHitRate * 100).toFixed(1) + '%';
        await root.locator('.foot-status').filter({ hasText: label }).waitFor();
        console.log(`PASS real vision response for a ${Math.round(buffer.length / 1024)} KB image; native historical thumbnail; provider-backed cumulative cache rate`);
        await page.reload(); await root.waitFor({ state: 'attached' }); await root.locator('.launch').click();
        await root.locator('.message.assistant').filter({ hasText: code }).first().waitFor({ timeout: 20000 });
        await page.waitForFunction(() => [...document.querySelector('#trilium-dsh-chat').shadowRoot.querySelectorAll('.chat-image')].some(image => image.naturalWidth > 0));
        await root.locator('.foot-status').filter({ hasText: label }).waitFor();
        console.log('PASS actual picture history, current model and cache metrics survive reload');
        fs.mkdirSync('output/dsh-chat', { recursive: true }); await page.screenshot({ path: 'output/dsh-chat/native-media.png' });
    } finally {
        await rpc('stop', { sessionId }).catch(() => {});
        for (let i = 0; i < 30; i++) { if (!(await rpc('view', { sessionId })).running) break; await wait(100); }
        await rpc('model', { sessionId, ...original });
        const restored = await rpc('models'); assert.deepEqual(restored.default, original, 'Restore the original DSH deployment default');
        if (originalWindow) await page.setViewportSize(originalWindow);
        await browser.close(); console.log('Original DSH model and effort restored');
    }
})().catch(error => { console.error(error); process.exit(1); });
