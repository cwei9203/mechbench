import * as THREE from 'three';

/* 球形门锁 · 几何与运动（尺寸表 D、材质、全部几何、applyMotion 从旧项目 game.html 原样迁移，未改尺寸）
 * 基准：1 unit = 1 mm；锁轴 = 世界 x 轴；门板厚 40（x ∈ [-20,20]）；门边 z=60（背距 60）。
 * 锁舌行程 12.7（½"）；凸轮半径 12.7 → boltRetract(θ)=R(1−cosθ)，90° 正好 12.7 mm。
 * 21 件教学零件 + 门板局部 / 门框两件基准。零件清单见 notes.md。
 */
const world = new THREE.Group();

/* ============================== 尺寸基准 ==============================
 * 真机/标准：门板厚 40；通孔 Ø54；边孔 Ø25.4；背距 60；锁舌行程 12.7；面板 25.4×57×2.5；
 *   执手球 Ø57；装饰圈 Ø66×8；安装板 Ø50；对穿螺栓 M5（Ø4.6）；锁芯转子 Ø16、锁芯壳 Ø24、
 *   5 组弹子 Ø4.4、剪切线 y=8。
 * 教学估算：门板切片 40×180×120；螺丝头规格；离合行程 5；凸轮销 Ø5；弹子长度按 5 级齿高排布。
 * ================================================================== */
const D = {
  doorX: 20, doorY: 90, doorZBack: -60, doorZEdge: 60, boreR: 27.6, edgeBoreR: 12.7,
  faceZ: 60, faceT: 2.5, faceW: 25.4, faceH: 57, strikeW: 25.4, strikeH: 70,
  boltW: 12.7, boltH: 15.9, boltL: 26, throw: 12.7,
  tubeR0: 10.5, tubeR1: 11.5, tubeZ0: 17.6, tubeZ1: 57.5,
  spindleX0: -50, spindleX1: 27.5,
  plateOutX0: -19.5, plateOutX1: -15.5, plateInX0: 15.5, plateInX1: 19.5, plateR: 25,
  knobR: 28.5, knobInC: 59, knobOutC: -59,
  plugR: 8, plugX0: -83.5, plugX1: -53, housingR: 12, capY: 16,
  pinX: [-76, -71, -66, -61, -56],
  cutY: [1, -2, 0.5, -3, -1], wrongIndex: 2,
  plateX0: -39, plateX1: -34, diskR: 9,
  collarLock: -48, collarEngage: -43,
};

/* 半剖/半壳件的角向缩进：两半件对接处不留可见缝（≤0.002 rad ≈ 0.02 mm） */
const TRIM = 0.0015;

const RAD = Math.PI / 180;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* 行程/运动常量：几何与读数共用同一函数（单一状态量 boltRetract） */
const THROW = 12.7;
const CAM_R = 12.7;
const MAX_TURN = 90;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const boltRetract = (deg) => CAM_R * (1 - Math.cos(clamp(deg, 0, MAX_TURN) * Math.PI / 180));

const PART_NAMES = {
  latchHousing: '锁舌壳', latchBolt: '斜舌', latchSpring: '复位弹簧', retractor: '凸轮拨片',
  faceplate: '锁舌面板', faceScrews: '面板螺丝',
  strike: '扣板', strikeScrews: '扣板螺丝',
  spindle: '方轴·凸轮', plateOut: '外侧安装板', plateIn: '内侧安装板', throughBolts: '对穿螺栓',
  roseOut: '外装饰圈', roseIn: '内装饰圈',
  knobIn: '内球形执手', knobOut: '外球形执手', cylHousing: '锁芯壳', plug: '锁芯转子',
  pinStack: '五组弹子', clutch: '离合套', key: '钥匙',
  door: '门板局部', jamb: '门框',
};

/* ---------- 材质（每件 clone，剖切/还原都靠 userData.omat） ---------- */
const MAT = {
  nickel: new THREE.MeshPhysicalMaterial({ color: 0xdce1e4, metalness: .95, roughness: .19, clearcoat: .5, clearcoatRoughness: .25 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd2d8dc, metalness: 1, roughness: .24 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x7b8187, metalness: .9, roughness: .44 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xd3a85a, metalness: .95, roughness: .3 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xe3a93c, metalness: .78, roughness: .32 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xbcc5cb, metalness: 1, roughness: .26 }),
  plug: new THREE.MeshStandardMaterial({ color: 0x8d979f, metalness: .95, roughness: .34 }),
  teal: new THREE.MeshStandardMaterial({ color: 0x2f7d74, metalness: .35, roughness: .5 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb8452f, metalness: .3, roughness: .55 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xd6c3a3, roughness: .92, metalness: 0 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0xc2ac8b, roughness: .94, metalness: 0 }),
  spring: new THREE.MeshStandardMaterial({ color: 0xa7b0b6, metalness: 1, roughness: .34 }),
  // 门板在剖开时只变半透、不裁切（裁切会把门切掉半个，看着像坏掉了）
  woodGhost: new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: .9, metalness: .05,
    transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide }),
};

