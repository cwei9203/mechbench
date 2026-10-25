#!/usr/bin/env node
/* mechbench · 几何自检的公共底座
 *
 * 三个物品各自手写过的样板（临时文件改 three 路径、DOM 桩、Box3/射线/顶点半径工具、
 * 汇总打印）都收在这里。物品的 check-geometry.mjs 只留"这台机器必须成立的物理事实"。
 *
 * 模型来自 dist/<slug>.logic.mjs（build.py 生成），所以先构建再跑。
 *
 * 用法（在物品里）：
 *   import { runGeom } from '../../tools/geom.mjs';
 *   await runGeom('injection-pen', ({ MODEL, THREE, g, need, near }) => { ... });
 */
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function runGeom(slug, fn) {
  const file = join(ROOT, 'dist', `${slug}.logic.mjs`);
  if (!existsSync(file)) {
    console.error(`缺 dist/${slug}.logic.mjs → 先跑 python3 tools/build.py ${slug}`);
    process.exit(2);
  }
  const ns = await import(pathToFileURL(file).href + '?t=' + Date.now());
  const { MODEL, MANIFEST, THREE } = ns;
  if (!MODEL) {
    console.error(`${slug} 没有 MODEL（二维物品），没有几何可查`);
    process.exit(2);
  }

  const ok = [], bad = [];
  const need = (cond, msg) => (cond ? ok : bad).push(msg);
  const round = (v) => Math.round(v * 100) / 100;
  const r2 = round;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const near = (a, b, tol, msg) => need(Math.abs(a - b) <= tol, `${msg}（${r2(a)} vs ${r2(b)}）`);

  /* 参数既可以是零件对象（{g}）也可以是裸 Object3D */
  const target = (o) => (o && o.g && o.g.isObject3D ? o.g : o);
  const part = (k) => MODEL.byKey.get(k);
  const meshesOf = (o) => { const out = []; target(o).traverse((m) => { if (m.isMesh) out.push(m); }); return out; };
  const sync = () => MODEL.world.updateMatrixWorld(true);
  const boxOf = (o) => { sync(); return new THREE.Box3().setFromObject(target(o)); };
  const groupBox = (k) => boxOf(part(k));
  const apply = (view, state) => { MODEL.applyMotion(view || { cut: false }, state); sync(); };

  const verts = (o) => {
    sync();
    const out = [];
    const v = new THREE.Vector3();
    for (const m of meshesOf(o)) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        out.push([v.x, v.y, v.z]);
      }
    }
    return out;
  };
  const radiusOf = ([, y, z]) => Math.hypot(y, z);            // 绕 x 轴的半径
  const angleOf = ([, y, z]) => (Math.atan2(y, z) * 180) / Math.PI;   // 0° = +Z，向 +Y 为正
  const maxR = (o, filt = () => true) => Math.max(...verts(o).filter(filt).map(radiusOf));
  const minR = (o, filt = () => true) => Math.min(...verts(o).filter(filt).map(radiusOf));

  /* 沿 x 轴打一条平行射线，回来的是命中点的 x */
  const shoot = (key, fromX, dir, y = 0.5, z = 0) => {
    sync();
    const rc = new THREE.Raycaster(new THREE.Vector3(fromX, y, z), new THREE.Vector3(dir, 0, 0));
    return rc.intersectObjects(meshesOf(part(key)), false).map((h) => h.point.x);
  };

  /* 双面射线：用于"孔真的通"— 用副本网格 + DoubleSide，背光面也算命中 */
  const rayMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const hitsBoth = (o, origin, dir, far = 400) => {
    sync();
    const copies = meshesOf(o).map((x) => {
      const m = new THREE.Mesh(x.geometry, rayMat);
      m.matrixAutoUpdate = false;
      m.matrix.copy(x.matrixWorld);
      m.updateMatrixWorld(true);
      return m;
    });
    const rc = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...dir).normalize(), 0, far);
    return rc.intersectObjects(copies, false);
  };

  const g = {
    MODEL, MANIFEST, THREE, part, target, meshesOf, sync, boxOf, groupBox, apply,
    verts, radiusOf, angleOf, maxR, minR, shoot, hitsBoth, round, r2, r3, near,
  };

  try {
    await fn({ MODEL, MANIFEST, THREE, g, need, near, r2, r3, round, ok, bad });
  } catch (e) {
    bad.push('几何自检抛错：' + (e.stack || e.message));
  }

  for (const m of ok) console.log('  ✓ ' + m);
  for (const m of bad) console.log('  ✗ ' + m);
  console.log(bad.length
    ? `\n✗ ${slug} 几何自检未通过（${bad.length} 项）`
    : `\n✓ ${slug} 几何自检通过（${ok.length} 项）`);
  process.exit(bad.length ? 1 : 0);
}
