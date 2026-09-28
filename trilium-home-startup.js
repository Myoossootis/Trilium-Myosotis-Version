/* Home navigation overrides for Trilium Notes v0.105.x. */
const HOME_NOTE_ID = "HmeDashboard";
const NEW_TAB_SELECTOR = ".note-new-tab";

function openHomeTab() {
    return api.openTabWithNote(HOME_NOTE_ID, true);
}

async function ensureHomeTabInBackground() {
    const alreadyOpen = api.getMainNoteContexts().some((context) =>
        context.note?.noteId === HOME_NOTE_ID ||
        context.notePath?.split("/").includes(HOME_NOTE_ID)
    );

    if (!alreadyOpen) await api.openTabWithNote(HOME_NOTE_ID, false);
}

// Let Trilium restore and keep the last active editing tab. Home is added as
// a background tab only, so startup never steals focus from the user's note.
setTimeout(() => void ensureHomeTabInBackground(), 900);

// The built-in "+" button dispatches openNewTab. Intercept it before the
// command handler so an explicit Home tab is created instead of an empty tab.
document.addEventListener("click", (event) => {
    if (!event.target.closest(NEW_TAB_SELECTOR)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void openHomeTab();
}, true);

// Keep the keyboard entry point consistent with the "+" button.
api.bindGlobalShortcut("ctrl+t", () => void openHomeTab(), "eric-home-new-tab");

const AUTO_INDENT_ATTRIBUTE = "data-eric-no-auto-indent";

async function toggleParagraphAutoIndent() {
    const editor = await api.getActiveContextTextEditor();
    const paragraph = [...editor.model.document.selection.getSelectedBlocks()]
        .find((block) => block.is("element", "paragraph"));

    if (!paragraph) {
        api.showMessage("请先将光标放在要调整的正文段落中。");
        return;
    }
    if (paragraph.hasAttribute("listType")) {
        api.showMessage("列表缩进请使用列表工具；层级缩进按钮只作用于普通正文。");
        return;
    }
    if (!editor.model.schema.checkAttribute(paragraph, "htmlPAttributes")) {
        api.showError("当前编辑器未启用段落样式保存，无法取消自动缩进。");
        return;
    }

    const oldValue = paragraph.getAttribute("htmlPAttributes") || {};
    const oldAttributes = oldValue.attributes || {};
    const disabled = oldAttributes[AUTO_INDENT_ATTRIBUTE] === "true";
    const attributes = { ...oldAttributes };
    if (disabled) delete attributes[AUTO_INDENT_ATTRIBUTE];
    else attributes[AUTO_INDENT_ATTRIBUTE] = "true";

    editor.model.change((writer) => {
        if (Object.keys(attributes).length || oldValue.classes?.length || Object.keys(oldValue.styles || {}).length) {
            writer.setAttribute("htmlPAttributes", { ...oldValue, attributes }, paragraph);
        } else {
            writer.removeAttribute("htmlPAttributes", paragraph);
        }
    });
    api.showMessage(disabled ? "已恢复该段的自动层级缩进。" : "已取消该段的自动层级缩进。");
}

function installAutoIndentButton() {
    for (const toolbar of document.querySelectorAll(".ck-toolbar")) {
        if (toolbar.querySelector(".eric-auto-indent-toggle")) continue;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "ck ck-button eric-auto-indent-toggle";
        button.title = "取消／恢复首段层级缩进";
        button.setAttribute("aria-label", button.title);
        button.innerHTML = '<span class="ck ck-icon" aria-hidden="true">⇤</span>';
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => void toggleParagraphAutoIndent());
        toolbar.append(button);
    }
}

// Removes only copied spacing overrides. Text decoration, links, equations,
// heading level and list structure remain untouched and continue to use the
// knowledge-base stylesheet as their single source of layout.
const NORMALIZED_SPACING_STYLES = new Set([
    "line-height",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "margin-block",
    "margin-block-start",
    "margin-block-end",
    "padding-top",
    "padding-bottom"
]);

