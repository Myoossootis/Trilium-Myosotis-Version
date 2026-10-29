function pluginMarketService(action,payload={}) {
    const store=api.getNote('MyoMarketData');
    if(!store || store.isDeleted || store.isProtected || !store.hasLabel('pluginMarketData'))throw new Error('插件市场配置不可访问');
    let registry;try{registry=JSON.parse(store.getContent());}catch{throw new Error('插件市场配置损坏，已停止修改');}
    if(registry.version!==1 || !Array.isArray(registry.plugins) || !Number.isInteger(registry.revision))throw new Error('插件市场配置格式不兼容');
    const prefix='myoDisabled_';
    const baseName=attr=>attr.name.startsWith(prefix)?attr.name.slice(prefix.length):attr.name;
    const labels=new Set(['run','widget','appCss','iconPack','customRequestHandler','customResourceProvider','customResourceHandler']);
    const relations=new Set(['renderNote','script','widget','titleTemplate','webViewSrc','runOnNoteCreation','runOnNoteTitleChange','runOnNoteChange','runOnNoteContentChange','runOnNoteDeletion','runOnBranchCreation','runOnBranchChange','runOnBranchDeletion','runOnChildNoteCreation','runOnAttributeCreation','runOnAttributeChange']);
    const protectedIds=new Set(['MyoMarketRoot','MyoMarketData','MyoMarketUI01','MyoMarketSvc1','MyoMarketCSS1','MyoModuleUI01',registry.rootId]);
    function components(plugin){const ids=new Set(plugin.componentIds || []);if(!plugin.componentIds)for(const id of plugin.roots){const note=api.getNote(id);if(note&&!note.isDeleted){ids.add(id);for(const child of note.getSubtreeNoteIds())ids.add(child);}}return [...ids].map(id=>api.getNote(id)).filter(note=>note&&!note.isDeleted);}
    const owners=new Map();
    for(const plugin of registry.plugins)for(const note of components(plugin)){if(owners.has(note.noteId)&&owners.get(note.noteId)!==plugin.id)throw Error('插件组件归属重叠，请先整理：'+note.noteId);owners.set(note.noteId,plugin.id);}
    function activation(plugin){
        const notes=components(plugin),attributes=new Map();
        const accepted=attr=>{const name=baseName(attr);return (attr.type==='label'?labels:relations).has(name)||(plugin.managedThemes&&attr.type==='label'&&name==='appTheme');};
        for(const note of notes){
            for(const attr of note.getOwnedAttributes())if(accepted(attr) && !protectedIds.has(attr.noteId))attributes.set(attr.attributeId,attr);
            // Include native launchers, render pages and event hooks pointing into this package.
            for(const attr of note.getTargetRelations())if(accepted(attr)&&!protectedIds.has(attr.noteId)&&(!owners.has(attr.noteId)||owners.get(attr.noteId)===plugin.id))attributes.set(attr.attributeId,attr);
        }
        return {notes,attributes:[...attributes.values()]};
    }
    function list(){return {revision:registry.revision,rootId:registry.rootId,plugins:registry.plugins.map(plugin=>{
        const {notes,attributes}=activation(plugin);if(!notes.length)return null;
        const enabled=attributes.some(attr=>!attr.name.startsWith(prefix));
        const disabled=attributes.some(attr=>attr.name.startsWith(prefix));
        const sourceNotes=notes.filter(note=>note.type==='code' && !note.mime?.includes('json') && !note.hasLabel('commissionData') && !note.hasLabel('pluginMarketData') && !note.hasLabel('homeWordChangeData'));
        const updatedAt=sourceNotes.map(note=>note.utcDateModified).filter(Boolean).sort().at(-1) || plugin.updatedAt || null;
        const theme=!plugin.managedThemes&&notes.some(note=>note.hasLabel('appTheme')); 
        const locked=plugin.locked || theme || !attributes.length || attributes.some(attr=>api.getNote(attr.noteId)?.isProtected);
        return {...plugin,updatedAt,componentCount:notes.length,enabled:(plugin.locked||theme)?true:typeof plugin.enabled==='boolean'?plugin.enabled:enabled,mixed:enabled && disabled,canToggle:!locked,toggleHint:plugin.locked?'市场自身保持启用':theme?'主题请在 Trilium 设置中切换':!attributes.length?'手动组件，没有自动加载入口':attributes.some(attr=>api.getNote(attr.noteId)?.isProtected)?'受保护的插件不能修改':'切换后刷新或重启 Trilium 生效'};
    }).filter(Boolean)};}
    if(action==='load')return list();
    if(action==='audit')return {plugins:registry.plugins.filter(p=>!p.core).map(plugin=>{const {notes,attributes}=activation(plugin);return {id:plugin.id,componentIds:notes.map(n=>n.noteId),bindings:attributes.map(a=>({noteId:a.noteId,type:a.type,name:a.name,value:a.value,isInheritable:a.isInheritable,position:a.position}))};})};
    if(action!=='toggle')throw new Error('未知插件市场操作');
    if(payload.revision!==registry.revision)throw new Error('插件状态已变化，请刷新后重试');
    if(typeof payload.enabled!=='boolean')throw new Error('启用状态不正确');
    const plugin=registry.plugins.find(item=>item.id===payload.id);if(!plugin)throw new Error('未找到插件');
    const view=list().plugins.find(item=>item.id===plugin.id);if(!view?.canToggle)throw new Error(view?.toggleHint || '该插件不能切换');
    const {attributes}=activation(plugin);
    // Preflight every owner before any mutation; Trilium runs this operation in one transaction.
    for(const attr of attributes){const owner=api.getNote(attr.noteId);if(!owner || owner.isDeleted || owner.isProtected || protectedIds.has(owner.noteId))throw new Error('插件入口不可修改，操作已停止');}
    // A disabled custom theme must not remain selected. Restore only if the user
    // has kept the fallback theme rather than choosing another one meanwhile.
    let themeOption=null;
    if(plugin.managedThemes){
        themeOption=api.getOption('theme');
        const current=themeOption?.value;
        if(!payload.enabled){delete plugin.previousTheme;delete plugin.fallbackTheme;const selected=activation(plugin).attributes.find(a=>a.type==='label'&&baseName(a)==='appTheme'&&a.value===current);if(selected){plugin.previousTheme=current;plugin.fallbackTheme=api.getNote(selected.noteId).getLabelValue('appThemeBase')?.includes('dark')?'next-dark':'next-light';themeOption.value=plugin.fallbackTheme;themeOption.save();}}
    }
    let changed=0;
    for(const attr of attributes){
        const wasDisabled=attr.name.startsWith(prefix);if(wasDisabled!==payload.enabled)continue;
        const owner=api.getNote(attr.noteId),name=payload.enabled?attr.name.slice(prefix.length):prefix+attr.name;
        // Clone/delete this exact native attribute, rather than removing every
        // equal-valued attribute on the owner. Duplicate legacy bindings and
        // their positions must round-trip unchanged as well.
        const replacement=attr.createClone(attr.type,name,attr.value,attr.isInheritable);
        replacement.save();attr.markAsDeleted();changed++;
    }
    if(plugin.managedThemes&&payload.enabled&&plugin.previousTheme&&themeOption?.value===plugin.fallbackTheme){themeOption.value=plugin.previousTheme;themeOption.save();}
    plugin.enabled=payload.enabled;
    registry.revision++;
    registry.history=[...(registry.history || []),{id:plugin.id,enabled:payload.enabled,time:new Date().toISOString(),changed}].slice(-100);
    store.setContent(JSON.stringify(registry));
    return {...list(),restartRequired:true,changed};
}
