/* 气钉枪 · 几何自检（Node 直接跑，不进浏览器；先 python3 tools/build.py nail-gun-lab）
 * 校验 accept.mjs 用 DOM 测不到的东西：零件之间的间隙、钉条是否真的在弹匣里。
 * 工具与装载都在 ../../tools/geom.mjs。
 */
import { runGeom } from '../../tools/geom.mjs';

await runGeom('nail-gun-lab', ({ MODEL, THREE, g, need, round }) => {
  const { part, boxOf, sync } = g;
  const gapX = (a, b) => Math.max(b.min.x - a.max.x, a.min.x - b.max.x);
  sync();

  /* ---------- 1. 钉条在弹匣里，钉距 / 支数与文档一致 ---------- */
  const MAG_TAIL = 56;      // 弹匣顶板尾端 x（主机体 box(134,4,20) 中心 123）
  const AXIS = 190;         // 击发轴 = 缸孔 = 钉道
  const nails = part('nails');
  const meshes = nails.obj.userData.nailMeshes;
  const nailBox = boxOf(nails.obj);
  const pitch = Math.abs(meshes[1].position.x - meshes[0].position.x);
  need(nailBox.min.x >= MAG_TAIL - 0.01, `钉条尾端在弹匣窗口内（${round(nailBox.min.x)} ≥ ${MAG_TAIL}）`);
  need(Math.abs(meshes[0].position.x - AXIS) < 0.01, `最前一根钉在击发轴上（${round(meshes[0].position.x)}）`);
  need(meshes.length === MODEL.NAILS, `零件注册钉数一致（${meshes.length} = ${MODEL.NAILS}）`);
  need(Math.abs(pitch - 1.5) < 1e-6, `钉距与文档一致（${round(pitch)} mm）`);

  /* ---------- 2. 推钉板顶住最后一排钉头；空匣时走到击发窗 ---------- */
  const follower = part('follower');
  const folBox = boxOf(follower.obj);
  const lastHead = boxOf(meshes[meshes.length - 1].children[2]);
  const pushGap = lastHead.min.x - folBox.max.x;
  need(pushGap >= 0 && pushGap <= 2, `推钉板顶住最后一排钉头（间隙 ${round(pushGap)} mm）`);
  const folFrontEmpty = folBox.max.x + pitch * meshes.length;
  need(Math.abs(folFrontEmpty - AXIS) <= 2, `空匣推钉板前沿进入击发窗（${round(folFrontEmpty)} ≈ ${AXIS}）`);

  /* ---------- 3. 刀尖：不扎当前钉头、不撞相邻钉头、到底不碰木板 ---------- */
  const piston = part('piston');
  let blade = null;
  piston.obj.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== 'BoxGeometry') return;
    const b = boxOf(o);
    if (!blade || b.min.y < blade.b.min.y) blade = { o, b };
  });
  const head0 = boxOf(meshes[0].children[2]);
  const head1 = boxOf(meshes[1].children[2]);

  const restY = blade.b.min.y - head0.max.y;
  need(restY >= 0, `静止时刀尖停在当前钉头上方（间隙 ${round(restY)} mm）`);
  const nearGap = gapX(blade.b, head1);
  need(nearGap >= 0.05, `刀尖不撞相邻钉头（间隙 ${round(nearGap)} mm）`);

  const BOARD_TOP = -54, STROKE = 41.7;
  const bladeFired = blade.b.min.y - STROKE;
  need(bladeFired - BOARD_TOP >= 0.5, `击发到底刀尖不碰木板（余 ${round(bladeFired - BOARD_TOP)} mm）`);

  const headW = round(head0.max.x - head0.min.x), headD = round(head0.max.z - head0.min.z);
  const bladeW = round(blade.b.max.x - blade.b.min.x);
  console.log(`钉条 ${meshes.length} 支 · 钉距 ${round(pitch)} mm · 钉头 ${headW}×${headD} · 刀尖宽 ${bladeW} mm`);
  console.log(`刀尖↔当前钉头 ${round(restY)} mm · 刀尖↔相邻钉头 ${round(nearGap)} mm · 到底离木板 ${round(bladeFired - BOARD_TOP)} mm`);
  console.log(`推钉板顶面 ${round(folBox.max.x)} → 空匣前沿 ${round(folFrontEmpty)}（尾段外露 ${round(MAG_TAIL - folBox.min.x)} mm，真机由外套管包住）`);
});
