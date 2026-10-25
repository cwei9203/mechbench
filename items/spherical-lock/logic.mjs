/* 球形门锁 · 装配与实验逻辑（纯逻辑，无 DOM、无三维）
 * 每个动作先校验前置条件；失败不动状态。模块与关卡文案的唯一来源是 manifest.mjs。
 * 运动常量（THROW / MAX_TURN / boltRetract / clamp）来自 model.mjs —— 与几何同一份。
 */
const MODULES = MANIFEST.modules;
const CHAPTERS = MANIFEST.chapters;
const MODULE_IDS = MODULES.map(m => m.id);

export function createGame() {
  const initial = () => ({
    chapter: 0, phase: 'build', placed: [], selected: null, completed: [false, false, false],
    observed: false, knobIn: 0, knobOut: 0, spindle: 0,
    locked: true, plug: 0, keyKind: 'none', keyInserted: 0, wrongTried: false, lab: false,
  });
  const state = initial();
  const fail = (message) => ({ ok: false, message });
  const mod = (id) => MODULES.find(m => m.id === id);
  const has = (id) => state.placed.includes(id);

  function current() {
    if (state.phase !== 'build') return null;
    return MODULES.find(m => m.chapter === state.chapter && !has(m.id)) || null;
  }
  function chapterDone(ch) {
    return MODULES.filter(m => m.chapter === ch).every(m => has(m.id));
  }
  function select(id) {
    if (state.phase !== 'build') return fail('本章装配已完成，先做实验和判断。');
    const m = mod(id);
    if (!m) return fail('零件盒里没有这块模块。');
    if (has(id)) return fail(m.name + '已经装上了。');
    state.selected = id;
    return { ok: true, message: m.tip, kind: 'select' };
  }
  function place(onTarget = true) {
    if (state.phase !== 'build') return fail('本章装配已完成。');
    const m = current();
    if (!state.selected) return fail('先从零件盒选一块模块。');
    if (onTarget !== true) return fail('还没对准安装位置，拖到轮廓里再松手。');
    if (!m || state.selected !== m.id) return fail('这一步需要先装' + (m ? m.name : '前面的模块') + '。');
    state.placed.push(m.id); state.selected = null;
    if (chapterDone(state.chapter)) { state.phase = 'experiment'; state.observed = false; }
    return { ok: true, message: m.name + '已归位。', learn: m.learn, kind: 'placed' };
  }
  function undo() {
    if (state.phase === 'lab') return fail('整机已装好；想重装请点「重新开始」。');
    const last = state.placed.filter(id => mod(id).chapter === state.chapter).pop();
    if (!last) return fail('本章还没有装上的模块。');
    state.placed = state.placed.filter(id => id !== last);
    state.phase = 'build'; state.selected = null;
    state.observed = false; state.completed[state.chapter] = false;
    state.knobIn = 0; state.knobOut = 0; state.spindle = 0;
    return { ok: true, message: '已撤回' + mod(last).name + '。', kind: 'undo' };
  }
  function pushBolt() {
    if (!has('latch')) return fail('先装好锁舌组件。');
    if (state.phase === 'build') return fail('先装完本章模块，再做实验。');
    return { ok: true, kind: 'push', message: '斜舌被按下 12.7 mm，松手后弹簧把它推回来。' };
  }
  function knob(side, deg) {
    const id = side === 'in' ? 'knobIn' : 'knobOut';
    if (!has(id)) return fail(side === 'in' ? '内执手还没装上。' : '外执手还没装上。');
    if (!has('spindle')) return fail('方轴还没装，执手转起来不会带动任何零件。');
    const a = clamp(Number.isFinite(deg) ? deg : 0, 0, MAX_TURN);
    if (side === 'in') state.knobIn = a; else state.knobOut = a;
    const engaged = side === 'in' ? true : !state.locked;
    state.spindle = engaged ? a : 0;
    return {
      ok: true, kind: 'knob', engaged, pull: boltRetract(state.spindle),
      message: side === 'in'
        ? (a > 60 ? '内执手转到底：方轴转 ' + Math.round(a) + '°，锁舌回缩 ' + boltRetract(a).toFixed(1) + ' mm。' : '内执手已经带动方轴。')
        : (!state.locked ? '离合已接通，外执手带动方轴。' : '外执手在空转：离合套没有接上，方轴没动。'),
    };
  }
  function insertKey(kind) {
    if (!has('key')) return fail('钥匙还没装上。');
    if (!has('knobOut')) return fail('锁芯还没装（外执手模块未归位）。');
    if (state.knobOut > 0.5) return fail('先把外侧执手松开，再动钥匙。');
    if (kind !== 'right' && kind !== 'wrong' && kind !== 'none') return fail('只能插对钥匙、错钥匙，或者拔出来。');
    if (kind !== 'none' && state.plug > 0.5) return fail('锁芯已经转过去了，先转回来再动钥匙。');
    state.keyKind = kind; state.keyInserted = kind === 'none' ? 0 : 1;
    if (kind === 'wrong') state.wrongTried = true;
    return {
      ok: true, kind: 'key',
      message: kind === 'wrong' ? '错钥匙插到底了：第 3 组弹子低 1 mm，跨着剪切线。'
        : kind === 'right' ? '对钥匙插到底：五组弹子接缝都落在剪切线上。' : '钥匙已拔出。',
    };
  }
  function turnKey(deg) {
    if (!has('key')) return fail('还没有钥匙。');
    if (state.keyKind === 'none') return fail('先插钥匙。');
    if (state.keyKind === 'wrong') {
      return { ok: false, kind: 'blocked',
        message: '转不动。有一组弹子跨在剪切线上，把转子顶死了——插得进去，不等于转得动。' };
    }
    if (state.knobOut > 0.5) return { ok: false, message: '先把外侧执手松开，锁芯才退得回来。' };
    const a = clamp(Number.isFinite(deg) ? deg : 0, 0, MAX_TURN);
    state.plug = a;
    if (a >= MAX_TURN - 0.5) state.locked = false;
    else if (a <= 0.5) state.locked = true;
    return {
      ok: true, kind: 'plug',
      message: a >= MAX_TURN - 0.5 ? '锁芯转到 90°：尾片把离合套推进外执手，外执手现在能带动方轴。'
        : a <= 0.5 ? '锁芯回到 0°，离合套退回，外执手重新空转。' : '锁芯转动中。',
    };
  }
  // 本关实验：动作 + 观察一次做完，然后进判断（判断阶段还能「再看一遍」）
  function experiment() {
    if (state.phase !== 'experiment' && state.phase !== 'quiz') return fail('先把本章模块全部装好，再做实验。');
    const again = state.phase === 'quiz';
    const ch = CHAPTERS[state.chapter];
    state.observed = true;
    let tail = '';
    if (state.chapter === 0) tail = '';
    if (state.chapter === 1) { state.knobIn = MAX_TURN; state.spindle = MAX_TURN; }
    if (state.chapter === 2) {
      insertKey('wrong');
      const blocked = turnKey(MAX_TURN);
      state.plug = 0;
      const keyed = insertKey('right');
      const opened = turnKey(MAX_TURN);
      tail = ' 错钥匙：' + blocked.message + ' 对钥匙：' + keyed.message + opened.message;
    }
    if (!again) state.phase = 'quiz';
    return {
      ok: true, message: ch.expText + tail,
      kind: state.chapter === 0 ? 'push' : state.chapter === 1 ? 'knob' : 'key',
    };
  }
  function answer(index) {
    if (state.phase !== 'quiz') return fail('先亲手完成本章实验，再回答问题。');
    const ch = CHAPTERS[state.chapter];
    if (!Number.isInteger(index) || index < 0 || index >= ch.options.length) return fail('请选择一个有效答案。');
    if (index !== ch.a) return { ok: false, kind: 'wrong', message: '再观察一下。' + ch.why, learn: ch.why };
    state.completed[state.chapter] = true; state.phase = 'checkpoint';
    return { ok: true, kind: 'correct', message: '答对了，获得「' + ch.badge + '」。', learn: ch.why };
  }
  function next() {
    if (state.phase !== 'checkpoint' || !state.completed[state.chapter]) return fail('先完成本章实验与判断。');
    state.selected = null; state.observed = false;
    state.knobIn = 0; state.knobOut = 0; state.spindle = 0;
    if (state.chapter < CHAPTERS.length - 1) {
      state.chapter++; state.phase = 'build';
      return { ok: true, kind: 'chapter', message: CHAPTERS[state.chapter].subtitle };
    }
    state.phase = 'lab'; state.lab = true;
    return { ok: true, kind: 'complete', message: '整机装好了。现在可以转执手、插钥匙、锁上、剖开看五组弹子。' };
  }
  // 自由实验：一键满装
  function demo() {
    Object.assign(state, initial());
    state.placed = MODULE_IDS.slice();
    state.completed = [true, true, true];
    state.chapter = CHAPTERS.length - 1; state.phase = 'lab'; state.lab = true;
    return { ok: true, kind: 'demo', message: '整机已装好：所有实验解锁，锁处于锁定状态。' };
  }
  function restart() {
    Object.assign(state, initial());
    return { ok: true, kind: 'restart', message: '重新开始：先从锁舌组件装起。' };
  }
  return { state, current, chapterDone, select, place, undo, pushBolt, knob, insertKey, turnKey,
    experiment, answer, next, demo, restart };
}
