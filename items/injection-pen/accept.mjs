/* 注射笔 · 专属断言：拔帽、装针、拨剂量、注射、关卡链路、自由实验都要真的改变场景状态
 * 只能用 DOM 驱动；"场景状态"通过 window.__lab.stage（?debug=1 暴露）读零件的世界坐标与可见性。
 */
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (s) => $(s)?.textContent.trim() ?? '';
const rd = (k) => $(`[data-rd="${k}"]`)?.textContent.trim() ?? '';
const num = (k) => parseFloat(((rd(k) || '').match(/-?\d+(\.\d+)?/) || [0])[0]) || 0;
const ok = [], bad = [];
const need = (cond, msg) => (cond ? ok : bad).push(msg);
const tap = async (id, ms = 220) => { $(id)?.click(); await wait(ms); };
const stage = window.__lab?.stage;

/* 零件在世界里的 x 区间与可见性（笔轴 = x，沿 x 量就够） */
function partBox(key) {
  const out = { min: Infinity, max: -Infinity, vis: false, n: 0 };
  if (!stage) return out;
  stage.scene.updateMatrixWorld(true);
  stage.scene.traverse((o) => {
    if (!o.isMesh || !o.userData || o.userData.key !== key) return;
    // 目标轮廓是克隆出来的（材质是纯色 MeshBasicMaterial），不能算进"零件真实位置"
    if (o.material && o.material.type === 'MeshBasicMaterial') return;
    out.n++;
    let v = o.visible;
    for (let p = o.parent; p; p = p.parent) if (!p.visible) v = false;
    if (v) out.vis = true;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, e = o.matrixWorld.elements;
    const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2;
    const x = e[0] * cx + e[4] * cy + e[8] * cz + e[12];
    out.min = Math.min(out.min, x); out.max = Math.max(out.max, x);
  });
  return out;
}
const cam = () => stage.camera.position.toArray().map((v) => v.toFixed(1)).join(',');

/* ---------- 1. 自由实验：一键满装 ---------- */
$('#free-lab').click();
await wait(600);
need(txt('#plabel') === '12 / 12 块模块', `自由实验一键满装（进度 ${txt('#plabel')}）`);
need(rd('dose') !== '—' && rd('stroke') !== '—' && rd('left') !== '—', `读数都已赋值（${rd('dose')} / ${rd('stroke')} / ${rd('left')}）`);
need(partBox('capOuter').vis && partBox('capInner').vis, '外帽、内帽都在笔上');
need(partBox('needle').vis, '针头在位');
need(Math.abs(num('stroke')) < 0.001, `起始活塞行程为 0（${rd('stroke')}）`);

/* ---------- 2. 不拔帽不能注射（帽不是装饰） ---------- */
await tap('#dose-full', 600);
await tap('#inject', 400);
need(txt('#feedback').includes('帽'), `帽还盖着时注射被拒绝（${txt('#feedback')}）`);
need(Math.abs(num('stroke')) < 0.001, `被拒绝的注射不动活塞（${rd('stroke')}）`);

/* ---------- 3. 拔帽：外帽和内帽真的滑出场景 ---------- */
const capX0 = partBox('capOuter').min;
await tap('#uncap', 600);
need(!partBox('capOuter').vis, '第一次拔帽：外帽从场景里消失');
await tap('#uncap', 700);
need(!partBox('capInner').vis, '第二次拔帽：内帽从场景里消失');
need(partBox('capOuter').min > capX0 + 20, `外帽是滑出去才消失的（${capX0.toFixed(0)} → ${partBox('capOuter').min.toFixed(0)}）`);

/* ---------- 4. 旋钮到 0：按钮锁死 ---------- */
await tap('#dose-zero', 500);
need(num('dose') === 0, `旋钮回到 0（${rd('dose')}）`);
await tap('#inject', 300);
need(/拨|0/.test(txt('#feedback')), `旋钮在 0 时注射被拒绝（${txt('#feedback')}）`);
need(Math.abs(num('stroke')) < 0.001, `拒绝注射不动活塞（${rd('stroke')}）`);

