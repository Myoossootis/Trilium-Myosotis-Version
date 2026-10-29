// Optional startup check: never uploads or restores without a user's confirmation.
module.exports=class extends api.BasicWidget{
 static get parentWidget(){return 'left-pane';}
 get position(){return 8;}
 doRender(){this.$widget=$('<div hidden></div>');this.contentSized();let disposed=false;this.disposeSync=()=>{disposed=true;};this.timer=setTimeout(async()=>{try{
  const source=await(await api.getNote('GhSyncSvc001')).getContent(),call=(action,payload={})=>api.runAsyncOnBackendWithManualTransactionHandling(source,[action,payload]);
  const state=await call('load');if(disposed||!state.config.autoSync||!state.config.repository)return;
  const {id}=await call('begin',{operation:'check'});let plan;
  while(!disposed){await new Promise(r=>setTimeout(r,1000));const job=await call('job',{id});if(!job.running){if(job.error)throw Error(job.error);plan=job.result;break;}}
  if(disposed||!plan?.changes.length)return;
  window.TriliumGitSyncPlan=plan;window.dispatchEvent(new Event('trilium-github-sync-plan'));await api.activateNote('GhSyncView01');
 }catch(e){if(!disposed)api.showError('GitHub 启动同步检查：'+e.message);}},1800);}
 cleanup(){clearTimeout(this.timer);this.disposeSync?.();}
};
