/* 手摇发电手电筒 · 接线（规则在 logic.mjs，几何在 model.mjs，文案在 manifest.mjs） */
const game = createGame();
const state = game.state;
const CH = MANIFEST.chapters;
const MODS = MANIFEST.modules;
const $ = (s) => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const lab = mountLab(MANIFEST);
const stage = createStage({
  host: document.getElementById('viewport'),
  stageEl: document.getElementById('stage'),
  world: MODEL.world,
  modules: MODS,
  model: MODEL,
  config: MANIFEST.scene,
  getState: () => state,
  nextModule: () => game.current(),
  canDrag: () => state.phase === 'build' && !!state.selected,
  targetAlways: () => true,
  onDrop: (id, onTarget) => act('place', onTarget),
  onPickKey: (key) => {
    if (['idlerGear', 'crankGear', 'motorPinion', 'gearPlate'].includes(key)) stage.fitCamera('gears');
    else if (key === 'generator') stage.fitCamera('gen');
    else if (['headShell', 'reflector', 'lens', 'led'].includes(key)) stage.fitCamera('head');
    else stage.fitCamera('all');
  },
  tick: (dt) => tick(dt),
});
lab.attached3d = true;
lab.stage = stage;
const view = stage.view;
view.cut = true;
view.light = 0;
view.autoCrank = null;

/* ---------- 每帧：摇动、放电、灯光 ---------- */
function tick(dt) {
  view.clock += dt;
  stepAutoCrank(dt);
  game.update(dt);
  view.light += (game.brightness() - view.light) * Math.min(1, dt * 10);
  updateReadout();
}
function stepAutoCrank(dt) {
  const ac = view.autoCrank;
  if (!ac) return;
  const take = Math.min(ac.left, (ac.total * dt) / ac.duration);
  game.crank(take, dt);
  ac.left -= take;
  if (ac.left <= 1e-4) view.autoCrank = null;
}
function startAutoCrank(turns, duration) { view.autoCrank = { left: turns, total: turns, duration }; }

function updateReadout() {
  const has = state.placed.includes('plate');
  lab.paint({
    turns: has ? state.crankTurns.toFixed(2) + ' / ' + (state.crankTurns * 16).toFixed(1) + ' 圈' : '0.00 / 0.0 圈',
    rpm: has ? Math.round(game.rpm()) + ' rpm' : '—',
    charge: has ? Math.round(state.charge * 100) + '%' : '—',
  });
}

