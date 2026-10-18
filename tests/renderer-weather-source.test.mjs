import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transform } from 'esbuild';
import { WEATHER_ATTRIBUTION } from '../packages/greeting/index.mjs';

// Compile the actual renderer component in memory; no browser, API key or network.
const source = await readFile(new URL('../apps/desktop/renderer/weather-source.tsx', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'tsx', format: 'cjs', target: 'node24', jsx: 'automatic' });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', code)(createRequire(import.meta.url), compiled, compiled.exports);
const { WeatherSource, normalizeWeatherSource } = compiled.exports;
const render = value => renderToStaticMarkup(React.createElement(WeatherSource, { source: value }));

test('weather attribution returned by the real greeting service renders without crashing React', () => {
  let markup;
  assert.doesNotThrow(() => { markup = render(WEATHER_ATTRIBUTION); });
  assert.match(markup, /Fonte do tempo/);
  assert.match(markup, /Open-Meteo/);
  assert.match(markup, /CC BY 4\.0/);
  assert.match(markup, /href="https:\/\/open-meteo\.com\/"/);
  assert.match(markup, /href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"/);
  assert.ok(markup.includes('resumidos em português'));
});

test('legacy string attribution renders as escaped text', () => {
  assert.match(render('Open-Meteo · CC BY 4.0'), /Open-Meteo · CC BY 4\.0/);
  const markup = render('<img src=x onerror=alert(1)>');
  assert.ok(markup.includes('&lt;img'));
  assert.equal(markup.includes('<img'), false);
});

test('missing or malformed attribution cannot become an object React child', () => {
  for (const value of [undefined, null, '', [], { name: {} }, { text: { nested: true } }, 42]) assert.equal(render(value), '');
  assert.doesNotThrow(() => render({ name: 'Open-Meteo', text: { nested: true }, license: ['bad'] }));
});

test('source and license links accept only their expected HTTPS hosts', () => {
  const normalized = normalizeWeatherSource({ name: 'Open-Meteo', url: 'javascript:alert(1)', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org.evil.example/' });
  assert.equal(normalized.url, undefined);
  assert.equal(normalized.licenseUrl, undefined);
  const markup = render({ name: 'Open-Meteo', url: 'https://user:secret@open-meteo.com/' });
  assert.equal(markup.includes('href='), false);
  assert.equal(markup.includes('secret'), false);
});
