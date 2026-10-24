import * as THREE from 'three';

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
for(const [ya,yb] of [[10,62],[72,85]]){const o=tube(ya,yb,10,9,M.shell,frontShell,-Math.PI/2+.012,Math.PI-.024);o.scale.z=1.1;}
for(const [a,len]of [[-Math.PI/2+.012,Math.PI/2-.36-.012],[.36,Math.PI/2-.36-.012]]){const o=tube(62,72,10,9,M.shell,frontShell,a,len);o.scale.z=1.1;}
mesh(lathe([[85,9],[85,10],[96,9.4],[103,6],[107,3.4],[108,3.4],[108,2.4],[103,4.8],[96,8.4],[85,9]],64,-Math.PI/2+.012,Math.PI-.024),M.shell,frontShell).scale.z=1.1;
mesh(lathe([[9,8.2],[10,9.5],[10,10],[10,9],[9,8.2]],48,-Math.PI/2+.012,Math.PI-.024),M.shell,frontShell).scale.z=1.1;
mesh(sealSeat(-1),M.shell,frontShell);
addPart('front','前侧外壳',frontShell,'前后半壳卡扣合拢；按钮处为真实贯通孔。','壁厚约 1 mm · 估算','#dedfd6',{shell:true});

const rearShell=group();mesh(lathe(bodyProfile,64,Math.PI/2+.012,Math.PI-.024),M.shell,rearShell).scale.z=1.1;
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
const button=group();box(7.8,10.6,1,M.rubber,button,V(0,67,9.7));cylinder(2.7,2.4,M.teal,button,V(0,67,10.7),'z');cylinder(.75,9,M.teal,button,V(0,67,5),'z');const symbol=torus(1.1,.1,M.white,button,0);symbol.rotation.x=0;symbol.position.set(0,67,11.93);
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
export const MODEL = {
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
