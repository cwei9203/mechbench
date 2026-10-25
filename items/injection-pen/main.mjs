/* 注射笔 · 接线（规则在 logic.mjs，几何在 model.mjs，文案在 manifest.mjs） */
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
    if (['dial', 'button', 'pawl', 'scale'].includes(key)) stage.fitCamera('rear');
    else if (['spring', 'sleeve', 'nut', 'screw'].includes(key)) stage.fitCamera('drive');
    else if (['holder', 'cartridge', 'drug', 'bung'].includes(key)) stage.fitCamera('cart');
    else if (['hub', 'needle', 'capInner', 'capOuter'].includes(key)) stage.fitCamera('tip');
    else stage.fitCamera('all');
  },
  tick: (dt) => penFrame(dt),
});
lab.attached3d = true;
lab.stage = stage;
const view = stage.view;
view.cut = true;

/* ---------- 每帧：机构动画 + 读数（读数与几何同源） ---------- */
let wasInjecting = false;
function penFrame(dt) {
  view.clock = (view.clock || 0) + dt;
  game.update(dt);
  // 一针打完要把面板刷新回来（否则按钮还停在"注射中"的禁用态）
  const injecting = state.pending > 0;
  if (wasInjecting && !injecting) refreshPen();
  wasInjecting = injecting;
  penReadout();
}
function penReadout() {
  const left = Math.max(0, game.total - state.delivered);
  lab.paint({
    dose: state.windMg.toFixed(2) + ' mg',
    stroke: (MODEL.PEN.strokePerMg * state.delivered).toFixed(2) + ' mm',
    left: left.toFixed(2) + ' mg · ' + (left / 5).toFixed(2) + ' mL',
    clicks: Math.round(state.windMg / MODEL.PEN.clickMg) + ' 格',
  });
  syncDoseSlider();
}
function syncDoseSlider() {
  const el = document.querySelector('[data-exp="dose"]');
  if (!el || document.activeElement === el) return;
  const want = String(Math.round(state.windMg / MODEL.PEN.clickMg));
  if (el.value !== want) el.value = want;
  const out = document.querySelector('[data-exp-out="dose"]');
  if (out) out.textContent = want + ' 格';
}

/* ---------- 教练面板 ---------- */
const undoBtn = () => {
  const last = MODS.find((m) => m.id === state.placed.at(-1));
  return `<div class="sub"><button id="undo" ${last && last.chapter === state.chapter && state.phase !== 'lab' ? '' : 'disabled'}>撤回一步</button></div>`;
};

