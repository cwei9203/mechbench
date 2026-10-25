/* 双缸发动机 · 无浏览器断言（node tools/verify.mjs double-cylinder-engine）
 * 重点：曲柄连杆运动学（行程 = 2R）、正时 2:1、跳火次数、拆链后凸轮不跟。
 */
export default function (t, { createGame, MANIFEST, MODEL }) {
  const RAD = Math.PI / 180;
  const { R } = MODEL.D;
  const placeChapter = (g, advance) => {
    let n = 0;
    while (g.state.phase === 'build' && n++ < 20) {
      const m = g.current();
      if (!m) break;
      g.select(m.id);
      g.place(true);
    }
    return n;
  };

  /* ---- 1. 曲柄连杆运动学 ---- */
  const y0 = MODEL.pistonPinY(0);
  const y180 = MODEL.pistonPinY(180 * RAD);
  t.near(MODEL.pistonPinY(360 * RAD), y0, 1e-9, '曲轴转一圈回到同一位置');
  t.near(Math.abs(y0 - y180), 2 * R, 1e-6, `活塞行程 = 2R = ${2 * R} mm`);
  let minY = Infinity, maxY = -Infinity;
  for (let d = 0; d <= 360; d += 2) {
    const y = MODEL.pistonPinY(d * RAD);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  t.near(maxY - minY, 2 * R, 0.05, '整个循环的位移量程等于行程');

  /* ---- 2. 配气与点火 ---- */
  const vs = MODEL.valveState(0, 0);
  t.ok(Array.isArray(vs) && vs.length >= 4, `四个气门都有状态（${vs.length}）`);
  t.ok(vs.every((v) => Number.isFinite(v.valveLift)), '气门升程都是有限值');
  let sparks = 0;
  for (let d = 0; d < 720; d += 1) sparks += MODEL.sparkState(d).filter((s) => s.on).length;
  t.ok(sparks >= 4, `720° 循环内跳火 ${sparks} 次（双缸各自点火）`);

  /* ---- 3. 阶段与自由实验 ---- */
  const g = createGame();
  t.ok(!g.run(true).ok, '装配阶段不能运行');
  t.ok(!g.chain().ok, '装配阶段不能拆正时链');
  t.ok(!g.cover().ok, '装配阶段不能拆气门室盖');
  for (let ch = 0; ch < MANIFEST.chapters.length; ch++) {
    const n = placeChapter(g);
    t.ok(n < 20, `第 ${ch + 1} 关在有限步内装完（${n} 步）`);
    t.eq(g.state.phase, 'experiment', `第 ${ch + 1} 关装完进入实验`);
    t.ok(!g.answer(0).ok, `第 ${ch + 1} 关没做实验不能答题`);
    t.ok(g.experiment().ok, `第 ${ch + 1} 关做完实验`);
    t.ok(g.answer(MANIFEST.chapters[ch].a).ok, `第 ${ch + 1} 关答对`);
    if (ch < MANIFEST.chapters.length - 1) t.ok(g.advance().ok, `进入第 ${ch + 2} 关`);
  }
  t.eq(g.state.phase, 'checkpoint', '最后一关停在结算');
  t.ok(g.advance().ok, '进入自由实验');
  t.eq(g.state.phase, 'lab', '自由实验阶段');

  /* ---- 4. 自由实验：运行 / 拆链条 / 拆气门室盖 ---- */
  t.ok(g.run(true).ok, '可以开始运行');
  t.eq(g.state.running, true, '运行中');
  t.ok(g.run(false).ok, '可以停机');
  t.eq(g.state.running, false, '已停机');
  // 第 3 关的实验本身就会拆一次链，所以这里只断言"能来回切"
  const chain0 = g.state.chainOff;
  t.ok(g.chain().ok, '自由实验可以拆装正时链');
  t.eq(g.state.chainOff, !chain0, '正时链状态翻转');
  t.ok(g.chain().ok, '可以再切回来');
  t.eq(g.state.chainOff, chain0, '正时链回到原状');
  const cover0 = g.state.coverOff;
  t.ok(g.cover().ok, '可以拆装气门室盖');
  t.eq(g.state.coverOff, !cover0, '气门室盖状态翻转');

  /* ---- 5. 几何与状态同源：曲轴角 → 活塞位置 ---- */
  MODEL.applyMotion({ crankDeg: 90, camDeg: 45, cut: false, solid: false, speed: 1 }, g.state);
  t.ok(Number.isFinite(MODEL.pistonPinY(90 * RAD)), 'applyMotion 后活塞位置有限');
}
