// Optional enhancements live here; the knowledge workspace only supplies a mount point.
module.exports=class extends api.BasicWidget{
    static get parentWidget(){return 'left-pane';}
    get position(){return 8;}
    doRender(){this.$widget=$('<div hidden></div>');this.contentSized();window.TriliumNoteExperience?.dispose();this.controller=createNoteExperience();window.TriliumNoteExperience=this.controller;window.dispatchEvent(new Event('trilium-note-experience-changed'));}
    cleanup(){this.controller?.dispose();}
    noteSwitchedEvent(){this.controller?.noteSwitched();}
};
function createNoteExperience(){
    let disposed=false,source,locationVersion=0,notice=null,targetId=null;
    const mounts=new Set();
    const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
    function clearLocation(){locationVersion++;targetId=null;notice?.remove();notice=null;CSS.highlights?.delete('nx-note-hit');}
    function terms(query){return [...new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean))];}
    function marked(node,text,words){
        let from=0;const lower=text.toLowerCase();while(from<text.length){let start=-1,word='';for(const t of words){const i=lower.indexOf(t,from);if(i>=0&&(start<0||i<start)){start=i;word=t;}}
            if(start<0){node.append(document.createTextNode(text.slice(from)));break;}node.append(document.createTextNode(text.slice(from,start)),el('mark','',text.slice(start,start+word.length)));from=start+word.length;
        }
    }
    async function search(rootId,query){if(!source)source=await (await api.getNote('NxExpSvc001')).getContent();return api.runOnBackend(source,[rootId,query]);}
    // Build a text-to-DOM map without editing CKEditor's content or selection.
    function textMap(root){
        let text='',positions=[],lastBlock=null,space=false;
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;return !p||p.closest('script,style,[aria-hidden="true"],.ck-fake-selection-container')||!p.getClientRects().length?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
        let node;
        while((node=walker.nextNode())){
            const block=node.parentElement.closest('p,li,h1,h2,h3,h4,h5,h6,td,th,pre,blockquote');
            if(text&&block!==lastBlock&&!space){text+=' ';positions.push(null);space=true;}lastBlock=block;
            for(let i=0;i<node.data.length;i++){const c=node.data[i];if(/\s/.test(c)){if(text&&!space){text+=' ';positions.push({node,offset:i});space=true;}}else{text+=c;positions.push({node,offset:i});space=false;}}
        }
        return {text,positions};
    }
    async function locate(note,match,version){
        if(!match)return;
        const started=performance.now();let root;
        while(!disposed&&version===locationVersion&&performance.now()-started<6000){
            if(api.getActiveContext().noteId!==note.id)return;
            const editor=await api.getActiveContextTextEditor();root=editor?.ui?.view?.editable?.element;
            if(root?.isConnected&&root.getClientRects().length&&root.textContent.toLowerCase().includes(match.term))break;
            await new Promise(r=>setTimeout(r,80));
        }
        if(disposed||version!==locationVersion||api.getActiveContext().noteId!==note.id)return;
        await new Promise(r=>setTimeout(r,180));
        if(disposed||version!==locationVersion||api.getActiveContext().noteId!==note.id||!root?.isConnected)return;
        const map=textMap(root),lower=map.text.toLowerCase(),context=match.context.toLowerCase();
        let index=-1,candidate=lower.indexOf(context),distance=Infinity;
        while(candidate>=0){const delta=Math.abs(candidate+match.contextOffset-match.offset);if(delta<distance){distance=delta;index=candidate+match.contextOffset;}candidate=lower.indexOf(context,candidate+1);}
        if(index<0){index=lower.indexOf(match.term);if(index>=0&&lower.indexOf(match.term,index+match.term.length)>=0)index=-1;}
        const start=map.positions[index],end=map.positions[index+match.term.length-1];
        if(!start||!end){api.showMessage('已打开笔记；正文可能已变化，未能准确定位原片段。');return;}
        const range=document.createRange();range.setStart(start.node,start.offset);range.setEnd(end.node,end.offset+1);
        if(typeof Highlight!=='undefined'&&CSS.highlights)CSS.highlights.set('nx-note-hit',new Highlight(range));
        const target=start.node.parentElement;
        target.scrollIntoView({block:'center',behavior:'instant'});
        const scroller=target.closest('.scrolling-container');if(scroller){const rect=range.getBoundingClientRect(),box=scroller.getBoundingClientRect();scroller.scrollTop+=rect.top-box.top-box.height*.38;}
        notice=el('div','nx-location');notice.setAttribute('role','status');notice.append(el('span','','已定位正文'));
        const back=el('button','','返回搜索');back.type='button';back.onclick=()=>api.activateNote('KbHubHome001');
        const close=el('button','','×');close.type='button';close.setAttribute('aria-label','关闭定位提示');close.onclick=clearLocation;notice.append(back,close);document.body.append(notice);
    }
    function mountSearch(container,options){
        let alive=true,timer,limit=30;const words=terms(options.query),abort=new AbortController();
        const dispose=()=>{alive=false;clearTimeout(timer);abort.abort();container.replaceChildren();mounts.delete(dispose);};mounts.add(dispose);
        const status=el('p','nx-search-status','正在搜索当前子库全文…');status.setAttribute('role','status');container.replaceChildren(status);
        timer=setTimeout(async()=>{
            try{
                const response=await search(options.rootId,options.query);if(!alive||disposed)return;
                const allowed=new Set(options.allowedIds),results=response.results.filter(n=>allowed.has(n.id));
                container.replaceChildren();const summary=el('div','nx-search-summary');summary.dataset.query=options.query;summary.append(el('span','',results.length+' 篇笔记'),el('small','','当前子库 · 标题与完整正文'));container.append(summary);
                if(!results.length){container.append(el('p','hl-empty','没有找到匹配内容，试试更短的关键词。'));return;}
                const list=el('div','nx-results');container.append(list);
                async function open(note,match){
                    clearLocation();targetId=note.id;await options.onOpen(note);if(disposed)return;
                    // A completed activation owns its location request.
                    const version=locationVersion;locate(note,match,version).catch(e=>api.showMessage('已打开笔记，定位失败：'+e.message));
                }
                function render(){list.replaceChildren();for(const note of results.slice(0,limit)){
                    const card=el('article','nx-result');card.dataset.kbNote=note.id;card.dataset.kbParent=note.parentId;
                    const header=el('div','nx-result-header'),title=el('button','nx-result-title'),label=el('strong');title.type='button';marked(label,note.title.replace(/^\d+\s*/,''),words);title.append(label);title.onclick=()=>open(note,note.matches[0]);
                    const more=el('button','hl-open','⋯');more.type='button';more.dataset.kbMenu='';more.setAttribute('aria-label','更多操作 '+note.title);header.append(title,more);card.append(header,el('small','nx-result-path',note.path.map(t=>t.replace(/^\d+\s*/,'')).join(' / ')||'子库专题'));
                    for(const match of note.matches){const snippet=el('button','nx-snippet');snippet.type='button';snippet.setAttribute('aria-label','打开并定位：'+match.text);if(match.prefix)snippet.append(document.createTextNode('…'));marked(snippet,match.text,words);if(match.suffix)snippet.append(document.createTextNode('…'));snippet.onclick=()=>open(note,match);card.append(snippet);}
                    const hint=el('small','nx-result-hint',note.hitCount?(note.limited?'至少 ':'')+note.hitCount+' 处正文命中 · 点击片段定位':'标题或目录命中 · 打开笔记');card.append(hint);
                    card.addEventListener('click',event=>{if(!event.target.closest('button,a'))open(note,note.matches[0]);},{signal:abort.signal});list.append(card);
                }if(results.length>limit){const more=el('button','hl-more','再显示 30 篇');more.type='button';more.onclick=()=>{limit+=30;render();};list.append(more);}}
                render();
            }catch(error){if(alive&&!disposed){status.textContent='全文搜索失败：'+error.message;status.setAttribute('role','alert');container.replaceChildren(status);}}
        },180);
        return dispose;
    }
    return {mountSearch,clearLocation,noteSwitched(){if(api.getActiveContext().noteId!==targetId)clearLocation();},dispose(){disposed=true;for(const dispose of [...mounts])dispose();clearLocation();if(window.TriliumNoteExperience===this)delete window.TriliumNoteExperience;window.dispatchEvent(new Event('trilium-note-experience-changed'));}};
}
