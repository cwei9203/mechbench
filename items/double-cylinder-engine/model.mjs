/* ============================================================================
 * 并列双缸发动机 · 机构模型（几何 + 运动学：一处定义，视图/读数/自检共用）
 * ----------------------------------------------------------------------------
 * 基准：1 unit = 1 mm。曲轴轴线 = +x，气缸轴线 = +y（向上），缸盖朝 +y。
 * 参考机型：雅马哈 XS650 并列双缸（1970s）。公布参数：缸径 75 / 行程 74 /
 * 排量 653 cc / 压缩比 8.4:1 / SOHC 每缸 2 气门 / 360° 曲轴 / 链条驱动凸轮轴。
 * 其余（连杆中心距、缸心距、壁厚、气门尺寸、配气正时、箱体分型）均为教学估算。
 * 这是教学模型，不是可制造图纸。
 *
 * 零件表（20 类 / 26 件）｜ 真机尺寸 → 建模尺寸 ｜ 由谁固定 ｜ 运动 ｜ 简化项
 *  01 下曲轴箱   估算 228×84×184 壁6      ｜上箱螺接                ｜固定 ｜油道、变速腔未建模
 *  02 上曲轴箱   估算 228×88×184          ｜下箱螺接,顶面承缸体      ｜固定 ｜同上
 *  03 曲轴       真机行程74(曲柄半径37)    ｜两主轴承支承            ｜转   ｜无扭转减振器
 *  04 主轴承×2   估算 Ø42/Ø62×18          ｜压入上下箱座            ｜固定 ｜滚动体未建模
 *  05 连杆1      估算 中心距130 大头Ø38    ｜大头套曲柄销            ｜摆   ｜轴瓦油膜未建模
 *  06 连杆2      同上(与连杆1共用曲柄销)   ｜同上                    ｜摆   ｜同上
 *  07 活塞1      真机缸径75(模型74.6)      ｜活塞销+缸壁导向          ｜往复 ｜环弹性未建模
 *  08 活塞2      同上                       ｜同上                    ｜往复 ｜同上
 *  09 缸垫×2     估算 Ø84×1.5 环            ｜缸体与缸盖夹紧          ｜固定 ｜密封压缩量未建模
 *  10 气缸体     真机缸径75 缸心距85(估算)  ｜缸头螺柱压紧于上箱      ｜固定 ｜水套/风道、气门室未建模
 *  11 气缸盖     真机2气门/缸(尺寸估算)    ｜缸头螺柱压紧            ｜固定 ｜进排气道按剖开显示
 *  12 气门组×4   估算 进Ø36/排Ø32 杆Ø7     ｜导管导向,弹簧压紧        ｜往复 ｜配气相位为教学值
 *  13 凸轮轴     估算 基圆R14 升程6.5       ｜两轴承座支承            ｜半速转｜无减压阀
 *  14 气门挺柱×4 估算 Ø22×20               ｜缸盖挺柱孔导向,压在弹簧座上｜往复 ｜导向孔未开,靠外形表达
 *  16 曲轴链轮   估算 15T 节距8             ｜键+螺母固定于曲轴左端    ｜转   ｜—
 *  17 凸轮链轮   估算 30T 节距8             ｜螺栓固定于凸轮轴左端     ｜半速转｜—
 *  18 正时链     估算 节距8 约90节          ｜环绕两链轮              ｜沿环 ｜张紧器、导轨未建模
 *  19 气门室盖   估算 190×30×104            ｜螺栓固定于缸盖顶面      ｜固定 ｜密封垫未建模
 *  20 火花塞×2   M12×1.25(模型估算)         ｜拧入缸盖                ｜固定 ｜点火能量未建模
 *  21 飞轮磁电机 估算 Ø148×34               ｜锥面+键装于曲轴左端      ｜转   ｜磁电输出未建模
 * ==========================================================================*/

import * as THREE from 'three';

/* 引擎几何在 world 组里；kit/scene.mjs 负责把 world 挂进场景 */
const world = new THREE.Group();

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* ====== 机构尺寸：一处定义 ====== */
const D = {
  R: 37, ROD: 130, BORE: 75, BORE_X: 42.5,
  DECK: 201, BARREL_Y0: 88,
  HEAD_Y1: 336, COVER_Y1: 366,
  CAM_Y: 272, CAM_RB: 14, CAM_RX: 12, CAM_LIFT: 6.5, CAM_X0: -104, CAM_X1: 70,
  VZ: 0, VSEAT: 203, VSTEM_TOP: 240, VDX: 19,
  TAPPET_TOP: 258, TAPPET_R: 11,
  CASE_Y0: -76, CASE_TOP: 88, CASE_X: 110, CASE_Z: 76,
  CHAIN_X: -99, CH_PITCH: 8, SPR_N: 15, SPR_M: 30,
  ROTOR_X0: -148, ROTOR_X1: -114,
  PISTON_CRN: 33, PISTON_BOT: -29, RING_TEETH: 42, SPR_FREE: 26, SPR_BASE: 7,
};
const CYL_X = [-D.BORE_X, D.BORE_X];              // 缸 1 = -x，缸 2 = +x
const TUNNEL = [-104, -92, 28];                    // 上箱顶板让链条通过的开口 x0,x1,halfZ

/* 配气正时（曲轴转角，0° = 缸1 压缩上止点） */
const TIMING = {
  ex: { open: 135, close: 370 },   // 排气：下止点前45°开 / 上止点后10°关（235°）
  im: { open: 350, close: 585 },   // 进气：上止点前10°开 / 下止点后45°关（235°）
};
const PEAK = { ex: (TIMING.ex.open + TIMING.ex.close) / 2, im: (TIMING.im.open + TIMING.im.close) / 2 };
const DUR_CAM = (TIMING.ex.close - TIMING.ex.open) / 2;    // 凸轮角制下的开启持续角

/* 挺柱位置与配气几何，几何与运动共用 */
// 挺柱/气门在缸心线上的 x 偏置：进气靠 -x、排气靠 +x，两只挺柱才不会互撞
const valveX = (i, kind) => CYL_X[i] + (kind === 'im' ? -D.VDX : D.VDX);
const lobeX = valveX;
// 挺柱直接坐在气门弹簧座上，凸轮升程 = 气门升程（1:1，无杠杆，接触点不会走偏）
const VALVE_LIFT_MAX = D.CAM_LIFT;

/* ====== 几何助手 ====== */
function mergeGeos(list){
  let n = 0, ni = 0;
  for (const g of list){ n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(n * 3), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of list){
    pos.set(g.attributes.position.array, vo * 3);
    const c = g.attributes.position.count;
    if (g.index){ const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io++] = a[i] + vo; }
    else for (let i = 0; i < c; i++) idx[io++] = i + vo;
    vo += c;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}
