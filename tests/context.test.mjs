import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextService, ContextError } from '../packages/context/index.mjs';
import { StartupGreetingService } from '../packages/greeting/index.mjs';

const NOW = new Date('2026-10-20T14:00:00Z');
const task = (runId, status = 'completed', extra = {}) => ({ runId, status, tool: 'apps_open', updatedAt: NOW.toISOString(), ...extra });
const missingWeather = () => ({ status: 'not_configured', timezone: 'UTC', locationLabel: '', weather: null, attribution: null, fetchedAt: null,
  cache: { hit: false, expiresAt: null } });
function fixture({ readWeather = async () => missingWeather(), getSnapshot = () => ({ tasks: [] }), getProfileId = () => 'default', ...options } = {}) {
  return new ContextService({ weather: { readWeather }, getSnapshot, getProfileId, now: () => new Date(NOW), ...options });
}

test('context contains only observed weather and local execution history, without fabricated calendar or mail connections', async () => {
  let weatherRequests = 0, profile;
  const weather = new StartupGreetingService({ getSettings: () => ({ startupGreeting: false, weatherLocation: { name: 'Cidade de teste', latitude: 10, longitude: 20 } }),
    getKey: () => { assert.fail('context must not read the voice key'); }, now: () => new Date(NOW),
    fetch: async () => { weatherRequests++; return Response.json({ current_units: { temperature_2m: '°C' }, daily_units: { temperature_2m_min: '°C', temperature_2m_max: '°C', precipitation_probability_max: '%' },
      current: { time: NOW.getTime() / 1000, temperature_2m: 25, weather_code: 0 }, daily: { time: [Date.parse('2026-10-20T00:00:00Z') / 1000],
        temperature_2m_min: [19], temperature_2m_max: [29], precipitation_probability_max: [10] } }); } });
  const service = new ContextService({ weather, getProfileId: () => 'trusted-profile', getSnapshot: id => {
    profile = id; return { tasks: [task('run-1', 'completed'), task('run-2', 'awaiting_approval')],
      memories: [{ text: 'private-memory' }], procedures: [{ body: 'private-procedure' }] };
  }, now: () => new Date(NOW) });
  const result = await service.read({ timezone: 'UTC' });
  assert.equal(profile, 'trusted-profile'); assert.equal(weatherRequests, 1);
  assert.equal(result.generatedAt, NOW.getTime()); assert.equal(result.weather.status, 'ok');
  assert.equal(result.weather.weather.currentTemperature, 25); assert.equal(result.activity.status, 'ok');
  assert.equal(result.activity.total, 2); assert.equal(result.activity.counts.completed, 1); assert.equal(result.activity.counts.awaitingApproval, 1);
  assert.deepEqual(result.sources.map(source => source.id), ['weather', 'local_activity']);
  assert.equal(result.sources[0].attribution.name, 'Open-Meteo');
  const output = JSON.stringify(result);
  for (const secret of ['private-memory', 'private-procedure', 'latitude', 'longitude', 'audioBase64', 'calendar', 'email']) assert.equal(output.includes(secret), false);
});

test('task context is bounded, separates statuses and omits arguments, summaries, absolute paths and unknown tools', async () => {
  const tasks = Array.from({ length: 110 }, (_, index) => task(`run-${index}`, index % 2 === 0 ? 'failed' : 'running', {
    args: { text: 'private-dictation' }, summary: 'private-summary', steps: [{ source: 'C:/private/file' }],
  }));
  tasks[0].tool = 'private-tool-secret';
  const result = await fixture({ getSnapshot: () => ({ tasks }) }).read({ timezone: 'UTC' });
  assert.equal(result.activity.total, 100); assert.equal(result.activity.observedCount, 100); assert.equal(result.activity.limit, 100);
  assert.equal(result.activity.tasks.length, 8); assert.equal(result.activity.truncated, true);
  assert.equal(result.activity.counts.failed, 50); assert.equal(result.activity.counts.running, 50);
  assert.equal(result.activity.tasks[0].tool, undefined);
  for (const entry of result.activity.tasks) assert.ok(Object.keys(entry).every(key => ['runId', 'status', 'tool', 'updatedAt'].includes(key)));
  assert.equal(JSON.stringify(result).includes('private-'), false);
});

test('malformed and future task records are not presented as facts', async () => {
  const tasks = [task('good'), task('bad-state', 'meeting'), task('bad-time', 'completed', { updatedAt: 'never' }),
    task('future', 'completed', { updatedAt: '2030-01-01T00:00:00Z' }), task('bad\nID'), null];
  const result = await fixture({ getSnapshot: () => ({ tasks }) }).read({ timezone: 'UTC' });
  assert.equal(result.activity.total, 1); assert.equal(result.activity.tasks[0].runId, 'good');
  assert.equal(result.activity.counts.completed, 1);
});

