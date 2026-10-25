/* 注射笔 · 无浏览器断言（node tools/verify.mjs injection-pen）
 * 只碰 logic + model 的状态量，不碰 DOM、不开浏览器。覆盖三关的主线 + 几条最容易讲错的因果。
 */
export default function (t, { createGame, MANIFEST, MODEL }) {
  const PEN = MODEL.PEN;
  const A = (i) => MANIFEST.chapters[i].a;                       // 每关正确答案
  // logic 只管状态量；几何由渲染循环里的 applyMotion 驱动，node 里要自己推一帧
  const VIEW = { crankDeg: 0, camDeg: 0, speed: 1, running: false, cut: false, solid: false, clock: 0 };
  const settle = (g, n = 400, dt = 0.05) => { for (let i = 0; i < n; i++) g.update(dt); MODEL.applyMotion(VIEW, g.state); };
  const screwX = () => MODEL.byKey.get('screw').obj.position.x;   // 丝杠的真实几何位移

  /* ---- 1. 装配顺序与失败不动状态 ---- */
  const g = createGame();
  t.eq(g.state.chapter, 0, '初始在第 1 关');
  t.eq(g.state.phase, 'build', '初始在装配阶段');
  t.eq(g.state.placed.length, 0, '初始没有已装模块');
  t.ok(!g.select('dial').ok, '第 1 关选不到第 2 关的模块');
  t.ok(!g.place(true).ok, '没选中时「装入」失败');
  t.eq(g.state.placed.length, 0, '失败操作没有留下已装件');

  t.ok(g.select('cart').ok, '能选中药筒组件');
  t.ok(g.place(true).ok, '药筒组件装入');
  t.eq(g.state.placed.join(','), 'cart', 'placed 只有 cart');
  t.ok(!g.place(true).ok, '重复装入失败');
  t.eq(g.state.placed.length, 1, '重复装入没有多出零件');
  t.ok(!g.place(false).ok, '拖歪了（onTarget=false）不算装上');
  t.ok(g.undo().ok, '能撤回');
  t.eq(g.state.placed.length, 0, '撤回后回到空');

  const placeAll = (g2, ids) => { for (const id of ids) { g2.select(id); g2.place(true); } };
  placeAll(g, ['cart', 'bung', 'hub']);
  t.eq(g.state.phase, 'experiment', '第 1 关装完进入实验阶段');

  /* ---- 2. 关卡推进：实验 → 答题 → 徽章 → 下一关 ---- */
  t.ok(!g.answer(0).ok, '没做实验不能答题');
  t.ok(g.experiment().ok, '做完实验');
  t.eq(g.state.phase, 'quiz', '进入答题阶段');
  t.ok(!g.answer(A(0) === 0 ? 1 : 0).ok, '答错返回 ok:false');
  t.eq(g.state.completed[0], false, '答错不给徽章');
  t.ok(g.answer(A(0)).ok, '答对');
  t.eq(g.state.completed[0], true, '答对得徽章');
  t.ok(g.next().ok, '进入下一关');
  t.eq(g.state.chapter, 1, '章号前进到第 2 关');
  t.eq(g.state.phase, 'build', '新一关回到装配阶段');
  t.ok(!g.next().ok, '没完成就不能跳关');

  /* ---- 3. 核心因果：拨剂量时活塞一动不动 ---- */
  placeAll(g, ['scale', 'spring', 'drive', 'screw', 'dial']);
  t.eq(g.state.phase, 'experiment', '第 2 关装完');
  t.eq(Math.round(1 / PEN.clickMg), 8, '一格 0.125 mg → 1.0 mg 拨 8 格');
  t.eq(g.state.windMg, 0, '未拨前扭簧零储能');
  const stroke0 = screwX();
  t.ok(g.dialTo(1.0).ok, '拨满 1.0 mg');
  settle(g);
  t.near(g.state.windMg, 1.0, 1e-6, '拨满后 windMg = 1.0 mg');
  t.eq(g.state.delivered, 0, '拨剂量时 delivered 仍是 0');
  t.near(screwX() - stroke0, 0, 1e-9, '拨剂量时丝杠几何位移 = 0（活塞不动）');
  t.ok(!g.inject().ok, '药筒/传动链这段不能注射');
  t.eq(g.state.delivered, 0, '失败的注射没有推进活塞');

  /* ---- 4. 拔帽顺序：内帽必须先拔外帽 ---- */
  g.experiment();
  g.answer(A(1));
  t.ok(g.next().ok, '进入第 3 关');
  placeAll(g, ['button', 'body', 'needle', 'caps']);
  t.eq(g.state.phase, 'experiment', '第 3 关装完');
  t.ok(!g.uncapInner().ok, '外帽还盖着时拔不掉内帽');
  t.ok(g.uncapOuter().ok, '拔外帽');
  settle(g, 20);
  t.ok(g.uncapInner().ok, '拔内帽');
  settle(g, 20);
  t.ok(g.unmountNeedle().ok, '能把针头拧下来');
  settle(g, 20);
  t.ok(!g.inject().ok, '没装针头时打不出去');
  t.ok(g.mountNeedle().ok, '把针头拧回针座');
  settle(g, 20);

  /* ---- 5. 松闸之后：剂量 → 丝杠位移 → 活塞行程，读数与几何同源 ---- */
  t.ok(g.dialTo(1.0).ok, '第 3 关拨 1.0 mg');
  settle(g);
  const before = g.state.delivered;
  t.ok(g.inject().ok, '按下按钮松闸');
  settle(g);
  t.near(g.state.delivered - before, 1.0, 1e-3, '打完 1.0 mg');
  t.eq(g.state.windMg, 0, '扭簧回零');
  t.near(screwX(), PEN.strokePerMg * g.state.delivered, 1e-6, '丝杠几何位移 = 读数行程（同源）');
  t.near(PEN.strokePerMg * g.state.delivered, 2.82, 1e-2, '1.0 mg → 活塞前进 2.82 mm');

  /* ---- 6. 旋钮在 0 时按钮锁死；打满会拒绝 ---- */
  const g2 = createGame();
  g2.demo();
  t.eq(g2.state.phase, 'lab', '自由实验阶段');
  t.eq(g2.state.placed.length, MANIFEST.modules.length, '自由实验一键满装');
  g2.uncapOuter(); g2.uncapInner(); settle(g2, 20);
  t.ok(!g2.inject().ok, '旋钮在 0 时按钮压不动');
  t.eq(g2.state.delivered, 0, '锁死时没有药液流失');

  let rounds = 0;
  while (rounds++ < 20) {
    if (!g2.dialTo(1.0).ok) break;
    settle(g2, 20);            // 等扭簧上弦（拨剂量是动画，windMg 追 targetMg）
    if (!g2.inject().ok) break;
    settle(g2);                // 等这一针打完
  }
  t.ok(rounds < 20, '药量不足时会拒绝继续拨剂量');
  t.ok(g2.state.delivered <= PEN.totalMg + 1e-6, 'delivered 不超过总药量');
  t.near(g2.state.delivered, PEN.totalMg, 0.05, '打满约 10 mg（2 mL @ 5 mg/mL）');
}
