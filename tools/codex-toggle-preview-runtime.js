import options from './options-preview-native.js';
import {t as loadTheme} from './theme-preview-native.js';
window.glob={assetPath:'/trilium-asar-work-20260915/public',theme:'codex-ui-dark',themeBase:'next-dark',customThemeCssUrl:'/trilium-codex-dark.css'};
window.api={showMessage:message=>window.lastThemeError=message};
const actionSource=await (await fetch('../customizations/frontend/codex-theme-toggle.js')).text();
const action=new (Object.getPrototypeOf(async function(){}).constructor)('api',actionSource);
document.querySelector('.launcher-button.myo-day-night-icon').addEventListener('click',()=>action(window.api));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(test){for(let i=0;i<100;i++){if(test())return;await pause(50);}throw new Error('Theme test timed out');}
try {
    window.checkDarkTokens();
    const button=document.querySelector('.myo-day-night-icon');
    if(!button || !document.body.classList.contains('dark-theme'))throw new Error('Missing initial dark switch');
    button.click();button.click();
    await until(()=>!button.disabled && options.get('theme')==='codex-ui');
    if(getComputedStyle(document.body).getPropertyValue('--theme-style').trim()!=='light')throw new Error('Native light stylesheet not loaded');
    if(localStorage.getItem('theme-preview')!=='codex-ui')throw new Error('Theme not persisted');
    button.click();await until(()=>!button.disabled && options.get('theme')==='codex-ui-dark');
    if(getComputedStyle(document.body).getPropertyValue('--theme-style').trim()!=='dark')throw new Error('Native dark stylesheet not loaded');
    window.failThemeSave=true;button.click();await until(()=>!button.disabled && window.lastThemeError);
    if(options.get('theme')!=='codex-ui-dark' || !document.body.classList.contains('dark-theme'))throw new Error('Failed save lost current theme');
    // External Appearance changes must update the shortcut, too.
    await options.save('theme','codex-ui');await loadTheme();await until(()=>document.body.classList.contains('light-theme'));
    button.focus();
    await options.save('theme','codex-ui-dark');await loadTheme();await until(()=>document.body.classList.contains('dark-theme'));
    if(document.querySelectorAll('.myo-day-night-icon').length!==1)throw new Error('Duplicate shortcut');
    document.querySelector('#result').textContent='PASS: native stylesheet switching, persistence, repeat clicks, save failure and external theme sync';
} catch(error){document.querySelector('#result').textContent='FAIL: '+error.message;}
