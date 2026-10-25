import * as THREE from 'three';

/* 手摇发电手电筒 · 几何与运动（几何段从旧项目 game-shell.html 原样迁移，未改尺寸）
 * 基准：1 unit = 1 mm；整机约 146 × 58 × 42 mm（不含灯头与摇柄）。12 模块 / 18 件零件。
 * 两级增速 (40T→10T)×(40T→10T)=16:1；模块 0.5 mm，中心距 12.5 mm。
 */
const world = new THREE.Group();

/* ============================ 材质 ============================ */
const M={
 shell:new THREE.MeshPhysicalMaterial({color:0xccd4dc,roughness:.42,clearcoat:.5,clearcoatRoughness:.45}),
 shell2:new THREE.MeshPhysicalMaterial({color:0xb4bfca,roughness:.5,clearcoat:.35}),
 accent:new THREE.MeshStandardMaterial({color:0xf2a13b,roughness:.45,metalness:.15}),
 metal:new THREE.MeshStandardMaterial({color:0xd6dce3,metalness:1,roughness:.28}),
 steel:new THREE.MeshStandardMaterial({color:0xa9b2bc,metalness:1,roughness:.35}),
 brass:new THREE.MeshStandardMaterial({color:0xcf9c42,metalness:.85,roughness:.34}),
 dark:new THREE.MeshStandardMaterial({color:0x39424c,roughness:.6}),
 rubber:new THREE.MeshStandardMaterial({color:0x454b52,roughness:.9}),
 pcb:new THREE.MeshStandardMaterial({color:0x2f8a70,roughness:.6}),
 copper:new THREE.MeshStandardMaterial({color:0xbf6a3d,metalness:.8,roughness:.4}),
 glass:new THREE.MeshPhysicalMaterial({color:0xeaf4ff,roughness:.05,metalness:0,transparent:true,opacity:.28,clearcoat:1,depthWrite:false,side:THREE.DoubleSide}),
 reflector:new THREE.MeshStandardMaterial({color:0xe8eef5,metalness:1,roughness:.12,side:THREE.DoubleSide}),
 led:new THREE.MeshStandardMaterial({color:0xfff6e2,emissive:0xffdca0,emissiveIntensity:.25,roughness:.3}),
 ceramic:new THREE.MeshStandardMaterial({color:0xe6dcc8,roughness:.7}),
};

/* ============================ 几何助手 ============================ */
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const TAU=Math.PI*2;
function box(w,h,d,mat,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return m;}
function cylZ(r,h,mat,x,y,z,seg=32){const g=new THREE.CylinderGeometry(r,r,h,seg);g.rotateX(Math.PI/2);const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);return m;}
function cylX(r,h,mat,x,y,z,seg=32){const g=new THREE.CylinderGeometry(r,r,h,seg);g.rotateZ(-Math.PI/2);const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);return m;}
function lathe(profile,seg=64){const pts=profile.map(([x,r])=>new THREE.Vector2(Math.max(r,1e-3),x));const g=new THREE.LatheGeometry(pts,seg);g.rotateZ(-Math.PI/2);g.computeVertexNormals();return g;}
function roundedRect(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
 s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
 s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function toothedRing(x0,x1,rTip,rRoot,n,rIn=0){
 // 齿对称于 a：齿心在 a，槽心在 a+step/2。相位因此可以按半齿距直接对齐。
 const step=TAU/n,pts=[];
 for(let i=0;i<n;i++){const a=i*step;pts.push([rRoot,a-step*.32],[rTip,a-step*.18],[rTip,a+step*.18],[rRoot,a+step*.32],[rRoot,a+step*.5]);}
 const sh=new THREE.Shape(pts.map(([r,a])=>new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r)));
 if(rIn>0){const hole=new THREE.Path();hole.absarc(0,0,rIn,0,TAU,true);sh.holes.push(hole);}
 const g=new THREE.ExtrudeGeometry(sh,{depth:x1-x0,bevelEnabled:false,curveSegments:12});
 g.rotateY(Math.PI/2);g.translate(x0,0,0);return g;}
