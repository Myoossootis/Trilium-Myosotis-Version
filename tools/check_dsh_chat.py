"""Read-only post-update check. Never sends a prompt or changes a conversation."""
import json
from pathlib import Path
import sys
import urllib.request

def main():
    config = json.loads((Path.home() / '.trilium-dsh-bridge/connection.json').read_text(encoding='utf-8'))
    if config.get('version') != 1 or config.get('port') != 37846: raise RuntimeError('Bridge protocol/configuration is incompatible')
    def rpc(body):
        request = urllib.request.Request('http://127.0.0.1:37846/rpc', data=json.dumps(body).encode(), headers={'Authorization': config['token'], 'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=20) as response: result = json.load(response)
        if 'error' in result: raise RuntimeError(result['error'])
        return result['result']
    status = rpc({'action': 'status'})
    if status.get('protocol') != 1 or not status.get('connected'): raise RuntimeError(status.get('error') or 'Bridge protocol is incompatible')
    catalog = rpc({'action': 'models'})
    if not isinstance(catalog.get('groups'), list) or not catalog.get('default', {}).get('model'): raise RuntimeError('Model catalog contract changed')
    items = rpc({'action': 'list'})['items']
    if not isinstance(items, list): raise RuntimeError('Session list contract changed')
    if items:
        view = rpc({'action': 'view', 'sessionId': items[0]['id']})
        if view.get('error') or not isinstance(view.get('messages'), list): raise RuntimeError(view.get('error') or 'History contract changed')
        if any(message.get('role') not in ['user', 'assistant'] or not isinstance(message.get('text'), str) for message in view['messages']): raise RuntimeError('Message contract changed')
        usage = view.get('usage')
        if usage:
            total = usage['inputTokens']
            if total != usage['uncachedInputTokens'] + usage['cacheReadTokens'] + usage['cacheWriteTokens']: raise RuntimeError('Usage accounting is inconsistent')
            if total > 0 and abs(usage['cacheHitRate'] - usage['cacheReadTokens'] / total) > 1e-9: raise RuntimeError('Cache rate is inconsistent')
    print(f'PASS bridge protocol 1, model catalog, {len(items)} sessions, history/usage contracts; no prompts sent')

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(f'FAIL DSH chat health: {type(error).__name__}: {error}')
        sys.exit(1)
