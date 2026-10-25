/* mechbench · 生成物，勿手改
 * 源：items/injection-pen/{model.mjs,manifest.mjs,logic.mjs}
 * 重新生成：python3 tools/build.py injection-pen
 * 用途：无浏览器断言 → node tools/verify.mjs injection-pen
 */
/* node 环境最小 DOM 桩：model.mjs 里的 canvas 贴图纹理需要 */
const __stubGradient = () => ({ addColorStop() {} });
const __stubCtx = () => ({
  fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '', lineWidth: 1, globalAlpha: 1,
  fillRect() {}, strokeRect() {}, clearRect() {}, save() {}, restore() {},
  translate() {}, rotate() {}, scale() {}, setTransform() {}, transform() {},
  fillText() {}, strokeText() {}, measureText: () => ({ width: 10 }),
  beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, rect() {},
  bezierCurveTo() {}, quadraticCurveTo() {}, stroke() {}, fill() {}, clip() {},
  drawImage() {}, createLinearGradient: __stubGradient, createRadialGradient: __stubGradient,
  createPattern: () => null, getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  putImageData() {},
});
if (!globalThis.document) {
  globalThis.document = {
    createElement: () => ({ width: 1, height: 1, style: {}, getContext: __stubCtx }),
    createElementNS: () => ({ width: 1, height: 1, style: {}, getContext: __stubCtx }),
  };
}
import * as THREE from '../vendor/three.module.js';

/* ==== injection-pen/model.mjs ==== */

/* 注射笔 · 几何与运动 —— 一次性预充式注射笔（替尔泊肽 / KwikPen 类）
 * 1 unit = 1 mm；笔轴 = x（后端 0 → 针尖 +155 量级）；含外帽总长 170 mm。
 *
 * 传动链（全部由 applyMotion 里的同一组状态量驱动，读数也从这组量算）：
 *   剂量旋钮(棘轮咔哒) → 扭簧上弦 → 按钮松闸 → 驱动套筒/螺母转 → 丝杠(被笔身键住不能转，只能直线走) → 活塞
 * 剂量关系：1.0 mg = 旋钮半圈 = 丝杠 1 转（导程 5.64 的双头螺纹）= 活塞 2.82 mm。
 * 尺寸依据 / 教学简化见 notes.md。
 */

const PEN = {
  len: 170,          // 含外帽总长
  bore: 4.75,        // 卡式瓶内径半径（Ø9.5）
  strokePerMg: 2.82, // 活塞行程 / mg（由 Ø9.5 内径与 5 mg/mL 浓度折算）
  lead: 5.64,        // 丝杠导程（双头，螺距 2.82）
  crest: 2.95,       // 螺纹牙顶半径
  clickMg: 0.125,    // 一格（22.5°）
  teeth: 16,         // 棘轮齿数 / 转
  dialDegPerMg: 180, // 旋钮 180° / 1.0 mg
  totalMg: 10,       // 2 mL × 5 mg/mL
  bung0: 92,         // 活塞后端 x（未注射时）
  bungL: 6,
  drugLen: 30,       // 药液柱长（98 → 128）
  drugEnd: 128,
  capOuterInner: 164.2, // 外帽内腔前端（针尖必须在这之前）
  capInnerInner: 159, // 内帽内腔前端
};

const penWorld = new THREE.Group();
const penTau = Math.PI * 2;
const penDeg = (d) => (d * Math.PI) / 180;

/* ============================ 材质 ============================ */
const PM = {
  shell: new THREE.MeshPhysicalMaterial({ color: 0xf7e9ec, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.3 }),
  shell2: new THREE.MeshPhysicalMaterial({ color: 0xf0dade, roughness: 0.42, clearcoat: 0.5 }),
  dial: new THREE.MeshStandardMaterial({ color: 0xa02b4e, roughness: 0.5 }),
  dialRib: new THREE.MeshStandardMaterial({ color: 0xc8556f, roughness: 0.42 }),
  button: new THREE.MeshStandardMaterial({ color: 0x6e1a33, roughness: 0.42 }),
  cap: new THREE.MeshStandardMaterial({ color: 0x8d2545, roughness: 0.45 }),
  clear: new THREE.MeshPhysicalMaterial({ color: 0xe2f0f4, roughness: 0.18, clearcoat: 1, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xd3ecf5, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide }),
  drug: new THREE.MeshPhysicalMaterial({ color: 0xdcbe86, roughness: 0.28, clearcoat: 0.5 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x44444c, roughness: 0.85 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xcfd6da, metalness: 1, roughness: 0.24 }),
  alu: new THREE.MeshStandardMaterial({ color: 0xb6bec3, metalness: 1, roughness: 0.32 }),
  plastic: new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.45 }),
  tan: new THREE.MeshStandardMaterial({ color: 0xcbbca6, roughness: 0.6 }),
  grey: new THREE.MeshStandardMaterial({ color: 0x98a2a6, roughness: 0.5 }),
  sep: new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.72 }),
  ink: new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.62 }),
  needle: new THREE.MeshStandardMaterial({ color: 0xdfe4e7, metalness: 1, roughness: 0.18 }),
};

