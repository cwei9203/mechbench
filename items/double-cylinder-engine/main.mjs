/* 双缸发动机 · 接线（规则在 logic.mjs，几何在 model.mjs，文案在 manifest.mjs） */
const game = createGame();
const state = game.state;
const CH = MANIFEST.chapters;
const MODS = MANIFEST.modules;
const RAD = Math.PI / 180;
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
  targetAlways: () => {
    const n = game.current();
    return !!n && (n.id === 'case' || n.id === 'crank');
  },
  onDrop: (id, onTarget) => act('place', onTarget),
  onPickKey: (key, again) => {
    if (view.cut) stage.fitCamera(again ? 'engine' : key);
  },
  tick: (dt) => tick(dt),
});
lab.attached3d = true;
lab.stage = stage;
const view = stage.view;

/* ---------- 读数 ---------- */
function setRd(key, value) {
  const el = document.querySelector(`[data-rd="${key}"]`);
  if (el && el.textContent !== value) el.textContent = value;
}
function updateReadout() {
  const has = (id) => state.placed.includes(id);
  const c = (((view.crankDeg % 720) + 720) % 720);
  setRd('crank', has('crank') ? c.toFixed(0) + '°' : '—');
  setRd('cam', has('cam') ? ((((view.camDeg % 360) + 360) % 360).toFixed(0) + '°') : '—');
  const pinY = MODEL.pistonPinY(view.crankDeg * RAD);
  setRd('piston', has('piston') ? (pinY - (MODEL.D.ROD - MODEL.D.R)).toFixed(0) + ' / 74 mm' : '—');
  const vs = MODEL.valveState(view.crankDeg, view.camDeg);
  const vi = vs.find((v) => v.i === 0 && v.kind === 'im');
  const ve = vs.find((v) => v.i === 0 && v.kind === 'ex');
  setRd('valve', has('valve') ? vi.valveLift.toFixed(1) + ' / ' + ve.valveLift.toFixed(1) + ' mm' : '—');
  const sp = MODEL.sparkState(view.crankDeg).filter((s) => s.on).map((s) => '缸' + (s.i + 1));
  setRd('spark', has('ignition') ? (sp.length ? sp.join(' ') + ' 跳火' : '—') : '—');
}

/* ---------- 手动摇曲轴 ---------- */
function bindCrankSlider(root) {
  const s = root.querySelector('#crank');
  if (!s) return;
  s.oninput = () => {
    stopTurning();
    view.crankDeg = Number(s.value);
    if (!state.chainOff) view.camDeg = view.crankDeg / 2;
    const out = root.querySelector('#crank-out');
    if (out) out.textContent = s.value + '°';
  };
}
function stopTurning() {
  view.running = false;
  state.running = false;
}

