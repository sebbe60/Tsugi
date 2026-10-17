const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,{exports,require:n=>imports[n]||{},...globals});return exports;}
const history=load('src/utils/libraryHistory.ts');
const dates=load('src/utils/releaseDates.ts',{'./libraryHistory':history});
const sites=load('src/utils/tsugiSites.ts',{},{URL});
const tracking=load('src/utils/videoTracking.ts');
const row=(title,airingState,releaseDate,nextAiring)=>({title,airingState,releaseDate,nextAiring,fn:{progress:null}});
const now=Date.parse('2026-10-16T12:00:00Z');
test('Watching is strictly ordered by next release, with unknown schedules before finished shows',()=>{
 const list=[row('Finished','FINISHED','2026-09-01'),row('Later','RELEASING',null,{episode:3,timestamp:now+50000}),row('Unknown','RELEASING'),row('Sooner','RELEASING',null,{episode:4,timestamp:now+10000})];
 assert.equal(dates.orderLibrary(list,'watching',now).map(i=>i.title).join(','),'Sooner,Later,Unknown,Finished');
 assert.equal(list[0].title,'Finished');
});
test('Upcoming dates ascend, Planned release dates descend, and missing dates sort last',()=>{
 const list=[row('Unknown','FINISHED'),row('Old','FINISHED','2005-01-01'),row('Recent','FINISHED','2026-09-01')];
 assert.equal(dates.orderLibrary(list,'upcoming').map(i=>i.title).join(','),'Old,Recent,Unknown');
 assert.equal(dates.orderLibrary(list,'planned').map(i=>i.title).join(','),'Recent,Old,Unknown');
 for(const state of ['FINISHED','RELEASING','currently_airing','finished_airing','current',1,2])assert.equal(dates.isReleased({airingState:state}),true);
 for(const state of ['NOT_YET_RELEASED','tba',3,undefined])assert.equal(dates.isReleased({airingState:state}),false);
});
test('Release dates retain partial precision and reject impossible calendar dates',()=>{
 assert.equal(dates.releaseDateLabel('2027'),'2027 · Month and day not announced');
 assert.match(dates.releaseDateLabel('2027-01-00'),/Jan 2027 · Day not announced/);
 assert.equal(dates.releaseDateLabel('2027-02-29'),'Release date unavailable');
 assert.equal(dates.releaseDateLabel('2028-02-29'),'29 Feb 2028');
});
test('Stockholm release time uses a 24-hour clock and follows daylight-saving offsets',()=>{
 const summer=dates.formatReleaseTime(Date.parse('2026-10-17T15:00:00Z'),'Europe/Stockholm',true);
 const winter=dates.formatReleaseTime(Date.parse('2026-11-17T15:00:00Z'),'Europe/Stockholm',true);
 assert.match(summer,/17:00/);assert.match(winter,/16:00/);assert.doesNotMatch(summer,/AM|PM/);
 assert.match(dates.formatReleaseTime(now,'Europe/Stockholm',false),/pm/i);
});
test('Saved site URLs support HTTPS defaults and reject unsafe schemes and credentials',()=>{
 assert.equal(sites.normalizeSiteUrl('example.com/watch#player'),'https://example.com/watch');
 for(const url of ['javascript:alert(1)','file:///etc/passwd','https://user:pass@example.com','data:text/html,hello'])assert.throws(()=>sites.normalizeSiteUrl(url));
 assert.equal(sites.isTsugiSite({id:'one',name:'Site',url:'https://example.com'}),true);
 assert.equal(sites.isTsugiSite({id:'one',name:'',url:'https://example.com'}),false);
});
test('Video completion accepts a real ended event, while paused scrubbing and invalid durations do not qualify',()=>{
 assert.equal(tracking.qualifiesForTracking({current:90,duration:100,paused:false},.85),true);
 assert.equal(tracking.qualifiesForTracking({current:100,duration:100,paused:true,ended:true},.85),true);
 assert.equal(tracking.qualifiesForTracking({current:99,duration:100,paused:true},.85),false);
 for(const duration of [Infinity,NaN,0,45])assert.equal(tracking.qualifiesForTracking({current:100,duration,paused:false},.85),false);
});
test('Video strategy remembers completion before its startup delay finishes',async()=>{
 let callback;let waiting;
 const player={startTracking(){return this;},addListener(key,fn){callback=fn;return this;},removeListener(){}};
 const {VideoStrategy}=load('src/pages-sync/trackingMode/VideoStrategy.ts',{'../../utils/videoTracking':tracking,'../../utils/player':{PlayerSingleton:{getInstance:()=>player}}},{api:{type:'webextension',settings:{get:()=>85}},chrome:{runtime:{sendMessage:async()=>{}}},utils:{wait:()=>new Promise(resolve=>{waiting=resolve;})},setTimeout:()=>1,clearTimeout:()=>{}});
 const strategy=new VideoStrategy();strategy.start();const done=strategy.waitForTrackingAction();
 callback({current:100,duration:100,paused:true,ended:true});waiting();await done;strategy.stop();
});
test('Site health serializes player and successful-sync writes without losing either',async()=>{
 const store={};let writes=0;
 const health=load('src/background/siteHealth.ts',{'../utils/tsugiSites':sites},{URL,Date,con:{error:()=>{}},chrome:{storage:{local:{get:async key=>({[key]:store[key]}),set:async values=>{writes++;Object.assign(store,values);}}}}});
 const sender={tab:{url:'https://reanime.to/watch/example?ep=14'}};
 await Promise.all([health.recordSitePlayer(sender,{current:90,duration:100,paused:false}),health.recordSiteSync(sender,{title:'Matched anime',toEpisode:14})]);
 const value=store['tsugi/site-health/reanime.to'];assert.equal(value.episode,14);assert.equal(value.progress,.9);assert.ok(value.syncedAt);assert.ok(value.playerSeenAt);
 await health.recordSitePlayer(sender,{current:91,duration:100,paused:false});assert.equal(writes,2);
 await health.recordSitePlayer({url:'moz-extension://test/window.html'},{current:90,duration:100,paused:false});assert.equal(writes,2);
});

test('Video strategy clears the previous video completion when the new episode starts',async()=>{
 let callback;let waiting;let resolved=false;
 const player={startTracking(){return this;},addListener(key,fn){callback=fn;return this;},removeListener(){}};
 const {VideoStrategy}=load('src/pages-sync/trackingMode/VideoStrategy.ts',{'../../utils/videoTracking':tracking,'../../utils/player':{PlayerSingleton:{getInstance:()=>player}}},{api:{type:'webextension',settings:{get:()=>85}},chrome:{runtime:{sendMessage:async()=>{}}},utils:{wait:()=>new Promise(resolve=>{waiting=resolve;})},setTimeout:()=>1,clearTimeout:()=>{}});
 const strategy=new VideoStrategy();strategy.start();const done=strategy.waitForTrackingAction().then(()=>{resolved=true;});
 callback({current:100,duration:100,paused:true,ended:true});
 callback({current:1,duration:100,paused:false});
 waiting();await Promise.resolve();await Promise.resolve();assert.equal(resolved,false);
 callback({current:90,duration:100,paused:false});await done;strategy.stop();
});
