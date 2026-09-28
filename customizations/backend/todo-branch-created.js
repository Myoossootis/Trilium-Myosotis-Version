/* Self-contained ToDo status hook; replaces missing legacy global helpers. */
(async function () {
    const branch = api.originEntity;
    const task = branch?.getNote?.();
    const parent = branch?.parentNoteId ? await api.getNote(branch.parentNoteId) : null;
    if (!task || !parent) return;
    const isStatus = ["todoInProgress", "todoDone", "todoBacklog", "todoArchive"].some((label) => parent.hasLabel(label));
    if (!isStatus) return;
    task.removeRelation("location");
    task.setRelation("location", parent.noteId);
    if (parent.hasLabel("todoDone")) {
        if (!task.hasLabel("completedDate")) task.setLabel("completedDate", api.dayjs().format("YYYY-MM-DD"));
    } else {
        task.removeLabel("completedDate");
    }
})();
