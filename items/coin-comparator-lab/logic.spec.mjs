/* 比较式投币器 · 行为断言（node 直接跑，毫秒级）
 * 规则：装配顺序 / 比较门限 / 厚度门 / 退币 / 灵敏度 / 换样币 / 断电 fail-safe。
 */
export default (t, { createGame, MANIFEST, MODEL }) => {
  const COINS = MODEL.COINS;
  const ST = MODEL.STATIONS;
  const modules = MANIFEST.modules;
  const placeAll = (g) => {
    let guard = 0;
    while (g.current() && guard++ < 20) {
      const m = g.current();
      const r = g.select(m.id);
      t.ok(r.ok, `选中 ${m.id}`);
      const p = g.place(true);
      t.ok(p.ok, `装好 ${m.id}`);
    }
  };
  const run = (g, n = 26, dt = .05) => { for (let i = 0; i < n; i++) g.advance(dt); };
  const settle = (g, max = 120) => { let n = 0; while (g.state.coin && !String(g.state.coin.stage).startsWith('done-') && n++ < max) g.advance(.05); return g.state.coin; };
  const outcome = (g) => g.state.coin && g.state.coin.stage;

  /* ---------- 1. 结构与初始状态 ---------- */
  {
    const g = createGame(), s = g.state;
    t.eq(MANIFEST.chapters.length, 3, '三关');
    t.eq(modules.length, 12, '12 块模块');
    t.eq(new Set(modules.flatMap((m) => m.parts)).size, 14, '14 件教学零件');
    t.eq(s.phase, 'build', '初始在装配阶段');
    t.eq(s.placed.length, 0, '初始未装模块');
    t.eq(g.current().id, 'base', '第一步是底板');
    t.ok(!g.place(true).ok, '没选模块不能装');
    t.ok(!g.select('coil').ok, '跨章节选模块被拒');
    t.ok(g.select('base').ok && g.place(true).ok, '底板可装');
    t.eq(s.placed.length, 1, '底板已装');
    t.ok(g.undo().ok, '可撤回底板');
    t.eq(s.placed.length, 0, '撤回后归零');
  }

  /* ---------- 2. 三关顺序：装完 → 实验 → 答错保留 → 答对 → 下一关 ---------- */
  {
    const g = createGame(), s = g.state;
    for (let ch = 0; ch < 3; ch++) {
      placeAll(g);
      t.eq(s.phase, 'experiment', `第 ${ch + 1} 关装完进入实验`);
      t.ok(g.experiment().ok, `第 ${ch + 1} 关进入答题`);
      t.eq(s.phase, 'quiz', `第 ${ch + 1} 关在答题`);
      const wrong = g.answer(1);
      t.ok(!wrong.ok, `第 ${ch + 1} 关答错被拒`);
      t.eq(s.phase, 'quiz', '答错保留答题状态');
      t.ok(g.answer(0).ok, `第 ${ch + 1} 关答对`);
      t.eq(s.phase, 'checkpoint', `第 ${ch + 1} 关拿徽章`);
      t.ok(g.next().ok, `第 ${ch + 1} 关进入下一段`);
    }
    t.eq(s.phase, 'lab', '三关走完进入自由实验室');
    t.eq(s.placed.length, 12, '自由实验室整机 12 模块');
  }

  /* ---------- 3. 比较公式：差值 / 门限 / 灵敏度 ---------- */
  {
    const g = createGame(), s = g.state;
    g.freeview();
    t.eq(s.phase, 'lab', 'freeview 进入 lab');
    t.eq(s.placed.length, 12, 'freeview 满装');
    t.eq(s.sample, 'yuan', '默认样币 1 元');
    t.eq(s.sensitivity, 6, '默认灵敏度 6');
    t.eq(s.threshold, 46, '默认门限 46');
    const yuan = g.compare('yuan'), jiao = g.compare('jiao'), fake = g.compare('fake');
    t.eq(yuan.verdict, 'pass', '1 元对 1 元合格');
    t.near(yuan.diff, 0, .01, '1 元差值 0');
    t.eq(jiao.verdict, 'fail', '5 角对 1 元不合格');
    t.near(jiao.diff, 67, .2, '5 角直径差 4.5×14 + 厚度差 4 = 67');
    t.eq(fake.verdict, 'fail', '铜章同径异材不合格');
    t.near(fake.diff, 53, .2, '铜章材质差 52 + 厚度 1 = 53');
    t.eq(g.setSensitivity(2).ok, true, '灵敏度可调');
    t.eq(s.threshold, 82, '灵敏度 2 → 门限 82');
    t.eq(g.compare('fake').verdict, 'pass', '松门限下铜章能过');
    g.setSensitivity(9);
    t.eq(s.threshold, 19, '灵敏度 9 → 门限 19');
    t.eq(g.compare('fake').verdict, 'fail', '严门限下铜章被拒');
    g.setSensitivity(6);
    t.eq(g.compare('washer').verdict, 'fail', '厚垫圈材质/厚度差都超门限（先被厚度门挡住）');
    t.near(g.compare('washer').diff, 65, .3, '厚垫圈差值 27+38=65');
    t.eq(COINS.yuan.d, 25.0, '1 元 Ø25.0');
    t.eq(COINS.jiao.d, 20.5, '5 角 Ø20.5');
    t.ok(COINS.washer.t > MODEL.GATE_MAX_T, '厚垫圈 3.2 厚于厚度门 2.6');
    t.ok(COINS.yuan.t < MODEL.GATE_MAX_T, '1 元 1.85 薄于厚度门');
  }

  /* ---------- 4. 投币全链路：合格 → 接受 + 计数；不合格 → 退回 ---------- */
  {
    const g = createGame(), s = g.state;
    g.freeview();
    t.ok(g.insert('yuan').ok, '投入 1 元');
    run(g, 16);
    t.eq(s.verdict, 'pass', '到线圈后判定合格');
    t.ok(s.gate > .8, '电磁铁把活门拉到接受位');
    settle(g);
    run(g, 6);
    t.eq(outcome(g), 'done-accepted', '1 元落进接币盒');
    t.eq(s.acceptCount, 1, '接受计数 +1');
    t.eq(s.gate, 0, '币过后弹簧把活门送回退币位');
    t.ok(g.insert('jiao').ok, '再投 5 角');
    settle(g);
    t.eq(s.verdict, 'fail', '5 角判定不合格');
    t.eq(outcome(g), 'done-rejected', '5 角被活门挡进退币杯');
    t.eq(s.acceptCount, 1, '拒绝不增加计数');
    t.eq(s.rejectCount, 1, '拒绝计数 +1');
  }

  /* ---------- 5. 厚度门：物理阻挡 + 退币推杆 ---------- */
  {
    const g = createGame(), s = g.state;
    g.freeview();
    g.insert('washer');
    run(g, 8);
    t.eq(outcome(g), 'blocked', '厚垫圈被厚度门挡住');
    t.ok(s.coin.t < ST.block && s.coin.t > ST.stop - .01, `停在厚度门前，没穿进夹板（${s.coin.t.toFixed(3)} < ${ST.block}）`);
    t.ok(!g.insert('yuan').ok, '卡币未退时不能再投');
    t.ok(g.pressReturn().ok, '按退币可推回');
    run(g, 24);
    t.eq(outcome(g), 'done-returned', '卡币被推进退币杯');
    t.eq(s.returnCount, 1, '退币计数 +1');
    t.eq(s.acceptCount, 0, '退币不计数');
    t.ok(g.insert('yuan').ok, '退币后可以重新投');
  }

  /* ---------- 6. 换样币：参考换了，判定跟着换 ---------- */
  {
    const g = createGame(), s = g.state;
    g.freeview();
    t.ok(g.setSample('token').ok, '样币换成游戏币');
    t.eq(s.sample, 'token', '样币状态是游戏币');
    t.eq(g.compare('token').verdict, 'pass', '游戏币对游戏币样币合格');
    t.eq(g.compare('yuan').verdict, 'fail', '1 元对游戏币样币不合格');
    g.insert('token');
    settle(g);
    t.eq(s.acceptCount, 1, '游戏币被接受');
    g.setSample('yuan');
    t.eq(g.compare('yuan').verdict, 'pass', '换回 1 元样币后 1 元又合格');
  }

  /* ---------- 7. 断电 fail-safe ---------- */
  {
    const g = createGame(), s = g.state;
    g.freeview();
    t.ok(g.setPower(false).ok, '可以断开电源');
    t.eq(g.compare('yuan').verdict, 'off', '断电后比较器不工作');
    g.insert('yuan');
    settle(g);
    t.eq(s.verdict, 'off', '断电判定为 off');
    t.eq(outcome(g), 'done-rejected', '断电时真币也退回');
    t.eq(s.acceptCount, 0, '断电不计数');
    t.eq(s.gate, 0, '断电活门在退币位');
    g.setPower(true);
    g.insert('yuan');
    settle(g);
    t.eq(s.acceptCount, 1, '恢复供电后真币接受');
  }


  /* ---------- 9. 关卡限定的币种与文案控件一一对应 ---------- */
  {
    const g = createGame();
    placeAll(g);
    t.ok(!g.insert('jiao').ok, '第一关只让投 1 元 / 厚垫圈，5 角被挡在面板外');
    t.ok(g.insert('washer').ok, '第一关能投厚垫圈');
    const g2 = createGame();
    placeAll(g2); g2.experiment(); g2.answer(0); g2.next();
    placeAll(g2);
    t.ok(g2.insert('token').ok, '第二关面板上的「投游戏币」真的能投');
  }

  /* ---------- 8. 缺陷门控：比较头没装时不能调/投 ---------- */
  {
    const g = createGame(), s = g.state;
    t.ok(!g.setSensitivity(5).ok, '没装比较器板不能调灵敏度');
    t.ok(!g.setPower(false).ok, '没装比较器板不能断电');
    t.ok(!g.insert('yuan').ok, '币道没装不能投币');
    t.ok(!g.pressReturn().ok, '未装配不能按退币');
  }
  // 调参不能改写正在执行的判定，失败操作保持完整状态。
  {
    const g = createGame(), s = g.state;
    g.freeview();
    const initial = JSON.stringify(s);
    [NaN, Infinity, 'invalid'].forEach((value) => {
      t.ok(!g.setSensitivity(value).ok, '拒绝无效灵敏度');
      t.eq(JSON.stringify(s), initial, '无效灵敏度不改变状态');
    });
    g.setSensitivity(2);
    g.insert('fake');
    run(g, 16);
    t.eq(s.verdict, 'pass', '铜章已按松门限判为合格');
    const rolling = JSON.stringify(s);
    t.ok(!g.setSensitivity(9).ok, '币未落定时拒绝改门限');
    t.eq(JSON.stringify(s), rolling, '拒绝调参不改变判定或门限');
    run(g, 11);
    t.eq(s.coin.stage, 'accepted', '币已过分选口');
    const accepted = JSON.stringify(s);
    t.ok(!g.pressReturn().ok, '已过分选口不能退币');
    t.eq(JSON.stringify(s), accepted, '失败退币不改变按钮或币状态');
    settle(g);
    t.ok(g.setSensitivity(9).ok, '币落定后可以改门限');
    t.eq(s.verdict, null, '调参清除旧比较结果');
    t.eq(s.diff, null, '调参清除旧差值');
    g.insert('fake');
    settle(g);
    t.eq(s.coin.stage, 'done-rejected', '下一枚铜章按新门限拒绝');
  }

};
