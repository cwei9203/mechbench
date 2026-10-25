/* 手摇发电手电筒 · 装配与实验逻辑（纯逻辑，无 DOM、无三维）
 * 每个动作先校验前置条件；失败不动业务状态。模块与关卡文案的唯一来源是 manifest.mjs。
 */
const GEAR_RATIO = 16;
const MODULES = MANIFEST.modules;
const CHAPTERS = MANIFEST.chapters;

/* ---------------- 电气与机构参数（教学模型，见文档） ---------------- */
const RATIO = GEAR_RATIO;
const CHARGE_RATE = .95;       // 满速摇动时每秒充入的电量
const DRAIN_ON = .16;          // LED 点亮时每秒放掉的电量（约 6 秒余辉）
const DRAIN_OFF = .02;         // 开关断开时的漏电
const FULL_SPEED = 1.5;        // 视为满速的摇动速度（圈/秒）

export function createGame(){
  const initial = () => ({
    chapter:0, phase:'build', placed:[], selected:null, rotation:0,
    completed:[false,false,false], switchOn:false,
    crankTurns:0, charge:0, handActive:0, lastSpeed:0, glowPeak:0
  });
  const state = initial();
  const fail = message => ({ok:false,message});
  const has = id => state.placed.includes(id);
  const chainReady = () => ['plate','crank','crankGear','idler','generator','pinion'].every(has);
  const circuitReady = () => ['board','capacitor','switch','head'].every(has);
  const current = () => state.phase==='build'
    ? MODULES.find(m=>m.chapter===state.chapter && !has(m.id)) || null : null;

  function select(id){
    if(state.phase!=='build') return fail('先完成本章实验与挑战，再继续装配。');
    const m = MODULES.find(x=>x.id===id);
    if(!m) return fail('没有这块模块，请从零件盒选择。');
    if(has(id)) return fail('这块模块已经装好了。');
    state.selected = id;
    return {ok:true,message:m.tip};
  }
  function place(onTarget=true){
    if(state.phase!=='build') return fail('本章装配已完成，请做实验与挑战。');
    if(!state.selected) return fail('先从零件盒选一块模块。');
    if(onTarget!==true) return fail('还没对准装配位置，拖到轮廓内再松手。');
    const m = current();
    if(!m || state.selected!==m.id)
      return fail('这一步需要'+(m?.name||'当前模块')+'。传动链有先后，先装支承和上一级。');
    state.placed.push(m.id); state.selected = null;
    if(m.id==='switch') state.switchOn = true;          // 装进去时拨杆停在「开」
    if(!MODULES.some(x=>x.chapter===state.chapter && !has(x.id))) state.phase = 'experiment';
    return {ok:true,message:m.name+' 已归位。',learn:m.learn,kind:'placed'};
  }
  function undo(){
    if(state.phase==='lab') return fail('整机已通关；想重装请点重新开始。');
    const last = state.placed.at(-1), m = MODULES.find(x=>x.id===last);
    if(!m || m.chapter!==state.chapter) return fail('本章还没有装入的模块。');
    state.placed.pop(); state.phase='build'; state.selected=null;
    state.completed[state.chapter]=false; state.handActive=0;
    if(m.id==='switch') state.switchOn=false;
    if(!chainReady()){ state.crankTurns=0; state.charge=0; }
    return {ok:true,message:'已撤回 '+m.name+'，可以重新装配。',kind:'undo'};
  }
  function experiment(){
    if(state.phase!=='experiment') return fail('先把本章模块全部装好，再做实验。');
    const c = CHAPTERS[state.chapter];
    if(c.expKind==='ratio' && !chainReady()) return fail('传动链还没闭合。');
    if(c.expKind==='glow' && !circuitReady()) return fail('电路还没接通。');
    state.phase='quiz';
    return {ok:true,message:c.expText,kind:c.expKind};
  }
  function answer(index){
    if(state.phase!=='quiz') return fail('先亲手完成本章实验，再回答问题。');
    const c = CHAPTERS[state.chapter];
    if(!Number.isInteger(index)||index<0||index>=c.options.length) return fail('请选择一个有效答案。');
    if(index!==c.a) return {ok:false,message:'再观察一下。'+c.why,learn:c.why,kind:'wrong'};
    state.completed[state.chapter]=true; state.phase='checkpoint';
    return {ok:true,message:'答对了！获得「'+c.badge+'」。',learn:c.why,kind:'correct'};
  }
  function next(){
    if(state.phase!=='checkpoint'||!state.completed[state.chapter]) return fail('先完成本章实验与挑战。');
    state.selected=null;
    if(state.chapter<CHAPTERS.length-1){
      state.chapter++; state.phase='build';
      return {ok:true,message:CHAPTERS[state.chapter].subtitle,kind:'chapter'};
    }
    state.phase='lab';
    return {ok:true,message:'装配完成！可以自由摇、开关灯、拆开看传动。',kind:'complete'};
  }
  // 摇动：turns 为本次增加的圈数（可正可负），dt 为这一帧的秒数
  function crank(turns,dt){
    if(!chainReady()) return fail('传动链还没装好，摇柄转不动齿轮。');
    if(state.phase==='build'||state.phase==='checkpoint') return fail('先完成这一段的装配。');
    const d = Number(turns)||0, h = Math.max(1e-3,Number(dt)||0);
    state.crankTurns += d;
    state.lastSpeed = Math.abs(d)/h;
    state.handActive = .18;
    if(circuitReady()){
      const p = Math.min(1,state.lastSpeed/FULL_SPEED);
      state.charge = Math.min(1,state.charge + p*CHARGE_RATE*h);
    }
    return {ok:true,turns:state.crankTurns,genTurns:state.crankTurns*RATIO,
      speed:state.lastSpeed,charge:state.charge,kind:'crank'};
  }
  function update(dt){
    const h = Math.max(0,Math.min(.1,dt||0));
    state.handActive = Math.max(0,state.handActive-h);
    if(state.handActive<=0 && state.charge>0){
      const drain = state.switchOn && circuitReady() ? DRAIN_ON : DRAIN_OFF;
      state.charge = Math.max(0,state.charge - drain*h);
    }
  }
  function toggleSwitch(){
    if(!has('switch')) return fail('还没装电源开关。');
    if(state.phase!=='quiz'&&state.phase!=='experiment'&&state.phase!=='lab')
      return fail('先完成本段装配。');
    state.switchOn = !state.switchOn;
    return {ok:true,message:state.switchOn?'开关已合上：LED 接入回路。':'开关已断开：摇动只会给电容充电，灯不亮。',kind:'switch'};
  }
  function brightness(){
    if(!state.switchOn || !circuitReady()) return 0;
    return Math.max(0,Math.min(1,(state.charge-.04)/.5));
  }
  function voltage(){ return 2.0 + 1.6*state.charge; }
  function rpm(){
    // 只用于读数：把当前摇动速度换算成转子转速
    return state.lastSpeed*RATIO*60;
  }
  function demo(){
    Object.assign(state,initial());
    state.placed = MODULES.map(m=>m.id);
    state.completed=[true,true,true];state.chapter=CHAPTERS.length-1;state.phase='lab';state.switchOn=true;
    return {ok:true,message:'整机已装好：拖摇柄、开关灯、剖开看，随便试。',kind:'demo'};
  }
  function restart(){
    Object.assign(state,initial());
    return {ok:true,message:'新的装配开始了，先把传动板放进后壳。',kind:'restart'};
  }
  return {state,current,select,place,undo,experiment,answer,next,crank,update,
    toggleSwitch,brightness,voltage,rpm,chainReady,circuitReady,demo,restart};
}
