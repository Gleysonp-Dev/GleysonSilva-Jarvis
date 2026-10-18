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