test('each source can fail or time out independently without hiding the other source or leaking error details', async t => {
  await t.test('weather timeout preserves local observation', async () => {
    const result = await fixture({ readWeather: async () => new Promise(() => {}), weatherTimeoutMs: 10,
      getSnapshot: () => ({ tasks: [task('local-ok')] }) }).read({ timezone: 'UTC' });
    assert.equal(result.weather.status, 'unavailable'); assert.equal(result.weather.weather, null);
    assert.equal(result.activity.status, 'ok'); assert.equal(result.activity.total, 1);
    assert.equal(result.sources[0].observedAt, null);
  });
  await t.test('local timeout preserves weather configuration state', async () => {
    const result = await fixture({ getSnapshot: async () => new Promise(() => {}), snapshotTimeoutMs: 10 }).read({ timezone: 'UTC' });
    assert.equal(result.weather.status, 'not_configured'); assert.equal(result.activity.status, 'unavailable');
    assert.equal(result.activity.total, 0); assert.equal(result.sources[1].observedAt, null);
  });
  await t.test('source errors have fixed states without provider text', async () => {
    const result = await fixture({ readWeather: async () => { throw new Error('private-provider-key'); },
      getSnapshot: () => { throw new Error('private-database-path'); } }).read({ timezone: 'UTC' });
    assert.equal(result.weather.status, 'unavailable'); assert.equal(result.activity.status, 'unavailable');
    assert.equal(JSON.stringify(result).includes('private-'), false);
  });
});

test('renderer input cannot select another profile or arbitrary source and is rejected before either read', async () => {
  let reads = 0;
  const service = fixture({ readWeather: async () => { reads++; return missingWeather(); }, getSnapshot: () => { reads++; return { tasks: [] }; } });
  for (const input of [null, [], { profileId: 'someone-else' }, { timezone: 'UTC', source: 'http://localhost/' }, { timezone: 'invalid-timezone' }]) {
    await assert.rejects(service.read(input), error => error instanceof ContextError && error.code === 'invalid_input');
  }
  assert.equal(reads, 0);
});

test('cancellation rejects promptly and late completion does not deliver a result', async () => {
  let entered, finish;
  const started = new Promise(resolve => { entered = resolve; });
  let delivered = false;
  const service = fixture({ readWeather: async () => { entered(); return new Promise(resolve => { finish = resolve; }); } });
  const controller = new AbortController();
  const pending = service.read({ timezone: 'UTC' }, { signal: controller.signal }).then(result => { delivered = true; return result; });
  await started; controller.abort();
  await assert.rejects(pending, error => error instanceof ContextError && error.code === 'cancelled');
  finish(missingWeather()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(delivered, false);
});

test('profile changes while weather loads discard the old profile observation', async () => {
  let profile = 'first', finish, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const observedProfiles = [];
  const service = fixture({ getProfileId: () => profile, getSnapshot: id => { observedProfiles.push(id); return { tasks: [task(`run-${id}`)] }; },
    readWeather: async () => { entered(); return new Promise(resolve => { finish = resolve; }); } });
  const pending = service.read({ timezone: 'UTC' });
  await started; profile = 'second'; finish(missingWeather());
  await assert.rejects(pending, { code: 'profile_changed' });
  assert.deepEqual(observedProfiles, ['first']);
});

test('context has no memory of a previous profile snapshot', async () => {
  let profile = 'first';
  const service = fixture({ getProfileId: () => profile, getSnapshot: id => ({ tasks: id === 'first' ? [task('private-first-run')] : [] }) });
  const first = await service.read({ timezone: 'UTC' });
  assert.equal(first.activity.total, 1);
  profile = 'second'; const second = await service.read({ timezone: 'UTC' });
  assert.equal(second.activity.total, 0); assert.equal(JSON.stringify(second).includes('private-first-run'), false);
});

test('aborted reads and invalid trusted clock/profile values never start external sources', async () => {
  let calls = 0;
  const readWeather = async () => { calls++; return missingWeather(); };
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fixture({ readWeather }).read({ timezone: 'UTC' }, { signal: controller.signal }), { code: 'cancelled' });
  await assert.rejects(fixture({ readWeather, getProfileId: () => '../private' }).read({ timezone: 'UTC' }), { code: 'invalid_input' });
  await assert.rejects(fixture({ readWeather, now: () => new Date('bad') }).read({ timezone: 'UTC' }), { code: 'invalid_input' });
  assert.equal(calls, 0);
});
