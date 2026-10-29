// Editing and sticky-heading utilities belong to the optional note package.
// Clear presentation through the editor model: retain structure, semantic data and undo.
const PRESENTATION_ATTRIBUTES = new Set([
    "lineHeight", "blockIndent", "indent", "imageStyle", "resizedWidth", "resizedHeight",
    "tableWidth", "tableHeight", "tableAlignment", "tableBackgroundColor",
    "tableBorderColor", "tableBorderStyle", "tableBorderWidth",
    "tableCellWidth", "tableCellHeight", "tableCellPadding", "tableCellBackgroundColor",
    "tableCellBorderColor", "tableCellBorderStyle", "tableCellBorderWidth",
    "tableCellHorizontalAlignment", "tableCellVerticalAlignment"
]);
const HTML_PRESENTATION_ATTRIBUTES = new Set([
    "align", "valign", "bgcolor", "color", "face", "size", "border", "cellpadding", "cellspacing",
    "hspace", "vspace", "width", "height", "data-eric-no-auto-indent"
]);
const SEMANTIC_CLASSES = new Set(["math-tex", "ck-math-tex", "reference-link", "include-note"]);

function clearedHtmlFormatting(value) {
    const next = { ...value };
    delete next.styles;
    if (next.classes) {
        const classes = next.classes.filter(name => SEMANTIC_CLASSES.has(name) || name.startsWith("language-"));
        if (classes.length) next.classes = classes;
        else delete next.classes;
    }
    if (next.attributes) {
        const attributes = Object.fromEntries(Object.entries(next.attributes)
            .filter(([name]) => !HTML_PRESENTATION_ATTRIBUTES.has(name.toLowerCase())));
        if (Object.keys(attributes).length) next.attributes = attributes;
        else delete next.attributes;
    }
    return Object.keys(next).length ? next : null;
}

function clearItemFormatting(editor, writer, item, range) {
    let changed = 0;
    for (const [name, value] of [...item.getAttributes()]) {
        if (name.startsWith("html") && value && typeof value === "object") {
            const next = clearedHtmlFormatting(value);
            if (JSON.stringify(next) === JSON.stringify(value)) continue;
            if (next) writer.setAttribute(name, next, range);
            else writer.removeAttribute(name, range);
        } else {
            // Numbering, list nesting and table dimensions in rows/columns are structure.
            // Trilium marks linkHref as formatting; keep its semantic destination explicitly.
            if (name.startsWith("list") || name.startsWith("link") || name === "todoListChecked") continue;
            if (!editor.model.schema.getAttributeProperties(name).isFormatting && !PRESENTATION_ATTRIBUTES.has(name)) continue;
            writer.removeAttribute(name, range);
        }
        changed++;
    }
    return changed;
}

async function clearSelectedFormatting(toolbar) {
    // A toolbar in a split editor must operate on its own editor, not another tab's.
    const editable = toolbar.closest(".ck-editor")?.querySelector(".ck-editor__editable");
    const editor = editable?.ckeditorInstance || await api.getActiveContextTextEditor();
    if (!editor || editor.isReadOnly) { api.showMessage("请先打开可编辑的文本笔记。"); return; }
    const { model } = editor, selection = model.document.selection;
    const blocks = [...selection.getSelectedBlocks()];
    if (!blocks.length) { api.showMessage("请先将光标放在正文中，或选中要清除格式的内容。"); return; }
    const ranges = selection.isCollapsed
        ? blocks.map(block => model.createRangeIn(block)) : [...selection.getRanges()];
    let changed = 0;
    model.change(writer => {
        const elements = new Set(blocks);
        for (const range of ranges) for (const item of range.getItems()) {
            if (item.is("element")) elements.add(item);
            else if (item.is("$textProxy")) changed += clearItemFormatting(editor, writer, item, writer.createRangeOn(item));
        }
        for (const element of elements) changed += clearItemFormatting(editor, writer, element, writer.createRangeOn(element));
        for (const [name, value] of [...selection.getAttributes()]) {
            if (name.startsWith("html") && value && typeof value === "object") {
                const next = clearedHtmlFormatting(value);
                if (JSON.stringify(next) === JSON.stringify(value)) continue;
                if (next) writer.setSelectionAttribute(name, next);
                else writer.removeSelectionAttribute(name);
            } else if (!name.startsWith("list") && !name.startsWith("link") && name !== "todoListChecked" && (model.schema.getAttributeProperties(name).isFormatting || PRESENTATION_ATTRIBUTES.has(name))) {
                writer.removeSelectionAttribute(name);
            }
        }
    });
    editor.editing.view.focus();
    api.showMessage(changed ? "已清除原有外观格式，保留内容与结构；可撤销恢复。" : "所选内容已使用默认格式。");
}

