"""Assemble a Windows release from explicit source/runtime allowlists.

Never recurse over the workspace, application backups, writable profiles, or
imported question/media directories. The supplied seed must already be sanitized.
"""
import argparse,hashlib,json,shutil,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE_DIRS=['tools','customizations/backend','customizations/frontend','customizations/assets','customizations/dsh-bridge','customizations/github-sync','customizations/licenses','customizations/shared','customizations/svg-icons','customizations/themes','customizations/vendor','electronic-symbols-font-20260918','vendor-electronic-symbols-20260918','tabler-circuit-svg']
RUNTIME_FILES=['trilium.exe','chrome_100_percent.pak','chrome_200_percent.pak','d3dcompiler_47.dll','dxcompiler.dll','dxil.dll','ffmpeg.dll','icudtl.dat','libEGL.dll','libGLESv2.dll','LICENSE','LICENSES.chromium.html','resources.pak','snapshot_blob.bin','v8_context_snapshot.bin','version','vk_swiftshader_icd.json','vk_swiftshader.dll','vulkan-1.dll','trilium-portable.bat','trilium-safe-mode.bat']

def copy(source,target):
 target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
def assemble(runtime,seed,target):
 target.mkdir(parents=True,exist_ok=True)
 for f in ROOT.iterdir():
  if f.is_file() and (f.suffix=='.md' or f.name in ['LICENSE','.gitignore','.gitattributes','customizations-manifest.json','package.json','run-myosotis-trilium.bat','login-github.bat','setup-deepseek.bat'] or f.name.startswith('trilium-') and f.suffix in ['.js','.css'] or f.name.startswith(('build_electronic_','install_electronic_')) and f.suffix in ['.py','.js']):copy(f,target/f.name)
 for name in SOURCE_DIRS:
  folder=ROOT/name
  if not folder.exists():continue
  for f in folder.rglob('*'):
   if not f.is_file() or any(p in {'__pycache__','node_modules','.git','_agent_scratch'} for p in f.relative_to(folder).parts):continue
   if name=='tools' and f.suffix not in {'.py','.cjs','.js','.jsx','.html'}:continue
   copy(f,target/f.relative_to(ROOT))
 for name in ['home-pages.json','commissions-empty.json']:copy(ROOT/'customizations/data'/name,target/'customizations/data'/name)
 for name in RUNTIME_FILES:copy(runtime/name,target/'trilium-portable'/name)
 copy(runtime/'resources/app.asar',target/'trilium-portable/resources/app.asar')
 for name in ['locales','resources/app.asar.unpacked']:
  for f in (runtime/name).rglob('*'):
   if f.is_file():copy(f,target/'trilium-portable'/f.relative_to(runtime))
 for f in (ROOT/'customizations/runtime-tools').rglob('*'):
  if f.is_file() and '__pycache__' not in f.parts:copy(f,target/'trilium-portable/myosotis-tools'/f.relative_to(ROOT/'customizations/runtime-tools'))
 copy(seed,target/'trilium-seed-data/document.db')
 # No writable runtime profile is part of a release.
 assert not (target/'trilium-portable/trilium-data').exists()
 assert not (target/'trilium-portable/trilium-electron-data').exists()
 forbidden=[f for f in target.rglob('*') if f.is_file() and ('.before-' in f.name or '.svg-pending' in f.name or f.suffix in {'.log','.token','.key','.pem'} or f.name.startswith('document.db-'))]
 if forbidden:raise ValueError('Unexpected runtime state: '+str(forbidden[0]))
 files=[f for f in target.rglob('*') if f.is_file() and '.git' not in f.relative_to(target).parts and f.name!='PACKAGE-MANIFEST.json']
 manifest={f.relative_to(target).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
 (target/'PACKAGE-MANIFEST.json').write_text(json.dumps({'version':'0.105.0-myosotis.20261030.2','files':manifest},indent=2),encoding='utf8')
 return len(files)

def archive(target,output):
 with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
  for f in sorted(target.rglob('*')):
   if f.is_file() and '.git' not in f.relative_to(target).parts:z.write(f,target.name+'/'+f.relative_to(target).as_posix())
 return hashlib.sha256(output.read_bytes()).hexdigest()

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--runtime',type=Path,required=True);p.add_argument('--seed',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--zip',type=Path);a=p.parse_args();print('Assembled',assemble(a.runtime,a.seed,a.output),'files',flush=True)
 if a.zip:print('ZIP SHA256',archive(a.output,a.zip),flush=True)
