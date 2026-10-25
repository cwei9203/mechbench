/* 气钉枪 · 无浏览器断言（node tools/verify.mjs nail-gun-lab）
 * 重点：两段式顺序击发（不压鼻端扣不动、不扣扳机打不响）、空匣锁定、卡钉清障、深度三档。
 */
export default function (t, { createGame, MANIFEST, MODEL }) {
  const placeChapter = (g) => {
    let n = 0;
    while (g.state.phase === 'build' && n++ < 20) {
      const m = g.current();
      if (!m) break;
      g.select(m.id);
      g.place(true);
    }
    return n;
  };

  /* ---- 1. 主板与两段保险（第 2 关实验，还没有钉条） ---- */
  const g = createGame();
  t.eq(g.NAILS, MODEL.NAILS, `钉条支数与模型一致（${g.NAILS}）`);
  t.ok(!g.fire().ok, '装配阶段不能击发');
  placeChapter(g);
  t.ok(g.experiment().ok, '第 1 关做完实验');
  g.answer(MANIFEST.chapters[0].a);
  g.next();
  placeChapter(g);                                   // 第 2 关：接气 / 压鼻端 / 扣扳机
  t.eq(g.state.phase, 'experiment', '第 2 关装完进入实验');
  t.ok(!g.demoAir().ok === false, '实验里可以接气');
  t.eq(g.state.air, true, '气源已接通');
  const noTrip = g.demoTrigger();
  t.ok(!noTrip.ok && noTrip.kind === 'blocked', '没压鼻端时扳机扣不动（第一道保险）');
  t.ok(g.demoTrip().ok, '压住鼻端触压板');
  t.eq(g.state.trip, 1, '鼻端已压紧');
  const noNails = g.demoTrigger();
  t.ok(!noNails.ok && noNails.kind === 'blocked', '气通了、鼻端压了，但没钉条仍不击发');

  /* ---- 2. 自由实验：击发一次 ---- */
  const g2 = createGame();
  g2.freeview();
  t.eq(g2.state.phase, 'lab', '自由实验阶段');
  t.eq(g2.state.placed.length, MANIFEST.modules.length, '一键满装');
  t.ok(!g2.fire().ok, '没接气不能击发');
  t.ok(g2.setAir().ok, '接气');
  t.ok(!g2.fire().ok, '没压鼻端不能击发');
  t.ok(g2.setTrip().ok, '压鼻端');
  t.ok(!g2.fire().ok, '没扣扳机不能击发');
  t.ok(g2.setTrigger().ok, '扣住扳机');
  const shot = g2.fire();
  t.ok(shot.ok && shot.kind === 'fired', '条件齐了才击发');
  t.eq(g2.state.fired, 1, '击发计数 +1');
  t.eq(g2.state.nails, g2.NAILS - 1, '钉条少一支');

  /* ---- 3. 卡钉：击发中止，重装清障 ---- */
  t.ok(g2.injectJam().ok, '制造一根弯钉');
  const jammed = g2.fire();
  t.ok(jammed.kind === 'jamstop', '卡钉后击发中止');
  t.ok(g2.reload().ok, '重装钉条清障');
  t.eq(g2.state.jam, false, '卡钉已清除');
  t.eq(g2.state.nails, g2.NAILS, '钉条重新装满');
  t.eq(g2.state.fired, 0, '击发记录清零');

  /* ---- 4. 打空：锁定空击 ---- */
  let guard = 0;
  while (g2.state.nails > 0 && guard++ < 200) g2.fire();
  t.eq(g2.state.nails, 0, '把钉条打空');
  t.eq(g2.state.fired, g2.NAILS, '每次击发只消耗一支钉');
  const empty = g2.fire();
  t.ok(empty.kind === 'lockout', '空匣锁定空击');

  /* ---- 5. 深度三档循环 ---- */
  const depths = [];
  for (let i = 0; i < 3; i++) { g2.cycleDepth(); depths.push(g2.state.depth); }
  t.eq(new Set(depths).size, 3, `深度三档都走到了（${depths.join('/')}）`);
  t.eq(g2.state.depth, 0, '三档之后回到中档');

  /* ---- 6. 几何与状态同源 ---- */
  MODEL.applyMotion({ cut: false, speed: 1, clock: 0 }, g2.state);
  t.ok(Number.isFinite(g2.state.nails), 'applyMotion 后状态量仍有效');
}
