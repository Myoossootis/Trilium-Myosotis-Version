function hardwareLibraryService(rootId) {
    if(api.getNote('MyoMarketData')?.getJsonContent()?.plugins.find(p=>p.id==='KbWikiRoot01')?.enabled===false)throw Error('该插件已关闭，请在插件管理器中开启。');
    const root=api.getNote(rootId);
    if(!root || root.isDeleted) return {title:'硬件工程师知识库',topics:[],notes:[],unavailable:true};
    if(root.isProtected)throw new Error('请先解锁知识库');
    const accepted=new Set(['text','markdown','render','file','image','book']);
    const visible=note=>note && !note.isDeleted && !note.isProtected && accepted.has(note.type) && !note.hasLabel('homeInternal') && !note.hasLabel('iconPack');
    const clean=value=>String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
    const topics=[],notes=[],seen=new Set([rootId]);
    function visit(note,topic,parentId,path,pathIds=[]) {
        if(seen.has(note.noteId) || !visible(note))return null;
        seen.add(note.noteId);
        if(seen.size>10000)throw new Error('知识库过大，请缩小首页索引范围');
        const children=note.getChildNotes().filter(visible);
        const text=['text','markdown'].includes(note.type)?clean(note.getContent()):'';
        const entry={id:note.noteId,title:note.title.trim(),topicId:topic.id,parentId,path,pathIds,children:[],type:note.type,excerpt:text.slice(0,220),hasContent:!!text,updated:note.utcDateModified || note.dateModified || '',icon:note.getOwnedAttributes().find(a=>a.type==='label' && a.name==='iconClass')?.value || ''};
        notes.push(entry);
        for(const child of children) {
            const item=visit(child,topic,note.noteId,[...path,note.title.trim()],[...pathIds,note.noteId]);
            if(item)entry.children.push(item.id);
        }
        return entry;
    }
    for(const note of root.getChildNotes().filter(visible)) {
        const topic={id:note.noteId,title:note.title.trim()};
        const entry=visit(note,topic,rootId,[]);
        if(!entry)continue;
        const members=notes.filter(n=>n.topicId===topic.id && n.id!==topic.id);
        topics.push({...topic,children:entry.children,count:members.length,written:members.filter(n=>n.hasContent).length,excerpt:entry.excerpt,icon:entry.icon,updated:[entry,...members].map(n=>n.updated).sort().at(-1)});
    }
    return {title:root.title.trim(),topics,notes,unavailable:false};
}
