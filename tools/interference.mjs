/* 通用穿模探测（所有物品共用，Node 直接跑，不进浏览器）
 *
 * 目的：补上「肉眼 + 像素探针」之外的一项确定性证据 —— 装配态下任意两件零件的
 *      实体是否互相插进去，插进去多深、在哪。不依赖各物品手写的断言。
 *
 * 做法：
 *   1. 导入 items/<slug>/model.mjs（three 指到 vendor），不动状态，直接取装配位姿；
 *   2. 每件零件的三角面按 2 mm 分箱；对每个 (x,y) 列沿 +z 打线求交点，用奇偶规则
 *      把「实体内部」填进 1 mm 体素（这就是该零件的实体）；
 *   3. 在零件 A 表面按面积撒点，落在零件 B 实体体素里的点再算到 B 三角面的
 *      最近距离：> 0.45 mm 才算真穿入（贴面/共面接触不算）；
 *   4. 逐对输出「穿入点数 / 最大穿入深度 / 位置」。
 *
 * 奇偶填充要求零件是闭合实体。开放面（半壳、部分圆弧 lathe、剖切件）会被
 * 自动识别并跳过当「被穿入方」，计入输出的「未覆盖」清单，不静默放过。
 *
 * 用法：
 *   node tools/interference.mjs                 # 六个物品全跑
 *   node tools/interference.mjs nail-gun-lab    # 只跑一个
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEAD = path.join(ROOT, 'vendor', 'three.module.js');
const CELL = 1.0;        // 体素边长 mm
const BIN = 2.0;         // 三角面 xy 分箱 mm
const DEPTH_MIN = 0.45;  // 判为「真穿入」的最小深度 mm
const SAMPLES = 700;     // 每件表面的撒点数（面积加权）

const THREE = await import(pathToFileURL(HEAD).href);

/* ---------- 取模型 ---------- */
function stubDom() {
  const grad = () => ({ addColorStop() {} });
  const ctx = () => ({
    fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '',
    fillRect() {}, strokeRect() {}, clearRect() {}, save() {}, restore() {},
    translate() {}, rotate() {}, scale() {},
    fillText() {}, measureText: () => ({ width: 10 }),
    createRadialGradient: grad, createLinearGradient: grad,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {},
  });
  globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: ctx, style: {} }) };
  if (!globalThis.self) globalThis.self = globalThis;
}

async function loadModel(slug) {
  stubDom();
  const file = path.join(ROOT, 'items', slug, 'model.mjs');
  const src = fs.readFileSync(file, 'utf8')
    .replace(/from\s+['"]three['"]/, `from '${pathToFileURL(HEAD).href}'`);
  const tmp = path.join(ROOT, 'items', slug, '.interference.probe.mjs');
  fs.writeFileSync(tmp, src);
  try {
    const m = await import(pathToFileURL(tmp).href + '?t=' + Date.now());
    return m.MODEL;
  } finally { fs.unlinkSync(tmp); }
}

/* ---------- 世界坐标三角面 ---------- */
function collect(part) {
  const tris = [], pts = new Map(); // pts: 顶点去重后供撒点
  let instanced = 0, meshes = 0;
  part.g.updateMatrixWorld(true);
  part.g.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    if (o.isInstancedMesh) { instanced++; return; }
    const g = o.geometry, pos = g.attributes.position, idx = g.index;
    const m = o.matrixWorld;
    const v = (i) => {
      const t = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m);
      return [t.x, t.y, t.z];
    };
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const a = v(idx ? idx.getX(i) : i);
      const b = v(idx ? idx.getX(i + 1) : i + 1);
      const c = v(idx ? idx.getX(i + 2) : i + 2);
      tris.push([a, b, c]);
    }
  });
  return { tris, instanced, meshes };
}