function removeSpacingOverrides(writer, item, visited) {
    if (visited.has(item)) return 0;
    visited.add(item);

    let changed = 0;
    for (const [attributeName, attributeValue] of item.getAttributes()) {
        if (attributeName === "lineHeight") {
            writer.removeAttribute(attributeName, item);
            changed++;
            continue;
        }

        // HTML support stores pasted CSS in html*Attributes.styles.
        if (!attributeName.startsWith("html") || !attributeValue?.styles ||
            typeof attributeValue.styles !== "object") continue;

        const styles = { ...attributeValue.styles };
        const removableKeys = Object.keys(styles).filter((styleName) =>
            NORMALIZED_SPACING_STYLES.has(styleName.toLowerCase())
        );
        if (!removableKeys.length) continue;

        for (const styleName of removableKeys) delete styles[styleName];
        const nextValue = { ...attributeValue };
        if (Object.keys(styles).length) nextValue.styles = styles;
        else delete nextValue.styles;

        if (Object.keys(nextValue).length) writer.setAttribute(attributeName, nextValue, item);
        else writer.removeAttribute(attributeName, item);
        changed++;
    }

    if (item.is?.("element")) {
        for (const child of item.getChildren()) changed += removeSpacingOverrides(writer, child, visited);
    }
    return changed;
}

async function normalizeSelectedTextFormatting() {
    const editor = await api.getActiveContextTextEditor();
    const blocks = [...editor.model.document.selection.getSelectedBlocks()];
    if (!blocks.length) {
        api.showMessage("请先把光标放在要规范化的段落中，或选中多个段落。");
        return;
    }

    let changed = 0;
    editor.model.change((writer) => {
        const visited = new Set();
        for (const block of blocks) changed += removeSpacingOverrides(writer, block, visited);
    });
    api.showMessage(changed
        ? `已清除 ${changed} 处复制带来的行距或段落留白。`
        : "所选内容没有可清除的行距或段落留白覆盖。");
}

function installFormatNormalizeButton() {
    for (const toolbar of document.querySelectorAll(".ck-toolbar")) {
        if (toolbar.querySelector(".eric-format-normalize")) continue;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "ck ck-button eric-format-normalize";
        button.title = "规范化行距与段落间距";
        button.setAttribute("aria-label", button.title);
        button.innerHTML = '<span class="ck ck-icon" aria-hidden="true">↕</span>';
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => void normalizeSelectedTextFormatting());
        toolbar.append(button);
    }
}

function installEditorUtilities() {
    installAutoIndentButton();
    installFormatNormalizeButton();
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

function getStickyHeadingLaneTop(content, h3) {
    const scrollParent = getStickyHeadingScrollParent(content);
    const parentTop = scrollParent === document.scrollingElement
        ? 0
        : scrollParent.getBoundingClientRect().top;
    const configuredOffset = parseFloat(getComputedStyle(h3).top);
    return parentTop + (Number.isFinite(configuredOffset) ? Math.max(0, configuredOffset) : 0);
}

function syncStickyHeadingContainer(content) {
    if (!content.isConnected) return;

    const headings = [...content.querySelectorAll("h2, h3")];
    const h2Indexes = headings.reduce((indexes, heading, index) => {
        if (heading.tagName === "H2") indexes.push(index);
        return indexes;
    }, []);

    for (let index = 0; index < headings.length; index++) {
        const heading = headings[index];
        if (heading.tagName !== "H3") continue;

        const nextH2Index = h2Indexes.find((h2Index) => h2Index > index);
        const nextH2 = nextH2Index === undefined ? null : headings[nextH2Index];
        const superseded = nextH2 &&
            nextH2.getBoundingClientRect().top <= getStickyHeadingLaneTop(content, heading) + 1;
        heading.classList.toggle(STICKY_H3_SUPERSEDED_CLASS, Boolean(superseded));
    }
}

function installStickyHeadingFix() {
    if (window.__ericStickyHeadingFix) return;
    window.__ericStickyHeadingFix = true;

    const style = document.createElement("style");
    style.id = "eric-sticky-heading-fix-style";
    style.textContent = `
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
            if (existing?.scrollParent === scrollParent) continue;

            existing?.scrollParent?.removeEventListener("scroll", existing.onScroll);
            const onScroll = scheduleSync;
            scrollParent.addEventListener("scroll", onScroll, { passive: true });
            containers.set(content, { scrollParent, onScroll });
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
