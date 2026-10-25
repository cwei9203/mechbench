/* 手摇发电手电筒 · 插槽填充（纯数据 + 少量回调）
 * 机构依据见 notes.md：两级增速 16:1、桥式整流、5.5 V / 0.1 F 超级电容。
 */
export const MANIFEST = {
  slug: 'hand-crank-flashlight',
  brand: {
    title: '手摇手电筒装配实验室',
    subtitle: '16:1 增速 · 12 模块 / 18 件 · 3 关',
    mark: { a: '#f2a13b', b: '#1f8f74' },
  },

  chapters: [
    {
      title: '把 1 圈变成 16 圈', subtitle: '先搭出一条增速传动链：小齿轮被大齿轮带，越传越快。', badge: '增速观察员',
      exp: '摇一圈，数圈数', expKind: 'ratio',
      expText: '抓住摇柄转一整圈，看发电机转子转了几圈。读完再回答问题。',
      q: '摇柄转 1 圈，发电机转子转几圈？',
      options: ['1 圈，齿轮只是把力传过去', '4 圈，只有一级增速', '16 圈，两级各放大 4 倍'],
      a: 2,
      why: '第一级 40→10 放大 4 倍，第二级 40→10 再放大 4 倍，串起来 16 倍。摇 1 圈，转子转 16 圈。',
    },
    {
      title: '把交流变成直流', subtitle: '发电机出来的是交流电，先整流，再存进电容。', badge: '整流探索员',
      exp: '摇三圈，再松手', expKind: 'glow',
      expText: '摇三圈让灯亮起来，然后松手。注意松手之后灯还亮了多久。',
      q: '反着摇手柄，灯还会亮吗？',
      options: ['不亮，电流方向反了', '亮，桥式整流把交流整成了同一个方向', '亮，因为电容自己会发电'],
      a: 1,
      why: '桥式整流的四个二极管让两个半周都以同一极性输出，所以正摇反摇都能给电容充电、都能点亮 LED。',
    },
    {
      title: '合上壳，整机验证', subtitle: '壳把每根轴都夹住，再摇一次，看电存住了没有。', badge: '整机工程师',
      exp: '整机摇五圈，停手', expKind: 'glow',
      expText: '合上壳后摇五圈，停手，盯着灯：光是从发电机来的，还是从电容来的？',
      q: '停手以后灯还亮着，这时的能量从哪来？',
      options: ['电容在放电', '发电机靠惯性还在转', 'LED 自己会储能'],
      a: 0,
      why: '手停了，转子很快停下，发电机不再发电。此时是 0.1 F 电容在给 LED 放电，电压从 3.6 V 慢慢掉到 2 V 以下，灯才熄灭。',
    },
  ],

  stage: {
    title: '拼一支摇出来的手电',
    hint: '选一块模块，把它放到机身上它该在的位置。',
  },

  readout: [
    { key: 'turns', label: '摇柄 / 转子' },
    { key: 'rpm', label: '转子转速' },
    { key: 'charge', label: '电容电量', big: true },
  ],

  tray: { title: '第一盒 · 增速传动', hint: '点选模块，再拖到机身上' },

  modules: [
    { id: 'plate', chapter: 0, name: '传动板', parts: ['gearPlate'], color: '#7f93ad', icon: 'plate',
      tip: '把传动板放进后壳的四根柱子上，三个轴承孔朝向齿轮面。',
      learn: '传动板上的三个轴承孔决定了三根轴的间距：12.5 mm，正好等于 40 齿与 10 齿齿轮的节圆半径之和，齿轮才能正确啮合。' },
    { id: 'crank', chapter: 0, name: '折叠摇柄', parts: ['crank'], color: '#f0a13c', icon: 'lever',
      tip: '曲轴从后壳轴承穿进去，手柄留在壳外。',
      learn: '曲轴把手的推力变成绕轴转动。摇一圈，曲轴上的 40 齿大齿轮也正好转一圈。' },
    { id: 'crankGear', chapter: 0, name: '摇柄大齿轮 40T', parts: ['crankGear'], color: '#d9a441', icon: 'gear',
      tip: '把 40 齿大齿轮套到曲轴上，齿面朝向传动板。',
      learn: '主动轮 40 齿。它转一圈，只把 40 个齿推过去；与它啮合的 10 齿小齿轮就得转 4 圈。' },
    { id: 'idler', chapter: 0, name: '复合增速齿轮', parts: ['idlerGear', 'idlerShaft'], color: '#c98b4b', icon: 'gear',
      tip: '把复合齿轮的轴插进中间轴承孔，小齿轮与大齿轮同轴固定。',
      learn: '同一根轴上固定着 10 齿小齿轮和 40 齿大齿轮，两个齿轮一起转。第一级 40→10 已经放大 4 倍转速。' },
    { id: 'generator', chapter: 0, name: '永磁发电机', parts: ['generator'], color: '#8d97a5', icon: 'coil',
      tip: '把发电机轴对准传动板中间的孔，机体贴住传动板。',
      learn: '发电机就是一台永磁直流电机反过来用：转子被带着转，线圈切割磁感线产生交流电。剖开机体能看到转子铁芯、铜绕组、两块永磁钢和换向器——机壳不动，只有转子在转。' },
    { id: 'pinion', chapter: 0, name: '发电机小齿轮 10T', parts: ['motorPinion'], color: '#e3b257', icon: 'gear',
      tip: '把 10 齿小齿轮压到发电机轴上，与复合齿轮的大齿轮啮合。',
      learn: '第二级又是 40→10，再放大 4 倍。两级串联：4 × 4 = 16，摇一圈，发电机转子转 16 圈。' },
    { id: 'board', chapter: 1, name: '桥式整流板', parts: ['pcb'], color: '#3f8f7a', icon: 'plate',
      tip: '把整流板卡进前壳的四个支柱，线束朝发电机一侧。',
      learn: '四个二极管接成桥式整流：不管电流从哪边来，输出端的极性都不变。所以正着摇、反着摇，灯都能亮。' },
    { id: 'capacitor', chapter: 1, name: '超级电容 0.1F', parts: ['capacitor'], color: '#3f6fa8', icon: 'battery',
      tip: '把电容焊脚对准板上两个孔，立着装进去。',
      learn: '5.5 V / 0.1 F 双电层电容。它不靠化学反应储能，充电快、放电也快，正好用来接住手摇这几秒的电。' },
    { id: 'switch', chapter: 1, name: '电源开关', parts: ['switch'], color: '#c2605c', icon: 'bolt',
      tip: '把开关从灯头端装进去，拨杆穿出端盖的长孔，两根线接到板上。',
      learn: '开关串在 LED 回路里。它只控制通断，不改变发电量：摇的时候关着开关，电照样存进电容。' },
    { id: 'head', chapter: 1, name: '灯头组件', parts: ['headShell', 'reflector', 'lens', 'led'], color: '#e8c46a', icon: 'disc',
      tip: '把装好镜片和反光杯的灯头旋到端盖上，LED 对准反光杯中心。',
      learn: 'LED 是 3.0–3.2 V 白光管，反光杯把散开的光收成一束。灯头由端盖固定，LED 焊在板上不跟着动。' },
    { id: 'shells', chapter: 2, name: '前后机壳', parts: ['frontShell', 'backShell', 'endCap'], color: '#7d8ba0', icon: 'shell',
      tip: '先把后壳扣上，再合上前壳，端盖对齐灯头。',
      learn: '后壳托住传动板和曲轴轴承，前壳托住发电机和整流板。两半壳合起来才把每根轴都夹住。' },
    { id: 'screws', chapter: 2, name: '四颗 M2 螺丝', parts: ['screws'], color: '#aab4c0', icon: 'screw',
      tip: '四颗 M2×34 螺丝从前往后拧进后壳的螺柱。',
      learn: '螺丝把前后壳夹紧，也把传动板压在后壳柱子上。少了它们，摇动时齿轮会轴向窜动。' },
  ],

  notes: [
    '1 unit = 1 mm。整机约 146 × 58 × 42 mm（不含灯头与摇柄）。除标准件（40T/10T 齿轮模块 0.5 mm、AAA 级尺寸的 M2 螺丝）外，壳体和内部布置为教学估算。',
    '<b>16:1 怎么来的：</b>曲轴 (-37, 8) → 中间轴 (-49.5, 8) → 电机轴 (-62, 8)，两两相距 12.5 mm（40T 节圆 Φ20 + 10T 节圆 Φ5 的一半）。两级 40→10 串联，4 × 4 = 16。',
    '复合惰轮跨两个 z 面：10T 在 z=14.5 与摇柄 40T 啮合，40T 在 z=17 与电机 10T 啮合——错开平面后 Φ20 大轮不会撞到 Φ5 小轮。',
    '电气链：发电机 → 桥式整流 → 5.5 V / 0.1 F 电容 → 开关 → LED。用一阶充放电模型（满速 0.95/s 充、开灯 0.16/s 放、关灯 0.02/s 漏），不求解动力学。',
    '灯只作为因果线索：LED 自发光 + 3000 K 暖色聚光（位于镜片口、目标指向 +x）+ 淡黄体积光锥 + 台面暖光斑 + 光晕。',
  ],

  scene: {
    bench: { y: -34, color: 0xe9e2d4, size: 1400 },
    spawnFor: (id, info) => [80 - info.center.x, 55 - info.center.y, 40 - info.center.z],
    camera: { fov: 32, near: 5, far: 1400, defaultFocus: 'all' },
    orbit: { minDistance: 40, maxDistance: 1200, minPolar: 0.04, maxPolar: 0.6 },
    renderer: { exposure: 1.0, pixelRatio: 1.5 },
    env: 0.5,
    lights: {
      hemi: [0xffffff, 0xcbbfa8, 1.15],
      key: { color: 0xfff3e0, intensity: 2.6, pos: [-90, 180, 190] },
      rim: { color: 0xbcd6ff, intensity: 1.1, pos: [120, 80, -150] },
    },
    cut: { normal: [0, 0, -1], constant: 0 },
    focus: {
      all: { dir: [45.6, 19.5], fit: 1.0, box: () => [[0, 12, 4], [200, 120, 120]] },
      gears: { dir: [45.6, 19.5], fit: 1.0, box: () => [[-45, 8, 10], [60, 46, 60]] },
      gen: { dir: [-133.4, 24.3], fit: 1.0, box: () => [[-56, 8, 2], [58, 42, 42]] },
      head: { dir: [45.6, 19.5], fit: 1.0, box: () => [[84, 0, 0], [104, 52, 56]] },
    },
    inset: {
      fov: 34,
      visible: (s, v) => v.cut && s.phase !== 'build' && s.placed.includes('pinion'),
      target: () => ({
        part: 'idlerGear',
        local: [-55.7, 8, 17],
        offset: [13.3, 21.2, 38.6],
        title: '两级啮合 · 40T→10T 再 40T→10T',
      }),
    },
  },
};
