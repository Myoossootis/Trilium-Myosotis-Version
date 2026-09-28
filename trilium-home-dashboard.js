/* Home dashboard — a Trilium JSX render note. */
import { useEffect, useRef, useState } from "trilium:preact";

const HOME_LINKS = [
    ["▦", "工作台", "eae485474234", "purple"],
    ["⌬", "学术知识库", "79483c47e0d0", "teal"],
    ["▣", "硬件知识库", "e3e7d52e13a9", "blue"],
    ["✓", "今日任务", "ZrxUIJf75kFS", "gold"]
];
const KNOWLEDGE_BASE_IDS = ["79483c47e0d0", "e3e7d52e13a9"];
const TASK_STATUSES = [["进行中", "52Z91MOBH5g9"], ["已冻结", "IXeWPMzNDeCF"], ["已完成", "VRagMKcXpZ6N"], ["已归档", "G1dMogAOtW5i"]];
const FALLBACK_QUOTE = ["保持好奇，持续记录。", "知识库原则"];
const DASHBOARD_CACHE_KEY = "eric-home-dashboard-v5";
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

async function loadHomeData() {
    const settings = await api.searchForNote("#homeSettings") || api.startNote;
    const quoteNote = await api.searchForNote("#homeQuotes");
    const changeDataNote = await api.searchForNote("#homeWordChangeData");
    let dailyChanges = {};
    try { dailyChanges = JSON.parse(await changeDataNote?.getContent?.() || "{}").days || {}; } catch { /* empty by design */ }
    const quotes = quoteNote ? parseQuoteLibrary(await quoteNote.getContent()) : [];
    const all = await api.searchForNotes("note.title *=* ''");
    const notes = all.filter((note) => !note.isDeleted && note.noteId !== api.startNote.noteId && !note.hasLabel("homeInternal"));
    let metaCursor = 0; const metadata = new Map();
    async function metaWorker() { while (metaCursor < notes.length) { const note = notes[metaCursor++]; metadata.set(note.noteId, await getMetadata(note)); } }
    await Promise.all(Array.from({ length: Math.min(16, notes.length) }, metaWorker));
    const workingEntries = notes.map((note) => ({ note, meta: metadata.get(note.noteId) || {} }));
    // The word total is intentionally limited to the two actual knowledge
    // bases; settings, plug-ins, workbench notes and ToDo content do not count.
    const wordEntries = workingEntries.filter(({ note }) =>
        KNOWLEDGE_BASE_IDS.includes(note.noteId) || KNOWLEDGE_BASE_IDS.some((rootId) => note.hasAncestor?.(rootId))
    );
    const wordCounts = await getWordCounts(wordEntries);
    const entries = workingEntries.map(({ note, meta }) => ({ noteId: note.noteId, title: note.title, meta, words: wordCounts.get(note.noteId) || 0 }));
    const sorted = [...entries].sort((a, b) => String(noteDate(b)).localeCompare(String(noteDate(a))));
    const taskStatuses = await Promise.all(TASK_STATUSES.map(async ([name, noteId]) => ({ name, noteId, count: (await api.searchForNotes(`note.parents.noteId = "${noteId}"`)).filter((note) => !note.isDeleted).length })));
    return {
        name: settings.getLabelValue("homeGreetingName") || "朋友", countdownTitle: settings.getLabelValue("homeCountdownTitle") || "年度目标", countdownDate: settings.getLabelValue("homeCountdownDate") || "2026-12-31",
        quotes, quoteNoteId: quoteNote?.noteId || settings.noteId, settingsNoteId: settings.noteId,
        notes: sorted.slice(0, 7), totalNotes: notes.length, taskStatuses, totalTasks: taskStatuses.reduce((total, status) => total + status.count, 0),
        words: [...wordCounts.values()].reduce((total, value) => total + value, 0), dailyChanges
    };
}

function cachedHomeData() { return readStorage(DASHBOARD_CACHE_KEY, null)?.data || null; }

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