function flipIndex(g){
  const t = g.index.array;
  for (let i = 0; i < t.length; i += 3){ const s = t[i]; t[i] = t[i + 2]; t[i + 2] = s; }
  g.index.needsUpdate = true; g.computeVertexNormals(); return g;
}
function latheX(profile, seg = 64){          // [[x, r], ...]
  const g = new THREE.LatheGeometry(profile.map(([x, r]) => new THREE.Vector2(Math.max(r, 1e-3), x)), seg);
  g.rotateZ(-Math.PI / 2); g.computeVertexNormals(); return g;
}
function latheY(profile, seg = 64){          // [[y, r], ...]
  const g = new THREE.LatheGeometry(profile.map(([y, r]) => new THREE.Vector2(Math.max(r, 1e-3), y)), seg);
  g.computeVertexNormals(); return g;
}
function cylX(x0, x1, r, seg = 32){
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg, 1, false);
  g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0); return g;
}
function cylY(y0, y1, r, seg = 24){
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg); g.translate(0, (y0 + y1) / 2, 0); return g;
}
// 空心圆环管（沿 x），各面用 three 自带几何保证绕向
function ringX(x0, x1, ri, ro, seg = 48){
  const parts = [];
  let g = new THREE.CylinderGeometry(ro, ro, x1 - x0, seg, 1, true);
  g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0); parts.push(g);
  g = new THREE.CylinderGeometry(ri, ri, x1 - x0, seg, 1, true);
  g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0); parts.push(flipIndex(g));
  g = new THREE.RingGeometry(ri, ro, seg); g.rotateY(-Math.PI / 2); g.translate(x0, 0, 0); parts.push(g);
  g = new THREE.RingGeometry(ri, ro, seg); g.rotateY(Math.PI / 2); g.translate(x1, 0, 0); parts.push(g);
  return mergeGeos(parts);
}
function ringY(y, h, ri, ro, seg = 48){
  const sh = new THREE.Shape(circlePts(0, 0, ro, seg).map(([u, v]) => new THREE.Vector2(u, v)));
  sh.holes.push(new THREE.Path(circlePts(0, 0, ri, seg, false).map(([u, v]) => new THREE.Vector2(u, v))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); g.translate(0, y - h / 2, 0); return g;
}
function rectPts(u0, u1, v0, v1, r, seg = 4){    // 圆角矩形，CCW
  const pts = [];
  const corner = (cu, cv, a0) => {
    for (let i = 0; i <= seg; i++){
      const a = a0 + (Math.PI / 2) * (i / seg);
      pts.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]);
    }
  };
  corner(u1 - r, v0 + r, -Math.PI / 2); corner(u1 - r, v1 - r, 0);
  corner(u0 + r, v1 - r, Math.PI / 2); corner(u0 + r, v0 + r, Math.PI);
  return pts;
}
function notchRect(u0, u1, v0, v1, zr, xn){      // 左侧开槽的矩形，CCW
  return [[u1, v0], [u1, v1], [u0, v1], [u0, zr], [xn, zr], [xn, -zr], [u0, -zr], [u0, v0]];
}
function circlePts(u, v, r, seg = 48, ccw = true){
  const pts = [];
  for (let i = 0; i < seg; i++){
    const a = (ccw ? 1 : -1) * (i / seg) * TAU;
    pts.push([u + Math.cos(a) * r, v + Math.sin(a) * r]);
  }
  return pts;
}
/* 棱柱：外轮廓 CCW + 孔 CW，沿 y。壁面逐边生成（不重叠），可以安全叠加剖切面。*/
function prismXZ(outer, holes, y0, y1, opt = {}){
  const shape = new THREE.Shape(outer.map(([u, v]) => new THREE.Vector2(u, v)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
  const cap = new THREE.ShapeGeometry(shape);
  cap.deleteAttribute('uv'); cap.deleteAttribute('normal');
  cap.rotateX(Math.PI / 2);                        // (u,v) → (u,0,v)，法线朝 -y
  const geos = [];
  if (opt.caps !== false){
    const bottom = cap.clone(); bottom.translate(0, y0, 0);
    const top = cap.clone(); top.translate(0, y1, 0); flipIndex(top);
    geos.push(bottom, top);
  }
  const wall = (contour) => {
    const pos = [], idx = [];
    for (let i = 0; i < contour.length; i++){
      const [pu, pv] = contour[i], [qu, qv] = contour[(i + 1) % contour.length];
      const b = pos.length / 3;
      pos.push(pu, y0, pv, qu, y0, qv, qu, y1, qv, pu, y1, pv);
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  geos.push(wall(outer));
  for (const h of holes) geos.push(wall(h));
  return mergeGeos(geos);
}
/* 剖面在 (z,y) 平面、沿 x 拉伸的板件：用于曲轴箱主轴承隔板 */
function prismYZ(pts, holes, x0, x1){
  const g = prismXZ(pts, holes, x0, x1);
  g.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  return g;
}
/* 半圆盘（配重扇形）：sgn=+1 上半 / -1 下半，返回 [z,y] 闭合点列 */
function halfDiscPts(r, sgn, seg = 24){
  const pts = [];
  for (let k = 0; k <= seg; k++){
    const t = Math.PI * (1 - k / seg);
    pts.push([r * Math.cos(t), sgn * r * Math.sin(t)]);
  }
  return pts;
}
/* 半圆环隔板：sgn=+1 上半 / -1 下半 */
function halfBulkhead(x0, x1, ri, ro, sgn, seg = 30){
  const pts = [];
  const arc = (r, a0, a1, n) => {
    for (let k = 0; k <= n; k++){
      const t = a0 + (a1 - a0) * k / n;
      pts.push([r * Math.cos(t), sgn * r * Math.sin(t)]);       // [z, y]
    }
  };
  if (sgn > 0){ arc(ro, 0, Math.PI, seg); arc(ri, Math.PI, 0, seg); }
  else { arc(ro, Math.PI, 0, seg); arc(ri, 0, Math.PI, seg); }
  return prismYZ(pts, [], x0, x1);
}
function toothedRingX(x0, x1, rRoot, rTip, n, rIn){
  const step = TAU / n, pts = [];
  for (let i = 0; i < n; i++){
    const a = i * step;
    pts.push([rRoot, a], [rTip, a + step * .3], [rTip, a + step * .58], [rRoot, a + step * .8]);
  }
  const sh = new THREE.Shape(pts.map(([r, a]) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)));
  if (rIn > 0){ const hole = new THREE.Path(); hole.absarc(0, 0, rIn, 0, TAU, true); sh.holes.push(hole); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false, curveSegments: 10 });
  g.rotateY(Math.PI / 2); g.translate(x0, 0, 0); return g;
}
function lobeGeo(x0, x1, rFn, n = 168){
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++){
    const a = (i / n) * TAU, r = rFn(a);
    pos.push(x0, r * Math.cos(a), r * Math.sin(a), x1, r * Math.cos(a), r * Math.sin(a));
  }
  for (let i = 0; i < n; i++){
    const p = i * 2, q = p + 2;
    idx.push(p, q + 1, q, p, p + 1, q + 1);
  }
  const c0 = pos.length / 3; pos.push(x0, 0, 0);
  const c1 = pos.length / 3; pos.push(x1, 0, 0);
  for (let i = 0; i < n; i++){
    idx.push(c0, i * 2, i * 2 + 2);
    idx.push(c1, i * 2 + 3, i * 2 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function helixY(y0, y1, radius, wire, turns, seg = 7){
  const pts = [], n = Math.round(turns * 26);
  for (let i = 0; i <= n; i++){
    const t = i / n, a = t * turns * TAU;
    pts.push(new THREE.Vector3(radius * Math.cos(a), y0 + (y1 - y0) * t, radius * Math.sin(a)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, seg, false);
}
function boxG(w, h, d, x = 0, y = 0, z = 0){
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g;
}

/* ====== 材质 ====== */
const M = {
  caseAlu:   new THREE.MeshStandardMaterial({ color: 0x6b727a, roughness: .62, metalness: .55 }),
  barrel:    new THREE.MeshStandardMaterial({ color: 0xb3b8bd, roughness: .46, metalness: .62 }),
  head:      new THREE.MeshStandardMaterial({ color: 0x9ba1a8, roughness: .44, metalness: .66 }),
  steel:     new THREE.MeshStandardMaterial({ color: 0xc6cbcf, roughness: .26, metalness: 1 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x989ea5, roughness: .36, metalness: 1 }),
  piston:    new THREE.MeshStandardMaterial({ color: 0xd6dade, roughness: .3, metalness: .95 }),
  ring:      new THREE.MeshStandardMaterial({ color: 0x5d6369, roughness: .38, metalness: 1 }),
  valve:     new THREE.MeshStandardMaterial({ color: 0xbfc4c9, roughness: .3, metalness: 1 }),
  spring:    new THREE.MeshStandardMaterial({ color: 0x7b828a, roughness: .42, metalness: .9 }),
  cam:       new THREE.MeshStandardMaterial({ color: 0xa9afb5, roughness: .2, metalness: 1 }),
  chain:     new THREE.MeshStandardMaterial({ color: 0x74797f, roughness: .44, metalness: .95 }),
  rotor:     new THREE.MeshStandardMaterial({ color: 0x8a9097, roughness: .3, metalness: 1 }),
  gasket:    new THREE.MeshStandardMaterial({ color: 0x4b5157, roughness: .92, metalness: .08 }),
  brass:     new THREE.MeshStandardMaterial({ color: 0xc39a5f, roughness: .38, metalness: .85 }),
  accent:    new THREE.MeshStandardMaterial({ color: 0xc2452d, roughness: .5, metalness: .25 }),
  porcelain: new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: .55, metalness: 0 }),
  cover:     new THREE.MeshStandardMaterial({ color: 0x434a52, roughness: .34, metalness: .72 }),
};

/* ====== 零件注册 ====== */
const parts = [], byKey = new Map();
function addPart(key, name, obj, mat, opt = {}){
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.keepMat){
      o.material = mat.clone();
      o.castShadow = opt.shadow !== false; o.receiveShadow = opt.shadow !== false;
    }
    o.userData.omat = o.material;
    o.userData.ocast = o.castShadow;
    o.userData.key = key;
  });
  const g = new THREE.Group(); g.userData.key = key; g.add(obj); world.add(g);
  const p = { key, name, g, obj, e: 0, off: V(), mat, layer: 0, shell: !!opt.shell };
  parts.push(p); byKey.set(key, p);
  return p;
}
/* 供自检读取的关键尺寸（不参与渲染） */
const PROBE = {
  bulkhead: { x: 84, halfW: 11, ri: 30.2, ro: 70 },
  crankPin: { y: null, r: 19 },
};
const MECH = {
  crankSpin: null, rods: [], pistons: [], camSpin: null, tappets: [], springs: [], valves: [],
  crankSpr: null, camSpr: null, chain: null, chainPath: null, rotor: null, sparks: [], lobes: [],
};

/* ---------- 01 下曲轴箱 ---------- */
{
  const X = D.CASE_X, Z = D.CASE_Z;
  const outer = rectPts(-X, X, -Z, Z, 14);
  const cavity = rectPts(-X + 7, X - 7, -Z + 7, Z - 7, 10);
  const shell = prismXZ(outer, [cavity], D.CASE_Y0, 0);
  const pan = prismXZ(rectPts(-X + 24, X - 24, -Z + 24, Z - 24, 12), [], D.CASE_Y0 - 13, D.CASE_Y0 + 1);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeGeos([shell, pan]), M.caseAlu));
  for (const sx of [-PROBE.bulkhead.x, PROBE.bulkhead.x]){
    // 主轴承隔板：半圆环从轴承孔一直长到箱壁与箱底，不再是悬空的圆环
    g.add(new THREE.Mesh(halfBulkhead(sx - PROBE.bulkhead.halfW, sx + PROBE.bulkhead.halfW, PROBE.bulkhead.ri, PROBE.bulkhead.ro, -1), M.caseAlu));
    for (const sz of [-1, 1]) g.add(new THREE.Mesh(boxG(22, 34, 14, sx, -52, sz * 44), M.caseAlu));
  }
  // 分型面密封线 + 侧壁加强筋：让闭合状态也能读出上下箱的分界
  g.add(new THREE.Mesh(prismXZ(rectPts(-X - .3, X + .3, -Z - .3, Z + .3, 14), [], -1.6, 1.6), M.gasket));
  for (const sx of [-74, -26, 26, 74]){
    g.add(new THREE.Mesh(boxG(11, 62, 6, sx, -34, -Z + 1), M.caseAlu));
    g.add(new THREE.Mesh(boxG(11, 62, 6, sx, -34, Z - 1), M.caseAlu));
  }
  addPart('caseLower', '下曲轴箱', g, M.caseAlu, { shell: true });
}

