const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const runtime=fs.readFileSync('customizations/frontend/pomodoro-runtime.js','utf8');
const source=fs.readFileSync('customizations/backend/commission-service.js','utf8');
let now=1000000,stored=null,ledger=JSON.stringify({version:1,revision:0,tasks:[],events:[]}),sequence=0,offline=false,loseResponse=false;
const service=new Function('api',`return (${source});`)({getNote:()=>({hasLabel:()=>true,getContent:()=>ledger,setContent:value=>{ledger=value;}}),randomString:()=>`linkedTest${++sequence}`});
service('create',{revision:0,title:'学习模电一个番茄钟（25分钟）',recurrence:'repeat',coins:30,xp:40,itemName:'',itemQuantity:1});
const task=JSON.parse(ledger).tasks[0];
const api={getNote:async()=>({getContent:async()=>source}),runOnBackend:async(code,args)=>{if(offline)throw new Error('Network offline');const result=service(...args);if(args[0]==='complete' && loseResponse){loseResponse=false;throw new Error('Response lost');}return JSON.parse(JSON.stringify(result));}};
function load(){const window={addEventListener(){},dispatchEvent(){},setInterval(){},setTimeout(){}};vm.runInNewContext(runtime,{window,api,Event:class{},document:{addEventListener(){},getElementById(){return null;},createElement(){return {remove(){}};},body:{appendChild(){}}},Date:{now:()=>now},localStorage:{getItem:()=>stored,setItem:(key,value)=>{stored=value;}},console});return window.MyoPomodoro;}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 let clock=load();clock.linkCommission(task);assert.equal(clock.snapshot().settings.focus,25);
 assert.throws(()=>clock.settings({...clock.snapshot().settings,focus:1}));
 clock.start();now+=60000;clock.reset();await settle();assert.equal(JSON.parse(ledger).events.length,0);
 clock.start();now+=60000;clock.pause();now+=3600000;await settle();assert.equal(JSON.parse(ledger).events.length,0);clock.start();
 loseResponse=true;now+=24*60000;clock.tick();await settle();assert.equal(JSON.parse(ledger).events.length,0);assert.equal(clock.snapshot().history.at(-1).commission.status,'confirm');clock.confirmCommission(clock.snapshot().history.at(-1).commission.requestId);await settle();assert.equal(JSON.parse(ledger).events.length,1);assert.equal(clock.snapshot().history.at(-1).commission.status,'done');
 clock.confirmCommission(clock.snapshot().history.at(-1).commission.requestId);clock.tick();await clock.retryCommissions();assert.equal(JSON.parse(ledger).events.length,1);assert.equal(JSON.parse(ledger).events[0].coins,30);assert.equal(JSON.parse(ledger).events[0].xp,40);
 clock.next('focus');clock.start();offline=true;now+=25*60000;clock.tick();await settle();assert.equal(clock.snapshot().history.at(-1).commission.status,'confirm');clock.confirmCommission(clock.snapshot().history.at(-1).commission.requestId);await settle();assert.equal(clock.snapshot().history.at(-1).commission.status,'pending');assert.equal(JSON.parse(ledger).events.length,1);
 offline=false;clock=load();await settle();assert.equal(JSON.parse(ledger).events.length,2);assert.equal(clock.snapshot().history.at(-1).commission.status,'done');
 service('archive',{id:task.id,revision:JSON.parse(ledger).revision});clock.next('focus');clock.start();now+=25*60000;clock.tick();await settle();clock.confirmCommission(clock.snapshot().history.at(-1).commission.requestId);await settle();assert.equal(JSON.parse(ledger).events.length,2);assert.equal(clock.snapshot().history.at(-1).commission.status,'skipped');
 const before=ledger;assert.throws(()=>service('complete',{id:task.id,revision:JSON.parse(ledger).revision,requestId:'too_short',source:'pomodoro',focusedMinutes:1}),/25/);assert.equal(ledger,before);
 console.log('PASS: manual confirmation before linked 25-minute rewards, pause/reset exclusions, lost response idempotency, offline recovery, archived-task skip and minimum duration');
})().catch(error=>{console.error(error);process.exitCode=1;});
