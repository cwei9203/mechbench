/* 比较式投币器 · 专属断言：整机投币、退币、灵敏度、换样币、断电 fail-safe 都要真的改变场景 */
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (s) => $(s)?.textContent.trim() ?? '';
const rd = (k) => $(`[data-rd="${k}"]`)?.textContent.trim() ?? '';
const ok = [], bad = [];
const need = (cond, msg) => (cond ? ok : bad).push(msg);
const stage = window.__lab && window.__lab.stage;

const visibleKeys = () => {
  const set = new Set();
  if (!stage) return set;
  stage.scene.traverse((o) => {
    if (!o.isMesh || !o.userData.key) return;
    if (o.material && o.material.isMeshBasicMaterial) return;
    let n = o, vis = true;
    while (n) { if (!n.visible) { vis = false; break; } n = n.parent; }
    if (vis) set.add(o.userData.key);
  });
  return set;
};
const coinMesh = (kind) => {
  let found = null;
  stage?.scene.traverse((o) => { if (o.name === 'coin-' + kind && o.visible) found = o; });
  return found;
};
const setSens = async (v) => {
  const el = $('#sens');
  if (!el) { bad.push('sens missing; task HTML=' + (document.querySelector('#task')?.innerHTML || '').slice(0, 700)); return false; }
  el.value = String(v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(120);
  return true;
};
const tap = async (sel, ms = 220) => { $(sel)?.click(); await wait(ms); };

need(!!stage, '拿得到三维舞台');
// 待取模块要落在舞台可见范围内，不能生成到镜头外
{
  const info = stage.info.get('base');
  const off = stage.view.offsets.get('base') || { x: 0, y: 0, z: 0 };
  const p = stage.project(info.center.clone().add(off));
  const r = document.querySelector('.stage').getBoundingClientRect();
  need(p.x > 0 && p.x < r.width && p.y > 0 && p.y < r.height,
    `待取的底板投影在舞台内（${p.x.toFixed(0)}, ${p.y.toFixed(0)} / ${r.width.toFixed(0)}×${r.height.toFixed(0)}）`);
}

/* 0. 三关真实流程：装模块 → 做实验 → 答对 → 下一关 */
const waitVerdict = async (want, ms = 5000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (want.includes(rd('verdict'))) return rd('verdict');
    await wait(100);
  }
  return rd('verdict');
};
const buildChapter = async () => {
  let guard = 0;
  while (guard++ < 12) {
    const card = document.querySelector('#mlist .card:not([disabled])');
    if (!card) break;
    card.click(); await wait(80);
    const place = document.querySelector('#task #place');
    if (!place || place.disabled) break;
    place.click(); await wait(140);
  }
};
const answerAndNext = async () => {
  const opt = document.querySelector('[data-opt="0"]');
  need(!!opt, '答题选项出现');
  opt?.click(); await wait(280);
  const next = document.querySelector('#task #next');
  need(!!next, '答对后出现下一关按钮');
  next?.click(); await wait(320);
};

// 第一关
await buildChapter();
need(/^5 \/ 12 块模块$/.test(txt('#plabel')), `第一关 5 块模块装好（${txt('#plabel')}）`);
need(!!$('#ins-washer') && !!$('#return'), '第一关实验有投厚垫圈/退币按钮');
$('#ins-washer').click();
need((await waitVerdict(['厚度门阻挡'])) === '厚度门阻挡', `第一关：厚垫圈卡在厚度门（${rd('verdict')}）`);
await tap('#return', 200);
need((await waitVerdict(['已退币'])) === '已退币', `第一关：退币按钮把它推回（${rd('verdict')}）`);
await tap('#to-quiz', 260);
await answerAndNext();
need(/^5 \/ 12 块模块$/.test(txt('#plabel')), `进入第二关时还是第一关的 5 块（${txt('#plabel')}）`);

// 第二关
await buildChapter();
need(/^8 \/ 12 块模块$/.test(txt('#plabel')), `第二关 3 块装好（${txt('#plabel')}）`);
need(!!$('#ins-fake') && !!$('#sens'), '第二关实验有比较头与灵敏度控件');
$('#ins-yuan').click();
need((await waitVerdict(['接受'])) === '接受', `第二关：1 元判合格（${rd('verdict')}）`);
need(txt('#feedback').includes('还没装活门'), `第二关：提示活门未装，币先落进接币盒（${txt('#feedback').slice(0, 30)}）`);
await tap('#to-quiz', 260);
await answerAndNext();
need(/^8 \/ 12 块模块$/.test(txt('#plabel')), `进入第三关时还是第二关的 8 块（${txt('#plabel')}）`);

// 第三关
await buildChapter();
need(/^12 \/ 12 块模块$/.test(txt('#plabel')), `第三关 4 块装好（${txt('#plabel')}）`);
need(!!$('#ins-jiao') && !!$('#power'), '第三关实验有投币与断电按钮');
$('#ins-yuan').click();
need((await waitVerdict(['接受'])) === '接受', `第三关：1 元被接受（${rd('verdict')}）`);
need(txt('#feedback').includes('计数 +1'), '跨关连续接受也更新完成反馈');
need(rd('count') === '1 枚', `第三关：接受计数 1（${rd('count')}）`);
$('#ins-jiao').click();
need((await waitVerdict(['退回'])) === '退回', `第三关：5 角被退回（${rd('verdict')}）`);
$('#power').click();
$('#ins-yuan').click();
need((await waitVerdict(['退回'])) === '退回', `第三关：断电时 1 元也退回（${rd('verdict')}）`);
need(txt('#feedback').includes('断电'), '连续退回时更新为断电反馈');
need(rd('signal') === '断电', `第三关：读数显示断电（${rd('signal')}）`);
$('#power').click();
await tap('#to-quiz', 260);
await answerAndNext();
need(txt('.coach h2').includes('认币'), `三关走完进入自由实验室（${txt('.coach h2')}）`);

