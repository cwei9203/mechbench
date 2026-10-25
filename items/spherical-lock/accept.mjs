/* 球形门锁 · 专属断言：装配推进、实验、钥匙/离合、拖执手、剖开、拆件都要真的改变场景 */
const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (s) => q(s)?.textContent.trim() ?? '';
const rd = (k) => q(`[data-rd="${k}"]`)?.textContent.trim() ?? '';
const num = (k) => parseFloat((rd(k) || '').replace(/[^\d.-]/g, '')) || 0;
const ok = [], bad = [];
const need = (cond, msg) => (cond ? ok : bad).push(msg);
const stage = window.__lab && window.__lab.stage;

// 场景里「此刻真的被画出来」的零件 key 集合（拆件 = 从集合里消失）
const visibleKeys = () => {
  const set = new Set();
  if (!stage) return set;
  stage.scene.traverse((o) => {
    if (!o.isMesh || !o.userData.key) return;
    if (o.material && o.material.isMeshBasicMaterial) return;   // 安装位轮廓是 kit 的克隆件，不算装上的零件
    let n = o, vis = true;
    while (n) { if (!n.visible) { vis = false; break; } n = n.parent; }
    if (vis) set.add(o.userData.key);
  });
  return set;
};
const stageRect = () => q('.stage').getBoundingClientRect();
const probe = (fx, fy, fw, fh) => {
  const r = stageRect();
  return stage.probe({ x: r.width * fx, y: r.height * fy, width: r.width * fw, height: r.height * fh });
};
const clickCard = (id) => { const c = q(`#mlist .card[data-id="${id}"]`); if (c) c.click(); return !!c; };
const nextCard = () => q('#mlist .card:not([disabled])');

/* ============ 1. 三关：装完 → 实验 → 答对 → 徽章 → 下一关 ============ */
need(!!stage, '拿得到三维舞台');
const beforeCount = visibleKeys().size;

for (let ch = 0; ch < 3; ch++) {
  let guard = 0;
  while (nextCard() && guard++ < 6) {
    nextCard().click();
    await wait(110);
    const btn = q('#task #place');
    if (!btn || btn.disabled) break;
    btn.click();
    await wait(170);
  }
  need(!!q('#task #experiment'), `第 ${ch + 1} 关：模块装完出现实验按钮`);
  need(/^\d+ \/ 8 块模块$/.test(txt('#plabel')), `第 ${ch + 1} 关：进度条按 21 件 / 8 模块统计（${txt('#plabel')}）`);

  const keysNow = visibleKeys();
  if (ch === 0) need(['latchHousing', 'latchBolt', 'latchSpring', 'retractor', 'faceplate', 'faceScrews', 'strike']
    .every((k) => keysNow.has(k)), `第 1 关：锁舌组件 6 件 + 扣板进了场景（${keysNow.size} 件可见）`);
  if (ch === 1) need(['spindle', 'plateOut', 'plateIn', 'throughBolts', 'roseOut', 'roseIn', 'knobIn']
    .every((k) => keysNow.has(k)), `第 2 关：方轴 / 安装板 / 装饰圈 / 内执手进了场景（${keysNow.size} 件可见）`);
  if (ch === 2) need(['knobOut', 'cylHousing', 'plug', 'pinStack', 'clutch']
    .every((k) => keysNow.has(k)), `第 3 关：外执手与锁芯 5 件进了场景（${keysNow.size} 件可见）`);

  const boltBefore = num('bolt');
  q('#task #experiment').click();
  await wait(ch === 0 ? 170 : 320);
  if (ch === 0) {
    need(num('bolt') < boltBefore - 1, `第 1 关：推锁舌让读数变小（${boltBefore} → ${num('bolt')}）`);
    await wait(1100);
    need(Math.abs(num('bolt') - 12.7) < 0.2, `第 1 关：松手回弹到 12.7 mm（${rd('bolt')}）`);
  }
  if (ch === 1) {
    need(num('spindle') > 85 && Math.abs(num('bolt')) < 0.2, `第 2 关：转内执手 90° → 锁舌缩回 0（${rd('spindle')} / ${rd('bolt')}）`);
    need(rd('pull').startsWith('12.7'), `第 2 关：拨片位移=锁舌行程（${rd('pull')}）`);
  }
  if (ch === 2) {
    need(num('cylinder') > 85 && rd('clutch').startsWith('接通'), `第 3 关：对钥匙转 90° → 离合接通（${rd('cylinder')} / ${rd('clutch')}）`);
    need(txt('#feedback').includes('错钥匙'), `第 3 关：实验里先试了错钥匙（${txt('#feedback').slice(0, 40)}）`);
  }

  const again = q('#task #again');
  if (again) {
    again.click();
    await wait(260);
    need(!!q('[data-opt="0"]') && !q('#feedback').classList.contains('error'), `第 ${ch + 1} 关：「再看一遍」能在判断阶段重做实验`);
    await wait(900);
  } else {
    bad.push(`第 ${ch + 1} 关：判断阶段没有「再看一遍」`);
  }

  const opt = q('[data-opt="0"]');
  need(!!opt, `第 ${ch + 1} 关：实验后进入判断`);
  opt && opt.click();
  await wait(260);
  need(qa('.journey li.done').length >= ch + 1, `第 ${ch + 1} 关：答对拿到徽章（${qa('.journey li.done').length} 关已过）`);
  const next = q('#task #next');
  need(!!next, `第 ${ch + 1} 关：出现「下一关 / 进自由实验」`);
  next && next.click();
  await wait(320);
}
need(txt('[data-slot="coach.title"]').includes('装完') || txt('.coach h2').includes('装完'), `三关走完进入自由实验（${txt('.coach h2')}）`);
need(qa('.journey li.done').length === 3, '三关徽章全部点亮');

