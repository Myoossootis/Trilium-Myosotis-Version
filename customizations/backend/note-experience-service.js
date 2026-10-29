// Read-only search in the accessible descendants of one knowledge sublibrary.
function noteExperienceSearch(rootId,query){
    const widget=api.getNote('NxExpUI0001');
    if(!widget?.hasLabel('widget'))throw Error('笔记增强插件已关闭。');
    const root=api.getNote('KbHubHome001')?.getChildNotes().find(n=>n.noteId===rootId&&!n.isDeleted&&!n.isProtected&&['text','render','book'].includes(n.type)&&!n.hasLabel('homeInternal')&&n.noteId!=='KbWikiFolder1');
    if(!root)throw Error('当前子库不可访问。');
    query=String(query || '').trim();if(query.length>200)throw Error('关键词请控制在 200 字以内。');
    const terms=[...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
    if(!terms.length)return {results:[],scanned:0};
    const clean=html=>api.unescapeHtml(String(html || '').replace(/<!--[^]*?-->/g,'').replace(/<(script|style)\b[^>]*>[^]*?<\/\1>/gi,'').replace(/<br\b[^>]*>|<\/(?:p|div|h[1-6]|li|tr|td|th|blockquote|pre)>/gi,' ').replace(/<[^>]+>/g,'')).replace(/\s+/g,' ').trim();
    const seen=new Set([rootId]),results=[];
    const visible=n=>n&&!n.isDeleted&&!n.isProtected&&!n.hasLabel('homeInternal')&&!n.hasLabel('iconPack')&&['text','markdown','book','render','file','image'].includes(n.type);
    function visit(note,topicId,parentId,path){
        if(seen.has(note.noteId)||!visible(note))return;seen.add(note.noteId);
        if(seen.size>10000)throw Error('子库过大，请缩小搜索范围。');
        const body=['text','markdown'].includes(note.type)?clean(note.getContent()):'',lower=body.toLowerCase(),title=note.title.trim(),heading=[title,...path].join(' ').toLowerCase();
        if(terms.every(t=>heading.includes(t)||lower.includes(t))){
            const hits=[];
            for(const term of terms){let from=0,index;while((index=lower.indexOf(term,from))>=0){hits.push({offset:index,term});from=index+term.length;if(hits.length>=300)break;}if(hits.length>=300)break;}
            hits.sort((a,b)=>a.offset-b.offset);
            const matches=[];
            for(const hit of hits){if(matches.some(m=>Math.abs(m.offset-hit.offset)<100))continue;
                const start=Math.max(0,hit.offset-55),end=Math.min(body.length,hit.offset+hit.term.length+100);
                matches.push({...hit,text:body.slice(start,end),context:body.slice(Math.max(0,hit.offset-35),Math.min(body.length,hit.offset+hit.term.length+55)),contextOffset:Math.min(35,hit.offset),prefix:start>0,suffix:end<body.length});if(matches.length===3)break;
            }
            const titleMatch=terms.every(t=>title.toLowerCase().includes(t));
            results.push({id:note.noteId,title,type:note.type,parentId,topicId,path,matches,hitCount:hits.length,limited:hits.length>=300,score:(titleMatch?100:0)+(matches.length?20:0)+(title.toLowerCase()===query.toLowerCase()?100:0)});
        }
        for(const child of note.getChildNotes())visit(child,topicId,note.noteId,[...path,title]);
    }
    for(const note of root.getChildNotes())visit(note,note.noteId,rootId,[]);
    results.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'zh-CN'));
    return {results,scanned:seen.size-1};
}
