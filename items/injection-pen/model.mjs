import * as THREE from 'three';

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

export const MODEL = {
  world: penWorld,
  byKey: penByKey,
  PARTS: penParts,
  moduleBounds,
  applyMotion,
  PEN,
  strokeOf: (mg) => PEN.strokePerMg * mg,
};
