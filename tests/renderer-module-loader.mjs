import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
const cache = new Map();
export function loadRendererModule(name) {
  const file = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/desktop/renderer', name);
  return load(file);
}
function load(file) {
  if (!extname(file)) file += existsSync(file + '.ts') ? '.ts' : '.tsx';
  if (cache.has(file)) return cache.get(file).exports;
  const compiled = { exports: {} }; cache.set(file, compiled);
  const { code } = transformSync(readFileSync(file, 'utf8'), { loader: file.endsWith('.tsx') ? 'tsx' : 'ts', format: 'cjs', target: 'node24', jsx: 'automatic' });
  const localRequire = name => name.startsWith('.') ? load(resolve(dirname(file), name)) : require(name);
  new Function('require', 'module', 'exports', code)(localRequire, compiled, compiled.exports);
  return compiled.exports;
}
