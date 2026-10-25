/* 注射笔 · 装配与实验逻辑（纯逻辑，无 DOM、无三维）
 * 每步先校验、再改状态；失败不动已装件与已拨剂量。
 * 剂量 / 行程 / 剩余药量都出自这里的 windMg、delivered 两个状态量，model.mjs 的几何也只读这两个量。
 */
const PEN_MODS = MANIFEST.modules;
const PEN_CH = MANIFEST.chapters;
const PEN_CLICKS_PER_MG = Math.round(1 / PEN.clickMg);   // 8 格 = 1.0 mg

export function createGame() {
  const TOTAL = PEN.totalMg;
  const DIAL_RATE = 2.6;      // mg/s：拨剂量动画（8 格约 0.4 s）
  const INJECT_RATE = 0.55;   // mg/s：注射动画（1.0 mg 约 1.8 s）
  const MOVE_RATE = 5;        // 帽 / 针的滑动速度（每秒完成比例）

  const initial = () => ({
    chapter: 0, phase: 'build', placed: [], selected: null,
    completed: [false, false, false],
    capOuterT: 1, capOuter: 1, capInnerT: 1, capInner: 1,
    needleT: 1, needle: 1,
    pressT: 0, press: 0,
    targetMg: 0, windMg: 0, delivered: 0, pending: 0,
    expStep: 0, lastKind: '',
  });
  const state = initial();

  const fail = (message) => ({ ok: false, message });
  const mod = (id) => PEN_MODS.find((m) => m.id === id);
  const has = (id) => state.placed.includes(id);
  const capsOff = () => state.capOuter < 0.05 && state.capInner < 0.05;
  const slack = () => TOTAL - state.delivered - state.windMg;

  function current() {
    if (state.phase !== 'build') return null;
    return PEN_MODS.find((m) => m.chapter === state.chapter && !has(m.id)) || null;
  }
  function select(id) {
    if (state.phase !== 'build') return fail(state.phase === 'lab' ? '自由实验室里不重装零件，想从头来请点「重新开始」。' : '先完成本章的实验与挑战，再继续装配。');
    const m = mod(id);
    if (!m) return fail('没有这块模块，请从零件盒选择。');
    if (has(id)) return fail(m.name + ' 已经装好了。');
    if (m.chapter !== state.chapter) return fail('这一步还轮不到' + m.name + '——先完成当前这一关。');
    state.selected = id;
    return { ok: true, message: m.tip };
  }
  function place(onTarget = true) {
    if (state.phase !== 'build') return fail('本章装配已完成，请做实验与挑战。');
    if (!state.selected) return fail('先从零件盒选一块模块。');
    if (onTarget !== true) return fail('还没对准位置——拖到笔身上的高亮轮廓里再松手。');
    const m = current();
    if (!m) return fail('本章已经装完了。');
    if (state.selected !== m.id) return fail('这一步需要「' + m.name + '」，顺序不能乱。');
    state.placed.push(m.id);
    state.selected = null;
    if (m.id === 'caps') { state.capOuterT = 1; state.capInnerT = 1; }
    if (m.id === 'needle') { state.needleT = 1; }
    if (!PEN_MODS.some((x) => x.chapter === state.chapter && !has(x.id))) state.phase = 'experiment';
    return { ok: true, message: m.name + ' 已归位。', learn: m.learn, kind: 'placed' };
  }
  function undo() {
    if (state.phase === 'lab') return fail('自由实验室不撤回；想重装请点「重新开始」。');
    const last = state.placed.at(-1), m = mod(last);
    if (!m || m.chapter !== state.chapter) return fail('本章还没有可撤回的模块。');
    state.placed.pop(); state.phase = 'build'; state.selected = null;
    state.completed[state.chapter] = false; state.expStep = 0;
    if (m.id === 'dial' || m.id === 'spring') { state.targetMg = 0; state.windMg = 0; }
    if (m.id === 'screw' || m.id === 'bung') { state.delivered = 0; state.pending = 0; }
    if (m.id === 'caps') { state.capOuterT = 1; state.capInnerT = 1; }
    if (m.id === 'needle') { state.needleT = 0; }
    return { ok: true, message: '已撤回 ' + m.name + '，可以重新装配。', kind: 'undo' };
  }
  function experiment() {
    if (state.phase !== 'experiment') return fail('先把本章模块全部装好，再做实验。');
    state.phase = 'quiz';
    return { ok: true, message: PEN_CH[state.chapter].expText || '', kind: 'experiment' };
  }
  function answer(i) {
    if (state.phase !== 'quiz') return fail('先亲手完成本章实验，再回答问题。');
    const c = PEN_CH[state.chapter];
    if (!Number.isInteger(i) || i < 0 || i >= c.options.length) return fail('请选择一个有效答案。');
    if (i !== c.a) return { ok: false, message: '再观察一下。' + c.why, learn: c.why, kind: 'wrong' };
    state.completed[state.chapter] = true; state.phase = 'checkpoint';
    return { ok: true, message: '答对了！获得「' + c.badge + '」。', learn: c.why, kind: 'correct' };
  }
  function next() {
    if (state.phase !== 'checkpoint' || !state.completed[state.chapter]) return fail('先完成本章的实验与挑战。');
    if (state.chapter < PEN_CH.length - 1) {
      state.chapter++; state.phase = 'build'; state.expStep = 0;
      return { ok: true, message: PEN_CH[state.chapter].subtitle, kind: 'chapter' };
    }
    state.phase = 'lab';
    return { ok: true, message: '装配完成！拔帽、装针、拨剂量、按到底——随便试。', kind: 'complete' };
  }

  /* ---------------- 剂量 ---------------- */
  function dialTo(mg) {
    if (state.phase === 'build' || state.phase === 'checkpoint') return fail('先装完这一段，再拨剂量。');
    if (!has('dial')) return fail('剂量旋钮还没装，拨不动。');
    if (state.pending > 0) return fail('正在注射——等它打完再拨。');
    const want = Math.max(0, Math.min(1, Math.round(Number(mg) / PEN.clickMg) * PEN.clickMg));
    if (want > slack() + 1e-6) return fail('药不够了：这支笔只剩 ' + (TOTAL - state.delivered).toFixed(2) + ' mg。');
    state.targetMg = want;
    state.expStep = Math.max(state.expStep, want > 0.001 ? 1 : 0);
    const clicks = Math.round(want / PEN.clickMg);
    return {
      ok: true,
      kind: 'dose',
      message: want < 0.001
        ? '旋钮回到 0：扭簧松了，按钮压不动。'
        : '旋钮转过 ' + clicks + ' 格（' + (clicks * 22.5).toFixed(1) + '°），棘爪咔哒 ' + clicks + ' 声，扭簧上弦；丝杠和活塞没有动。',
    };
  }
  function clickOne() {
    const next = Math.round((state.targetMg + PEN.clickMg) / PEN.clickMg) * PEN.clickMg;
    return dialTo(next > 1.0001 ? PEN.clickMg : next);
  }
  function inject() {
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2))
      return fail('先装完这一段，再按注射按钮。');
    if (!has('dial') || !has('button')) return fail('按钮或旋钮还没装好。');
    if (state.pending > 0) return fail('正在注射——等它打完。');
    if (state.capOuter > 0.05 || state.capOuterT > 0.5) return fail('外帽还盖着——先拔掉外帽。');
    if (has('caps') && (state.capInner > 0.05 || state.capInnerT > 0.5)) return fail('内帽还罩着针头——先拔掉内帽。');
    if (has('needle') && (state.needle < 0.5 || state.needleT < 0.5)) return fail('还没装针头，药出不去。');
    if (state.windMg < PEN.clickMg / 2) return fail('旋钮在 0：按钮是锁死的，先拨剂量。');
    state.pending = state.windMg;
    state.pressT = 1;
    return {
      ok: true, kind: 'inject',
      message: '按下按钮：棘爪被顶开，扭簧释放——螺母转，丝杠前进 ' + (PEN.strokePerMg * state.windMg).toFixed(2) + ' mm，药经针头出去。',
    };
  }

  /* ---------------- 帽 / 针 ---------------- */
  function uncapOuter() {
    if (!has('caps')) return fail('外帽还没装上。');
    if (state.pending > 0) return fail('正在注射——先等它打完。');
    if (state.capOuterT < 0.5) return fail('外帽已经拔掉了。');
    state.capOuterT = 0;
    return { ok: true, kind: 'uncap', message: '外帽（杯状硬壳）已取下，露出内帽。' };
  }
  function uncapInner() {
    if (!has('caps')) return fail('内帽还没装上。');
    if (state.pending > 0) return fail('正在注射——先等它打完。');
    if (state.capOuterT > 0.5) return fail('外帽还套着——先把外帽拔掉。');
    if (state.capInnerT < 0.5) return fail('内帽已经拔掉了。');
    state.capInnerT = 0;
    return { ok: true, kind: 'uncap', message: '内帽（护住针座的薄护套）已取下，针座和针头露出来了。' };
  }
  function mountNeedle() {
    if (!has('needle')) return fail('针头还没装上。');
    if (state.pending > 0) return fail('正在注射——先等它打完。');
    if (state.capInnerT > 0.5) return fail('内帽还罩着针座——先拔内帽，针头才拧得进去。');
    if (state.needleT > 0.5) return fail('针头已经拧在针座上了。');
    state.needleT = 1;
    return { ok: true, kind: 'needle', message: '针头拧到针座螺纹上，拧到底时针管穿过隔膜进到药液里。' };
  }
  function unmountNeedle() {
    if (!has('needle')) return fail('针头还没装上。');
    if (state.pending > 0) return fail('正在注射——先等它打完。');
    if (state.needleT < 0.5) return fail('针头已经取下了。');
    state.needleT = 0;
    return { ok: true, kind: 'needle', message: '针头拧下来（一次性耗材，用完就丢）——卡式瓶不能换，但药还剩 ' + (TOTAL - state.delivered).toFixed(2) + ' mg。' };
  }

  /* ---------------- 每帧 ---------------- */
  function update(dt) {
    const h = Math.max(0, Math.min(0.1, dt || 0));
    // 帽 / 针滑动
    const step = (cur, want) => {
      const d = want - cur, m = MOVE_RATE * h;
      return Math.abs(d) <= m ? want : cur + Math.sign(d) * m;
    };
    state.capOuter = step(state.capOuter, state.capOuterT);
    state.capInner = step(state.capInner, state.capInnerT);
    state.needle = step(state.needle, state.needleT);
    // 按钮：按下 0.12 s，松手 0.2 s
    state.press += ((state.pressT ? 1 : 0) - state.press) * Math.min(1, h * (state.pressT ? 14 : 8));
    // 注射：pending 就是"这一针要打掉的剂量"，windMg 与 delivered 同步反向变化
    if (state.pending > 0.0005) {
      const d = Math.min(state.pending, INJECT_RATE * h);
      state.pending -= d;
      state.windMg = Math.max(0, state.windMg - d);
      state.delivered = Math.min(TOTAL, state.delivered + d);
      state.targetMg = Math.max(0, state.targetMg - d);
      if (state.pending <= 0.0005) {
        state.pending = 0; state.windMg = 0; state.targetMg = 0; state.pressT = 0;
        state.lastKind = 'done';
      }
    } else {
      // 拨剂量：旋钮追目标，几何与读数同步走
      const d = state.targetMg - state.windMg, m = DIAL_RATE * h;
      state.windMg = Math.abs(d) <= m ? state.targetMg : state.windMg + Math.sign(d) * m;
    }
  }

  function reset() {
    Object.assign(state, initial());
    state.needle = 0; state.needleT = 0; state.capOuter = 0; state.capInner = 0;
    state.capOuterT = 1; state.capInnerT = 1;
    return { ok: true, kind: 'restart', message: '新的装配开始了——先把药筒组件放进笔身。' };
  }
  function demo() {
    Object.assign(state, initial());
    state.placed = PEN_MODS.map((m) => m.id);
    state.completed = [true, true, true];
    state.chapter = PEN_CH.length - 1;
    state.phase = 'lab';
    state.capOuter = 1; state.capOuterT = 1;
    state.capInner = 1; state.capInnerT = 1;
    state.needle = 1; state.needleT = 1;
    return { ok: true, kind: 'demo', message: '整支笔装好了（帽还盖着）：先拔外帽、再拔内帽，然后拨剂量、按按钮。' };
  }

  return {
    state, current, select, place, undo, experiment, answer, next,
    dialTo, clickOne, inject, uncapOuter, uncapInner, mountNeedle, unmountNeedle,
    update, reset, demo,
    capsOff, slack, total: TOTAL,
  };
}
