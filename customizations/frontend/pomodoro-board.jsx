/*
Apex Dashboard adaptation — https://github.com/PandoraReads/apex-dashboard
Source revision: 556a33e110e55946dcd6d3dde7c2f72a65585ccf
MIT License

Copyright (c) 2025 PandoraReads

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
import { useEffect, useState } from 'trilium:preact';

const modes={focus:'专注',short:'短休息',long:'长休息'};
const format=ms=>{const seconds=Math.ceil(ms/1000);return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
const dateKey=time=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
// Adapted from Apex Dashboard (MIT), PandoraReads: activity color hashing,
// SVG donut segmentation and the 12-week activity heatmap. See THIRD_PARTY_NOTICES.md.
const activityColor=name=>{const palette=['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#00bcd4','#ff7043'];let hash=0;for(let i=0;i<name.length;i++)hash=((hash<<5)-hash+name.charCodeAt(i))|0;return palette[Math.abs(hash)%palette.length];};
const dayOffset=(key,offset)=>dateKey(new Date(key+'T12:00:00+08:00').getTime()+offset*86400000);
function ActivityManager({clock,state}){
    const [name,setName]=useState(''),[failure,setFailure]=useState('');
    const act=callback=>{try{callback();setFailure('');}catch(error){setFailure(error.message);}};
    return <section className="mp-tag-manager"><h2>管理活动标签</h2><form onSubmit={event=>{event.preventDefault();act(()=>{clock.addTag(name);setName('');});}}><input aria-label="新活动标签" required maxLength={40} value={name} placeholder="例如：模电、英语、运动" onInput={event=>setName(event.target.value)}/><button>添加</button></form><div className="mp-managed-tags">{state.tags.map(tag=><ActivityTagRow key={tag} tag={tag} rename={value=>act(()=>clock.renameTag(tag,value))} remove={()=>act(()=>{if(window.confirm('从可选标签中移除“'+tag+'”？已有专注记录仍保留此活动。'))clock.removeTag(tag);})}/>)}</div>{failure && <p role="alert" className="mp-error">{failure}</p>}<small>重命名会更新历史标签；删除保留历史。旧记录可在专注记录中补选标签。</small></section>;
}
function ActivityTagRow({tag,rename,remove}){
    const [value,setValue]=useState(tag);
    return <form onSubmit={event=>{event.preventDefault();rename(value);}}><span className="mp-color-dot" style={{background:activityColor(tag)}}/><input aria-label={'重命名活动 '+tag} maxLength={40} required value={value} onInput={event=>setValue(event.target.value)}/><button disabled={value===tag}>重命名</button><button type="button" onClick={remove}>删除</button></form>;
}
function FocusDashboard({state}){
    const [range,setRange]=useState('day'),[filter,setFilter]=useState(''),[hover,setHover]=useState(null),[selectedDay,setSelectedDay]=useState('');
    const now=Date.now(),todayKey=dateKey(now),weekday=new Date(todayKey+'T12:00:00+08:00').getUTCDay();
    const start=range==='week'?dayOffset(todayKey,-((weekday+6)%7)):range==='month'?todayKey.slice(0,8)+'01':range==='all'?'0000-00-00':todayKey;
    const history=state.history.filter(item=>item.time<=now),today=history.filter(item=>dateKey(item.time)===todayKey);
    const ranged=history.filter(item=>dateKey(item.time)>=start),grouped=new Map();
    for(const item of ranged){const name=item.activity || '未分类';grouped.set(name,(grouped.get(name)||0)+item.minutes);}
    const groups=[...grouped].sort((a,b)=>b[1]-a[1]),total=groups.reduce((sum,[,minutes])=>sum+minutes,0);
    const filtered=history.filter(item=>!filter || (item.activity || '未分类')===filter),daily=new Map();
    for(const item of filtered){const key=dateKey(item.time);daily.set(key,(daily.get(key)||0)+item.minutes);}
    const days=Array.from({length:84},(_,i)=>({key:dayOffset(todayKey,i-83),minutes:daily.get(dayOffset(todayKey,i-83))||0}));
    const trend=days.slice(-7),maximum=Math.max(25,...trend.map(day=>day.minutes));
    const totalMinutes=today.reduce((sum,item)=>sum+item.minutes,0),goal=state.settings.dailyGoal || 4;
    let offset=0;const circumference=2*Math.PI*74;
    const timeline=filtered.filter(item=>dateKey(item.time)===(selectedDay || todayKey));
    return <section className="mp-dashboard" aria-label="活动统计"><header><h2>专注足迹</h2><nav aria-label="统计周期">{Object.entries({day:'今日',week:'本周',month:'本月',all:'全部'}).map(([key,label])=><button key={key} aria-pressed={range===key} onClick={()=>{setRange(key);setHover(null);}}>{label}</button>)}</nav></header>
        <div className="mp-summary" aria-label="今日专注统计"><div><strong>{today.length}</strong><small>今日完成</small></div><div><strong>{totalMinutes}<em> 分钟</em></strong><small>今日专注</small></div><div><strong>{today.length}<em> / {goal} 轮</em></strong><small>每日目标</small><progress aria-label="每日专注目标" max={goal} value={Math.min(goal,today.length)}/></div></div>
        <div className="mp-dashboard-grid"><section className="mp-chart-card"><h2>{({day:'今日',week:'本周',month:'本月',all:'全部'})[range]}活动分布</h2><div className="mp-distribution"><svg className="mp-donut" viewBox="0 0 200 200" role="img" aria-label={'活动分布，共 '+total+' 分钟'}><circle cx="100" cy="100" r="74" fill="none" stroke="var(--main-border-color,#e7e8ef)" stroke-width="26"/>{groups.map(([name,minutes])=>{const length=circumference*minutes/total,position=offset;offset+=length;return <circle key={name} cx="100" cy="100" r="74" fill="none" stroke={activityColor(name)} stroke-width={hover?.name===name?32:26} stroke-dasharray={`${Math.max(0,length-(groups.length>1?3:0))} ${circumference-Math.max(0,length-(groups.length>1?3:0))}`} stroke-dashoffset={-position} transform="rotate(-90 100 100)" onMouseEnter={()=>setHover({name,minutes})} onMouseLeave={()=>setHover(null)}><title>{name+' · '+minutes+' 分钟 · '+(100*minutes/total).toFixed(1)+'%'}</title></circle>;})}<text x="100" y="98" text-anchor="middle" className="mp-donut-value">{hover?hover.minutes:total}</text><text x="100" y="120" text-anchor="middle" className="mp-donut-caption">{hover?hover.name:'专注分钟'}</text></svg><div className="mp-chart-legend">{groups.length?groups.map(([name,minutes])=><button key={name} aria-pressed={filter===name} onFocus={()=>setHover({name,minutes})} onBlur={()=>setHover(null)} onClick={()=>setFilter(filter===name?'':name)}><span className="mp-color-dot" style={{background:activityColor(name)}}/><span>{name}</span><small>{minutes} 分钟 · {(100*minutes/total).toFixed(1)}%</small></button>):<p>完成一轮专注，让今天留下第一笔。</p>}</div></div></section>
        <section className="mp-chart-card"><header><h2>近 7 天趋势</h2>{filter && <button className="mp-clear-filter" onClick={()=>setFilter('')}>{filter} ×</button>}</header><div className="mp-trend">{trend.map(day=><div key={day.key} title={day.key+' · '+day.minutes+' 分钟'}><small>{day.minutes || ''}</small><div className="mp-trend-track"><span style={{height:Math.max(day.minutes?3:0,100*day.minutes/maximum)+'%',background:filter?activityColor(filter):'#6874cc'}}/></div><small>{day.key.slice(5)}</small></div>)}</div><p className="mp-chart-note">仅统计已完成的专注，休息和暂停不计入时长。</p></section></div>
        <section className="mp-chart-card mp-heatmap-card"><header><h2>12 周热力图{filter?' · '+filter:''}</h2><small>{days[0].key} — {todayKey}</small></header><div className="mp-heatmap">{days.map(day=><button type="button" key={day.key} className={'mp-heat-cell mp-heat-'+(day.minutes===0?0:day.minutes<=15?1:day.minutes<=45?2:3)} title={day.key+' · '+day.minutes+' 分钟'} aria-label={day.key+'，专注 '+day.minutes+' 分钟'} aria-pressed={selectedDay===day.key} onClick={()=>setSelectedDay(day.key)}/>)}</div><div className="mp-heat-legend"><span>少</span>{[0,1,2,3].map(level=><i key={level} className={'mp-heat-cell mp-heat-'+level}/>)}<span>多 · 分钟</span><button onClick={()=>setSelectedDay('')}>查看今日</button></div></section>
        <section className="mp-chart-card mp-timeline"><h2>{selectedDay && selectedDay!==todayKey?selectedDay:'今日'}活动时间线</h2>{timeline.length?<ol>{timeline.map((item,i)=><li key={i}><time>{new Date(item.time).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false})}</time><span className="mp-color-dot" style={{background:activityColor(item.activity || '未分类')}}/><div><b>{item.activity || '未分类'}</b><small>{item.task || '专注一轮'}</small></div><span>{item.minutes} 分钟{item.interruptions?' · 暂停 '+item.interruptions+' 次':''}</span></li>)}</ol>:<p>这一天还没有完成的专注记录。</p>}</section>
    </section>;
}
export default function PomodoroBoard(){
    const [clock,setClock]=useState(null),[state,setState]=useState(null),[error,setError]=useState(''),[settings,setSettings]=useState(null);
    const [commissions,setCommissions]=useState([]),[linkError,setLinkError]=useState(''),[manageTags,setManageTags]=useState(false);
    useEffect(()=>{
        let alive=true,unsubscribe;
        (async()=>{
            if(!window.MyoPomodoro || (window.MyoPomodoro.runtimeVersion!==3 && typeof window.MyoPomodoro.dispose==='function')){const note=await api.getNote('MyoPomoRun1');if(!note)throw new Error('番茄钟组件未安装');new Function(await note.getContent())();}
            if(alive){const service=window.MyoPomodoro;service.setOpener?.(()=>api.activateNote('MyoPomoBoard'));service.setCommissionApi?.(api);service.acknowledge?.();setClock(service);unsubscribe=service.subscribe(setState);if(typeof service.loadCommissions!=='function' || typeof service.confirmCommission!=='function'){setLinkError('当前仍在使用旧计时服务，请重启 Trilium 后启用委托联动。计时记录会保留。');return;}try{const tasks=await service.loadCommissions();if(alive)setCommissions(tasks);}catch(failure){if(alive)setLinkError(failure.message || String(failure));}}
        })().catch(failure=>{if(alive)setError(failure.message || String(failure));});
        return()=>{alive=false;unsubscribe?.();};
    },[]);
    if(!state)return <main className="myo-pomodoro"><h1>番茄钟</h1><p>{error || '正在加载…'}</p></main>;
    const active=['running','paused'].includes(state.status);
    const canLink=typeof clock.linkCommission==='function' && typeof clock.setCommissionApi==='function' && typeof clock.confirmCommission==='function';
    const total=state.settings[state.mode]*60000;
    const nextMode=state.mode==='focus'?(state.completed%4===0?'long':'short'):'focus';
    const roundProgress=state.completed%4 || (state.completed && (state.mode!=='focus' || state.status==='done')?4:0);
    const reset=()=>{if(!active || window.confirm('重置本轮计时？未完成的专注不会计入记录。'))clock.reset();};
    return <main className="myo-pomodoro">
        <header className="mp-header"><div><small>FOCUS · ONE THING AT A TIME</small><h1>番茄钟</h1><p>一次只做一件事，完成一轮，再好好休息。</p></div><button onClick={()=>{setSettings(settings?null:{...state.settings});setError('');}}>设置</button></header>
        <div className="mp-workspace"><section className={'mp-timer mp-mode-'+state.mode}>
            <nav aria-label="计时模式">{Object.entries(modes).map(([mode,label])=><button key={mode} disabled={active} aria-pressed={state.mode===mode} onClick={()=>clock.select(mode)}>{label}</button>)}</nav>
<div className="mp-link"><label>关联人升委托<select aria-label="关联人升委托" disabled={!canLink || state.status!=='idle'} value={state.commission?.id || ''} onChange={event=>{clock.linkCommission(commissions.find(task=>task.id===event.target.value) || null);setSettings(null);}}><option value="">独立专注，不完成委托</option>{state.commission && !commissions.some(task=>task.id===state.commission.id) && <option value={state.commission.id}>{state.commission.title}</option>}{commissions.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label><small>{state.commission?'完整专注 25 分钟后弹窗，手动确认完成委托并领取奖励。':linkError || '可选择学习模电 25 分钟的委托。'}</small><button type="button" disabled={!canLink || active} onClick={async()=>{try{setCommissions(await clock.loadCommissions());setLinkError('');}catch(failure){setLinkError(failure.message || String(failure));}}}>刷新委托</button></div>
            <div className="mp-activity"><label>活动标签<select aria-label="活动标签" value={state.activity || ''} disabled={state.status!=='idle' || !clock.activity} onChange={event=>clock.activity(event.target.value)}><option value="">未分类</option>{(state.tags || []).map(tag=><option key={tag} value={tag}>{tag}</option>)}</select></label><button type="button" onClick={()=>setManageTags(!manageTags)}>管理标签</button></div>
            <label className="mp-task">这一轮想完成什么？<input aria-label="专注内容" maxLength={120} placeholder="例如：整理一个模电知识点" value={state.task} disabled={state.status!=='idle'} onInput={event=>clock.task(event.target.value)}/></label>
            <div className="mp-clock" role="timer" aria-label="剩余时间">{format(state.remaining)}</div>
            <p className="mp-status" role="status">{state.status==='done'?(state.mode==='focus'?'完成了，给这份努力一个肯定。':'休息结束，准备好再继续。'):state.status==='paused'?'已暂停，准备好后继续。':state.status==='running'?(state.mode==='focus'?'专注中，慢慢把这一件事做好。':'休息中，让自己恢复一点精力。'):'准备好就开始。'}</p>
            <progress aria-label="本轮进度" max={total} value={total-state.remaining}/>
            <div className="mp-controls">{state.status==='done'?<button className="mp-primary" onClick={()=>{clock.next();clock.start();}}>开始{modes[nextMode]}</button>:<button className="mp-primary" onClick={()=>state.status==='running'?clock.pause():clock.start()}>{state.status==='running'?'暂停':state.status==='paused'?'继续':'开始'+modes[state.mode]}</button>}<button onClick={reset}>重置</button></div>
            <div className="mp-rounds" aria-label="长休息周期">{[0,1,2,3].map(i=><span key={i} className={i<roundProgress?'filled':''}>●</span>)}<small>每完成 4 轮专注，安排一次长休息</small></div>
        </section>
        <aside className="mp-session-note"><small>ONE SESSION</small><h2>{state.activity || '未分类活动'}</h2><p>{state.task || '选择活动标签，让每一轮专注都有迹可循。'}</p><span className="mp-color-dot" style={{background:activityColor(state.activity || '未分类')}}/><small>活动统计与人升奖励独立记录</small></aside></div>
        {manageTags && clock.addTag && <ActivityManager clock={clock} state={state}/>}
        {(error || clock.error()) && <p className="mp-error" role="alert">{error || clock.error()}</p>}
{settings && <form className="mp-settings" onSubmit={event=>{event.preventDefault();try{clock.settings(settings);setSettings(null);setError('');}catch(failure){setError(failure.message);}}}><h2>计时设置</h2><div className="mp-fields">{Object.entries(modes).map(([mode,label])=><label key={mode}>{label} · 分钟<input aria-label={label+'时长'} type="number" min="1" max="180" step="1" required disabled={active || (mode==='focus' && !!state.commission)} value={settings[mode]} onInput={event=>{const value=Number(event.target.value);setSettings(current=>({...current,[mode]:value}));}}/></label>)}</div><label className="mp-goal-setting">每日目标 · 轮<input aria-label="每日专注目标轮数" type="number" min="1" max="30" required value={settings.dailyGoal || 4} onInput={event=>setSettings(current=>({...current,dailyGoal:Number(event.target.value)}))}/></label><label className="mp-sound"><input type="checkbox" checked={settings.sound} onChange={event=>setSettings(current=>({...current,sound:event.target.checked}))}/>结束提示音</label><label className="mp-sound"><input aria-label="显示悬浮小窗" type="checkbox" checked={settings.floating} onChange={event=>setSettings(current=>({...current,floating:event.target.checked}))}/>显示悬浮小窗</label><p>{active?'计时中可调整提示音和小窗开关；时长需结束或重置后调整。':'1～180 分钟。下一轮需手动开始。'}</p><button className="mp-primary">保存设置</button></form>}
        <FocusDashboard state={state}/>
        <section className="mp-history"><h2>最近的专注</h2>{state.history.length?<ul>{[...state.history].reverse().slice(0,8).map((item,i)=><li key={i}><div><b>{item.task || '专注一轮'}</b>{clock.recordActivity && <select className="mp-record-tag" aria-label={'记录活动标签 '+item.time} value={item.activity || ''} onChange={event=>clock.recordActivity(item.time,event.target.value)}><option value="">未分类</option>{item.activity && !(state.tags || []).includes(item.activity) && <option value={item.activity}>{item.activity}</option>}{(state.tags || []).map(tag=><option key={tag} value={tag}>{tag}</option>)}</select>}<small>{new Date(item.time).toLocaleString('zh-CN',{hour12:false})}</small>{item.commission && <small>{['confirm','deferred'].includes(item.commission.status)?'等待手动确认完成委托':item.commission.status==='pending'?(item.commission.error?'委托待同步：'+item.commission.error:'正在同步人升委托…'):item.commission.message}</small>}{['confirm','deferred'].includes(item.commission?.status) && <button type="button" onClick={()=>clock.showConfirmation(item.commission.requestId)}>确认完成委托</button>}</div><span>{item.minutes} 分钟</span></li>)}</ul>:<p>完成第一轮专注后，在这里留下记录。</p>}{state.history.some(item=>item.commission?.status==='pending') && <button type="button" onClick={()=>void clock.retryCommissions()}>重试委托同步</button>}</section>
        <p className="mp-footnote">切换笔记会继续计时。关闭应用期间按时间计算，重新打开后核对本轮；应用关闭时无法发出提醒。记录保存在本机。</p>
    </main>;
}