/* ---------- 5. 拨剂量：读数变化，但丝杠与活塞不动 ---------- */
const bungA = partBox('bung'), screwA = partBox('screw');
await tap('#dose-half', 600);
need(Math.abs(num('dose') - 0.5) < 0.001, `拨 0.5 mg 后剂量读数（${rd('dose')}）`);
need(rd('clicks') !== '', `咔哒格数有读数（${rd('clicks')}）`);
need(Math.abs(parseFloat(rd('clicks')) - 4) < 0.01, `0.5 mg = 4 格（${rd('clicks')}）`);
need(Math.abs(partBox('bung').min - bungA.min) < 0.01, `拨剂量时活塞没动（${bungA.min.toFixed(2)} → ${partBox('bung').min.toFixed(2)}）`);
need(Math.abs(partBox('screw').min - screwA.min) < 0.01, '拨剂量时丝杠没动（剂量只是给扭簧上弦）');
await tap('#dose-full', 600);
need(Math.abs(num('dose') - 1.0) < 0.001, `拨满 1.0 mg（${rd('dose')}）`);
need(Math.abs(parseFloat(rd('clicks')) - 8) < 0.01, `1.0 mg = 8 格（${rd('clicks')}）`);

/* ---------- 6. 注射：活塞推进、剩余药量减少 ---------- */
const left0 = num('left');
const bungB = partBox('bung');
await tap('#inject', 2800);
need(Math.abs(num('stroke') - 2.82) < 0.02, `1.0 mg 注射后活塞行程 2.82 mm（${rd('stroke')}）`);
need(Math.abs(partBox('bung').min - bungB.min - 2.82) < 0.05, `活塞网格真的前进了 2.82 mm（${bungB.min.toFixed(2)} → ${partBox('bung').min.toFixed(2)}）`);
need(Math.abs(num('left') - (left0 - 1)) < 0.03, `剩余药量减少 1.0 mg（${left0} → ${rd('left')}）`);
need(num('dose') === 0, `注射到底旋钮回到 0（${rd('dose')}）`);

/* ---------- 7. 剂量档决定位移：0.5 mg 正好一半 ---------- */
await tap('#dose-half', 600);
await tap('#inject', 2400);
need(Math.abs(num('stroke') - 4.23) < 0.03, `再注 0.5 mg → 累计 4.23 mm（${rd('stroke')}）`);

/* ---------- 8. 卸针 / 装针 ---------- */
const needleX = partBox('needle').min;
await tap('#needle', 700);
need(!partBox('needle').vis, '卸针后针头从场景里消失');
need(partBox('needle').min > needleX + 10, `针头是拧出去才消失的（${needleX.toFixed(0)} → ${partBox('needle').min.toFixed(0)}）`);
await tap('#dose-full', 600);
await tap('#inject', 350);
need(txt('#feedback').includes('针'), `没装针时注射被拒绝（${txt('#feedback')}）`);
await tap('#needle', 700);
need(partBox('needle').vis, '再点一次把针头装回去');

/* ---------- 9. 声明式实验控件：滑杆与按钮 ---------- */
const slider = $('[data-exp="dose"]');
need(!!slider, '剂量滑杆存在');
if (slider) {
  const s0 = num('stroke');
  slider.value = '3';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(500);
  need(Math.abs(num('dose') - 0.375) < 0.01, `滑杆拨 3 格 → 0.375 mg（${rd('dose')}）`);
  const inj = $('[data-exp="inject"]');
  need(!!inj, '声明式「按注射按钮」存在');
  inj.click(); await wait(2200);
  need(num('stroke') > s0 + 0.9, `声明式注射按钮推进了活塞（${rd('stroke')}）`);
}

