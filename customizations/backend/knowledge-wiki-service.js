// Knowledge hub for the existing hardware subtree. No source notes are modified.
function knowledgeWikiService(action, payload = {}) {
    if(api.getNote('MyoMarketData')?.getJsonContent()?.plugins.find(p=>p.id==='KbWikiRoot01')?.enabled===false)throw Error('该插件已关闭，请在插件管理器中开启。');
    const HARDWARE = 'e3e7d52e13a9', HUB = 'KbHubHome001', WIKI = 'KbWikiFolder1';
    const hub=api.getNote(HUB), wiki=api.getNote(WIKI);
    if (!hub || hub.isDeleted || hub.isProtected) throw new Error('知识库入口不可访问。');
    const libraries=hub.getChildNotes().filter(note=>note.noteId!==WIKI && !note.isDeleted && !note.isProtected && ['text','render','book'].includes(note.type) && !note.hasLabel('homeInternal'));
    const root=libraries.find(note=>note.noteId===(payload.libraryId || HARDWARE));
    if (!root) throw new Error('所选子库不可访问，请刷新后重试。');
    if (!wiki || wiki.isDeleted || wiki.isProtected) throw new Error('Wiki 目录不可访问。');
    const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const text = value => String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<\/(?:p|h[1-6]|li|div|tr)>|<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/[\t\f\v ]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    const readable = note => note && !note.isDeleted && !note.isProtected && ['text','markdown'].includes(note.type) && !note.hasLabel('homeInternal') && !note.hasLabel('iconPack');
    function normalizeMath(markdown) {
        const output=[], pending=[]; let fence='';
        function flush() {
            if(!pending.length)return;
            output.push(pending.splice(0).join('\n').replace(/(`+[^`\n]*`+)|\\\[([\s\S]*?)\\\]|\\\(([^\n]*?)\\\)/g,
                (match,code,block,inline)=>code || (block!==undefined?`$$${block}$$`:`$${inline}$`)));
        }
        for(const line of markdown.split(/\r?\n/)) {
            const marker=line.match(/^\s*(`{3,}|~{3,})/);
            if(marker && (!fence || marker[1][0]===fence)){flush();output.push(line);fence=fence?'':marker[1][0];}
            else if(fence)output.push(line);else pending.push(line);
        }
        flush();return output.join('\n');
    }
    function index() {
        const rows = [], topics = [], seen = new Set([root.noteId]);
        function visit(note, topic, path, parentId) {
            if (!note || note.isDeleted || note.isProtected || seen.has(note.noteId) || note.hasLabel('homeInternal') || note.hasLabel('iconPack')) return;
            seen.add(note.noteId);
            if (seen.size > 10000) throw new Error('知识库过大，请缩小索引范围。');
            if (readable(note)) {
                const body = text(note.getContent());
                rows.push({id:note.noteId,title:note.title.trim(),topicId:topic.id,parentId,path,excerpt:body.slice(0,260),body,updated:note.utcDateModified || ''});
            }
            for (const child of note.getChildNotes()) visit(child, topic, [...path,note.title.trim()],note.noteId);
        }
        for (const child of root.getChildNotes()) {
            if (child.isDeleted || child.isProtected || child.hasLabel('homeInternal') || child.hasLabel('iconPack')) continue;
            const topic = {id:child.noteId,title:child.title.trim()};
            const before=rows.length; visit(child,topic,[],root.noteId); topic.count=rows.length-before;
            if(topic.count) topics.push(topic);
        }
        return {rows,topics};
    }
    function wikiItems() {
        return wiki.getChildNotes().filter(readable).map(note=>{
            const raw=String(note.getContent() || '');
            const ids=[...raw.matchAll(/href=["']#root\/([\w-]+)["']/g)].map(match=>match[1]);
            const sources=[...new Set(ids)].map(id=>api.getNote(id)).filter(readable).map(n=>({id:n.noteId,title:n.title.trim()}));
            return {id:note.noteId,title:note.title.trim(),excerpt:text(raw).slice(0,180),body:text(raw),markdown:api.htmlToMarkdown(raw),sources,updated:note.utcDateModified || ''};
        }).sort((a,b)=>b.updated.localeCompare(a.updated));
    }
    if (action === 'libraries') return {libraries:libraries.map(note=>({id:note.noteId,title:note.title.trim()}))};
    if (action === 'overview') {
        const {rows,topics}=index();
        return {library:{id:root.noteId,title:root.title.trim(),count:rows.length},libraries:libraries.map(note=>({id:note.noteId,title:note.title.trim()})),topics,notes:rows.map(({body,...row})=>row),wiki:wikiItems()};
    }
    if (action === 'search') {
        const query=String(payload.query || '').trim().toLocaleLowerCase();
        if (!query || query.length>300) throw new Error('请输入 1–300 字的检索问题。');
        const terms=new Set(query.match(/[a-z0-9][a-z0-9.+-]{1,}/gi) || []);
        for (const sequence of query.match(/[\u3400-\u9fff]{2,}/g) || []) for(let i=0;i<sequence.length-1;i++) terms.add(sequence.slice(i,i+2));
        const {rows}=index();
        return rows.map(({body,...row})=>{
            const title=row.title.toLocaleLowerCase(), hay=(row.title+' '+row.path.join(' ')+' '+body).toLocaleLowerCase();
            let score=title.includes(query)?20:0;
            for (const term of terms) { if (hay.includes(term)) score++; if(title.includes(term)) score+=3; }
            return {...row,score};
        }).filter(row=>row.score>0).sort((a,b)=>b.score-a.score || b.updated.localeCompare(a.updated)).slice(0,20);
    }
    if (action === 'prepare') {
        const ids=Array.isArray(payload.ids)?[...new Set(payload.ids)]:[];
        if (!ids.length || ids.length>4 || ids.some(id=>typeof id!=='string')) throw new Error('请选择 1–4 篇来源笔记。');
        const {rows}=index(), byId=new Map(rows.map(row=>[row.id,row]));
        const selected=ids.map(id=>byId.get(id));
        if (selected.some(note=>!note || !note.body)) throw new Error('来源笔记已移动、受保护或没有正文，请重新选择。');
        return selected.map(note=>({id:note.id,title:note.title,updated:note.updated,body:note.body.slice(0,3200),truncated:note.body.length>3200}));
    }
    if (action === 'save') {
        const title=String(payload.title || '').trim(), draft=String(payload.draft || '').trim();
        if (!title || title.length>100 || !draft || draft.length>20000) throw new Error('标题须为 1–100 字，正文须为 1–20000 字。');
        const snapshots=Array.isArray(payload.sources)?payload.sources:[];
        if (!snapshots.length || snapshots.length>4) throw new Error('请重新选择来源。');
        const {rows}=index(), byId=new Map(rows.map(note=>[note.id,note]));
        const sources=snapshots.map(source=>byId.get(source.id));
        if (sources.some((source,i)=>!source || source.updated!==snapshots[i].updated)) throw new Error('来源笔记已变化或不可访问，请重新生成后再保存。');
        if (wiki.getChildNotes().some(note=>!note.isDeleted && note.title.trim().toLocaleLowerCase()===title.toLocaleLowerCase())) throw new Error('已有同名 Wiki，请换个标题；不会覆盖原笔记。');
        // Use Trilium's own sanitizing Markdown converter so headings, lists,
        // tables and emphasis remain editable in the native text editor.
        const body=api.markdownToHtml(normalizeMath(draft).replace(/!\[([^\]]*)\]\([^)]*\)/g,'[图片：$1]'));
        const links=sources.map(source=>`<li><a class="reference-link" href="#root/${source.id}">${escape(source.title)}</a></li>`).join('');
        const result=api.createTextNote(WIKI,title,`${body}<h2>来源笔记</h2><ul>${links}</ul>`);
        // createTextNote does not run the normal content-link scanner; add the
        // same native relations used by Trilium's importer. Later edits are
        // reconciled by Trilium's own content scanner.
        for (const source of sources) result.note.addRelation('internalLink',source.id);
        return {id:result.note.noteId,title};
    }
    throw new Error('不支持的知识库操作。');
}
