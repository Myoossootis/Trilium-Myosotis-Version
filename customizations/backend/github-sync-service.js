async function githubDatabaseSyncService(action,payload={}){
    if(api.getNote('MyoMarketData')?.getJsonContent()?.plugins.find(p=>p.id==='GhSyncRoot01')?.enabled===false)throw Error('GitHub 数据库同步插件已关闭。');
    const require=process.mainModule.require.bind(process.mainModule),path=require('path');
    const source=api.getNote('GhSyncEngine1').getContent(),workerSource=api.getNote('GhSyncRestore1').getContent();
    const module={exports:{}};new Function('require','module','exports',source)(require,module,module.exports);
    const resourceDir=process.resourcesPath||path.join(path.dirname(process.execPath),'resources');
    const Database=require(path.join(resourceDir,'app.asar','node_modules','better-sqlite3'));
    const dataDir=api.getAppInfo().dataDirectory;
    const engine=new module.exports.SyncEngine({Database,activeDbPath:path.join(dataDir,'document.db'),storeDir:path.join(dataDir,'myosotis-github-sync'),modulePath:path.join(resourceDir,'app.asar','package.json'),engineSource:source,workerSource});
    // Large snapshots outlive Electron's HTTP request timeout. Keep the task in
    // the backend process and let the UI poll short requests for its result.
    const fs=require('fs'),jobFile=path.join(engine.dir,'background-job.json');
    if(action==='begin'){
        if(!['check','confirm'].includes(payload.operation))throw Error('不支持的后台同步操作。');
        const id=require('crypto').randomUUID();
        fs.mkdirSync(engine.dir,{recursive:true});
        let previous;try{previous=JSON.parse(fs.readFileSync(jobFile,'utf8'));}catch{}
        if(previous?.running&&previous.pid===process.pid)throw Error('已有同步任务正在执行，请稍后查看结果。');
        const write=result=>{const tmp=jobFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify({id,pid:process.pid,...result}),{mode:0o600});fs.renameSync(tmp,jobFile);};
        write({running:true});
        setTimeout(()=>engine.handle(payload.operation,payload.input||{}).then(result=>write({running:false,result})).catch(error=>write({running:false,error:error.message})),0);
        return {id};
    }
    if(action==='job'){
        let job;try{job=JSON.parse(fs.readFileSync(jobFile,'utf8'));}catch{throw Error('同步任务记录不存在，请重新检查。');}
        if(job.id!==payload.id)throw Error('同步任务已更换，请重新打开同步页面。');
        if(job.running&&job.pid!==process.pid)throw Error('上次同步已中断，请重新检查差异。');
        return job;
    }
    return engine.handle(action,payload);
}