/* ---------- 02 上曲轴箱（顶板含缸筒与链条通道开孔） ---------- */
{
  const X = D.CASE_X, Z = D.CASE_Z, TOP = D.CASE_TOP;
  const outer = rectPts(-X, X, -Z, Z, 14);
  const cavity = rectPts(-X + 7, X - 7, -Z + 7, Z - 7, 10);
  const walls = prismXZ(outer, [cavity], 0, TOP - 6, { caps: false });
  const topHoles = [
    circlePts(CYL_X[0], 0, D.BORE / 2 + .8, 56, false),
    circlePts(CYL_X[1], 0, D.BORE / 2 + .8, 56, false),
    rectPts(TUNNEL[0], TUNNEL[1], -TUNNEL[2], TUNNEL[2], 4, 3).reverse(),
  ];
  const plate = prismXZ(rectPts(-X + .5, X - .5, -Z + .5, Z - .5, 14), topHoles, TOP - 7, TOP);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeGeos([walls, plate]), M.caseAlu));
  for (const sx of [-PROBE.bulkhead.x, PROBE.bulkhead.x]) g.add(new THREE.Mesh(halfBulkhead(sx - PROBE.bulkhead.halfW, sx + PROBE.bulkhead.halfW, PROBE.bulkhead.ri, PROBE.bulkhead.ro, 1), M.caseAlu));
  addPart('caseUpper', '上曲轴箱', g, M.caseAlu, { shell: true });
}