/* ============ 2. 自由实验：一键满装 + 卡片已装态 ============ */
q('#free-lab').click();
await wait(600);
need(txt('#plabel') === '8 / 8 块模块', `自由实验一键满装（${txt('#plabel')}）`);
const cards = qa('#mlist .card');
need(cards.length >= 2 && cards.every((c) => c.dataset.installed === 'true'), `自由实验后卡片都是已装态（${cards.length} 张）`);
const labKeys = visibleKeys();
need(labKeys.size >= 20, `整机 20 件以上零件在场景里（${labKeys.size}）`);
need(!labKeys.has('key'), '没插钥匙时钥匙不在场景里');

/* ============ 3. 钥匙 / 离合 / 锁芯 ============ */
q('#key-right').click();
await wait(260);
need(visibleKeys().has('key'), '插对钥匙 → 钥匙进场景');
need(rd('cylinder').includes('对钥匙'), `读数显示对钥匙（${rd('cylinder')}）`);
q('#plug').click();
await wait(300);
need(rd('clutch').startsWith('接通'), `转钥匙 90° → 离合接通（${rd('clutch')}）`);
need(num('cylinder') > 85, `锁芯读数 90°（${rd('cylinder')}）`);

/* ============ 4. 拖外执手 → 方轴（解锁后才传动） ============ */
if (stage && innerWidth >= 700) {
  const cv = stage.renderer.domElement;
  const rect = cv.getBoundingClientRect();
  const pt = stage.camera.position.clone();
  pt.set(-59, 0, 0);
  const sp = stage.project(pt);
  const pe = (type, x, y, id = 17) => cv.dispatchEvent(new PointerEvent(type, {
    clientX: rect.left + x, clientY: rect.top + y, pointerId: id, pointerType: 'mouse',
    button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true,
  }));
  const before = num('spindle');
  pe('pointerdown', sp.x, sp.y);
  await wait(60);
  pe('pointermove', sp.x + 160, sp.y);
  await wait(160);
  const dragged = num('spindle');
  pe('pointerup', sp.x + 160, sp.y);
  await wait(160);
  need(dragged > 88, `解锁后拖外执手把方轴拖到 90°（${before} → ${dragged}°）`);
  need(Math.abs(num('bolt')) < 0.5, `方轴 90° → 锁舌缩回 12.7 mm 到底（${rd('bolt')}）`);
  need(Math.abs(num('bolt') - (12.7 - 12.7 * (1 - Math.cos(dragged * Math.PI / 180)))) < 0.4,
    `锁舌读数 = R(1−cosθ)（${dragged}° → ${rd('bolt')}）`);
} else {
  ok.push('窄屏跳过执手拖拽断言（' + innerWidth + 'px）');
}

// 把外执手归零（拖拽断言在窄屏会跳过，这里不假设它转过）
if (txt('#task #turn-out').includes('松开')) { q('#task #turn-out').click(); await wait(240); }
need(num('spindle') < 5, `松开外执手 → 方轴回 0（${rd('spindle')}）`);
q('#plug').click();
await wait(220);
need(rd('clutch').startsWith('断开'), `转钥匙回 0° → 离合断开（${rd('clutch')}）`);

/* ============ 5. 错钥匙转不动 ============ */
q('#key-wrong').click();
await wait(240);
need(visibleKeys().has('key'), '错钥匙也进得了场景');
need(rd('cylinder').includes('错钥匙'), `读数显示错钥匙（${rd('cylinder')}）`);
q('#plug').click();
await wait(260);
need(txt('#feedback').includes('转不动'), `错钥匙转不动（${txt('#feedback').slice(0, 30)}）`);
need(num('cylinder') < 5 && rd('clutch').startsWith('断开'), `转子仍是 0°、离合仍断开（${rd('cylinder')} / ${rd('clutch')}）`);