/* ============================ 几何助手 ============================ */
function penMesh(geo, mat, parent) { const m = new THREE.Mesh(geo, mat); if (parent) parent.add(m); return m; }
// profile: [[x, r], ...]，沿 +x 的旋转面；闭合 profile 得到有壁厚的筒
function penLathe(profile, seg = 72, start = 0, len = penTau) {
  const pts = profile.map(([x, r]) => new THREE.Vector2(Math.max(r, 1e-4), x));
  const g = new THREE.LatheGeometry(pts, seg, start, len);
  g.rotateZ(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
// 只做一段圆弧：worldStart/worldLen 是"世界角"（0 = +Z，向 +Y 为正）
function penArc(profile, worldStart, worldLen, seg = 96) {
  return penLathe(profile, seg, penDeg(-(worldStart + worldLen)), penDeg(worldLen));
}
function penExtrudeX(shape, x0, x1) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 24 });
  g.rotateY(-Math.PI / 2);
  g.translate(x1, 0, 0);
  return g;
}
function penBox(w, h, d, mat, parent, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}
// 把"角度 + 半径"换成 y/z（0° = +Z，90° = +Y）
const penPolar = (deg, r) => [Math.sin(penDeg(deg)) * r, Math.cos(penDeg(deg)) * r];
// 螺纹示意：半径 r 的螺旋管；leftHanded=true 时旋向相反
function penHelix(x0, x1, r, wire, turns, segPerTurn = 14, phase = 0, leftHanded = false) {
  const n = Math.max(16, Math.round(turns * segPerTurn));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (leftHanded ? -1 : 1) * t * turns * penTau + phase;
    pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, Math.sin(a) * r, Math.cos(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, 6, false);
}
// 径向棘轮环：外圈圆、内孔是锯齿（齿顶 rCrest、齿谷 rValley）
function penRatchetRing(x0, x1, rOut, rValley, rCrest, n, phase = 0) {
  const step = penTau / n;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOut, 0, penTau, false);
  const hole = new THREE.Path();
  const push = (r, a, first) => {
    const x = Math.cos(a + phase) * r, y = Math.sin(a + phase) * r;
    if (first) hole.moveTo(x, y); else hole.lineTo(x, y);
  };
  for (let i = 0; i < n; i++) {
    const a0 = i * step;
    push(rValley, a0, i === 0);
    push(rCrest, a0 + step * 0.42, false);   // 缓坡爬升
    push(rCrest, a0 + step * 0.50, false);   // 齿顶
    push(rValley, a0 + step * 0.55, false);  // 陡壁落下
  }
  hole.closePath();
  shape.holes.push(hole);
  return penExtrudeX(shape, x0, x1);
}
// 扁带绕簧（可扭转的钢丝带）
function penRibbon(x0, x1, radius, width, thick, turns, segPerTurn = 56) {
  const N = Math.round(turns * segPerTurn);
  const ri = radius - thick / 2, ro = radius + thick / 2;
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = t * turns * penTau, cx = x0 + (x1 - x0) * t;
    const c = Math.cos(a), s = Math.sin(a);
    pos.push(cx - width / 2, ri * c, ri * s, cx - width / 2, ro * c, ro * s,
      cx + width / 2, ri * c, ri * s, cx + width / 2, ro * c, ro * s);
  }
  for (let i = 0; i < N; i++) {
    const p = i * 4, q = p + 4;
    idx.push(p, p + 2, q + 2, p, q + 2, q);             // 内表面
    idx.push(p + 1, q + 1, q + 3, p + 1, q + 3, p + 3); // 外表面
    idx.push(p, q, q + 1, p, q + 1, p + 1);             // 后侧窄边
    idx.push(p + 2, p + 3, q + 3, p + 2, q + 3, q + 2); // 前侧窄边
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ============================ 零件注册 ============================ */
const penParts = [], penByKey = new Map();
function addPenPart(key, name, obj, mat, opt = {}) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.keepMat) o.material = mat.clone();
    o.userData.omat = o.material;
    o.userData.key = key;
  });
  const g = new THREE.Group();
  g.add(obj);
  g.userData.key = key;
  penWorld.add(g);
  const p = { key, name, g, obj, shell: !!opt.shell };
  penParts.push(p); penByKey.set(key, p);
  return p;
}

/* ---------- 笔身（含剂量窗；棘爪座 + 防转键 + 扭簧前支点都在壳内） ---------- */
{
  const grp = new THREE.Group();
  const rin = 9.5, rout = 10.4;
  grp.add(new THREE.Mesh(penLathe([[26, rin], [26, rout], [33, rout], [33, rin], [26, rin]], 96), PM.shell));
  // 剂量窗：正对观察者挖掉 64°（世界角 -32°…+32°）
  grp.add(new THREE.Mesh(penArc([[33, rin], [33, rout], [52, rout], [52, rin], [33, rin]], 32, 296, 128), PM.shell));
  // 窗两侧封边（弧段两端的切面要补，否则能看见薄壳）
  for (const s of [-1, 1]) {
    const [y, z] = penPolar(32 * s, rout - 0.45);
    grp.add(penBox(19, 1.0, 0.9, PM.shell, grp, 42.5, y, z)).rotation.x = -penDeg(32 * s);
  }
  grp.add(new THREE.Mesh(penLathe([[52, rin], [52, rout], [104, rout], [106, rout - 0.55], [106, rin], [52, rin]], 96), PM.shell));
  // 后端法兰：棘爪的固定根座
  grp.add(new THREE.Mesh(penLathe([[26.2, 6.3], [26.2, 8.5], [31, 8.5], [31, 6.3], [26.2, 6.3]], 64), PM.shell));
  // 防转键座：丝杠的扁位从这里穿过，只许直走不许转
  grp.add(new THREE.Mesh(penLathe([[34, 3.1], [34, 8.45], [39, 8.45], [39, 3.1], [34, 3.1]], 64), PM.shell));
  for (const s of [-1, 1]) penBox(4.4, 0.6, 1.8, PM.shell, grp, 36.5, s * 2.8, 0);
  // 扭簧前支点：扭簧前端挂在这块凸耳上（固定在笔身，不跟任何轴转）
  penBox(2, 1.6, 1.6, PM.shell2, grp, 73, 0, 7.8);
  penBox(2, 1.6, 1.0, PM.shell2, grp, 73, 0, 9.05);
  addPenPart('body', '笔身外壳（含剂量窗、棘爪座、防转键）', grp, PM.shell, { shell: true });
}

/* ---------- 棘爪：只许旋钮单向转，一齿一声咔哒 ---------- */
const pawlPivot = new THREE.Group();
pawlPivot.position.set(26, 0, 8.26);
{
  // 叶片从根座(x=26) 往前伸 8 mm，尖端落在棘轮齿谷里
  pawlPivot.add(penBox(8, 0.9, 0.4, PM.tan, pawlPivot, -4, 0, 0));
  pawlPivot.add(penBox(1.1, 0.9, 0.26, PM.tan, pawlPivot, -8.1, 0, 0.05));
  addPenPart('pawl', '棘爪弹片', pawlPivot, PM.tan);
}
const pawl = penByKey.get('pawl');

/* ---------- 剂量刻度套筒（印着 0 / 0.5 / 1.0，随旋钮转） ---------- */
// 刻度数字用贴片平面：位置与朝向都是显式给的，不受圆柱 UV 方向影响
function penNumberDecal(text, wmm = 7.4, hmm = 6.0) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 208;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 208);
  g.fillStyle = '#241d20';
  g.font = '700 150px ui-monospace, Menlo, monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 108);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wmm, hmm),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.userData.keepMat = true;
  return m;
}
const SCALE_R = 9.22;
const scaleAt = (obj, dose, r = SCALE_R, x = 41) => {
  const a = penDeg(PEN.dialDegPerMg * dose);   // 刻度在“该剂量正对窗口”的位置上
  obj.position.set(x, Math.sin(a) * r, Math.cos(a) * r);
  obj.rotation.x = -a;
  return obj;
};
{
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(penLathe([[26.6, 8.6], [26.6, 9.2], [52, 9.2], [52, 8.6], [26.6, 8.6]], 96), PM.plastic));
  for (const [dose, label] of [[0, '0'], [0.5, '0.5'], [1.0, '1.0']]) {
    grp.add(scaleAt(penNumberDecal(label), dose, SCALE_R + 0.02));
  }
  for (let k = 0; k <= 8; k++) {            // 分格线：一格 0.125 mg
    const major = k % 4 === 0;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(major ? 4.6 : 2.8, major ? 0.7 : 0.5, 0.16), PM.ink);
    tick.userData.keepMat = false;
    scaleAt(tick, k * PEN.clickMg, SCALE_R, 47.2);
    grp.add(tick);
  }
  // 扭簧后支点：这块筋跟着旋钮转，扭簧前端钩在笔身上，一上弦就扭起来
  penBox(2, 1.0, 2.6, PM.plastic, grp, 53, 0, 7.9);
  addPenPart('scale', '剂量刻度套筒', grp, PM.plastic);
}

