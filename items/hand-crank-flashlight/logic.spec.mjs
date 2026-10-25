/* 手摇手电筒 · 无浏览器断言（node tools/verify.mjs hand-crank-flashlight）
 * 重点：16:1 增速、充电/放电速率、开关与回路的耦合。全是可以算准的数，不用开浏览器。
 */
export default function (t, { createGame, MANIFEST, MODEL }) {
  const RATIO = 16;                                  // 摇 1 圈 → 转子 16 圈
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

  /* ---- 1. 装配顺序 ---- */
  const g = createGame();
  t.eq(g.state.chapter, 0, '初始在第 1 关');
  t.eq(g.state.phase, 'build', '初始在装配阶段');
  t.ok(!g.crank(1, 0.1).ok, '传动链没装好时摇不动');
  t.eq(g.state.crankTurns, 0, '失败的摇动没有累计圈数');
  const n0 = placeChapter(g);
  t.ok(n0 < 20, `第 1 关装配能在有限步内结束（${n0} 步）`);
  t.eq(g.state.phase, 'experiment', '第 1 关装完进入实验阶段');

  /* ---- 2. 16:1 增速（此时传动链闭合、回路还没接） ---- */
  t.eq(g.chainReady(), true, '第 1 关装完传动链闭合');
  t.eq(g.circuitReady(), false, '此时回路还没接通');
  const r = g.crank(1, 0.1);
  t.ok(r.ok, '传动链闭合后能摇');
  t.near(r.genTurns, RATIO, 1e-9, `摇 1 圈 → 转子 ${RATIO} 圈（增速比）`);
  t.near(r.turns, 1, 1e-9, '摇柄圈数如实累计');
  t.eq(g.state.charge, 0, '回路断开时摇动不给电容充电（只转不充）');

  /* ---- 3. 关卡推进 ---- */
  t.ok(!g.answer(0).ok, '没做实验不能答题');
  t.ok(g.experiment().ok, '做完第 1 关实验');
  t.eq(g.state.phase, 'quiz', '进入答题');
  t.ok(g.answer(MANIFEST.chapters[0].a).ok, '答对第 1 关');
  t.eq(g.state.completed[0], true, '拿到第 1 枚徽章');
  t.ok(g.next().ok, '进入第 2 关');
  t.eq(g.state.chapter, 1, '章号前进');
  t.ok(!g.crank(1, 0.1).ok, '第 2 关还在装配时不摇动');
  placeChapter(g);                                   // 把第 2 关装完（电路接通）
  t.eq(g.circuitReady(), true, '第 2 关装完回路接通');

  /* ---- 4. 回路接通后按速率充电 ---- */
  const before = g.state.charge;
  g.crank(1.5, 1);                                   // 满速（1.5 圈/秒）摇 1 秒
  t.near(g.state.charge - before, 0.95, 1e-6, '满速摇 1 秒充入 0.95');

  /* ---- 6. 放电：开关合上比断开快 ---- */
  // update() 每帧把 dt 截到 0.1 秒，所以 1 秒要分 10 帧
  const drain = (on) => {
    g.state.charge = 0.6;
    g.state.switchOn = on;
    g.state.handActive = 0;                          // 跳过摇动后的 0.18s 宽限
    for (let i = 0; i < 10; i++) g.update(0.1);
    return 0.6 - g.state.charge;
  };
  const off = drain(false), on = drain(true);
  t.near(off, 0.02, 1e-6, '开关断开时每秒漏 0.02');
  t.near(on, 0.16, 1e-6, '开关合上时每秒放 0.16（约 6 秒余辉）');
  t.ok(on > off * 5, '合上开关放电明显更快');

  /* ---- 7. 亮度与电压 ---- */
  g.state.charge = 0.54;
  g.state.switchOn = true;
  t.near(g.brightness(), 1, 1e-6, '电满时亮度封顶 1');
  g.state.charge = 0.29;
  t.near(g.brightness(), 0.5, 1e-6, '电荷 0.29 时亮度约一半');
  g.state.switchOn = false;
  t.eq(g.brightness(), 0, '开关断开时灯不亮（哪怕电容有电）');
  t.near(g.voltage(), 2.0 + 1.6 * 0.29, 1e-9, '电压随电荷线性上升');

  /* ---- 8. 电容不会过充；撤回到断链时清零 ---- */
  g.state.switchOn = true;
  for (let i = 0; i < 40; i++) g.crank(1.5, 1);
  t.ok(g.state.charge <= 1, `反复摇动电荷不超过 1（${g.state.charge}）`);
  t.near(g.state.charge, 1, 1e-9, '摇够时间后电容充满');

  /* ---- 9. 自由实验一键满装 ---- */
  const g2 = createGame();
  g2.demo();
  t.eq(g2.state.phase, 'lab', '自由实验阶段');
  t.eq(g2.state.placed.length, MANIFEST.modules.length, '一键满装全部模块');
  t.eq(g2.chainReady(), true, '满装后传动链闭合');
  t.eq(g2.circuitReady(), true, '满装后回路接通');

  /* ---- 10. 几何侧：几何用的也是同一个 charge / crankTurns ---- */
  MODEL.applyMotion({ angle: 0, crankDeg: 0, light: 0, cut: false, solid: false, clock: 0 }, g2.state);
  t.ok(Number.isFinite(g2.state.charge), 'applyMotion 后状态量仍有限');
}
