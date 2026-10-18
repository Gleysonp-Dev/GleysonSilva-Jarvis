import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { SettingsStore, validateSettings } from '../apps/desktop/settings.mjs';

function fixture(t) {
  const dir=mkdtempSync(join(tmpdir(),'jarvis-settings-')); t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const key=randomBytes(32);
  const crypto={isEncryptionAvailable:()=>true,
    encryptString(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]);},
    decryptString(value){const d=createDecipheriv('aes-256-gcm',key,value.subarray(0,12));d.setAuthTag(value.subarray(12,28));return Buffer.concat([d.update(value.subarray(28)),d.final()]).toString('utf8');}};
  return {dir,crypto,store:new SettingsStore(dir,crypto)};
}
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
