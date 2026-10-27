/* 比较式投币器 · 接线（规则在 logic.mjs，几何在 model.mjs，文案在 manifest.mjs） */
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
    if (['sampleHolder', 'sampleCoin'].includes(key) && state.placed.includes('sample')) stage.fitCamera('sample');
    else if (['coil', 'board', 'pot'].includes(key) && state.placed.includes('coil')) stage.fitCamera('coil');
    else if (['gate', 'solenoid', 'counter', 'cashbox'].includes(key) && state.placed.includes('gate')) stage.fitCamera('gate');
    else if (['entry', 'returnBtn', 'runway'].includes(key)) stage.fitCamera('entry');
    else stage.fitCamera('all');
  },
  tick: (dt) => tick(dt),
});
lab.attached3d = true;
lab.stage = stage;
const view = stage.view;
view.cut = true;
const mech = MODEL.mech;

let lastStage = '';
let lastResult = '';

/* ---------- 每一帧：推进币、活门、计数 ---------- */
function tick(dt) {
  mech.now += dt * 1000;
  game.advance(dt);
  const c = state.coin;
  const stageNow = c ? c.stage : '';
  if (stageNow !== lastStage) {
    lastStage = stageNow;
    if (stageNow === 'blocked') {
      const spec = MODEL.COINS[c.kind];
      say(`厚度门挡住：${spec.name} 厚 ${spec.t.toFixed(2)} mm，门缝只有 2.6 mm。点「按退币」把它推回去。`, 'error');
    }
  }
  if (state.lastResult && state.lastResult !== lastResult) {
    lastResult = state.lastResult;
    if (lastResult === 'accepted') {
      if (!state.placed.includes('coil')) {
        say('币顺着币道落进接币盒。这一关只验币道和厚度门，比较头还没装。', 'success');
      } else if (!state.placed.includes('gate')) {
        const pass = state.verdict === 'pass';
        say(pass
          ? `比较器判合格（差值 ${state.diff} ≤ 门限 ${state.threshold}）；这一关还没装活门，币先落进接币盒。`
          : `比较器判不合格（差值 ${state.diff} > 门限 ${state.threshold}）；活门还没装，币暂时也落进接币盒——装上活门后才会被分开。`, pass ? 'success' : 'error');
      } else {
        say(`通过！活门摆向接受位，币落进接币盒，计数 +1。差值 ${state.diff} 小于门限 ${state.threshold}。`, 'success');
      }
    } else if (lastResult === 'rejected') say(state.power ? `退回：差值 ${state.diff} 超过门限 ${state.threshold}，弹簧把活门按在退币位。` : '断电：比较器不工作，弹簧把活门按在退币位，币滑进退币杯。', state.power ? 'error' : 'success');
    else if (lastResult === 'returned') say('退币按钮把币推回入口，币掉进退币杯。', 'success');
  }
  lastResult = state.lastResult;
  updateReadout();
}

function say(text, kind = '') {
  lab.state.feedback = text;
  lab.state.feedbackKind = kind;
  const fb = document.getElementById('feedback');
  if (fb) {
    fb.textContent = text;
    fb.className = 'feedback' + (kind ? ' ' + kind : '');
  }
}
function updateReadout() {
  const verdict = state.verdict;
  const c = state.coin;
  labelVerdict = !c ? '待投币'
    : c.stage === 'blocked' ? '厚度门阻挡'
    : c.stage === 'done-accepted' ? '接受'
    : c.stage === 'done-rejected' ? '退回'
    : c.stage === 'done-returned' ? '已退币'
    : verdict === 'pass' ? '合格'
    : verdict === 'fail' ? '不合格'
    : verdict === 'off' ? '断电容限'
    : verdict === 'none' ? '缺比较头'
    : '比较中';
  const gateText = !state.placed.includes('gate') ? '未装'
    : state.gate > .8 ? '接受位' : state.gate > .08 ? '动作中' : '退币位';
  const sampleText = state.placed.includes('sample') ? (state.sample === 'yuan' ? '1 元' : '游戏币') : '—';
  const signalText = verdict === 'pass' || verdict === 'fail'
    ? `${state.diff} / 门限 ${state.threshold}`
    : verdict === 'off' ? '断电' : verdict === 'none' ? '缺模块' : '—';
  lab.paint({
    sample: sampleText,
    signal: signalText,
    verdict: labelVerdict,
    gate: gateText,
    count: state.placed.includes('counter') ? state.acceptCount + ' 枚' : '—',
  });
}
let labelVerdict = '待投币';