// 齿轮：轴线沿 z，几何中心在原点
function gearGeo(n,mod,thick,bore){
 const rp=mod*n/2,rt=rp+mod,rr=rp-1.25*mod;
 const g=toothedRing(0,thick,rt,rr,n,bore);
 g.rotateY(Math.PI/2);g.translate(0,0,thick/2);return g;   // 旋两次后挤出方向为 −z，平移 +thick/2 才居中
}
function tube(points,r,mat,seg=32){const c=new THREE.CatmullRomCurve3(points.map(p=>V(...p)));return new THREE.Mesh(new THREE.TubeGeometry(c,seg,r,8,false),mat);}

/* ============================ 零件注册 ============================
 * 零件清单（真机尺寸 / 建模尺寸 / 结论）见 README.md「零件表」。
 * 每个零件都由谁固定，都在 README 里逐条写明；没有悬浮件。
 * ================================================================ */
const parts=[],byKey=new Map();
function addPart(key,name,obj,mat,opt={}){
 obj.traverse(o=>{if(!o.isMesh)return;
  if(o.userData.keepMat){o.userData.omat=o.material;}
  else{o.material=mat.clone();o.userData.omat=o.material;}
  o.userData.key=key;});
 const g=new THREE.Group();g.add(obj);g.userData.key=key;world.add(g);
 const p={key,name,g,obj,shell:!!opt.shell};
 parts.push(p);byKey.set(key,p);return p;
}

/* ---------- 机壳：前后半壳 + 端盖 ---------- */
const BODY={x0:-80,x1:66,cx:-7,h:58,z:21,r:8};
function halfShell(faceZ,wallFrom,wallTo,withScrewHoles){
 const grp=new THREE.Group();
 const plate=roundedRect(146,58,8);
 if(withScrewHoles)for(const[x,y]of SCREWS){const h=new THREE.Path();h.absarc(x-BODY.cx,y,1.25,0,TAU,true);plate.holes.push(h);}
 const pg=new THREE.ExtrudeGeometry(plate,{depth:2,bevelEnabled:false,curveSegments:48});
 pg.translate(BODY.cx,0,faceZ);grp.add(new THREE.Mesh(pg,M.shell));
 const outer=roundedRect(146,58,8);
 const innerShape=roundedRect(140,52,5);
 const hole=new THREE.Path().setFromPoints(innerShape.getPoints(64));outer.holes.push(hole);
 const pad=faceZ<0?-.2:.2;   // 侧壁朝端板多伸 0.2 mm：端面与端板内表面同面会 z-fighting
 const wg=new THREE.ExtrudeGeometry(outer,{depth:wallTo-wallFrom+Math.abs(pad),bevelEnabled:false,curveSegments:48});
 wg.translate(BODY.cx,0,wallFrom+(pad<0?pad:0));grp.add(new THREE.Mesh(wg,M.shell));
 return grp;
}
const SCREWS=[[-72,-23],[50,-23],[-72,23],[50,23]];
let genCan=null,genRotor=null;
addPart('frontShell','前壳（含灯头端壁）',halfShell(-21,-19,0,true),M.shell,{shell:true});
{
 const grp=halfShell(19,0,19,false);
 for(const[x,y]of SCREWS)grp.add(cylZ(3,19.5,M.shell,x,y,9.75,20));   // 螺柱：端面伸进端板 0.5
 // 传动板的两根支柱（板前 z 13.5→19）
 grp.add(cylZ(3,6,M.shell,-30,22,16.5,16));
 grp.add(cylZ(3,6,M.shell,-70,22,16.5,16));
 addPart('backShell','后壳（含螺柱）',grp,M.shell2,{shell:true});
}
{ // 端盖：中央 Ø40 通灯头，下方 Ø7 长孔过开关拨杆
 // 局部 x → 世界 z，局部 y → 世界 y：宽 42 对应机身厚度，高 58 对应机身高度
 const s=roundedRect(42,58,6);
 const h1=new THREE.Path();h1.absarc(0,0,20,0,TAU,true);s.holes.push(h1);
 const h2=new THREE.Path();h2.absarc(0,-22,3.5,0,TAU,true);s.holes.push(h2);
 const g=new THREE.ExtrudeGeometry(s,{depth:2,bevelEnabled:false,curveSegments:48});
 g.rotateY(-Math.PI/2);g.translate(68,0,0);   // 局部 x 变成世界 y，局部 y 变成世界 z
 const m=new THREE.Mesh(g,M.shell2);
 addPart('endCap','灯头端盖',m,M.shell2,{shell:true});
}
/* ---------- 灯头：外壳 / 反光杯 / 镜片 / LED ---------- */
addPart('headShell','灯头外壳',new THREE.Mesh(lathe([[68,15],[68,20],[76,20],[78,17],[78,15],[68,15]],72),M.shell),M.shell,{shell:true});
addPart('reflector','反光杯',new THREE.Mesh(lathe([[58,3],[70,15.4],[70,14.6],[58,1.5],[58,3]],72),M.reflector),M.reflector);
addPart('lens','镜片',new THREE.Mesh(lathe([[74,0],[74,15],[75.2,15],[75.2,0]],72),M.glass),M.glass,{shell:true});
const ledPart=addPart('led','白光 LED',(()=>{const g=new THREE.Group();
 g.add(new THREE.Mesh(lathe([[55,0],[55,2.5],[58,2.5],[58.6,2.2],[58.8,0]],48),M.led));
 g.add(cylX(2.9,1.2,M.ceramic,55.6,0,0));return g;})(),M.led);
