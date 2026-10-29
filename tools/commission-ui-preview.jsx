import { render } from 'preact';
import CommissionBoard from '../customizations/frontend/commission-board.jsx';
import serviceSource from '../customizations/backend/commission-service.js?raw';
let sequence = 0;
let content = JSON.stringify({version:1,revision:0,tasks:[],events:[]});
const opened = [];
function PreviewIconPicker({icon,onSelect,onReset,disabled,title}) {
    return <div><button type="button" aria-label={title} disabled={disabled} onClick={()=>onSelect('bx bx-book')}>选择商品图标</button><button type="button" disabled={disabled} onClick={onReset}>重置商品图标</button><i data-preview-icon={icon}/></div>;
}
window.api = {
    preact:{IconPicker:PreviewIconPicker},
    getNote: async () => ({ getContent: async () => serviceSource }),
    runOnBackend: async (source, args) => {
        const backendApi = {
            getNote: () => ({ hasLabel: () => true, getContent: () => content, setContent: text => {content=text;} }),
            randomString: () => 'previewId'+(++sequence)
        };
        const execute = new Function('api', `return (${source});`)(backendApi);
        return JSON.parse(JSON.stringify(execute(...args)));
    },
    openTabWithNote: async id => { opened.push(id); }
};
window.confirm = () => true;
render(<CommissionBoard/>, document.getElementById('app'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (value, message) => {if(!value) throw new Error(message);};
const find = text => [...document.querySelectorAll('button')].find(button => button.textContent.includes(text));
async function test() {
    await wait(350);
    check(document.querySelector('.mq-experience b').textContent==='小白 · Lv.1','初始人物称号错误');
    check(!document.querySelector('.mq-stats').textContent.includes('总经验'),'重复经验卡片仍存在');
    find('自定义委托').click(); await wait(150);
    const title = document.querySelector('.mq-form input');
    title.value='学习模电 25 分钟'; title.dispatchEvent(new Event('input',{bubbles:true}));
    const description=document.querySelector('textarea');
    description.value='理解一个知识点，整理到笔记中。'; description.dispatchEvent(new Event('input',{bubbles:true}));
    const coins=document.querySelector('input[aria-label="金币奖励"]');coins.value='100';coins.dispatchEvent(new Event('input',{bubbles:true}));
    const item=document.querySelector('input[placeholder="例如：一级补给箱"]');
    item.value='一级补给箱'; item.dispatchEvent(new Event('input',{bubbles:true}));
    await wait(100); document.querySelector('form').requestSubmit(); await wait(250);
    check(JSON.parse(content).tasks.length===1,'创建失败');
    find('完成并领奖').click(); find('完成并领奖')?.click(); await wait(250);
    check(JSON.parse(content).events.length===1,'重复奖励');
    check(document.querySelector('.mq-stats strong').textContent==='100','余额错误');
    find('已完成').click(); await wait(150);
    find('撤销完成').click(); await wait(200);
    check(JSON.parse(content).events.length===2,'撤销失败');
    find('进行中').click(); await wait(120);
    find('完成并领奖').click(); await wait(200);
    check(JSON.parse(content).events.length===3,'重新结算失败');
    find('已完成').click(); await wait(120);
    check(document.querySelector('.mq-card h2').textContent==='学习模电 25 分钟','任务展示错误');
    check(![...document.querySelectorAll('.mq-tabs button')].some(button=>/商店|仓库/.test(button.textContent)), '商店仓库仍在委托分类中');
    find('商店').click(); await wait(100); find('添加商品').click(); await wait(100);
    check(opened.length===0 && document.querySelector('h1').textContent==='奖励商店', '商店未在当前页面切换');
    check(!find('自定义委托') && !document.querySelector('.mq-tabs'), '商店混入委托控件');
    const productName=document.querySelector('.mq-form input');
    productName.value='游戏休息 30 分钟'; productName.dispatchEvent(new Event('input',{bubbles:true}));
    const price=document.querySelector('.mq-form input[type="number"]');
    price.value='5'; price.dispatchEvent(new Event('input',{bubbles:true}));
    const stock=document.querySelector('input[aria-label="累计可售数量"]');
    stock.value='2'; stock.dispatchEvent(new Event('input',{bubbles:true}));
    await wait(100); find('仓库').click(); await wait(100);
    check(!document.querySelector('.mq-form'), '商品表单出现在仓库');
    find('商店').click(); await wait(100);
    check(document.querySelector('.mq-form input').value==='游戏休息 30 分钟', '切换丢失商品草稿');
    await wait(100); document.querySelector('form').requestSubmit(); await wait(180);
    check(JSON.parse(content).products.length===1,'商品创建失败');
    const limitedCard=[...document.querySelectorAll('.mq-redeem-card')].find(card=>card.textContent.includes('游戏休息'));
    check(limitedCard.querySelector('.mq-mini-meta').textContent.includes('剩余 2 件'),'库存剩余数量未并入商品信息行');
    check(!limitedCard.querySelector('.mq-mini-policy'),'库存商品多出独立库存提示行');
    find('购买 ·').click(); find('购买 ·')?.click(); await wait(180);
    check(JSON.parse(content).events.filter(event=>event.kind==='purchase').length===1,'购买重复扣款');
    check(document.querySelector('.mq-stats strong').textContent==='95','购买余额错误');
    find('仓库').click(); await wait(120);
    check(opened.length===0 && document.querySelector('h1').textContent==='我的仓库', '仓库未在当前页面切换');
    const purchased=[...document.querySelectorAll('.mq-card')].find(card=>card.textContent.includes('游戏休息'));
    check(!!purchased,'购买未入库'); purchased.querySelector('button').click(); await wait(180);
    check(JSON.parse(content).events.filter(event=>event.kind==='use').length===1,'使用未记录');
    check(![...document.querySelectorAll('.mq-card')].some(card=>card.textContent.includes('游戏休息')),'使用未扣库存');
    find('委托').click(); await wait(150);
    check(document.querySelector('.mq-tabs .selected').textContent==='已完成', '切换丢失委托分类');
    find('奖励与记录').click(); await wait(120);
    check(document.querySelector('.mq-ledger').textContent.includes('购买入库'),'记录类型错误');
    check(document.querySelector('.mq-ledger').textContent.includes('使用道具'),'使用记录缺失');
    find('委托').click(); await wait(100);
    async function createCycle(recurrence) {
        find('自定义委托').click(); await wait(100);
        const title=document.querySelector('.mq-form input');title.value='Cycle '+recurrence;title.dispatchEvent(new Event('input',{bubbles:true}));
        const cycle=document.querySelector('select[aria-label="任务周期"]');cycle.value=recurrence;cycle.dispatchEvent(new Event('change',{bubbles:true}));await wait(60);
        for(const label of ['金币奖励']) {const e=document.querySelector(`input[aria-label="${label}"]`);e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));}
        for(const [label,value] of [['重要程度','4'],['紧急程度','3']]) {const e=document.querySelector(`input[aria-label="${label}"]`);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}
        if(recurrence==='weeklyMultiple'){const e=document.querySelector('input[aria-label="每周目标次数"]');e.value='2';e.dispatchEvent(new Event('input',{bubbles:true}));}
        await wait(80);document.querySelector('form').requestSubmit();await wait(150);
        return JSON.parse(content).tasks[0].id;
    }
    const repeatId=await createCycle('repeat');
    const taskCard=id=>document.querySelector(`[data-task="${id}"]`);
    taskCard(repeatId).querySelector('.mq-primary').click();await wait(150);
    taskCard(repeatId).querySelector('.mq-primary').click();await wait(150);
    check(taskCard(repeatId).textContent.includes('今日完成 2 次'),'repeat card did not remain available');
    const undo=[...taskCard(repeatId).querySelectorAll('button')].find(e=>e.textContent.includes('撤销'));undo.click();await wait(150);
    check(taskCard(repeatId).textContent.includes('今日完成 1 次'),'repeat undo failed');
    const weeklyId=await createCycle('weeklyMultiple');
    taskCard(weeklyId).querySelector('.mq-primary').click();await wait(150);
    taskCard(weeklyId).querySelector('.mq-primary').click();await wait(150);
    check(!taskCard(weeklyId),'weekly completed target still active');
    find('已完成').click();await wait(100);
    check(taskCard(weeklyId).textContent.includes('本周 2 / 2'),'weekly progress missing');
    check(taskCard(weeklyId).textContent.includes('重要 Lv.4') && taskCard(weeklyId).textContent.includes('紧急 Lv.3'),'level sliders did not save');
    const change=(element,value,event='input')=>{check(!!element,'Missing input '+value);element.value=String(value);element.dispatchEvent(new Event(event,{bubbles:true}));};
    check(document.querySelector('.mq-rank-detail').textContent.includes('累计经验 '+JSON.parse(content).events.reduce((n,e)=>n+e.xp,0)),'XP total missing');
    check(document.querySelector('.mq-experience b').textContent==='菜鸟 · Lv.2','升级后人物称号未更新');
    document.querySelector('.mq-quest-toolbar').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:200,clientY:200}));await wait(80);
    check(document.querySelector('[aria-label="委托分类操作"]'),'Category context menu missing');
    check(![...document.querySelectorAll('.mq-quest-toolbar button')].some(button=>button.textContent.includes('管理分类')),'Category button still visible');
    find('管理分类').click();await wait(80);
    change(document.querySelector('input[aria-label="新分类名称"]'),'学习');await wait(60);find('新增').click();await wait(100);
    change(taskCard(weeklyId).querySelector('.mq-task-category select'),'学习','change');await wait(100);
    check(JSON.parse(content).tasks.find(task=>task.id===weeklyId).category==='学习','Completed task category not changed');
    const row=document.querySelector('.mq-category-row');change(row.querySelector('input'),'课程');await wait(60);row.querySelector('button').click();await wait(100);
    check(taskCard(weeklyId).querySelector('select').value==='课程','Category rename did not propagate');
    change(document.querySelector('select[aria-label="筛选委托分类"]'),'课程','change');await wait(80);
    check(document.querySelectorAll('[data-task]').length===1,'Category filter failed');
    document.querySelector('.mq-category-row button:last-child').click();await wait(100);
    check(JSON.parse(content).tasks.find(task=>task.id===weeklyId).category==='','Deleting category deleted or retained task association');
    change(document.querySelector('select[aria-label="筛选委托分类"]'),'*','change');await wait(80);
    find('商店').click();await wait(80);find('添加商品').click();await wait(80);
    change(document.querySelector('.mq-form input'),'组合奖励');change(document.querySelector('.mq-form input[type="number"]'),1);
    document.querySelector('button[aria-label="选择商品图标"]').click();await wait(60);
    check(document.querySelector('[data-preview-icon]').getAttribute('data-preview-icon')==='bx bx-book','Icon selection did not update draft');
    change(document.querySelector('select[aria-label="使用效果"]'),'custom','change');await wait(80);
    check(document.querySelectorAll('.mq-effect-picker button').length===5,'Effect choices exceed requested five');
    check(!document.querySelector('.mq-check'),'Legacy purchase checkbox still visible');
    const purchaseLimit=document.querySelector('select[aria-label="购买限制"]');
    const useLimit=document.querySelector('select[aria-label="使用限制"]');
    check([...purchaseLimit.options].some(option=>option.textContent==='不可直接购买'),'Purchase restriction option missing');
    check(![...purchaseLimit.options].some(option=>option.textContent==='累计'),'Purchase cumulative option should be removed');
    check([...useLimit.options].some(option=>option.textContent==='累计'),'Use cumulative option missing');
    for(const type of ['金币','经验值','道具增减','合成','开箱']){[...document.querySelectorAll('.mq-effect-picker button')].find(button=>button.textContent.includes(type)).click();await wait(60);}
    const effects=[...document.querySelectorAll('.mq-effect')];
    for(const [index,value] of [[0,6],[1,8]]){change(effects[index].querySelector('input[aria-label="最小变化"]'),value);change(effects[index].querySelector('input[aria-label="最大变化"]'),value);}
    change(effects[1].querySelector('input[aria-label="效果经验技能"]'),'学识');
    for(const [index,name,qty] of [[2,'额外道具',1],[3,'合成成品',2]]){change(effects[index].querySelector('input[aria-label="效果道具名称"]'),name);change(effects[index].querySelector('input[aria-label="效果道具数量"]'),qty);}
    effects[4].querySelector('.mq-item-trigger').click();await wait(60);
    const candidate=effects[4].querySelector('.mq-item-icon-grid button');check(candidate,'No existing items available');const chestName=candidate.getAttribute('aria-label');candidate.focus();await wait(50);check(effects[4].querySelector('.mq-item-name-preview').textContent===chestName,'Focused icon name preview missing');candidate.click();await wait(60);
    check(effects[4].querySelector('.mq-chest-probability').textContent.includes('100.00%'),'Single chest probability wrong');
    [...effects[4].querySelectorAll('button')].find(button=>button.textContent==='＋ 道具').click();await wait(60);
    const rows=effects[4].querySelectorAll('.mq-effect-item');rows[1].querySelector('.mq-item-trigger').click();await wait(50);rows[1].querySelector('.mq-item-icon-grid button').click();await wait(50);change(rows[1].querySelector('[aria-label="开箱权重"]'),3);await wait(80);
    const table=effects[4].querySelector('.mq-chest-probability');check(table.textContent.includes('25.00%') && table.textContent.includes('75.00%'),'Weights did not update probability');rows[1].querySelector('button:last-child').click();await wait(60);
    await wait(100);document.querySelector('form').requestSubmit();await wait(150);
    check(JSON.parse(content).products[0].effects.length===5,'Effect configuration not saved');
    check(JSON.parse(content).products[0].iconClass==='bx bx-book','Selected product icon not saved');
    const rewardCard=[...document.querySelectorAll('.mq-redeem-card')].find(card=>card.textContent.includes('组合奖励'));
    check(rewardCard.querySelector('.mq-product-icon').classList.contains('bx-book'),'Shop icon missing');
    rewardCard.querySelector('.mq-purchase button').click();await wait(150);
    find('仓库').click();await wait(100);
    const rewardItem=[...document.querySelectorAll('.mq-card')].find(card=>card.textContent.includes('组合奖励'));
    check(rewardItem.querySelector('.mq-product-icon').classList.contains('bx-book'),'Warehouse icon missing');
    rewardItem.querySelector('button').click();await wait(80);
    check(document.querySelector('.mq-use-form').textContent.includes('合成成品'),'Use confirmation omitted effects');
    document.querySelector('.mq-use-form').requestSubmit();await wait(150);
    const settled=JSON.parse(content).events;
    check(settled.some(e=>e.kind==='effect' && e.xp===8 && e.skill==='学识'),'XP effect failed');
    check(document.querySelector('.mq-experience').textContent.includes('学识'),'Skill experience missing');
    check(document.querySelector('[role="status"]').textContent.includes(chestName),'Chest result not displayed');
    check([...document.querySelectorAll('.mq-card')].some(card=>card.textContent.includes('合成成品') && card.textContent.includes('×2')),'Craft did not produce inventory');
    find('商店').click();await wait(100);
    const deletingCard=()=>[...document.querySelectorAll('.mq-redeem-card')].find(card=>card.textContent.includes('组合奖励'));
    deletingCard().querySelector('.mq-purchase button').click();await wait(120);
    const openMenu=()=>deletingCard().dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:200,clientY:200}));
    openMenu();await wait(80);check(document.querySelector('[role="menu"]'),'Right-click menu missing');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(60);check(!document.querySelector('[role="menu"]'),'Escape did not dismiss menu');
    openMenu();await wait(60);window.confirm=()=>false;find('删除商品').click();await wait(80);check(deletingCard(),'Cancel deleted the product');
    window.confirm=()=>true;openMenu();await wait(60);find('删除商品').click();await wait(120);check(!deletingCard(),'Deleted product remains visible');
    check(JSON.parse(content).products.find(p=>p.name==='组合奖励').deleted,'Delete not persisted');
    find('仓库').click();await wait(100);
    const retained=[...document.querySelectorAll('.mq-card')].find(card=>card.textContent.includes('组合奖励'));
    check(!retained,'Deleting product did not clear owned inventory');
    check(JSON.parse(content).events.some(event=>event.kind==='discard' && event.itemName==='组合奖励' && event.itemQuantity===-1),'Stock deletion not recorded');
    find('委托').click();await wait(80);
    find('进行中').click();await wait(100);
    document.getElementById('result').textContent='PASS: same-tab navigation, task cycles, levels, editable categories, XP, five product effects and atomic use';
}
test().catch(error=>{document.getElementById('result').textContent='FAIL: '+error.message;});
