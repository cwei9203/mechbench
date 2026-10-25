/* 气钉枪 · 接线（规则在 logic.mjs，几何在 model.mjs，文案在 manifest.mjs） */
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
    if (['headcap', 'plunger', 'vspring', 'deflector'].includes(key) && state.placed.includes('headvalve')) stage.fitCamera('valve');
    else if (['trip', 'dwheel', 'latch'].includes(key) && state.placed.includes('trip')) stage.fitCamera('nose');
    else stage.fitCamera('all');
  },
  tick: (dt) => tick(dt),
});
lab.attached3d = true;
lab.stage = stage;
const view = stage.view;
view.cut = true;
view.speed = 60;
const mech = MODEL.mech;
mech.speed = view.speed;
const STROKE_MM = 41.7;

/* ---------- 每一帧：推进动画（压力、击发循环、手压活塞、气流） ---------- */
function tick(dt) {
  mech.now += dt * 1000;
  mech.pressure += ((state.air ? 0.6 : 0) - mech.pressure) * Math.min(1, dt * 2.2);
  if (mech.cycle) {
    mech.cycleT += (dt * mech.speed) / 60;
    MODEL.runCycle(mech);
    if (!mech.cycle && mech.pending) mech.pending = false;
  }
  if (mech.pressT != null) {
    mech.pressT += dt;
    const t = mech.pressT, tau = t - 0.45;
    mech.piston = t < 0.45 ? 0.5 * smoothStep(t / 0.45) : Math.max(0, 0.5 * Math.exp(-2.6 * tau) * Math.abs(Math.cos(7 * tau)));
    if (t > 2.4) { mech.pressT = null; mech.piston = 0; }
  }
  mech.speed = view.speed;
  updateReadout();
}
const smoothStep = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

function updateReadout() {
  const has = state.placed.includes('body');
  lab.paint({
    supply: mech.pressure.toFixed(2) + ' MPa',
    ret: (state.air ? 0.6 : 0.35 * mech.piston).toFixed(2) + ' MPa',
    phase: phaseText(),
    piston: has ? '+' + (mech.piston * STROKE_MM).toFixed(1) + ' mm' : '—',
    nails: state.placed.includes('nails') ? state.nails + ' 支' : '—',
  });
  updateFlow();
}

/* 阶段读数：把动画正在做的那一步说出来，慢放时能对上画面 */
function phaseText() {
  if (!state.placed.includes('body')) return '整机未装';
  if (mech.pressT != null) return mech.pressT < 0.45 ? '压下·充气' : '松手·回弹';
  if (!state.air) return state.trip ? '已压鼻端·未接气' : '未接气';
  if (!state.trip) return '扳机锁定';
  if (!state.trigger) return '待扣扳机';
  if (mech.cycle) {
    const t = mech.cycleT;
    if (t < 0.10) return '阀杆抬起';
    if (t < 0.20) return '头阀打开';
    if (t < 0.30) return '气室进气';
    if (t < 0.55) return '活塞击钉';
    if (t < 0.66) return '阀塞复位';
    if (t < 0.88) return '回程';
    return '排气';
  }
  if (state.jam) return '卡钉·待清障';
  if (state.nails <= 0) return '空击锁定';
  return '待击发';
}

/* 原理链：气源 → 触发阀 → 头阀 → 活塞上腔 → 击针 → 钉 */
function updateFlow() {
  const el = document.getElementById('flow');
  if (!el) return;
  const mark = (k, on) => {
    const e = el.querySelector(`[data-node="${k}"]`);
    if (e) e.classList.toggle('off', !on);
  };
  const open = state.air && state.trip && state.trigger;
  mark('supply', state.air);
  mark('trig', open);
  mark('head', open && (mech.valve > 0.3 || (mech.cycleT > 0.1 && mech.cycleT < 0.72)));
  mark('top', mech.cycleT > 0.24 && mech.cycleT < 0.58);
  mark('driver', mech.piston > 0.05);
  mark('nail', state.nails > 0);
  el.classList.toggle('on', state.air);
}