/* ============ 6. 内执手 / 推锁舌 / 实验台滑杆 ============ */
q('#key-off').click();
await wait(240);
need(!visibleKeys().has('key'), '拔钥匙 → 钥匙从场景移除');
if (txt('#task #turn-in').includes('松开')) { q('#task #turn-in').click(); await wait(240); }
q('#turn-in').click();
await wait(280);
need(num('spindle') > 85 && Math.abs(num('bolt')) < 0.2, `转内执手 90° → 方轴 90°、锁舌 0（${rd('spindle')} / ${rd('bolt')}）`);
q('#turn-in').click();
await wait(260);
need(num('spindle') < 5 && Math.abs(num('bolt') - 12.7) < 0.2, `松开 → 方轴 0°、锁舌 12.7（${rd('spindle')} / ${rd('bolt')}）`);

const slider = q('[data-exp="knobAngle"]');
if (slider) {
  slider.value = '45';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(240);
  need(Math.abs(num('spindle') - 45) < 6, `实验台滑杆改变方轴转角（${rd('spindle')}）`);
  need(Math.abs(num('bolt') - (12.7 - 12.7 * (1 - Math.cos(45 * Math.PI / 180)))) < 0.5, `滑杆同时改变锁舌读数（${rd('bolt')}）`);
  slider.value = '0';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(200);
} else {
  bad.push('实验台没有内执手转角滑杆');
}

const b0 = num('bolt');
q('#push').click();
await wait(170);
need(num('bolt') < b0 - 1, `推锁舌按钮改变读数（${b0} → ${num('bolt')}）`);
await wait(1100);

/* ============ 7. 取景按钮 / 剖开 ============ */
const camBefore = stage.camera.position.toArray().map((v) => v.toFixed(1)).join(',');
q('#focus-cyl').click();
await wait(300);
const camAfter = stage.camera.position.toArray().map((v) => v.toFixed(1)).join(',');
need(camBefore !== camAfter, `「看锁芯」移动了相机（${camBefore} → ${camAfter}）`);

q('[data-tool="pan"]').click();
await wait(160);
need(q('[data-tool="pan"]').getAttribute('aria-pressed') === 'true', '「平移」工具切得过去');
q('[data-tool="rotate"]').click();
await wait(160);
need(q('[data-tool="rotate"]').getAttribute('aria-pressed') === 'true', '「旋转」工具切得回来');
const camCyl = stage.camera.position.toArray().map((v) => v.toFixed(1)).join(',');
q('[data-tool="home"]').click();
await wait(420);
need(stage.camera.position.toArray().map((v) => v.toFixed(1)).join(',') !== camCyl, '「复位」把相机拉回整机取景');

// 剖开：先量实体，再量剖开，两次渲染必须不同
const cutBtn = q('[data-tool="cut"]');
const wasOn = cutBtn.getAttribute('aria-pressed') === 'true';
if (wasOn) { cutBtn.click(); await wait(320); }
const solid = await probe(0.2, 0.15, 0.6, 0.7);
cutBtn.click();
await wait(320);
const cut = await probe(0.2, 0.15, 0.6, 0.7);
need(solid.lit > 0 && cut.lit > 0, `剖开 / 实体两次都有实体（${solid.lit} / ${cut.lit} 像素）`);
need(Math.abs(solid.lit - cut.lit) > solid.lit * 0.02 || solid.colors !== cut.colors,
  `剖开切换真的改变了渲染（${solid.lit} / ${cut.lit} 像素，${solid.colors} / ${cut.colors} 色）`);
need(cutBtn.getAttribute('aria-pressed') === 'true', '剖开按钮回到打开态');

if (innerWidth >= 1200) {
  need(!q('#inset').hidden, '剖开时出现锁芯放大窗');
  need(txt('#inset-title').includes('锁芯'), `放大窗标题正确（${txt('#inset-title')}）`);
} else {
  ok.push('窄屏不放放大窗（' + innerWidth + 'px）');
}

/* ============ 8. 重新开始 → 拆件真的从场景移除 ============ */
q('#restart').click();
await wait(400);
need(txt('#plabel') === '0 / 8 块模块', `重新开始后进度归零（${txt('#plabel')}）`);
const emptyKeys = visibleKeys();
need(!emptyKeys.has('latchHousing') && !emptyKeys.has('knobIn'), `未装模块不在场景里（可见 ${emptyKeys.size} 件）`);

clickCard('latch');
await wait(200);
need(!!q('#task #place') && !q('#task #place').disabled, '第 1 关选中模块后可装入');
q('#task #place').click();
await wait(300);
need(txt('#plabel') === '1 / 8 块模块', `装入后进度 1 / 8（${txt('#plabel')}）`);
need(visibleKeys().has('latchHousing') && visibleKeys().has('faceplate'), '装入后锁舌壳与面板出现在场景里');
q('#task #undo').click();
await wait(320);
need(txt('#plabel') === '0 / 8 块模块', `撤回后进度归零（${txt('#plabel')}）`);
need(!visibleKeys().has('latchHousing'), '拆下的模块从场景移除（不是只是变文案）');

/* ============ 收尾：整机 + 剖开，给缩略图和像素探针留证据 ============ */
q('#free-lab').click();
await wait(700);
if (q('[data-tool="cut"]').getAttribute('aria-pressed') !== 'true') q('[data-tool="cut"]').click();
await wait(500);
return { ok, bad };
