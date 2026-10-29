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

