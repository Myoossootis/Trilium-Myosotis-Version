/* Paragraph/heading references. No whole-note rewrite, selection or clipboard interception. */
(() => {
    if (window.__myosotisBlockReferences) return;
    const BLOCKS = 'h1,h2,h3,h4,h5,h6,p,li';
    const normalize = text => (text || '').trim().replace(/\s+/g, ' ');
    const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    function describe(block, content) {
        const text = normalize(block.textContent).slice(0, 240);
        const tag = block.tagName.toLowerCase();
        const matches = [...content.querySelectorAll(tag)].filter(item => normalize(item.textContent).slice(0, 240) === text);
        return { v: 1, id: block.id || '', tag, text, ordinal: matches.indexOf(block) };
    }
    function makeLink(noteId, locator) {
        return `#root/${encodeURIComponent(noteId)}?myoref=${encodeURIComponent(JSON.stringify(locator))}`;
    }
    function parseLink(href) {
        try {
            const hash = href.slice(href.indexOf('#'));
            const match = /^#root\/([a-zA-Z0-9_-]+)\?(.+)$/.exec(hash);
            if (!match) return null;
            const data = new URLSearchParams(match[2]).get('myoref');
            if (!data || data.length > 2000) return null;
            const locator = JSON.parse(data);
            if (locator.v !== 1 || !/^(h[1-6]|p|li)$/.test(locator.tag) ||
                typeof locator.text !== 'string' || locator.text.length > 240 ||
                typeof locator.id !== 'string' || locator.id.length > 200 ||
                !Number.isInteger(locator.ordinal) || locator.ordinal < 0) return null;
            return { noteId: match[1], locator };
        } catch { return null; }
    }
    function locate(content, locator) {
        const items = [...content.querySelectorAll(BLOCKS)];
        if (locator.id) {
            const exact = items.find(item => item.id === locator.id);
            if (exact) return exact;
        }
        return items.filter(item => item.tagName.toLowerCase() === locator.tag &&
            normalize(item.textContent).slice(0, 240) === locator.text)[locator.ordinal];
    }
    window.__myosotisBlockReferences = { describe, makeLink, parseLink, locate };
    let pending;
    let scanTimer;
    const contextFor = block => {
        const id = block.closest('.note-split[data-ntx-id]')?.dataset.ntxId;
        return api.getNoteContexts().find(context => context.ntxId === id);
    };
    async function persistentId(block, context) {
        if (block.id) return block.id;
        // Read-only references are textual: never turn on editing or rewrite the note.
        if (!block.closest('[contenteditable="true"]')) return '';
        const editor = await context.getTextEditor();
        if (!editor || editor.isReadOnly || !block.isConnected) return '';
        const view = editor.editing.view.domConverter.mapDomToView(block);
        const model = view && editor.editing.mapper.toModelElement(view);
        const ghs = editor.plugins.get('GeneralHtmlSupport');
        const tag = block.tagName.toLowerCase();
        const attr = ghs.getGhsAttributeNameForElement(tag);
        if (!model || !editor.model.schema.checkAttribute(model, attr)) return '';
        const id = model.getAttribute(attr)?.attributes?.id || `myo-ref-${crypto.randomUUID()}`;
        ghs.setModelHtmlAttributes(tag, { id }, model);
        return id;
    }
    async function copy(block) {
        try {
            const context = contextFor(block);
            const note = context?.note;
            const content = block.closest('.ck-content');
            if (!note || note.type !== 'text' || !content || !normalize(block.textContent)) {
                api.showMessage('请先选择正文段落或标题。'); return;
            }
            if (note.isProtected) { api.showMessage('受保护笔记暂不生成段落引用。'); return; }
            const locator = describe(block, content);
            // Attribute insertion follows CKEditor's normal save/undo pipeline.
            try { locator.id = await persistentId(block, context); }
            catch (error) { console.warn('Persistent anchor unavailable; using text locator', error); locator.id = ''; }
            const href = makeLink(note.noteId, locator);
            const label = `${note.title} › ${locator.text.slice(0, 70)}`;
            const html = `<a class="myosotis-block-reference" href="${escape(href)}" title="${escape(locator.text)}">${escape(label)}</a>`;
            if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
                await navigator.clipboard.write([new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([href], { type: 'text/plain' })
                })]);
            } else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(href);
            else throw Error('当前环境不支持剪贴板写入');
            api.showMessage(locator.id ? '已复制引用，可粘贴到其他笔记；锚点随正文保存。' :
                '已复制文字定位引用；只读内容若改写，需重新生成引用。');
        } catch (error) { console.error('Block reference copy failed', error); api.showError(`复制引用失败：${error.message}`); }
    }
    function selectionBlock(heading) {
        const node = window.getSelection()?.anchorNode;
        let block = (node?.nodeType === 1 ? node : node?.parentElement)?.closest(BLOCKS);
        const content = block?.closest('.note-split .ck-content');
        if (!content) return null;
        if (!heading || /^H[1-6]$/.test(block.tagName)) return block;
        let last;
        for (const item of content.querySelectorAll(BLOCKS)) {
            if (item === block) break;
            if (/^H[1-6]$/.test(item.tagName)) last = item;
        }
        return last || null;
    }
    function addToolbarButtons() {
        for (const toolbar of document.querySelectorAll('.note-split .ck-toolbar')) {
            if (toolbar.querySelector('.myosotis-copy-block')) continue;
            for (const [heading, label] of [[false, '复制段落引用'], [true, '复制标题引用']]) {
                const entry = document.createElement('button');
                entry.type = 'button'; entry.className = 'ck ck-button myosotis-copy-block';
                entry.textContent = heading ? '标题引用' : '段落引用'; entry.title = label;
                entry.setAttribute('aria-label', label);
                entry.addEventListener('mousedown', event => event.preventDefault());
                entry.addEventListener('click', () => {
                    const block = selectionBlock(heading);
                    if (block) void copy(block); else api.showMessage('请将光标放在正文或标题中。');
                });
                toolbar.append(entry);
            }
        }
    }
    function jump() {
        if (!pending) return;
        const contexts = api.getNoteContexts().filter(context => context.note?.noteId === pending.noteId);
        for (const context of contexts) {
            const root = [...document.querySelectorAll('.note-split[data-ntx-id]')]
                .find(item => item.dataset.ntxId === context.ntxId && item.getClientRects().length);
            const content = root?.querySelector('.ck-content');
            const target = content && locate(content, pending.locator);
            const scroller = target?.closest('.scrolling-container');
            if (!target || !scroller) continue;
            // Explicit navigation takes precedence over reading-position restoration.
            scroller.dispatchEvent(new CustomEvent('myosotis-reference-jump', { bubbles: true, detail: { noteId: pending.noteId } }));
            const margin = root.querySelector('.note-split-title')?.getBoundingClientRect().height || 70;
            const desired = scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - margin - 50;
            scroller.scrollTo({ top: Math.max(0, desired), behavior: 'auto' });
            pending = null;
            if (target.animate) target.animate([{ backgroundColor: '#fff0a8' }, { backgroundColor: 'transparent' }], { duration: 1400 });
            return;
        }
    }
    async function navigate(reference) {
        pending = reference;
        const request = reference;
        try {
            await api.openTabWithNote(reference.noteId, true);
            jump();
            for (const delay of [150, 500, 1200]) setTimeout(() => { if (pending === request) jump(); }, delay);
            setTimeout(() => {
                if (pending !== request) return;
                pending = null;
                api.showMessage('未找到引用段落，内容可能已改写或删除。已打开目标笔记。');
            }, 5000);
        } catch (error) {
            if (pending === request) pending = null;
            api.showError(`无法打开引用：${error.message}`);
        }
    }
    document.addEventListener('click', event => {
        const link = event.target.closest?.('a[href]');
        const reference = link && parseLink(link.getAttribute('href'));
        if (!reference || event.button !== 0) return;
        event.preventDefault(); event.stopImmediatePropagation();
        void navigate(reference);
    }, true);
    const observer = new MutationObserver(() => {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => { addToolbarButtons(); jump(); }, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', () => {
        const reference = parseLink(location.hash);
        if (reference) void navigate(reference);
    });
    addToolbarButtons();
    const initial = parseLink(location.hash);
    if (initial) void navigate(initial);
})();