/* ---------- 传动板：真开三个轴承孔 ---------- */
{
 const shape=roundedRect(46,30,4);
 for(const[px,py,r]of[[14,-1,3],[1.5,-1,2.2],[-11,-1,4.2]]){
  const hole=new THREE.Path();hole.absarc(px,py,r,0,TAU,true);shape.holes.push(hole);
 }
 // 减重窗：让发电机从齿轮面也能看见（真机传动板同样开窗）
 for(const[px,py]of[[5,8],[-6,8]]){
  const hole=new THREE.Path();hole.absarc(px,py,3.6,0,TAU,true);shape.holes.push(hole);
 }
 const g=new THREE.ExtrudeGeometry(shape,{depth:2,bevelEnabled:false,curveSegments:32});
 const plate=new THREE.Mesh(g,M.steel);plate.position.set(-51,9,10.5); // 与齿轮面留 1 mm，避免同深度闪烁
 addPart('gearPlate','传动板',plate,M.steel);
}
/* ---------- 曲轴 + 摇柄 ---------- */
const crankSpin=new THREE.Group();crankSpin.position.set(-37,8,0);
{
 crankSpin.add(cylZ(2.5,15,M.metal,0,0,15.5,24));          // 曲轴
 crankSpin.add(cylZ(6,2.4,M.accent,0,0,22.6,32));           // 轮毂
 crankSpin.add(box(19,4.6,3,M.accent,9.2,0,23));            // 摇臂
 crankSpin.add(box(4,7,3,M.accent,18.4,0,23));
 crankSpin.add(cylZ(4,18,M.rubber,18.4,0,34,24));           // 手柄
 crankSpin.add(cylZ(4.4,1.2,M.accent,18.4,0,42.4,24));
 crankSpin.add(cylZ(2.5,1.2,M.dark,0,0,9.3,20));
 addPart('crank','折叠摇柄（曲轴+摇臂+手柄）',crankSpin,M.accent,{spin:crankSpin});
}
/* ---------- 齿轮 ---------- */
const crankGearSpin=new THREE.Group();crankGearSpin.position.set(-37,8,14.5);
crankGearSpin.add(new THREE.Mesh(gearGeo(40,.5,2,.5),M.brass));
crankGearSpin.add(cylZ(4.2,2.6,M.metal,0,0,0,20));
addPart('crankGear','摇柄大齿轮 40T',crankGearSpin,M.brass,{spin:crankGearSpin});

