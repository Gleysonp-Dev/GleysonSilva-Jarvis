import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv, generateKeyPairSync } from 'node:crypto';
import { SettingsStore, validateSettings, defaults } from '../apps/desktop/settings.mjs';

function fixture(t) {
  const dir=mkdtempSync(join(tmpdir(),'jarvis-settings-')); t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const key=randomBytes(32);
  const crypto={isEncryptionAvailable:()=>true,
    encryptString(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]);},
    decryptString(value){const d=createDecipheriv('aes-256-gcm',key,value.subarray(0,12));d.setAuthTag(value.subarray(12,28));return Buffer.concat([d.update(value.subarray(28)),d.final()]).toString('utf8');}};
  return {dir,crypto,store:new SettingsStore(dir,crypto)};
}
test('Fire TV configuration is opt-in and validates effective host before changing secrets', t => {
 const {store}=fixture(t);assert.equal(defaults.fireTvEnabled,false);assert.equal(defaults.fireTvHost,'');
 store.save({apiKey:'existing-private'});
 for(const host of ['8.8.8.8','127.0.0.1','localhost','10.01.0.1','172.32.0.1','192.168.1.300','192.168.1.1:5555','10.0.0.1;echo x','http://10.0.0.1',null]) assert.throws(()=>store.save({fireTvHost:host,apiKey:'replacement'}));
 assert.throws(()=>store.save({fireTvEnabled:true,apiKey:'replacement'}));assert.equal(store.getSecret(),'existing-private');assert.equal(store.get().fireTvEnabled,false);
 store.save({fireTvHost:'192.168.42.7'});store.save({fireTvEnabled:true});assert.equal(store.public().fireTvPaired,false);
 assert.throws(()=>store.save({fireTvHost:''}));assert.equal(store.get().fireTvHost,'192.168.42.7');
 store.save({fireTvEnabled:false,fireTvHost:''});assert.equal(store.get().fireTvEnabled,false);
});
test('Fire TV identity is separately encrypted and pairing is bound to host and profile', t => {
 const {store,dir,crypto}=fixture(t);
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 const record={host:'192.168.42.7',profileId:'default',privateKey,paired:true};
 store.save({fireTvEnabled:true,fireTvHost:record.host});store.setFireTvKeyRecord(record);
 const restored=new SettingsStore(dir,crypto);assert.deepEqual(restored.getFireTvKeyRecord(),record);assert.equal(restored.public().fireTvPaired,true);
 assert.equal(JSON.stringify(restored.public()).includes(privateKey),false);assert.equal(JSON.stringify(restored.get()).includes(privateKey),false);
 for(const file of readdirSync(dir))assert.equal(readFileSync(join(dir,file)).includes(Buffer.from('PRIVATE KEY')),false);
 restored.save({profileId:'other'});assert.equal(restored.public().fireTvPaired,false);
 restored.save({profileId:'default',fireTvHost:'192.168.42.8'});assert.equal(restored.public().fireTvPaired,false);
 restored.save({fireTvHost:record.host,fireTvEnabled:false});assert.equal(restored.public().fireTvPaired,false);
 assert.throws(()=>restored.setFireTvKeyRecord({...record,host:'example.com'}));assert.throws(()=>restored.setFireTvKeyRecord({...record,privateKey:'invalid'}));assert.throws(()=>restored.setFireTvKeyRecord({...record,extra:true}));
 assert.deepEqual(restored.getFireTvKeyRecord(),record);
 const unavailable=new SettingsStore(dir,{isEncryptionAvailable:()=>false});assert.equal(unavailable.getFireTvKeyRecord(),null);assert.throws(()=>unavailable.setFireTvKeyRecord(record),/protegido/);
 writeFileSync(join(dir,'credentials-fire-tv.bin'),'broken');assert.equal(restored.getFireTvKeyRecord(),null);
});
test('credentials persist encrypted and never appear in public settings or JSON',t=>{
 const {dir,store,crypto}=fixture(t),secret='sk-test-private-marker';
 store.save({apiKey:secret,profileId:'primary'});
 store.write({apps:[{id:'notepad',label:'Bloco de notas',path:'C:/private/app.exe'}]});
 assert.equal(new SettingsStore(dir,crypto).getSecret(),secret);
 assert.equal(JSON.stringify(store.public()).includes(secret),false);
 assert.equal(JSON.stringify(store.public()).includes('C:/private/app.exe'),false);
 assert.equal(store.public().hasKey,true);
 for(const file of readdirSync(dir))assert.equal(readFileSync(join(dir,file)).includes(Buffer.from(secret)),false);
});
test('invalid settings do not replace existing secret or selected profile',t=>{
 const {store}=fixture(t);store.save({apiKey:'sk-original',profileId:'primary'});
 assert.throws(()=>store.save({apiKey:'sk-replacement',profileId:'../../other'}));
 assert.equal(store.getSecret(),'sk-original');assert.equal(store.get().profileId,'primary');
 assert.throws(()=>validateSettings({maxSessionMinutes:31}));
 assert.throws(()=>validateSettings({voice:'https://evil.test'}));
});
test('secret save fails closed when protected storage is unavailable',t=>{
 const {dir}=fixture(t);const store=new SettingsStore(dir,{isEncryptionAvailable:()=>false});
 assert.throws(()=>store.save({apiKey:'sk-private'}),/protegido/);
 assert.deepEqual(readdirSync(dir),[]);
});
test('ElevenLabs has a separate encrypted credential and public settings only expose availability',t=>{
 const {dir,store,crypto}=fixture(t);store.save({apiKey:'openai-test',elevenApiKey:'eleven-private-test',elevenVoiceId:'testVoice123',startupGreeting:true,weatherLocation:{name:'Cidade de ensaio',latitude:10,longitude:20}});
 const restored=new SettingsStore(dir,crypto);
 assert.equal(restored.getSecret(),'openai-test');assert.equal(restored.getElevenSecret(),'eleven-private-test');assert.equal(restored.public().hasElevenKey,true);
 assert.equal(JSON.stringify(restored.public()).includes('eleven-private-test'),false);
 for(const file of readdirSync(dir))assert.equal(readFileSync(join(dir,file)).includes(Buffer.from('eleven-private-test')),false);
 assert.equal(restored.public().weatherLocation.name,'Cidade de ensaio');
});
test('weather settings reject malformed locations and do not modify stored credentials',t=>{
 const {store}=fixture(t);store.save({elevenApiKey:'eleven-original'});
 for(const location of [{name:'Cidade',latitude:100,longitude:0},{name:'Cidade',latitude:0,longitude:NaN},{name:'Cidade',latitude:0,longitude:0,url:'https://bad.test'},{name:'<script>',latitude:0,longitude:0}])assert.throws(()=>store.save({weatherLocation:location,elevenApiKey:'replacement'}));
 assert.equal(store.getElevenSecret(),'eleven-original');
 assert.throws(()=>store.save({apiKey:'openai-would-change',elevenApiKey:'bad\nkey'}));
 assert.throws(()=>store.save({startupGreeting:'yes'}));
});

