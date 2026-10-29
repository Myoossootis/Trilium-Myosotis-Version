const QUIZ_HTML="                  <div class=\"desk-app\">\n        <aside class=\"desk-rail\" aria-label=\"主导航\">\n          <div class=\"rail-brand\"><span class=\"rail-mark\">题</span><div><strong>通用刷题</strong><small>Desktop HUD</small></div></div>\n          <nav class=\"rail-nav\" id=\"rail-nav\">\n            <button type=\"button\" class=\"rail-item active\" data-rail=\"practice\"><span class=\"rail-ico\">▷</span><span>练习</span></button>\n            <button type=\"button\" class=\"rail-item\" data-rail=\"resume\" id=\"rail-resume\" hidden><span class=\"rail-ico\">↻</span><span>继续练习</span></button>\n            <button type=\"button\" class=\"rail-item\" data-rail=\"banks\"><span class=\"rail-ico\">类</span><span>按分类练习</span></button>\n            <button type=\"button\" class=\"rail-item\" data-rail=\"wrong\"><span class=\"rail-ico\">错</span><span>错题本</span></button>\n            <button type=\"button\" class=\"rail-item\" data-rail=\"favorites\"><span class=\"rail-ico\">★</span><span>收藏</span></button>\n            <button type=\"button\" class=\"rail-item\" data-rail=\"topics\"><span class=\"rail-ico\">知</span><span>知识点</span></button>\n            <button type=\"button\" class=\"rail-item\" data-rail=\"daily\"><span class=\"rail-ico\">日</span><span>每日刷题</span></button>\n            <button type=\"button\" class=\"rail-item\" data-rail=\"stats\"><span class=\"rail-ico\">统</span><span>统计</span></button>\n            <button type=\"button\" class=\"rail-item\" data-rail=\"settings\"><span class=\"rail-ico\">⚙</span><span>设置</span></button>\n          </nav>\n          <div class=\"rail-foot\"><button id=\"theme-toggle\" class=\"icon-button\" aria-label=\"切换深浅色\" title=\"切换深浅色\">◐</button></div>\n        </aside>\n\n        <section class=\"desk-main\">\n          <header class=\"desk-topbar\">\n            <div class=\"topbar-text\"><strong id=\"browse-title\">练习</strong><p id=\"browse-subtitle\">选择题库范围后开始练习</p></div>\n            <div class=\"topbar-actions\">\n              <label class=\"search-field top-search\"><span>⌕</span><input id=\"question-search\" placeholder=\"搜索题目 / 编号 / 知识点\" aria-label=\"搜索题目\"></label>\n              <button id=\"start-learning\" class=\"primary top-start\">开始练习</button>\n              <button id=\"daily-button\" class=\"secondary\" hidden>每日刷题</button>\n              <button id=\"manage-button\" class=\"secondary\" hidden>导入与管理</button>\n            </div>\n          </header>\n          <section id=\"resume-card\" class=\"resume-card resume-compact\" hidden></section>\n\n          <section id=\"panel-stats\" class=\"desk-panel stats-panel\" hidden>\n            <div class=\"stats-grid\">\n              <div class=\"stat-tile\"><div class=\"stat-label\">今日答题</div><div class=\"stat-value\" id=\"stat-answered\">0</div></div>\n              <div class=\"stat-tile\"><div class=\"stat-label\">今日正确率</div><div class=\"stat-value\" id=\"stat-accuracy\">—</div></div>\n              <div class=\"stat-tile\"><div class=\"stat-label\">错题数</div><div class=\"stat-value\" id=\"stat-wrong\">0</div></div>\n              <div class=\"stat-tile\"><div class=\"stat-label\">收藏数</div><div class=\"stat-value\" id=\"stat-fav\">0</div></div>\n              <div class=\"stat-tile\"><div class=\"stat-label\">总题量</div><div class=\"stat-value\" id=\"stat-total\">0</div></div>\n              <div class=\"stat-tile\"><div class=\"stat-label\">每日目标</div><div class=\"stat-value\" id=\"stat-target\">20</div></div>\n            </div>\n          </section>\n\n          <section id=\"panel-workspace\" class=\"desk-panel workspace-panel\">\n            <div class=\"library desk-library list-mode\" id=\"desk-library\">\n              <aside class=\"topic-panel\" id=\"topic-panel\" hidden>\n                <div class=\"panel-heading\"><strong>知识点</strong><button id=\"add-topic\" class=\"icon-button\" aria-label=\"新建知识点\" title=\"新建知识点\">＋</button></div>\n                <p class=\"topic-hint\">勾选要练的知识点；点「全部知识点」则不限。</p>\n                <div id=\"topic-tree\"></div>\n              </aside>\n              <div class=\"question-library\">\n                <div class=\"list-toolbar-bar\">\n                  <div class=\"scope-line\">\n                    <button type=\"button\" class=\"scope-chip\" id=\"scope-chip\" title=\"展开/收起知识点筛选\">范围：全部知识点</button>\n                    <strong id=\"scope-title\" class=\"sr-only\">范围：全部知识点</strong>\n                    <span id=\"selected-topics\"></span>\n                    <span id=\"pool-count\" class=\"pool-count\"></span>\n                    <p id=\"scope-description\" class=\"sr-only\"></p>\n                  </div>\n                  <div class=\"list-controls\">\n                    <label class=\"ctrl\">题量<select id=\"question-count\"><option>10</option><option selected>20</option><option>50</option></select></label>\n                    <label class=\"ctrl\">顺序<select id=\"question-order\"><option value=\"random\">均匀随机</option><option value=\"balanced\">知识点均衡</option><option value=\"weighted\">薄弱优先</option><option value=\"warm\">知识保温</option><option value=\"sequential\">顺序</option></select></label>\n                    <div class=\"library-tabs\" id=\"library-tabs\">\n                      <button data-tab=\"all\" class=\"active\">全部</button>\n                      <button data-tab=\"wrong\">错题</button>\n                      <button data-tab=\"favorites\">收藏</button>\n                      <label class=\"scope-limit-toggle\" id=\"scope-limit-wrap\" hidden title=\"仅对错题/收藏生效\"><input type=\"checkbox\" id=\"limit-topic-filter\"> 限知识点</label>\n                    </div>\n                    <button id=\"start-learning-secondary\" class=\"primary\" hidden>开始练习</button>\n                  </div>\n                </div>\n                <div id=\"bank-actions\" class=\"bank-actions\" hidden>\n                  <button type=\"button\" class=\"secondary\" data-bank-act=\"sequential\">按编号顺序练</button>\n                  <button type=\"button\" class=\"secondary\" data-bank-act=\"random\">随机 N 题</button>\n                  <button type=\"button\" class=\"secondary\" data-bank-act=\"wrong\">本类错题</button>\n                </div>\n                                <div id=\"nk-bank-home\" class=\"nk-bank-home\" hidden>\n                  <div class=\"nk-home-main\">\n                    <div id=\"nk-cat-tabs\" class=\"nk-cat-tabs\" role=\"tablist\" aria-label=\"题库分类\"></div>\n                    <div id=\"nk-type-filters\" class=\"nk-type-filters\" aria-label=\"题型筛选\"></div>\n                    <div id=\"nk-bank-sections\" class=\"nk-bank-sections\"></div>\n                    <div id=\"bank-picker\" class=\"bank-picker nk-card-grid\" hidden></div>\n                  </div>\n                  <aside id=\"nk-history\" class=\"nk-history\" aria-label=\"练习记录\">\n                    <div class=\"nk-history-head\"><strong>练习记录</strong></div>\n                    <div id=\"nk-history-list\" class=\"nk-history-list\"></div>\n                    <div class=\"nk-history-foot\">\n                      <button type=\"button\" class=\"text-button\" data-nk-hist=\"resume\">继续练习</button>\n                      <button type=\"button\" class=\"text-button\" data-nk-hist=\"wrong\">错题练习</button>\n                    </div>\n                  </aside>\n                </div>\n                <div id=\"bank-shortcuts\" class=\"bank-shortcuts\" hidden></div>\n                <div id=\"batch-actions\" class=\"batch-actions\" hidden><span id=\"batch-count\"></span><button id=\"batch-tag\" class=\"secondary\">批量打标签</button><button id=\"clear-selected\" class=\"text-button\">取消选择</button></div>\n                <div class=\"qtable-wrap\">\n                  <div class=\"list-heading qtable-head\" id=\"list-heading\">\n                    <span class=\"col-check\"><label><input id=\"select-page\" type=\"checkbox\" aria-label=\"选择本页题目\"></label></span>\n                    <span class=\"col-no\">编号</span>\n                    <span class=\"col-stem\">题干摘要</span>\n                    <span class=\"col-src\">分类</span>\n                    <span class=\"col-tags\">标签</span>\n                    <span class=\"col-status\">状态</span>\n                  </div>\n                  <div id=\"question-list\" class=\"qtable-body\"></div>\n                </div>\n                <div id=\"list-pagination\" class=\"pagination\"></div>\n              </div>\n              </div>\n            </div>\n          </section>\n        </section>\n      </div>\n\n\n  <dialog id=\"study-dialog\" class=\"study-dialog study-hud study-docked\" aria-labelledby=\"study-title\">\n    <header class=\"study-header\">\n      <div class=\"study-title-block\">\n        <h2 id=\"study-title\">练习中</h2>\n        <span class=\"eyebrow\" id=\"study-mode\" hidden>本次练习</span>\n        <span id=\"save-status\" class=\"save-status sr-only\">已保存</span>\n      </div>\n      <div class=\"study-actions\">\n        <button type=\"button\" id=\"study-favorite\" class=\"header-action\" aria-label=\"收藏\">☆ 收藏</button>\n        <button type=\"button\" id=\"study-edit-question\" class=\"header-action\" aria-label=\"编辑题目\">✎ 编辑题目</button>\n        <div class=\"font-controls\" title=\"字号\"><button type=\"button\" id=\"font-smaller\" aria-label=\"减小字号\">A−</button><button type=\"button\" id=\"font-larger\" aria-label=\"增大字号\">A＋</button></div>\n        <button type=\"button\" id=\"close-study\" class=\"icon-button close-button\" aria-label=\"保存并关闭练习\" title=\"保存并关闭\">×</button>\n      </div>\n    </header>\n    <div class=\"session-progress\"><div id=\"session-progress-bar\"></div></div>\n    <div class=\"study-body\">\n      <section id=\"question-scroll\" class=\"question-scroll\" tabindex=\"-1\">\n        <div class=\"study-toolbar\" id=\"study-toolbar\">\n          <button type=\"button\" class=\"tool-btn\" id=\"tool-edit-stem\">修改题干</button>\n          <button type=\"button\" class=\"tool-btn\" id=\"tool-edit-answer\">修改答案</button>\n          <button type=\"button\" class=\"tool-btn tool-gear\" id=\"tool-font\" title=\"字号\" hidden>⚙</button>\n          <span class=\"spacer\"></span>\n          <button type=\"button\" class=\"expert-badge\" id=\"expert-badge\" hidden>专家解析</button>\n        </div>\n        <div id=\"study-question\"></div>\n      </section>\n      <aside class=\"answer-sidebar\" id=\"answer-sidebar\">\n        <button type=\"button\" class=\"icon-button answer-collapse\" id=\"toggle-answer-card\" title=\"折叠答题卡\" aria-label=\"折叠答题卡\">⟩</button>\n        <div class=\"answer-heading\"><strong>答题卡</strong><span id=\"answered-count\"></span></div>\n        <div id=\"answer-map\" class=\"answer-map\"></div>\n        <div class=\"map-legend\"><span><i class=\"legend-dot neutral\"></i>未答</span><span><i class=\"legend-dot draft\"></i>已选</span><span><i class=\"legend-dot correct\"></i>正确</span><span><i class=\"legend-dot wrong\"></i>错误</span><span><i class=\"legend-dot self\"></i>自评</span></div>\n        <div class=\"session-tip\">A–H 选答 · Enter 提交/下一题 · Esc 关闭</div>\n      </aside>\n    </div>\n    <footer class=\"study-footer study-footer-hud\">\n      <button type=\"button\" id=\"previous-question\" class=\"secondary footer-nav\">上一题</button>\n      <button type=\"button\" id=\"primary-study-action\" class=\"primary footer-nav\">提交</button>\n      <button type=\"button\" id=\"next-question\" class=\"secondary footer-nav\">下一题</button>\n      <span id=\"question-position\" class=\"sr-only\"></span>\n      <button type=\"button\" id=\"skip-question\" class=\"text-button\" hidden>跳过</button>\n    </footer>\n  </dialog>\n  <dialog id=\"tags-dialog\" class=\"small-dialog\" aria-labelledby=\"tags-title\"><form method=\"dialog\"><header class=\"small-dialog-heading\"><h2 id=\"tags-title\">知识点标签</h2><button class=\"icon-button\" aria-label=\"关闭标签窗口\">×</button></header></form><p id=\"tags-description\"></p><div id=\"tag-options\" class=\"tag-options\"></div><div class=\"small-dialog-footer\"><button id=\"save-tags\" class=\"primary\">保存标签</button></div></dialog>\n  <dialog id=\"topic-dialog\" class=\"small-dialog\" aria-labelledby=\"topic-title\"><form id=\"topic-form\"><header class=\"small-dialog-heading\"><h2 id=\"topic-title\">新建知识点</h2><button type=\"button\" id=\"close-topic\" class=\"icon-button\" aria-label=\"关闭\">×</button></header><label class=\"form-label\">名称<input id=\"topic-name\" maxlength=\"40\" required placeholder=\"例如：温度特性\"></label><label class=\"form-label\">上级知识点<select id=\"topic-parent\"></select></label><div class=\"small-dialog-footer\"><button class=\"primary\">创建知识点</button></div></form></dialog>\n  <dialog id=\"daily-dialog\" class=\"small-dialog\" aria-labelledby=\"daily-title\"><form id=\"daily-form\"><header class=\"small-dialog-heading\"><h2 id=\"daily-title\">每日刷题</h2><button type=\"button\" id=\"close-daily\" class=\"icon-button\" aria-label=\"关闭每日设置\">×</button></header><label class=\"form-label\">今日目标题量<input id=\"daily-target\" type=\"number\" min=\"1\" step=\"1\" required inputmode=\"numeric\"></label><p id=\"daily-description\" class=\"daily-description\"></p><label class=\"scope-limit-toggle daily-scope-toggle\"><input type=\"checkbox\" id=\"daily-use-scope\"> 沿用当前筛选（默认从全库抽题）</label><p class=\"daily-note\">新题、错题与保温题统一计入；同一道题当天重复练习计为 1 题。默认不限知识点与套卷。</p><div class=\"small-dialog-footer\"><button class=\"primary\" id=\"start-daily\">保存并开始</button></div></form></dialog>\n  <dialog id=\"manage-dialog\" class=\"small-dialog manage-dialog\" aria-labelledby=\"manage-title\"><form method=\"dialog\"><header class=\"small-dialog-heading\"><h2 id=\"manage-title\">导入来源与管理</h2><button class=\"icon-button\" aria-label=\"关闭管理窗口\">×</button></header></form><p>来源用于追溯题目资料，练习可以跨来源选题。</p><div id=\"source-list\" class=\"source-list\"></div><details class=\"source-options\"><summary>资料与答案</summary><label class=\"form-label\">导入来源<select id=\"source-select\"></select></label><div class=\"small-dialog-footer\"><button id=\"export-source\" class=\"secondary\">导出题目</button><button id=\"import-answers\" class=\"secondary\">导入答案</button><input id=\"answers-file\" type=\"file\" hidden accept=\".json,application/json\"></div></details><div class=\"small-dialog-footer\"><button id=\"import-web\" class=\"secondary\">导入网页题目</button><button id=\"import-bank\" class=\"secondary\">导入题目</button><button id=\"export-prototype\" class=\"secondary\">导出学习记录</button><button id=\"export-unsaved\" class=\"text-button\">导出未保存内容</button></div></dialog>\n  <div id=\"toast\" class=\"toast\" role=\"status\" hidden></div>\n<dialog id=\"import-dialog\" class=\"small-dialog manage-dialog\"><form id=\"import-form\"><header class=\"small-dialog-heading\"><h2>导入题目</h2><button type=\"button\" id=\"close-import\" class=\"icon-button\">×</button></header><p>选择题库 JSON 文件，或粘贴内容。导入的题目先放入未归类。</p><div class=\"header-actions\"><label class=\"secondary\">选择文件<input id=\"import-file\" type=\"file\" accept=\".json,application/json\" hidden></label><button type=\"button\" id=\"import-template\" class=\"secondary\">下载模板</button></div><textarea id=\"import-content\" rows=\"10\" required aria-label=\"题目 JSON\" placeholder='{\"title\":\"题库名称\",\"questions\":[{\"stem\":\"题干\",\"options\":[\"甲\",\"乙\"],\"answer\":\"A\"}]}'></textarea><div class=\"small-dialog-footer\"><button class=\"primary\" id=\"import-confirm\">导入题目</button></div></form></dialog>\n<dialog id=\"edit-dialog\" class=\"small-dialog question-edit-dialog\" aria-labelledby=\"edit-dialog-title\">\n    <form id=\"edit-form\">\n      <header class=\"small-dialog-heading\"><h2 id=\"edit-dialog-title\">编辑题目</h2><button type=\"button\" id=\"close-edit\" class=\"icon-button\" aria-label=\"关闭\">×</button></header>\n      <label class=\"form-label\">题干<textarea id=\"edit-stem\" rows=\"5\" maxlength=\"20000\" required placeholder=\"题干\"></textarea></label>\n      <div class=\"edit-options-block\">\n        <div class=\"form-label-text\">选项与答案</div>\n        <div id=\"edit-options-list\" class=\"edit-options-list\"></div>\n      </div>\n      <input type=\"hidden\" id=\"edit-answer\" value=\"\">\n      <label class=\"form-label\">题型<select id=\"edit-type\"><option value=\"single\">单选题</option><option value=\"multi\">多选题</option><option value=\"self\">自评题</option></select></label>\n      <label class=\"form-label\">参考解析（可选）<textarea id=\"edit-explanation\" rows=\"4\" maxlength=\"20000\" placeholder=\"解析\"></textarea></label>\n      <p class=\"edit-hint\">将写入学习记录中的题目覆盖（题干/选项/标答/解析）；历史作答保留当时参考答案。<span id=\"edit-answer-source\"></span></p>\n      <div class=\"small-dialog-footer\"><button type=\"button\" id=\"cancel-edit\" class=\"secondary\">取消</button><button class=\"primary\" id=\"save-edit-question\">保存到题库</button></div>\n    </form>\n  </dialog>\n<dialog id=\"stem-dialog\" class=\"small-dialog\" aria-labelledby=\"stem-title\"><form id=\"stem-form\"><header class=\"small-dialog-heading\"><h2 id=\"stem-title\">修改题干</h2><button type=\"button\" id=\"close-stem\" class=\"icon-button\" aria-label=\"关闭\">×</button></header><label class=\"form-label\">题干<textarea id=\"stem-content\" rows=\"8\" maxlength=\"20000\" required></textarea></label><div class=\"small-dialog-footer\"><button type=\"button\" id=\"restore-stem\" class=\"text-button\">恢复原题干</button><button id=\"save-stem\" class=\"primary\">保存题干</button></div></form></dialog>\n\n<dialog id=\"web-dialog\" class=\"small-dialog manage-dialog\" aria-labelledby=\"web-title\"><header class=\"small-dialog-heading\"><h2 id=\"web-title\">导入网页题目</h2><button id=\"close-web\" type=\"button\" class=\"icon-button\" aria-label=\"关闭\">×</button></header><p>选择牛客助手保存的题目包，先预览再导入。冲突题跳过，现有学习记录保留。</p><label class=\"secondary\">选择题目包<input id=\"web-file\" type=\"file\" accept=\".json,application/json\" hidden></label><p id=\"web-preview\" role=\"status\"></p><div id=\"web-items\" class=\"web-preview-list\"></div><div class=\"small-dialog-footer\"><button id=\"web-confirm\" class=\"primary\" disabled>确认导入</button></div></dialog>\n";
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

