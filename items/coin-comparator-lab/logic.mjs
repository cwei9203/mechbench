/* 比较式投币器 · 装配与实验逻辑（纯逻辑，无 DOM、无三维）
 * 规则：先校验，再改状态；失败不动已装件与正在走的币。
 * 比较公式：直径差×14 + 厚度差×20 + 材质差；门限 = 100 − 灵敏度×9。
 */
const MODULES = MANIFEST.modules;
const CHAPTERS = MANIFEST.chapters;
const ST = MODEL.STATIONS;
const MAT_DIFF = { nickel: 0, brass: 52, steel: 38 };
const GATE_CLEAR = MODEL.GATE_MAX_T - .05;
const BLOCK_STOP = ST.stop;   // 厚币停在门前的币边处，不穿进夹板
const COIN_KEYS = Object.keys(MODEL.COINS);

export function createGame() {
  const initial = () => ({
    chapter: 0, phase: 'build', placed: [], selected: null,
    completed: [false, false, false],
    sample: 'yuan', sensitivity: 6, power: true,
    coin: null, verdict: null, diff: null, threshold: 46,
    gate: 0, returnBtn: 0,
    acceptCount: 0, rejectCount: 0, returnCount: 0,
    expStep: 0, slow: false, lastResult: '',
  });
  const state = initial();
  const fail = (message) => ({ ok: false, message });
  const mod = (id) => MODULES.find((m) => m.id === id);
  const has = (id) => state.placed.includes(id);
  const doneCoin = () => !state.coin || String(state.coin.stage).startsWith('done-');
  const thresholdOf = (s = state.sensitivity) => 100 - s * 9;
  const resetCoin = () => {
    state.coin = null; state.verdict = null; state.diff = null;
    state.threshold = thresholdOf(); state.gate = 0; state.returnBtn = 0;
  };

  function current() {
    if (state.phase !== 'build') return null;
    return MODULES.find((m) => m.chapter === state.chapter && !state.placed.includes(m.id)) || null;
  }
  function select(id) {
    if (state.phase !== 'build') return fail(state.phase === 'lab' ? '自由实验室里不搞装配，想重拼请点「重新开始」。' : '先完成本章实验与挑战，再继续装配。');
    const m = mod(id);
    if (!m) return fail('没有这块模块，请从零件盒选择。');
    if (state.placed.includes(id)) return fail(m.name + '已经装好了。');
    if (m.chapter !== state.chapter) return fail('这一步还轮不到' + m.name + '——先完成当前模块。');
    state.selected = id;
    return { ok: true, message: m.tip };
  }
  function place(onTarget = true) {
    if (state.phase !== 'build') return fail('本章装配已完成，请进行实验与挑战。');
    if (!state.selected) return fail('先从零件盒选一块模块。');
    if (onTarget !== true) return fail('还没对准装配位置——拖到蓝色轮廓里再松手，或按「装到这里」。');
    const m = current();
    if (!m) return fail('本章已经装完了。');
    if (state.selected !== m.id) return fail('这一步需要「' + m.name + '」，顺序不能乱。');
    state.placed.push(m.id); state.selected = null;
    if (!MODULES.some((x) => x.chapter === state.chapter && !state.placed.includes(x.id))) state.phase = 'experiment';
    return { ok: true, message: m.name + '已归位。', learn: m.learn, kind: 'placed' };
  }
  function undo() {
    if (state.phase === 'lab') return fail('自由实验室不撤回；想重拼请点「重新开始」。');
    const last = state.placed.at(-1), m = mod(last);
    if (!m || m.chapter !== state.chapter) return fail('本章还没有可撤回的模块。');
    state.placed.pop(); state.phase = 'build'; state.selected = null;
    state.completed[state.chapter] = false; state.expStep = 0;
    resetCoin();
    return { ok: true, message: '已撤回' + m.name + '，可以重新装配。', kind: 'undo' };
  }
  function experiment() {
    if (state.phase !== 'experiment') return fail('先把本章模块全部装好，再进行实验。');
    state.phase = 'quiz'; state.expStep = 0;
    return { ok: true, message: CHAPTERS[state.chapter].expText, kind: 'experiment' };
  }
  function answer(i) {
    if (state.phase !== 'quiz') return fail('先亲手完成本章实验，再回答问题。');
    const c = CHAPTERS[state.chapter];
    if (!Number.isInteger(i) || i < 0 || i >= c.options.length) return fail('请选择一个有效答案。');
    if (i !== c.a) return { ok: false, message: '再观察一下。' + c.why, kind: 'wrong' };
    state.completed[state.chapter] = true; state.phase = 'checkpoint';
    return { ok: true, message: '答对了！获得「' + c.badge + '」。', kind: 'correct' };
  }
  function next() {
    if (state.phase !== 'checkpoint' || !state.completed[state.chapter]) return fail('先完成本章实验与挑战。');
    if (state.chapter < CHAPTERS.length - 1) {
      state.chapter++; state.phase = 'build'; state.expStep = 0;
      state.sample = 'yuan'; state.sensitivity = 6; state.power = true;
      resetCoin();
      return { ok: true, message: CHAPTERS[state.chapter].subtitle, kind: 'chapter' };
    }
    state.phase = 'lab';
    return { ok: true, message: '装配完成！进入自由实验室：投任意币、换样币、调灵敏度、断电试 fail-safe。', kind: 'complete' };
  }

  /* ---------- 投币与比较 ---------- */
  function compare(kind) {
    const cs = MODEL.COINS[kind];
    const ss = MODEL.SAMPLES[state.sample] || MODEL.SAMPLES.yuan;
    if (!state.power) return { verdict: 'off', diff: null, threshold: thresholdOf() };
    if (!has('sample') || !has('coil') || !has('board')) return { verdict: 'none', diff: null, threshold: thresholdOf() };
    const dd = Math.abs(cs.d - ss.d);
    const dt = Math.abs(cs.t - ss.t);
    const dm = Math.abs((MAT_DIFF[cs.mat] || 0) - (MAT_DIFF[ss.mat] || 0));
    const diff = Math.round((dd * 14 + dt * 20 + dm) * 10) / 10;
    const threshold = thresholdOf();
    return { verdict: diff <= threshold ? 'pass' : 'fail', diff, threshold };
  }
  function insert(kind) {
    if (state.phase !== 'experiment' && state.phase !== 'lab') return fail('先完成本章装配，再投币。');
    if (!COIN_KEYS.includes(kind)) return fail('没有这种币。');
    if (!has('entry') || !has('runway') || !has('cashbox')) return fail('币道还没装完整，先装入口、币道和接币盒。');
    if (state.coin && !doneCoin()) return fail('上一枚币还没走完——先等它落定，或按「退币」把它退回来。');
    const chapterKinds = state.phase === 'experiment'
      ? (state.chapter === 0 ? ['yuan', 'washer'] : state.chapter === 1 ? ['yuan', 'token', 'jiao', 'fake'] : ['yuan', 'jiao'])
      : COIN_KEYS;
    if (!chapterKinds.includes(kind)) return fail('本关先测试这几种币：' + chapterKinds.map((k) => MODEL.COINS[k].name).join(' / ') + '。');
    state.coin = { kind, stage: 'rolling', t: 0, rt: 0, blockChecked: false };
    state.verdict = null; state.diff = null; state.threshold = thresholdOf();
    state.lastResult = '';
    return { ok: true, message: MODEL.COINS[kind].name + '已投进币道。', kind: 'insert' };
  }
  function pressReturn() {
    if (state.phase !== 'experiment' && state.phase !== 'lab') return fail('完成装配后再操作退币按钮。');
    if (state.coin && !doneCoin() && !['rolling', 'blocked'].includes(state.coin.stage)) {
      return { ok: false, message: '币已经过分选口或正在退回，请等它落定。', kind: 'return-late' };
    }
    state.returnBtn = 1;
    if (!state.coin || String(state.coin.stage).startsWith('done-')) {
      return { ok: true, message: '推杆空走一下：币道里没有可退的币。', kind: 'return-idle' };
    }
    const st = state.coin.stage;
    if (st === 'rolling' || st === 'blocked') {
      state.coin.stage = 'returning';
      state.verdict = null; state.diff = null; state.threshold = thresholdOf(); state.gate = 0;
      if (state.phase === 'experiment' && state.chapter === 0) state.expStep = Math.max(state.expStep, 2);
      return { ok: true, message: '退币按钮经推杆把币从币道推回入口，币掉进退币杯。', kind: 'return' };
    }
    return { ok: false, message: '币已经过分选口，退币推杆够不到它——这一枚只能算接受或拒绝。', kind: 'return-late' };
  }
  function setSensitivity(v) {
    if (state.phase !== 'experiment' && state.phase !== 'lab') return fail('完成装配后再调灵敏度。');
    if (!has('board')) return fail('先装上比较器板和灵敏度旋钮。');
    if (!doneCoin()) return fail('币还在币道里，等它落定再调灵敏度。');
    const value = Number(v);
    if (!Number.isFinite(value)) return fail('灵敏度必须是有效数值。');
    const n = Math.max(0, Math.min(10, Math.round(value)));
    state.sensitivity = n; state.threshold = thresholdOf(n);
    state.verdict = null; state.diff = null;
    if (state.phase === 'experiment' && state.chapter === 1) state.expStep = Math.max(state.expStep, 3);
    return { ok: true, message: `灵敏度 ${n}/10：比较门限 ${state.threshold}。越松越容易接受，也越容易被铜章蒙混。`, kind: 'sensitivity' };
  }
  function setSample(kind) {
    if (state.phase !== 'experiment' && state.phase !== 'lab') return fail('完成装配后再换样币。');
    if (!has('sample')) return fail('先装上样币座和样币。');
    if (state.coin && !doneCoin()) return fail('币还在币道里，等它落定再换样币。');
    if (!MODEL.SAMPLES[kind]) return fail('样币座里只有 1 元和游戏币两种样币。');
    state.sample = kind;
    state.verdict = null; state.diff = null; state.threshold = thresholdOf();
    return { ok: true, message: `样币已换成${MODEL.SAMPLES[kind].name}：参考线圈里的基准信号也跟着换了。`, kind: 'sample' };
  }
  function setPower(on = true) {
    if (state.phase !== 'experiment' && state.phase !== 'lab') return fail('完成装配后再操作电源。');
    if (!has('board')) return fail('先装上比较器板。');
    state.power = !!on;
    if (!state.power) {
      if (state.coin && !doneCoin()) state.verdict = 'off';
      state.diff = null;
    } else if (state.verdict === 'off') {
      state.verdict = null; state.diff = null;
    }
    return { ok: true, message: state.power ? '电源接通：比较器工作，电磁铁待命。' : '电源断开：比较器停摆，活门被弹簧按在退币位——fail-safe。', kind: 'power' };
  }
  function toggleSlow() {
    state.slow = !state.slow;
    return { ok: true, message: state.slow ? '慢放 ×0.3：看清币经过线圈、活门换位。' : '恢复常速。', kind: 'slow' };
  }

  /* ---------- 每帧推进（只由 state 驱动；几何在 model.mjs 落位） ---------- */
  function advance(dt) {
    const k = Math.max(0, Math.min(.25, dt || 0));
    state.returnBtn = Math.max(0, state.returnBtn - k * 5);
    const wantGate = (state.verdict === 'pass' && state.power && has('gate') && has('solenoid')
      && state.coin && !String(state.coin.stage).startsWith('done-')) ? 1 : 0;
    state.gate += (wantGate - state.gate) * Math.min(1, k * 20);
    if (Math.abs(state.gate - wantGate) < .003) state.gate = wantGate;
    const c = state.coin;
    if (!c) return;
    const sp = state.slow ? .3 : 1;
    if (c.stage === 'rolling') {
      c.t += k * .55 * sp;
      if (!c.blockChecked && c.t >= BLOCK_STOP) {
        c.blockChecked = true;
        if (MODEL.COINS[c.kind].t > GATE_CLEAR) {
          c.t = BLOCK_STOP; c.stage = 'blocked';
          if (state.phase === 'experiment' && state.chapter === 0) state.expStep = Math.max(state.expStep, 1);
          return;
        }
      }
      if (c.t >= ST.coil && state.verdict == null) {
        const r = compare(c.kind);
        state.verdict = r.verdict; state.diff = r.diff; state.threshold = r.threshold;
        if (state.phase === 'experiment' && state.chapter === 1) {
          state.expStep = Math.max(state.expStep, r.verdict === 'pass' ? 1 : 2);
        }
      }
      if (c.t >= ST.gate) {
        const accept = !has('gate') || (state.verdict === 'pass' && state.power && has('solenoid'));
        c.stage = accept ? 'accepted' : 'rejected';
        c.t = ST.gate;
      }
    } else if (c.stage === 'accepted' || c.stage === 'rejected') {
      c.t += k * .62 * sp;
      if (c.t >= 1) {
        c.t = 1;
        const ok = c.stage === 'accepted';
        c.stage = ok ? 'done-accepted' : 'done-rejected';
        state.lastResult = ok ? 'accepted' : 'rejected';
        if (ok) { if (has('counter')) state.acceptCount++; } else state.rejectCount++;
        state.gate = ok ? 1 : 0;
        if (state.phase === 'experiment' && state.chapter === 2) {
          state.expStep = Math.max(state.expStep, ok ? 1 : (state.power ? 2 : 3));
        }
      }
    } else if (c.stage === 'returning') {
      c.t -= k * .9 * sp;
      if (c.t <= 0) { c.t = 0; c.stage = 'returned'; c.rt = 0; }
    } else if (c.stage === 'returned') {
      c.rt = (c.rt || 0) + k * 1.5;
      if (c.rt >= .55) {
        c.rt = .55; c.stage = 'done-returned';
        state.returnCount++; state.lastResult = 'returned';
      }
    }
  }

  function freeview() {
    Object.assign(state, initial());
    state.placed = MODULES.map((m) => m.id);
    state.completed = [true, true, true];
    state.chapter = CHAPTERS.length - 1;
    state.phase = 'lab';
    state.sample = 'yuan'; state.sensitivity = 6; state.power = true;
    state.threshold = thresholdOf();
    return { ok: true, kind: 'freeview', message: '已装完整机，进入自由实验：投币、换样币、调灵敏度、断电试 fail-safe。' };
  }
  function restart() {
    Object.assign(state, initial());
    return { ok: true, kind: 'restart', message: '新的装配开始了——把底板放上工作台。' };
  }

  return { state, current, select, place, undo, experiment, answer, next,
    insert, pressReturn, setSensitivity, setSample, setPower, toggleSlow, advance,
    compare, freeview, restart, resetCoin, COIN_KEYS };
}
