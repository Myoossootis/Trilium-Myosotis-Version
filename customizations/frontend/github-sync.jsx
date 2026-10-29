import {useEffect,useRef,useState} from 'trilium:preact';
let service;
async function syncCall(action,payload={}){
 if(!service)service=await(await api.getNote('GhSyncSvc001')).getContent();
 const call=(a,p)=>api.runAsyncOnBackendWithManualTransactionHandling(service,[a,p]);
 if(!['check','confirm'].includes(action))return call(action,payload);
 const {id}=await call('begin',{operation:action,input:payload});
 for(;;){await new Promise(r=>setTimeout(r,1000));const job=await call('job',{id});if(!job.running){if(job.error)throw Error(job.error);return job.result;}}
}
export default function(){
 const [config,setConfig]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[plan,setPlan]=useState(null),[selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[accepted,setAccepted]=useState(false),[direction,setDirection]=useState('upload'),[last,setLast]=useState(null),dialog=useRef(null),confirmDialog=useRef(null),ticket=useRef(0);
 useEffect(()=>{let alive=true;const receive=()=>{if(alive&&window.TriliumGitSyncPlan){setPlan(window.TriliumGitSyncPlan);delete window.TriliumGitSyncPlan;}};window.addEventListener('trilium-github-sync-plan',receive);syncCall('load').then(data=>{if(!alive)return;setConfig(data.config);setLast(data.lastResult);receive();}).catch(e=>alive&&setError(e.message));return()=>{alive=false;ticket.current++;window.removeEventListener('trilium-github-sync-plan',receive);};},[]);
 useEffect(()=>{if(plan?.changes.length&&!dialog.current?.open)dialog.current?.showModal();},[plan]);
 const [progress,setProgress]=useState(null);
 useEffect(()=>{if(!busy){setProgress(null);return;}let alive=true;const timer=setInterval(()=>syncCall('load').then(r=>{if(alive)setProgress(r.progress);}).catch(()=>{}),2000);return()=>{alive=false;clearInterval(timer);};},[busy]);
 async function run(job){if(busy)return;setBusy(true);setError('');try{await job();}catch(e){setError(e.message||String(e));}finally{setBusy(false);}}
 async function inspect(){await syncCall('saveConfig',config);const result=await syncCall('check');setPlan(result);setSelected(null);setDetail(null);if(!result.changes.length)setLast({ok:true,message:'两端笔记与设置一致，无需覆盖。'});}
 async function select(item){setSelected(item);setDetail(null);const serial=++ticket.current;try{const result=await syncCall('detail',{planId:plan.id,noteId:item.id});if(serial===ticket.current)setDetail(result);}catch(e){if(serial===ticket.current)setError(e.message);}}
 function ask(value){setDirection(value);setAccepted(false);confirmDialog.current.showModal();}
 async function apply(){await run(async()=>{const result=await syncCall('confirm',{planId:plan.id,direction});setLast(result);confirmDialog.current.close();dialog.current.close();setPlan(null);setDetail(null);});}
 const count=kind=>plan?.changes.filter(n=>n.kind===kind).length||0;
 return <main className="gs-app">
  <header><i className="bx bxl-github" aria-hidden="true"/><div><h1>GitHub 数据库同步</h1><p>私有仓库保存完整快照，确认差异后再覆盖。</p></div></header>
  {error&&<div className="gs-error" role="alert">{error}</div>}
  {busy&&<p role="status">{progress?.phase||'正在处理…'}{progress?.total?' · '+progress.done+' / '+progress.total:''}</p>}
  {config?<section className="gs-card">
   <label>个人 GitHub 仓库<input aria-label="GitHub 仓库" value={config.repository} placeholder="https://github.com/你的账号/你的私有仓库" onInput={e=>setConfig({...config,repository:e.target.value})}/></label>
   <label>Trilium 数据库位置<input aria-label="数据库位置" value={config.dbPath} onInput={e=>setConfig({...config,dbPath:e.target.value})}/></label>
   <label className="gs-check"><input type="checkbox" checked={config.autoSync} onChange={e=>setConfig({...config,autoSync:e.target.checked})}/>启动 Trilium 时自动检查同步差异</label>
   <p className="gs-help">有差异时会弹出确认，启动检查不会自动覆盖任何一端。登录沿用 GitHub CLI 的系统凭据；仓库地址、数据库位置和启动开关只保存在本机，不写入笔记数据库。</p>
   <div className="gs-actions"><button disabled={busy} onClick={()=>run(async()=>{const r=await syncCall('saveConfig',config);setConfig(r.config);setLast({ok:true,message:'设置已保存。'});})}>保存设置</button><button className="primary" disabled={busy} onClick={()=>run(inspect)}>{busy?'正在处理…':'手动同步 / 检查差异'}</button></div>
  </section>:<p>正在读取本机配置…</p>}
  <section className="gs-card"><h2>如何使用</h2><ol><li>首次登录：在终端运行 <code>gh auth login</code>，选择 GitHub.com、HTTPS 和浏览器登录。整合包附有登录工具。</li><li>填写私有仓库和数据库位置，点击“手动同步”。查看新增、修改、删除及原文对比。</li><li>选择用本地更新 GitHub，或用 GitHub 快照替换本机。完整快照不会自动合并两个版本的笔记。</li><li>恢复时先确认，再正常关闭 Trilium。退出后会再次核对、本地备份、恢复并重新打开；关闭前继续编辑会取消恢复。</li></ol></section>
  {last&&<div className={last.ok===false?'gs-error':'gs-result'} role="status">{last.message||(last.action==='upload'?'上传完成，提交 '+last.commit?.slice(0,10):last.action==='restore'?'已从远端恢复；原库备份：'+last.backup:'检查完成')}{last.time&&<small>{new Date(last.time).toLocaleString()}</small>}</div>}
  <dialog className="gs-diff" ref={dialog} onCancel={e=>{if(busy)e.preventDefault();}}>
   <header><div><h2>同步差异</h2><p>本地相对 GitHub：<b className="gs-added">+{count('added')} 新增</b> · <b>{count('modified')} 修改</b> · <b className="gs-deleted">−{count('deleted')} 删除</b></p></div><button aria-label="关闭差异" disabled={busy} onClick={()=>dialog.current.close()}>×</button></header>
   <p className="gs-help">选择左侧条目查看原文及属性。上传和恢复都会使用完整数据库快照；没有勾选逐条合并。</p>
   <div className="gs-compare"><nav aria-label="差异条目">{plan?.changes.map(item=><button key={item.id} aria-pressed={selected?.id===item.id} onClick={()=>select(item)}><span className={'gs-'+item.kind}>{item.kind==='added'?'+':item.kind==='deleted'?'−':'M'}</span><span>{item.title}<small>{item.id}</small></span></button>)}</nav><div className="gs-versions"><section><h3>GitHub 版本</h3><pre className="gs-before">{selected?detail?detail.remote??'（远端没有此条目）':'正在读取…':'请选择一个差异条目'}</pre></section><section><h3>本地版本</h3><pre className="gs-after">{selected?detail?detail.local??'（本地已删除此条目）':'正在读取…':'请选择一个差异条目'}</pre></section></div></div>
   {error&&<div className="gs-error" role="alert">{error}</div>}
   <footer><button disabled={busy} onClick={()=>dialog.current.close()}>稍后处理</button><span/><button disabled={busy||!plan?.hasRemote} onClick={()=>ask('restore')}>用 GitHub 版本替换本机</button><button className="primary" disabled={busy} onClick={()=>ask('upload')}>用本地版本更新 GitHub</button></footer>
  </dialog>
  <dialog className="gs-confirm" ref={confirmDialog} onCancel={e=>{if(busy)e.preventDefault();}}><h2>{direction==='upload'?'确认上传完整快照':'确认恢复完整数据库'}</h2><p>{direction==='upload'?'本地笔记不会修改。远端当前版本会更新，旧提交继续保留。':'本机全部笔记和设置将以远端快照为准。正常关闭后才执行替换，原数据库会完整备份；这不会逐条合并。'}</p><label className="gs-check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>我已核对差异，确认使用所选方向覆盖完整版本</label>{busy&&<p role="status">{progress?.phase||'正在处理…'}{progress?.total?' · '+progress.done+' / '+progress.total:''}</p>}{error&&<p className="gs-error">{error}</p>}<footer><button disabled={busy} onClick={()=>confirmDialog.current.close()}>取消</button><button className="primary" disabled={!accepted||busy} onClick={apply}>{busy?'正在执行…':direction==='upload'?'确认上传':'确认恢复，随后关闭 Trilium'}</button></footer></dialog>
 </main>;
}