/* ---------- 几何助手 ---------- */
function lathe(prof, seg = 56) {   // [[x, r], ...] 绕 +x
  const pts = prof.map(([x, r]) => new THREE.Vector2(Math.max(r, 1e-3), x));
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateZ(-Math.PI / 2); g.computeVertexNormals(); return g;
}
function latheZ(prof, seg = 40) { const g = lathe(prof, seg); g.rotateY(-Math.PI / 2); return g; }
// 形状写世界 (z,y)，沿 +x 挤出 depth（x∈[x0, x0+depth]）
function extrudeAlongX(shape, depth, x0, seg = 48) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: seg });
  g.rotateY(Math.PI / 2); g.translate(x0, 0, 0); g.computeVertexNormals(); return g;
}
// 形状写世界 (x,z)，沿 y 挤出 depth
function extrudeAlongY(shape, depth, y0 = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.rotateX(Math.PI / 2); g.translate(0, y0, 0); g.computeVertexNormals(); return g;
}
const PX = (z, y) => [-z, y];
// 形状写 (x,y)，沿 +z 挤出 depth（z∈[z0, z0+depth]）
function extrudeAlongZ(shape, depth, z0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, z0); g.computeVertexNormals(); return g;
}
function annulusSector(rOut, rIn, a0, a1, seg = 48) {
  const pts = [];
  for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; pts.push(new THREE.Vector2(Math.cos(a) * rOut, Math.sin(a) * rOut)); }
  for (let i = seg; i >= 0; i--) { const a = a0 + (a1 - a0) * i / seg; pts.push(new THREE.Vector2(Math.cos(a) * rIn, Math.sin(a) * rIn)); }
  return new THREE.Shape(pts);
}
function rectShape(x0, y0, x1, y1, holes = []) {
  const s = new THREE.Shape();
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath();
  holes.forEach(h => s.holes.push(h)); return s;
}
function rectHole(x0, y0, x1, y1) {
  const p = new THREE.Path();
  p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); return p;
}
function shapeFromPts(pts, holes = []) {
  const s = new THREE.Shape();
  pts.forEach(([z, y], i) => { const [u, v] = PX(z, y); if (i) s.lineTo(u, v); else s.moveTo(u, v); });
  s.closePath();
  holes.forEach(h => s.holes.push(h));
  return s;
}
function circlePts(r, cx = 0, cy = 0, seg = 40, a0 = 0, a1 = Math.PI * 2) {
  const out = [];
  for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
function holeCircle(r, cx = 0, cy = 0) {
  const p = new THREE.Path(); p.absarc(-cx, cy, r, 0, Math.PI * 2, true); return p;  // shape 坐标 u=-z
}
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
function cylX(r, len, mat, x = 0, seg = 32) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); return mesh(g, mat, x); }
function cylY(r, len, mat, x = 0, y = 0, z = 0, seg = 24) { return mesh(new THREE.CylinderGeometry(r, r, len, seg), mat, x, y, z); }
function cylZ(r, len, mat, x = 0, y = 0, z = 0, seg = 24) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); return mesh(g, mat, x, y, z); }
function box(w, h, d, mat, x = 0, y = 0, z = 0) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }
function coilZ(radius, wire, len, turns, mat, seg = 6) {
  const n = Math.round(turns * 20), pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * Math.PI * 2; pts.push(V(radius * Math.cos(a), radius * Math.sin(a), len * t)); }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, seg, false), mat);
}
function coilY(radius, wire, len, turns, mat, seg = 6) {
  const n = Math.round(turns * 18), pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * Math.PI * 2; pts.push(V(radius * Math.cos(a), len * t, radius * Math.sin(a))); }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, seg, false), mat);
}

/* ---------- 零件注册（逐件表见 notes.md） ----------
 * g 是 kit 用来摆位的组（装配位/悬浮位）；obj 是零件自身的组，运动只改 obj，
 * 这样 kit 每帧写 g.position 时不会把拨片/离合/钥匙的运动量清掉。
 * ================================================================ */
const parts = [], byKey = new Map(), R = { pins: [] };
function addPart(k, obj, mat, opt = {}) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.keepMat) o.material = mat.clone();
    o.userData.omat = o.material;
    o.castShadow = true; o.receiveShadow = true; o.userData.key = k;
  });
  const g = new THREE.Group(); g.userData.key = k; g.add(obj);
  world.add(g);
  const p = { key: k, name: PART_NAMES[k] || k, g, obj, shell: !!opt.shell };
  parts.push(p); byKey.set(k, p); return p;
}