/* ---------- 03 曲轴（两主轴颈 + 两曲柄臂 + 单曲柄销） ---------- */
{
  const g = new THREE.Group(), spin = new THREE.Group();
  const geos = [
    cylX(-95, -71, 21, 40),      // 左主轴颈（埋入曲柄臂 1 mm）
    cylX(71, 95, 21, 40),
    cylX(-122, -95, 12, 20),      // 左端轴头：穿过箱壁、压装飞轮
    cylX(-56, 56, PROBE.crankPin.r, 40).translate(0, D.R, 0),   // 曲柄销：偏心 R，不是画在轴心上
  ];
  // 曲柄臂 = 对侧配重扇形 + 主轴毂 + 通往曲柄销的窄臂。
  // 销侧故意不做满圆盘，否则连杆大头从侧面完全被挡住，看着像"连杆没接上曲轴"。
  for (const [x0, x1] of [[-72, -56], [56, 72]]){
    const mid = (x0 + x1) / 2;
    geos.push(prismYZ(halfDiscPts(54, -1), [], x0, x1));              // 配重扇形
    geos.push(cylX(x0, x1, 30, 44));                                   // 主轴毂
    geos.push(boxG(x1 - x0, 32, 36, mid, 19, 0));                      // 窄臂
    geos.push(cylX(x0, x1, 28, 40).translate(0, D.R, 0));              // 销座
  }
  spin.add(new THREE.Mesh(mergeGeos(geos), M.steel));
  // 曲柄销两端面上的出油孔（画在销的端面上，不从销身里穿出来）
  const oil = [];
  for (const [xo, zo] of [[-56.2, 12], [56.2, 12]]){
    const o = new THREE.CylinderGeometry(1.6, 1.6, 3, 8);
    o.rotateZ(Math.PI / 2); o.translate(xo, D.R + zo, 0); oil.push(o);
  }
  spin.add(new THREE.Mesh(mergeGeos(oil), M.steelDark));
  // 左轴头上的半圆键：飞轮靠它定相位
  spin.add(new THREE.Mesh(mergeGeos([boxG(12, 4, 7, -110, 12, 0)]), M.steelDark));
  // 曲柄臂对位标记（非对称特征：让旋转看得出来）
  spin.add(new THREE.Mesh(mergeGeos([boxG(4, 6, 26, 65, 44, 0)]), M.accent));
  g.add(spin);
  addPart('crankshaft', '曲轴', g, M.steel);
  MECH.crankSpin = spin;
}

/* ---------- 04 主轴承 ×2 ---------- */
{
  const g = new THREE.Group();
  g.add(new THREE.Mesh(ringX(-94, -74, 21.3, 30, 40), M.brass));
  g.add(new THREE.Mesh(ringX(74, 94, 21.3, 30, 40), M.brass));
  addPart('mainBearings', '主轴承 ×2', g, M.brass);
}

/* ---------- 05/06 连杆 ×2 ---------- */
for (let i = 0; i < 2; i++){
  const g = new THREE.Group(), pivot = new THREE.Group();   // 大头中心=原点，小头在 +y
  const geos = [
    ringX(-11, 11, 19.05, 27, 40),                                   // 大头（含瓦盖）
    ringX(-11, 11, 10.05, 17.5, 36).translate(0, D.ROD, 0),          // 小头（衬套孔）
    // 杆身：从大头（宽 34）向小头（宽 21）收细的实腹断面，比细扁条更像真连杆
    prismYZ([[-17, 15], [17, 15], [10.5, D.ROD - 12], [-10.5, D.ROD - 12]], [], -9, 9),
    // 两侧加强筋：读得出连杆的工字断面
    prismYZ([[-18.5, 17], [-15.5, 17], [-10.5, D.ROD - 14], [-13, D.ROD - 14]], [], -9, 9),
    prismYZ([[15.5, 17], [18.5, 17], [13, D.ROD - 14], [10.5, D.ROD - 14]], [], -9, 9),
  ];
  pivot.add(new THREE.Mesh(mergeGeos(geos), M.steel));
  // 大头轴瓦与小头衬套：铜色薄壁，从侧面看就是一圈亮边
  pivot.add(new THREE.Mesh(ringX(-10.5, 10.5, 19.05, 21.2, 40), M.brass));
  pivot.add(new THREE.Mesh(ringX(-10.5, 10.5, 10.05, 11.8, 32).translate(0, D.ROD, 0), M.brass));
  // 连杆螺栓 + 螺母：大头两侧各一（真实连杆靠它把瓦盖压紧）
  const bolts = [];
  for (const bz of [-18.5, 18.5]){
    bolts.push(cylY(-33, 11, 3.1, 10).translate(0, 0, bz));   // 螺柱：穿过瓦盖进到杆身
    bolts.push(cylY(-40, -33, 5.2, 6).translate(0, 0, bz));   // 螺栓头（瓦盖外侧）
    bolts.push(cylY(11, 17, 5.2, 6).translate(0, 0, bz));     // 螺母
  }
  pivot.add(new THREE.Mesh(mergeGeos(bolts), M.steelDark));
  // 瓦盖分界线：y=0 两侧各一段细槽，读得出连杆是两半用螺栓压在一起的
  pivot.add(new THREE.Mesh(mergeGeos([boxG(23, 1.4, 15, 0, 0, 20), boxG(23, 1.4, 15, 0, 0, -20)]), M.steelDark));
  g.add(pivot);
  addPart('rod' + (i + 1), '连杆 ' + (i + 1), g, M.steel);
  MECH.rods[i] = pivot;
}

