const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function handler(manifest, result = true) {
  const exports = {};const calls = [];
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/permissions.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => ({}), chrome: { runtime: { getManifest: () => manifest }, permissions: { request: request => {calls.push(JSON.parse(JSON.stringify(request)));return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);} } } });
  const instance = new exports.PermissionsHandler();
  instance.required = {match:['*://myanimelist.net/*'],api:['https://api.malsync.moe/*']};instance.player={match:['*://player.example/*']};instance.pages=[];instance.chibi=[];instance.init=async()=>instance;
  return {instance,calls};
}
test('Firefox required scripting is excluded and all-site request stays compact',async()=>{const {instance,calls}=handler({permissions:['scripting'],host_permissions:['*://*/*']});const request=instance.requestPermissions();assert.equal(calls.length,1,'request runs synchronously in click handler');assert.deepEqual(calls[0],{permissions:[],origins:['*://*/*']});assert.equal(await request,true);});
test('Chromium optional scripting and granular host requests are retained',async()=>{const {instance,calls}=handler({permissions:['storage'],host_permissions:[]});await instance.requestPermissions();assert.deepEqual(calls[0].permissions,['scripting']);assert.ok(calls[0].origins.includes('*://player.example/*'));});
test('denial and browser rejection are returned to the caller',async()=>{assert.equal(await handler({permissions:['scripting'],host_permissions:['*://*/*']},false).instance.requestPermissions(),false);await assert.rejects(handler({permissions:['scripting'],host_permissions:['*://*/*']},new Error('Firefox rejected')).instance.requestPermissions(),/Firefox rejected/);});
