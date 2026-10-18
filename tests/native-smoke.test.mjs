import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, writeFile, rm, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runNativeSmoke } from '../scripts/native-smoke.mjs';

async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'jarvis-smoke-runner-test-')),executable=join(directory,'Jarvis.exe');await writeFile(executable,'test-only-non-executable');
 t.after(()=>rm(directory,{recursive:true,force:true}));return {executable};
}
function childProcess(){const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();return child;}
function report(token,overrides={}){return {token,ready:true,window:true,dom:true,preload:true,boot:true,packaged:true,...overrides};}

test('native runner gives the child an empty isolated profile, strips cloud keys and accepts only full proof',async t=>{
 const {executable}=await fixture(t);let options,profile;
 const result=await runNativeSmoke({executable,env:{OPENAI_API_KEY:'must-not-reach-child',elevenlabs_api_key:'must-not-reach-child',ELECTRON_RUN_AS_NODE:'1',NODE_OPTIONS:'--inspect',KEEP:'kept'},spawnImpl(command,args,selected){
  assert.equal(command,executable);assert.deepEqual(args,['--jarvis-smoke']);options=selected;profile=selected.env.JARVIS_SMOKE_DATA_DIR;
  assert.equal(selected.shell,false);assert.equal(selected.windowsHide,true);for(const key of Object.keys(selected.env))assert.equal(/^(OPENAI_API_KEY|ELEVENLABS_API_KEY|ELECTRON_RUN_AS_NODE|NODE_OPTIONS)$/i.test(key),false);
  const child=childProcess();setImmediate(async()=>{assert.deepEqual(await readdir(profile),[]);child.stdout.write('ordinary internal log\nJARVIS_NATIVE_SMOKE='+JSON.stringify(report(selected.env.JARVIS_SMOKE_TOKEN))+'\n');child.emit('close',0);});return child;
 }});
 assert.deepEqual(result,{ready:true,window:true,dom:true,preload:true,boot:true,packaged:true});assert.equal(options.env.KEEP,'kept');assert.match(options.env.JARVIS_SMOKE_TOKEN,/^[a-f0-9]{64}$/);await assert.rejects(access(profile));
});

test('an unrelated marker, partial UI or development process cannot pass the packaged smoke',async t=>{
 const {executable}=await fixture(t);
 for(const change of [{token:'wrong-token'},{dom:false},{preload:false},{boot:false},{packaged:false}]){
  let profile;
  await assert.rejects(runNativeSmoke({executable,spawnImpl(command,args,options){
   profile=options.env.JARVIS_SMOKE_DATA_DIR;const child=childProcess();setImmediate(()=>{child.stdout.write('JARVIS_NATIVE_SMOKE='+JSON.stringify(report(options.env.JARVIS_SMOKE_TOKEN,change))+'\n');child.emit('close',0);});return child;
  }}),/não confirmou/);await assert.rejects(access(profile));
 }
});

test('a deadlocked main times out, terminates only its child and cleans the disposable profile',async t=>{
 const {executable}=await fixture(t);let created,terminated,profile;
 await assert.rejects(runNativeSmoke({executable,timeoutMs:15,spawnImpl(command,args,options){profile=options.env.JARVIS_SMOKE_DATA_DIR;created=childProcess();return created;},terminateImpl:async child=>{terminated=child;child.emit('close',1);}}),/no prazo/);
 assert.equal(terminated,created);await assert.rejects(access(profile));
});

test('the runner never treats a successful marker followed by a crash as a passing launch',async t=>{
 const {executable}=await fixture(t);
 await assert.rejects(runNativeSmoke({executable,spawnImpl(command,args,options){const child=childProcess();setImmediate(()=>{child.stdout.write('JARVIS_NATIVE_SMOKE='+JSON.stringify(report(options.env.JARVIS_SMOKE_TOKEN))+'\n');child.emit('close',1);});return child;}}),/encerrou com falha/);
});
