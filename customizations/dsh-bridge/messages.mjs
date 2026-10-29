// DSH 0.2.1-rc.2's public Session wire vocabulary. No model/tool execution here.
export function contentText(content) {
    if (!Array.isArray(content)) return '';
    return content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n');
}
export function messageFromEvent(event) {
    if (!event || !['user/message', 'assistant/message', 'assistant/attempt'].includes(event.type)) return null;
    const user = event.type === 'user/message';
    const message = user ? event.data : event.data?.message;
    if (!message && event.type !== 'assistant/attempt') throw Error('DSH 消息结构已变更，请更新聊天桥接。');
    if (message && !Array.isArray(message.content)) throw Error('DSH 消息正文格式已变更，请更新聊天桥接。');
    // DSH also stores runtime/skill/time context as user-role model inputs.
    // They are not human chat messages and must not appear in the chat window.
    if (user && message?.source?.kind !== 'user') return null;
    const text = contentText(message?.content);
    const images = (message?.content || []).filter(block => block.type === 'image' && typeof block.attachment?.attachmentId === 'string').map(block => ({ attachmentId: block.attachment.attachmentId, mediaType: block.attachment.mediaType, name: block.attachment.name || '图片' }));
    if (!text && !images.length) return null;
    return { id: String(message.id || event.seq), seq: event.seq, role: user ? 'user' : 'assistant', text, images, time: event.time };
}
export function streamText(records) {
    if (!Array.isArray(records)) return '';
    return records.map(record => record.type === 'text-chunks' ? (record.texts || []).join('') : record.type === 'chunk' && record.chunk?.type === 'text-delta' ? record.chunk.text : '').join('');
}