/* ---------- 教练面板 ---------- */
lab.task(({ chapter: ch, chapterIndex: i, phase }) => {
  const next = game.current();
  const sel = MODS.find((m) => m.id === state.selected);
  const undoBtn = `<div class="sub"><button id="undo" ${MODS.find((m) => m.id === state.placed.at(-1))?.chapter === state.chapter ? '' : 'disabled'}>撤回一步</button></div>`;

  if (phase === 'build') {
    return {
      html: `<p class="label">现在要装</p><h3>${next ? next.name : ''}</h3><p>${next ? next.tip : ''}</p>
        <div class="note">${sel ? '已拿起：' + sel.name : '从下方零件盒选择一块模块'}</div>
        <button class="primary action" id="place" ${sel ? '' : 'disabled'}>装入当前模块</button>
        ${undoBtn}`,
      bind(root) {
        root.querySelector('#place').onclick = () => act('place');
        root.querySelector('#undo').onclick = () => act('undo');
      },
    };
  }

  if (phase === 'experiment') {
    const label = state.chapter === 0 ? '摇一圈' : state.chapter === 1 ? '摇三圈' : '摇五圈';
    return {
      html: `<p class="label">模块已归位，现在验证一下</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
        <button class="primary action" id="experiment">${label}</button>
        <p class="note">也可以直接拖三维里的摇柄，自己摇。</p>${undoBtn}`,
      bind(root) {
        root.querySelector('#experiment').onclick = () => act('experiment');
        root.querySelector('#undo').onclick = () => act('undo');
      },
    };
  }

  if (phase === 'quiz') {
    return {
      html: `<p class="label">看一看，想一想</p><h3>${ch.q}</h3>
        <div class="options">${ch.options.map((o, k) => `<button data-opt="${k}"><b>${String.fromCharCode(65 + k)}</b>${o}</button>`).join('')}</div>
        <button class="action" id="again" style="margin-top:12px">${ch.exp}</button>
        <p class="note" style="margin-top:10px">答错不会清空进度，观察会帮你找到原因。</p>`,
      bind(root) {
        root.querySelector('#again').onclick = () => {
          startAutoCrank(state.chapter === 0 ? 1 : state.chapter === 1 ? 3 : 5, state.chapter === 0 ? 1.35 : 2);
          lab.state.feedback = ch.expText;
          lab.state.feedbackKind = '';
          lab.render();
        };
      },
    };
  }

  if (phase === 'checkpoint') {
    return {
      html: `<div class="badge" aria-hidden="true">✓</div><p class="label">新发现徽章</p><h3>${ch.badge}</h3>
        <p>${ch.why}</p>
        <button class="primary action" id="next">${i === CH.length - 1 ? '进入自由实验室' : '继续第 ' + (i + 2) + ' 关'}</button>`,
      bind(root) {
        root.querySelector('#next').onclick = () => act('next');
      },
    };
  }

  return {
    html: `<div class="labgrid">
        <button class="primary" id="crank-once">摇五圈</button>
        <button id="toggle" aria-pressed="${state.switchOn}">${state.switchOn ? '关掉开关' : '合上开关'}</button>
        <button id="focus-gears">看齿轮</button>
        <button id="focus-head">看灯头</button>
        <button id="focus-all">看整机</button>
      </div>
      <div class="flow ${state.charge > 0.05 ? 'on' : ''}"><span>手摇</span><i>›</i><span>16:1</span><i>›</i><span>发电机</span><i>›</i><span>整流</span><i>›</i><span>电容</span><i>›</i><span class="${state.switchOn ? '' : 'off'}">LED</span></div>
      <p class="note">${state.switchOn ? '开关合上：摇动时灯亮，停手后电容继续供电。' : '开关断开：摇动只给电容充电，灯不亮。'}</p>
      <div class="earned">${CH.map((c) => `<span>✓ ${c.badge}</span>`).join('')}</div>`,
    bind(root) {
      root.querySelector('#crank-once').onclick = () => startAutoCrank(5, 2.6);
      root.querySelector('#toggle').onclick = () => act('toggleSwitch');
      root.querySelector('#focus-gears').onclick = () => stage.fitCamera('gears');
      root.querySelector('#focus-head').onclick = () => stage.fitCamera('head');
      root.querySelector('#focus-all').onclick = () => stage.fitCamera('all');
    },
  };
});

/* ---------- 刷新显示态 ---------- */
const BOX = ['第一盒 · 增速传动', '第二盒 · 整流与储电', '第三盒 · 外壳'];
function refresh() {
  const labPhase = state.phase === 'lab';
  const s = lab.state;
  s.chapter = state.chapter;
  s.phase = state.phase;
  s.placed = state.placed;
  s.selected = state.selected;
  s.completed = state.completed;
  s.badges = labPhase ? CH.map((c) => c.badge) : state.completed.map((ok, k) => (ok ? CH[k].badge : null)).filter(Boolean);
  s.progress = { done: state.placed.length, total: MODS.length };
  s.cardsLocked = state.phase !== 'build';
  s.visible.readout = true;
  s.coach = labPhase
    ? { tag: '三个发现，全部解锁', title: '你的手电，摇出光来了', intro: '自由实验：摇、停、开关灯，也可以剖开看齿轮怎么转。' }
    : null;
  s.trayTitle = labPhase ? '你的装配记录' : BOX[state.chapter];
  s.trayHint = labPhase ? '12 块模块，拼出了一条完整能量链' : '点选模块，再拖到机身上';
  s.stageHint = labPhase
    ? '拖摇柄就能摇；停手看余辉，开关灯看差别。'
    : state.phase === 'build'
    ? '把选中的模块拖到机身上它该在的位置。'
    : state.phase === 'experiment'
    ? '这一段已经拼好，去试验你的发现。'
    : '看清谁在动，再完成原理挑战。';
  lab.render();
  $('[data-tool="cut"]').setAttribute('aria-pressed', String(view.cut));
}

/* ---------- 动作 ---------- */
const ACTIONS = {
  select: (id) => game.select(id),
  place: (onTarget) => game.place(onTarget !== false),
  undo: () => game.undo(),
  experiment: () => game.experiment(),
  answer: (i) => game.answer(i),
  next: () => game.next(),
  toggleSwitch: () => game.toggleSwitch(),
  restart: () => game.restart(),
  demo: () => game.demo(),
};

