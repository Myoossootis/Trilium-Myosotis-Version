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
if(typeof module!=='undefined')module.exports=nowcoderPackageTools;
