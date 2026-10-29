function hardwareQuizService(action, payload = {}) {
    if(api.getNote('MyoMarketData')?.getJsonContent()?.plugins.find(p=>p.id==='hardware-quiz')?.enabled===false)throw Error('该插件已关闭，请在插件管理器中开启。');
    /* NOWCODER_FORMAT_START */
// Portable data only: no imported HTML, remote resources, or executable formula markup.
function nowcoderPackageTools() {
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mathTags=new Set('math mrow mi mn mo mtext mspace ms mfrac msqrt mroot msub msup msubsup mover munder munderover mmultiscripts mprescripts none mtable mtr mtd menclose mfenced mstyle mpadded mphantom'.split(' '));
  const mathAttrs=new Set('display mathvariant stretchy fence separator accent accentunder linethickness columnalign rowalign columnspacing rowspacing notation open close separators width height depth lspace voffset'.split(' '));
  const fail=s=>{throw Error(s);};
  const text=(v,max=20000)=>typeof v==='string'&&v.length<=max?v:fail('网页题目文字格式或长度无效');
  function math(node,depth=0){
    if(depth>32)fail('公式层级过深');
    if(typeof node==='string')return text(node,4000);
    if(!node||!mathTags.has(node.tag)||!Array.isArray(node.children)||node.children.length>500)fail('公式格式无效');
    const attrs={};for(const [k,v] of Object.entries(node.attrs||{})){if(!mathAttrs.has(k)||typeof v!=='string'||! /^[\w\s.,+−\-()%]*$/.test(v)||v.length>100)fail('公式属性无效');attrs[k]=v;}
    return {tag:node.tag,attrs,children:node.children.map(n=>math(n,depth+1))};
  }
  function blocks(value){
    if(!Array.isArray(value)||value.length>1000)fail('题目富文本格式无效');
    return value.map(b=>{
      if(b?.kind==='text')return {kind:'text',text:text(b.text)};
      if(b?.kind==='math')return {kind:'math',tree:math(b.tree),text:text(b.text||'',4000)};
      if(b?.kind==='image'){
        if(typeof b.data!=='string'||b.data.length>2800000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(b.data))fail('题图必须是包内 PNG、JPEG 或 WebP（单张不超过 2 MB）');
        const raw=b.data.split(',')[1];
        if(!(b.data.startsWith('data:image/png;')&&raw.startsWith('iVBORw0KGgo')||b.data.startsWith('data:image/jpeg;')&&raw.startsWith('/9j/')||b.data.startsWith('data:image/webp;')&&raw.startsWith('UklGR')))fail('题图文件头不匹配');
        return {kind:'image',data:b.data,alt:text(b.alt||'题图',300)};
      }
      fail('无法识别的题目内容');
    });
  }
  const plain=bs=>bs.map(b=>b.kind==='text'?b.text:b.kind==='math'?b.text:'[题图]').join('').trim();
  const normalize=s=>String(s||'').normalize('NFC').replace(/\s+/g,' ').trim();
  const blockKey=bs=>JSON.stringify(bs.map(b=>b.kind==='text'?['t',normalize(b.text)]:b.kind==='image'?['i',b.data]:['m',b.tree]));
  const contentKey=(q,field,option)=>{
    const bs=option?option.rich:q.rich?.[field];
    // Text-only exports must deduplicate against ordinary imported questions too.
    return bs?.some(b=>b.kind!=='text')?blockKey(bs):normalize(option?option.text:q[field]);
  };
  const signature=q=>JSON.stringify([contentKey(q,'stem'),q.type==='multi'?'multi':q.type==='self'?'self':'single',(q.options||[]).map(o=>contentKey(q,'',o)).sort(),q.images||[]]);
  function validate(input){
    if(!input||input.format!=='nowcoder-visible-quiz'||input.version!==1||!Array.isArray(input.questions)||!input.questions.length||input.questions.length>100)fail('请选择导出助手生成的题目包（每包 1～100 题）');
    if(JSON.stringify(input).length>20*1024*1024)fail('题目包不能超过 20 MB');
    return input.questions.map((q,i)=>{
      if(!q||!['single','multi','self'].includes(q.type))fail('题型无效');
      const stem=text(q.stem);if(!stem.trim())fail('题干不能为空');
      const sourceId=q.sourceId===null?null:text(q.sourceId,80);if(sourceId!==null&&!/^[a-zA-Z0-9_-]+$/.test(sourceId))fail('来源题号无效');
      const sourceUrl=text(q.sourceUrl,500);if(!/^https:\/\/www\.nowcoder\.com\/(questionTerminal\/[a-zA-Z0-9_-]+|exam\/test\/[0-9]+\/(detail|intelligent))$/.test(sourceUrl))fail('来源页面地址无效');
      const capturedAt=text(q.capturedAt,40);if(!Number.isFinite(Date.parse(capturedAt)))fail('保存时间无效');
      if(!Array.isArray(q.options)||q.options.length>8||q.type!=='self'&&q.options.length<2)fail('选择题需有 2～8 个选项');
      const options=q.options.map(o=>{if(!o||! /^[A-H]$/.test(o.key))fail('选项编号无效');const value={key:o.key,text:text(o.text)};if(o.rich)value.rich=blocks(o.rich);if(!value.text.trim())fail('选项不能为空');return value;});
      if(new Set(options.map(o=>o.key)).size!==options.length)fail('选项编号重复');
      if(!Array.isArray(q.answer)||q.answer.some(k=>!options.some(o=>o.key===k))||q.type==='single'&&q.answer.length>1||q.type==='self'&&q.answer.length)fail('参考答案无效');
      const rich={stem:blocks(q.rich?.stem||[{kind:'text',text:stem}]),explanation:blocks(q.rich?.explanation||[{kind:'text',text:q.explanation||''}])};
      if(plain(rich.stem)!==stem.trim()||plain(rich.explanation)!==(q.explanation||'').trim()||options.some(o=>o.rich&&plain(o.rich)!==o.text.trim()))fail('文字与题图/公式内容不一致，请重新保存网页');
      return {stem,type:q.type,options,answer:[...new Set(q.answer)].sort(),explanation:text(q.explanation||''),rich,sourceId,sourceUrl,capturedAt,number:i+1};
    });
  }
  function plan(input,existing,overrides={}){
    const incoming=validate(input),bySource=new Map(),byContent=new Map(),items=[],virtual=[...existing];
    const register=q=>{for(const s of q.webSources||[])if(s.sourceId)bySource.set(s.sourceId,q);const key=signature(q);if(!byContent.has(key))byContent.set(key,q);};
    existing.forEach(register);
    for(const q of incoming){
      const old=q.sourceId?bySource.get(q.sourceId):null,target=old||byContent.get(signature(q));
      if(target){
        if(signature(target)!==signature(q)){items.push({status:'conflict',q,targetId:target.id,reason:'来源题号相同，但题干、题型、选项或题图不同'});continue;}
        const mapping=new Map(q.options.map(o=>[o.key,target.options.filter(t=>contentKey(q,'',o)===contentKey(target,'',t))]));
        const mapped=q.answer.map(k=>mapping.get(k));
        if(mapped.some(a=>a.length!==1)){items.push({status:'conflict',q,targetId:target.id,reason:'选项重复，无法确定参考答案对应关系'});continue;}
        const answer=mapped.map(a=>a[0].key).sort(),protectedAnswer=Object.hasOwn(overrides[target.id]||{},'answer');
        if(answer.length&&(target.answer.length&&JSON.stringify(answer)!==JSON.stringify([...target.answer].sort())||protectedAnswer&&!target.answer.length)){
          items.push({status:'conflict',q,targetId:target.id,reason:'网页参考答案与现有答案或手动更正不同',suggestedAnswer:answer});continue;
        }
        const fillAnswer=!target.answer.length&&answer.length&&!protectedAnswer;
        const fillExplanation=!target.explanation&&q.explanation&&!Object.hasOwn(overrides[target.id]||{},'explanation');
        items.push({status:fillAnswer||fillExplanation?'update':'duplicate',q,targetId:target.id,answer:fillAnswer?answer:null,fillExplanation:!!fillExplanation});
        if(fillAnswer)target.answer=answer;if(fillExplanation)target.explanation=q.explanation;
        if(q.sourceId)bySource.set(q.sourceId,target);
      }else{
        // Similar stems with different conditions/options stay separate; show them in preview.
        const similar=virtual.some(t=>normalize(t.stem)===normalize(q.stem));
        const entry={...q,id:'new_'+items.length,images:[],webSources:[{sourceId:q.sourceId}]};
        items.push({status:'new',q,targetId:entry.id,similar});virtual.push(entry);register(entry);
      }
    }
    return {items,counts:Object.fromEntries(['new','update','duplicate','conflict'].map(k=>[k,items.filter(i=>i.status===k).length])),similar:items.filter(i=>i.similar).length};
  }
  function render(bs){
    const m=n=>typeof n==='string'?escape(n):`<${n.tag}${Object.entries(n.attrs).map(([k,v])=>` ${k}="${escape(v)}"`).join('')}${n.tag==='math'?' xmlns="http://www.w3.org/1998/Math/MathML"':''}>${n.children.map(m).join('')}</${n.tag}>`;
    return blocks(bs).map(b=>b.kind==='text'?escape(b.text):b.kind==='image'?`<img class="web-question-image" src="${b.data}" alt="${escape(b.alt)}">`:`<span class="web-question-math">${m(b.tree)}</span>`).join('');
  }
  return {validate,plan,render,plain,math,signature};
}

    /* NOWCODER_FORMAT_END */
    const read = id => {
        const n = api.getNote(id);
        if (!n || n.isDeleted || n.isProtected) throw new Error('刷题数据不可访问：' + id);
        return JSON.parse(n.getContent());
    };
    const index = read('HwQuizIndex01');
    const store = api.getNote('HwQuizState01');
    const state = read('HwQuizState01');
    if (state.version !== 1 || !Number.isInteger(state.revision) || !state.records || !state.sessions || !Array.isArray(state.events)) throw new Error('刷题记录格式异常，停止写入');
    state.customBanks ||= {};
    /* CATEGORY_ALIAS_START: display categories + duplicate aliases (read-time merge; raw records/ids untouched) */
    state.aliases ||= {};state.categories ||= {};
    const CAT_DEFAULT=[{code:'ANA',name:'模拟电路'},{code:'DIG',name:'数字电路'},{code:'PCB',name:'PCB/信号完整性/EMC/电源完整性'},{code:'PWR',name:'电源'},{code:'MCU',name:'处理器/嵌入式/计算机组成'},{code:'COM',name:'接口/总线/通信与网络'},{code:'DEV',name:'器件/可靠性/安规与热设计'},{code:'TST',name:'测试与仪器'},{code:'SIG',name:'信号系统/电磁场/通信原理/控制'},{code:'GEN',name:'硬件通用/无法归类'}];
    const catDefs=Array.isArray(state.categoryDefs)&&state.categoryDefs.length?state.categoryDefs:CAT_DEFAULT;
    const catOrder=new Map(catDefs.map((c,i)=>[c.code,i]));
    const canon=id=>{let n=0;while(id&&Object.hasOwn(state.aliases,id)&&state.aliases[id]!==id&&n++<20)id=state.aliases[id];return id;};
    const isAlias=id=>Object.hasOwn(state.aliases,id)&&canon(id)!==id;
    const aliasesOf=id=>Object.keys(state.aliases).filter(old=>isAlias(old)&&canon(old)===id);
    const mergedRecords=()=>{
        const out={...state.records};
        for(const old of Object.keys(state.aliases)){
            if(!isAlias(old))continue;const r=state.records[old];delete out[old];if(!r)continue;
            const id=canon(old),c=out[id]?{...out[id]}:{attempts:0,wrong:false,favorite:false};
            c.attempts=(c.attempts||0)+(r.attempts||0);c.favorite=!!(c.favorite||r.favorite);
            if((r.lastResult?.time||'')>(c.lastResult?.time||'')){c.lastResult=r.lastResult;c.updatedAt=r.updatedAt;c.wrong=!!r.wrong;}
            out[id]=c;
        }
        return out;
    };
    const viewEvents=()=>state.events.map(e=>isAlias(e.questionId)?{...e,questionId:canon(e.questionId),aliasOf:e.questionId}:e);
    const viewStudy=s=>{
        const out={...s},tags={},drafts={},schedules={};
        for(const [id,ids] of Object.entries(s.tags||{})){const c=canon(id);tags[c]=[...new Set([...(tags[c]||[]),...ids])];}
        for(const [id,d] of Object.entries(s.drafts||{}))if(!isAlias(id))drafts[id]=d;
        for(const [id,v] of Object.entries(s.schedules||{})){const c=canon(id);if(c===id||!schedules[c])schedules[c]=v;}
        out.tags=tags;out.drafts=drafts;out.schedules=schedules;
        if(s.daily)out.daily={...s.daily,days:Object.fromEntries(Object.entries(s.daily.days||{}).map(([k,ids])=>[k,[...new Set(ids.map(canon))]]))};
        if(s.session&&Array.isArray(s.session.ids)&&s.session.ids.some(isAlias)){
            const ids=[...new Set(s.session.ids.map(canon))],responses={};
            for(const [id,r] of Object.entries(s.session.responses||{}))if(!isAlias(id))responses[id]=r;
            out.session=ids.length?{...s.session,ids,responses,position:Math.max(0,ids.indexOf(canon(s.session.ids[s.session.position])))}:null;
        }
        return out;
    };
    const withCategory=q=>{const c=state.categories[q.id];return {...q,category:c?.cat||'UNC',catNo:c?.no||''};};
    const catKey=q=>[catOrder.has(q.category)?catOrder.get(q.category):999,q.catNo?0:1,q.catNo];
    const byCategory=(a,b)=>{const x=catKey(a),y=catKey(b);return x[0]-y[0]||x[1]-y[1]||(x[2]<y[2]?-1:x[2]>y[2]?1:0);};
    /* CATEGORY_ALIAS_END */
    for (const b of Object.values(state.customBanks)) index.banks.push({id:b.id,title:b.title,count:b.questions.length,answered:b.questions.filter(q=>q.answer.length).length,custom:true});
    const bank = id => {
        if (!index.banks.some(b => b.id === id)) throw new Error('未找到题库');
        const b = state.customBanks[id] ? JSON.parse(JSON.stringify(state.customBanks[id])) : read('HwQuizBank' + id.slice(2));
        b.questions = b.questions.map(q => {
            const override=state.overrides[q.id]||{},value={...q,...override,...(state.questionEnrichments?.[q.id]?{enrichment:state.questionEnrichments[q.id]}:{}),record:state.records[q.id]||{}};
            if(q.rich||override.rich){value.rich={...q.rich,...override.rich};if(Object.hasOwn(override,'stem')&&override.stem!==q.stem&&!override.rich?.stem)delete value.rich.stem;if(Object.hasOwn(override,'explanation')&&override.explanation!==q.explanation&&!override.rich?.explanation)delete value.rich.explanation;}
            return value;
        });
        return b;
    };
    const summary = () => {
        const records = Object.values(mergedRecords()), graded = state.events.filter(e => typeof e.correct === 'boolean' && !e.self);
        return {answered: records.filter(r => r.attempts).length, wrong:records.filter(r=>r.wrong).length,
            favorites:records.filter(r=>r.favorite).length, totalAttempts:state.events.length,
            accuracy:graded.length ? Math.round(100*graded.filter(e=>e.correct).length/graded.length) : null};
    };
    const view = () => ({index, state, summary:summary()});
    const editedRich=(blocks,value)=>{
        if(!blocks)return undefined;
        const out=[];let position=0;
        for(const block of blocks.filter(b=>b.kind!=='text')){
            const marker=block.kind==='image'?'[题图]':block.text,at=marker?value.indexOf(marker,position):-1;
            if(at<0)throw Error('请保留原来的 [题图] 和公式占位文字；可以修改它们前后的文字');
            if(at>position)out.push({kind:'text',text:value.slice(position,at)});out.push(block);position=at+marker.length;
        }
        if(position<value.length)out.push({kind:'text',text:value.slice(position)});return out;
    };
    if (action === 'previewWebQuestions' || action === 'importWebQuestions') {
        if(payload.revision!==state.revision)throw Error('另一窗口更新了学习记录，请重新选择文件预览');
        const existing=index.banks.flatMap(b=>bank(b.id).questions);
        const plan=nowcoderPackageTools().plan(payload.package,existing,state.overrides||{});
        const receipt={counts:plan.counts,similar:plan.similar,items:plan.items.map(i=>({status:i.status,stem:i.q.stem.slice(0,160),reason:i.reason||'',targetId:i.targetId,suggestedAnswer:i.suggestedAnswer||[]}))};
        if(action==='previewWebQuestions')return receipt;
        if(Object.values(state.customBanks).reduce((n,b)=>n+b.questions.length,0)+plan.counts.new>10000)throw Error('自定义题目总数不能超过 10000');
        const all=new Map();for(const b of Object.values(state.customBanks))for(const q of b.questions)all.set(q.id,q);
        const aliases=new Map();let addedBank;
        for(const item of plan.items){
            if(item.status==='conflict')continue;
            const source={sourceId:item.q.sourceId,url:item.q.sourceUrl,capturedAt:item.q.capturedAt};
            let target;
            if(item.status==='new'){
                if(!addedBank){addedBank=Object.values(state.customBanks).find(b=>b.webCaptureVersion===1);if(!addedBank){const id='qb_'+api.randomString(16);if(index.banks.some(b=>b.id===id))throw Error('题目来源编号冲突，请重试');addedBank={id,title:'模拟电路',questions:[],sourceName:'牛客手动保存',sourceNoteId:null,webCaptureVersion:1};}}
                target={...item.q,id:addedBank.id+'-'+String(addedBank.questions.length+1).padStart(3,'0'),number:addedBank.questions.length+1,images:[],pages:[],ocr:false,answerSource:item.q.answer.length?'牛客页面展示的参考答案':'',webSources:[]};
                delete target.sourceId;delete target.sourceUrl;delete target.capturedAt;
                addedBank.questions.push(target);all.set(target.id,target);aliases.set(item.targetId,target.id);
            }else{
                const id=aliases.get(item.targetId)||item.targetId;
                target=all.get(id);
                // Original banks remain immutable; additive fields go into the existing override store.
                if(!target)target=state.overrides[id]={...(state.overrides[id]||{})};
                if(item.answer){target.answer=item.answer;target.answerSource='牛客页面展示的参考答案';}
                if(item.fillExplanation){target.explanation=item.q.explanation;target.rich={...(target.rich||existing.find(q=>q.id===id)?.rich||{}),explanation:item.q.rich.explanation};}
            }
            const effective=existing.find(q=>q.id===(aliases.get(item.targetId)||item.targetId));
            target.webSources=[...(target.webSources||effective?.webSources||[])];
            if(!target.webSources.some(s=>s.sourceId===source.sourceId&&s.url===source.url))target.webSources.push(source);
        }
        if(addedBank){state.customBanks[addedBank.id]=addedBank;const entry={id:addedBank.id,title:addedBank.title,count:addedBank.questions.length,answered:addedBank.questions.filter(q=>q.answer.length).length,custom:true};const previous=index.banks.find(b=>b.id===addedBank.id);if(previous)Object.assign(previous,entry);else index.banks.push(entry);}
        if(JSON.stringify(state).length>60*1024*1024)throw Error('学习数据及题图超过 60 MB，停止本次导入，请先导出备份');
        state.revision++;store.setContent(JSON.stringify(state));return {...view(),importReport:receipt};
    }
    if (action === 'enrichQuestions') {
        if (payload.version!==1 || payload.answerPolicy!=='suggest_only_preserve_grading_until_confirmation' || !/^[a-f0-9]{64}$/.test(payload.requestId || '')) throw new Error('逐题补充格式不正确');
        const repeated=state.enrichmentBatches?.[payload.requestId];
        if(repeated)return {...repeated,repeated:true,revision:state.revision};
        if(payload.revision!==state.revision)throw new Error('另一窗口更新了学习记录，请重新检查后补充');
        const questions=index.banks.flatMap(entry=>bank(entry.id).questions),byId=new Map(questions.map(q=>[q.id,q]));
        if(questions.length!==payload.sourceQuestionCount)throw new Error('题库数量已变化，请重新读取');
        if(!Array.isArray(payload.topics) || !payload.questions || !payload.tags)throw new Error('标签或解析缺失');
        let topics=[...(state.study?.topics || [])];
        const migration=payload.topicMigration,redirects=migration?.redirects || {};
        if(migration){
            if(!Array.isArray(migration.expectedTopics) || typeof redirects!=='object' || Array.isArray(redirects))throw new Error('知识库标签迁移格式无效');
            const expected=new Map(migration.expectedTopics.map(t=>[t.id,t]));
            for(const [oldId,target] of Object.entries(redirects)){
                const old=topics.find(t=>t.id===oldId),known=expected.get(oldId);
                if(!known || typeof target!=='string' || oldId===target)throw new Error('标签迁移范围无效');
                if(old && (old.name!==known.name || old.parent!==known.parent))throw new Error('标签已经由用户修改，请重新核对：'+oldId);
            }
            topics=topics.filter(t=>!redirects[t.id]).map(t=>({...t,parent:redirects[t.parent] || t.parent}));
        }
        const topicMap=new Map(topics.map(t=>[t.id,t]));
        for(const t of payload.topics){
            if(!t || typeof t.id!=='string' || !/^topic_[a-zA-Z0-9-]+$/.test(t.id) || typeof t.name!=='string' || !t.name.trim() || t.name.length>40 || !(t.parent===null || typeof t.parent==='string'))throw new Error('知识点定义不正确');
            const old=topicMap.get(t.id);
            if(old && (old.name!==t.name || old.parent!==t.parent))throw new Error('知识点编号冲突：'+t.id);
            if(!old){topics.push({id:t.id,name:t.name,parent:t.parent});topicMap.set(t.id,t);}
        }
        if(topics.length>1000)throw new Error('知识点数量超过上限');
        for(const t of topics){const seen=new Set([t.id]);let parent=t.parent;while(parent){if(!topicMap.has(parent)||seen.has(parent))throw new Error('知识点上级无效或形成循环');seen.add(parent);parent=topicMap.get(parent).parent;}}
        for(const target of Object.values(redirects))if(!topicMap.has(target))throw new Error('标签迁移目标不存在');
        const remap=ids=>[...new Set(ids.map(id=>redirects[id] || id))];
        const tags=Object.fromEntries(Object.entries(state.study?.tags || {}).map(([id,ids])=>[id,remap(ids)])),enrichments={...(state.questionEnrichments || {})};
        for(const [id,e] of Object.entries(payload.questions)){
            const q=byId.get(id);if(!q)throw new Error('题目不存在：'+id);
            const input={};for(const field of ['id','stem','type','options','answer','images','explanation'])input[field]=q[field] ?? null;
            if(JSON.stringify(input)!==JSON.stringify(e.input))throw new Error('原题或答案已经变化：'+id);
            if(e.version!==1 || e.reviewedBy!=='codex' || typeof e.summary!=='string' || !e.summary.trim() || e.summary.length>10000 || !['reviewed','needs-review'].includes(e.reviewStatus))throw new Error('解析状态无效：'+id);
            if(!e.options || typeof e.options!=='object' || Array.isArray(e.options) || Object.entries(e.options).some(([key,value])=>!q.options.some(o=>o.key===key) || typeof value!=='string' || !value.trim() || value.length>4000))throw new Error('选项解析无效：'+id);
            if(e.displayMode!=='focused' && Object.keys(e.options).length!==q.options.length)throw new Error('旧版选项解析不完整：'+id);
            if(e.displayMode==='focused' && (!Array.isArray(e.focusOptions) || e.focusOptions.some(k=>!Object.hasOwn(e.options,k)) || !Array.isArray(e.steps) || e.steps.length>12 || e.steps.some(s=>typeof s!=='string' || !s.trim() || s.length>4000)))throw new Error('重点解析格式无效：'+id);
            if(!Array.isArray(e.suggestedAnswer) || e.suggestedAnswer.some(a=>!q.options.some(o=>o.key===a)))throw new Error('建议答案不对应选项：'+id);
            if(!Array.isArray(e.sources) || e.sources.some(url=>typeof url!=='string' || !/^https:\/\//.test(url)))throw new Error('依据链接无效：'+id);
            const assigned=payload.tags[id];if(!Array.isArray(assigned) || !assigned.length || assigned.some(t=>!topicMap.has(t)))throw new Error('题目缺少有效标签：'+id);
            tags[id]=[...new Set([...(tags[id] || []),...assigned])];
            const {input:ignored,...entry}=e;enrichments[id]=entry;
        }
        if(Object.keys(payload.tags).some(id=>!payload.questions[id]))throw new Error('标签与逐题解析范围不一致');
        const topicNoteRefs={...(state.study?.topicNoteRefs || {}),...(payload.topicNoteRefs || {})};
        for(const [id,noteId] of Object.entries(topicNoteRefs))if(!topicMap.has(id) || typeof noteId!=='string' || !/^[a-zA-Z0-9]+$/.test(noteId))throw new Error('知识库笔记关联无效');
        state.study={...state.study,topics,tags,topicNoteRefs,filters:remap(state.study?.filters || []),excludedTopics:remap(state.study?.excludedTopics || [])};state.questionEnrichments=enrichments;
        state.revision++;
        const receipt={ok:true,requestId:payload.requestId,revision:state.revision,totalQuestions:questions.length,enrichedQuestions:Object.keys(enrichments).filter(id=>byId.has(id)).length,optionAnalyses:Object.entries(enrichments).filter(([id])=>byId.has(id)).reduce((n,[id,e])=>n+Object.keys(e.options).length,0),unclassifiedQuestions:questions.filter(q=>!tags[q.id]?.length).length,appliedAt:new Date().toISOString()};
        state.enrichmentBatches={...state.enrichmentBatches,[payload.requestId]:receipt};
        store.setContent(JSON.stringify(state));return receipt;
    }
    // The knowledge workspace is an additive migration. Legacy banks and sessions stay intact.
    if (action === 'studyLoad' || action === 'studySave') {
        const questions=index.banks.flatMap(entry=>{const b=bank(entry.id);return b.questions.map(q=>({...q,sourceId:b.id,source:b.title,sourceNoteId:b.sourceNoteId,tags:[],images:(q.images || []).map(id=>'api/images/'+id+'/'+id+'.png')}));}).filter(q=>!isAlias(q.id)).map(withCategory).sort(byCategory);
        const byId=new Map(questions.map(q=>[q.id,q]));
        const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
        const study={version:1,topics:[],tags:{},drafts:{},session:null,font:20,theme:'auto',filters:[],excludedTopics:[],scopeActive:false,selectionVersion:3,daily:{target:20},schedules:{},limitTopicsOnSpecialTabs:false,sourceFilter:null,dailyUseCurrentScope:false,...(state.study || {})};
        study.daily={target:20,days:{},...study.daily};
        for(const e of state.events){const key=day(e.time);study.daily.days[key]=[...new Set([...(study.daily.days[key] || []),e.questionId])];}
        if(!state.study && state.lastPractice){
            const saved=state.sessions[state.lastPractice.bankId+':'+state.lastPractice.mode];
            if(saved?.ids.length){const ids=saved.ids.filter(id=>byId.has(id));if(ids.length){study.session={ids,position:Math.min(saved.position,ids.length-1),responses:{},title:'上次学习',tab:state.lastPractice.mode==='wrong'?'wrong':state.lastPractice.mode==='favorites'?'favorites':'all',order:state.lastPractice.mode==='random'?'random':'sequential',finished:false,startedAt:Date.now()};
                if(saved.last && ids.includes(saved.last.questionId)){const e=saved.last;study.session.responses[e.questionId]={selected:e.selected,text:e.answerText || '',submitted:true,correct:e.correct,self:!!e.self,answer:e.answer,attemptId:'study_legacy_'+e.id};}
            }}
        }
        const load=()=>({index,revision:state.revision,questions,study:{...viewStudy(study),records:mergedRecords()},events:viewEvents(),summary:summary(),categoryDefs:catDefs});
        if(action==='studyLoad')return load();
        if(payload.revision!==state.revision)throw new Error('另一窗口更新了学习记录，请重新打开插件；本窗口的未保存内容可以导出。');
        const incoming=payload.study;
        const fail=message=>{throw new Error(message);};
        if(!incoming || incoming.version!==1 || !Array.isArray(incoming.topics) || incoming.topics.length>1000)fail('知识点数据格式不正确');
        const topics=incoming.topics.map(t=>{
            if(!t || typeof t.id!=='string' || !/^topic_[a-zA-Z0-9-]+$/.test(t.id) || typeof t.name!=='string' || !t.name.trim() || t.name.length>40)fail('知识点名称或编号不正确');
            return {id:t.id,name:t.name.trim(),parent:t.parent || null};
        });
        const topicIds=new Set(topics.map(t=>t.id));
        if(topicIds.size!==topics.length)fail('知识点编号重复');
        for(const t of topics){const seen=new Set([t.id]);let parent=t.parent;while(parent){if(!topicIds.has(parent)||seen.has(parent))fail('知识点层级存在循环或无效上级');seen.add(parent);parent=topics.find(x=>x.id===parent).parent;}}
        const tags={};
        for(const [id,ids] of Object.entries(incoming.tags || {})){if(!byId.has(id)||!Array.isArray(ids)||ids.some(t=>!topicIds.has(t)))fail('题目标签不正确');tags[id]=[...new Set(ids)];}
        for(const [id,ids] of Object.entries(state.study?.tags || {}))if(isAlias(id)&&Array.isArray(ids))tags[id]=ids.filter(t=>topicIds.has(t)); // keep aliased raw tags (reversible)
        const validResponse=(id,value,submitted=false)=>{
            const q=byId.get(id);if(!q || !value || !Array.isArray(value.selected) || value.selected.some(k=>!q.options.some(o=>o.key===k)))fail('作答选项不正确');
            const selected=[...new Set(value.selected)].sort();
            if(q.type!=='multi'&&selected.length>1 || submitted&&q.type!=='self'&&!selected.length)fail('请选择有效选项');
            if(typeof value.text!=='string' || value.text.length>10000)fail('作答文字过长');
            return {selected,text:value.text,submitted,correct:null,self:false};
        };
        const drafts={};for(const [id,r] of Object.entries(incoming.drafts || {}))drafts[id]=validResponse(id,r);
        for(const [id,r] of Object.entries(state.study?.drafts || {}))if(isAlias(id))drafts[id]=r;
        const schedules={...study.schedules},daily=JSON.parse(JSON.stringify(study.daily));
        if(!Number.isSafeInteger(incoming.daily?.target)||incoming.daily.target<1)fail('每日题量应为正整数');daily.target=incoming.daily.target;
        const schedule=(id,correct,time)=>{if(typeof correct!=='boolean')return;const previous=schedules[id]?.stage || 0;const stage=correct?Math.min(previous+1,5):0;const intervals=[1,1,3,7,14,30];schedules[id]={stage,due:new Date(new Date(time).getTime()+intervals[stage]*86400000).toISOString()};};
        let session=null;
        if(incoming.session){
            const s=incoming.session;
            if(!Array.isArray(s.ids)||!s.ids.length||s.ids.length>questions.length||s.ids.some(id=>!byId.has(id))||new Set(s.ids).size!==s.ids.length||!Number.isInteger(s.position)||s.position<0||s.position>=s.ids.length)fail('学习进度不正确');
            session={ids:s.ids,position:s.position,responses:{},title:String(s.title || '知识点练习').slice(0,500),tab:['all','wrong','favorites'].includes(s.tab)?s.tab:'all',order:['sequential','random','balanced','weighted','warm'].includes(s.order)?s.order:'random',finished:!!s.finished,startedAt:s.startedAt};
            for(const [id,r] of Object.entries(s.responses || {})){
                if(!s.ids.includes(id))fail('作答不属于本次练习');
                const value=validResponse(id,r,!!r.submitted);session.responses[id]=value;if(!r.submitted)continue;
                if(typeof r.attemptId!=='string'||r.attemptId.length>100||!/^study_[a-zA-Z0-9_-]+$/.test(r.attemptId))fail('提交编号不正确');
                const q=byId.get(id);let event=state.events.find(e=>e.requestId===r.attemptId || r.attemptId==='study_legacy_'+e.id);
                const last=state.records[id]?.lastResult;
                if(!event && last && (last.requestId===r.attemptId || r.attemptId==='study_legacy_'+last.id))event={...last};
                if(event){if(canon(event.questionId)!==id||JSON.stringify(event.selected)!==JSON.stringify(value.selected)||event.answerText!==value.text)fail('已提交的作答不能修改');}
                else{
                    const correct=q.type==='self'||!q.answer.length?null:JSON.stringify(value.selected)===JSON.stringify([...q.answer].sort());
                    event={id:api.randomString(16),requestId:r.attemptId,questionId:id,bankId:q.sourceId,selected:value.selected,answerText:value.text,correct,answer:[...q.answer],answerSource:q.answerSource,self:false,time:new Date().toISOString(),topics:[...(tags[id] || [])]};
                    state.events.push(event);const record=state.records[id] ||= {attempts:0,wrong:false,favorite:false};record.attempts++;record.updatedAt=event.time;record.lastResult={...event};if(correct!==null)record.wrong=!correct;
                    const key=day(event.time);daily.days[key]=[...new Set([...(daily.days[key] || []),id])];schedule(id,correct,event.time);
                }
                if(r.self&&event.correct===null&&typeof r.correct==='boolean'){
                    event.correct=r.correct;event.self=true;state.records[id].wrong=!r.correct;state.records[id].lastResult={...event};schedule(id,r.correct,new Date().toISOString());
                }
                Object.assign(value,{correct:event.correct,self:!!event.self,attemptId:r.attemptId,answer:[...event.answer],time:event.time});delete drafts[id];
            }
        }
        const mergedBefore=mergedRecords();
        for(const [id,r] of Object.entries(incoming.records || {})){if(!byId.has(id)||typeof r.favorite!=='boolean')fail('收藏数据不正确');if(!!mergedBefore[id]?.favorite!==r.favorite){const record=state.records[id] ||= {attempts:0,wrong:false,favorite:false};record.favorite=r.favorite;for(const old of aliasesOf(id))if(state.records[old])state.records[old].favorite=r.favorite;}}
        const allowed=new Set([...topicIds,'unclassified']);
        if(!Array.isArray(incoming.filters)||incoming.filters.some(id=>!allowed.has(id)))fail('知识点筛选不正确');if(incoming.excludedTopics!=null&&!Array.isArray(incoming.excludedTopics))fail('知识点筛选不正确');
        if(![18,20,22,24,26].includes(incoming.font))fail('题目字号不正确');
        const bankIds=new Set(index.banks.map(b=>b.id));const catFilterOk=v=>/^cat:[A-Z]{2,4}$/.test(v)&&(v==='cat:UNC'||catOrder.has(v.slice(4)));const sourceFilter=(typeof incoming.sourceFilter==='string'&&(bankIds.has(incoming.sourceFilter)||catFilterOk(incoming.sourceFilter)))?incoming.sourceFilter:null;Object.assign(study,{topics,tags,drafts,session,daily,schedules,font:incoming.font,theme:['dark','light'].includes(incoming.theme)?incoming.theme:'auto',filters:[...new Set(incoming.filters)],excludedTopics:[],scopeActive:!!incoming.scopeActive&&!!incoming.filters?.length,selectionVersion:[2,3].includes(incoming.selectionVersion)?incoming.selectionVersion:3,quantity:[10,20,50].includes(incoming.quantity)?incoming.quantity:20,order:['sequential','random','balanced','weighted','warm'].includes(incoming.order)?incoming.order:'random',limitTopicsOnSpecialTabs:!!incoming.limitTopicsOnSpecialTabs,sourceFilter,dailyUseCurrentScope:!!incoming.dailyUseCurrentScope});
        // Writes happen only after all validation succeeds; optimistic revision guards every save.
        state.study=study;state.events=state.events.slice(-10000);state.revision++;store.setContent(JSON.stringify(state));
        return {revision:state.revision,study:{...viewStudy(study),records:mergedRecords()},events:viewEvents(),summary:summary()};
    }
    if (action === 'load' || action === 'export') return view();
    if (action === 'bank') return {...view(), bank:bank(payload.bankId)};
    if (action === 'exportBank') {const b=bank(payload.bankId);return {title:b.title,questions:b.questions.map(({record,...q})=>q)};}
    if (payload.requestId && state.events.some(e=>e.requestId===payload.requestId)) return {...view(), result:state.events.find(e=>e.requestId===payload.requestId)};
    if (payload.revision !== state.revision) throw new Error('另一窗口更新了刷题记录，请刷新后重试');
    if (action === 'importBank') {
        const input=payload.bank;
        if (!input || typeof input.title!=='string' || !input.title.trim() || input.title.length>200 || !Array.isArray(input.questions) || !input.questions.length || input.questions.length>2000) throw new Error('题库需包含 title 和 1～2000 道 questions');
        if (Object.values(state.customBanks).reduce((n,b)=>n+b.questions.length,0)+input.questions.length>10000) throw new Error('自定义题库最多保存 10000 道题，请先导出备份');
        const id='qb_'+api.randomString(16);
        if(index.banks.some(b=>b.id===id))throw new Error('题库编号冲突，请重试');
        const questions=input.questions.map((item,i)=>{
            const fail=message=>{throw new Error('第 '+(i+1)+' 题：'+message);};
            if(!item || typeof item.stem!=='string' || !item.stem.trim() || item.stem.length>20000)fail('请填写题干 stem（最多 20000 字）');
            if(item.type && !['single','multi','boolean','self'].includes(item.type))fail('题型应为 single、multi、boolean 或 self');
            let options=[];
            if(item.type==='boolean')options=[{key:'A',text:'正确'},{key:'B',text:'错误'}];
            else if(item.type!=='self'){
                if(!Array.isArray(item.options) || item.options.length<2 || item.options.length>8)fail('选择题需要 2～8 个 options');
                options=item.options.map((o,j)=>({key:typeof o==='string'?String.fromCharCode(65+j):String(o?.key || String.fromCharCode(65+j)).toUpperCase(),text:typeof o==='string'?o:String(o?.text ?? '')}));
                if(new Set(options.map(o=>o.key)).size!==options.length || options.some(o=>! /^[A-H]$/.test(o.key) || !o.text.trim() || o.text.length>20000))fail('选项字母应唯一，选项内容不能为空');
            }
            let raw=item.answer ?? [];
            if(item.type==='boolean' && typeof raw==='boolean')raw=raw?'A':'B';
            if(Array.isArray(raw))raw=raw.join('');
            if(typeof raw!=='string')fail('answer 应为答案字母字符串或数组');
            raw=raw.toUpperCase().replace(/[\s,，、]/g,'');
            if(!/^[A-H]*$/.test(raw) || [...raw].some(a=>!options.some(o=>o.key===a)))fail('答案必须对应本题选项，自评题请将参考答案写入 explanation');
            const answer=[...new Set(raw)].sort(),type=item.type==='self'?'self':item.type==='multi' || (!item.type && answer.length>1)?'multi':'single';
            if(type==='single' && answer.length>1)fail('单选题只能有一个参考答案');
            return {id:id+'-'+String(i+1).padStart(3,'0'),number:i+1,stem:item.stem.trim(),type,options,answer,answerSource:answer.length?'导入题库参考答案':'',explanation:String(item.explanation || '').slice(0,20000),images:[],pages:[],ocr:false};
        });
        state.customBanks[id]={id,title:input.title.trim(),questions,sourceName:'用户导入题库',sourceNoteId:null};
        index.banks.push({id,title:input.title.trim(),count:questions.length,answered:questions.filter(q=>q.answer.length).length,custom:true});
        state.sessions[id+':sequential']={ids:questions.map(q=>q.id),position:0,last:null};
        state.lastPractice={bankId:id,mode:'sequential'};
        state.revision++;store.setContent(JSON.stringify(state));
        return {...view(),bank:bank(id)};
    }
    const b=bank(payload.bankId), q=b.questions.find(q=>q.id===payload.questionId);
    const key=payload.bankId+':'+(payload.mode || 'sequential');
    const session=state.sessions[key];
    const record = () => state.records[q.id] ||= {attempts:0,wrong:false,favorite:false};
    let result;
    if (action === 'importAnswers') {
        if(!Array.isArray(payload.answers) || payload.answers.length>2000)throw new Error('答案文件格式或数量不正确');
        const updates=payload.answers.map(item=>{
            const target=b.questions.find(q=>q.id===item.questionId);
            if(!target || target.type==='self')throw new Error('答案题号不存在或属于原图自评题：'+item.questionId);
            const raw=String(item.answer || '').toUpperCase().replace(/[\s,，、]/g,'');
            if(!/^[A-H]*$/.test(raw) || [...raw].some(a=>!target.options.some(o=>o.key===a)))throw new Error('题目答案不合法：'+item.questionId);
            const answer=[...new Set(raw)].sort();
            return {id:target.id,value:{answer,answerSource:answer.length?'用户导入答案':'',explanation:String(item.explanation ?? target.explanation).slice(0,20000),type:answer.length>1?'multi':target.type}};
        });
        if(new Set(updates.map(u=>u.id)).size!==updates.length)throw new Error('答案文件有重复题号');
        for(const update of updates){state.overrides[update.id]={...state.overrides[update.id],...update.value};if(state.records[update.id])state.records[update.id].wrong=false;for(const s of Object.values(state.sessions))if(s.last?.questionId===update.id)s.last=null;}
    } else if (action === 'start') {
        if (!['sequential','random','wrong','favorites'].includes(payload.mode)) throw new Error('练习模式不正确');
        if (!session || payload.restart) {
            let ids=b.questions.filter(q=>payload.mode==='wrong'?q.record.wrong:payload.mode==='favorites'?q.record.favorite:true).map(q=>q.id);
            if (payload.mode==='random') for(let i=ids.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
            state.sessions[key]={ids,position:0,last:null};
        }
    } else if (action === 'move') {
        if (!session || !Number.isInteger(payload.position) || payload.position<0 || payload.position>=session.ids.length) throw new Error('题目位置不正确');
        session.position=payload.position;session.last=null;
    } else {
        if (!q) throw new Error('未找到题目');
        if (action === 'favorite') record().favorite=!record().favorite;
        else if (action === 'answer') {
            if (!session || session.ids[session.position]!==q.id || session.last) throw new Error('当前题目已经提交或练习进度已变化');
            if (!Array.isArray(payload.selected) || (q.type!=='self' && (!payload.selected.length || payload.selected.some(a=>!q.options.some(o=>o.key===a))))) throw new Error('请选择有效选项');
            const selected=[...new Set(payload.selected)].sort();
            if(q.type!=='multi' && selected.length>1)throw new Error('单选题只能选择一个选项');
            const correct=q.answer.length?JSON.stringify(selected)===JSON.stringify([...q.answer].sort()):null;
            result={id:api.randomString(16),requestId:payload.requestId,questionId:q.id,bankId:b.id,selected,correct,
                answer:[...q.answer],answerSource:q.answerSource,answerText:String(payload.answerText || '').slice(0,10000),time:new Date().toISOString()};
            state.events.push(result);if(state.events.length>10000)state.events.shift();
            const r=record();r.attempts++;r.lastResult=result;r.updatedAt=result.time;
            if(correct!==null)r.wrong=!correct;
            session.last=result;
        } else if(action==='selfGrade') {
            if (!session?.last || session.last.questionId!==q.id || session.last.correct!==null || typeof payload.correct!=='boolean')throw new Error('当前题目无需自评');
            session.last.self=true;session.last.correct=payload.correct;
            const e=state.events.find(e=>e.id===session.last.id);if(e){e.self=true;e.correct=payload.correct;}
            const r=record();r.wrong=!payload.correct;r.lastResult={...session.last};result=session.last;
         } else if(action==='editStem') {
            if(payload.restore===true){if(state.overrides[q.id]){delete state.overrides[q.id].stem;if(state.overrides[q.id].rich)delete state.overrides[q.id].rich.stem;}}
            else {if(typeof payload.stem!=='string' || !payload.stem.trim() || payload.stem.length>20000)throw new Error('题干不能为空，最多 20000 字');const stem=payload.stem.trim(),rich=editedRich(q.rich?.stem,stem);state.overrides[q.id]={...state.overrides[q.id],stem,...(rich?{rich:{...q.rich,stem:rich}}:{})};}
        } else if (action==='edit') {
            const prev=state.overrides[q.id]||{};
            let options=Array.isArray(q.options)?q.options.map(o=>({...o})):[];
            if(Array.isArray(payload.options)){
              if(!payload.options.length)throw new Error('选项不能为空');
              const keys=[];
              options=payload.options.map((o,i)=>{
                const key=String(o.key||String.fromCharCode(65+i)).toUpperCase();
                const text=String(o.text??'').trim();
                if(!/^[A-H]$/.test(key))throw new Error('选项字母须为 A–H');
                if(keys.includes(key))throw new Error('选项字母重复');
                keys.push(key);
                if(!text||text.length>4000)throw new Error('选项内容不能为空，最多 4000 字');
                const old=q.options.find(o=>o.key===key);
                return {key,text,...(old?.rich?{rich:editedRich(old.rich,text)}:{})};
              });
            }
            if(typeof payload.stem==='string'){
              const stem=payload.stem.trim();
              if(!stem||stem.length>20000)throw new Error('题干不能为空，最多 20000 字');
              prev.stem=stem;
            }
            const answer=String(payload.answer || '').toUpperCase().replace(/[\s,，、]/g,'');
            const effectiveType=payload.type||q.type;
            if(effectiveType==='self' && answer)throw new Error('原图自评题请将参考答案写入解析，保持自评模式');
            if(!/^[A-H]*$/.test(answer) || [...answer].some(a=>!options.some(o=>o.key===a)))throw new Error('答案必须使用本题选项字母');
            const value=[...new Set(answer)].sort();
            const nextType=effectiveType==='self'?'self':value.length>1?'multi':payload.type==='multi'?'multi':'single';
            const explanation=String(payload.explanation ?? q.explanation ?? '').slice(0,20000),rich=q.rich?{stem:editedRich(q.rich.stem,prev.stem??q.stem),explanation:editedRich(q.rich.explanation,explanation)}:undefined;
            state.overrides[q.id]={...prev,options,answer:value,answerSource:value.length?'用户确认':'',explanation,type:nextType,...(rich?{rich}:{})};
            if(state.records[q.id])state.records[q.id].wrong=false;
            for(const s of Object.values(state.sessions))if(s.last?.questionId===q.id)s.last=null;
        } else throw new Error('未知刷题操作');
    }
    if(['start','move','answer','selfGrade'].includes(action))state.lastPractice={bankId:payload.bankId,mode:payload.mode || 'sequential'};
    state.revision++;store.setContent(JSON.stringify(state));
    return {...view(), bank:bank(payload.bankId), result};
}
