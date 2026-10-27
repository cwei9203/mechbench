import * as THREE from 'three';

/* 比较式投币器 · 几何与运动（唯一真源）
 * 基准 1 unit = 1 mm。整体包络约 131×214×46 mm（含背面安装凸台、底部接币盒/退币杯、右侧电磁铁外罩）；前盖 124×178×5。内部为教学排布。
 *
 * 零件表（编号 · 名称 · 依据 / 建模尺寸 · 结论）
 * 01 base        底板与机架   120×174×6 铝板 + 4 橡胶脚；同类整机包络取整
 * 02 runway      币道+厚度门  弧形槽轨，槽宽 2.6；1 元(1.85)过，厚垫圈(3.2)被挡
 * 03 entry       投币口/入口  喇叭口 + 前面板槽口，币立姿进入
 * 04 returnBtn   退币按钮+推杆 红色按钮 Ø18、行程 4；纯机械旁路
 * 05 cashbox     接币盒+退币杯 透明接币盒、回收杯；两个出口分开
 * 06 sampleHolder 样币座    右上，透明窗，弹簧夹
 * 07 sampleCoin  样币        1 元 Ø25.0×1.85 或 游戏币 Ø24.0×1.80（黄铜）
 * 08 coil        双线圈      测试线圈/参考线圈各 4 圈，铜线 Ø1.6；桥路两臂
 * 09 board       比较器板    34×28 PCB、比较器、灵敏度电位器、表头、LED
 * 10 pot         灵敏度旋钮  旋钮 Ø16 穿前盖，行程 0..10
 * 11 gate        分选活门+弹簧 活门 15 mm、回位弹簧；默认退币位
 * 12 solenoid    电磁铁      12 V，行程 8 mm，拉杆扣活门尾
 * 13 counter     机械计数表  双拨盘 0..99，币身拨棘爪
 * 14 cover       前盖面板    120×174×5，四个真开孔+透明窗
 * 15 coin        投入币（场景件，不注册零件）五种币，Ø20.5..25、厚 1.65..3.2
 *
 * 币道中心线：立姿硬币在 x-y 平面内沿弧线滚动，厚度方向 z；币面中心 z=-8.4。
 * 入口(-34,78) → 厚度门(-33,44) → 测试线圈(-12,6) → 活门(34,-34) → 接币盒/退币杯。
 */
const world = new THREE.Group();

const M = {
  alu:     new THREE.MeshPhysicalMaterial({ color: 0xb6bcc4, metalness: .72, roughness: .42, clearcoat: .25, clearcoatRoughness: .55 }),
  aluDark: new THREE.MeshStandardMaterial({ color: 0x747c86, metalness: .65, roughness: .5 }),
  steel:   new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: .95, roughness: .25 }),
  dark:    new THREE.MeshStandardMaterial({ color: 0x30343a, metalness: .3, roughness: .62 }),
  black:   new THREE.MeshStandardMaterial({ color: 0x1d2024, metalness: .2, roughness: .7 }),
  rubber:  new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: .95 }),
  brass:   new THREE.MeshStandardMaterial({ color: 0xc9a24e, metalness: .9, roughness: .32 }),
  copper:  new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: .9, roughness: .3, emissive: 0x3a1705, emissiveIntensity: .35 }),
  pcb:     new THREE.MeshStandardMaterial({ color: 0x24684f, roughness: .75 }),
  chip:    new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: .55 }),
  red:     new THREE.MeshStandardMaterial({ color: 0xc2452d, roughness: .5 }),
  glow:    new THREE.MeshStandardMaterial({ color: 0x66d18f, emissive: 0x2f9a5e, emissiveIntensity: 1.4, roughness: .4 }),
  clear:   new THREE.MeshPhysicalMaterial({ color: 0xcfe3ea, metalness: 0, roughness: .08, transmission: .85, transparent: true, opacity: .32, depthWrite: false }),
  nickel:  new THREE.MeshStandardMaterial({ color: 0xd2d7dd, metalness: .88, roughness: .28 }),
  brassCoin: new THREE.MeshStandardMaterial({ color: 0xd4ad58, metalness: .82, roughness: .32 }),
  steelCoin: new THREE.MeshStandardMaterial({ color: 0x59616a, metalness: .9, roughness: .34 }),
  yellow:  new THREE.MeshStandardMaterial({ color: 0xe0b13f, roughness: .5 }),
  white:   new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: .8 }),
};

