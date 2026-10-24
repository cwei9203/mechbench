/* 模板物品 · 接线（真物品照这个结构写，只是多了三维调用）
 * 规则：lab.state 只是"要显示什么"；装配是否合法在这里判断，失败不动状态。
 */
const lab = mountLab(MANIFEST);
const model = createModel(MANIFEST);
const TOTAL = lab.modules.length;

function sync() {
  const chMods = lab.chapterModules();
  const done = chMods.every((m) => lab.state.placed.includes(m.id));
  if (done && lab.state.phase === 'build') lab.state.phase = 'check';
  lab.state.readout = {
    crank: (lab.state.crankDeg ?? 0) + '°',
    state: lab.state.phase === 'done' ? '本关完成' : lab.state.placed.length + ' / ' + TOTAL,
  };
  lab.state.visible.readout = true;
  lab.render();
}

function say(text, kind = '') {
  lab.state.feedback = text;
  lab.state.feedbackKind = kind;
}

lab.on('select', (id) => {
  lab.state.selected = lab.state.selected === id ? null : id;
  say(id ? `已选中「${lab.moduleOf(id).name}」，按「装到这里」或直接拖过去。` : '');
  sync();
});

lab.on('place', () => {
  const id = lab.state.selected;
  if (!id) return say('先在零件盒里选一块模块。', 'error');
  const m = lab.moduleOf(id);
  lab.state.placed.push(id);
  lab.state.selected = null;
  model.install(id);
  say(`「${m.name}」装好了。${m.learn}`, 'success');
  sync();
});

lab.on('undo', () => {
  const id = lab.state.placed.pop();
  if (!id) return;
  model.uninstall(id);
  lab.state.phase = 'build';
  say(`撤回一步：把「${lab.moduleOf(id).name}」拿回零件盒。`);
  sync();
});

lab.on('answer', (i) => {
  const task = lab.item.tasks[lab.state.chapter];
  if (i !== task.a) return say(`再想想：${task.options[i]} 不对。提示——${task.expText}`, 'error');
  lab.state.badges.push(lab.chapters[lab.state.chapter].badge);
  lab.state.phase = 'done';
  say(task.why, 'success');
  sync();
});

lab.on('next', () => {
  lab.state.chapter = Math.min(lab.state.chapter + 1, lab.chapters.length - 1);
  lab.state.phase = 'build';
  lab.state.selected = null;
  say('');
  sync();
});

lab.on('replay', () => {
  lab.state.phase = 'check';
  say('再看一遍刚才的现象，然后重新作答。');
  sync();
});

lab.on('free', () => {
  for (const m of lab.modules) if (!lab.state.placed.includes(m.id)) lab.state.placed.push(m.id);
  lab.state.chapter = lab.chapters.length - 1;
  lab.state.phase = 'done';
  lab.state.selected = null;
  say('自由实验：全部模块已装上，随便拆、随便试。');
  sync();
});

lab.on('restart', () => {
  lab.state.placed = [];
  lab.state.badges = [];
  lab.state.chapter = 0;
  lab.state.phase = 'build';
  lab.state.selected = null;
  lab.state.crankDeg = 0;
  say('');
  sync();
});

lab.on('experiment', ({ id, value }) => {
  if (id === 'crank') lab.state.crankDeg = value;
  sync();
});

lab.on('tool', (id) => {
  if (id === 'home') say('视角已复位。');
  sync();
});

say('从下方选中「底座」，开始第一步。');
sync();