/* Dense Spectral Starfield, adapted from the user's HTML to the Home hero. */
function SpectralBackground() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx) return undefined;

        const BEAM_COUNT = 650;
        const DUST_COUNT = 450;
        const FAR_STARS_COUNT = 1200;
        const VISUAL_SCALE = 2;
        const SPEED = 3.6;
        const FOV = 280;
        const MAX_DEPTH = 1800;
        const SPECTRAL_HUES = [185, 205, 220, 245, 275, 310, 36, 155];
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
        let width = 1, height = 1, cx = .5, cy = .5;
        let frame = 0, visible = true, globalTime = 0, resizeObserver, visibilityObserver;

        function resize() {
            const box = canvas.getBoundingClientRect();
            width = Math.max(1, box.width); height = Math.max(1, box.height);
            const scale = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            cx = width / 2; cy = height / 2;
            ctx.fillStyle = "#010206"; ctx.fillRect(0, 0, width, height);
        }

        class SpectralBeam {
            constructor() { this.reset(true); }
            reset(init = false) {
                this.baseAngle = Math.random() * Math.PI * 2;
                this.radius = 120 + Math.random() * 750;
                this.z = init ? Math.random() * MAX_DEPTH : MAX_DEPTH;
                this.prevZ = this.z;
                this.hue = SPECTRAL_HUES[Math.floor(Math.random() * SPECTRAL_HUES.length)];
                this.sat = this.hue === 36 ? 75 : 65;
                this.light = 72 + Math.random() * 12;
            }
            update() { this.prevZ = this.z; this.z -= SPEED; if (this.z <= 6) this.reset(false); }
            getAngleAt(z, time) {
                const subtleTwist = Math.pow(1 - z / MAX_DEPTH, 2) * .35;
                return this.baseAngle + time * .03 + subtleTwist;
            }
            draw(time) {
                const angle = this.getAngleAt(this.z, time), currentScale = FOV / this.z;
                const x = Math.cos(angle) * this.radius * currentScale + cx;
                const y = Math.sin(angle) * this.radius * currentScale + cy;
                const tailZ = Math.min(this.prevZ + 16, MAX_DEPTH);
                const tailAngle = this.getAngleAt(tailZ, time), tailScale = FOV / tailZ;
                const tailX = Math.cos(tailAngle) * this.radius * tailScale + cx;
                const tailY = Math.sin(tailAngle) * this.radius * tailScale + cy;
                const midZ = (this.z + tailZ) * .5;
                const midAngle = this.getAngleAt(midZ, time), midScale = FOV / midZ;
                const midX = Math.cos(midAngle) * this.radius * midScale + cx;
                const midY = Math.sin(midAngle) * this.radius * midScale + cy;
                const ratio = 1 - this.z / MAX_DEPTH;
                const alpha = Math.sin(ratio * Math.PI) * .35;
                if (alpha <= 0 || (x < -100 && tailX < -100) || (x > width + 100 && tailX > width + 100) || (y < -100 && tailY < -100) || (y > height + 100 && tailY > height + 100)) return;
                ctx.strokeStyle = `hsla(${this.hue}, ${this.sat}%, ${this.light}%, ${alpha})`;
                ctx.lineWidth = Math.max(.4, ratio * 1.2) * VISUAL_SCALE; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.quadraticCurveTo(midX, midY, x, y); ctx.stroke();
            }
        }

        class CosmicStar {
            constructor() { this.reset(true); }
            reset(init = false) {
                this.x = (Math.random() - .5) * width * 2.2;
                this.y = (Math.random() - .5) * height * 2.2;
                this.z = init ? Math.random() * MAX_DEPTH : MAX_DEPTH;
                this.hue = SPECTRAL_HUES[Math.floor(Math.random() * SPECTRAL_HUES.length)];
                this.baseSize = .6 + Math.random();
            }
            update() { this.z -= SPEED * .65; if (this.z <= 8) this.reset(false); }
            draw() {
                const scale = FOV / this.z, x = this.x * scale + cx, y = this.y * scale + cy;
                if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
                const ratio = 1 - this.z / MAX_DEPTH;
                ctx.fillStyle = `hsla(${this.hue}, 65%, 82%, ${ratio * .5})`;
                ctx.beginPath(); ctx.arc(x, y, Math.max(.5, ratio * this.baseSize) * VISUAL_SCALE, 0, Math.PI * 2); ctx.fill();
            }
        }

        class DeepDust {
            constructor() { this.reset(true); }
            reset(init = false) {
                this.x = (Math.random() - .5) * width * 2.6;
                this.y = (Math.random() - .5) * height * 2.6;
                this.z = init ? Math.random() * MAX_DEPTH : MAX_DEPTH;
                this.alpha = .15 + Math.random() * .3;
                this.hue = SPECTRAL_HUES[Math.floor(Math.random() * SPECTRAL_HUES.length)];
            }
            update() { this.z -= SPEED * .25; if (this.z <= 6) this.reset(false); }
            draw() {
                const scale = FOV / this.z, x = this.x * scale + cx, y = this.y * scale + cy;
                if (x < 0 || x > width || y < 0 || y > height) return;
                const ratio = 1 - this.z / MAX_DEPTH;
                ctx.fillStyle = `hsla(${this.hue}, 50%, 85%, ${this.alpha * ratio})`;
                ctx.fillRect(x, y, VISUAL_SCALE, VISUAL_SCALE);
            }
        }

        resize();
        const beams = Array.from({ length: BEAM_COUNT }, () => new SpectralBeam());
        const stars = Array.from({ length: DUST_COUNT }, () => new CosmicStar());
        const dust = Array.from({ length: FAR_STARS_COUNT }, () => new DeepDust());
        function animate() {
            frame = requestAnimationFrame(animate);
            if (!visible || document.hidden || reducedMotion) return;
            ctx.fillStyle = "rgba(1, 2, 6, 0.24)"; ctx.fillRect(0, 0, width, height);
            globalTime += .01;
            for (const point of dust) { point.update(); point.draw(); }
            for (const point of stars) { point.update(); point.draw(); }
            for (const beam of beams) { beam.update(); beam.draw(globalTime); }
        }
        resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
        visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
        visibilityObserver.observe(canvas);
        if (!reducedMotion) animate();
        return () => { cancelAnimationFrame(frame); resizeObserver.disconnect(); visibilityObserver.disconnect(); };
    }, []);
    return <canvas ref={canvasRef} className="ehd-spectral-canvas" aria-hidden="true" />;
}

function LiveClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
    return <div className="ehd-time"><div className="ehd-clock">{now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</div><div className="ehd-date">{now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</div></div>;
}

function LiveGreeting({ name }) {
    const [hour, setHour] = useState(() => new Date().getHours());
    useEffect(() => { const timer = setInterval(() => setHour(new Date().getHours()), 60000); return () => clearInterval(timer); }, []);
    return <div className="ehd-welcome"><div className="ehd-kicker">✦ 欢迎回来</div><div className="ehd-greeting">{greeting(hour)}<b>{name}</b></div><div className="ehd-subtitle">把今天的思考，沉淀为可复用的知识。</div></div>;
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

function HomeDashboard() {
    const [data, setData] = useState(cachedHomeData); const today = new Date();
    useEffect(() => { let mounted = true; loadHomeData().then((value) => { if (!mounted) return; writeStorage(DASHBOARD_CACHE_KEY, { savedAt: Date.now(), data: value }); setData(value); }).catch(() => { if (mounted && !data) setData({ error: true }); }); return () => { mounted = false; }; }, []);
    if (!data) return <div className="ehd-loading">正在统计笔记更新与字数…</div>;
    if (data.error) return <div className="ehd-loading">首页数据暂时无法读取。</div>;
    const quote = data.quotes.length ? data.quotes[dailyIndex(today, data.quotes.length)] : FALLBACK_QUOTE;
    return <div className="eric-home-dashboard">
        <section className="ehd-hero"><SpectralBackground/><LiveGreeting name={data.name}/><LiveClock/><MiniCalendar today={today}/></section>
        <div className="ehd-top">
            <section className="ehd-card ehd-recent"><div className="ehd-card-title">◷ 最近笔记 <span>按真实修改时间</span></div>{data.notes.map((entry) => <button key={entry.noteId} className="ehd-note" onClick={() => api.activateNote(entry.noteId)}><span>▤</span><b>{entry.title || "未命名笔记"}</b><small>{prettyDate(noteDate(entry))}</small></button>)}</section>
            <section className="ehd-card ehd-links"><div className="ehd-card-title">▦ 快捷入口 <span>4 个入口</span></div><div>{HOME_LINKS.map(([icon, label, noteId, tone]) => <button className={`ehd-link ${tone}`} onClick={() => api.activateNote(noteId)}><i>{icon}</i>{label}</button>)}</div></section>
            <div className="ehd-side-stack"><section className="ehd-card ehd-countdown"><div className="ehd-card-title">⌛ {data.countdownTitle}<button className="ehd-edit" title="自定义年度目标" onClick={() => api.activateNote(data.settingsNoteId)}>⚙ 自定义</button></div><strong>{daysUntil(data.countdownDate)}</strong><em>天</em><p>目标日期：{data.countdownDate}</p></section><section className="ehd-card ehd-quote"><div className="ehd-card-title">☘ 每日一言<button className="ehd-edit" title="打开每日格言库" onClick={() => api.activateNote(data.quoteNoteId)}>✎ 格言库</button></div><p>“{quote[0]}”</p><small>—— {quote[1]}</small></section></div>
        </div>
        <div className="ehd-bottom">
            <section className="ehd-card ehd-contributions"><div className="ehd-card-title">◌ 笔记更新 <span>近一年 · 悬停查看新增、删除与实际改动</span></div><ContributionGrid dailyChanges={data.dailyChanges}/><div className="ehd-legend"><span>Less</span><i className="l0"/><i className="l1"/><i className="l2"/><i className="l3"/><i className="l4"/><span>More</span></div></section>
            <section className="ehd-card ehd-tasks"><div className="ehd-card-title">✓ 任务状态 <span>{data.totalTasks} 项</span></div><div className="ehd-task-cols">{data.taskStatuses.map((status) => <button onClick={() => api.activateNote(status.noteId)}><b>{status.name}</b><p>{status.count}</p></button>)}</div><button className="ehd-todo-open" onClick={() => api.activateNote("ZrxUIJf75kFS")}>打开 ToDo 清单 →</button></section>
            <section className="ehd-card ehd-stats"><div className="ehd-card-title">◉ 库统计</div><div><p><b>{data.totalNotes}</b><span>笔记</span></p><p><b>{data.totalTasks}</b><span>任务</span></p><p><b>{formatWords(data.words)}</b><span>字数</span></p><p><b>2</b><span>知识库</span></p></div></section>
        </div>
    </div>;
}
export default HomeDashboard;
