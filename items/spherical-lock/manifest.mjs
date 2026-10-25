/* 球形门锁 · 插槽填充（纯数据 + 少量回调）
 * 机构依据见 notes.md：锁舌 12.7 行程、方轴凸轮 R12.7、五组弹子 + 离合套。
 */
// 竖屏时把取景中心右移、再拉远一点，右下角的读数面板才不压住锁体
// （Node 里跑 check-geometry 时没有 window，按宽屏处理）
const NARROW = typeof window !== 'undefined' && window.innerWidth < 640;

export const MANIFEST = {
  slug: 'spherical-lock',
  brand: {
    title: '球形门锁装配实验室',
    subtitle: '21 件零件 · 8 模块 · 3 关 · 锁舌行程 12.7 mm',
    mark: { a: '#c2452d', b: '#8d979f' },
  },

  chapters: [
    {
      title: '先让门扣得住', subtitle: '锁舌、压缩弹簧与扣板：按下去，弹回来。', badge: '锁舌观察员',
      exp: '推一下锁舌', expKind: 'push',
      expText: '用手把斜舌往里按 12.7 mm，松手，看弹簧把它推回原位。',
      q: '松手以后，是什么把斜舌推回伸出的位置？',
      options: ['锁舌壳里的压缩弹簧', '扣板唇口的斜面', '方轴转动带回来的'],
      a: 0,
      why: '弹簧夹在锁舌尾部和锁舌壳尾端之间。按压储存能量，松手释放，把锁舌推回；扣板只在关门那一下压回锁舌。',
    },
    {
      title: '一根轴串起两只执手', subtitle: '执手 → 方轴 → 凸轮销 → 环形扇面 → 锁舌。', badge: '传动追踪员',
      exp: '转内侧执手', expKind: 'knob',
      expText: '把内执手转到底（90°），看方轴、凸轮销和拨片一起动，锁舌缩回 12.7 mm。',
      q: '转内侧执手时，锁舌是被哪条链路拉回的？',
      options: ['执手 → 方轴 → 凸轮销 → 拨片 → 锁舌', '执手直接顶住锁舌尾部', '弹簧反过来把锁舌拉回'],
      a: 0,
      why: '执手把力矩给方轴，方轴上的凸轮销在扇面上摆动，把旋转变成拨片沿 z 的后移：R(1−cosθ)，90° 正好 12.7 mm。',
    },
    {
      title: '钥匙决定外侧能不能转', subtitle: '五组弹子对齐剪切线，锁芯才转得动，离合套才接通。', badge: '锁芯解析员',
      exp: '先插错钥匙，再插对钥匙', expKind: 'key',
      expText: '先用错钥匙试转（转不动，有一组弹子跨着剪切线），换对钥匙转到 90°，离合套被推进外执手，外执手才带动方轴。',
      q: '为什么错钥匙能插进去，却让锁芯转不动？',
      options: ['有弹子的接缝没落在剪切线，弹子把转子顶住', '钥匙齿形反了，根本插不到底', '外执手空转，所以钥匙跟着转不动'],
      a: 0,
      why: '每组弹子只有一种高度让下弹子顶部正好停在剪切线。错钥匙让其中一组停低 1 mm，上弹子就横跨剪切线，转子被物理卡住。',
    },
  ],

  stage: {
    title: '装一把能锁住的门锁',
    hint: '选一块模块，把它拖到门上它该在的位置。',
  },

  // 环境件：门与门框是安装基准，不属于任何可装模块（verify.mjs 会校对这条声明）
  envParts: ['door', 'jamb'],

  readout: [
    { key: 'spindle', label: '方轴转角' },
    { key: 'bolt', label: '锁舌伸出', big: true },
    { key: 'pull', label: '拨片位移' },
    { key: 'clutch', label: '离合套' },
    { key: 'cylinder', label: '锁芯 / 钥匙' },
  ],

  tray: { title: '第一盒 · 锁舌与扣板', hint: '点选模块，再拖到门上的缺口' },

  // 实验台控件（声明式，kit 生成滑杆）：转内执手，读数与几何一起变
  experiments: [
    { id: 'knobAngle', label: '内执手转角', control: 'slider', min: 0, max: 90, step: 15, value: 0, unit: '°' },
  ],

  modules: [
    { id: 'latch', chapter: 0, name: '预装锁舌组件', parts: ['latchHousing', 'latchBolt', 'latchSpring', 'retractor', 'faceplate', 'faceScrews'],
      color: '#b8894a', icon: 'spring', sub: '6 件 · 预装',
      tip: '把整个锁舌组件推进门边 Ø25.4 的边孔，面板与门边齐平，打两颗面板螺丝。',
      learn: '锁舌壳约束斜舌只能沿 z 滑动；压缩弹簧顶住锁舌，让它保持伸出。凸轮拨片是后面接执手的接口，此刻还没有东西推它。' },
    { id: 'strike', chapter: 0, name: '扣板与门框', parts: ['strike', 'strikeScrews'],
      color: '#8d6f4e', icon: 'plate', sub: '2 件 · 预装',
      tip: '把扣板贴到门框上，开口对准锁舌，拧两颗螺丝。',
      learn: '扣板是锁舌的受力座。关门时斜舌的斜面被扣板唇口压回去，进了扣板开口再被弹簧推出来，门才被扣住。' },

    { id: 'spindle', chapter: 1, name: '方轴·凸轮', parts: ['spindle'],
      color: '#e0a63c', icon: 'shaft',
      tip: '把方轴从侧面穿过拨片的扇面，两端各伸进一个执手。',
      learn: '方轴是唯一贯穿两个执手的传动件。轴上凸轮销（R12.7）压在拨片扇面上：方轴转多少，拨片就被推后多少。' },
    { id: 'plates', chapter: 1, name: '两块安装板', parts: ['plateOut', 'plateIn', 'throughBolts'],
      color: '#8794a0', icon: 'disc', sub: '2 板 + 2 螺栓',
      tip: '两侧安装板夹住门板，两根对穿螺栓从内侧穿过门板拧进外侧板。',
      learn: '安装板把整把锁夹在门板上，同时给方轴和执手做支承。没有它，执手只会跟着门板转。' },
    { id: 'roses', chapter: 1, name: '两只装饰圈', parts: ['roseOut', 'roseIn'],
      color: '#aeb9c2', icon: 'disc', sub: '2 件 · 预装',
      tip: '把装饰圈扣在安装板上，盖住螺栓头。',
      learn: '装饰圈只遮螺栓，不传力；但它限制了执手球头的轴向位置。' },
    { id: 'knobIn', chapter: 1, name: '内球形执手', parts: ['knobIn'],
      color: '#dfe3e6', icon: 'lever',
      tip: '把内执手 8.4 方孔对准方轴推到底。',
      learn: '内执手直接套在方轴上，任何状态下都能转（逃生方向不允许被锁住）。转它，方轴立刻跟着转。' },

    { id: 'knobOut', chapter: 2, name: '外执手·锁芯组件', parts: ['knobOut', 'cylHousing', 'plug', 'pinStack', 'clutch'],
      color: '#c9cfd4', icon: 'housing', sub: '5 件 · 预装',
      tip: '把带锁芯的外执手对准方轴推进去，锁芯朝向门外。',
      learn: '锁芯（教学半剖）里五组弹子把转子锁在壳里。离合套由锁芯尾片带动：没转钥匙时它退在后面，外执手只是空转。' },
    { id: 'key', chapter: 2, name: '钥匙', parts: ['key'],
      color: '#d9b464', icon: 'bolt',
      tip: '把钥匙插进锁芯面板的钥匙孔。',
      learn: '钥匙齿顶起下弹子，让五组弹子的接缝全部落在剪切线上，转子才能转。齿形差 1 mm 就有一组弹子跨着剪切线，转子被卡死。' },
  ],

  notes: [
    '1 unit = 1 mm。锁轴 = 世界 x 轴；门板厚 40（x ∈ [−20, 20]）；门边 z = 60（背距 60）。除标准件（锁舌行程 12.7 = ½″、面板 25.4×57、执手球 Ø57、装饰圈 Ø66、安装板 Ø50、对穿螺栓 M5、锁芯转子 Ø16 / 锁芯壳 Ø24）外，门板切片与内部布置为教学估算。',
    '<b>传动链：</b>内执手 ──方轴(8×8)──凸轮销(R12.7)──环形扇面拨片──锁舌(行程 12.7)──扣板开口；外执手 ──离合盘(缺口)──离合套(2 爪，行程 5)──方轴；钥匙 ──五组弹子对齐剪切线(y=8)──转子转 90°──尾片螺旋凸轮──离合套。',
    '<b>单一运动量：</b>拨片/锁舌后移只有一条公式 <code>boltRetract(θ)=R(1−cosθ)</code>（R=12.7）。90° 时 = 12.7 mm，所以凸轮销与扇面每一步都恰好留 0.10 mm 间隙：既压得到，又不穿模。读数「锁舌伸出」「拨片位移」就是这条公式的输出，不另算一份。',
    '门框的 28×80 观察窗、锁舌壳上的 100° 观察窗、锁芯壳的下半管与转子的半剖都是<b>教学剖视</b>：真机没有这些缺口。「剖开看」把外壳换成半透并裁到 z=0，同时把转子/下弹子换成半剖件，剪切线单独标红。',
  ],

  scene: {
    bench: { y: -96, color: 0xe7e2d8, size: 1400 },
    // 未装模块停在安装位前上方：拖下来就进缺口（相对安装位的平移）
    spawnFor: (id) => ({
      latch: [0, 46, 30], strike: [0, 52, 24], spindle: [0, 44, 28], plates: [0, 42, 28],
      roses: [0, 38, 28], knobIn: [0, 38, 28], knobOut: [0, 38, 28], key: [0, 34, 26],
    }[id] || [0, 42, 28]),
    camera: { fov: 30, near: 1, far: 3000, defaultFocus: 'all' },
    orbit: { minDistance: 60, maxDistance: 1600, minPolar: 0.05, maxPolar: 0.62 },
    nearRadius: { wide: 70, narrow: 88 },
    renderer: { exposure: 1.0, pixelRatio: 1.5 },
    env: 0.55,
    lights: {
      hemi: [0xffffff, 0xd8d1c3, 1.1],
      key: { color: 0xfff4e6, intensity: 2.4, pos: [-220, 320, 280] },
      fill: { color: 0xdfe9ff, intensity: 0.7, pos: [280, 120, -220] },
      rim: { color: 0xffe9cf, intensity: 0.55, pos: [200, -120, 240] },
    },
    // 裁切面放在模型之外：剖开只把外壳换成半透（不会把门切掉半个），
    // 真正的“剖”来自锁芯壳下半管、转子/下弹子的半剖件与两处观察窗
    cut: { normal: [0, 0, -1], constant: 420 },
    focus: {
      all: { dir: [-52, 20], fit: NARROW ? 1.16 : 1.02, box: () => (NARROW ? [[14, -10, 12], [214, 200, 158]] : [[-16, 0, 12], [214, 202, 158]]) },
      latch: { dir: [30, 20], fit: 1.0, box: () => [[0, 6, 46], [70, 110, 72]] },
      knob: { dir: [64, 18], fit: 1.0, box: () => [[40, 2, 4], [96, 76, 72]] },
      cylinder: { dir: [14, 14], fit: 1.0, box: () => [[-68, 2, 0], [60, 46, 48]] },
    },
    inset: {
      fov: 60,
      visible: (s, v) => v.cut && (s.phase === 'lab' || s.chapter === 2 || s.placed.includes('knobOut')),
      target: () => ({ part: 'plug', local: [-68, 2, 0], offset: [9, 10, 22], title: '锁芯半剖 · 五组弹子与剪切线' }),
    },
  },
};