/* ---------- 门板局部（四段：Ø55.2 通孔 + Ø25.4 边孔 + 面板沉槽，互不重叠） ---------- */
{
  const g = new THREE.Group();
  const X0 = -D.doorX, X1 = D.doorX, Y0 = -D.doorY, Y1 = D.doorY;
  // 后段 z -60..-27.6（沿 z 挤出）
  const sA = new THREE.Shape();
  sA.moveTo(X0, Y0); sA.lineTo(X1, Y0); sA.lineTo(X1, Y1); sA.lineTo(X0, Y1); sA.closePath();
  const bz = D.boreR;                            // 分段正好在孔的最大 z 处
  const gA = new THREE.ExtrudeGeometry(sA, { depth: -bz - D.doorZBack, bevelEnabled: false });
  gA.translate(0, 0, D.doorZBack); g.add(mesh(gA, MAT.wood));
  // 锁孔段 z -27.6..27.6（沿 x 挤出，形状含通孔）
  const ySlot = D.edgeBoreR, zMeet = Math.sqrt(D.boreR ** 2 - ySlot ** 2);
  const aMeet = Math.asin(ySlot / D.boreR);
  const sB = shapeFromPts([[bz, Y0], [bz, -ySlot], [zMeet, -ySlot]]
    .concat(circlePts(D.boreR, 0, 0, 48, -aMeet, -Math.PI * 2 + aMeet))
    .concat([[zMeet, ySlot], [bz, ySlot], [bz, Y1], [-bz, Y1], [-bz, Y0]]));
  g.add(mesh(extrudeAlongX(sB, D.doorX * 2, X0), MAT.wood));
  // 边孔段 z 27.6..57.5（沿 z 挤出，形状含 Ø25.4）
  const sC = new THREE.Shape();
  sC.moveTo(X0, Y0); sC.lineTo(X1, Y0); sC.lineTo(X1, Y1); sC.lineTo(X0, Y1); sC.closePath();
  sC.holes.push(holeCircle(D.edgeBoreR));
  const gC = new THREE.ExtrudeGeometry(sC, { depth: D.faceZ - D.faceT - bz, bevelEnabled: false });
  gC.translate(0, 0, bz); g.add(mesh(gC, MAT.woodDark));
  // 面板沉槽段 z 57.5..60
  const sD = new THREE.Shape();
  sD.moveTo(X0, Y0); sD.lineTo(X1, Y0); sD.lineTo(X1, Y1); sD.lineTo(X0, Y1); sD.closePath();
  sD.holes.push(rectHole(-D.faceW / 2, -D.faceH / 2, D.faceW / 2, D.faceH / 2));
  const gD = new THREE.ExtrudeGeometry(sD, { depth: D.faceT, bevelEnabled: false });
  gD.translate(0, 0, D.faceZ - D.faceT); g.add(mesh(gD, MAT.wood));
  addPart('door', g, MAT.wood);
  R.doorMeshes = [];
  g.traverse(o => { if (o.isMesh) R.doorMeshes.push(o); });
}

/* ---------- 门框（锁舌窝，开 28×80 教学观察窗） ---------- */
{
  const g = new THREE.Group(), zA = 63, zB = 75, zc = (zA + zB) / 2;
  const add = (w, h, x, y) => g.add(box(w, h, zB - zA, MAT.woodDark, x, y, zc));
  const winY = 40, winX = 14;
  add(60, D.doorY - winY, 0, (D.doorY + winY) / 2);
  add(60, D.doorY - winY, 0, -(D.doorY + winY) / 2);
  add(30 - winX, winY * 2, -(30 + winX) / 2, 0);
  add(30 - winX, winY * 2, (30 + winX) / 2, 0);
  addPart('jamb', g, MAT.woodDark);
}

