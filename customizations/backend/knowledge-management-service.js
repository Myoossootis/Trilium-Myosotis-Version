// Native branch operations, scoped to a direct sublibrary of the knowledge hub.
function knowledgeManagement(action,payload={}){
    if(api.getNote('MyoMarketData')?.getJsonContent()?.plugins.find(p=>p.id==='KbWikiRoot01')?.enabled===false)throw Error('该插件已关闭，请在插件管理器中开启。');
    const hub=api.getNote('KbHubHome001');
    const root=hub?.getChildNotes().find(n=>n.noteId===payload.rootId && !n.isDeleted && !n.isProtected && !n.hasLabel('homeInternal') && n.noteId!=='KbWikiFolder1' && ['text','render','book'].includes(n.type));
    if(!root)throw Error('子库不可访问，请刷新后重试。');
    const seen=new Map();
    function scan(n){if(!n || n.isDeleted || seen.has(n.noteId))return;seen.set(n.noteId,n);if(seen.size>10000)throw Error('子库过大');for(const c of n.getChildNotes())scan(c);}
    scan(root);
    const accessible=id=>{const n=seen.get(id);if(!n || n.isDeleted || n.isProtected || n.hasLabel('homeInternal') || n.hasLabel('iconPack'))throw Error('笔记已移动、删除或不可操作。');return n;};
    const title=value=>{const t=String(value || '').trim();if(!t || t.length>150)throw Error('名称须为 1–150 字。');return t;};
    function unique(parent,t,except){if(parent.getChildNotes().some(n=>!n.isDeleted&&n.noteId!==except&&n.title.trim().toLocaleLowerCase()===t.toLocaleLowerCase()))throw Error('此处已有同名笔记，请换个名称。');}
    function subtree(n){const ids=new Set();function visit(note){if(ids.has(note.noteId)||note.isDeleted)return;ids.add(note.noteId);for(const child of note.getChildNotes())visit(child);}visit(n);return ids;}
    function branch(n){const candidates=n.getParentBranches().filter(b=>!b.isDeleted&&seen.has(b.parentNoteId));const b=payload.parentId?candidates.find(b=>b.parentNoteId===payload.parentId):candidates.length===1?candidates[0]:null;if(!b)throw Error('当前位置已变化，或笔记有多个归属，请刷新后从具体位置操作。');return b;}
    function snapshot(n,b){return {id:n.noteId,parentId:b.parentNoteId,branchId:b.branchId,title:n.title,updated:n.utcDateModified,subtree:[...subtree(n)].sort()};}
    function verify(n,b){if(JSON.stringify(snapshot(n,b))!==JSON.stringify(payload.expected))throw Error('笔记已发生变化，请刷新后重新操作。');}
    if(action==='create'){
        const parent=accessible(payload.parentId),t=title(payload.title);unique(parent,t);
        const result=api.createTextNote(parent.noteId,t,'');return {id:result.note.noteId,parentId:parent.noteId};
    }
    const note=accessible(payload.id);
    if(note===root)throw Error('不能通过此菜单修改或删除子库根节点。');
    const current=branch(note),descendants=subtree(note);
    if(action==='inspect')return {title:note.title,expected:snapshot(note,current),parentId:current.parentNoteId,children:descendants.size-1,clones:note.getStrongParentBranches().length,topics:root.getChildNotes().filter(n=>!n.isDeleted&&!n.isProtected&&!n.hasLabel('homeInternal')&&!descendants.has(n.noteId)&&['text','render','book'].includes(n.type)).map(n=>({id:n.noteId,title:n.title}))};
    verify(note,current);
    if(action==='rename'){const t=title(payload.title);for(const parent of note.getParentNotes())unique(parent,t,note.noteId);note.title=t;note.save();return {id:note.noteId};}
    if(action==='move'){
        if([...descendants].some(id=>seen.get(id)?.isProtected))throw Error('包含受保护笔记，无法更改归属。');
        const target=payload.newTopic?root:accessible(payload.targetId);
        if(!payload.newTopic && !root.getChildNotes().some(n=>n.noteId===target.noteId))throw Error('请选择当前子库的专题。');
        if(descendants.has(target.noteId))throw Error('不能移动到自身或自己的子笔记下面。');
        if(target.noteId===current.parentNoteId&&!payload.newTopic)throw Error('笔记已经位于这个专题。');
        let destination=target;
        if(payload.newTopic){const t=title(payload.newTopic);unique(root,t);destination=api.createTextNote(root.noteId,t,'').note;}
        unique(destination,note.title,note.noteId);
        const linked=api.ensureNoteIsPresentInParent(note.noteId,destination.noteId,current.prefix);
        if(!linked.success)throw Error(linked.message || '无法更改专题。');
        const unlinked=api.ensureNoteIsAbsentFromParent(note.noteId,current.parentNoteId);
        if(!unlinked.success)throw Error(unlinked.message || '无法移除原位置。');
        return {id:note.noteId,parentId:destination.noteId};
    }
    if(action==='delete'){
        if(payload.confirm!==true)throw Error('请先确认删除。');
        for(const id of descendants)accessible(id);
        current.deleteBranch();return {id:note.noteId,parentId:current.parentNoteId};
    }
    throw Error('不支持的笔记操作。');
}
