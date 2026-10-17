const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const root=require('node:path').join(__dirname,'..');
function load(file,globals={},imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'/src/'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,{exports,require:n=>imports[n]||{},...globals});return exports;}
const definitions=load('_provider/definitions.ts');
const {status}=definitions;
function harness({type='anime',current=status.PlanToWatch,total=1,episode=0,accept=true,score='0'}={}){
 const prompts=[];const answers=[];
 const {SingleAbstract}=load('_provider/singleAbstract.ts',{api:{settings:{get:()=>true}}},{'./definitions':definitions,'../utils/emitter':{emitter:{}},'../utils/general':{returnYYYYMMDD:()=> '2026-10-17'},'../utils/trackingNotice':{confirmTrackingNotice:async (n,label)=>{prompts.push({n,label});if(n.rating)n.rating.onChange(score);return answers.length?answers.shift():accept;}}});
 const obj=Object.create(SingleAbstract.prototype);let date=null;let finish=null;let rating=null;let rewatch=0;
 Object.assign(obj,{getType:()=>type,getTitle:()=> 'One Piece Movie',getStatus:()=>current,setStatus:v=>current=v,getEpisode:()=>episode,getVolume:()=>0,getTotalEpisodes:()=>total,finishedAiring:()=>true,getStartDate:()=>date,setStartDate:v=>date=v,setFinishDate:v=>finish=v,getScoreCheckboxValue:()=> '0',getScoreCheckbox:()=>[{value:'0',label:'Not rated'},{value:'8',label:'8'}],handleScoreCheckbox:v=>rating=v,increaseRewatchCount:()=>rewatch++});
 return {obj,prompts,answers,state:()=>({current,date,finish,rating,rewatch})};
}
test('opening a movie never asks to start and complete together, even with askBefore enabled',async()=>{const h=harness();assert.equal(await h.obj.checkSync(1),true);assert.equal(h.prompts.length,0);await h.obj.lifeCycleHook('afterCheckSync');assert.equal(h.prompts.length,0);assert.equal(h.state().current,status.PlanToWatch);await h.obj.lifeCycleHook('beforeSync');assert.equal(h.prompts.length,1);assert.equal(h.prompts[0].label,'Complete & sync');assert.equal(h.state().current,status.Completed);await h.obj.lifeCycleHook('beforeSync');assert.equal(h.prompts.length,1);});
test('completion captures optional rating and completion/start dates',async()=>{const h=harness({score:'8'});await h.obj.finishWatchingMessage();assert.deepEqual(h.state(),{current:status.Completed,date:'2026-10-17',finish:'2026-10-17',rating:'8',rewatch:0});});
test('Not now keeps an unfinished movie in Watching and never completes or rates it',async()=>{const h=harness({accept:false});assert.equal(await h.obj.finishWatchingMessage(),false);assert.equal(h.state().current,status.Watching);assert.equal(h.state().finish,null);assert.equal(h.state().rating,null);});
test('starting an episodic show requires acceptance',async()=>{for(const accept of [true,false]){const h=harness({total:12,accept});assert.equal(await h.obj.checkSync(1),accept);assert.equal(h.prompts.length,1);assert.equal(h.prompts[0].label,'Start tracking');assert.equal(h.state().current,accept?status.Watching:status.PlanToWatch);}});
test('rewatch confirmations only change rewatch status/count after acceptance',async()=>{for(const accept of [true,false]){const h=harness({current:status.Completed,accept});await h.obj.startRewatchingMessage();assert.equal(h.state().current,accept?status.Rewatching:status.Completed);await h.obj.finishRewatchingMessage();assert.equal(h.state().rewatch,accept?1:0);}});