test('startup and standby defaults require deliberate activation and persist independently',t=>{
 const {store,dir,crypto}=fixture(t);
 assert.equal(defaults.startAtLogin,false);assert.equal(defaults.standbyEnabled,false);
 for(const key of ['wakeClapEnabled','wakeVoiceEnabled','greetingMusicEnabled'])assert.equal(defaults[key],true);
 const selected={startAtLogin:true,standbyEnabled:true,wakeClapEnabled:false,wakeVoiceEnabled:true,greetingMusicEnabled:false};
 store.save(selected);
 const restored=new SettingsStore(dir,crypto);
 for(const [key,value] of Object.entries(selected)){assert.equal(restored.get()[key],value);assert.equal(restored.public()[key],value);}
 restored.save({wakeClapEnabled:true});
 assert.equal(restored.get().wakeClapEnabled,true);assert.equal(restored.get().greetingMusicEnabled,false);
});

test('startup options reject coercion without modifying credentials or stored configuration',t=>{
 const {store}=fixture(t);store.save({apiKey:'private-original',startAtLogin:false});
 for(const key of ['startAtLogin','standbyEnabled','wakeClapEnabled','wakeVoiceEnabled','greetingMusicEnabled']){
  for(const value of ['true',0,1,null,{},[]])assert.throws(()=>store.save({[key]:value,apiKey:'replacement'}));
 }
 assert.equal(store.get().startAtLogin,false);assert.equal(store.getSecret(),'private-original');
});