// Sampling is local and does not change records. Grading and review dates are authoritative in the backend.
function quizSample(questions,state,events,order,now=Date.now(),random=Math.random){
  const tags=q=>state.tags[q.id] || [],records=state.records || {},schedules=state.schedules || {};
  const due=q=>schedules[q.id]?.due ? new Date(schedules[q.id].due).getTime()<=now : typeof records[q.id]?.lastResult?.correct==='boolean' && records[q.id]?.lastResult?.time && new Date(records[q.id].lastResult.time).getTime()+86400000<=now;
  const shuffled=list=>list.map(q=>({q,key:random()})).sort((a,b)=>a.key-b.key).map(x=>x.q);
  if(order==='sequential')return [...questions];
  if(order==='warm')return shuffled(questions.filter(due)).sort((a,b)=>new Date(schedules[a.id]?.due || records[a.id].lastResult.time)-new Date(schedules[b.id]?.due || records[b.id].lastResult.time));
  if(order==='balanced'){
    const groups=new Map();
    for(const q of shuffled(questions)){
      const ancestor=(id,other)=>{const seen=new Set();while(other&&!seen.has(other)){if(other===id)return true;seen.add(other);other=state.topics.find(t=>t.id===other)?.parent;}return false;};
      const leaf=tags(q).filter(id=>!tags(q).some(other=>other!==id && ancestor(id,other)));
      const id=(leaf.length?leaf:['unclassified']).sort((a,b)=>(groups.get(a)?.length || 0)-(groups.get(b)?.length || 0))[0];
      if(!groups.has(id))groups.set(id,[]);groups.get(id).push(q);
    }
    const result=[],buckets=shuffled([...groups.values()]);while(buckets.some(b=>b.length))for(const b of buckets)if(b.length)result.push(b.pop());return result;
  }
  if(order==='weighted'){
    const stats=new Map();
    for(const e of events){const age=(now-new Date(e.time).getTime())/86400000;if(age<0||age>30||typeof e.correct!=='boolean')continue;
      const ids=state.tags[e.questionId] || e.topics || [];const decay=Math.exp(-age/14)*(e.self ? 0.5 : 1)/Math.max(ids.length,1);
      for(const id of ids.length?ids:['unclassified']){const s=stats.get(id)||{wrong:0,total:0};s.total+=decay;if(!e.correct)s.wrong+=decay;stats.set(id,s);}
    }
    const weakness=id=>{const s=stats.get(id)||{wrong:0,total:0};return (s.wrong+1)/(s.total+4);};
    return questions.map(q=>{const ids=tags(q);const weak=(ids.length?ids:['unclassified']).reduce((n,id)=>n+weakness(id),0)/Math.max(ids.length,1);const weight=1+3*weak+(records[q.id]?.wrong?2:0)+(due(q)?1:0)+(!records[q.id]?.attempts ? 0.5 : 0);return {q,key:Math.log(Math.max(random(),1e-12))/weight};}).sort((a,b)=>b.key-a.key).map(x=>x.q);
  }
  return shuffled(questions);
}
/* Native Trilium knowledge workspace; persisted through the backend revision queue. */
function quizLearningApp(DATA, host, bridge) {
  'use strict';
  const listeners=[];
  const realDocument=host.ownerDocument;
  const document={getElementById:id=>host.querySelector('#'+id),querySelector:s=>host.querySelector(s),querySelectorAll:s=>host.querySelectorAll(s),createElement:tag=>realDocument.createElement(tag),get activeElement(){return realDocument.activeElement;},body:host,documentElement:host,addEventListener:(type,fn)=>{realDocument.addEventListener(type,fn);listeners.push([type,fn]);}};
  let saveSerial=0,failed=false,lastSave=Promise.resolve(),draftTimer;
  const orders={random:'均匀随机',balanced:'知识点均衡',weighted:'薄弱知识点优先',warm:'知识保温',sequential:'顺序'};
  const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const webFormat=nowcoderPackageTools();
  const richText=(q,field,option)=>{const bs=option?option.rich:q.rich?.[field];return bs?webFormat.render(bs):esc(option?option.text:q[field]);};
  const questionById=new Map(DATA.questions.map(q=>[q.id,q]));
  let state={version:1,topics:DATA.topics,tags:{},records:{},drafts:{},session:null,font:20,theme:'light',filters:[],excludedTopics:[],scopeActive:false,selectionVersion:3,daily:{target:20},limitTopicsOnSpecialTabs:false,sourceFilter:null,dailyUseCurrentScope:false},tab='all',search='',page=0,batch=new Set(),tagTargets=[],storageError=false,toastTimer,uiMode='home',browseMode='library',nkCat='recommend',nkTypeFilter=null;
  state={...state,...DATA.study};state.records=JSON.parse(JSON.stringify(DATA.study.records));state.limitTopicsOnSpecialTabs=!!state.limitTopicsOnSpecialTabs;state.dailyUseCurrentScope=!!state.dailyUseCurrentScope;state.sourceFilter=typeof state.sourceFilter==='string'&&state.sourceFilter?state.sourceFilter:null;state.excludedTopics=[];
  const tags=q=>state.tags[q.id]??q.tags,record=id=>state.records[id]||{},topic=id=>state.topics.find(t=>t.id===id);
  function path(id){const visited=new Set(),names=[];while(id&&!visited.has(id)){visited.add(id);const t=topic(id);if(!t)break;names.unshift(t.name);id=t.parent;}return names.join(' / ');}
  function within(id,ancestor){const seen=new Set();while(id&&!seen.has(id)){if(id===ancestor)return true;seen.add(id);id=topic(id)?.parent;}return false;}
  const descendants=id=>id==='unclassified'?['unclassified']:state.topics.filter(t=>within(t.id,id)).map(t=>t.id);
  state.daily={target:20,days:{},...state.daily};
  const dateKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const today=()=>dateKey(Date.now()),dailyCount=()=>new Set(state.daily.days[today()]||[]).size;
  if(!Object.keys(state.daily.days).length)for(const [id,r] of Object.entries(state.records))if(r.lastResult?.time){const day=dateKey(r.lastResult.time);state.daily.days[day]||=[];state.daily.days[day].push(id);}
  function countDaily(id){const key=today();state.daily.days[key]=[...new Set([...(state.daily.days[key]||[]),id])];}
  if(state.selectionVersion!==3){state.excludedTopics=[];state.filters=[...new Set((state.filters||[]).flatMap(descendants))];state.scopeActive=!!state.filters.length;state.selectionVersion=3;}
  function matches(q,filters){if(filters)return filters.some(id=>id==='unclassified'?tags(q).length===0:tags(q).some(t=>within(t,id)));if(!state.scopeActive||!state.filters.length)return true;return state.filters.some(id=>id==='unclassified'?tags(q).length===0:tags(q).includes(id));}
  function checkedTopic(id){return descendants(id).every(t=>state.filters.includes(t));}
  function partialTopic(id){const ids=descendants(id);return ids.some(t=>state.filters.includes(t))&&!ids.every(t=>state.filters.includes(t));}
  function selectTopic(id,checked){const ids=descendants(id);if(checked)state.filters=[...new Set([...state.filters,...ids])];else state.filters=state.filters.filter(t=>!ids.includes(t));state.excludedTopics=[];state.scopeActive=state.filters.length>0;page=0;batch.clear();save();renderLibrary();}
  function selectedRoots(){return state.filters.filter(id=>id==='unclassified'||!state.filters.includes(topic(id)?.parent));}
  function applyTopicFilter(){return !((tab==='wrong'||tab==='favorites')&&!state.limitTopicsOnSpecialTabs);}
  function pool(){const query=search.toLowerCase().replace(/\s+/g,' ').trim();return DATA.questions.filter(q=>{
    if(state.sourceFilter&&!inSource(q))return false;
    if(applyTopicFilter()&&!matches(q))return false;
    if(tab==='wrong'&&!record(q.id).wrong)return false;
    if(tab==='favorites'&&!record(q.id).favorite)return false;
    if(query&&!(q.stem+' '+q.id+' '+(q.catNo||'')+' '+(q.source||'')+' '+(q.sourceId||'')+' '+tags(q).map(path).join(' ')).toLowerCase().replace(/\s+/g,' ').includes(query))return false;
    return true;
  });}
  function dailyPool(){const done=new Set(state.daily.days[today()]||[]);const base=state.dailyUseCurrentScope?pool():DATA.questions;return base.filter(q=>!done.has(q.id));}
  function bankLabel(id){if(!id)return '自定义';if(String(id).startsWith('cat:'))return catLabel(String(id).slice(4));const s=(DATA.sources||[]).find(x=>x.id===id);if(s?.title)return s.title;return id.startsWith('hw')?('第 '+id.slice(2)+' 套'):id;}
  function clearSourceFilter(){state.sourceFilter=null;page=0;batch.clear();save();if(uiMode==='banks'||uiMode==='practice'||browseMode==='banks'){railNavigate(uiMode==='banks'?'banks':'practice',{clearBank:false});}else renderLibrary();}function resetTopicFilters(){state.filters=[];state.excludedTopics=[];state.scopeActive=false;page=0;batch.clear();save();renderLibrary();}
  function setSourceFilter(id){state.sourceFilter=id||null;page=0;batch.clear();save();renderLibrary();}
  function updateOrderAvailability(list){
    const sample=list.length?list:DATA.questions;
    const untagged=sample.filter(q=>!(tags(q)||[]).length).length;
    const mostly=sample.length>0&&untagged/sample.length>=0.5;
    const sel=$('question-order');if(!sel)return;
    for(const opt of sel.options){
      if(opt.value==='balanced'||opt.value==='weighted'){
        opt.disabled=mostly;
        opt.title=mostly?'当前范围多数题目未打知识点标签，此策略暂不可用':'';
      }
    }
    if(mostly&&(sel.value==='balanced'||sel.value==='weighted'))sel.value='random';
  }
  function save(){
    clearTimeout(draftTimer);draftTimer=null;
    const serial=++saveSerial,snapshot=JSON.parse(JSON.stringify({...state,records:Object.fromEntries(Object.entries(state.records).map(([id,r])=>[id,{favorite:!!r.favorite}])),daily:{target:state.daily.target},schedules:undefined}));
    $('save-status').textContent='保存中…';
    lastSave=bridge.save(snapshot).then(result=>{
      state.schedules=result.study.schedules;DATA.events=result.events;
      if(serial===saveSerial){state.records=result.study.records;state.daily=result.study.daily;if(state.session&&result.study.session)for(const [id,r] of Object.entries(result.study.session.responses))Object.assign(state.session.responses[id]||={},r);storageError=false;$('save-status').textContent='已保存';renderLibrary();if($('study-dialog').open)renderMapOnly();}
      return true;
    }).catch(e=>{failed=true;storageError=true;$('save-status').textContent='保存失败';toast(e.message || '保存失败，请导出未保存内容');return false;});
    return lastSave;
  }
  function saveDraft(){clearTimeout(draftTimer);saveSerial++;draftTimer=setTimeout(save,300);$('save-status').textContent='保存中…';}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2800);}
  function applyAppearance(){const probe=realDocument.createElement('span');probe.style.color='var(--main-background-color, white)';probe.hidden=true;host.append(probe);const nativeColor=getComputedStyle(probe).color.match(/\d+(?:\.\d+)?/g);probe.remove();const nativeDark=nativeColor&&nativeColor.slice(0,3).map(Number).reduce((a,b)=>a+b,0)<384;document.body.classList.toggle('dark',state.theme==='dark'||state.theme==='auto'&&!!nativeDark);document.documentElement.style.setProperty('--question-size',state.font+'px');document.documentElement.style.setProperty('--option-size',(state.font-2)+'px');}
  function scopedCount(id){return DATA.questions.filter(q=>matches(q,[id])).length;}
  let expandedTopics=new Set();
  try{const saved=JSON.parse(localStorage.getItem('hw-quiz-expanded-topics')||'[]');if(Array.isArray(saved))expandedTopics=new Set(saved.filter(id=>typeof id==='string'));}catch{}
  function renderTopics(){
    const row=(id,name,count,depth=0,hasChildren=false)=>`<div class="topic-row ${state.filters.includes(id)?'active':''} ${depth?'child':''}" style="padding-left:${7+depth*13}px">${hasChildren?`<button type="button" class="topic-fold" data-fold="${esc(id)}" aria-expanded="${expandedTopics.has(id)}" aria-label="${expandedTopics.has(id)?'收起':'展开'}${esc(name)}">${expandedTopics.has(id)?'▾':'▸'}</button>`:'<span class="topic-fold-spacer"></span>'}<label class="topic-select"><input type="checkbox" data-topic="${esc(id)}" ${checkedTopic(id)?'checked':''}><span>${esc(name)}</span></label><span class="topic-count">${count}</span></div>`;
    let html=`<button class="topic-row ${!state.scopeActive?'active':''}" data-all="true" style="width:100%;text-align:left"><span>全部知识点</span><span class="topic-count">${DATA.questions.length}</span></button>`;
    const children=parent=>state.topics.filter(t=>t.parent===parent),seen=new Set();
    function branch(t,depth){if(seen.has(t.id))return;seen.add(t.id);const items=children(t.id);html+=row(t.id,t.name,scopedCount(t.id),depth,items.length>0);if(expandedTopics.has(t.id))for(const child of items)branch(child,depth+1);}
    html+='<div class="topic-label">展开查看子标签，勾选父级包含子级</div>';for(const t of children(null))branch(t,0);
    html+='<div class="topic-divider"></div>'+row('unclassified','未归类',scopedCount('unclassified'));
    $('topic-tree').innerHTML=html;
    $('topic-tree').querySelectorAll('[data-topic]').forEach(input=>{input.indeterminate=partialTopic(input.dataset.topic);input.setAttribute('aria-checked',input.indeterminate?'mixed':String(input.checked));});
  }
  function renderResume(){
    const card=$('resume-card');if(!card)return;
    const s=state.session;card.hidden=!s;if(!s)return;
    const current=questionById.get(s.ids[s.position]),response=s.responses[current?.id];
    const hasDraft=response&&!response.submitted&&(response.selected.length||response.text?.trim());
    const progress=s.finished?'已完成，可回顾':`进度 ${s.position+1}/${s.ids.length}${hasDraft?' · 有草稿':''}`;
    const go=s.finished?'回顾':'继续';
    card.innerHTML=`<button type="button" class="resume-mini" id="resume-learning"><strong>继续上次</strong><span class="resume-mini-meta">${esc(s.title)} · ${progress}</span><span class="resume-mini-go">${go} →</span></button>`;
    const btn=$('resume-learning');if(btn)btn.onclick=()=>openStudy();
  }
  
  function todayEvents(){const key=today();return (DATA.events||[]).filter(e=>dateKey(e.time)===key);}
  function todayAccuracy(){const graded=todayEvents().filter(e=>typeof e.correct==='boolean'&&!e.self);if(!graded.length)return null;return Math.round(100*graded.filter(e=>e.correct).length/graded.length);}
  function wrongCount(){return DATA.questions.filter(q=>record(q.id).wrong).length;}
  function favoriteCount(){return DATA.questions.filter(q=>record(q.id).favorite).length;}
  function untaggedCount(){return DATA.questions.filter(q=>!(tags(q)||[]).length).length;}
  function rootTopics(){return state.topics.filter(t=>t.parent==null);}
  function branchCount(id){return DATA.questions.filter(q=>matches(q,[id])).length;}
  function setNav(mode){(host.querySelectorAll('.app-nav .nav-item')||[]).forEach(b=>b.classList.toggle('active',b.dataset.nav===mode));}
  
  function setRail(mode){
    host.querySelectorAll('#rail-nav .rail-item').forEach(b=>b.classList.toggle('active',b.dataset.rail===mode));
  }
  function updateResumeRail(){
    const btn=$('rail-resume');if(!btn)return;
    const s=state.session;btn.hidden=!s||!!s.finished;
  }
  function renderStatsPanel(){
    const answered=dailyCount(),acc=todayAccuracy();
    const map={
      'stat-answered':answered,
      'stat-accuracy':acc==null?'—':(acc+'%'),
      'stat-wrong':wrongCount(),
      'stat-fav':favoriteCount(),
      'stat-total':DATA.questions.length,
      'stat-target':state.daily.target
    };
    for(const [id,val] of Object.entries(map)){const el=$(id);if(el)el.textContent=val;}
  }
  function showWorkspace(show){
    const w=$('panel-workspace'),s=$('panel-stats');
    if(w)w.hidden=!show;if(s)s.hidden=show;
  }
  function railNavigate(mode, opts={}){
    uiMode=mode;browseMode=opts.mode||(mode==='banks'?'banks':mode==='topics'?'topic':'library');
    if(mode==='daily'){$('daily-target').value=state.daily.target;describeDaily();$('daily-dialog').showModal();return;}
    if(mode==='settings'){const mb=$('manage-button');if(mb)mb.click();return;}
    if(mode==='resume'){if(state.session&&!state.session.finished){openStudy();return;}toast('没有可继续的练习');mode='practice';}

    setRail(mode==='resume'?'practice':mode);
    showWorkspace(mode!=='stats');
    if(mode==='stats'){renderStatsPanel();$('browse-title').textContent='统计';$('browse-subtitle').textContent='学习统计';updateResumeRail();return;}

    if(opts.tab)tab=opts.tab;
    else if(mode==='wrong')tab='wrong';
    else if(mode==='favorites')tab='favorites';
    else tab='all';

    if(mode==='wrong'||mode==='favorites')state.limitTopicsOnSpecialTabs=false;
    if(opts.clearTopics!==false && mode!=='topics'){state.filters=[];state.excludedTopics=[];state.scopeActive=false;}
    if(mode==='topics'){/* keep filters; ensure topic panel visible */}
    if(opts.clearBank!==false && mode!=='banks' && !opts.keepBank)state.sourceFilter=null;
    if(opts.sourceFilter!==undefined)state.sourceFilter=opts.sourceFilter;
    if(opts.search!=null){search=opts.search;const qs=$('question-search');if(qs)qs.value=search;}

    const titles={
      practice:['练习','题库浏览 · 选择分类后可顺序 / 随机 / 错题重练'],
      banks:['按分类练习','选择分类后可顺序练 / 随机 / 本类错题'],
      wrong:['错题本','默认不限知识点；可勾选「限当前知识点」'],
      favorites:['收藏','已收藏的题目'],
      topics:['知识点','在左侧勾选要练的知识点'],
    };
    const t=titles[mode]||titles.practice;
    $('browse-title').textContent=opts.title||t[0];
    $('browse-subtitle').textContent=opts.subtitle||t[1];

    const showNkHome=(browseMode==='banks'||mode==='banks'||mode==='practice')&&!state.sourceFilter;
    const showBanks=showNkHome;
    const nkHome=$('nk-bank-home');if(nkHome)nkHome.hidden=!showNkHome;
    const bp=$('bank-picker');if(bp)bp.hidden=true;
    const desk=$('desk-library');
    const wantTopics=(mode==='topics')||!!opts.openTopics;
    const tp=$('topic-panel');
    if(tp)tp.hidden=showBanks||!wantTopics;
    if(desk){desk.classList.toggle('list-mode',!!showBanks||!wantTopics);desk.classList.toggle('topics-open',!showBanks&&wantTopics&&!(tp&&tp.hidden));}
    const lh=$('list-heading');if(lh)lh.hidden=showBanks;
    const qlist=$('question-list');if(qlist)qlist.hidden=showBanks;
    const lpag=$('list-pagination');if(lpag)lpag.hidden=showBanks;
    const qwrap=host.querySelector('.qtable-wrap');if(qwrap)qwrap.hidden=!!showBanks;
    const ba=$('bank-actions');if(ba){const nk=$('nk-bank-home');ba.hidden=!state.sourceFilter||(nk&&!nk.hidden);}
    if(showBanks)renderBankPicker();
    page=0;batch.clear();save();renderLibrary();updateResumeRail();
  }
  function showHome(){railNavigate('practice');}
  function showBrowse(opts={}){
    const mode=opts.mode==='banks'?'banks':(opts.tab==='wrong'?'wrong':opts.tab==='favorites'?'favorites':opts.mode==='topic'?'topics':'practice');
    railNavigate(mode,{...opts,keepBank:!!opts.sourceFilter,clearBank:!opts.sourceFilter,clearTopics:opts.clearTopics!==false});
  }

  /* Category model: the 10 display categories (state.categories on the service) replace per-paper cards. */
  const CAT_DEFS=(DATA.categoryDefs&&DATA.categoryDefs.length?DATA.categoryDefs:[{code:'ANA',name:'模拟电路'},{code:'DIG',name:'数字电路'},{code:'PCB',name:'PCB/信号完整性/EMC/电源完整性'},{code:'PWR',name:'电源'},{code:'MCU',name:'处理器/嵌入式/计算机组成'},{code:'COM',name:'接口/总线/通信与网络'},{code:'DEV',name:'器件/可靠性/安规与热设计'},{code:'TST',name:'测试与仪器'},{code:'SIG',name:'信号系统/电磁场/通信原理/控制'},{code:'GEN',name:'硬件通用/无法归类'}]).map(c=>({id:c.code,label:c.name}));
  function catLabel(code){if(code==='UNC')return '未分类（新导入）';return CAT_DEFS.find(c=>c.id===code)?.label||code;}
  function catList(){const list=[...CAT_DEFS];if(DATA.questions.some(q=>(q.category||'UNC')==='UNC'))list.push({id:'UNC',label:catLabel('UNC')});return list;}
  function inSource(q,f=state.sourceFilter){if(!f)return true;f=String(f);return f.startsWith('cat:')?(q.category||'UNC')===f.slice(4):q.sourceId===f;}
  function srcKey(q){return 'cat:'+(q.category||'UNC');}
  function qLabel(q){return q.catNo||(catLabel(q.category||'UNC')+(q.number?' #'+q.number:''));}
  function bankQuestions(sourceId){return DATA.questions.filter(q=>inSource(q,sourceId));}
  function qMatchesType(q){
    if(!nkTypeFilter)return true;
    const t=q.type||((q.answer&&q.answer.length>1)?'multi':'single');
    return t===nkTypeFilter;
  }
  function isAnsweredRecord(r){return !!(r&&(r.attempts||r.lastResult||r.wrong));}
  function bankProgress(sourceId){
    const qs=bankQuestions(sourceId).filter(qMatchesType);
    let done=0,wrong=0;
    for(const q of qs){const r=record(q.id);if(isAnsweredRecord(r))done++;if(r.wrong)wrong++;}
    return {total:qs.length,done,wrong};
  }
  function bankNewHint(sourceId,prog){
    const fresh=Math.max(0,prog.total-prog.done);
    if(fresh<=0||prog.done<=0)return '';
    return `<span class="nk-new-badge">新题+${fresh}</span>`;
  }
  function renderNkHistory(){
    const list=$('nk-history-list');if(!list)return;
    const items=[];
    const s=state.session;
    if(s&&s.ids&&s.ids.length){
      const submitted=s.ids.filter(id=>s.responses[id]?.submitted).length;
      const status=s.finished?'已完成':'未完成';
      const cls=s.finished?'done':'todo';
      items.push(`<button type="button" class="nk-hist-item" data-nk-hist="resume"><span class="nk-hist-title">${esc(s.title||'最近练习')}</span><span class="nk-hist-meta">${submitted}/${s.ids.length}</span><span class="nk-hist-status ${cls}">${status}</span></button>`);
    }
    const bankTimes=new Map();
    for(const q of DATA.questions){
      const r=record(q.id);const t=r.lastResult?.time;if(!t)continue;const k=srcKey(q);
      const prev=bankTimes.get(k)||0;if(t>prev)bankTimes.set(k,t);
    }
    const recent=[...bankTimes.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
    for(const [bid] of recent){
      if(s&&!s.finished&&s.title&&bankLabel(bid)===s.title)continue;
      const prog=bankProgress(bid);
      const unfinished=prog.done>0&&prog.done<prog.total;
      items.push(`<button type="button" class="nk-hist-item" data-pick-bank="${esc(bid)}"><span class="nk-hist-title">${esc(bankLabel(bid))}</span><span class="nk-hist-meta">已做 ${prog.done}/${prog.total}</span><span class="nk-hist-status ${unfinished?'todo':'done'}">${unfinished?'未完成':'已完成'}</span></button>`);
    }
    list.innerHTML=items.join('')||'<div class="nk-hist-empty">暂无练习记录</div>';
  }
  function renderBankPicker(){
    const home=$('nk-bank-home');const el=$('bank-picker');
    if(home)home.hidden=false;
    const tabs=$('nk-cat-tabs');
    if(tabs){tabs.innerHTML='';tabs.hidden=true;}
    const tf=$('nk-type-filters');
    if(tf){
      const types=[{id:null,label:'全部'},{id:'single',label:'单选'},{id:'multi',label:'多选'}];
      tf.innerHTML=types.map(t=>`<button type="button" class="nk-type-chip ${nkTypeFilter===t.id?'active':''}" data-nk-type="${t.id||''}">${t.label}</button>`).join('');
    }
    const cats=catList().map(c=>({id:'cat:'+c.id,code:c.id,title:c.label})).filter(c=>bankQuestions(c.id).some(qMatchesType));
    const withProg=cats.map(c=>({c,prog:bankProgress(c.id)}));
    const sections=[];
    const unfinished=withProg.filter(x=>x.prog.done>0&&x.prog.done<x.prog.total).map(x=>x.c);
    if(unfinished.length)sections.push({title:'继续练习',banks:unfinished});
    sections.push({title:'全部分类',banks:cats});
    const cardHtml=s=>{
      const prog=bankProgress(s.id);
      const active=state.sourceFilter===s.id?'active':'';
      return `<button type="button" class="bank-picker-card nk-bank-card nk-cat-card ${active}" data-pick-bank="${esc(s.id)}"><div class="nk-card-top"><span class="nk-cat-code">${esc(s.code)}</span><strong>${esc(s.title)}</strong>${bankNewHint(s.id,prog)}</div><div class="bank-picker-meta nk-card-progress"><span class="nk-done">已做 ${prog.done}/${prog.total}题</span><span class="wrong">错题 ${prog.wrong}</span></div></button>`;
   };
    const secEl=$('nk-bank-sections');
    if(secEl){
      secEl.innerHTML=sections.map(sec=>`<section class="nk-section"><h3 class="nk-section-title">${esc(sec.title)}</h3><div class="nk-card-grid">${sec.banks.map(cardHtml).join('')||'<div class="empty-state"><strong>该分类暂无题目</strong></div>'}</div></section>`).join('')||'<div class="empty-state"><strong>暂无题目</strong></div>';
    }
    if(el){el.innerHTML='';el.hidden=true;}
    renderNkHistory();
  }
    function renderHome(){renderStatsPanel();}
  function setNav(mode){/* compat no-op for old calls */ setRail(mode==='review'?'wrong':mode==='home'?'practice':mode);}
  function handleHomeAction(){/* removed mobile home */}
  let homeActions={};


  function renderLibrary(){
    updateResumeRail();
    const ba=$('bank-actions');if(ba){const nk=$('nk-bank-home');ba.hidden=!state.sourceFilter||(nk&&!nk.hidden);}
    if($('daily-button'))$('daily-button').textContent=`每日刷题 · ${dailyCount()} / ${state.daily.target}`;
    renderTopics();renderResume();const list=pool(),pageSize=16,maxPage=Math.max(0,Math.ceil(list.length/pageSize)-1);page=Math.min(page,maxPage);
    const visible=list.slice(page*pageSize,(page+1)*pageSize);
    if($('pool-count'))$('pool-count').textContent=list.length+' 题';
    const scopeLabel='范围：'+titleForScope();
    if($('scope-title'))$('scope-title').textContent=scopeLabel;
    const chip=$('scope-chip');if(chip)chip.textContent=scopeLabel;
    const planned=Math.min(list.length,Number($('question-count')?.value||20));
    if($('scope-description'))$('scope-description').textContent=`当前范围 ${list.length} 道题，计划练习 ${planned} 道 · ${tab==='wrong'?'错题复习':tab==='favorites'?'收藏练习':(state.sourceFilter?'分类筛选':'分类不限')}${((tab==='wrong'||tab==='favorites')&&!state.limitTopicsOnSpecialTabs)?' · 不限知识点':''}`;
    const limitWrap=$('scope-limit-wrap'),limitBox=$('limit-topic-filter');
    if(limitWrap&&limitBox){limitWrap.hidden=!(tab==='wrong'||tab==='favorites');limitBox.checked=!!state.limitTopicsOnSpecialTabs;}
    updateOrderAvailability(list);
    const banks=$('bank-shortcuts');
    if(banks){banks.innerHTML='';banks.hidden=true;}
    const sl=$('start-learning');if(sl)sl.disabled=!list.length;
    const sl2=$('start-learning-secondary');if(sl2)sl2.disabled=!list.length;
    const sel=$('selected-topics');
    if(sel)sel.innerHTML=(state.sourceFilter?`<span class="filter-chip bank-filter-chip">${esc(bankLabel(state.sourceFilter))}<button type="button" data-clear-bank="1" aria-label="清除分类筛选">×</button></span>`:'')+(topicScopeSummary()?`<span class="scope-summary">${esc(topicScopeSummary())}</span><button type="button" class="text-button scope-reset" data-reset-topics="1">清除筛选</button>`:'');
    const qlEl=$('question-list');
    if(qlEl)qlEl.innerHTML=visible.length?visible.map(q=>{
      const qs=tags(q),r=record(q.id);
      const srcLabel=catLabel(q.category||'UNC');
      const stem=(q.stem||'').replace(/\s+/g,' ').trim();
      const practiced=!!(r.attempts||r.lastResult||r.wrong);const status=r.wrong?'<span class="status-wrong">错题</span>':practiced?'<span class="status-done">已练</span>':'<span class="status-todo">未练</span>';
      const tagHtml=qs.length?qs.slice(0,2).map(id=>`<span class="tag-chip" title="${esc(path(id))}">${esc(topic(id)?.name||id)}</span>`).join('')+(qs.length>2?`<span class="tag-chip muted">+${qs.length-2}</span>`:''):'<span class="tag-chip unclassified">未归类</span>';
      const favCls=r.favorite?' favorite':'';
      return `<div class="qtable-row" data-question="${esc(q.id)}"><span class="col-check"><input type="checkbox" data-select="${esc(q.id)}" aria-label="选择题目 ${esc(q.number)}" ${batch.has(q.id)?'checked':''}></span><span class="col-no" title="${esc(q.source||'')}">${esc(q.catNo||q.number||'')}</span><button type="button" class="col-stem" data-practice="${esc(q.id)}" title="${esc(stem)}">${esc(stem)}</button><button type="button" class="col-src source-chip" data-bank-filter="${esc(srcKey(q))}" title="按该分类筛选">${esc(srcLabel)}</button><span class="col-tags">${tagHtml}<button type="button" class="row-tag-button linkish" data-tag="${esc(q.id)}">标</button></span><span class="col-status">${status}<button type="button" class="row-action${favCls}" data-favorite="${esc(q.id)}" aria-label="${r.favorite?'取消收藏':'收藏题目'}" title="${r.favorite?'取消收藏':'收藏'}">${r.favorite?'★':'☆'}</button></span></div>`;
    }).join(''):`<div class="empty-state"><strong>这个范围内暂时没有题目</strong><p>可以换一个条件再试</p><div class="empty-actions"><button type="button" class="secondary" data-empty-action="all-wrong">查看全部错题</button><button type="button" class="secondary" data-empty-action="clear-topics">清除知识点筛选</button><button type="button" class="secondary" data-empty-action="clear-bank">清除分类筛选</button><button type="button" class="secondary" data-empty-action="all">全部题目</button></div></div>`;
    const pag=$('list-pagination');
    if(pag)pag.innerHTML=list.length?`<button class="secondary" data-page="${page-1}" ${page===0?'disabled':''}>上一页</button><span>${page+1} / ${maxPage+1} 页</span><button class="secondary" data-page="${page+1}" ${page===maxPage?'disabled':''}>下一页</button>`:'';
    const sp=$('select-page');
    if(sp){sp.checked=!!visible.length&&visible.every(q=>batch.has(q.id));sp.indeterminate=visible.some(q=>batch.has(q.id))&&!sp.checked;}
    const bact=$('batch-actions');if(bact)bact.hidden=!batch.size;
    const bc=$('batch-count');if(bc)bc.textContent='已选 '+batch.size+' 题';
    (host.querySelectorAll('#library-tabs button')||[]).forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});
  }
  function topicScopeSummary(){if(!state.scopeActive||!state.filters.length)return '';const roots=selectedRoots();if(!roots.length)return '';if(roots.length===1){const id=roots[0];const name=id==='unclassified'?'未归类':(topic(id)?.name||id);return (id!=='unclassified'&&descendants(id).length>1)?('已选：'+name+'（含下属）'):('已选：'+name);}return '已选 '+roots.length+' 个知识点';}
  function titleForScope(){let topicPart;if(!state.scopeActive||!state.filters.length)topicPart='全部知识点';else{const roots=selectedRoots();if(!roots.length)topicPart='全部知识点';else if(roots.length===1){const id=roots[0];const name=id==='unclassified'?'未归类':(topic(id)?.name||id);topicPart=(id!=='unclassified'&&descendants(id).length>1)?(name+'（含下属）'):name;}else topicPart='已选 '+roots.length+' 个知识点';}const bankPart=state.sourceFilter?(' · '+bankLabel(state.sourceFilter)):'';return topicPart+bankPart;}
  function startStudy(ids){
    const previous=state.session;
    if(previous)for(const [id,r] of Object.entries(previous.responses))if(!r.submitted&&(r.selected.length||r.text?.trim()))state.drafts[id]=r;
    const responses={};for(const id of ids)if(state.drafts[id])responses[id]=JSON.parse(JSON.stringify(state.drafts[id]));
    state.session={ids,position:0,responses,title:titleForScope(),tab,order:$('question-order').value,finished:false,startedAt:Date.now()};
    save();renderLibrary();openStudy();
    if(previous&&!previous.finished)toast('之前的答题记录已保留，本次开始新的练习。');
  }
  // Sequential-by-number: number order (catNo), start at the first question not yet done, take the chosen count (wraps to the start).
  function seqDone(id){const r=record(id);return (r.attempts||0)>0||!!r.lastResult;}
  function seqPick(ids,n){const qn=id=>questionById.get(id)?.catNo||'';const list=ids.map((id,i)=>({id,i})).sort((a,b)=>{const x=qn(a.id),y=qn(b.id);return x&&y&&x!==y?(x<y?-1:1):a.i-b.i;}).map(o=>o.id);if(!list.length)return [];const start=Math.max(0,list.findIndex(id=>!seqDone(id)));return [...list.slice(start),...list.slice(0,start)].slice(0,Math.max(1,n));}
  function orderedPool(list){return quizSample(list.map(id=>questionById.get(id)),state,DATA.events || [],$('question-order').value).map(q=>q.id);}
  function startFromPool(){const list=orderedPool(pool().map(q=>q.id)).slice(0,Number($('question-count').value));if(list.length)startStudy(list);else toast('暂无到期保温题，可以选择均匀随机开始学习。');}
  function current(){const s=state.session;return s?questionById.get(s.ids[s.position]):null;}
  function response(q=current()){if(!q)return null;return state.session.responses[q.id]||={selected:[],text:'',submitted:false,correct:null,self:false};}
  // Practice shares the native note viewport with the right pane, without making it inert.
  const studyViewport=host.closest('.note-detail-render') || host.parentElement;
  const studyClip=host.closest('.scrolling-container') || studyViewport;
  let studyLayoutFrame=0;
  function syncStudyLayout(){
    studyLayoutFrame=0;
    const dialog=$('study-dialog'),rect=studyViewport.getBoundingClientRect(),clip=studyClip.getBoundingClientRect();
    const left=Math.max(0,rect.left,clip.left),top=Math.max(0,rect.top,clip.top);
    const bounds={left,top,width:Math.max(0,Math.min(innerWidth,rect.right,clip.right)-left),height:Math.max(0,Math.min(innerHeight,rect.bottom,clip.bottom)-top)};
    for(const [key,value] of Object.entries(bounds)){
      const name='--study-'+key,next=value+'px';
      if(dialog.style.getPropertyValue(name)!==next)dialog.style.setProperty(name,next);
    }
  }
  function scheduleStudyLayout(){if($('study-dialog').open&&!studyLayoutFrame)studyLayoutFrame=requestAnimationFrame(syncStudyLayout);}
  const studyResize=new ResizeObserver(scheduleStudyLayout);studyResize.observe(studyViewport);studyResize.observe(studyClip);
  realDocument.addEventListener('scroll',scheduleStudyLayout,true);
  window.addEventListener('resize',scheduleStudyLayout);
  function openStudy(){if(!state.session)return;renderStudy();syncStudyLayout();if(!$('study-dialog').open)$('study-dialog').show();$('question-scroll').focus({preventScroll:true});}
  async function closeStudy(){if(!await save())return;$('study-dialog').close();renderLibrary();}
  function toggleFavorite(id){const r=state.records[id]||={attempts:0,wrong:false,favorite:false};r.favorite=!r.favorite;save();if($('study-dialog').open&&!state.session.finished)renderStudy(false);renderLibrary();}
  function feedback(q,r){
    if(!r.submitted)return '';
    const e=q.enrichment,disputed=e?.reviewStatus==='needs-review';
    const title=disputed&&r.correct!==null&&!r.self?(r.correct?'按原参考答案：正确':'按原参考答案：错误'):r.correct===null?'暂无参考答案，请自行评估':r.self?(r.correct?'自评：已掌握':'自评：待巩固'):r.correct?'回答正确':'回答错误 · 已加入错题';
    const optionList=keys=>keys.length?`<ul class="option-analysis-list">${keys.map(key=>`<li><strong>${esc(key)}</strong><span>${esc(e.options[key])}</span></li>`).join('')}</ul>`:'';
    const answer=disputed&&e.suggestedAnswer?.length?e.suggestedAnswer:q.answer;
    const focus=e?[...new Set([...(e.focusOptions||[]),...r.selected.filter(k=>!answer.includes(k))])].filter(k=>e.options?.[k]):[];
    const more=e?Object.keys(e.options||{}).filter(k=>!focus.includes(k)):[];
    const analysis=e?`${disputed?`<div class="analysis-review"><strong>参考答案待核对</strong><p>${esc(e.reviewReason||'题目条件或原参考答案需要核对。')}${e.suggestedAnswer?.length?` 建议答案：${esc(e.suggestedAnswer.join('、'))}。`:''} 原判分答案保留。</p></div>`:''}<p class="explanation">${esc(e.summary)}</p>${e.steps?.length?`<ol class="analysis-steps">${e.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol>`:''}${optionList(focus)}${more.length?`<details class="original-analysis option-details"><summary>选项辨析</summary>${optionList(more)}</details>`:''}${q.explanation||e.sources?.length?`<details class="original-analysis"><summary>原始解析与依据</summary>${q.explanation?`<p class="explanation">${richText(q,'explanation')}</p>`:''}${e.sources?.length?`<p>${e.sources.filter(url=>/^https:\/\//.test(url)).map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">官方资料 ${i+1}</a>`).join(' · ')}</p>`:''}</details>`:''}`:`<p class="explanation ${q.explanation?'':'explanation-empty'}">${q.explanation?richText(q,'explanation'):esc('此题的原始资料未提供解析。可通过「更正答案」补充参考解析。')}</p>`;

    return `<section class="feedback" aria-live="polite"><div class="feedback-heading ${r.correct===true?'correct':r.correct===false?'wrong':''}"><span>${r.correct===true?'✓':r.correct===false?'×':'◉'}</span>${title}</div><p class="feedback-answer">${q.type==='self'?`你的思路：<strong>${esc(r.text||'未填写')}</strong>`:`你的选择：<strong>${esc(r.selected.join('、'))}</strong>${q.answer.length?`　参考答案：<strong>${esc(q.answer.join('、'))}</strong>`:''}`}</p>${r.correct===null?'<div class="self-grade-actions"><button class="secondary" data-grade="true">我已掌握</button><button class="secondary" data-grade="false">需要巩固</button></div>':''}<h3>答案解析</h3>${analysis}</section>`;
  }
  function renderStudy(resetScroll=true){
    const s=state.session;if(!s)return;
    const submitted=s.ids.filter(id=>s.responses[id]?.submitted).length;
    const ac=$('answered-count');if(ac)ac.textContent=submitted+' / '+s.ids.length;
    const bar=$('session-progress-bar');if(bar)bar.style.width=(s.ids.length?(submitted/s.ids.length*100):0)+'%';
    const map=$('answer-map');
    if(map)map.innerHTML=s.ids.map((id,i)=>{const r=s.responses[id],classes=[i===s.position&&!s.finished?'current':'',r?.submitted?(r.self||r.correct===null?'self':r.correct?'correct':'wrong'):(r?.selected.length||r?.text?'draft':'')].join(' ');return `<button type="button" class="${classes}" data-position="${i}" aria-label="第 ${i+1} 题" aria-current="${i===s.position?'step':'false'}">${i+1}${record(id).favorite?'<span class="map-star">★</span>':''}</button>`;}).join('');
    if(s.finished){
      const st=$('study-title');if(st)st.textContent='练习结束 · '+s.ids.length+' 题';
      renderSummary();return;
    }
    const q=current(),r=response(q),r0=record(q.id),qs=tags(q);
    const type=q.type==='multi'?'多选题':q.type==='self'?'自评题':'单选题';
    const bankLabel=(q.catNo?q.catNo+' · ':'')+catLabel(q.category||'UNC');
    const st=$('study-title');if(st)st.textContent=`练习中 · 第 ${s.position+1} / ${s.ids.length}`;
    const sm=$('study-mode');if(sm){sm.hidden=true;sm.textContent=(s.tab==='wrong'?'错题复习':s.tab==='favorites'?'收藏练习':'练习')+' · '+(orders[s.order]||'均匀随机');}
    const fav=$('study-favorite');if(fav){fav.dataset.favorite=q.id;fav.textContent=r0.favorite?'★ 已收藏':'☆ 收藏';fav.classList.toggle('is-on',!!r0.favorite);}
    const badge=$('expert-badge');if(badge){const has=!!(q.enrichment&&(q.enrichment.summary||q.enrichment.steps));badge.hidden=!has;badge.classList.toggle('active',has);}
    const qp=$('question-position');if(qp)qp.textContent='第 '+(s.position+1)+' / '+s.ids.length+' 题';
    const stemMeta=`第 ${s.position+1} / ${s.ids.length} 题${bankLabel?' · '+bankLabel:''} · ${type}`;
    const explainOpen=!!r.submitted;
    const ql=$('study-question');
    if(ql)ql.innerHTML=`<div class="question-meta"><span class="type-badge">${type}</span><span class="stem-index">${esc(stemMeta)}</span><span class="meta-hint">${r.submitted?'已提交':q.type==='multi'?'可多选':'作答后提交'}</span></div><div class="study-tags">${qs.length?qs.map(id=>`<span class="tag-chip" title="${esc(path(id))}">${esc(topic(id)?.name||id)}</span>`).join(''):'<span class="tag-chip unclassified">未归类</span>'}<button type="button" class="row-tag-button" data-tag="${esc(q.id)}">编辑标签</button></div><h3 class="study-stem">${richText(q,'stem')}</h3>${(q.images||[]).map(src=>`<img class="question-figure" src="${esc(src)}" alt="原题附图">`).join('')}${q.type==='self'?`<div class="self-answer"><label for="self-response">记录答案或思路</label><textarea id="self-response" ${r.submitted?'readonly':''} placeholder="写下自己的理解，提交后对照解析自评。">${esc(r.text||'')}</textarea></div>`:`<div class="options">${(q.options||[]).map(o=>{const picked=r.selected.includes(o.key),correct=r.submitted&&q.answer.includes(o.key),wrong=r.submitted&&picked&&!q.answer.includes(o.key)&&r.correct===false;return `<button type="button" class="option ${picked?'chosen':''} ${correct?'is-correct':wrong?'is-wrong':''}" data-option="${esc(o.key)}" aria-pressed="${picked}" ${r.submitted?'disabled':''}><span class="option-key">${esc(o.key)}</span><span class="option-text">${richText(q,'',o)}</span><span class="option-status">${correct?'✓':wrong?'×':picked?'●':''}</span></button>`;}).join('')}</div>`}<div class="question-source">${q.catNo?'编号：'+esc(q.catNo)+' · ':''}来源：${esc(q.source||'')}${q.pages&&q.pages.length?' · 第 '+q.pages.join('、')+' 页':''}${q.answerSource?` · 标答来源：${esc(q.answerSource)}`:''}${q.webSources?.[0]?.url&&/^https:\/\/www\.nowcoder\.com\//.test(q.webSources[0].url)?` · <a href="${esc(q.webSources[0].url)}" target="_blank" rel="noopener noreferrer">原题页面</a>`:''}</div>${wrapExplain(feedback(q,r),explainOpen)}`;
    const prev=$('previous-question');if(prev)prev.disabled=s.position===0;
    const skip=$('skip-question');if(skip)skip.hidden=true;
    const primary=$('primary-study-action');
    if(primary){primary.textContent='提交';primary.disabled=!!r.submitted||(q.type!=='self'&&!(r.selected&&r.selected.length));}
    const nextBtn=$('next-question');if(nextBtn){nextBtn.disabled=false;nextBtn.textContent=s.position===s.ids.length-1&&r.submitted?'完成':'下一题';}
    const fs=$('font-smaller');if(fs)fs.disabled=state.font<=18;
    const fl=$('font-larger');if(fl)fl.disabled=state.font>=26;
    const ss=$('save-status');if(ss)ss.textContent=storageError?'保存失败':bridge.pending()||draftTimer?'保存中…':'已保存';
    const area=$('self-response');if(area)area.oninput=()=>{r.text=area.value;state.drafts[q.id]={...r};saveDraft();renderMapOnly();};
    if(resetScroll){const sc=$('question-scroll');if(sc)sc.scrollTop=0;}
  }
  function wrapExplain(html,open){
    if(!html)return `<details class="explain-panel"><summary>解析（已折叠）</summary><div class="explain-body"><p class="explanation explanation-empty">提交后显示解析。</p></div></details>`;
    return `<details class="explain-panel" ${open?'open':''}><summary>${open?'解析':'解析（已折叠）'}</summary><div class="explain-body">${html}</div></details>`;
  }
  function renderMapOnly(){const scroll=$('question-scroll').scrollTop,active=document.activeElement;if(active?.id==='self-response'){
      const s=state.session,index=s.position,b=$('answer-map').querySelector(`[data-position="${index}"]`);b?.classList.toggle('draft',!!response().text.trim());
    }else{renderStudy(false);$('question-scroll').scrollTop=scroll;}}
  function choose(key){const q=current(),r=response();if(!q||r.submitted||q.type==='self'||!q.options.some(o=>o.key===key))return;r.selected=q.type==='multi'?(r.selected.includes(key)?r.selected.filter(k=>k!==key):[...r.selected,key]):[key];state.drafts[q.id]={...r};save();renderStudy(false);}
  function submit(){if(failed){toast('保存失败，请先导出未保存内容');return;}const q=current(),r=response();if(!q||r.submitted||q.type!=='self'&&!r.selected.length)return;
    r.attemptId='study_'+crypto.randomUUID();r.submitted=true;r.correct=q.type==='self'||!q.answer.length?null:JSON.stringify([...r.selected].sort())===JSON.stringify([...q.answer].sort());delete state.drafts[q.id];
    const rr=state.records[q.id]||={attempts:0,wrong:false,favorite:false};rr.attempts++;if(r.correct!==null)rr.wrong=!r.correct;rr.lastResult={correct:r.correct,self:false,time:Date.now()};countDaily(q.id);save();renderStudy(false);renderLibrary();
    // Keep marked options visible; explanations expand naturally below them.
  }
  function selfGrade(correct){const q=current(),r=response();if(!r.submitted||r.correct!==null)return;r.correct=correct;r.self=true;const rr=state.records[q.id];rr.wrong=!correct;rr.lastResult={correct,self:true,time:Date.now()};save();renderStudy(false);renderLibrary();}
  function move(position){const s=state.session;if(position<0||position>=s.ids.length)return;s.position=position;s.finished=false;save();renderStudy();}
  function next(){const s=state.session;if(s.position<s.ids.length-1)move(s.position+1);else{s.finished=true;save();renderStudy();renderLibrary();}}
  function renderSummary(){
    const s=state.session,results=s.ids.map(id=>s.responses[id]).filter(r=>r?.submitted),objective=results.filter(r=>r.correct!==null&&!r.self),correct=objective.filter(r=>r.correct).length,wrong=s.ids.filter(id=>s.responses[id]?.submitted&&s.responses[id].correct===false).length;
    $('study-question').innerHTML=`<section class="session-summary"><div class="summary-icon">✓</div><h2>这一段练习，先到这里</h2><p>已保存本次答题记录，可以继续巩固薄弱内容。</p><div class="summary-stats"><div><strong>${results.length}</strong><span>已练习 / ${s.ids.length} 题</span></div><div><strong>${objective.length?Math.round(correct/objective.length*100)+'%':'—'}</strong><span>本次客观题正确率</span></div><div><strong>${wrong}</strong><span>待巩固</span></div></div><div class="summary-actions">${wrong?'<button class="primary" id="review-session-wrong">再练本次错题</button>':''}<button class="secondary" id="return-to-question">查看答题记录</button></div></section>`;
    $('previous-question').disabled=false;$('question-position').textContent='本次练习回顾';$('skip-question').hidden=true;$('primary-study-action').textContent='保存并关闭';$('primary-study-action').disabled=false;
    const _rtq=$('return-to-question');if(_rtq)_rtq.onclick=()=>move(0);const retry=$('review-session-wrong');if(retry)retry.onclick=()=>{const ids=s.ids.filter(id=>s.responses[id]?.submitted&&s.responses[id].correct===false);startStudy(ids);};$('question-scroll').scrollTop=0;
  }
  function openTags(ids){tagTargets=ids;$('tags-title').textContent=ids.length>1?'批量添加知识点':'编辑题目知识点';$('tags-description').textContent=ids.length>1?`为选中的 ${ids.length} 道题添加标签，保留原有标签。`:'一道题可归属于多个知识点，取消勾选可移除标签。';const existing=ids.length===1?tags(questionById.get(ids[0])):[];
    $('tag-options').innerHTML=state.topics.map(t=>`<label class="tag-choice"><input type="checkbox" value="${esc(t.id)}" ${existing.includes(t.id)?'checked':''}><span>${esc(t.name)}${t.parent?`<span class="topic-path">　${esc(path(t.parent))}</span>`:''}</span></label>`).join('');$('tags-dialog').showModal();
  }
  $('save-tags').onclick=()=>{const chosen=[...$('tag-options').querySelectorAll('input:checked')].map(i=>i.value);for(const id of tagTargets){const q=questionById.get(id);state.tags[id]=tagTargets.length>1?[...new Set([...tags(q),...chosen])]:chosen;}save();$('tags-dialog').close();batch.clear();renderLibrary();if($('study-dialog').open&&!state.session.finished)renderStudy(false);toast('知识点标签已保存');};
  $('topic-tree').onchange=e=>{const id=e.target.dataset.topic;if(id)selectTopic(id,e.target.checked);};
  $('topic-tree').onclick=e=>{const fold=e.target.closest('[data-fold]');if(fold){const id=fold.dataset.fold;if(expandedTopics.has(id))expandedTopics.delete(id);else expandedTopics.add(id);try{localStorage.setItem('hw-quiz-expanded-topics',JSON.stringify([...expandedTopics]));}catch{}renderTopics();$('topic-tree').querySelectorAll('[data-fold]').forEach(b=>{if(b.dataset.fold===id)b.focus();});return;}if(e.target.closest('[data-all]')){resetTopicFilters();}};
  $('selected-topics').onclick=e=>{if(e.target.dataset.clearBank)clearSourceFilter();else if(e.target.dataset.resetTopics)resetTopicFilters();};
  $('library-tabs').onclick=e=>{const button=e.target.closest('[data-tab]');if(!button)return;tab=button.dataset.tab;page=0;batch.clear();renderLibrary();};
  $('question-search').oninput=e=>{search=e.target.value;page=0;batch.clear();renderLibrary();};
  $('question-list').onclick=e=>{const target=e.target.closest('button');if(!target)return;if(target.dataset.bankFilter){setSourceFilter(target.dataset.bankFilter);return;}if(target.dataset.emptyAction){const a=target.dataset.emptyAction;if(a==='all-wrong'){tab='wrong';state.limitTopicsOnSpecialTabs=false;state.sourceFilter=null;state.scopeActive=false;state.filters=[];state.excludedTopics=[];}else if(a==='clear-topics'){state.scopeActive=false;state.filters=[];state.excludedTopics=[];}else if(a==='clear-bank'){state.sourceFilter=null;}else if(a==='all'){tab='all';state.scopeActive=false;state.filters=[];state.excludedTopics=[];state.sourceFilter=null;}page=0;batch.clear();save();renderLibrary();return;}if(target.dataset.practice)startStudy([target.dataset.practice]);else if(target.dataset.tag)openTags([target.dataset.tag]);else if(target.dataset.favorite)toggleFavorite(target.dataset.favorite);};
  $('bank-shortcuts').onclick=e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.clearBank)clearSourceFilter();else if(t.dataset.bankFilter)setSourceFilter(state.sourceFilter===t.dataset.bankFilter?null:t.dataset.bankFilter);};
  const limitBoxInit=$('limit-topic-filter');if(limitBoxInit)limitBoxInit.onchange=e=>{state.limitTopicsOnSpecialTabs=!!e.target.checked;page=0;batch.clear();save();renderLibrary();};
  const dailyScopeInit=$('daily-use-scope');if(dailyScopeInit)dailyScopeInit.onchange=e=>{state.dailyUseCurrentScope=!!e.target.checked;save();describeDaily();};
  $('question-list').onchange=e=>{const id=e.target.dataset.select;if(!id)return;if(e.target.checked)batch.add(id);else batch.delete(id);renderLibrary();};
  $('select-page').onchange=e=>{const visible=pool().slice(page*16,(page+1)*16);for(const q of visible)if(e.target.checked)batch.add(q.id);else batch.delete(q.id);renderLibrary();};
  $('clear-selected').onclick=()=>{batch.clear();renderLibrary();};$('batch-tag').onclick=()=>openTags([...batch]);
  $('list-pagination').onclick=e=>{const value=e.target.closest('[data-page]')?.dataset.page;if(value===undefined)return;page=Number(value);renderLibrary();};
  $('question-count').value=state.quantity||20;$('question-order').value=state.order||'random';$('question-count').onchange=()=>{state.quantity=Number($('question-count').value);save();renderLibrary();};$('question-order').onchange=()=>{state.order=$('question-order').value;save();renderLibrary();};
  $('start-learning').onclick=startFromPool;
  const _sl2=$('start-learning-secondary');if(_sl2)_sl2.onclick=startFromPool;
  const scopeChip=$('scope-chip');
  if(scopeChip)scopeChip.onclick=()=>{
    const tp=$('topic-panel'),desk=$('desk-library');
    if(!tp||($('bank-picker')&&!$('bank-picker').hidden))return;
    const open=!!tp.hidden;
    tp.hidden=!open;
    if(desk){desk.classList.add('list-mode');desk.classList.toggle('topics-open',open);}
  };
  $('close-study').onclick=closeStudy;
  $('study-dialog').addEventListener('cancel',e=>{e.preventDefault();closeStudy();});
  const _sq=$('study-question');if(_sq)_sq.onclick=e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.option)choose(button.dataset.option);else if(button.dataset.favorite)toggleFavorite(button.dataset.favorite);else if(button.dataset.tag)openTags([button.dataset.tag]);else if(button.dataset.editStem)openQuestionEdit('stem');else if(button.dataset.edit)openQuestionEdit('answer');else if(button.dataset.grade)selfGrade(button.dataset.grade==='true');};
  $('answer-map').onclick=e=>{const b=e.target.closest('[data-position]');if(b)move(Number(b.dataset.position));};
  const _prevQ=$('previous-question');if(_prevQ)_prevQ.onclick=()=>{if(state.session)move(Math.max(0,state.session.position-1));};
  const _skipQ=$('skip-question');if(_skipQ)_skipQ.onclick=next;
  const _nextQ=$('next-question');if(_nextQ)_nextQ.onclick=()=>{if(!state.session)return;if(state.session.finished)closeStudy();else next();};
  const _primary=$('primary-study-action');if(_primary)_primary.onclick=()=>{if(!state.session)return;if(state.session.finished)closeStudy();else submit();};
  const _studyFav=$('study-favorite');if(_studyFav)_studyFav.onclick=()=>{const id=_studyFav.dataset.favorite;if(id)toggleFavorite(id);};
  const _studyEdit=$('study-edit-question');if(_studyEdit)_studyEdit.onclick=()=>openQuestionEdit('all');
  const _toolStem=$('tool-edit-stem');if(_toolStem)_toolStem.onclick=()=>openQuestionEdit('stem');
  const _toolAns=$('tool-edit-answer');if(_toolAns)_toolAns.onclick=()=>openQuestionEdit('answer');
  const _expert=$('expert-badge');if(_expert)_expert.onclick=()=>{const panel=host.querySelector('.explain-panel');if(panel){panel.open=true;panel.scrollIntoView({block:'nearest'});}};

  $('font-smaller').onclick=()=>{state.font=Math.max(18,state.font-2);applyAppearance();save();renderStudy(false);};$('font-larger').onclick=()=>{state.font=Math.min(26,state.font+2);applyAppearance();save();renderStudy(false);};
  $('theme-toggle').onclick=()=>{state.theme=host.classList.contains('dark')?'light':'dark';applyAppearance();save();};
  $('add-topic').onclick=()=>{$('topic-name').value='';$('topic-parent').innerHTML='<option value="">无上级（一级知识点）</option>'+state.topics.map(t=>`<option value="${esc(t.id)}">${esc(path(t.id))}</option>`).join('');$('topic-dialog').showModal();$('topic-name').focus();};
  $('close-topic').onclick=()=>$('topic-dialog').close();$('topic-form').onsubmit=e=>{e.preventDefault();const name=$('topic-name').value.trim(),parent=$('topic-parent').value||null;if(!name)return;if(state.topics.some(t=>t.name===name&&t.parent===parent)){toast('同一层级已有这个知识点');return;}state.topics.push({id:'topic_'+crypto.randomUUID(),name,parent});save();$('topic-dialog').close();renderLibrary();toast('知识点已创建');};
  $('manage-button').onclick=()=>{$('source-list').innerHTML=DATA.sources.map(s=>`<div class="source-row"><span>${esc(s.title)}</span><small>${s.count} 道题</small></div>`).join('');$('source-select').innerHTML=DATA.sources.map(s=>`<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('');$('manage-dialog').showModal();};
  $('daily-button').onclick=()=>{$('daily-target').value=state.daily.target;describeDaily();$('daily-dialog').showModal();};
  function describeDaily(){const target=Number($('daily-target').value),count=dailyCount(),eligible=dailyPool().length;const remaining=Math.max(0,target-count);const scopeText=state.dailyUseCurrentScope?('当前筛选：'+titleForScope()):'全库（不限知识点/分类）';const box=$('daily-use-scope');if(box)box.checked=!!state.dailyUseCurrentScope;$('daily-description').textContent=`今日已练 ${count} 题 · ${scopeText}${remaining?' · 本次可练 '+Math.min(remaining,eligible)+' 题':' · 今日目标已完成'}`;$('start-daily').textContent=remaining&&eligible?'保存并开始':'保存目标';}
  $('daily-target').oninput=describeDaily;$('close-daily').onclick=()=>$('daily-dialog').close();
  $('daily-form').onsubmit=e=>{e.preventDefault();const target=Number($('daily-target').value);if(!Number.isSafeInteger(target)||target<1)return;state.daily.target=target;const remaining=Math.max(0,target-dailyCount()),ids=orderedPool(dailyPool().map(q=>q.id)).slice(0,remaining);save();$('daily-dialog').close();renderLibrary();if(ids.length)startStudy(ids);else toast(remaining?(state.dailyUseCurrentScope?'当前筛选下没有今日尚未练习的题目，可改回全库或调整筛选。':'全库中没有今日尚未练习的题目。'):'每日目标已保存');};
  function download(value,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('export-prototype').onclick=async()=>{try{await lastSave;download(await bridge.export(),'通用刷题学习记录.json');}catch(e){toast(e.message);}};
  $('export-unsaved').onclick=()=>download(state,'通用刷题未保存内容.json');
  const template={title:'我的题库',questions:[{stem:'1 + 1 等于多少？',options:['1','2','3'],answer:'B',explanation:'1 + 1 = 2。'},{stem:'下面哪些是偶数？',type:'multi',options:['2','3','4'],answer:['A','C']},{stem:'地球绕太阳公转。',type:'boolean',answer:true},{stem:'简述本知识点。',type:'self',explanation:'参考要点'}]};
  let webPackage=null,webPreview=null;
  $('import-web').onclick=()=>{$('web-dialog').showModal();};
  $('close-web').onclick=()=>$('web-dialog').close();
  $('web-file').onchange=async e=>{
    webPackage=null;webPreview=null;$('web-confirm').disabled=true;$('web-preview').textContent='正在检查…';
    try{
      const file=e.target.files?.[0];if(!file){$('web-preview').textContent='';return;}
      if(file.size>20*1024*1024)throw Error('题目包不能超过 20 MB');
      const pack=JSON.parse(await file.text());webFormat.validate(pack);await lastSave;
      const preview=await bridge.previewWeb(pack);webPackage=pack;webPreview=preview;
      const c=preview.counts;$('web-preview').textContent=`新增 ${c.new} · 补全 ${c.update} · 重复 ${c.duplicate} · 冲突 ${c.conflict}。${preview.similar?'相同题干的不同变体 '+preview.similar+' 题，将分别保留。':''}`;
      $('web-items').innerHTML=preview.items.map(i=>`<div class="web-preview-item"><span>${({new:'新增',update:'补全',duplicate:'重复',conflict:'冲突 · 跳过'})[i.status]}</span><p>${esc(i.stem)}</p>${i.reason?`<small>${esc(i.reason)}${i.suggestedAnswer?.length?'；网页建议：'+esc(i.suggestedAnswer.join('、')):''}</small>`:''}</div>`).join('');
      $('web-confirm').disabled=c.new+c.update+c.duplicate===0;
    }catch(error){$('web-preview').textContent=error.message;$('web-items').replaceChildren();}
  };
  $('web-confirm').onclick=async()=>{
    if(!webPackage||!webPreview)return;$('web-confirm').disabled=true;
    try{
      await lastSave;const data=await bridge.action('importWebQuestions',{package:webPackage});reloadData(data);
      const c=data.importReport.counts;$('web-preview').textContent=`已完成：新增 ${c.new}，补全 ${c.update}，重复 ${c.duplicate}，跳过冲突 ${c.conflict}。学习记录保持不变。`;
      webPackage=null;toast('网页题目已导入；冲突题未覆盖。');
    }catch(error){$('web-preview').textContent=error.message+'。请重新选择文件预览。';webPackage=null;}
  };
  $('import-bank').onclick=()=>$('import-dialog').showModal();$('close-import').onclick=()=>$('import-dialog').close();
  $('import-template').onclick=()=>download(template,'题库导入模板.json');
  $('import-file').onchange=async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>20*1024*1024)throw Error('题库文件不能超过 20 MB');$('import-content').value=await file.text();}catch(e){toast(e.message);}finally{e.target.value='';}};
  function reloadData(data){DATA.questions=data.questions;if(data.categoryDefs)DATA.categoryDefs=data.categoryDefs;DATA.sources=data.index.banks;DATA.events=data.events;questionById.clear();for(const q of DATA.questions)questionById.set(q.id,q);state={...state,...data.study};renderLibrary();}
  $('import-form').onsubmit=async e=>{e.preventDefault();$('import-confirm').disabled=true;try{const data=await bridge.action('importBank',{bank:JSON.parse($('import-content').value)});reloadData(data);$('import-dialog').close();$('manage-dialog').close();$('import-content').value='';toast('题目已导入未归类，可以跨来源练习。');}catch(e){toast(e.message);}finally{$('import-confirm').disabled=false;}};
  $('export-source').onclick=()=>{const id=$('source-select').value;download({title:DATA.sources.find(s=>s.id===id).title,questions:DATA.questions.filter(q=>q.sourceId===id).map(({record,tags,source,sourceId,sourceNoteId,...q})=>q)},'题目来源-'+id+'.json');};
  $('import-answers').onclick=()=>$('answers-file').click();
  $('answers-file').onchange=async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>5*1024*1024)throw Error('答案文件不能超过 5 MB');const input=JSON.parse(await file.text());if(!Array.isArray(input.answers))throw Error('答案 JSON 需包含 answers 数组，每项含 questionId、answer 和可选 explanation');const bankId=$('source-select').value;await lastSave;const changed=new Set(input.answers.map(a=>a.questionId));if(state.session)for(const id of changed)delete state.session.responses[id];if(!await save())return;const data=await bridge.action('importAnswers',{bankId,answers:input.answers});reloadData(data);toast('参考答案已导入，历史答题记录保留。');}catch(error){toast(error.message);}finally{e.target.value='';}};
  let stemTarget;
  function openStemEdit(){stemTarget=current();$('stem-content').value=stemTarget.stem;$('stem-dialog').showModal();$('stem-content').focus();}
  $('close-stem').onclick=()=>$('stem-dialog').close();
  async function persistStem(restore=false){const button=$('save-stem');button.disabled=true;$('restore-stem').disabled=true;try{await lastSave;const data=await bridge.action('editStem',{bankId:stemTarget.sourceId,questionId:stemTarget.id,stem:$('stem-content').value,restore});reloadData(data);$('stem-dialog').close();renderStudy(false);toast(restore?'已恢复原题干':'题干已保存');}catch(e){toast(e.message);}finally{button.disabled=false;$('restore-stem').disabled=false;}}
  $('stem-form').onsubmit=e=>{e.preventDefault();persistStem();};
  $('restore-stem').onclick=()=>persistStem(true);
  let editTarget, editFocus='all';
  function openEdit(focus='answer'){openQuestionEdit(focus);}
  function openQuestionEdit(focus='all'){
    editTarget=current();if(!editTarget)return;
    editFocus=focus||'all';
    const title=$('edit-dialog-title');if(title)title.textContent='编辑题目 · '+(editTarget.id||'');
    const stem=$('edit-stem');if(stem){stem.value=editTarget.stem||'';stem.disabled=false;}
    const typeEl=$('edit-type');
    if(typeEl){
      typeEl.value=editTarget.type||'single';
      typeEl.disabled=editTarget.type==='self';
      const selfOpt=typeEl.querySelector('option[value=self]');if(selfOpt)selfOpt.disabled=editTarget.type!=='self';
    }
    const exp=$('edit-explanation');if(exp)exp.value=editTarget.explanation||'';
    const src=$('edit-answer-source');if(src)src.textContent=editTarget.answerSource?('当前标答来源：'+editTarget.answerSource):'';
    renderEditOptions();
    const dlg=$('edit-dialog');if(dlg)dlg.showModal();
    if(focus==='stem'&&stem)stem.focus();
    else if(focus==='answer'){const first=host.querySelector('#edit-options-list input[type=checkbox]');if(first)first.focus();}
    else if(stem)stem.focus();
  }
  function renderEditOptions(){
    const list=$('edit-options-list');if(!list||!editTarget)return;
    const opts=editTarget.options||[];
    const ans=new Set(editTarget.answer||[]);
    const isSelf=editTarget.type==='self'||($('edit-type')&&$('edit-type').value==='self');
    if(isSelf){list.innerHTML='<p class="edit-hint">自评题请将参考说明写在解析中。</p>';const ansEl=$('edit-answer');if(ansEl)ansEl.value='';return;}
    list.innerHTML=opts.map(o=>`<label class="edit-option-row"><span class="edit-opt-key">${esc(o.key)}</span><input type="checkbox" data-edit-key="${esc(o.key)}" ${ans.has(o.key)?'checked':''} aria-label="标为正确答案 ${esc(o.key)}"><input type="text" data-edit-text="${esc(o.key)}" value="${esc(o.text)}" maxlength="4000" aria-label="选项 ${esc(o.key)} 内容"></label>`).join('');
    syncEditAnswerHidden();
  }
  function syncEditAnswerHidden(){
    const ansEl=$('edit-answer');if(!ansEl)return;
    const keys=[...host.querySelectorAll('#edit-options-list input[type=checkbox]:checked')].map(el=>el.dataset.editKey).filter(Boolean).sort();
    ansEl.value=keys.join('');
  }
  const _closeEdit=$('close-edit');if(_closeEdit)_closeEdit.onclick=()=>{const d=$('edit-dialog');if(d)d.close();};
  const _cancelEdit=$('cancel-edit');if(_cancelEdit)_cancelEdit.onclick=()=>{const d=$('edit-dialog');if(d)d.close();};
  const _editType=$('edit-type');if(_editType)_editType.onchange=()=>renderEditOptions();
  const _optList=$('edit-options-list');
  if(_optList){_optList.onchange=e=>{if(e.target&&e.target.matches('input[type=checkbox]')){const t=$('edit-type');if(t&&t.value==='single'){host.querySelectorAll('#edit-options-list input[type=checkbox]').forEach(cb=>{if(cb!==e.target)cb.checked=false;});}syncEditAnswerHidden();}};}
  const _editForm=$('edit-form');
  if(_editForm)_editForm.onsubmit=async e=>{
    e.preventDefault();
    if(!editTarget)return;
    try{
      await lastSave;
      if(state.session)delete state.session.responses[editTarget.id];
      delete state.drafts[editTarget.id];
      if(!await save())return;
      syncEditAnswerHidden();
      const stemVal=($('edit-stem')&&$('edit-stem').value)||'';
      const typeVal=($('edit-type')&&$('edit-type').value)||editTarget.type;
      const expVal=($('edit-explanation')&&$('edit-explanation').value)||'';
      const options=[...host.querySelectorAll('#edit-options-list input[data-edit-text]')].map(inp=>({key:inp.dataset.editText,text:inp.value}));
      const answer=($('edit-answer')&&$('edit-answer').value)||'';
      const data=await bridge.action('edit',{bankId:editTarget.sourceId,questionId:editTarget.id,stem:stemVal,options:typeVal==='self'?undefined:options,answer:typeVal==='self'?'':answer,type:typeVal,explanation:expVal});
      reloadData(data);
      const d=$('edit-dialog');if(d)d.close();
      renderStudy(false);renderLibrary();
      toast('题目已保存到题库覆盖');
    }catch(err){toast(err.message||String(err));}
  };

  // Scope answer shortcuts to practice. Keys in chat or other native panels never answer a question.
  $('study-dialog').addEventListener('keydown',e=>{
    if(!$('study-dialog').open||host.querySelector('dialog[open]:not(#study-dialog)')||e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();void closeStudy();return;}
    if(e.target.matches('input,textarea,select,[contenteditable=true]'))return;
    let handled=true;
    if(/^[a-h]$/i.test(e.key)&&state.session&&!state.session.finished)choose(e.key.toUpperCase());
    else if(e.key==='Enter'&&!e.target.closest('button')){const r=response();if(r&&r.submitted){const n=$('next-question');if(n)n.click();else next();}else{const p=$('primary-study-action');if(p)p.click();}}
    else if(e.key==='ArrowLeft'){const p=$('previous-question');if(p)p.click();}
    else if(e.key==='ArrowRight'){const n=$('next-question');if(n)n.click();else next();}
    else handled=false;
    if(handled){e.preventDefault();e.stopPropagation();}
  });
  const unload=e=>{if(bridge.pending()||draftTimer||failed){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',unload);
  
  
  const _bb=$('browse-back');if(_bb)_bb.onclick=()=>showHome();
  const appNav=host.querySelector('.app-nav');if(appNav)appNav.onclick=e=>{
    const btn=e.target.closest('[data-nav]');if(!btn)return;
    const nav=btn.dataset.nav;
    if(nav==='home')showHome();
    else if(nav==='review'){state.limitTopicsOnSpecialTabs=false;showBrowse({mode:'library',tab:'wrong',title:'复习',subtitle:'错题与收藏',clearTopics:true,clearBank:true,nav:'review'});}
    else if(nav==='settings'){$('manage-button').click();}
  };
  const _hs=$('home-search');if(_hs)_hs.addEventListener('keydown',e=>{
    if(e.key!=='Enter')return;
    const q=e.target.value.trim();
    showBrowse({mode:'library',tab:'all',title:'搜索结果',subtitle:q?('关键词：'+q):'全部题目',clearTopics:true,clearBank:true,search:q,nav:'home'});
  });
  function pickBankFromUi(bankId){
    if(!bankId)return;
    state.sourceFilter=bankId;browseMode='library';uiMode='practice';
    const nk=$('nk-bank-home');if(nk)nk.hidden=true;
    const bp=$('bank-picker');if(bp)bp.hidden=true;
    const _tp=$('topic-panel');if(_tp)_tp.hidden=true;const _desk=$('desk-library');if(_desk){_desk.classList.add('list-mode');_desk.classList.remove('topics-open');}const _lh=$('list-heading');if(_lh)_lh.hidden=false;const _ql=$('question-list');if(_ql)_ql.hidden=false;const _lp=$('list-pagination');if(_lp)_lp.hidden=false;const _qw=host.querySelector('.qtable-wrap');if(_qw)_qw.hidden=false;
    const ba=$('bank-actions');if(ba)ba.hidden=false;
    $('browse-title').textContent=bankLabel(state.sourceFilter);
    $('browse-subtitle').textContent='本分类题目 · 可用下方按钮顺序 / 随机 / 错题重练';
    setRail('banks');page=0;batch.clear();save();renderLibrary();updateResumeRail();
  }
  function onNkHomeClick(e){
    const cat=e.target.closest('[data-nk-cat]');
    if(cat){nkCat=cat.dataset.nkCat;renderBankPicker();return;}
    const typ=e.target.closest('[data-nk-type]');
    if(typ){nkTypeFilter=typ.dataset.nkType||null;renderBankPicker();return;}
    const hist=e.target.closest('[data-nk-hist]');
    if(hist){
      const act=hist.dataset.nkHist;
      if(act==='resume'){if(state.session&&!state.session.finished)openStudy();else toast('没有可继续的练习');return;}
      if(act==='wrong'){railNavigate('wrong');return;}
    }
    const b=e.target.closest('[data-pick-bank]');if(b)pickBankFromUi(b.dataset.pickBank);
  }
  const _nkHome=$('nk-bank-home');if(_nkHome)_nkHome.onclick=onNkHomeClick;
  $('bank-picker').onclick=e=>{
    const b=e.target.closest('[data-pick-bank]');if(!b)return;
    pickBankFromUi(b.dataset.pickBank);
  };

  
  const railNav=host.querySelector('#rail-nav');
  if(railNav)railNav.onclick=e=>{const btn=e.target.closest('[data-rail]');if(!btn)return;railNavigate(btn.dataset.rail);};
  const bankAct=$('bank-actions');
  if(bankAct)bankAct.onclick=e=>{
    const btn=e.target.closest('[data-bank-act]');if(!btn||!state.sourceFilter)return;
    const act=btn.dataset.bankAct;
    const ids=DATA.questions.filter(q=>inSource(q)&&qMatchesType(q)).map(q=>q.id);
    if(act==='sequential'){const list=seqPick(ids,Number($('question-count').value)||20);if(list.length)startStudy(list);else toast('该分类没有题目');return;}
    if(act==='random'){const n=Number($('question-count').value)||20;const list=orderedPool(ids).slice(0,n);if(list.length)startStudy(list);else toast('该分类没有题目');return;}
    if(act==='wrong'){const list=ids.filter(id=>record(id).wrong);if(list.length)startStudy(orderedPool(list).slice(0,Number($('question-count').value)||50));else toast('该分类暂无错题');return;}
  };
  const toggleCard=$('toggle-answer-card');
  if(toggleCard)toggleCard.onclick=()=>{const d=$('study-dialog');d.classList.toggle('card-collapsed');toggleCard.textContent=d.classList.contains('card-collapsed')?'\u27e8':'\u27e9';};

  applyAppearance();railNavigate('practice');
  // renderLibrary via showHome/renderHome path; ensure browse widgets ready
  renderLibrary();

  return()=>{studyResize.disconnect();cancelAnimationFrame(studyLayoutFrame);realDocument.removeEventListener('scroll',scheduleStudyLayout,true);window.removeEventListener('resize',scheduleStudyLayout);if(draftTimer)save();clearTimeout(toastTimer);for(const [type,fn] of listeners)realDocument.removeEventListener(type,fn);window.removeEventListener('beforeunload',unload);host.querySelectorAll('dialog[open]').forEach(d=>d.close());};
}

import {useEffect,useRef,useState} from 'trilium:preact';
export default function(){ /* reload-safe anonymous default export */
    const root=useRef(null),[error,setError]=useState(''),[ready,setReady]=useState(false);
    useEffect(()=>{
        let alive=true,cleanup,service,revision,queue=Promise.resolve(),blocked=false,pending=0;
        async function call(action,payload={}){
            if(!service){const n=await api.getNote('HwQuizSvc01');service=await n.getContent();}
            return api.runOnBackend(service,[action,payload]);
        }
        (async()=>{
            try{
                const data=await call('studyLoad');revision=data.revision;if(!alive)return;
                root.current.innerHTML=QUIZ_HTML;
                const bridge={
                    save(snapshot){
                        if(blocked)return Promise.reject(Error('保存已暂停，请导出未保存内容并重新打开插件'));
                        pending++;
                        const job=queue.then(async()=>{
                            if(blocked)throw Error('保存已暂停');
                            const result=await call('studySave',{revision,study:snapshot});revision=result.revision;return result;
                        });
                        const tracked=job.finally(()=>pending--);
                        queue=tracked.catch(e=>{blocked=true;if(alive)setError(e.message || String(e));});
                        return tracked;
                    },
                    async action(action,payload={}){
                        await queue;if(blocked)throw Error('保存失败，请先导出未保存内容');
                        const result=await call(action,{revision,...payload});revision=result.state.revision;
                        return {...await call('studyLoad'),importReport:result.importReport};
                    },
                    async previewWeb(packageData){await queue;if(blocked)throw Error('保存失败，请先导出未保存内容');return call('previewWebQuestions',{revision,package:packageData});},
                    export:()=>call('export'),
                    pending:()=>pending>0
                };
                cleanup=quizLearningApp({...data,sources:data.index.banks,topics:[]},root.current,bridge);
                setReady(true);
            }catch(e){if(alive)setError(e.message || String(e));}
        })();
        return()=>{alive=false;cleanup?.();};
    },[]);
    return <main className="hw-quiz-root">{error&&<div key="quiz-error" role="alert" className="hw-quiz-error">{error} · 可在「导入与管理」导出未保存内容，然后重新打开插件。</div>}{!ready&&!error&&<p key="quiz-loading">正在加载题目…</p>}<div key="quiz-host" className="hw-quiz" ref={root}/></main>;
}
