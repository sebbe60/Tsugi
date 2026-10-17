const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=require('node:path').resolve(__dirname,'..');
const ts=require(root+'/node_modules/typescript');
const patterns=require(root+'/node_modules/webext-patterns');
const source=ts.transpileModule(fs.readFileSync(root+'/src/background/reconnectTracking.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
const main={id:'main',matches:['*://reanime.to/*'],js:['vendor/jquery.min.js','i18n.js','content/chibi.js','content/content-script.js']};
const player={id:'player',matches:['*://flixcloud.cc/*'],js:['vendor/jquery.min.js','i18n.js','content/iframe.js']};
function setup({frames,tabs=[{id:1,url:'https://reanime.to/watch/test'}],failFrame,failTab}={}){
 const calls=[];const errors=[];const exports={};
 const chrome={tabs:{query:async()=>tabs},scripting:{executeScript:async options=>{
  if(options.func){if(options.target.tabId===failTab)throw Error('closed tab');return frames||[];}
  calls.push(options);if(options.target.frameIds[0]===failFrame)throw Error('closed frame');return [];
 }}};
 vm.runInNewContext(source,{exports,require:()=>patterns,chrome,con:{error:(...args)=>errors.push(args)}});
 return {run:(scripts=[main,player])=>exports.reconnectTrackingTabs(scripts),calls,errors};
}
const frame=(frameId,url,mainLoaded=false,playerLoaded=false)=>({frameId,result:{url,mainLoaded,playerLoaded}});
test('reattaches main before matching player without touching unrelated frames',async()=>{
 const s=setup({frames:[frame(2,'https://ads.example/ad'),frame(1,'https://flixcloud.cc/e/123'),frame(0,'https://reanime.to/watch/test')]});await s.run();
 assert.deepEqual(s.calls.map(c=>c.target.frameIds[0]),[0,1]);assert.equal(s.calls[0].files,main.js);assert.equal(s.calls[1].files,player.js);
});
test('healthy trackers are skipped',async()=>{
 const s=setup({frames:[frame(0,'https://reanime.to/watch/test',true),frame(1,'https://flixcloud.cc/e/123',false,true)]});await s.run();assert.equal(s.calls.length,0);
});
test('missing player reconnects while active main stays untouched',async()=>{
 const s=setup({frames:[frame(0,'https://reanime.to/watch/test',true),frame(1,'https://flixcloud.cc/e/123')]});await s.run();assert.equal(s.calls.length,1);assert.equal(s.calls[0].files,player.js);
});
test('frame failure does not prevent remaining frames',async()=>{
 const s=setup({failFrame:0,frames:[frame(0,'https://reanime.to/watch/test'),frame(1,'https://flixcloud.cc/e/123')]});await s.run();assert.equal(s.calls.length,2);assert.equal(s.errors.length,1);
});
test('closed tab does not prevent another tab recovering',async()=>{
 const s=setup({failTab:1,tabs:[{id:1,url:'https://reanime.to/watch/a'},{id:2,url:'https://reanime.to/watch/b'}],frames:[frame(0,'https://reanime.to/watch/b')]});await s.run();assert.equal(s.calls.length,1);assert.equal(s.calls[0].target.tabId,2);assert.equal(s.errors.length,1);
});
test('empty scripts and unrelated tabs are safe',async()=>{
 const s=setup({tabs:[{id:1,url:'https://unrelated.example/'}]});await s.run([]);await s.run();assert.equal(s.calls.length,0);
});
