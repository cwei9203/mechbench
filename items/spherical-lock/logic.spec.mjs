/* 球形门锁 · 无浏览器断言（node tools/verify.mjs spherical-lock）
 * 重点：内外执手的分工（离合）、错钥匙插得进转不动、锁舌回缩量由同一个 boltRetract 决定。
 */
export default function (t, { createGame, MANIFEST, MODEL }) {
  const THROW = MODEL.THROW;

  /* ---- 1. 装配前的连锁否定 ---- */
  const g = createGame();
  t.eq(g.state.locked, true, '初始是锁定状态');
  t.ok(!g.knob('in', 90).ok, '内执手没装时转不动');
  t.ok(!g.pushBolt().ok, '锁舌组件没装时按不动');
  t.ok(!g.insertKey('right').ok, '钥匙没装时插不了');

  /* ---- 2. 一键满装 ---- */
  g.demo();
  t.eq(g.state.phase, 'lab', '自由实验阶段');
  t.eq(g.state.placed.length, MANIFEST.modules.length, '一键满装');

  /* ---- 3. 内执手：直接带动方轴，锁舌回缩到行程 ---- */
  const inner = g.knob('in', 90);
  t.ok(inner.ok, '内执手能转');
  t.eq(inner.engaged, true, '内执手始终接通离合');
  t.near(g.state.spindle, 90, 1e-9, '方轴转过 90°');
  t.near(inner.pull, THROW, 0.05, `锁舌回缩到行程 ${THROW} mm`);
  t.near(MODEL.boltPull(g.state, { cut: false }), inner.pull, 1e-6, '读数与几何用同一个 boltRetract');
  g.knob('in', 0);
  t.near(g.state.spindle, 0, 1e-9, '内执手松开，方轴回零');

  /* ---- 4. 锁定时外执手空转 ---- */
  const out = g.knob('out', 90);
  t.ok(out.ok, '外执手可以转');
  t.eq(out.engaged, false, '锁定时外执手与方轴断开');
  t.eq(g.state.spindle, 0, '空转时方轴不动（防撬的关键）');
  g.knob('out', 0);

  /* ---- 5. 错钥匙：插得进，转不动 ---- */
  t.ok(g.insertKey('wrong').ok, '错钥匙插得进去');
  const jammed = g.turnKey(90);
  t.ok(!jammed.ok && jammed.kind === 'blocked', '错钥匙转不动（弹子跨剪切线）');
  t.eq(g.state.plug, 0, '锁芯没被转动');
  t.eq(g.state.locked, true, '门仍然锁着');
  t.ok(g.insertKey('none').ok, '能拔出错钥匙');

  /* ---- 6. 对钥匙：转 90° 松闸，外执手接通 ---- */
  t.ok(g.insertKey('right').ok, '对钥匙插到底');
  const turned = g.turnKey(90);
  t.ok(turned.ok, '对钥匙能转');
  t.eq(g.state.locked, false, '锁芯转到底 → 离合接通');
  const out2 = g.knob('out', 90);
  t.eq(out2.engaged, true, '解锁后外执手接通方轴');
  t.eq(g.state.spindle, 90, '外执手带动方轴');
  g.knob('out', 0);

  /* ---- 7. 锁芯转回原位 → 重新锁死 ---- */
  t.ok(g.turnKey(0).ok, '锁芯转回 0°');
  t.eq(g.state.locked, true, '重新锁定');
  const out3 = g.knob('out', 90);
  t.eq(out3.engaged, false, '重新锁定后外执手又空转');

  /* ---- 8. 锁舌回缩量单调、端点对准 ---- */
  const r0 = MODEL.boltPull({ ...g.state, spindle: 0 }, { cut: false });
  const r45 = MODEL.boltPull({ ...g.state, spindle: 45 }, { cut: false });
  const r90 = MODEL.boltPull({ ...g.state, spindle: 90 }, { cut: false });
  t.near(r0, 0, 1e-6, '方轴 0° 时锁舌全伸');
  t.ok(r45 > r0 && r45 < r90, '中间角度回缩量在两端之间');
  t.near(r90, THROW, 0.05, '方轴 90° 时锁舌全缩');
}
