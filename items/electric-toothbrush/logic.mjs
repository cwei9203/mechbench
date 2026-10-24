/* ============================================================================
 * 电动牙刷 · 装配与实验逻辑（纯逻辑，无 DOM、无三维）
 * 每个动作自己校验前置条件；失败不动业务状态。
 * ==========================================================================*/

/* 模块表与关卡文案的唯一来源是 manifest.mjs */
const MODULES = MANIFEST.modules;
const CHAPTERS = MANIFEST.chapters;

export function createGame(){
  const initial=()=>({chapter:0,phase:'build',placed:[],selected:null,rotation:0,completed:[false,false,false],running:false,headOff:false});
  const state=initial();
  const fail=message=>({ok:false,message});
  function current(){return state.phase==='build'?MODULES.find(m=>m.chapter===state.chapter&&!state.placed.includes(m.id))||null:null;}
  function select(id){
    if(state.phase!=='build')return fail('先完成本章实验与挑战，再继续装配。');
    const module=MODULES.find(m=>m.id===id);
    if(!module)return fail('没有这块模块，请从零件盘选择。');
    if(state.placed.includes(id))return fail('这块模块已经装好了。');
    state.selected=id;state.rotation=id==='head'?1:0;
    return {ok:true,message:module.tip};
  }
  function turn(){
    if(state.phase!=='build'||state.selected!=='head')return fail('先选中空心刷头，才能调整 D 形内孔方向。');
    state.rotation=(state.rotation+1)%4;
    return {ok:true,message:state.rotation===0?'D 形平面已对齐，可以装上刷头。':'刷头已转过 90°，继续对齐 D 形平面。'};
  }
  function place(onTarget=true){
    if(state.phase!=='build')return fail('本章装配已完成，请进行实验与挑战。');
    if(!state.selected)return fail('先从零件盘选一块模块。');
    if(onTarget!==true)return fail('还没对准装配位置，拖到轮廓内再松手。');
    const module=current();
    if(!module||state.selected!==module.id)return fail('这一步需要'+(module?.name||'当前模块')+'。先完成支承和连接，再装后面的零件。');
    if(module.id==='head'&&state.rotation!==0)return fail('D 形平面还没对齐。旋转刷头，让内孔与金属轴的平面一致。');
    state.placed.push(module.id);state.selected=null;state.rotation=0;
    if(!MODULES.some(m=>m.chapter===state.chapter&&!state.placed.includes(m.id)))state.phase='experiment';
    return {ok:true,message:module.name+'已归位。',learn:module.learn,kind:'placed'};
  }
  function undo(){
    if(state.phase==='lab')return fail('整机已通关；想重新装配，请点击重新开始。');
    const last=state.placed.at(-1),module=MODULES.find(m=>m.id===last);
    if(!module||module.chapter!==state.chapter)return fail('本章还没有装入的模块。');
    state.placed.pop();state.phase='build';state.selected=null;state.rotation=0;state.running=false;state.headOff=false;state.completed[state.chapter]=false;
    return {ok:true,message:'已撤回'+module.name+'，可以重新装配。',kind:'undo'};
  }
  function experiment(){
    if(state.phase!=='experiment')return fail('先把本章模块全部装好，再进行实验。');
    state.phase='quiz';state.running=state.chapter>0;
    return {ok:true,message:CHAPTERS[state.chapter].expText,kind:state.chapter===0?'manual':'power'};
  }
  function answer(index){
    if(state.phase!=='quiz')return fail('先亲手完成本章实验，再回答问题。');
    const chapter=CHAPTERS[state.chapter];
    if(!Number.isInteger(index)||index<0||index>=chapter.options.length)return fail('请选择一个有效答案。');
    if(index!==chapter.a)return {ok:false,message:'再观察一下。'+chapter.why,learn:chapter.why,kind:'wrong'};
    state.running=false;state.completed[state.chapter]=true;state.phase='checkpoint';
    return {ok:true,message:'答对了！获得「'+chapter.badge+'」。',learn:chapter.why,kind:'correct'};
  }
  function next(){
    if(state.phase!=='checkpoint'||!state.completed[state.chapter])return fail('先完成本章实验与挑战。');
    state.running=false;state.selected=null;state.rotation=0;
    if(state.chapter<CHAPTERS.length-1){state.chapter++;state.phase='build';return {ok:true,message:CHAPTERS[state.chapter].subtitle,kind:'chapter'};}
    state.phase='lab';return {ok:true,message:'装配完成！现在可以自由运行、剖开观察，或停机拔下刷头。',kind:'complete'};
  }
  function power(){
    if(state.phase!=='lab')return fail('先完成三章挑战，再进入自由实验。');
    state.running=!state.running;
    return {ok:true,message:state.running?(state.headOff?'空载观察：金属轴摆动，移开的刷头保持不动。':'整机运行：金属轴与刷头同步往复，机壳固定。'):'已停机，可以检查或拆装刷头。',kind:state.running?'power':'stop'};
  }
  function head(){
    if(state.phase!=='lab')return fail('完成装配挑战后，才能拆下刷头进行对比。');
    if(state.running)return fail('请先停机，再拔下或装回刷头。');
    state.headOff=!state.headOff;
    return {ok:true,message:state.headOff?'刷头已拔下，内衬随刷头离开，金属轴留在手柄。可点击运行进行空载观察。':'刷头已装回，D 形内衬重新与金属轴连接。',kind:state.headOff?'headOff':'headOn'};
  }
  function restart(){Object.assign(state,initial());return {ok:true,message:'新的装配开始了，先把骨架放到装配台。',kind:'restart'};}
  // 直接看成品：整机装好 + 三关完成 + 已通电
  function demo(){
    Object.assign(state,initial());
    state.placed=MODULES.map(m=>m.id);state.completed=[true,true,true];
    state.chapter=CHAPTERS.length-1;state.phase='lab';state.running=true;
    return {ok:true,message:'整机已装好并通电。看它摆，再拔下刷头做空载对照。',kind:'demo'};
  }
  return {state,current,select,turn,place,undo,experiment,answer,next,power,head,restart,demo};
}