// 复合齿轮：10T（第一级从动，z 13.5–15.5）与 40T（第二级主动，z 16–18）同轴固定
const idlerSpin=new THREE.Group();idlerSpin.position.set(-49.5,8,0);
{
 const g10=new THREE.Mesh(gearGeo(10,.5,1.9,.35),M.brass);g10.position.z=14.5;
 const g40=new THREE.Mesh(gearGeo(40,.5,2,.35),M.brass);g40.position.z=17;
 const hub=cylZ(3,4.6,M.metal,0,0,15.75,20);
 idlerSpin.add(g10,g40,hub);
 addPart('idlerGear','复合增速齿轮（10T+40T）',idlerSpin,M.brass,{spin:idlerSpin});
}
const idlerShaftPart=addPart('idlerShaft','中间轴',cylZ(2,6.4,M.steel,-49.5,8,15.2,20),M.steel);

const pinionSpin=new THREE.Group();pinionSpin.position.set(-62,8,17);
pinionSpin.add(new THREE.Mesh(gearGeo(10,.5,1.9,.3),M.brass));
pinionSpin.add(cylZ(2.6,2.4,M.metal,0,0,0,18));
addPart('motorPinion','发电机小齿轮 10T',pinionSpin,M.brass,{spin:pinionSpin});

