"""Bundle the native knowledge workspace into Trilium's single JSX render note."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
FRONT = ROOT / 'customizations/frontend'
shared = (ROOT / 'customizations/shared/nowcoder-package.js').read_text(encoding='utf-8').split("if(typeof module!=='undefined')")[0]
service_path = ROOT / 'customizations/backend/hardware-quiz-service.js'
service = service_path.read_text(encoding='utf-8')
start, end = '/* NOWCODER_FORMAT_START */', '/* NOWCODER_FORMAT_END */'
before, rest = service.split(start, 1)
_, after = rest.split(end, 1)
service_path.write_text(before + start + '\n' + shared + '\n    ' + end + after, encoding='utf-8')
(ROOT / 'browser-helpers/nowcoder-visible/format.js').write_text(shared, encoding='utf-8')
app = (FRONT / 'quiz-learning-app.js').read_text(encoding='utf-8')
html = (FRONT / 'quiz-learning.html').read_text(encoding='utf-8')
shell = '''import {useEffect,useRef,useState} from 'trilium:preact';
export default function(){ /* reload-safe anonymous default export */
    const root=useRef(null),[error,setError]=useState(''),[ready,setReady]=useState(false);
    useEffect(()=>{
        let alive=true,cleanup,service,revision,queue=Promise.resolve(),blocked=false,pending=0;
        async function call(action,payload={}){
            if(!service){const n=await api.getNote('HwQuizSvc01');service=await n.getContent();}
            return api.runOnBackend(service,[action,payload]);
        }
        (async()=>{
            try{
                const data=await call('studyLoad');revision=data.revision;if(!alive)return;
                root.current.innerHTML=QUIZ_HTML;
                const bridge={
                    save(snapshot){
                        if(blocked)return Promise.reject(Error('保存已暂停，请导出未保存内容并重新打开插件'));
                        pending++;
                        const job=queue.then(async()=>{
                            if(blocked)throw Error('保存已暂停');
                            const result=await call('studySave',{revision,study:snapshot});revision=result.revision;return result;
                        });
                        const tracked=job.finally(()=>pending--);
                        queue=tracked.catch(e=>{blocked=true;if(alive)setError(e.message || String(e));});
                        return tracked;
                    },
                    async action(action,payload={}){
                        await queue;if(blocked)throw Error('保存失败，请先导出未保存内容');
                        const result=await call(action,{revision,...payload});revision=result.state.revision;
                        return {...await call('studyLoad'),importReport:result.importReport};
                    },
                    async previewWeb(packageData){await queue;if(blocked)throw Error('保存失败，请先导出未保存内容');return call('previewWebQuestions',{revision,package:packageData});},
                    export:()=>call('export'),
                    pending:()=>pending>0
                };
                cleanup=quizLearningApp({...data,sources:data.index.banks,topics:[]},root.current,bridge);
                setReady(true);
            }catch(e){if(alive)setError(e.message || String(e));}
        })();
        return()=>{alive=false;cleanup?.();};
    },[]);
    return <main className="hw-quiz-root">{error&&<div key="quiz-error" role="alert" className="hw-quiz-error">{error} · 可在「导入与管理」导出未保存内容，然后重新打开插件。</div>}{!ready&&!error&&<p key="quiz-loading">正在加载题目…</p>}<div key="quiz-host" className="hw-quiz" ref={root}/></main>;
}
'''
(FRONT / 'hardware-quiz.jsx').write_text('const QUIZ_HTML='+json.dumps(html,ensure_ascii=False)+';\n'+shared+'\n'+app+'\n'+shell,encoding='utf-8')
print('Built native knowledge quiz render note')
