/* 电动牙刷 · 接线（规则在 logic.mjs，几何在 model.mjs，文案在 manifest.mjs） */
const game = createGame();
const state = game.state;
const CH = MANIFEST.chapters;
const MODS = MANIFEST.modules;
const CYCLE = Math.PI * 2;
const DRIVE = THREE.MathUtils.degToRad(3);
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
    if (!state.placed.includes('core')) return;
    if (['shaft', 'rotor', 'stator', 'spring', 'bearings'].includes(key)) stage.fitCamera('drive');
    else if (['coupler', 'brush', 'bristles', 'neckseal'].includes(key)) stage.fitCamera('head');
    else stage.fitCamera('all');
  },
  tick: (dt) => tick(dt),
});
lab.attached3d = true;
lab.stage = stage;
const view = stage.view;
view.cut = true;
let clock = 0;

/* ---------- 运动 ---------- */
function motionAngle() {
  if (state.running) return DRIVE * Math.sin(clock * CYCLE * 2 * view.speed);
  if (view.manualStart !== null) {
    const t = clock - view.manualStart;
    if (t < 2.6) return DRIVE * Math.exp(-2 * t) * Math.cos(CYCLE * 2 * t);
  }
  return 0;
}

/* ---------- 读数 ---------- */
function updateReadout() {
  const deg = (view.angle * 180) / Math.PI;
  const has = state.placed.includes('core');
  lab.paint({
    angle: has ? (deg >= 0 ? '+' : '') + deg.toFixed(1) + '° / ±3°' : '—',
    mode: !has ? '动力芯未装' : state.running ? '通电往复' : state.phase === 'quiz' && state.chapter === 0 ? '手拨回中' : '停机',
  });
}

/* ---------- 教练面板 ---------- */
lab.task(({ chapter: ch, chapterIndex: i, phase }) => {
  const next = game.current();
  const sel = MODS.find((m) => m.id === state.selected);

  if (phase === 'build') {
    const turnBox =
      state.selected === 'head'
        ? `<button class="action" id="turn">旋转刷头 ${state.rotation * 90}°</button>
           <p class="note">${state.rotation === 0 ? 'D 形平面已对齐，可以装上刷头。' : '继续转到 0°，让内孔平面与金属轴对齐。'}</p>`
        : '';
    return {
      html: `<p class="label">现在要装</p><h3>${next ? next.name : ''}</h3><p>${next ? next.tip : ''}</p>
        <div class="note">${sel ? '已拿起：' + sel.name : '从下方零件盘选择一块模块'}</div>
        <button class="primary action" id="place" ${sel ? '' : 'disabled'}>装入当前模块</button>
        ${turnBox}
        <div class="sub"><button id="undo" ${MODS.find((m) => m.id === state.placed.at(-1))?.chapter === state.chapter ? '' : 'disabled'}>撤回一步</button></div>`,
      bind(root) {
        root.querySelector('#place').onclick = () => act('place');
        root.querySelector('#undo').onclick = () => act('undo');
        const t = root.querySelector('#turn');
        if (t) t.onclick = () => act('turn');
      },
    };
  }

  if (phase === 'experiment') {
    const again =
      state.chapter === 0
        ? '<button class="action" id="manual-again">再手拨一次</button>'
        : '';
    return {
      html: `<p class="label">模块已归位，现在验证</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
        <button class="primary action" id="experiment">${ch.exp}</button>${again}
        <div class="sub"><button id="undo">撤回最后一块</button></div>`,
      bind(root) {
        root.querySelector('#experiment').onclick = () => act('experiment');
        const a = root.querySelector('#manual-again');
        if (a) a.onclick = () => act('experiment');
        root.querySelector('#undo').onclick = () => act('undo');
      },
    };
  }

  if (phase === 'quiz') {
    return {
      html: `<p class="label">看一看，想一想</p><h3>${ch.q}</h3>
        <div class="options">${ch.options.map((o, k) => `<button data-a="${k}"><b>${String.fromCharCode(65 + k)}</b>${o}</button>`).join('')}</div>
        ${state.chapter === 0 ? '<div class="sub"><button id="manual-again">再手拨一次</button></div>' : ''}
        <p class="note" style="margin-top:10px">答错不会清空进度，观察会帮你找到原因。</p>`,
      bind(root) {
        root.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => act('answer', Number(b.dataset.a))));
        const a = root.querySelector('#manual-again');
        if (a) a.onclick = () => act('experiment');
      },
    };
  }

  if (phase === 'checkpoint') {
    return {
      html: `<div class="badge" aria-hidden="true">✓</div><p class="label">新徽章</p><h3>${ch.badge}</h3>
        <p>${ch.why}</p>
        <button class="primary action" id="next">${i === CH.length - 1 ? '进入自由实验' : '继续第 ' + (i + 2) + ' 关'}</button>`,
      bind(root) {
        root.querySelector('#next').onclick = () => act('next');
      },
    };
  }

  return {
    html: `<div class="labgrid">
        <button class="primary" id="power">${state.running ? '停机' : '接通供电'}</button>
        <button id="head">${state.headOff ? '装回刷头' : '拔下刷头'}</button>
        <button id="focus-all">看整机</button>
        <button id="focus-drive">看动力芯</button>
        <button id="focus-head">看刷头</button>
      </div>
      <label class="speed" for="speed">摆动速度 <output id="speed-out">${view.speed.toFixed(2)}×</output>
        <input id="speed" type="range" min="0.25" max="3" step="0.25" value="${view.speed}"></label>
      <div class="flow ${state.running ? 'on' : ''}"><span>电池</span><i>›</i><span>驱动板</span><i>›</i><span>线圈</span><i>›</i><span class="${state.headOff ? 'off' : ''}">刷头</span></div>
      <p class="note">${state.headOff ? '刷头已拔下：金属轴空载摆动，内衬随刷头离开。' : '先接通供电，再拔下刷头做空载对照。'}</p>
      <div class="earned">${CH.map((c) => `<span>✓ ${c.badge}</span>`).join('')}</div>`,
    bind(root) {
      root.querySelector('#power').onclick = () => act('power');
      root.querySelector('#head').onclick = () => act('head');
      root.querySelector('#focus-all').onclick = () => stage.fitCamera('all');
      root.querySelector('#focus-drive').onclick = () => stage.fitCamera('drive');
      root.querySelector('#focus-head').onclick = () => stage.fitCamera('head');
      const sp = root.querySelector('#speed');
      sp.oninput = () => {
        view.speed = Number(sp.value);
        root.querySelector('#speed-out').textContent = view.speed.toFixed(2).replace(/0$/, '') + '×';
      };
    },
  };
});

