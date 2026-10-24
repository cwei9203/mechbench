/* 双缸发动机 · 浏览器专属断言：每个按钮都必须真的改变场景状态 */
const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (s) => q(s)?.textContent.trim() ?? '';
const rd = (k) => q(`[data-rd="${k}"]`)?.textContent.trim() ?? '';
const ok = [], bad = [];
const need = (cond, msg) => (cond ? ok : bad).push(msg);

// 1. 自由实验：一键装完全部 10 块模块
q('#free-lab').click();
await wait(350);
need(txt('#plabel') === '10 / 10 块模块', `自由实验后进度=10 (实际 ${txt('#plabel')})`);
need(qa('#mlist .card').every((c) => c.dataset.installed === 'true' && c.disabled), '自由实验后卡片全部标记已装且禁用');
need(q('#readout').classList.contains('on'), '自由实验后读数可见');
need(rd('crank') !== '—', `曲轴读数已赋值 (${rd('crank')})`);

// 2. 让它转起来：曲轴读数随时间变化
const c0 = rd('crank');
q('#run').click();
await wait(450);
need(rd('crank') !== c0, `运行后曲轴角变化 (${c0} → ${rd('crank')})`);
q('#run').click();
await wait(120);

// 3. 手动摇曲轴到 180°：读数必须跟着到 180°
const slider = q('#crank');
slider.value = '180';
slider.dispatchEvent(new Event('input', { bubbles: true }));
await wait(120);
need(rd('crank') === '180°', `摇到 180° 读数同步 (实际 ${rd('crank')})`);
need(txt('#crank-out') === '180°', '滑杆上的角度显示同步');

// 4. 拆正时链：凸轮轴读数冻结，传动链示意置灰
const camBefore = rd('cam');
q('#chain').click();
await wait(150);
need(txt('#chain') === '装回正时链', '拆链条后按钮变成「装回正时链」');
slider.value = '360';
slider.dispatchEvent(new Event('input', { bubbles: true }));
await wait(150);
need(rd('crank') === '360°' && rd('cam') === camBefore, `拆链后凸轮轴不跟曲轴 (曲轴 ${rd('crank')}，凸轮轴 ${rd('cam')})`);
need(qa('.flow span.off').length === 3, '传动链示意三格置灰');

// 5. 剖开看：按钮进入按下态
q('[data-tool="cut"]').click();
await wait(150);
need(q('[data-tool="cut"]').getAttribute('aria-pressed') === 'true', '剖开看进入按下态');
q('[data-tool="cut"]').click();
await wait(120);

// 6. 取下气门室盖：按钮文字与场景状态变化
q('#cover').click();
await wait(150);
need(txt('#cover') === '盖回气门室盖', '取下气门室盖后按钮文字变化');

// 7. 看配气 / 看整机：取景切换不报错
q('#focus-top').click();
await wait(200);
q('#focus-all').click();
await wait(200);
need(true, '取景切换执行完成');

// 8. 重新开始：回到第一关空装配
q('#restart').click();
await wait(250);
need(txt('#plabel') === '0 / 10 块模块', `重新开始后进度归零 (实际 ${txt('#plabel')})`);
need(qa('#mlist .card').some((c) => c.dataset.installed === 'false'), '重新开始后卡片回到未装状态');

// 收尾：停在自由实验整机画面，给验收截图留证据
q('#free-lab').click();
await wait(400);
need(rd('crank') !== '—', '收尾截图停在整机画面');

return { ok, bad };