/* ---------- 教练面板（按阶段换内容，比插槽默认面板更细） ---------- */
lab.task(({ chapter: ch, chapterIndex: i, phase }) => {
  const next = game.current();
  const sel = MODS.find((m) => m.id === state.selected);

  if (phase === 'build') {
    return {
      html: `<p class="label">现在要装</p><h3>${next ? next.name : ''}</h3><p>${next ? next.tip : ''}</p>
        <div class="note">${sel ? '已拿起：' + sel.name : '从下方零件盒选择一块模块'}</div>
        <button class="primary action" id="place" ${sel ? '' : 'disabled'}>装入当前模块</button>
        <div class="sub"><button id="hint">给点提示</button>
        <button id="undo" ${MODS.find((m) => m.id === state.placed.at(-1))?.chapter === state.chapter ? '' : 'disabled'}>撤回一步</button></div>`,
      bind(root) {
        root.querySelector('#place').onclick = () => act('place');
        root.querySelector('#hint').onclick = () => {
          view.hintOn = true;
          lab.state.feedback = '蓝色轮廓就是安装位置：把模块拖进轮廓里再松手。';
          lab.state.feedbackKind = '';
          refresh();
        };
        root.querySelector('#undo').onclick = () => act('undo');
      },
    };
  }

  if (phase === 'experiment') {
    const chainBtn =
      state.chapter === 2
        ? `<button class="action" id="exp-chain">${state.chainOff ? '装回正时链' : '拆掉正时链'}</button>
           <p class="note">${state.chainOff ? '链条已拆下：凸轮轴与气门停在原位。' : '链条还在：凸轮轴仍被曲轴带着转（2:1）。'}</p>`
        : '';
    return {
      html: `<p class="label">模块已归位，现在验证</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
        <button class="primary action" id="exp">${ch.exp}</button>${chainBtn}
        <label class="crankctl" for="crank">手动摇曲轴 <output id="crank-out">${Math.round((((view.crankDeg % 720) + 720) % 720))}°</output>
          <input id="crank" type="range" min="0" max="720" step="2" value="${Math.round((((view.crankDeg % 720) + 720) % 720))}"></label>
        <div class="sub"><button id="undo">撤回最后一块</button></div>`,
      bind(root) {
        root.querySelector('#exp').onclick = () => act('experiment');
        root.querySelector('#exp-chain')?.addEventListener('click', () => act('chain'));
        root.querySelector('#undo').onclick = () => act('undo');
        bindCrankSlider(root);
      },
    };
  }

  if (phase === 'quiz') {
    return {
      html: `<p class="label">看一看，想一想</p><h3>${ch.q}</h3>
        <div class="options">${ch.options.map((o, k) => `<button data-a="${k}"><b>${String.fromCharCode(65 + k)}</b>${o}</button>`).join('')}</div>
        <label class="crankctl" for="crank">继续摇曲轴 <output id="crank-out">${Math.round((((view.crankDeg % 720) + 720) % 720))}°</output>
          <input id="crank" type="range" min="0" max="720" step="2" value="${Math.round((((view.crankDeg % 720) + 720) % 720))}"></label>
        <p class="note" style="margin-top:10px">答错也不会清空进度，观察和提示会帮你找到原因。</p>`,
      bind(root) {
        root.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => act('answer', Number(b.dataset.a))));
        bindCrankSlider(root);
      },
    };
  }

  if (phase === 'checkpoint') {
    return {
      html: `<div class="badge" aria-hidden="true">✓</div><p class="label">新徽章</p><h3>${ch.badge}</h3>
        <p>${ch.why}</p>
        <button class="primary action" id="next">${i === CH.length - 1 ? '进入自由实验' : '继续第 ' + (i + 2) + ' 关'}</button>`,
      bind(root) {
        root.querySelector('#next').onclick = () => act('advance');
      },
    };
  }

  // lab：自由实验台
  return {
    html: `<div class="labgrid">
        <button class="primary" id="run">${state.running ? '暂停' : '让它转起来'}</button>
        <button id="chain">${state.chainOff ? '装回正时链' : '拆掉正时链'}</button>
        <button id="cover">${state.coverOff ? '盖回气门室盖' : '取下气门室盖'}</button>
        <button id="focus-all">看整机</button>
        <button id="focus-top">看配气</button>
      </div>
      <label class="speed" for="speed">观察速度 <output id="speed-out">${view.speed.toFixed(2)}×</output>
        <input id="speed" type="range" min="0.25" max="3" step="0.25" value="${view.speed}"></label>
      <label class="crankctl" for="crank">手动摇曲轴 <output id="crank-out">${Math.round((((view.crankDeg % 720) + 720) % 720))}°</output>
        <input id="crank" type="range" min="0" max="720" step="2" value="${Math.round((((view.crankDeg % 720) + 720) % 720))}"></label>
      <div class="flow ${state.running ? 'on' : ''}"><span>曲轴</span><i>›</i><span class="${state.chainOff ? 'off' : ''}">正时链</span><i>›</i><span class="${state.chainOff ? 'off' : ''}">凸轮轴</span><i>›</i><span class="${state.chainOff ? 'off' : ''}">气门</span></div>
      <p class="note">${state.chainOff ? '链条已拆下：曲轴和活塞照动，凸轮轴与气门保持不动。' : '先让它转起来，再拆掉链条做对照。'}</p>
      <div class="earned">${CH.map((c) => `<span>✓ ${c.badge}</span>`).join('')}</div>`,
    bind(root) {
      root.querySelector('#run').onclick = () => act('run');
      root.querySelector('#chain').onclick = () => act('chain');
      root.querySelector('#cover').onclick = () => act('cover');
      root.querySelector('#focus-all').onclick = () => stage.fitCamera('engine');
      root.querySelector('#focus-top').onclick = () => stage.fitCamera('camshaft');
      const sp = root.querySelector('#speed');
      sp.oninput = () => {
        view.speed = Number(sp.value);
        root.querySelector('#speed-out').textContent = view.speed.toFixed(2).replace(/0$/, '') + '×';
      };
      bindCrankSlider(root);
    },
  };
});

