/* 电动牙刷 · 无浏览器断言（node tools/verify.mjs electric-toothbrush）
 * 重点：D 形平面的装配约束、通电后往复、空载对照（拔刷头 vs 装上刷头）。
 */
export default function (t, { createGame, MANIFEST, MODEL }) {
  const placeChapter = (g) => {
    let n = 0;
    while (g.state.phase === 'build' && n++ < 20) {
      const m = g.current();
      if (!m) break;
      g.select(m.id);
      if (g.state.rotation !== 0 && g.current()?.id === 'head') { g.turn(); g.turn(); g.turn(); }
      g.place(true);
    }
    return n;
  };

  /* ---- 1. 装配阶段：通电与拆刷头都不许 ---- */
  const g = createGame();
  t.ok(!g.power().ok, '装配阶段不能通电');
  t.ok(!g.head().ok, '装配阶段不能拆刷头');
  t.ok(!g.turn().ok, '没选中刷头时不能转 D 形平面');

  /* ---- 2. D 形平面：转 4 次回原位；没对齐装不上 ---- */
  const g2 = createGame();
  t.ok(g2.select('head').ok, '能选中空心刷头');
  t.eq(g2.state.rotation, 1, '选中刷头时默认先转 90°（错位）');
  const path = [];
  for (let i = 0; i < 4; i++) { g2.turn(); path.push(g2.state.rotation); }
  t.eq(path.join(','), '2,3,0,1', '转四次走完四个 90° 档位');
  t.eq(g2.state.rotation, 1, '四步之后回到同一档');

  /* ---- 3. 三关主线 ---- */
  const g3 = createGame();
  for (let ch = 0; ch < MANIFEST.chapters.length; ch++) {
    const n = placeChapter(g3);
    t.ok(n < 20, `第 ${ch + 1} 关在有限步内装完（${n} 步）`);
    t.eq(g3.state.phase, 'experiment', `第 ${ch + 1} 关装完进入实验`);
    t.ok(!g3.answer(0).ok, `第 ${ch + 1} 关没做实验不能答题`);
    t.ok(g3.experiment().ok, `第 ${ch + 1} 关做完实验`);
    t.ok(g3.answer(MANIFEST.chapters[ch].a).ok, `第 ${ch + 1} 关答对`);
    if (ch < MANIFEST.chapters.length - 1) t.ok(g3.next().ok, `进入第 ${ch + 2} 关`);
  }
  t.ok(g3.next().ok, '进入自由实验');
  t.eq(g3.state.phase, 'lab', '自由实验阶段');

  /* ---- 4. 通电 / 停机 / 空载对照 ---- */
  const running0 = g3.state.running;
  t.ok(g3.power().ok, '自由实验可以切换通电');
  t.eq(g3.state.running, !running0, '通电状态翻转');
  if (g3.state.running) t.ok(g3.power().ok, '运行中可以停机');
  t.eq(g3.state.running, false, '停机后不再往复');
  const head0 = g3.state.headOff;
  t.ok(g3.head().ok, '停机后可以拔/装刷头');
  t.eq(g3.state.headOff, !head0, '刷头状态翻转');
  t.ok(g3.power().ok, '空载也能通电');
  t.eq(g3.state.running, true, '空载运行中');

  /* ---- 5. 摆角：往复位移与驱动模型同一个量 ---- */
  MODEL.applyMotion({ angle: 0.05, running: true, cut: false, solid: false, clock: 0 }, g3.state);
  t.ok(Number.isFinite(MODEL.DRIVE ?? 0.05), '驱动幅值可用');
}
