/* 注射笔 · 几何自检（Node 直接跑，不进浏览器；先 python3 tools/build.py injection-pen）
 * 校验 accept.mjs 用 DOM 测不到的东西：针尖会不会穿帽底、活塞与玻璃管内壁有没有穿透、
 * 推杆行程与剂量比是否一致、针座螺纹段与笔身前端是否干涉、棘轮齿会不会被棘爪扎进去。
 * 工具与装载都在 ../../tools/geom.mjs。
 */
import { runGeom } from '../../tools/geom.mjs';

await runGeom('injection-pen', ({ MODEL, THREE, g, need, r2, r3 }) => {
  const { part, boxOf, verts, maxR, minR, shoot, radiusOf, angleOf, apply } = g;
  const PEN = MODEL.PEN;

  const ALL = MODEL.PARTS.map((p) => p.key);
  const FULL = {
    chapter: 2, phase: 'lab', placed: ALL, completed: [true, true, true],
    capOuterT: 1, capOuter: 1, capInnerT: 1, capInner: 1, needleT: 1, needle: 1,
    pressT: 0, press: 0, targetMg: 0, windMg: 0, delivered: 0, pending: 0,
  };
  const pose = (patch = {}) => apply({ cut: false }, { ...FULL, ...patch });
  pose();

  /* ---------- 1. 针尖不穿帽底（帽内腔前端） ---------- */
  const needleTip = Math.max(...verts(part('needle')).map((v) => v[0]));
  const capInnerBack = shoot('capInner', needleTip, 1)[0];
  const capOuterBack = shoot('capOuter', needleTip, 1)[0];
  need(Math.abs(needleTip - 157.4) < 0.2, `针尖位置与文档一致（x=${r2(needleTip)}）`);
  need(capInnerBack != null && capInnerBack - needleTip >= 1.5, `针尖不穿内帽底（余 ${r2(capInnerBack - needleTip)} mm）`);
  need(capOuterBack != null && capOuterBack - needleTip >= 5, `针尖不穿外帽底（余 ${r2(capOuterBack - needleTip)} mm）`);

  /* ---------- 2. 活塞与卡式瓶内壁零穿透 ---------- */
  const bungR = maxR(part('bung'));
  // 径向射线：从 (x=106, r=40) 朝轴心打，先命中玻璃外壁、再命中内壁
  const rc2 = new THREE.Raycaster(new THREE.Vector3(106, 40, 0), new THREE.Vector3(0, -1, 0));
  const glassObjs = [];
  part('cartridge').g.traverse((o) => { if (o.isMesh) glassObjs.push(o); });
  const glassHits = rc2.intersectObjects(glassObjs, false).map((h) => Math.abs(h.point.y));
  const glassOuter = glassHits[0], glassInner = glassHits[1];
  need(glassInner != null && Math.abs(glassInner - PEN.bore) < 0.03, `玻璃管内径量得 Ø${r2((glassInner || 0) * 2)}（文档 Ø9.5）`);
  need(bungR + 0.05 <= glassInner, `活塞不刮管内壁（活塞 Ø${r2(bungR * 2)} ≤ 管内 Ø${r2(glassInner * 2)}，余 ${r3(glassInner - bungR)} mm）`);
  const b0 = boxOf(part('bung'));
  need(b0.min.x >= 88.2 && b0.max.x <= 132, `活塞整段在玻璃直管里（${r2(b0.min.x)} … ${r2(b0.max.x)}）`);
  need(Math.abs(glassOuter - 5.8) < 0.05, `玻璃外径量得 Ø${r2(glassOuter * 2)}`);

  /* ---------- 3. 推杆行程与剂量比一致 ---------- */
  const bungX = (patch) => { pose(patch); return boxOf(part('bung')).min.x; };
  const dragFront = (patch) => { pose(patch); return boxOf(part('drug')).max.x; };
  const x0 = bungX({});
  const xHalf = bungX({ delivered: 0.5 });
  const xOne = bungX({ delivered: 1.0 });
  need(Math.abs(x0 - 92) < 0.01, `静止时活塞后端在 x=92（${r2(x0)}）`);
  need(Math.abs((xHalf - x0) - 1.41) < 0.01, `0.5 mg 档位移 1.41 mm（实测 ${r3(xHalf - x0)}）`);
  need(Math.abs((xOne - x0) - 2.82) < 0.01, `1.0 mg 档位移 2.82 mm（实测 ${r3(xOne - x0)}）`);
  need(Math.abs((xOne - x0) / (xHalf - x0) - 2) < 0.01, `两档位移比正好 2:1（${r3((xOne - x0) / (xHalf - x0))}）`);
  // 药液体积 ↔ 剂量：1.0 mg 应排出 0.2 mL（5 mg/mL）
  const vol = (xOne - x0) * Math.PI * PEN.bore * PEN.bore;   // mm³
  const mass = vol * 0.005;                                  // 5 mg/mL = 0.005 mg/mm³
  need(Math.abs(vol / 1000 - 0.2) < 0.003, `1.0 mg 档排出 ${r3(vol / 1000)} mL（应 0.2 mL）`);
  need(Math.abs(mass - 1.0) < 0.01, `按 5 mg/mL 折算为 ${r3(mass)} mg（标称 1.0 mg）`);
  // 只拨剂量（不上弦后的推进）时活塞与丝杠不该动
  const xDial = bungX({ windMg: 1.0 });
  need(Math.abs(xDial - x0) < 0.005, `只拨剂量时活塞纹丝不动（${r3(xDial - x0)} mm）`);
  // 拨剂量时螺母与旋钮反向转、且转角与剂量对应（180°/mg）
  pose({ windMg: 0.5 });
  const dialA = part('dial').obj.rotation.x, nutA = part('nut').obj.rotation.x;
  need(Math.abs(dialA - Math.PI / 2) < 1e-6, `0.5 mg 时旋钮转 90°（${r2((dialA * 180) / Math.PI)}°）`);
  need(Math.abs(nutA) < 1e-6, `0.5 mg 时螺母还没转（${r2((nutA * 180) / Math.PI)}°）`);
  pose({ delivered: 0.5, windMg: 0.5 });
  need(Math.abs(part('nut').obj.rotation.x + Math.PI / 2) < 1e-6, '注射半程时螺母转过 90°');
  // 注射到底：药液柱前后端贴合活塞
  pose({ delivered: PEN.totalMg });
  const drugCol = new THREE.Box3().setFromObject(part('drug').obj.children[0]);
  const bMax = boxOf(part('bung')), drugMax = { max: { x: drugCol.max.x }, min: { x: drugCol.min.x } };
  need(Math.abs(drugMax.max.x - PEN.drugEnd) < 0.01, `注射到底药液柱前端仍在 x=128（${r2(drugMax.max.x)}）`);
  need(bMax.max.x <= PEN.drugEnd + 0.02, `活塞不顶穿药液（活塞前 ${r2(bMax.max.x)} ≤ 128）`);
  need(bMax.max.x < 132, `活塞不会走到玻璃肩部（${r2(bMax.max.x)} < 132）`);
  // 丝杠与螺母始终啮合
  pose({ delivered: PEN.totalMg });
  const nutBox = boxOf(part('nut')), screwBox = boxOf(part('screw'));
  need(screwBox.min.x < nutBox.min.x - 1 && screwBox.max.x > nutBox.max.x + 1,
    `打满后丝杠仍贯穿螺母（丝杠 ${r2(screwBox.min.x)}…${r2(screwBox.max.x)} / 螺母 ${r2(nutBox.min.x)}…${r2(nutBox.max.x)}）`);

  /* ---------- 4. 针座螺纹段与笔身前端不干涉 ---------- */
  pose();
  const hubCrest = maxR(part('hub'));
  const needleBore = minR(part('needle'), (v) => radiusOf(v) > 3 && v[0] < 152);
  const hubBox = boxOf(part('hub')), bodyBox = boxOf(part('body')), holderBox = boxOf(part('holder'));
  const innerCapBore = minR(part('capInner'), (v) => radiusOf(v) > 3 && v[0] < 158.5);
  need(hubCrest <= needleBore - 0.05, `针座螺纹牙顶 Ø${r2(hubCrest * 2)} 小于针头内孔 Ø${r2(needleBore * 2)}（余 ${r3(needleBore - hubCrest)} mm）`);
  need(hubBox.min.x >= holderBox.max.x - 0.02 && hubBox.min.x > bodyBox.max.x + 20,
    `针座只坐在支架前端，离笔身还有 ${r2(hubBox.min.x - bodyBox.max.x)} mm`);
  need(hubCrest < innerCapBore - 0.3, `内帽内孔 Ø${r2(innerCapBore * 2)} 罩得住针座（余 ${r2(innerCapBore - hubCrest)} mm）`);
  const needleHubR = maxR(part('needle'), (v) => v[0] > 144 && v[0] < 153.2);
  need(needleHubR < innerCapBore - 0.2, `内帽罩得住装好的针头（针头座 Ø${r2(needleHubR * 2)}）`);

  /* ---------- 5. 棘轮齿不被棘爪扎进去 ---------- */
  pose();
  const ratchetInner = Math.min(...verts(part('dial')).filter((v) => radiusOf(v) > 7 && radiusOf(v) < 8.7).map(radiusOf));
  const valleyFloor = Math.max(...verts(part('dial')).filter((v) => radiusOf(v) > 8.4 && radiusOf(v) < 8.7).map(radiusOf));
  const pawlTip = (p) => Math.max(...verts(p).filter((v) => v[0] < 19.2).map(radiusOf));
  const pawlOuter = pawlTip(part('pawl'));
  const pawlAngles = verts(part('pawl')).filter((v) => v[0] < 26).map(angleOf).filter((a) => Math.abs(a) < 30);
  const pawlHalf = Math.max(...pawlAngles.map(Math.abs));
  const valleys = verts(part('dial'))
    .filter((v) => Math.abs(radiusOf(v) - valleyFloor) < 0.02)
    .map(angleOf)
    .filter((a) => Math.abs(a) < 20);
  const valleyHalf = Math.min(...valleys.map(Math.abs));
  need(valleyFloor - pawlOuter >= 0.04, `棘爪尖离齿谷底 ${r3(valleyFloor - pawlOuter)} mm（不穿模）`);
  need(valleyHalf - pawlHalf >= 0.5, `棘爪（±${r2(pawlHalf)}°）落在齿谷（±${r2(valleyHalf)}°）里，两侧余量 ${r2((valleyHalf - pawlHalf) / 180 * Math.PI * valleyFloor)} mm`);
  need(pawlOuter - ratchetInner >= 0.6, `棘爪与齿顶还有 ${r2(pawlOuter - ratchetInner)} mm（转到齿顶前先被抬起）`);
  // 拨到一半（棘爪抬起）时也不该扎进齿里
  pose({ windMg: 0.0625 });
  const lifted = pawlTip(part('pawl'));
  need(lifted < ratchetInner - 0.1, `拨一格途中棘爪抬到 r=${r2(lifted)}（齿顶 r=${r2(ratchetInner)}）`);
  pose({});

  /* ---------- 6. 药液与活塞贴合、剩余药量不越界 ---------- */
  pose({ delivered: 3.0 });
  const b3 = boxOf(part('bung'));
  const d3 = new THREE.Box3().setFromObject(part('drug').obj.children[0]);
  need(Math.abs(d3.min.x - b3.max.x) < 0.03, `药液后端贴着活塞前端（${r3(d3.min.x - b3.max.x)} mm）`);

  /* ---------- 输出 ---------- */
  console.log(`笔长 ${r2(Math.max(...verts(part('capOuter')).map((v) => v[0])) - Math.min(...verts(part('button')).map((v) => v[0])))} mm · `
    + `卡式瓶内径 Ø${r2(glassInner * 2)} · 针尖 x=${r2(needleTip)} · 针座牙顶 Ø${r2(hubCrest * 2)}`);
  console.log(`0.5 mg → ${r3(xHalf - x0)} mm · 1.0 mg → ${r3(xOne - x0)} mm · 1.0 mg 排液 ${r3(vol / 1000)} mL`);
  console.log(`棘轮：齿谷底 r=${r2(valleyFloor)} · 齿顶 r=${r2(ratchetInner)} · 棘爪外沿 r=${r2(pawlOuter)} · 齿谷半角 ${r2(valleyHalf)}°`);
});
