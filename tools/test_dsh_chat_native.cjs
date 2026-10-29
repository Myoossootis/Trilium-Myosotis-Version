// Integration checks on the isolated Trilium, using only our dedicated DSH test session.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
    const { sessionId } = JSON.parse(fs.readFileSync('tmp/dsh-chat-test-session.json', 'utf8'));
    const marker = `TRILIUM_FOLLOWUP_${Date.now()}`;
    const browser = await chromium.connectOverCDP('http://127.0.0.1:37842');
    const page = browser.contexts()[0].pages().find(page => page.url().startsWith('trilium-app:'));
    assert(page, 'Use the isolated native app');
    try {
        await page.evaluate(id => localStorage.setItem('eric.dsh-chat.ui.v1', JSON.stringify({ sessionId: id })), sessionId);
        await page.reload();
        const root = page.locator('#trilium-dsh-chat');
        await root.waitFor({ state: 'attached' });
        await root.locator('.launch').click();
        await root.locator('.status').filter({ hasText: '已连接 DSH' }).waitFor({ timeout: 30000 });
        await root.locator('.message').filter({ hasText: 'TRILIUM_DSH_OK' }).first().waitFor();
        assert.equal(await root.locator('textarea').count(), 1);
        assert.equal(await root.locator('input[type=checkbox]').count(), 0);
        console.log('PASS native startup, authenticated backend bridge and actual DSH history');
        await root.locator('.input').fill(`继续连通性测试。只回复 ${marker}，不调用任何工具。`);
        await root.locator('.send').click();
        await root.locator('.message.assistant').filter({ hasText: marker }).first().waitFor({ timeout: 45000 });
        console.log('PASS actual model response and follow-up in the same DSH session');
        await root.locator('.minimize').click();
        assert(await root.locator('.chat').isHidden());
        await root.locator('.launch').click();
        assert(await root.locator('.chat').isVisible());
        await root.locator('.history-toggle').click();
        await root.locator('.session').first().waitFor();
        await root.locator('.history-close').click();
        const oldSize = await root.locator('.chat').boundingBox();
        await root.locator('.resize').focus(); await page.keyboard.press('ArrowLeft');
        assert((await root.locator('.chat').boundingBox()).width > oldSize.width);
        await page.evaluate(() => {
            const dialog = document.createElement('dialog'); dialog.id = 'dsh-chat-test-modal';
            dialog.textContent = 'Isolated modal test'; document.body.append(dialog); dialog.showModal();
        });
        await page.waitForFunction(() => document.querySelector('#trilium-dsh-chat')?.parentElement?.id === 'dsh-chat-test-modal');
        await root.locator('.input').fill('测试草稿');
        assert.equal(await root.locator('.input').inputValue(), '测试草稿');
        await page.evaluate(() => { const dialog = document.querySelector('#dsh-chat-test-modal'); dialog.close(); });
        await page.waitForFunction(() => document.querySelector('#trilium-dsh-chat')?.parentElement === document.body);
        await page.evaluate(() => document.querySelector('#dsh-chat-test-modal').remove());
        console.log('PASS minimize/history/resize and keyboard input above native modal dialogs');
        await root.locator('.input').fill('');
        await page.reload(); await root.waitFor({ state: 'attached' }); await root.locator('.launch').click();
        await root.locator('.message.assistant').filter({ hasText: marker }).first().waitFor({ timeout: 20000 });
        console.log('PASS selected DSH session and its conversation survive reload');
        fs.mkdirSync('output/dsh-chat', { recursive: true });
        await page.screenshot({ path: 'output/dsh-chat/native-chat.png' });
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
