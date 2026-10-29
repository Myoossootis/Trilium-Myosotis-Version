import { useEffect, useState, useRef } from 'trilium:preact';

const pages = {
    quests: { label: '委托', title: '委托中心', subtitle: '完成学习委托，把努力变成可积累的奖励。' },
    shop: { label: '商店', title: '奖励商店', subtitle: '用完成委托获得的金币，兑换期待的奖励。' },
    warehouse: { label: '仓库', title: '我的仓库', subtitle: '收藏努力换来的道具，在需要时使用。' }
};

const cycles = {once:'一次性',repeat:'重复任务',daily:'每日',weekly:'每周一次',weeklyMultiple:'每周多次'};
const cycleDescription = task => task.recurrence === 'repeat' ? `今日完成 ${task.periodCount} 次 · 可继续完成` : task.recurrence === 'daily' ? `今日 ${task.periodCount} / 1` : ['weekly','weeklyMultiple'].includes(task.recurrence) ? `本周 ${task.periodCount} / ${task.target}` : '完成一次后结束';
const blank = () => ({ title: '', description: '', category:'', recurrence:'once',weeklyTarget:3,importance:1,urgency:1,coins: 30, xp:30, skill:'', itemName: '', itemQuantity: 1, noteLink: '' });
// Lv.1 starts at zero; next level costs 100 × current level experience.
const experienceLevel = xp => {const level=Math.floor((1+Math.sqrt(1+8*xp/100))/2);const start=50*level*(level-1);return {level,progress:xp-start,next:100*level};};
const engineerRanks = [{level:1,title:'小白'},{level:2,title:'菜鸟'},{level:3,title:'蒟蒻'},{level:5,title:'电子学徒'},{level:8,title:'工程实习生'},{level:12,title:'助理工程师'},{level:16,title:'初级工程师'},{level:20,title:'工程师'},{level:25,title:'高级工程师'},{level:30,title:'资深工程师'}];
const engineerRank = level => ({current:engineerRanks.filter(rank=>rank.level<=level).at(-1),next:engineerRanks.find(rank=>rank.level>level)});
const when = iso => new Date(iso).toLocaleString('zh-CN', { hour12: false });
const eventLabel = kind => ({ complete: '完成委托', undo: '撤销完成', purchase: '购买入库', use: '使用道具', effect:'使用效果', discard:'删除商品及库存' }[kind] || '历史记录');
const effectNames = {xp:'经验值',item:'道具增减',coins:'金币',craft:'合成',chest:'开箱'};
const newEffect = type => ['xp','coins'].includes(type) ? {type,min:0,max:0,skill:''} : {type,items:[{name:'',quantity:1,weight:1}]};
const newProduct = () => ({name:'',description:'',category:'道具',price:10,iconClass:'bx bx-gift',stock:null,useMode:'none',useLabelChoice:'使用',useLabel:'使用',effects:[],purchaseLimit:null,useLimit:null});
const editProduct = item => ({...item, useLabelChoice:['使用','兑换'].includes(item.useLabel)?item.useLabel:'custom', purchaseDisabled:false, stock:item.stock ?? (item.purchaseLimit?.period === 'total' ? item.purchaseLimit.count : null), purchaseLimit:item.purchaseLimit?.period === 'total' ? null : (item.purchaseLimit || (item.purchaseDisabled ? {period:'disabled'} : null))});
let nativePickerPromise;
async function loadTriliumIconPicker() {
    if (api.preact?.IconPicker) return api.preact.IconPicker;
    if (!nativePickerPromise) nativePickerPromise = (async()=>{
        // Resolve the installed build's native component, without hardcoding Vite hashes.
        const resources = [...performance.getEntriesByType('resource').map(entry=>entry.name),
            ...Array.from(document.querySelectorAll('script[src],link[href]'),node=>node.src || node.href)];
        let moduleUrl = resources.find(url=>/\/IconPicker-[^/]+\.js(?:\?|$)/.test(url));
        let cssUrl = resources.find(url=>/\/IconPicker-[^/]+\.css(?:\?|$)/.test(url));
        if (!moduleUrl) {
            const entries = resources.filter(url=>/\/(?:desktop|mobile|layout_commons)-[^/]+\.js(?:\?|$)/.test(url));
            for (const entry of [...new Set(entries)]) {
                const url = new URL(entry,document.baseURI);
                if (url.origin !== location.origin) continue;
                const response = await fetch(url);
                if (!response.ok) continue;
                const source = await response.text();
                const modulePath = source.match(/["'`]([^"'`]*IconPicker-[^"'`/]+\.js)["'`]/)?.[1];
                const cssPath = source.match(/["'`]([^"'`]*IconPicker-[^"'`/]+\.css)["'`]/)?.[1];
                if (modulePath) { moduleUrl=new URL(modulePath,url).href; if(cssPath)cssUrl=new URL(cssPath,url).href; break; }
            }
        }
        if (!moduleUrl) throw new Error('未找到 Trilium 原生图标选择器，请重新打开人升');
        if (cssUrl && !Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link=>link.href===cssUrl)) {
            const link=document.createElement('link');link.rel='stylesheet';link.href=cssUrl;document.head.appendChild(link);
        }
        // Render-note compilation rewrites import expressions into note lookups.
        // A browser-created function keeps this import in the native ESM loader.
        const importNativeModule = new Function('url', 'return import(url)');
        const module = await importNativeModule(moduleUrl);
        const component = module.IconPicker || module.default || module.t;
        if (typeof component !== 'function') throw new Error('此版本 Trilium 图标选择器接口不兼容');
        return component;
    })().catch(error=>{nativePickerPromise=null;throw error;});
    return nativePickerPromise;
}
function ProductIconPicker({icon,onChange,disabled,loadPicker}) {
    const [Picker,setPicker]=useState(null);
    const [error,setError]=useState('');
    useEffect(()=>{
        let alive=true;
        loadPicker().then(component=>{if(alive)setPicker(()=>component);}).catch(failure=>{if(alive)setError(failure.message || String(failure));});
        return ()=>{alive=false;};
    },[loadPicker]);
    return <div className="mq-product-icon-field"><span>商品图标</span><div className="mq-actions">{Picker?<Picker icon={icon || 'bx bx-gift'} title="选择商品图标" disabled={disabled} onSelect={onChange} onReset={()=>onChange('bx bx-gift')} resetText="重置商品图标"/>:<i className={'tn-icon mq-product-icon '+(icon || 'bx bx-gift')} aria-hidden="true"/>}<small>{error || (Picker?'点击图标选择 · 使用 Trilium 图标库':'正在加载图标选择器…')}</small></div>{error && <p role="alert" className="mq-error">{error}</p>}</div>;
}
function EffectItemPicker({name,names,products,disabled,onChange}) {
    const [open,setOpen]=useState(false),[preview,setPreview]=useState('');
    const root=useRef(null),trigger=useRef(null);
    const icon=value=>products.find(product=>product.name===value)?.iconClass || 'bx bx-gift';
    useEffect(()=>{
        if(!open)return;
        const close=event=>{if(!root.current?.contains(event.target))setOpen(false);};
        document.addEventListener('pointerdown',close);
        return ()=>document.removeEventListener('pointerdown',close);
    },[open]);
    return <div className="mq-item-chooser" ref={root} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);trigger.current?.focus();}}}>
        <button type="button" ref={trigger} className="mq-item-trigger" aria-label={name?`选择开箱道具：${name}`:'选择开箱道具'} title={name || '选择道具'} aria-expanded={open} disabled={disabled} onClick={()=>{setOpen(!open);setPreview(name);}}><i className={'tn-icon '+(name?icon(name):'bx bx-plus')} aria-hidden="true"/><span aria-hidden="true">▾</span></button>
        {open && <div className="mq-item-options" role="group" aria-label="选择开箱道具"><div className="mq-item-icon-grid">{names.map(value=><button type="button" key={value} title={value} aria-label={value} aria-pressed={name===value} onMouseEnter={()=>setPreview(value)} onFocus={()=>setPreview(value)} disabled={disabled} onClick={()=>{onChange(value);setOpen(false);trigger.current?.focus();}}><i className={'tn-icon '+icon(value)} aria-hidden="true"/></button>)}</div><p className="mq-item-name-preview" aria-live="polite">{names.length?(preview || '悬停或聚焦图标查看名称'):'暂无道具，请先添加商品'}</p></div>}
    </div>;
}
function ChestProbability({items,products}) {
    const [preview,setPreview]=useState('');
    const valid=items.every(item=>Number.isInteger(item.weight) && item.weight>=1 && item.weight<=10000);
    const total=items.reduce((sum,item)=>sum+(Number(item.weight) || 0),0);
    return <div className="mq-chest-probability"><table><caption>开箱概率 · {valid?`总权重 ${total}`:'请填写有效权重'}</caption><thead><tr><th>道具</th><th>数量</th><th>权重</th><th>概率</th></tr></thead><tbody>{items.map((item,index)=><tr key={index}><td><button type="button" className="mq-probability-icon" title={item.name || '未选择道具'} aria-label={item.name || '未选择道具'} onMouseEnter={()=>setPreview(item.name || '未选择道具')} onFocus={()=>setPreview(item.name || '未选择道具')}><i className={'tn-icon '+(products.find(product=>product.name===item.name)?.iconClass || 'bx bx-gift')} aria-hidden="true"/></button></td><td>×{item.quantity}</td><td>{item.weight}</td><td>{valid && total>0?(100*item.weight/total).toFixed(2)+'%':'—'}</td></tr>)}</tbody></table><p className="mq-item-name-preview" aria-live="polite">{preview || '悬停或聚焦图标查看名称'}</p></div>;
}
function EffectEditor({effects,onChange,disabled,names,products}) {
    const update = (index,values) => onChange(current=>current.map((effect,i)=>i===index?{...effect,...values}:effect));
    const updateItem = (index,itemIndex,values) => onChange(current=>current.map((effect,i)=>i===index?{...effect,items:effect.items.map((item,j)=>j===itemIndex?{...item,...values}:item)}:effect));
    const input = (index,key,numeric=false) => event => update(index,{[key]:numeric?Number(event.target.value):event.target.value});
    return <section className="mq-effects"><h3>使用效果 <small>按每件道具结算，可组合多项</small></h3>
        <div className="mq-effect-picker">{Object.entries(effectNames).map(([type,label])=><button key={type} type="button" disabled={disabled || effects.length>=20} onClick={()=>onChange(current=>[...current,newEffect(type)])}>＋ {label}</button>)}</div>
        {effects.map((effect,index)=><div className="mq-effect" key={index}>
            <header><b>{index+1}. {effectNames[effect.type]}</b><button type="button" disabled={disabled} onClick={()=>onChange(current=>current.filter((_,i)=>i!==index))}>移除</button></header>
            {['coins','xp'].includes(effect.type) && <><div className="mq-fields"><label>最小变化<input aria-label="最小变化" type="number" min="-100000" max="100000" required value={effect.min} onInput={input(index,'min',true)} disabled={disabled}/></label><label>最大变化<input aria-label="最大变化" type="number" min={effect.min} max="100000" required value={effect.max} onInput={input(index,'max',true)} disabled={disabled}/></label></div><small>相同数值为固定变化；负数扣除，资产不足时不消耗道具。</small>{effect.type==='xp' && <label>技能名称（可选）<input aria-label="效果经验技能" maxLength={80} value={effect.skill || ''} onInput={input(index,'skill')} disabled={disabled}/></label>}</>}
            {['item','craft','chest'].includes(effect.type) && <><p className="mq-muted">{effect.type==='chest'?'每件随机抽取一项，概率由权重决定。':effect.type==='craft'?'消耗正在使用的商品，获得以下全部成品；数量按使用件数倍增。':'正数获得道具，负数消耗道具；支持组合所需材料。'}</p>{effect.items.map((item,i)=><div className="mq-effect-item" key={i}>{effect.type==='chest'?<EffectItemPicker name={item.name} names={names} products={products} disabled={disabled} onChange={name=>updateItem(index,i,{name})}/>:<input aria-label="效果道具名称" list="mq-item-names" placeholder="道具名称" maxLength={80} required disabled={disabled} value={item.name} onInput={event=>updateItem(index,i,{name:event.target.value})}/>}<input aria-label="效果道具数量" type="number" min={effect.type==='item'?-100000:1} max="100000" required disabled={disabled} value={item.quantity} onInput={event=>updateItem(index,i,{quantity:Number(event.target.value)})}/>{effect.type==='chest' && <input aria-label="开箱权重" title="权重" type="number" min="1" max="10000" required disabled={disabled} value={item.weight} onInput={event=>updateItem(index,i,{weight:Number(event.target.value)})}/>}<button type="button" disabled={disabled || effect.items.length===1} onClick={()=>update(index,{items:effect.items.filter((_,j)=>j!==i)})}>删除</button></div>)}<button type="button" disabled={disabled || effect.items.length>=20} onClick={()=>update(index,{items:[...effect.items,{name:'',quantity:1,weight:1}]})}>＋ 道具</button>{effect.type==='chest' && <ChestProbability items={effect.items} products={products}/>}</>}
        </div>)}<datalist id="mq-item-names">{names.map(name=><option key={name} value={name}/>)}</datalist>
    </section>;
}
function LimitEditor({label,value,onChange,disabled}) {
    return <div className="mq-fields"><label>{label}<select aria-label={label} value={value?.period || ''} disabled={disabled} onChange={event=>onChange(event.target.value?event.target.value==='disabled'?{period:'disabled'}:{period:event.target.value,count:value?.count || 1}:null)}><option value="">无限制</option>{label==='购买限制' && <option value="disabled">不可直接购买</option>}<option value="daily">每日</option><option value="weekly">每周</option>{label!=='购买限制' && <option value="total">累计</option>}</select></label>{value && value.period !== 'disabled' && <label>最多件数<input type="number" min="1" max="100000" required disabled={disabled} value={value.count} onInput={event=>onChange({...value,count:Number(event.target.value)})}/></label>}</div>;
}