/* ---------- 锁舌组件：壳 / 斜舌 / 弹簧 / 拨片 / 面板 / 面板螺丝 ---------- */
{
  const hs = new THREE.Group();
  // 锁舌壳开 100° 教学观察窗（+y 方向）
  const winA = 40 * Math.PI / 180, winB = 140 * Math.PI / 180;
  hs.add(mesh(extrudeAlongZ(annulusSector(D.tubeR1, D.tubeR0, winB, winA + Math.PI * 2), D.tubeZ1 - D.tubeZ0, D.tubeZ0), MAT.dark));
  // 前端整圈（锁舌出口导套）
  const frontRing = new THREE.Shape(circlePts(D.tubeR1, 0, 0, 40).map(([x, y]) => new THREE.Vector2(x, y)));
  const frontHole = new THREE.Path(); frontHole.absarc(0, 0, D.tubeR0, 0, Math.PI * 2, true); frontRing.holes.push(frontHole);
  hs.add(mesh(extrudeAlongZ(frontRing, 1.2, D.tubeZ1 - 1.2), MAT.dark));
  // 弹簧后座：内缘 Ø16.4 让拨片颈穿过
  hs.add(mesh(latheZ([[D.tubeZ0 - .2, 8.2], [D.tubeZ0 - .2, D.tubeR0], [D.tubeZ0, D.tubeR0], [D.tubeZ0, 8.2], [D.tubeZ0 - .2, 8.2]]), MAT.dark));
  addPart('latchHousing', hs, MAT.dark, { shell: true });

  const bw = D.boltW / 2;
  const bp = new THREE.Shape();
  bp.moveTo(-bw, -D.boltL); bp.lineTo(-bw, 0); bp.lineTo(0, 0); bp.lineTo(bw, -11); bp.lineTo(bw, -D.boltL); bp.closePath();
  const boltG = extrudeAlongY(bp, D.boltH, D.boltH / 2);
  boltG.translate(0, 0, D.faceZ + D.throw);
  const bolt = new THREE.Group(); bolt.add(mesh(boltG, MAT.steel));
  addPart('latchBolt', bolt, MAT.steel);

  const spring = new THREE.Group();
  const coil = coilZ(7.5, .45, 23.6, 12, MAT.spring);
  coil.position.z = D.tubeZ0 + .9; spring.add(coil);   // 两端各留 0.9，压缩时不顶到后座与拨片钩
  R.coil = coil; R.coilLen = 23.6;
  addPart('latchSpring', spring, MAT.spring);

  const ret = new THREE.Group();
  // 环形扇面：凸轮销（R=12.7，Ø5）压在扇面内缘上 → 方轴转 θ，拨片后移 R(1-cosθ)
  const sector = (() => {
    const a0 = -10 * Math.PI / 180, a1 = 100 * Math.PI / 180, ri = 13, ro = 19;
    const pts = [];
    for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24; pts.push([Math.cos(a) * ro, Math.sin(a) * ro]); }
    for (let i = 24; i >= 0; i--) { const a = a0 + (a1 - a0) * i / 24; pts.push([Math.cos(a) * ri, Math.sin(a) * ri]); }
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    return extrudeAlongZ(sh, 2, 15.3);
  })();
  ret.add(mesh(sector, MAT.teal));
  ret.add(box(10, 7.1, 2, MAT.teal, 0, 9.35, 16.3));   // 扇面 → 颈 连杆
  ret.add(box(10, 12, 27.7, MAT.teal, 0, 0, 28.85));   // 颈 z 15.3..43
  ret.add(box(11, 17, 3.7, MAT.teal, 0, 0, 44.85));    // 前钩 z 43..46.7
  addPart('retractor', ret, MAT.teal);

  const face = new THREE.Group();
  const fs = rectShape(-D.faceW / 2, -D.faceH / 2, D.faceW / 2, D.faceH / 2, [rectHole(-6.6, -8.2, 6.6, 8.2)]);
  face.add(mesh(extrudeAlongZ(fs, D.faceT, D.faceZ - D.faceT), MAT.chrome));
  addPart('faceplate', face, MAT.chrome, { shell: true });

  const screws = new THREE.Group();
  for (const y of [-19, 19]) {
    screws.add(cylZ(2.3, 12.5, MAT.steel, 0, y, D.faceZ - 6.75));
    screws.add(cylZ(4, 1.6, MAT.steel, 0, y, D.faceZ - 1.0));
  }
  addPart('faceScrews', screws, MAT.steel);
}

/* ---------- 扣板 + 螺丝 ---------- */
{
  const g = new THREE.Group();
  const s = rectShape(-12.7, -35, 12.7, 35, [rectHole(-10, -8.5, 10, 8.5)]);
  g.add(mesh(extrudeAlongZ(s, 2.4, 60.6), MAT.chrome));
  // 唇口：斜舌撞上的斜面
  const lip = new THREE.Shape(); lip.moveTo(10, 60.6); lip.lineTo(12.7, 60.6); lip.lineTo(10, 55); lip.closePath();
  g.add(mesh(extrudeAlongY(lip, 20, 10), MAT.chrome));
  addPart('strike', g, MAT.chrome);
  const sc = new THREE.Group();
  for (const y of [-28, 28]) { sc.add(cylZ(2.3, 9.5, MAT.steel, 0, y, 65.7)); sc.add(cylZ(4, 1.6, MAT.steel, 0, y, 62.0)); }
  addPart('strikeScrews', sc, MAT.steel);
}

