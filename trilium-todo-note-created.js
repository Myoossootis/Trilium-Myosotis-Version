/* Initialize a new ordinary note as a ToDo task without legacy global helpers. */
(async function () {
    const task = api.originEntity;
    const parent = task?.getParentNotes?.()[0];
    if (!task || !parent) return;
    task.setLabel("todoItem");
    task.removeRelation("location");
    task.setRelation("location", parent.noteId);
    const attributeHook = await api.getNoteWithLabel("todoTaskAttributeChanged");
    const branchHook = await api.getNoteWithLabel("todoBranchCreated");
    if (attributeHook) task.setRelation("runOnAttributeChange", attributeHook.noteId);
    if (branchHook) task.setRelation("runOnBranchCreation", branchHook.noteId);
    if (parent.hasLabel("todoDone")) task.setLabel("completedDate", api.dayjs().format("YYYY-MM-DD"));
})();
