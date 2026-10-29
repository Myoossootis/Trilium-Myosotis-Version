// Always available management infrastructure; feature packages remain optional.
const initialModules=await api.runOnBackend(()=>JSON.parse(api.getNote('MyoMarketData').getContent()).plugins);
module.exports=class extends api.BasicWidget{
    static get parentWidget(){return 'left-pane';}
    get position(){return 0;}
    doRender(){
        this.$widget=$('<div hidden></div>');this.contentSized();
        let modules=initialModules,disposed=false,generation=0;
        const state={enabled:id=>modules.find(p=>p.id===id)?.enabled!==false,available:noteId=>{const owner=modules.find(p=>p.componentIds?.includes(noteId)||p.entries?.includes(noteId));return owner?.enabled!==false;},
            refresh:async()=>{const request=++generation;const next=await api.runOnBackend(()=>JSON.parse(api.getNote('MyoMarketData').getContent()).plugins);if(disposed||request!==generation)return;modules=next;window.dispatchEvent(new Event('trilium-modules-changed'));},
            dispose:()=>{disposed=true;if(window.TriliumModules===state)delete window.TriliumModules;}};
        this.controller=state;window.TriliumModules=state;
    }
    entitiesReloadedEvent({loadResults}){if(loadResults.isNoteContentReloaded('MyoMarketData'))this.controller?.refresh().catch(e=>console.warn('Plugin states unavailable',e.message));}
    cleanup(){this.controller?.dispose();}
};
