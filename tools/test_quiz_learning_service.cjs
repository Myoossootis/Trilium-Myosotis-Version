const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createHarness}=require('./test_hardware_quiz.cjs');
const {run,notes}=createHarness();
let load=run('studyLoad'),study=load.study,revision=load.revision;
assert.equal(load.questions.length,1403);assert.equal(study.topics.length,0);
assert.equal(JSON.parse(notes.get('HwQuizState01')).revision,0,'opening must not write records');
function save(){const result=run('studySave',{revision,study});revision=result.revision;study=JSON.parse(JSON.stringify(result.study));return result;}
study.topics=[{id:'topic_parent',name:'电路',parent:null},{id:'topic_child',name:'二极管',parent:'topic_parent'},{id:'topic_other',name:'数字',parent:null}];
study.tags={'hw01-001':['topic_parent','topic_child'],'hw02-001':['topic_child','topic_other']};
study.filters=['topic_parent','topic_child'];study.scopeActive=true;save();
study.session={ids:['hw01-001','hw02-001'],position:0,responses:{'hw01-001':{selected:['B'],text:'',submitted:false}},title:'电路',tab:'all',order:'weighted',startedAt:Date.now(),finished:false};save();
assert.equal(run('studyLoad').study.session.responses['hw01-001'].selected[0],'B');
study.session.responses['hw01-001']={selected:['B'],text:'',submitted:true,correct:true,self:false,attemptId:'study_first'};
let result=save();assert.equal(result.study.records['hw01-001'].wrong,true,'server must compute the grade');assert.equal(result.study.session.responses['hw01-001'].correct,false);
assert.equal(result.events.length,1);assert.equal(result.study.schedules['hw01-001'].stage,0);assert.equal(Object.values(result.study.daily.days)[0].length,1);
save();assert.equal(run('studyLoad').events.length,1,'snapshots must be idempotent');
study.records['hw01-001'].favorite=true;study.daily.target=37;save();assert.equal(run('studyLoad').study.records['hw01-001'].favorite,true);
const before=notes.get('HwQuizState01');assert.throws(()=>run('studySave',{revision:0,study}),/另一窗口/);assert.equal(notes.get('HwQuizState01'),before);
study.topics[0].parent='topic_child';assert.throws(save,/循环/);assert.equal(notes.get('HwQuizState01'),before);study.topics[0].parent=null;
study.session.responses['hw01-001']={selected:['A'],text:'',submitted:true,correct:false,self:false,attemptId:'study_retry'};save();
assert.equal(study.records['hw01-001'].wrong,false);assert.equal(study.records['hw01-001'].attempts,2);assert.equal(study.schedules['hw01-001'].stage,1);assert.equal(Object.values(study.daily.days)[0].length,1,'daily count is unique questions');
const self=load.questions.find(q=>q.type==='self');study.session={ids:[self.id],position:0,responses:{[self.id]:{selected:[],text:'我的答案',submitted:true,correct:null,self:false,attemptId:'study_self'}},title:'自评',tab:'all',order:'random',finished:false};save();
assert.equal(study.session.responses[self.id].correct,null);assert.equal(study.schedules[self.id],undefined);
study.session.responses[self.id].correct=true;study.session.responses[self.id].self=true;save();assert.equal(study.schedules[self.id].stage,1);assert.equal(run('load').summary.accuracy,50,'self grades excluded');
// All historical data and embedded custom banks are preserved by the additive workspace.
const original=JSON.parse(notes.get('HwQuizState01'));run('importBank',{revision,bank:{title:'新来源',questions:[{stem:'测试',options:['甲','乙'],answer:'A'}]}});
const imported=run('studyLoad');assert.equal(imported.questions.length,1404);assert.equal(JSON.stringify(imported.events),JSON.stringify(original.events));assert.equal(JSON.stringify(imported.study.records),JSON.stringify(original.records));
// Read-only migration resumes a legacy session without creating a second answer event.
const old=createHarness();let legacy=old.run('start',{bankId:'hw01',mode:'sequential',revision:0});legacy=old.run('answer',{bankId:'hw01',questionId:'hw01-001',mode:'sequential',selected:['A'],requestId:'legacy',revision:legacy.state.revision});
const migrated=old.run('studyLoad');old.run('studySave',{revision:migrated.revision,study:migrated.study});assert.equal(old.run('load').state.events.length,1);
const scope={};vm.runInNewContext(fs.readFileSync('customizations/frontend/quiz-learning-app.js','utf8'),scope);
let sampling={tags:{a:['topic_child'],b:['topic_other']},records:{a:{attempts:10,wrong:true},b:{attempts:10,wrong:false},c:{attempts:0}},schedules:{a:{due:'2020-01-01T00:00:00Z'}},topics:study.topics};
const qs=['a','b','c'].map(id=>({id}));const recent=Array.from({length:10},(_,i)=>({questionId:i<5?'a':'b',correct:i>=5,time:new Date().toISOString()}));
assert.equal(JSON.stringify(scope.quizSample(qs,sampling,recent,'warm').map(q=>q.id)),JSON.stringify(['a']));
for(const mode of ['random','balanced','weighted']){const chosen=scope.quizSample(qs,sampling,recent,mode);assert.equal(new Set(chosen.map(q=>q.id)).size,3);}
let firstA=0,firstB=0;for(let i=0;i<2000;i++){const id=scope.quizSample(qs,sampling,recent,'weighted')[0].id;firstA+=id==='a';firstB+=id==='b';}assert.ok(firstA>firstB*1.4,'weak tags should receive more sampling weight');
console.log('PASS knowledge workspace: read-only migration, drafts, authoritative grading, retry, daily dedup, tags, review intervals, concurrency, custom banks and weighted sampling');
