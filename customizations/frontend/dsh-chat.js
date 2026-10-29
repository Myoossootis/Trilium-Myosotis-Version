// Native right-pane client. Primary: messages and send; secondary: history/model; tertiary: usage.
// Reuse Trilium theme tokens and native pane sizing; no note/question contents or API keys.
module.exports = new class extends api.RightPanelWidget {
    static get parentWidget() { return 'right-pane'; }
    get parentWidget() { return 'right-pane'; }
    get position() { return 1; }
    get widgetTitle() { return 'DeepSeek'; }
    async doRenderBody() {
    if (this.controller) { this.controller.mount(this.$body); return; }
    const card = this.$body[0].closest('.card.widget');
    card?.classList.add('grow', 'dsh-panel-widget');
    const deepseekWhale = (await (await api.getNote('DsChatIcon01')).getContent()).replace('fill="#000"','fill="currentColor"');
    const service = await (await api.getNote('DsChatSvc01')).getContent();
    let formatter = null, formatFailure = '';
    try { formatter = new Function(await (await api.getNote('DsChatFmt01')).getContent())(); }
    catch { formatFailure = '消息渲染组件未加载，请重新安装插件后刷新窗口。'; }
    const call = (action, payload = {}) => api.runAsyncOnBackendWithManualTransactionHandling(service, [action, payload]);
    const host = document.createElement('div');
    host.id = 'trilium-dsh-chat';
    host.style.cssText = 'display:flex;flex:1;min-width:0;min-height:0;width:100%;';
    this.$body.empty().append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
<style>
:host{container-type:inline-size;font-family:var(--main-font-family,"Segoe UI","Microsoft YaHei",sans-serif);font-size:14px;color:var(--main-text-color,#26303e)}
*{box-sizing:border-box} [hidden]{display:none!important}
.ds{--paper:var(--main-background-color,#fff);--soft:var(--accented-background-color,#f6f7f9);--ink:var(--main-text-color,#26303e);--muted:var(--muted-text-color,#788394);--line:var(--main-border-color,#e2e6ed);--blue:var(--theme-accent,#4d6bfe);--blue-soft:color-mix(in srgb,var(--blue) 10%,var(--paper));color:var(--ink);font:14px/1.65 var(--main-font-family,"Segoe UI","Microsoft YaHei",sans-serif)}
button,textarea,input{font:inherit;color:inherit}button{cursor:pointer;border:0;background:none}button:disabled{opacity:.45;cursor:default}button:focus-visible,textarea:focus-visible,input:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
.glyph{font-size:19px;line-height:1}.ds{display:flex;flex:1;min-width:0;min-height:0;width:100%}.chat{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;width:100%;background:var(--paper)}
.head{display:flex;gap:10px;align-items:center;flex-shrink:0;padding:13px 14px;border-bottom:1px solid var(--line)}.mark svg{width:24px;height:24px}.mark{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:var(--blue-soft);color:var(--blue)}.brand{font-size:16px;font-weight:600;letter-spacing:-.3px}.status{color:var(--muted);font-size:12px;max-width:205px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.spacer{flex:1;min-width:0}.icon{display:grid;place-items:center;width:29px;height:29px;border-radius:7px;font-size:17px;flex-shrink:0}.icon:hover{background:var(--soft)}.icon.active{color:var(--blue);background:var(--blue-soft)}
.sessionbar{display:flex;align-items:center;gap:8px;padding:8px 15px;background:var(--soft);flex-shrink:0;font-size:12px}.title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hint{color:var(--muted);font-size:11px;white-space:nowrap}.body{position:relative;min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden}
.history{position:absolute;inset:0 auto 0 0;width:min(275px,100%);z-index:2;background:var(--paper);border-right:1px solid var(--line);box-shadow:10px 0 25px #0001;overflow:auto;padding:13px 11px}.history-head{display:flex;align-items:center;justify-content:space-between;margin:0 5px 12px;font-weight:600}.search{width:100%;border:1px solid var(--line);border-radius:7px;padding:8px 10px;background:var(--soft);font-size:12px;margin-bottom:12px}.session{display:block;width:100%;text-align:left;padding:11px 10px;border-radius:8px;margin:3px 0;font-size:13px;overflow-wrap:anywhere}.session:hover{background:var(--soft)}.session.active{color:var(--blue);background:var(--blue-soft)}.session small{display:block;font-size:11px;color:var(--muted);margin-top:3px}
.log{min-height:0;flex:1;overflow:auto;padding:18px 18px 9px;scrollbar-width:thin}.empty{color:var(--muted);text-align:center;padding:45px 15px;font-size:13px}.message{margin:0 0 21px;overflow-wrap:anywhere;font-size:13px;white-space:pre-wrap}.message.user{padding:10px 13px;width:fit-content;max-width:91%;margin-left:auto;background:var(--blue-soft);border-radius:12px 12px 3px 12px}.speaker{color:var(--blue);font-size:12px;font-weight:600;margin-bottom:7px}.message.live{color:var(--ink)}.older{display:block;margin:0 auto 18px;font-size:12px;color:var(--muted);padding:5px 10px}.older:hover{color:var(--blue)}
.error{flex-shrink:0;margin:0 12px 8px;padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:var(--soft);font-size:12px;overflow-wrap:anywhere}.reconnect{color:var(--blue);padding:0 3px;font-size:12px}
.compose{flex-shrink:0;border:1px solid var(--line);border-radius:11px;padding:10px;margin:0 12px 8px}.compose:focus-within{border-color:var(--blue)}.input{display:block;width:100%;min-height:52px;max-height:160px;resize:vertical;border:0;background:transparent;color:var(--ink);font-size:13px;line-height:1.6;padding:0}.compose-bottom{display:flex;align-items:center;margin-top:8px;gap:8px}.send{background:var(--blue);color:#fff;width:30px;height:30px;display:grid;place-items:center;border-radius:8px;font-size:19px}.send:disabled{background:var(--soft);color:var(--muted);opacity:1}.foot{display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:11px;padding:0 13px 11px;flex-shrink:0}
.model-select{min-width:0;flex:1;width:100%;border:0;background:var(--soft);border-radius:6px;color:var(--ink);font-size:11px;padding:6px 4px}.image-picker{width:30px;height:30px;flex-shrink:0;display:grid;place-items:center;border-radius:7px;font-size:19px}.image-picker:hover{background:var(--soft)}.send{flex-shrink:0}.attachments{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:10px}.attachment{position:relative;width:66px;height:66px}.attachment img{width:100%;height:100%;object-fit:cover;border:1px solid var(--line);border-radius:8px}.remove-image{position:absolute;right:-5px;top:-5px;width:21px;height:21px;display:grid;place-items:center;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:50%;font-size:13px}.chat-image{display:block;max-width:100%;width:180px;min-height:70px;max-height:230px;object-fit:contain;border-radius:8px;background:var(--soft);margin:8px 0}.foot-status{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.formatted{white-space:normal;line-height:1.8}.formatted>:first-child{margin-top:0}.formatted>:last-child{margin-bottom:0}.formatted p{margin:.65em 0}.formatted h1,.formatted h2,.formatted h3,.formatted h4{font-weight:600;line-height:1.5;margin:1.1em 0 .5em}.formatted h1{font-size:1.3em}.formatted h2{font-size:1.2em}.formatted h3{font-size:1.1em}.formatted h4{font-size:1em}.formatted strong{font-weight:600}.formatted ol,.formatted ul{padding-left:1.8em;margin:.65em 0}.formatted li{margin:.35em 0}.formatted a{color:var(--blue);text-decoration:underline}.formatted blockquote{border-left:3px solid var(--line);margin:.8em 0;padding:.1em 1em;color:var(--muted)}.formatted code{font-family:Consolas,monospace;font-size:.95em;background:var(--soft);border-radius:4px;padding:.12em .3em}.formatted pre{white-space:pre;max-width:100%;overflow-x:auto;background:var(--soft);padding:12px;border-radius:8px}.formatted pre code{padding:0;background:none}.formatted table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;margin:.8em 0}.formatted th,.formatted td{border:1px solid var(--line);padding:6px 9px}.formatted hr{border:0;border-top:1px solid var(--line);margin:1em 0}.ds-math math{font-family:"Cambria Math","STIX Two Math",math;font-size:1.15em;color:inherit}.ds-math-display{display:block;max-width:100%;overflow-x:auto;margin:.8em 0;padding:.35em .1em}.formatted .ds-math-error{white-space:pre-wrap;overflow-wrap:anywhere}
@container(max-width:320px){.head{gap:6px;padding:10px}.mark{width:28px;height:28px}.hint{display:none}.log{padding:12px}.foot span:last-child{display:none}}
</style>
<div class="ds"><section class="chat" aria-label="DeepSeek 右侧聊天面板"><header class="head"><span class="mark glyph" aria-hidden="true">${deepseekWhale}</span><div><div class="status" role="status">未连接</div></div><span class="spacer"></span><button class="icon history-toggle" type="button" title="历史会话" aria-label="历史会话">◧</button><button class="icon new" type="button" title="新建对话" aria-label="新建对话">＋</button></header><div class="sessionbar"><span aria-hidden="true">◌</span><span class="title">DeepSeek</span><span class="hint">DSH 本地会话</span></div><div class="body"><aside class="history" aria-label="历史会话" hidden><div class="history-head"><span>历史会话</span><button class="icon history-close" type="button" aria-label="收起历史会话">‹</button></div><input class="search" type="search" aria-label="搜索会话" placeholder="搜索会话"><div class="sessions"></div></aside><div class="log" role="log" aria-label="聊天消息"></div><div class="error" role="alert" hidden><span class="error-text"></span> <button class="reconnect" type="button">重新连接</button></div></div><div class="compose"><div class="attachments" aria-label="待发送图片" hidden></div><input class="image-files" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden><textarea class="input" rows="2" maxlength="20000" aria-label="发送消息" placeholder="发送消息，或粘贴图片…"></textarea><div class="compose-bottom"><button class="image-picker" type="button" title="添加图片（支持粘贴）" aria-label="添加图片">▧</button><select class="model-select" aria-label="DeepSeek 模型" disabled><option>正在读取模型…</option></select><button class="send" type="button" aria-label="发送" disabled>↑</button></div></div><footer class="foot"><span class="foot-status" title="会话累计输入 token 的缓存读取占比，来源为 DSH">缓存命中 —</span><span>Shift + Enter 换行</span></footer></section></div>`;
    const $ = selector => shadow.querySelector(selector);
    const storeKey = 'eric.dsh-chat.ui.v1';
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch { /* Fresh preferences. */ }
    let opened = false, sessionId = typeof saved.sessionId === 'string' ? saved.sessionId : null, items = [], generation = 0, polling = false, disposed = false, connected = false, pending = false, running = false, timer, viewRevision = null, older = [], beforeSeq, hasMore = false, requestId = null, lastDraft = '';
    let catalog = null, selectedModel = null, attachments = [], loadingImages = false;
    const errors = { action: '', poll: '' };
    let messageRenderCache = new Map();
    const imageCache = new Map();
    const pictureObserver = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
            const image = entry.target; pictureObserver.unobserve(image);
            const id = image.dataset.session, attachmentId = image.dataset.attachment, key = id + ':' + attachmentId;
            if (!imageCache.has(key)) {
                const promise = call('attachment', { sessionId: id, attachmentId }).then(result => {
                    if (!['image/png','image/jpeg','image/webp','image/gif'].includes(result.attachment?.mediaType)) throw Error('不支持的历史图片格式');
                    return 'data:' + result.attachment.mediaType + ';base64,' + result.data;
                });
                imageCache.set(key, promise); if (imageCache.size > 24) imageCache.delete(imageCache.keys().next().value);
            }
            imageCache.get(key).then(url => { if (!disposed) image.src = url; }).catch(e => { image.alt = e.message; image.title = e.message; imageCache.delete(key); });
        }
    }, { root: $('.log'), rootMargin: '100px' });
    const save = () => { try { localStorage.setItem(storeKey, JSON.stringify({ sessionId })); } catch { /* UI preferences are optional. */ } };
    // Native tabs remain mounted while hidden. Pause polling without discarding the draft/history.
    const visibility = new IntersectionObserver(() => syncVisibility());
    visibility.observe(host);
    const syncVisibility = () => {
        host.closest('.card.widget')?.classList.add('grow', 'dsh-panel-widget');
        const visible = host.isConnected && host.checkVisibility() && !document.hidden;
        if (visible === opened || disposed) return;
        opened = visible;
        if (opened) { if (!connected) void connect(); else void poll(); }
        else clearTimeout(timer);
    };
    document.addEventListener('visibilitychange', syncVisibility);
    const updateSend = () => {
        $('.send').textContent = running ? '■' : '↑'; $('.send').setAttribute('aria-label', running ? '停止生成' : '发送');
        $('.send').disabled = pending || loadingImages || !connected || (!running && !$('.input').value.trim() && !attachments.length);
        $('.new').disabled = pending || loadingImages; $('.image-picker').disabled = pending || loadingImages;
        $('.model-select').disabled = pending || loadingImages || running || !connected || !catalog;
        shadow.querySelectorAll('.remove-image').forEach(button => { button.disabled = pending || loadingImages; });
        $('.status').textContent = connected ? running ? 'DSH 正在回复…' : '已连接 DSH' : '未连接 DSH';
    };
    function error(message, source = 'action') { errors[source] = message; const shown = errors.poll || errors.action || formatFailure; $('.error-text').textContent = shown; $('.error').hidden = !shown; }
    if (formatFailure) error(formatFailure);
    function modelKey(selection) { return selection ? JSON.stringify([selection.provider, selection.model]) : ''; }
    function renderModels() {
        const select = $('.model-select'); select.replaceChildren();
        if (!catalog) { const option = document.createElement('option'); option.textContent = '模型目录不可用'; select.append(option); return; }
        for (const group of catalog.groups) {
            const optgroup = document.createElement('optgroup'); optgroup.label = group.name;
            for (const model of group.models) { const option = document.createElement('option'); option.value = modelKey({ provider: group.id, model: model.id }); option.textContent = model.name + ' · ' + group.name; optgroup.append(option); }
            select.append(optgroup);
        }
        const key = modelKey(selectedModel);
        if (key && ![...select.options].some(option => option.value === key)) { const option = document.createElement('option'); option.value = key; option.textContent = '当前模型不可用 · ' + selectedModel.model; option.disabled = true; select.prepend(option); }
        select.value = key; select.title = select.selectedOptions[0]?.textContent || '请选择 DSH 模型';
    }
    function showUsage(usage) {
        const label = $('.foot-status');
        label.textContent = Number.isFinite(usage?.cacheHitRate) ? '会话缓存命中 ' + (usage.cacheHitRate * 100).toFixed(1) + '%' : '会话缓存命中 —';
        label.title = usage ? `DSH 会话累计：缓存读取 ${usage.cacheReadTokens.toLocaleString()} / 输入 ${usage.inputTokens.toLocaleString()} tokens；未缓存 ${usage.uncachedInputTokens.toLocaleString()}，缓存写入 ${usage.cacheWriteTokens.toLocaleString()}。` : 'DSH 暂未提供可计算的用量数据';
    }
    function renderAttachments() {
        const container = $('.attachments'); container.replaceChildren(); container.hidden = !attachments.length;
        attachments.forEach((attachment, index) => {
            const div = document.createElement('div'); div.className = 'attachment';
            const image = document.createElement('img'); image.src = attachment.url; image.alt = attachment.name;
            const button = document.createElement('button'); button.type = 'button'; button.className = 'remove-image'; button.setAttribute('aria-label', '移除图片 ' + attachment.name); button.textContent = '×';
            button.onclick = () => { attachments.splice(index, 1); requestId = null; renderAttachments(); updateSend(); };
            div.append(image, button); container.append(div);
        });
    }
    async function addImages(files) {
        if (pending || loadingImages) return; loadingImages = true; updateSend(); error('');
        try {
            const incoming = [...files]; if (attachments.length + incoming.length > 4) throw Error('每次最多发送 4 张图片');
            let total = attachments.reduce((sum, image) => sum + image.bytes, 0); const additions = [];
            for (const file of incoming) {
                if (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)) throw Error('只支持 PNG、JPEG、WebP 和 GIF 图片');
                total += file.size; if (file.size > 4 * 1024 * 1024 || total > 8 * 1024 * 1024) throw Error('单张图片最多 4 MB，每次合计最多 8 MB');
                const url = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('无法读取图片')); reader.readAsDataURL(file); });
                additions.push({ id: crypto.randomUUID(), name: file.name || '粘贴的图片', mediaType: file.type, data: url.split(',')[1], url, bytes: file.size });
            }
            attachments.push(...additions); requestId = null; renderAttachments();
        } catch (e) { error(e.message); }
        finally { loadingImages = false; updateSend(); }
    }
    function renderSessions() {
        const container = $('.sessions'), query = $('.search').value.trim().toLowerCase(); container.replaceChildren();
        for (const item of items.filter(item => item.title.toLowerCase().includes(query))) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'session' + (item.id === sessionId ? ' active' : ''); button.textContent = item.title;
            const small = document.createElement('small'); small.textContent = item.running ? '正在回复' : item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '本地会话'; button.append(small);
            button.onclick = () => { if (!pending && !loadingImages) void selectSession(item.id); }; container.append(button);
        }
        if (!container.children.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = query ? '没有匹配的会话' : '暂无会话'; container.append(p); }
    }
    function renderMessages(view) {
        const log = $('.log'), bottom = log.scrollHeight - log.clientHeight - log.scrollTop < 70, previousScroll = log.scrollTop;
        pictureObserver.disconnect(); log.replaceChildren();
        if (view.hasMore || hasMore) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'older'; button.textContent = '加载更早的消息';
            button.onclick = async () => {
                const id = sessionId, ticket = generation; button.disabled = true;
                try { const result = await call('older', { sessionId: id, beforeSeq: beforeSeq ?? view.beforeSeq }); if (ticket !== generation) return; older = [...result.messages, ...older]; beforeSeq = result.beforeSeq; hasMore = result.hasMore; renderMessages({ ...view, hasMore: false }); }
                catch (e) { if (ticket === generation) error(e.message); } finally { button.disabled = false; }
            }; log.append(button);
        }
        const seen = new Set(), nextRenderCache = new Map();
        for (const item of [...older, ...view.messages, ...(view.live ? [{ id: 'live', role: 'assistant', text: view.live }] : [])]) {
            if (seen.has(item.id)) continue; seen.add(item.id);
            const div = document.createElement('div'); div.className = 'message ' + item.role;
            if (item.role === 'assistant') { const speaker = document.createElement('div'); speaker.className = 'speaker'; speaker.textContent = 'deepseek'; div.append(speaker); }
            const text = document.createElement('div');
            if (item.role === 'assistant' && formatter) {
                let cached = messageRenderCache.get(item.id);
                if (!cached || cached.text !== item.text) cached = { text: item.text, html: formatter.render(item.text) };
                nextRenderCache.set(item.id, cached); text.className = 'formatted'; text.innerHTML = cached.html;
            } else text.textContent = item.text;
            div.append(text); log.append(div);
            for (const attachment of item.images || []) {
                const image = document.createElement('img'); image.className = 'chat-image'; image.alt = attachment.name || '图片'; image.dataset.session = sessionId; image.dataset.attachment = attachment.attachmentId;
                div.append(image); pictureObserver.observe(image);
            }
        }
        if (!seen.size) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '发送消息，开始对话'; log.append(empty); }
        messageRenderCache = nextRenderCache;
        if (bottom || viewRevision === null) log.scrollTop = log.scrollHeight; else log.scrollTop = previousScroll;
    }
    async function poll() {
        clearTimeout(timer); if (!opened || disposed || polling || !sessionId) return;
        const id = sessionId, ticket = generation; polling = true;
        try {
            const view = await call('view', { sessionId: id }); if (disposed || ticket !== generation) return;
            connected = true; running = view.running;
            if (!pending && view.selection && modelKey(view.selection) !== modelKey(selectedModel)) { selectedModel = view.selection; renderModels(); }
            showUsage(view.usage);
            if (view.revision !== viewRevision) { if (beforeSeq === undefined) { beforeSeq = view.beforeSeq; hasMore = view.hasMore; } renderMessages({ ...view, hasMore }); viewRevision = view.revision; }
            error(view.error || '', 'poll'); updateSend();
        } catch (e) { if (ticket === generation && !disposed) { connected = false; error(e.message, 'poll'); updateSend(); } }
        finally { polling = false; if (opened && !disposed) timer = setTimeout(poll, connected ? 650 : 4000); }
    }
    async function selectSession(id) {
        generation++; sessionId = id; viewRevision = null; older = []; beforeSeq = undefined; hasMore = false; running = false; error('');
        imageCache.clear(); messageRenderCache.clear(); showUsage(null);
        $('.title').textContent = items.find(item => item.id === id)?.title || '新对话'; $('.history').hidden = true; $('.history-toggle').classList.remove('active');
        $('.log').replaceChildren(); renderSessions(); save(); updateSend(); await poll();
    }
    async function connect() {
        if (pending) return; pending = true; updateSend(); $('.status').textContent = '正在连接 DSH…';
        try {
            const result = await call('list'); if (disposed) return; items = result.items; connected = true; error(''); error('', 'poll'); renderSessions();
            try { catalog = await call('models'); selectedModel = catalog.default; renderModels(); } catch (e) { catalog = null; renderModels(); error(e.message); }
            if (sessionId && items.some(item => item.id === sessionId)) await selectSession(sessionId);
            else { sessionId = null; $('.title').textContent = '新对话'; $('.log').innerHTML = '<div class="empty">发送消息，开始新对话<br>或从右上角选择历史会话</div>'; save(); }
        } catch (e) { connected = false; error(e.message); }
        finally { pending = false; updateSend(); }
    }
    async function send() {
        if (pending || loadingImages || !connected) return;
        if (running) { pending = true; updateSend(); try { await call('stop', { sessionId }); } catch (e) { error(e.message); } finally { pending = false; updateSend(); } return; }
        const text = $('.input').value.trim(); if (!text && !attachments.length) return;
        pending = true; const ticket = generation; updateSend(); error('');
        try {
            if (!sessionId) {
                const result = await call('new'); sessionId = result.sessionId; items.unshift({ id: sessionId, title: '新对话', updatedAt: Date.now() }); save();
                if (selectedModel) selectedModel = (await call('model', { sessionId, ...selectedModel })).selected;
            }
            const fingerprint = JSON.stringify([sessionId, text, attachments.map(image => image.id)]);
            if (fingerprint !== lastDraft || !requestId) { requestId = crypto.randomUUID(); lastDraft = fingerprint; }
            await call('send', { sessionId, text, requestId, images: attachments.map(({ name, mediaType, data }) => ({ name, mediaType, data })) });
            if (ticket !== generation || disposed) return;
            $('.input').value = ''; attachments = []; renderAttachments(); requestId = null; lastDraft = ''; running = true; viewRevision = null; clearTimeout(timer); void poll();
        } catch (e) { if (ticket === generation) error(e.message); }
        finally { pending = false; updateSend(); }
    }
    $('.history-toggle').onclick = async () => { $('.history').hidden = !$('.history').hidden; $('.history-toggle').classList.toggle('active', !$('.history').hidden); if (!$('.history').hidden && !pending) { try { items = (await call('list')).items; renderSessions(); } catch (e) { error(e.message); } } };
    $('.history-close').onclick = () => { $('.history').hidden = true; $('.history-toggle').classList.remove('active'); };
    $('.search').oninput = renderSessions; $('.reconnect').onclick = connect;
    $('.new').onclick = () => { if (pending || loadingImages) return; generation++; sessionId = null; requestId = null; lastDraft = ''; viewRevision = null; older = []; beforeSeq = undefined; hasMore = false; running = false; clearTimeout(timer); imageCache.clear(); messageRenderCache.clear(); pictureObserver.disconnect(); showUsage(null); $('.title').textContent = '新对话'; $('.history').hidden = true; $('.log').innerHTML = '<div class="empty">发送消息，开始新对话</div>'; error(''); save(); updateSend(); };
    $('.image-picker').onclick = () => $('.image-files').click();
    $('.image-files').onchange = event => { void addImages(event.target.files); event.target.value = ''; };
    $('.input').addEventListener('paste', event => { const images = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean); if (images.length) { event.preventDefault(); void addImages(images); } });
    $('.model-select').onchange = async () => {
        const old = selectedModel; const value = $('.model-select').value; if (!value || pending || running) return;
        const [provider, model] = JSON.parse(value); pending = true; updateSend(); error('');
        try {
            const next = { provider, model };
            selectedModel = sessionId ? (await call('model', { sessionId, ...next })).selected : next;
            if (catalog) catalog.default = selectedModel; renderModels();
        } catch (e) { selectedModel = old; renderModels(); error(e.message); }
        finally { pending = false; updateSend(); }
    };
    $('.send').onclick = send; $('.input').oninput = updateSend;
    $('.input').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void send(); } };
    host.addEventListener('keydown', event => event.stopPropagation());
    const layoutStyle = document.createElement('style');
    layoutStyle.textContent = `
        #right-pane .dsh-panel-widget {min-width:0;--right-pane-grow-min-height:240px}
        #right-pane .dsh-panel-widget > .body-wrapper > .card-body {padding:0;overflow:hidden}
        #right-pane .dsh-panel-widget > .body-wrapper > .card-body > div,
        #right-pane .dsh-panel-widget > .body-wrapper > .card-body > div > .component {display:flex;flex:1;min-width:0;min-height:0}
        #right-pane #DsChatBoot1:not(.collapsed) {display:flex;flex-direction:column;flex:1 1 0;min-height:240px;min-width:0}
        #right-pane #DsChatBoot1 > .body-wrapper {display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
        #right-pane #DsChatBoot1 > .body-wrapper > .card-body {display:flex;flex-direction:column;flex:1;min-height:0;padding:0;overflow:hidden}
        #right-pane #DsChatBoot1 > .body-wrapper > .card-body > div,
        #right-pane #DsChatBoot1 > .body-wrapper > .card-body > div > .component {display:flex;flex:1;min-width:0;min-height:0}
        body:not(.experimental-feature-new-layout) #right-pane .dsh-panel-widget .card-body {height:calc(100vh - 220px);min-height:240px}
        @media(max-width:759px) {
            #right-pane-host.peek:has(#DsChatBoot1) {width:auto!important}
            #right-pane-host.peek:has(#DsChatBoot1) > #right-pane {width:100%!important;max-width:100%}
            #right-pane-host.peek:has(#DsChatBoot1) > .right-pane-peek-spacer,
            #right-pane-host.peek:has(#DsChatBoot1) > .gutter {display:none}
        }
    `;
    host.append(layoutStyle);
    const moduleChanged = () => { if (window.TriliumModules?.enabled('DsChatRoot1') === false) { this.controller?.destroy(); this.controller = null; } };
    window.addEventListener('trilium-modules-changed', moduleChanged);
    this.controller = {
        mount(body) { body.empty().append(host); visibility.observe(host); document.addEventListener('visibilitychange', syncVisibility); syncVisibility(); },
        suspend() { opened = false; clearTimeout(timer); visibility.disconnect(); document.removeEventListener('visibilitychange', syncVisibility); },
        destroy() { disposed = true; generation++; this.suspend(); window.removeEventListener('trilium-modules-changed', moduleChanged); pictureObserver.disconnect(); imageCache.clear(); messageRenderCache.clear(); host.remove(); }
    };
    syncVisibility();
    }
    // Closing the native pane unmounts its widgets. Retain this window's transient draft.
    cleanup() { this.controller?.suspend(); }
};
