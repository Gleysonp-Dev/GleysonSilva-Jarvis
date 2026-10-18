import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, readdirSync, symlinkSync, openSync, closeSync, ftruncateSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GreetingMusicStore } from '../apps/desktop/greeting-music.mjs';

function wav(sample = 3) {
 const bytes=Buffer.alloc(48);bytes.write('RIFF');bytes.writeUInt32LE(40,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(4,40);bytes.writeInt16LE(sample,44);bytes.writeInt16LE(sample,46);return bytes;
}
function audioFixtures(){
 const mp3=Buffer.concat([Buffer.from([0xff,0xfb,0x90,0]),Buffer.alloc(413)]);
 const ogg=Buffer.alloc(47);ogg.write('OggS');ogg[26]=1;ogg[27]=19;ogg.write('OpusHead',28);ogg[36]=1;ogg[37]=1;
 const m4a=Buffer.alloc(32);m4a.writeUInt32BE(24);m4a.write('ftyp',4);m4a.write('M4A ',8);m4a.write('M4A ',16);m4a.write('isom',20);m4a.writeUInt32BE(8,24);m4a.write('mdat',28);
 return [{extension:'.mp3',mime:'audio/mpeg',bytes:mp3},{extension:'.wav',mime:'audio/wav',bytes:wav()},{extension:'.ogg',mime:'audio/ogg',bytes:ogg},{extension:'.m4a',mime:'audio/mp4',bytes:m4a}];
}
function fixture(t){
 const directory=mkdtempSync(join(tmpdir(),'jarvis-music-test-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const dataDir=join(directory,'private'),sources=join(directory,'selected');mkdirSync(sources);const store=new GreetingMusicStore({dataDir});
 return {directory,dataDir,sources,store};
}

test('an empty music store stays unavailable and does not create a soundtrack',async t=>{
 const {dataDir,store}=fixture(t);assert.equal(store.available(),false);assert.equal(await store.read(),null);assert.deepEqual(readdirSync(dataDir),[]);
 assert.throws(()=>new GreetingMusicStore({dataDir:'relative'}));
});

test('selected audio outside the private directory is copied without retaining its source path or filename',async t=>{
 const {dataDir,sources,store}=fixture(t),source=join(sources,'personal-name-do-not-save.wav'),bytes=wav();writeFileSync(source,bytes);
 assert.deepEqual(await store.importFile(source),{hasGreetingMusic:true});unlinkSync(source);
 assert.equal(store.available(),true);const saved=await store.read();assert.equal(saved.mime,'audio/wav');assert.deepEqual(saved.bytes,bytes);
 assert.deepEqual(readdirSync(dataDir).sort(),['greeting-music.audio','greeting-music.json']);
 const metadata=readFileSync(join(dataDir,'greeting-music.json'),'utf8');assert.equal(metadata.includes(source),false);assert.equal(metadata.includes('personal-name'),false);
 const restored=new GreetingMusicStore({dataDir});assert.equal(restored.available(),true);assert.deepEqual((await restored.read()).bytes,bytes);
});

test('the bounded store recognizes each permitted audio container from its bytes',async t=>{
 const {sources,store}=fixture(t);
 for(const {extension,mime,bytes} of audioFixtures()){
  const source=join(sources,'test'+extension);writeFileSync(source,bytes);await store.importFile(source);const saved=await store.read();assert.equal(saved.mime,mime);assert.deepEqual(saved.bytes,bytes);
 }
});

test('mislabelled content, non-audio files, empty files and files above 20 MiB do not replace approved audio',async t=>{
 const {sources,store}=fixture(t),original=wav();const valid=join(sources,'approved.wav');writeFileSync(valid,original);await store.importFile(valid);
 for(const [name,bytes] of [['renamed.mp3',wav()],['script.mp3',Buffer.from('<html>not audio</html>')],['bad-id3.mp3',Buffer.from('ID3\x03\x00\x00\x7f\x7f\x7f\x7fgarbage')],['empty.wav',Buffer.alloc(0)],['wrong.txt',wav()]]){
  const file=join(sources,name);writeFileSync(file,bytes);await assert.rejects(store.importFile(file));
 }
 const large=join(sources,'large.wav'),handle=openSync(large,'w');ftruncateSync(handle,20*1024*1024+1);closeSync(handle);await assert.rejects(store.importFile(large),/20 MiB/);
 assert.deepEqual((await store.read()).bytes,original);
});

test('directory links and nonregular selected files cannot cross the import boundary',async t=>{
 const {directory,sources,store}=fixture(t),source=join(sources,'audio.wav');writeFileSync(source,wav());
 const link=join(directory,'linked-source');symlinkSync(sources,link,process.platform==='win32'?'junction':'dir');
 await assert.rejects(store.importFile(join(link,'audio.wav')),/sem links/);
 const nonregular=join(sources,'folder.wav');mkdirSync(nonregular);await assert.rejects(store.importFile(nonregular),/regular/);
 const privateLink=join(directory,'linked-private');symlinkSync(sources,privateLink,process.platform==='win32'?'junction':'dir');assert.throws(()=>new GreetingMusicStore({dataDir:privateLink}),/sem links/);
});

test('tampered bytes or metadata are not returned as playable private audio',async t=>{
 const {dataDir,sources,store}=fixture(t),source=join(sources,'test.wav');writeFileSync(source,wav());await store.importFile(source);
 writeFileSync(join(dataDir,'greeting-music.audio'),wav(4));assert.equal(await store.read(),null);
 await store.importFile(source);
 const metadataFile=join(dataDir,'greeting-music.json'),metadata=JSON.parse(readFileSync(metadataFile,'utf8'));metadata.mime='text/html';writeFileSync(metadataFile,JSON.stringify(metadata));
 assert.equal(store.available(),false);assert.equal(await store.read(),null);
});

test('an unsafe destination is refused without writing through it',async t=>{
 const {directory,dataDir,sources,store}=fixture(t),source=join(sources,'test.wav');writeFileSync(source,wav());
 const outside=join(directory,'outside');mkdirSync(outside);symlinkSync(outside,join(dataDir,'greeting-music.audio'),process.platform==='win32'?'junction':'dir');
 await assert.rejects(store.importFile(source),/seguro/);assert.deepEqual(readdirSync(outside),[]);assert.equal(store.available(),false);
});

test('concurrent imports finish in order without leaving temporary files',async t=>{
 const {dataDir,sources,store}=fixture(t),first=join(sources,'first.wav'),last=join(sources,'last.wav');writeFileSync(first,wav(1));writeFileSync(last,wav(2));
 await Promise.all([store.importFile(first),store.importFile(last)]);assert.deepEqual((await store.read()).bytes,wav(2));
 assert.deepEqual(readdirSync(dataDir).sort(),['greeting-music.audio','greeting-music.json']);
});
