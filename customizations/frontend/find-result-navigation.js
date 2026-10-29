/* Reveal CKEditor's selected search match inside Trilium's note scroller. */
(() => {
    if (window.__myosotisFindNavigation) return;
    window.__myosotisFindNavigation = true;
    const selected = '.ck-content .ck-find-result_selected';
    const previous = new WeakMap();
    let scheduled = false;
    function reveal() {
        scheduled = false;
        for (const root of document.querySelectorAll('.note-split[data-ntx-id]')) {
            const match = root.querySelector(selected);
            if (!match) { previous.delete(root); continue; }
            if (previous.get(root) === match || !match.getClientRects().length) continue;
            const scroller = match.closest('.scrolling-container');
            if (!scroller || !scroller.clientHeight) continue;
            previous.set(root, match);
            // Cancel delayed reading-position restoration before an explicit jump.
            scroller.dispatchEvent(new CustomEvent('myosotis-reference-jump', {
                bubbles: true, detail: { source: 'find' }
            }));
            const bounds = scroller.getBoundingClientRect();
            const rect = match.getBoundingClientRect();
            // Center the result, away from sticky headings and the find toolbar.
            const target = scroller.scrollTop + rect.top - bounds.top -
                scroller.clientTop - (scroller.clientHeight - rect.height) / 2;
            const behavior = scroller.style.scrollBehavior;
            scroller.style.scrollBehavior = 'auto';
            scroller.scrollTop = Math.max(0, Math.min(target, scroller.scrollHeight - scroller.clientHeight));
            scroller.style.scrollBehavior = behavior;
        }
    }
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        // Wait for marker rendering and native scroll handling before correcting it.
        requestAnimationFrame(() => requestAnimationFrame(reveal));
    }
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true,
        attributes: true, attributeFilter: ['class'] });
    schedule();
})();
