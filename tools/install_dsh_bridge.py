"""Add the local bridge through DSH's profile overlay, never its installation files."""
import datetime as dt
from pathlib import Path
import sys
import yaml

ROOT = Path(__file__).resolve().parents[1]
profile = Path.home() / '.dsh/profiles/desktop/cordis.patch.yml'
source = ROOT / 'customizations/dsh-bridge/index.mjs'
if not profile.is_file(): raise SystemExit('Start official DeepSeek Harness once before installing the bridge')
original = profile.read_text(encoding='utf-8')
rows = yaml.safe_load(original)
if not isinstance(rows, list): raise SystemExit('Unknown DSH overlay format; no configuration was changed')
entries = [entry for row in rows if isinstance(row, dict) for entry in row.get('insert', []) if isinstance(entry, dict)]
matches = [entry for entry in entries if entry.get('id') == 'trilium-chat-bridge']
if matches:
    if len(matches) != 1 or Path(matches[0]['name']).resolve() != source.resolve(): raise SystemExit('Bridge ID is occupied by another plugin; no configuration was changed')
    print('DSH bridge overlay already installed')
else:
    backup = ROOT / 'backups' / f'dsh-chat-{dt.datetime.now():%Y%m%d-%H%M%S-%f}'
    backup.mkdir(parents=True)
    (backup / 'cordis.patch.yml').write_bytes(profile.read_bytes())
    patch = f'\n- insert:\n    - id: trilium-chat-bridge\n      name: {source.as_posix()}\n'
    yaml.safe_load(original + patch)
    temporary = profile.with_suffix('.yml.trilium-tmp')
    temporary.write_text(original + patch, encoding='utf-8')
    temporary.replace(profile)
    print(f'DSH bridge installed; profile backup: {backup}')
