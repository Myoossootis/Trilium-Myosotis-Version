/* Four-column ToDo board for Trilium. Tasks remain ordinary child notes. */
import { useEffect, useState } from "trilium:preact";

const STATUSES = [
    { id: "52Z91MOBH5g9", name: "进行中", icon: "◷", tone: "in-progress" },
    { id: "VRagMKcXpZ6N", name: "已完成", icon: "✓", tone: "done" },
    { id: "IXeWPMzNDeCF", name: "已冻结", icon: "❄", tone: "frozen" },
    { id: "G1dMogAOtW5i", name: "已归档", icon: "▣", tone: "archived" }
];
const STATUS_IDS = STATUSES.map((status) => status.id);

async function loadTasks() {
    const groups = await Promise.all(STATUSES.map(async (status) => {
        const notes = await api.searchForNotes(`note.parents.noteId = "${status.id}"`);
        return [status.id, notes.filter((note) => !note.isDeleted && note.hasLabel("todoItem")).map((note) => ({
            noteId: note.noteId, title: note.title || "未命名任务", dueDate: note.getLabelValue("dueDate") || "",
            priority: note.getLabelValue("priority") || "", description: note.getLabelValue("descriptionLabel") || ""
        }))];
    }));
    return Object.fromEntries(groups);
}

async function moveTask(noteId, targetId) {
    return api.runOnBackend((taskId, newParentId, statusIds, doneId) => {
        const note = api.getNote(taskId);
        if (!note || !statusIds.includes(newParentId)) throw new Error("Invalid task or status");
        const oldParents = note.getParentNotes().filter((parent) => statusIds.includes(parent.noteId));
        api.toggleNoteInParent(true, taskId, newParentId);
        for (const parent of oldParents) if (parent.noteId !== newParentId) api.toggleNoteInParent(false, taskId, parent.noteId);
        note.setRelation("location", newParentId);
        if (newParentId === doneId) note.setLabel("completedDate", api.dayjs().format("YYYY-MM-DD"));
        else note.removeLabel("completedDate");
    }, [noteId, targetId, STATUS_IDS, "VRagMKcXpZ6N"]);
}

function TaskCard({ task, statusId, busy, onMove }) {
    const completed = statusId === "VRagMKcXpZ6N";
    return <article className={`etb-task${busy ? " busy" : ""}`} draggable={!busy} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", task.noteId); }}>
        <div className="etb-task-main">
            <button className={`etb-check${completed ? " checked" : ""}`} disabled={busy} title={completed ? "取消完成" : "标记为完成"} onClick={() => onMove(task.noteId, completed ? "52Z91MOBH5g9" : "VRagMKcXpZ6N")} aria-label={completed ? "取消完成" : "标记为完成"}>{completed ? "✓" : ""}</button>
            <button className="etb-task-title" onClick={() => api.activateNote(task.noteId)}>{task.title}</button>
        </div>
        {(task.dueDate || task.priority || task.description) && <div className="etb-meta">{task.dueDate && <span>◫ {task.dueDate}</span>}{task.priority && <span className="priority">{task.priority}</span>}{task.description && <small>{task.description}</small>}</div>}
    </article>;
}

function TodoBoard() {
    const [columns, setColumns] = useState(null); const [busy, setBusy] = useState(""); const [over, setOver] = useState("");
    const refresh = () => loadTasks().then(setColumns).catch(() => api.showError("ToDo 清单读取失败"));
    useEffect(() => { refresh(); }, []);
    async function changeStatus(noteId, targetId) {
        if (busy) return;
        const sourceId = STATUS_IDS.find((id) => columns[id]?.some((task) => task.noteId === noteId));
        if (!sourceId || sourceId === targetId) return;
        const task = columns[sourceId].find((item) => item.noteId === noteId);
        setBusy(noteId); setColumns((current) => ({ ...current, [sourceId]: current[sourceId].filter((item) => item.noteId !== noteId), [targetId]: [task, ...current[targetId]] }));
        try { await moveTask(noteId, targetId); api.showMessage(`已移动到“${STATUSES.find((status) => status.id === targetId).name}”`); }
        catch (error) { api.showError(`移动失败：${error.message || error}`); await refresh(); }
        finally { setBusy(""); }
    }
    if (!columns) return <div className="etb-loading">正在载入 ToDo 看板…</div>;
    const total = STATUS_IDS.reduce((sum, id) => sum + columns[id].length, 0);
    return <main className="eric-todo-board">
        <header className="etb-header"><div><span>任务工作台</span><div className="etb-title">ToDo 清单</div><p>勾选完成，或把卡片拖到另一列改变状态。</p></div><div className="etb-total"><b>{total}</b><span>全部任务</span></div></header>
        <div className="etb-columns">{STATUSES.map((status) => <section key={status.id} className={`etb-column ${status.tone}${over === status.id ? " drag-over" : ""}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setOver(status.id); }} onDragLeave={() => setOver("")} onDrop={(event) => { event.preventDefault(); const noteId = event.dataTransfer.getData("text/plain"); setOver(""); if (noteId) changeStatus(noteId, status.id); }}>
            <header><div><i>{status.icon}</i><b>{status.name}</b></div><span>{columns[status.id].length}</span></header>
            <div className="etb-card-list">{columns[status.id].map((task) => <TaskCard key={task.noteId} task={task} statusId={status.id} busy={busy === task.noteId} onMove={changeStatus}/>)}{!columns[status.id].length && <div className="etb-empty">将任务拖到这里</div>}</div>
        </section>)}</div>
    </main>;
}

export default TodoBoard;
