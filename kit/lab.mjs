/* mechbench · 布局渲染层
 * 把 manifest 的插槽填进固定骨架，并把玩家操作转成事件。
 * 不做三维（kit/scene.mjs）、不做业务规则（物品的 logic.mjs / main.mjs）。
 */

const COPY = {
  brand: { title: '装配实验室', subtitle: '', mark: { a: '#c2452d', b: '#9aa6b2' } },
  stage: {
    title: '装一台能动的机器',
    hint: '从下方零件盒选一块模块，拖到机身高亮处。',
    gestures: '拖动空白处旋转 · 右键平移 · 滚轮缩放<br>触屏双指平移 / 缩放',
  },
  tray: { title: '零件盒', hint: '点选模块，再拖到高亮位置' },
  coach: { tag: '第 {n} 关 / {total}', hintLabel: '工作台提示', notesLabel: '这是怎样的一套模型？' },
  tools: [
    { id: 'rotate', label: '旋转', pressed: true },
    { id: 'pan', label: '平移' },
    { id: 'cut', label: '剖开看' },
    { id: 'home', label: '复位' },
  ],
  labels: {
    exp: '本关要观察的', quiz: '判断一下', done: '本关完成',
    installed: '✓ 已归位', picked: '拿起这块', preloaded: '{n} 组零件预装',
  },
};

const q = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function pick(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? pick(base[k] || {}, v) : v;
  }
  return out;
}

