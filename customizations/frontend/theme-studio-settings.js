// Theme preview cards inside Trilium's existing Appearance settings.
const palettes=/*THEME_PALETTES*/[];
const state=window.MyoCodexThemeSwitchState ||= {busy:false,nativePromise:null};
    async function nativeModules() {
        // Resolve hashed native modules from the running build, rather than import a note module.
        const sources=[...document.querySelectorAll('script[src][type="module"]')].map(s=>s.src);
        let themeUrl, optionsUrl;
        for(const source of sources) {
            if(new URL(source,location.href).origin!==location.origin)continue;
            const response=await fetch(source);
            if(!response.ok)continue;
            const code=await response.text();
            const theme=code.match(/\.\/theme-[\w-]+\.js/);
            const options=code.match(/\.\/options-[\w-]+\.js/);
            if(theme)themeUrl=new URL(theme[0],source).href;
            if(options)optionsUrl=new URL(options[0],source).href;
            if(themeUrl && optionsUrl)break;
        }
        if(!themeUrl)throw new Error('未找到 Trilium 原生主题模块');
        // The theme loader also declares the options module it uses.
        if(!optionsUrl) {
            const response=await fetch(themeUrl);
            if(!response.ok)throw new Error('无法读取主题模块');
            const match=(await response.text()).match(/\.\/options-[\w-]+\.js/);
            if(match)optionsUrl=new URL(match[0],themeUrl).href;
        }
        if(!optionsUrl)throw new Error('未找到 Trilium 原生设置模块');
        const [theme,settings]=await Promise.all([import(themeUrl),import(optionsUrl)]);
        const options=settings.default || settings.t;
        if(typeof theme.t!=='function' || typeof options?.save!=='function')throw new Error('当前 Trilium 版本的主题接口不兼容');
        await options.initializedPromise;
        return {options,loadTheme:theme.t};
    }
    function waitForTheme(target) {
        return new Promise((resolve,reject)=>{
            let observer;
            const timeout=setTimeout(()=>{observer.disconnect();reject(new Error('主题样式加载失败'));},8000);
            const check=()=>{if(document.body.getAttribute('data-theme-id')===target){clearTimeout(timeout);observer.disconnect();resolve();}};
            observer=new MutationObserver(check);observer.observe(document.body,{attributes:true,attributeFilter:['data-theme-id']});check();
        });
    }

