import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const model = `import * as THREE from 'three';
const world = new THREE.Group();
const g = new THREE.Group();
g.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)));
world.add(g);
export const MODEL = { world, PARTS: [{ key: 'box', name: 'box', g }] };
`;

function fixture(t, items = ['ok']) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mechbench-gate-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'tools'));
  fs.mkdirSync(path.join(dir, 'items'));
  fs.mkdirSync(path.join(dir, 'vendor'));
  fs.copyFileSync(path.join(root, 'tools/interference.mjs'), path.join(dir, 'tools/interference.mjs'));
  fs.copyFileSync(path.join(root, 'vendor/three.module.js'), path.join(dir, 'vendor/three.module.js'));
  for (const slug of items) {
    fs.mkdirSync(path.join(dir, 'items', slug));
    fs.writeFileSync(path.join(dir, 'items', slug, 'model.mjs'), slug === 'broken' ? 'throw new Error("fixture import failure");' : model);
  }
  const baselineFile = path.join(dir, 'tools/interference.baseline.json');
  fs.writeFileSync(baselineFile, JSON.stringify({ ok: { 'old~pair': 1.2 }, untouched: { 'a~b': 2.4 } }) + '\n');
  return {
    dir, baselineFile,
    run: (...args) => spawnSync(process.execPath, [path.join(dir, 'tools/interference.mjs'), ...args], { encoding: 'utf8' }),
  };
}

test('missing model fails gate and leaves baseline byte-identical', (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.baselineFile, 'utf8');
  const result = f.run('__qa_missing_model__', '--gate', '--baseline');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /探测未完成/);
  assert.doesNotMatch(result.stdout, /gate 通过|全部物品未发现/);
  assert.equal(fs.readFileSync(f.baselineFile, 'utf8'), before);
});

test('partial scan failure blocks full baseline write', (t) => {
  const f = fixture(t, ['ok', 'broken']);
  const before = fs.readFileSync(f.baselineFile, 'utf8');
  const result = f.run('--baseline');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /成功 1 件，失败 1 件/);
  assert.equal(fs.readFileSync(f.baselineFile, 'utf8'), before);
});

test('single item baseline write preserves other items', (t) => {
  const f = fixture(t);
  const result = f.run('ok', '--baseline');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.baselineFile)), { ok: {}, untouched: { 'a~b': 2.4 } });
});

test('successful full scan replaces obsolete baseline items', (t) => {
  const f = fixture(t);
  const result = f.run('--baseline');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.baselineFile)), { ok: {} });
});

test('empty scan fails without replacing baseline', (t) => {
  const f = fixture(t, []);
  const before = fs.readFileSync(f.baselineFile, 'utf8');
  const result = f.run('--gate', '--baseline');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(fs.readFileSync(f.baselineFile, 'utf8'), before);
});

test('clean single item gate accepts eliminated findings without updating baseline', (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.baselineFile, 'utf8');
  const result = f.run('ok', '--gate');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /gate 通过/);
  assert.equal(fs.readFileSync(f.baselineFile, 'utf8'), before);
});

test('failed gate cannot overwrite baseline when both flags supplied', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.dir, 'tools/interference.ignore.json'), JSON.stringify({ ok: [{ pair: 'missing~pair', kind: 'test', reason: 'stale fixture' }] }));
  const before = fs.readFileSync(f.baselineFile, 'utf8');
  const result = f.run('ok', '--gate', '--baseline');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(fs.readFileSync(f.baselineFile, 'utf8'), before);
});
