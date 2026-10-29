async function dshChatService(action, payload = {}) {
    if(api.getNote('MyoMarketData')?.getJsonContent()?.plugins.find(p=>p.id==='DsChatRoot1')?.enabled===false)throw Error('该插件已关闭，请在插件管理器中开启。');
    if (!['status', 'list', 'new', 'view', 'older', 'send', 'stop', 'models', 'model', 'attachment'].includes(action)) throw Error('不支持的聊天操作');
    const fs = process.mainModule.require('fs');
    const os = process.mainModule.require('os');
    const path = process.mainModule.require('path');
    let config;
    try { config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.trilium-dsh-bridge', 'connection.json'), 'utf8')); }
    catch { throw Error('尚未连接 DSH，请先启动已安装桥接的 DeepSeek Harness。'); }
    if (config.version !== 1 || config.port !== 37846 || typeof config.token !== 'string' || !/^[a-f0-9]{64}$/.test(config.token)) throw Error('DSH 桥接版本或配置不兼容，请更新桥接并重启 DeepSeek Harness。');
    let response;
    try {
        response = await fetch('http://127.0.0.1:37846/rpc', {
            method: 'POST', headers: { Authorization: config.token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, action }), signal: AbortSignal.timeout(20000)
        });
    } catch { throw Error('无法连接 DSH，请确认 DeepSeek Harness 已启动，然后点击重新连接。'); }
    const value = await response.json();
    if (!response.ok || value.error) throw Error(value.error || 'DSH 请求失败');
    return value.result;
}
