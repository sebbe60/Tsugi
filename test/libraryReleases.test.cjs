const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,imports={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,{exports,require:n=>imports[n]||{}});return exports;}
const history=load('src/utils/watchHistory.ts');
const lib=load('src/utils/libraryHistory.ts',{'./watchHistory':history});
const row=(uid,date,extra={})=>({uid,cacheKey:uid,type:'anime',status:2,title:`Series ${uid}`,url:`https://anilist.co/anime/${uid}`,image:'',finishDate:date,rewatchCount:0,...extra});
const now=new Date('2026-10-16T12:00:00+02:00').getTime();
const item=(extra={})=>({airingState:'RELEASING',fn:{progress:null},...extra});
test('completion dates validate calendar precision and preserve the local day',()=>{
 for(const date of ['2026','2026-10','2026-00-00','2026-02-29','2026-04-31','2026-13-01','garbage',null]) assert.equal(lib.completionTimestamp(date),0);
 const date=new Date(lib.completionTimestamp('2024-02-29'));
 assert.equal(date.getFullYear(),2024);assert.equal(date.getMonth(),1);assert.equal(date.getDate(),29);
});
test('raw partial MAL dates never inherit the rounded January 1 date',()=>{
 const rows=lib.completedEntries([row(1,'2026-01-01',{completionDate:'2026-00-00'}),row(2,'2026-10-15'),row(3,null),row(4,'2026-10-15',{status:1}),row(5,'2026-10-15',{type:'manga'})]);
 assert.equal(rows.length,3);assert.equal(rows[0].id,'completed/2');assert.equal(rows[1].watchedAt,0);
 const groups=lib.groupCompletedEntries(rows,'days');assert.equal(groups.length,2);assert.equal(groups[0].events.length,1);assert.equal(groups[1].key,'undated');assert.equal(groups[1].events.length,2);
});
test('completed galleries regroup dates and retain every series including undated ones',()=>{
 const rows=lib.completedEntries([row(1,'2026-10-15'),row(2,'2026-10-14'),row(3,'2025-10-14'),row(4,null)]);
 const months=lib.groupCompletedEntries(rows,'months');const years=lib.groupCompletedEntries(rows,'years');
 assert.equal(months.length,3);assert.equal(months[0].events.length,2);assert.equal(years[0].title,'2026');
 assert.equal(years.reduce((n,g)=>n+g.events.length,0),4);
});
test('scheduled next episode takes priority over an estimated release',()=>{
 const r=lib.nextRelease(item({nextAiring:{episode:4,timestamp:now+2*86400000+3*3600000},fn:{progress:{isFinished:()=>false,progress:()=>({getPredictionTimestamp:()=>now+100000,getCurrentEpisode:()=>2})}}}),now);
 assert.equal(r.label,'In 2d 3h');assert.equal(r.episode,4);assert.equal(r.estimated,false);assert.match(r.detail,/AniList/);
});
test('predictions are explicitly estimates and respect the prediction setting',()=>{
 const i=item({fn:{progress:{isFinished:()=>false,progress:()=>({getPredictionTimestamp:()=>now+40*60000,getCurrentEpisode:()=>12})}}});
 const r=lib.nextRelease(i,now);assert.equal(r.estimated,true);assert.equal(r.episode,13);assert.equal(r.label,'In 40m');
 assert.equal(lib.nextRelease(i,now,false).timestamp,0);
});
test('finished, unknown, invalid and expired schedules do not invent a future release',()=>{
 assert.equal(lib.nextRelease(item({airingState:'FINISHED'}),now).label,'All episodes released');
 assert.equal(lib.nextRelease(item(),now).label,'Date not announced');
 for(const timestamp of [NaN,now-1000,Infinity])assert.equal(lib.nextRelease(item({nextAiring:{episode:3,timestamp}}),now).timestamp,0);
 assert.equal(lib.nextRelease(item({nextAiring:{episode:-1,timestamp:now+10000}}),now).timestamp,0);
 assert.equal(lib.releaseCountdown(now,now),'Schedule updating');assert.equal(lib.releaseCountdown(now+1,now),'In 1m');
});