const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const group = () => new THREE.Group();
const mesh = (g, m, parent, pos) => { const o = new THREE.Mesh(g, m); if (pos) o.position.copy(pos); if (parent) parent.add(o); return o; };
const box = (w, h, d, m, parent, pos) => mesh(new THREE.BoxGeometry(w, h, d), m, parent, pos);
const cylZ = (r, h, m, parent, pos, seg = 32) => { const o = mesh(new THREE.CylinderGeometry(r, r, h, seg), m, parent, pos); o.rotation.x = Math.PI / 2; return o; };
const cylY = (r, h, m, parent, pos, seg = 32) => mesh(new THREE.CylinderGeometry(r, r, h, seg), m, parent, pos, seg);
const cylX = (r, h, m, parent, pos, seg = 32) => { const o = cylY(r, h, m, parent, pos, seg); o.rotation.z = Math.PI / 2; return o; };
const torusZ = (r, wire, m, parent, pos) => mesh(new THREE.TorusGeometry(r, wire, 10, 48), m, parent, pos);
const torusY = (r, wire, m, parent, pos) => { const o = mesh(new THREE.TorusGeometry(r, wire, 10, 48), m, parent, pos); o.rotation.x = Math.PI / 2; return o; };
function wire(pts, r, m, parent) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p)), false, 'chordal'), Math.max(20, pts.length * 5), r, 7, false), m, parent);
}
function polyWire(pts, r, m, parent) {
  const g = group();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = V(...pts[i]), b = V(...pts[i + 1]);
    const d = b.clone().sub(a), len = d.length();
    const c = mesh(new THREE.CylinderGeometry(r, r, len + r * 1.2, 8), m, g);
    c.position.copy(a).add(b).multiplyScalar(.5);
    c.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    mesh(new THREE.SphereGeometry(r * 1.05, 8, 6), m, g, a);
  }
  const end = V(...pts[pts.length - 1]);
  mesh(new THREE.SphereGeometry(r * 1.05, 8, 6), m, g, end);
  parent.add(g);
  return g;
}
function rrect(x0, y0, x1, y1, r) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
function holeRect(x0, y0, x1, y1, r) {
  const p = new THREE.Path();
  p.moveTo(x0 + r, y0); p.quadraticCurveTo(x0, y0, x0, y0 + r);
  p.lineTo(x0, y1 - r); p.quadraticCurveTo(x0, y1, x0 + r, y1);
  p.lineTo(x1 - r, y1); p.quadraticCurveTo(x1, y1, x1, y1 - r);
  p.lineTo(x1, y0 + r); p.quadraticCurveTo(x1, y0, x1 - r, y0);
  p.closePath();
  return p;
}
function panel(x0, y0, x1, y1, r, holes, thick, z, m, parent) {
  const s = rrect(x0, y0, x1, y1, r);
  for (const h of holes) {
    if (h.kind === 'circle') { const p = new THREE.Path(); p.absarc(h.x, h.y, h.r, 0, TAU, true); s.holes.push(p); }
    else s.holes.push(holeRect(h.x0, h.y0, h.x1, h.y1, h.r || 1));
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 20 });
  g.translate(0, 0, z);
  return mesh(g, m, parent);
}
function printLabel(text, w, h, parent, pos, rotY = 0, color = '#6d6558') {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(32, Math.round(512 * h / w));
  const ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.font = `700 ${Math.floor(c.height * .62)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const o = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), parent, pos);
  o.rotation.y = rotY; o.userData.label = true; o.userData.keepMat = true;
  return o;
}
function springUnit(turns = 7, radius = 2.2, wireR = .45) {
  const pts = [];
  const n = turns * 28;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * TAU;
    pts.push([radius * Math.cos(a), t, radius * Math.sin(a)]);
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), n, wireR, 6, false);
}
function placeSpring(obj, a, b) {
  const d = b.clone().sub(a), len = Math.max(1, d.length());
  obj.position.copy(a);
  obj.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  obj.scale.set(1, len, 1);
}

/* ---------- 硬币规格（几何/逻辑唯一来源） ---------- */
export const COINS = {
  yuan:   { name: '1 元',   d: 25.0, t: 1.85, mat: 'nickel', label: '1',  color: 0xd2d7dd },
  token:  { name: '游戏币', d: 24.0, t: 1.80, mat: 'brass',  label: '★',  color: 0xd4ad58 },
  jiao:   { name: '5 角',   d: 20.5, t: 1.65, mat: 'nickel', label: '5',  color: 0xd2d7dd },
  fake:   { name: '铜章',   d: 25.0, t: 1.80, mat: 'brass',  label: '章', color: 0xc79c45 },
  washer: { name: '厚垫圈', d: 25.0, t: 3.20, mat: 'steel',  label: '垫', color: 0x8f969e, hole: 8 },
};
export const SAMPLES = { yuan: COINS.yuan, token: COINS.token };
const GATE_MAX_T = 2.6;          // 厚度门净宽
const REF_R = 12.5;              // 1 元半径，币道基准
const COIN_Z = -8.4;
const GATE_T = 0.72;             // 主币道在整条参数里的占比

/* ---------- 币道中心线 ---------- */
const mainPts = [[-34, 78], [-34, 56], [-33, 44], [-30, 32], [-24, 20], [-16, 10], [-8, 2], [2, -8], [14, -18], [26, -27], [34, -34]];
const acceptPts = [[34, -34], [36, -46], [36, -60], [36, -76], [36, -96]];
const rejectPts = [[34, -34], [27, -39], [18, -45], [6, -51], [-8, -55], [-18, -60], [-18, -76], [-18, -96]];
const mkCurve = (pts, z = COIN_Z) => new THREE.CatmullRomCurve3(pts.map((p) => V(p[0], p[1], z)), false, 'catmullrom', .25);
const mainCurve = mkCurve(mainPts), acceptCurve = mkCurve(acceptPts), rejectCurve = mkCurve(rejectPts);
const L_MAIN = mainCurve.getLength(), L_ACC = acceptCurve.getLength(), L_REJ = rejectCurve.getLength();
function nearestU(curve, x, y) {
  let best = 0, bd = 1e9;
  for (let i = 0; i <= 600; i++) {
    const p = curve.getPointAt(i / 600);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = i / 600; }
  }
  return best;
}
const U_BLOCK = nearestU(mainCurve, -33, 44);
const U_COIL = nearestU(mainCurve, -12, 6);
export const STATIONS = { block: U_BLOCK * GATE_T, stop: Math.max(0, U_BLOCK * GATE_T - .13), coil: U_COIL * GATE_T, gate: GATE_T, end: 1 };
const DIR = (u) => { const t = mainCurve.getTangentAt(u); return { x: t.x, y: t.y, a: Math.atan2(t.y, t.x) }; };


/* ---------- 零件注册 ---------- */
const parts = [], byKey = new Map(), PIV = {};
function addPart(key, name, obj, mat, opt = {}) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.keepMat) o.material = (o.userData.mat || o.material || mat).clone();
    o.userData.omat = o.material;
    o.userData.key = key;
  });
  const g = new THREE.Group(); g.add(obj); g.userData.key = key;
  world.add(g);
  const p = { key, name, g, obj, anim: new THREE.Vector3(), shell: !!opt.shell };
  parts.push(p); byKey.set(key, p);
  return p;
}

/* ---------- 01 底板与机架 ---------- */
{
  const g = group();
  panel(-62, -86, 62, 92, 7, [], 6, -18, M.alu, g);                 // 背板 -18..-12
  for (const [x, y] of [[-52, -76], [52, -76], [-52, 82], [52, 82]]) {
    box(10, 8, 12, M.dark, g, V(x, y, -18 - 3));
  }
  for (const x of [-48, 0, 48]) box(8, 4, 4, M.aluDark, g, V(x, -40, -10.5)); // 加强筋
  for (const s of [-1, 1]) box(8, 18, 40, M.aluDark, g, V(s * 58, -95, -1));
  for (const s of [-1, 1]) cylY(6, 6, M.rubber, g, V(s * 58, -107, -1), 14);
  for (const [x, y] of [[-40, 18], [-40, -24]]) {                           // 线圈定位柱
    cylZ(3, 2, M.aluDark, g, V(x, y, -11.6), 12);
  }
  box(36, 1.2, .3, M.aluDark, g, V(0, 88, -11.9));
  addPart('base', '底板与机架', g, M.alu);
}

/* ---------- 02 币道 + 厚度门 ---------- */
{
  const g = group();
  const N = 46;
  for (let i = 0; i < N - 2; i++) {
    const u0 = i / N, u1 = (i + 1) / N;
    const p0 = mainCurve.getPointAt(u0), p1 = mainCurve.getPointAt(u1);
    const mid = p0.clone().add(p1).multiplyScalar(.5);
    const tan = mainCurve.getTangentAt((u0 + u1) / 2);
    const ang = Math.atan2(tan.y, tan.x), len = p0.distanceTo(p1) + 1.1;
    const rail = box(len, 4, 3.2, M.aluDark, g);
    rail.position.set(mid.x, mid.y - REF_R - 2, mid.z); rail.rotation.z = ang;
    const lip = box(len, 5, .9, M.dark, g);
    lip.position.set(mid.x, mid.y - REF_R + 2, -6.75); lip.rotation.z = ang;
  }
  // 币道托脚：把轨道和底板连起来
  box(6, 2.4, 3, M.aluDark, g, V(-30, 15.8, -10.3));
  box(6, 2.4, 3, M.aluDark, g, V(11, -32.5, -10.3));
  // 厚度门：两片夹板，净缝 2.6；厚垫圈停在这里
  const gp = mainCurve.getPointAt(U_BLOCK), gt = mainCurve.getTangentAt(U_BLOCK);
  const gateG = group();
  gateG.position.copy(gp); gateG.rotation.z = Math.atan2(gt.y, gt.x);
  for (const s of [-1, 1]) {
    const jaw = box(11, 32, 2, M.steel, gateG, V(0, 0, s * (GATE_MAX_T / 2 + 1.0)));
    if (s > 0) jaw.userData.cutaway = true;   // 剖开时只留后夹板，能看见卡在缝里的币
  }
  for (const y of [-16, 16]) box(11, 2.4, 7.6, M.steel, gateG, V(0, y, 0));
  printLabel('2.6', 8, 3, gateG, V(0, 18.2, 3.82), 0, '#40382c');
  g.add(gateG);
  addPart('runway', '币道与厚度门', g, M.aluDark);
}

/* ---------- 03 投币口与入口 ---------- */
{
  const g = group();
  // 入口腔：前盖上的 3 mm 竖缝只容币厚；币以“边先入”的姿势进来，在腔内转 90° 后落到币道
  for (const s of [-1, 1]) box(4, 36, 21, M.dark, g, V(-34 + s * 19, 76, -1.4));
  box(38, 4, 21, M.dark, g, V(-34, 96, -1.4));
  for (const s of [-1, 1]) box(3, 30, 2.5, M.alu, g, V(-34 + s * 2.9, 78, 15.5));
  printLabel('投币口', 11, 3.6, g, V(-34, 99.5, 11.4), 0, '#4b463c');
  addPart('entry', '投币口与入口', g, M.dark);
}

/* ---------- 04 退币按钮与推杆 ---------- */
{
  const g = group();
  const btn = group(); btn.position.set(-52, 56, 14);
  cylZ(9, 5, M.red, btn, V(0, 0, 1.5), 28);
  cylZ(10.5, 1.5, M.aluDark, btn, V(0, 0, .8), 28);
  printLabel('退币', 9, 3.2, btn, V(0, 0, 4.2), 0, '#f5eee2');
  g.add(btn); PIV.retBtn = btn;
  box(4, 4, 24, M.steel, g, V(-52, 56, 2));
  const kick = group(); kick.position.set(-44, 64, -8.2);
  box(4, 22, 2.0, M.steel, kick, V(0, -9, 0));
  box(10, 4, 2.0, M.steel, kick, V(5, 2, 0));
  g.add(kick); PIV.kick = kick;
  box(6, 3, 6, M.aluDark, g, V(-47, 60, -5));
  box(6, 6, 4.5, M.aluDark, g, V(-47, 60, -9.75));
  addPart('returnBtn', '退币按钮与推杆', g, M.red);
}

/* ---------- 05 接币盒与退币杯 ---------- */
{
  const g = group();
  // 接受通道：两侧挡板把币导进接币盒，币面朝前保持可见
  for (const s of [-1, 1]) box(1.6, 40, 18, M.aluDark, g, V(36 + s * 14, -62, -3));
  // 接币盒：透明亚克力
  box(30, 2, 22, M.dark, g, V(36, -88, 0));
  for (const s of [-1, 1]) {
    box(30, 18, 1.5, M.clear, g, V(36, -97, s * 11));
    box(1.5, 18, 22, M.clear, g, V(36 + s * 15, -97, 0));
  }
  box(30, 1.5, 22, M.clear, g, V(36, -106, 0));
  printLabel('接币盒', 12, 4, g, V(36, -109.5, 11.6), 0, '#6f8a7f');
  // 退币滑道：沿拒绝曲线铺一条托轨
  const RN = 26;
  for (let i = 1; i < RN; i++) {
    const p0 = rejectCurve.getPointAt(i / RN), p1 = rejectCurve.getPointAt((i + 1) / RN);
    const mid = p0.clone().add(p1).multiplyScalar(.5);
    const tan = rejectCurve.getTangentAt((i + .5) / RN);
    const seg = box(p0.distanceTo(p1) + 1.1, 4, 3.2, M.aluDark, g);
    seg.position.set(mid.x, mid.y - REF_R - 2, mid.z); seg.rotation.z = Math.atan2(tan.y, tan.x);
    const lip = box(p0.distanceTo(p1) + 1.1, 4.5, .9, M.dark, g);
    lip.position.set(mid.x, mid.y - REF_R + 2, -6.75); lip.rotation.z = Math.atan2(tan.y, tan.x);
  }
  // 退币杯
  box(28, 2, 20, M.dark, g, V(-18, -90, 0));
  for (const s of [-1, 1]) {
    box(28, 18, 1.5, M.clear, g, V(-18, -99, s * 10));
    box(1.5, 18, 20, M.clear, g, V(-18 + s * 14, -99, 0));
  }
  box(28, 1.5, 20, M.clear, g, V(-18, -108, 0));
  box(28, 1.5, 1.3, M.alu, g, V(-18, -89.5, 10));
  printLabel('退币杯', 12, 4, g, V(-18, -111, 10.6), 0, '#6f8a7f');
  addPart('cashbox', '接币盒与退币杯', g, M.aluDark);
}

/* ---------- 06 样币座 ---------- */
{
  const g = group();
  box(34, 4, 3.5, M.aluDark, g, V(44, 78, -8.0));
  box(4, 30, 3.5, M.aluDark, g, V(27, 63, -8.0));
  box(4, 30, 3.5, M.aluDark, g, V(61, 63, -8.0));
  box(34, 4, 3.5, M.aluDark, g, V(44, 48, -8.0));
  for (const x of [28, 60]) for (const y of [50, 76]) cylZ(2, 3, M.aluDark, g, V(x, y, -10.5), 12);
  const clip = group(); clip.position.set(44, 80, -5.5);
  box(3, 5, 3, M.steel, clip, V(0, -2.5, 0));
  box(12, 3, 4, M.steel, clip, V(0, .5, 0));
  g.add(clip); PIV.sampleClip = clip;
  printLabel('样币 SAMPLE', 18, 4, g, V(44, 82.5, -4.6), 0, '#4b463c');
  addPart('sampleHolder', '样币座', g, M.aluDark);
}

/* ---------- 07 样币（两枚，切换显隐） ---------- */
function coinGroup(spec, z = 0) {
  const g = group();
  const r = spec.d / 2;
  const mat = spec.mat === 'brass' ? M.brassCoin : spec.mat === 'steel' ? M.steelCoin : M.nickel;
  if (spec.hole) {
    const shape = new THREE.Shape(); shape.absarc(0, 0, r, 0, TAU, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, spec.hole / 2, 0, TAU, true); shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: spec.t, bevelEnabled: false, curveSegments: 40 });
    geo.translate(0, 0, -spec.t / 2 + z);
    mesh(geo, mat, g);
    for (const s of [-1, 1]) {
      torusZ(r - .45, .32, M.steel, g, V(0, 0, z + s * spec.t / 2));
      torusZ(spec.hole / 2 + .35, .3, M.steel, g, V(0, 0, z + s * spec.t / 2));
    }
  } else {
    cylZ(r, spec.t, mat, g, V(0, 0, z), 44);
    for (const s of [-1, 1]) { const t = torusZ(r - .55, .28, mat, g, V(0, 0, z + s * spec.t / 2)); }
  }
  if (!spec.hole) {
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .17 : r * .38;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? star.lineTo(x, y) : star.moveTo(x, y);
  }
  star.closePath();
  const sg = new THREE.ExtrudeGeometry(star, { depth: .35, bevelEnabled: false, curveSegments: 8 });
  sg.translate(0, 0, z + spec.t / 2);
  mesh(sg, mat, g);
  printLabel(spec.label, r * .8, r * .8, g, V(0, 0, z + spec.t / 2 + .42), 0, '#2a2620');
  }
  return g;
}
{
  const g = group();
  const yuan = coinGroup(SAMPLES.yuan, -7.0); yuan.position.set(44, 62, 2.0); yuan.name = 'sample-yuan';
  const token = coinGroup(SAMPLES.token, -7.0); token.position.set(44, 62, 2.0); token.name = 'sample-token';
  g.add(yuan, token); PIV.sampleYuan = yuan; PIV.sampleToken = token;
  PIV.sampleToken.visible = false;
  addPart('sampleCoin', '样币', g, M.nickel);
}

/* ---------- 08 测试线圈 + 参考线圈 ---------- */
function pancakeCoil(cx, cy, parent, name) {
  const g = group(); g.position.set(cx, cy, -11.0);
  cylZ(11, 1.2, M.chip, g, V(0, 0, -.4), 28);          // 铁氧体背板
  for (let k = 0; k < 4; k++) {
    const r = 5.6 + k * 3.0;
    const pts = [];
    for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU; pts.push(V(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, .85, 6, true), M.copper, g);
  }
  torusZ(16, .5, M.brass, g, V(0, 0, -.2));
  g.name = name;
  parent.add(g);
  return g;
}
{
  const g = group();
  pancakeCoil(-12, 6, g, 'testCoil');
  const ref = pancakeCoil(44, 62, g, 'refCoil');
  PIV.testCoil = g.getObjectByName('testCoil');
  // 引线：测试线圈 → 板，参考线圈 → 板
  wire([[-12, 6, -10.4], [-2, 10, -10.6], [12, 16, -10.6], [26, 18, -9.6]], .55, M.copper, g);
  wire([[44, 62, -10.4], [50, 52, -10.6], [50, 40, -10.6], [46, 30, -9.6]], .55, M.copper, g);
  addPart('coil', '测试线圈与参考线圈', g, M.copper);
}

/* ---------- 09 比较器板 + 10 灵敏度电位器 ---------- */
{
  const g = group();
  box(34, 30, 2, M.pcb, g, V(44, 8, -9.4));
  for (const [x, y] of [[-14, -12], [14, -12], [-14, 12], [14, 12]]) cylZ(1.5, 3.6, M.brass, g, V(44 + x, 8 + y, -10.1), 8);
  box(10, 7, 2.2, M.chip, g, V(38, 12, -7.8));
  for (let i = 0; i < 6; i++) box(.8, 5.2, .5, M.steel, g, V(34.6 + i * 1.25, 12, -6.6));
  for (const [x, y, r] of [[28, 2, 2.4], [31, 4, 1.4], [55, 2, 1.8]]) {
    cylZ(1.2, 5, M.steel, g, V(x, y, -6.6), 8);
    cylZ(r, 3.2, M.chip, g, V(x, y, -5.2), 16);
  }
  // 表头：0..门限，红区
  const dial = group(); dial.position.set(43, 3, -7.3);
  box(18, 13, 1.5, M.dark, dial, V(0, 0, -.8));
  const dc = document.createElement('canvas'); dc.width = 512; dc.height = 360;
  const dx = dc.getContext('2d');
  dx.fillStyle = '#f2efe6'; dx.fillRect(0, 0, 512, 360);
  dx.strokeStyle = '#3a3a35'; dx.lineWidth = 3;
  dx.beginPath(); dx.arc(256, 300, 175, Math.PI * 1.18, Math.PI * 1.82); dx.stroke();
  dx.fillStyle = '#b23a26'; dx.beginPath(); dx.arc(256, 300, 175, Math.PI * 1.72, Math.PI * 1.82); dx.lineTo(256, 300); dx.fill();
  dx.fillStyle = '#3a3a35'; dx.font = '700 42px sans-serif'; dx.textAlign = 'center';
  dx.fillText('比较', 256, 120); dx.font = '600 26px sans-serif'; dx.fillText('0', 160, 210); dx.fillText('门限', 340, 180);
  const tex = new THREE.CanvasTexture(dc); tex.colorSpace = THREE.SRGBColorSpace;
  const face = mesh(new THREE.PlaneGeometry(16, 11), new THREE.MeshBasicMaterial({ map: tex }), dial, V(0, 0, .02));
  face.userData.keepMat = true;
  const needle = group(); needle.position.set(0, -2.7, .2);
  box(.7, 8.5, .3, M.red, needle, V(0, 4.2, 0));
  torusZ(1.6, .35, M.dark, needle, V(0, 0, 0));
  dial.add(needle); PIV.needle = needle;
  g.add(dial);
  // LED
  const led = cylZ(1.7, 1.2, M.glow, g, V(32, 19.5, -6.9), 16);
  led.userData.keepMat = true; PIV.led = led;
  addPart('board', '比较器板', g, M.pcb);

  const p = group();
  cylZ(4, 2.5, M.dark, p, V(52, 22, -7.2), 20);
  cylZ(1.4, 22, M.steel, p, V(52, 22, 3.4), 10);
  const knob = group(); knob.position.set(52, 22, 14.6);
  cylZ(8, 4, M.dark, knob, V(0, 0, 0), 32);
  cylZ(8.6, 1, M.brass, knob, V(0, 0, -2.1), 32);
  const mark = box(1.6, 6, .6, M.red, knob, V(0, 4.2, 2.1));
  printLabel('灵敏度', 8, 2.6, p, V(52, 13.2, 17.2), 0, '#5a5042');
  p.add(knob); PIV.knob = knob;
  addPart('pot', '灵敏度旋钮', p, M.dark);
}

/* ---------- 11 分选活门 + 回位弹簧 ---------- */
const GATE_PIVOT = V(46, -30, COIN_Z);
{
  const g = group();
  const piv = group(); piv.position.copy(GATE_PIVOT);
  cylZ(4.2, 4, M.steel, piv, V(0, 0, 0), 20);
  torusZ(4.2, 1.1, M.brass, piv, V(0, 0, 2.4));
  const vane = group();
  const vb = box(17, 4.2, 3.2, M.steel, vane, V(-8.5, -4.2, 0)); vb.rotation.z = -.22;
  box(6, 2.2, .6, M.yellow, vane, V(-7, -3.2, 1.75));
  box(4.5, 5, 3.2, M.dark, vane, V(-16.5, -6.5, 0));
  const tail = box(15, 4, 3.2, M.steel, piv, V(9, 3.6, 0)); tail.rotation.z = .3;
  box(4, 6, 4, M.dark, piv, V(15, 5.2, 0));
  piv.add(vane);
  g.add(piv); PIV.gate = piv;
  const sp = mesh(springUnit(7, 2.1, .42), M.steel, g);
  g.add(sp); PIV.gateSpring = sp;
  box(5, 5, 6, M.dark, g, V(54, -12, COIN_Z));
  box(7, 8, 3.5, M.aluDark, g, V(46, -30, -9.25));
  addPart('gate', '分选活门与回位弹簧', g, M.steel);
}

/* ---------- 12 电磁铁 ---------- */
{
  const g = group();
  cylY(6.2, 24, M.dark, g, V(60, -47, -4.6), 28);
  for (let i = 0; i < 5; i++) { torusY(6.4, .7, M.copper, g, V(60, -57 + i * 5, -4.6)); }
  box(4, 4, 8, M.aluDark, g, V(60, -35, -4.6));
  box(8, 6, 3, M.aluDark, g, V(60, -34, -10.5));
  const rod = cylY(1.8, 18, M.steel, g, V(60, -44, -5.2), 14);
  g.add(rod); PIV.solRod = rod;
  polyWire([[60, -59, -4.6], [60, -68, -11.2], [60, -40, -11.2], [60, -10, -11.2], [60, 20, -11.2], [63, 20, -11.2]], .6, M.black, g);
  addPart('solenoid', '电磁铁', g, M.dark);
}

/* ---------- 13 机械计数表 ---------- */
function dialTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#f2efe6'; x.beginPath(); x.arc(128, 128, 124, 0, TAU); x.fill();
  x.strokeStyle = '#6b6355'; x.lineWidth = 4; x.beginPath(); x.arc(128, 128, 116, 0, TAU); x.stroke();
  x.fillStyle = '#2c2924'; x.font = '700 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * TAU / 10;
    x.fillText(String(i), 128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84);
  }
  x.fillStyle = '#b23a26'; x.beginPath(); x.arc(128, 38, 6, 0, TAU); x.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
{
  const g = group();
  box(34, 16, 6, M.dark, g, V(0, -45, -5));
  for (const x of [-12, 12]) cylZ(2, 4, M.aluDark, g, V(x, -45, -10), 12);
  const unit = group(); unit.position.set(-6, -45, -1.4); unit.name = 'unitDial';
  const d1 = mesh(new THREE.CircleGeometry(8, 40), new THREE.MeshBasicMaterial({ map: dialTexture() }), unit, V(0, 0, .2));
  d1.userData.keepMat = true;
  g.add(unit); PIV.unitDial = unit;
  const tens = group(); tens.position.set(5, -45, -1.4); tens.name = 'tensDial';
  const d2 = mesh(new THREE.CircleGeometry(8, 40), new THREE.MeshBasicMaterial({ map: dialTexture() }), tens, V(0, 0, .2));
  d2.userData.keepMat = true;
  g.add(tens); PIV.tensDial = tens;
  const ptr = new THREE.Shape(); ptr.moveTo(0, 0); ptr.lineTo(1.8, 5.5); ptr.lineTo(-1.8, 5.5); ptr.closePath();
  for (const x of [-6, 5]) {
    const o = mesh(new THREE.ExtrudeGeometry(ptr, { depth: .4, bevelEnabled: false }), M.red, g, V(x, -52.6, 0.1));
    o.rotation.z = Math.PI;
  }
  // 币身拨动的棘爪，接受币经过时被压一下
  const pawl = box(1.8, 18, 1.8, M.steel, g, V(19.5, -41, -4)); pawl.rotation.z = -.3;
  g.add(pawl); PIV.pawl = pawl;
  box(30, 1.4, 1.2, M.alu, g, V(0, -35.5, 2.2));
  addPart('counter', '机械计数表', g, M.dark);
}

/* ---------- 14 前盖面板 ---------- */
{
  const g = group();
  const holes = [
    { x0: -35.6, y0: 63, x1: -32.4, y1: 91, r: 1.2 },
    { kind: 'circle', x: 44, y: 62, r: 15.5 },
    { kind: 'circle', x: -52, y: 56, r: 9.6 },
    { kind: 'circle', x: 52, y: 22, r: 9.4 },
    { x0: -15.5, y0: -53.5, x1: 19.5, y1: -36.5, r: 2 },
  ];
  panel(-62, -86, 62, 92, 7, holes, 5, 9, M.alu, g);
  const glass = new THREE.MeshBasicMaterial({ color: 0xdfeef2, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide });
  cylZ(15.4, .8, glass, g, V(44, 62, 12));
  box(34.6, 16.6, .8, glass, g, V(0, -45, 12));
  // 投币口唇缘（3 mm 竖缝）
  for (const s of [-1, 1]) box(2.2, 32, 3, M.steel, g, V(-34 + s * 3.1, 78, 14.6));
  for (const y of [62.2, 91.8]) box(9, 2.2, 3, M.steel, g, V(-34, y, 14.6));
  // 铭牌与丝印
  box(40, 1.4, .25, M.dark, g, V(-8, 74, 14.2));
  printLabel('COIN ACCEPTOR', 30, 5, g, V(-12, 84, 14.3), 0, '#575145');
  printLabel('SAMPLE', 16, 4, g, V(44, 80.5, 14.3), 0, '#575145');
  printLabel('COUNT', 12, 3.4, g, V(0, -33.5, 14.3), 0, '#575145');
  printLabel('SENSITIVITY', 18, 4, g, V(52, 32.5, 14.3), 0, '#575145');
  printLabel('PUSH RETURN', 14, 3.4, g, V(-52, 41.5, 14.3), 0, '#575145');
  printLabel('INSERT COIN', 15, 3.2, g, V(-34, 57.5, 14.3), 0, '#575145');
  printLabel('CC-12 · 比较式', 24, 4.8, g, V(-12, 44, 14.3), 0, '#6a6255');
  for (const x of [-58, 58]) for (const y of [-82, 84]) cylZ(3, 21, M.dark, g, V(x, y, -1.5), 14);
  const cled = cylZ(2.2, 1.2, M.glow, g, V(26, 34, 14.0), 18);
  cled.userData.keepMat = true; PIV.coverLed = cled;
  addPart('cover', '前盖与面板', g, M.alu, { shell: true });
}

/* ---------- 15 投入币（场景件，不注册） ---------- */
const coinsGroup = group(); world.add(coinsGroup);
const coinMeshes = {};
for (const k of Object.keys(COINS)) {
  const c = coinGroup(COINS[k], 0);
  c.visible = false; c.name = 'coin-' + k;
  coinsGroup.add(c); coinMeshes[k] = c;
}
const returnCurve = new THREE.CatmullRomCurve3([V(-34, 78, 18), V(-30, 30, 22), V(-24, -40, 24), V(-18, -95, 20)]);

/* ---------- 运动状态 ---------- */
export const MECH = {
  now: 0, gate: 0, lastCount: 0, countAge: 9,
};
const ease = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
function poseCoin(state) {
  const c = state.coin;
  for (const k of Object.keys(coinMeshes)) coinMeshes[k].visible = false;
  if (!c) return;
  const meshC = coinMeshes[c.kind]; if (!meshC) return;
  meshC.visible = true;
  const spec = COINS[c.kind] || COINS.yuan;
  const rad = REF_R - spec.d / 2;
  let pos = null, rotZ = 0, rotY = 0;
  const shift = (curve, u) => {
    const p = curve.getPointAt(Math.min(1, Math.max(0, u)));
    p.y -= rad;
    return p;
  };
  if (c.stage === 'returning') {
    const u = Math.min(1, Math.max(0, c.t / GATE_T));
    pos = shift(mainCurve, u);
    rotZ = -u * L_MAIN / (spec.d / 2);
    if (c.t < .05) rotY = Math.PI / 2 * (1 - c.t / .05);
  } else if (c.stage === 'returned' || c.stage === 'done-returned') {
    const u = Math.min(1, (c.rt || 0) / .55);
    pos = returnCurve.getPointAt(ease(u));
    rotZ = -3.2 * u; rotY = Math.PI / 2;
  } else if (c.stage === 'blocked') {
    pos = shift(mainCurve, Math.max(0, c.t / GATE_T));
    rotZ = -(c.t * 260) / (spec.d / 2);
  } else {
    const t = c.t;
    if (t < .05) {
      const u = t / .05;
      pos = mainCurve.getPointAt(0);
      pos.z = 18 - 26.4 * ease(u);
      rotY = Math.PI / 2 * (1 - ease(u));
      rotZ = -u * 9 / (spec.d / 2);
    } else if (t <= GATE_T) {
      pos = shift(mainCurve, t / GATE_T);
      rotZ = -(t * 190) / (spec.d / 2);
    } else {
      const branch = (c.stage === 'accepted' || c.stage === 'done-accepted') ? acceptCurve : rejectCurve;
      const u = Math.min(1, (t - GATE_T) / (1 - GATE_T));
      pos = shift(branch, u);
      rotZ = -(GATE_T * 190 + (t - GATE_T) * 170) / (spec.d / 2);
    }
  }
  if (pos) meshC.position.copy(pos);
  meshC.rotation.set(0, rotY, rotZ);
}

function applyMotion(view, state) {
  MECH.gate = state.gate || 0;
  MECH.now = MECH.now || 0;
  // 样币切换
  if (PIV.sampleYuan) PIV.sampleYuan.visible = state.sample !== 'token';
  if (PIV.sampleToken) PIV.sampleToken.visible = state.sample === 'token';
  // 活门角度：0 退币位（弹簧），-0.95 接受位（电磁铁）
  const th = -0.95 * MECH.gate;
  if (PIV.gate) PIV.gate.rotation.z = th;
  if (PIV.gateSpring) {
    const tail = V(GATE_PIVOT.x + 14 * Math.cos(th) - 6 * Math.sin(th),
                   GATE_PIVOT.y + 14 * Math.sin(th) + 6 * Math.cos(th), COIN_Z);
    placeSpring(PIV.gateSpring, V(56, -12, COIN_Z), tail);
  }
  if (PIV.solRod) {
    const tailY = GATE_PIVOT.y + 14 * Math.sin(th) + 6 * Math.cos(th);
    PIV.solRod.position.y = tailY - 9;
    PIV.solRod.position.x = GATE_PIVOT.x + 14 * Math.cos(th) - 6 * Math.sin(th);
  }
  // 退币按钮与推杆
  const rb = state.returnBtn || 0;
  if (PIV.retBtn) PIV.retBtn.position.z = 14 - 4.2 * rb;
  if (PIV.kick) PIV.kick.rotation.z = -.95 * rb;
  // 灵敏度旋钮
  if (PIV.knob) PIV.knob.rotation.z = -1.5 * (state.sensitivity ?? 6) / 10;
  // 表头
  if (PIV.needle) {
    let ang = -1.05;
    if (state.verdict && state.verdict !== 'off' && Number.isFinite(state.diff) && state.threshold) {
      ang = -1.05 + 2.0 * Math.min(1.25, state.diff / state.threshold);
    }
    PIV.needle.rotation.z = ang;
  }
  // LED 与测试线圈微亮
  for (const key of ['led', 'coverLed']) {
    const L = PIV[key];
    if (!L) continue;
    const on = !!state.power && !!state.placed?.includes('board');
    const pass = state.verdict === 'pass';
    L.material.color.setHex(on ? (pass ? 0x66d18f : 0xd4553d) : 0x2a2d31);
    L.material.emissive.setHex(on ? (pass ? 0x2f9a5e : 0x8e2a1c) : 0x000000);
    L.material.emissiveIntensity = on ? 1.4 : 0;
  }
  if (PIV.testCoil) {
    const near = state.coin && Math.abs((state.coin.t || 0) - STATIONS.coil) < .085;
    PIV.testCoil.scale.setScalar(near ? 1.06 : 1);
  }
  // 计数表：接受数驱动拨盘；到位后拨爪落一下
  const ac = state.acceptCount || 0;
  if (ac !== MECH.lastCount) { MECH.lastCount = ac; MECH.countAge = 0; }
  MECH.countAge += 1 / 60;
  if (PIV.unitDial) PIV.unitDial.rotation.z = -ac * TAU / 10;
  if (PIV.tensDial) PIV.tensDial.rotation.z = -Math.floor(ac / 10) * TAU / 10;
  if (PIV.pawl) PIV.pawl.rotation.z = -.35 - .35 * Math.max(0, 1 - MECH.countAge / .35);
  // 硬币
  poseCoin(state);
}

/* ---------- 包围盒 ---------- */
function moduleBounds(keys) {
  const b = new THREE.Box3();
  for (const k of keys) {
    const p = byKey.get(k);
    if (p) b.union(new THREE.Box3().setFromObject(p.g));
  }
  return b;
}

export const MODEL = { world, byKey, PARTS: parts, moduleBounds, applyMotion, mech: MECH,
  COINS, SAMPLES, STATIONS, GATE_MAX_T, GATE_T, mainCurve, U_BLOCK, U_COIL, coinMeshes };
