/* Trilium Home Pages: modular dashboard; visual and pointer interaction adapted from Home Pages, GPL-3.0-only. See THIRD_PARTY_NOTICES.md. */
import { useEffect, useRef, useState } from "trilium:preact";
const DASHBOARD_CACHE_KEY = "eric-home-pages-data-v1";
const WORD_CACHE_KEY = "eric-home-word-counts-v2";
function dayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function noteDate(entry) { return entry.meta?.dateModified || entry.meta?.utcDateModified || entry.meta?.dateCreated || ""; }
function dateKeyFromValue(value) { return String(value).slice(0, 10); }
function greeting(hour) { return hour < 6 ? "夜深了，" : hour < 11 ? "上午好，" : hour < 14 ? "中午好，" : hour < 18 ? "下午好，" : "晚上好，"; }
function daysUntil(value) { const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? "—" : Math.ceil((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000); }
function prettyDate(value) { const d = new Date(String(value).replace(" ", "T")); if (Number.isNaN(d.getTime())) return String(value).slice(0, 10); const age = Math.max(0, Date.now() - d.getTime()); return age < 3600000 ? `${Math.max(1, Math.round(age / 60000))} 分钟前` : age < 86400000 ? `${Math.round(age / 3600000)} 小时前` : age < 604800000 ? `${Math.round(age / 86400000)} 天前` : `${d.getMonth() + 1}/${d.getDate()}`; }

function countWords(content) {
    const text = String(content || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
    const words = (text.replace(/[\u3400-\u9fff]/g, " ").match(/[\p{L}\p{N}_'-]+/gu) || []).length;
    return chinese + words;
}

function parseQuoteLibrary(content) {
    const doc = new DOMParser().parseFromString(String(content || ""), "text/html");
    const listItems = [...doc.querySelectorAll("li")];
    const rows = listItems.length ? listItems : [...doc.querySelectorAll("p")];
    return rows.map((node) => node.textContent.trim()).filter(Boolean).map((line) => {
        const [quote, ...source] = line.split(/\s*[｜|]\s*/);
        return [quote.trim(), source.join("｜").trim() || "格言库"];
    }).filter(([quote]) => quote);
}

function dailyIndex(date, length) {
    const seed = dayKey(date).split("").reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 7);
    return length ? seed % length : 0;
}

function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage is optional */ }
}

async function getMetadata(note) {
    if (note.dateModified || note.utcDateModified || note.dateCreated) return {
        dateModified: note.dateModified, utcDateModified: note.utcDateModified, dateCreated: note.dateCreated
    };
    try { return await note.getMetadata(); } catch { return {}; }
}

async function getWordCounts(entries) {
    const result = new Map();
    const previous = readStorage(WORD_CACHE_KEY, {}); const nextCache = {};
    let next = 0;
    async function worker() {
        while (next < entries.length) {
            const { note, meta } = entries[next++];
            const stamp = noteDate({ meta });
            const preset = Number(note.getLabelValue("wordCount") || 0);
            if (preset) { result.set(note.noteId, preset); nextCache[note.noteId] = { stamp, words: preset }; continue; }
            if (!["text", "code", "markdown", "render"].includes(note.type)) { result.set(note.noteId, 0); nextCache[note.noteId] = { stamp, words: 0 }; continue; }
            if (stamp && previous[note.noteId]?.stamp === stamp) {
                result.set(note.noteId, previous[note.noteId].words || 0); nextCache[note.noteId] = previous[note.noteId]; continue;
            }
            try {
                const words = countWords(await note.getContent()); result.set(note.noteId, words); nextCache[note.noteId] = { stamp, words };
            } catch { result.set(note.noteId, 0); }
        }
    }
    await Promise.all(Array.from({ length: Math.min(8, entries.length) }, worker));
    writeStorage(WORD_CACHE_KEY, nextCache);
    return result;
}


function contributionLevel(words) { return words >= 2001 ? 4 : words >= 1001 ? 3 : words >= 501 ? 2 : words >= 1 ? 1 : 0; }
function formatWords(words) { return words >= 10000 ? `${(words / 10000).toFixed(1)} 万` : words.toLocaleString("zh-CN"); }
function ContributionGrid({ dailyChanges = {} }) {
    const scrollRef = useRef(null);
    const today = new Date(); const start = new Date(today); const dates = [];
    start.setHours(0, 0, 0, 0); start.setDate(today.getDate() - (52 * 7 + today.getDay()));
    for (const date = new Date(start); date <= today; date.setDate(date.getDate() + 1)) dates.push(new Date(date));
    const months = [];
    dates.forEach((date, index) => {
        if (date.getDate() <= 7 && !months.some((item) => item.month === date.getMonth())) months.push({ month: date.getMonth(), column: Math.floor(index / 7) + 1 });
    });
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        });
        return () => cancelAnimationFrame(frame);
    }, [dailyChanges]);
    return <div className="ehd-contribution-chart" aria-label="近一年笔记更新">
        <div className="ehd-weekdays"><span>周一</span><span>周三</span><span>周五</span></div>
        <div className="ehd-heatmap-scroll" ref={scrollRef}><div className="ehd-heatmap">
            <div className="ehd-months">{months.map((item) => <span style={{ gridColumnStart: item.column }}>{item.month + 1}月</span>)}</div>
            <div className="ehd-grid">{dates.map((date) => { const change = dailyChanges[dayKey(date)] || {}; const total = Number(change.changed || 0); return <span className={`ehd-cell l${contributionLevel(total)}`} title={`${dayKey(date)}：新增 ${formatWords(Number(change.added || 0))} 字，删除 ${formatWords(Number(change.deleted || 0))} 字，实际改动 ${formatWords(total)} 字`} />; })}</div>
        </div></div>
    </div>;
}


