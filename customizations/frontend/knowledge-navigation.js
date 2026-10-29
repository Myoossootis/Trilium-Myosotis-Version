// A native widget is constructed before the desktop layout is first painted.
// This avoids waiting behind every #run=frontendStartup script.
const initial=await api.runOnBackend(knowledgeNavigationService,['load']);
module.exports=class extends api.BasicWidget {
    static get parentWidget(){return 'left-pane';}
    get position(){return 5;}
    doRender(){
        this.contentSized();
        const header=document.createElement('nav');header.id='kb-workspace-navigation';header.setAttribute('aria-label','工作空间');
        header.innerHTML='<div class="kw-label">工作空间</div><button type="button" data-note="HmeDashboard" data-view="home"><i class="bx bx-grid-alt" aria-hidden="true"></i><span>工作台</span></button><button type="button" data-note="KbHubHome001" data-view="knowledge"><i class="bx bx-library" aria-hidden="true"></i><span>知识库</span></button><button type="button" data-note="KbGraphNote1" data-view="graph"><i class="bx bx-git-branch" aria-hidden="true"></i><span>关系图谱</span></button><section id="kb-workspace-shortcuts" aria-label="快捷工具"><div class="kw-shortcuts-heading"><span>快捷工具</span><button type="button" data-action="tools" aria-expanded="false" aria-controls="kb-tool-picker" aria-haspopup="dialog">自定义</button></div><div class="kw-shortcut-list" aria-label="已固定工具"></div><div id="kb-tool-picker" class="kw-tools-menu" role="dialog" aria-label="自定义快捷工具" hidden><div class="kw-menu-title">添加常用工具</div><div class="kw-menu-hint">已固定的入口自动合并，拖动侧栏工具可排序</div><div class="kw-tool-choices"></div><div class="kw-save-status" role="status"></div></div></section>';
        this.$widget=$(header);
        const controller=createNavigation(header,initial);
        this.navigation=controller;
        window.TriliumKnowledgeNavigation?.dispose();
        window.TriliumKnowledgeNavigation=controller;
        document.body.classList.add('kb-workspace-nav');
        const attach=()=>{
            if(controller.disposed)return;
            const pane=header.parentElement,wrapper=pane?.querySelector('.tree-wrapper');
            if(!pane || !wrapper){this.attachFrame=requestAnimationFrame(attach);return;}
            controller.attach(pane,wrapper);
        };
        this.attachFrame=requestAnimationFrame(attach);
    }
    cleanup(){cancelAnimationFrame(this.attachFrame);this.navigation?.dispose();}
    activeContextChangedEvent(){this.navigation?.refresh();}
    noteSwitchedEvent(){this.navigation?.refresh();}
};