/* ---------- 方轴 + 凸轮销 ---------- */
{
  const g = new THREE.Group();
  const len = D.spindleX1 - D.spindleX0;
  g.add(box(len, 8, 8, MAT.gold, (D.spindleX0 + D.spindleX1) / 2, 0, 0));
  g.add(box(8, 5, 12.7, MAT.gold, 0, 0, 6.35));          // 凸轮臂：轴心 → +z，R=12.7
  const pin = cylX(2.5, 8, MAT.brass, 0); pin.position.set(0, 0, 12.7); g.add(pin);
  g.add(box(57, 1.4, 1.4, MAT.red, -21, 3.4, 3.4));      // 转动标记（止于方孔外）
  R.camPin = pin;
  addPart('spindle', g, MAT.gold);
}

/* ---------- 安装板 + 对穿螺栓 ---------- */
{
  for (const [k, x0, x1] of [['plateOut', D.plateOutX0, D.plateOutX1], ['plateIn', D.plateInX0, D.plateInX1]]) {
    const s = shapeFromPts(circlePts(D.plateR, 0, 0, 48));
    s.holes.push(holeCircle(11));                        // 中心 Ø22（执手颈）
    for (const y of [-14, 14]) s.holes.push(holeCircle(2.5, 0, y));
    const g = new THREE.Group(); g.add(mesh(extrudeAlongX(s, x1 - x0, x0), MAT.dark));
    addPart(k, g, MAT.dark, { shell: true });
  }
  const gb = new THREE.Group();
  for (const y of [-14, 14]) {
    gb.add(cylX(2.3, 39.5, MAT.steel, 2.25).translateY(y));
    gb.add(cylX(4, 2.6, MAT.steel, 22.8).translateY(y));
  }
  addPart('throughBolts', gb, MAT.steel);
}

/* ---------- 两只装饰圈 ---------- */
{
  const prof = [[-.2, 20], [-.2, 32], [2, 33], [7.4, 33], [8, 32], [8, 20], [-.2, 20]];
  addPart('roseOut', new THREE.Group().add(mesh(lathe(prof.map(([dx, r]) => [-D.doorX - dx, r])), MAT.nickel)), MAT.nickel, { shell: true });
  addPart('roseIn', new THREE.Group().add(mesh(lathe(prof.map(([dx, r]) => [D.doorX + dx, r])), MAT.nickel)), MAT.nickel, { shell: true });
}

/* ---------- 球壳生成（前开口 + 内壁） ---------- */
function ballShell(c, rimR) {
  const R0 = D.knobR, R1 = 26.5;
  const aRim = Math.asin(Math.min(1, rimR / R0));
  const a0 = Math.PI - aRim, a1 = 2 * RAD;
  const prof = [];
  for (let i = 0; i <= 22; i++) { const a = a0 + (a1 - a0) * i / 22; prof.push([c + Math.cos(a) * R0, Math.sin(a) * R0]); }
  for (let i = 22; i >= 0; i--) { const a = a0 + (a1 - a0) * i / 22; prof.push([c + Math.cos(a) * R1, Math.max(1e-3, Math.sin(a) * R1)]); }
  prof.push(prof[0]);
  return lathe(prof, 56);
}

/* ---------- 内执手 ---------- */
{
  const g = new THREE.Group(), c = D.knobInC;
  const ball = mesh(ballShell(c, 9.5), MAT.nickel); ball.material.side = THREE.DoubleSide; g.add(ball);
  const ring = shapeFromPts(circlePts(9.5, 0, 0, 40), [(() => {
    const p = new THREE.Path(); const h = 4.2;
    p.moveTo(h, -h); p.lineTo(h, h); p.lineTo(-h, h); p.lineTo(-h, -h); p.closePath(); return p;
  })()]);
  g.add(mesh(extrudeAlongX(ring, 8.5, 19.5), MAT.nickel));   // 方孔套 x 19.5..28（避开拨片扇面扫掠区）
  g.add(cylX(9.5, 4, MAT.nickel, 30));
  const ridge = box(24, 2.2, 2.4, MAT.red, c - 12, 26.4, 0); ridge.rotation.z = -.22; g.add(ridge);
  g.add(cylY(3, 1.6, MAT.teal, c, 27.4, 0));
  addPart('knobIn', g, MAT.nickel, { shell: true });
}

