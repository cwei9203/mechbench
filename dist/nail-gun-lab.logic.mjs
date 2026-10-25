/* mechbench · 生成物，勿手改
 * 源：items/nail-gun-lab/{model.mjs,manifest.mjs,logic.mjs}
 * 重新生成：python3 tools/build.py nail-gun-lab
 * 用途：无浏览器断言 → node tools/verify.mjs nail-gun-lab
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

/* ==== nail-gun-lab/model.mjs ==== */

/* 气钉枪 · 几何与运动（重做版）
 * 基准 1 unit = 1 mm。外形包络按 DeWalt DWFP12233 18Ga 直钉枪（长≈287、高≈241、宽≈81 mm，
 * 70–120 psi，1/4" NPT，100 支弹匣，F15–F50 直钉）；内部气路与阀件为教学估算。
 * 结构：后握把、前鼻框、缸孔在下、头阀在上；弹匣在握把前方、缸体下方，钉条竖挂。
 * 击发轴 x=190；活塞行程 41.7；钉条 80 支、钉距 1.5（真机 100 支、钉距≈1.4，模型受弹匣梁长度限制）。
 */
const world = new THREE.Group();

const M = {
  alu:     new THREE.MeshPhysicalMaterial({ color:0xb9bec6, metalness:.72, roughness:.44, clearcoat:.28, clearcoatRoughness:.5 }),
  aluDark: new THREE.MeshStandardMaterial({ color:0x848b93, metalness:.7, roughness:.5 }),
  steel:   new THREE.MeshStandardMaterial({ color:0xb3bbc2, metalness:.95, roughness:.26 }),
  steelDark:new THREE.MeshStandardMaterial({ color:0x6c737b, metalness:.9, roughness:.4 }),
  rubber:  new THREE.MeshStandardMaterial({ color:0x2b2e33, roughness:.94 }),
  plastic: new THREE.MeshStandardMaterial({ color:0x3a3d44, roughness:.62 }),
  yellow:  new THREE.MeshStandardMaterial({ color:0xe3ae37, roughness:.52 }),
  brass:   new THREE.MeshStandardMaterial({ color:0xc19a4e, metalness:.88, roughness:.33 }),
  wood:    new THREE.MeshStandardMaterial({ color:0xc8a06c, roughness:.86 }),
  nail:    new THREE.MeshStandardMaterial({ color:0xb6bcc2, metalness:.95, roughness:.3 }),
  glue:    new THREE.MeshStandardMaterial({ color:0xd8c98f, roughness:.7 }),
  red:     new THREE.MeshStandardMaterial({ color:0xc2452d, roughness:.5 }),
  air:     new THREE.MeshBasicMaterial({ color:0x5fa8d8, transparent:true, opacity:.95, depthTest:false }),
  puff:    new THREE.MeshBasicMaterial({ color:0xd8dee6, transparent:true, opacity:.5, depthWrite:false }),
  clamp:   new THREE.MeshStandardMaterial({ color:0x58514a, roughness:.85 }),
};