function installEditorUtilities() {
    for (const toolbar of document.querySelectorAll(".classic-toolbar-widget > .ck-toolbar,.ck-editor__top .ck-toolbar")) {
        if (toolbar.parentElement.closest(".ck-toolbar")) continue;
        toolbar.querySelectorAll(".eric-auto-indent-toggle,.eric-format-normalize").forEach(button => button.remove());
        if (toolbar.querySelector(".eric-clear-formatting")) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ck ck-button eric-clear-formatting";
        button.title = "清除所有格式（保留结构）：选中内容或当前段落；Ctrl+A 可处理全文";
        button.setAttribute("aria-label", "清除所有格式（保留结构）");
        button.innerHTML = '<svg class="ck ck-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h12v2h-5v7H9V5H4zM3 15h9v2H3zm10-4 1.4-1.4L16 11.2l1.6-1.6L19 11l-1.6 1.6L19 14l-1.4 1.4L16 13.8l-1.6 1.6L13 14l1.6-1.4z"/></svg>';
        button.addEventListener("mousedown", event => event.preventDefault());
        button.addEventListener("click", () => void clearSelectedFormatting(toolbar).catch(error => api.showError(error.message || String(error))));
        (toolbar.querySelector(".ck-toolbar__items") || toolbar).append(button);
    }
}

/*
 * H3 headings are styled as sticky rows by the knowledge-base CSS. A sticky
 * element normally remains pinned until the whole editor container ends, so
 * the last H3 in one H2 section can incorrectly stay visible while the next
 * H2 section (which has no H3) is being read. Disable only that superseded H3
 * once the following H2 reaches the H2/H3 frozen-heading boundary.
 */
const STICKY_HEADING_SCOPE = ".note-split.eric-knowledge-base .ck-content";
const STICKY_H3_SUPERSEDED_CLASS = "eric-sticky-h3-superseded";

function getStickyHeadingScrollParent(element) {
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        const overflow = `${style.overflow} ${style.overflowY}`;
        if (/(auto|scroll|overlay)/.test(overflow)) return parent;
        parent = parent.parentElement;
    }
    return document.scrollingElement || document.documentElement;
}

function getStickyHeadingViewportTop(scrollParent) {
    if (scrollParent === document.scrollingElement) return 0;
    return scrollParent.getBoundingClientRect().top + scrollParent.clientTop +
        (parseFloat(getComputedStyle(scrollParent).paddingTop) || 0);
}

function getStickyHeadingLaneTop(content, h3) {
    const parentTop = getStickyHeadingViewportTop(getStickyHeadingScrollParent(content));
    const computed = getComputedStyle(h3);
    // Superseded rows have top:auto. Keep their lane stable so they do not
    // alternate between frozen and unfrozen as the incoming heading moves.
    const configuredOffset = parseFloat(computed.getPropertyValue('--eric-sticky-h2-height')) || parseFloat(computed.top);
    return parentTop + (Number.isFinite(configuredOffset) ? Math.max(0, configuredOffset) : 0);
}

