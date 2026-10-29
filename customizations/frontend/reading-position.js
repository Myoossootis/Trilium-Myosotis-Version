/* Local reading positions; never touches note content or editor selection. */
(() => {
    if (window.__myosotisReadingPosition) return;
    window.__myosotisReadingPosition = true;
    const KEY = 'myosotis-reading-positions-v1';
    const states = new Map();
    const explicitJumps = new Map();
    let positions = {};
    let scanTimer;
    try { positions = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
    if (!positions || typeof positions !== 'object' || Array.isArray(positions)) positions = {};
    const signature = element => (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160);
    const editingMode = content => content.getAttribute('contenteditable') || 'readonly';
    const blocks = state => [...state.content.querySelectorAll('p, li, figure, table')]
        .filter(element => element.getClientRects().length && signature(element));
    function persist() {
        const entries = Object.entries(positions).sort((a, b) => b[1].time - a[1].time).slice(0, 1000);
        positions = Object.fromEntries(entries);
        try { localStorage.setItem(KEY, JSON.stringify(positions)); } catch (error) {
            console.warn('Reading-position storage unavailable', error);
        }
    }
    function save(state, flush = true) {
        if (state.restoring || !state.scroller.isConnected || !state.scroller.getClientRects().length) return;
        // Contexts are reused during navigation: never label new DOM as the old note.
        const current = api.getNoteContexts().find(context => context.ntxId === state.ntxId);
        if ((current?.note?.noteId || current?.noteId) !== state.noteId) return;
        // A mode switch can reset the shared scroller before the debounced scan.
        // Do not let that reset overwrite the position from the previous view.
        if (!state.content.isConnected || state.root.querySelector('.ck-content') !== state.content ||
            editingMode(state.content) !== state.mode) return;
        const top = state.scroller.getBoundingClientRect().top;
        const visibleBlocks = blocks(state);
        const anchor = visibleBlocks.find(element => element.getBoundingClientRect().bottom > top + 80);
        const text = anchor ? signature(anchor) : '';
        const ordinal = anchor ? visibleBlocks.filter(element => signature(element) === text).indexOf(anchor) : 0;
        positions[state.noteId] = {
            y: state.scroller.scrollTop,
            ratio: state.scroller.scrollTop / Math.max(1, state.scroller.scrollHeight - state.scroller.clientHeight),
            text, ordinal, offset: anchor ? anchor.getBoundingClientRect().top - top : 0,
            time: Date.now()
        };
        if (flush) persist();
    }
    function dispose(state) {
        clearTimeout(state.saveTimer);
        state.timers.forEach(clearTimeout);
        state.resize?.disconnect();
        state.scroller.removeEventListener('scroll', state.onScroll);
        state.scroller.removeEventListener('myosotis-reference-jump', state.cancel);
        for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
            state.scroller.removeEventListener(name, state.cancel);
        }
    }
    function restore(state) {
        if (!state.restoring || !state.scroller.isConnected || !state.scroller.getClientRects().length) return;
        const current = api.getNoteContexts().find(context => context.ntxId === state.ntxId);
        if ((current?.note?.noteId || current?.noteId) !== state.noteId) return;
        const record = positions[state.noteId];
        if (!record) return;
        const candidates = blocks(state).filter(element => signature(element) === record.text);
        const anchor = candidates[record.ordinal || 0];
        const max = Math.max(0, state.scroller.scrollHeight - state.scroller.clientHeight);
        const target = anchor
            ? state.scroller.scrollTop + anchor.getBoundingClientRect().top - state.scroller.getBoundingClientRect().top - record.offset
            : Number.isFinite(record.y) ? record.y : record.ratio * max;
        const old = state.scroller.style.scrollBehavior;
        state.scroller.style.scrollBehavior = 'auto';
        state.scroller.scrollTop = Math.min(max, Math.max(0, target || 0));
        state.scroller.style.scrollBehavior = old;
    }
    function scan() {
        for (const context of api.getNoteContexts()) {
            const note = context.note;
            const noteId = note?.noteId || context.noteId;
            const root = [...document.querySelectorAll('.note-split[data-ntx-id]')]
                .find(element => element.dataset.ntxId === context.ntxId);
            const content = root?.querySelector('.ck-content');
            const scroller = content?.closest('.scrolling-container');
            const previous = states.get(context.ntxId);
            const mode = content ? editingMode(content) : null;
            if (previous && previous.noteId === noteId && previous.content === content &&
                previous.scroller === scroller && previous.mode === mode) continue;
            if (previous) { dispose(previous); states.delete(context.ntxId); }
            if (!noteId || !content || !scroller || note?.isProtected || note?.type !== 'text') continue;
            const state = { ntxId: context.ntxId, noteId, root, content, mode, scroller, timers: [],
                restoring: !!positions[noteId] && (explicitJumps.get(noteId) || 0) < Date.now() };
            state.cancel = () => {
                state.restoring = false;
                state.resize?.disconnect();
                state.timers.forEach(clearTimeout);
            };
            state.onScroll = () => {
                if (state.restoring) return;
                clearTimeout(state.saveTimer);
                state.saveTimer = setTimeout(() => save(state), 250);
            };
            scroller.addEventListener('scroll', state.onScroll, { passive: true });
            scroller.addEventListener('myosotis-reference-jump', state.cancel);
            for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
                scroller.addEventListener(name, state.cancel, { passive: true });
            }
            states.set(context.ntxId, state);
            if (state.restoring) {
                state.resize = new ResizeObserver(() => restore(state));
                state.resize.observe(content);
                for (const delay of [0, 150, 500, 1200, 2500]) {
                    state.timers.push(setTimeout(() => restore(state), delay));
                }
                state.timers.push(setTimeout(state.cancel, 3000));
            }
        }
        const ids = new Set(api.getNoteContexts().map(context => context.ntxId));
        for (const [id, state] of states) {
            if (!ids.has(id) || !state.scroller.isConnected) { dispose(state); states.delete(id); }
        }
    }
    document.addEventListener('scroll', event => {
        // Save synchronously in memory before a fast note switch can reuse the DOM.
        for (const state of states.values()) {
            if (event.target === state.scroller && !state.restoring) save(state, false);
        }
    }, { capture: true, passive: true });
    document.addEventListener('myosotis-reference-jump', event => {
        if (event.detail?.noteId) explicitJumps.set(event.detail.noteId, Date.now() + 3500);
        for (const state of states.values()) if (state.scroller === event.target) state.cancel();
    }, true);
    const observer = new MutationObserver(() => {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(scan, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['data-ntx-id', 'class', 'contenteditable'] });
    window.addEventListener('pagehide', () => { for (const state of states.values()) save(state, false); persist(); });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { for (const state of states.values()) save(state); }
        else scan();
    });
    scan();
})();
