/* 气钉枪 · 装配与实验逻辑（纯逻辑，无 DOM、无三维）
 * 每个动作先校验前置条件；失败不动业务状态。模块与关卡文案的唯一来源是 manifest.mjs。
 */
const MODULES = MANIFEST.modules;
const CHAPTERS = MANIFEST.chapters;

export function createGame(){
  const NAILS = 80;
  const initial = () => ({ chapter:0, phase:'build', placed:[], selected:null,
    completed:[false,false,false], air:false, trip:0, trigger:0, fired:0, nails:NAILS,
    depth:0, jam:false, latch:0, expStep:0 });
  const state = initial();
  const fail = message => ({ ok:false, message });
  const mod = id => MODULES.find(m => m.id === id);
  function current(){
    if (state.phase !== 'build') return null;
    return MODULES.find(m => m.chapter === state.chapter && !state.placed.includes(m.id)) || null;
  }
  function select(id){
    if (state.phase !== 'build') return fail(state.phase==='lab' ? '自由实验室里不搞装配,想重拼请点重新开始。' : '先完成本章实验与挑战,再继续装配。');
    const m = mod(id);
    if (!m) return fail('没有这块模块,请从零件盒选择。');
    if (state.placed.includes(id)) return fail(m.name + '已经装好了。');
    if (m.chapter !== state.chapter) return fail('这一步还轮不到' + m.name + '——先完成当前模块。');
    state.selected = id;
    return { ok:true, message:m.tip };
  }
  function place(onTarget=true){
    if (state.phase !== 'build') return fail('本章装配已完成,请进行实验与挑战。');
    if (!state.selected) return fail('先从零件盒选一块模块。');
    if (onTarget !== true) return fail('还没对准装配位置——拖到蓝色轮廓里再松手,或按「装到这里」。');
    const m = current();
    if (!m) return fail('本章已经装完了。');
    if (state.selected !== m.id) return fail('这一步需要「' + (m ? m.name : '当前模块') + '」,顺序不能乱。');
    state.placed.push(m.id); state.selected = null;
    if (!MODULES.some(x => x.chapter === state.chapter && !state.placed.includes(x.id))) state.phase = 'experiment';
    return { ok:true, message:m.name + '已归位。', learn:m.learn, kind:'placed' };
  }
  function undo(){
    if (state.phase === 'lab') return fail('自由实验室不撤回;想重拼请点重新开始。');
    const last = state.placed.at(-1), m = mod(last);
    if (!m || m.chapter !== state.chapter) return fail('本章还没有可撤回的模块。');
    state.placed.pop(); state.phase = 'build'; state.selected = null;
    state.air = false; state.trip = 0; state.trigger = 0; state.expStep = 0;
    if (m.id === 'nails'){ state.nails = NAILS; }
    if (m.id === 'follower' && state.placed.includes('nails')){ state.nails = NAILS; }
    state.completed[state.chapter] = false;
    return { ok:true, message:'已撤回' + m.name + ',可以重新装配。', kind:'undo' };
  }
  function experiment(){
    if (state.phase !== 'experiment') return fail('先把本章模块全部装好,再进行实验。');
    state.phase = 'quiz'; state.expStep = 0;
    return { ok:true, message:CHAPTERS[state.chapter].expText, kind:'experiment' };
  }
  // 实验演示动作(阶段限定)
  function demoAir(){
    if (state.phase !== 'experiment') return fail('实验动作要在实验阶段做。');
    if (state.chapter !== 1) return fail('本章不需要接气。');
    state.air = true; state.expStep = Math.max(state.expStep,1);
    return { ok:true, message:'气源接通:气室充压。活塞被缸下腔/回程腔的气压顶在上位——听,充气有一声短促的排气声。', kind:'air' };
  }
  function demoTrip(){
    if (state.phase !== 'experiment') return fail('实验动作要在实验阶段做。');
    if (state.chapter !== 1) return fail('本章不压鼻端。');
    if (!state.air) return fail('先接通气源,再压鼻端。');
    state.trip = state.trip ? 0 : 1; state.expStep = Math.max(state.expStep,2);
    return { ok:true, message:state.trip ? '触压板压紧工件(缩回 4 mm),扳机联动解锁——但还没扣扳机,不击发。' : '触压板回位,扳机重新锁住。', kind:'trip' };
  }
  function demoTrigger(){
    if (state.phase !== 'experiment') return fail('实验动作要在实验阶段做。');
    if (state.chapter !== 1) return fail('本章不空扣扳机。');
    if (!state.trip) return { ok:false, kind:'blocked', message:'扣不动:鼻端触压板没有压住工件,顺序击发联动锁住了扳机。这正是两段保险——先压鼻端,再扣扳机。' };
    if (!state.air) return { ok:false, kind:'blocked', message:'扳机能扣动,但没接气,阀后无气,头阀塞上腔不放气,照样不击发。先接气。' };
    return { ok:false, kind:'blocked', message:'气已接、鼻端已压、扳机已扣——这下会真的击发!但弹匣里还没装钉条,去第三章装上钉条再打。' };
  }
  function answer(i){
    if (state.phase !== 'quiz') return fail('先亲手完成本章实验,再回答问题。');
    const c = CHAPTERS[state.chapter];
    if (!Number.isInteger(i) || i<0 || i>=c.options.length) return fail('请选择一个有效答案。');
    if (i !== c.a) return { ok:false, message:'再观察一下。' + c.why, kind:'wrong' };
    state.completed[state.chapter] = true; state.phase = 'checkpoint';
    return { ok:true, message:'答对了!获得「' + c.badge + '」。', kind:'correct' };
  }
  function next(){
    if (state.phase !== 'checkpoint' || !state.completed[state.chapter]) return fail('先完成本章实验与挑战。');
    if (state.chapter < CHAPTERS.length-1){ state.chapter++; state.phase='build'; state.expStep=0; state.air=false; state.trip=0; state.trigger=0;
      return { ok:true, message:CHAPTERS[state.chapter].subtitle, kind:'chapter' }; }
    state.phase = 'lab';
    return { ok:true, message:'装配完成!进入自由实验室:击发、调深浅、制造卡钉再清障。', kind:'complete' };
  }
  // 自由实验动作
  function fire(){
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2)) return fail('完成装配与实验后才可击发。');
    if (!state.air) return fail('未接通气源——先接气再击发。');
    if (!state.trip) return fail('鼻端触压板未压下——两段式顺序击发要求先压鼻端。');
    if (!state.trigger) return fail('先扣住扳机,再保持压紧鼻端。');
    if (state.jam) return { ok:true, kind:'jamstop', message:'刀口下行顶住弯钉,击发中止——打开卡扣门清障。' };
    if (state.nails <= 0){ return { ok:true, kind:'lockout', message:'弹匣已空:推钉板前沿进入击发窗,锁定空击——装入钉条再打。' }; }
    state.fired++; state.nails--;
    return { ok:true, kind:'fired', message:'击发!高压气经头阀压下活塞,击针把钉打进木板;回程腔随即把活塞顶回,钉条前进一格。' };
  }
  function setAir(){
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2)) return fail('完成装配后才可操作气源。');
    state.air = !state.air; state.expStep = Math.max(state.expStep, state.air?1:0);
    if (!state.air){ state.trigger = 0; }
    return { ok:true, message:state.air ? '气源接通,气室充压(表压 0.6 MPa)。' : '气源已断开,气压归零。', kind:'air' };
  }
  function setTrip(){
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2)) return fail('完成装配后才可压鼻端。');
    state.trip = state.trip ? 0 : 1;
    if (!state.trip) state.trigger = 0;
    return { ok:true, message:state.trip ? '触压板压紧工件,扳机联动解锁。' : '触压板回位,扳机重新锁住。', kind:'trip' };
  }
  function setTrigger(){
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2)) return fail('完成装配后才可扣扳机。');
    if (!state.trip) return { ok:false, kind:'blocked', message:'扣不动:触压板未压下,顺序击发联动锁住扳机——先压鼻端。' };
    state.trigger = state.trigger ? 0 : 1;
    return { ok:true, message:state.trigger ? '扳机已扣住:触发阀放气,只待击发。' : '扳机已松开。', kind:'trigger' };
  }
  function cycleDepth(){
    if (state.phase !== 'lab' && !(state.phase === 'experiment' && state.chapter === 2)) return fail('先完成三章挑战,再进实验室调深浅。');
    state.depth = ((state.depth + 2) % 3) - 1;   // -1 浅 · 0 中 · 1 深
    const name = state.depth === 1 ? '深(钉帽近齐平)' : state.depth === 0 ? '中' : '浅(钉帽露出更多)';
    return { ok:true, message:'深度调节:转为' + name + '。再击发一钉对比钉帽高度。', kind:'depth' };
  }
  function setLatch(){
    if (state.phase !== 'lab') return fail('先完成三章挑战,再进实验室。');
    if (!state.jam && !state.latch){ state.latch = 1; return { ok:true, kind:'latch', message:'卡扣门已打开:能看到刀槽与出口。', latch:1 }; }
    if (state.jam && state.latch){ state.jam = false; state.latch = 0; return { ok:true, kind:'clearjam', message:'弯钉已取出,合上卡扣门,可以继续击发。', latch:0 }; }
    state.latch = state.latch ? 0 : 1;
    return { ok:true, kind:'latch', message:state.latch ? '卡扣门已打开。' : '卡扣门已合上。', latch:state.latch };
  }
  function injectJam(){
    if (state.phase !== 'lab') return fail('先完成三章挑战,再进实验室。');
    if (state.jam) return fail('已经有一根弯钉卡住了。');
    if (state.nails <= 0) return fail('弹匣是空的,先装入钉条。');
    state.jam = true;
    return { ok:true, kind:'jam', message:'下一根钉打偏弯住——再击发就会顶在弯钉上。打开卡扣门把它取出来。' };
  }
  function reload(){
    if (state.phase !== 'lab') return fail('先完成三章挑战,再进实验室。');
    state.nails = NAILS; state.fired = 0; state.jam = false; state.latch = 0;
    return { ok:true, kind:'reload', message:'已装入整条 F38 直钉(80 支展示),清空击发记录与卡钉。' };
  }
  function pressPiston(){
    if (state.phase === 'experiment' && state.chapter === 0) return { ok:true, kind:'press', message:'活塞被压下 21 mm,缸下腔的空气被压进回程环腔;松手后被这团气顶回,晃两下停住。' };
    if (state.phase === 'lab') return { ok:true, kind:'press', message:'手动下压活塞:缸下腔空气经回程孔压进环腔,松手回弹——这就是回程的气垫。' };
    return fail('这个动作在第一章实验或实验室里才有意义。');
  }
  function freeview(){
    Object.assign(state, initial());
    state.placed = MODULES.map(m => m.id);
    state.completed = [true, true, true];
    state.chapter = CHAPTERS.length - 1;
    state.phase = 'lab';
    return { ok:true, kind:'freeview', message:'已装配完整机,进入自由实验。' };
  }
  function restart(){ Object.assign(state, initial()); return { ok:true, kind:'restart', message:'新的装配开始了——把主机体放上装配台。' }; }
  return { state, current, select, place, undo, experiment, demoAir, demoTrip, demoTrigger,
           answer, next, fire, setAir, setTrip, setTrigger, cycleDepth, setLatch, injectJam,
           reload, pressPiston, freeview, restart, NAILS };
}
