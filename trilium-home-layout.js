/* Pointer sorting adapted from Home Pages (GPL-3.0-only), revision 2f98a7c44432a5e077977535f94093487417c735. See THIRD_PARTY_NOTICES.md. */
const DRAG_THRESHOLD = 6;
const EDGE_SIZE = 48;
const FLIP_MS = 220;
const FLIP_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const FLIP_ID = "hp-flip";
function moveBefore(items, id, beforeId) {
    const from = items.findIndex((item)=>item.id === id);
    const before = beforeId === null ? items.length : items.findIndex((item)=>item.id === beforeId);
    if (from < 0 || before < 0 || id === beforeId) return false;
    const to = before > from ? before - 1 : before;
    if (from === to) return false;
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    return true;
}
function prefersReducedMotion(win = window) {
    return win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
function animateLayout(container, itemSelector, mutate, from) {
    const win = container.ownerDocument.defaultView ?? window;
    if (prefersReducedMotion(win) || typeof container.animate !== "function") {
        mutate();
        return;
    }
    const query = ()=>Array.from(container.querySelectorAll(itemSelector)).filter((item)=>item.parentElement === container && item.dataset.id);
    const first = new Map();
    for (const item of query())first.set(item.dataset.id ?? "", item.getBoundingClientRect());
    for (const [id, rect] of from ?? [])first.set(id, rect);
    mutate();
    const items = query();
    for (const item of items)for (const animation of item.getAnimations())if (animation.id === FLIP_ID) animation.cancel();
    const last = items.map((item)=>item.getBoundingClientRect());
    items.forEach((item, index)=>{
        const start = first.get(item.dataset.id ?? "");
        if (!start) return;
        const dx = start.left - last[index].left;
        const dy = start.top - last[index].top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        const animation = item.animate([
            {
                transform: `translate(${dx}px, ${dy}px)`
            },
            {
                transform: "none"
            }
        ], {
            duration: FLIP_MS,
            easing: FLIP_EASING
        });
        animation.id = FLIP_ID;
    });
}
class PointerSorter {
    container;
    options;
    session = null;
    frame = null;
    suppressClick = false;
    doc;
    win;
    constructor(container, options){
        this.container = container;
        this.options = options;
        this.doc = container.ownerDocument;
        this.win = this.doc.defaultView ?? window;
        container.addEventListener("pointerdown", this.onPointerDown);
        container.addEventListener("click", this.onClick, true);
        container.addEventListener("dragstart", this.onNativeDrag);
    }
    items() {
        return Array.from(this.container.querySelectorAll(this.options.itemSelector)).filter((item)=>item.parentElement === this.container);
    }
    get ghostHost() {
        return this.container.parentElement ?? this.container;
    }
    onPointerDown = (event)=>{
        if (!this.session) this.suppressClick = false;
        if (this.session || event.button !== 0 || !event.isPrimary) return;
        const target = event.target;
        const item = target?.closest(this.options.itemSelector);
        if (!item || item.parentElement !== this.container || !this.options.canStart(event, item)) return;
        this.session = {
            source: item,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX,
            y: event.clientY,
            grabX: 0,
            grabY: 0,
            started: false,
            placement: null,
            ghost: null
        };
        this.doc.addEventListener("pointermove", this.onPointerMove, {
            capture: true,
            passive: false
        });
        this.doc.addEventListener("pointerup", this.onPointerUp, true);
        this.doc.addEventListener("pointercancel", this.onPointerCancel, true);
        this.doc.addEventListener("lostpointercapture", this.onPointerCancel, true);
        this.doc.addEventListener("keydown", this.onKeyDown, true);
        this.win.addEventListener("blur", this.onPointerCancel);
    };
    onPointerMove = (event)=>{
        const session = this.session;
        if (!session || event.pointerId !== session.pointerId) return;
        session.x = event.clientX;
        session.y = event.clientY;
        if (!session.started) {
            if (Math.hypot(session.x - session.startX, session.y - session.startY) < DRAG_THRESHOLD) return;
            session.started = true;
            const rect = session.source.getBoundingClientRect();
            session.grabX = session.startX - rect.left;
            session.grabY = session.startY - rect.top;
            session.ghost = this.createGhost(session.source, rect);
            session.source.classList.add("is-dragging");
            this.container.classList.add("is-sorting");
            session.source.setPointerCapture(event.pointerId);
            this.positionGhost();
            this.frame = this.win.requestAnimationFrame(this.tick);
        }
        event.preventDefault();
        event.stopPropagation();
        this.updatePlacement();
    };
    createGhost(source, rect) {
        const ghost = source.cloneNode(true);
        ghost.classList.remove("is-dragging", "drop-before", "drop-after", "drop-vertical");
        ghost.classList.add("hp-sort-ghost");
        ghost.removeAttribute("data-id");
        ghost.setAttribute("aria-hidden", "true");
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        this.ghostHost.appendChild(ghost);
        return ghost;
    }
    positionGhost() {
        const session = this.session;
        if (!session?.ghost) return;
        const host = this.ghostHost.getBoundingClientRect();
        const x = session.x - session.grabX - host.left;
        const y = session.y - session.grabY - host.top;
        session.ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    updatePlacement() {
        const session = this.session;
        if (!session?.started) return;
        const next = this.computePlacement(session);
        const previous = session.placement;
        if (previous?.target === next?.target && previous?.after === next?.after && previous?.vertical === next?.vertical) {
            session.placement = next;
            return;
        }
        if (previous) previous.target.classList.remove("drop-before", "drop-after", "drop-vertical");
        session.placement = next;
        if (next) {
            next.target.classList.add(next.after ? "drop-after" : "drop-before");
            next.target.classList.toggle("drop-vertical", next.vertical);
        }
    }
    computePlacement(session) {
        const bounds = this.container.getBoundingClientRect();
        const viewport = this.options.scrollContainer?.getBoundingClientRect() ?? bounds;
        const { x, y } = session;
        if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom || x < viewport.left || x > viewport.right || y < viewport.top || y > viewport.bottom) return null;
        const items = this.items();
        const boxes = items.map((item)=>({
                item,
                rect: item.getBoundingClientRect()
            }));
        const hit = boxes.find(({ rect })=>x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
        if (hit?.item === session.source) return null;
        const nearest = hit ?? boxes.filter(({ item })=>item !== session.source).sort((a, b)=>{
            const distance = (rect)=>Math.max(rect.left - x, 0, x - rect.right) ** 2 + Math.max(rect.top - y, 0, y - rect.bottom) ** 2;
            return distance(a.rect) - distance(b.rect);
        })[0];
        if (!nearest) return null;
        const { item: target, rect } = nearest;
        const vertical = !boxes.some((box)=>box.item !== target && Math.min(box.rect.bottom, rect.bottom) > Math.max(box.rect.top, rect.top) && (box.rect.right <= rect.left || box.rect.left >= rect.right));
        const after = vertical ? y > rect.top + rect.height / 2 : x > rect.left + rect.width / 2;
        const index = items.indexOf(target);
        const beforeId = after ? items[index + 1]?.dataset.id ?? null : target.dataset.id ?? null;
        if (beforeId === session.source.dataset.id) return null;
        return {
            target,
            beforeId,
            after,
            vertical
        };
    }
    tick = ()=>{
        this.frame = null;
        const session = this.session;
        const scroller = this.options.scrollContainer;
        if (!session?.started) return;
        if (scroller) {
            const rect = scroller.getBoundingClientRect();
            if (session.x >= rect.left && session.x <= rect.right && session.y >= rect.top && session.y <= rect.bottom) {
                const edge = Math.min(EDGE_SIZE, rect.height / 4);
                const delta = session.y < rect.top + edge ? -Math.ceil((rect.top + edge - session.y) / 4) : session.y > rect.bottom - edge ? Math.ceil((session.y - rect.bottom + edge) / 4) : 0;
                if (delta) {
                    scroller.scrollTop += delta;
                    this.updatePlacement();
                }
            }
        }
        this.positionGhost();
        this.frame = this.win.requestAnimationFrame(this.tick);
    };
    onPointerUp = (event)=>{
        const session = this.session;
        if (!session || event.pointerId !== session.pointerId) return;
        if (session.started) {
            session.x = event.clientX;
            session.y = event.clientY;
            this.updatePlacement();
            event.preventDefault();
            event.stopPropagation();
        }
        this.finish(true);
    };
    onPointerCancel = (event)=>{
        if ("pointerId" in event && event.pointerId !== this.session?.pointerId) return;
        if (event.type === "lostpointercapture" && event.target !== this.session?.source) return;
        this.finish(false);
    };
    onKeyDown = (event)=>{
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        this.finish(false);
    };
    finish(commit) {
        const session = this.session;
        const id = session?.source.dataset.id;
        const placement = commit ? session?.placement ?? null : null;
        const ghostRect = session?.ghost?.getBoundingClientRect();
        this.cancel();
        if (!id || !session?.started) return;
        const from = ghostRect ? new Map([
            [
                id,
                ghostRect
            ]
        ]) : undefined;
        animateLayout(this.container, this.options.itemSelector, ()=>{
            if (placement) this.options.onReorder(id, placement.beforeId);
        }, from);
    }
    onClick = (event)=>{
        if (!this.suppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.suppressClick = false;
    };
    onNativeDrag = (event)=>{
        if (this.session) event.preventDefault();
    };
    clearMarkers() {
        for (const item of this.items())item.classList.remove("drop-before", "drop-after", "drop-vertical");
    }
    cancel() {
        const session = this.session;
        this.session = null;
        if (session?.started) {
            this.suppressClick = true;
            session.source.classList.remove("is-dragging");
            if (session.source.hasPointerCapture(session.pointerId)) session.source.releasePointerCapture(session.pointerId);
        }
        session?.ghost?.remove();
        this.container.classList.remove("is-sorting");
        this.clearMarkers();
        if (this.frame !== null) this.win.cancelAnimationFrame(this.frame);
        this.frame = null;
        this.doc.removeEventListener("pointermove", this.onPointerMove, true);
        this.doc.removeEventListener("pointerup", this.onPointerUp, true);
        this.doc.removeEventListener("pointercancel", this.onPointerCancel, true);
        this.doc.removeEventListener("lostpointercapture", this.onPointerCancel, true);
        this.doc.removeEventListener("keydown", this.onKeyDown, true);
        this.win.removeEventListener("blur", this.onPointerCancel);
    }
    destroy() {
        this.cancel();
        this.container.removeEventListener("pointerdown", this.onPointerDown);
        this.container.removeEventListener("click", this.onClick, true);
        this.container.removeEventListener("dragstart", this.onNativeDrag);
    }
}

// Arrange complete bands so short cards fill the height of neighbouring lists.
// Work only with existing widgets: removing a card must never recreate it.
function arrangeWidgets(widgets) {
    const copies = widgets.map(widget => ({ ...widget }));
    const rank = ["tasks", "recent", "workbench", "quicklinks", "calendar", "note", "capture"];
    const smallRank = ["pomodoro", "stats", "countdown", "quote"];
    const main = copies.filter(widget => !["hero", "contributions", ...smallRank].includes(widget.kind));
    main.sort((a, b) => (rank.indexOf(a.kind) < 0 ? rank.length : rank.indexOf(a.kind)) - (rank.indexOf(b.kind) < 0 ? rank.length : rank.indexOf(b.kind)));
    const small = copies.filter(widget => smallRank.includes(widget.kind));
    small.sort((a, b) => smallRank.indexOf(a.kind) - smallRank.indexOf(b.kind));
    const result = copies.filter(widget => widget.kind === "hero").map(widget => ({ ...widget, w: 12 }));
    while (main.length || small.length) {
        const pair = small.splice(0, 2), lists = main.splice(0, pair.length ? 2 : 3);
        if (!lists.length) {
            result.push(...pair.map(widget => ({ ...widget, w: 12 / pair.length, h: 3 })));
            continue;
        }
        const height = lists.some(widget => ["tasks", "workbench"].includes(widget.kind)) ? 7 : 6;
        const width = 12 / (lists.length + (pair.length ? 1 : 0));
        result.push(...lists.map(widget => ({ ...widget, w: width, h: height })));
        result.push(...pair.map((widget, index) => ({ ...widget, w: width, h: pair.length === 1 ? height : index === 0 ? 3 : height - 3 })));
    }
    result.push(...copies.filter(widget => widget.kind === "contributions").map(widget => ({ ...widget, w: 12 })));
    return result;
}

return { PointerSorter, animateLayout, moveBefore, arrangeWidgets };
