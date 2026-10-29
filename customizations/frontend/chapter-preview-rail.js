/* A quiet, Codex-like outline rail. All UI lives outside the note/editor DOM. */
(() => {
    if (window.__myosotisChapterRail) return;
    const SELECTOR = 'h1,h2,h3,h4,h5,h6';
    const text = element => (element.textContent || '').trim().replace(/\s+/g, ' ');
    const activeIndex = (positions, y) => {
        let low = 0, high = positions.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (positions[middle] <= y) low = middle + 1; else high = middle;
        }
        return Math.max(0, low - 1);
    };
    const tickWidth = level => Math.max(5, 21 - level * 3);
    window.__myosotisChapterRail = { activeIndex, tickWidth, version: 'visible-content-instant-v3' };
    const style = document.createElement('style');
    style.textContent = `
        .myo-chapter-rail { position:fixed; z-index:80; width:24px; display:flex;
            flex-direction:column; justify-content:space-between; pointer-events:auto;
            transform:translateY(-50%); }
        .myo-chapter-tick { appearance:none; border:0; background:transparent; padding:0;
            width:24px; flex:1; min-height:0; max-height:16px; cursor:pointer;
            display:flex; align-items:center; justify-content:flex-end; pointer-events:auto; }
        .myo-chapter-tick::before { content:''; width:var(--compact-width); height:2px;
            border-radius:2px; background:var(--main-text-color,#303030); opacity:.18;
            transition:opacity 120ms ease,width 120ms ease; }
        .myo-chapter-tick[data-active]::before { opacity:.8; height:3px; width:8px; }
        .myo-chapter-tick:hover::before,.myo-chapter-tick[data-hovered]::before,.myo-chapter-tick:focus-visible::before {
            opacity:1; width:var(--tick-width); }
        .myo-chapter-tick:focus-visible { outline:1px solid var(--main-text-color,#555); border-radius:3px; }
        .myo-chapter-preview { position:fixed; z-index:1100; box-sizing:border-box;
            width:300px; max-width:calc(100vw - 48px); padding:12px 14px; border-radius:12px;
            color:var(--main-text-color,#242424); background:var(--main-background-color,#fff);
            border:1px solid var(--main-border-color,#e5e5e5); box-shadow:0 5px 18px #00000012;
            pointer-events:none; font:13px/1.6 var(--main-font-family,system-ui); }
        .myo-chapter-preview strong { display:block; font-size:13px; font-weight:600;
            margin-bottom:4px; overflow-wrap:anywhere; }
        .myo-chapter-preview p { margin:0; opacity:.6; overflow-wrap:anywhere; }
        .myo-chapter-preview small { display:block; margin-top:6px; opacity:.4; font-size:11px; }
        @media (prefers-reduced-motion:reduce) { .myo-chapter-tick::before,.myo-chapter-rail { transition:none; } }
    `;
    document.head.append(style);
    const measuringStyle = document.createElement('style');
    document.head.append(measuringStyle);
    const preview = document.createElement('aside');
    preview.className = 'myo-chapter-preview';
    preview.hidden = true;
    preview.setAttribute('aria-hidden', 'true');
    document.body.append(preview);
    const states = new Map();
    let frame, scanTimer, previewTimer;
    const rendered = element => {
        if (!element?.isConnected || !element.getClientRects().length) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    };
    // Read-only and temporary-edit views can coexist in the same note split.
    // The first .ck-content may be a hidden snapshot with all-zero rectangles.
    const visibleContent = root => [...(root?.querySelectorAll('.ck-content') || [])]
        .find(content => rendered(content) && rendered(content.closest('.scrolling-container')));
    function hidePreview() { clearTimeout(previewTimer); preview.hidden = true; }
    function showPreview(state, index, button) {
        hidePreview();
        previewTimer = setTimeout(() => {
            if (!button.isConnected || !state.root.getClientRects().length) return;
            const entry = state.entries[index];
            preview.replaceChildren();
            const title = document.createElement('strong'); title.textContent = entry.title;
            const summary = document.createElement('p'); summary.textContent = entry.summary || '此章节暂无正文摘要';
            const hint = document.createElement('small'); hint.textContent = `${entry.level} 级标题 · 点击跳转`;
            preview.append(title, summary, hint);
            preview.hidden = false;
            const rect = button.getBoundingClientRect();
            preview.style.left = `${Math.max(8, Math.min(innerWidth - preview.offsetWidth - 8, rect.left - preview.offsetWidth - 10))}px`;
            preview.style.top = `${Math.max(8, Math.min(innerHeight - preview.offsetHeight - 8, rect.top - 12))}px`;
        }, 220);
    }
    function measure(state) {
        if (!rendered(state.content) || !rendered(state.scroller) || visibleContent(state.root) !== state.content) {
            state.measured = false;
            state.rail.style.display = 'none';
            return false;
        }
        const headings = [...state.content.querySelectorAll(SELECTOR)].filter(element => text(element));
        if (headings.length > 300) headings.length = 300;
        // CSSOM-only measurement: temporarily unfreeze headings without modifying
        // editor nodes, their styles, model, selection or saved HTML.
        const rule = `.note-split[data-ntx-id="${CSS.escape(state.id)}"] .ck-content :is(${SELECTOR}) { position:static!important;top:auto!important; }`;
        const sheet = measuringStyle.sheet;
        const ruleIndex = sheet.insertRule(rule, sheet.cssRules.length);
        try {
            const base = state.scroller.getBoundingClientRect().top;
            state.positions = headings.map(heading => heading.getBoundingClientRect().top - base + state.scroller.scrollTop);
        } finally { sheet.deleteRule(ruleIndex); }
        state.measured = state.positions.every(Number.isFinite);
        const entries = headings.map(heading => {
            const level = Number(heading.tagName.slice(1));
            let summary = '';
            let sibling = heading.nextElementSibling;
            while (sibling && summary.length < 180 && !/^H[1-6]$/.test(sibling.tagName)) {
                summary += `${text(sibling)} `;
                sibling = sibling.nextElementSibling;
            }
            return { heading, level, title: text(heading), summary: summary.trim().slice(0, 180) };
        });
        const unchanged = entries.length === state.entries.length && entries.every((entry, index) => {
            const old = state.entries[index];
            return entry.heading === old.heading && entry.title === old.title && entry.summary === old.summary;
        });
        state.entries = entries;
        if (unchanged) { scheduleLayout(); return state.measured; }
        hidePreview();
        state.rail.replaceChildren();
        state.entries.forEach((entry, index) => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'myo-chapter-tick';
            button.style.setProperty('--tick-width', `${tickWidth(entry.level) + 5}px`);
            button.style.setProperty('--compact-width', `${Math.max(3, Math.round(tickWidth(entry.level) * .35))}px`);
            button.setAttribute('aria-label', `跳转到 ${entry.title}`);
            button.addEventListener('pointerenter', () => {
                button.setAttribute('data-hovered', ''); showPreview(state, index, button);
            });
            button.addEventListener('pointerleave', () => {
                button.removeAttribute('data-hovered'); hidePreview();
            });
            button.addEventListener('focus', () => showPreview(state, index, button));
            button.addEventListener('blur', hidePreview);
            button.addEventListener('mousedown', event => event.preventDefault());
            button.addEventListener('click', () => {
                hidePreview();
                // Layout can change between resize/mutation observation and this
                // click (tab activation, mode switch, image load or frozen titles).
                // Measure the clicked heading in its current, visible DOM before
                // using cached positions. Never coerce invalid/hidden geometry to 0.
                if (!entry.heading.isConnected || !state.content.contains(entry.heading) || !measure(state)) return;
                const targetIndex = state.entries.findIndex(item => item.heading === entry.heading);
                const position = state.positions[targetIndex];
                if (targetIndex < 0 || !Number.isFinite(position)) return;
                state.scroller.dispatchEvent(new CustomEvent('myosotis-reference-jump', {
                    bubbles: true, detail: { noteId: state.noteId }
                }));
                // 'auto' inherits the application's global smooth-scroll rule.
                // Navigation is an explicit jump, not a long running animation.
                state.scroller.scrollTo({ top: Math.max(0, position - 105), behavior: 'instant' });
                layout();
            });
            state.rail.append(button);
        });
        layout();
        return state.measured;
    }
    function layout() {
        frame = null;
        for (const state of states.values()) {
            const rect = state.scroller.getBoundingClientRect();
            const visible = rendered(state.content) && state.measured && rect.width >= 320 && rect.height >= 180 && state.entries.length;
            state.rail.style.display = visible ? 'flex' : 'none';
            if (!visible) continue;
            const height = Math.min(rect.height - 120, Math.max(80, state.entries.length * 12));
            const scrollbarWidth = Math.max(0, state.scroller.offsetWidth - state.scroller.clientWidth);
            state.rail.style.left = `${rect.right - scrollbarWidth - 24 - 3}px`;
            // Keep the midpoint fixed as additional headings expand both ends.
            state.rail.style.top = `${rect.top + rect.height / 2}px`;
            state.rail.style.height = `${height}px`;
            const active = activeIndex(state.positions, state.scroller.scrollTop + 110);
            [...state.rail.children].forEach((button, index) => {
                button.toggleAttribute('data-active', index === active);
                if (index === active) button.setAttribute('aria-current', 'location');
                else button.removeAttribute('aria-current');
            });
        }
    }
    function scheduleLayout() { if (!frame) frame = requestAnimationFrame(layout); }
    function dispose(state) {
        clearTimeout(state.timer);
        state.observer.disconnect(); state.resize.disconnect();
        state.scroller.removeEventListener('scroll', state.onScroll);
        state.rail.remove(); hidePreview();
    }
    function scan() {
        const contexts = api.getNoteContexts();
        const live = new Set();
        for (const context of contexts) {
            const root = [...document.querySelectorAll('.note-split[data-ntx-id]')].find(element => element.dataset.ntxId === context.ntxId);
            const content = visibleContent(root);
            const scroller = content?.closest('.scrolling-container');
            const old = states.get(context.ntxId);
            if (context.note?.type !== 'text' || !content || !scroller) continue;
            live.add(context.ntxId);
            if (old?.content === content && old.noteId === context.note.noteId && old.scroller === scroller) {
                if (!old.measured) measure(old);
                continue;
            }
            if (old) dispose(old);
            const rail = document.createElement('nav'); rail.className = 'myo-chapter-rail';
            rail.setAttribute('aria-label', '章节分级预览导航'); document.body.append(rail);
            const state = { id: context.ntxId, noteId: context.note.noteId, root, content, scroller, rail,
                entries: [], positions: [], measured: false };
            rail.addEventListener('pointerleave', hidePreview);
            const refresh = () => { clearTimeout(state.timer); state.timer = setTimeout(() => measure(state), 180); };
            state.observer = new MutationObserver(refresh);
            state.observer.observe(content, { childList: true, subtree: true, characterData: true });
            state.resize = new ResizeObserver(refresh); state.resize.observe(scroller); state.resize.observe(content);
            state.onScroll = () => {
                if (!rail.querySelector('[data-hovered]')) hidePreview();
                scheduleLayout();
            };
            scroller.addEventListener('scroll', state.onScroll, { passive: true });
            states.set(context.ntxId, state); measure(state);
        }
        for (const [id, state] of states) if (!live.has(id)) { dispose(state); states.delete(id); }
        scheduleLayout();
    }
    const observer = new MutationObserver(records => {
        if (!records.some(record => record.type === 'childList' || record.target === document.body ||
            record.target.closest?.('.note-split[data-ntx-id]'))) return;
        clearTimeout(scanTimer); scanTimer = setTimeout(scan, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'contenteditable'] });
    window.addEventListener('resize', () => { hidePreview(); scheduleLayout(); }, { passive: true });
    document.addEventListener('click', scheduleLayout, { passive: true });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') hidePreview(); });
    scan();
})();