/* ---------- 扭簧（上弦时按扭转量变形） ---------- */
const springGeo = penRibbon(54, 72, 7.15, 1.6, 0.5, 12);
const springRest = springGeo.attributes.position.array.slice();
const springPart = addPenPart('spring', '扭簧', new THREE.Mesh(springGeo, PM.steel), PM.steel);

/* ---------- 驱动套筒 + 驱动螺母 ---------- */
{
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(penLathe([[56, 3.2], [56, 5.6], [88, 5.6], [88, 3.2], [56, 3.2]], 64), PM.plastic));
  for (const x of [74, 84]) grp.add(new THREE.Mesh(penLathe([[x, 5.6], [x, 7.2], [x + 2, 7.2], [x + 2, 5.6], [x, 5.6]], 64), PM.plastic));
  addPenPart('sleeve', '驱动套筒', grp, PM.plastic);
}
const nutGroup = new THREE.Group();
{
  // 螺母：内孔吃丝杠螺纹，外圈与套筒花键同转
  nutGroup.add(new THREE.Mesh(penLathe([[76, 3.0], [76, 6.95], [84, 6.95], [84, 3.0], [76, 3.0]], 64), PM.grey));
  for (let i = 0; i < 8; i++) {
    const [y, z] = penPolar(i * 45, 7.02);
    const rib = penBox(7, 0.9, 0.5, PM.grey, nutGroup, 80, y, z);
    rib.rotation.x = -penDeg(i * 45);
  }
  addPenPart('nut', '驱动螺母', nutGroup, PM.grey);
}

/* ---------- 丝杠：扁位段被笔身键住，螺纹段吃在螺母里；只平移不自转 ---------- */
const screwGroup = new THREE.Group();
{
  // 双扁位截面：上平 → 左弧 → 下平 → 右弧（扁位就被笔身的防转键咬住）
  const R = 2.8, FLAT = 2.45, aTop = Math.asin(FLAT / R);
  const shapePts = [[R * Math.cos(aTop), FLAT], [-R * Math.cos(aTop), FLAT]];
  for (let i = 0; i <= 20; i++) {                        // 左半弧
    const ang = Math.PI - aTop + (2 * aTop) * (i / 20);
    shapePts.push([R * Math.cos(ang), R * Math.sin(ang)]);
  }
  shapePts.push([R * Math.cos(2 * Math.PI - aTop), -FLAT]);
  for (let i = 0; i <= 20; i++) {                        // 右半弧
    const ang = 2 * Math.PI - aTop + (2 * aTop) * (i / 20);
    shapePts.push([R * Math.cos(ang), R * Math.sin(ang)]);
  }  const shape = new THREE.Shape(shapePts.map(([x, y]) => new THREE.Vector2(x, y)));
  screwGroup.add(new THREE.Mesh(penExtrudeX(shape, 30, 42), PM.steel));
  // 螺纹段：芯杆 + 双头左旋螺纹（螺母反向转 → 丝杠前进）
  const core = new THREE.CylinderGeometry(2.62, 2.62, 50, 24);
  core.rotateZ(-Math.PI / 2);
  const coreMesh = penMesh(core, PM.steel, screwGroup);
  coreMesh.position.x = 67;
  for (const ph of [0, Math.PI]) {
    screwGroup.add(new THREE.Mesh(penHelix(42, 92, 2.78, 0.17, 50 / PEN.lead, 12, ph, true), PM.steel));
  }
  addPenPart('screw', '丝杠（推杆）', screwGroup, PM.steel);
}

/* ---------- 剂量旋钮（内侧就是棘轮齿） ---------- */
const dialGroup = new THREE.Group();
{
  dialGroup.add(new THREE.Mesh(penLathe([[0, 8.9], [0, 9.4], [25.6, 9.4], [25.6, 8.9], [0, 8.9]], 96), PM.dial));
  dialGroup.add(new THREE.Mesh(penLathe([[0, 5.6], [0, 9.4], [1.6, 9.4], [1.6, 5.6], [0, 5.6]], 64), PM.dial));
  // 棘轮：齿谷在 0°（正对棘爪），16 齿 / 转
  dialGroup.add(new THREE.Mesh(penRatchetRing(2, 25.6, 8.9, 8.6, 7.3, PEN.teeth, penDeg(-0.775 * (360 / PEN.teeth))), PM.dialRib));
  // 前轮毂：插进刻度套筒的孔里，一起转
  dialGroup.add(new THREE.Mesh(penLathe([[25.6, 7.6], [25.6, 8.4], [27.6, 8.4], [27.6, 7.6], [25.6, 7.6]], 64), PM.dial));
  for (let i = 0; i < 24; i++) {         // 滚花
    const [y, z] = penPolar(i * 15, 9.55);
    const rib = penBox(21, 0.55, 0.42, PM.dialRib, dialGroup, 12.5, y, z);
    rib.rotation.x = -penDeg(i * 15);
  }
  addPenPart('dial', '剂量旋钮（棘轮咔哒）', dialGroup, PM.dial);
}

/* ---------- 注射按钮 ---------- */
const buttonGroup = new THREE.Group();
{
  buttonGroup.add(new THREE.Mesh(penLathe([[-4.5, 0], [-4.5, 4.6], [-3.4, 5.4], [5, 5.4], [5, 0]], 48), PM.button));
  addPenPart('button', '注射按钮', buttonGroup, PM.button);
}

/* ---------- 药筒支架（透明，开四道窗看药） ---------- */
{
  const grp = new THREE.Group();
  const prof = [[87, 6.2], [87, 7.0], [134, 7.0], [134, 6.2], [87, 6.2]];
  for (let i = 0; i < 4; i++) grp.add(new THREE.Mesh(penArc(prof, i * 90 + 13, 64, 24), PM.clear));
  grp.add(new THREE.Mesh(penLathe([[134, 7.0], [141, 4.45], [141, 3.85], [134, 6.2], [134, 7.0]], 64), PM.clear));
  addPenPart('holder', '卡式瓶支架', grp, PM.clear, { shell: true });
}

/* ---------- 卡式瓶：玻璃管 + 铝盖 + 隔膜 ---------- */
{
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(penLathe([[88.2, 4.75], [88.2, 5.8], [132, 5.8], [135.6, 3.0], [139.8, 3.0], [139.8, 2.0], [135.6, 2.0], [132, 4.75], [88.2, 4.75]], 72), PM.glass));
  const crimp = new THREE.Mesh(penLathe([[137.0, 2.62], [137.0, 3.5], [140.9, 3.5], [140.9, 2.72], [140.2, 2.72], [140.2, 3.02], [137.0, 3.02], [137.0, 2.62]], 64), PM.alu);
  grp.add(crimp);
  const septum = new THREE.Mesh(penLathe([[139.6, 0], [139.6, 2.7], [141.15, 2.7], [141.15, 0]], 48), PM.sep);
  septum.userData.sub = 'septum';
  grp.add(septum);
  addPenPart('cartridge', '卡式瓶（玻璃 + 铝盖 + 隔膜）', grp, PM.glass, { shell: true });
}