/* 1. 自由实验整机 */
$('#free-lab').click();
await wait(800);
/* 1. 投 1 元：比较合格 → 活门摆向接受位 → 落进接币盒 → 计数 +1 */
const n0 = parseInt(rd('count')) || 0;
$('#ins-yuan').click();
await wait(120);
await setSens(9);
need($('#sens').value === '6' && txt('#sens-out').includes('46'), '走币中调参被拒，滑块与门限保持一致');
const cm0 = coinMesh('yuan');
need(!!cm0, '投币后 1 元币出现在场景里');
const p0 = cm0 ? cm0.position.clone() : null;
await wait(600);
const cm1 = coinMesh('yuan');
need(!!p1Moved(p0, cm1), `币在币道里滚动（${p0 ? p0.y.toFixed(1) : '—'} → ${cm1 ? cm1.position.y.toFixed(1) : '—'}）`);
let gates = new Set();
for (let i = 0; i < 24; i++) { gates.add(rd('gate')); await wait(90); }
need(gates.has('接受位'), `合格币让活门摆到接受位（${[...gates].join(' / ')}）`);
need(rd('verdict') === '接受', `1 元判定接受（${rd('verdict')}）`);
need((parseInt(rd('count')) || 0) === n0 + 1, `计数 +1（${rd('count')}）`);
need(coinMesh('yuan') && coinMesh('yuan').position.y < -80, `币真的落进接币盒（y=${coinMesh('yuan')?.position.y.toFixed(1)}）`);

/* 2. 投 5 角：直径差超门限 → 退回，计数不变 */
const c1 = parseInt(rd('count')) || 0;
$('#ins-jiao').click();
await wait(2800);
need(rd('verdict') === '退回', `5 角被退回（${rd('verdict')}）`);
need((parseInt(rd('count')) || 0) === c1, `退回不计数（${rd('count')}）`);
need(/门限/.test(rd('signal')), `读数给出差值与门限（${rd('signal')}）`);

/* 3. 厚垫圈：厚度门物理阻挡 → 退币按钮推回 */
$('#ins-washer').click();
await wait(900);
need(rd('verdict') === '厚度门阻挡', `厚垫圈被厚度门挡住（${rd('verdict')}）`);
const countBlocked = parseInt(rd('count')) || 0;
await tap('#return', 2200);
need(rd('verdict') === '已退币', `退币按钮把厚垫圈推回（${rd('verdict')}）`);
need((parseInt(rd('count')) || 0) === countBlocked, `退币不计数（${rd('count')}）`);

/* 4. 灵敏度：铜章在松门限下能过，在严门限下被拒 */
need(await setSens(2), '灵敏度滑块可操作');
need(rd('signal') === '—' || /门限/.test(rd('signal')), `灵敏度改变门限（${rd('signal')}）`);
$('#ins-fake').click();
await wait(2800);
need(rd('verdict') === '接受', `灵敏度 2 时铜章被接受（${rd('verdict')}）`);
const countLoose = parseInt(rd('count')) || 0;
await setSens(9);
$('#ins-fake').click();
await wait(2800);
need(rd('verdict') === '退回', `灵敏度 9 时铜章被拒（${rd('verdict')}）`);
need((parseInt(rd('count')) || 0) === countLoose, `严格档拒绝不计数（${rd('count')}）`);

/* 5. 换样币：参考换成游戏币，1 元立刻变成“异种币” */
await tap('#swap', 300);
need(rd('sample') === '游戏币', `样币已换成游戏币（${rd('sample')}）`);
$('#ins-yuan').click();
await wait(2800);
need(rd('verdict') === '退回', `样币换游戏币后 1 元被拒（${rd('verdict')}）`);

/* 6. 断电：比较器停摆，弹簧活门退币（fail-safe） */
await tap('#swap', 300);
need(rd('sample') === '1 元', '样币换回 1 元');
await setSens(6);
await tap('#power', 300);
const countOff = parseInt(rd('count')) || 0;
$('#ins-yuan').click();
await wait(2800);
need(rd('verdict') === '退回', `断电时 1 元也被退回（${rd('verdict')}）`);
need(rd('signal') === '断电', `读数显示断电（${rd('signal')}）`);
need((parseInt(rd('count')) || 0) === countOff, `断电退币不计数（${rd('count')}）`);
await tap('#power', 300);

/* 7. 重新开始归零；再回自由实验留截图 */
await tap('#restart', 500);
need(txt('#plabel') === '0 / 12 块模块', `重新开始后进度归零（${txt('#plabel')}）`);
need(rd('verdict') === '待投币' && rd('sample') === '—', `归零后读数回到初始（${rd('verdict')} / ${rd('sample')}）`);
$('#free-lab').click();
await wait(800);
need(txt('#plabel') === '12 / 12 块模块', '自由实验入口可重复进入');
// 收尾：留一枚厚垫圈卡在厚度门，截图与像素探针都能看到「币真的在币道里」
$('#ins-washer').click();
await wait(900);
need(rd('verdict') === '厚度门阻挡', `收尾画面停在厚度门阻挡（${rd('verdict')}）`);
return { ok, bad };

function p1Moved(a, b) { return !!a && !!b && Math.abs(a.y - b.position.y) > 5; }