/* ---------- 07/08 活塞 ×2（含三道环与活塞销） ---------- */
for (let i = 0; i < 2; i++){
  const g = new THREE.Group();
  // 剖面是一圈闭合折线：冠顶 → 外壁 → 裙脚 → 内壁 → 冠底。
  // 裙部必须空心开口，连杆才能从下方伸进活塞销，而不是穿透一块实心饼。
  const prof = [[D.PISTON_CRN - 1.2, 0], [D.PISTON_CRN - .2, 20], [D.PISTON_CRN, 30], [31.6, 36.2], [30, 37.2]];
  for (const [gy, gh] of [[25.5, 2.0], [20.5, 2.0], [14.5, 2.6]]){   // 降序：油环在下
    prof.push([gy + gh / 2 + 1, 37.3], [gy + gh / 2, 37.3], [gy + gh / 2, 34.9],
              [gy - gh / 2, 34.9], [gy - gh / 2, 37.3], [gy - gh / 2 - 1, 37.3]);
  }
  prof.push([D.PISTON_BOT + 3, 36.1], [D.PISTON_BOT, 34.4],          // 外壁到底
            [D.PISTON_BOT, 30.6], [D.PISTON_BOT + 2.5, 28.6],        // 裙脚翻边
            [26.5, 28.6], [30, 21], [32, 8], [D.PISTON_CRN, 0]);     // 内壁回到冠底中心
  const geos = [latheY(prof, 72)];
  for (const [gy, gh] of [[14.5, 2.6], [20.5, 2.0], [25.5, 2.0]]) geos.push(ringY(gy, gh - .5, 35.2, 37.4, 44));
  geos.push(cylX(-24, 24, 10, 40));                                    // 活塞销 Ø20（空心销的实心示意）
  for (const px of [-1, 1]) geos.push(ringX(px * 13, px * 21, 10.2, 15.5, 28));  // 销座
  g.add(new THREE.Mesh(mergeGeos(geos), M.piston));
  addPart('piston' + (i + 1), '活塞 ' + (i + 1), g, M.piston);
  MECH.pistons[i] = g;
}

/* ---------- 09 缸垫 ×2 ---------- */
{
  const g = new THREE.Group();
  for (const x of CYL_X){
    const m = new THREE.Mesh(ringY(D.DECK + .75, 1.4, D.BORE / 2 - .3, D.BORE / 2 + 7, 56), M.gasket);
    m.position.x = x; g.add(m);
  }
  addPart('gasket', '气缸垫 ×2', g, M.gasket);
}

/* ---------- 10 气缸体（缸筒 + 链条通道 + 风冷散热片 + 缸头螺柱） ---------- */
{
  const g = new THREE.Group();
  const outer = rectPts(-92, 86, -46, 46, 8);
  const holes = [
    circlePts(CYL_X[0], 0, D.BORE / 2, 56, false),
    circlePts(CYL_X[1], 0, D.BORE / 2, 56, false),
  ];
  const body = prismXZ(outer, holes, D.BARREL_Y0, D.DECK);
  const fins = [];
  for (let i = 0; i < 7; i++){
    const y = 95 + i * 14;
    fins.push(prismXZ(rectPts(-84, 88, -74, 74, 10),
      [circlePts(CYL_X[0], 0, D.BORE / 2 + 2.4, 56, false),
       circlePts(CYL_X[1], 0, D.BORE / 2 + 2.4, 56, false)], y, y + 4.5));
  }
  // 缸体底法兰（压在箱体顶面上）
  const flange = prismXZ(rectPts(-92, 92, -80, 80, 10),
    [circlePts(CYL_X[0], 0, D.BORE / 2, 56, false), circlePts(CYL_X[1], 0, D.BORE / 2, 56, false)], D.BARREL_Y0 - .1, D.BARREL_Y0 + 11);
  g.add(new THREE.Mesh(mergeGeos([body, flange, ...fins]), M.barrel));
  for (const sx of [-86, 80]) for (const sz of [-40, 40]){
    g.add(new THREE.Mesh(cylY(D.BARREL_Y0 - 1, D.DECK + 1, 5, 12).translate(sx, 0, sz), M.steelDark));
  }
  addPart('barrel', '气缸体', g, M.barrel, { shell: true });
}

/* ---------- 11 气缸盖（燃烧室 + 气门导管 + 凸轮腔 + 链轮口） ---------- */
{
  const g = new THREE.Group();
  const outer = rectPts(-94, 86, -58, 58, 10);
  const chambers = [circlePts(CYL_X[0], 0, D.BORE / 2, 56, false), circlePts(CYL_X[1], 0, D.BORE / 2, 56, false)];
  // 底板：燃烧室开通
  const deck = prismXZ(outer, chambers, D.DECK + 1.3, 217);
  // 侧壁：内腔 x -103..70 / z ±44（避开底板外壁 0.6 mm）
  const cav = rectPts(-88, 70, -48, 48, 10).reverse();
  const walls = prismXZ(rectPts(-93.4, 85.4, -57.4, 57.4, 10), [cav], 216, D.HEAD_Y1);
  // 燃烧室顶：每个缸一块带气门孔与火花塞孔的圆盘
  const roofs = [];
  for (const x of CYL_X){
    const holes = [circlePts(x - D.VDX, 0, 5.4, 24, false), circlePts(x + D.VDX, 0, 5.4, 24, false),
                   circlePts(x, 24, 7.2, 20, false)];
    roofs.push(prismXZ(circlePts(x, 0, 37.4, 56), holes, 211, 217));
  }
  // 缸盖散热片（比缸体短，环绕凸轮腔外壁）
  const hfins = [];
  for (const y of [221, 236, 251]) hfins.push(prismXZ(rectPts(-86, 88, -70, 70, 10), [cav], y, y + 4));
  g.add(new THREE.Mesh(mergeGeos([deck, walls, ...roofs, ...hfins]), M.head));
  // 气门导管
  for (const x of CYL_X) for (const s of [-D.VDX, D.VDX]){
    g.add(new THREE.Mesh(cylY(206, 233, 6.5, 16).translate(x + s, 0, 0), M.steelDark));
  }
  // 凸轮轴承座（跨在内腔两侧壁之间）
  for (const x of [-60, 52]){
    const parts2 = [ringX(x - 12, x + 12, 12.2, 17, 24).translate(0, D.CAM_Y, 0)];
    for (const z of [-26, 26]) parts2.push(boxG(24, 8, 32, x, D.CAM_Y, z));
    g.add(new THREE.Mesh(mergeGeos(parts2), M.head));
  }
  addPart('head', '气缸盖', g, M.head, { shell: true });
}