function act(name, ...args) {
  const beforeChapter = state.chapter, beforePhase = state.phase;
  const res = ACTIONS[name](...args);
  lab.state.feedback = res.message || '';
  lab.state.feedbackKind = res.ok ? 'success' : 'error';
  if (res.learn) lab.setDiscovery(res.learn);
  if (res.ok) {
    if (res.kind === 'ratio') startAutoCrank(1, 1.35);
    if (res.kind === 'glow') startAutoCrank(state.chapter === 2 ? 5 : 3, state.chapter === 2 ? 2.6 : 2.0);
    if (['correct', 'undo', 'restart', 'chapter', 'complete', 'switch'].includes(res.kind)) view.autoCrank = null;
    if (res.kind === 'restart' || res.kind === 'demo') {
      view.offsets.clear();
      view.autoCrank = null;
      view.light = 0;
      view.cut = true;
      stage.setNavigation('rotate');
      lab.setDiscovery('');
    }
    if (res.kind === 'restart' || state.chapter !== beforeChapter) stage.fitCamera('all');
    if (res.kind === 'correct' || res.kind === 'complete') lab.celebrate();
  }
  if (beforePhase !== state.phase && !['correct', 'wrong', 'complete'].includes(res.kind)) {
    lab.state.feedback = lab.state.feedback || '';
    lab.state.feedbackKind = '';
  }
  refresh();
  return res;
}

/* ---------- 摇柄：绕轴心拖一圈就摇一圈 ---------- */
const canvas = stage.renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let crankDrag = null;
function pointerRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
  raycaster.setFromCamera(ndc, stage.camera);
}
function crankAxis() { return stage.project(new THREE.Vector3(-37, 8, 22)); }
function crankAngleAt(e) {
  const r = canvas.getBoundingClientRect(), c = crankAxis();
  return Math.atan2(e.clientY - r.top - c.y, e.clientX - r.left - c.x);
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || view.navigation === 'pan' || view.drag) return;
  if (!game.chainReady() || state.phase === 'build' || state.phase === 'checkpoint' || view.autoCrank) return;
  pointerRay(e);
  const hit = raycaster.intersectObject(MODEL.byKey.get('crank').obj, true).find((h) => h.object.visible);
  if (!hit) return;
  crankDrag = { pointerId: e.pointerId, angle: crankAngleAt(e), last: performance.now() };
  stage.controls.enabled = false;
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  canvas.style.cursor = 'grabbing';
  e.preventDefault();
  e.stopImmediatePropagation();
}, { capture: true });

canvas.addEventListener('pointermove', (e) => {
  if (!crankDrag || crankDrag.pointerId !== e.pointerId) return;
  const a = crankAngleAt(e);
  let d = a - crankDrag.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  crankDrag.angle = a;
  const now = performance.now();
  const dt = Math.max(0.008, (now - crankDrag.last) / 1000);
  crankDrag.last = now;
  // 屏幕角度顺时针为正，绕 z 正向旋转在屏幕上是逆时针，取反才跟手
  const res = game.crank(-d / (Math.PI * 2), dt);
  if (!res.ok) { lab.state.feedback = res.message; lab.state.feedbackKind = 'error'; refresh(); }
  e.preventDefault();
  e.stopImmediatePropagation();
}, { capture: true });

function releaseCrank(e, cancel) {
  if (!crankDrag || crankDrag.pointerId !== e.pointerId) return;
  crankDrag = null;
  stage.controls.enabled = true;
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
  stage.setNavigation(view.navigation);
  refresh();
  e.stopImmediatePropagation();
}
canvas.addEventListener('pointerup', (e) => releaseCrank(e, false), { capture: true });
canvas.addEventListener('pointercancel', (e) => releaseCrank(e, true), { capture: true });

/* ---------- 事件 ---------- */
lab.on('select', (id) => act('select', id));
lab.on('place', () => act('place'));
lab.on('undo', () => act('undo'));
lab.on('answer', (i) => act('answer', i));
lab.on('next', () => act('next'));
lab.on('restart', () => act('restart'));
lab.on('free', () => { act('demo'); stage.fitCamera('all'); });
lab.on('tool', (id) => {
  if (id === 'cut') view.cut = $('[data-tool="cut"]').getAttribute('aria-pressed') === 'true';
  if (id === 'home') stage.fitCamera('all');
  if (id === 'rotate' || id === 'pan') stage.setNavigation(id);
  refresh();
});

view.cut = true;
$('[data-tool="cut"]').setAttribute('aria-pressed', 'true');
lab.state.feedback = '从下方零件盒选中「传动板」，开始第一步。';
refresh();
updateReadout();   // 首帧前先把读数填上（tick 之前是一屏占位）
stage.start();
