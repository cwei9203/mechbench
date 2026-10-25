/* 气钉枪 · 专属断言：自由实验、击发循环、卡钉清障、深度轮都要真的改变场景 */
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (s) => $(s)?.textContent.trim() ?? '';
const rd = (k) => $(`[data-rd="${k}"]`)?.textContent.trim() ?? '';
const ok = [], bad = [];
const need = (cond, msg) => (cond ? ok : bad).push(msg);
const tap = async (id, ms = 220) => { $(id)?.click(); await wait(ms); };

// 1. 自由实验：整机装好，读数有值
$('#free-lab').click();
await wait(500);
need(txt('#plabel') === '13 / 13 块模块', `自由实验后进度=13（实际 ${txt('#plabel')}）`);
need(rd('supply') !== '—', `气压读数已赋值（${rd('supply')}）`);
need(rd('nails') === '80 支', `初始余钉 80（实际 ${rd('nails')}）`);

// 2. 不接气不能击发
await tap('#fire', 300);
need(txt('#feedback').includes('气源'), `未接气被拒绝（${txt('#feedback')}）`);
need(rd('nails') === '80 支', '拒绝击发不消耗钉子');

// 3. 接气 → 不压鼻端仍不能击发 → 压鼻端 → 扣扳机 → 击发
await tap('#air', 500);
need(parseFloat(rd('supply')) > 0.1, `接通气源后气压上升（${rd('supply')}）`);
await tap('#fire', 250);
need(txt('#feedback').includes('鼻端'), `未压鼻端被拒绝（${txt('#feedback')}）`);
await tap('#trip');
await tap('#trig');
await tap('#fire', 120);
const pistonA = rd('piston');
const phases = new Set();
let pistonPeak = 0;
for (let i = 0; i < 14; i++) {
  phases.add(rd('phase'));
  pistonPeak = Math.max(pistonPeak, Math.abs(parseFloat(rd('piston'))) || 0);
  await wait(90);
}
const pistonB = rd('piston');
need(pistonPeak > 5, `击发时活塞在动（${pistonA} → 峰值 +${pistonPeak.toFixed(1)} mm → ${pistonB}）`);
need(phases.size >= 3, `慢放时“阶段”走过多个步骤（${[...phases].join(' / ')}）`);
need(rd('nails') === '79 支', `击发消耗一钉（实际 ${rd('nails')}）`);
await wait(1200);

// 4. 卡钉：弄弯一根钉后击发被顶住，开卡扣门清障
await tap('#jam');
await tap('#fire', 400);
need(txt('#feedback').includes('弯钉'), `卡钉时击发中止（${txt('#feedback')}）`);
const nailsBefore = rd('nails');
await tap('#latch');
need(txt('#latch').length > 0, '卡扣门可以操作');
await tap('#latch', 350);
need(rd('nails') === nailsBefore, '清障没有偷偷消耗钉子');

// 5. 深度轮：三档名称循环
const d0 = txt('#depth');
await tap('#depth');
const d1 = txt('#depth');
await tap('#depth');
const d2 = txt('#depth');
need(d0 !== d1 && d1 !== d2 && d0 !== d2, `深度轮三档循环（${d0} → ${d1} → ${d2}）`);

// 6. 手压活塞：活塞行程离开 0
await wait(600);
const p0 = rd('piston');
await tap('#press', 300);
need(rd('piston') !== p0 || parseFloat(rd('piston')) !== 0, `手压活塞有位移（${p0} → ${rd('piston')}）`);
need(parseFloat(rd('ret')) > 0.01, `回程腔压力随活塞上升（${rd('ret')}）`);
await wait(2400);

// 7. 重装整条钉
await tap('#reload', 300);
need(rd('nails') === '80 支', `重装钉条归满（实际 ${rd('nails')}）`);

// 8. 剖开 / 实体
await tap('[data-tool="cut"]', 200);
need($('[data-tool="cut"]').getAttribute('aria-pressed') === 'false', '剖开可以关掉');
await tap('[data-tool="cut"]', 200);
need($('[data-tool="cut"]').getAttribute('aria-pressed') === 'true', '剖开可以打开');

// 9. 重新开始
await tap('#restart', 300);
need(txt('#plabel') === '0 / 13 块模块', `重新开始后进度归零（实际 ${txt('#plabel')}）`);
need(rd('piston') === '—' && rd('nails') === '—', '归零后行程与余钉回到 —');

// 收尾：停在整机画面，给缩略图与像素探针留证据
$('#free-lab').click();
await wait(700);
return { ok, bad };