/* ---------- 12 气门组 ×4（杆顶 240，弹簧 210~236，弹簧座 234~240） ---------- */
for (let i = 0; i < 2; i++) for (const [k, z, dia] of [[0, 0, 34], [1, 0, 30]]){
  const x = valveX(i, k ? 'ex' : 'im');
  const g = new THREE.Group(), node = new THREE.Group();
  node.position.set(x, D.VSEAT, z);
  node.add(new THREE.Mesh(mergeGeos([latheY([[0, 0], [0, dia / 2 - 2], [1.5, dia / 2], [3, dia / 2 - 3],
    [5, dia / 2 - 9], [7, 3.6], [37, 3.6], [37, 0]], 40)]), M.valve));
  const spring = new THREE.Mesh(helixY(0, D.SPR_FREE, 13, 1.9, 6, 7), M.spring);
  spring.position.y = D.SPR_BASE;
  node.add(spring);
  const ret = new THREE.Mesh(latheY([[0, 3.6], [0, 14], [5, 14], [5, 3.6]], 26), M.steelDark);
  ret.position.y = 32;
  node.add(ret);
  g.add(node);
  addPart('valve' + (i + 1) + (k ? 'e' : 'i'), '气门 ' + (i + 1) + (k ? '排' : '进'), g, M.valve);
  MECH.valves.push({ node, spring, ret, x, z, kind: k ? 'ex' : 'im', i });
}

/* ---------- 12b 气门挺柱 ×4（凸轮直接压在挺柱顶面） ---------- */
for (let i = 0; i < 2; i++) for (const kind of ['im', 'ex']){
  const side = kind === 'im' ? -1 : 1, x = valveX(i, kind), z = side * D.VZ;
  const g = new THREE.Group(), node = new THREE.Group();
  node.position.set(x, 0, z);
  const geos = [cylY(D.TAPPET_TOP - 18.05, D.TAPPET_TOP, D.TAPPET_R, 28)];
  geos.push(cylY(D.TAPPET_TOP - 4, D.TAPPET_TOP, D.TAPPET_R - 1.2, 28));   // 顶面硬化片
  node.add(new THREE.Mesh(mergeGeos(geos), M.steel));
  g.add(node);
  addPart('tappet' + (i + 1) + (kind === 'im' ? 'i' : 'e'), '挺柱 ' + (i + 1) + (kind === 'im' ? '进' : '排'), g, M.steel);
  MECH.tappets.push({ node, i, kind, x, z });
}

/* ---------- 13 凸轮轴 ---------- */
{
  const g = new THREE.Group(), spin = new THREE.Group(); spin.position.set(0, D.CAM_Y, 0);
  const geos = [cylX(D.CAM_X0, D.CAM_X1, D.CAM_RX, 32)];
  for (let i = 0; i < 2; i++) for (const kind of ['im', 'ex']){
    const xc = lobeX(i, kind);
    const psiPeak = PEAK[kind] / 2 + i * 180;                       // 该凸轮到达峰值的凸轮轴转角
    const mid = -psiPeak * DEG;      // 挺柱在凸轮正下方：跟随者方位 = 0°
    const half = DUR_CAM * DEG / 2;                 // 升程包半宽（凸轮角）
    MECH.lobes.push({ mid, half, h: D.CAM_LIFT, xc, kind, i });
    // 几何里的角度是"点相对 +y 的方位角"，挺柱在 -y（方位 π）：
    // 凸轮转过 camDeg 后，方位角 = mid + camDeg，要压在挺柱上就得 mid_geo = mid_math + π
    const midGeo = mid + Math.PI;
    geos.push(lobeGeo(xc - 6, xc + 6, camRadiusFn([{ mid: midGeo, half, h: D.CAM_LIFT }]), 168));
  }
  spin.add(new THREE.Mesh(mergeGeos(geos), M.cam));
  spin.add(new THREE.Mesh(mergeGeos([boxG(12, 6, 4, D.CAM_X1 - 14, 13, 0)]), M.accent));  // 键槽标记
  g.add(spin);
  addPart('camshaft', '凸轮轴', g, M.cam);
  MECH.camSpin = spin;
}

/* ---------- 16/17 链轮 ---------- */
const sprocketR = teeth => D.CH_PITCH / (2 * Math.sin(Math.PI / teeth));      // 齿形节圆（画齿用）
const sprocketPitchR = teeth => D.CH_PITCH * teeth / TAU;                     // 链条节圆：每齿走一个节距
{
  const r1 = sprocketR(D.SPR_N);
  const g = new THREE.Group(), spin = new THREE.Group();
  spin.position.set(D.CHAIN_X, 0, 0);
  spin.add(new THREE.Mesh(toothedRingX(-4, 4, r1 - 4.5, r1, D.SPR_N, 7), M.steelDark));
  spin.add(new THREE.Mesh(cylX(-5.5, 5.5, 8, 20), M.steelDark));
  g.add(spin);
  addPart('crankSprocket', '曲轴链轮 ' + D.SPR_N + 'T', g, M.steelDark);
  MECH.crankSpr = spin;
}
{
  const r2 = sprocketR(D.SPR_M);
  const g = new THREE.Group(), spin = new THREE.Group();
  spin.position.set(D.CHAIN_X, D.CAM_Y, 0);
  spin.add(new THREE.Mesh(toothedRingX(-4, 4, r2 - 5, r2, D.SPR_M, 11), M.steelDark));
  spin.add(new THREE.Mesh(toothedRingX(-3, 3, 13, 30, 6, 9), M.steelDark));   // 减重孔盘
  spin.add(new THREE.Mesh(cylX(-6, 6, 10, 20), M.steelDark));
  spin.add(new THREE.Mesh(mergeGeos([boxG(5, 4, 4, 0, r2 - 6, 0)]), M.accent));  // 正时记号
  g.add(spin);
  addPart('camSprocket', '凸轮链轮 ' + D.SPR_M + 'T', g, M.steelDark);
  MECH.camSpr = spin;
}

