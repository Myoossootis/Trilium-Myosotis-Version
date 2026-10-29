// A compact entry beside Trilium's native right-pane switch. No floating overlay.
const deepseekWhale = (await (await api.getNote('DsChatIcon01')).getContent()).replace('fill="#000"','fill="currentColor"');
module.exports = class extends api.BasicWidget {
    static get parentWidget() { return 'left-pane'; }
    get position() { return 1; }
    doRender() {
        this.$widget = $('<div hidden></div>'); this.contentSized();
        let disposed = false, frame, resizeFrame, pointerWasVisible;
        const button = document.createElement('button');
        button.type = 'button'; button.id = 'dsh-sidebar-entry'; button.className = 'icon-action';
        button.title = 'DeepSeek · 右侧面板'; button.setAttribute('aria-label', '打开 DeepSeek 右侧面板');
        button.innerHTML = deepseekWhale + '<span>DeepSeek</span>';
        const whale=button.querySelector('svg');whale.setAttribute('width','20');whale.setAttribute('height','20');whale.setAttribute('aria-hidden','true');
        button.style.cssText = 'display:inline-flex;align-items:center;gap:5px;flex-shrink:0;width:auto;padding:4px 8px;font-size:12px;color:var(--main-text-color);';
        const open = (value = true) => {
            const visible = document.querySelector('#trilium-dsh-chat')?.checkVisibility();
            if (value && visible) return;
            if (!value && !visible) return;
            const paneVisible = document.querySelector('#right-pane')?.checkVisibility();
            const widgetsVisible = document.querySelector('#DsChatBoot1')?.checkVisibility();
            api.triggerCommand('selectRightPaneTab', { tabId: 'widgets', peek: !!(value && (innerWidth < 760 || paneVisible && widgetsVisible)), expandWidgetId: 'DsChatBoot1' });
        };
        const pointerDown = event => { if (button.contains(event.target)) pointerWasVisible = !!document.querySelector('#trilium-dsh-chat')?.checkVisibility(); };
        window.addEventListener('pointerdown', pointerDown, true);
        button.onclick = () => { open(!(pointerWasVisible ?? document.querySelector('#trilium-dsh-chat')?.checkVisibility())); pointerWasVisible = undefined; };
        const attach = () => {
            if (disposed) return;
            const toggle = document.querySelector('.right-pane-toggle-button');
            if (toggle && button.nextElementSibling !== toggle) toggle.before(button);
            button.setAttribute('aria-pressed', String(!!document.querySelector('#trilium-dsh-chat')?.checkVisibility()));
        };
        const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(attach); });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        const resize = () => {
            if (innerWidth >= 760 || !document.querySelector('#trilium-dsh-chat')?.checkVisibility() || !document.querySelector('#right-pane.right-pane-mode-docked')) return;
            // Use the native temporary pane on small windows, retaining the same client.
            api.triggerCommand('peekRightPane');
            resizeFrame = requestAnimationFrame(() => { if (!disposed) open(true); });
        };
        window.addEventListener('resize', resize);
        attach();
        const controller = { open, destroy() { disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame); window.removeEventListener('resize', resize); window.removeEventListener('pointerdown', pointerDown, true); observer.disconnect(); button.remove(); if (window.TriliumDshChat === controller) delete window.TriliumDshChat; } };
        this.controller = controller; window.TriliumDshChat = controller;
    }
    cleanup() { this.controller?.destroy(); }
};
