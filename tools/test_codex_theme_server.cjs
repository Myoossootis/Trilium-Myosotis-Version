// Run the shipped Trilium theme loader with small options/server adapters.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
module.exports=async root=>{
    const server=http.createServer((request,response)=>{
        const url=new URL(request.url,'http://localhost');
        let source,mime='text/javascript';
        if(url.pathname.endsWith('/theme-preview-native.js')){
            source=fs.readFileSync(path.join(root,'trilium-asar-work-20260915/public/src/theme-BNdlKxow.js'),'utf8')
                .replaceAll('./preload-helper-HclGiUj8.js','./theme-preview-preload.js')
                .replaceAll('./options-CT-4Y9U_.js','./options-preview-native.js')
                .replaceAll('./server-CtP3lGKO.js','./theme-preview-server.js')
                .replaceAll('./app_context-CPsnWTCA.js','./theme-preview-context.js');
        }else if(url.pathname.endsWith('/options-preview-native.js'))source='let value="codex-ui-dark";export default {initializedPromise:Promise.resolve(),get(){return value;},async save(name,v){if(window.failThemeSave){window.failThemeSave=false;throw Error("模拟保存失败");}value=v;localStorage.setItem("theme-preview",v);}}';
        else if(url.pathname.endsWith('/theme-preview-preload.js'))source='export const t=fn=>fn();';
        else if(url.pathname.endsWith('/theme-preview-context.js'))source='export default {triggerEvent(){}}';
        else if(url.pathname.endsWith('/theme-preview-server.js'))source='export default {async get(){return [{val:"codex-ui",noteId:"MyoCodexUI01",appThemeBase:"next-light"},{val:"codex-ui-dark",noteId:"MyoCodexDark1",appThemeBase:"next-dark"}];}}';
        else {
            let relative=decodeURIComponent(url.pathname).replace(/^\//,'');
            if(relative==='tools/api/notes/download/MyoCodexUI01')relative='trilium-codex-ui.css';
            if(relative==='tools/api/notes/download/MyoCodexDark1')relative='trilium-codex-dark.css';
            const file=path.resolve(root,relative);
            if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
            source=fs.readFileSync(file);mime=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript';
        }
        response.setHeader('Content-Type',mime+'; charset=utf-8');response.end(source);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server;
};