module.exports=class extends api.BasicWidget {
    static get parentWidget(){return 'left-pane';}
    get position(){return 1;}
    doRender(){
        this.$widget=$('<div hidden></div>');this.contentSized();
        window.TriliumThemeCards?.dispose();
        const controller=createThemeCards();window.TriliumThemeCards=controller;this.controller=controller;
    }
    cleanup(){this.controller?.dispose();}
};
function createThemeCards(){
    let panel=null,themeRow=null,modeRow=null,scheduled=false,disposed=false,ownBusy=false;
    const descriptions={slate:'中性克制',forest:'自然清新',paper:'温暖阅读',ocean:'清晰冷静',mist:'柔和安静'};
    function current(){return palettes.find(p=>p.id===document.body.dataset.themeId);}
    function mode(){return current()?.mode || (document.body.classList.contains('dark-theme')?'dark':'light');}
    function refresh(){
        if(!panel)return;
        const selected=current(),activeMode=mode();
        for(const button of panel.querySelectorAll('[data-palette]')){
            const p=palettes.find(p=>p.key===button.dataset.palette && p.mode===activeMode),c=p.colors;
            button.setAttribute('aria-pressed',String(selected?.key===p.key));button.disabled=ownBusy;
            for(const key of ['surface','sidebar','text','border','accent','soft'])button.style.setProperty('--thumb-'+key,c[key]);
            button.querySelector('.ts-card-state').textContent=selected?.key===p.key?'已选':'';
        }
        for(const button of panel.querySelectorAll('[data-mode]')){button.setAttribute('aria-pressed',String(activeMode===button.dataset.mode));button.disabled=ownBusy;}
        panel.querySelector('.ts-current').textContent=selected?'当前：'+selected.name:'当前：原生主题';
    }
    async function select(key,nextMode){
        const target=palettes.find(p=>p.key===key && p.mode===nextMode);if(!target || state.busy || ownBusy || target.id===document.body.dataset.themeId)return;
        state.busy=true;ownBusy=true;refresh();panel.querySelector('.ts-status').textContent='正在切换…';
        let native,previous,changed=false;
        try{
            native=await(state.nativePromise ||= nativeModules().catch(error=>{state.nativePromise=null;throw error;}));
            previous=native.options.get('theme');await native.options.save('theme',target.id);changed=true;
            await native.loadTheme();await waitForTheme(target.id);
            if(panel?.isConnected)panel.querySelector('.ts-status').textContent='已保存';
        }catch(error){
            if(changed)try{await native.options.save('theme',previous);await native.loadTheme();}catch(rollback){console.error('Theme cards rollback',rollback);}
            if(panel?.isConnected)panel.querySelector('.ts-status').textContent='切换失败，已恢复原主题';api.showMessage(error.message || String(error));
        }finally{state.busy=false;ownBusy=false;refresh();const body=panel?.closest('.modal-body');if(body)body.scrollLeft=0;}
    }
    function mount(){
        scheduled=false;if(disposed)return;
        const native=document.querySelector('.options-dialog button[id^="theme-"]');
        if(!native){if(panel?.isConnected)panel.remove();panel=null;return;}
        const row=native.closest('.tn-card-section');if(!row)return;
        if(panel?.isConnected && themeRow===row){refresh();return;}
        panel?.remove();themeRow?.classList.remove('ts-native-theme-row','ts-native-visible');modeRow?.classList.remove('ts-native-theme-row','ts-native-visible');
        themeRow=row;modeRow=row.nextElementSibling?.querySelector('label[for^="color-scheme-"]')?row.nextElementSibling:null;
        panel=document.createElement('section');panel.className='ts-settings';panel.setAttribute('aria-label','主题预览');
        panel.innerHTML='<div class="ts-settings-head"><div><strong>主题与配色</strong><span class="ts-current"></span></div><div class="ts-mode" role="group" aria-label="主题明暗"><button type="button" data-mode="light">浅色</button><button type="button" data-mode="dark">暗色</button></div></div><div class="ts-theme-grid" aria-label="主题预览卡片"></div><div class="ts-settings-foot"><button type="button" class="ts-native-toggle" aria-expanded="false">其他主题</button><span class="ts-status" role="status" aria-live="polite"></span></div>';
        const grid=panel.querySelector('.ts-theme-grid');
        for(const p of palettes.filter(p=>p.mode==='light')){
            const button=document.createElement('button');button.type='button';button.className='ts-theme-card';button.dataset.palette=p.key;
            button.innerHTML='<div class="ts-thumb" aria-hidden="true"><div class="ts-thumb-nav"><i></i><i></i><i></i></div><div class="ts-thumb-page"><div class="ts-thumb-title"></div><div class="ts-thumb-line"></div><div class="ts-thumb-line short"></div><div class="ts-thumb-box"><i></i><i></i></div><div class="ts-thumb-line"></div></div></div><span class="ts-card-label"></span><span class="ts-card-description"></span><span class="ts-card-state"></span>';
            button.querySelector('.ts-card-label').textContent=p.name.split(' · ')[0];button.querySelector('.ts-card-description').textContent=descriptions[p.key];
            grid.append(button);
        }
        panel.addEventListener('click',event=>{
            const button=event.target.closest('button');if(!button)return;
            if(button.dataset.palette)select(button.dataset.palette,mode());
            else if(button.dataset.mode)select(current()?.key || 'paper',button.dataset.mode);
            else if(button.classList.contains('ts-native-toggle')){
                const show=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(show));
                button.textContent=show?'收起其他主题':'其他主题';themeRow.classList.toggle('ts-native-visible',show);modeRow?.classList.toggle('ts-native-visible',show);
            }
        });
        row.before(panel);themeRow.classList.add('ts-native-theme-row');modeRow?.classList.add('ts-native-theme-row');refresh();
    }
    function schedule(){if(!scheduled&&!disposed){scheduled=true;requestAnimationFrame(mount);}}
    // Ignore mutations created by our own card refresh to avoid observer loops.
    const observer=new MutationObserver(records=>{
        if(records.every(record=>panel?.contains(record.target)))return;
        schedule();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    const themeObserver=new MutationObserver(refresh);themeObserver.observe(document.body,{attributes:true,attributeFilter:['data-theme-id','class']});
    schedule();
    return {dispose(){disposed=true;observer.disconnect();themeObserver.disconnect();panel?.remove();themeRow?.classList.remove('ts-native-theme-row','ts-native-visible');modeRow?.classList.remove('ts-native-theme-row','ts-native-visible');if(window.TriliumThemeCards===this)delete window.TriliumThemeCards;}};
}