/* ---------- 发电机 ---------- */
{
 const grp=new THREE.Group();
 const can=new THREE.CylinderGeometry(12.2,12.2,30.5,48);can.rotateX(Math.PI/2);
 const canMesh=new THREE.Mesh(can,M.steel);canMesh.position.set(-62,8,-5.05);grp.add(canMesh);genCan=canMesh;   // 前端面 z=10.2，与传动板留 0.3 mm
 canMesh.userData.ghostShell=true;canMesh.userData.ghostOpacity=.22;   // 剖开时只让机壳变透明，内部转子保持实体
 grp.add(cylZ(5.4,2.2,M.dark,-62,8,-19.4,32));           // 后端盖
 grp.add(cylZ(4,2,M.metal,-62,8,12,32));                 // 前端盖凸台（穿过传动板 Ø8.4 孔）
 // 定子：两块永磁钢 + 两只电刷，不转
 for(const m of [box(10,2.4,24,M.dark,-62,18.2,-5),box(10,2.4,24,M.dark,-62,-2.2,-5),
                 box(2,1.2,2,M.dark,-62,11.4,8.4),box(2,1.2,2,M.dark,-62,4.6,8.4)]){m.userData.keepMat=true;grp.add(m);}
 // 转子：铁芯 + 铜绕组 + 换向器 + 轴，一起以 16× 转（轴原先挂在机壳上）
 const rotor=new THREE.Group();rotor.position.set(-62,8,0);
 rotor.add(cylZ(7,18,M.dark,0,0,-4.5,32));
 rotor.add(cylZ(7.3,15,M.copper,0,0,-4.8,32));
 rotor.add(cylZ(3,3.2,M.brass,0,0,8.4,24));
 rotor.add(cylZ(1,6.6,M.metal,0,0,15.6,16));
 rotor.traverse(o=>{if(o.isMesh)o.userData.keepMat=true;});
 grp.add(rotor);genRotor=rotor;
 grp.add(box(9,1.4,.6,M.copper,-62,8,9.6));              // 铭牌线
 grp.add(box(2,4,.8,M.copper,-62,17.6,-18.4));           // 端子
 addPart('generator','永磁发电机（370 电机）',grp,M.steel);
}
/* ---------- 电路 ---------- */
{
 const grp=new THREE.Group();
 grp.add(box(40,40,1.6,M.pcb,28,-4,-16.2));
 for(const[x,y]of[[16,10],[22,10],[16,5],[22,5]])grp.add(cylZ(1.6,4.6,M.dark,x,y,-12.9,16));
 grp.add(box(6,3,.8,M.copper,34,12,-15.1));
 grp.add(tube([[-62,8,-19.8],[-46,5,-19.4],[-20,-2,-17.6],[7,-6,-16.2]],1.1,M.copper,40)); // 发电机→板
 grp.add(tube([[55,-1.5,0],[52,-3,-6],[47.5,-4,-15]],.9,M.copper,24));                        // LED→板
 addPart('pcb','桥式整流板 + 线束',grp,M.pcb);
}
{
 const grp=new THREE.Group();
 const bodyMat=new THREE.MeshStandardMaterial({color:0x2c4f86,roughness:.5});
 grp.add(cylZ(6.5,25,bodyMat,34,-16,-2.9,40));            // 筒身 z -15.4 … 9.6
 grp.add(cylZ(6.7,1.4,M.metal,34,-16,10.3,40));           // 正极盖
 grp.add(box(.6,13,10,M.metal,40.4,-16,-2.9));            // 侧面包边
 addPart('capacitor','超级电容 5.5V 0.1F',grp,bodyMat);
}
{
 const grp=new THREE.Group();
 grp.add(box(9,7,7,M.dark,60.5,-22,0));
 grp.add(box(3.4,2.6,2.6,M.accent,66.6,-22,0));
 grp.add(box(2.2,2.2,4.6,M.dark,63.4,-22,3.4));
 grp.add(tube([[56,-24,-2],[52,-22,-8],[50,-16,-13]],.8,M.copper,20));
 addPart('switch','电源开关',grp,M.dark);
}
/* ---------- 螺丝 ---------- */
{
 const grp=new THREE.Group();
 for(const[x,y]of SCREWS){
  // 螺丝头端面原来与端板外表面同为 z=-21，两个面同深度 → 转视角时逐像素抢深度（用户看到的闪烁）
  grp.add(cylZ(1,29,M.metal,x,y,-5.9,14));    // 杆端藏进头里，不再和端板内表面 z=-19 共面
  grp.add(cylZ(2.1,1.6,M.metal,x,y,-20.6,18)); // 头端面 -21.4：比壳面 -21 凸出 0.4 mm
  grp.add(box(3.2,.7,.6,M.dark,x,y,-21.55));   // 槽再凸 0.45，不和头端面共面
 }
 addPart('screws','四颗 M2×34 螺丝',grp,M.metal);
}

/* ============================ 模块与虚影 ============================ */

/* ---------- 工作台网格与接触阴影（场景件，不注册） ---------- */
{
  const grid=new THREE.GridHelper(460,46,0xc9bfae,0xded6c7);
  grid.position.y=-31;grid.material.transparent=true;grid.material.opacity=.5;world.add(grid);
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  const g=x.createRadialGradient(128,128,8,128,128,128);g.addColorStop(0,'rgba(70,58,40,.32)');g.addColorStop(.55,'rgba(70,58,40,.14)');g.addColorStop(1,'rgba(70,58,40,0)');
  x.fillStyle=g;x.fillRect(0,0,256,256);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(250,150),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));
  sh.rotation.x=-Math.PI/2;sh.position.set(-2,-30.6,0);world.add(sh);
}

