/*
 * 列表编号样式按钮
 * ------------------------------------------------------------------
 * 在编辑器工具栏加一排编号样式按钮：1. 01. a. A. i. I. •
 * 点一下即把光标所在的列表切换为对应编号样式。
 *
 * 说明：内置的「列表样式」下拉菜单若不好用，可用这些按钮替代。
 *      起始编号请用内置的「列表属性 → 起始值」设置（该字段只接受数字，
 *      例如要从 c 开始就填 3；字母序号：a=1 b=2 c=3 … z=26 aa=27）。
 *
 * 安装：本笔记需带标签 #run=frontendStartup 才会随应用启动运行。
 */

const ERIC_LIST_STYLES = [
    { type: "decimal",              text: "1.",   title: "数字：1. 2. 3." },
    { type: "decimal-leading-zero", text: "01.",  title: "补零数字：01. 02. 03." },
    { type: "lower-alpha",          text: "a.",   title: "小写字母：a. b. c." },
    { type: "upper-alpha",          text: "A.",   title: "大写字母：A. B. C." },
    { type: "lower-roman",          text: "i.",   title: "小写罗马：i. ii. iii." },
    { type: "upper-roman",          text: "I.",   title: "大写罗马：I. II. III." },
    { type: "disc",                 text: "\u2022", title: "圆点列表" }
];

async function ericListEditor() {
    try {
        return await api.getActiveContextTextEditor();
    } catch (e) {
        return null;
    }
}

async function ericSetListStyle(type) {
    const editor = await ericListEditor();
    if (!editor || !editor.model) {
        api.showMessage("请先在文本笔记中把光标放到列表里。");
        return;
    }

    const cmd = editor.commands && editor.commands.get("listStyle");
    if (cmd) {
        try {
            editor.execute("listStyle", { type: type });
            return;
        } catch (e) {
            /* 落到模型兜底 */
        }
    }

    const model = editor.model;
    const blocks = [...model.document.selection.getSelectedBlocks()];
    let hit = false;
    model.change(function (writer) {
        for (const b of blocks) {
            if (b.hasAttribute && b.hasAttribute("listType")) {
                writer.setAttribute("listStyle", type, b);
                hit = true;
            }
        }
    });
    if (!hit) api.showMessage("请先把光标放到列表项里，再选择编号样式。");
}

function ericListButton(label, title, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ck ck-button eric-list-btn";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.style.minWidth = "24px";
    b.style.padding = "0 4px";
    const span = document.createElement("span");
    span.className = "ck ck-button__label";
    span.style.fontWeight = "600";
    span.textContent = label;
    b.appendChild(span);
    b.addEventListener("mousedown", (ev) => ev.preventDefault());
    b.addEventListener("click", (ev) => { ev.preventDefault(); void onClick(); });
    return b;
}

function ericInstallListButtons() {
    for (const toolbar of document.querySelectorAll(".ck-toolbar")) {
        if (toolbar.querySelector(".eric-list-group")) continue;

        const group = document.createElement("div");
        group.className = "eric-list-group";
        group.style.display = "inline-flex";
        group.style.alignItems = "center";
        group.style.gap = "1px";

        for (const item of ERIC_LIST_STYLES) {
            group.appendChild(ericListButton(item.text, item.title,
                () => ericSetListStyle(item.type)));
        }

        toolbar.appendChild(group);
    }
}

ericInstallListButtons();
new MutationObserver(ericInstallListButtons).observe(document.body, {
    childList: true,
    subtree: true
});
