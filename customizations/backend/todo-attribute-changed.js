/* Attribute hook without dependencies on removed taskComplete/taskReTodo helpers. */
(async function () {
    const attribute = api.originEntity;
    const task = attribute?.getNote?.();
    if (!task) return;
    if (attribute.name === "addDescription") {
        if (attribute.value !== "true") task.removeLabel("descriptionLabel");
        return;
    }
    // dueDate and completedDate are rendered directly by the board. Status
    // movement is handled atomically by the board and branch-created hook.
})();
