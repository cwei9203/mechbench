/* mechbench · 生成物，勿手改
 * 源：items/electric-toothbrush/{model.mjs,manifest.mjs,logic.mjs}
 * 重新生成：python3 tools/build.py electric-toothbrush
 * 用途：无浏览器断言 → node tools/verify.mjs electric-toothbrush
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

/* ==== electric-toothbrush/model.mjs ==== */

/* 电动牙刷 · 几何与运动（几何段从旧项目 model.html 原样迁移，未改尺寸）
 * 基准：1 unit = 1 mm；通用电磁摆动轴式教学模型，160 × 20 × 22 mm 外形及内部参数均为估算，非品牌复刻。
 * 零件清单（21 件）：前壳/后壳/底盖/底盖密封圈/内骨架/AAA 电池/触片弹簧/驱动板/按键/
 * 线圈磁轭/永磁转子/金属轴/扭簧/两轴套/轴唇封/D 形内衬/空心刷颈/刷毛。
 */
const world = new THREE.Group();

const M={shell:new THREE.MeshPhysicalMaterial({color:0xf6f5ef,roughness:.3,clearcoat:.3}),teal:new THREE.MeshStandardMaterial({color:0x287363,roughness:.56}),chassis:new THREE.MeshStandardMaterial({color:0x53695e,roughness:.65}),metal:new THREE.MeshStandardMaterial({color:0xaab8bd,metalness:.85,roughness:.3}),gold:new THREE.MeshStandardMaterial({color:0xc49c50,metalness:.75,roughness:.28}),copper:new THREE.MeshStandardMaterial({color:0xcb7a43,metalness:.65,roughness:.33}),rubber:new THREE.MeshStandardMaterial({color:0x263c35,roughness:.84}),battery:new THREE.MeshStandardMaterial({color:0x496e8e,metalness:.2,roughness:.38}),pcb:new THREE.MeshStandardMaterial({color:0x3a7152,roughness:.68}),white:new THREE.MeshStandardMaterial({color:0xe4eeeb,roughness:.4}),bristle:new THREE.MeshStandardMaterial({color:0x87c4bb,roughness:.5}),dark:new THREE.MeshStandardMaterial({color:0x344542,roughness:.6})};
const DRIVE_AMPLITUDE=THREE.MathUtils.degToRad(3);
const TAU=Math.PI*2,V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function group(){return new THREE.Group()}
function mesh(g,m,parent,pos){const o=new THREE.Mesh(g,m);if(pos)o.position.copy(pos);if(parent)parent.add(o);return o}
function lathe(profile,seg=64,start=0,len=TAU){return new THREE.LatheGeometry(profile.map(([y,r])=>new THREE.Vector2(r,y)),seg,start,len)}
function tube(y0,y1,ro,ri,mat,parent,start=0,len=TAU){return mesh(lathe([[y0,ri],[y0,ro],[y1,ro],[y1,ri],[y0,ri]],64,start,len),mat,parent)}
function cylinder(radius,height,mat,parent,pos,axis='y'){const o=mesh(new THREE.CylinderGeometry(radius,radius,height,40),mat,parent,pos);if(axis==='z')o.rotation.x=Math.PI/2;return o}
function box(w,h,d,mat,parent,pos){return mesh(new THREE.BoxGeometry(w,h,d),mat,parent,pos)}
function wire(points,r,mat,parent){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>V(...p))),Math.max(18,points.length*5),r,6,false),mat,parent)}
function helix(y0,y1,radius,wireR,turns,mat,parent){const pts=[];for(let i=0;i<=turns*32;i++){const t=i/(turns*32);pts.push([radius*Math.cos(t*turns*TAU),y0+(y1-y0)*t,radius*Math.sin(t*turns*TAU)])}return wire(pts,wireR,mat,parent)}
function torus(radius,wireR,mat,parent,y){const o=mesh(new THREE.TorusGeometry(radius,wireR,10,64),mat,parent,V(0,y,0));o.rotation.x=Math.PI/2;return o}
// D 形截面为真实几何；内衬分前后半件，透视仅剖开前半，保留实体壁厚。
function dShaft(y0,y1,r,flat){const a=Math.acos(flat/r),pts=[];for(let i=0;i<=80;i++){const t=a+(TAU-2*a)*i/80;pts.push(new THREE.Vector2(r*Math.cos(t),r*Math.sin(t)));}const g=new THREE.ExtrudeGeometry(new THREE.Shape(pts),{depth:y1-y0,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y0,0);return g;}
function socketHalf(y0,y1,sign,relief=false){const ro=2.62,ri=1.47,flat=.92,a=Math.acos(flat/ri),pts=[];for(let i=0;i<=48;i++){const t=Math.PI*i/48;pts.push([ro*Math.cos(t),ro*Math.sin(t)]);}for(let i=0;i<=48;i++){const t=Math.PI+(a-Math.PI)*i/48;pts.push([ri*Math.cos(t),ri*Math.sin(t)]);}if(relief)pts.push([flat,.4],[1.6,.4],[1.6,0]);else pts.push([flat,0]);const shape=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,sign*z)));const g=new THREE.ExtrudeGeometry(shape,{depth:y1-y0,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y0,0);return g;}
function sealSeat(sign){const pts=[];for(let i=0;i<=48;i++){const a=Math.PI*i/48;pts.push(new THREE.Vector2(3.4*Math.cos(a),sign*3.74*Math.sin(a)));}for(let i=0;i<=48;i++){const a=Math.PI*(1-i/48);pts.push(new THREE.Vector2(2.4*Math.cos(a),sign*2.4*Math.sin(a)));}const g=new THREE.ExtrudeGeometry(new THREE.Shape(pts),{depth:.8,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,107.2,0);return g;}
function printLabel(text,w,h,parent,pos){const c=document.createElement('canvas');c.width=512;c.height=Math.round(512*h/w);const ctx=c.getContext('2d');ctx.fillStyle='#e0eae5';ctx.font=`500 ${Math.floor(c.height*.65)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,c.height/2);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});const o=mesh(new THREE.PlaneGeometry(w,h),m,parent,pos);o.userData.label=true;return o}
const parts=[],byKey=new Map();
function addPart(key,name,obj,desc,size,color,options={}){const holder=group();holder.add(obj);world.add(holder);obj.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.userData.omat=o.material;o.userData.key=key;o.castShadow=false;});const p={key,name,obj,g:holder,desc,size,color,...options,e:0,homed:false,base:V(),ex:V(),layer:0};parts.push(p);byKey.set(key,p);return p}
const bodyProfile=[[9,8.2],[10,9.5],[15,10],[85,10],[96,9.4],[103,6],[107,3.4],[108,3.4],[108,2.4],[103,4.8],[96,8.4],[85,9],[15,9],[10,8.4],[9,8.2]];
const frontShell=group();
for(const [ya,yb] of [[10,62],[72,85]]){const o=tube(ya,yb,10,9,M.shell,frontShell,-Math.PI/2+.002,Math.PI-.004);o.scale.z=1.1;}
for(const [a,len]of [[-Math.PI/2+.002,Math.PI/2-.36-.002],[.36,Math.PI/2-.36-.002]]){const o=tube(62,72,10,9,M.shell,frontShell,a,len);o.scale.z=1.1;}
mesh(lathe([[85,9],[85,10],[96,9.4],[103,6],[107,3.4],[108,3.4],[108,2.4],[103,4.8],[96,8.4],[85,9]],64,-Math.PI/2+.002,Math.PI-.004),M.shell,frontShell).scale.z=1.1;
mesh(lathe([[9,8.2],[10,9.5],[10,10],[10,9],[9,8.2]],48,-Math.PI/2+.002,Math.PI-.004),M.shell,frontShell).scale.z=1.1;
mesh(sealSeat(-1),M.shell,frontShell);
addPart('front','前侧外壳',frontShell,'前后半壳卡扣合拢；按钮处为真实贯通孔。','壁厚约 1 mm · 估算','#dedfd6',{shell:true});

const rearShell=group();mesh(lathe(bodyProfile,64,Math.PI/2+.002,Math.PI-.004),M.shell,rearShell).scale.z=1.1;
for(const y of [18,58,78,92])for(const x of [-6.6,6.6])box(1.8,1.2,2.5,M.shell,rearShell,V(x,y,-4.95));
mesh(sealSeat(1),M.shell,rearShell);
addPart('rear','后侧外壳',rearShell,'内筋固定骨架；壳口圆形环座固定轴封。金属轴穿过壳口，外壳不与刷头传扭。','包络 Ø20 × 99 mm · 估算','#dedfd6',{shell:true});
const cap=group();mesh(lathe([[0,0],[0,7.5],[1,9.2],[3,10],[6.8,10],[7.4,9.2],[8.6,9.2],[9,9],[9,8],[3,8],[3,0]]),M.teal,cap).scale.z=1.1;
cylinder(2.8,8.4,M.teal,cap,V(0,7.2,0));
for(const x of [-7.8,7.8])box(1.4,2,3,M.teal,cap,V(x,9,0));
addPart('cap','卡口底盖',cap,'旋转卡口固定，打开后才能抽出电池。','Ø20 × 9 mm · 估算','#287363',{shell:true});
const seal=group();torus(9.3,.5,M.rubber,seal,8).scale.y=1.1;addPart('seal','底盖密封圈',seal,'嵌入底盖槽内，随底盖取下。','Ø18.6 × 1 mm · 估算','#35453d');
const chassis=group();for(const x of [-6.8,6.8])box(1.3,83,5,M.chassis,chassis,V(x,52.5,-1.4));
for(const y of [11,61,78.4,94])box(14,1.6,1.4,M.chassis,chassis,V(0,y,y===11?-6:-4.8));
tube(77.5,79,3.2,2.39,M.chassis,chassis);box(6.4,1.5,1.4,M.chassis,chassis,V(0,78.25,-3.6));
for(const x of [-6.2,6.2])wire([[x,93,-1.8],[Math.sign(x)*1.3,104.5,-2.4]],.55,M.chassis,chassis);
tube(103.5,105.5,3,2.39,M.chassis,chassis);box(1.4,.8,3,M.chassis,chassis,V(5,96,-1));
for(const x of [-5.5,5.5])for(const y of [62,72])box(2.6,2,2,M.chassis,chassis,V(x,y,-2.6));
addPart('chassis','内骨架与轴套座',chassis,'壳体内筋夹持骨架；后横梁固定磁轭，斜撑连接上轴套座；侧台固定扭簧下腿。','约 15 × 95 × 9 mm · 估算','#53695e');
const battery=group();cylinder(5.25,42.3,M.battery,battery,V(0,36.85,0));cylinder(5.2,.7,M.metal,battery,V(0,15.35,0));cylinder(5.2,.6,M.metal,battery,V(0,58.3,0));cylinder(1.7,.9,M.metal,battery,V(0,59.05,0));printLabel('AAA',7,3,battery,V(0,39,5.29));printLabel('+',2,2,battery,V(0,55,5.3));
addPart('battery','AAA 电池',battery,'标准 LR03 电池，正极朝向电机；两端触片夹持。','Ø10.5 × 44.5 mm · 标准尺寸','#496e8e');
const contacts=group(),capSpring=group();contacts.add(capSpring);helix(11.5,14.9,2.5,.18,3,M.metal,capSpring);wire([[2.5,11.5,0],[4,11,-1.7],[5.8,10.5,-3.3]],.2,M.copper,capSpring);box(5,.35,5,M.metal,contacts,V(0,59.8,0));wire([[0,60,-2],[0,61,-3],[2,62,-3]],.22,M.copper,contacts);wire([[5.8,10.5,-3.3],[5.8,12,-3.3],[5.8,61,-3.3],[4,63,-3]],.2,M.copper,contacts);
addPart('contacts','弹簧与电池触片',contacts,'底弹簧固定于底盖，打开时随盖移开；上触片卡在骨架，导线连控制板。','弹簧线径 0.36 mm · 估算','#aab8bd');
const pcb=group();box(9,14,1,M.pcb,pcb,V(0,67,-2.6));box(3.2,3.2,1.5,M.dark,pcb,V(0,67,-1.3));cylinder(1,1.1,M.metal,pcb,V(0,67,.1),'z');for(const x of [-3,3])for(const y of [63,71])box(1.2,2,1.4,M.metal,pcb,V(x,y,-1.5));wire([[-2,73,-2],[-4.3,76,-2],[-4.3,85.5,0]],.22,M.copper,pcb);wire([[2,73,-2],[4.3,76,-2],[4.3,85.5,0]],.22,M.dark,pcb);
addPart('pcb','升压与交变驱动板',pcb,'板卡固定于骨架槽；电池直流经升压、驱动电路交变励磁。电路和线圈接线仅示意。','9 × 14 × 1 mm · 估算','#3a7152');
// 硅胶唇缘按窗洞尺寸放大 1 mm（旧版 7.8×10.6 盖不住前壳按钮窗，实体外观下露出横缝）
const button=group();box(8.9,11.7,1.6,M.rubber,button,V(0,67,9.9));cylinder(2.7,2.4,M.teal,button,V(0,67,10.7),'z');cylinder(.75,9,M.teal,button,V(0,67,5),'z');const symbol=torus(1.1,.1,M.white,button,0);symbol.rotation.x=0;symbol.position.set(0,67,11.93);
addPart('button','硅胶电源按键',button,'唇缘扣在前壳孔内，顶杆连接板上开关；点按可启动。','按面 Ø5.4 mm · 行程 0.5 mm','#287363');
const stator=group();box(12.8,16,1.2,M.metal,stator,V(0,87,-4.8));
for(const sign of [-1,1]){box(1.2,14,5.4,M.metal,stator,V(sign*5.8,87,-2.1));const core=cylinder(1.05,2.8,M.dark,stator,V(sign*4.3,87,0));core.rotation.z=Math.PI/2;const coil=helix(-.85,.85,1.45,.1,7,M.copper,stator);coil.rotation.z=-Math.PI/2;coil.position.set(sign*4.2,87,0);box(.5,10,4.4,M.metal,stator,V(sign*2.9,87,0));}
addPart('stator','固定线圈与磁轭',stator,'U 形磁轭固定于骨架后横梁，两组铜线交变励磁；极靴与永磁转子之间留气隙。','约 12.8 × 16 × 9 mm · 估算','#cb7a43');
const rotor=group();tube(80,94,1.8,1.38,M.metal,rotor);
for(const sign of [-1,1]){box(2.4,12,.5,M.metal,rotor,V(0,87,sign*1.75));box(2.4,12,.8,sign>0?M.teal:M.dark,rotor,V(0,87,sign*2.2));}
addPart('rotor','永磁摆动转子',rotor,'磁块固定在转子载体上；轮毂压装在金属轴，交变磁场使转子小角度往复摆动。','轮毂 Ø3.6 × 14 mm · 估算','#287363');
const shaft=group();cylinder(1.4,33.7,M.metal,shaft,V(0,93.35,0));mesh(dShaft(110.2,125,1.4,.85),M.metal,shaft);
for(const [a,b,r]of [[76.8,77.45,2],[100.5,101.5,1.9],[105.55,106.2,2],[109.2,110.2,2.1]])tube(a,b,r,1.38,M.metal,shaft);
addPart('shaft','金属输出轴与轴肩',shaft,'下段圆轴在两轴套内摆动；上端 D 形插入刷头内衬传扭。轴肩托住内衬，止推环限制轴向窜动；拔头后轴留在手柄。','Ø2.8 × 48.5 mm · D 形平面 x=0.85 mm · 估算','#aab8bd');
const spring=group(),springPoints=[[5,96,0],[2.8,96,0]];for(let i=1;i<=96;i++){const t=i/96;springPoints.push([2.8*Math.cos(t*3*TAU),96+5*t,2.8*Math.sin(t*3*TAU)]);}springPoints.push([1.8,101,0]);const springWire=wire(springPoints,.25,M.gold,spring);const springRest=springWire.geometry.attributes.position.array.slice(),springNormals=springWire.geometry.attributes.normal.array.slice();
// shortcut: 按高度插值扭转仅展示两端约束；分析共振或应力时需换弹性动力学模型。
function deformSpring(theta){const pos=springWire.geometry.attributes.position,normal=springWire.geometry.attributes.normal;for(let i=0;i<pos.count;i++){const j=i*3,a=theta*THREE.MathUtils.clamp((springRest[j+1]-96)/5,0,1),c=Math.cos(a),s=Math.sin(a);pos.setXYZ(i,c*springRest[j]+s*springRest[j+2],springRest[j+1],-s*springRest[j]+c*springRest[j+2]);normal.setXYZ(i,c*springNormals[j]+s*springNormals[j+2],springNormals[j+1],-s*springNormals[j]+c*springNormals[j+2]);}pos.needsUpdate=true;normal.needsUpdate=true;}
addPart('spring','扭转复位弹簧',spring,'下腿固定骨架侧台，上腿固定轴环；输出轴摆动时弹簧扭转并提供回复力。','中径 5.6 mm · 线径 0.5 mm · 3 圈 · 估算','#c49c50');
const bearings=group();for(const [a,b]of [[77.5,79],[103.5,105.5]])tube(a,b,2.4,1.42,M.gold,bearings);addPart('bearings','两端滑动轴套',bearings,'外圆压装在骨架轴套座中，估算单边干涉 0.01 mm，弹性省略；圆孔支撑金属轴，轴套固定。','外径 4.8 mm · 孔径 2.84 mm · 估算','#ac914f');
const neckseal=group();mesh(lathe([[106.6,1.4],[106.6,2.4],[108,2.4],[108,1.4],[107.7,1.4],[107.7,1.8],[106.9,1.8],[106.9,1.4],[106.6,1.4]]),M.rubber,neckseal);addPart('neckseal','输出轴唇封',neckseal,'外缘固定于机壳口，内唇贴合金属轴；允许小角度往复，密封压缩未模拟。','外径 4.8 mm · 内唇轴孔 2.8 mm · 估算','#35453d');
const coupler=group();for(const sign of [-1,1])for(const [a,b,relief]of [[110.2,112,false],[112,123,true],[123,126,false]])mesh(socketHalf(a,b,sign,relief),M.teal,coupler).userData.cutaway=sign<0;
for(const sign of [-1,1]){box(.28,13,.5,M.teal,coupler,V(sign*2.66,118,0));box(.5,13,.28,M.teal,coupler,V(0,118,sign*2.66)).userData.cutaway=sign>0;}
const clipPoints=[V(1.35,111.7,0),V(.91,114,0),V(.91,121,0),V(1.35,123.3,0)];for(let i=1;i<clipPoints.length;i++){const a=clipPoints[i-1],b=clipPoints[i],delta=b.clone().sub(a),clip=box(.12,delta.length(),.6,M.metal,coupler,a.clone().add(b).multiplyScalar(.5));clip.rotation.z=-Math.atan2(delta.x,delta.y);clip.userData.clampSpring=true;}
addPart('coupler','D 形内衬与夹持弹片',coupler,'内衬外肋压入空心刷颈，D 形孔与金属轴配合传扭；弹片压紧轴平面，底面坐在轴肩上。透视剖开前半内衬；夹持变形省略。','外径 5.24 mm · D 孔半径 1.47 mm · 平面 x=0.92 mm · 估算','#287363');
const brush=group();tube(109.7,127,3.4,2.7,M.shell,brush).userData.socketCover=true;mesh(lathe([[127,0],[127,3.4],[136,2.1],[142,2.7],[143,0]]),M.shell,brush);
const headshape=new THREE.Shape();headshape.absellipse(0,0,5,11.5,0,TAU,false,0);const hg=new THREE.ExtrudeGeometry(headshape,{depth:3.4,bevelEnabled:true,bevelSize:.5,bevelThickness:.4,bevelSegments:3,curveSegments:40});mesh(hg,M.shell,brush,V(0,148,0));
addPart('brush','空心刷颈与刷头基座',brush,'下部真空腔容纳内衬和金属轴；上部与刷毛基座为一体件。由内衬传扭，同步往复摆动；与机壳留 1.7 mm 间隙。','空腔 Ø5.4 × 17.3 mm · 刷头约 10 × 23 × 4 mm · 估算','#e0e5db');
const bristles=group(),positions=[];for(let row=-4;row<=4;row++){const y=148+row*2.1;for(let col=-1;col<=1;col++){if(Math.abs(row)===4&&col!==0)continue;positions.push([col*2.55,y]);}}
const fiberGeom=new THREE.CylinderGeometry(.08,.1,5,5);fiberGeom.rotateX(Math.PI/2);const fibers=new THREE.InstancedMesh(fiberGeom,M.bristle,positions.length*19);const dummy=new THREE.Object3D();let fi=0;for(const [x,y]of positions){for(let j=0;j<19;j++){const radius=j===0?0:j<7?.32:.62;const angle=j===0?0:j<7?(j-1)*TAU/6:(j-7)*TAU/12;dummy.position.set(x+radius*Math.cos(angle),y+radius*Math.sin(angle),6.2);dummy.updateMatrix();fibers.setMatrixAt(fi++,dummy.matrix)}}bristles.add(fibers);
addPart('bristles','植入式刷毛束',bristles,'每束 19 根圆丝植入基座；与金属轴、内衬、刷颈同相往复摆动，不模拟刷牙接触。','23 束 · 长 5 mm · 估算','#87c4bb');


/* 装配台（旧壳里的 plate）：静态托板，不属于任何模块 */
{
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(116, 2, 56),
    new THREE.MeshStandardMaterial({ color: 0xd3e1f5, roughness: 0.8 })
  );
  plate.position.set(12, -4, 0);
  plate.receiveShadow = true;
  world.add(plate);
}

/* ====== 运动：theta 为当前摆角（弧度） ====== */
function applyMotionAt(theta, state, view) {
  rotor.rotation.y = theta;
  shaft.rotation.y = theta;
  const headAngle = state.headOff ? view.detachedAngle : theta;
  coupler.rotation.y = headAngle;
  brush.rotation.y = headAngle;
  bristles.rotation.y = headAngle;
  deformSpring(theta);
}

/* ====== 包围盒 ====== */
function moduleBounds(keys) {
  const b = new THREE.Box3();
  for (const k of keys) {
    const p = byKey.get(k);
    if (p) b.union(new THREE.Box3().setFromObject(p.g));
  }
  return b;
}

/* ====== 对外接口 ====== */
const MODEL = {
  world,
  byKey,
  PARTS: parts,
  moduleBounds,
  applyMotion: (view, state) => {
    // 未装入的刷头跟着「旋转对齐」一起转，让 D 形平面看得出来
    const rot = state.selected === 'head' && !state.placed.includes('head') ? (state.rotation || 0) * Math.PI / 2 : 0;
    for (const k of ['coupler', 'brush', 'bristles']) byKey.get(k).g.rotation.y = rot;
    applyMotionAt(view.angle || 0, state, view);
  },
};

/* ==== electric-toothbrush/manifest.mjs ==== */
/* 电动牙刷 · 插槽填充（纯数据 + 少量回调）
 * 参考：通用电磁摆动轴式结构，160 × 20 × 22 mm，除 AAA 电池外均为教学估算。
 */
const MANIFEST = {
  slug: 'electric-toothbrush',
  brand: {
    title: '牙刷装配实验室',
    subtitle: '把原理，一块一块拼出来 · 10 模块 · 3 关',
    mark: { a: '#3d9c80', b: '#315efb' },
  },

  chapters: [
    {
      title: '搭起动力核心', subtitle: '先认识支承与复位，再给电机通电。', badge: '复位观察员',
      exp: '手拨一下',
      expText: '给金属轴一个小偏角，观察它往复几次后回到中间。没有通电，弹簧只释放手拨时储存的能量。',
      q: '手拨金属轴后，什么让它回到中间位置？',
      options: ['扭转复位弹簧', '电池', '固定线圈'],
      a: 0,
      why: '扭簧一端连骨架、一端连轴。手拨使它储存弹性能，松开后推动轴回中；尚未接电的线圈不会持续驱动轴。',
    },
    {
      title: '接通能量回路', subtitle: '从电池直流，到线圈的交变励磁。', badge: '电磁探索员',
      exp: '接电试运行',
      expText: '在装配台上接通供电，观察转子与金属轴持续往复。铜线圈固定，只有磁场随驱动电流改变。',
      q: '电池输出直流，金属轴为什么能持续往复？',
      options: ['电池自行改变正负极', '驱动板交替改变线圈电流方向', '外壳带动电机旋转'],
      a: 1,
      why: '驱动板让线圈交变励磁，推动永磁转子往复；转子与金属轴同步，线圈和机壳保持固定。',
    },
    {
      title: '让刷头接住摆动', subtitle: '对齐 D 形连接，完成从电机到刷毛的传动。', badge: '装配小工程师',
      exp: '整机试运行',
      expText: '观察金属轴、内衬、刷颈和刷毛同相摆动，机壳保持固定。通关后还能停机拔下刷头，查看连接关系。',
      q: '拔下刷头后，金属输出轴会一起被拔出吗？',
      options: ['不会，轴留在手柄，内衬随刷头离开', '会，轴和刷头是同一个零件', '会，金属轴藏在刷毛里面'],
      a: 0,
      why: '金属轴仍受机内轴套支撑，D 形内衬随刷头拔出。装回并对齐平面后，轴的摆动才能传给刷头。',
    },
  ],

  stage: {
    title: '拼一支会动的牙刷',
    hint: '选一块模块，把它放到蓝色轮廓里。',
  },

  readout: [
    { key: 'angle', label: '输出摆角', big: true },
    { key: 'mode', label: '状态' },
  ],

  tray: { title: '第一盒 · 动力核心', hint: '点选模块，再拖到蓝色位置' },

  modules: [
    { id: 'frame', chapter: 0, name: '装配骨架', parts: ['chassis'], color: '#40577b', icon: 'housing',
      tip: '把骨架放进装配台，其他模块都由它支撑。',
      learn: '骨架固定电机、轴套和电路板。装机壳前，装配台暂时托住整个机构。' },
    { id: 'core', chapter: 0, name: '预装动力芯', parts: ['rotor', 'shaft', 'spring', 'bearings'], color: '#e6a52d', icon: 'shaft',
      tip: '把带金属轴的动力芯放进骨架。轴套和扭簧已预装。',
      learn: '永磁转子与金属轴一起摆动；轴套支撑轴，扭转弹簧一端连轴、一端连骨架，负责回中。压装工序已预装，吸附只表示模块归位。' },
    { id: 'field', chapter: 0, name: '固定线圈', parts: ['stator'], color: '#d97545', icon: 'coil',
      tip: '把线圈和磁轭装在动力芯外侧。',
      learn: '线圈与磁轭固定在骨架上，与转子留有气隙。线圈不跟着轴摆动；现在尚未通电，只能手拨观察。' },
    { id: 'driver', chapter: 1, name: '交变驱动板', parts: ['pcb'], color: '#2b9a87', icon: 'plate',
      tip: '把驱动板卡进骨架下方的槽位。',
      learn: '电池输出直流。驱动板交替改变线圈电流方向，让磁场推动永磁转子往复摆动。电路参数在本模型中简化。' },
    { id: 'battery', chapter: 1, name: 'AAA 电池', parts: ['battery'], color: '#4b83c0', icon: 'battery',
      tip: '把电池装进电池仓，凸起的正极朝向驱动板。',
      learn: '电池提供能量，自己不会转动。这里使用标准 Ø10.5 × 44.5 mm 的 AAA 电池，正负触片接通后才能形成供电回路。' },
    { id: 'power', chapter: 1, name: '预装供电座', parts: ['contacts', 'cap', 'seal'], color: '#d4a332', icon: 'screw',
      tip: '把带触片、弹簧与密封圈的供电座合到底部。',
      learn: '底部弹簧接触电池负极，上触片接触正极；底盖托住弹簧。此模块把触片和底盖预装在一起，密封圈只展示位置，不代表防水验证。' },
    { id: 'seal', chapter: 2, name: '输出轴唇封', parts: ['neckseal'], color: '#60716c', icon: 'disc',
      tip: '把唇封套到输出轴根部；合壳后外缘固定在壳口。',
      learn: '唇封内唇接触金属轴，外缘固定在机壳口，允许轴小角度往复。橡胶压缩和装配拉伸没有模拟。' },
    { id: 'head', chapter: 2, name: '空心刷头', parts: ['coupler', 'brush', 'bristles'], color: '#65ab97', icon: 'piston',
      tip: '先旋转刷头，让 D 形内孔的平面与金属轴对齐，再插到轴肩上。',
      learn: '空心刷颈内有 D 形内衬和夹持弹片。平面对齐后，金属轴把摆动传给刷头；轴肩限位，刷头与机壳之间保留 1.7 mm 间隙。' },
    { id: 'button', chapter: 2, name: '电源按键', parts: ['button'], color: '#d87481', icon: 'bolt',
      tip: '把按键对准驱动板开关，随后合壳固定。',
      learn: '按键顶杆触发板上的开关，硅胶唇缘由前壳固定。按键控制供电，不是传动件。' },
    { id: 'shell', chapter: 2, name: '前后机壳', parts: ['front', 'rear'], color: '#99adbe', icon: 'shell',
      tip: '合拢前后机壳，固定按键、骨架和轴封。',
      learn: '机壳保护并固定内部组件。运行时机壳、线圈和轴套保持固定；转子、金属轴、刷头和刷毛同步小角度往复。' },
  ],

  notes: [
    '1 unit = 1 mm。通用声波式教学结构，整机约 160 × 20 × 22 mm；除 AAA 电池（标准 Ø10.5 × 44.5 mm）外，几何与性能参数均为估算，不对应某一品牌整机。',
    '简化项：橡胶密封压缩与装配拉伸未模拟；电路与线圈接线只示意；卡扣弹性省略；刷毛与牙齿接触未建模。',
    '<b>摆动从哪来：</b>电池供直流 → 驱动板交变励磁 → 固定线圈推动永磁转子 → 转子与金属轴一起往复（±3°）→ D 形内衬把摆动传给空心刷颈与刷毛。机壳、线圈、轴套全程不动，所以只有刷头在摆。',
  ],

  scene: {
    bench: false,
    spawnFor: (id, info) => [42, 72 - info.center.y, 0],
    camera: { defaultFocus: 'all', fov: 34, near: 0.1, far: 1500 },
    orbit: { minDistance: 22, maxDistance: 800 },
    renderer: { exposure: 1.1, pixelRatio: 2 },
    env: 0.65,
    lights: {
      hemi: [0xffffff, 0xb1c4de, 1.8],
      key: { color: 0xffffff, intensity: 2.5, pos: [-80, 160, 150] },
      rim: { color: 0xd8e9ff, intensity: 1.4, pos: [80, 100, -90] },
    },
    focus: {
      all: { dir: [14.6, 5.6], fit: 1.08, box: (s) => (s.chapter < 2 ? [[13, 63, 0], [102, 132, 50]] : [[13, s.headOff ? 92 : 82, 0], [102, s.headOff ? 196 : 176, 50]]) },
      drive: { dir: [14.6, 5.6], fit: 1.75, box: () => [[0, 94, 0], [38, 55, 30]] },
      head: { dir: [14.6, 5.6], fit: 1.75, box: (s) => (s.headOff ? [[10, 135, 0], [62, 92, 30]] : [[0, 120, 0], [35, 65, 30]]) },
    },
    inset: {
      fov: 36,
      visible: (s) => s.phase !== 'build' && s.placed.includes('core'),
      target: (s) => ({
        part: 'shaft',
        local: [0, s.chapter === 2 ? 117 : 92, 0],
        offset: s.chapter === 2 ? [10, 5, 44] : [15, 7, 61],
        title: s.chapter === 2 ? '金属轴与空心刷头' : '固定线圈与摆动轴',
      }),
    },
    // 剖开时隐藏后半壳等被切掉的网格（由 model.mjs 里的 userData.cutaway 标记）
    hiddenPart: (key, s) => false,
  },
};

/* ==== electric-toothbrush/logic.mjs ==== */
/* ============================================================================
 * 电动牙刷 · 装配与实验逻辑（纯逻辑，无 DOM、无三维）
 * 每个动作自己校验前置条件；失败不动业务状态。
 * ==========================================================================*/

/* 模块表与关卡文案的唯一来源是 manifest.mjs */
const MODULES = MANIFEST.modules;
const CHAPTERS = MANIFEST.chapters;
function createGame(){
  const initial=()=>({chapter:0,phase:'build',placed:[],selected:null,rotation:0,completed:[false,false,false],running:false,headOff:false});
  const state=initial();
  const fail=message=>({ok:false,message});
  function current(){return state.phase==='build'?MODULES.find(m=>m.chapter===state.chapter&&!state.placed.includes(m.id))||null:null;}
  function select(id){
    if(state.phase!=='build')return fail('先完成本章实验与挑战，再继续装配。');
    const module=MODULES.find(m=>m.id===id);
    if(!module)return fail('没有这块模块，请从零件盘选择。');
    if(state.placed.includes(id))return fail('这块模块已经装好了。');
    state.selected=id;state.rotation=id==='head'?1:0;
    return {ok:true,message:module.tip};
  }
  function turn(){
    if(state.phase!=='build'||state.selected!=='head')return fail('先选中空心刷头，才能调整 D 形内孔方向。');
    state.rotation=(state.rotation+1)%4;
    return {ok:true,message:state.rotation===0?'D 形平面已对齐，可以装上刷头。':'刷头已转过 90°，继续对齐 D 形平面。'};
  }
  function place(onTarget=true){
    if(state.phase!=='build')return fail('本章装配已完成，请进行实验与挑战。');
    if(!state.selected)return fail('先从零件盘选一块模块。');
    if(onTarget!==true)return fail('还没对准装配位置，拖到轮廓内再松手。');
    const module=current();
    if(!module||state.selected!==module.id)return fail('这一步需要'+(module?.name||'当前模块')+'。先完成支承和连接，再装后面的零件。');
    if(module.id==='head'&&state.rotation!==0)return fail('D 形平面还没对齐。旋转刷头，让内孔与金属轴的平面一致。');
    state.placed.push(module.id);state.selected=null;state.rotation=0;
    if(!MODULES.some(m=>m.chapter===state.chapter&&!state.placed.includes(m.id)))state.phase='experiment';
    return {ok:true,message:module.name+'已归位。',learn:module.learn,kind:'placed'};
  }
  function undo(){
    if(state.phase==='lab')return fail('整机已通关；想重新装配，请点击重新开始。');
    const last=state.placed.at(-1),module=MODULES.find(m=>m.id===last);
    if(!module||module.chapter!==state.chapter)return fail('本章还没有装入的模块。');
    state.placed.pop();state.phase='build';state.selected=null;state.rotation=0;state.running=false;state.headOff=false;state.completed[state.chapter]=false;
    return {ok:true,message:'已撤回'+module.name+'，可以重新装配。',kind:'undo'};
  }
  function experiment(){
    if(state.phase!=='experiment')return fail('先把本章模块全部装好，再进行实验。');
    state.phase='quiz';state.running=state.chapter>0;
    return {ok:true,message:CHAPTERS[state.chapter].expText,kind:state.chapter===0?'manual':'power'};
  }
  function answer(index){
    if(state.phase!=='quiz')return fail('先亲手完成本章实验，再回答问题。');
    const chapter=CHAPTERS[state.chapter];
    if(!Number.isInteger(index)||index<0||index>=chapter.options.length)return fail('请选择一个有效答案。');
    if(index!==chapter.a)return {ok:false,message:'再观察一下。'+chapter.why,learn:chapter.why,kind:'wrong'};
    state.running=false;state.completed[state.chapter]=true;state.phase='checkpoint';
    return {ok:true,message:'答对了！获得「'+chapter.badge+'」。',learn:chapter.why,kind:'correct'};
  }
  function next(){
    if(state.phase!=='checkpoint'||!state.completed[state.chapter])return fail('先完成本章实验与挑战。');
    state.running=false;state.selected=null;state.rotation=0;
    if(state.chapter<CHAPTERS.length-1){state.chapter++;state.phase='build';return {ok:true,message:CHAPTERS[state.chapter].subtitle,kind:'chapter'};}
    state.phase='lab';return {ok:true,message:'装配完成！现在可以自由运行、剖开观察，或停机拔下刷头。',kind:'complete'};
  }
  function power(){
    if(state.phase!=='lab')return fail('先完成三章挑战，再进入自由实验。');
    state.running=!state.running;
    return {ok:true,message:state.running?(state.headOff?'空载观察：金属轴摆动，移开的刷头保持不动。':'整机运行：金属轴与刷头同步往复，机壳固定。'):'已停机，可以检查或拆装刷头。',kind:state.running?'power':'stop'};
  }
  function head(){
    if(state.phase!=='lab')return fail('完成装配挑战后，才能拆下刷头进行对比。');
    if(state.running)return fail('请先停机，再拔下或装回刷头。');
    state.headOff=!state.headOff;
    return {ok:true,message:state.headOff?'刷头已拔下，内衬随刷头离开，金属轴留在手柄。可点击运行进行空载观察。':'刷头已装回，D 形内衬重新与金属轴连接。',kind:state.headOff?'headOff':'headOn'};
  }
  function restart(){Object.assign(state,initial());return {ok:true,message:'新的装配开始了，先把骨架放到装配台。',kind:'restart'};}
  // 直接看成品：整机装好 + 三关完成 + 已通电
  function demo(){
    Object.assign(state,initial());
    state.placed=MODULES.map(m=>m.id);state.completed=[true,true,true];
    state.chapter=CHAPTERS.length-1;state.phase='lab';state.running=true;
    return {ok:true,message:'整机已装好并通电。看它摆，再拔下刷头做空载对照。',kind:'demo'};
  }
  return {state,current,select,turn,place,undo,experiment,answer,next,power,head,restart,demo};
}

export { MODEL, MANIFEST, createGame, THREE };
