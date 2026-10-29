import {useEffect,useRef,useState} from 'trilium:preact';

const HARDWARE_ROOT='e3e7d52e13a9';
const trimTitle=title=>title.replace(/^\d+\s*/,'');
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Optional local preferences. */}};
const categories=['全部专题','基础电路','接口与嵌入式','PCB 与测试','进阶课程','待分类'];
function category(title){return /^99/.test(title)?'待分类':/^30|^40/.test(title)?'进阶课程':/PCB|EMC|ESD|测试/.test(title)?'PCB 与测试':/接口|MCU|FPGA|存储/.test(title)?'接口与嵌入式':'基础电路';}
function presentation(title){
    if(/模拟集成/.test(title))return ['bx bx-chip','晶体管级设计、偏置与数据转换','violet'];
    if(/微传感/.test(title))return ['bx bx-radar','微加工、机械与机电建模','violet'];
    if(/模拟电路/.test(title))return ['bx bx-pulse','元器件、放大器与电源设计','green'];
    if(/数字电路/.test(title))return ['bx bx-chip','逻辑、时序、电平与存储','blue'];
    if(/通信/.test(title))return ['bx bx-transfer-alt','常用总线与通信协议','blue'];
    if(/PCB/.test(title))return ['bx bx-layer','布局布线、信号完整性与制造','amber'];
    if(/EMC|ESD/.test(title))return ['bx bx-shield-quarter','电磁兼容、抗扰与静电防护','amber'];
    if(/测试|信号/.test(title))return ['bx bx-line-chart','测量方法与信号分析','amber'];
    if(/MCU|FPGA/.test(title))return ['bx bx-microchip','嵌入式与可编程逻辑','blue'];
    if(/接口|存储/.test(title))return ['bx bx-data','高速链路与存储系统','blue'];
    if(/待分类/.test(title))return ['bx bx-inbox','暂存资料，逐步归入专题','neutral'];
    return ['bx bx-network-chart','基础方法、原理与工程应用','green'];
}
function updated(value){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric'});}

export default function LibraryBrowser({rootId=HARDWARE_ROOT,tools=null}){
    const ROOT=rootId,FAVORITES='myosotis.hardware.favorites.'+ROOT,HISTORY='myosotis.hardware.history.'+ROOT,STATE='trilium.library.browser.'+ROOT;
    const remembered=read(STATE,{}),rootRef=useRef(null),restored=useRef(false),dataRef=useRef(null);
    const searchRef=useRef(null),searchOpen=useRef(null),[experience,setExperience]=useState(()=>window.TriliumNoteExperience || null);
    useEffect(()=>{const update=()=>setExperience(window.TriliumNoteExperience || null);window.addEventListener('trilium-note-experience-changed',update);return()=>window.removeEventListener('trilium-note-experience-changed',update);},[]);

    const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
    const [query,setQuery]=useState(()=>String(remembered.query || '')),[filter,setFilter]=useState(()=>categories.includes(remembered.filter)?remembered.filter:'全部专题'),[view,setView]=useState(()=>['topics','notes','favorites'].includes(remembered.view)?remembered.view:'topics'),[folder,setFolder]=useState(()=>remembered.folder || null),[preview,setPreview]=useState(null),[limit,setLimit]=useState(40);
    const [favorites,setFavorites]=useState(()=>{const value=read(FAVORITES,[]);return Array.isArray(value)?value:[];});
    const [history,setHistory]=useState(()=>{const value=read(HISTORY,{});return value && !Array.isArray(value) && typeof value==='object'?value:{};});
    async function load(){const service=await api.getNote('MyoHardwareSvc');if(!service)throw new Error('知识库首页组件未安装');return api.runOnBackend(await service.getContent(),[ROOT]);}
    useEffect(()=>{let alive=true;load().then(result=>{if(alive){setData(result);if(remembered.folder&&!result.notes.some(n=>n.id===remembered.folder))setFolder(null);}}).catch(e=>{if(alive)setError(e.message || String(e));});return()=>{alive=false;};},[]);
    async function refresh(){setBusy(true);try{setData(await load());setError('');}catch(e){setError(e.message || String(e));}finally{setBusy(false);}}
    const notes=data?.notes || [],topics=data?.topics || [],byId=new Map(notes.map(n=>[n.id,n])),topicById=new Map(topics.map(t=>[t.id,t]));
    dataRef.current=data;
    const reading=read('myosotis-reading-positions-v1',{});
    const recent=notes.filter(n=>n.hasContent || history[n.id] || reading?.[n.id]?.time).map(n=>({...n,readAt:Math.max(Number(history[n.id]) || 0,Number(reading?.[n.id]?.time) || 0)})).filter(n=>n.readAt).sort((a,b)=>b.readAt-a.readAt).slice(0,4);
    const changed=notes.filter(n=>n.hasContent && !topics.some(t=>t.id===n.id)).sort((a,b)=>b.updated.localeCompare(a.updated)).slice(0,5);
    const resume=recent[0];
    function resetScroll(){save(STATE,{...read(STATE,{}),scroll:0});rootRef.current?.closest('.scrolling-container')?.scrollTo({top:0,behavior:'instant'});}
    async function open(note){
        save(STATE,{...read(STATE,{}),scroll:rootRef.current?.closest('.scrolling-container')?.scrollTop || 0});setError('');
        try{await api.activateNote(note.id);const next={...history,[note.id]:Date.now()};save(HISTORY,next);setHistory(next);}
        catch(e){setError('无法打开笔记：'+(e.message || e));}
    }
    searchOpen.current=open;
    function favorite(id){const next=favorites.includes(id)?favorites.filter(n=>n!==id):[...favorites,id];setFavorites(next);save(FAVORITES,next);}
    function browse(id){resetScroll();setFilter('全部专题');setFolder(id);setQuery('');setView('topics');setPreview(null);setLimit(40);}
    function changeView(next){resetScroll();setView(next);setFolder(null);setQuery('');setPreview(null);setLimit(40);}
    function up(){if(!activeFolder)return;resetScroll();setFolder(activeFolder.parentId===ROOT?null:activeFolder.parentId);setQuery('');setPreview(null);}
    useEffect(()=>{
        let alive=true,dirty=false,timer,running=false;
        function schedule(){clearTimeout(timer);timer=setTimeout(reload,180);}
        async function reload(){
            if(!alive||running||!dirty||!rootRef.current?.getClientRects().length)return;
            dirty=false;running=true;
            try{
                const next=await load();if(!alive)return;
                const previous=dataRef.current,valid=new Set(next.notes.map(n=>n.id));
                setData(next);setError('');
                setFolder(current=>{let id=current;const visited=new Set();while(id&&id!==ROOT&&!valid.has(id)&&!visited.has(id)){visited.add(id);id=previous?.notes.find(n=>n.id===id)?.parentId;}return id===ROOT||!valid.has(id)?null:id;});
            }catch(e){if(alive)setError(e.message || String(e));}
            finally{running=false;if(alive&&dirty)schedule();}
        }
        const update=e=>{if(e.detail.rootId!==ROOT)return;clearTimeout(timer);dirty=true;reload();};
        const changed=e=>{const known=new Set([ROOT,...(dataRef.current?.notes || []).map(n=>n.id)]);if(!e.detail.ids.some(id=>known.has(id)))return;dirty=true;schedule();};
        const activated=()=>{if(dirty)schedule();};
        window.addEventListener('trilium-knowledge-updated',update);
        window.addEventListener('trilium-knowledge-source-changed',changed);
        window.addEventListener('trilium-knowledge-activated',activated);
        return()=>{alive=false;clearTimeout(timer);window.removeEventListener('trilium-knowledge-updated',update);window.removeEventListener('trilium-knowledge-source-changed',changed);window.removeEventListener('trilium-knowledge-activated',activated);};
    },[]);
    useEffect(()=>{save(STATE,{...read(STATE,{}),folder,view,query,filter});},[folder,view,query,filter]);
    useEffect(()=>{if(!data||restored.current)return;restored.current=true;const scroller=rootRef.current?.closest('.scrolling-container');if(!scroller)return;const frame=requestAnimationFrame(()=>{scroller.scrollTop=Number(remembered.scroll)||0;});let timer;const remember=()=>{clearTimeout(timer);timer=setTimeout(()=>save(STATE,{...read(STATE,{}),scroll:scroller.scrollTop}),120);};scroller.addEventListener('scroll',remember,{passive:true});return()=>{cancelAnimationFrame(frame);clearTimeout(timer);scroller.removeEventListener('scroll',remember);};},[!!data]);
    const activeFolder=byId.get(folder);
    const text=query.trim().toLocaleLowerCase();
    const visibleTopics=topics.filter(t=>filter==='全部专题' || category(t.title)===filter);
    const resultMode=!!text || view!=='topics';
    const results=notes.filter(n=>{
        if(filter!=='全部专题' && category(topicById.get(n.topicId)?.title || '')!==filter)return false;
        if(view==='favorites' && !favorites.includes(n.id))return false;
        if(folder && n.id!==folder && n.topicId!==activeFolder?.topicId)return false;
        return !text || [n.title,...n.path,n.excerpt].join(' ').toLocaleLowerCase().includes(text);
    }).sort((a,b)=>Number(b.hasContent)-Number(a.hasContent) || a.title.localeCompare(b.title,'zh-CN'));
    const children=(activeFolder?.children || []).map(id=>byId.get(id)).filter(Boolean);
    const showNote=byId.get(preview);
    const enhancedSearch=!!text&&!!experience;
    useEffect(()=>{
        if(!enhancedSearch||!searchRef.current||!data)return;
        const allowed=notes.filter(n=>(filter==='全部专题'||category(topicById.get(n.topicId)?.title || '')===filter)&&(view!=='favorites'||favorites.includes(n.id)));
        return experience.mountSearch(searchRef.current,{rootId:ROOT,query,allowedIds:allowed.map(n=>n.id),onOpen:note=>searchOpen.current(note)});
    },[experience,query,ROOT,filter,view,data,favorites]);
    function star(note){return <button className={'hl-star'+(favorites.includes(note.id)?' is-saved':'')} aria-label={(favorites.includes(note.id)?'取消收藏 ':'收藏 ')+trimTitle(note.title)} aria-pressed={favorites.includes(note.id)} onClick={()=>favorite(note.id)}><i className={'bx '+(favorites.includes(note.id)?'bxs-star':'bx-star')} aria-hidden="true"/></button>;}
    function row(note){return <article key={note.id} data-kb-note={note.id} data-kb-parent={note.parentId} className="hl-row" onClick={e=>{if(!e.target.closest('button,a,input'))note.children.length?browse(note.id):open(note);}} onMouseEnter={()=>setPreview(note.id)} onFocusIn={()=>setPreview(note.id)}>
        <span className="hl-row-icon"><i className={'bx '+(note.children.length?'bx-folder':'bx-file')} aria-hidden="true"/></span>
        <button className="hl-row-link" onClick={()=>note.children.length?browse(note.id):open(note)}><b>{trimTitle(note.title)}</b><small>{note.path.map(trimTitle).join(' / ') || trimTitle(topicById.get(note.topicId)?.title || '')}</small></button>
        <span className="hl-row-meta">{note.children.length?note.children.length+' 个子项':note.hasContent?'笔记':'待完善'}</span>{note.children.length>0 && <button type="button" className="hl-source" aria-label={'打开原文 '+trimTitle(note.title)} onClick={()=>open(note)}>打开原文</button>}{star(note)}
        <button className="hl-open" data-kb-menu aria-label={'更多操作 '+trimTitle(note.title)} title="更多操作（也可右键）"><i className="bx bx-dots-horizontal-rounded" aria-hidden="true"/></button>
    </article>;}
    // Primary: browse cards; secondary: resume/search; tertiary: metadata (§2.1).
    return <section ref={rootRef} className="hardware-library library-browser" data-kb-root={ROOT} data-library={ROOT}>
        <div className="hl-summary"><span>{topics.length} 个专题 <b>·</b> {notes.filter(n=>n.hasContent).length} 篇已记录</span>{resume && <button className="hl-continue" onClick={()=>open(resume)}>继续阅读：{trimTitle(resume.title)} <i className="bx bx-right-arrow-alt"/></button>}<button className="hl-refresh" disabled={busy} onClick={refresh} aria-label="刷新知识库" title="刷新知识库"><i className={'bx bx-refresh'+(busy?' hl-spinning':'')}/></button></div>
        <div className="hl-toolbar"><nav aria-label="知识库视图">{[['topics','专题导航'],['notes','全部笔记'],['favorites','我的收藏']].map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>changeView(id)}>{label}{id==='favorites' && <span>{favorites.filter(id=>byId.has(id)).length}</span>}</button>)}</nav>{tools}<label className="hl-search"><i className="bx bx-search" aria-hidden="true"/><input type="search" aria-label="搜索知识库" placeholder="查找知识点、章节或关键词…" value={query} onInput={e=>{setQuery(e.target.value);setLimit(40);}}/></label></div>
        {ROOT===HARDWARE_ROOT && <div className="hl-filters" aria-label="专题分类">{categories.map(name=><button key={name} aria-pressed={filter===name} onClick={()=>{setFilter(name);setFolder(null);setPreview(null);setLimit(40);}}>{name}</button>)}</div>}
        {error && <p className="hl-error" role="alert">{error}<button onClick={refresh}>重试</button></p>}
        {!data && !error && <p className="hl-empty" role="status">正在整理知识库目录…</p>}
        {data?.unavailable && <p className="hl-empty">尚未连接硬件知识库，请先在 Trilium 中安装或恢复原知识库。</p>}
        {data && !data.unavailable && <div className="hl-layout"><section className="hl-content">
            {enhancedSearch?<div ref={searchRef} className="nx-search" aria-label="全文搜索结果"/>:resultMode?<><div className="hl-section-heading"><h2>{text?'搜索结果':view==='favorites'?'我的收藏':'全部笔记'}</h2><span>{results.length} 项</span></div>{results.slice(0,limit).map(row)}{!results.length && <p className="hl-empty">{view==='favorites' && !text?'点击卡片或笔记旁的星标，收藏常用知识。':'没有匹配内容，试试其他关键词或分类。'}</p>}{results.length>limit && <button className="hl-more" onClick={()=>setLimit(limit+40)}>再显示 40 项</button>}</>
            :activeFolder?<><nav className="hl-breadcrumb" aria-label="章节位置"><button onClick={()=>browse(null)}>{data.title}</button>{(activeFolder.pathIds || []).map(id=>{const parent=byId.get(id);return parent && <span key={id}> / <button onClick={()=>browse(id)}>{trimTitle(parent.title)}</button></span>;})}<span>/</span><b>{trimTitle(activeFolder.title)}</b></nav><div className="hl-section-heading"><div className="hl-folder-heading"><button className="hl-up" onClick={up} aria-label="返回上一级" title="返回上一级"><i className="bx bx-arrow-back"/></button><h2>{trimTitle(activeFolder.title)}</h2></div><div className="hl-folder-actions"><button type="button" className="hl-source" aria-label={'打开原文 '+trimTitle(activeFolder.title)} onClick={()=>open(activeFolder)}>打开原文</button><button className="hl-create" data-kb-create={folder} data-kb-parent={activeFolder.parentId}>＋ 新建子笔记</button><button data-kb-note={folder} data-kb-parent={activeFolder.parentId} data-kb-menu aria-label="当前章节更多操作"><i className="bx bx-dots-horizontal-rounded"/></button></div></div>{activeFolder.excerpt && <p className="hl-intro">{activeFolder.excerpt}</p>}{children.map(row)}{!children.length && <p className="hl-empty">这个专题还没有子笔记。可打开原笔记，继续整理内容。</p>}</>
            :<><div className="hl-section-heading"><h2>专题 <small>{visibleTopics.length}</small></h2><button className="hl-create" data-kb-create={ROOT}>＋ 新增专题</button></div><div className="hl-topic-grid">{visibleTopics.map(t=>{const [icon,description,tone]=ROOT===HARDWARE_ROOT?presentation(t.title):['bx bx-book-open','浏览子主题与笔记','neutral'];return <article className={'hl-topic hl-tone-'+tone} key={t.id} data-kb-note={t.id} data-kb-parent={ROOT} onClick={e=>{if(!e.target.closest('button,a,input'))browse(t.id);}} onMouseEnter={()=>setPreview(t.id)} onFocusIn={()=>setPreview(t.id)}><header><span className="hl-topic-icon"><i className={t.icon || icon} aria-hidden="true"/></span>{star(t)}</header><button className="hl-topic-title" aria-label={'浏览 '+trimTitle(t.title)} onClick={()=>browse(t.id)}><h3>{trimTitle(t.title)}</h3></button><p>{t.excerpt || description}</p><div className="hl-topic-preview">{t.children.slice(0,2).map(id=><button key={id} onClick={()=>byId.get(id)?.children.length?browse(id):open(byId.get(id))}>{trimTitle(byId.get(id)?.title || '')}</button>)}</div><footer><span>{t.count?t.count+' 个知识页':'待整理'}{t.written>0 && <small> · {t.written} 篇已记录</small>}</span><button data-kb-menu aria-label={'更多操作 '+trimTitle(t.title)} title="更多操作（也可右键）"><i className="bx bx-dots-horizontal-rounded" aria-hidden="true"/></button></footer></article>;})}</div></>}
        </section><aside className="hl-aside"><section className="hl-preview" aria-live="polite"><div className="hl-aside-heading"><i className="bx bx-book-open" aria-hidden="true"/><h2>知识点预览</h2></div>{showNote?<><small>{showNote.path.map(trimTitle).join(' / ') || '专题'}</small><h3>{trimTitle(showNote.title)}</h3><p>{showNote.excerpt || (showNote.children.length?'包含 '+showNote.children.length+' 个子项，进入章节查看。':'这篇笔记还没有正文内容。')}</p><button onClick={()=>open(showNote)}>打开笔记 <i className="bx bx-right-arrow-alt" aria-hidden="true"/></button></>:<p className="hl-preview-hint">悬停或聚焦一个专题、知识点，即可在这里预览内容。</p>}</section>
            <section className="hl-recent"><div className="hl-aside-heading"><i className="bx bx-history" aria-hidden="true"/><h2>{recent.length?'最近阅读':'最近更新'}</h2></div>{(recent.length?recent:changed).map(n=><button key={n.id} onClick={()=>open(n)}><span>{trimTitle(n.title)}</span><small>{updated(n.readAt || n.updated)}</small></button>)}{!recent.length && !changed.length && <p className="hl-preview-hint">有内容的笔记会出现在这里。</p>}</section>
            {ROOT===HARDWARE_ROOT && <section className="hl-map-link"><i className="bx bx-network-chart" aria-hidden="true"/><div><h3>换个角度看知识</h3><p>探索知识之间的联系</p></div><button aria-label="打开硬件知识图谱" onClick={()=>open({id:'tPEhNqMKFiVJ'})}><i className="bx bx-right-arrow-alt" aria-hidden="true"/></button></section>}
        </aside></div>}
    </section>;
}
