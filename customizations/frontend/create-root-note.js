/* The main New Note launcher creates an unfiled note directly under root. */
await api.triggerCommand('hoistNote',{noteId:'root'});
await api.createNote('root',{title:'新建笔记',type:'text',content:'',activate:true});
