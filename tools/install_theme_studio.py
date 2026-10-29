"""Install paired native Trilium themes and plugin color mappings via ETAPI."""
from __future__ import annotations
import argparse,datetime as dt,json,sqlite3,sys
from contextlib import closing
from pathlib import Path
from apply_customizations import Etapi,EtapiError
ROOT=Path(__file__).resolve().parents[1]
GROUP='ThmStudioRoot'
PALETTES=json.loads((ROOT/'customizations/themes/palettes.json').read_text(encoding='utf-8'))
SETTINGS=[('ThmStudioUI01','主题预览卡片','application/javascript;env=frontend','customizations/frontend/theme-studio-settings.js','widget'),('ThmStudioCSS1','主题预览卡片样式','text/css','customizations/frontend/theme-studio-settings.css','appCss')]
UPDATED=[('MyoCodexFlip','customizations/frontend/codex-theme-toggle.js')]

def build(palette):
    mode=palette['mode'];colors=palette['colors']
    # Keep the established Trilium shell layout; only recolor it.
    shell=(ROOT/('trilium-codex-ui.css' if mode=='light' else 'trilium-codex-dark.css')).read_text(encoding='utf-8')
    tokens='\n'.join('    --ts-'+key+':'+value+';' for key,value in colors.items())
    tokens+='\n    --ts-mode:'+mode+';\n    --ts-selected:color-mix(in srgb,var(--ts-accent) 12%,var(--ts-surface));'
    return ('/* Theme Studio · '+palette['name']+' · native Trilium theme. Independent implementation. */\n'+shell+
            '\n:root{--theme-style:'+mode+';color-scheme:'+mode+';--native-titlebar-background:'+colors['sidebar']+'}\n'+
            'body[data-theme-id="'+palette['id']+'"]{\n'+tokens+'\n}\n'+(ROOT/'customizations/themes/integrations.css').read_text(encoding='utf-8'))

def install(api,data_dir,backup=True):
    def maybe(id):
        try:return api.get_note(id)
        except EtapiError as e:
            if 'HTTP 404' not in str(e):raise
    api.get_note('0e50f559e1a3')
    group=maybe(GROUP)
    if group and (group['title']!='全局配色主题' or group['type']!='text' or group['isProtected']):raise RuntimeError('Theme group ID is occupied')
    definitions=[(p['noteId'],p['name'],build(p),p) for p in PALETTES]
    originals={}
    for id,title,content,palette in definitions:
        note=maybe(id)
        if note and (note['title']!=title or note['type']!='code' or note['mime']!='text/css' or note['isProtected']):raise RuntimeError('Theme ID is occupied: '+id)
        if note:originals[id]={'note':note,'content':api.request('GET','/notes/'+id+'/content',accept='text/plain')}
        found=api.search_notes(title)
        if any(n['noteId']!=id for n in found):raise RuntimeError('Another theme already uses this title: '+title)
    for id,path in UPDATED:
        note=api.get_note(id)
        if note['type']!='code' or note['isProtected']:raise RuntimeError('Expected accessible program note: '+id)
        originals[id]={'note':note,'content':api.request('GET','/notes/'+id+'/content',accept='text/plain')}
    for id,title,mime,path,label in SETTINGS:
        note=maybe(id)
        if note and (note['title']!=title or note['type']!='code' or note['mime']!=mime or note['isProtected']):raise RuntimeError('Settings component ID is occupied: '+id)
        if note:originals[id]={'note':note,'content':api.request('GET','/notes/'+id+'/content',accept='text/plain')}
    backup_dir=None
    if backup:
        backup_dir=ROOT/'backups'/('theme-studio-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f'));backup_dir.mkdir(parents=True)
        with closing(sqlite3.connect((Path(data_dir)/'document.db').resolve().as_uri()+'?mode=ro',uri=True)) as source,closing(sqlite3.connect(backup_dir/'document.db')) as target:source.backup(target)
        (backup_dir/'before.json').write_text(json.dumps(originals,ensure_ascii=False,indent=2),encoding='utf-8')
    if not group:api.create_note({'noteId':GROUP,'parentNoteId':'0e50f559e1a3','title':'全局配色主题','type':'text','content':'<p>设置 → 外观 → 应用主题，选择极简灰、森林绿、纸墨暖色、深海蓝或柔雾紫。每套提供浅色和暗色，底部日夜开关保留当前配色。切换即时生效，由 Trilium 保存。</p><p>参考 Minimal、Things 和 Catppuccin 的语义配色分层；针对本机 Trilium 与插件独立实现。选择原来的 Codex 或其他原生主题可退出这套配色。</p>'})
    def attr(id,name,value=''):
        note=api.get_note(id)
        if any(a['noteId']==id and a['type']=='label' and a['name']=='myoDisabled_'+name and a['value']==value for a in note['attributes']):return
        attrs=[a for a in note['attributes'] if a['noteId']==id and a['type']=='label' and a['name']==name]
        if any(a['value']!=value for a in attrs):raise RuntimeError('Unexpected theme binding: '+id+' '+name)
        if not attrs:api.add_attribute(id,{'type':'label','name':name,'value':value,'isInheritable':False})
    attr(GROUP,'homeInternal')
    for id,title,content,p in definitions:
        if not maybe(id):api.create_note({'noteId':id,'parentNoteId':GROUP,'title':title,'type':'code','mime':'text/css','content':content})
        elif api.request('GET','/notes/'+id+'/content',accept='text/plain')!=content:api.put_content(id,content)
        attr(id,'homeInternal');attr(id,'appTheme',p['id']);attr(id,'appThemeBase','next-'+p['mode'])
        assert api.request('GET','/notes/'+id+'/content',accept='text/plain')==content
    for id,title,mime,path,label in SETTINGS:
        content=(ROOT/path).read_text(encoding='utf-8')
        if label=='widget':content=content.replace('/*THEME_PALETTES*/[]',json.dumps(PALETTES,ensure_ascii=False))
        if not maybe(id):api.create_note({'noteId':id,'parentNoteId':GROUP,'title':title,'type':'code','mime':mime,'content':content})
        elif api.request('GET','/notes/'+id+'/content',accept='text/plain')!=content:api.put_content(id,content)
        attr(id,'homeInternal');attr(id,label)
        assert api.request('GET','/notes/'+id+'/content',accept='text/plain')==content
    for id,path in UPDATED:
        content=(ROOT/path).read_text(encoding='utf-8')
        if api.request('GET','/notes/'+id+'/content',accept='text/plain')!=content:api.put_content(id,content)
        assert api.request('GET','/notes/'+id+'/content',accept='text/plain')==content
    from plugin_catalog import refresh_catalog
    refresh_catalog(api)
    return {'installed':'全局配色主题','themes':len(definitions),'backup':str(backup_dir) if backup_dir else None,'settings':'设置 → 外观 → 应用主题'}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:37840/etapi');parser.add_argument('--data-dir',required=True);parser.add_argument('--skip-backup',action='store_true');args=parser.parse_args()
    if args.skip_backup and args.url.rstrip('/')=='http://127.0.0.1:37840/etapi':parser.error('The active instance always requires a backup')
    sys.stdout.reconfigure(encoding='utf-8')
    api=Etapi(args.url,Path('C:/Users/杜锦鸿/Desktop/api.txt').read_text(encoding='utf-8-sig').strip())
    print(json.dumps(install(api,args.data_dir,not args.skip_backup),ensure_ascii=False))