/* ---------- 药液：柱体随活塞缩短，瓶颈里的药液不缩 ---------- */
const drugMove = new THREE.Group();
{
  const grp = new THREE.Group();
  const col = new THREE.CylinderGeometry(4.72, 4.72, PEN.drugLen, 40);
  col.rotateZ(-Math.PI / 2);
  col.translate(PEN.drugLen / 2, 0, 0);   // 平移烘进几何，scale.x 才不会把位置也缩掉
  drugMove.add(penMesh(col, PM.drug, drugMove));
  drugMove.position.x = PEN.bung0 + PEN.bungL; // 98
  grp.add(drugMove);
  const neck = new THREE.CylinderGeometry(1.9, 1.9, 12.4, 28);
  neck.rotateZ(-Math.PI / 2);
  const neckMesh = penMesh(neck, PM.drug, grp);
  neckMesh.position.x = 133.6;
  addPenPart('drug', '药液', grp, PM.drug);
}

/* ---------- 活塞 ---------- */
const bungGroup = new THREE.Group();
{
  // 几何从 0 起算，位置由 applyMotion 给（92 + 行程）
  bungGroup.add(new THREE.Mesh(penLathe([
    [0, 0], [0, 4.6], [0.8, 4.68], [1.6, 4.68], [2.2, 4.45], [3.0, 4.45],
    [3.8, 4.68], [4.6, 4.68], [5.4, 4.45], [6, 4.45], [6, 0],
  ], 48), PM.rubber));
  bungGroup.position.x = PEN.bung0;
  addPenPart('bung', '活塞', bungGroup, PM.rubber);
}

/* ---------- 螺纹针座 ---------- */
{
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(penLathe([[141.0, 2.8], [141.0, 4.4], [146.6, 4.4], [146.6, 2.8], [141.0, 2.8]], 64), PM.alu));
  grp.add(new THREE.Mesh(penHelix(141.5, 146.2, 4.32, 0.3, 4, 20), PM.alu));
  addPenPart('hub', '螺纹针座', grp, PM.alu);
}

/* ---------- 一次性针头：塑料座 + 一根套管针 ---------- */
const needleGroup = new THREE.Group();
{
  needleGroup.add(new THREE.Mesh(penLathe([
    [145.6, 4.72], [145.6, 5.0], [152.0, 5.0], [152.9, 3.2], [152.9, 0.95], [152.0, 0.95], [152.0, 4.72], [145.6, 4.72],
  ], 64), PM.plastic));
  for (let i = 0; i < 8; i++) {      // 拧针时的滚花
    const [y, z] = penPolar(i * 45, 4.99);
    const rib = penBox(6, 0.45, 0.3, PM.plastic, needleGroup, 149, y, z);
    rib.rotation.x = -penDeg(i * 45);
  }
  const cannula = new THREE.CylinderGeometry(0.36, 0.36, 17.4, 12);
  cannula.rotateZ(-Math.PI / 2);
  const cm = penMesh(cannula, PM.needle, needleGroup);
  cm.position.x = 147.9;   // 139.2 … 156.6
  const tip = new THREE.ConeGeometry(0.36, 0.9, 12);
  tip.rotateZ(-Math.PI / 2);
  const tm = penMesh(tip, PM.needle, needleGroup);
  tm.position.x = 156.95;  // 针尖 157.4
  addPenPart('needle', '一次性针头', needleGroup, PM.plastic);
}

/* ---------- 内帽（内针护套） ---------- */
const capInnerGroup = new THREE.Group();
{
  capInnerGroup.add(new THREE.Mesh(penLathe([
    [142.8, 5.4], [142.8, 6.6], [159.0, 6.6], [161.0, 5.2], [161.0, 0], [159.0, 0], [159.0, 5.4], [142.8, 5.4],
  ], 64), PM.shell2));
  addPenPart('capInner', '内帽', capInnerGroup, PM.shell2, { shell: true });
}

/* ---------- 外帽（杯状 + 笔夹） ---------- */
const capOuterGroup = new THREE.Group();
{
  capOuterGroup.add(new THREE.Mesh(penLathe([
    [104, 9.9], [104, 11.5], [147, 11.5], [152.5, 10.9], [158, 9.2], [163, 4.6], [165.5, 0],
    [164.6, 0], [162.2, 3.4], [157.2, 7.8], [151.8, 9.5], [147, 9.9], [104, 9.9],
  ], 72), PM.cap));
  penBox(42, 1.7, 5.4, PM.cap, capOuterGroup, 126, 11.9, 0);
  penBox(6, 6.4, 3.2, PM.cap, capOuterGroup, 104.5, 9.6, 0);
  addPenPart('capOuter', '外帽', capOuterGroup, PM.cap, { shell: true });
}