function MiniCalendar({ today }) {
    const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
    const [selected, setSelected] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    const year = month.getFullYear(); const monthIndex = month.getMonth();
    const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const days = new Date(year, monthIndex + 1, 0).getDate();
    const cells = [...Array(leading).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
    while (cells.length < 42) cells.push(null);
    const moveMonth = (step) => setMonth(new Date(year, monthIndex + step, 1));
    const isTodayMonth = year === today.getFullYear() && monthIndex === today.getMonth();
    const selectDay = (day) => setSelected(new Date(year, monthIndex, day));
    return <div className="ehd-calendar">
        <div className="ehd-calendar-head"><button title="上个月" onClick={() => moveMonth(-1)}>‹</button><button className="ehd-calendar-title" title="回到本月" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>{year}年{monthIndex + 1}月</button><button title="下个月" onClick={() => moveMonth(1)}>›</button></div>
        <div className="ehd-calendar-week">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="ehd-calendar-days">{cells.map((day, index) => day ? <button key={index} title={`${year}年${monthIndex + 1}月${day}日`} className={`${isTodayMonth && day === today.getDate() ? "today " : ""}${selected.getFullYear() === year && selected.getMonth() === monthIndex && selected.getDate() === day ? "selected" : ""}`} aria-pressed={selected.getFullYear() === year && selected.getMonth() === monthIndex && selected.getDate() === day} onClick={() => selectDay(day)}>{day}</button> : <span key={index} className="empty" />)}</div>
        <div className="ehd-calendar-selected">已选：{selected.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</div>
    </div>;
}


const CATALOG = [
    { kind: "hero", title: "欢迎回来", icon: "sun", color: "#8b5cf6", w: 12, h: 4, description: "时段问候、实时时钟、知识库概览与目标徽章。" },
    { kind: "tasks", title: "待办与日程", icon: "task", color: "#0ea5e9", w: 4, h: 7, description: "直接读取 ToDo 清单，勾选完成，打开原任务。" },
    { kind: "workbench", title: "工作台资料", icon: "briefcase-alt-2", color: "#10b981", w: 4, h: 7, description: "原工作台的笔记、流程图和待整理资料。" },
    { kind: "pomodoro", title: "番茄时钟", icon: "stopwatch", color: "#e11d48", w: 4, h: 3, description: "连接现有番茄钟，离开首页也继续计时。" },
    { kind: "stats", title: "库统计", icon: "pie-chart-alt-2", color: "#d97706", w: 4, h: 4, description: "笔记、标签、知识库字数与附件统计。" },
    { kind: "recent", title: "最近笔记", icon: "history", color: "#3b82f6", w: 4, h: 5, description: "显示最近修改的内容笔记和所属知识库。" },
    { kind: "quicklinks", title: "快捷入口", icon: "pin", color: "#0d9488", w: 4, h: 5, description: "学术、硬件知识库与常用工具的图标磁贴。" },
    { kind: "countdown", title: "年度目标", icon: "hourglass", color: "#e11d48", w: 4, h: 3, description: "距目标日期的剩余天数或已经过去的天数。" },
    { kind: "quote", title: "每日一言", icon: "quote-alt-left", color: "#22a06b", w: 4, h: 3, description: "沿用每日格言库，按天轮换。" },
    { kind: "contributions", title: "笔记更新", icon: "calendar-check", color: "#0d9488", w: 8, h: 4, description: "按实际字数改动展示写作活动热力图。" },
    { kind: "calendar", title: "日历", icon: "calendar", color: "#8b5cf6", w: 4, h: 5, description: "浏览月份和日期，不自动创建日记。" },
    { kind: "capture", title: "快速记录", icon: "edit-alt", color: "#0ea5e9", w: 4, h: 4, description: "把想法保存为待整理资料下的普通笔记。" },
    { kind: "note", title: "笔记预览", icon: "file", color: "#64748b", w: 6, h: 5, description: "在首页阅读指定笔记的文字，随时打开原文。" }
];
const SPEC = Object.fromEntries(CATALOG.map(item => [item.kind, item]));
const clone = value => JSON.parse(JSON.stringify(value));
const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const makeWidget = kind => ({ id: uid(kind), kind, title: SPEC[kind].title, w: SPEC[kind].w, h: SPEC[kind].h, config: {} });
function defaultLayout() {
    return { version: 1, activePageId: "workspace", pages: [{ id: "workspace", name: "工作台", widgets: ["hero", "tasks", "workbench", "pomodoro", "stats", "recent", "quicklinks", "countdown", "quote", "contributions", "calendar"].map(makeWidget) }] };
}
let backendSource;
async function homeService(action, payload = {}) {
    if (!backendSource) backendSource = await (await api.getNote("HmHomeSvc01")).getContent();
    return api.runOnBackend(backendSource, [action, payload]);
}
function Icon({ name, ...props }) { return <i {...props} className={`bx bx-${name}`} aria-hidden="true" />; }
function SmallButton({ icon, title, onClick, disabled = false, children }) { return <button type="button" className="hp-editbtn" title={title} aria-label={title} onClick={onClick} disabled={disabled}>{icon && <Icon name={icon}/>} {children}</button>; }
const NOTE_LINKS = [
    ["book-open", "学术知识库", "79483c47e0d0"], ["chip", "硬件知识库", "e3e7d52e13a9"],
    ["task", "今日任务", "ZrxUIJf75kFS"], ["stopwatch", "番茄钟", "MyoPomoBoard"],
    ["book", "学习题库", "HwQuizBoard01"], ["extension", "插件市场", "0e50f559e1a3"]
];
const KNOWLEDGE_BASE_IDS = ["79483c47e0d0", "e3e7d52e13a9"];
const TASK_STATUSES = [["进行中", "52Z91MOBH5g9"], ["已冻结", "IXeWPMzNDeCF"], ["已完成", "VRagMKcXpZ6N"], ["已归档", "G1dMogAOtW5i"]];
async function loadHomeData(report) {
    const settings = await api.getNote("HmSettings01") || api.startNote;
    const [all, quoteNote, changesNote, workbench] = await Promise.all([
        api.searchForNotes("note.title *=* ''"), api.searchForNote("#homeQuotes"), api.searchForNote("#homeWordChangeData"), api.getNote("eae485474234")
    ]);
    const notes = all.filter(note => !note.isDeleted && !note.hasLabel("homeInternal"));
    const withinKnowledge = note => KNOWLEDGE_BASE_IDS.includes(note.noteId) || KNOWLEDGE_BASE_IDS.some(id => note.hasAncestor?.(id));
    const metadata = await Promise.all(notes.map(async note => ({ note, meta: await getMetadata(note) })));
    const recent = metadata.filter(({ note }) => note.noteId !== "eae485474234" && (withinKnowledge(note) || ["text", "markdown"].includes(note.type)))
        .map(({ note, meta }) => ({ noteId: note.noteId, title: note.title, meta, location: note.hasAncestor?.(KNOWLEDGE_BASE_IDS[1]) ? "硬件知识库" : note.hasAncestor?.(KNOWLEDGE_BASE_IDS[0]) ? "学术知识库" : "笔记" }))
        .sort((a, b) => String(noteDate(b)).localeCompare(String(noteDate(a))));
    const groups = await Promise.all(TASK_STATUSES.map(async ([name, id]) => ({ name, id, tasks: (await api.searchForNotes(`note.parents.noteId = "${id}"`)).filter(note => !note.isDeleted && note.hasLabel("todoItem")).map(note => ({ noteId: note.noteId, title: note.title, dueDate: note.getLabelValue("dueDate") || "", priority: note.getLabelValue("priority") || "" })) })));
    const workbenchNotes = workbench ? await workbench.getChildNotes() : [];
    const links = (await Promise.all(NOTE_LINKS.map(async ([icon, title, noteId]) => { const note = await api.getNote(noteId); return note && !note.isDeleted ? { icon, title, noteId } : null; }))).filter(Boolean);
    let changes = {}; try { changes = JSON.parse(await changesNote?.getContent?.() || "{}").days || {}; } catch { /* unrelated statistics remain optional */ }
    const data = {
        name: settings.getLabelValue("homeGreetingName") || "朋友", countdownTitle: settings.getLabelValue("homeCountdownTitle") || "年度目标", countdownDate: settings.getLabelValue("homeCountdownDate") || "2026-12-31",
        quotes: quoteNote ? parseQuoteLibrary(await quoteNote.getContent()) : [], quoteNoteId: quoteNote?.noteId || settings.noteId,
        totalNotes: notes.filter(note => !["book", "launcher"].includes(note.type)).length,
        totalTags: new Set(notes.flatMap(note => (note.getLabels?.() || []).map(label => label.name))).size,
        attachments: notes.filter(note => ["file", "image"].includes(note.type)).length,
        notes: recent, groups, links, words: null, dailyChanges: changes,
        workbench: workbenchNotes.filter(note => !note.isDeleted).map(note => ({ noteId: note.noteId, title: note.title, icon: note.type === "render" ? "task" : "file-blank" }))
    };
    report(data);
    const counts = await getWordCounts(metadata.filter(({ note }) => withinKnowledge(note)));
    data.words = [...counts.values()].reduce((sum, value) => sum + value, 0);
    report({ ...data });
    writeStorage(DASHBOARD_CACHE_KEY, data);
}
function Empty({ children }) { return <div className="hp-empty"><Icon name="inbox"/><span>{children}</span></div>; }
function NoteList({ notes, limit = 7 }) {
    return <div className="hp-list">{notes.slice(0, limit).map(note => <button type="button" key={note.noteId} className="hp-list-row is-clickable" title={note.title} onClick={() => api.activateNote(note.noteId)}><span className="hp-list-icon"><Icon name="file-blank"/></span><span className="hp-list-text"><span className="hp-list-title">{note.title || "未命名笔记"}</span>{note.location && <span className="hp-list-sub">{note.location}</span>}</span>{note.meta && <span className="hp-list-meta">{prettyDate(noteDate(note))}</span>}</button>)}{!notes.length && <Empty>这里还没有笔记</Empty>}</div>;
}
function Hero({ data, config }) {
    const [now, setNow] = useState(new Date());
    useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
    return <div className={`hp-card-body hp-hero hp-hero-${config.background || "sky"}`}>
        <div className="hp-hero-top"><div className="hp-hero-left"><div className="hp-hero-greeting"><span className="hp-hero-greeting-icon"><Icon name="sun"/></span>{greeting(now.getHours())}<span className="hp-hero-name">{config.name || data.name || "朋友"}</span></div><div className="hp-hero-meta"><span className="hp-hero-meta-item"><Icon name="file-blank"/>{data.totalNotes ?? "—"} 篇笔记</span><span className="hp-hero-meta-item"><Icon name="purchase-tag-alt"/>{data.totalTags ?? "—"} 标签</span></div></div><div className="hp-hero-clockbox"><div className="hp-hero-clock">{now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}{config.seconds && <span className="hp-hero-clock-seconds">:{String(now.getSeconds()).padStart(2, "0")}</span>}</div><div className="hp-hero-date">{now.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })}</div></div></div>
        <div className="hp-hero-chips"><span className="hp-hero-chip"><Icon name="leaf"/>{config.subtitle || "把思考沉淀为可复用的知识"}</span><span className="hp-hero-chip"><Icon name="flag"/>{data.countdownTitle || "年度目标"} {daysUntil(data.countdownDate || "2026-12-31")} 天</span></div>
    </div>;
}
function Pomodoro() {
    const [service, setService] = useState(null), [state, setState] = useState(null), [error, setError] = useState("");
    useEffect(() => { let alive = true, dispose; (async () => { try { if (!window.MyoPomodoro) { const note = await api.getNote("MyoPomoRun1"); if (!note) throw new Error("尚未安装番茄钟"); new Function(await note.getContent())(); } if (alive) { setService(window.MyoPomodoro); dispose = window.MyoPomodoro.subscribe(setState); } } catch (failure) { if (alive) setError(failure.message); } })(); return () => { alive = false; dispose?.(); }; }, []);
    if (!state) return <Empty>{error || "正在连接计时服务…"}</Empty>;
    const seconds = Math.ceil(state.remaining / 1000), time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    const today = dayKey(new Date());
    const done = state.history.filter(record => dayKey(new Date(record.time)) === today).length;
    return <div className="hp-card-body ehd-pomo"><div className="ehd-pomo-ring"><b>{time}</b><small>{state.mode === "focus" ? "专注" : "休息"}</small></div><div className="ehd-pomo-controls"><span className="ehd-pomo-dots">● ● ● ●</span><small>今日 {done} · 累计 {state.completed}</small><div className="ehd-pomo-buttons"><SmallButton icon="reset" title="重置番茄钟" onClick={() => service.reset()}/><button type="button" className="ehd-pomo-start" onClick={() => { if (state.status === "done") { service.next(); service.start(); } else if (state.status === "running") service.pause(); else service.start(); }}><Icon name={state.status === "running" ? "pause" : "play"}/>{state.status === "running" ? "暂停" : state.status === "done" ? "下一轮" : "开始"}</button><SmallButton icon="link-external" title="打开完整番茄钟" onClick={() => api.activateNote("MyoPomoBoard")}/></div></div></div>;
}
async function completeTask(noteId, completed) {
    return api.runOnBackend((taskId, targetId, statusIds, done) => {
        if(api.getNote('MyoMarketData')?.getJsonContent()?.plugins.find(p=>p.id==='TdBoardJs001')?.enabled===false)throw Error('任务管理插件已关闭。');
        const note = api.getNote(taskId); if (!note || !note.hasLabel("todoItem") || note.isDeleted) throw new Error("任务已不存在。");
        const parents = note.getParentNotes().filter(parent => statusIds.includes(parent.noteId));
        api.toggleNoteInParent(true, taskId, targetId);
        for (const parent of parents) if (parent.noteId !== targetId) api.toggleNoteInParent(false, taskId, parent.noteId);
        note.setRelation("location", targetId);
        if (done) note.setLabel("completedDate", api.dayjs().format("YYYY-MM-DD")); else note.removeLabel("completedDate");
    }, [noteId, completed ? "VRagMKcXpZ6N" : "52Z91MOBH5g9", TASK_STATUSES.map(([, id]) => id), completed]);
}
function Tasks({ data, onRefresh }) {
    const [status, setStatus] = useState("52Z91MOBH5g9"), [busy, setBusy] = useState("");
    const group = data.groups?.find(item => item.id === status);
    async function toggle(task) { setBusy(task.noteId); try { await completeTask(task.noteId, status !== "VRagMKcXpZ6N"); await onRefresh(); } catch (error) { api.showError(error.message); } finally { setBusy(""); } }
    return <div className="hp-card-body"><div className="ehd-task-filters">{(data.groups || []).slice(0, 3).map((item, index) => <button type="button" className={`ehd-task-filter tone-${index}${status === item.id ? " active" : ""}`} onClick={() => setStatus(item.id)} key={item.id}>{item.name} {item.tasks.length}</button>)}</div><div className="hp-list">{(group?.tasks || []).map(task => <div className="ehd-task-row" key={task.noteId}><button type="button" className="ehd-task-check" aria-label={status === "VRagMKcXpZ6N" ? "取消完成" : "完成任务"} disabled={busy === task.noteId} onClick={() => toggle(task)}>{status === "VRagMKcXpZ6N" && <Icon name="check"/>}</button><button type="button" className="ehd-task-open" onClick={() => api.activateNote(task.noteId)}><b>{task.title}</b><small>ToDo 清单 {task.dueDate && `· ${task.dueDate}`}</small></button></div>)}{!group?.tasks.length && <Empty>当前没有{group?.name || "待办"}任务</Empty>}</div><button type="button" className="ehd-card-link" onClick={() => api.activateNote("ZrxUIJf75kFS")}>打开完整任务看板 <Icon name="right-arrow-alt"/></button></div>;
}
function Capture({ onRefresh }) {
    const [text, setText] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
    async function save() { if (!text.trim()) return; setBusy(true); try { const result = await homeService("capture", { text }); setText(""); setMessage(`已保存「${result.title}」`); await onRefresh(); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
    return <div className="hp-card-body ehd-capture"><textarea placeholder="记下想法，保存到待整理资料…" aria-label="快速记录" maxLength={20000} value={text} onInput={event => setText(event.currentTarget.value)}/><button type="button" className="hp-button mod-cta" disabled={busy || !text.trim()} onClick={save}>{busy ? "保存中…" : "保存记录"}</button><span className="ehd-inline-status" role="status">{message}</span></div>;
}
function NotePreview({ noteId }) {
    const [text, setText] = useState(""), [error, setError] = useState("");
    useEffect(() => { let alive = true; setText(""); setError(""); if (noteId) api.getNote(noteId).then(async note => { if (!note || note.isDeleted || note.isProtected) throw new Error("笔记不存在或受保护。"); const content = await note.getContent(); const plain = note.mime === "text/html" ? new DOMParser().parseFromString(content, "text/html").body.textContent : content; if (alive) setText(plain); }).catch(failure => { if (alive) setError(failure.message); }); return () => { alive = false; }; }, [noteId]);
    return <div className="hp-card-body"><div className="hp-note"><p className="ehd-note-preview">{error || text || (noteId ? "正在读取笔记…" : "在组件设置中选择要预览的笔记。")}</p></div>{noteId && <button type="button" className="hp-note-open" onClick={() => api.activateNote(noteId)}>打开原笔记 →</button>}</div>;
}
function WidgetBody({ widget, data, onRefresh }) {
    const config = widget.config || {};
    const dependency={pomodoro:'x9qOG6S641fS',tasks:'TdBoardJs001'}[widget.kind];
    if(dependency&&window.TriliumModules?.enabled(dependency)===false)return <Empty>{widget.kind==='pomodoro'?'番茄钟已关闭':'任务管理已关闭'}</Empty>;
    switch (widget.kind) {
        case "hero": return <Hero data={data} config={config}/>;
        case "pomodoro": return <Pomodoro/>;
        case "tasks": return <Tasks data={data} onRefresh={onRefresh}/>;
        case "recent": return <div className="hp-card-body"><NoteList notes={(data.notes || []).filter(note => !config.scope || config.scope === "all" || note.location === config.scope)} limit={Number(config.limit) || 7}/></div>;
        case "workbench": return <div className="hp-card-body"><NoteList notes={data.workbench || []}/><button type="button" className="ehd-card-link" onClick={() => api.activateNote("eae485474234")}>打开工作台资料 <Icon name="right-arrow-alt"/></button></div>;
        case "quicklinks": return <div className="hp-card-body hp-quicklinks" style={{ "--hp-cols": Number(config.columns) || 2 }}>{(data.links || []).filter(link=>window.TriliumModules?.available(link.noteId)!==false).map((link, index) => <button key={link.noteId} type="button" className={`hp-quicklink is-clickable hp-tone-${index % 4}`} onClick={() => api.activateNote(link.noteId)}><span className="hp-quicklink-icon"><Icon name={link.icon}/></span><span className="hp-quicklink-label">{link.title}</span></button>)}</div>;
        case "stats": return <div className="hp-card-body hp-stats" style={{ "--hp-cols": 2 }}>{[[data.totalNotes, "笔记"], [data.totalTags, "标签"], [data.words === null || data.words === undefined ? "统计中…" : formatWords(data.words), "知识库字数"], [data.attachments, "附件"]].map(([value, label], index) => <div key={label} className={`hp-stat hp-tone-${index}`}><div className="hp-stat-value">{value ?? "—"}</div><div className="hp-stat-label">{label}</div></div>)}</div>;
        case "countdown": { const date = config.date || data.countdownDate || "2026-12-31", days = daysUntil(date); return <div className={`hp-card-body hp-countdown${typeof days === "number" && days < 0 ? " is-overdue" : ""}`}><div className="hp-countdown-num"><strong className="hp-countdown-value">{typeof days === "number" ? Math.abs(days) : days}</strong><span className="hp-countdown-unit">天</span></div><div className="hp-countdown-label">{days < 0 ? "目标已过去" : days === 0 ? "目标就在今天" : "距离目标还有"} · {date}</div></div>; }
        case "quote": { const quotes = data.quotes?.length ? data.quotes : [["保持好奇，持续记录。", "知识库原则"]], quote = quotes[dailyIndex(new Date(), quotes.length)]; return <div className="hp-card-body ehd-quote-body"><Icon name="quote-alt-left"/><p>{quote[0]}</p><small>—— {quote[1]}</small></div>; }
        case "contributions": return <div className="hp-card-body ehd-contributions-body"><ContributionGrid dailyChanges={data.dailyChanges || {}}/><div className="ehd-legend">少 <i className="l0"/><i className="l1"/><i className="l2"/><i className="l3"/><i className="l4"/> 多</div></div>;
        case "calendar": return <div className="hp-card-body ehd-calendar-body"><MiniCalendar today={new Date()}/></div>;
        case "capture": return <Capture onRefresh={onRefresh}/>;
        case "note": return <NotePreview noteId={config.noteId}/>;
        default: return <Empty>组件暂不可用</Empty>;
    }
}
function Modal({ title, onClose, children }) {
    const dialog = useRef(null);
    useEffect(() => { const node = dialog.current; node.showModal(); const cancel = event => { event.preventDefault(); onClose(); }; node.addEventListener("cancel", cancel); return () => { node.removeEventListener("cancel", cancel); node.close(); }; }, []);
    return <dialog ref={dialog} className="ehd-modal" onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}><header><h2>{title}</h2><SmallButton icon="x" title="关闭" onClick={onClose}/></header>{children}</dialog>;
}
function WidgetSettings({ widget, onSave, onClose }) {
    const [value, setValue] = useState(clone(widget));
    const setConfig = (name, data) => setValue(current => ({ ...current, config: { ...current.config, [name]: data } }));
    return <Modal title="组件设置" onClose={onClose}><div className="ehd-settings"><label>组件标题<input value={value.title} maxLength={80} onInput={event => setValue({ ...value, title: event.currentTarget.value })}/></label>
        {widget.kind === "hero" && <><label>称呼<input value={value.config.name || ""} placeholder="沿用首页自定义设置" maxLength={40} onInput={event => setConfig("name", event.currentTarget.value)}/></label><label>横幅背景<select value={value.config.background || "sky"} onChange={event => setConfig("background", event.currentTarget.value)}><option value="sky">晴空渐变</option><option value="plain">主题渐变</option><option value="stars">星空</option></select></label><label>横幅短句<input value={value.config.subtitle || ""} maxLength={100} onInput={event => setConfig("subtitle", event.currentTarget.value)}/></label><label className="ehd-checkbox"><input type="checkbox" checked={!!value.config.seconds} onChange={event => setConfig("seconds", event.currentTarget.checked)}/>显示秒钟</label></>}
        {widget.kind === "recent" && <><label>显示数量<input type="number" min="1" max="30" value={value.config.limit || 7} onInput={event => setConfig("limit", clamp(Number(event.currentTarget.value), 1, 30))}/></label><label>显示范围<select value={value.config.scope || "all"} onChange={event => setConfig("scope", event.currentTarget.value)}><option value="all">所有内容笔记</option><option>学术知识库</option><option>硬件知识库</option></select></label></>}
        {widget.kind === "quicklinks" && <label>磁贴列数<input type="number" min="1" max="4" value={value.config.columns || 2} onInput={event => setConfig("columns", clamp(Number(event.currentTarget.value), 1, 4))}/></label>}
        {widget.kind === "countdown" && <label>目标日期<input type="date" value={value.config.date || ""} onChange={event => setConfig("date", event.currentTarget.value)}/></label>}
        {widget.kind === "note" && <label>笔记 ID<input value={value.config.noteId || ""} maxLength={40} placeholder="从笔记信息中复制 ID" onInput={event => setConfig("noteId", event.currentTarget.value.trim())}/></label>}
        {widget.kind === "quote" && <button type="button" className="hp-button" onClick={async () => { const note = await api.searchForNote("#homeQuotes"); if (note) { onClose(); api.activateNote(note.noteId); } }}>打开每日格言库</button>}
        {widget.kind === "pomodoro" && <button type="button" className="hp-button" onClick={() => { onClose(); api.activateNote("MyoPomoBoard"); }}>打开番茄钟设置</button>}
        <div className="ehd-dialog-actions"><button type="button" className="hp-button" onClick={onClose}>取消</button><button type="button" className="hp-button mod-cta" onClick={() => onSave({ ...value, title: value.title.trim() || SPEC[value.kind].title })}>应用</button></div></div></Modal>;
}
function HomeDashboard() {
    const [data, setData] = useState(() => readStorage(DASHBOARD_CACHE_KEY, {})), [layout, setLayout] = useState(defaultLayout), [ready, setReady] = useState(false), [helpers, setHelpers] = useState(null), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [modal, setModal] = useState(null), [transfer, setTransfer] = useState(""), [pageName, setPageName] = useState("");
    const rootRef = useRef(null), gridRef = useRef(null), revision = useRef(0), savedLayout = useRef(null), sorter = useRef(null), resizeCleanup = useRef(null), layoutRef = useRef(layout);
    layoutRef.current = layout;
    const page = layout.pages.find(item => item.id === layout.activePageId) || layout.pages[0];
    const refresh = () => loadHomeData(setData).catch(error => setMessage(`笔记数据读取失败：${error.message}`));
    useEffect(() => {
        let alive = true;
        Promise.all([homeService("load"), api.getNote("HmLayoutLib1").then(async note => new Function(await note.getContent())())]).then(async ([state, library]) => {
            if (!alive) return;
            setHelpers(library);
            let value = state.layout || defaultLayout();
            const active = value.pages.find(item => item.id === value.activePageId) || value.pages[0];
            if (active.arrangementVersion !== 1) {
                value = { ...value, pages: value.pages.map(item => item.id === active.id ? { ...item, arrangementVersion: 1, widgets: library.arrangeWidgets(item.widgets) } : item) };
                try { state = await homeService("save", { revision: state.revision, layout: value }); if (alive) setMessage("已自动整理卡片布局"); }
                catch (error) { state = await homeService("load"); value = state.layout || defaultLayout(); if (alive) setMessage(`自动整理未保存：${error.message}`); }
            }
            if (!alive) return;
            revision.current = state.revision; setLayout(value); savedLayout.current = clone(value); setReady(true);
        }).catch(error => { if (alive) setMessage(error.message); });
        refresh(); return () => { alive = false; resizeCleanup.current?.(); };
    }, []);
    const updateWidgets = update => setLayout(current => ({ ...current, pages: current.pages.map(item => item.id === current.activePageId ? { ...item, widgets: update(item.widgets) } : item) }));
    const resizeWidget = (id, w, h) => updateWidgets(widgets => widgets.map(widget => widget.id === id ? { ...widget, w: clamp(w, 1, 12), h: clamp(h, 2, 30) } : widget));
    useEffect(() => {
        if (!editing || !helpers) return;
        let scroller = rootRef.current.parentElement;
        while (scroller.parentElement && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
        const instance = new helpers.PointerSorter(gridRef.current, { itemSelector: ".hp-card", scrollContainer: scroller, canStart: (event, card) => !!event.target.closest(".hp-card-header") && !event.target.closest("button, input, select, textarea"), onReorder: (id, beforeId) => updateWidgets(widgets => { const result = [...widgets]; helpers.moveBefore(result, id, beforeId); return result; }) });
        sorter.current = instance;
        return () => { instance.destroy(); sorter.current = null; };
    }, [editing, helpers, page.id]);
    async function persist(next = layoutRef.current) {
        if (busy) return; setBusy(true); setMessage("正在保存布局…");
        try { const state = await homeService("save", { revision: revision.current, layout: next }); revision.current = state.revision; savedLayout.current = clone(next); setLayout(next); setEditing(false); setMessage("布局已保存"); return true; }
        catch (error) { setMessage(error.message); return false; }
        finally { setBusy(false); }
    }
    function startEditing() { if (!ready) return; savedLayout.current = clone(layout); setEditing(true); setMessage("拖动卡片标题调整顺序，用右下角手柄或底部按钮调整尺寸。"); }
    function arrangePage() {
        resizeCleanup.current?.(); sorter.current?.cancel();
        setLayout(current => ({ ...current, pages: current.pages.map(item => item.id === current.activePageId ? { ...item, arrangementVersion: 1, widgets: helpers.arrangeWidgets(item.widgets) } : item) }));
        setMessage("卡片已对齐，点击完成后保存；仍可继续拖拽调整。");
    }
    function cancelEditing() { resizeCleanup.current?.(); sorter.current?.cancel(); if (savedLayout.current) setLayout(clone(savedLayout.current)); setEditing(false); setMessage("已取消本次布局修改"); }
    function changePage(id) { if (id === page.id) return; resizeCleanup.current?.(); sorter.current?.cancel(); const next = { ...layout, activePageId: id }; setLayout(next); if (!editing) void persist(next); }
    function shift(id, delta) { updateWidgets(widgets => { const result = [...widgets], index = result.findIndex(widget => widget.id === id), next = index + delta; if (next < 0 || next >= result.length) return result; [result[index], result[next]] = [result[next], result[index]]; return result; }); }
    function configure(widget) { if (!editing) { savedLayout.current = clone(layout); setEditing(true); } setModal({ type: "widget", widget }); }
    function beginResize(event, widget) {
        if (!editing || busy || event.button !== 0 || !event.isPrimary || resizeCleanup.current) return;
        event.preventDefault(); event.stopPropagation(); sorter.current?.cancel();
        const handle = event.currentTarget, card = handle.closest(".hp-card"), grid = getComputedStyle(gridRef.current), tracks = grid.gridTemplateColumns.split(" ").filter(Boolean), column = parseFloat(tracks[0]) + parseFloat(grid.columnGap), row = parseFloat(grid.gridAutoRows) + parseFloat(grid.rowGap), lock = tracks.length !== 12;
        const start = { x: event.clientX, y: event.clientY, w: widget.w, h: widget.h }, rect = card.getBoundingClientRect(), frame = document.createElement("div"), badge = document.createElement("span"); let size = { w: widget.w, h: widget.h };
        frame.className = "hp-resize-frame"; badge.className = "hp-card-size-badge"; rootRef.current.append(frame); card.append(badge); card.classList.add("is-resizing"); rootRef.current.classList.add("is-resizing");
        const paint = move => { const root = rootRef.current.getBoundingClientRect(); frame.style.transform = `translate(${rect.left - root.left}px,${rect.top - root.top}px)`; frame.style.width = `${Math.max(30, lock ? rect.width : rect.width + move.clientX - start.x)}px`; frame.style.height = `${Math.max(50, rect.height + move.clientY - start.y)}px`; badge.textContent = lock ? `高 ${size.h} 行` : `${size.w} 列 × ${size.h} 行`; card.style.setProperty("--hp-card-w", size.w); card.style.setProperty("--hp-card-h", size.h); };
        const move = event => { if (event.pointerId !== startPointer) return; event.preventDefault(); size = { w: lock ? start.w : clamp(start.w + Math.round((event.clientX - start.x) / column), 1, 12), h: clamp(start.h + Math.round((event.clientY - start.y) / row), 2, 30) }; paint(event); };
        const finish = commit => { resizeCleanup.current = null; handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", cancel); handle.removeEventListener("lostpointercapture", cancel); document.removeEventListener("keydown", key, true); window.removeEventListener("blur", blur); if (handle.hasPointerCapture(startPointer)) handle.releasePointerCapture(startPointer); frame.remove(); badge.remove(); card.classList.remove("is-resizing"); rootRef.current?.classList.remove("is-resizing"); if (commit) resizeWidget(widget.id, size.w, size.h); else { card.style.setProperty("--hp-card-w", start.w); card.style.setProperty("--hp-card-h", start.h); } };
        const startPointer = event.pointerId, up = event => { if (event.pointerId === startPointer) finish(true); }, cancel = event => { if (event.pointerId === startPointer) finish(false); }, blur = () => finish(false), key = event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(false); } };
        resizeCleanup.current = () => finish(false); handle.setPointerCapture(startPointer); handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", cancel); handle.addEventListener("lostpointercapture", cancel); document.addEventListener("keydown", key, true); window.addEventListener("blur", blur); paint(event);
    }
    function exportLayout() { const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `trilium-home-${dayKey(new Date())}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    async function importLayout() { try { const incoming = JSON.parse(transfer); if (incoming.version !== 1 || !Array.isArray(incoming.pages) || !incoming.pages.length || !incoming.pages.every(item => Array.isArray(item.widgets) && item.widgets.every(widget => SPEC[widget.kind] && Number.isInteger(widget.w) && widget.w >= 1 && widget.w <= 12 && Number.isInteger(widget.h) && widget.h >= 2 && widget.h <= 30))) throw new Error("不是有效的首页布局文件"); if (!incoming.pages.some(item => item.id === incoming.activePageId)) incoming.activePageId = incoming.pages[0].id; await homeService("validate", { layout: incoming }); if (!editing) savedLayout.current = clone(layout); setEditing(true); setLayout(incoming); setModal(null); setMessage("布局已导入预览，点击完成后保存。"); } catch (error) { setMessage(`导入失败：${error.message}`); } }
    function savePageName() { const name = pageName.trim(); if (!name) return; if (!editing) savedLayout.current = clone(layout); setEditing(true); if (modal.newPage) { const id = uid("page"); setLayout(current => ({ ...current, activePageId: id, pages: [...current.pages, { id, name, widgets: [] }] })); } else setLayout(current => ({ ...current, pages: current.pages.map(item => item.id === (modal.pageId || page.id) ? { ...item, name } : item) })); setModal(null); }
    return <div ref={rootRef} className={`eric-home-dashboard hp-root${editing ? " is-editing" : ""}`}>
        <div className="ehd-page-bar"><div className="hp-tabs">{layout.pages.map(item => <button key={item.id} type="button" className={`hp-tab${page.id === item.id ? " is-active" : ""}`} disabled={!ready || busy} onClick={() => changePage(item.id)} onContextMenu={event => { event.preventDefault(); setPageName(item.name); setModal({ type: "page", newPage: false, pageId: item.id }); }}><Icon name="home-alt"/> {item.name}</button>)}<button type="button" className="hp-tab hp-tab-add" title="新增页面" aria-label="新增页面" disabled={!ready || busy || layout.pages.length >= 20} onClick={() => { setPageName(""); setModal({ type: "page", newPage: true }); }}><Icon name="plus"/></button></div><div className="ehd-page-actions"><SmallButton icon="cog" title="页面与布局设置" disabled={!ready || busy} onClick={() => setModal({ type: "layout" })}/><SmallButton icon="refresh" title="刷新首页数据" disabled={busy} onClick={refresh}/>{!editing && <button type="button" className="hp-button" disabled={!ready || !helpers} onClick={startEditing}><Icon name="edit-alt"/>编辑布局</button>}</div></div>
        {editing && <div className="hp-toolbar"><span className="hp-toolbar-hint"><Icon name="move"/>拖动卡片调整顺序，用底部按钮或右下角手柄调整尺寸。</span><div className="hp-toolbar-actions"><button type="button" className="hp-button" disabled={busy || !helpers} onClick={arrangePage}><Icon name="layout"/>自动整理</button><button type="button" className="hp-button" disabled={busy} onClick={() => setModal({ type: "add" })}><Icon name="plus"/>添加组件</button><button type="button" className="hp-button" disabled={busy} onClick={cancelEditing}>取消</button><button type="button" className="hp-button mod-cta" disabled={busy} onClick={() => persist()}><Icon name="check"/>{busy ? "保存中…" : "完成"}</button></div></div>}
        <div className="ehd-save-status" role="status">{message || (!ready ? "正在读取首页设置…" : "")}</div>
        <div className="hp-grid" ref={gridRef}>{page.widgets.map((widget, index) => { const spec = SPEC[widget.kind]; if (!spec) return null; return <section key={widget.id} data-id={widget.id} data-kind={widget.kind} className={`hp-card hp-card-${widget.kind}`} style={{ "--hp-card-w": widget.w, "--hp-card-h": widget.h, "--hp-accent": spec.color }}>
            <header className="hp-card-header"><div className="hp-card-title"><span className="hp-card-grip"><Icon name="dots-vertical-rounded"/></span><span className="hp-card-icon"><Icon name={spec.icon}/></span><span className="hp-card-title-text">{widget.title}</span></div><div className="hp-card-header-right"><span className="hp-card-subtitle">{widget.kind === "hero" ? dayKey(new Date()) : widget.kind === "recent" ? "内容笔记" : widget.kind === "workbench" ? `${data.workbench?.length || 0} 个入口` : widget.kind === "quicklinks" ? `${data.links?.length || 0} 个入口` : widget.kind === "stats" ? "知识库概览" : ""}</span><button type="button" className="hp-card-gear" title={`设置${widget.title}`} aria-label={`设置${widget.title}`} onClick={() => configure(widget)}><Icon name="cog"/></button></div></header>
            <WidgetBody widget={widget} data={data} onRefresh={refresh}/>
            {editing && <><div className="hp-card-editbar"><span className="hp-editbtn-group"><SmallButton icon="left-arrow-alt" title="前移组件" disabled={index === 0} onClick={() => shift(widget.id, -1)}/><SmallButton icon="right-arrow-alt" title="后移组件" disabled={index === page.widgets.length - 1} onClick={() => shift(widget.id, 1)}/></span><span className="hp-editbtn-group"><span className="hp-editbtn-label">宽</span><SmallButton icon="minus" title="减小宽度" disabled={widget.w <= 1} onClick={() => resizeWidget(widget.id, widget.w - 1, widget.h)}/><span className="hp-editbtn-value">{widget.w}</span><SmallButton icon="plus" title="增加宽度" disabled={widget.w >= 12} onClick={() => resizeWidget(widget.id, widget.w + 1, widget.h)}/></span><span className="hp-editbtn-group"><span className="hp-editbtn-label">高</span><SmallButton icon="minus" title="减小高度" disabled={widget.h <= 2} onClick={() => resizeWidget(widget.id, widget.w, widget.h - 1)}/><span className="hp-editbtn-value">{widget.h}</span><SmallButton icon="plus" title="增加高度" disabled={widget.h >= 30} onClick={() => resizeWidget(widget.id, widget.w, widget.h + 1)}/></span><span className="hp-editbtn-group"><SmallButton icon="cog" title="组件设置" onClick={() => configure(widget)}/><SmallButton icon="copy" title="复制组件" disabled={page.widgets.length >= 80} onClick={() => updateWidgets(widgets => [...widgets.slice(0, index + 1), { ...clone(widget), id: uid(widget.kind) }, ...widgets.slice(index + 1)])}/><SmallButton icon="trash" title="移除组件（保留原笔记）" onClick={() => updateWidgets(widgets => widgets.filter(item => item.id !== widget.id))}/></span></div><button type="button" className="hp-card-resize" aria-label={`调整${widget.title}尺寸`} title="拖动调整尺寸，方向键逐格调整，Esc 取消" onPointerDown={event => beginResize(event, widget)} onKeyDown={event => { const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]; if (delta) { event.preventDefault(); resizeWidget(widget.id, widget.w + delta[0], widget.h + delta[1]); } }}><Icon name="expand-alt"/></button></>}
        </section>; })}{!page.widgets.length && <div className="hp-grid-empty"><Icon name="layout"/><span>这个页面还没有组件</span><button type="button" className="hp-button mod-cta" onClick={() => { if (!editing) startEditing(); setModal({ type: "add" }); }}>添加组件</button></div>}</div>
        {modal?.type === "add" && <Modal title="添加组件" onClose={() => setModal(null)}><div className="ehd-widget-catalog">{CATALOG.map(spec => <button key={spec.kind} type="button" className="ehd-widget-choice" disabled={page.widgets.length >= 80} onClick={() => { updateWidgets(widgets => [...widgets, makeWidget(spec.kind)]); setModal(null); }}><span className="hp-card-icon" style={{ "--hp-accent": spec.color }}><Icon name={spec.icon}/></span><span><b>{spec.title}</b><small>{spec.description}</small></span></button>)}</div></Modal>}
        {modal?.type === "widget" && <WidgetSettings widget={modal.widget} onClose={() => setModal(null)} onSave={value => { updateWidgets(widgets => widgets.map(widget => widget.id === value.id ? value : widget)); setModal(null); }}/>} 
        {modal?.type === "layout" && <Modal title="页面与布局" onClose={() => setModal(null)}><div className="ehd-settings"><button type="button" className="hp-button" onClick={() => { setPageName(page.name); setModal({ type: "page", newPage: false, pageId: item.id }); }}><Icon name="rename"/>重命名当前页面</button><button type="button" className="hp-button" onClick={exportLayout}><Icon name="download"/>导出布局 JSON</button><label>导入布局 JSON<textarea rows="5" value={transfer} onInput={event => setTransfer(event.currentTarget.value)} placeholder="粘贴导出的布局 JSON"/></label><input type="file" aria-label="选择布局 JSON 文件" accept=".json,application/json" onChange={async event => { const file = event.currentTarget.files?.[0]; if (file && file.size <= 250000) setTransfer(await file.text()); else setMessage("请选择小于 250 KB 的布局文件。"); }}/><button type="button" className="hp-button mod-cta" onClick={importLayout} disabled={!transfer.trim()}>导入并预览</button><p>布局只包含组件设置，不包含笔记正文；移除组件不会删除笔记。</p></div></Modal>}
        {modal?.type === "page" && <Modal title={modal.newPage ? "新增页面" : "页面设置"} onClose={() => setModal(null)}><div className="ehd-settings"><label>页面名称<input autoFocus maxLength={40} value={pageName} onInput={event => setPageName(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter") savePageName(); }}/></label><div className="ehd-dialog-actions">{!modal.newPage && layout.pages.length > 1 && <button type="button" className="hp-button ehd-danger" onClick={() => { if (!editing) savedLayout.current = clone(layout); setEditing(true); setLayout(current => { const pages = current.pages.filter(item => item.id !== (modal.pageId || page.id)); return { ...current, pages, activePageId: pages.some(item => item.id === current.activePageId) ? current.activePageId : pages[0].id }; }); setModal(null); }}>移除此页面布局</button>}<button type="button" className="hp-button mod-cta" disabled={!pageName.trim()} onClick={savePageName}>应用</button></div></div></Modal>}
    </div>;
}
export default HomeDashboard;
