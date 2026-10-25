/* 球形门锁 · 接线（几何在 model.mjs，规则在 logic.mjs，文案在 manifest.mjs） */
import * as THREE from 'three';

const game = createGame();
const state = game.state;
const CH = MANIFEST.chapters;
const MODS = MANIFEST.modules;
const $ = (s) => document.querySelector(s);

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
    if (key === 'latchBolt' && state.phase !== 'build') return void act('pushBolt');
    if (['latchHousing', 'latchBolt', 'latchSpring', 'retractor', 'faceplate', 'faceScrews', 'strike'].includes(key))
      return stage.fitCamera('latch');
    if (key === 'knobIn') return stage.fitCamera('knob');
    if (['knobOut', 'cylHousing', 'plug', 'pinStack', 'clutch', 'key'].includes(key)) return stage.fitCamera('cylinder');
  },
  tick: (dt) => tick(dt),
});
lab.attached3d = true;
lab.stage = stage;
const view = stage.view;
view.cut = true;
view.push = 0;
view.pushT = null;

/* ---------- 读数：全部取自 model 的同一个驱动量 ---------- */
function keyLabel() {
  return state.keyKind === 'right' ? '对钥匙' : state.keyKind === 'wrong' ? '错钥匙' : '无钥匙';
}
function updateReadout() {
  const pull = MODEL.boltPull(state, view);          // 与 applyMotion 同一个函数
  const latch = state.placed.includes('latch');
  const out = state.placed.includes('knobOut');
  lab.paint({
    spindle: Math.round(state.spindle) + '°',
    bolt: latch ? (MODEL.THROW - pull).toFixed(1) + ' mm' : '—',
    pull: latch ? pull.toFixed(1) + ' mm' : '—',
    clutch: out ? (state.locked ? '断开 · 空转' : '接通 · 传动') : '—',
    cylinder: out ? Math.round(state.plug) + '° · ' + keyLabel() : '—',
  });
}

/* ---------- 每帧：推锁舌的按压脉冲 ---------- */
function tick(dt) {
  if (view.pushT !== null) {
    view.pushT += dt;
    const t = view.pushT / 0.95;
    if (t >= 1) { view.push = 0; view.pushT = null; }
    else view.push = MODEL.THROW * Math.sin(t * Math.PI);
  }
  updateReadout();
}
function pushPulse() { view.pushT = 0; }

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
    return {
      html: `<p class="label">模块已归位，现在验证一下</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
        <button class="primary action" id="experiment">${ch.exp}</button>
        <p class="note">也可以直接点三维里的斜舌、或拖执手自己试。</p>${undoBtn}`,
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
        root.querySelector('#again').onclick = () => act('experiment');
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

  const unlocked = !state.locked;
  return {
    html: `<div class="labgrid">
        <button class="primary" id="turn-in">${state.knobIn > 5 ? '松开内执手' : '转内执手 90°'}</button>
        <button id="turn-out">${state.knobOut > 5 ? '松开外执手' : '转外执手 90°'}</button>
        <button id="key-right">插对钥匙</button>
        <button id="key-wrong">插错钥匙</button>
        <button id="key-off">拔钥匙</button>
        <button id="plug">${state.plug > 5 ? '转钥匙锁上' : '转钥匙解锁'}</button>
        <button id="push">推锁舌</button>
        <button id="focus-cyl">看锁芯</button>
      </div>
      <div class="flow ${unlocked ? 'on' : ''}"><span>钥匙</span><i>›</i><span>${unlocked ? '离合接通' : '离合断开'}</span><i>›</i><span class="${unlocked ? '' : 'off'}">外执手</span><i>›</i><span>方轴</span><i>›</i><span>锁舌</span></div>
      <p class="note">${unlocked
        ? '离合已接通：外执手能带动方轴，锁舌跟着缩回。'
        : state.keyKind === 'wrong'
          ? '钥匙是错的：第 3 组弹子跨着剪切线，转子被顶死，转不动。'
          : '先插对钥匙再转锁芯，离合套才会被推进外执手。'}</p>
      <div class="earned">${CH.map((c) => `<span>✓ ${c.badge}</span>`).join('')}</div>`,
    bind(root) {
      root.querySelector('#turn-in').onclick = () => act('knob', 'in', state.knobIn > 5 ? 0 : 90);
      root.querySelector('#turn-out').onclick = () => act('knob', 'out', state.knobOut > 5 ? 0 : 90);
      root.querySelector('#key-right').onclick = () => act('insertKey', 'right');
      root.querySelector('#key-wrong').onclick = () => act('insertKey', 'wrong');
      root.querySelector('#key-off').onclick = () => act('insertKey', 'none');
      root.querySelector('#plug').onclick = () => act('turnKey', state.plug > 5 ? 0 : 90);
      root.querySelector('#push').onclick = () => act('pushBolt');
      root.querySelector('#focus-cyl').onclick = () => stage.fitCamera('cylinder');
    },
  };
});

/* ---------- 刷新显示态 ---------- */
const BOX = ['第一盒 · 锁舌与扣板', '第二盒 · 执手与方轴', '第三盒 · 锁芯与钥匙'];
function refresh() {
  const s = lab.state;
  const labPhase = state.phase === 'lab';
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
    ? { tag: '三个发现，全部解锁', title: '你的门锁，装完了', intro: '自由实验：转执手、插错/对钥匙、剖开看五组弹子。' }
    : null;
  s.trayTitle = labPhase ? '你的装配记录' : BOX[state.chapter];
  s.trayHint = labPhase ? '8 块模块，21 件零件全部到位' : '点选模块，再拖到门上的缺口';
  s.stageHint = labPhase
    ? '拖执手转方轴；插错钥匙看那组弹子；「剖开看」切出半剖锁芯。'
    : state.phase === 'build'
      ? '把选中的模块拖到门上它该在的位置。'
      : state.phase === 'experiment'
        ? '这一段已经拼好，去试验你的发现。'
        : '看清谁在动，再完成原理挑战。';
  lab.render();
  $('[data-tool="cut"]').setAttribute('aria-pressed', String(view.cut));
  updateReadout();
}

