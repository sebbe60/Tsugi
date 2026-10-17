const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, globals = {}, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => imports[name] || {}, ...globals });
  return exports;
}
const history = load('src/utils/watchHistory.ts');
const library = load('src/_minimal/utils/library.ts');
const progress = { mediaKey:'anime/1',title:'Test series',url:'https://myanimelist.net/anime/1',image:'',fromEpisode:2,toEpisode:3,rewatchCount:0 };
const event = (id,date,extra={})=>({...progress,id,watchedAt:new Date(date).getTime(),...extra});

test('records only valid forward episode progress',()=>{
  assert.equal(history.isWatchProgress(progress),true);
  for(const change of [{toEpisode:2},{toEpisode:1},{fromEpisode:-1},{toEpisode:NaN},{toEpisode:2.5},{url:'javascript:alert(1)'}])
    assert.equal(history.isWatchProgress({...progress,...change}),false);
});
test('labels bulk changes as progress updates rather than independently observed episodes',()=>{
  assert.equal(history.episodeLabel(progress),'Episode 3');
  assert.equal(history.episodeLabel({...progress,toEpisode:5}),'Episodes 3–5 · progress update');
});
test('groups by local calendar day and sorts newest first',()=>{
  const entries=[event('old','2025-12-31T23:00:00+01:00'),event('one','2026-10-15T12:00:00+02:00'),event('two','2026-10-16T12:00:00+02:00')];
  const groups=history.groupWatchEvents(entries,'days','en',new Date('2026-10-16T15:00:00+02:00'));
  assert.equal(groups[0].title,'Today');assert.equal(groups[1].title,'Yesterday');assert.equal(groups[0].events[0].id,'two');
});
test('months and years keep separate years and reconcile episode totals',()=>{
  const entries=[event('one','2026-10-15T12:00:00+02:00'),event('two','2026-10-16T12:00:00+02:00',{toEpisode:5}),event('old','2025-10-15T12:00:00+02:00')];
  const months=history.groupWatchEvents(entries,'months','en');assert.equal(months.length,2);assert.equal(months[0].episodes,4);
  const years=history.groupWatchEvents(entries,'years','en');assert.equal(years[0].title,'2026');assert.equal(years[1].title,'2025');
});
test('release classification includes only confirmed unreleased statuses',()=>{
  for(const airingState of ['NOT_YET_RELEASED','not_yet_aired','tba',3])assert.equal(library.isUnreleased({airingState}),true);
  for(const airingState of [undefined,'RELEASING','FINISHED','currently_airing',1,2])assert.equal(library.isUnreleased({airingState}),false);
});

test('background serializes concurrent writes, deduplicates repeats and keeps independent episodes',async()=>{
  const values={};let id=0;
  const {appendWatchHistory}=load('src/background/watchHistory.ts',{
    api:{storage:{get:async key=>values[key]}},
    chrome:{storage:{local:{set:async value=>Object.assign(values,value)}}},
    crypto:{randomUUID:()=>String(++id)},
  },{'../utils/watchHistory':history});
  await Promise.all([appendWatchHistory(progress),appendWatchHistory(progress),appendWatchHistory({...progress,fromEpisode:3,toEpisode:4})]);
  const events=Object.entries(values).filter(([key])=>key.startsWith(history.HISTORY_PREFIX));
  assert.equal(events.length,2);assert.equal(events[0][1].toEpisode,3);assert.equal(events[1][1].toEpisode,4);
});

function singleHarness({fail=false,syncMethod='normal',before=13,episode=14,previousStatus=1,status=1}={}){
  const messages=[];
  const {SingleAbstract}=load('src/_provider/singleAbstract.ts',{
    api:{type:'webextension'},utils:{setEntrySettings:async()=>''},con:{error:()=>{}},
    chrome:{runtime:{sendMessage:async msg=>{messages.push(msg);return {recorded:true};}}},
  },{'./definitions':{status:{Completed:2,Rewatching:23}},'../utils/emitter':{emitter:{}}});
  const single=Object.create(SingleAbstract.prototype);
  Object.assign(single,{
    type:'anime',syncMethod,historyEpisode:before,persistenceState:{episode:before,status:previousStatus},
    logger:{log:()=>{}},options:null,fixDates:()=>{},_setTags:()=>{},_getTags:()=>'',emitUpdate:()=>{},
    _sync:async()=>{if(fail)throw Error('Provider failed');},getEpisode:()=>episode,getStatus:()=>status,
    getCacheKey:()=>1,getTitle:()=>progress.title,getUrl:()=>progress.url,getImage:()=>'',getRewatchCount:()=>0,
  });
  return {single,messages,setEpisode:value=>{episode=value;}};
}
test('successful sync writes history once, then advances the history baseline',async()=>{
  const {single,messages,setEpisode}=singleHarness();
  await single.sync();await single.sync();setEpisode(15);await single.sync();
  assert.equal(messages.length,2);assert.equal(messages[0].entry.fromEpisode,13);assert.equal(messages[1].entry.fromEpisode,14);
});
test('failed, score-only, decreasing and cross-service list syncs do not invent watch events',async()=>{
  const failed=singleHarness({fail:true});await assert.rejects(()=>failed.single.sync());assert.equal(failed.messages.length,0);
  for(const settings of [{episode:13},{episode:12},{syncMethod:'listSync'}]){
    const h=singleHarness(settings);await h.single.sync();assert.equal(h.messages.length,0);
  }
});
test('the first episode of a rewatch records episode one after a completed season',async()=>{
  const h=singleHarness({before:24,episode:1,previousStatus:2,status:23});await h.single.sync();
  assert.equal(h.messages.length,1);assert.equal(h.messages[0].entry.fromEpisode,0);assert.equal(h.messages[0].entry.toEpisode,1);
});