/* ---------- 刷新 ---------- */
const BOX = ['第一盒 · 动力核心', '第二盒 · 能量回路', '第三盒 · 刷头连接'];
function refresh() {
  const labPhase = state.phase === 'lab';
  const s = lab.state;
  s.chapter = state.chapter;
  s.phase = state.phase;
  s.placed = state.placed;
  s.selected = state.selected;
  s.completed = state.completed;
  s.badges = state.completed.map((ok, k) => (ok ? CH[k].badge : null)).filter(Boolean);
  s.progress = { done: state.placed.length, total: MODS.length };
  s.cardsLocked = state.phase !== 'build';
  s.visible.readout = true;
  s.coach = labPhase
    ? { tag: '三个原理，全部验证', title: '你的牙刷，摆起来了', intro: '自由实验：通断供电、拔刷头做空载对照、剖开看内部。' }
    : null;
  s.trayTitle = labPhase ? '你的装配记录' : BOX[state.chapter];
  s.trayHint = labPhase ? '10 块模块全部到位' : '点选模块，再拖到蓝色位置';
  s.stageHint = labPhase
    ? '通断供电、拔刷头、剖开，验证你刚刚发现的因果。'
    : state.phase === 'build'
    ? '选一块模块，把它放到蓝色轮廓里。'
    : state.phase === 'experiment'
    ? '先做实验，再回答挑战。'
    : '这一段装好了，去验证你的发现。';
  lab.render();
  $('[data-tool="cut"]').setAttribute('aria-pressed', String(view.cut));
}

/* ---------- 动作 ---------- */
function act(name, ...args) {
  const beforeChapter = state.chapter;
  const res = game[name](...args);
  lab.state.feedback = res.message || '';
  lab.state.feedbackKind = res.ok ? 'success' : 'error';
  if (res.ok && res.learn) lab.setDiscovery(res.learn);
  if (res.ok) {
    if (res.kind === 'restart' || res.kind === 'demo') lab.setDiscovery('');
    if (res.kind === 'manual') view.manualStart = clock;
    if (res.kind === 'headOff') view.detachedAngle = view.angle;
    if (res.kind === 'restart') {
      view.offsets.clear();
      view.manualStart = null;
      view.detachedAngle = 0;
      view.cut = true;
    }
    if (res.kind === 'chapter' && state.chapter !== beforeChapter) stage.fitCamera('all');
    if (res.kind === 'complete') {
      lab.celebrate();
      stage.fitCamera('all');
    }
  }
  refresh();
  return res;
}

/* ---------- 循环 ---------- */
function tick(dt) {
  clock += dt;
  view.angle = motionAngle();
  updateReadout();
}

/* ---------- 事件 ---------- */
lab.on('select', (id) => act('select', id));
lab.on('place', () => act('place'));
lab.on('undo', () => act('undo'));
lab.on('answer', (i) => act('answer', i));
lab.on('next', () => act('next'));
lab.on('restart', () => act('restart'));
lab.on('free', () => {
  act('demo');
  stage.fitCamera('all');
});
lab.on('tool', (id) => {
  if (id === 'cut') view.cut = $('[data-tool="cut"]').getAttribute('aria-pressed') === 'true';
  if (id === 'home') stage.fitCamera('all');
  if (id === 'rotate' || id === 'pan') stage.setNavigation(id);
  refresh();
});

refresh();
updateReadout();   // 首帧前先把读数填上（tick 之前是一屏占位）
stage.start();