/* ---------- 外执手（球前开口 + 颈 + 离合盘） + 锁芯壳 ---------- */
{
  const g = new THREE.Group(), c = D.knobOutC;
  const ball = mesh(ballShell(c, 10.3), MAT.nickel); ball.material.side = THREE.DoubleSide; g.add(ball);
  const ring = shapeFromPts(circlePts(9.5, 0, 0, 40), [holeCircle(6)]);
  g.add(mesh(extrudeAlongX(ring, 16.5, -32), MAT.nickel));   // 颈 Ø19 / 内 Ø12
  // 离合盘：OD18，±y 两个缺口，中心 Ø12
  const dpR = D.diskR, nW = 2.5, nD = 2.5;
  const dp = shapeFromPts([[-dpR, nW / 2], [-nD, nW / 2], [-nD, dpR], [nD, dpR], [nD, nW / 2], [dpR, nW / 2],
    [dpR, -nW / 2], [nD, -nW / 2], [nD, -dpR], [-nD, -dpR], [-nD, -nW / 2], [-dpR, -nW / 2]], [holeCircle(6)]);
  g.add(mesh(extrudeAlongX(dp, D.plateX1 - D.plateX0, D.plateX0), MAT.dark));
  addPart('knobOut', g, MAT.nickel, { shell: true });

  // 锁芯壳：下半管（教学半剖）+ 前端环 + 顶部封板
  const hs = new THREE.Group();
  const half = shapeFromPts(circlePts(D.housingR, 0, 0, 40, Math.PI + TRIM, Math.PI * 2 - TRIM)
    .concat(circlePts(D.plugR, 0, 0, 40, Math.PI * 2 - TRIM, Math.PI + TRIM).reverse()));
  const hx0 = D.plugX0 + 1, hx1 = D.plugX1 + 1;
  hs.add(mesh(extrudeAlongX(half, hx1 - hx0, hx0), MAT.dark));
  const bez = shapeFromPts(circlePts(D.housingR, 0, 0, 40), [holeCircle(D.plugR)]);
  hs.add(mesh(extrudeAlongX(bez, 2.2, hx0), MAT.dark));
  hs.add(box(D.pinX[4] - D.pinX[0] + 12, 1.4, 7, MAT.dark, (D.pinX[0] + D.pinX[4]) / 2, D.capY + .7, 0));
  addPart('cylHousing', hs, MAT.dark, { shell: true });
}

/* ---------- 锁芯转子（分段挤出：实心段带钥匙槽，弹子段上下贯通；半剖版另给一份） ---------- */
{
  const g = new THREE.Group();
  const aNotch = Math.asin(2.7 / D.plugR), aStart = aNotch - Math.PI / 2, aEnd = Math.PI * 1.5 - aNotch;
  const solidPts = [[2.7, 2.5], [2.7, -Math.sqrt(D.plugR ** 2 - 2.7 ** 2)]]
    .concat(circlePts(D.plugR, 0, 0, 40, aStart, aEnd)).concat([[-2.7, 2.5]]);
  const crescent = side => [[side * 2.7, Math.sqrt(D.plugR ** 2 - 2.7 ** 2)]]
    .concat(side > 0
      ? circlePts(D.plugR, 0, 0, 20, Math.PI / 2 - aNotch, aNotch - Math.PI / 2)
      : circlePts(D.plugR, 0, 0, 20, Math.PI / 2 + aNotch, Math.PI * 1.5 - aNotch));
  const xs = [D.plugX0];
  for (const px of D.pinX) xs.push(px - 2.7, px + 2.7);
  xs.push(D.plugX1);
  // 半剖版：把每段截面在 z=0 切掉 −z 半边（+z 半边留作剖切面）
  const posHalf = circlePts(D.plugR, 0, 0, 26, Math.PI / 2 + TRIM, Math.PI * 1.5 - TRIM)
    .concat([[-2.7, 2.5], [0, 2.5]]);
  const bandHalf = circlePts(D.plugR, 0, 0, 20, Math.PI / 2 + aNotch + TRIM, Math.PI * 1.5 - aNotch - TRIM);
  const fullG = new THREE.Group(), halfG = new THREE.Group();
  for (let i = 0; i < xs.length; i += 2) {
    fullG.add(mesh(extrudeAlongX(shapeFromPts(solidPts), xs[i + 1] - xs[i], xs[i]), MAT.plug));
    halfG.add(mesh(extrudeAlongX(shapeFromPts(posHalf), xs[i + 1] - xs[i], xs[i]), MAT.plug));
    if (i + 2 < xs.length) {
      const a = xs[i + 1], b = xs[i + 2];
      fullG.add(mesh(extrudeAlongX(shapeFromPts(crescent(1)), b - a, a), MAT.plug));
      fullG.add(mesh(extrudeAlongX(shapeFromPts(crescent(-1)), b - a, a), MAT.plug));
      halfG.add(mesh(extrudeAlongX(shapeFromPts(bandHalf), b - a, a), MAT.plug));
    }
  }
  g.add(fullG); halfG.visible = false; g.add(halfG);
  R.plugFull = fullG; R.plugHalf = halfG;

  // 尾片 + 螺旋凸轮（随转子转，推离合套）——必须先建好再加入零件，否则 kit 的材质还原会读到空的 omat
  const tail = new THREE.Group();
  tail.add(cylX(3, 5, MAT.steel, D.plugX1 - 2.5));
  const segs = 20, pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = -Math.PI / 2 + t * Math.PI / 2, x = D.collarLock + 5 * t;
    pos.push(x, Math.sin(a) * 9, Math.cos(a) * 9, x, Math.sin(a) * 3, Math.cos(a) * 3);
  }
  for (let i = 0; i < segs; i++) { const p = i * 2; idx.push(p, p + 2, p + 3, p, p + 3, p + 1); }
  const rgeo = new THREE.BufferGeometry();
  rgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rgeo.setIndex(idx); rgeo.computeVertexNormals();
  const rampMat = new THREE.MeshStandardMaterial({ color: 0x8d949a, metalness: .9, roughness: .4, side: THREE.DoubleSide });
  const rampMesh = new THREE.Mesh(rgeo, rampMat); rampMesh.userData.keepMat = true;
  tail.add(rampMesh); g.add(tail); R.tail = tail;
  addPart('plug', g, MAT.plug);
}