/* ---------- 10. 取景按钮移动相机；剖开切换 ---------- */
if (stage) {
  const a = cam();
  await tap('#focus-tip', 260);
  const b = cam();
  await tap('#focus-drive', 260);
  const c = cam();
  need(a !== b && b !== c, `取景按钮移动了相机（${a} → ${b} → ${c}）`);
  await tap('#focus-cart', 200);
  await tap('[data-tool="cut"]', 260);
  need($('[data-tool="cut"]').getAttribute('aria-pressed') === 'false', '剖开可以关掉');
  await tap('[data-tool="cut"]', 260);
  need($('[data-tool="cut"]').getAttribute('aria-pressed') === 'true', '剖开可以打开');
} else {
  bad.push('拿不到三维舞台，取景与剖开没法验证');
}

/* ---------- 11. 关卡推进链路：装 → 实验 → 答题 → 徽章 → 下一关 ---------- */
await tap('#restart', 400);
need(txt('#plabel') === '0 / 12 块模块', `重新开始后进度归零（${txt('#plabel')}）`);
need(!partBox('capOuter').vis && !partBox('needle').vis, '重新开始后零件都不在场景里');

async function placeNext(n) {
  for (let i = 0; i < n; i++) {
    const card = document.querySelector('#mlist .card:not([disabled])');
    if (!card) break;
    card.click();
    await wait(80);
    const place = document.querySelector('#place');
    if (place && !place.disabled) place.click();
    await wait(140);
  }
}
await placeNext(3);
need(txt('#plabel') === '3 / 12 块模块', `第 1 关装完 3 块（${txt('#plabel')}）`);
need(!!$('#cut-look'), '第 1 关出现剖开实验按钮');
await tap('#cut-look', 300);
need($('[data-tool="cut"]').getAttribute('aria-pressed') === 'true', '剖开实验真的打开了剖切');
await tap('#to-quiz', 250);
document.querySelector('[data-opt="0"]')?.click();
await wait(250);
need(txt('#feedback').includes('获得'), `答对获得徽章（${txt('#feedback')}）`);
await tap('#next', 300);

await placeNext(5);
need(txt('#plabel') === '8 / 12 块模块', `第 2 关装完 5 块（${txt('#plabel')}）`);
const strokeBefore = num('stroke');
await tap('#dose-full', 700);
need(Math.abs(num('stroke') - strokeBefore) < 0.001, '第 2 关实验：拨 8 格时丝杠行程不变');
need(Math.abs(num('dose') - 1.0) < 0.001, `第 2 关实验拨到 1.0 mg（${rd('dose')}）`);
await tap('#to-quiz', 250);
document.querySelector('[data-opt="1"]')?.click();
await wait(250);
need(txt('#feedback').includes('获得'), '第 2 关答对');
await tap('#next', 300);

await placeNext(4);
need(txt('#plabel') === '12 / 12 块模块', `12 块全部装完（${txt('#plabel')}）`);
need(!!$('#uncap-outer'), '第 3 关出现取用流程按钮');
await tap('#uncap-outer', 600);
need(!partBox('capOuter').vis, '第 3 关拔外帽生效');
await tap('#uncap-inner', 600);
need(!partBox('capInner').vis, '第 3 关拔内帽生效');
await tap('#dose-full', 700);
await tap('#inject', 2600);
need(num('stroke') > 2.7, `第 3 关注射推进活塞（${rd('stroke')}）`);
await tap('#to-quiz', 250);
document.querySelector('[data-opt="1"]')?.click();
await wait(250);
need(txt('#feedback').includes('获得'), '第 3 关答对');
await tap('#next', 500);
need(txt('#feedback').includes('装配完成') || txt('#feedback').includes('自由'), `通关进入自由实验（${txt('#feedback')}）`);
need(txt('#bcount').includes('3'), `三枚徽章都拿到（${txt('#bcount')}）`);

/* 收尾：停在整机（剖开）画面上，给缩略图与像素探针留证据 */
$('#free-lab').click();
await wait(600);
await tap('#uncap', 600);
await tap('#uncap', 600);
await tap('#dose-full', 900);
return { ok, bad };
