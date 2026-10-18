import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { configureStartup, isStandbyLaunch, WindowsWakeService, NATIVE_WAKE_POLICY } from '../apps/desktop/startup.mjs';

function nativeApp({ packaged = true, observed = true } = {}) {
 const writes=[],reads=[];
 return {writes,reads,app:{isPackaged:packaged,
  setLoginItemSettings(value){writes.push(value);},
  getLoginItemSettings(value){reads.push(value);return {openAtLogin:observed,executableWillLaunchAtLogin:observed};}
 }};
}

function wakeRig({ initial = {type:'ready',culture:'en-US'}, acknowledgeStop = true } = {}) {
 const children=[],calls=[];
 const spawnImpl=(command,args,options)=>{
  calls.push({command,args,options});
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.input='';child.kills=0;
  child.stdin=new Writable({write(chunk,encoding,callback){child.input+=chunk.toString();callback();},final(callback){callback();if(acknowledgeStop)queueMicrotask(()=>child.emit('close',0));}});
  child.kill=()=>{child.kills++;queueMicrotask(()=>child.emit('close',0));return true;};
  children.push(child);if(initial)queueMicrotask(()=>child.stdout.write(JSON.stringify(initial)+'\n'));
  return child;
 };
 return {children,calls,spawnImpl};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const wake = (overrides = {}) => ({ type: 'wake', keyword: 'Jarvis', confidence: 0.98, wordConfidence: 0.97, wordCount: 1, durationMs: 650, ...overrides });

test('login startup uses only the packaged Windows executable and the fixed standby argument',()=>{
 const {app,writes,reads}=nativeApp();
 const result=configureStartup(app,{startAtLogin:true},{platform:'win32',execPath:'C:\\Program Files\\Jarvis\\Jarvis.exe'});
 assert.deepEqual(result,{available:true,requested:true,enabled:true});
 assert.deepEqual(writes,[{openAtLogin:true,path:'C:\\Program Files\\Jarvis\\Jarvis.exe',args:['--jarvis-standby']}]);
 assert.deepEqual(reads,[{path:'C:\\Program Files\\Jarvis\\Jarvis.exe',args:['--jarvis-standby']}]);
 assert.equal(isStandbyLaunch(['app','--jarvis-standby']),true);
 assert.equal(isStandbyLaunch(['app','--jarvis-standby=false']),false);
});

test('development, browser and non-Windows contexts never mutate OS startup',()=>{
 for(const [platform,packaged] of [['win32',false],['linux',true],['darwin',true]]){
  const {app,writes}=nativeApp({packaged});const result=configureStartup(app,{startAtLogin:true},{platform});
  assert.equal(result.available,false);assert.equal(result.enabled,false);assert.deepEqual(writes,[]);
 }
 assert.throws(()=>configureStartup(nativeApp().app,{startAtLogin:'true'},{platform:'win32'}));
});

test('startup removal is verified and external OS disablement is reported honestly',()=>{
 const off=nativeApp({observed:false});assert.equal(configureStartup(off.app,{startAtLogin:false},{platform:'win32'}).enabled,false);
 assert.equal(off.writes[0].openAtLogin,false);
 const blocked=nativeApp({observed:false});assert.equal(configureStartup(blocked.app,{startAtLogin:true},{platform:'win32'}).reason,'startup_not_confirmed');
 const broken={isPackaged:true,setLoginItemSettings(){throw new Error('private path');},getLoginItemSettings(){}};
 assert.deepEqual(configureStartup(broken,{startAtLogin:true},{platform:'win32'}),{available:true,requested:true,enabled:false,reason:'startup_configuration_failed'});
});

test('portable builds register the original stable executable instead of the extracted process',()=>{
 const {app,writes}=nativeApp();
 configureStartup(app,{startAtLogin:true},{platform:'win32',env:{PORTABLE_EXECUTABLE_FILE:'C:\\Jarvis\\GleysonSilva-Jarvis-0.2.0-Windows.exe'}});
 assert.equal(writes[0].path,'C:\\Jarvis\\GleysonSilva-Jarvis-0.2.0-Windows.exe');
 const invalid=nativeApp();
 assert.equal(configureStartup(invalid.app,{startAtLogin:true},{platform:'win32',env:{PORTABLE_EXECUTABLE_FILE:'relative.exe'}}).reason,'startup_path_unavailable');
 assert.equal(invalid.writes.length,0);
});

test('wake service is inactive on construction and cannot start on unsupported platforms',async()=>{
 const rig=wakeRig();const service=new WindowsWakeService({platform:'linux',spawnImpl:rig.spawnImpl});
 assert.equal(service.status().running,false);assert.equal((await service.start()).reason,'requires_windows');assert.equal(rig.calls.length,0);
});

test('wake service accepts only the fixed keyword above threshold and debounces duplicate detections',async t=>{
 const rig=wakeRig(),events=[];let at=100;
 const service=new WindowsWakeService({platform:'win32',spawnImpl:rig.spawnImpl,onWake:event=>events.push(event),now:()=>at});t.after(()=>service.stop());
 const status=await service.start();assert.equal(status.running,true);assert.equal(status.culture,'en-US');
 assert.equal(rig.calls.length,1);assert.equal(rig.calls[0].options.shell,false);assert.equal(rig.calls[0].options.windowsHide,true);
 assert.match(rig.calls[0].args.at(-1),/windowsSpeech\.ps1$/);assert.equal(rig.calls[0].args.includes('-Command'),false);
 const child=rig.children[0];
 at += NATIVE_WAKE_POLICY.startupQuietMs;
 for(const value of [
  wake({keyword:'not Jarvis'}),
  wake({confidence:0.71}),
  wake({confidence:1.01}),
  wake({confidence:'0.99'}),
  wake({confidence:0.9}),
  wake({confidence:0.95}),
  wake()
 ])child.stdout.write(JSON.stringify(value)+'\n');
 assert.deepEqual(events,[{source:'voice',keyword:'Jarvis',confidence:0.95}]);
 at+=NATIVE_WAKE_POLICY.cooldownMs;child.stdout.write(JSON.stringify(wake())+'\n');assert.equal(events.length,2);
 await service.start();assert.equal(rig.calls.length,1);
 await service.stop();assert.equal(child.input,'STOP\n');assert.equal(service.status().running,false);
 child.stdout.write('{"type":"wake","keyword":"Jarvis","confidence":1}\n');assert.equal(events.length,2);
});

test('native wake rejects missing, weak, multiword and implausible-duration evidence before notifying main', async t => {
 const rig = wakeRig(), events = []; let at = 0;
 const service = new WindowsWakeService({ platform: 'win32', spawnImpl: rig.spawnImpl, now: () => at, onWake: event => events.push(event) }); t.after(() => service.stop());
 await service.start(); const child = rig.children[0]; at = NATIVE_WAKE_POLICY.startupQuietMs;
 for (const invalid of [
  { confidence: 0.9199 }, { wordConfidence: 0.8999 }, { wordConfidence: 1.001 }, { wordConfidence: '0.99' }, { wordConfidence: undefined },
  { durationMs: 249.9 }, { durationMs: 1500.1 }, { durationMs: Infinity }, { durationMs: '650' }, { durationMs: undefined },
  { wordCount: 2 }, { wordCount: '1' }, { wordCount: undefined }
 ]) child.stdout.write(JSON.stringify(wake(invalid)) + '\n');
 assert.equal(events.length, 0);
 child.stdout.write(JSON.stringify(wake({ confidence: NATIVE_WAKE_POLICY.minConfidence, wordConfidence: NATIVE_WAKE_POLICY.minWordConfidence, durationMs: NATIVE_WAKE_POLICY.minDurationMs })) + '\n');
 assert.equal(events.length, 1);
 at += NATIVE_WAKE_POLICY.cooldownMs;
 child.stdout.write(JSON.stringify(wake({ durationMs: NATIVE_WAKE_POLICY.maxDurationMs })) + '\n'); assert.equal(events.length, 2);
});

test('microphone warmup rejects early matches and stopping/restarting cannot erase the wake cooldown', async t => {
 const rig = wakeRig(), events = []; let at = 0;
 const service = new WindowsWakeService({ platform: 'win32', spawnImpl: rig.spawnImpl, now: () => at, onWake: event => events.push(event) }); t.after(() => service.stop());
 await service.start(); rig.children[0].stdout.write(JSON.stringify(wake()) + '\n'); assert.equal(events.length, 0);
 at = NATIVE_WAKE_POLICY.startupQuietMs - 1; rig.children[0].stdout.write(JSON.stringify(wake()) + '\n'); assert.equal(events.length, 0);
 at++; rig.children[0].stdout.write(JSON.stringify(wake()) + '\n'); assert.equal(events.length, 1);
 await service.stop(); at += 500; await service.start();
 at += NATIVE_WAKE_POLICY.startupQuietMs; rig.children[1].stdout.write(JSON.stringify(wake()) + '\n'); assert.equal(events.length, 1);
 at = NATIVE_WAKE_POLICY.startupQuietMs + NATIVE_WAKE_POLICY.cooldownMs;
 rig.children[1].stdout.write(JSON.stringify(wake()) + '\n'); assert.equal(events.length, 2);
});

test('missing recognition engines fail without claiming active listening',async()=>{
 const rig=wakeRig({initial:{type:'unavailable',reason:'speech_engine_missing'}});
 const service=new WindowsWakeService({platform:'win32',spawnImpl:rig.spawnImpl});
 const status=await service.start();assert.equal(status.available,false);assert.equal(status.running,false);assert.equal(status.reason,'speech_engine_missing');
 await service.stop();assert.equal(rig.children[0].input,'STOP\n');
});

test('abort stops the worker and an aborted start does not capture the microphone',async()=>{
 const rig=wakeRig(),controller=new AbortController();const service=new WindowsWakeService({platform:'win32',spawnImpl:rig.spawnImpl});
 await service.start({signal:controller.signal});controller.abort();await service.stop();
 assert.equal(service.status().running,false);assert.equal(rig.children[0].input,'STOP\n');
 await service.start({signal:controller.signal});assert.equal(rig.calls.length,1);
});

test('malformed or excessive worker output closes the worker and stale generations cannot wake',async()=>{
 for(const bad of ['not-json\n','x'.repeat(8193)]){
  const rig=wakeRig(),wakes=[];const service=new WindowsWakeService({platform:'win32',spawnImpl:rig.spawnImpl,onWake:value=>wakes.push(value)});
  await service.start();rig.children[0].stdout.write(bad);await tick();
  assert.equal(service.status().reason,'invalid_worker_output');assert.equal(service.status().running,false);
  rig.children[0].stdout.write('{"type":"wake","keyword":"Jarvis","confidence":1}\n');assert.equal(wakes.length,0);await service.stop();
 }
});

test('worker spawn failures do not leak system errors and a later start can recover',async()=>{
 let attempts=0;const rig=wakeRig();
 const service=new WindowsWakeService({platform:'win32',spawnImpl(...args){if(++attempts===1)throw new Error('private path');return rig.spawnImpl(...args);}});
 assert.equal((await service.start()).reason,'speech_worker_unavailable');
 assert.equal((await service.start()).running,true);await service.stop();
});

test('the native worker compiles and its real C# rejection policy is exercised without opening the microphone',{skip:process.platform!=='win32'},()=>{
 const source=readFileSync(new URL('../apps/desktop/platform/windowsSpeech.ps1',import.meta.url),'utf8');
 const code=source.match(/@'\r?\n([\s\S]*?)\r?\n'@/)[1];
 const encodedSource=Buffer.from(code,'utf8').toString('base64');
 const script=`$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Add-Type -AssemblyName System.Speech; $refs=@([System.Speech.Recognition.SpeechRecognitionEngine].Assembly.Location,[Console].Assembly.Location,[System.Threading.Monitor].Assembly.Location,[Diagnostics.Stopwatch].Assembly.Location)|Select-Object -Unique; Add-Type -ReferencedAssemblies $refs -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedSource}'))); $accepted=@([JarvisLocalWake]::IsWakeCandidate('Jarvis',.98,.97,1,650),[JarvisLocalWake]::IsWakeCandidate('jarvis',.92,.9,1,250),[JarvisLocalWake]::IsWakeCandidate('Jarvis',1,1,1,1500)); $rejected=@([JarvisLocalWake]::IsWakeCandidate('outra palavra',1,1,1,650),[JarvisLocalWake]::IsWakeCandidate('Jarvis',.919,.99,1,650),[JarvisLocalWake]::IsWakeCandidate('Jarvis',.99,.899,1,650),[JarvisLocalWake]::IsWakeCandidate('Jarvis',.99,.99,2,650),[JarvisLocalWake]::IsWakeCandidate('Jarvis',.99,.99,1,249),[JarvisLocalWake]::IsWakeCandidate('Jarvis',.99,.99,1,1501),[JarvisLocalWake]::IsWakeCandidate('Jarvis',[float]::NaN,.99,1,650),[JarvisLocalWake]::IsWakeCandidate('Jarvis',.99,.99,1,[double]::PositiveInfinity)); if(($accepted -contains $false)-or($rejected -contains $true)){throw 'wake-policy-failed'}; [Console]::WriteLine('compiled-and-policy-verified');`;
 const output=execFileSync(join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:64000});
 assert.match(output,/compiled-and-policy-verified/);
});
