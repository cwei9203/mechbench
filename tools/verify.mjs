#!/usr/bin/env node
/* mechbench · 无浏览器断言（node 直接跑，毫秒级）
 *
 * 读 dist/<slug>.logic.mjs（tools/build.py 生成：model + manifest + logic 三个纯模块），做两组检查：
 *   静态：manifest × model 交叉一致性。零件归属、读数 key、取景名、实验控件是否自洽。
 *   行为：items/<slug>/logic.spec.mjs 的断言（可选）。装配顺序 / 剂量 / 传动比 / 失败不动状态。
 *
 * 与 accept.mjs 的分工：accept 回答"页面能不能用"（布局、交互、像素），这里回答
 * "规则和几何对不对"。这里能跑的不该再写进 accept。
 *
 * 用法：
 *   node tools/verify.mjs injection-pen      # 一个物品
 *   node tools/verify.mjs all                 # items/ 下全部
 *   node tools/verify.mjs injection-pen --static   # 只跑静态检查（build.py 用）
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_ONLY = process.argv.includes('--static');

const ok = [];
const bad = [];
const need = (cond, msg) => (cond ? ok : bad).push(msg);

/* ---------------- 静态：manifest × model ---------------- */
function staticChecks(slug, ns) {
  const { MANIFEST, MODEL } = ns;
  need(!!MANIFEST, 'MANIFEST 导出存在');
  if (!MANIFEST) return;
  need(MANIFEST.slug === slug, `MANIFEST.slug 与目录名一致（${MANIFEST.slug}）`);
  need(!!MANIFEST.brand?.title, 'brand.title 非空');
  need(!!MANIFEST.stage?.title, 'stage.title 非空');

  const chs = MANIFEST.chapters || [];
  const mods = MANIFEST.modules || [];
  need(chs.length >= 1, `关卡 ${chs.length} 关`);
  need(mods.length >= 1, `模块 ${mods.length} 块`);

  for (let i = 0; i < chs.length; i++) {
    const c = chs[i];
    const t = MANIFEST.tasks?.[i] || c;
    need(!!c.title, `第 ${i + 1} 关有 title`);
    need(mods.some((m) => m.chapter === i), `第 ${i + 1} 关有模块`);
    need(!!(t.exp && t.expText && t.q && t.options?.length && Number.isInteger(t.a)), `第 ${i + 1} 关实验/题目齐全`);
    need(!!(t.options?.length > t.a), `第 ${i + 1} 关正确答案下标在范围内`);
  }

  const ids = new Set();
  for (const m of mods) {
    need(!ids.has(m.id), `模块 id 唯一：${m.id}`);
    ids.add(m.id);
    need(Number.isInteger(m.chapter) && m.chapter >= 0 && m.chapter < chs.length, `模块 ${m.id} 的 chapter 在范围内`);
    need(Array.isArray(m.parts) && m.parts.length > 0, `模块 ${m.id} 有 parts`);
    need(!!m.name, `模块 ${m.id} 有 name`);
  }

  const rk = new Set();
  for (const r of MANIFEST.readout || []) {
    need(!rk.has(r.key), `读数 key 唯一：${r.key}`);
    rk.add(r.key);
    need(!!r.label, `读数 ${r.key} 有 label`);
  }
  need((MANIFEST.readout || []).length >= 1, '至少一行读数');

  for (const x of MANIFEST.experiments || []) {
    need(!!x.id && !!x.label, `实验控件有 id/label：${x.id}`);
    need(['slider', 'toggle', 'button'].includes(x.control), `实验 ${x.id} 的 control 合法`);
    if (x.control === 'slider') need(Number(x.max) > Number(x.min), `实验 ${x.id} 有量程`);
  }

  // 约定：有 logic.mjs 就必须导出 createGame()，verify/spec 靠它把游戏拿出来
  if (existsSync(join(ROOT, 'items', slug, 'logic.mjs'))) {
    need(typeof ns.createGame === 'function', 'logic.mjs 导出 createGame()');
  }

  if (!MODEL) {
    ok.push('无 MODEL（二维物品），跳过零件交叉检查');
    return;
  }  for (const k of ['world', 'byKey', 'PARTS', 'applyMotion', 'moduleBounds']) {
    need(MODEL[k] != null, `MODEL.${k} 存在`);
  }
  const byKey = MODEL.byKey;
  if (!(byKey instanceof Map)) {
    bad.push('MODEL.byKey 不是 Map');
    return;
  }
  need(MODEL.PARTS.length === byKey.size, `PARTS(${MODEL.PARTS.length}) 与 byKey(${byKey.size}) 数量一致`);

  const owner = new Map();
  for (const m of mods) {
    for (const k of m.parts) {
      need(byKey.has(k), `模块 ${m.id} 的零件 ${k} 在 byKey 里`);
      need(!owner.has(k), `零件 ${k} 只属于一个模块（${owner.get(k)} / ${m.id}）`);
      owner.set(k, m.id);
    }
  }
  for (const k of byKey.keys()) {
    const env = (MANIFEST.envParts || []).includes(k);
    need(owner.has(k) || env, `零件 ${k} 被模块认领（或在 envParts 里声明为环境件）`);
  }
  // 拾取靠的是"网格向上能回溯到 userData.key"，所以查网格而不是查组
  byKey.forEach((p, k) => {
    const seen = new Set();
    p.g.traverse((o) => {
      if (!o.isMesh) return;
      for (let n = o; n; n = n.parent) if (n.userData?.key) { seen.add(n.userData.key); return; }
      seen.add(null);
    });
    need(seen.size === 1 && seen.has(k), `零件 ${k} 的网格都能回溯到自己的 key（实际 ${[...seen].join('/')}）`);
  });

  // 模块包围盒：接得上的话说明 parts 里的 key 真能定位到几何
  for (const m of mods) {
    let s = null;
    try {
      const b = MODEL.moduleBounds(m.parts);
      s = b.max.clone().sub(b.min);
    } catch (e) {
      bad.push(`moduleBounds(${m.id}) 抛错：${e.message}`);
    }
    need(!!s && Number.isFinite(s.length()) && s.length() > 0, `模块 ${m.id} 的包围盒有效`);
  }

  // 取景名：main.mjs 里 fitCamera('x') 的 x 必须在 scene.focus 里
  const focus = Object.keys(MANIFEST.scene?.focus || {});
  if (focus.length) {
    const main = join(ROOT, 'items', slug, 'main.mjs');
    if (existsSync(main)) {
      const src = readFileSync(main, 'utf8');
      const names = new Set([...src.matchAll(/fitCamera\(\s*'([^']+)'/g)].map((m) => m[1]));
      for (const n of names) need(focus.includes(n), `取景 '${n}' 在 scene.focus 里（现有 ${focus.join('/')}）`);
    }
  }

  // 每个零件真的能被画出来：有网格、有材质、有顶点、矩阵没 NaN
  const empty = [];
  let noMat = 0, zeroGeo = 0, nanMat = 0, meshCount = 0;
  byKey.forEach((p, k) => {
    let n = 0;
    p.g.traverse((o) => {
      if (!o.isMesh) return;
      n++; meshCount++;
      if (!o.material) noMat++;
      if (!(o.geometry?.attributes?.position?.count > 0)) zeroGeo++;
      if (!o.matrixWorld.elements.every(Number.isFinite)) nanMat++;
    });
    if (!n) empty.push(k);
  });
  need(empty.length === 0, `每个零件都有网格（空零件：${empty.join('/') || '无'}）`);
  need(noMat === 0, `每个网格都有材质（缺 ${noMat} 个）`);
  need(zeroGeo === 0, `每个网格都有顶点（空几何 ${zeroGeo} 个）`);
  need(nanMat === 0, `每个网格的矩阵都是有限值（NaN ${nanMat} 个）`);
  need(meshCount >= byKey.size, `${meshCount} 个网格覆盖 ${byKey.size} 个零件`);

  // 运动：用初始状态跑一帧 applyMotion，不许抛错也不许把变换算成 NaN
  const game = typeof ns.createGame === 'function' ? ns.createGame() : null;
  const runState = game?.state || {};
  const VIEW = { crankDeg: 0, camDeg: 0, speed: 1, running: false, cut: false, solid: false, clock: 0, focus: 'all' };
  try {
    MODEL.applyMotion(VIEW, runState);
    ok.push('applyMotion 在初始状态可调用');
    let nan = 0;
    MODEL.world.updateMatrixWorld(true);
    MODEL.world.traverse((o) => {
      const v = [o.position.x, o.position.y, o.position.z, o.scale.x, o.scale.y, o.scale.z];
      if (!v.every(Number.isFinite)) nan++;
    });
    need(nan === 0, `applyMotion 后没有 NaN 变换（${nan} 个）`);
  } catch (e) {
    bad.push('applyMotion 抛错：' + e.message);
  }
}

/* ---------------- 行为：items/<slug>/logic.spec.mjs ---------------- */
async function specChecks(slug, ns) {
  const file = join(ROOT, 'items', slug, 'logic.spec.mjs');
  if (!existsSync(file)) {
    ok.push('无 logic.spec.mjs（跳过行为断言）');
    return;
  }
  const t = {
    ok: (cond, msg) => need(!!cond, msg),
    eq: (a, b, msg) => need(a === b, `${msg}（${JSON.stringify(a)} === ${JSON.stringify(b)}）`),
    near: (a, b, tol, msg) => need(Math.abs(a - b) <= tol, `${msg}（${a} ≈ ${b} ±${tol}）`),
  };
  const mod = await import(pathToFileURL(file).href + '?t=' + Date.now());
  try {
    await mod.default(t, { ...ns });
  } catch (e) {
    bad.push('logic.spec.mjs 抛错：' + (e.stack || e.message));
  }
}

/* ---------------- 跑 ---------------- */
async function runOne(slug) {
  const file = join(ROOT, 'dist', `${slug}.logic.mjs`);
  if (!existsSync(file)) {
    console.log(`  ✗ ${slug}: 缺 dist/${slug}.logic.mjs，先跑 python3 tools/build.py ${slug}`);
    return 1;
  }
  ok.length = 0; bad.length = 0;
  try {
    const ns = await import(pathToFileURL(file).href + '?t=' + Date.now());
    staticChecks(slug, ns);
    if (!STATIC_ONLY) await specChecks(slug, ns);
  } catch (e) {
    bad.push('导入 dist/' + slug + '.logic.mjs 失败：' + (e.message || e));
  }
  const tag = bad.length ? `✗ ${bad.length} 项` : `✓ ${ok.length} 项`;
  console.log(`  ${tag}  ${slug}`);
  for (const b of bad) console.log(`       ✗ ${b}`);
  if (process.env.VERBOSE) for (const o of ok) console.log(`       ✓ ${o}`);
  return bad.length;
}

const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const slugs = !arg || arg === 'all'
  ? readdirSync(join(ROOT, 'items')).filter((s) => !s.startsWith('_') && !s.startsWith('.') && existsSync(join(ROOT, 'items', s, 'manifest.mjs')))
  : [arg];

console.log(`无浏览器断言${STATIC_ONLY ? '（仅静态）' : ''}：${slugs.length} 个物品`);
let failed = 0;
for (const s of slugs) failed += await runOne(s);
console.log(failed ? `\n✗ ${failed} 项未通过` : '\n✓ 全部通过');
process.exit(failed ? 1 : 0);