lab.task(({ chapter: ch, chapterIndex: i, phase }) => {
  const next = game.current();
  const sel = MODS.find((m) => m.id === state.selected);

  if (phase === 'build') {
    return {
      html: `<p class="label">现在要装</p><h3>${next ? next.name : ''}</h3><p>${next ? next.tip : ''}</p>
        <div class="note">${sel ? '已拿起：' + sel.name : '从下方零件盒选择一块模块'}</div>
        <button class="primary action" id="place" ${sel ? '' : 'disabled'}>装入当前模块</button>
        ${undoBtn()}`,
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
          <button class="primary action" id="cut-look">剖开，转到药筒</button>
          <button class="action" id="peek">剥开支架看药液</button>
          <button class="action" id="to-quiz">看完现象，去答题</button>${undoBtn()}`,
        bind(root) {
          root.querySelector('#cut-look').onclick = () => act('lookCart');
          root.querySelector('#peek').onclick = () => act('lookCart');
          root.querySelector('#to-quiz').onclick = () => act('experiment');
          root.querySelector('#undo').onclick = () => act('undo');
        },
      };
    }
    if (state.chapter === 1) {
      const clicks = Math.round(state.windMg / MODEL.PEN.clickMg);
      return {
        html: `<p class="label">模块已归位，现在验证一下</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
          <button class="penstep ${clicks >= 8 ? 'done' : ''}" id="dose-full"><i>${clicks >= 8 ? '✓' : '1'}</i>拨满 8 格（1.0 mg）</button>
          <button class="penstep ${clicks > 0 ? 'done' : ''}" id="dose-one"><i>${clicks > 0 ? '✓' : '2'}</i>再拨一格，听一声咔哒</button>
          <button class="action" id="focus-drive">凑近看丝杠与螺母</button>
          <button class="action" id="to-quiz">看完现象，去答题</button>${undoBtn()}`,
        bind(root) {
          root.querySelector('#dose-full').onclick = () => act('doseFull');
          root.querySelector('#dose-one').onclick = () => act('doseOne');
          root.querySelector('#focus-drive').onclick = () => { stage.fitCamera('drive'); refreshPen(); };
          root.querySelector('#to-quiz').onclick = () => act('experiment');
          root.querySelector('#undo').onclick = () => act('undo');
        },
      };
    }
    return {
      html: `<p class="label">最后一步：走一遍真实取用流程</p><h3>${ch.exp}</h3><p>${ch.expText}</p>
        <button class="penstep ${state.capOuterT < 0.5 ? 'done' : ''}" id="uncap-outer"><i>${state.capOuterT < 0.5 ? '✓' : '1'}</i>拔外帽</button>
        <button class="penstep ${state.capInnerT < 0.5 ? 'done' : ''}" id="uncap-inner"><i>${state.capInnerT < 0.5 ? '✓' : '2'}</i>拔内帽</button>
        <button class="penstep ${state.needleT > 0.5 ? 'done' : ''}" id="needle-on"><i>${state.needleT > 0.5 ? '✓' : '3'}</i>把针头拧到针座</button>
        <button class="penstep ${state.windMg > 0.5 ? 'done' : ''}" id="dose-full"><i>${state.windMg > 0.5 ? '✓' : '4'}</i>拨 1.0 mg</button>
        <button class="primary action" id="inject">按下注射按钮</button>
        <button class="action" id="to-quiz">看完现象，去答题</button>${undoBtn()}`,
      bind(root) {
        root.querySelector('#uncap-outer').onclick = () => act('uncapOuter');
        root.querySelector('#uncap-inner').onclick = () => act('uncapInner');
        root.querySelector('#needle-on').onclick = () => act('mountNeedle');
        root.querySelector('#dose-full').onclick = () => act('doseFull');
        root.querySelector('#inject').onclick = () => act('inject');
        root.querySelector('#to-quiz').onclick = () => act('experiment');
        root.querySelector('#undo').onclick = () => act('undo');
      },
    };
  }

  if (phase === 'quiz') {
    const replay = state.chapter === 0 ? '再剖一次' : state.chapter === 1 ? '再拨一次 8 格' : '再注射一次';
    return {
      html: `<p class="label">看一看，想一想</p><h3>${ch.q}</h3>
        <div class="options">${ch.options.map((o, k) => `<button data-opt="${k}"><b>${String.fromCharCode(65 + k)}</b>${o}</button>`).join('')}</div>
        <button class="action" id="replay-exp" style="margin-top:12px">${replay}</button>
        <p class="note" style="margin-top:10px">答错不会清空进度，观察会帮你找到原因。</p>`,
      bind(root) {
        root.querySelector('#replay-exp').onclick = () => {
          if (state.chapter === 0) act('lookCart');
          else if (state.chapter === 1) { act('doseZero'); setTimeout(() => act('doseFull'), 400); }
          else { act('resetFlow'); setTimeout(() => act('demoRun'), 500); }
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

  /* ---------- 自由实验 ---------- */
  const click = Math.round(state.windMg / MODEL.PEN.clickMg);
  const injecting = state.pending > 0;
  return {
    html: `<div class="labgrid">
        <button class="primary" id="dose-half" ${injecting ? 'disabled' : ''}>拨 0.5 mg</button>
        <button id="dose-full" ${injecting ? 'disabled' : ''}>拨 1.0 mg</button>
        <button id="dose-one" ${injecting ? 'disabled' : ''}>拨一格</button>
        <button id="dose-zero" ${injecting ? 'disabled' : ''}>旋钮回 0</button>
        <button id="inject" class="${state.windMg > 0.06 ? 'primary' : ''}">按注射按钮</button>
        <button id="uncap">${state.capOuterT > 0.5 ? '拔外帽' : state.capInnerT > 0.5 ? '拔内帽' : '帽已拔完'}</button>
        <button id="needle">${state.needleT > 0.5 ? '卸下针头' : '装针头'}</button>
      </div>
      <div class="labgrid">
        <button id="focus-tip">看针座</button>
        <button id="focus-drive">看传动</button>
        <button id="focus-rear">看旋钮</button>
        <button id="focus-cart">看药筒</button>
      </div>
      <div class="penflow">
        <span class="${click > 0 ? 'on' : ''}">旋钮 ${click} 格</span><i>›</i>
        <span class="${click > 0 ? 'on' : ''}">扭簧上弦</span><i>›</i>
        <span class="${injecting ? 'on' : ''}">螺母转</span><i>›</i>
        <span class="${state.delivered > 0.0001 ? 'on' : ''}">丝杠直推</span><i>›</i>
        <span class="${state.delivered > 0.0001 ? 'on' : ''}">活塞</span><i>›</i>
        <span class="${state.delivered > 0.0001 ? 'on' : ''}">药 → 针</span>
      </div>
      <p class="note">${injecting ? '扭簧正在释放：旋钮回零、螺母转、丝杠直推活塞。' : click > 0 ? '扭簧已上弦，丝杠没动——按按钮才松闸。' : '旋钮在 0，按钮锁死：先拨剂量。'}</p>
      <div class="earned">${CH.map((c) => `<span>✓ ${c.badge}</span>`).join('')}</div>`,
    bind(root) {
      const on = (id, name) => { const el = root.querySelector('#' + id); if (el) el.onclick = () => act(name); };
      on('dose-half', 'doseHalf'); on('dose-full', 'doseFull'); on('dose-one', 'doseOne'); on('dose-zero', 'doseZero');
      on('inject', 'inject'); on('uncap', 'uncapBoth'); on('needle', 'toggleNeedle');
      for (const [id, cam] of [['focus-tip', 'tip'], ['focus-drive', 'drive'], ['focus-rear', 'rear'], ['focus-cart', 'cart']]) {
        root.querySelector('#' + id).onclick = () => { stage.fitCamera(cam); refreshPen(); };
      }
    },
  };
});

/* ---------- 刷新显示态 ---------- */
const BOX = ['第一盒 · 药与活塞', '第二盒 · 传动链', '第三盒 · 外壳、帽与针'];
function refreshPen() {
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
    ? { tag: '三个发现，全部解锁', title: '这支笔，只会往前推', intro: '自由实验：拨剂量、按按钮、拔帽装针，或者剖开看螺母怎么把转角换成直线。' }
    : null;
  s.trayTitle = labPhase ? '你的装配记录' : BOX[state.chapter];
  s.trayHint = labPhase ? '12 块模块，拼成一支一次性预充笔' : '点选模块，再拖到笔身上';
  s.stageHint = labPhase
    ? '拨剂量 → 按按钮；也可以剖开看丝杠怎么走。'
    : state.phase === 'build'
    ? '选一块模块，把它放到笔身上它该在的位置。'
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
  doseHalf: () => game.dialTo(0.5),
  doseFull: () => game.dialTo(1.0),
  doseTo: (clicks) => game.dialTo((Number(clicks) || 0) * MODEL.PEN.clickMg),
  doseOne: () => game.clickOne(),
  doseZero: () => game.dialTo(0),
  inject: () => game.inject(),
  uncapOuter: () => game.uncapOuter(),
  uncapInner: () => game.uncapInner(),
  mountNeedle: () => game.mountNeedle(),
  unmountNeedle: () => game.unmountNeedle(),
  toggleNeedle: () => (state.needleT > 0.5 ? game.unmountNeedle() : game.mountNeedle()),
  uncapBoth: () => {
    if (state.capOuterT > 0.5) return game.uncapOuter();
    return game.uncapInner();
  },
  resetFlow: () => {
    state.delivered = 0; state.windMg = 0; state.targetMg = 0; state.pending = 0;
    state.capOuterT = 0; state.capInnerT = 0; state.needleT = 1;
    return { ok: true, kind: 'restart', message: '换上一支新笔：药满、帽已拔、针头在位。' };
  },
  demoRun: () => {
    ACTIONS.doseFull();
    setTimeout(() => act('inject'), 900);
    return { ok: true, message: '拨 1.0 mg，再按注射按钮。' };
  },
  restart: () => game.reset(),
  demo: () => game.demo(),
  lookCart: () => {
    view.cut = true;
    $('[data-tool="cut"]').setAttribute('aria-pressed', 'true');
    stage.fitCamera('cart');
    return { ok: true, kind: 'lookCart', message: '剖开了：玻璃卡式瓶里的药液，尾部那块黑色橡胶活塞就是唯一的活动边界。' };
  },
};

function act(name, ...args) {
  const before = state.chapter;
  const res = ACTIONS[name](...args);
  lab.state.feedback = res.message || '';
  lab.state.feedbackKind = res.ok ? 'success' : 'error';
  if (res.learn) lab.setDiscovery(res.learn);
  if (res.ok) {
    if (res.kind === 'lookCart') { view.cut = true; stage.fitCamera('cart'); }
    if (res.kind === 'restart' || res.kind === 'demo') {
      view.offsets.clear();
      view.cut = true;
      stage.setNavigation('rotate');
      lab.setDiscovery('');
    }
    if (res.kind === 'restart' || res.kind === 'demo' || res.kind === 'chapter') stage.fitCamera('all');
    if (res.kind === 'correct') lab.celebrate();
    if (res.kind === 'complete') { lab.celebrate(); stage.fitCamera('all'); }
  }
  if (before !== state.chapter) stage.fitCamera('all');
  refreshPen();
  return res;
}

/* ---------- 事件 ---------- */
lab.on('select', (id) => act('select', id));
lab.on('place', () => act('place'));
lab.on('undo', () => act('undo'));
lab.on('answer', (i) => act('answer', i));
lab.on('next', () => act('next'));
lab.on('restart', () => act('restart'));
lab.on('free', () => { act('demo'); stage.fitCamera('all'); });
lab.on('experiment', ({ id, value }) => {
  if (id === 'dose') act('doseTo', value);
  else if (id === 'inject') act('inject');
});
lab.on('tool', (id) => {
  if (id === 'cut') view.cut = $('[data-tool="cut"]').getAttribute('aria-pressed') === 'true';
  if (id === 'home') stage.fitCamera('all');
  if (id === 'rotate' || id === 'pan') stage.setNavigation(id);
  refreshPen();
});

view.cut = true;
$('[data-tool="cut"]').setAttribute('aria-pressed', 'true');
lab.state.feedback = '从下方零件盒选中「药筒组件」，开始第一步。';
penReadout();
refreshPen();
stage.start();