const lamp=new THREE.SpotLight(0xffc978,0,400,.55,.6,2);   // 只照镜片前方，避免把整机内部从里往外照亮
lamp.position.set(74,0,0);lamp.target.position.set(240,0,0);world.add(lamp,lamp.target);
// 光束：淡黄体积锥，浅色背景上靠不透明度可见（加色混合在浅底会直接过曝）
const beamGeo=new THREE.CylinderGeometry(36,10,70,32,1,true);beamGeo.rotateZ(-Math.PI/2);
const beamTex=(()=>{const c=document.createElement('canvas');c.width=4;c.height=64;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,0,64);g.addColorStop(0,'rgba(255,190,96,.95)');g.addColorStop(.5,'rgba(255,203,124,.4)');g.addColorStop(1,'rgba(255,214,150,0)');
 x.fillStyle=g;x.fillRect(0,0,4,64);return new THREE.CanvasTexture(c);})();
const beam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({map:beamTex,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
beam.position.set(111,0,0);beam.renderOrder=9;world.add(beam);
// 工作台上的暖光斑
const poolTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
 const g=x.createRadialGradient(64,64,2,64,64,64);g.addColorStop(0,'rgba(255,206,120,.85)');g.addColorStop(.5,'rgba(255,196,110,.28)');g.addColorStop(1,'rgba(255,196,110,0)');
 x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);})();
const pool=new THREE.Mesh(new THREE.PlaneGeometry(150,110),new THREE.MeshBasicMaterial({map:poolTex,transparent:true,opacity:0,depthWrite:false}));
pool.rotation.x=-Math.PI/2;pool.position.set(120,-30.4,0);pool.renderOrder=8;world.add(pool);
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
 const g=x.createRadialGradient(64,64,2,64,64,64);g.addColorStop(0,'rgba(255,224,150,1)');g.addColorStop(.3,'rgba(255,198,110,.55)');g.addColorStop(1,'rgba(255,186,96,0)');
 x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);})();
const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,opacity:0,depthWrite:false,depthTest:false}));
glow.renderOrder=10;   // 灯亮时光晕不被镜片/反光杯挡住
glow.position.set(77,0,0);world.add(glow);

/* ---------- 运动：齿轮链与灯，全部由 state 驱动 ---------- */
const CRANK_PHASE=-.65, IDLER_PHASE=Math.PI/10, PINION_PHASE=Math.PI/10;
function moduleBounds(keys) {
  const b = new THREE.Box3();
  for (const k of keys) {
    const p = byKey.get(k);
    if (p) b.union(new THREE.Box3().setFromObject(p.g));
  }
  return b;
}

let canGhost = null;
function applyMotion(view, state) {
  const a = (state.crankTurns || 0) * TAU + CRANK_PHASE;
  crankSpin.rotation.z = a;
  crankGearSpin.rotation.z = a;
  idlerSpin.rotation.z = -a * 4 + IDLER_PHASE;
  pinionSpin.rotation.z = a * 16 + PINION_PHASE;
  if (genRotor) genRotor.rotation.z = a * 16 + PINION_PHASE;

  const b = Math.max(0, Math.min(1, view.light || 0));
  ledPart.obj.traverse(o => {
    if (o.isMesh && o.material === o.userData.omat && o.userData.omat.emissiveIntensity !== undefined) {
      o.userData.omat.emissiveIntensity = .2 + b * 5;
    }
  });
  lamp.intensity = b * 900;
  beam.material.opacity = b * .85;
  pool.material.opacity = b * .55;
  glow.material.opacity = b * .95;
  glow.scale.setScalar(30 + b * 60);

  // 剖开：发电机机壳单独变透明，转子保持实体（kit 只管 p.shell 的件）
  if (genCan) {
    if (!canGhost) {
      canGhost = genCan.userData.omat.clone();
      canGhost.transparent = true;
      canGhost.opacity = .22;
      canGhost.depthWrite = false;
      canGhost.metalness = 0;
      canGhost.roughness = .8;
      canGhost.side = THREE.DoubleSide;
    }
    genCan.material = view.cut && (state.placed || []).includes('generator') ? canGhost : genCan.userData.omat;
  }
}

export const MODEL = { world, byKey, PARTS: parts, moduleBounds, applyMotion };
