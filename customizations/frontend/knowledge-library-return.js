// Native sublibrary roots are aliases of the same workspace; no entry page.
const libraries=await api.runOnBackend(()=>api.getNote('KbHubHome001').getChildNotes()
    .filter(n=>!n.isDeleted&&!n.isProtected&&['text','render','book'].includes(n.type)&&!n.hasLabel('homeInternal')&&n.noteId!=='KbWikiFolder1')
    .map(n=>({id:n.noteId,title:n.title})));
module.exports=class extends api.BasicWidget{
    static get parentWidget(){return 'left-pane';}
    get position(){return 6;}
    doRender(){
        this.$widget=$('<div hidden></div>');this.contentSized();
        let routing=false,disposed=false;
        this.router={open:async id=>{
            if(disposed||routing||!libraries.some(l=>l.id===id))return;
            routing=true;
            try{sessionStorage.setItem('trilium.knowledge.active-library',id);window.dispatchEvent(new CustomEvent('trilium-workspace-select',{detail:{libraryId:id}}));await api.activateNote('KbHubHome001');}
            catch(e){api.showMessage(e.message || String(e));}finally{routing=false;}
        },dispose(){disposed=true;}};
        window.TriliumKnowledgeWorkspaceRouter=this.router;
        this.frame=requestAnimationFrame(()=>this.check());
    }
    check(){let context;try{context=api.getActiveContext();}catch(error){if(error.message==='No active context found')return;throw error;}const id=context?.note?.noteId || context?.noteId;if(libraries.some(l=>l.id===id))this.router?.open(id);}
    activeContextChangedEvent(){this.check();}
    noteSwitchedEvent(){this.check();}
    cleanup(){cancelAnimationFrame(this.frame);this.router?.dispose();if(window.TriliumKnowledgeWorkspaceRouter===this.router)delete window.TriliumKnowledgeWorkspaceRouter;}
};