/* ---------- 教练面板（按阶段给不同的面板） ---------- */
lab.task(({ chapter: ch, chapterIndex: i, phase }) => {
  const next = game.current();
  const sel = MODS.find((m) => m.id === state.selected);
  const undoBtn = `<div class="sub"><button id="undo" ${MODS.find((m) => m.id === state.placed.at(-1))?.chapter === state.chapter ? '' : 'disabled'}>撤回一步</button></div>`;

  if (phase === 'build') {
    return {
      html: `<p class="label">现在要装</p><h3>${next ? next.name : ''}</h3><p>${next ? next.tip : ''}</p>
        <div class="note">${sel ? '已拿起：' + sel.name : '从下方零件盘选择一块模块'}</div>
        <button class="primary action" id="place" ${sel ? '' : 'disabled'}>装入当前模块</button>
        ${undoBtn}`,
      bind(root) {
        root.querySelector('#place').onclick = () => act('place');
        root.querySelector('#undo').onclick = () => act('undo');
      },
    };
  }

  if (phase === 'experiment') {
    if (state.chapter === 0) {
      return {
        html: `<p class="label">模块已归位，现在验证一下</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
          <button class="primary action" id="press">手压活塞</button>
          <button class="action" id="to-quiz">看完现象，去答题</button>${undoBtn}`,
        bind(root) {
          root.querySelector('#press').onclick = () => act('pressPiston');
          root.querySelector('#to-quiz').onclick = () => act('experiment');
          root.querySelector('#undo').onclick = () => act('undo');
        },
      };
    }
    if (state.chapter === 1) {
      const step = state.expStep;
      return {
        html: `<p class="label">三步各试一次，看清两段保险</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
          <button class="step ${step >= 1 ? 'done' : ''}" id="air"><i>${step >= 1 ? '✓' : '1'}</i>接通气源</button>
          <button class="step ${step >= 2 ? 'done' : ''}" id="trip"><i>${step >= 2 ? '✓' : '2'}</i>只压鼻端（不扣扳机）</button>
          <button class="step" id="trig"><i>3</i>只扣扳机（不压鼻端）</button>
          <button class="action" id="to-quiz">看完现象，去答题</button>${undoBtn}`,
        bind(root) {
          root.querySelector('#air').onclick = () => act('demoAir');
          root.querySelector('#trip').onclick = () => act('demoTrip');
          root.querySelector('#trig').onclick = () => act('demoTrigger');
          root.querySelector('#to-quiz').onclick = () => act('experiment');
          root.querySelector('#undo').onclick = () => act('undo');
        },
      };
    }
    return {
      html: `<p class="label">最后一关：打通动力链</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
        <button class="step ${state.air ? 'done' : ''}" id="air"><i>${state.air ? '✓' : '1'}</i>接通气源</button>
        <button class="step ${state.trip ? 'done' : ''}" id="trip"><i>${state.trip ? '✓' : '2'}</i>压鼻端</button>
        <button class="step ${state.trigger ? 'done' : ''}" id="trig"><i>${state.trigger ? '✓' : '3'}</i>扣扳机</button>
        <button class="primary action" id="fire">击发！</button>
        <button class="action" id="depth">转深度轮，再打一钉对比</button>
        <button class="action" id="to-quiz">看完现象，去答题</button>${undoBtn}`,
      bind(root) {
        root.querySelector('#air').onclick = () => act('setAir');
        root.querySelector('#trip').onclick = () => act('setTrip');
        root.querySelector('#trig').onclick = () => act('setTrigger');
        root.querySelector('#fire').onclick = () => act('fire');
        root.querySelector('#depth').onclick = () => act('cycleDepth');
        root.querySelector('#to-quiz').onclick = () => act('experiment');
        root.querySelector('#undo').onclick = () => act('undo');
      },
    };
  }

  if (phase === 'quiz') {
    const replay = state.chapter === 0 ? '再压一次活塞' : state.chapter === 1 ? '再试一遍三步' : '再打一钉';
    return {
      html: `<p class="label">看一看，想一想</p><h3>${ch.q}</h3>
        <div class="options">${ch.options.map((o, k) => `<button data-opt="${k}"><b>${String.fromCharCode(65 + k)}</b>${o}</button>`).join('')}</div>
        <button class="action" id="replay-exp" style="margin-top:12px">${replay}</button>
        <p class="note" style="margin-top:10px">答错不会清空进度，观察会帮你找到原因。</p>`,
      bind(root) {
        root.querySelector('#replay-exp').onclick = () => {
          if (state.chapter === 0) act('pressPiston');
          else if (state.chapter === 1) { state.expStep = 0; act('demoAir'); setTimeout(() => act('demoTrip'), 900); setTimeout(() => act('demoTrigger'), 1800); }
          else { if (!state.air) act('setAir'); if (!state.trip) act('setTrip'); if (!state.trigger) act('setTrigger'); setTimeout(() => act('fire'), 700); }
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

  const dname = state.depth === 1 ? '深' : state.depth === 0 ? '中' : '浅';
  return {
    html: `<div class="labgrid">
        <button class="primary" id="fire">击发！</button>
        <button id="air">${state.air ? '断开气源' : '接通气源'}</button>
        <button id="trip">${state.trip ? '松开鼻端' : '压紧鼻端'}</button>
        <button id="trig">${state.trigger ? '松开扳机' : '扣住扳机'}</button>
        <button id="depth">深度：${dname} ›</button>
        <button id="jam">弄弯一根钉</button>
        <button id="latch">${state.jam && state.latch ? '取弯钉并合门' : state.latch ? '合上卡扣门' : '打开卡扣门'}</button>
        <button id="reload">重装整条钉</button>
        <button id="press">手压活塞</button>
      </div>
      <label class="speed" for="speed">慢放倍率 <output id="speed-out">×${view.speed}</output>
        <input id="speed" type="range" min="10" max="150" step="10" value="${view.speed}"></label>
      <div class="flow ${state.air ? 'on' : ''}" id="flow">
        <span data-node="supply" class="${state.air ? '' : 'off'}">气源</span><i>›</i>
        <span data-node="trig" class="off">触发阀</span><i>›</i>
        <span data-node="head" class="off">头阀</span><i>›</i>
        <span data-node="top" class="off">上腔</span><i>›</i>
        <span data-node="driver" class="off">击针</span><i>›</i>
        <span data-node="nail" class="${state.nails > 0 ? '' : 'off'}">钉</span>
      </div>
      <p class="note">${state.jam ? '有弯钉卡在刀槽里：击发会顶住，开卡扣门取钉。' : state.nails <= 0 ? '弹匣已空：推钉板前沿进入击发窗，空击被锁定——重装钉条。' : '先压鼻端、再扣扳机，然后击发。两道输入缺一不可。'}</p>
      <div class="earned">${CH.map((c) => `<span>✓ ${c.badge}</span>`).join('')}</div>`,
    bind(root) {
      for (const [id, action] of [['fire', 'fire'], ['air', 'setAir'], ['trip', 'setTrip'], ['trig', 'setTrigger'], ['depth', 'cycleDepth'], ['jam', 'injectJam'], ['latch', 'setLatch'], ['reload', 'reload'], ['press', 'pressPiston']]) {
        root.querySelector('#' + id).onclick = () => act(action);
      }
      const sp = root.querySelector('#speed');
      sp.oninput = () => {
        view.speed = Number(sp.value);
        mech.speed = view.speed;
        root.querySelector('#speed-out').textContent = '×' + view.speed;
      };
    },
  };
});

/* ---------- 刷新显示态 ---------- */
const BOX = ['第一盒 · 动力核心', '第二盒 · 气路与保险', '第三盒 · 供钉与击发'];
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
    ? { tag: '三个发现，全部解锁', title: '你的气钉枪，能打钉了', intro: '自由实验：接气击发、调深浅、卡钉清障，或剖开看阀怎么切换。' }
    : null;
  s.trayTitle = labPhase ? '你的装配记录' : BOX[state.chapter];
  s.trayHint = labPhase ? '13 块模块，拼成了一把能打钉的气钉枪' : '点选模块，再拖到蓝色位置';
  s.stageHint = labPhase
    ? '接气、压鼻端、扣扳机——或者剖开看阀怎么切换。'
    : state.phase === 'build'
    ? '选一块模块，把它放到蓝色轮廓里。'
    : state.phase === 'experiment'
    ? '这一段已拼好，亲手做一次实验。'
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
  demoAir: () => game.demoAir(),
  demoTrip: () => game.demoTrip(),
  demoTrigger: () => game.demoTrigger(),
  fire: () => game.fire(),
  setAir: () => game.setAir(),
  setTrip: () => game.setTrip(),
  setTrigger: () => game.setTrigger(),
  cycleDepth: () => game.cycleDepth(),
  setLatch: () => game.setLatch(),
  injectJam: () => game.injectJam(),
  reload: () => game.reload(),
  pressPiston: () => game.pressPiston(),
  restart: () => game.restart(),
  freeview: () => game.freeview(),
};

function act(name, ...args) {
  const before = state.chapter;
  const res = ACTIONS[name](...args);
  lab.state.feedback = res.message || '';
  lab.state.feedbackKind = res.ok ? 'success' : 'error';
  if (res.learn) lab.setDiscovery(res.learn);
  if (res.ok) {
    if (res.kind === 'fired') { mech.pending = true; mech.cycle = true; mech.cycleT = 0; }
    if (res.kind === 'lockout' || res.kind === 'jamstop') { mech.cycle = true; mech.cycleT = 0; mech.lockout = res.kind === 'lockout'; }
    if (res.kind === 'press') mech.pressT = 0;
    if (res.kind === 'air' && state.air) mech.puffT = 0;
    if (res.kind === 'restart' || res.kind === 'freeview') {
      mech.cycle = false; mech.pending = false; mech.lockout = false; mech.cycleT = 0;
      mech.piston = 0; mech.pressT = null; mech.pressure = 0;
      view.offsets.clear();
      view.cut = true;
      stage.setNavigation('rotate');
      lab.setDiscovery('');
    }
    if (res.kind === 'chapter') stage.fitCamera('all');
    if (res.kind === 'complete') { lab.celebrate(); stage.fitCamera('all'); }
    if (name === 'select' || ['air', 'trip', 'trigger', 'fired', 'experiment'].includes(res.kind)) {
      if (matchMedia('(max-width:760px)').matches) document.getElementById('stage').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }
  if (before !== state.chapter) stage.fitCamera('all');
  refresh();
  return res;
}

/* ---------- 事件 ---------- */
lab.on('select', (id) => act('select', id));
lab.on('place', () => act('place'));
lab.on('undo', () => act('undo'));
lab.on('answer', (i) => act('answer', i));
lab.on('next', () => act('next'));
lab.on('restart', () => act('restart'));
lab.on('free', () => { act('freeview'); stage.fitCamera('all'); });
lab.on('tool', (id) => {
  if (id === 'cut') view.cut = $('[data-tool="cut"]').getAttribute('aria-pressed') === 'true';
  if (id === 'home') stage.fitCamera('all');
  if (id === 'rotate' || id === 'pan') stage.setNavigation(id);
  refresh();
});

view.cut = true;
$('[data-tool="cut"]').setAttribute('aria-pressed', 'true');
lab.state.feedback = '从下方零件盒选中「主机体」，开始第一步。';
refresh();
updateReadout();   // 首帧前先把读数填上（tick 之前是一屏占位）
stage.start();
