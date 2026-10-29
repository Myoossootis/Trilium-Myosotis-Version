// Primary: enable/style choice; secondary: previews; tertiary: scope and save status.
// Use existing native theme tokens, 8/12/16/24/32 spacing, 16px body and 1.9 leading.
const initial=await api.runOnBackend(typographyPreferences,['load']);
module.exports=class extends api.BasicWidget {
    static get parentWidget(){return 'left-pane';}
    get position(){return 2;}
    doRender(){
        this.$widget=$('<div hidden></div>');this.contentSized();
        window.TriliumNoteTypography?.dispose();
        this.controller=createTypography(initial);window.TriliumNoteTypography=this.controller;
    }
    cleanup(){this.controller?.dispose();}
};
function createTypography(initial){
    let config=initial,panel=null,busy=false,disposed=false,scheduled=false;
    const styles=[['clean','简洁正文','清晰标题 · 舒适行距'],['study','荧光复习','标题标记 · 重点引用'],['reading','纸面阅读','宋体正文 · 居中纸页']];
    function apply(){
        if(config.enabled)document.body.dataset.noteTypography=config.style;
        else delete document.body.dataset.noteTypography;
        if(!panel)return;
        panel.querySelector('input').checked=config.enabled;
        panel.querySelector('input').disabled=busy;
        for(const button of panel.querySelectorAll('[data-style]')){
            button.disabled=busy;button.setAttribute('aria-pressed',String(button.dataset.style===config.style));
            button.querySelector('.nt-selected').textContent=button.dataset.style===config.style?'已选':'';
        }
        panel.querySelector('.nt-current').textContent=config.enabled?'已开启 · '+styles.find(s=>s[0]===config.style)[1]:'已关闭 · 使用原有排版';
    }
    async function save(change){
        if(busy)return;
        const previous=config;config={...config,...change};
        busy=true;apply();panel.querySelector('.nt-status').textContent='正在保存…';
        try{
            config=await api.runOnBackend(typographyPreferences,['save',config]);apply();
            if(panel?.isConnected)panel.querySelector('.nt-status').textContent='已保存，即时生效';
        }catch(error){
            config=previous;
            if(panel?.isConnected)panel.querySelector('.nt-status').textContent='保存失败，保留原设置';
            api.showMessage(error.message || String(error));
        }finally{busy=false;apply();}
    }
    function mount(){
        scheduled=false;if(disposed)return;
        const anchor=document.querySelector('.options-dialog .ts-settings');
        if(!anchor){panel?.remove();panel=null;return;}
        if(panel?.isConnected)return;
        panel=document.createElement('section');panel.className='nt-settings';panel.setAttribute('aria-label','笔记排版');
        panel.innerHTML='<div class="nt-head"><div><strong>笔记排版</strong><span class="nt-current"></span></div><label class="nt-enable"><input type="checkbox" role="switch" aria-label="启用笔记排版"><span>启用</span></label></div><div class="nt-grid" role="group" aria-label="笔记排版风格"></div><p class="nt-help">仅调整文本笔记的显示，适用于阅读和编辑。配色跟随当前主题，关闭后恢复原有排版。</p><span class="nt-status" role="status" aria-live="polite"></span>';
        for(const [id,name,description] of styles){
            const button=document.createElement('button');button.type='button';button.className='nt-card';button.dataset.style=id;
            button.innerHTML='<div class="nt-thumb" aria-hidden="true"><div class="nt-sheet"><b>把知识写成自己的理解</b><i></i><i></i><em>01　先记住一个关系</em><i></i><i></i><blockquote>温故而知新</blockquote></div></div><strong>'+name+'</strong><span class="nt-description">'+description+'</span><span class="nt-selected"></span>';
            panel.querySelector('.nt-grid').append(button);
        }
        panel.querySelector('input').addEventListener('change',event=>save({enabled:event.target.checked}));
        panel.addEventListener('click',event=>{const button=event.target.closest('[data-style]');if(button && button.dataset.style!==config.style)save({style:button.dataset.style});});
        anchor.after(panel);apply();
    }
    const observer=new MutationObserver(records=>{
        if(records.every(record=>panel?.contains(record.target)))return;
        if(!scheduled&&!disposed){scheduled=true;requestAnimationFrame(mount);}
    });
    observer.observe(document.body,{childList:true,subtree:true});apply();mount();
    return {dispose(){disposed=true;observer.disconnect();panel?.remove();delete document.body.dataset.noteTypography;if(window.TriliumNoteTypography===this)delete window.TriliumNoteTypography;}};
}
// Preferences live in one Trilium code note and survive refresh/restart and theme changes.
function typographyPreferences(action,payload){
    const note=api.getNote('NtStyleCfg01');
    if(!note || note.isDeleted || note.isProtected)throw Error('笔记排版配置不可访问');
    const validate=value=>{
        if(value?.version!==1 || typeof value.enabled!=='boolean' || !['clean','study','reading'].includes(value.style))throw Error('笔记排版配置格式不兼容');
        return {version:1,enabled:value.enabled,style:value.style};
    };
    const current=validate(JSON.parse(note.getContent()));
    if(action==='load')return current;
    if(action!=='save')throw Error('未知排版操作');
    const next=validate(payload);note.setContent(JSON.stringify(next));return next;
}
