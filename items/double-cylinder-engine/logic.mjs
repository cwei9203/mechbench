/* ============================================================================
 * 并列双缸发动机 · 装配与实验逻辑（纯逻辑，无 DOM）
 * 每个动作自己校验前置条件；失败不动业务状态。
 * ==========================================================================*/


/* 模块表与关卡文案的唯一来源是 manifest.mjs */
const MODULES = MANIFEST.modules;
const CHAPTERS = MANIFEST.chapters;

export function createGame(){
  const initial = () => ({
    chapter:0, phase:'build', placed:[], selected:null, completed:[false,false,false],
    running:false, chainOff:false, coverOff:false, crankDeg:0, runningSince:0,
  });
  const state = initial();
  const fail = message => ({ ok:false, message });
  const mods = ch => MODULES.filter(m => m.chapter === ch);
  const next = () => state.phase === 'build' ? mods(state.chapter).find(m => !state.placed.includes(m.id)) || null : null;

  function select(id){
    if (state.phase !== 'build') return fail('本章已装配完成，先做实验与挑战。');
    const m = MODULES.find(x => x.id === id);
    if (!m) return fail('没有这块模块，请从下方零件盒选择。');
    if (state.placed.includes(id)) return fail('这块模块已经装好了。');
    if (m.chapter !== state.chapter) return fail('这是后面章节的模块，先把当前这一组装完。');
    state.selected = id;
    return { ok:true, message:m.tip, kind:'select' };
  }
  function place(onTarget = true){
    if (state.phase !== 'build') return fail('本章已装配完成。');
    if (!state.selected) return fail('先从零件盒选一块模块。');
    if (onTarget !== true) return fail('还没对准安装位置：把模块拖到机身缺口上再松手。');
    const want = next();
    if (!want || want.id !== state.selected) return fail('这一步要装「' + (want ? want.name : '当前模块') + '」，顺序按机械依赖来。');
    state.placed.push(state.selected); state.selected = null;
    if (!next()) state.phase = 'experiment';
    return { ok:true, message:want.name + '已归位。', learn:want.learn, kind:'placed' };
  }
  function undo(){
    if (state.phase === 'lab') return fail('已进入自由实验；要重装请点「重新开始」。');
    const last = state.placed.at(-1);
    const m = MODULES.find(x => x.id === last);
    if (!m || m.chapter !== state.chapter) return fail('本章还没有装入的模块。');
    state.placed.pop(); state.phase = 'build'; state.selected = null;
    state.running = false; state.completed[state.chapter] = false;
    return { ok:true, message:'已撤回「' + m.name + '」。', kind:'undo' };
  }
  function experiment(){
    if (state.phase !== 'experiment') return fail('先把本章模块全部装好，再做实验。');
    // 第三关的实验就是"拆掉链条再看"：点按钮必须真的把链条拆下来
    if (state.chapter === 2) state.chainOff = true;
    state.phase = 'quiz'; state.running = true; state.runningSince = 0;
    return { ok:true, message:CHAPTERS[state.chapter].expText, kind:'manual' };
  }
  function answer(i){
    if (state.phase !== 'quiz') return fail('先亲手完成本章实验，再回答问题。');
    const ch = CHAPTERS[state.chapter];
    if (!Number.isInteger(i) || i < 0 || i >= ch.options.length) return fail('请选择一个有效答案。');
    if (i !== ch.a) return { ok:false, message:'再观察一下。' + ch.why, learn:ch.why, kind:'wrong' };
    state.running = false; state.completed[state.chapter] = true; state.phase = 'checkpoint';
    return { ok:true, message:'答对了！获得「' + ch.badge + '」。', learn:ch.why, kind:'correct' };
  }
  function advance(){
    if (state.phase !== 'checkpoint' || !state.completed[state.chapter]) return fail('先完成本章实验与挑战。');
    state.running = false; state.selected = null;
    if (state.chapter < CHAPTERS.length - 1){
      state.chapter++; state.phase = 'build';
      return { ok:true, message:CHAPTERS[state.chapter].subtitle, kind:'chapter' };
    }
    state.phase = 'lab';
    return { ok:true, message:'装配完成。现在可以自由运行、拆掉链条对比、剖开看内部。', kind:'complete' };
  }
  function run(on){
    if (state.phase !== 'lab' && state.phase !== 'quiz') return fail('先用实验按钮开始运转。');
    state.running = on === undefined ? !state.running : !!on;
    return { ok:true, message:state.running ? '曲轴开始转。' : '已停机。', kind:'run' };
  }
  function chain(){
    const inCh3Exp = state.chapter === 2 && (state.phase === 'experiment' || state.phase === 'quiz');
    if (state.phase !== 'lab' && !inCh3Exp) return fail('完成三章挑战后，才能拆链条做对比。');
    state.chainOff = !state.chainOff;
    return { ok:true, message: state.chainOff
      ? '正时链已拆下：再摇曲轴，凸轮轴和气门都不动了。'
      : '正时链已装回，凸轮轴重新跟住曲轴（2:1）。', kind:'chain' };
  }
  function cover(){
    if (state.phase !== 'lab') return fail('完成三章挑战后，才能拆气门室盖。');
    state.coverOff = !state.coverOff;
    return { ok:true, message: state.coverOff ? '气门室盖已取下，可以看到凸轮轴和挺柱。' : '气门室盖已盖回。', kind:'cover' };
  }
  function restart(){
    Object.assign(state, initial());
    return { ok:true, message:'新的装配开始了：先放下曲轴箱。', kind:'restart' };
  }
  // 直接看成品：整机重置后按章重建，保证从任意阶段进入都得到同一个状态
  function demo(){
    Object.assign(state, initial());
    state.placed = MODULES.map(m => m.id);
    state.chapter = 2; state.phase = 'lab'; state.completed = [true,true,true];
    return { ok:true, message:'整机已装好。看它转起来，再拆链条做对照。', kind:'demo' };
  }
  return { state, current:next, select, place, undo, experiment, answer, advance, run, chain, cover, restart, demo };
}