/* ---------- 弹子（5 组：下弹子 + 上弹子 + 簧；下弹子半剖版） ---------- */
{
  const g = new THREE.Group();
  R.pinSpin = new THREE.Group(); g.add(R.pinSpin);
  const shear = box(D.pinX[4] - D.pinX[0] + 9, .9, 7, MAT.red, (D.pinX[0] + D.pinX[4]) / 2, 8.3, -3.5);
  R.shear = shear; g.add(shear);
  const halfDisc = r => circlePts(r, 0, 0, 18, Math.PI / 2 + TRIM, Math.PI * 1.5 - TRIM);
  R.pinSpinHalf = new THREE.Group(); R.pinSpinHalf.visible = false; g.add(R.pinSpinHalf);
  D.pinX.forEach((px, i) => {
    const keyPin = cylY(2.6, 1, MAT.brass, px, 0, 0);
    const keyPinHalf = mesh(extrudeAlongY(shapeFromPts(halfDisc(2.6)), 1, 0), MAT.brass, px, 0, 0);
    const driver = cylY(2.6, 5, MAT.steel, px, 0, 0);
    const spr = coilY(2.3, .55, 3, 5, MAT.spring);
    R.pinSpin.add(keyPin); R.pinSpinHalf.add(keyPinHalf); g.add(driver); g.add(spr);
    R.pins.push({ px, keyPin, keyPinHalf, driver, spr, i });
  });
  addPart('pinStack', g, MAT.steel);
}

/* ---------- 离合套（Ø14 毂 + 2 爪；毂有真 8.1 方孔让方轴穿过） ---------- */
{
  const g = new THREE.Group();
  g.add(mesh(extrudeAlongX(shapeFromPts(circlePts(7, 0, 0, 32), [rectHole(-4.05, -4.05, 4.05, 4.05)]), 4, D.collarLock), MAT.teal));
  for (const s of [-1, 1]) g.add(box(4, 3, 3, MAT.teal, D.collarLock + 6, s * 6.2, 0));
  addPart('clutch', g, MAT.teal);
}

/* ---------- 钥匙 ---------- */
{
  const g = new THREE.Group();
  const cuts = D.cutY, px = D.pinX, yBot = -7.5;
  const pts = [[D.plugX1, yBot], [D.plugX0 - 25, yBot], [D.plugX0 - 25, 2.5], [D.plugX0 + .6, 2.5], [D.plugX0 + .6, cuts[0]]];
  for (let i = 0; i < 5; i++) {
    pts.push([px[i] - 2, cuts[i]], [px[i] + 2, cuts[i]]);
    if (i < 4) pts.push([px[i] + 3, cuts[i + 1]]);
  }
  pts.push([D.plugX1 + 1, yBot]);
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: false });
  geo.translate(0, 0, -2.0);
  g.add(mesh(geo, MAT.brass));
  const bow = new THREE.Shape();
  circlePts(12, 0, 0, 36).forEach(([x, y], i) => i ? bow.lineTo(x, y) : bow.moveTo(x, y));
  bow.closePath();
  const bowHole = new THREE.Path(); bowHole.absarc(0, 0, 6, 0, Math.PI * 2, true); bow.holes.push(bowHole);
  const bg = new THREE.ExtrudeGeometry(bow, { depth: 2.4, bevelEnabled: false });
  bg.rotateY(Math.PI / 2); bg.translate(D.plugX0 - 28.5, -2.5, 0);
  g.add(mesh(bg, MAT.brass));
  addPart('key', g, MAT.brass);
}

