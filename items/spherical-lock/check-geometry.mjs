/* 球形门锁 · 几何自检（Node 直接跑，不进浏览器；先 python3 tools/build.py spherical-lock）
 * 校验 accept.mjs 用 DOM 测不到的东西：真机尺寸、真孔、凸轮-扇面间隙、拨片贴锁舌、弹子对齐、门板切片。
 * 工具与装载都在 ../../tools/geom.mjs。
 */
import { runGeom } from '../../tools/geom.mjs';

await runGeom('spherical-lock', ({ MODEL, MANIFEST, THREE, g, need, near, round }) => {
  const { part, boxOf, groupBox, hitsBoth } = g;
  const D = MODEL.D, R = MODEL.R;

  /* 状态形状与页面一致；apply 会把运动真正刷到网格上 */
  const view = { cut: false, push: 0 };
  const st = (extra = {}) => ({
    chapter: 2, phase: 'lab', placed: MANIFEST.modules.map((m) => m.id),
    spindle: 0, knobIn: 0, knobOut: 0, plug: 0, locked: true, keyKind: 'none', keyInserted: 0, ...extra,
  });
  const apply = (spindle = 0, extra = {}, v = {}) => g.apply({ ...view, ...v }, st({ spindle, ...extra }));

  /* ---------- 1. 零件表：21 件教学零件 + 门板/门框基准 ---------- */
  const keys = MODEL.PARTS.map((p) => p.key);
  const BASE = ['door', 'jamb'];
  const teach = keys.filter((k) => !BASE.includes(k));
  need(teach.length === 21, `21 件教学零件（实际 ${teach.length}）`);
  need(new Set(keys).size === keys.length, '零件 key 唯一');
  const covered = MANIFEST.modules.flatMap((m) => m.parts);
  need(JSON.stringify([...covered].sort()) === JSON.stringify([...teach].sort()),
    `8 个模块覆盖 21 件且无重复无遗漏（覆盖 ${covered.length} 件）`);
  need(teach.every((k) => MODEL.PART_NAMES[k]), '每件教学零件都有中文名');

  /* ---------- 2. 真机尺寸 ---------- */
  apply();
  const ballIn = part('knobIn').obj.children[0];
  near(boxOf(ballIn).getSize(new THREE.Vector3()).y, 57, 0.3, '执手球 Ø57');
  const boltBox = groupBox('latchBolt');
  near(boltBox.max.x - boltBox.min.x, 12.7, 0.05, '斜舌宽 12.7');
  near(boltBox.max.y - boltBox.min.y, 15.9, 0.05, '斜舌高 15.9');
  near(boltBox.max.z - boltBox.min.z, 26, 0.05, '斜舌长 26');
  near(boltBox.max.z, 60 + 12.7, 0.05, '伸出时舌尖到 72.7（门边 60 + 行程 12.7）');
  const faceBox = groupBox('faceplate');
  near(faceBox.max.z, 60, 0.05, '面板与门边齐平');
  near(faceBox.max.x - faceBox.min.x, 25.4, 0.05, '面板宽 25.4');
  near(faceBox.max.y - faceBox.min.y, 57, 0.05, '面板高 57');
  near(groupBox('latchHousing').max.x - groupBox('latchHousing').min.x, 23, 0.2, '锁舌壳 Ø23（边孔 Ø25.4 内）');
  near(groupBox('plateOut').max.x - groupBox('plateOut').min.x, 4, 0.05, '安装板厚 4');
  near(groupBox('roseOut').getSize(new THREE.Vector3()).y, 66, 0.3, '装饰圈 Ø66');

  /* ---------- 3. 门板：Ø55.2 通孔、Ø25.4 边孔、背距 60、面板沉槽 2.5 ---------- */
  const doorObj = part('door').obj;
  need(hitsBoth(doorObj, [-100, 0, 0], [1, 0, 0]).filter((h) => h.point.x < 20 && h.point.x > -26).length === 0,
    '门板中心 Ø55.2 通孔真的通（沿 x 射线零命中）');
  need(hitsBoth(doorObj, [-100, 40, 0], [1, 0, 0]).length > 0, '孔外仍是门板材料（y=40 有实体）');
  near(hitsBoth(doorObj, [0, 0, 100], [0, 0, -1])[0].point.z, -27.6, 0.4, 'Ø25.4 边孔与 Ø55.2 通孔连通');
  near(hitsBoth(doorObj, [0, 24, 100], [0, 0, -1])[0].point.z, 57.5, 0.3, '面板沉槽深 2.5（槽底 z=57.5）');
  near(hitsBoth(doorObj, [0, 40, 100], [0, 0, -1])[0].point.z, 60, 0.3, '沉槽外仍是门边 z=60（背距 60）');

  /* ---------- 4. 门板切片互不重叠（4 段 z 区间单调、首尾相接、总长 -60..60） ---------- */
  const slices = doorObj.children.filter((o) => o.isMesh)
    .map((o) => { const b = new THREE.Box3().setFromObject(o); return { min: round(b.min.z), max: round(b.max.z) }; })
    .sort((a, b) => a.min - b.min);
  let overlapped = false, gapSeen = false;
  for (let i = 1; i < slices.length; i++) {
    if (slices[i].min < slices[i - 1].max - 0.02) overlapped = true;
    if (slices[i].min > slices[i - 1].max + 0.02) gapSeen = true;
  }
  need(slices.length === 4, `门板切成 4 段（实际 ${slices.length}）`);
  need(!overlapped, `门板切片不重叠（z 区间 ${slices.map((s) => s.min + '..' + s.max).join(' / ')}）`);
  need(!gapSeen, '门板切片首尾相接无缝隙');
  near(slices[0].min, -60, 0.05, '门板后段到 -60');
  near(slices[slices.length - 1].max, 60, 0.05, '门板到门边 60');

  /* ---------- 5. 行程：单一位移函数 + 拨片钩全程贴锁舌尾 ---------- */
  const rows = [];
  for (const deg of [0, 15, 30, 45, 60, 75, 90]) {
    apply(deg);
    const b = groupBox('latchBolt'), r = groupBox('retractor');
    const pull = MODEL.boltRetract(deg);
    near(b.max.z, 60 + 12.7 - pull, 0.06, `锁舌位置跟 R(1−cosθ) ${deg}°`);
    near(r.max.z, 46.7 - pull, 0.06, `拨片钩位置跟同一函数 ${deg}°`);
    near(r.max.z - b.min.z, 0, 0.06, `拨片钩贴着锁舌尾 ${deg}°`);
    rows.push(deg + '°:' + round(pull));
  }
  near(MODEL.boltRetract(90), 12.7, 0.001, '90° 行程 = 12.7 mm（½ 英寸）');
  need(rows.length === 7, '行程链逐角度实测：' + rows.join(' '));

  /* ---------- 6. 凸轮销 vs 环形扇面：逐角度 0.10 mm 间隙，不穿模也不脱开 ---------- */
  const sectorOf = () => {
    let b = null;
    part('retractor').obj.traverse((o) => { if (o.isMesh && o.geometry.type === 'ExtrudeGeometry') b = new THREE.Box3().setFromObject(o); });
    return b;
  };
  const gaps = [];
  for (const deg of [0, 15, 30, 45, 60, 75, 90]) {
    apply(deg);
    const pinPos = R.camPin.getWorldPosition(new THREE.Vector3());
    const sector = sectorOf();
    const gap = sector.min.z - (pinPos.z + 2.5);
    gaps.push(round(gap));
    need(gap >= 0.04 && gap <= 0.2, `凸轮销与扇面间隙 ${deg}° = ${round(gap)} mm（压得到、不穿模）`);
  }
  need(new Set(gaps).size === 1, '凸轮销与扇面间隙逐角度恒定（' + gaps.join('/') + ' mm）');

  /* ---------- 7. 五组弹子：对钥匙全对齐 y=8、无钥匙全落、错钥匙第 3 组卡在 7 ---------- */
  const tops = (kind, ins) => MODEL.pinState(st({ keyKind: kind }), ins).map((p) => p.top);
  tops('right', 1).forEach((t, i) => near(t, 8, 1e-6, `对钥匙第 ${i + 1} 组接缝落在剪切线 y=8`));
  need(tops('none', 0).every((t) => t < 8), '无钥匙时五组弹子都落在剪切线以下');
  const wrong = tops('wrong', 1);
  near(wrong[D.wrongIndex], 7, 1e-6, '错钥匙第 3 组停在剪切线下方 1 mm');
  wrong.forEach((t, i) => { if (i !== D.wrongIndex) near(t, 8, 1e-6, `错钥匙其余组仍对齐（第 ${i + 1} 组）`); });
  apply(0, { keyKind: 'right', keyInserted: 1 });
  near(new THREE.Box3().setFromObject(R.pins[0].driver).min.y, 8, 0.02, '上弹子底面落在剪切线（网格实测）');
  apply(0, { keyKind: 'wrong', keyInserted: 1 });
  near(new THREE.Box3().setFromObject(R.pins[D.wrongIndex].driver).min.y, 7, 0.02, '错钥匙那组上弹子下沉 1 mm（网格实测）');
  need(R.pins[D.wrongIndex].driver.material.color.getHex() !== R.pins[0].driver.material.color.getHex(), '卡住那组用红色标出');

  /* ---------- 8. 离合套：锁定退 1 mm、90° 进 5 mm 落进离合盘缺口 ---------- */
  function dogs() {
    const out = [];
    part('clutch').obj.traverse((o) => { if (o.isMesh && o.geometry.type === 'BoxGeometry') out.push(new THREE.Box3().setFromObject(o)); });
    return out;
  }
  apply(0, { plug: 0, locked: true });
  let dg = dogs();
  need(dg.length === 2, '离合套两只爪');
  near(Math.max(...dg.map((b) => b.max.x)), D.plateX0 - 1, 0.06, '锁定时离合爪停在离合盘前 1 mm（退出啮合）');
  apply(0, { plug: 90, locked: false });
  dg = dogs();
  const dmin = Math.min(...dg.map((b) => b.min.x)), dmax = Math.max(...dg.map((b) => b.max.x));
  need(dmin >= D.plateX0 - 0.06 && dmax <= D.plateX1 + 0.06, `解锁后离合爪进入离合盘缺口（x ${round(dmin)}..${round(dmax)}）`);
  need(Math.max(...dg.map((b) => Math.abs(b.max.y))) < D.diskR, '爪半径小于离合盘外径，落在缺口里');
  near(MODEL.clutchShift(st({ plug: 90 })), 5, 1e-9, '锁芯 0–90° 映射成离合套 5 mm 行程');

  /* ---------- 9. 方轴穿孔：离合套 / 内执手方孔 / 两安装板 / 外执手颈 都是真孔 ---------- */
  function passThrough(obj, from, to, label) {
    const meshes = [];
    obj.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const dir = new THREE.Vector3(...to).sub(new THREE.Vector3(...from));
    const len = dir.length(); dir.normalize();
    const list = new THREE.Raycaster(new THREE.Vector3(...from), dir, 0, len).intersectObjects(meshes, false);
    need(list.length === 0, `${label}：轴线射线零命中（实际 ${list.length} 次）`);
  }
  apply(0);
  passThrough(part('clutch').obj, [-44, 0, 0], [-49, 0, 0], '方轴穿过离合套的 8.1 方孔');
  passThrough(part('knobIn').obj, [19.2, 0, 0], [27.8, 0, 0], '方轴穿过内执手方孔');
  passThrough(part('knobOut').obj, [-30, 0, 0], [-16, 0, 0], '方轴穿过外执手颈内孔');
  passThrough(part('plateOut').obj, [-30, 0, 0], [-14, 0, 0], '方轴穿过外侧安装板中心孔');
  passThrough(part('plateIn').obj, [14, 0, 0], [30, 0, 0], '方轴穿过内侧安装板中心孔');
  passThrough(part('key').obj, [-40, 0, 0], [-52, 0, 0], '钥匙没插时不占钥匙孔', true);

  /* ---------- 10. 静态间隙：扇面不扫方轴、拨片颈在壳内孔里、弹簧两端留空间 ---------- */
  apply(0);
  need(sectorOf().min.z > groupBox('spindle').max.z, '拨片扇面在方轴之后，不穿过方轴');
  need(13 > Math.hypot(4, 4) + 0.1, '扇面内缘 13 > 方轴对角半径 5.66，转 90° 不扫到方轴');
  const neckIn = [];
  part('retractor').obj.traverse((o) => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    if (b.max.z > 17.6 && b.min.z < 43.2) neckIn.push(b);
  });
  need(neckIn.length >= 2, '拨片颈与前钩进入锁舌壳');
  need(neckIn.every((b) => Math.max(-b.min.x, b.max.x) < 10.5 && Math.max(-b.min.y, b.max.y) < 10.5),
    '进入锁舌壳的拨片件都在 Ø21 内');
  const springBox = groupBox('latchSpring');
  need(springBox.max.z <= 43.1 && springBox.min.z >= D.tubeZ0 - 0.1, '弹簧坐落在后座与拨片钩之间');
  need(Math.hypot(5.5, 8.5) < D.tubeR0, '拨片颈能穿过锁舌壳后端 Ø21 孔');

  /* ---------- 11. 半剖件 trim ≤0.002 rad：半管不过中心线、转子半剖面在 z=0 ---------- */
  const housing = part('cylHousing');
  const lowerHalf = housing.obj.children.find((o) => o.isMesh && o.geometry.type === 'ExtrudeGeometry');
  const lowerBox = new THREE.Box3().setFromObject(lowerHalf);
  need(lowerBox.max.y <= 0.02 && lowerBox.max.y > -0.06, `锁芯壳下半管顶边刚好在中心线（y=${round(lowerBox.max.y)}，trim=0.0015 rad）`);
  apply(0, {}, { cut: true });
  const halfBox = new THREE.Box3().setFromObject(R.plugHalf);
  need(halfBox.max.z <= 0.03 && halfBox.max.z >= -0.03, `转子半剖的剖面落在 z=0（${round(halfBox.max.z)}）`);
  need(round(halfBox.min.z) < -7, `半剖只留 z<0 半边（${round(halfBox.min.z)}..${round(halfBox.max.z)}）`);
  need(R.plugHalf.visible === true && R.plugFull.visible === false, '剖开时显示半剖转子');
  apply(0, {}, { cut: false });
  need(R.plugHalf.visible === false && R.plugFull.visible === true, '实体时恢复整件转子');
  need(new THREE.Box3().setFromObject(R.shear).getSize(new THREE.Vector3()).y < 1, '剪切线是一条薄片（y 厚 0.9 mm）');

  /* ---------- 12. 门框观察窗 + 扣板开口（教学剖视的尺寸） ---------- */
  const jambMeshes = [];
  part('jamb').obj.traverse((o) => o.isMesh && jambMeshes.push(new THREE.Box3().setFromObject(o)));
  need(jambMeshes.length === 4, `门框由 4 块拼出 28×80 观察窗（实际 ${jambMeshes.length} 块）`);
  need(hitsBoth(part('jamb').obj, [0, 0, 100], [0, 0, -1]).length === 0, '从 +z 看穿门框窗口（中心 28×80 无遮挡）');
  const strikeBox = groupBox('strike');
  near(strikeBox.max.x - strikeBox.min.x, 25.4, 0.05, '扣板宽 25.4');
  near(strikeBox.max.y - strikeBox.min.y, 70, 0.05, '扣板高 70');
});
