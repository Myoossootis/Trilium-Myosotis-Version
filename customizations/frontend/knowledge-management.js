// Primary: one contextual action; secondary: cancel. Existing theme tokens and
// native modal focus containment; no controls or metadata are added to editor HTML.
module.exports=class extends api.BasicWidget{
    static get parentWidget(){return 'left-pane';}
    get position(){return 7;}
    doRender(){this.$widget=$('<div hidden></div>');this.contentSized();window.TriliumKnowledgeManagement?.dispose();this.controller=createManager();window.TriliumKnowledgeManagement=this.controller;}
    cleanup(){this.controller?.dispose();}
    entitiesReloadedEvent({loadResults}){
        const ids=new Set(loadResults.getNoteIds());
        for(const branch of loadResults.getBranchRows()){ids.add(branch.noteId);ids.add(branch.parentNoteId);}
        for(const attribute of loadResults.getAttributeRows())ids.add(attribute.noteId);
        if(ids.size)window.dispatchEvent(new CustomEvent('trilium-knowledge-source-changed',{detail:{ids:[...ids]}}));
    }
    noteSwitchedEvent(){window.dispatchEvent(new Event('trilium-knowledge-activated'));}
    activeContextChangedEvent(){window.dispatchEvent(new Event('trilium-knowledge-activated'));}
};
function createManager(){
    let source,menu=null,dialog=null,anchor=null,disposed=false,busy=false;
    const controller=new AbortController(),signal=controller.signal;
    async function service(action,payload){if(!source)source=await (await api.getNote('KbManageSvc1')).getContent();return api.runOnBackend(source,[action,payload]);}
    function closeMenu(restore=false){menu?.remove();menu=null;if(restore&&anchor?.isConnected)anchor.focus();}
    function context(element){const area=element.closest('[data-kb-root]'),item=element.closest('[data-kb-note]');return area?{rootId:area.dataset.kbRoot,id:item?.dataset.kbNote,parentId:item?.dataset.kbParent}:null;}
    function notify(rootId,result){window.dispatchEvent(new CustomEvent('trilium-knowledge-updated',{detail:{rootId,...result}}));}
    async function showMenu(element,x,y){
        closeMenu();const ctx=context(element);if(!ctx?.id)return;anchor=element.closest('button')||element.querySelector('button');
        const m=document.createElement('div');m.className='km-menu';m.setAttribute('popover','manual');m.setAttribute('role','menu');m.setAttribute('aria-label','笔记操作');m.innerHTML='<div class="km-menu-title"></div>';
        const label=element.closest('[data-kb-note]').querySelector('strong,h3,b')?.textContent || '笔记';m.firstChild.textContent=label;
        const actions=[['open','打开笔记','bx-link-external'],['child','新建子笔记','bx-file'],['rename','重命名','bx-edit-alt'],['move','更换专题…','bx-folder-open'],['copy','复制笔记链接','bx-link'],['delete','从此处删除…','bx-trash']];
        for(const [id,text,icon]of actions){const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.dataset.action=id;b.innerHTML='<i class="bx '+icon+'" aria-hidden="true"></i><span></span>';b.lastChild.textContent=text;if(id==='delete')b.className='km-delete';b.addEventListener('click',()=>{closeMenu();run(id,ctx);});m.append(b);}
        menu=m;document.body.append(m);m.showPopover();const r=m.getBoundingClientRect();m.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';m.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+'px';m.querySelector('button').focus({preventScroll:true});
    }
    function showDialog(title,description,kind,value='',topics=[]){
        dialog?.remove();const d=document.createElement('dialog');d.className='km-dialog';d.setAttribute('aria-labelledby','km-dialog-title');d.innerHTML='<form><h2 id="km-dialog-title"></h2><p class="km-description"></p><div class="km-fields"></div><p class="km-error" role="alert"></p><footer><button type="button" class="km-cancel">取消</button><button type="submit" class="km-submit"></button></footer></form>';
        d.querySelector('h2').textContent=title;d.querySelector('.km-description').textContent=description;
        const fields=d.querySelector('.km-fields');
        if(kind==='move'){
            fields.innerHTML='<label>目标专题<select name="target"></select></label><label class="km-new-topic" hidden>新专题名称<input name="topic" maxlength="150" placeholder="例如：视频知识补充"></label>';
            const select=fields.querySelector('select');select.add(new Option('请选择专题',''));for(const t of topics)select.add(new Option(t.title,t.id));select.add(new Option('＋ 新增专题并移入','new'));select.addEventListener('change',()=>{const field=fields.querySelector('.km-new-topic');field.hidden=select.value!=='new';field.querySelector('input').required=select.value==='new';if(select.value==='new')field.querySelector('input').focus();});select.required=true;
        }else if(kind!=='delete'){
            fields.innerHTML='<label>名称<input name="title" required maxlength="150" autocomplete="off"></label>';fields.querySelector('input').value=value;
        }
        const submit=d.querySelector('.km-submit');submit.textContent=kind==='delete'?'确认删除':kind==='move'?'移动到专题':'保存';if(kind==='delete')submit.classList.add('km-danger');
        document.body.append(d);dialog=d;d.showModal();
        d.addEventListener('cancel',e=>{if(d.dataset.saving)e.preventDefault();});
        const target=kind==='delete'?d.querySelector('.km-cancel'):fields.querySelector('input,select');target.focus();if(target.tagName==='INPUT')target.select();
        d.querySelector('.km-cancel').addEventListener('click',()=>d.close());
        d.addEventListener('close',()=>{d.remove();if(dialog===d)dialog=null;busy=false;if(anchor?.isConnected)anchor.focus();});
        return d;
    }
    async function run(action,ctx){
        if(busy||disposed)return;
        try{
            if(action==='open'){await api.activateNote(ctx.id);return;}
            if(action==='copy'){await navigator.clipboard.writeText(location.origin+'/#root/'+ctx.id);api.showMessage('已复制笔记链接');return;}
            busy=true;
            const info=ctx.id?await service('inspect',ctx):null;
            if(disposed){busy=false;return;}
            const kind=action==='child'||action==='topic'?'create':action;
            const title=action==='child'?'新建子笔记':action==='topic'?'新增专题':action==='rename'?'重命名':action==='move'?'更换专题':'删除笔记';
            const description=action==='child'?'创建在「'+info.title+'」下面，可记录一个独立问题。':action==='topic'?'在当前子库下创建一个专题。':action==='rename'?'名称会同步到这篇笔记的所有归属位置。':action==='move'?'移动当前归属，子笔记随之移动，其他克隆位置保留。':'将从当前位置删除「'+info.title+'」。'+(info.clones>1?'其他归属位置保留。':'包含其下 '+info.children+' 篇子笔记；有其他归属的子笔记保留。')+'可在 Trilium 的最近更改中恢复。';
            const d=showDialog(title,description,kind,action==='rename'?info.title:'',info?.topics || []);
            d.querySelector('form').addEventListener('submit',async event=>{
                event.preventDefault();if(d.dataset.saving)return;d.dataset.saving='true';for(const b of d.querySelectorAll('button'))b.disabled=true;
                try{
                    const fields=new FormData(event.currentTarget);let payload={...ctx,expected:info?.expected};
                    if(kind==='create')payload={rootId:ctx.rootId,parentId:action==='child'?ctx.id:ctx.rootId,title:fields.get('title')};
                    else if(kind==='rename')payload.title=fields.get('title');
                    else if(kind==='move'){payload.targetId=fields.get('target');if(payload.targetId==='new')payload.newTopic=fields.get('topic');}
                    else if(kind==='delete')payload.confirm=true;
                    const result=await service(kind,payload);notify(ctx.rootId,{...result,action:kind});d.close();
                    api.showMessage(kind==='delete'?'已从当前位置删除':kind==='move'?'已更换专题':kind==='create'?'已创建':'已重命名');
                    if(action==='child')await api.activateNote(result.id);
                }catch(e){d.querySelector('.km-error').textContent=e.message || String(e);}
                finally{delete d.dataset.saving;for(const b of d.querySelectorAll('button'))b.disabled=false;}
            });
        }catch(e){busy=false;api.showMessage(e.message || String(e));}
    }
    document.addEventListener('contextmenu',event=>{const item=event.target.closest('[data-kb-note]');if(!item||!context(item))return;event.preventDefault();event.stopPropagation();showMenu(event.target,event.clientX,event.clientY);},{signal});
    document.addEventListener('click',event=>{
        const more=event.target.closest('[data-kb-menu]');if(more){const r=more.getBoundingClientRect();event.preventDefault();event.stopPropagation();showMenu(more,r.right,r.bottom);return;}
        const create=event.target.closest('[data-kb-create]');if(create){const area=create.closest('[data-kb-root]');if(!area)return;anchor=create;const parent=create.dataset.kbCreate;run(parent===area.dataset.kbRoot?'topic':'child',{rootId:area.dataset.kbRoot,id:parent===area.dataset.kbRoot?undefined:parent,parentId:create.dataset.kbParent});}
    },{signal});
    document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target))closeMenu();},{signal});
    document.addEventListener('scroll',()=>closeMenu(),{capture:true,signal});window.addEventListener('resize',()=>closeMenu(),{signal});
    document.addEventListener('keydown',e=>{
        if(menu){const buttons=[...menu.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length].focus();}else if(e.key==='Escape'){e.preventDefault();closeMenu(true);}else if(e.key==='Tab')closeMenu();}
        else if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){const item=e.target.closest('[data-kb-note]');if(item){e.preventDefault();const r=item.getBoundingClientRect();showMenu(e.target,r.left+24,r.top+24);}}
    },{signal});
    return {dispose(){disposed=true;controller.abort();closeMenu();dialog?.close();dialog?.remove();if(window.TriliumKnowledgeManagement===this)delete window.TriliumKnowledgeManagement;}};
}