function syncStickyHeadingContainer(content) {
    if (!content.isConnected || !content.getBoundingClientRect().height) return;

    const headings = [...content.querySelectorAll("h2, h3")];
    const h2Indexes = headings.reduce((indexes, heading, index) => {
        if (heading.tagName === "H2") indexes.push(index);
        return indexes;
    }, []);

    // Typography, wrapped titles and zoom can change H2 height. Keep the H3
    // lane below the actual current H2 rather than assuming a 39px frozen row.
    // The variable lives on the note split, outside CKEditor's saved content.
    const split = content.closest('.note-split');
    const parentTop = getStickyHeadingViewportTop(getStickyHeadingScrollParent(content));
    const chapters = h2Indexes.map(index => headings[index]);
    const active = chapters.filter(h2 => h2.getBoundingClientRect().top <= parentTop + 1).at(-1) || chapters[0];
    const height = active ? Math.ceil(active.getBoundingClientRect().height) : 0;
    if (split && height > 0 && split.style.getPropertyValue('--eric-sticky-h2-height') !== `${height}px`) {
        split.style.setProperty('--eric-sticky-h2-height', `${height}px`);
    }

    for (let index = 0; index < headings.length; index++) {
        const heading = headings[index];
        if (heading.tagName !== "H3") continue;

        const nextH2Index = h2Indexes.find((h2Index) => h2Index > index);
        const nextH2 = nextH2Index === undefined ? null : headings[nextH2Index];
        const nextH3 = headings.slice(index + 1, nextH2Index).find(next => next.tagName === 'H3');
        const laneTop = getStickyHeadingLaneTop(content, heading);
        const superseded = (nextH2 && nextH2.getBoundingClientRect().top <= laneTop + 1) ||
            (nextH3 && nextH3.getBoundingClientRect().top <= laneTop + heading.getBoundingClientRect().height);
        heading.classList.toggle(STICKY_H3_SUPERSEDED_CLASS, Boolean(superseded));
    }
}

function installStickyHeadingFix() {
    if (window.__ericStickyHeadingFix) return;
    window.__ericStickyHeadingFix = true;

    const style = document.createElement("style");
    style.id = "eric-sticky-heading-fix-style";
    style.textContent = `
        ${STICKY_HEADING_SCOPE} h3 {
            top: var(--eric-sticky-h2-height, 2.45rem) !important;
        }
        ${STICKY_HEADING_SCOPE} h3.${STICKY_H3_SUPERSEDED_CLASS} {
            position: static !important;
            top: auto !important;
            z-index: auto !important;
        }
    `;
    document.head.append(style);

    const containers = new Map();
    let frame = 0;

    function syncAll() {
        frame = 0;
        for (const [content, state] of containers) {
            if (!content.isConnected) {
                state.scrollParent?.removeEventListener("scroll", state.onScroll);
                state.resize?.disconnect();
                containers.delete(content);
                continue;
            }
            syncStickyHeadingContainer(content);
        }
    }

    function scheduleSync() {
        if (!frame) frame = requestAnimationFrame(syncAll);
    }

    function registerContainers() {
        for (const content of document.querySelectorAll(STICKY_HEADING_SCOPE)) {
            const scrollParent = getStickyHeadingScrollParent(content);
            const existing = containers.get(content);
            if (existing?.scrollParent === scrollParent) {
                content.querySelectorAll('h2').forEach(h2 => existing.resize.observe(h2));
                continue;
            }

            existing?.scrollParent?.removeEventListener("scroll", existing.onScroll);
            existing?.resize?.disconnect();
            const onScroll = scheduleSync;
            scrollParent.addEventListener("scroll", onScroll, { passive: true });
            const resize = new ResizeObserver(scheduleSync);
            resize.observe(content);
            content.querySelectorAll('h2').forEach(h2 => resize.observe(h2));
            containers.set(content, { scrollParent, onScroll, resize });
        }
        scheduleSync();
    }

    registerContainers();
    window.addEventListener("resize", scheduleSync, { passive: true });
    new MutationObserver(() => {
        registerContainers();
        scheduleSync();
    }).observe(document.body, { childList: true, subtree: true });
}

installEditorUtilities();
installStickyHeadingFix();
new MutationObserver(() => {
    installEditorUtilities();
    installStickyHeadingFix();
}).observe(document.body, { childList: true, subtree: true });
