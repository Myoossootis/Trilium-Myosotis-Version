/* Home Pages state and inbox actions. Layout is an ordinary local Trilium note. */
function homePagesService(action, payload = {}) {
    if(api.getNote('MyoMarketData')?.getJsonContent()?.plugins.find(p=>p.id==='gTC4ItLtMiD5')?.enabled===false)throw Error('该插件已关闭，请在插件管理器中开启。');
    const stateNote = api.getNote("HmHomeData01");
    if (!stateNote || stateNote.isDeleted || stateNote.isProtected || !stateNote.hasLabel("homeLayoutData"))
        throw new Error("首页布局数据不可访问，已停止写入。");
    let state;
    try { state = JSON.parse(stateNote.getContent()); }
    catch { throw new Error("首页布局数据无法读取，请从备份恢复。"); }
    if (state.version !== 1 || !Number.isSafeInteger(state.revision)) throw new Error("首页数据版本不兼容。");
    if (action === "load") return state;
    if (action === "capture") {
        const text = String(payload.text || "").trim();
        if (!text || text.length > 20000) throw new Error("记录内容须为 1–20000 字。");
        const parentId = "e6856b492955";
        const parent = api.getNote(parentId);
        if (!parent || parent.isDeleted || parent.isProtected) throw new Error("待整理资料笔记不可访问。");
        const escape = value => value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
        const title = text.split(/\r?\n/)[0].slice(0, 80);
        const result = api.createTextNote(parentId, title, text.split(/\r?\n/).map(line => `<p>${escape(line) || "<br>"}</p>`).join(""));
        return { noteId: result.note.noteId, title };
    }
    if (!["save", "validate"].includes(action)) throw new Error("不支持的首页操作。");
    if (action === "save" && payload.revision !== state.revision) throw new Error("首页已在另一窗口更新，请刷新后重新编辑。");
    const layout = payload.layout;
    const kinds = new Set(["hero", "tasks", "workbench", "pomodoro", "stats", "recent", "quicklinks", "countdown", "quote", "contributions", "calendar", "capture", "note"]);
    if (!layout || layout.version !== 1 || !Array.isArray(layout.pages) || layout.pages.length < 1 || layout.pages.length > 20)
        throw new Error("布局须包含 1–20 个页面。");
    const ids = new Set();
    for (const page of layout.pages) {
        if (!page || typeof page.id !== "string" || !page.id || ids.has(page.id) || typeof page.name !== "string" || !page.name.trim() || page.name.length > 40 || !Array.isArray(page.widgets) || page.widgets.length > 80)
            throw new Error("页面名称或组件数量无效。");
        ids.add(page.id);
        const widgetIds = new Set();
        for (const widget of page.widgets) {
            if (!widget || typeof widget.id !== "string" || !widget.id || widgetIds.has(widget.id) || !kinds.has(widget.kind) || !Number.isInteger(widget.w) || widget.w < 1 || widget.w > 12 || !Number.isInteger(widget.h) || widget.h < 2 || widget.h > 30 || typeof widget.title !== "string" || widget.title.length > 80 || !widget.config || typeof widget.config !== "object" || Array.isArray(widget.config))
                throw new Error("组件类型、尺寸或设置无效。");
            widgetIds.add(widget.id);
        }
    }
    if (!ids.has(layout.activePageId) || JSON.stringify(layout).length > 200000) throw new Error("首页布局无效或过大。");
    if (action === "validate") return { valid: true };
    state = { ...state, revision: state.revision + 1, layout };
    stateNote.setContent(JSON.stringify(state));
    return state;
}