function createNavigation(header,initial){
    const catalog=initial.catalog;
    let state=initial.state,disposed=false,fullTree=false,scheduled=false,saving=false,dragId='',focusedChoice='';
    let pane,wrapper,treeObserver,paneObserver,launcherObserver;
    const directory=document.createElement('div');directory.id='kb-workspace-directory';
    directory.innerHTML='<span>知识目录</span><button type="button" aria-pressed="false">完整目录</button>';
    const footer=document.createElement('div');footer.id='kb-workspace-tools';
    footer.innerHTML='<button type="button" data-note="0e50f559e1a3"><i class="bx bx-extension" aria-hidden="true"></i><span>插件</span></button><button type="button" data-command="showOptions"><i class="bx bx-cog" aria-hidden="true"></i><span>设置</span></button><button type="button" class="launcher-button myo-day-night-icon" data-action="theme" aria-label="切换浅色或暗色" title="切换浅色或暗色"><span aria-hidden="true">◐</span></button><button type="button" data-command="hideLeftPane" aria-label="收起导航" title="收起导航"><i class="bx bx-chevrons-left" aria-hidden="true"></i></button>';
    const rail=document.createElement('nav');rail.id='kb-workspace-rail';rail.setAttribute('aria-label','工作空间 · 收起导航');
    rail.innerHTML='<div class="kw-rail-workspace"></div><div class="kw-rail-shortcuts" aria-label="快捷工具"></div><div class="kw-rail-footer"></div>';
    function railButton(source){
        const button=source.cloneNode(true),label=source.getAttribute('aria-label') || source.querySelector('span')?.textContent || source.title;
        button.setAttribute('aria-label',label);button.title=label;button.draggable=false;
        button.classList.remove('kw-shortcut');
        button.querySelector('.kw-drag-handle')?.remove();return button;
    }
    rail.querySelector('.kw-rail-workspace').append(...[...header.querySelectorAll('[data-view]')].map(railButton));
    rail.querySelector('.kw-rail-footer').append(...[...footer.querySelectorAll('button:not([data-command="hideLeftPane"])')].map(railButton));
    const expand=railButton(footer.querySelector('[data-command="hideLeftPane"]'));
    expand.dataset.command='showLeftPane';expand.setAttribute('aria-label','展开导航');expand.title='展开导航';
    expand.querySelector('i').className='bx bx-chevrons-right';
    rail.querySelector('.kw-rail-footer').append(expand);
    const list=header.querySelector('.kw-shortcut-list'),menu=header.querySelector('.kw-tools-menu'),menuButton=header.querySelector('[data-action="tools"]'),choices=header.querySelector('.kw-tool-choices'),status=header.querySelector('.kw-save-status');
    const iconTokens=item=>item.icon.split(/\s+/).filter(t=>t && !['bx','tn-icon'].includes(t));
    const available=item=>item&&window.TriliumModules?.available(item.script||item.target||item.id)!==false;
    function nativeButton(item){
        if(!available(item))return null;
        const buttons=[...document.querySelectorAll('#launcher-container .launcher-button')],tokens=iconTokens(item);
        return buttons.find(b=>tokens.length && tokens.every(t=>b.classList.contains(t))) || buttons.find(b=>item.command && b.dataset.triggerCommand===item.command);
    }
    function makeIcon(item){const icon=document.createElement('i');icon.className=[...new Set(item.icon.split(/\s+/))].join(' ');icon.setAttribute('aria-hidden','true');return icon;}
    function closeMenu(){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');focusedChoice='';}
    function renderShortcuts(){
        list.replaceChildren();
        for(const id of state.pinned){
            const item=catalog.find(n=>n.id===id);if(!available(item))continue;
            const button=document.createElement('button');button.type='button';button.className='kw-shortcut';button.dataset.tool=id;button.draggable=!saving;
            button.title=item.title+' · 拖动排序，或 Alt + ↑ / ↓';
            const label=document.createElement('span');label.textContent=item.title;
            const handle=document.createElement('i');handle.className='bx bx-grid-vertical kw-drag-handle';handle.setAttribute('aria-hidden','true');
            button.append(makeIcon(item),label,handle);list.append(button);
        }
        if(!list.children.length){const empty=document.createElement('div');empty.className='kw-empty-tools';empty.textContent='添加常用工具';list.append(empty);}
        rail.querySelector('.kw-rail-shortcuts').replaceChildren(...[...list.querySelectorAll('[data-tool]')].map(railButton));
        const scrollTop=choices.scrollTop;
        choices.replaceChildren();
        for(const item of catalog){
            if(!available(item))continue;
            const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=item.id;input.checked=state.pinned.includes(item.id);input.disabled=saving;
            const text=document.createElement('span');text.textContent=item.title;label.append(input,makeIcon(item),text);choices.append(label);
        }
        choices.scrollTop=scrollTop;
        if(!saving && !menu.hidden && focusedChoice)choices.querySelector(`input[value="${focusedChoice}"]`)?.focus({preventScroll:true});
        header.dataset.saving=String(saving);
    }
    async function save(pinned){
        if(saving || disposed)return;
        const previous=state;saving=true;state={...state,pinned};status.textContent='正在保存…';renderShortcuts();
        try{
            const next=await api.runOnBackend(knowledgeNavigationService,['save',{revision:previous.revision,pinned}]);
            if(disposed)return;state=next;status.textContent='已保存';
        }catch(error){state=previous;status.textContent='保存失败，已恢复原顺序';api.showMessage(error.message || String(error));}
        finally{saving=false;if(!disposed)renderShortcuts();}
    }
    function move(id,target,after){
        if(id===target || saving)return;
        const pinned=state.pinned.filter(n=>n!==id),index=pinned.indexOf(target);
        if(index<0)return;pinned.splice(index+(after?1:0),0,id);return save(pinned);
    }
    function decorate(){
        scheduled=false;if(disposed || !pane)return;
        let context;try{context=api.getActiveContext();}catch{}
        fullTree=context?.hoistedNoteId==='root';
        directory.querySelector('span').textContent=fullTree?'笔记目录':context?.hoistedNoteId==='HmeDashboard'?'工作台资料':context?.hoistedNoteId==='KbHubHome001'?'知识目录':'当前目录';
        directory.querySelector('button').textContent=fullTree?'子库目录':'完整目录';
        directory.querySelector('button').setAttribute('aria-pressed',String(fullTree));
        document.body.classList.add('kb-workspace-nav');
        document.body.classList.toggle('kb-workspace-collapsed',getComputedStyle(pane).display==='none');
        const id=context?.noteId,path=context?.notePath || '';
        const selected=id==='HmeDashboard' || path.includes('/HmeDashboard/')?'home':context?.note?.type==='noteMap' || context?.note?.type==='relationMap'?'graph':id==='KbHubHome001' || path.includes('/KbHubHome001/')?'knowledge':'';
        for(const button of header.querySelectorAll('[data-view]'))button.style.display=window.TriliumModules?.available(button.dataset.note)===false?'none':'';
        footer.querySelector('[data-action="theme"]').style.display=window.TriliumModules?.enabled('ThmStudioRoot')===false?'none':'';
        for(const button of header.querySelectorAll('[data-view]'))button.setAttribute('aria-current',button.dataset.view===selected?'page':'false');
        for(const button of list.querySelectorAll('[data-tool]')){const item=catalog.find(n=>n.id===button.dataset.tool);button.disabled=!nativeButton(item);button.setAttribute('aria-current',item.target && (id===item.target || path.split('/').includes(item.target))?'page':'false');}
        footer.querySelector('[data-note]').setAttribute('aria-current',id==='0e50f559e1a3' || path.split('/').includes('0e50f559e1a3')?'page':'false');
        for(const button of rail.querySelectorAll('[data-view],[data-tool],[data-note="0e50f559e1a3"]')){
            const source=button.dataset.view?header.querySelector(`[data-view="${button.dataset.view}"]`):button.dataset.tool?list.querySelector(`[data-tool="${button.dataset.tool}"]`):footer.querySelector('[data-note]');
            button.setAttribute('aria-current',source?.getAttribute('aria-current') || 'false');button.disabled=source?.disabled || false;button.style.display=source?.style.display || '';
        }
    }
    function schedule(){rail.querySelector('[data-action="theme"]').style.display=window.TriliumModules?.enabled('ThmStudioRoot')===false?'none':'';if(!scheduled && !disposed){scheduled=true;requestAnimationFrame(decorate);}}
    async function click(event){
        const button=event.target.closest('button');if(!button || dragId)return;
        try{
            if(button.dataset.note){closeMenu();const id=button.dataset.note;await api.setHoistedNoteId(id==='HmeDashboard'?id:['KbHubHome001','KbGraphNote1'].includes(id)?'KbHubHome001':'root');await api.activateNote(id);}
            else if(button.dataset.command){
                closeMenu();await api.triggerCommand(button.dataset.command);
                if(button.dataset.command==='hideLeftPane')requestAnimationFrame(()=>rail.querySelector('[data-command="showLeftPane"]').focus());
                else if(button.dataset.command==='showLeftPane')requestAnimationFrame(()=>footer.querySelector('[data-command="hideLeftPane"]').focus());
            }
            else if(button.dataset.action==='tools'){menu.hidden=!menu.hidden;menuButton.setAttribute('aria-expanded',String(!menu.hidden));}
            else if(button.dataset.action==='theme'){
                const native=document.querySelector('#launcher-container .myo-day-night-icon');if(!native)throw Error('原有主题切换入口不可用');native.click();
            }else if(button.dataset.tool){
                const native=nativeButton(catalog.find(n=>n.id===button.dataset.tool));if(!native)throw Error('此工具尚未启用');closeMenu();native.click();
            }
            schedule();
        }catch(error){api.showMessage(error.message || String(error));}
    }
    header.addEventListener('click',click);footer.addEventListener('click',click);rail.addEventListener('click',click);
    choices.addEventListener('focusin',event=>{focusedChoice=event.target.value || '';});
    choices.addEventListener('change',event=>{const {value,checked}=event.target;if(!saving)save(checked?[...state.pinned,value]:state.pinned.filter(id=>id!==value));});
    list.addEventListener('keydown',event=>{
        const button=event.target.closest('[data-tool]');if(!button || !event.altKey || !['ArrowUp','ArrowDown'].includes(event.key))return;
        event.preventDefault();const index=state.pinned.indexOf(button.dataset.tool),target=state.pinned[index+(event.key==='ArrowUp'?-1:1)];
        if(target)Promise.resolve(move(button.dataset.tool,target,event.key==='ArrowDown')).then(()=>list.querySelector(`[data-tool="${button.dataset.tool}"]`)?.focus());
    });
    list.addEventListener('dragstart',event=>{const button=event.target.closest('[data-tool]');if(!button || saving){event.preventDefault();return;}dragId=button.dataset.tool;event.dataTransfer.setData('text/plain',dragId);event.dataTransfer.effectAllowed='move';button.classList.add('kw-dragging');});
    function clearDrop(){for(const b of list.children)b.classList.remove('kw-drop-before','kw-drop-after','kw-dragging');}
    list.addEventListener('dragover',event=>{const target=event.target.closest('[data-tool]');if(!dragId || !target || dragId===target.dataset.tool)return;event.preventDefault();event.dataTransfer.dropEffect='move';clearDrop();const rect=target.getBoundingClientRect();target.classList.add(event.clientY>rect.top+rect.height/2?'kw-drop-after':'kw-drop-before');});
    list.addEventListener('drop',event=>{const target=event.target.closest('[data-tool]');if(!dragId || !target)return;event.preventDefault();const rect=target.getBoundingClientRect();move(dragId,target.dataset.tool,event.clientY>rect.top+rect.height/2);clearDrop();dragId='';});
    list.addEventListener('dragend',()=>{clearDrop();dragId='';});
    const outside=event=>{if(!header.querySelector('#kb-workspace-shortcuts').contains(event.target))closeMenu();};
    const escape=event=>{if(event.key==='Escape' && !menu.hidden){closeMenu();menuButton.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);window.addEventListener('hashchange',schedule);
    directory.querySelector('button').addEventListener('click',async()=>{try{await api.setHoistedNoteId(fullTree?'KbHubHome001':'root');schedule();}catch(error){api.showMessage(error.message || String(error));}});
    const modulesChanged=()=>{renderShortcuts();schedule();};window.addEventListener('trilium-modules-changed',modulesChanged);
    renderShortcuts();
    return {get disposed(){return disposed;},refresh:schedule,attach(parent,tree){
        pane=parent;wrapper=tree;pane.insertBefore(directory,wrapper);pane.append(footer);pane.before(rail);
        treeObserver=new MutationObserver(schedule);treeObserver.observe(wrapper,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
        paneObserver=new MutationObserver(schedule);paneObserver.observe(pane,{attributes:true,attributeFilter:['style']});
        launcherObserver=new MutationObserver(schedule);const launchers=document.querySelector('#launcher-container');if(launchers)launcherObserver.observe(launchers,{childList:true,subtree:true});
        decorate();
    },dispose(){
        disposed=true;treeObserver?.disconnect();paneObserver?.disconnect();launcherObserver?.disconnect();document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('hashchange',schedule);window.removeEventListener('trilium-modules-changed',modulesChanged);header.remove();directory.remove();footer.remove();rail.remove();document.body.classList.remove('kb-workspace-nav','kb-workspace-collapsed');
        if(window.TriliumKnowledgeNavigation===this)delete window.TriliumKnowledgeNavigation;
    }};
}

// Persist only navigation preferences; launcher actions remain native Trilium actions.
function knowledgeNavigationService(action, payload = {}) {
    const note=api.getNote('KbNavData001');
    if(!note || note.isDeleted || note.isProtected)throw Error('导航配置不可访问。');
    const state=JSON.parse(note.getContent());
    if(state.version!==1 || !Number.isInteger(state.revision) || !Array.isArray(state.pinned))throw Error('导航配置格式不兼容。');
    const launchers=api.getNote('_lbVisibleLaunchers').getChildNotes()
        .filter(n=>!n.isDeleted && !n.isProtected && n.type==='launcher')
        .map(n=>({id:n.noteId,title:n.title,icon:n.getLabelValue('iconClass') || '',command:n.getLabelValue('command') || '',builtin:n.getLabelValue('builtinWidget') || '',kind:n.getLabelValue('launcherType') || '',script:n.getRelationValue('script') || n.getRelationValue('myoDisabled_script') || '',target:n.getRelationValue('target') || ''}))
        .filter(n=>n.icon && !['spacer','bookmarks','syncStatus','quickSearch'].includes(n.builtin));
    const key=n=>n.kind==='script' && n.script?'script:'+n.script:n.kind==='note' && n.target?'note:'+n.target:n.command?'command:'+n.command:n.target?'note:'+n.target:n.script?'script:'+n.script:n.builtin?'builtin:'+n.builtin:'launcher:'+n.id;
    const fixed=new Set(['note:HmeDashboard','note:KbHubHome001','note:KbGraphNote1','note:0e50f559e1a3','script:HmOpenHomeTab','script:MyoCodexFlip','command:showOptions','command:hideLeftPane','command:quickSearch']);
    const byId=new Map(launchers.map(n=>[n.id,n])),groups=new Map();
    for(const item of launchers){
        const actionKey=key(item);if(fixed.has(actionKey))continue;
        if(!groups.has(actionKey))groups.set(actionKey,[]);groups.get(actionKey).push(item);
    }
    // Prefer the user's chosen alias when several launchers run the same action.
    const catalog=[...groups.values()].map(group=>state.pinned.map(id=>group.find(n=>n.id===id)).find(Boolean) || group[0]).map(n=>({...n,title:n.target==='_globalNoteMap'?'全局关系图谱':n.command==='searchNotes'?'高级搜索':n.title}));
    const canonical=new Map(catalog.map(n=>[key(n),n.id]));
    function normalize(pinned){
        const seen=new Set(),result=[];
        for(const id of pinned){
            const item=byId.get(id),actionKey=item?key(item):'launcher:'+id;
            if(fixed.has(actionKey) || seen.has(actionKey))continue;
            seen.add(actionKey);result.push(canonical.get(actionKey) || id);
        }
        return result;
    }
    // Loading only projects the visible choices; it does not rewrite saved preferences.
    if(action==='load')return {state:{...state,pinned:normalize(state.pinned)},catalog};
    if(action!=='save')throw Error('未知导航操作。');
    if(payload.revision!==state.revision)throw Error('导航已在其他窗口修改，请刷新后重试。');
    const allowed=new Set([...launchers.map(n=>n.id),...state.pinned]);
    if(!Array.isArray(payload.pinned) || payload.pinned.length>40 || new Set(payload.pinned).size!==payload.pinned.length || payload.pinned.some(id=>typeof id!=='string' || !allowed.has(id)))throw Error('快捷工具列表无效。');
    const next={version:1,revision:state.revision+1,pinned:normalize(payload.pinned)};
    note.setContent(JSON.stringify(next));
    return next;
}

