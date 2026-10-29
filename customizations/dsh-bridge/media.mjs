export const IMAGE_LIMITS = { count: 4, perImage: 4 * 1024 * 1024, total: 8 * 1024 * 1024 };
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export function promptImages(images = []) {
    if (!Array.isArray(images) || images.length > IMAGE_LIMITS.count) throw Error('每次最多发送 4 张图片');
    let total = 0;
    return images.map(image => {
        if (!image || !IMAGE_TYPES.includes(image.mediaType) || typeof image.data !== 'string') throw Error('只支持 PNG、JPEG、WebP 和 GIF 图片');
        if (image.data.length > Math.ceil(IMAGE_LIMITS.perImage / 3) * 4) throw Error('单张图片不能超过 4 MB');
        const bytes = Buffer.from(image.data, 'base64');
        if (!bytes.length || bytes.toString('base64') !== image.data) throw Error('图片编码无效');
        total += bytes.length;
        if (bytes.length > IMAGE_LIMITS.perImage || total > IMAGE_LIMITS.total) throw Error('单张图片最多 4 MB，每次图片合计最多 8 MB');
        const valid = image.mediaType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
            : image.mediaType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : image.mediaType === 'image/gif' ? ['GIF87a','GIF89a'].includes(bytes.subarray(0, 6).toString())
            : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
        if (!valid) throw Error('图片内容与文件格式不一致');
        return { type: 'image', mediaType: image.mediaType, data: image.data, name: String(image.name || '图片').split(/[\\/]/).at(-1).slice(0, 120) };
    });
}
export function tokenUsageView(usage) {
    if (!usage || !['uncachedInputTokens','cacheReadTokens','cacheWriteTokens'].every(key => Number.isFinite(usage[key]) && usage[key] >= 0)) return null;
    const inputTokens = usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
    return { inputTokens, cacheReadTokens: usage.cacheReadTokens, cacheWriteTokens: usage.cacheWriteTokens, uncachedInputTokens: usage.uncachedInputTokens, outputTokens: usage.outputTokens, cacheHitRate: inputTokens > 0 ? usage.cacheReadTokens / inputTokens : null };
}
