import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.JARVIS_PYTHON ?? 'python';
const probe = spawnSync(python, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 10_000 });
const available = !probe.error && probe.status === 0;

test('optional Python vision protocol and preprocessing contracts', { skip: available ? false : 'Python opcional ausente; configure JARVIS_PYTHON para validar o worker.' }, () => {
  const result = spawnSync(python, ['-I', '-B', '-m', 'unittest', 'discover', '-s', 'services/vision', '-p', 'test_*.py'], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30_000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('worker --status keeps missing models optional and returns JSON without an open camera', { skip: !available }, () => {
  const result = spawnSync(python, ['-I', path.join(root, 'services/vision/worker.py'), '--models-dir', path.join(root, 'not-installed-models'), '--status'], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30_000,
  });
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout.trim());
  assert.equal(status.ok, true);
  assert.equal(status.available, false);
  assert.equal(status.reason.code, 'models_unavailable');
});