/* ---------- 教练面板（按阶段给不同面板） ---------- */
lab.task(({ chapter: ch, chapterIndex: i, phase }) => {
  const next = game.current();
  const sel = MODS.find((m) => m.id === state.selected);
  const undoBtn = `<div class="sub"><button id="undo" ${MODS.find((m) => m.id === state.placed.at(-1))?.chapter === state.chapter ? '' : 'disabled'}>撤回一步</button></div>`;
  const slowBtn = `<button class="action" id="slow">${state.slow ? '恢复常速' : '慢放 ×0.3'}</button>`;
  const sensHtml = !state.placed.includes('board') ? '' : `<label class="labctl">灵敏度 <output id="sens-out">${state.sensitivity}/10 · 门限 ${state.threshold}</output>
    <input id="sens" type="range" min="0" max="10" step="1" value="${state.sensitivity}"></label>`;
  const status = `<p class="note">当前样币：${state.sample === 'yuan' ? '1 元' : '游戏币'} · 电源：${state.power ? '接通' : '断开'} · 已收 ${state.placed.includes('counter') ? state.acceptCount : '—'} 枚</p>`;

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

  if (phase === 'experiment' && state.chapter === 0) {
    return {
      html: `<p class="label">模块已归位，先让币走一遍</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
        <div class="labgrid">
          <button id="ins-yuan">投 1 元</button>
          <button id="ins-washer">投厚垫圈</button>
          <button id="return">按退币</button>
          <button id="to-quiz" class="primary">看完现象，去答题</button>
        </div>
        ${slowBtn}
        ${status}
        <p class="note">${state.expStep >= 2 ? '已经试过：厚度门挡住厚币，退币按钮能把它推回去。' : '先投厚垫圈，看它停在哪；再按退币。'}</p>`,
      bind(root) {
        root.querySelector('#ins-yuan').onclick = () => act('insert', 'yuan');
        root.querySelector('#ins-washer').onclick = () => act('insert', 'washer');
        root.querySelector('#return').onclick = () => act('pressReturn');
        root.querySelector('#to-quiz').onclick = () => act('experiment');
        root.querySelector('#slow').onclick = () => act('toggleSlow');
      },
    };
  }

  if (phase === 'experiment' && state.chapter === 1) {
    return {
      html: `<p class="label">比较头装好了，先看它怎么判</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
        <div class="labgrid">
          <button id="ins-yuan">投 1 元</button>
          <button id="ins-token">投游戏币</button>
          <button id="ins-jiao">投 5 角</button>
          <button id="ins-fake">投铜章</button>
          <button id="swap">${state.sample === 'yuan' ? '样币换游戏币' : '样币换 1 元'}</button>
          <button id="return">按退币</button>
          <button id="to-quiz" class="primary">看完现象，去答题</button>
        </div>
        ${sensHtml}${slowBtn}${status}
        <p class="note">${state.expStep >= 2 ? '5 角因直径差被拒；铜章因材质差落在门限附近。转灵敏度看它的判定翻转。' : '1 元应与样币几乎零差；再试 5 角和铜章。'}</p>`,
      bind(root) {
        root.querySelector('#ins-yuan').onclick = () => act('insert', 'yuan');
        root.querySelector('#ins-token').onclick = () => act('insert', 'token');
        root.querySelector('#ins-jiao').onclick = () => act('insert', 'jiao');
        root.querySelector('#ins-fake').onclick = () => act('insert', 'fake');
        root.querySelector('#swap').onclick = () => act('setSample', state.sample === 'yuan' ? 'token' : 'yuan');
        root.querySelector('#return').onclick = () => act('pressReturn');
        root.querySelector('#to-quiz').onclick = () => act('experiment');
        root.querySelector('#slow').onclick = () => act('toggleSlow');
        bindSens(root);
      },
    };
  }

  if (phase === 'experiment') {
    return {
      html: `<p class="label">最后一步：把判断变成动作</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
        <div class="labgrid">
          <button id="ins-yuan">投 1 元</button>
          <button id="ins-jiao">投 5 角</button>
          <button id="return">按退币</button>
          <button id="power">${state.power ? '断开电源' : '接通电源'}</button>
          <button id="to-quiz" class="primary">看完现象，去答题</button>
        </div>
        ${slowBtn}${status}
        <p class="note">${state.expStep >= 3 ? '好币接受、坏币退回、断电也退回——fail-safe 已验证。' : '先投 1 元看接受与计数，再投 5 角看退币，最后断电再投 1 元。'}</p>`,
      bind(root) {
        root.querySelector('#ins-yuan').onclick = () => act('insert', 'yuan');
        root.querySelector('#ins-jiao').onclick = () => act('insert', 'jiao');
        root.querySelector('#return').onclick = () => act('pressReturn');
        root.querySelector('#power').onclick = () => act('setPower', !state.power);
        root.querySelector('#to-quiz').onclick = () => act('experiment');
        root.querySelector('#slow').onclick = () => act('toggleSlow');
      },
    };
  }

  if (phase === 'quiz') {
    return {
      html: `<p class="label">看一看，想一想</p><h3>${ch.q}</h3>
        <div class="options">${ch.options.map((o, k) => `<button data-opt="${k}"><b>${String.fromCharCode(65 + k)}</b>${o}</button>`).join('')}</div>
        <p class="note" style="margin-top:10px">答错不会清空进度，实验可以再做一遍。</p>`,
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
        <button class="primary" id="ins-yuan">投 1 元</button>
        <button id="ins-token">投游戏币</button>
        <button id="ins-jiao">投 5 角</button>
        <button id="ins-fake">投铜章</button>
        <button id="ins-washer">投厚垫圈</button>
        <button id="return">按退币</button>
        <button id="power">${state.power ? '断开电源' : '接通电源'}</button>
        <button id="swap">${state.sample === 'yuan' ? '样币换游戏币' : '样币换 1 元'}</button>
        <button id="slow">${state.slow ? '恢复常速' : '慢放 ×0.3'}</button>
      </div>
      ${sensHtml}
      <div class="flow" id="flow">
        <span data-node="sample" class="${state.placed.includes('sample') ? '' : 'off'}">样币</span><i>›</i>
        <span data-node="coil" class="${state.placed.includes('coil') ? '' : 'off'}">双线圈</span><i>›</i>
        <span data-node="board" class="${state.placed.includes('board') ? '' : 'off'}">比较器</span><i>›</i>
        <span data-node="gate" class="${state.placed.includes('gate') ? '' : 'off'}">活门</span><i>›</i>
        <span data-node="counter" class="${state.placed.includes('counter') ? '' : 'off'}">计数</span>
      </div>
      <p class="note">投币后看币走的路：厚度门 → 测试线圈 → 活门。断电能验证 fail-safe：弹簧默认退币。</p>
      <div class="earned">${CH.map((c) => `<span>✓ ${c.badge}</span>`).join('')}</div>`,
    bind(root) {
      for (const [id, kind] of [['ins-yuan', 'yuan'], ['ins-token', 'token'], ['ins-jiao', 'jiao'], ['ins-fake', 'fake'], ['ins-washer', 'washer']]) {
        root.querySelector('#' + id).onclick = () => act('insert', kind);
      }
      root.querySelector('#return').onclick = () => act('pressReturn');
      root.querySelector('#power').onclick = () => act('setPower', !state.power);
      root.querySelector('#swap').onclick = () => act('setSample', state.sample === 'yuan' ? 'token' : 'yuan');
      root.querySelector('#slow').onclick = () => act('toggleSlow');
      bindSens(root);
    },
  };
});

function bindSens(root) {
  const el = root.querySelector('#sens');
  if (!el) return;
  el.oninput = () => {
    const res = game.setSensitivity(el.value);
    el.value = String(state.sensitivity);
    say(res.message, res.ok ? 'success' : 'error');
    const out = root.querySelector('#sens-out');
    if (out) out.textContent = `${state.sensitivity}/10 · 门限 ${state.threshold}`;
    updateReadout();
  };
}

/* ---------- 刷新显示态 ---------- */
const BOX = ['第一盒 · 币道与退币', '第二盒 · 样币与比较头', '第三盒 · 分选与计数'];
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
    ? { tag: '三个发现，全部解锁', title: '你的投币器，认币了', intro: '自由实验：投五种币、换样币、调灵敏度、断电试 fail-safe，或剖开看线圈与活门。' }
    : null;
  s.trayTitle = labPhase ? '你的装配记录' : BOX[state.chapter];
  s.trayHint = labPhase ? '12 块模块，拼成一台会认币的机器' : '点选模块，再拖到蓝色位置';
  s.stageHint = labPhase
    ? '投币、换样币、调灵敏度，或者断开电源看弹簧怎么退币。'
    : state.phase === 'build'
    ? '选一块模块，把它放到蓝色轮廓里。'
    : state.phase === 'experiment'
    ? '这一段已拼好，亲手做一次实验。'
    : '看清谁在动，再完成原理挑战。';
  lab.render();
  $('[data-tool="cut"]')?.setAttribute('aria-pressed', String(view.cut));
  updateReadout();
}

/* ---------- 动作 ---------- */
const ACTIONS = {
  select: (id) => game.select(id),
  place: (onTarget) => game.place(onTarget !== false),
  undo: () => game.undo(),
  experiment: () => game.experiment(),
  answer: (i) => game.answer(i),
  next: () => game.next(),
  insert: (kind) => game.insert(kind),
  pressReturn: () => game.pressReturn(),
  setSensitivity: (v) => game.setSensitivity(v),
  setSample: (kind) => game.setSample(kind),
  setPower: (on) => game.setPower(on),
  toggleSlow: () => game.toggleSlow(),
  restart: () => game.restart(),
  freeview: () => game.freeview(),
};

function act(name, ...args) {
  const res = ACTIONS[name](...args);
  if (!res) return res;
  lab.state.feedback = res.message || '';
  lab.state.feedbackKind = res.ok ? 'success' : 'error';
  if (res.learn) lab.setDiscovery(res.learn);
  if (res.ok) {
    if (res.kind === 'restart' || res.kind === 'freeview') {
      view.offsets.clear();
      view.cut = true;
      stage.setNavigation('rotate');
      lab.setDiscovery('');
      mech.gate = 0; mech.lastCount = 0;
      lastStage = ''; lastResult = '';
      stage.fitCamera('all');
    }
    if (res.kind === 'chapter') stage.fitCamera('all');
    if (res.kind === 'complete') { lab.celebrate(); stage.fitCamera('all'); }
    if (name === 'select' || ['insert', 'return', 'power', 'sample'].includes(res.kind)) {
      if (matchMedia('(max-width:760px)').matches) document.getElementById('stage').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }
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
  if (id === 'cut') view.cut = $('[data-tool="cut"]')?.getAttribute('aria-pressed') === 'true';
  if (id === 'home') stage.fitCamera('all');
  if (id === 'rotate' || id === 'pan') stage.setNavigation(id);
  refresh();
});

view.cut = true;
$('[data-tool="cut"]')?.setAttribute('aria-pressed', 'true');
lab.state.feedback = '从下方零件盒选中「底板与机架」，开始第一步。';
refresh();
updateReadout();
stage.start();