/* ---------- 装配台地面阴影（场景件，不注册） ---------- */
{
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(70,58,40,.34)'); g.addColorStop(.55, 'rgba(70,58,40,.13)'); g.addColorStop(1, 'rgba(70,58,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(240, 46),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2;
  sh.position.set(85, -9.6, 0);
  penWorld.add(sh);
}

/* ============================ 运动 ============================ */
const penSmooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const penStroke = (state) => PEN.strokePerMg * (state.delivered || 0);
const penWindAngle = (state) => penDeg(PEN.dialDegPerMg) * (state.windMg || 0);

function penSpringGeom(dialAngle) {
  // 后端跟旋钮转、前端挂在笔身上：按扭转量做线性插值的扭转
  const pos = springGeo.attributes.position;
  const x0 = 54, x1 = 72;
  for (let i = 0; i < pos.count; i++) {
    const j = i * 3;
    const bx = springRest[j], by = springRest[j + 1], bz = springRest[j + 2];
    const u = (x1 - bx) / (x1 - x0);          // 1 = 后端（旋钮侧）
    const a = dialAngle * u, c = Math.cos(a), s = Math.sin(a);
    pos.setXYZ(i, bx, c * by + s * bz, -s * by + c * bz);
  }
  pos.needsUpdate = true;
  springGeo.computeVertexNormals();
}

function applyMotion(view, state) {
  const s = state || {};
  const installed = (k) => (s.placed || []).includes(k);
  const wind = s.windMg || 0;
  const delivered = s.delivered || 0;
  const dialA = penWindAngle(s);
  const nutA = -penDeg(PEN.dialDegPerMg) * delivered;   // 螺母与旋钮回零同向转
  const stroke = penStroke(s);

  // 旋钮、刻度套筒、螺母、套筒：同一组角度，读数与几何同源
  dialGroup.rotation.x = dialA;
  penByKey.get('scale').obj.rotation.x = dialA;
  nutGroup.rotation.x = nutA;
  penByKey.get('sleeve').obj.rotation.x = nutA;

  // 丝杠只平移（被笔身防转键挡住不能转）
  screwGroup.position.x = stroke;
  bungGroup.position.x = PEN.bung0 + stroke;
  drugMove.position.x = PEN.bung0 + PEN.bungL + stroke;
  drugMove.scale.x = Math.max(0.02, (PEN.drugLen - stroke) / PEN.drugLen);

  // 扭簧：上弦扭转，按下按钮释放后回到零
  penSpringGeom(dialA);

  // 棘爪：拨一格抬一次（按齿距相位算），按下按钮则被离合片顶开
  const press = penSmooth(s.press || 0);
  const phase = Math.abs(dialA) / penDeg(360 / PEN.teeth);
  const clickLift = Math.sin(Math.PI * (phase % 1)) * 1.34;
  const lift = Math.max(clickLift, press * 1.34);
  pawl.obj.rotation.y = -Math.asin(Math.min(0.99, lift / 8));

  // 按钮：按入 1.8 mm
  buttonGroup.position.x = 1.8 * press;

  // 帽与针：拆下就沿轴滑出并隐藏（不是"冻住"）
  if (installed('caps')) {
    const co = s.capOuter == null ? 1 : s.capOuter;
    const ci = s.capInner == null ? 1 : s.capInner;
    capOuterGroup.position.x = (1 - co) * 46;
    capInnerGroup.position.x = (1 - ci) * 40;
    capOuterGroup.visible = co > 0.02;
    capInnerGroup.visible = ci > 0.02;
  }
  if (installed('needle')) {
    const nv = s.needle == null ? 0 : s.needle;
    needleGroup.position.x = (1 - nv) * 26;
    needleGroup.visible = nv > 0.02;
  }
}

/* ============================ 包围盒 ============================ */
function moduleBounds(keys) {
  const b = new THREE.Box3();
  for (const k of keys) {
    const p = penByKey.get(k);
    if (p) b.union(new THREE.Box3().setFromObject(p.g));
  }
  return b;
}
const MODEL = {
  world: penWorld,
  byKey: penByKey,
  PARTS: penParts,
  moduleBounds,
  applyMotion,
  PEN,
  strokeOf: (mg) => PEN.strokePerMg * mg,
};

/* ==== injection-pen/manifest.mjs ==== */
/* 注射笔 · 插槽填充（纯数据 + 少量回调）
 * 机构依据：一次性预充式注射笔（替尔泊肽 / KwikPen 类，一次性卡式瓶不可更换）。
 * 尺寸与简化项见 notes.md。
 */
const MANIFEST = {
  slug: 'injection-pen',
  brand: {
    title: '注射笔装配实验室',
    subtitle: '一次性预充笔 · 17 件零件 / 12 模块 · 3 关',
    mark: { a: '#a02b4e', b: '#f0dade' },
  },

  chapters: [
    {
      title: '先装药：卡式瓶与活塞',
      subtitle: '药液封在玻璃卡式瓶里，前端被隔膜堵住，后端只有活塞能动。',
      badge: '药筒观察员',
      exp: '剖开，看药液与活塞',
      expText: '剖开笔身：玻璃卡式瓶、里面的药液、尾部那块黑色橡胶活塞。药液前端被隔膜封住，后端只有活塞能动。',
      q: '药液是被什么推向针头的？',
      options: ['活塞被丝杠顶着往前推', '药液自己会往外流', '靠重力往下滴'],
      a: 0,
      why: '卡式瓶两头一封：前端是铝盖压住的橡胶隔膜，后端是活塞。丝杠把活塞往隔膜顶，药液只能经针头出去——活塞每前进 2.82 mm，正好 0.2 mL（1.0 mg）。',
    },
    {
      title: '把旋转变成直推',
      subtitle: '旋钮转半圈 → 扭簧上弦 → 螺母转 → 丝杠前进 2.82 mm。',
      badge: '传动解码员',
      exp: '拨 8 格（1.0 mg），盯住丝杠',
      expText: '一格 22.5°，八格正好半圈。旋钮转了、刻度窗跳出 1.0、扭簧上弦——但丝杠和活塞一点没动。',
      q: '拨完剂量、还没按按钮，活塞前进了吗？',
      options: ['前进了 2.82 mm', '没动：剂量先存在扭簧里', '前进了 1.41 mm'],
      a: 1,
      why: '拨剂量只是把扭簧上弦、把旋钮转到刻度上；螺母被棘爪挡着不转，丝杠也就不会走。按下按钮才松闸，扭簧带着螺母转半圈，丝杠前进 2.82 mm。',
    },
    {
      title: '合笔、上帽、装针',
      subtitle: '笔身把丝杠键住只许直走；拔帽、装针、按到底，药才出去。',
      badge: '注射流程师',
      exp: '拔帽 · 拔内帽 · 装针 · 注射',
      expText: '按顺序做：拔外帽、拔内帽、把针头拧到针座上、拨 1.0 mg 后按下注射按钮。盯着活塞和剩余药量。',
      q: '按下按钮后，是什么让丝杠前进的？',
      options: ['手指直接推丝杠', '扭簧释放，螺母转，丝杠被笔身键住只能直走', '电机带动'],
      a: 1,
      why: '按钮只是松闸：棘爪脱开，扭簧把套筒和螺母带着转半圈；丝杠被笔身的防转键卡住不能自转，螺纹只能把它变成 2.82 mm 的直线行程。',
    },
  ],

  stage: {
    title: '装一支只会往前推的笔',
    hint: '选一块模块，把它放到笔身上它该在的位置。',
  },

  readout: [
    { key: 'dose', label: '剂量设定', big: true },
    { key: 'stroke', label: '活塞行程' },
    { key: 'left', label: '剩余药量' },
    { key: 'clicks', label: '棘轮咔哒' },
  ],

  tray: { title: '第一盒 · 药与活塞', hint: '点选模块，再拖到笔身上' },

  modules: [
    {
      id: 'cart', chapter: 0, name: '药筒组件', parts: ['holder', 'cartridge', 'drug'], color: '#9dbcc6', icon: 'disc',
      sub: '3 件预装',
      tip: '把装好药液的玻璃卡式瓶推进透明支架，瓶颈朝笔头。',
      learn: '卡式瓶是一次性密封件：玻璃管里装着 2 mL 药液（5 mg/mL），前端铝盖压住橡胶隔膜，后端由活塞密封。支架只负责抱住它，不参与密封。',
    },
    {
      id: 'bung', chapter: 0, name: '活塞', parts: ['bung'], color: '#4d4d57', icon: 'piston',
      tip: '把活塞从卡式瓶尾部塞进玻璃管内壁，两道密封筋朝上。',
      learn: '活塞是药液唯一的活动边界。它向前走多少，药液就被挤出多少——Ø9.5 的管内径下，每 2.82 mm 正好是 0.2 mL（1.0 mg）。',
    },
    {
      id: 'hub', chapter: 0, name: '螺纹针座', parts: ['hub'], color: '#aab3b8', icon: 'screw',
      tip: '把针座旋到支架前端，螺纹段朝外，中心孔对着隔膜。',
      learn: '针座外圆是 4 圈螺纹，针头就拧在这上面。它的中心孔正对橡胶隔膜：针头拧到底时，针管才能穿过隔膜进到药液里。',
    },
    {
      id: 'scale', chapter: 1, name: '剂量刻度套筒', parts: ['scale'], color: '#e5dad6', icon: 'disc',
      tip: '把印着 0 / 0.5 / 1.0 的套筒塞进笔身，字正好落在剂量窗后面。',
      learn: '刻度套筒和旋钮是同一根轴上的一体件：旋钮转多少，窗口里的数字就转过多少。数字之间还有 8 根分格线——一格就是一声咔哒。',
    },
    {
      id: 'spring', chapter: 1, name: '扭簧', parts: ['spring'], color: '#c6ced2', icon: 'coil',
      tip: '把钢带扭簧套到驱动套筒外，后端钩在刻度套筒、前端挂在笔身凸耳上。',
      learn: '拨剂量时旋钮把扭簧拧紧，弹性能先存着；按下按钮松闸，扭簧把套筒和螺母一起带着转。药不是被手指推出去的，是这股储能转出来的。',
    },
    {
      id: 'drive', chapter: 1, name: '驱动套筒与螺母', parts: ['sleeve', 'nut'], color: '#8f9a9e', icon: 'screw',
      sub: '2 件预装',
      tip: '把套筒推进笔身，让螺母的内螺纹对准丝杠中心。',
      learn: '螺母只能转、不能前后走（被套筒两侧的凸缘夹住）。它一转，吃在里面的丝杠就只能沿轴向走——这就是"旋转变直推"的那一步。',
    },
    {
      id: 'screw', chapter: 1, name: '丝杠（推杆）', parts: ['screw'], color: '#cfd6da', icon: 'shaft',
      tip: '把丝杠的扁位段穿进笔身的防转键座，螺纹段吃进螺母。',
      learn: '丝杠是双头螺纹，导程 5.64 mm。它的尾部有两道扁位，被笔身上的防转键咬住，所以它永远不会自转——只能被螺母推着直线前进。',
    },
    {
      id: 'dial', chapter: 1, name: '剂量旋钮', parts: ['dial'], color: '#a02b4e', icon: 'gear',
      tip: '把旋钮套到笔身后端，内侧的棘轮齿对准棘爪。',
      learn: '旋钮内侧有 16 个单向棘齿，配一只弹片棘爪：每转过一格（22.5°）棘爪跳一次齿，你听到的就是那声"咔哒"。棘爪只许它往拨剂量的方向转，回不了头。',
    },
    {
      id: 'button', chapter: 2, name: '注射按钮', parts: ['button'], color: '#6e1a33', icon: 'bolt',
      tip: '把按钮从旋钮后端推进去，按面朝外，行程 1.8 mm。',
      learn: '按钮自己不推药：它是一道闸。按下去棘爪被顶开，扭簧才有机会释放。没拨剂量时按钮是压不动的——旋钮不到 1.0，闸就是空的。',
    },
    {
      id: 'body', chapter: 2, name: '笔身与棘爪', parts: ['body', 'pawl'], color: '#f7e9ec', icon: 'housing',
      sub: '2 件预装',
      tip: '把笔身两端口对准，棘爪弹片朝里，剂量窗朝上。',
      learn: '笔身干三件事：托住刻度套筒、用防转键咬住丝杠的扁位、用棘爪给旋钮定格。剖开看，剂量窗后面就是转动的刻度套筒。',
    },
    {
      id: 'needle', chapter: 2, name: '一次性针头', parts: ['needle'], color: '#dfe4e7', icon: 'pin',
      tip: '把针头拧到针座螺纹上，拧到底时针管刚好穿过隔膜。',
      learn: '针头是一次性耗材：塑料座内螺纹咬住针座的 4 圈螺纹，一根 32G 套管针穿过隔膜伸进药液。用完连同针头一起丢，卡式瓶不能换。',
    },
    {
      id: 'caps', chapter: 2, name: '外帽与内帽', parts: ['capOuter', 'capInner'], color: '#8d2545', icon: 'shell',
      sub: '2 件预装',
      tip: '先套内帽护住针头，再扣外帽。取用时顺序相反：先外后内。',
      learn: '外帽是杯状硬壳，内帽是一层薄护套。两层都拔掉才能碰到针座；装针前必须先拔帽，否则针座被内帽整个罩住。',
    },
  ],

  experiments: [
    { id: 'dose', label: '拨剂量（一格 0.125 mg）', control: 'slider', min: 0, max: 8, step: 1, value: 0, unit: ' 格' },
    { id: 'inject', label: '按注射按钮', control: 'button' },
  ],

  notes: [
    '1 unit = 1 mm。含外帽总长 170 mm、笔身 Ø20.8、旋钮 Ø19、卡式瓶 Ø11.6（内径 Ø9.5，壁 1.05）：与公开的预充式注射笔尺度同一量级。除标准件（32G 针管、M 级螺纹）外，内部布置为教学估算。',
    '<b>三条传动链是一条：</b>旋钮（棘轮 16 齿，一格 22.5° = 0.125 mg）→ 扭簧上弦 → 按下按钮松闸 → 套筒与螺母转（180°/mg）→ 丝杠被笔身防转键咬住，只能沿 x 直线走（双头螺纹导程 5.64 mm）→ 活塞 2.82 mm/mg。剂量、行程、剩余药量三个读数都取自同一个 <code>delivered</code> / <code>windMg</code> 状态量。',
    '<b>为什么拨剂量时活塞不动：</b>拨剂量只是把扭簧拧紧、把旋钮转到刻度上；螺母被棘轮挡着不转，丝杠自然不动。按下按钮才松闸。这是这支笔最容易讲错的一环——所以第 2 关的实验专门让人盯着丝杠看。',
    '剖开看：外壳类零件（笔身、支架、卡式瓶、内外帽）在剖开模式下换成半透明，机构保持实体；针座与针头有局部放大窗。',
  ],

  scene: {
    bench: { y: -15, color: 0xe8e4da, size: 1200 },
    spawnFor: (id, info) => [0, 32 + (info.size.y > 16 ? 4 : 0), -4],
    camera: { fov: 30, near: 1, far: 3000, defaultFocus: 'all' },
    orbit: { minDistance: 60, maxDistance: 1800, minPolar: 0.05, maxPolar: 0.55 },
    renderer: { exposure: 1.0, pixelRatio: 1.5 },
    env: 0.55,
    lights: {
      hemi: [0xffffff, 0xcbc2b6, 1.1],
      key: { color: 0xfff4e8, intensity: 2.4, pos: [-100, 190, 170] },
      rim: { color: 0xcfe0f0, intensity: 1.0, pos: [130, 110, -160] },
    },
    cut: { normal: [0, 0, -1], constant: 0 },
    focus: {
      all: { dir: [56, 20], fit: 1.02, box: () => [[85, 0, 0], [196, 34, 34]] },
      rear: { dir: [62, 26], fit: 1.1, box: () => [[16, 0, 0], [54, 30, 30]] },
      drive: { dir: [62, 24], fit: 1.05, box: () => [[68, 0, 0], [48, 26, 26]] },
      cart: { dir: [62, 22], fit: 1.05, box: () => [[112, 0, 0], [58, 24, 24]] },
      tip: { dir: [62, 24], fit: 1.1, box: () => [[148, 0, 0], [32, 22, 22]] },
    },
    inset: {
      fov: 30,
      visible: (s) => s.phase !== 'build' && (s.capOuter || 0) < 0.5 && (s.capInner || 0) < 0.5
        && (s.needle || 0) > 0.6 && (s.placed || []).includes('needle'),
      target: () => ({
        part: 'needle',
        local: [149, 0, 0],
        offset: [11, 9, 20],
        title: '针座螺纹 · 针头 · 隔膜',
      }),
    },
  },
};

/* ==== injection-pen/logic.mjs ==== */
/* 注射笔 · 装配与实验逻辑（纯逻辑，无 DOM、无三维）
 * 每步先校验、再改状态；失败不动已装件与已拨剂量。
 * 剂量 / 行程 / 剩余药量都出自这里的 windMg、delivered 两个状态量，model.mjs 的几何也只读这两个量。
 */
const PEN_MODS = MANIFEST.modules;
const PEN_CH = MANIFEST.chapters;
const PEN_CLICKS_PER_MG = Math.round(1 / PEN.clickMg);   // 8 格 = 1.0 mg
function createGame() {
  const TOTAL = PEN.totalMg;
  const DIAL_RATE = 2.6;      // mg/s：拨剂量动画（8 格约 0.4 s）
  const INJECT_RATE = 0.55;   // mg/s：注射动画（1.0 mg 约 1.8 s）
  const MOVE_RATE = 5;        // 帽 / 针的滑动速度（每秒完成比例）

  const initial = () => ({
    chapter: 0, phase: 'build', placed: [], selected: null,
    completed: [false, false, false],
    capOuterT: 1, capOuter: 1, capInnerT: 1, capInner: 1,
    needleT: 1, needle: 1,
    pressT: 0, press: 0,
    targetMg: 0, windMg: 0, delivered: 0, pending: 0,
    expStep: 0, lastKind: '',
  });
  const state = initial();

  const fail = (message) => ({ ok: false, message });
  const mod = (id) => PEN_MODS.find((m) => m.id === id);
  const has = (id) => state.placed.includes(id);
  const capsOff = () => state.capOuter < 0.05 && state.capInner < 0.05;
  const slack = () => TOTAL - state.delivered - state.windMg;

  function current() {
    if (state.phase !== 'build') return null;
    return PEN_MODS.find((m) => m.chapter === state.chapter && !has(m.id)) || null;
  }
  function select(id) {
    if (state.phase !== 'build') return fail(state.phase === 'lab' ? '自由实验室里不重装零件，想从头来请点「重新开始」。' : '先完成本章的实验与挑战，再继续装配。');
    const m = mod(id);
    if (!m) return fail('没有这块模块，请从零件盒选择。');
    if (has(id)) return fail(m.name + ' 已经装好了。');
    if (m.chapter !== state.chapter) return fail('这一步还轮不到' + m.name + '——先完成当前这一关。');
    state.selected = id;
    return { ok: true, message: m.tip };
  }
  function place(onTarget = true) {
    if (state.phase !== 'build') return fail('本章装配已完成，请做实验与挑战。');
    if (!state.selected) return fail('先从零件盒选一块模块。');
    if (onTarget !== true) return fail('还没对准位置——拖到笔身上的高亮轮廓里再松手。');
    const m = current();
    if (!m) return fail('本章已经装完了。');
    if (state.selected !== m.id) return fail('这一步需要「' + m.name + '」，顺序不能乱。');
    state.placed.push(m.id);
    state.selected = null;
    if (m.id === 'caps') { state.capOuterT = 1; state.capInnerT = 1; }
    if (m.id === 'needle') { state.needleT = 1; }
    if (!PEN_MODS.some((x) => x.chapter === state.chapter && !has(x.id))) state.phase = 'experiment';
    return { ok: true, message: m.name + ' 已归位。', learn: m.learn, kind: 'placed' };
  }
  function undo() {
    if (state.phase === 'lab') return fail('自由实验室不撤回；想重装请点「重新开始」。');
    const last = state.placed.at(-1), m = mod(last);
    if (!m || m.chapter !== state.chapter) return fail('本章还没有可撤回的模块。');
    state.placed.pop(); state.phase = 'build'; state.selected = null;
    state.completed[state.chapter] = false; state.expStep = 0;
    if (m.id === 'dial' || m.id === 'spring') { state.targetMg = 0; state.windMg = 0; }
    if (m.id === 'screw' || m.id === 'bung') { state.delivered = 0; state.pending = 0; }
    if (m.id === 'caps') { state.capOuterT = 1; state.capInnerT = 1; }
    if (m.id === 'needle') { state.needleT = 0; }
    return { ok: true, message: '已撤回 ' + m.name + '，可以重新装配。', kind: 'undo' };
  }
  function experiment() {
    if (state.phase !== 'experiment') return fail('先把本章模块全部装好，再做实验。');
    state.phase = 'quiz';
    return { ok: true, message: PEN_CH[state.chapter].expText || '', kind: 'experiment' };
  }
  function answer(i) {
    if (state.phase !== 'quiz') return fail('先亲手完成本章实验，再回答问题。');
    const c = PEN_CH[state.chapter];
    if (!Number.isInteger(i) || i < 0 || i >= c.options.length) return fail('请选择一个有效答案。');
    if (i !== c.a) return { ok: false, message: '再观察一下。' + c.why, learn: c.why, kind: 'wrong' };
    state.completed[state.chapter] = true; state.phase = 'checkpoint';
    return { ok: true, message: '答对了！获得「' + c.badge + '」。', learn: c.why, kind: 'correct' };
  }
  function next() {
    if (state.phase !== 'checkpoint' || !state.completed[state.chapter]) return fail('先完成本章的实验与挑战。');
    if (state.chapter < PEN_CH.length - 1) {
      state.chapter++; state.phase = 'build'; state.expStep = 0;
      return { ok: true, message: PEN_CH[state.chapter].subtitle, kind: 'chapter' };
    }
    state.phase = 'lab';
    return { ok: true, message: '装配完成！拔帽、装针、拨剂量、按到底——随便试。', kind: 'complete' };
  }

  /* ---------------- 剂量 ---------------- */
  function dialTo(mg) {
    if (state.phase === 'build' || state.phase === 'checkpoint') return fail('先装完这一段，再拨剂量。');
    if (!has('dial')) return fail('剂量旋钮还没装，拨不动。');
    if (state.pending > 0) return fail('正在注射——等它打完再拨。');
    const want = Math.max(0, Math.min(1, Math.round(Number(mg) / PEN.clickMg) * PEN.clickMg));
    if (want > slack() + 1e-6) return fail('药不够了：这支笔只剩 ' + (TOTAL - state.delivered).toFixed(2) + ' mg。');
    state.targetMg = want;
    state.expStep = Math.max(state.expStep, want > 0.001 ? 1 : 0);
    const clicks = Math.round(want / PEN.clickMg);
    return {
      ok: true,
      kind: 'dose',
      message: want < 0.001
        ? '旋钮回到 0：扭簧松了，按钮压不动。'
        : '旋钮转过 ' + clicks + ' 格（' + (clicks * 22.5).toFixed(1) + '°），棘爪咔哒 ' + clicks + ' 声，扭簧上弦；丝杠和活塞没有动。',
    };
  }
  function clickOne() {
    const next = Math.round((state.targetMg + PEN.clickMg) / PEN.clickMg) * PEN.clickMg;
    return dialTo(next > 1.0001 ? PEN.clickMg : next);
  }
  function inject() {
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2))
      return fail('先装完这一段，再按注射按钮。');
    if (!has('dial') || !has('button')) return fail('按钮或旋钮还没装好。');
    if (state.pending > 0) return fail('正在注射——等它打完。');
    if (state.capOuter > 0.05 || state.capOuterT > 0.5) return fail('外帽还盖着——先拔掉外帽。');
    if (has('caps') && (state.capInner > 0.05 || state.capInnerT > 0.5)) return fail('内帽还罩着针头——先拔掉内帽。');
    if (has('needle') && (state.needle < 0.5 || state.needleT < 0.5)) return fail('还没装针头，药出不去。');
    if (state.windMg < PEN.clickMg / 2) return fail('旋钮在 0：按钮是锁死的，先拨剂量。');
    state.pending = state.windMg;
    state.pressT = 1;
    return {
      ok: true, kind: 'inject',
      message: '按下按钮：棘爪被顶开，扭簧释放——螺母转，丝杠前进 ' + (PEN.strokePerMg * state.windMg).toFixed(2) + ' mm，药经针头出去。',
    };
  }

  /* ---------------- 帽 / 针 ---------------- */
  function uncapOuter() {
    if (!has('caps')) return fail('外帽还没装上。');
    if (state.pending > 0) return fail('正在注射——先等它打完。');
    if (state.capOuterT < 0.5) return fail('外帽已经拔掉了。');
    state.capOuterT = 0;
    return { ok: true, kind: 'uncap', message: '外帽（杯状硬壳）已取下，露出内帽。' };
  }
  function uncapInner() {
    if (!has('caps')) return fail('内帽还没装上。');
    if (state.pending > 0) return fail('正在注射——先等它打完。');
    if (state.capOuterT > 0.5) return fail('外帽还套着——先把外帽拔掉。');
    if (state.capInnerT < 0.5) return fail('内帽已经拔掉了。');
    state.capInnerT = 0;
    return { ok: true, kind: 'uncap', message: '内帽（护住针座的薄护套）已取下，针座和针头露出来了。' };
  }
  function mountNeedle() {
    if (!has('needle')) return fail('针头还没装上。');
    if (state.pending > 0) return fail('正在注射——先等它打完。');
    if (state.capInnerT > 0.5) return fail('内帽还罩着针座——先拔内帽，针头才拧得进去。');
    if (state.needleT > 0.5) return fail('针头已经拧在针座上了。');
    state.needleT = 1;
    return { ok: true, kind: 'needle', message: '针头拧到针座螺纹上，拧到底时针管穿过隔膜进到药液里。' };
  }
  function unmountNeedle() {
    if (!has('needle')) return fail('针头还没装上。');
    if (state.pending > 0) return fail('正在注射——先等它打完。');
    if (state.needleT < 0.5) return fail('针头已经取下了。');
    state.needleT = 0;
    return { ok: true, kind: 'needle', message: '针头拧下来（一次性耗材，用完就丢）——卡式瓶不能换，但药还剩 ' + (TOTAL - state.delivered).toFixed(2) + ' mg。' };
  }

  /* ---------------- 每帧 ---------------- */
  function update(dt) {
    const h = Math.max(0, Math.min(0.1, dt || 0));
    // 帽 / 针滑动
    const step = (cur, want) => {
      const d = want - cur, m = MOVE_RATE * h;
      return Math.abs(d) <= m ? want : cur + Math.sign(d) * m;
    };
    state.capOuter = step(state.capOuter, state.capOuterT);
    state.capInner = step(state.capInner, state.capInnerT);
    state.needle = step(state.needle, state.needleT);
    // 按钮：按下 0.12 s，松手 0.2 s
    state.press += ((state.pressT ? 1 : 0) - state.press) * Math.min(1, h * (state.pressT ? 14 : 8));
    // 注射：pending 就是"这一针要打掉的剂量"，windMg 与 delivered 同步反向变化
    if (state.pending > 0.0005) {
      const d = Math.min(state.pending, INJECT_RATE * h);
      state.pending -= d;
      state.windMg = Math.max(0, state.windMg - d);
      state.delivered = Math.min(TOTAL, state.delivered + d);
      state.targetMg = Math.max(0, state.targetMg - d);
      if (state.pending <= 0.0005) {
        state.pending = 0; state.windMg = 0; state.targetMg = 0; state.pressT = 0;
        state.lastKind = 'done';
      }
    } else {
      // 拨剂量：旋钮追目标，几何与读数同步走
      const d = state.targetMg - state.windMg, m = DIAL_RATE * h;
      state.windMg = Math.abs(d) <= m ? state.targetMg : state.windMg + Math.sign(d) * m;
    }
  }

  function reset() {
    Object.assign(state, initial());
    state.needle = 0; state.needleT = 0; state.capOuter = 0; state.capInner = 0;
    state.capOuterT = 1; state.capInnerT = 1;
    return { ok: true, kind: 'restart', message: '新的装配开始了——先把药筒组件放进笔身。' };
  }
  function demo() {
    Object.assign(state, initial());
    state.placed = PEN_MODS.map((m) => m.id);
    state.completed = [true, true, true];
    state.chapter = PEN_CH.length - 1;
    state.phase = 'lab';
    state.capOuter = 1; state.capOuterT = 1;
    state.capInner = 1; state.capInnerT = 1;
    state.needle = 1; state.needleT = 1;
    return { ok: true, kind: 'demo', message: '整支笔装好了（帽还盖着）：先拔外帽、再拔内帽，然后拨剂量、按按钮。' };
  }

  return {
    state, current, select, place, undo, experiment, answer, next,
    dialTo, clickOne, inject, uncapOuter, uncapInner, mountNeedle, unmountNeedle,
    update, reset, demo,
    capsOff, slack, total: TOTAL,
  };
}

export { MODEL, MANIFEST, createGame, THREE };