/* ---------- 18 正时链（真实闭合环，逐节沿路径推进） ---------- */
{
  const r1 = sprocketPitchR(D.SPR_N), r2 = sprocketPitchR(D.SPR_M);
  const pts = chainPolyline({ y: 0, z: 0 }, { y: D.CAM_Y, z: 0 }, r1, r2);
  const seg = [], cum = [0];
  for (let i = 0; i < pts.length; i++){
    const a = pts[i], b = pts[(i + 1) % pts.length];
    seg.push({ a, b, len: Math.hypot(b.y - a.y, b.z - a.z) });
    cum.push(cum.at(-1) + seg.at(-1).len);
  }
  MECH.chainPath = { pts, seg, cum, total: cum.at(-1) };
  const count = Math.round(MECH.chainPath.total / D.CH_PITCH);
  const parts2 = [];
  for (const x of [-2.7, 2.7]) parts2.push(boxG(1.2, 10, 5.2, x, 0, 0));
  for (const y of [-D.CH_PITCH / 2, D.CH_PITCH / 2]){
    const c = new THREE.CylinderGeometry(1.7, 1.7, 6.8, 10); c.rotateZ(Math.PI / 2); c.translate(0, y, 0); parts2.push(c);
  }
  const inst = new THREE.InstancedMesh(mergeGeos(parts2), M.chain, count);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.frustumCulled = false;
  const root = new THREE.Group(); root.position.set(D.CHAIN_X, 0, 0); root.add(inst);
  addPart('camChain', '正时链 ' + count + ' 节', root, M.chain);
  MECH.chain = { inst, count };
}

/* ---------- 19 气门室盖 ---------- */
{
  const g = new THREE.Group();
  const body = prismXZ(rectPts(-96, 88, -62, 62, 12), [], D.HEAD_Y1 - .6, D.COVER_Y1 - 10);
  const top = prismXZ(rectPts(-90, 82, -54, 54, 12), [], D.COVER_Y1 - 11, D.COVER_Y1);
  g.add(new THREE.Mesh(mergeGeos([body, top]), M.cover));
  for (const x of [-86, 74]) for (const z of [-44, 44]){
    g.add(new THREE.Mesh(cylY(D.COVER_Y1 - 3, D.COVER_Y1 + 3, 5, 12).translate(x, 0, z), M.steel));
  }
  addPart('valveCover', '气门室盖', g, M.cover, { shell: true });
}

