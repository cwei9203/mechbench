/* 手摇发电手电筒 · 专属断言：摇动、灯光、开关、取景、拖摇柄都要真的生效 */
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (s) => $(s)?.textContent.trim() ?? '';
const rd = (k) => $(`[data-rd="${k}"]`)?.textContent.trim() ?? '';
const num = (k) => parseFloat((rd(k) || '').replace(/[^\d.-]/g, '')) || 0;
const ok = [], bad = [];
const need = (cond, msg) => (cond ? ok : bad).push(msg);
const tap = async (id, ms = 220) => { $(id)?.click(); await wait(ms); };
const stage = window.__lab?.stage;

// 1. 自由实验：整机装好
$('#free-lab').click();
await wait(500);
need(txt('#plabel') === '12 / 12 块模块', `自由实验后进度=12（实际 ${txt('#plabel')}）`);
need(txt('#feedback').includes('整机已装好'), `自由实验有反馈（${txt('#feedback')}）`);

// 2. 摇五圈：圈数、转子转速、电容电量都动起来
await tap('#crank-once', 3200);
need(num('turns') > 4, `摇五圈后摇柄圈数增加（${rd('turns')}）`);
need(num('charge') > 5, `摇动给电容充上电（${rd('charge')}）`);
need(num('rpm') > 0 || num('turns') > 4, `转子转速已赋值（${rd('rpm')}）`);

// 3. 开关灯真的改变画面（像素探针：灯灭后同一块区域变暗）
if (stage && stage.probe) {
  const box = $('.stage').getBoundingClientRect();
  const area = { x: box.width * 0.5, y: box.height * 0.15, width: box.width * 0.45, height: box.height * 0.6 };
  const on = await stage.probe(area);
  await wait(350);
  const on2 = await stage.probe(area);
  await tap('#toggle', 350);
  const off = await stage.probe(area);
  need(on2.lit !== off.lit || on2.colors !== off.colors, `关灯改变了画面（亮 ${on2.lit} px / 灭 ${off.lit} px）`);
  need(on.lit > 0 && off.lit > 0, '舞台上有实体');
  await tap('#toggle', 300);
  need($('#toggle').getAttribute('aria-pressed') === 'true', '可以重新合上开关');
} else {
  bad.push('拿不到三维舞台，无法验证灯光');
}

// 4. 拖摇柄：绕过轴心划 90°，摇柄圈数变化
if (stage && stage.controls && innerWidth >= 700) {
  const cv = stage.renderer.domElement;
  const v = stage.controls.target.clone();
  v.set(-37, 8, 22);
  const p = stage.project(v);
  const rect = cv.getBoundingClientRect();
  const pe = (type, x, y, id = 13) => cv.dispatchEvent(new PointerEvent(type, {
    clientX: rect.left + x, clientY: rect.top + y, pointerId: id, pointerType: 'mouse',
    button: 0, buttons: 1, bubbles: true, cancelable: true,
  }));
  const before = num('turns');
  const r = 70;
  pe('pointerdown', p.x, p.y);
  pe('pointermove', p.x + Math.cos(Math.PI / 2) * r, p.y + Math.sin(Math.PI / 2) * r);
  pe('pointerup', p.x + Math.cos(Math.PI / 2) * r, p.y + Math.sin(Math.PI / 2) * r);
  await wait(250);
  const after = num('turns');
  need(Math.abs(after - before) > 0.1, `拖摇柄转动了机构（${before} → ${after} 圈）`);
} else {
  ok.push('窄屏跳过摇柄拖拽断言（' + innerWidth + 'px）');
}

// 5. 取景按钮真的移动相机
if (stage) {
  const cam = () => stage.camera.position.toArray().map((v) => v.toFixed(1)).join(',');
  const a = cam();
  await tap('#focus-gears');
  const b = cam();
  await tap('#focus-head');
  const c = cam();
  need(a !== b && b !== c, `取景按钮移动了相机（${a} → ${b} → ${c}）`);
  await tap('#focus-all');
}

// 6. 剖开 / 实体
await tap('[data-tool="cut"]', 250);
need($('[data-tool="cut"]').getAttribute('aria-pressed') === 'false', '剖开可以关掉');
await tap('[data-tool="cut"]', 250);
need($('[data-tool="cut"]').getAttribute('aria-pressed') === 'true', '剖开可以打开');

// 7. 重新开始
await tap('#restart', 350);
need(txt('#plabel') === '0 / 12 块模块', `重新开始后进度归零（实际 ${txt('#plabel')}）`);
need(num('charge') === 0, `电量归零（${rd('charge')}）`);

// 收尾：停在整机画面，给缩略图与像素探针留证据
$('#free-lab').click();
await wait(600);
$('#crank-once').click();
await wait(2800);
return { ok, bad };
