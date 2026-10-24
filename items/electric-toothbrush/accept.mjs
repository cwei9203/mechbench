/* 电动牙刷 · 专属断言：供电、拔刷头、放大窗、剖开都要真的生效 */
const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (s) => q(s)?.textContent.trim() ?? '';
const rd = (k) => q(`[data-rd="${k}"]`)?.textContent.trim() ?? '';
const ok = [], bad = [];
const need = (cond, msg) => (cond ? ok : bad).push(msg);

// 1. 自由实验：整机装好 + 已通电
q('#free-lab').click();
await wait(400);
need(txt('#plabel') === '10 / 10 块模块', `自由实验后进度=10 (实际 ${txt('#plabel')})`);
need(rd('angle') !== '—', `摆角读数已赋值 (${rd('angle')})`);
need(rd('mode') === '通电往复', `状态显示通电往复 (实际 ${rd('mode')})`);

// 2. 摆角随时间变化（正弦驱动）
const a0 = rd('angle');
await wait(300);
need(rd('angle') !== a0, `摆角在动 (${a0} → ${rd('angle')})`);

// 3. 局部放大窗只在足够大的舞台显示（和旧版一致：stage 宽度 > 760）
if (innerWidth >= 1200) {
  need(!q('#inset').hidden, '局部放大窗已显示');
  need(txt('#inset-title').length > 0, `放大窗有标题 (${txt('#inset-title')})`);
}

// 4. 拔下刷头：先停机（运行中不允许拆），再拆
q('#power').click();
await wait(200);
q('#head').click();
await wait(200);
need(txt('#head') === '装回刷头', '拔下刷头后按钮变成「装回刷头」');
need(qa('.flow span.off').length === 1, '传动链末格置灰');
q('#head').click();
await wait(200);
need(txt('#head') === '拔下刷头', '装回后按钮复原');

// 5. 停机状态（上一步已停机）
need(rd('mode') === '停机', `停机后状态正确 (实际 ${rd('mode')})`);
q('#power').click();
await wait(200);
need(rd('mode') === '通电往复', '可以重新通电');

// 6. 剖开看
q('[data-tool="cut"]').click();
await wait(150);
need(q('[data-tool="cut"]').getAttribute('aria-pressed') === 'false', '剖开可以关掉');
q('[data-tool="cut"]').click();
await wait(150);
need(q('[data-tool="cut"]').getAttribute('aria-pressed') === 'true', '剖开可以打开');

// 7. 重新开始
q('#restart').click();
await wait(250);
need(txt('#plabel') === '0 / 10 块模块', `重新开始后进度归零 (实际 ${txt('#plabel')})`);
need(qa('#mlist .card').some((c) => c.dataset.installed === 'false'), '卡片回到未装状态');

// 收尾：停在整机画面，给缩略图留证据
q('#free-lab').click();
await wait(400);

return { ok, bad };