export default function CommissionBoard({ page: initialPage = 'quests', loadIconPicker = loadTriliumIconPicker } = {}) {
    const [page, setPage] = useState(initialPage);
    const currentPage = pages[page] || pages.quests;
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('active');
    const [form, setForm] = useState(null);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [productForm, setProductForm] = useState(null);
    const [category, setCategory] = useState('');
    const [shopView, setShopView] = useState('sale');
    const [quantities, setQuantities] = useState({});
    const [taskCategory, setTaskCategory] = useState('*');
    const [categoryManager, setCategoryManager] = useState(false);
    const [categoryDraft, setCategoryDraft] = useState('');
    const [categoryEdits, setCategoryEdits] = useState({});
    const [usage, setUsage] = useState(null);
    const [productMenu,setProductMenu]=useState(null);
    const menuRef=useRef(null);
    const [categoryMenu,setCategoryMenu]=useState(null);
    const categoryMenuRef=useRef(null);
    useEffect(()=>{
        if (!productMenu) return;
        menuRef.current?.querySelector('button')?.focus();
        const close=event=>{if(!menuRef.current?.contains(event.target))setProductMenu(null);};
        const key=event=>{if(event.key==='Escape'){setProductMenu(null);document.querySelector(`[data-product="${productMenu.id}"]`)?.focus();}};
        const dismiss=()=>setProductMenu(null);
        document.addEventListener('pointerdown',close,true);document.addEventListener('keydown',key);
        window.addEventListener('resize',dismiss);window.addEventListener('scroll',dismiss,true);
        return ()=>{document.removeEventListener('pointerdown',close,true);document.removeEventListener('keydown',key);window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true);};
    },[productMenu]);
    useEffect(()=>{
        if (!categoryMenu) return;
        categoryMenuRef.current?.querySelector('button')?.focus();
        const close=event=>{if(!categoryMenuRef.current?.contains(event.target))setCategoryMenu(null);};
        const key=event=>{if(event.key==='Escape'){setCategoryMenu(null);document.querySelector('[aria-label="筛选委托分类"]')?.focus();}};
        const dismiss=()=>setCategoryMenu(null);
        document.addEventListener('pointerdown',close,true);document.addEventListener('keydown',key);
        window.addEventListener('resize',dismiss);window.addEventListener('scroll',dismiss,true);
        return ()=>{document.removeEventListener('pointerdown',close,true);document.removeEventListener('keydown',key);window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true);};
    },[categoryMenu]);
    useEffect(()=>setProductMenu(null),[page]);
    const lock = useRef(false);
    const service = useRef(null);
    const alive = useRef(true);
    const call = async (action, payload = {}) => {
        if (!service.current) {
            const source = await api.getNote('MyoQuestSvc1');
            if (!source) throw new Error('委托服务未安装');
            service.current = await source.getContent();
        }
        return api.runOnBackend(service.current, [action, payload]);
    };
    async function refresh() {
        if (lock.current) return;
        lock.current = true; setBusy(true);
        try { const next = await call('load'); if (alive.current) { setData(next); setError(''); } }
        catch (failure) { if (alive.current) setError(failure.message || String(failure)); }
        finally { lock.current = false; if (alive.current) setBusy(false); }
    }
    useEffect(() => {
        alive.current = true; void refresh();
        const update = () => { void refresh(); };
        window.addEventListener('myo-quests-changed', update);
        window.addEventListener('focus', update);
        const timer = window.setInterval(update, 30000);
        document.addEventListener('visibilitychange', update);
        return () => {
            alive.current = false;
            window.removeEventListener('myo-quests-changed', update);
            window.removeEventListener('focus', update);
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', update);
        };
    }, []);
    async function act(action, payload = {}) {
        if (lock.current || !data) return false;
        lock.current = true; setBusy(true); setError(''); setNotice('');
        try {
            const requestId = ['complete','buy','useItem'].includes(action) ? (globalThis.crypto?.randomUUID?.() || `settlement_${Date.now()}_${Math.random().toString(36).slice(2)}`) : undefined;
            const next = await call(action, { ...payload, requestId, revision: data.revision });
            if (!alive.current) return false;
            setData(next);
            window.dispatchEvent(new Event('myo-quests-changed'));
            if (action === 'complete') {
                const event = [...next.events].reverse().find(item => item.taskId === payload.id && item.kind === 'complete');
                setNotice(`委托完成！＋${event.coins} 金币 · ＋${event.xp} 经验${event.itemName ? ` · ${event.itemName} ×${event.itemQuantity}` : ''}`);
            } else if (action === 'useItem') {
                const event = next.events.find(item=>item.kind==='use' && item.requestId===requestId);
                const changes = next.events.filter(item=>item.useId===event?.id).map(eventDetail);
                setNotice(`已使用「${payload.itemName}」×${payload.quantity}${changes.length?' · '+changes.join('；'):''}`);
            } else setNotice({ create: '委托已创建', edit: '委托已更新', undo: '已撤销完成并回收本次奖励', archive: '已归档，历史奖励保留', restore: '委托已恢复', productCreate: '商品已上架', productEdit: '商品已更新，历史购买记录不变', productDelete:'商品及同名库存已删除，历史记录保留', productArchive: '商品已下架，仓库物品保留', productRestore: '商品已重新上架', buy: '购买成功！已扣除金币并放入仓库', useItem: '道具已使用，效果已结算并记录', taskCategory:'委托分类已调整',categoryCreate:'分类已新增',categoryRename:'分类已更新',categoryDelete:'分类已删除，委托移至未分类' }[action] || '已保存');
            return true;
        } catch (failure) {
            if (alive.current) {
                setError(failure.message || String(failure));
                try { setData(await call('load')); } catch {}
            }
            return false;
        } finally { lock.current = false; if (alive.current) setBusy(false); }
    }
    function edit(task) {
        setEditing(task?.id || null);
        setForm(task ? { ...task, noteLink: task.noteId ? `#root/${task.noteId}` : '' } : blank());
    }
    async function submit(event) {
        event.preventDefault();
        if (await act(editing ? 'edit' : 'create', { ...form, id: editing })) { setForm(null); setEditing(null); setTab('active'); }
    }
    const field = (key, numeric = false) => event => setForm(current => ({ ...current, [key]: numeric ? Number(event.target.value) : event.target.value }));
    const amount = key => quantities[key] ?? 1;
    const quantityInput = (key, max = 999) => <input aria-label="数量" className="mq-quantity" type="number" min="1" max={Math.min(max,999)} step="1" value={amount(key)} disabled={busy} onInput={event => setQuantities(current => ({...current,[key]:Number(event.target.value)}))}/>;
    const productField = (key, numeric = false) => event => setProductForm(current => ({...current,[key]:numeric ? Number(event.target.value) : event.target.value}));
    async function saveProduct(event) {
        event.preventDefault();
        if (await act(productForm.id ? 'productEdit' : 'productCreate', {...productForm,useLabel:productForm.useLabelChoice==='custom'?productForm.useLabel:productForm.useLabelChoice})) setProductForm(null);
    }
    if (!data) return <main className="myo-quests"><h2>{currentPage.title}</h2><p>{error || '正在加载…'}</p><button disabled={busy} onClick={refresh}>重试</button></main>;
    const tasks = data.tasks.filter(task => (tab === 'archived' ? task.archived : !task.archived && task.status === tab) && (taskCategory==='*' || (task.category || '')===taskCategory));
    const active = data.tasks.filter(task => !task.archived && task.status === 'active').length;
    const done = data.tasks.filter(task => !task.archived && task.status === 'done').length;
    const validAmount = (key, max = 999) => Number.isInteger(amount(key)) && amount(key) >= 1 && amount(key) <= Math.min(max, 999);
    const eventDetail = event => [event.coins ? `${event.coins > 0 ? '+' : ''}${event.coins} 金币` : '',event.xp?`${event.xp>0?'+':''}${event.xp} ${event.skill || ''}经验`:'', event.itemName ? `${event.itemName} ${event.itemQuantity > 0 ? '+' : ''}${event.itemQuantity}` : ''].filter(Boolean).join(' · ') || '已记录';
    const categories = data.categories || [];
    const inventoryProducts = data.inventoryProducts || data.products;
    const visibleProducts = data.products.filter(item=>(shopView==='archived'?!!item.archived:!item.archived && (shopView==='unbuyable')===!!(item.purchaseDisabled || item.purchaseLimit?.period==='disabled')) && (!category || item.category===category));
    const character = experienceLevel(data.wallet.xp);
    const rank = engineerRank(character.level);
    const stockRemaining = item => item.stock == null ? null : Math.max(0, item.stock - data.events.filter(event=>event.kind==='purchase' && event.productId===item.id).reduce((sum,event)=>sum+event.itemQuantity,0));
    const showProductMenu=(event,item)=>{
        if(busy)return;
        event.preventDefault();
        const rect=event.currentTarget.getBoundingClientRect();
        setProductMenu({id:item.id,name:item.name,archived:item.archived,x:Math.max(8,Math.min(event.clientX || rect.left,window.innerWidth-200)),y:Math.max(8,Math.min(event.clientY || rect.top,window.innerHeight-180))});
    };
    const showCategoryMenu=event=>{
        if(busy)return;
        event.preventDefault();
        const rect=event.currentTarget.getBoundingClientRect();
        setCategoryMenu({x:Math.max(8,Math.min(event.clientX || rect.left,window.innerWidth-180)),y:Math.max(8,Math.min(event.clientY || rect.bottom,window.innerHeight-90))});
    };
    const itemNames = [...new Set([...data.products.map(item=>item.name),...Object.keys(data.wallet.items)])];
    async function use(event) {
        event.preventDefault();
        if (await act('useItem',{itemName:usage.name,productId:usage.product?.id,quantity:usage.quantity})) setUsage(null);
    }
    return <main className="myo-quests">
        {page==='shop' && productMenu && <div ref={menuRef} className="mq-product-menu" role="menu" aria-label={'商品操作 '+productMenu.name} style={{left:productMenu.x,top:productMenu.y}}><button role="menuitem" disabled={busy} onClick={()=>{setProductForm(editProduct(data.products.find(item=>item.id===productMenu.id)));setProductMenu(null);}}>编辑商品</button><button role="menuitem" disabled={busy} onClick={()=>{void act(productMenu.archived?'productRestore':'productArchive',{id:productMenu.id});setProductMenu(null);}}>{productMenu.archived?'上架商品':'下架商品'}</button><button className="mq-delete" role="menuitem" disabled={busy} onClick={async()=>{const item=productMenu;setProductMenu(null);if(window.confirm(`删除商品「${item.name}」？\n商品将从商店移除，并清空同名道具库存 ×${data.wallet.items[item.name] || 0}（含委托奖励）。无法重新上架，不退还金币；历史记录保留。`)){if(await act('productDelete',{id:item.id})){if(productForm?.id===item.id)setProductForm(null);if(usage?.name===item.name)setUsage(null);}}}}>删除商品</button></div>}
        {page==='quests' && categoryMenu && <div ref={categoryMenuRef} className="mq-product-menu" role="menu" aria-label="委托分类操作" style={{left:categoryMenu.x,top:categoryMenu.y}}><button role="menuitem" disabled={busy} onClick={()=>{setCategoryManager(true);setCategoryMenu(null);}}>管理分类</button></div>}
        <header className="mq-header"><div><small>人升 · PERSONAL QUESTS</small><h1>{currentPage.title}</h1><p>{currentPage.subtitle}</p></div>
            <div className="mq-actions"><button disabled={busy} onClick={refresh}>刷新</button></div></header>
        <nav className="mq-windows" aria-label="人升页面">{Object.entries(pages).map(([key, entry]) => <button key={key} aria-current={key === page ? 'page' : undefined} className={key === page ? 'selected' : ''} onClick={() => setPage(key)}>{entry.label}</button>)}</nav>
        <section className="mq-stats"><div><small>金币</small><strong>{data.wallet.coins}</strong></div><div><small>进行中</small><strong>{active}</strong></div><div><small>已完成</small><strong>{done}</strong></div></section>
        <section className="mq-experience" aria-label="人物成长"><div><b>{rank.current.title} · Lv.{character.level}</b><small>下一级 {character.progress} / {character.next} 经验</small></div><progress aria-label="人物升级进度" max={character.next} value={character.progress}/><div className="mq-rank-detail"><small>累计经验 {data.wallet.xp}</small><small>{rank.next ? `下一称号：${rank.next.title} · Lv.${rank.next.level}` : '已达最高称号，等级仍可继续提升'}</small></div>{Object.entries(data.wallet.skills).map(([name,xp])=><div className="mq-skill" key={name}><span>{name} · Lv.{experienceLevel(xp).level}</span><small>{xp} 经验</small><progress max={experienceLevel(xp).next} value={experienceLevel(xp).progress}/></div>)}</section>
        {error && <div role="alert" className="mq-error">{error}</div>}
        {notice && <div role="status" className="mq-notice">{notice}</div>}
        {usage && <form className="mq-form mq-use-form" onSubmit={use}><header><h2>{usage.product?.useLabel || '使用 / 兑换'} · {usage.name}</h2><button type="button" disabled={busy} onClick={()=>setUsage(null)}>取消</button></header><p>将消耗 {usage.quantity} 件，按当前商品设置结算以下效果：</p>{(usage.product?.effects || []).map((effect,i)=><p key={i}>{effectNames[effect.type]}{['coins','xp'].includes(effect.type)?`：每件 ${effect.min}～${effect.max}${effect.skill?' · '+effect.skill:''}`:effect.items?`：${effect.items.map(item=>`${item.name} ${item.quantity>0?'+':''}${item.quantity}${effect.type==='chest'?`（权重 ${item.weight}）`:''}`).join('、')}`:''}</p>)}<footer><small>材料及资产不足时不会消耗道具，全部效果一起结算。</small><button type="submit" className="mq-primary" disabled={busy}>确认使用</button></footer></form>}
        {page === 'quests' && <nav className="mq-tabs" aria-label="委托分类">{[['active','进行中'],['done','已完成'],['archived','已归档'],['rewards','奖励与记录']].map(([key,label]) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>}
        <datalist id="mq-task-categories">{categories.map(name=><option key={name} value={name}/>)}</datalist>
        {page==='quests' && <div className="mq-shop-toolbar mq-quest-toolbar" tabIndex={0} aria-label="委托分类筛选与操作" onContextMenu={showCategoryMenu} onKeyDown={event=>{if(event.key==='ContextMenu' || (event.shiftKey && event.key==='F10'))showCategoryMenu(event);}}><h2>委托列表</h2><div className="mq-actions"><select aria-label="筛选委托分类" value={taskCategory} onChange={event=>setTaskCategory(event.target.value)}><option value="*">全部分类</option><option value="">未分类</option>{categories.map(name=><option key={name} value={name}>{name}</option>)}</select><button className="mq-primary" disabled={busy} onClick={() => edit(null)}>＋ 自定义委托</button></div></div>}
        {page==='quests' && categoryManager && <section className="mq-form"><h2>管理委托分类</h2><div className="mq-actions"><input aria-label="新分类名称" placeholder="新增分类" maxLength={40} value={categoryDraft} onInput={event=>setCategoryDraft(event.target.value)} disabled={busy}/><button disabled={busy || !categoryDraft.trim()} onClick={async()=>{if(await act('categoryCreate',{name:categoryDraft}))setCategoryDraft('');}}>新增</button></div>{categories.map(name=><div className="mq-category-row" key={name}><input aria-label={'分类名称 '+name} maxLength={40} disabled={busy} value={categoryEdits[name]??name} onInput={event=>setCategoryEdits({...categoryEdits,[name]:event.target.value})}/><button disabled={busy} onClick={async()=>{const target=categoryEdits[name]??name;if(await act('categoryRename',{name,target})){if(taskCategory===name)setTaskCategory(target.trim());}}}>改名</button><button disabled={busy} onClick={async()=>{if(window.confirm(`删除分类「${name}」？所属委托将移至未分类。`) && await act('categoryDelete',{name})){if(taskCategory===name)setTaskCategory('');}}}>删除</button></div>)}<small>改名会同步调整所有委托；删除分类保留委托和奖励。</small></section>}
        {page === 'quests' && form && <form className="mq-form" onSubmit={submit}>
            <header><h2>{editing ? '编辑委托' : '自定义委托'}</h2><button type="button" disabled={busy} onClick={() => setForm(null)}>取消</button></header>
            <label>委托名称<input required maxLength={80} value={form.title} onInput={field('title')} placeholder="例如：学习模电 25 分钟并整理一个知识点" disabled={busy}/></label>
            <label>委托分类<input aria-label="委托分类" list="mq-task-categories" maxLength={40} placeholder="未分类；也可输入新分类" value={form.category || ''} onInput={field('category')} disabled={busy}/></label>
            <label>说明与完成条件<textarea rows={3} maxLength={2000} value={form.description} onInput={field('description')} placeholder="写清楚怎样才算完成；第一版由你手动确认" disabled={busy}/></label>
            <div className="mq-fields"><label>任务周期<select aria-label="任务周期" value={form.recurrence || 'once'} onChange={field('recurrence')} disabled={busy}>{Object.entries(cycles).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{form.recurrence === 'weeklyMultiple' && <label>每周目标次数<input aria-label="每周目标次数" type="number" min="2" max="99" required value={form.weeklyTarget || 3} onInput={field('weeklyTarget',true)} disabled={busy}/></label>}</div>
            <p className="mq-cycle-help">{form.recurrence === 'repeat' ? '不限次数，同一天可以多次完成，每次单独结算奖励。' : form.recurrence === 'daily' ? '每天完成一次，北京时间 00:00 开启下一天。' : form.recurrence === 'weekly' || form.recurrence === 'weeklyMultiple' ? '每周一 00:00 开启新一周，多次任务可在同一天完成。' : '完成一次后结束，可撤销本次完成。'}</p>
            <div className="mq-task-levels">{[['importance','重要程度'],['urgency','紧急程度']].map(([key,label])=><label key={key}><span>{label}<b>Lv.{form[key] || 1}</b></span><input type="range" aria-label={label} min="1" max="4" step="1" value={form[key] || 1} onInput={field(key,true)} disabled={busy}/><div className="mq-level-ticks">{[1,2,3,4].map(level=><small key={level} className={level===(form[key] || 1)?'selected':''}>Lv.{level}</small>)}</div></label>)}</div>
            <label>金币奖励<input type="number" min="0" max="100000" step="1" required aria-label="金币奖励" value={form.coins} onInput={field('coins',true)} disabled={busy}/></label>
            <div className="mq-fields"><label>经验奖励<input aria-label="经验奖励" type="number" min="0" max="100000" step="1" required value={form.xp ?? 0} onInput={field('xp',true)} disabled={busy}/></label><label>技能名称（可选）<input aria-label="经验技能" maxLength={80} placeholder="例如：模拟电路；留空只累计总经验" value={form.skill || ''} onInput={field('skill')} disabled={busy}/></label></div>
            <div className="mq-fields"><label>奖励道具（可选）<input maxLength={80} value={form.itemName} onInput={field('itemName')} placeholder="例如：一级补给箱" disabled={busy}/></label><label>道具数量<input type="number" min="1" max="999" step="1" value={form.itemQuantity} onInput={field('itemQuantity', true)} disabled={busy || !form.itemName}/></label></div>
            <label>关联笔记（可选）<input value={form.noteLink} onInput={field('noteLink')} placeholder="粘贴 #root/… 笔记链接或笔记 ID" disabled={busy}/></label>
            <footer><small>奖励数值由你规定；完成时结算，撤销时回收。不重复发奖。</small><button className="mq-primary" disabled={busy} type="submit">{busy ? '保存中…' : '保存委托'}</button></footer>
        </form>}
        {page === 'quests' && <p className="mq-muted">进行中 {active} · 已完成 {done} · 完成学习委托获得金币、经验和道具。</p>}
        {page === 'shop' && <section className="mq-minimal-shop">
            <div className="mq-shop-toolbar"><h2>自定义兑换</h2><div className="mq-actions"><select aria-label="商品分类" value={category} onChange={event => setCategory(event.target.value)}><option value="">全部分类</option>{[...new Set(data.products.map(item=>item.category))].map(name=><option key={name} value={name}>{name}</option>)}</select><button title={{sale:'当前：在售商品',archived:'当前：已下架商品',unbuyable:'当前：不可直接购买商品'}[shopView]} onClick={()=>{setShopView(current=>({sale:'archived',archived:'unbuyable',unbuyable:'sale'})[current]);setProductMenu(null);}}>{{sale:'查看下架',archived:'查看不可购买',unbuyable:'查看在售'}[shopView]}</button><button className="mq-primary" disabled={busy} onClick={()=>setProductForm(newProduct())}>＋ 添加商品</button></div></div>
            <p className="mq-muted">金币通过学习委托获得。同名道具会合并库存；现实奖励使用后请自行兑现。</p>
            {productForm && <form className="mq-form" onSubmit={saveProduct}>
                <header><h2>{productForm.id?'编辑商品':'添加商品'}</h2><button type="button" disabled={busy} onClick={()=>setProductForm(null)}>取消</button></header>
                <ProductIconPicker icon={productForm.iconClass} disabled={busy} loadPicker={loadIconPicker} onChange={iconClass=>setProductForm(current=>({...current,iconClass}))}/>
                <label>商品名称<input required maxLength={80} value={productForm.name} onInput={productField('name')} disabled={busy} placeholder="例如：游戏休息 30 分钟 / 水族馆装饰券"/></label>
                <label>使用说明<textarea rows={3} maxLength={2000} value={productForm.description} onInput={productField('description')} disabled={busy} placeholder="写下兑换内容及使用说明"/></label>
                <div className="mq-fields"><label>分类<input required maxLength={40} value={productForm.category} onInput={productField('category')} disabled={busy}/></label><label>金币单价<input required type="number" min="0" max="100000" step="1" value={productForm.price} onInput={productField('price',true)} disabled={busy}/></label></div>
                <div className="mq-fields"><label>累计可售数量（留空无限）<input aria-label="累计可售数量" type="number" min="0" max="100000" value={productForm.stock ?? ''} onInput={event=>setProductForm(current=>({...current,stock:event.target.value===''?null:Number(event.target.value)}))} disabled={busy}/></label><div><label>使用按钮文案<select aria-label="使用按钮文案类型" value={productForm.useLabelChoice} onChange={productField('useLabelChoice')} disabled={busy}><option value="使用">使用</option><option value="兑换">兑换</option><option value="custom">自定义</option></select></label>{productForm.useLabelChoice==='custom' && <label>自定义文案<input aria-label="使用按钮文案" required maxLength={30} value={productForm.useLabel || ''} placeholder="输入按钮文案" onInput={productField('useLabel')} disabled={busy}/></label>}</div></div>
                <label>使用效果<select aria-label="使用效果" value={productForm.useMode || 'none'} onChange={productField('useMode')} disabled={busy}><option value="none">无（消耗并记录使用）</option><option value="disabled">不可使用（收藏品）</option><option value="custom">自定义效果</option></select></label>
                {productForm.useMode==='custom' && <EffectEditor effects={productForm.effects || []} names={itemNames} products={[...data.products,...inventoryProducts]} disabled={busy} onChange={transform=>setProductForm(current=>({...current,effects:transform(current.effects || [])}))}/>}
                <LimitEditor label="购买限制" value={productForm.purchaseLimit} disabled={busy} onChange={purchaseLimit=>setProductForm(current=>({...current,purchaseLimit}))}/>
                <LimitEditor label="使用限制" value={productForm.useLimit} disabled={busy} onChange={useLimit=>setProductForm(current=>({...current,useLimit}))}/>
                <footer><small>已有库存按当前商品设置使用，历史结算不变。每日／每周限制按北京时间重置。</small><button type="submit" className="mq-primary" disabled={busy}>保存商品</button></footer>
            </form>}
            <div className="mq-catalog mq-mini-grid">{visibleProducts.map(item=><article className="mq-card mq-mini-card mq-redeem-card" key={item.id} data-product={item.id} tabIndex={0} aria-haspopup="menu" onContextMenu={event=>showProductMenu(event,item)} onKeyDown={event=>{if(event.key==='ContextMenu' || (event.shiftKey && event.key==='F10'))showProductMenu(event,item);}} title={item.description || '暂无使用说明'}>
                <div className="mq-mini-heading"><i className={'tn-icon mq-product-icon '+(item.iconClass || 'bx bx-gift')} aria-hidden="true"/><h2>{item.name}</h2></div><div className="mq-mini-meta"><span>{item.price} <small>金币 / 件</small></span><small>{item.category}{stockRemaining(item) !== null ? ` · 剩余 ${stockRemaining(item)} 件` : ''}</small></div>
                {(item.purchaseDisabled || item.purchaseLimit?.period==='disabled' || item.useMode==='disabled' || item.useMode==='custom') && <p className="mq-mini-policy">{(item.purchaseDisabled || item.purchaseLimit?.period==='disabled')?'不可直接购买':item.useMode==='disabled'?'收藏品':`${item.effects?.length || 0} 项使用效果`}</p>}
                <footer><div className="mq-actions"><button disabled={busy} onClick={()=>setProductForm(editProduct(item))}>编辑</button><button disabled={busy} onClick={()=>act(item.archived?'productRestore':'productArchive',{id:item.id})}>{item.archived?'上架':'下架'}</button></div></footer>
                {!item.archived && !item.purchaseDisabled && item.purchaseLimit?.period!=='disabled' && <div className="mq-purchase">{quantityInput('buy:'+item.id)}<button className="mq-primary" disabled={busy || !Number.isInteger(amount('buy:'+item.id)) || amount('buy:'+item.id)<1 || amount('buy:'+item.id)>999 || data.wallet.coins<item.price*amount('buy:'+item.id) || (item.stock!=null && item.stock-data.events.filter(event=>event.kind==='purchase' && event.productId===item.id).reduce((sum,event)=>sum+event.itemQuantity,0)<amount('buy:'+item.id))} onClick={()=>{const quantity=amount('buy:'+item.id);if(window.confirm(`购买「${item.name}」×${quantity}，花费 ${item.price*quantity} 金币？`)) void act('buy',{id:item.id,quantity});}}>购买 · {item.price*amount('buy:'+item.id)} 金币</button></div>}
            </article>)}</div>
            {!visibleProducts.length && <div className="mq-empty">{{archived:'没有下架商品。',unbuyable:'没有不可直接购买的商品。',sale:'没有在售商品。添加一些真正让你期待的奖励吧。'}[shopView]}</div>}
        </section>}
        {page === 'warehouse' && <section><h2>道具与兑换物</h2><p className="mq-muted">保留原有道具及现实奖励。使用会扣除库存并留下记录，不可直接撤销。</p><div className="mq-catalog">{Object.entries(data.wallet.items).filter(([,qty])=>qty>0).map(([name,qty])=>{
            const snapshot=[...data.events].reverse().find(event=>event.kind==='purchase' && event.itemName===name);
            const product=inventoryProducts.find(item=>item.name===name);
            const key='use:'+name;
            return <article className="mq-card" key={name}><div className="mq-card-heading"><h2><i className={"tn-icon mq-product-icon "+(product?.iconClass || snapshot?.iconClass || "bx bx-gift")} aria-hidden="true"/> {name}</h2><span>库存 ×{qty}</span></div><p className="mq-description">{product?.description || snapshot?.description || '完成委托或购买获得的道具。'}</p>{product?.useMode==='disabled'?<small>收藏品 · 不可使用</small>:<div className="mq-purchase">{quantityInput(key,qty)}<button className="mq-primary" disabled={busy || !validAmount(key,qty)} onClick={()=>{const quantity=amount(key);if(product?.useMode==='custom')setUsage({name,quantity,product});else if(window.confirm(`使用「${name}」×${quantity}？将扣除库存，现实奖励请自行兑现。`))void act('useItem',{itemName:name,productId:product?.id,quantity});}}>{product?.useLabel || '使用 / 兑换'}</button></div>}</article>;
        })}</div>{!Object.values(data.wallet.items).some(qty=>qty>0) && <p className="mq-muted">暂无其他道具。</p>}</section>}
        {page === 'quests' && ['active','done','archived'].includes(tab) && <section className="mq-list">{tasks.map(task => <article className="mq-card mq-task-card" key={task.id} data-task={task.id} data-recurrence={task.recurrence || 'once'}>
            <div className="mq-card-heading"><h2>{task.title}</h2><span>{task.archived ? '已归档' : task.status === 'done' ? '已完成' : '进行中'}</span></div>
            <label className="mq-task-category">分类<select aria-label={'调整分类 '+task.title} value={task.category || ''} disabled={busy} onChange={event=>act('taskCategory',{id:task.id,category:event.target.value})}><option value="">未分类</option>{categories.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
            <div className="mq-task-tags"><span>{cycles[task.recurrence]}</span><span>重要 Lv.{task.importance}</span><span className={task.urgency >= 3 ? 'urgent' : ''}>紧急 Lv.{task.urgency}</span></div><p className="mq-task-progress">{cycleDescription(task)}{task.recurrence !== 'once' ? ` · 累计 ${task.completionCount} 次` : ''}</p>
            {task.description && <p className="mq-description">{task.description}</p>}
            <div className="mq-rewards"><span>◈ {task.coins} 金币</span><span>✧ {task.xp || 0} 经验{task.skill?` · ${task.skill}`:""}</span>{task.itemName && <span>▣ {task.itemName} ×{task.itemQuantity}</span>}</div>
            <footer><small>{task.status === 'done' ? `完成于 ${when(task.completedAt)}` : `创建于 ${when(task.createdAt)}`}</small><div className="mq-actions">
                {task.noteId && <button onClick={() => api.openTabWithNote(task.noteId, true)}>打开笔记 ↗</button>}
                {task.archived ? <button disabled={busy} onClick={() => act('restore', {id:task.id})}>恢复</button> : <>
                    {(task.canComplete || task.recurrence !== 'once') && <button disabled={busy} onClick={() => edit(task)}>编辑</button>}
                    {task.canComplete && <button className="mq-primary" disabled={busy} onClick={() => act('complete',{id:task.id})}>✓ 完成并领奖</button>}
                    {task.completionEventId && <button disabled={busy} onClick={() => { if (window.confirm('撤销上次完成会回收那次金币、经验和道具，确定吗？')) void act('undo',{id:task.id,eventId:task.completionEventId}); }}>{task.recurrence === 'once' ? '撤销完成' : '撤销上次完成'}</button>}
                    <button disabled={busy} onClick={() => act('archive',{id:task.id})}>归档</button>
                </>}
            </div></footer>
        </article>)}{!tasks.length && <div className="mq-empty">{tab === 'active' ? '还没有进行中的委托。点击“自定义委托”创建你的第一项学习任务。' : '这里暂时没有委托。'}</div>}</section>}
        {page === 'quests' && tab === 'rewards' && <section className="mq-history">
            <h2>道具库存</h2><div className="mq-rewards">{Object.entries(data.wallet.items).filter(([,qty]) => qty > 0).map(([name,qty]) => <span key={name}>▣ {name} ×{qty}</span>)}{!Object.values(data.wallet.items).some(qty=>qty>0) && <small>尚未获得道具。</small>}</div>
            <h2>最近结算记录</h2><div className="mq-ledger">{[...data.events].reverse().slice(0,50).map(event=><article key={event.id}><div><b>{eventLabel(event.kind)} · {event.title}</b><small>{when(event.time)}</small></div><span>{eventDetail(event)}</span></article>)}{!data.events.length && <p>完成第一项委托后，会在这里留下奖励记录。</p>}</div>
        </section>}
        <footer className="mq-footnote">个人自用人升插件 · 数据保存于 Trilium 本地数据库 · 完成委托获取金币，兑换奖励</footer>
    </main>;
}
