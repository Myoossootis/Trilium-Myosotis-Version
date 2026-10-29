import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { messageFromEvent, streamText } from './messages.mjs';
import { promptImages, tokenUsageView, IMAGE_LIMITS } from './media.mjs';

export const name = 'trilium-chat-bridge';
export const inject = ['sessionController', 'agents'];
export const BRIDGE_PROTOCOL = 1;
const PORT = 37846;
const LIMIT = 12 * 1024 * 1024;

export async function apply(ctx) {
    const methods = ['list', 'create', 'follow', 'page', 'prompt', 'cancel'];
    const missing = methods.filter(method => typeof ctx.sessionController?.[method] !== 'function');
    let compatibilityError = missing.length ? `DSH 会话接口已变更（${missing.join(', ')}），请更新聊天桥接。` : '';
    const directory = join(homedir(), '.trilium-dsh-bridge');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const filename = join(directory, 'connection.json');
    let token;
    try { token = JSON.parse(await readFile(filename, 'utf8')).token; } catch { /* First installation. */ }
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) token = randomBytes(32).toString('hex');
    const watches = new Map();
    const signal = () => AbortSignal.timeout(15000);
    const sessionId = value => {
        if (typeof value !== 'string' || !/^[\w-]{1,200}$/.test(value)) throw Error('会话 ID 无效');
        return value;
    };
    function acceptEvent(watch, event) {
        watch.cursor = Math.max(watch.cursor, event.seq);
        const message = messageFromEvent(event);
        if (message && !watch.messages.some(item => item.seq === message.seq)) watch.messages.push(message);
        if (event.type === 'turn/start') watch.running = true;
        if (event.type === 'turn/end') { watch.running = false; watch.live = ''; }
        if (event.type === 'assistant/message' || event.type === 'assistant/attempt') watch.live = '';
        watch.messages = watch.messages.slice(-400);
    }
    async function watchSession(id) {
        let watch = watches.get(id);
        if (watch?.closed) { watches.delete(id); watch = undefined; }
        if (watch) { watch.lastRead = Date.now(); await watch.ready; return watch; }
        const abort = new AbortController();
        watch = { abort, messages: [], live: '', cursor: -1, hasMore: false, beforeSeq: undefined, running: false, revision: 0, lastRead: Date.now(), error: '' };
        let resolveReady, rejectReady;
        watch.ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
        watches.set(id, watch);
        watch.task = (async () => {
            try {
                for await (const frame of ctx.sessionController.follow({ address: { kind: 'session', sessionId: id }, assistantStream: true, maxMessages: 40 }, abort.signal)) {
                    if (frame.type === 'snapshot') {
                        if (!Array.isArray(frame.records) || !Number.isSafeInteger(frame.cursor)) throw Error('DSH 历史数据格式已变更，请更新聊天桥接。');
                        watch.cursor = frame.cursor; watch.hasMore = frame.hasMore;
                        watch.beforeSeq = frame.records[0]?.event?.seq;
                        for (const record of frame.records) if (record.type === 'event') acceptEvent(watch, record.event);
                        watch.running = ctx.agents.get(id)?.status === 'running';
                        watch.live = streamText(frame.assistantStream?.stream);
                        resolveReady();
                    } else if (frame.type === 'event') acceptEvent(watch, frame.event);
                    else if (frame.type === 'assistant-stream') {
                        const live = frame.frame;
                        if (live.type === 'start') { watch.live = ''; watch.running = true; }
                        if (live.type === 'chunk' && live.chunk?.type === 'text-delta') watch.live += live.chunk.text;
                        if (live.type === 'end') watch.live = '';
                    }
                    watch.revision++;
                }
            } catch (error) {
                if (!abort.signal.aborted) { watch.error = error.message; rejectReady(error); }
            } finally { watch.closed = true; resolveReady(); }
        })();
        await watch.ready;
        return watch;
    }
    async function dispatch(body) {
        const { action } = body;
        if (action === 'status') return { connected: !compatibilityError, protocol: BRIDGE_PROTOCOL, version: '1.1.0', error: compatibilityError, imageLimits: IMAGE_LIMITS };
        if (compatibilityError) throw Error(compatibilityError);
        if (action === 'list') {
            const { items } = await ctx.sessionController.list({}, signal());
            if (!Array.isArray(items) || items.some(item => typeof item.sessionId !== 'string')) {
                compatibilityError = 'DSH 会话列表格式已变更，请更新聊天桥接。'; throw Error(compatibilityError);
            }
            return { items: items.map(item => ({ id: item.sessionId, title: item.projections?.values?.title?.title || item.projections?.values?.title || item.title || '新对话', updatedAt: item.updatedAt, running: item.running, cwd: item.cwd, archived: item.archived })).filter(item => !item.archived) };
        }
        if (action === 'models') {
            if (typeof ctx.sessionController.modelCatalog !== 'function') throw Error('当前 DSH 不提供模型目录，请更新桥接适配');
            const catalog = await ctx.sessionController.modelCatalog();
            if (!Array.isArray(catalog.groups) || !catalog.default?.model) throw Error('DSH 模型目录格式已变更，请更新桥接');
            return catalog;
        }
        if (action === 'new') return ctx.sessionController.create({ cwd: homedir() });
        const id = sessionId(body.sessionId);
        if (action === 'model') {
            if (typeof ctx.sessionController.selectModel !== 'function') throw Error('当前 DSH 不提供模型切换，请更新桥接适配');
            if (ctx.agents.get(id)?.status === 'running') throw Error('请等待当前回答结束后再切换模型');
            if (typeof body.provider !== 'string' || typeof body.model !== 'string' || body.provider.length > 200 || body.model.length > 200) throw Error('模型选择无效');
            const request = { sessionId: id, provider: body.provider, model: body.model };
            if (typeof body.reasoningEffort === 'string' && body.reasoningEffort.length < 50) request.reasoningEffort = body.reasoningEffort;
            return ctx.sessionController.selectModel(request);
        }
        if (action === 'view') {
            const watch = await watchSession(id);
            const projections = typeof ctx.sessionController.projections === 'function' ? await ctx.sessionController.projections({ sessionId: id }, signal()) : null;
            const values = projections?.values || {};
            return { messages: watch.messages, live: watch.live, running: ctx.agents.get(id)?.status === 'running' || watch.running, revision: watch.revision, hasMore: watch.hasMore, beforeSeq: watch.beforeSeq, error: watch.error, selection: values.modelSelection?.next || values.modelSelection?.lastUsed || null, usage: tokenUsageView(values.tokenUsage) };
        }
        if (action === 'attachment') {
            if (typeof body.attachmentId !== 'string' || body.attachmentId.length > 300) throw Error('图片标识无效');
            if (typeof ctx.sessionController.attachment !== 'function') throw Error('当前 DSH 不提供历史图片读取');
            const result = await ctx.sessionController.attachment({ sessionId: id, attachmentId: body.attachmentId });
            if (!result.attachment || result.attachment.bytes > IMAGE_LIMITS.total) throw Error('历史图片过大，请在 DSH 中查看');
            return result;
        }
        if (action === 'older') {
            const watch = await watchSession(id);
            if (!Number.isSafeInteger(body.beforeSeq) || body.beforeSeq < 0) throw Error('历史游标无效');
            const page = await ctx.sessionController.page({ address: { kind: 'session', sessionId: id }, throughSeq: watch.cursor, beforeSeq: body.beforeSeq, maxMessages: 40 }, signal());
            return { messages: page.records.map(record => messageFromEvent(record.event)).filter(Boolean), beforeSeq: page.records[0]?.event?.seq, hasMore: page.hasMore };
        }
        if (action === 'send') {
            // Read through the same history adapter before admitting a new model turn.
            // An incompatible update must fail before it can append a user message.
            const watch = await watchSession(id);
            if (watch.error) throw Error(watch.error);
            if (typeof body.text !== 'string' || body.text.length > 20000) throw Error('消息文字最多 20,000 字符');
            const images = promptImages(body.images);
            if (!body.text.trim() && !images.length) throw Error('请填写消息或添加图片');
            if (typeof body.requestId !== 'string' || !/^[\w-]{1,100}$/.test(body.requestId)) throw Error('请求 ID 无效');
            return ctx.sessionController.prompt({ sessionId: id, requestId: body.requestId, mode: 'queue', content: [...(body.text.trim() ? [{ type: 'text', text: body.text }] : []), ...images], clientTimeZone: 'Asia/Singapore' }, signal());
        }
        if (action === 'stop') return ctx.sessionController.cancel({ sessionId: id });
        throw Error('不支持的操作');
    }
    const secret = Buffer.from(token);
    const server = createServer(async (request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        const provided = Buffer.from(request.headers.authorization || '');
        if (request.headers.origin || provided.length !== secret.length || !timingSafeEqual(provided, secret)) {
            response.writeHead(403); response.end(JSON.stringify({ error: '拒绝访问' })); return;
        }
        if (request.method !== 'POST' || request.url !== '/rpc') { response.writeHead(404); response.end('{}'); return; }
        try {
            const chunks = []; let length = 0;
            for await (const chunk of request) { length += chunk.length; if (length > LIMIT) throw Error('请求内容过大'); chunks.push(chunk); }
            const result = await dispatch(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            response.end(JSON.stringify({ result }));
        } catch (error) { response.writeHead(400); response.end(JSON.stringify({ error: String(error.message).slice(0,1000) })); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
    await writeFile(filename + '.tmp', JSON.stringify({ version: 1, port: PORT, token, pid: process.pid }), { mode: 0o600 });
    await rename(filename + '.tmp', filename);
    const cleanup = setInterval(() => {
        for (const [id, watch] of watches) if (Date.now() - watch.lastRead > 90000) { watch.abort.abort(); watches.delete(id); }
    }, 30000);
    cleanup.unref();
    ctx.effect(() => () => { clearInterval(cleanup); for (const watch of watches.values()) watch.abort.abort(); server.closeAllConnections(); server.close(); });
}