/* ---------- 刷新所有显示 ---------- */
const BOX = ['第一盒 · 曲柄连杆机构', '第二盒 · 配气机构', '第三盒 · 正时与点火'];
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
  s.visible.readout = state.phase !== 'build' || state.placed.length > 0;
  s.coach = labPhase
    ? { tag: '三个发现，全部解锁', title: '你的发动机，转起来了', intro: '自由实验：换转速、拆链条、剖开看内部。' }
    : null;
  s.trayTitle = labPhase ? '你的装配记录' : BOX[state.chapter];
  s.trayHint = labPhase ? '26 组零件全部到位' : '点选模块，再拖到机身缺口上';
  s.stageHint = labPhase
    ? '运行、拆链条、剖开，验证你刚刚发现的因果。'
    : state.phase === 'build'
    ? '从下方零件盒选一块模块，拖到机身缺口上。'
    : state.phase === 'experiment'
    ? '看谁在动、谁不动，再回答挑战。'
    : '这一段已经装好，去试验你的发现。';
  lab.render();
  document.querySelector('[data-tool="cut"]').setAttribute('aria-pressed', String(view.cut));
}

/* ---------- 动作入口 ---------- */
function act(name, ...args) {
  const beforeChapter = state.chapter;
  const res = game[name](...args);
  lab.state.feedback = res.message || '';
  lab.state.feedbackKind = res.ok ? 'success' : 'error';
  if (res.learn) lab.state.hint = res.learn;
  if (res.ok) {
    if (res.kind === 'select') {
      view.hintOn = false;
      for (const [id, off] of view.offsets) {
        if (!state.placed.includes(id) && id !== state.selected) off.copy(stage.spawn);
      }
    }
    if (['placed', 'restart', 'demo', 'undo'].includes(res.kind)) view.hintOn = false;
    if (res.kind === 'restart' || res.kind === 'demo') {
      view.offsets.clear();
      view.crankDeg = 0;
      view.camDeg = 0;
      view.running = false;
      view.cut = false;
      if (view.drag) view.drag = null;
      stage.controls.enabled = true;
    }
    if (res.kind === 'manual') {
      view.running = true;
      view.crankDeg = 0;
      view.camDeg = 0;
    }
    if (res.kind === 'run') view.running = state.running;
    if (res.kind === 'chain' && !state.chainOff) view.camDeg = view.crankDeg / 2;
    if (res.kind === 'complete' || res.kind === 'demo') view.running = true;
    if (res.kind === 'chapter' && state.chapter !== beforeChapter) stage.fitCamera('engine');
  }
  refresh();
  return res;
}

/* ---------- 循环 ---------- */
function tick(dt) {
  if (view.running) {
    view.crankDeg += dt * 110 * view.speed;
    if (!state.chainOff) view.camDeg = view.crankDeg / 2;
  }
  view.solid = state.phase === 'lab' || state.phase === 'checkpoint';
  updateReadout();
}

/* ---------- 事件 ---------- */
lab.on('select', (id) => act('select', id));
lab.on('place', () => act('place'));
lab.on('undo', () => act('undo'));
lab.on('answer', (i) => act('answer', i));
lab.on('next', () => act('advance'));
lab.on('replay', () => act('restart'));
lab.on('free', () => {
  act('demo');
  stage.fitCamera('engine');
});
lab.on('restart', () => act('restart'));
lab.on('tool', (id) => {
  if (id === 'cut') {
    view.cut = document.querySelector('[data-tool="cut"]').getAttribute('aria-pressed') === 'true';
    if (!view.cut) view.focus = 'all';
  }
  if (id === 'home') stage.fitCamera('engine');
  if (id === 'rotate' || id === 'pan') stage.setNavigation(id);
  refresh();
});

lab.state.feedback = '从下方选中「曲轴箱」，开始第一步。';
lab.state.hint = '选中模块后可以拖到机身上，也可以按「装入当前模块」。位置不对时，已有的进度不会丢。';
refresh();
stage.start();
