/* One clock per Trilium window, kept alive outside the render-note lifecycle. */
(() => {
    if(window.TriliumModules?.enabled('x9qOG6S641fS')===false)return;
    const runtimeVersion=3;
    if(window.MyoPomodoro?.runtimeVersion===runtimeVersion)return;
    if(window.MyoPomodoro){if(typeof window.MyoPomodoro.dispose!=='function')return;window.MyoPomodoro.dispose();}
    const key = 'myosotis.pomodoro.v1';
    const defaults = () => ({version:1,settings:{focus:25,short:5,long:15,sound:true,floating:true,dailyGoal:4},mode:'focus',status:'idle',remaining:25*60000,deadline:null,task:'',completed:0,history:[],unread:false,miniPosition:null,commission:null,roundId:null,activity:'',tags:['模电','数电','编程','阅读'],interruptions:0});
    const duration = (state,mode=state.mode) => state.settings[mode]*60000;
    function read() {
        try {
            const value=JSON.parse(localStorage.getItem(key));
            if (!value || value.version!==1 || !['focus','short','long'].includes(value.mode) || !['idle','running','paused','done'].includes(value.status)) return defaults();
            if (!value.settings || ['focus','short','long'].some(mode=>!Number.isInteger(value.settings[mode]) || value.settings[mode]<1 || value.settings[mode]>180)) return defaults();
            if (!Number.isFinite(value.remaining) || value.remaining<0 || value.remaining>duration(value) || !Number.isSafeInteger(value.completed) || value.completed<0 || !Array.isArray(value.history)) return defaults();
            if(value.status==='running' && !Number.isFinite(value.deadline))return defaults();
            value.task=String(value.task || '').slice(0,120);
            value.unread=!!value.unread;
            value.settings.floating=value.settings.floating!==false;
            value.settings.dailyGoal=Number.isInteger(value.settings.dailyGoal) && value.settings.dailyGoal>=1 && value.settings.dailyGoal<=30?value.settings.dailyGoal:4;
            value.tags=Array.isArray(value.tags)?[...new Set(value.tags.filter(tag=>typeof tag==='string' && tag.trim() && tag.length<=40))]:['模电','数电','编程','阅读'];
            value.activity=typeof value.activity==='string'?value.activity.slice(0,40):'';
            if(value.activity && !value.tags.includes(value.activity))value.tags.push(value.activity);
            value.interruptions=Number.isSafeInteger(value.interruptions)?value.interruptions:0;
            value.commission=value.commission && typeof value.commission.id==='string' && typeof value.commission.title==='string'?value.commission:null;
            value.miniPosition=value.miniPosition && Number.isFinite(value.miniPosition.x) && Number.isFinite(value.miniPosition.y)?value.miniPosition:null;
            value.history=value.history.filter(item=>Number.isFinite(item.time) && Number.isFinite(item.minutes) && typeof item.task==='string').map(item=>({...item,activity:typeof item.activity==='string'?item.activity:'',interruptions:Number.isSafeInteger(item.interruptions)?item.interruptions:0})).slice(-10000);
            for(const item of value.history)if(item.commission?.status==='pending' && !item.commission.confirmed)item.commission.status='confirm';
            return value;
        } catch { return defaults(); }
    }
    let state=read(), audio=null, mini=null, drag=null, suppressClick=false, disposed=false, confirmDialog=null, confirmId=null, returnFocus=null;
    let openBoard=()=>{if(typeof api!=='undefined')void api.activateNote('MyoPomoBoard');};
    let commissionApi=typeof api!=='undefined'?api:null, commissionSource=null, syncing=false, nextSync=0;
    const sessionId=()=>`pomo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    async function commissionCall(action,payload={}){
        if(!commissionApi)throw new Error('人升联动服务尚未就绪');
        if(!commissionSource){const note=await commissionApi.getNote('MyoQuestSvc1');if(!note)throw new Error('未找到人升插件');commissionSource=await note.getContent();}
        return commissionApi.runOnBackend(commissionSource,[action,payload]);
    }
    async function syncCommissions(){
        if(disposed || syncing || !commissionApi)return;
        syncing=true;nextSync=Date.now()+15000;
        try{
            for(const record of state.history.filter(item=>item.commission?.status==='pending')){
                const link=record.commission;
                try{
                    let result;
                    for(let attempt=0;attempt<2;attempt++){
                        const data=await commissionCall('load');
                        if(disposed)return;
                        if(data.events.some(event=>event.kind==='complete' && event.requestId===link.requestId)){result=data;break;}
                        const task=data.tasks.find(task=>task.id===link.id);
                        if(!task || task.archived || !task.canComplete){link.status='skipped';link.message=!task?'委托已不存在':task.archived?'委托已归档':'本周期委托已完成';break;}
                        try{result=await commissionCall('complete',{id:link.id,revision:data.revision,requestId:link.requestId,source:'pomodoro',focusedMinutes:record.minutes});break;}
                        catch(failure){if(attempt===1)throw failure;}
                    }
                    if(disposed)return;
                    if(result){const event=result.events.find(event=>event.kind==='complete' && event.requestId===link.requestId);link.status=event?'done':'skipped';link.message=event?`委托完成 · +${event.coins} 金币 · +${event.xp} 经验`:'本周期委托已完成';if(event && typeof window.dispatchEvent==='function')window.dispatchEvent(new Event('myo-quests-changed'));}
                    link.error='';
                }catch(failure){link.error=failure.message || String(failure);}
                publish();
            }
        }finally{syncing=false;}
    }
    const listeners=new Set();
    const snapshot=()=>({...state,settings:{...state.settings},history:[...state.history],tags:[...state.tags],remaining:state.status==='running'?Math.max(0,Math.min(duration(state),state.deadline-Date.now())):state.remaining});
    let storageError='';
    const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));storageError='';}catch{storageError='计时记录暂时无法保存，关闭应用后可能丢失。';}};
    const notify=()=>{if(disposed)return;listeners.forEach(listener=>listener(snapshot()));renderMini();renderConfirmation();};
    const publish=()=>{save();notify();};
    function unlockAudio() {
        if(!state.settings.sound)return;
        try{const Context=window.AudioContext || window.webkitAudioContext;if(Context){audio ||= new Context();audio.resume().catch(()=>{});}}catch{}
    }
    function alarm() {
        if(state.settings.sound && audio)try{
            for(let i=0;i<3;i++){const oscillator=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+i*.35;oscillator.frequency.value=660;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.12,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.22);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(at);oscillator.stop(at+.25);}
        }catch{}
        document.getElementById('myo-pomodoro-alert')?.remove();
        const banner=document.createElement('button');banner.id='myo-pomodoro-alert';banner.className='mp-alert';banner.type='button';
        banner.textContent=state.mode==='focus'?'本轮专注完成，休息一下吧。':'休息结束，可以开始下一轮专注了。';
        banner.onclick=()=>{banner.remove();window.MyoPomodoro.acknowledge();openBoard();};
        document.body.appendChild(banner);window.setTimeout(()=>banner.remove(),15000);
    }
    function tick() {
        if(disposed)return;
        if(state.status==='running' && state.deadline<=Date.now()){
            const finishedAt=state.deadline;
            state.remaining=0;state.deadline=null;state.status='done';state.unread=true;
            if(state.mode==='focus'){state.completed++;state.history.push({time:finishedAt,minutes:state.settings.focus,task:state.task,activity:state.activity,interruptions:state.interruptions,commission:state.commission?{...state.commission,requestId:state.roundId || sessionId(),status:'confirm'}:null});state.history=state.history.slice(-10000);}
            publish();alarm();
        }
        notify();
        if(Date.now()>=nextSync && state.history.some(item=>item.commission?.status==='pending'))void syncCommissions();
    }
    function renderMini(){
        if(typeof document.querySelector!=='function' || !document.body)return;
        if(!mini || !mini.isConnected){
            mini=document.createElement('section');mini.id='myo-pomodoro-mini';mini.className='mp-mini';mini.setAttribute('aria-label','番茄钟小窗口');
            mini.innerHTML='<button type="button" class="mp-mini-open" aria-label="打开番茄钟"><span class="mp-mini-label"></span><b class="mp-mini-time"></b></button><button type="button" class="mp-mini-action"></button><span class="mp-mini-hint" role="status"></span>';
            const handle=mini.querySelector('.mp-mini-open');
            handle.title='拖动调整位置，点击打开番茄钟';
            handle.onclick=event=>{if(suppressClick){event.preventDefault();return;}window.MyoPomodoro.acknowledge();openBoard();};
            handle.addEventListener('pointerdown',event=>{
                if(event.button!==0 || !event.isPrimary)return;
                const rect=mini.getBoundingClientRect();
                drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:rect.left,y:rect.top,moved:false};
                handle.setPointerCapture(event.pointerId);
            });
            handle.addEventListener('pointermove',event=>{
                if(!drag || drag.id!==event.pointerId)return;
                const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
                if(!drag.moved && Math.hypot(dx,dy)<4)return;
                drag.moved=true;suppressClick=true;event.preventDefault();
                placeMini({x:drag.x+dx,y:drag.y+dy});
            });
            const finish=event=>{
                if(!drag || drag.id!==event.pointerId)return;
                if(drag.moved){const rect=mini.getBoundingClientRect();state.miniPosition={x:rect.left,y:rect.top};save();}
                drag=null;
                if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
                window.setTimeout(()=>{suppressClick=false;},300);
            };
            handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
            mini.querySelector('.mp-mini-action').onclick=()=>{const clock=window.MyoPomodoro;if(state.status==='done'){clock.next(state.mode==='focus'?'short':'focus');clock.start();}else if(state.status==='running')clock.pause();else clock.start();};
            document.body.appendChild(mini);
        }
        const current=snapshot(),done=current.status==='done';
        mini.hidden=current.status==='idle' || !current.settings.floating;
        mini.classList.toggle('mp-mini-done',done);
        mini.querySelector('.mp-mini-label').title=current.activity || '未分类';mini.querySelector('.mp-mini-label').textContent=current.mode==='focus'?('专注'+(current.activity?' · '+current.activity:'')):current.mode==='long'?'长休息':'休息';
        const seconds=Math.ceil(current.remaining/1000);
        mini.querySelector('.mp-mini-time').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
        const action=mini.querySelector('.mp-mini-action');
        action.textContent=done?(current.mode==='focus'?`休息 ${current.settings.short} 分钟`:'下一轮'):current.status==='running'?'暂停':'继续';
        action.setAttribute('aria-label',done?(current.mode==='focus'?'开始短休息':'开始下一轮专注'):current.status==='running'?'暂停计时':'继续计时');
        const lastLink=current.mode==='focus' && done?current.history.at(-1)?.commission:null;
        mini.querySelector('.mp-mini-hint').textContent=lastLink?(lastLink.status==='done'?'委托已完成，奖励已领取':['confirm','deferred'].includes(lastLink.status)?'专注完成，等待确认委托':lastLink.status==='pending'?'专注完成，委托待同步':lastLink.message):done?(current.mode==='focus'?'专注完成，休息一下':'休息结束，准备下一轮'):current.status==='paused'?'已暂停':'';
        if(!drag && !mini.hidden && state.miniPosition)placeMini(state.miniPosition);
        document.querySelectorAll('#launcher-pane .mp-pomodoro-entry, #launcher-pane .launcher-button.bx-timer, #launcher-pane .launcher-button .bx-timer').forEach(icon=>{
            const button=icon.closest('button') || icon;
            button.classList.add('mp-pomodoro-launcher');
            button.classList.toggle('mp-unread',current.unread);
        });
    }
    function placeMini(position){
        mini.style.left=`${Math.max(8,Math.min(position.x,window.innerWidth-mini.offsetWidth-8))}px`;
        mini.style.top=`${Math.max(8,Math.min(position.y,window.innerHeight-mini.offsetHeight-8))}px`;
        mini.style.right='auto';mini.style.bottom='auto';
    }
    function renderConfirmation(){
        if(typeof document.querySelector!=='function' || !document.body)return;
        const record=state.history.find(item=>item.commission?.status==='confirm');
        if(!record){if(confirmDialog){confirmDialog.remove();confirmDialog=null;confirmId=null;if(returnFocus?.isConnected)returnFocus.focus();}return;}
        if(confirmDialog?.isConnected && confirmId===record.commission.requestId)return;
        confirmDialog?.remove();returnFocus=document.activeElement;confirmId=record.commission.requestId;
        confirmDialog=document.createElement('div');confirmDialog.className='mp-confirm-backdrop';
        confirmDialog.innerHTML='<section class="mp-confirm" role="dialog" aria-modal="true" aria-labelledby="mp-confirm-title"><h2 id="mp-confirm-title">专注完成</h2><p class="mp-confirm-task"></p><p>已完成 25 分钟专注，确认完成这次人升委托吗？</p><footer><button type="button" class="mp-confirm-later">稍后</button><button type="button" class="mp-confirm-submit">完成委托并领取奖励</button></footer></section>';
        confirmDialog.querySelector('.mp-confirm-task').textContent=record.commission.title;
        confirmDialog.querySelector('.mp-confirm-submit').onclick=()=>window.MyoPomodoro.confirmCommission(record.commission.requestId);
        const later=()=>{record.commission.status='deferred';publish();};
        confirmDialog.querySelector('.mp-confirm-later').onclick=later;
        confirmDialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();later();}if(event.key==='Tab'){event.preventDefault();const buttons=[...confirmDialog.querySelectorAll('button')];const index=buttons.indexOf(document.activeElement);buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}});
        document.body.appendChild(confirmDialog);confirmDialog.querySelector('.mp-confirm-submit').focus();
    }
    window.MyoPomodoro={
        runtimeVersion,
        dispose(){if(disposed)return;save();disposed=true;window.clearInterval?.(timer);for(const [target,name,listener] of handlers)target.removeEventListener?.(name,listener);listeners.clear();mini?.remove();confirmDialog?.remove();document.getElementById('myo-pomodoro-alert')?.remove();audio?.close?.().catch(()=>{});},
        snapshot,error:()=>storageError,
        setOpener(callback){if(typeof callback==='function')openBoard=callback;},
        setCommissionApi(value){commissionApi=value;void syncCommissions();},
        async loadCommissions(){const data=await commissionCall('load');return data.tasks.filter(task=>!task.archived && task.canComplete && /模电/.test(task.title) && /25/.test(task.title));},
        linkCommission(task){if(state.status!=='idle')return;state.commission=task?{id:task.id,title:task.title}:null;if(task){state.task=task.title;state.settings.focus=25;if(state.mode==='focus')state.remaining=25*60000;}publish();},
        retryCommissions(){nextSync=0;return syncCommissions();},
        confirmCommission(requestId){const record=state.history.find(item=>item.commission?.requestId===requestId);if(!record || !['confirm','deferred'].includes(record.commission.status))return;record.commission.confirmed=true;record.commission.status='pending';publish();void syncCommissions();},
        showConfirmation(requestId){const record=state.history.find(item=>item.commission?.requestId===requestId);if(record?.commission.status==='deferred'){record.commission.status='confirm';publish();}},
        acknowledge(){if(state.unread){state.unread=false;publish();}},
        subscribe(listener){listeners.add(listener);listener(snapshot());return()=>listeners.delete(listener);},
        start(){tick();if(state.status==='running' || state.status==='done')return;if(state.status==='idle' && state.mode==='focus'){state.roundId=sessionId();state.interruptions=0;}unlockAudio();state.unread=false;state.deadline=Date.now()+state.remaining;state.status='running';document.getElementById('myo-pomodoro-alert')?.remove();publish();},
        pause(){tick();if(state.status!=='running')return;if(state.mode==='focus')state.interruptions++;state.remaining=snapshot().remaining;state.deadline=null;state.status='paused';publish();},
        reset(){state.status='idle';state.unread=false;state.deadline=null;state.remaining=duration(state);document.getElementById('myo-pomodoro-alert')?.remove();publish();},
        select(mode){if(!['focus','short','long'].includes(mode) || state.status==='running' || state.status==='paused')return;state.mode=mode;state.status='idle';state.deadline=null;state.remaining=duration(state);publish();},
        next(mode){if(state.status!=='done')return;const proposed=state.mode==='focus'?(state.completed%4===0?'long':'short'):'focus';state.mode=['focus','short','long'].includes(mode)?mode:proposed;state.unread=false;state.status='idle';state.remaining=duration(state);publish();},
        activity(value){if(state.status!=='idle')return;const name=String(value).trim();if(name && !state.tags.includes(name))throw new Error('请选择已有活动标签');state.activity=name;publish();},
        addTag(value){const name=String(value).trim();if(!name || name.length>40 || name==='未分类')throw new Error('标签须为 1～40 字，不能使用“未分类”');if(!state.tags.includes(name))state.tags.push(name);publish();},
        renameTag(old,value){const name=String(value).trim();if(!state.tags.includes(old))return;if(!name || name.length>40 || name==='未分类')throw new Error('标签须为 1～40 字，不能使用“未分类”');if(name!==old && state.tags.includes(name))throw new Error('该标签已存在');state.tags=state.tags.map(tag=>tag===old?name:tag);if(state.activity===old)state.activity=name;state.history=state.history.map(item=>item.activity===old?{...item,activity:name}:item);publish();},
        removeTag(name){if(state.activity===name && ['running','paused'].includes(state.status))throw new Error('本轮正在使用这个标签，请结束后再删除');state.tags=state.tags.filter(tag=>tag!==name);if(state.activity===name)state.activity='';publish();},
        recordActivity(time,value){const name=String(value);if(name && !state.tags.includes(name))throw new Error('请选择已有活动标签');state.history=state.history.map(item=>item.time===time?{...item,activity:name}:item);publish();},
        task(value){if(state.status==='idle'){state.task=String(value).slice(0,120);publish();}},
        settings(values){if(state.commission && values.focus!==25)throw new Error('关联模电委托时专注时长固定为 25 分钟');if(['running','paused'].includes(state.status) && ['focus','short','long'].some(mode=>values[mode]!==state.settings[mode]))throw new Error('请先结束当前计时再调整时长');if(['focus','short','long'].some(mode=>!Number.isInteger(values[mode]) || values[mode]<1 || values[mode]>180))throw new Error('时长须为 1～180 分钟的整数');if(values.dailyGoal!==undefined && (!Number.isInteger(values.dailyGoal) || values.dailyGoal<1 || values.dailyGoal>30))throw new Error('每日目标须为 1～30 轮');state.settings={dailyGoal:values.dailyGoal ?? state.settings.dailyGoal,focus:values.focus,short:values.short,long:values.long,sound:!!values.sound,floating:values.floating ?? state.settings.floating};if(state.status==='idle')state.remaining=duration(state);publish();},
        tick
    };
    const handlers=[[window,'storage',event=>{if(event.key===key){state=read();tick();}}],[window,'focus',tick],[window,'resize',()=>renderMini()],[document,'visibilitychange',tick]];
    for(const [target,name,listener] of handlers)target.addEventListener(name,listener);
    const timer=window.setInterval(tick,500);
    tick();
})();
