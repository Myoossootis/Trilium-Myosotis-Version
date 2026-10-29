/* Native launcher draws immediately; execute the theme action only when clicked. */
window.MyoCodexThemeToggle?.dispose();
const state=window.MyoCodexThemeSwitchState ||= {busy:false,nativePromise:null};
const button=document.querySelector('#launcher-pane .launcher-button.myo-day-night-icon');
const dark=()=>getComputedStyle(document.body).getPropertyValue('--theme-style').trim()==='dark';
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

async function switchTheme() {
    if(state.busy)return;
    state.busy=true;
    if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
    let native,previous,changed=false;
    try {
        native=await (state.nativePromise ||= nativeModules().catch(error=>{state.nativePromise=null;throw error;}));
        previous=native.options.get('theme');
        const current=document.body.getAttribute('data-theme-id') || previous;
        const studio=String(current).match(/^studio-(slate|forest|paper|ocean|mist)-(light|dark)$/);
        const target=studio?`studio-${studio[1]}-${dark()?'light':'dark'}`:dark()?'codex-ui':'codex-ui-dark';
        await native.options.save('theme',target);changed=true;
        await native.loadTheme();
        await waitForTheme(target);
    } catch(error) {
        if(changed)try{await native.options.save('theme',previous);await native.loadTheme();}catch(rollback){console.error('Codex theme rollback',rollback);}
        console.error('Codex theme switch',error);
        api.showMessage(`主题切换失败：${error.message}`);
    } finally {
        state.busy=false;
        if(button){button.disabled=false;button.removeAttribute('aria-busy');}
    }
}
await switchTheme();