/* ---------- 闭合性：每条无向边必须恰好被两个三角面共用 ---------- */
function closedRatio(tris) {
  const edges = new Map();
  const k = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)},${p[2].toFixed(3)}`;
  for (const t of tris) {
    const [a, b, c] = t.map(k);
    for (const [u, w] of [[a, b], [b, c], [c, a]]) {
      const key = u < w ? u + '|' + w : w + '|' + u;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  let good = 0;
  for (const v of edges.values()) if (v === 2) good++;
  return edges.size ? good / edges.size : 0;
}

/* ---------- 实体体素（沿 +z 奇偶填充） ---------- */
function solidGrid(tris) {
  const box = new THREE.Box3();
  for (const t of tris) for (const p of t) box.expandByPoint(new THREE.Vector3(p[0], p[1], p[2]));
  if (box.isEmpty()) return null;
  const min = box.min, max = box.max;
  const nx = Math.max(1, Math.ceil((max.x - min.x) / CELL) + 1);
  const ny = Math.max(1, Math.ceil((max.y - min.y) / CELL) + 1);
  const nz = Math.max(1, Math.ceil((max.z - min.z) / CELL) + 1);
  const solid = new Uint8Array(nx * ny * nz);
  const idx = (i, j, k) => (k * ny + j) * nx + i;

  // 三角面按 xy 分箱
  const bins = new Map();
  const bx = Math.ceil((max.x - min.x) / BIN) + 1, by = Math.ceil((max.y - min.y) / BIN) + 1;
  for (const t of tris) {
    const x0 = Math.floor((Math.min(t[0][0], t[1][0], t[2][0]) - min.x) / BIN);
    const x1 = Math.floor((Math.max(t[0][0], t[1][0], t[2][0]) - min.x) / BIN);
    const y0 = Math.floor((Math.min(t[0][1], t[1][1], t[2][1]) - min.y) / BIN);
    const y1 = Math.floor((Math.max(t[0][1], t[1][1], t[2][1]) - min.y) / BIN);
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
      const key = i * by + j;
      let arr = bins.get(key);
      if (!arr) bins.set(key, (arr = []));
      arr.push(t);
    }
  }

  for (let i = 0; i < nx; i++) {
    const px = min.x + i * CELL;
    const bi = Math.floor((px - min.x) / BIN);
    for (let j = 0; j < ny; j++) {
      const py = min.y + j * CELL;
      const bj = Math.floor((py - min.y) / BIN);
      const cand = bins.get(bi * by + bj);
      if (!cand) continue;
      const hit = [];
      for (const [a, b, c] of cand) {
        // xy 平面内的重心坐标（2D 包含测试），交点 z 线性插值
        const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if (Math.abs(d) < 1e-12) continue;
        const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / d;
        const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        hit.push(l1 * a[2] + l2 * b[2] + l3 * c[2]);
      }
      if (hit.length < 2) continue;
      hit.sort((p, q) => p - q);
      for (let h = 0; h + 1 < hit.length; h += 2) {
        const k0 = Math.max(0, Math.ceil((hit[h] - min.z) / CELL));
        const k1 = Math.min(nz - 1, Math.floor((hit[h + 1] - min.z) / CELL));
        for (let k = k0; k <= k1; k++) solid[idx(i, j, k)] = 1;
      }
    }
  }
  return { solid, nx, ny, nz, min, max, idx };
}

/* ---------- 表面撒点（面积加权，确定性） ---------- */
function samplePoints(tris, n = SAMPLES) {
  let area = 0;
  for (const [a, b, c] of tris) area += triArea(a, b, c);
  if (area <= 0) return [];
  const step = area / n;
  const out = [];
  let s = 0.12345;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (const [a, b, c] of tris) {
    const ar = triArea(a, b, c);
    if (ar <= 0) continue;
    const k = Math.max(1, Math.round(ar / step));
    for (let i = 0; i < k; i++) {
      let u = rnd(), v = rnd();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      out.push([
        a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0]),
        a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]),
        a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]),
      ]);
    }
  }
  return out;
}
const triArea = (a, b, c) => {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  return 0.5 * Math.hypot(cx, cy, cz);
};

/* 点到三角面最近距离 */
function distTri(p, [a, b, c]) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return Math.hypot(...ap);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return Math.hypot(...bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return Math.hypot(...sub(p, [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]));
  }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return Math.hypot(...cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return Math.hypot(...sub(p, [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]));
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    const bc = sub(c, b);
    return Math.hypot(...sub(p, [b[0] + w * bc[0], b[1] + w * bc[1], b[2] + w * bc[2]]));
  }
  const denom = va + vb + vc;
  // 零面积三角面：退化成三条边，取到边的最近距离
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-9) {
    const seg = (s) => {
      const ab2 = sub(s[1], s[0]);
      const l2 = dot(ab2, ab2);
      const t = l2 > 0 ? Math.max(0, Math.min(1, dot(sub(p, s[0]), ab2) / l2)) : 0;
      return Math.hypot(...sub(p, [s[0][0] + t * ab2[0], s[0][1] + t * ab2[1], s[0][2] + t * ab2[2]]));
    };
    return Math.min(seg([a, b]), seg([b, c]), seg([c, a]));
  }
  const den = 1 / denom;
  const v = vb * den, w = vc * den;
  return Math.hypot(...sub(p, [
    a[0] + ab[0] * v + ac[0] * w,
    a[1] + ab[1] * v + ac[1] * w,
    a[2] + ab[2] * v + ac[2] * w,
  ]));
}

/* 精确奇偶：沿三个轴向各数一次交点，多数表决。体素只用来筛查候选点，判定以这个为准 */
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
function insideExact(p, tris) {
  let votes = 0;
  for (const d of AXES) {
    let n = 0;
    for (const [a, b, c] of tris) {
      const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
      const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
      const hx = d[1] * e2z - d[2] * e2y, hy = d[2] * e2x - d[0] * e2z, hz = d[0] * e2y - d[1] * e2x;
      const det = e1x * hx + e1y * hy + e1z * hz;
      if (Math.abs(det) < 1e-9) continue;
      const f = 1 / det;
      const sx = p[0] - a[0], sy = p[1] - a[1], sz = p[2] - a[2];
      const u = f * (sx * hx + sy * hy + sz * hz);
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const v = f * (d[0] * qx + d[1] * qy + d[2] * qz);
      if (v < 0 || u + v > 1) continue;
      const t = f * (e2x * qx + e2y * qy + e2z * qz);
      if (t > 1e-6) n++;
    }
    if (n % 2 === 1) votes++;
  }
  return votes >= 2;
}

/* ---------- 每件物品的「装配位姿」 ----------
 * 多数 model.mjs 在构造时就把零件摆在装配位置，直接量即可；少数零件的位姿
 * 由 applyMotion 给（例如双缸的活塞/连杆），必须先把它们摆到位再量。
 */
const POSES = {
  'double-cylinder-engine': (M) => M.applyMotion({ crankDeg: 0, camDeg: 0 }),
  'electric-toothbrush': (M) => M.applyMotion({ angle: 0, detachedAngle: 0 },
    { placed: M.PARTS.map((p) => p.key), selected: null, headOff: false, rotation: 0 }),
  'hand-crank-flashlight': (M) => M.applyMotion({ light: 1 }, { crankTurns: 0 }),
  'spherical-lock': (M) => M.applyMotion({}, {
    chapter: 2, phase: 'lab', placed: M.PARTS.map((p) => p.key),
    spindle: 0, knobIn: 0, knobOut: 0, plug: 0, locked: true, keyKind: 'none', keyInserted: 0,
  }),
  'injection-pen': (M) => M.applyMotion({ cut: false }, {
    chapter: 2, phase: 'lab', placed: M.PARTS.map((p) => p.key), completed: [true, true, true],
    capOuterT: 1, capOuter: 1, capInnerT: 1, capInner: 1, needleT: 1, needle: 1,
    pressT: 0, press: 0, targetMg: 0, windMg: 0, delivered: 0, pending: 0,
  }),
};

/* ---------- 主流程 ---------- */
const NOW = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const r2 = (v) => Math.round(v * 100) / 100;

async function runItem(slug, { verbose = false } = {}) {
  const MODEL = await loadModel(slug);
  MODEL.world.updateMatrixWorld(true);
  if (POSES[slug]) { POSES[slug](MODEL); MODEL.world.updateMatrixWorld(true); }
  else console.log('  · 未定义装配位姿，按 model.mjs 构造位量');
  const parts = MODEL.PARTS.map((p) => {
    const { tris, instanced, meshes } = collect(p);
    const closed = closedRatio(tris);
    return {
      key: p.key, name: p.name, tris, instanced, meshes, closed,
      isSolid: closed >= 0.98 && tris.length > 0,
      grid: null, pts: null,
    };
  });

  for (const p of parts) {
    if (p.isSolid) p.grid = solidGrid(p.tris);
    p.pts = p.instanced ? [] : samplePoints(p.tris);
  }

  const box = (p) => { const b = new THREE.Box3(); for (const t of p.tris) for (const q of t) b.expandByPoint(new THREE.Vector3(q[0], q[1], q[2])); return b; };
  for (const p of parts) p.box = box(p);

  const clusters = [];
  for (let i = 0; i < parts.length; i++) {
    for (let j = 0; j < parts.length; j++) {
      if (i === j) continue;
      const A = parts[i], B = parts[j];
      if (!B.grid || A.instanced) continue;
      if (!A.box.intersectsBox(B.box)) continue;
      const g = B.grid;
      const inB = [];
      for (const p of A.pts) {
        if (p[0] < g.min.x - CELL || p[0] > g.max.x + CELL) continue;
        if (p[1] < g.min.y - CELL || p[1] > g.max.y + CELL) continue;
        if (p[2] < g.min.z - CELL || p[2] > g.max.z + CELL) continue;
        const ii = Math.round((p[0] - g.min.x) / CELL), jj = Math.round((p[1] - g.min.y) / CELL), kk = Math.round((p[2] - g.min.z) / CELL);
        if (ii < 0 || jj < 0 || kk < 0 || ii >= g.nx || jj >= g.ny || kk >= g.nz) continue;
        if (g.solid[g.idx(ii, jj, kk)]) inB.push(p);
      }
      if (!inB.length) continue;
      // 体素只是候选；逐个用精确奇偶复核，再算离 B 表面的距离
      let deep = 0, maxD = 0, worst = null, sum = [0, 0, 0], unverified = 0;
      for (const p of inB) {
        if (!insideExact(p, B.tris)) { unverified++; continue; }
        let dmin = Infinity;
        for (const t of B.tris) {
          if (Math.abs(t[0][0] - p[0]) > 3 || Math.abs(t[1][1] - p[1]) > 3 || Math.abs(t[2][2] - p[2]) > 3) {
            const bb = [Math.min(t[0][0], t[1][0], t[2][0]) - 3, Math.max(t[0][0], t[1][0], t[2][0]) + 3,
                        Math.min(t[0][1], t[1][1], t[2][1]) - 3, Math.max(t[0][1], t[1][1], t[2][1]) + 3,
                        Math.min(t[0][2], t[1][2], t[2][2]) - 3, Math.max(t[0][2], t[1][2], t[2][2]) + 3];
            if (p[0] < bb[0] || p[0] > bb[1] || p[1] < bb[2] || p[1] > bb[3] || p[2] < bb[4] || p[2] > bb[5]) continue;
          }
          const d = distTri(p, t);
          if (Number.isFinite(d) && d < dmin) { dmin = d; if (dmin < 0.05) break; }
        }
        if (Number.isFinite(dmin) && dmin > DEPTH_MIN) {
          deep++; sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2];
          if (dmin > maxD) { maxD = dmin; worst = p; }
        }
      }
      if (!deep) continue;
      clusters.push({
        a: A.key, aName: A.name, b: B.key, bName: B.name,
        pts: deep, of: A.pts.length, maxDepth: maxD, unverified,
        at: [r2(sum[0] / deep), r2(sum[1] / deep), r2(sum[2] / deep)], worst,
      });
    }
  }

  // 同一对零件双向都报时合并
  const merged = new Map();
  for (const c of clusters) {
    const k = [c.a, c.b].sort().join('~');
    const prev = merged.get(k);
    if (!prev) { merged.set(k, { ...c, dirs: 1 }); continue; }
    prev.dirs++;
    prev.pts += c.pts;
    if (c.maxDepth > prev.maxDepth) { prev.maxDepth = c.maxDepth; prev.worst = c.worst; }
  }
  const findings = [...merged.values()].sort((x, y) => y.maxDepth - x.maxDepth);
  const open = parts.filter((p) => !p.isSolid).map((p) => p.key);
  const inst = parts.filter((p) => p.instanced).map((p) => p.key);

  return { slug, parts: parts.length, findings, open, inst,
    solids: parts.filter((p) => p.isSolid).length };
}

/* ---------- 输出 ----------
 * 命令行：
 *   node tools/interference.mjs                     六个物品全跑，打印缺陷
 *   node tools/interference.mjs nail-gun-lab        只跑一个
 *   node tools/interference.mjs --baseline          把当前结果写进基线（只在确认现状可接受时用）
 *   node tools/interference.mjs --gate              与基线比对，有新增或恶化就 exit 1
 *
 * 两套「不该再当缺陷」的机制，别混用：
 *   tools/interference.ignore.json  设计接触豁免：轴孔/螺纹/弹子孔这类**本来就该重合**的面。
 *                                   每条必须写原因 + 量到的深度 + 复核日期，且会被反向校验（见下）。
 *   tools/interference.baseline.json 修复基线：只用于「对比这次改动有没有变坏」，不掩盖缺陷。
 */
const ARGV = process.argv.slice(2);
const FLAGS = new Set(ARGV.filter((a) => a.startsWith('--')));
const only = ARGV.find((a) => !a.startsWith('--'));
const slugs = only ? [only] : fs.readdirSync(path.join(ROOT, 'items'))
  .filter((d) => !d.startsWith('_') && fs.existsSync(path.join(ROOT, 'items', d, 'model.mjs')));

const pairKey = (f) => [f.a, f.b].sort().join('~');
const IGNORE_FILE = path.join(ROOT, 'tools', 'interference.ignore.json');
const BASE_FILE = path.join(ROOT, 'tools', 'interference.baseline.json');
const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);

/* 豁免条目两种写法都收：'a~b' 或 {pair, kind, reason, max, checked}
 * 只有字符串（没写原因）的条目会单独警告 —— 没原因的豁免一律当待补。 */
const rawIgnore = readJson(IGNORE_FILE, {});
const ignore = {};
const unreasoned = [];
for (const [slug, arr] of Object.entries(rawIgnore)) {
  if (slug.startsWith('_')) continue;                     // _comment 之类的说明字段
  ignore[slug] = new Map();
  for (const e of arr || []) {
    const pair = typeof e === 'string' ? e : e && e.pair;
    if (!pair) continue;
    const norm = pair.split('~').sort().join('~');
    if (typeof e === 'string' || !e.reason || !e.kind) unreasoned.push(`${slug}: ${norm}`);
    ignore[slug].set(norm, typeof e === 'string' ? { pair: norm, kind: '?', reason: '' } : e);
  }
}
const baseline = readJson(BASE_FILE, null);
const seenIgnore = new Set();   // 用来反查「豁免了但缺陷已经不存在」的僵尸条目

let total = 0, mutedTotal = 0;
const failed = [];
const completed = new Set();
const now = {};                 // 本次结果，供 --baseline 写回
const worse = [];

if (FLAGS.has('--verbose')) console.log('· verbose：打印被豁免的条目');
console.log(`穿模探测 · 体素 ${CELL} mm · 判真深度 > ${DEPTH_MIN} mm · 每件撒点 ≈ ${SAMPLES}`);
for (const slug of slugs.sort()) {
  let res;
  try { res = await runItem(slug); } catch (e) {
    console.log(`\n## ${slug}\n  ✗ 模型导入/探测失败：${e.message}`);
    failed.push(slug);
    continue;
  }
  completed.add(slug);
  const skip = ignore[slug] || new Map();
  console.log(`\n## ${slug}  ${res.parts} 件 · 闭合实体 ${res.solids} 件`);
  if (res.inst.length) console.log(`  · 实例化零件（未采样）：${res.inst.join(', ')}`);
  if (res.open.length) console.log(`  · 开放面/剖切件（只当穿入方，不当被穿入方）：${res.open.join(', ')}`);
  const hits = res.findings.filter((f) => !skip.has(pairKey(f)));
  const mutedHits = res.findings.filter((f) => skip.has(pairKey(f)));
  const muted = mutedHits.length;
  now[slug] = {};
  for (const f of hits) now[slug][pairKey(f)] = Number(f.maxDepth.toFixed(2));
  for (const f of mutedHits) seenIgnore.add(`${slug}:${pairKey(f)}`);
  if (!hits.length) console.log('  ✓ 未发现穿入 > ' + DEPTH_MIN + ' mm 的零件对');
  for (const f of hits) {
    total++;
    const base = baseline && baseline[slug] ? baseline[slug][pairKey(f)] : undefined;
    let tag = '';
    if (baseline) {
      if (base === undefined) { tag = '  ← 新增'; worse.push(`${slug} ${pairKey(f)} +${f.maxDepth.toFixed(2)}mm`); }
      else if (f.maxDepth > base + 0.05) { tag = `  ← 恶化（基线 ${base.toFixed(2)}）`; worse.push(`${slug} ${pairKey(f)} ${base.toFixed(2)}→${f.maxDepth.toFixed(2)}mm`); }
    }
    console.log(`  ✗ ${f.aName}(${f.a}) ↔ ${f.bName}(${f.b}) · ${f.pts} 点穿入 · 最深 ${f.maxDepth.toFixed(2)} mm · 约在 [${f.at.join(', ')}]${tag}`);
  }
  if (muted) {
    mutedTotal += muted;
    console.log(`  · 已按 ignore 清单豁免 ${muted} 对（设计接触）`);
    for (const f of mutedHits) {
      const e = skip.get(pairKey(f));
      console.log(`    ↳ [${e.kind}] ${f.aName}↔${f.bName} · 现测 ${f.maxDepth.toFixed(2)} mm${e.max ? ` / 记录 ${e.max} mm` : ''}${e.checked ? ` · 复核 ${e.checked}` : ''}`);
      console.log(`       ${e.reason || '（缺原因，请补 reason）'}`);
    }
  }
  // 修好了的（基线里曾经有、现在没了）
  if (baseline && baseline[slug]) {
    const fixed = Object.keys(baseline[slug]).filter((k) => !(k in now[slug]) && !skip.has(k));
    if (fixed.length) console.log(`  ✓ 比基线少 ${fixed.length} 对（已消除：${fixed.join(', ')}）`);
  }
}