/* ---------- 20 火花塞 ×2 ---------- */
{
  const g = new THREE.Group();
  for (const x of CYL_X){
    const px = x, pz = 24;
    g.add(new THREE.Mesh(latheY([[204, 0], [204, 3], [206, 4], [212, 4], [212, 6.5], [220, 6.5], [220, 4.5],
      [226, 8.5], [232, 8.5], [232, 0]], 28).translate(px, 0, pz), M.steelDark));
    g.add(new THREE.Mesh(latheY([[222, 0], [222, 9], [234, 9], [234, 0]], 24).translate(px, 0, pz), M.porcelain));
    const spark = new THREE.Mesh(new THREE.SphereGeometry(4.4, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
    spark.position.set(px, 202, pz); spark.visible = false; spark.userData.keepMat = true;
    g.add(spark);
    MECH.sparks.push(spark);
  }
  addPart('sparkPlugs', '火花塞 ×2', g, M.porcelain, { shadow: false });
}

/* ---------- 21 飞轮磁电机 ---------- */
{
  const g = new THREE.Group(), spin = new THREE.Group();
  const geos = [latheX([[D.ROTOR_X0 + 8, 0], [D.ROTOR_X0 + 8, 38], [D.ROTOR_X0, 60], [D.ROTOR_X0 + 5, 74],
    [D.ROTOR_X1 - 5, 74], [D.ROTOR_X1, 38], [D.ROTOR_X1, 0]], 64)];
  // 6 块永磁体：必须落在转子本体的轴向位置上（漏了 x 就会被丢在曲轴中间）
  const magX = (D.ROTOR_X0 + D.ROTOR_X1) / 2 + 1;
  for (let i = 0; i < 6; i++){
    const mg = boxG(22, 15, 8, magX, 62, 0); mg.rotateX(i * TAU / 6); geos.push(mg);
  }
  spin.add(new THREE.Mesh(mergeGeos(geos), M.rotor));
  // 起动齿圈：飞轮外缘的一圈齿（起动电机就咬在这里）
  spin.add(new THREE.Mesh(toothedRingX(D.ROTOR_X0 + 3, D.ROTOR_X0 + 11, 63, 74, D.RING_TEETH, 58), M.steelDark));
  // 齿圈铆钉
  const rivets = [];
  for (let i = 0; i < 6; i++){
    const r = new THREE.CylinderGeometry(3.2, 3.2, 3, 10);
    r.rotateZ(Math.PI / 2); r.translate(D.ROTOR_X0 + 1.5, 60, 0); r.rotateX(i * TAU / 6);
    rivets.push(r);
  }
  spin.add(new THREE.Mesh(mergeGeos(rivets), M.steel));
  // 点火正时刻度：T / F 两个记号，飞轮转一圈能读出上止点
  spin.add(new THREE.Mesh(mergeGeos([boxG(4, 7, 5, D.ROTOR_X0 + 7, 52, 0)]), M.accent));
  spin.add(new THREE.Mesh(mergeGeos([boxG(4, 5, 3, D.ROTOR_X0 + 7, 52, 20)]), M.accent));
  g.add(spin);
  addPart('rotor', '飞轮磁电机', g, M.rotor);
  MECH.rotor = spin;
}

/* ====== 包覆层级（透视分档） ====== */
{
  const boxes = parts.map(p => new THREE.Box3().setFromObject(p.g));
  parts.forEach((p, i) => {
    const A = boxes[i]; let n = 0;
    boxes.forEach((B, j) => {
      if (i === j) return;
      const wrapsY = B.min.y <= A.min.y + .5 && B.max.y >= A.max.y - .5;
      const wrapsZ = B.min.z <= A.min.z + .5 && B.max.z >= A.max.z - .5;
      const hitX = B.min.x < A.max.x - .5 && B.max.x > A.min.x + .5;
      if (wrapsY && wrapsZ && hitX) n++;
    });
    p.layer = Math.min(n, 3);
  });
}

/* ====== 运动学：几何 / 视图 / 读数 / 自检共用 ====== */
function pistonPinY(ca){
  const s = D.R * Math.sin(ca);
  return D.R * Math.cos(ca) + Math.sqrt(D.ROD * D.ROD - s * s);
}
function rodAngle(ca){                     // 连杆绕 x 的摆角（大头→小头）
  const s = D.R * Math.sin(ca);
  return Math.atan2(-s, Math.sqrt(D.ROD * D.ROD - s * s));
}
function camRadiusFn(lobes){
  return (a) => {
    let r = D.CAM_RB;
    for (const L of lobes){
      let d = a - L.mid;
      d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
      const u = d / L.half;
      if (Math.abs(u) < 1) r = Math.max(r, D.CAM_RB + L.h * .5 * (1 + Math.cos(Math.PI * u)));
    }
    return r;
  };
}
// 凸轮轴局部角（度）下的升程：凸轮几何、挺柱位移、气门位移、读数全部取自它
function camLift(localDeg, i, kind){
  const L = MECH.lobes.find(l => l.i === i && l.kind === kind);   // 每只气门只受自己那一个凸轮驱动
  if (!L) return 0;
  let d = localDeg - L.mid / DEG;
  d = ((d + 180) % 360 + 360) % 360 - 180;
  const u = d / (L.half / DEG);
  return Math.abs(u) < 1 ? L.h * .5 * (1 + Math.cos(Math.PI * u)) : 0;
}
function valveState(crankDeg, camDegIn){
  const camDeg = camDegIn === undefined ? crankDeg / 2 : camDegIn, out = [];
  for (let i = 0; i < 2; i++) for (const kind of ['im', 'ex']){
    const h = camLift(-camDeg, i, kind);
    out.push({ i, kind, lift: h, valveLift: h });
  }
  return out;
}
function sparkState(crankDeg){
  const c = ((crankDeg % 720) + 720) % 720;
  return [0, 1].map(i => {
    const raw = ((c - i * 360) % 720 + 720) % 720;      // 点火间隔 720°，不能按 360° 取模
    const dist = Math.min(raw, 720 - raw);
    return { i, on: dist < 8, phase: dist };
  });
}
/* 四冲程阶段（0=进气 1=压缩 2=做功 3=排气） */
function strokeOf(crankDeg, i){
  const c = ((crankDeg - i * 360) % 720 + 720) % 720;
  if (c < 180) return 2;        // 做功 0..180
  if (c < 360) return 3;        // 排气 180..360
  if (c < 540) return 0;        // 进气 360..540
  return 1;                     // 压缩 540..720
}

/* ====== 摆到某个曲轴角 ====== */
function applyMotion(crankDeg, camDegIn){
  const ca = crankDeg * DEG;
  const camRad = (camDegIn === undefined ? crankDeg / 2 : camDegIn) * DEG;
  if (MECH.crankSpin) MECH.crankSpin.rotation.x = ca;
  if (MECH.crankSpr) MECH.crankSpr.rotation.x = ca;
  if (MECH.rotor) MECH.rotor.rotation.x = ca;
  if (MECH.camSpin) MECH.camSpin.rotation.x = camRad;
  if (MECH.camSpr) MECH.camSpr.rotation.x = camRad;

  const cy = D.R * Math.cos(ca), cz = D.R * Math.sin(ca), ang = rodAngle(ca);
  for (let i = 0; i < 2; i++){
    const rod = MECH.rods[i];
    if (rod){ rod.position.set(CYL_X[i], cy, cz); rod.rotation.x = ang; }
    const pis = MECH.pistons[i];
    if (pis) pis.position.set(CYL_X[i], pistonPinY(ca), 0);
  }
  const vs = valveState(crankDeg, camDegIn);
  for (const v of MECH.valves){
    const st = vs.find(o => o.i === v.i && o.kind === v.kind);
    const lift = st ? st.valveLift : 0;
    v.node.position.y = D.VSEAT - lift;
    v.spring.scale.y = (D.SPR_FREE - lift) / D.SPR_FREE;
    v.ret.position.y = 32 - lift;
  }
  for (const t of MECH.tappets){
    const st = vs.find(o => o.i === t.i && o.kind === t.kind);
    t.node.position.y = -(st ? st.valveLift : 0);   // 挺柱与气门同步下行，顶面始终贴着凸轮
  }
  if (MECH.chain) updateChain(ca);
  for (const s of sparkState(crankDeg)){
    const el = MECH.sparks[s.i];
    if (el) el.visible = s.on;
  }
}

/* ====== 正时链路径与推进 ====== */
function chainPolyline(c1, c2, r1, r2, n = 26){
  const dy = c2.y - c1.y, dz = c2.z - c1.z, d = Math.hypot(dy, dz);
  const base = Math.atan2(dz, dy);
  const phi = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
  const P = (c, r, a) => ({ y: c.y + Math.cos(a) * r, z: c.z + Math.sin(a) * r });
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(P(c2, r2, base + phi - 2 * phi * (i / n)));   // 凸轮侧外弧
  for (let i = 1; i <= 6; i++){
    const t = i / 6, a = P(c2, r2, base - phi), b = P(c1, r1, base - phi);
    pts.push({ y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  }
  for (let i = 0; i <= n; i++) pts.push(P(c1, r1, base - phi - (TAU - 2 * phi) * (i / n)));  // 曲轴侧外弧
  for (let i = 1; i < 6; i++){
    const t = i / 6, a = P(c1, r1, base + phi), b = P(c2, r2, base + phi);
    pts.push({ y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  }
  pts.reverse();                                  // 与 +x 正转同向
  return pts;
}
function chainAt(path, s){
  s = ((s % path.total) + path.total) % path.total;
  let i = 0;
  while (i < path.seg.length - 1 && path.cum[i + 1] < s) i++;
  const g = path.seg[i], t = (s - path.cum[i]) / g.len;
  return {
    y: g.a.y + (g.b.y - g.a.y) * t,
    z: g.a.z + (g.b.z - g.a.z) * t,
    rotX: Math.atan2(g.b.y - g.a.y, g.b.z - g.a.z) - Math.PI / 2,
  };
}
function updateChain(crankRad){
  if (!MECH.chain) return;
  const { inst, count } = MECH.chain, path = MECH.chainPath;
  const s0 = sprocketPitchR(D.SPR_N) * crankRad;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < count; i++){
    const p = chainAt(path, s0 + i * D.CH_PITCH);
    e.set(p.rotX, 0, 0); q.setFromEuler(e);
    m.compose(V(0, p.y, p.z), q, V(1, 1, 1));
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
}

/* ====== 包围盒工具 ====== */
function moduleCenter(keys){
  const b = new THREE.Box3();
  for (const k of keys) b.union(new THREE.Box3().setFromObject(byKey.get(k).g));
  return b.getCenter(V());
}
function moduleBounds(keys){
  const b = new THREE.Box3();
  for (const k of keys) b.union(new THREE.Box3().setFromObject(byKey.get(k).g));
  return b;
}

/* ====== 对外接口（kit/scene.mjs 用） ====== */
export const MODEL = {
  world, byKey, moduleBounds, moduleCenter,
  PARTS: parts, MECH, D, pistonPinY, valveState, sparkState, strokeOf,
  // kit 传整个 view；发动机只关心两个角
  applyMotion: (view) => applyMotion(view.crankDeg, view.camDeg),
};
