const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const ts=require('typescript');
test('overlapping permission and settings changes leave both site and player registered without races',async()=>{
 const registry=new Map(),errors=[],snapshots=[],listeners=[];const pause=()=>new Promise(r=>setTimeout(r,3));
 const domains=[{domain:'*://mkissa.to/*',page:'Mkissa',chibi:true},{domain:'*://filelotion.fyi/*',page:'Mkissa player',player:true},{domain:'*://filelotion.fyi/*',page:'Shared player',player:true},{domain:'*://mkissa.to/*',page:'Mkissa proxy',proxy:'content/proxy.js'}];
 const repo={init:async function(){await pause();return this;},getPermissions:async()=>domains,getList:()=>({})};
 const logger={m(){return this;},log(){},error(...args){errors.push(args);}};const exports={};
 const chrome={permissions:{onAdded:{addListener:fn=>listeners.push(fn)},onRemoved:{addListener(){}}},scripting:{unregisterContentScripts:async()=>{await pause();registry.clear();},registerContentScripts:async scripts=>{await pause();for(const s of scripts){if(registry.has(s.id))throw Error('Already registered '+s.id);registry.set(s.id,s);}},getRegisteredContentScripts:async()=>[...registry.values()]}};
 const imports={'../pages-chibi/loader/ChibiListRepository':{ChibiListRepository:{getInstance:async()=>repo}},'./reconnectTracking':{reconnectTrackingTabs:async scripts=>snapshots.push(scripts.map(s=>s.id))},'../utils/manifest':{isIframeUrl:()=>false}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/background/customDomain.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>imports[n]||{},chrome,con:{m:()=>logger,error:()=>{}},api:{settings:{getAsync:async()=>[]},storage:{storageOnChanged(){}}}});
 await exports.initCustomDomain();await Promise.all([listeners[0](),listeners[0](),listeners[0]()]);assert.equal(errors.length,0);assert.equal(registry.size,3);assert.equal(snapshots.length,4);assert(snapshots.every(s=>s.length===3));
});
