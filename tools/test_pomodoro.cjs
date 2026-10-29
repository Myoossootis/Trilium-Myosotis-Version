const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('customizations/frontend/pomodoro-runtime.js','utf8');
let now=1000000,stored=null;
function load(){
  const window={addEventListener(){},setInterval(){},setTimeout(){}};
  const document={addEventListener(){},getElementById(){return null;},createElement(){return {remove(){}};},body:{appendChild(){}}};
  const context={window,document,Date:{now:()=>now},localStorage:{getItem:()=>stored,setItem:(key,value)=>{stored=value;}},console};
  vm.runInNewContext(source,context);return window.MyoPomodoro;
}
let clock=load();
assert.equal(clock.snapshot().remaining,25*60000);
clock.settings({focus:1,short:1,long:2,sound:false});clock.task('模电');clock.start();
now+=20000;clock.pause();assert.equal(clock.snapshot().remaining,40000);
now+=300000;clock=load();assert.equal(clock.snapshot().status,'paused');assert.equal(clock.snapshot().remaining,40000);
clock.start();now+=40000;clock.tick();clock.tick();assert.equal(clock.snapshot().completed,1);assert.equal(clock.snapshot().history.length,1);assert.equal(clock.snapshot().history[0].task,'模电');
assert.equal(clock.snapshot().unread,true);clock=load();assert.equal(clock.snapshot().unread,true);clock.acknowledge();assert.equal(clock.snapshot().unread,false);
clock.settings({...clock.snapshot().settings,floating:false});clock=load();assert.equal(clock.snapshot().settings.floating,false);
clock=load();assert.equal(clock.snapshot().history.length,1);clock.next();assert.equal(clock.snapshot().mode,'short');assert.equal(clock.snapshot().status,'idle');
clock.start();now+=60000;clock.tick();assert.equal(clock.snapshot().completed,1);clock.next();assert.equal(clock.snapshot().mode,'focus');
for(let i=0;i<3;i++){clock.start();now+=60000;clock.tick();if(i<2){clock.next();clock.select('focus');}}
assert.equal(clock.snapshot().completed,4);clock.next();assert.equal(clock.snapshot().mode,'long');
clock.select('focus');clock.start();now+=10000;clock.reset();assert.equal(clock.snapshot().history.length,4);assert.equal(clock.snapshot().remaining,60000);
clock.start();assert.throws(()=>clock.settings({focus:2,short:1,long:2,sound:false}));clock.pause();clock.reset();assert.throws(()=>clock.settings({focus:0,short:1,long:2,sound:false}));
clock.start();now+=120000;clock=load();assert.equal(clock.snapshot().status,'done');assert.equal(clock.snapshot().completed,5);
stored='broken';assert.equal(load().snapshot().status,'idle');
console.log('PASS: pause/resume, reload, offline completion, no duplicate settlement, reset, four-round break, settings validation and corrupt storage');