export function mountLab(item) {
  const copy = pick(COPY, item.copy);
  const chapters = item.chapters || [];
  const modules = item.modules || [];
  const tasks = item.tasks || [];
  const readout = item.readout || [];
  const tools = item.tools || copy.tools;

  const lab = {
    item,
    chapters,
    modules,
    attached3d: false,
    taskRenderer: null,
    state: {
      chapter: 0,
      placed: [],
      selected: null,
      phase: 'build',
      completed: [],
      badges: [],
      progress: null, // {done,total} 覆盖默认的「本关模块数」
      readout: {},
      visible: {},
      hint: '',
      feedback: '',
      feedbackKind: '',
      stageHint: '',
      trayTitle: '',
      trayHint: '',
      cardsLocked: false,
      discovery: '',
    },
    handlers: {},
    on(name, fn) {
      (lab.handlers[name] ||= []).push(fn);
      return lab;
    },
    emit(name, payload) {
      for (const fn of lab.handlers[name] || []) fn(payload);
    },
    moduleOf(id) {
      return modules.find((m) => m.id === id);
    },
    chapterModules(i = lab.state.chapter) {
      return modules.filter((m) => m.chapter === i);
    },
    /** 物品自定义教练面板：fn({chapter, phase, state, lab}) => {html, bind(root)} */
    task(fn) {
      lab.taskRenderer = fn;
      return lab;
    },
    /** 发现卡：放一段“刚刚发现”的观察，传空串隐藏 */
    setDiscovery(text) {
      lab.state.discovery = text || '';
      const box = q('#discovery');
      if (!box) return lab;
      box.hidden = !text;
      if (text) q('#discovery-text').textContent = text;
      return lab;
    },
    /** 通关撒花：纯装饰，reduced-motion 下静默 */
    celebrate() {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return lab;
      const el = q('#celebration');
      if (!el) return lab;
      el.replaceChildren();
      const colors = ['#c2452d', '#b8862f', '#2f6f9f', '#2f7d5c'];
      for (let i = 0; i < 28; i++) {
        const bit = document.createElement('i');
        bit.style.background = colors[i % 4];
        const angle = (i / 28) * Math.PI * 2;
        bit.style.setProperty('--x', Math.cos(angle) * (95 + (i % 5) * 27) + 'px');
        bit.style.setProperty('--y', Math.sin(angle) * 130 + 130 + 'px');
        bit.style.setProperty('--r', i * 47 + 'deg');
        el.appendChild(bit);
      }
      setTimeout(() => el.replaceChildren(), 1500);
      return lab;
    },
    setInsetTitle(text) {
      const el = q('#inset-title');
      if (el) el.textContent = text;
      return lab;
    },
    /** 按 {key: 显示值} 批量写读数，内部 diff（可以每帧调，不碰 DOM）。
     * 读数的格式化留在物品侧（那里才知道 model/view/game）；这里只管写。 */
    paint(values) {
      for (const k of Object.keys(values || {})) {
        const el = rdEls.get(k);
        if (!el) continue;
        const text = values[k] == null ? '—' : String(values[k]);
        if (el.textContent !== text) el.textContent = text;
        lab.state.readout[k] = text;
      }
      return lab;
    },
    render,
  };

  /* ---------- 静态插槽：挂载时填一次 ---------- */
  document.title = item.brand?.title || copy.brand.title;
  q('[data-slot="brand.title"]').textContent = item.brand?.title || copy.brand.title;
  q('[data-slot="brand.subtitle"]').textContent = item.brand?.subtitle || copy.brand.subtitle;
  const mark = item.brand?.mark || copy.brand.mark;
  q('[data-slot="brand.mark"]').innerHTML = mark.svg
    ? mark.svg
    : `<span style="position:absolute;left:6px;top:9px;width:9px;height:16px;border-radius:2px;background:${mark.a || '#c2452d'}"></span>
       <span style="position:absolute;left:19px;top:6px;width:9px;height:16px;border-radius:2px;background:${mark.b || '#9aa6b2'}"></span>`;

  q('[data-slot="stage.title"]').textContent = item.stage?.title || copy.stage.title;
  q('[data-slot="stage.hint"]').textContent = item.stage?.hint || copy.stage.hint;
  q('[data-slot="stage.gestures"]').innerHTML = item.stage?.gestures || copy.stage.gestures;
  q('[data-slot="coach.hintLabel"]').textContent = copy.coach.hintLabel;
  q('[data-slot="coach.notesLabel"]').textContent = copy.coach.notesLabel;
  q('[data-slot="coach.notes"]').innerHTML = (item.notes || []).map((p) => `<p>${p}</p>`).join('');
  q('#notes').hidden = !(item.notes || []).length;

  q('[data-slot="journey"]').innerHTML = chapters
    .map((c, i) => `<li data-chapter="${i}"><b>${i + 1}</b>${esc(c.title)}</li>`)
    .join('');

  q('[data-slot="stage.tools"]').innerHTML = tools
    .map((t) => `<button data-tool="${t.id}" aria-pressed="${t.pressed ? 'true' : 'false'}">${esc(t.label)}</button>`)
    .join('');

  q('#readout').innerHTML = readout
    .map((r) => `<div class="row"><span>${esc(r.label)}</span><b data-rd="${r.key}"${r.big ? ' class="big"' : ''}>—</b></div>`)
    .join('');
  const rdEls = new Map();
  for (const r of readout) rdEls.set(r.key, q(`[data-rd="${r.key}"]`));

  q('[data-slot="coach.extras"]').innerHTML = (item.experiments || [])
    .map((x) => {
      if (x.control === 'toggle') {
        return `<div class="labctl toggle"><span>${esc(x.label)}</span>
          <button data-exp="${x.id}" aria-pressed="${x.value ? 'true' : 'false'}">${x.value ? '开' : '关'}</button></div>`;
      }
      if (x.control === 'button') return `<div class="labgrid"><button data-exp="${x.id}">${esc(x.label)}</button></div>`;
      return `<label class="labctl">${esc(x.label)}<output data-exp-out="${x.id}">${x.value ?? ''}${x.unit || ''}</output>
        <input type="range" data-exp="${x.id}" min="${x.min}" max="${x.max}" step="${x.step || 1}" value="${x.value ?? x.min}"></label>`;
    })
    .join('');

  /* ---------- 动态插槽 ---------- */
  function renderCards() {
    const list = q('#mlist');
    const chMods = lab.chapterModules();
    if (!chMods.length) {
      list.innerHTML = '<div class="empty"><div><strong>这一关没有模块</strong>检查 manifest 的 modules[].chapter。</div></div>';
      return;
    }
    list.innerHTML = chMods
      .map((m) => {
        const installed = lab.state.placed.includes(m.id);
        const sub = installed
          ? copy.labels.installed
          : m.sub || (m.parts?.length > 1 ? copy.labels.preloaded.replace('{n}', m.parts.length) : copy.labels.picked);
        return `<button class="card" data-id="${m.id}" data-installed="${installed}" style="--pc:${m.color || '#5b6470'}"
          aria-pressed="${lab.state.selected === m.id}"${installed || lab.state.cardsLocked ? ' disabled' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true">${m.icon && m.icon.startsWith('<') ? m.icon : iconBody(m.icon || 'box')}</svg>
          <span><strong>${esc(m.name)}</strong><small>${esc(sub)}</small></span></button>`;
      })
      .join('');
  }

  function renderTask() {
    const ch = chapters[lab.state.chapter] || {};
    if (lab.taskRenderer) {
      const out = lab.taskRenderer({ chapter: ch, chapterIndex: lab.state.chapter, phase: lab.state.phase, state: lab.state, lab }) || {};
      q('#task').innerHTML = out.html || '';
      out.bind?.(q('#task'));
      return;
    }
    const task = tasks[lab.state.chapter] || {};
    const s = lab.state;
    const head = `<p class="label">${esc(copy.labels.exp)}</p><h3>${esc(task.exp || ch.title || '')}</h3>
      <p>${esc(task.expText || ch.subtitle || '')}</p>`;
    if (s.phase === 'check' && task.options) {
      q('#task').innerHTML =
        head +
        `<p class="label">${esc(copy.labels.quiz)}</p><div class="options">${task.options
          .map((o, i) => `<button data-opt="${i}"><b>${'ABCD'[i]}</b>${esc(o)}</button>`)
          .join('')}</div>`;
      return;
    }
    if (s.phase === 'done') {
      q('#task').innerHTML =
        head +
        `<div class="badge">${esc(ch.badge || '✓')}</div><p>${esc(task.why || '')}</p>
         <div class="sub">${
           s.chapter < chapters.length - 1 ? '<button class="primary" data-act="next">进入下一关</button>' : ''
         }<button data-act="replay">再看一遍</button></div>`;
      return;
    }
    q('#task').innerHTML =
      head +
      `<div class="sub"><button class="primary" data-act="place"${s.selected ? '' : ' disabled'}>装到这里</button>
       <button data-act="undo"${s.placed.length ? '' : ' disabled'}>撤回一步</button></div>`;
  }

  function render() {
    const s = lab.state;
    for (const li of document.querySelectorAll('.journey li')) {
      const i = Number(li.dataset.chapter);
      li.className = s.completed?.[i] ? 'done' : i === s.chapter ? 'active' : '';
      li.querySelector('b').textContent = s.completed?.[i] ? '✓' : i + 1;
    }
    const ch = chapters[s.chapter] || {};
    const co = s.coach || {};
    q('[data-slot="coach.tag"]').textContent =
      co.tag ?? (copy.coach.tag || '').replace('{n}', s.chapter + 1).replace('{total}', chapters.length);
    q('[data-slot="coach.title"]').textContent = co.title ?? ch.title ?? '';
    q('[data-slot="coach.intro"]').textContent = co.intro ?? ch.subtitle ?? '';
    q('[data-slot="stage.hint"]').textContent = s.stageHint || item.stage?.hint || copy.stage.hint;

    const chMods = lab.chapterModules();
    const p = s.progress || { done: chMods.filter((m) => s.placed.includes(m.id)).length, total: chMods.length };
    const bar = q('#progress');
    bar.setAttribute('aria-valuemax', String(p.total || 1));
    bar.setAttribute('aria-valuenow', String(p.done));
    q('#pfill').style.width = (p.total ? (p.done / p.total) * 100 : 0) + '%';
    q('#plabel').textContent = `${p.done} / ${p.total} 块模块`;
    q('#bcount').textContent = `${(s.badges || []).length} 个徽章`;

    q('#tray-title').textContent = s.trayTitle || item.tray?.title || copy.tray.title;
    q('#tray-hint').textContent = s.trayHint || item.tray?.hint || copy.tray.hint;

    renderTask();
    renderCards();

    const fb = q('#feedback');
    fb.className = 'feedback' + (s.feedbackKind ? ' ' + s.feedbackKind : '');
    if (s.feedback) fb.textContent = s.feedback;
    q('#hinttext').textContent = s.hint || '';

    const ro = q('#readout');
    ro.classList.toggle('on', !!s.visible.readout);
    for (const b of ro.querySelectorAll('[data-rd]')) {
      const v = s.readout[b.dataset.rd];
      if (v != null && b.textContent !== String(v)) b.textContent = v;
    }
    // 有三维时 socket 的显隐与位置由 kit/scene.mjs 负责
    if (!lab.attached3d) q('#socket').hidden = !(s.selected && s.phase === 'build');
  }

  /* ---------- 交互：只发事件 ---------- */
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card && !card.disabled) return lab.emit('select', card.dataset.id);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act) return lab.emit(act);
    const tool = e.target.closest('[data-tool]')?.dataset.tool;
    if (tool) {
      if (tool === 'cut') {
        const b = e.target.closest('[data-tool]');
        b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      }
      return lab.emit('tool', tool);
    }
    if (e.target.id === 'free-lab') return lab.emit('free');
    if (e.target.id === 'restart') return lab.emit('restart');
    if (e.target.id === 'socket') return lab.emit('place');
    const opt = e.target.closest('[data-opt]');
    if (opt) return lab.emit('answer', Number(opt.dataset.opt));
    const exp = e.target.closest('[data-exp]');
    if (exp) {
      const id = exp.dataset.exp;
      const spec = (item.experiments || []).find((x) => x.id === id) || {};
      const value =
        exp.tagName === 'BUTTON'
          ? spec.control === 'toggle'
            ? exp.getAttribute('aria-pressed') !== 'true'
            : null
          : Number(exp.value);
      return lab.emit('experiment', { id, value });
    }
  });

  document.addEventListener('input', (e) => {
    const id = e.target.dataset?.exp;
    if (!id) return;
    const out = document.querySelector(`[data-exp-out="${id}"]`);
    const exp = (item.experiments || []).find((x) => x.id === id);
    if (out) out.textContent = e.target.value + (exp?.unit || '');
    lab.emit('experiment', { id, value: Number(e.target.value) });
  });

  render();
  // 调试钩子：?debug=1 时把 lab（含 lab.stage）挂到 window，方便控制台/验收排查
  if (new URLSearchParams(location.search).has('debug')) window.__lab = lab;
  return lab;
}

function iconBody(name) {
  const set = typeof ICONS === 'undefined' ? {} : ICONS;
  return set[name] || set.box || '<rect x="4" y="8" width="16" height="11" rx="1.5"/>';
}
