"""Embed the shared browser in JSX notes, without a runtime dependency loader."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def build_workspace():
    browser=(ROOT/'customizations/frontend/hardware-library.jsx').read_text(encoding='utf-8')
    browser=browser.replace("import {useEffect,useRef,useState} from 'trilium:preact';",'').replace('export default function LibraryBrowser','function LibraryBrowser')
    return (ROOT/'customizations/frontend/knowledge-wiki.jsx').read_text(encoding='utf-8').replace('/*LIBRARY_BROWSER*/',browser)

def build_library_entry():
    browser=(ROOT/'customizations/frontend/hardware-library.jsx').read_text(encoding='utf-8').replace('export default function LibraryBrowser','function LibraryBrowser')
    return browser+'''
// Preserve a standalone browser when the unified knowledge plugin is disabled.
export default function LibraryEntry(){
    useEffect(()=>{window.TriliumKnowledgeWorkspaceRouter?.open(HARDWARE_ROOT);},[]);
    return window.TriliumKnowledgeWorkspaceRouter?null:<LibraryBrowser/>;
}
'''

def component_source(note_id,path):
    if note_id=='KbWikiUI0001':return build_workspace()
    if note_id=='MyoHardwareUI':return build_library_entry()
    return Path(path).read_text(encoding='utf-8')
