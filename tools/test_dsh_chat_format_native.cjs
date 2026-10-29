// Read-only: use the exact conversation reported by the user; no model prompts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/杜锦鸿/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
    const { sessionId } = JSON.parse(fs.readFileSync('tmp/dsh-chat-formula-session.json', 'utf8'));
    const browser = await chromium.connectOverCDP('http://127.0.0.1:37842');
    const page = browser.contexts()[0].pages().find(page => page.url().startsWith('trilium-app:'));
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let toggled = false;
    try {
        await page.evaluate(id => localStorage.setItem('eric.dsh-chat.ui.v1', JSON.stringify({ sessionId: id })), sessionId);
        await page.reload();
        const root = page.locator('#trilium-dsh-chat'); await root.waitFor({ state: 'attached' }); await root.locator('.launch').click();
        await root.locator('.status').filter({ hasText: '已连接 DSH' }).waitFor({ timeout: 20000 });
        await root.locator('math').first().waitFor();
        const original = await root.locator('.log').evaluate(log => ({ formulas: log.querySelectorAll('math').length, display: log.querySelectorAll('.ds-math-display').length, strong: log.querySelectorAll('strong').length, tables: log.querySelectorAll('table').length, errors: log.querySelectorAll('.ds-math-error').length, namespace: log.querySelector('math').namespaceURI }));
        assert.equal(original.formulas, 12); assert.equal(original.display, 3); assert(original.strong > 0 && original.tables > 0); assert.equal(original.errors, 0);
        assert.equal(original.namespace, 'http://www.w3.org/1998/Math/MathML');
        await root.locator('.log').evaluate(log => { const formula = log.querySelector('.ds-math-display'); log.scrollTop += formula.getBoundingClientRect().top - log.getBoundingClientRect().top - 50; });
        fs.mkdirSync('output/dsh-chat', { recursive: true });
        await page.screenshot({ path: 'output/dsh-chat/native-formulas-detail.png' });
        console.log('PASS exact reported history: 12 native formulas, 3 display formulas, Markdown headings/bold/table, no formula errors');
        const color = await root.locator('math').first().evaluate(math => getComputedStyle(math).color);
        await page.locator('.myo-day-night-icon').click(); toggled = true;
        await page.waitForTimeout(150);
        assert.notEqual(await root.locator('math').first().evaluate(math => getComputedStyle(math).color), color);
        await page.screenshot({ path: 'output/dsh-chat/native-formulas-dark.png' });
        for (const width of [736, 320]) {
            await page.setViewportSize({ width, height: 1000 });
            const overflow = await root.locator('.log').evaluate(log => log.scrollWidth - log.clientWidth);
            assert(overflow <= 1, `Formula/table content must not widen the chat at ${width}px`);
        }
        console.log('PASS theme-aware native math and 320–736px formula/table containment');
        await page.locator('.myo-day-night-icon').click(); toggled = false;
        await page.setViewportSize({ width: 1100, height: 900 });
        await page.reload(); await root.waitFor({ state: 'attached' }); await root.locator('.launch').click();
        await root.locator('math').first().waitFor({ timeout: 20000 });
        assert.equal(await root.locator('math').count(), original.formulas);
        assert(await root.locator('.image-picker').isVisible());
        assert((await root.locator('.model-select option').count()) >= 2);
        assert((await root.locator('.foot-status').textContent()).includes('缓存命中'));
        assert.deepEqual(errors, []);
        console.log('PASS reload, image/model/cache controls and no JavaScript errors; no model requests sent');
    } finally {
        if (toggled) await page.locator('.myo-day-night-icon').click().catch(() => {});
        await browser.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