/* ---------- 动作 ---------- */
function say(message, kind) {
  lab.state.feedback = message || '';
  lab.state.feedbackKind = kind || '';
  const fb = document.getElementById('feedback');
  if (fb) { fb.className = 'feedback' + (kind ? ' ' + kind : ''); fb.textContent = message || ''; }
}
const ACTIONS = {
  select: (id) => game.select(id),
  place: (onTarget) => game.place(onTarget !== false),
  undo: () => game.undo(),
  experiment: () => game.experiment(),
  answer: (i) => game.answer(i),
  next: () => game.next(),
  pushBolt: () => game.pushBolt(),
  knob: (side, deg) => game.knob(side, deg),
  insertKey: (k) => game.insertKey(k),
  turnKey: (d) => game.turnKey(d),
  restart: () => game.restart(),
  demo: () => game.demo(),
};

function act(name, ...args) {
  const beforeChapter = state.chapter, beforePhase = state.phase;
  const res = ACTIONS[name](...args);
  say(res.message, res.ok ? 'success' : 'error');
  if (res.ok) {
    if (res.learn) lab.setDiscovery(res.learn);
    if (res.kind === 'push') pushPulse();
    if (['restart', 'demo'].includes(res.kind)) {
      view.offsets.clear();
      view.push = 0; view.pushT = null;
      view.cut = true;
      stage.setNavigation('rotate');
      lab.setDiscovery('');
      stage.fitCamera('all');
    }
    if (res.kind === 'restart' || state.chapter !== beforeChapter) stage.fitCamera('all');
    if (['correct', 'complete'].includes(res.kind)) lab.celebrate();
  }
  if (beforePhase !== state.phase && ['wrong'].includes(res.kind)) say(res.message, 'error');
  refresh();
  return res;
}

/* ---------- 拖执手：水平拖 → 0–90°（松手不回弹，面板上有「松开」） ---------- */
const canvas = stage.renderer.domElement;
const dragRay = new THREE.Raycaster();
const dragNdc = new THREE.Vector2();
let knobDrag = null;
function rayFrom(e) {
  const r = canvas.getBoundingClientRect();
  dragNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
  dragRay.setFromCamera(dragNdc, stage.camera);
}
function knobUnder(e) {
  rayFrom(e);
  for (const [side, key] of [['in', 'knobIn'], ['out', 'knobOut']]) {
    if (!state.placed.includes(key)) continue;
    const p = MODEL.byKey.get(key);
    if (!p) continue;
    const hit = dragRay.intersectObject(p.obj, true).find((h) => h.object.visible);
    if (hit) return side;
  }
  return null;
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || view.navigation !== 'rotate' || view.drag) return;
  if (state.phase === 'build' || state.phase === 'checkpoint') return;
  const side = knobUnder(e);
  if (!side) return;
  knobDrag = { side, pointerId: e.pointerId, x0: e.clientX, base: side === 'in' ? state.knobIn : state.knobOut };
  stage.controls.enabled = false;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  canvas.style.cursor = 'grabbing';
  e.preventDefault();
  e.stopImmediatePropagation();
}, { capture: true });
canvas.addEventListener('pointermove', (e) => {
  if (!knobDrag || knobDrag.pointerId !== e.pointerId) return;
  const deg = Math.max(0, Math.min(MODEL.MAX_TURN, knobDrag.base + (e.clientX - knobDrag.x0) * 0.62));
  const res = game.knob(knobDrag.side, deg);
  say(res.message, res.ok ? (res.engaged === false ? 'error' : '') : 'error');
  e.preventDefault();
  e.stopImmediatePropagation();
}, { capture: true });
function endKnob(e) {
  if (!knobDrag || (e && knobDrag.pointerId !== e.pointerId)) return;
  knobDrag = null;
  stage.controls.enabled = true;
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  canvas.style.cursor = 'grab';
  refresh();
  if (e) e.stopImmediatePropagation();
}
canvas.addEventListener('pointerup', (e) => endKnob(e), { capture: true });
canvas.addEventListener('pointercancel', (e) => endKnob(e), { capture: true });

/* ---------- 事件 ---------- */
lab.on('select', (id) => act('select', id));
lab.on('place', () => act('place'));
lab.on('undo', () => act('undo'));
lab.on('answer', (i) => act('answer', i));
lab.on('next', () => act('next'));
lab.on('restart', () => act('restart'));
lab.on('free', () => { act('demo'); stage.fitCamera('all'); });
lab.on('experiment', ({ id, value }) => {
  // 实验台滑杆：内执手转角 → 方轴/锁舌跟着变（读数与几何同源）
  if (id === 'knobAngle') act('knob', 'in', Number(value) || 0);
});
lab.on('tool', (id) => {
  if (id === 'cut') view.cut = $('[data-tool="cut"]').getAttribute('aria-pressed') === 'true';
  if (id === 'home') stage.fitCamera('all');
  if (id === 'rotate' || id === 'pan') stage.setNavigation(id);
  refresh();
});

refresh();
say('从下方零件盒选中「预装锁舌组件」，开始第一步。', '');
if (!canvas.style.cursor) canvas.style.cursor = 'grab';
updateReadout();   // 首帧前先把读数填上（tick 之前是一屏占位）
stage.start();
