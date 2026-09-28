/*
 * Home actual-change tracker (backend).
 * Attach through #runOnNoteContentChange (inheritable) to each knowledge base.
 * The dashboard reads the small JSON data note labelled #homeWordChangeData.
 */
(async function () {
    const note = api.originEntity;
    if (!note || note.isDeleted || note.hasLabel?.("homeInternal")) return;
    if (!["text", "code", "markdown", "render"].includes(note.type)) return;

    const DATA_LABEL = "homeWordChangeData";
    const BASELINE_SOURCE = "eric-word-change-baseline";

    function tokens(content) {
        const text = String(content || "")
            .replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ").trim();
        return text.match(/[\u3400-\u9fff]|[\p{L}\p{N}_'-]+/gu) || [];
    }

    // Exact for normal editing: unchanged prefix/suffix are removed first.
    // The remaining span is the real inserted/deleted content. This keeps the
    // hook inexpensive even for very long engineering notes.
    function contentDelta(before, after) {
        const oldTokens = tokens(before), newTokens = tokens(after);
        let head = 0;
        while (head < oldTokens.length && head < newTokens.length && oldTokens[head] === newTokens[head]) head++;
        let oldTail = oldTokens.length - 1, newTail = newTokens.length - 1;
        while (oldTail >= head && newTail >= head && oldTokens[oldTail] === newTokens[newTail]) { oldTail--; newTail--; }
        return { added: Math.max(0, newTail - head + 1), deleted: Math.max(0, oldTail - head + 1) };
    }

    const revisions = await note.getRevisions();
    // getRevisions() does not promise a newest-first order. Always compare
    // against the most recently written tracker checkpoint; using find() was
    // repeatedly selecting the first checkpoint and re-counting the entire
    // document on every autosave.
    const baseline = revisions
        .filter((revision) => revision.source === BASELINE_SOURCE)
        .sort((a, b) => String(b.utcDateCreated || b.utcDateModified || "")
            .localeCompare(String(a.utcDateCreated || a.utcDateModified || "")))[0];
    const current = await note.getContent();

    // The first change after installation establishes a reliable checkpoint.
    // Never fall back to an ordinary revision: that would present old history
    // as a fake "today" delta.
    if (!baseline) {
        await note.saveRevision({ source: BASELINE_SOURCE, description: "实际字数统计基线" });
        return;
    }

    const before = await baseline.getContent();
    const delta = contentDelta(before, current);
    await note.saveRevision({ source: BASELINE_SOURCE, description: "实际字数统计基线" });
    if (!delta.added && !delta.deleted) return;

    const dataNote = await api.getNoteWithLabel(DATA_LABEL);
    if (!dataNote) return;
    let data;
    try { data = JSON.parse(await dataNote.getContent()); } catch { data = {}; }
    data.version = 1;
    data.days ||= {};
    const date = api.dayjs().format("YYYY-MM-DD");
    const day = data.days[date] ||= { added: 0, deleted: 0, changed: 0 };
    day.added += delta.added;
    day.deleted += delta.deleted;
    day.changed += delta.added + delta.deleted;
    data.updatedAt = api.dayjs().format("YYYY-MM-DD HH:mm:ss");
    await dataNote.setContent(JSON.stringify(data));
})();
