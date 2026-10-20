import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createLocalTestServer } from '../scripts/local-test.mjs';
import { GreetingMusicStore } from '../apps/desktop/greeting-music.mjs';

async function fixture(t, { config, fetch: fetchImpl } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-local-test-'));
  const dataDir = path.join(directory, 'private'), assetsDir = path.join(directory, 'assets');
  await fs.mkdir(assetsDir);
  if (config) { await fs.mkdir(dataDir); await fs.writeFile(path.join(dataDir, 'config.json'), JSON.stringify(config)); }
  await fs.writeFile(path.join(assetsDir, 'index.html'), '<!doctype html><head></head><body><script src="/app.js"></script></body>');
  await fs.writeFile(path.join(assetsDir, 'app.js'), 'window.testApp=true;');
  await fs.writeFile(path.join(assetsDir, 'app.css'), ':root{color:white}');
  await fs.writeFile(path.join(assetsDir, 'voice-demo.mp3'), Buffer.from('ID3-test-fixture'));
  let local = await createLocalTestServer({ port: 0, dataDir, assetsDir, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
  let token;
  async function refreshToken() { const html = await (await fetch(local.url)).text(); token = /name="jarvis-token" content="([a-f0-9]{64})"/.exec(html)?.[1]; assert.ok(token); }
  await refreshToken();
  t.after(async () => {
    await local.close();
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}jarvis-local-test-`));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return { get local() { return local; }, get token() { return token; }, dataDir,
    async post(method, value = null, overrides = {}) {
      return fetch(`${local.url}/api/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jarvis-Token': token, Origin: local.url, ...overrides }, body: JSON.stringify(value) });
    },
    async value(method, value = null) { const response = await this.post(method, value); assert.equal(response.status, 200, await response.clone().text()); return (await response.json()).result; },
    async restart() { await local.close(); local = await createLocalTestServer({ port: 0, dataDir, assetsDir, ...(fetchImpl ? { fetch: fetchImpl } : {}) }); await refreshToken(); },
  };
}

test('context HTTP reads configured weather without greeting, a voice key or provider speech calls', async t => {
  const calls = [];
  const f = await fixture(t, { config: { startupGreeting: false, weatherLocation: { name: 'Cidade de teste', latitude: 0, longitude: 0 } }, fetch: async url => {
    calls.push(url); assert.equal(new URL(url).hostname, 'api.open-meteo.com');
    const now = Math.floor(Date.now() / 1000);
    return Response.json({ current: { time: now, temperature_2m: 24, weather_code: 1 }, current_units: { temperature_2m: '°C' },
      daily: { time: [Math.floor(now / 86400) * 86400], temperature_2m_min: [20], temperature_2m_max: [27], precipitation_probability_max: [10] },
      daily_units: { temperature_2m_min: '°C', temperature_2m_max: '°C', precipitation_probability_max: '%' } });
  } });
  assert.equal((await f.post('readContext', { timezone: 'UTC', profileId: 'other' })).status, 400);
  assert.equal((await f.post('readContext', { timezone: 'UTC', endpoint: 'https://example.com' })).status, 400);
  assert.equal(calls.length, 0);
  const result = await f.value('readContext', { timezone: 'UTC' });
  assert.equal(result.weather.status, 'ok'); assert.equal(result.weather.weather.currentTemperature, 24);
  assert.equal(result.activity.status, 'ok'); assert.equal(result.activity.total, 0);
  assert.equal(result.sources.length, 2); assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(result).includes('latitude'), false);
  assert.equal(JSON.stringify(result).includes('audioBase64'), false);
  const again = await f.value('readContext', { timezone: 'UTC' });
  assert.equal(again.weather.cache.hit, true); assert.equal(calls.length, 1);
});