test('enabling standby also enables its weather greeting even when an older configuration disabled it',t=>{
 const {store}=fixture(t);store.save({startupGreeting:false});
 assert.equal(store.get().startupGreeting,false);
 store.save({standbyEnabled:true,startupGreeting:false});
 assert.equal(store.get().standbyEnabled,true);assert.equal(store.get().startupGreeting,true);
 store.save({startupGreeting:false});assert.equal(store.get().startupGreeting,true);
 store.save({standbyEnabled:false,startupGreeting:false});assert.equal(store.get().startupGreeting,false);
});

test('automatic voice and continuous renewal require explicit boolean choices and persist without changing voice or keys',t=>{
 const {store,dir,crypto}=fixture(t); const fields=['receptionVoiceEnabled','continuousVoiceEnabled'];
 for(const key of fields){assert.equal(defaults[key],false);for(const value of ['true',0,1,null,{},[]])assert.throws(()=>store.save({[key]:value}));}
 store.save({apiKey:'test-openai',elevenApiKey:'test-eleven',elevenVoiceId:'TestVoice',...Object.fromEntries(fields.map(key=>[key,true]))});
 const restored=new SettingsStore(dir,crypto); for(const key of fields)assert.equal(restored.public()[key],true);
 assert.equal(restored.getSecret(),'test-openai');assert.equal(restored.getElevenSecret(),'test-eleven');assert.equal(restored.get().elevenVoiceId,'TestVoice');
});

test('old outfit opt-in is retired when reading or saving without modifying voice, keys or other settings',t=>{
 const {store,dir,crypto}=fixture(t);
 store.save({apiKey:'test-openai',elevenApiKey:'test-eleven',elevenVoiceId:'TestVoice',receptionVoiceEnabled:true,continuousVoiceEnabled:true});
 const file=join(dir,'settings.json'),raw=JSON.parse(readFileSync(file,'utf8'));
 writeFileSync(file,JSON.stringify({...raw,receptionOutfitEnabled:true}));
 const restored=new SettingsStore(dir,crypto);
 assert.equal(restored.public().receptionOutfitEnabled,false);
 restored.save({receptionOutfitEnabled:true});
 assert.equal(new SettingsStore(dir,crypto).get().receptionOutfitEnabled,false);
 assert.equal(restored.getSecret(),'test-openai');assert.equal(restored.getElevenSecret(),'test-eleven');assert.equal(restored.get().elevenVoiceId,'TestVoice');
 assert.equal(restored.get().receptionVoiceEnabled,true);assert.equal(restored.get().continuousVoiceEnabled,true);
 for(const value of ['true',0,1,null,{},[]])assert.throws(()=>restored.save({receptionOutfitEnabled:value,apiKey:'replacement'}));
 assert.equal(restored.getSecret(),'test-openai');
});


test('private Ultron access defaults off, persists explicit choice and rejects coercion atomically',t=>{
 const {store,dir,crypto}=fixture(t);
 assert.equal(defaults.ultronEnabled,false); assert.equal(store.public().ultronEnabled,false);
 store.save({ultronEnabled:true,apiKey:'private-original'});
 assert.equal(new SettingsStore(dir,crypto).public().ultronEnabled,true);
 for(const value of ['true',0,1,null,{},[]])assert.throws(()=>store.save({ultronEnabled:value,apiKey:'replacement'}));
 assert.equal(store.get().ultronEnabled,true);assert.equal(store.getSecret(),'private-original');
 store.save({ultronEnabled:false});assert.equal(new SettingsStore(dir,crypto).get().ultronEnabled,false);
});