const TAU = Math.PI * 2;
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
function group(){ return new THREE.Group(); }
function mesh(g, m, parent, pos){ const o = new THREE.Mesh(g, m); if (pos) o.position.copy(pos); if (parent) parent.add(o); return o; }
function box(w,h,d, m, parent, pos){ return mesh(new THREE.BoxGeometry(w,h,d), m, parent, pos); }
function latheY(profile, seg=48, start=0, len=TAU){
  const g = new THREE.LatheGeometry(profile.map(([y,r]) => new THREE.Vector2(Math.max(r,1e-3), y)), seg, start, len);
  g.computeVertexNormals(); return g;
}
function ringY(y0,y1,ro,ri, m, parent, cx=0, cz=0){ return mesh(latheY([[y0,ri],[y0,ro],[y1,ro],[y1,ri],[y0,ri]]), m, parent, V(cx,0,cz)); }
function cylY(r,h, m, parent, pos, seg=40){ return mesh(new THREE.CylinderGeometry(r,r,h,seg), m, parent, pos); }
function cylZ(r,h, m, parent, pos, seg=32){ const o = cylY(r,h,m,parent,pos,seg); o.rotation.x = Math.PI/2; return o; }
function cylX(r,h, m, parent, pos, seg=32){ const o = cylY(r,h,m,parent,pos,seg); o.rotation.z = Math.PI/2; return o; }
function wire(pts, r, m, parent){
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>V(...p))), Math.max(24,pts.length*6), r, 8, false), m, parent);
}
function helixY(y0,y1,radius,wireR,turns,m,parent){
  const pts=[]; for(let i=0;i<=turns*32;i++){ const t=i/(turns*32), a=t*turns*TAU;
    pts.push([radius*Math.cos(a), y0+(y1-y0)*t, radius*Math.sin(a)]); }
  return wire(pts,wireR,m,parent);
}
function helixX(x0,x1,radius,wireR,turns,m,parent){
  const pts=[]; for(let i=0;i<=turns*32;i++){ const t=i/(turns*32), a=t*turns*TAU;
    pts.push([x0+(x1-x0)*t, radius*Math.cos(a), radius*Math.sin(a)]); }
  return wire(pts,wireR,m,parent);
}
// 18Ga 直钉的钉头是 "D 头"：沿钉条方向的窄边 1.4，横向 2.0。
// 圆形 Ø1.9 头放不进 1.5 的钉距——刀尖要从相邻两钉头之间穿过。
function dHead(parent, pos){ return box(1.4,.8,2.0, M.nail, parent, pos); }
function torusY(r,wireR,m,parent,pos){ const o=mesh(new THREE.TorusGeometry(r,wireR,10,48),m,parent,pos); o.rotation.x=Math.PI/2; return o; }
// x-y 平面上的圆角矩形（沿 z 挤出）
function rrect(x0,y0,x1,y1,r){
  const s = new THREE.Shape();
  s.moveTo(x0+r,y0); s.lineTo(x1-r,y0); s.quadraticCurveTo(x1,y0,x1,y0+r);
  s.lineTo(x1,y1-r); s.quadraticCurveTo(x1,y1,x1-r,y1);
  s.lineTo(x0+r,y1); s.quadraticCurveTo(x0,y1,x0,y1-r);
  s.lineTo(x0,y0+r); s.quadraticCurveTo(x0,y0,x0+r,y0);
  return s;
}
function extrudeXY(shape, half, m, parent, bevel=1){
  const g = new THREE.ExtrudeGeometry(shape, { depth:half*2, bevelEnabled:bevel>0, bevelSize:bevel, bevelThickness:bevel, bevelSegments:2, curveSegments:24 });
  g.translate(0,0,-half);
  return mesh(g, m, parent);
}
// 带圆孔的平板：x0..x1 × z0..z1，厚 thick，顶面 y0
function plateHole(x0,x1,z0,z1,y0,thick,holeR,hx,hz,m,parent){
  const s=new THREE.Shape(); s.moveTo(x0,z0); s.lineTo(x1,z0); s.lineTo(x1,z1); s.lineTo(x0,z1); s.closePath();
  if(holeR>0){ const h=new THREE.Path(); h.absarc(hx,hz,holeR,0,TAU,true); s.holes.push(h); }
  const g=new THREE.ExtrudeGeometry(s,{depth:thick,bevelEnabled:false});
  g.rotateX(-Math.PI/2); g.translate(0,y0,0); return mesh(g,m,parent);
}
function printLabel(text,w,h,parent,pos,rotY=Math.PI){
  const c=document.createElement('canvas'); c.width=512; c.height=Math.round(512*h/w);
  const ctx=c.getContext('2d'); ctx.fillStyle='#7d776c'; ctx.font=`700 ${Math.floor(c.height*.5)}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,c.width/2,c.height/2);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8;
  const o=mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}), parent, pos);
  o.rotation.y=rotY; o.userData.label=true; o.userData.keepMat=true; return o;
}

/* ---------- 关键坐标 ---------- */
const NX = 190;                       // 击发 / 缸孔 / 钉道轴线
const STROKE = 41.7;
const BLADE_TIP_REST = -11, BLADE_TIP_FIRED = BLADE_TIP_REST - STROKE;
const PITCH = 1.5, NAILS = 80;
const FOLLOWER_FRONT0 = NX - (NAILS-1)*PITCH - 1.4;   // 71.6
const BOARD_TOP = -54;

/* ---------- 零件注册 ---------- */
const parts = [], byKey = new Map(), PIV = {};
function addPart(key, name, obj, mat, opt = {}){
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.keepMat) o.material = (o.userData.mat || mat).clone();
    o.userData.omat = o.material;
    o.userData.key = key;
  });
  const g = new THREE.Group();
  g.add(obj); g.userData.key = key;
  world.add(g);
  const p = { key, name, g, obj, anim:new THREE.Vector3(), shell:!!opt.shell };
  parts.push(p); byKey.set(key, p);
  return p;
}

/* ---------- 01 主机体：上梁 + 前鼻筒 + 握把座 + 弹匣梁 ---------- */
{
  const g = group();
  // 上梁（压铸壳体）
  extrudeXY(rrect(-34,4,238,54,10), 22, M.alu, g, 1.3);
  // 头盖座
  ringY(52,58,28,13,M.alu,g,NX,0);
  // 握把座
  extrudeXY(rrect(-44,-8,24,6,4), 23, M.alu, g, .9);
  // 前鼻筒：侧面开一个大窗，不剖开也能看见缸底、回程孔和击针
  mesh(latheY([[-44,17.5],[-44,21],[2,21],[6,19],[6,17],[-44,17.5]], 56, Math.PI*.70, Math.PI*1.60), M.aluDark, g, V(NX,0,0));
  box(12,50,40, M.aluDark, g, V(216,-19,0));      // 前柱
  box(52,4,40, M.aluDark, g, V(198,-46,0));        // 鼻筒底环
  // 回程环腔（缸壁外的环形空间，剖开时可见）
  ringY(-22,-2,24,19.5,M.aluDark,g,NX,0);
  for (const s2 of [-1,1]) box(6,4,10,M.aluDark,g,V(NX+s2*21,-12,0));
  // 弹匣梁：顶板 + 远侧壁 + 近侧窗 + 底轨 + 尾端盖
  box(134,4,20, M.aluDark, g, V(123,-10,0));                   // 顶板 x 56..190
  box(134,40,3, M.aluDark, g, V(123,-32,-8.6));                // 远侧壁
  box(134,18,3, M.aluDark, g, V(123,-43,8.6));                 // 近侧下壁
  box(134,2.6,2.6, M.aluDark, g, V(123,-12.3,8.6));            // 近侧挂轨
  for (const s2 of [-1,1]) box(134,4,2.4, M.aluDark, g, V(123,-50,s2*8.6));  // 底轨
  box(6,5,20, M.aluDark, g, V(58,-9.5,0));                     // 尾端上桥
  box(6,5,20, M.aluDark, g, V(58,-49.5,0));                    // 尾端下桥
  box(10,34,24, M.aluDark, g, V(158,-30,0));                   // 弹匣前段过渡
  // 观察窗：薄透明板 + 中肋（旧版整面敞开，看着像缺了一块）
  for (const rx of [100,155]) box(3,22,3, M.aluDark, g, V(rx,-24,9.2));
  // 侧面压铸细节：凹槽 + 品牌条
  for (const s2 of [-1,1]){
    box(150,7,.5, M.aluDark, g, V(96,34,s2*22.2));
    box(96,1.6,.5, M.yellow, g, V(96,40,s2*22.2));
  }
  // 标牌
  printLabel('18 GA · 70–120 PSI', 54, 5.4, g, V(96,20,-22.4));
  addPart('body', '主机体', g, M.alu, { shell:true });
}

/* ---------- 02 头盖 + 03 排气导板 + 04 头阀塞 + 05 阀弹簧 ---------- */
{
  const cap = group();
  // 圆顶 + 底法兰；内腔由阀腔衬套表达
  mesh(latheY([[50,12],[50,27],[53,29],[58,30],[66,28.5],[74,25],[80,19],[84,11],[85,3],[85,0],[50,0]],48), M.alu, cap, V(NX,0,0));
  ringY(50,84,12,9.5,M.aluDark,cap,NX,0);           // 阀腔
  ringY(80,84,9.5,4,M.aluDark,cap,NX,0);            // 气室顶
  for (const [dx,dz] of [[-21,-9],[21,-9],[-21,9],[21,9]]){
    cylY(2.4,3, M.aluDark, cap, V(NX+dx,53,dz), 8);
    cylY(1.1,4.6, M.steelDark, cap, V(NX+dx,54,dz), 6);
  }
  addPart('headcap', '头盖', cap, M.alu, { shell:true });

  const defl = group();
  const hood = group(); hood.position.set(NX+26, 79, 0);
  const arc = new THREE.Shape();
  arc.absarc(0, 0, 13, Math.PI*.10, Math.PI*.90, false);
  const dg = new THREE.ExtrudeGeometry(arc, { depth:24, bevelEnabled:false, curveSegments:24 });
  dg.translate(0, 0, -12);
  mesh(dg, M.plastic, hood);
  cylX(3.2, 10, M.plastic, hood, V(0, 12, 0));
  box(6, 9, 3, M.yellow, hood, V(4, 16, 0));
  defl.add(hood); PIV.defl = hood;
  addPart('deflector', '排气导板', defl, M.plastic);

  const plug = group();
  ringY(51,70,9.9,4.2,M.steel,plug,NX,0);
  ringY(69.5,70.4,9.9,4.2,M.steel,plug,NX,0);
  ringY(51,51.9,9.9,4.2,M.steel,plug,NX,0);
  ringY(51,70,4.8,4,M.steelDark,plug,NX,0);        // 中央回气孔
  torusY(9.4,1.05,M.rubber,plug,V(NX,55,0));
  torusY(9.4,1.05,M.rubber,plug,V(NX,66,0));
  addPart('plunger', '头阀塞', plug, M.steel);

  const vs = group();
  helixY(70.5,76.5,5.4,.42,4.5,M.steel,vs).position.x = NX;
  addPart('vspring', '阀弹簧', vs, M.steel);
}

/* ---------- 06 气缸 + 07 缓冲垫（模块：动力缸芯） ---------- */
{
  const cyl = group();
  for (const [y0,y1] of [[48,26],[24,-18],[-20,-22]]) ringY(y1, y0, 17, 14, M.alu, cyl, NX, 0);
  // 两圈真实回程孔（窗）
  for (const y of [4,-8])
    for (let k=0;k<4;k++){
      const a0 = k*Math.PI/2+.16, a1 = (k+1)*Math.PI/2-.16;
      mesh(latheY([[y-1.4,14],[y-1.4,17],[y+1.4,17],[y+1.4,14],[y-1.4,14]], 10, a0, a1-a0), M.alu, cyl, V(NX,0,0));
      const o = cylY(1.55,4.6,M.steelDark,cyl,V(NX+Math.cos((a0+a1)/2)*15.5,y,Math.sin((a0+a1)/2)*15.5));
      o.quaternion.setFromUnitVectors(V(0,1,0), V(Math.cos((a0+a1)/2),0,Math.sin((a0+a1)/2)));
    }
  addPart('cylinder', '气缸', cyl, M.alu);

  const bump = group();
  ringY(-22,-14,13.7,4.5,M.rubber,bump,NX,0);
  addPart('bumper', '缓冲垫', bump, M.rubber);
}

/* ---------- 08 活塞击针（模块：活塞击针） ---------- */
{
  const g = group();
  ringY(28,44,13.5,11.8,M.aluDark,g,NX,0);
  torusY(13.2,1.15,M.rubber,g,V(NX,36,0));
  ringY(43.2,44,12,10,M.aluDark,g,NX,0);
  box(3.2,6,6,M.steel,g,V(NX,25,0));          // 活塞到击针的过渡
  box(1.2,35,2.6,M.steel,g,V(NX,7.5,0));      // 击针（薄，避免撞相邻钉头）
  box(1.4,1.4,1.9,M.steelDark,g,V(NX,-10.3,0)); // 刀尖 1.4 宽，停在钉头上方 0.3
  addPart('piston', '活塞击针', g, M.aluDark);
}

/* ---------- 09 握把壳（模块：握把壳） ---------- */
{
  const g = group();
  const s2 = new THREE.Shape();
  s2.moveTo(-40,6); s2.lineTo(38,6);
  s2.quadraticCurveTo(42,-24, 22,-92);
  s2.quadraticCurveTo(12,-108, 4,-120);
  s2.lineTo(-46,-120);
  s2.quadraticCurveTo(-54,-100, -44,-60);
  s2.quadraticCurveTo(-42,-26, -40,6);
  const geo = new THREE.ExtrudeGeometry(s2, { depth:30, bevelEnabled:true, bevelSize:2.2, bevelThickness:1.8, bevelSegments:3, curveSegments:20 });
  geo.translate(0,0,-15);
  mesh(geo, M.plastic, g);
  const s3 = new THREE.Shape();
  s3.moveTo(-34,-58); s3.lineTo(24,-58);
  s3.quadraticCurveTo(18,-96, 4,-120); s3.lineTo(-46,-120);
  s3.quadraticCurveTo(-46,-92, -40,-58); s3.closePath();
  for (const sign of [-1,1]){
    const r = new THREE.ExtrudeGeometry(s3, { depth:1.6, bevelEnabled:true, bevelSize:1.2, bevelThickness:.9, bevelSegments:2, curveSegments:16 });
    r.translate(0,0,sign>0?14.2:-15.8);
    mesh(r, M.rubber, g);
  }
  for (const sign of [-1,1]) box(28,2.4,.6,M.yellow,g,V(-10,-52,sign*16.2));
  box(48,10,26,M.plastic,g,V(-20,-124,0));      // 底盖
  printLabel('MAX 120 PSI', 26, 4, g, V(-12,-78,17), Math.PI);
  addPart('grip', '握把壳', g, M.plastic, { shell:true });
}

/* ---------- 10 触发阀组件 + 11 气源接头（模块：触发阀与接头） ---------- */
{
  const tv = group();
  ringY(-36,-6,7,5.4,M.plastic,tv,4,0);
  ringY(-26,-22,7.4,5.4,M.brass,tv,4,0);
  ringY(-15,-11,7.4,5.4,M.brass,tv,4,0);
  const stem = group();
  cylY(2.6,22,M.steel,stem,V(4,-17,0));
  cylY(4.4,1.6,M.steelDark,stem,V(4,-34,0));  // 滚轮座
  torusY(2.55,.7,M.rubber,stem,V(4,-24,0));
  torusY(2.55,.7,M.rubber,stem,V(4,-12,0));
  tv.add(stem); PIV.tstem = stem;
  helixY(-36,-31,4.2,.5,3,M.steel,tv).position.x = 4;
  addPart('tvalve', '触发阀组件', tv, M.plastic);

  const inp = group();
  cylY(10,22,M.brass,inp,V(-14,-140,0));
  cylY(11.4,4,M.brass,inp,V(-14,-132,0),6);
  cylY(9.2,3,M.rubber,inp,V(-14,-151,0));
  cylY(5.5,14,M.brass,inp,V(-14,-159,0));
  cylY(7.5,4.5,M.brass,inp,V(-14,-166,0));
  addPart('inlet', '气源接头', inp, M.brass);
}

/* ---------- 12 控制气管（模块：控制气管） ---------- */
{
  const g = group();
  wire([[0,-10,8],[14,0,18],[58,12,23],[120,22,23],[166,40,20],[176,52,8]], 1.3, M.plastic, g);
  for (const p2 of [[58,12,23],[120,22,23]]) cylX(1.9,3.6,M.plastic,g,V(p2[0],p2[1],p2[2])).rotation.z = Math.PI/2;
  addPart('tube', '控制气管', g, M.plastic);
}

/* ---------- 13 扳机联动（模块：扳机联动） ---------- */
{
  const g = group();
  const lever = group(); lever.position.set(38,-8,0);
  const sh = new THREE.Shape();
  sh.moveTo(-4,0); sh.lineTo(7,0);
  sh.quadraticCurveTo(11,-20, 5,-44);
  sh.quadraticCurveTo(1,-52, -7,-48);
  sh.quadraticCurveTo(-2,-22, -4,0);
  const lg = new THREE.ExtrudeGeometry(sh, { depth:10, bevelEnabled:true, bevelSize:1.3, bevelThickness:1.1, bevelSegments:2, curveSegments:12 });
  lg.translate(0,0,-5);
  mesh(lg, M.aluDark, lever);
  box(9,5,9,M.yellow,lever,V(1,-46,0));        // 黄色扳机面
  cylZ(1.6,11,M.steelDark,lever,V(0,0,0));
  const pawl = group(); pawl.position.set(-16,6,0);
  box(4,20,4,M.steelDark,pawl,V(0,-7,0));
  box(5,2.4,5,M.steelDark,pawl,V(-1,3,0));     // 保险挂钩
  lever.add(pawl); PIV.pawl = pawl;
  g.add(lever); PIV.trig = lever;
  box(26,3,3,M.steelDark,g,V(22,-36,0));       // 扳机→阀杆的连杆
  helixY(-4,8,3.2,.5,3.5,M.steel,g).position.set(28,0,5);
  addPart('trig', '扳机联动', g, M.aluDark);
}

/* ---------- 14 保险触压板（模块：保险触压板） ---------- */
{
  const g = group();
  // U 形触压板：出钉口在中间，钉条从后方通过
  box(30,9,28, M.aluDark, g, V(212,-48.5,0));                 // 前唇
  for (const s of [-1,1]) box(26,9,4, M.aluDark, g, V(186,-48.5,s*12));
  box(30,2,28, M.yellow, g, V(212,-53.5,0));                  // 防滑垫
  plateHole(198,226,-3.4,3.4,-54.5,1,1.7,NX,0,M.alu, g);      // 出钉孔导板
  box(3,5,3,M.steelDark,g,V(NX,-45,8.4));                     // 深度滑块接口
  for (const s of [-1,1]) helixY(-44,-38,1.8,.45,2.5,M.steel,g).position.set(196,0,s*8.5);
  addPart('trip', '保险触压板', g, M.aluDark);
}

/* ---------- 15 深度调节轮（模块：深度调节轮） ---------- */
{
  const g = group();
  const wheel = group(); wheel.position.set(204,-38,25.5);
  const kn = cylY(11,5, M.yellow, wheel); kn.rotation.x = Math.PI/2;
  const pts = [];
  for (let i=0;i<36;i++){ const a=i*TAU/36;
    pts.push(new THREE.Vector2(Math.cos(a)*11, Math.sin(a)*11),
             new THREE.Vector2(Math.cos(a+TAU/72)*12.2, Math.sin(a+TAU/72)*12.2)); }
  const s = new THREE.Shape(pts); const h = new THREE.Path(); h.absarc(0,0,4,0,TAU,true); s.holes.push(h);
  const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth:5, bevelEnabled:false }), M.yellow);
  ring.rotation.y = Math.PI/2; ring.position.z = -2.5; wheel.add(ring);
  box(2.4,5,2.4, M.red, wheel, V(0,10.6,0));
  g.add(wheel); PIV.dwheel = wheel;
  cylZ(4,12, M.steelDark, g, V(204,-38,19));
  box(6,3,5, M.steelDark, g, V(204,-38,15));
  addPart('dwheel', '深度调节轮', g, M.yellow);
}

/* ---------- 16 卡扣门（模块：卡扣门） ---------- */
{
  const g = group();
  const door = group(); door.position.set(204,-30,-22.5);
  box(26,26,2.2, M.aluDark, door, V(-13,0,0));
  box(6,9,3, M.yellow, door, V(-22,-8,-1));
  cylY(1.4,28, M.steelDark, door, V(0,0,1)).rotation.z = Math.PI/2;
  g.add(door); PIV.latch = door;
  box(4,4,3, M.steelDark, g, V(186,-16,-23));
  addPart('latch', '卡扣门', g, M.aluDark);
}

/* ---------- 弯钉（卡钉演示，场景件） ---------- */
{
  const jam = group(); jam.position.set(188,-22,0); jam.rotation.z = .5;
  cylY(.6,34, M.nail, jam, V(0,-16,0), 8);
  dHead(jam, V(0,.4,0));
  jam.visible = false; world.add(jam); PIV.jamnail = jam;
}

/* ---------- 17 推钉组件（模块：推钉组件） ---------- */
{
  const g = group();
  box(6.6,3.6,3.2, M.plastic, g, V(FOLLOWER_FRONT0-3.3, -13, 0));     // 顶住钉头
  box(6.6,34,3.2, M.plastic, g, V(FOLLOWER_FRONT0-3.3, -31, 0));
  helixX(FOLLOWER_FRONT0-15, FOLLOWER_FRONT0-4, 4.6, .55, 7, M.steel, g).position.y = -30;
  box(12,8,10, M.plastic, g, V(FOLLOWER_FRONT0-15, -28, 0));
  box(5,5,3, M.yellow, g, V(FOLLOWER_FRONT0-20, -28, 0));
  addPart('follower', '推钉组件', g, M.plastic);
}

/* ---------- 18 钉条（模块：钉条） ---------- */
{
  const g = group(); const nailMeshes = [];
  for (let k=0;k<NAILS;k++){
    const n = group(); n.position.x = NX - k*PITCH;
    cylY(.6, 36, M.nail, n, V(0, -30.6, 0), 8);
    cylY(.5, 1.5, M.nail, n, V(0, -49.3, 0), 8);
    dHead(n, V(0, -11.7, 0));
    g.add(n); nailMeshes.push(n);
  }
  g.userData.nailMeshes = nailMeshes;
  box((NAILS-1)*PITCH+2, .5, 1.2, M.glue, g, V(NX-(NAILS-1)*PITCH/2, -12.3, 0));
  box((NAILS-1)*PITCH+2, .5, 1.2, M.glue, g, V(NX-(NAILS-1)*PITCH/2, -40, 0));
  addPart('nails', '钉条', g, M.nail);
}

/* ---------- 机构状态与位姿 ---------- */
const MECH = {
  air:false, pressure:0,
  trip:0, trigger:0, valve:0,
  plunger:0, piston:0,
  fired:0, nails:NAILS,
  jam:false, latch:0,
  depth:0, deflect:0,
  cycle:false, cycleT:0, lockout:false, pending:false, puffT:1,
  speed:60, now:0, pressT:null,
};
const CYCLE = { stem:.08, lift:.18, fire:.42, bottom:.55, seat:.62, back:.86, done:1 };
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t*t*(3-2*t); };
const seg = (t,a,b) => smooth((t-a)/(b-a));

/* ---------- 钉进木板的钉子（由 state.fired 派生） ---------- */
const drivenGroup = group(); world.add(drivenGroup);
function addDrivenNail(proud){
  const g = group();
  cylY(.6, Math.max(.5, proud+1.2), M.nail, g, V(NX, BOARD_TOP-(proud+1.2)/2, 0), 8);
  dHead(g, V(NX, BOARD_TOP-proud+.4, 0));
  drivenGroup.add(g);
}
let drivenCount = 0;
function syncDrivenNails(fired, depth){
  const want = Math.min(Math.max(0, fired|0), 24);
  while (drivenCount < want){ addDrivenNail(depth===1 ? 1.2 : depth===0 ? 2.7 : 4.2); drivenCount++; }
  while (drivenCount > want){ drivenGroup.remove(drivenGroup.children[drivenGroup.children.length-1]); drivenCount--; }
}

/* ---------- 气流（教学线索） ---------- */
const flows = [];
function addFlow(pts, active, r=1.4){
  const curve = new THREE.CatmullRomCurve3(pts.map(p=>V(...p)));
  const o = mesh(new THREE.SphereGeometry(r,12,10), M.air, world);
  o.renderOrder = 10;
  flows.push({ curve, active, o, tmp:new THREE.Vector3() });
}
addFlow([[ -2,-214],[0,-180],[4,-120],[8,-60],[10,-24]], m => m.air, 1.7);                       // 气源 → 触发阀
addFlow([[14,-8,10],[28,4,18],[70,26,22],[120,44,22],[160,54,14],[174,58,4]], m => m.air && m.valve < .4, 1.5); // 触发阀 → 头阀上腔
addFlow([[NX,76,0],[NX,62,0],[NX,52,0]], m => m.cycleT > .12 && m.cycleT < .40, 1.7);           // 气室 → 打开的头阀
addFlow([[NX,46,0],[NX,30,0],[NX,10,0],[NX,-12,0]], m => m.cycleT > .28 && m.cycleT < .58, 1.8); // 活塞上腔
addFlow([[NX,-18,0],[NX-20,-12,0],[NX-20,14,0],[NX,34,0]], m => m.cycleT > .58 && m.cycleT < .90, 1.5); // 回程腔
addFlow([[NX+12,74,0],[NX+26,78,0],[NX+36,80,0]], m => m.cycleT > .60 && m.cycleT < .95, 1.7);  // 排气
const puff = mesh(new THREE.ConeGeometry(5,15,12,1,true), M.puff, world, V(NX+34,78,0));
puff.rotation.z = -Math.PI/2; puff.renderOrder = 9;

function poseParts(m = MECH){
  const kb = k => byKey.get(k);
  if (kb('plunger')) kb('plunger').anim.y = 5*m.plunger;
  if (kb('piston'))  kb('piston').anim.y = -STROKE*m.piston;
  if (kb('trip'))    kb('trip').anim.y = 4*m.trip;
  if (kb('tvalve'))  kb('tvalve').anim.y = 2.5*m.valve;
  if (PIV.trig)      PIV.trig.rotation.z = .16*m.trigger;
  if (PIV.pawl)      PIV.pawl.rotation.z = -.55*m.trip;
  if (PIV.dwheel)    PIV.dwheel.rotation.z = 1.6*m.depth;
  if (PIV.latch)     PIV.latch.rotation.y = 1.15*m.latch;
  if (PIV.defl)      PIV.defl.rotation.y = m.deflect;
  if (PIV.tstem)     PIV.tstem.position.y = 2.5*m.valve;
  if (kb('nails')){
    kb('nails').anim.x = PITCH*m.fired;
    kb('nails').g.visible = m.nails > 0;
    const arr = kb('nails').obj.userData.nailMeshes || [];
    for (let k=0;k<arr.length;k++) arr[k].visible = k >= m.fired;
  }
  if (kb('follower')) kb('follower').anim.x = PITCH*m.fired;
  if (PIV.jamnail) PIV.jamnail.visible = !!m.jam;
  for (const f of flows){
    f.o.visible = !!f.active(m);
    if (f.o.visible){ f.curve.getPoint(((m.now||0)*.0011)%1, f.tmp); f.o.position.copy(f.tmp); }
  }
  const puffOn = (m.cycleT>.55 && m.cycleT<.92) || m.puffT < 1;
  puff.visible = puffOn && m.pressure > .05;
  if (m.puffT < 1){ puff.scale.setScalar(.5+.9*Math.sin(m.puffT*Math.PI)); puff.material.opacity = .5*(1-m.puffT); m.puffT = Math.min(1, m.puffT+.02); }
  else if (puffOn){ const q = seg(m.cycleT,.55,.92); puff.scale.setScalar(.4+q*1.7); puff.material.opacity = .5*(1-q); }
}

/* 击发循环：阀杆抬起 → 头阀上移 → 气室进活塞上腔 → 活塞下行 → 阀塞复位 → 回程 → 排气 */
function runCycle(m = MECH){
  const t = m.cycleT, c = CYCLE;
  m.valve = t < c.seat ? seg(t,0,c.stem) : 1-seg(t,c.seat,c.back);
  m.plunger = t < c.seat ? seg(t,c.stem*.7,c.lift) : 1-seg(t,c.seat,c.seat+.08);
  let drive = Math.pow(seg(t,c.lift*.9,c.fire), 1.7), maxDrive = 1;
  if (m.lockout) maxDrive = .005;
  else if (m.jam) maxDrive = .12;
  m.piston = Math.min(drive, maxDrive);
  if (t >= c.seat) m.piston = Math.min(m.piston, 1-seg(t,c.seat+.04,c.back));
  m.piston = Math.max(0, Math.min(1, m.piston));
  if (m.cycleT >= c.done){ m.cycle = false; m.cycleT = 0; m.lockout = false; }
}

/* ---------- 测试台：细支架 + 木板 ---------- */
{
  const stand = group();
  box(14, 250, 60, M.clamp, stand, V(-62, -84, 0));      // 立柱
  box(40, 10, 46, M.clamp, stand, V(-54, 30, 0));        // 上夹臂
  box(16, 30, 46, M.clamp, stand, V(-42, 10, 0));        // 夹块
  box(44, 136, 110, M.clamp, stand, V(318, -142, -30));  // 木板台
  box(470, 8, 270, new THREE.MeshStandardMaterial({color:0xd7d2c8, roughness:.95}), stand, V(120, -214, 0));  // 地面
  world.add(stand); PIV.stand = stand;
}
{
  const board = group();
  box(230, 20, 160, M.wood, board, V(215, -64, 0));
  box(230, .8, 160, new THREE.MeshStandardMaterial({ color:0xb58e58, roughness:.9 }), board, V(215, -54.4, 0));
  world.add(board); PIV.board = board;
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

/* ---------- 运动：状态只来自 logic 的 state，几何在这里落位 ---------- */
function applyMotion(view, state) {
  MECH.air = !!state.air;
  MECH.trip = state.trip || 0;
  MECH.trigger = state.trigger || 0;
  MECH.depth = state.depth || 0;
  MECH.jam = !!state.jam;
  MECH.latch = state.latch || 0;
  MECH.fired = Math.max(0, (state.fired || 0) - (MECH.pending ? 1 : 0));
  MECH.nails = state.nails == null ? NAILS : state.nails;
  syncDrivenNails(state.fired || 0, state.depth || 0);
  drivenGroup.visible = (state.placed || []).includes('nails');
  PIV.board.visible = PIV.stand.visible = true;
  for (const p of parts) p.anim.set(0, 0, 0);
  poseParts(MECH);
  const nailsPart = byKey.get('nails');
  if (nailsPart && !(state.placed || []).includes('nails')) nailsPart.g.visible = false;
  for (const p of parts) p.g.position.add(p.anim);
}
const MODEL = { world, byKey, PARTS: parts, moduleBounds, applyMotion, runCycle, mech: MECH, NAILS };

/* ==== nail-gun-lab/manifest.mjs ==== */
/* 气钉枪 · 插槽填充（纯数据 + 少量回调）
 * 外形依据 DeWalt DWFP12233 18Ga 直钉枪公开规格（长≈287 / 高≈241 / 宽≈81 mm，
 * 70–120 psi，1/4" NPT，100 支弹匣，F15–F50 直钉）；内部气路与阀件为教学估算。
 */
const MANIFEST = {
  slug: 'nail-gun-lab',
  brand: {
    title: '气钉枪装配实验室',
    subtitle: '把气压变成一颗钉子 · 13 模块 · 3 关',
    mark: { a: '#c2452d', b: '#e9b53a' },
  },

  chapters: [
    {
      title: '让活塞自己回来', subtitle: '缸下腔的空气就是一根气弹簧：压下去、弹回来。', badge: '气垫观察员',
      exp: '手压活塞',
      expText: '点「手压活塞」：活塞下行，把缸下腔的空气经缸壁两圈小孔挤进机体的回程环腔；松手后这团被压缩的空气把活塞顶回去。看「回程」读数先升后降。',
      q: '松手之后，是什么把活塞推回顶部？',
      options: ['缸下腔与回程环腔里被压缩的空气', '击针自己的弹性', '头阀里的阀弹簧'],
      a: 0,
      why: '活塞下行时缸下腔容积变小，空气只能经缸壁两圈回程孔挤进回程环腔；松手后它膨胀，把活塞推回。击针是钢的，不储能；阀弹簧只作用于头阀塞，碰不到活塞。',
    },
    {
      title: '先压鼻端，再扣扳机', subtitle: '触发阀是气路的开关，保险挂块是扳机的锁。', badge: '两段保险',
      exp: '三步各试一次',
      expText: '①只接气：气停在触发阀，头阀塞上腔有气压顶着；②再压鼻端：扳机解锁，但触发阀还没动；③只扣扳机（不压鼻端）：保险挂块挡住扳机，触发阀不动。两道输入同时成立，气才会被放掉。',
      q: '只扣扳机时，气钉枪为什么不击发？',
      options: ['气压还不够高', '保险挂块挡住扳机，触发阀不动作，头阀塞被上腔气压顶住', '头阀里的弹簧太硬'],
      a: 1,
      why: '头阀塞平时被上腔气压压在下位，把气室封住。触发阀不放气，上腔压力就不降，气室的高压气进不了活塞上腔。顺序击发让工具跌落时最多只满足一道输入，所以不会走火。',
    },
    {
      title: '一次击发的六个动作', subtitle: '从扳机到钉子，按顺序看完这六步。', badge: '击发工程师',
      exp: '完整击发',
      expText: '接气 → 压鼻端 → 扣扳机 → 击发。默认慢放 ×60，盯住「阶段」读数：阀杆抬起 → 头阀打开 → 气室进活塞上腔 → 活塞下行击钉 → 阀塞复位 → 回程腔推回 → 排气、钉条前进一格。',
      q: '推动活塞下行的高压气，是从哪里来的？',
      options: ['回程环腔', '一直存在气室里、经打开的头阀放进活塞上腔的那团气', '排气口吸进来的空气'],
      a: 1,
      why: '气室一直充满高压气，只是被头阀塞封住。扳机放掉阀塞上腔的气压后，气室的气把阀塞顶起，气室与活塞上腔接通，同一团高压气随即压下活塞。回程腔的气只在活塞回程时使用，排气口只出气。',
    },
  ],

  stage: {
    title: '拼一把会打钉的气钉枪',
    hint: '选一块模块，把它放到蓝色轮廓里。',
  },

  readout: [
    { key: 'supply', label: '气源' },
    { key: 'ret', label: '回程腔' },
    { key: 'phase', label: '阶段', big: true },
    { key: 'piston', label: '活塞行程' },
    { key: 'nails', label: '余钉' },
  ],

  tray: { title: '第一盒 · 动力核心', hint: '点选模块，再拖到蓝色位置' },

  modules: [
    { id: 'body', chapter: 0, name: '主机体', parts: ['body'], color: '#7b8694', icon: 'housing',
      tip: '把主机体放上测试台。缸孔、钉道、回程环腔和鼻框都在这一件上。',
      learn: '主机体是基准件：气缸压进前部的缸孔，头盖拧在顶法兰上，弹匣梁和鼻框都由它定位。回程环腔也铸在机体里，是活塞回程的气源。' },
    { id: 'core', chapter: 0, name: '动力缸芯', parts: ['cylinder', 'bumper'], color: '#c2734a', icon: 'disc',
      tip: '把预装了缓冲垫的气缸压进机体缸孔。',
      learn: '缓冲垫在缸底，空击时接住活塞。缸壁有两圈各 4 个回程孔，把缸下腔和机体的回程环腔连通——这就是回程气弹簧的通道。压装工序以吸附归位示意。' },
    { id: 'piston', chapter: 0, name: '活塞击针', parts: ['piston'], color: '#5e7ea6', icon: 'piston',
      tip: '把活塞和击针从缸孔上方装入气缸。',
      learn: '活塞带一道 O 形圈，把气缸分成上腔和下腔。击针从活塞底面伸出，穿过缓冲垫中孔直达钉头。它没有回程弹簧——回程靠气。' },
    { id: 'headvalve', chapter: 0, name: '头盖阀总成', parts: ['headcap', 'plunger', 'vspring', 'deflector'], color: '#8a6bb8', icon: 'valve',
      tip: '把带阀塞和弹簧的头盖总成装到机体顶法兰上。',
      learn: '头阀塞被弹簧和上腔气压压在下位，封住气室；气室在头盖顶部，一直充满高压气。阀塞一抬起，气室就与活塞上腔接通。排气导板把回程时的排气引向侧面。' },
    { id: 'airkit', chapter: 1, name: '触发阀与接头', parts: ['tvalve', 'inlet'], color: '#b8934a', icon: 'coil',
      tip: '把触发阀组件放进握把腔，气源接头已预装在阀体下方。',
      learn: '1/4 英寸 NPT 快插接头把压缩空气送进触发阀。阀是三通：平时把气送去头阀塞上腔，扣扳机时改把上腔放空。没有电，全靠气压切换。' },
    { id: 'trip', chapter: 1, name: '保险触压板', parts: ['trip'], color: '#4a9a8c', icon: 'plate',
      tip: '把 U 形触压板滑进鼻端滑槽，出钉孔对正出口。',
      learn: '触压板底部有防滑垫，中间是出钉孔；只有它压住工件上缩 4 mm，扳机的保险挂块才让路。这是第一道输入，也是深度的基准。' },
    { id: 'trig', chapter: 1, name: '扳机联动', parts: ['trig'], color: '#c25a5a', icon: 'lever',
      tip: '把扳机杆装进握把销孔，保险挂块朝上。',
      learn: '触压板没压下时，保险挂块挡住扳机行程；压下后扳机才能推动触发阀的阀杆。两道输入都给到，触发阀才会放掉头阀塞上腔的气。' },
    { id: 'tube', chapter: 1, name: '控制气管', parts: ['tube'], color: '#6a86b8', icon: 'shaft',
      tip: '把控制气管一头插进触发阀，一头插到头盖后部，卡进机体线槽。',
      learn: '这根细管就是头阀塞上腔的控制线：触发阀供气时，上腔压力把阀塞压住；触发阀放气时，上腔压力下降，阀塞才被气室顶起。' },
    { id: 'grip', chapter: 1, name: '握把壳', parts: ['grip'], color: '#5a6272', icon: 'housing',
      tip: '合上左右握把壳，罩住触发阀和扳机。',
      learn: '握把固定触发阀与扳机，底部拧入气源接头。合壳后气路完整，可以接气做两段保险实验。' },
    { id: 'follower', chapter: 2, name: '推钉组件', parts: ['follower'], color: '#9a6a4a', icon: 'spring',
      tip: '把推钉板和压簧从弹匣梁尾部推进轨道。',
      learn: '压簧一端顶弹匣尾端、一端顶推钉板，始终把钉条往前送。弹匣打空时，推钉板前沿进入击发窗挡住刀口——空击锁定。' },
    { id: 'nails', chapter: 2, name: '钉条', parts: ['nails'], color: '#4a7ab8', icon: 'pin',
      tip: '把 F38 直钉条钉尖朝下放入钉道，顶住击针刀口。',
      learn: '18Ga 直钉 Ø1.2×38 mm，胶排成条，钉头挂在头钉道里，由刀口从上向下逐支击出。真机 100 支/条；模型 80 支、钉距 1.5（放大保证刀口与邻钉头有间隙）。' },
    { id: 'depth', chapter: 2, name: '深度调节轮', parts: ['dwheel'], color: '#b8a24a', icon: 'gear',
      tip: '把滚花深度调节轮装到鼻端侧面轴销上。',
      learn: '轮子改变触压板的基准位：基准越低，枪身离木板越远，钉帽露出越多。真机靠触压板行程/泄气微调，模型用三档示意。' },
    { id: 'latch', chapter: 2, name: '卡扣门', parts: ['latch'], color: '#8c8c94', icon: 'bolt',
      tip: '把卡扣门装到鼻端侧面销轴上，清障用。',
      learn: '卡钉时打开侧门就能夹出弯钉。卡扣门也是检查刀槽和出钉口的窗口。' },
  ],

  notes: [
    '<b>一次击发，六个动作：</b>①扣扳机，扳机推动触发阀阀杆；②触发阀把控制气管和头阀塞上腔放空；③上腔压力一降，气室里那团高压气把阀塞顶起；④气室与活塞上腔接通，高压气压下活塞、击针打钉；⑤活塞到底后阀塞复位，气室重新封闭；⑥缸下腔的空气经回程孔把活塞推回，排气导板放掉余气，钉条前进一格。',
    '<b>为什么没有回程弹簧：</b>缸壁下段有两圈各 4 个回程孔，活塞下行时把缸下腔的空气挤进机体里的回程环腔；活塞到底后，这团压缩空气膨胀，把活塞推回。气压既是动力也是回程，结构比弹簧更耐高频。',
    '<b>两段保险为什么防跌落：</b>触发阀只在「鼻端压住工件」且「扳机被扣下」时动作。工具掉落时通常只碰到其中一个，头阀塞上腔的气压不会被放掉，气室始终封着，所以不会击发。',
    '<b>空击锁定：</b>弹匣打空后，推钉板前沿正好进入击发窗挡住刀口，活塞只走一小段就停住，避免刀口硬撞机体。',
    '外形按 DeWalt DWFP12233 18Ga 直钉枪包络（长约 287 mm、70–120 psi、1/4 英寸 NPT、100 支直钉弹匣）。内部气路与阀件为教学估算，<b>不对应某一品牌剖面</b>。击发原理参考 HowStuffWorks《How Nail Guns Work》与 Everwin 阀序说明；直排式「钉条竖挂、刀口下行」参考专利 EP1874505B1。',
    '默认动画慢放约 60 倍；观察速度只影响播放，不改变真实时序（实际击发行程约 10 ms 量级）。',
  ],

  scene: {
    bench: false,  // 场景自带地面与木板台，避免和 kit 的大平面重叠
    spawnFor: (id, info) => [20 - info.center.x, 120 - info.center.y, 90 - info.center.z],
    camera: { fov: 34, near: 1, far: 3000, defaultFocus: 'all' },
    orbit: { minDistance: 80, maxDistance: 2600, minPolar: 0.04, maxPolar: 0.57 },
    renderer: { exposure: 1.02, pixelRatio: 1.5 },
    env: 0.6,
    lights: {
      hemi: [0xffffff, 0xcfc4ac, 1.5],
      key: { color: 0xfff6ec, intensity: 2.2, pos: [-220, 320, 280] },
      fill: { color: 0xdfe9ff, intensity: 0.6, pos: [260, 120, -260] },
      rim: { color: 0xe8eeff, intensity: 1.1, pos: [220, 140, -240] },
    },
    cut: { normal: [0, 0, -1], constant: 0 },
    focus: {
      all: { dir: [27, 16], fit: 0.94, box: () => [[110, -70, 0], [430, 330, 240]] },
      valve: { dir: [27, 16], fit: 1.1, box: () => [[190, 52, 0], [90, 90, 60]] },
      nose: { dir: [27, 16], fit: 1.1, box: () => [[194, -36, 0], [120, 110, 60]] },
    },
    inset: {
      fov: 36,
      visible: (s, v) => v.cut && s.placed.includes('headvalve'),
      target: () => ({
        part: 'headcap',
        local: [190, 62, 0],
        offset: [-34, 22, 76],
        title: MODEL.mech.cycle ? '击发中 · 阀塞上移，气室接通活塞上腔' : '头阀特写 · 阀塞压在下位，气室封闭',
      }),
    },
  },
};

/* ==== nail-gun-lab/logic.mjs ==== */
/* 气钉枪 · 装配与实验逻辑（纯逻辑，无 DOM、无三维）
 * 每个动作先校验前置条件；失败不动业务状态。模块与关卡文案的唯一来源是 manifest.mjs。
 */
const MODULES = MANIFEST.modules;
const CHAPTERS = MANIFEST.chapters;
function createGame(){
  const NAILS = 80;
  const initial = () => ({ chapter:0, phase:'build', placed:[], selected:null,
    completed:[false,false,false], air:false, trip:0, trigger:0, fired:0, nails:NAILS,
    depth:0, jam:false, latch:0, expStep:0 });
  const state = initial();
  const fail = message => ({ ok:false, message });
  const mod = id => MODULES.find(m => m.id === id);
  function current(){
    if (state.phase !== 'build') return null;
    return MODULES.find(m => m.chapter === state.chapter && !state.placed.includes(m.id)) || null;
  }
  function select(id){
    if (state.phase !== 'build') return fail(state.phase==='lab' ? '自由实验室里不搞装配,想重拼请点重新开始。' : '先完成本章实验与挑战,再继续装配。');
    const m = mod(id);
    if (!m) return fail('没有这块模块,请从零件盒选择。');
    if (state.placed.includes(id)) return fail(m.name + '已经装好了。');
    if (m.chapter !== state.chapter) return fail('这一步还轮不到' + m.name + '——先完成当前模块。');
    state.selected = id;
    return { ok:true, message:m.tip };
  }
  function place(onTarget=true){
    if (state.phase !== 'build') return fail('本章装配已完成,请进行实验与挑战。');
    if (!state.selected) return fail('先从零件盒选一块模块。');
    if (onTarget !== true) return fail('还没对准装配位置——拖到蓝色轮廓里再松手,或按「装到这里」。');
    const m = current();
    if (!m) return fail('本章已经装完了。');
    if (state.selected !== m.id) return fail('这一步需要「' + (m ? m.name : '当前模块') + '」,顺序不能乱。');
    state.placed.push(m.id); state.selected = null;
    if (!MODULES.some(x => x.chapter === state.chapter && !state.placed.includes(x.id))) state.phase = 'experiment';
    return { ok:true, message:m.name + '已归位。', learn:m.learn, kind:'placed' };
  }
  function undo(){
    if (state.phase === 'lab') return fail('自由实验室不撤回;想重拼请点重新开始。');
    const last = state.placed.at(-1), m = mod(last);
    if (!m || m.chapter !== state.chapter) return fail('本章还没有可撤回的模块。');
    state.placed.pop(); state.phase = 'build'; state.selected = null;
    state.air = false; state.trip = 0; state.trigger = 0; state.expStep = 0;
    if (m.id === 'nails'){ state.nails = NAILS; }
    if (m.id === 'follower' && state.placed.includes('nails')){ state.nails = NAILS; }
    state.completed[state.chapter] = false;
    return { ok:true, message:'已撤回' + m.name + ',可以重新装配。', kind:'undo' };
  }
  function experiment(){
    if (state.phase !== 'experiment') return fail('先把本章模块全部装好,再进行实验。');
    state.phase = 'quiz'; state.expStep = 0;
    return { ok:true, message:CHAPTERS[state.chapter].expText, kind:'experiment' };
  }
  // 实验演示动作(阶段限定)
  function demoAir(){
    if (state.phase !== 'experiment') return fail('实验动作要在实验阶段做。');
    if (state.chapter !== 1) return fail('本章不需要接气。');
    state.air = true; state.expStep = Math.max(state.expStep,1);
    return { ok:true, message:'气源接通:气室充压。活塞被缸下腔/回程腔的气压顶在上位——听,充气有一声短促的排气声。', kind:'air' };
  }
  function demoTrip(){
    if (state.phase !== 'experiment') return fail('实验动作要在实验阶段做。');
    if (state.chapter !== 1) return fail('本章不压鼻端。');
    if (!state.air) return fail('先接通气源,再压鼻端。');
    state.trip = state.trip ? 0 : 1; state.expStep = Math.max(state.expStep,2);
    return { ok:true, message:state.trip ? '触压板压紧工件(缩回 4 mm),扳机联动解锁——但还没扣扳机,不击发。' : '触压板回位,扳机重新锁住。', kind:'trip' };
  }
  function demoTrigger(){
    if (state.phase !== 'experiment') return fail('实验动作要在实验阶段做。');
    if (state.chapter !== 1) return fail('本章不空扣扳机。');
    if (!state.trip) return { ok:false, kind:'blocked', message:'扣不动:鼻端触压板没有压住工件,顺序击发联动锁住了扳机。这正是两段保险——先压鼻端,再扣扳机。' };
    if (!state.air) return { ok:false, kind:'blocked', message:'扳机能扣动,但没接气,阀后无气,头阀塞上腔不放气,照样不击发。先接气。' };
    return { ok:false, kind:'blocked', message:'气已接、鼻端已压、扳机已扣——这下会真的击发!但弹匣里还没装钉条,去第三章装上钉条再打。' };
  }
  function answer(i){
    if (state.phase !== 'quiz') return fail('先亲手完成本章实验,再回答问题。');
    const c = CHAPTERS[state.chapter];
    if (!Number.isInteger(i) || i<0 || i>=c.options.length) return fail('请选择一个有效答案。');
    if (i !== c.a) return { ok:false, message:'再观察一下。' + c.why, kind:'wrong' };
    state.completed[state.chapter] = true; state.phase = 'checkpoint';
    return { ok:true, message:'答对了!获得「' + c.badge + '」。', kind:'correct' };
  }
  function next(){
    if (state.phase !== 'checkpoint' || !state.completed[state.chapter]) return fail('先完成本章实验与挑战。');
    if (state.chapter < CHAPTERS.length-1){ state.chapter++; state.phase='build'; state.expStep=0; state.air=false; state.trip=0; state.trigger=0;
      return { ok:true, message:CHAPTERS[state.chapter].subtitle, kind:'chapter' }; }
    state.phase = 'lab';
    return { ok:true, message:'装配完成!进入自由实验室:击发、调深浅、制造卡钉再清障。', kind:'complete' };
  }
  // 自由实验动作
  function fire(){
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2)) return fail('完成装配与实验后才可击发。');
    if (!state.air) return fail('未接通气源——先接气再击发。');
    if (!state.trip) return fail('鼻端触压板未压下——两段式顺序击发要求先压鼻端。');
    if (!state.trigger) return fail('先扣住扳机,再保持压紧鼻端。');
    if (state.jam) return { ok:true, kind:'jamstop', message:'刀口下行顶住弯钉,击发中止——打开卡扣门清障。' };
    if (state.nails <= 0){ return { ok:true, kind:'lockout', message:'弹匣已空:推钉板前沿进入击发窗,锁定空击——装入钉条再打。' }; }
    state.fired++; state.nails--;
    return { ok:true, kind:'fired', message:'击发!高压气经头阀压下活塞,击针把钉打进木板;回程腔随即把活塞顶回,钉条前进一格。' };
  }
  function setAir(){
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2)) return fail('完成装配后才可操作气源。');
    state.air = !state.air; state.expStep = Math.max(state.expStep, state.air?1:0);
    if (!state.air){ state.trigger = 0; }
    return { ok:true, message:state.air ? '气源接通,气室充压(表压 0.6 MPa)。' : '气源已断开,气压归零。', kind:'air' };
  }
  function setTrip(){
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2)) return fail('完成装配后才可压鼻端。');
    state.trip = state.trip ? 0 : 1;
    if (!state.trip) state.trigger = 0;
    return { ok:true, message:state.trip ? '触压板压紧工件,扳机联动解锁。' : '触压板回位,扳机重新锁住。', kind:'trip' };
  }
  function setTrigger(){
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2)) return fail('完成装配后才可扣扳机。');
    if (!state.trip) return { ok:false, kind:'blocked', message:'扣不动:触压板未压下,顺序击发联动锁住扳机——先压鼻端。' };
    state.trigger = state.trigger ? 0 : 1;
    return { ok:true, message:state.trigger ? '扳机已扣住:触发阀放气,只待击发。' : '扳机已松开。', kind:'trigger' };
  }
  function cycleDepth(){
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2)) return fail('先完成三章挑战,再进实验室调深浅。');
    state.depth = ((state.depth + 2) % 3) - 1;   // -1 浅 · 0 中 · 1 深
    const name = state.depth === 1 ? '深(钉帽近齐平)' : state.depth === 0 ? '中' : '浅(钉帽露出更多)';
    return { ok:true, message:'深度调节:转为' + name + '。再击发一钉对比钉帽高度。', kind:'depth' };
  }
  function setLatch(){
    if (state.phase !== 'lab') return fail('先完成三章挑战,再进实验室。');
    if (!state.jam && !state.latch){ state.latch = 1; return { ok:true, kind:'latch', message:'卡扣门已打开:能看到刀槽与出口。', latch:1 }; }
    if (state.jam && state.latch){ state.jam = false; state.latch = 0; return { ok:true, kind:'clearjam', message:'弯钉已取出,合上卡扣门,可以继续击发。', latch:0 }; }
    state.latch = state.latch ? 0 : 1;
    return { ok:true, kind:'latch', message:state.latch ? '卡扣门已打开。' : '卡扣门已合上。', latch:state.latch };
  }
  function injectJam(){
    if (state.phase !== 'lab') return fail('先完成三章挑战,再进实验室。');
    if (state.jam) return fail('已经有一根弯钉卡住了。');
    if (state.nails <= 0) return fail('弹匣是空的,先装入钉条。');
    state.jam = true;
    return { ok:true, kind:'jam', message:'下一根钉打偏弯住——再击发就会顶在弯钉上。打开卡扣门把它取出来。' };
  }
  function reload(){
    if (state.phase !== 'lab') return fail('先完成三章挑战,再进实验室。');
    state.nails = NAILS; state.fired = 0; state.jam = false; state.latch = 0;
    return { ok:true, kind:'reload', message:'已装入整条 F38 直钉(80 支展示),清空击发记录与卡钉。' };
  }
  function pressPiston(){
    if (state.phase === 'experiment' && state.chapter === 0) return { ok:true, kind:'press', message:'活塞被压下 21 mm,缸下腔的空气被压进回程环腔;松手后被这团气顶回,晃两下停住。' };
    if (state.phase === 'lab') return { ok:true, kind:'press', message:'手动下压活塞:缸下腔空气经回程孔压进环腔,松手回弹——这就是回程的气垫。' };
    return fail('这个动作在第一章实验或实验室里才有意义。');
  }
  function freeview(){
    Object.assign(state, initial());
    state.placed = MODULES.map(m => m.id);
    state.completed = [true, true, true];
    state.chapter = CHAPTERS.length - 1;
    state.phase = 'lab';
    return { ok:true, kind:'freeview', message:'已装配完整机,进入自由实验。' };
  }
  function restart(){ Object.assign(state, initial()); return { ok:true, kind:'restart', message:'新的装配开始了——把主机体放上装配台。' }; }
  return { state, current, select, place, undo, experiment, demoAir, demoTrip, demoTrigger,
           answer, next, fire, setAir, setTrip, setTrigger, cycleDepth, setLatch, injectJam,
           reload, pressPiston, freeview, restart, NAILS };
}

export { MODEL, MANIFEST, createGame, THREE };