test('context HTTP cancellation aborts its source and cannot return a delayed result', async t => {
  let began;
  const started = new Promise(resolve => { began = resolve; });
  let sourceSignal;
  const f = await fixture(t, { config: { startupGreeting: false, weatherLocation: { name: 'Cidade de teste', latitude: 0, longitude: 0 } }, fetch: async (_url, options) => {
    sourceSignal = options.signal; began();
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('private-provider-detail')), { once: true }));
  } });
  const reading = f.post('readContext', { timezone: 'UTC' });
  await started;
  assert.deepEqual(await f.value('cancelContext'), { cancelled: true });
  const response = await reading; assert.equal(response.status, 400);
  assert.equal(sourceSignal.aborted, true);
  assert.equal((await response.text()).includes('private-provider-detail'), false);
  assert.deepEqual(await f.value('cancelContext'), { cancelled: false });
});

test('loopback serves only allowlisted assets and rejects Host, origin, CSRF and GET effects', async t => {
  const f = await fixture(t);
  const index = await fetch(f.local.url);
  const html = await index.text();
  assert.match(html, /test-bridge\.js/);
  assert.match(index.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(index.headers.get('access-control-allow-origin'), null);
  const voiceDemo = await fetch(`${f.local.url}/voice-demo.mp3`);
  assert.equal(voiceDemo.status, 200);
  assert.equal(voiceDemo.headers.get('content-type'), 'audio/mpeg');
  assert.equal(await voiceDemo.text(), 'ID3-test-fixture');
  for (const suffix of ['/settings.json', '/%2e%2e/package.json', '/package.json', '/node_modules/electron/index.js']) assert.equal((await fetch(f.local.url + suffix)).status, 404);
  assert.equal((await fetch(`${f.local.url}/api/memorySave`)).status, 405);
  assert.equal((await f.post('memorySave', { text: 'forbidden' }, { 'X-Jarvis-Token': '0'.repeat(64) })).status, 403);
  assert.equal((await f.post('memorySave', { text: 'forbidden' }, { Origin: 'https://evil.example' })).status, 403);
  const noOrigin = await fetch(`${f.local.url}/api/memorySave`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jarvis-Token': f.token }, body: '{"text":"forbidden"}' });
  assert.equal(noOrigin.status, 403);
  assert.equal((await f.post('constructor')).status, 404);
  assert.equal((await f.value('boot')).snapshot.memories.length, 0);
  const badHost = await new Promise((resolve, reject) => {
    const req = request(f.local.url, { headers: { Host: 'evil.example:1234' } }, res => { res.resume(); res.once('end', () => resolve(res.statusCode)); }); req.on('error', reject); req.end();
  });
  assert.equal(badHost, 403);
});

test('body limits, fixed workspace and unavailable native integrations are enforced', async t => {
  const f = await fixture(t);
  const large = await fetch(`${f.local.url}/api/boot`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jarvis-Token': f.token, Origin: f.local.url }, body: JSON.stringify('x'.repeat(3 * 1024 * 1024)) });
  assert.equal(large.status, 413);
  const boot = await f.value('boot');
  assert.equal(boot.capabilities.desktop, false);
  assert.equal(boot.capabilities.jarvisSpeech, true);
  assert.equal(boot.capabilities.startup, false);
  assert.equal(boot.capabilities.voiceWake, false);
  assert.equal(boot.settings.hasGreetingMusic, false);
  assert.equal(boot.settings.apps.length, 0);
  assert.equal(await f.value('chooseWorkspace'), path.join(f.dataDir, 'workspace'));
  assert.equal(await f.value('chooseApp'), null);
  const result = await f.value('callTool', { id: randomUUID(), runId: randomUUID(), profileId: boot.settings.profileId, name: 'apps_open', args: { appId: 'notepad' } });
  assert.equal(result.status, 'failed');
  assert.equal((await f.post('openExternal', 'https://example.com')).status, 400);
  assert.equal((await f.post('saveSettings', { workspaceRoot: 'C:\\private' })).status, 400);
  for(const method of ['wakeStart','wakeStop','chooseGreetingMusic'])assert.equal((await f.value(method)).reason,'requires_native_windows');
});

test('new standby settings remain boolean and cannot give the browser native capabilities',async t=>{
 const f=await fixture(t);
 const values={startAtLogin:true,standbyEnabled:true,wakeClapEnabled:false,wakeVoiceEnabled:false,greetingMusicEnabled:false};
 const saved=await f.value('saveSettings',values);
 for(const [key,value] of Object.entries(values)){assert.equal(saved[key],value);assert.equal((await f.post('saveSettings',{[key]:'true'})).status,400);}
 const boot=await f.value('boot');assert.equal(boot.capabilities.startup,false);assert.equal(boot.capabilities.voiceWake,false);
 assert.equal((await f.value('wakeStart')).running,false);
});

test('speech API uses the approved ElevenLabs voice, protects replay and never returns a key',async t=>{
 const calls=[],audio=Buffer.from('mock-bounded-mp3-response');
 const f=await fixture(t,{fetch:async(url,init)=>{calls.push({url,init});return new Response(audio,{headers:{'content-type':'audio/mpeg'}});}});
 const packet={profileId:'default',runId:'speech-http-run',utteranceId:'sentence-1',text:'A ação foi concluída.'};
 await f.value('saveSettings',{elevenVoiceId:'TestApprovedVoice',elevenApiKey:'test-only-private-speech-key',voice:'marin'});
 const result=await f.value('speak',packet);
 assert.equal(result.audioBase64,audio.toString('base64'));assert.equal(result.mime,'audio/mpeg');assert.equal(result.runId,packet.runId);
 assert.equal(calls.length,1);assert.match(calls[0].url,/^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/TestApprovedVoice\/stream/);
 const body=JSON.parse(calls[0].init.body);assert.equal(body.text,packet.text);assert.equal(body.model_id,'eleven_multilingual_v2');
 assert.equal(JSON.stringify(result).includes('test-only-private-speech-key'),false);
 assert.deepEqual(await f.value('speak',packet),result);assert.equal(calls.length,1);
 assert.equal((await f.post('speak',{...packet,text:'changed'})).status,400);
 assert.equal(await f.value('cancelSpeech',{runId:packet.runId}),true);
 assert.equal((await f.post('speak',{...packet,utteranceId:'sentence-2'})).status,400);assert.equal(calls.length,1);
 assert.equal((await f.post('speak',{...packet,profileId:'another'})).status,400);
 assert.equal((await f.post('cancelSpeech',{runId:packet.runId,profileId:'another'})).status,400);
});

test('profile changes abort pending speech and discard provider audio without leaking internal failures',async t=>{
 let began,providerSignal;const started=new Promise(resolve=>{began=resolve;});
 const f=await fixture(t,{fetch:async(url,init)=>{providerSignal=init.signal;began();return new Promise(()=>{});}});
 await f.value('saveSettings',{elevenVoiceId:'TestApprovedVoice',elevenApiKey:'test-only-private-speech-key'});
 const pending=f.post('speak',{profileId:'default',runId:'pending-speech',utteranceId:'sentence-1',text:'Fala pendente.'});
 const deadline=setTimeout(()=>began(),5000);t.after(()=>clearTimeout(deadline));await started;assert.ok(providerSignal);
 await f.value('saveSettings',{profileId:'second'});
 const response=await pending;assert.equal(response.status,400);assert.equal(providerSignal.aborted,true);
 const error=await response.text();assert.match(error,/interrompida/i);assert.equal(error.includes('test-only-private-speech-key'),false);
 assert.equal((await f.post('speak',{profileId:'default',runId:'stale-speech',utteranceId:'sentence-1',text:'Perfil antigo.'})).status,400);
});

test('missing approved voice blocks realtime before any provider request and speech fails safely without fallback',async t=>{
 const calls=[];const f=await fixture(t,{fetch:async(url)=>{calls.push(url);throw new Error('private-provider-message-must-not-leak');}});
 await f.value('saveSettings',{apiKey:'test-openai-key',elevenVoiceId:''});
 const realtime=await f.post('realtimeSession',{profileId:'default',sdp:'v=0\r\n'});assert.equal(realtime.status,400);assert.match(await realtime.text(),/voz Jarvis/);
 const noVoice=await f.post('speak',{profileId:'default',runId:'missing-voice',utteranceId:'sentence-1',text:'Resposta em texto.'});assert.equal(noVoice.status,400);assert.match(await noVoice.text(),/voz Jarvis/);assert.equal(calls.length,0);
 await f.value('saveSettings',{elevenApiKey:'test-only-eleven-key',elevenVoiceId:'TestApprovedVoice'});
 const failure=await f.post('speak',{profileId:'default',runId:'failed-provider',utteranceId:'sentence-1',text:'Resposta em texto.'});assert.equal(failure.status,400);
 const message=await failure.text();assert.equal(message.includes('private-provider-message'),false);assert.match(message,/resposta continua disponível em texto/);
 assert.equal(calls.length,1);assert.match(calls[0],/^https:\/\/api\.elevenlabs\.io\//);
});

test('private greeting music has a fixed protected route, validated MIME and no public source path',async t=>{
 const f=await fixture(t),headers={'X-Jarvis-Token':f.token};
 assert.equal((await fetch(f.local.url+'/greeting-music')).status,403);
 assert.equal((await fetch(f.local.url+'/greeting-music',{headers})).status,404);
 const bytes=Buffer.alloc(48);bytes.write('RIFF');bytes.writeUInt32LE(40,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(4,40);
 const selected=path.join(f.dataDir,'temporary-selected.wav');await fs.writeFile(selected,bytes);await new GreetingMusicStore({dataDir:f.dataDir}).importFile(selected);await fs.unlink(selected);
 assert.equal((await f.value('boot')).settings.hasGreetingMusic,true);
 const served=await fetch(f.local.url+'/greeting-music',{headers});assert.equal(served.status,200);assert.equal(served.headers.get('content-type'),'audio/wav');assert.equal(served.headers.get('cache-control'),'no-store');assert.equal(served.headers.get('cross-origin-resource-policy'),'same-origin');assert.deepEqual(Buffer.from(await served.arrayBuffer()),bytes);
 assert.equal((await fetch(f.local.url+'/greeting-music',{headers:{'Sec-Fetch-Site':'same-origin'}})).status,200);
 assert.equal((await fetch(f.local.url+'/greeting-music',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
 assert.equal((await fetch(f.local.url+'/greeting-music',{headers:{...headers,'Sec-Fetch-Site':'cross-site'}})).status,403);
 assert.equal((await fetch(f.local.url+'/greeting-music?path=temporary-selected.wav',{headers})).status,404);
 assert.equal((await fetch(f.local.url+'/greeting-music.json',{headers})).status,404);
 await fs.writeFile(path.join(f.dataDir,'greeting-music.audio'),Buffer.alloc(48));assert.equal((await fetch(f.local.url+'/greeting-music',{headers})).status,404);
});

test('settings and keys remain in memory while saved memories remain isolated across profiles and restart', async t => {
  const f = await fixture(t);
  const secret = `test-only-secret-${randomUUID()}`;
  const elevenSecret = `test-only-eleven-secret-${randomUUID()}`;
  const saved = await f.value('saveSettings', { profileId: 'alice', apiKey: secret, elevenApiKey: elevenSecret, textModel: 'test-model' });
  assert.equal(saved.hasKey, true);
  assert.equal(saved.hasElevenKey, true);
  assert.equal(JSON.stringify(saved).includes(secret), false);
  assert.equal(JSON.stringify(saved).includes(elevenSecret), false);
  await f.value('memorySave', { profileId: 'alice', text: 'Alice memory' });
  const alice = await f.value('boot');
  assert.equal(alice.snapshot.memories[0].text, 'Alice memory');
  assert.equal(JSON.stringify(alice).includes(secret), false);
  assert.equal(JSON.stringify(alice).includes(elevenSecret), false);
  await f.value('saveSettings', { profileId: 'bob' });
  assert.equal((await f.value('boot')).snapshot.memories.length, 0);
  assert.equal((await f.post('memorySave', { profileId: 'alice', text: 'cross-profile' })).status, 400);
  const entries = await fs.readdir(f.dataDir, { recursive: true });
  for (const name of entries) {
    const file = path.join(f.dataDir, name);
    if ((await fs.lstat(file)).isFile()) {
      const bytes = await fs.readFile(file);
      assert.equal(bytes.includes(Buffer.from(secret)), false, `Key retained in ${name}`);
      assert.equal(bytes.includes(Buffer.from(elevenSecret)), false, `ElevenLabs key retained in ${name}`);
    }
  }
  await f.restart();
  const restarted = await f.value('boot');
  assert.equal(restarted.settings.profileId, 'default');
  assert.equal(restarted.settings.textModel === 'test-model', false);
  assert.equal(restarted.settings.hasKey, Boolean(process.env.OPENAI_API_KEY));
  assert.equal(restarted.settings.hasElevenKey, Boolean(process.env.ELEVENLABS_API_KEY));
  await f.value('saveSettings', { profileId: 'alice' });
  assert.equal((await f.value('boot')).snapshot.memories[0].text, 'Alice memory');
});

test('startup greeting validates its fixed inputs and returns useful text without an ElevenLabs voice setup', async t => {
  const f = await fixture(t);
  await f.value('saveSettings', { startupGreeting: true, weatherLocation: null, elevenVoiceId: '' });
  for (const input of [{ hour: -1 }, { hour: 24 }, { hour: 1.5 }, { hour: 9, timezone: 'not/a/timezone' }, { hour: 9, timezone: '+01:00' }, { hour: 9, text: 'arbitrary text must not reach synthesis' }]) assert.equal((await f.post('startupGreeting', input)).status, 400);
  const greeting = await f.value('startupGreeting', { hour: 9, timezone: 'America/New_York' });
  assert.match(greeting.text, /Bom dia/i);
  assert.equal(greeting.audioBase64, null);
  assert.equal(greeting.mime, 'audio/mpeg');
  assert.equal(greeting.weatherStatus, 'not_configured');
  assert.ok(['requires_key', 'requires_voice'].includes(greeting.reason));
  assert.equal((await f.post('startupGreeting', { hour: 9 })).status, 429);
  await f.value('saveSettings', { startupGreeting: true });
  assert.equal((await f.post('startupGreeting', { hour: 9 })).status, 429, 'saving settings does not reset the per-profile rate limit');
  await f.value('saveSettings', { profileId: 'other-greeting-profile' });
  assert.match((await f.value('startupGreeting', { hour: 16 })).text, /Boa tarde/i);
  await f.value('saveSettings', { startupGreeting: false });
  const disabled = await f.value('startupGreeting', { hour: 16 });
  assert.equal(disabled.skipped, true);
  assert.equal(disabled.reason, 'disabled');
});

test('private local config loads only validated non-secret greeting settings', async t => {
  const location = { name: 'Example City', latitude: 1.5, longitude: -2.5 };
  const f = await fixture(t, { config: { startupGreeting: false, weatherLocation: location, elevenVoiceId: 'ExampleVoice123', apiKey: 'must-not-load', elevenApiKey: 'must-not-load-eleven', workspaceRoot: 'C:\\not-allowed' } });
  const boot = await f.value('boot');
  assert.deepEqual(boot.settings.weatherLocation, location);
  assert.equal(boot.settings.elevenVoiceId, 'ExampleVoice123');
  assert.equal(boot.settings.startupGreeting, false);
  assert.equal(boot.settings.hasKey, Boolean(process.env.OPENAI_API_KEY));
  assert.equal(boot.settings.hasElevenKey, Boolean(process.env.ELEVENLABS_API_KEY));
  assert.equal(boot.settings.workspaceRoot, path.join(f.dataDir, 'workspace'));
  assert.equal(JSON.stringify(boot).includes('must-not-load'), false);
});

test('cancelling a pending greeting rejects late audio and releases its flight without resetting rate limits',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-18T15:00:00Z')});
 let began,releaseLate,providerSignal,calls=0;const started=new Promise(resolve=>{began=resolve;});
 const f=await fixture(t,{fetch:async(url,init)=>{
  calls++;if(calls===1){providerSignal=init.signal;began();return new Promise(resolve=>{releaseLate=resolve;});}
  return new Response(Buffer.from('second-greeting-audio'),{headers:{'content-type':'audio/mpeg'}});
 }});
 await f.value('saveSettings',{startupGreeting:true,weatherLocation:null,elevenVoiceId:'TestApprovedVoice',elevenApiKey:'test-only-greeting-key'});
 assert.deepEqual(await f.value('cancelGreeting'),{cancelled:false});
 const pending=f.post('startupGreeting',{hour:9,timezone:'America/New_York'});
 const deadline=setTimeout(()=>began(),5000);t.after(()=>clearTimeout(deadline));await started;assert.ok(providerSignal);
 assert.deepEqual(await f.value('cancelGreeting'),{cancelled:true});assert.equal(providerSignal.aborted,true);
 releaseLate(new Response(Buffer.from('must-not-reach-renderer'),{headers:{'content-type':'audio/mpeg'}}));
 const response=await pending;assert.equal(response.status,400);const cancelled=await response.json();assert.match(cancelled.error,/interrompida/);assert.equal(JSON.stringify(cancelled).includes('audioBase64'),false);
 assert.deepEqual(await f.value('cancelGreeting'),{cancelled:false});
 assert.equal((await f.post('startupGreeting',{hour:9})).status,429);assert.equal(calls,1);
 t.mock.timers.tick(60_001);
 const next=await f.value('startupGreeting',{hour:9});assert.equal(next.audioBase64,Buffer.from('second-greeting-audio').toString('base64'));assert.equal(calls,2);
});

test('protected event stream carries a real approval and approved dictation writes only inside demo workspace', async t => {
  const f = await fixture(t), controller = new AbortController();
  assert.equal((await fetch(`${f.local.url}/events`)).status, 403);
  const stream = await fetch(`${f.local.url}/events`, { headers: { 'X-Jarvis-Token': f.token }, signal: controller.signal });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  t.after(() => { controller.abort(); });
  const boot = await f.value('boot');
  const pending = f.value('callTool', { id: randomUUID(), runId: randomUUID(), profileId: boot.settings.profileId, name: 'notes_dictate', args: { text: 'Approved local note' } });
  let buffer = '', approval;
  const decoder = new TextDecoder();
  const deadline = setTimeout(() => controller.abort(), 5000);
  try {
    while (!approval) {
      const chunk = await reader.read(); assert.equal(chunk.done, false); buffer += decoder.decode(chunk.value, { stream: true });
      for (const line of buffer.split('\n')) if (line.startsWith('data: ')) { try { const event = JSON.parse(line.slice(6)); if (event.type === 'approval') approval = event; } catch {} }
    }
    assert.equal(approval.details.text, 'Approved local note');
    assert.equal(await f.value('approve', { approvalId: approval.approvalId, allow: true }), true);
    const result = await pending;
    assert.equal(result.status, 'verified');
    assert.equal(await fs.readFile(path.join(f.dataDir, 'workspace', result.data.path), 'utf8'), 'Approved local note\n');
  } finally { clearTimeout(deadline); controller.abort(); await reader.cancel().catch(() => {}); }
});
