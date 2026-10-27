/* 比较式投币器 · 几何自检（node 直接跑，不进浏览器；先 python3 tools/build.py coin-comparator-lab）
 * 校验 DOM 测不到的东西：真开孔、币道槽宽、活门行程、币与线圈对位、拨盘联动、托盘落点。
 */
import { runGeom } from '../../tools/geom.mjs';

await runGeom('coin-comparator-lab', ({ MODEL, MANIFEST, THREE, g, need, near }) => {
  const { part, groupBox, boxOf, hitsBoth } = g;
  const view = { cut: false };
  const full = () => ({
    chapter: 2, phase: 'lab', placed: MANIFEST.modules.map((m) => m.id),
    sample: 'yuan', sensitivity: 6, power: true, coin: null, verdict: null, diff: null,
    threshold: 46, gate: 0, acceptCount: 0, rejectCount: 0, returnBtn: 0,
  });
  const apply = (extra = {}) => { g.apply(view, { ...full(), ...extra }); };

  /* ---------- 1. 零件表与模块归属 ---------- */
  const keys = MODEL.PARTS.map((p) => p.key);
  need(keys.length === 14, `14 件教学零件（实际 ${keys.length}）`);
  need(new Set(keys).size === keys.length, '零件 key 唯一');
  need(keys.every((k) => MODEL.byKey.get(k).name), '每件零件都有中文名');
  const covered = MANIFEST.modules.flatMap((m) => m.parts);
  need(JSON.stringify([...covered].sort()) === JSON.stringify([...keys].sort()),
    `12 个模块覆盖 14 件且无重复无遗漏（覆盖 ${covered.length} 件）`);
  const expected = ['base', 'runway', 'entry', 'returnBtn', 'cashbox', 'sampleHolder', 'sampleCoin',
    'coil', 'board', 'pot', 'gate', 'solenoid', 'counter', 'cover'];
  need(expected.every((k) => keys.includes(k)), '零件 key 与设计表一致');

  /* ---------- 2. 外形包络：120×178 前盖 / 背板 ---------- */
  apply();
  const panels = (key) => {
    const out = [];
    part(key).g.traverse((o) => { if (o.isMesh && o.geometry.type === 'ExtrudeGeometry') out.push(o); });
    return out;
  };
  const coverPanel = panels('cover')[0];
  const basePanel = panels('base')[0];
  need(!!coverPanel && !!basePanel, '前盖与背板是真实挤出板');
  const coverBox = boxOf(coverPanel), baseBox = boxOf(basePanel);
  near(coverBox.max.x - coverBox.min.x, 124, .1, '前盖宽 124');
  near(coverBox.max.y - coverBox.min.y, 178, .1, '前盖高 178');
  near(coverBox.max.z - coverBox.min.z, 5, .1, '前盖厚 5');
  near(baseBox.max.x - baseBox.min.x, 124, .1, '背板宽 124');
  near(baseBox.max.y - baseBox.min.y, 178, .1, '背板高 178');
  near(baseBox.max.z - baseBox.min.z, 6, .1, '背板厚 6');
  near(baseBox.max.z, -12, .1, '背板前面 z=-12');

  /* ---------- 3. 前盖真开孔：投币口 / 样币窗 / 计数窗 / 灵敏度 / 退币 ---------- */
  const clearPanel = (x, y, label) => {
    const hits = hitsBoth(coverPanel, [x, y, 100], [0, 0, -1], 200);
    need(hits.length === 0, `${label}（${x},${y}）是真的通孔`);
  };
  clearPanel(-34, 78, '3 mm 投币竖缝');
  clearPanel(44, 62, '样币观察窗');
  clearPanel(0, -45, '计数窗');
  clearPanel(52, 22, '灵敏度旋钮孔');
  clearPanel(-52, 56, '退币按钮孔');
  need(hitsBoth(coverPanel, [0, 10, 100], [0, 0, -1], 200).length > 0, '面板实心处仍有铝板');

  /* ---------- 4. 厚度门：净缝 2.6，薄币过、厚垫圈停 ---------- */
  const jaws = [];
  part('runway').g.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== 'BoxGeometry') return;
    const p = o.geometry.parameters;
    if (Math.abs(p.height - 32) < .1 && Math.abs(p.depth - 2) < .1) jaws.push(o);
  });
  need(jaws.length === 2, `厚度门两片夹板（实际 ${jaws.length}）`);
  const jb = jaws.map((o) => boxOf(o)).sort((a, b) => a.getCenter(new THREE.Vector3()).z - b.getCenter(new THREE.Vector3()).z);
  const gap = jb[1].min.z - jb[0].max.z;
  near(gap, 2.6, .03, '厚度门净缝 2.6 mm');
  need(MODEL.COINS.yuan.t < gap, '1 元 1.85 < 2.6，能过');
  need(MODEL.COINS.washer.t > gap, '厚垫圈 3.2 > 2.6，会被挡住');
  const jawCenter = jb[0].getCenter(new THREE.Vector3()).add(jb[1].getCenter(new THREE.Vector3())).multiplyScalar(.5);
  const blockP = MODEL.mainCurve.getPointAt(MODEL.U_BLOCK);
  near(jawCenter.y, blockP.y, 2, '厚度门就在币道高度上');

  /* ---------- 5. 测试线圈：正在币道下方；参考线圈在样币座下 ---------- */
  const coilG = MODEL.world.getObjectByName('testCoil');
  const refG = MODEL.world.getObjectByName('refCoil');
  need(!!coilG && !!refG, '测试/参考线圈都在场景里');
  const coilP = coilG.getWorldPosition(new THREE.Vector3());
  const pathP = MODEL.mainCurve.getPointAt(MODEL.U_COIL);
  need(Math.hypot(coilP.x - pathP.x, coilP.y - pathP.y) < 1.6, '测试线圈对准币道经过点');
  const sampleP = MODEL.world.getObjectByName('sample-yuan').getWorldPosition(new THREE.Vector3());
  need(Math.hypot(refG.position.x - 44, refG.position.y - 62) < 1, '参考线圈在样币座中心');
  need(Math.abs(sampleP.x - 44) < .1 && Math.abs(sampleP.y - 62) < .1, '样币坐在样币座里');
  need(coilP.z > -11.5 && coilP.z < -10.4, '线圈贴在背板上');

  /* ---------- 6. 活门：默认挡住接受口，吸合后让开 ---------- */
  const capOf = () => {
    let cap = null;
    part('gate').g.traverse((o) => {
      if (!o.isMesh || o.geometry.type !== 'BoxGeometry') return;
      const p = o.geometry.parameters;
      if (Math.abs(p.width - 4.5) < .1 && Math.abs(p.height - 5) < .1) cap = o;
    });
    return cap;
  };
  apply({ gate: 0 });
  const tip0 = boxOf(capOf()).getCenter(new THREE.Vector3());
  const d0 = Math.hypot(tip0.x - 34, tip0.y + 34);
  need(d0 < 7, `退币位活门尖端挡在接受口前（距 ${d0.toFixed(1)} mm）`);
  apply({ gate: 1 });
  const tip1 = boxOf(capOf()).getCenter(new THREE.Vector3());
  const d1 = Math.hypot(tip1.x - 34, tip1.y + 34);
  need(d1 > 9, `接受位活门尖端让开币道（距 ${d1.toFixed(1)} mm）`);
  need(tip1.y - tip0.y > 8, `电磁铁行程把活门抬起 ${(tip1.y - tip0.y).toFixed(1)} mm`);

  /* ---------- 7. 硬币：尺寸、入币、过线圈、落点 ---------- */
  near(MODEL.COINS.yuan.d, 25.0, .01, '1 元直径 Ø25');
  near(MODEL.COINS.jiao.d, 20.5, .01, '5 角直径 Ø20.5');
  near(MODEL.COINS.token.d, 24.0, .01, '游戏币 Ø24');
  apply({ coin: { kind: 'yuan', stage: 'rolling', t: 0, rt: 0 } });
  const c0 = MODEL.coinMeshes.yuan;
  need(c0.visible && c0.position.z > 10 && Math.abs(c0.rotation.y) > 1.2, '投币瞬间币边先入，站在前盖外');
  apply({ coin: { kind: 'yuan', stage: 'rolling', t: MODEL.STATIONS.coil, rt: 0 } });
  const c1 = MODEL.coinMeshes.yuan.position;
  need(Math.hypot(c1.x - coilP.x, c1.y - coilP.y) < 1.6, '币经过时正对测试线圈');
  need(c1.z > coilP.z + 1, '币面在测试线圈前方，不压住线圈');
  apply({ coin: { kind: 'yuan', stage: 'done-accepted', t: 1, rt: 0 }, acceptCount: 1 });
  const ca = MODEL.coinMeshes.yuan.position;
  need(ca.y < -90 && Math.abs(ca.x - 36) < 3, `接受币落进接币盒（${ca.x.toFixed(1)}, ${ca.y.toFixed(1)}）`);
  apply({ coin: { kind: 'washer', stage: 'blocked', t: MODEL.STATIONS.stop, rt: 0 } });
  const cw = MODEL.coinMeshes.washer.position;
  const gb = boxOf(jaws[0]).getCenter(new THREE.Vector3());
  need(Math.hypot(cw.x - gb.x, cw.y - gb.y) > 17, `厚币停在厚度门前，币边不穿夹板（${Math.hypot(cw.x - gb.x, cw.y - gb.y).toFixed(1)} mm）`);
  apply({ coin: { kind: 'jiao', stage: 'done-rejected', t: 1, rt: 0 } });
  const cr = MODEL.coinMeshes.jiao.position;
  need(cr.y < -90 && Math.abs(cr.x + 18) < 3, `退回币落进退币杯（${cr.x.toFixed(1)}, ${cr.y.toFixed(1)}）`);

  /* ---------- 8. 拨盘随收币数转动 ---------- */
  apply({ acceptCount: 0 });
  const dial = MODEL.world.getObjectByName('unitDial');
  const a0 = dial.rotation.z;
  apply({ acceptCount: 3 });
  const a3 = dial.rotation.z;
  near(Math.abs(a3 - a0), 3 * Math.PI * 2 / 10, .01, '每收一枚，个位拨盘转 36°');

  /* ---------- 9. 样币切换：两枚都在座上，只显一枚 ---------- */
  apply({ sample: 'yuan' });
  const sy = MODEL.world.getObjectByName('sample-yuan');
  const st = MODEL.world.getObjectByName('sample-token');
  need(sy.visible && !st.visible, '默认显 1 元样币');
  apply({ sample: 'token' });
  need(!sy.visible && st.visible, '换成游戏币样币');
  const syB = boxOf(sy), stB = boxOf(st);
  near(syB.max.x - syB.min.x, 25.0, .2, '1 元样币实径 25');
  near(stB.max.x - stB.min.x, 24.0, .2, '游戏币样币实径 24');

  /* ---------- 10. 币道参数单调 ---------- */
  const ST = MODEL.STATIONS;
  need(ST.block > 0 && ST.block < ST.coil && ST.coil < ST.gate && ST.gate < 1,
    `币道站点单调（${ST.block.toFixed(2)} < ${ST.coil.toFixed(2)} < ${ST.gate} < 1）`);
});