/* ---------- 汇总与校验 ---------- */
const zombies = [];
for (const [slug, m] of Object.entries(ignore)) {
  if (!completed.has(slug)) continue;      // 本次没跑这件，不算僵尸
  for (const pair of m.keys()) if (!seenIgnore.has(`${slug}:${pair}`)) zombies.push(`${slug}:${pair}`);
}

if (failed.length || !completed.size) {
  console.log(`\n✗ 探测未完成：成功 ${completed.size} 件，失败 ${failed.length} 件${failed.length ? `（${failed.join(', ')}）` : ''}；不能判定全部通过，未写基线`);
  process.exit(1);
}

console.log(`\n${total ? `✗ 共 ${total} 对实心零件互相穿入` : '✓ 全部物品未发现实心零件互穿'}${mutedTotal ? `（另有 ${mutedTotal} 对为已复核的设计接触）` : ''}`);
if (unreasoned.length) console.log(`! ${unreasoned.length} 条豁免没写 kind/reason：${unreasoned.join('，')}`);
// 僵尸豁免：件已经修好（或那对不再出现）就不该继续留在清单里，否则清单会越滚越松
if (zombies.length) console.log(`! ${zombies.length} 条豁免已失效（这对零件现在不再穿入，请从 ignore 清单删掉）：${zombies.join('，')}`);

if (FLAGS.has('--gate')) {
  if (!baseline) { console.log('! --gate 需要先跑一次 --baseline'); process.exit(1); }
  if (worse.length) { console.log(`\n✗ gate 未通过：${worse.length} 处新增/恶化\n  ${worse.join('\n  ')}`); process.exit(1); }
  if (unreasoned.length || zombies.length) { console.log('\n✗ gate 未通过：ignore 清单有未写原因或已失效的条目'); process.exit(1); }
  console.log('✓ gate 通过：没有新增/恶化的穿入对');
}
if (FLAGS.has('--baseline')) {
  if (unreasoned.length || zombies.length) {
    console.log('✗ 未写基线：ignore 清单有未写原因或已失效的条目');
    process.exit(1);
  }
  // 单物品更新保留其他物品的基线；完整扫描替换整份基线。
  const next = only ? { ...(baseline || {}), ...now } : now;
  fs.writeFileSync(BASE_FILE, JSON.stringify(next, null, 2) + '\n');
  console.log(`· 已写基线 ${path.relative(ROOT, BASE_FILE)}：${Object.values(next).reduce((n, o) => n + Object.keys(o).length, 0)} 对`);
}
process.exit(0);