/* ============================== 运动（几何与读数同源） ============================== */
// 弹子列：bottom = 下弹子底面高度；len = 下弹子长度（由齿高定）；top = 底面+len
function pinState(st, keyIns) {
  return D.pinX.map((px, i) => {
    let target;
    if (st.keyKind === 'right') target = D.cutY[i];
    else if (st.keyKind === 'wrong') target = (i === D.wrongIndex ? D.cutY[i] - 1 : D.cutY[i]);
    else target = -8;
    const bottom = -8 + (target + 8) * keyIns;
    const len = 8 - D.cutY[i];
    return { px, bottom, len, top: bottom + len };
  });
}

/* 单一驱动量：拨片/锁舌后移 = boltRetract(方轴转角) + 视图里的按压脉冲 */
function boltPull(st, v) { return boltRetract(st.spindle || 0) + (v && v.push ? v.push : 0); }
/* 锁芯 0–90° 映射成离合套 5 mm 轴向行程 */
function clutchShift(st) { return (D.collarEngage - D.collarLock) * (clamp(st.plug || 0, 0, MAX_TURN) / MAX_TURN); }

function applyMotion(v, st) {
  const pull = boltPull(st, v);
  byKey.get('latchBolt').obj.position.z = -pull;
  byKey.get('retractor').obj.position.z = -pull;
  R.coil.scale.z = Math.max(.08, (R.coilLen - pull) / R.coilLen);

  const spindleDeg = clamp(st.spindle || 0, 0, MAX_TURN);
  byKey.get('spindle').obj.rotation.x = spindleDeg * RAD;
  byKey.get('knobIn').obj.rotation.x = clamp(st.knobIn || 0, 0, MAX_TURN) * RAD;
  byKey.get('knobOut').obj.rotation.x = clamp(st.knobOut || 0, 0, MAX_TURN) * RAD;
  byKey.get('clutch').obj.rotation.x = spindleDeg * RAD;
  byKey.get('clutch').obj.position.x = clutchShift(st);

  const plugDeg = clamp(st.plug || 0, 0, MAX_TURN);
  byKey.get('plug').obj.rotation.x = plugDeg * RAD;
  byKey.get('key').obj.rotation.x = plugDeg * RAD;
  const ins = clamp(st.keyInserted || 0, 0, 1);
  byKey.get('key').obj.position.x = -26.5 * (1 - ins);
  byKey.get('key').obj.visible = ins > .02;
  R.tail.rotation.x = plugDeg * RAD;

  // 剖开：锁芯转子与下弹子换半剖件，剪切线亮出来（kit 只管 p.shell 的件）
  const cutting = !!v.cut;
  R.plugFull.visible = !cutting;
  R.plugHalf.visible = cutting;
  R.pinSpin.visible = !cutting;
  R.pinSpinHalf.visible = cutting;
  R.shear.visible = cutting || st.chapter === 2 || st.phase === 'lab';

  const ps = pinState(st, ins);
  ps.forEach((p, i) => {
    const r = R.pins[i], bad = st.keyKind === 'wrong' && i === D.wrongIndex;
    r.keyPin.scale.y = p.len; r.keyPin.position.y = p.bottom + p.len / 2;
    r.keyPinHalf.scale.y = p.len; r.keyPinHalf.position.y = p.bottom + p.len / 2;
    r.driver.position.y = p.top + 2.5;
    r.spr.position.y = p.top + 5;
    r.spr.scale.y = Math.max(.2, (D.capY - (p.top + 5)) / 3);
    const km = bad ? MAT.red : MAT.brass, dm = bad ? MAT.red : MAT.steel;
    if (r.keyPin.material !== km) r.keyPin.material = km;
    if (r.keyPinHalf.material !== km) r.keyPinHalf.material = km;
    if (r.driver.material !== dm) r.driver.material = dm;
  });

  // 门板：剖开时变半透（不裁切，避免看起来被切成半个）
  const doorMat = cutting ? MAT.woodGhost : null;
  for (const o of R.doorMeshes) {
    const want = doorMat || o.userData.omat;
    if (o.material !== want) o.material = want;
  }
}

function moduleBounds(keys) {
  const b = new THREE.Box3();
  for (const k of keys) {
    const p = byKey.get(k);
    if (p) b.union(new THREE.Box3().setFromObject(p.g));
  }
  return b;
}

export const MODEL = {
  world, byKey, PARTS: parts, moduleBounds, applyMotion,
  boltPull, clutchShift, boltRetract, pinState,
  D, R, THROW, CAM_R, MAX_TURN, PART_NAMES,
};
