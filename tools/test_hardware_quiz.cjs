const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'customizations/data/hardware-quiz');
function createHarness(){
 const notes=new Map(),index=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
 notes.set('HwQuizIndex01',JSON.stringify(index));
 for(const b of index.banks)notes.set('HwQuizBank'+b.id.slice(2),fs.readFileSync(path.join(dir,b.id+'.json'),'utf8'));
 notes.set('HwQuizState01',JSON.stringify({version:1,revision:0,records:{},sessions:{},events:[],overrides:{}}));
 const api={getNote:id=>notes.has(id)?{getContent:()=>notes.get(id),setContent:c=>notes.set(id,c)}:null,randomString:()=>Math.random().toString(36).slice(2)};
 const run=vm.runInNewContext('('+fs.readFileSync(path.join(root,'customizations/backend/hardware-quiz-service.js'),'utf8')+')',{api});
 return {notes,run};
}
function test(){
 const {run,notes}=createHarness();let state=run('load');
 assert.equal(state.index.banks.length,28);
 state=run('start',{bankId:'hw01',mode:'sequential',revision:state.state.revision});
 const first=state.bank.questions[0];assert.equal(first.answer.join(''),'A');assert.ok(!first.stem.includes('（A）'));
 const request={bankId:'hw01',mode:'sequential',questionId:first.id,selected:['B'],requestId:'test-1',revision:state.state.revision};
 state=run('answer',request);assert.equal(state.result.correct,false);assert.equal(state.summary.wrong,1);
 assert.equal(run('answer',request).state.events.length,1,'network retry must not record twice');
 assert.throws(()=>run('favorite',{bankId:'hw01',questionId:first.id,revision:0}),/另一窗口/);
 state=run('favorite',{bankId:'hw01',questionId:first.id,revision:state.state.revision});assert.equal(state.summary.favorites,1);
 state=run('start',{bankId:'hw01',mode:'wrong',revision:state.state.revision});assert.equal(state.state.sessions['hw01:wrong'].ids.length,1);
 state=run('answer',{bankId:'hw01',mode:'wrong',questionId:first.id,selected:['A'],requestId:'test-2',revision:state.state.revision});assert.equal(state.summary.wrong,0);
 const resumed=run('bank',{bankId:'hw01'});assert.equal(resumed.state.sessions['hw01:wrong'].last.correct,true);
 state=run('start',{bankId:'hw18',mode:'sequential',revision:state.state.revision});
 const unknown=state.bank.questions[0];assert.equal(unknown.answer.length,0);
 state=run('answer',{bankId:'hw18',mode:'sequential',questionId:unknown.id,selected:['A'],requestId:'test-3',revision:state.state.revision});assert.equal(state.result.correct,null);
 state=run('selfGrade',{bankId:'hw18',mode:'sequential',questionId:unknown.id,correct:false,revision:state.state.revision});assert.equal(state.summary.wrong,1);assert.equal(state.summary.accuracy,50,'self grades must not affect objective accuracy');
 state=run('edit',{bankId:'hw18',questionId:unknown.id,answer:'AB',revision:state.state.revision});assert.equal(state.bank.questions[0].type,'multi');assert.equal(state.summary.wrong,0);
 state=run('answer',{bankId:'hw18',mode:'sequential',questionId:unknown.id,selected:['B','A'],requestId:'test-4',revision:state.state.revision});assert.equal(state.result.correct,true);
 const snapshot=notes.get('HwQuizState01');assert.throws(()=>run('edit',{bankId:'hw18',questionId:unknown.id,answer:'Z',revision:state.state.revision}),/答案/);assert.equal(notes.get('HwQuizState01'),snapshot);
 for(const item of state.index.banks){const b=JSON.parse(notes.get('HwQuizBank'+item.id.slice(2)));assert.ok(b.questions.length>0,item.id);assert.equal(b.questions.length,item.count);assert.equal(new Set(b.questions.map(q=>q.id)).size,b.questions.length);for(const q of b.questions){assert.ok(q.pages.length);assert.ok(q.answer.every(a=>q.options.some(o=>o.key===a)));assert.ok(q.stem.trim());}}
 const before=notes.get('HwQuizState01');
 assert.throws(()=>run('importBank',{revision:state.state.revision,bank:{title:'格式错误',questions:[{stem:'合法题',options:['甲','乙'],answer:'A'},{stem:'非法题',options:['甲','乙'],answer:'C'}]}}),/第 2 题/);
 assert.equal(notes.get('HwQuizState01'),before,'invalid batch must not import any questions');
 const originalRecords=JSON.stringify(state.state.records),originalEvents=JSON.stringify(state.state.events);
 state=run('importBank',{revision:state.state.revision,bank:{title:'英语与常识',questions:[{stem:'Choose cat',options:['cat','dog'],answer:'A'},{stem:'Even numbers',type:'multi',options:['2','3','4'],answer:['A','C']},{stem:'Earth is round',type:'boolean',answer:true},{stem:'Explain gravity',type:'self',explanation:'Reference notes'}]}});
 assert.equal(state.index.banks.length,29);assert.equal(JSON.stringify(state.state.records),originalRecords);assert.equal(JSON.stringify(state.state.events),originalEvents);
 const customId=state.bank.id;
 assert.equal(run('load').index.banks.length,29,'import survives reload');
 assert.equal(run('bank',{bankId:customId}).bank.title,'英语与常识');
 const exported=run('exportBank',{bankId:customId});assert.equal(exported.questions.length,4);assert.ok(!Object.hasOwn(exported.questions[0],'record'));
 state=run('answer',{bankId:customId,mode:'sequential',questionId:state.bank.questions[0].id,selected:['A'],revision:state.state.revision});assert.equal(state.result.correct,true);
 state=run('move',{bankId:customId,mode:'sequential',position:2,revision:state.state.revision});
 state=run('answer',{bankId:customId,mode:'sequential',questionId:state.bank.questions[2].id,selected:['A'],revision:state.state.revision});assert.equal(state.result.correct,true);
 state=run('move',{bankId:customId,mode:'sequential',position:3,revision:state.state.revision});
 state=run('answer',{bankId:customId,mode:'sequential',questionId:state.bank.questions[3].id,selected:[],answerText:'My response',revision:state.state.revision});assert.equal(state.result.correct,null);
 state=run('selfGrade',{bankId:customId,mode:'sequential',questionId:state.bank.questions[3].id,correct:true,revision:state.state.revision});assert.equal(state.result.self,true);
 state=run('importBank',{revision:state.state.revision,bank:exported});assert.notEqual(state.bank.id,customId,'reimports create independent question IDs');
 console.log('PASS 28 banks, grading, multi-select, retry, persistence, wrong-book, favorites, corrections and concurrency');
 console.log('PASS generic banks: atomic validation, single/multi/boolean/self grading, persistent import, export, independent IDs and original records preserved');
}
if(require.main===module)test();module.exports={createHarness};
