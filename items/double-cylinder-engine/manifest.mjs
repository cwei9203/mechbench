/* 双缸发动机 · 插槽填充（纯数据 + 少量回调） */
export const MANIFEST = {
  slug: 'double-cylinder-engine',
  brand: {
    title: '双缸发动机装配实验室',
    subtitle: '360° 并列双缸 · 26 组零件 · 3 关',
    mark: { a: '#c2452d', b: '#9aa6b2' },
  },

  chapters: [
    {
      title: '曲柄连杆机构', subtitle: '把旋转变成往复。', badge: '曲柄观察员',
      exp: '摇转曲轴',
      expText: '慢慢摇曲轴 720°，盯住两个活塞：它们始终同高，一起上升、一起下降。曲轴转一圈，活塞走完一个完整往复。',
      q: '曲轴转一整圈，活塞走了多少距离？',
      options: ['一个往复：行程 74 mm 上行 + 74 mm 下行', '两个往复：共 296 mm', '活塞停在原地不动'],
      a: 0,
      why: '曲柄半径 37 mm，活塞行程 = 2×37 = 74 mm。曲轴转一圈，活塞上行 74 mm、下行 74 mm，走完一个往复。',
    },
    {
      title: '配气机构', subtitle: '让气门跟住活塞。', badge: '配气工程师',
      exp: '慢放四冲程',
      expText: '以 1/8 速度转 720°，数一数凸轮轴转了几圈。再看 1 缸压缩上止点时，2 缸的气门正在做什么。',
      q: '曲轴转 720°（一个完整四冲程循环），凸轮轴转多少？',
      options: ['360°，正好一半', '720°，与曲轴同速', '180°，四分之一'],
      a: 0,
      why: '四冲程要曲轴转两圈才完成一次循环，而凸轮轴只需转一圈就能把四个冲程的进、排气门各开关一次。30 齿 ÷ 15 齿 = 2，所以凸轮轴是半速。',
    },
    {
      title: '正时与点火', subtitle: '差一格，就全错。', badge: '正时排故员',
      exp: '拆掉链条再看',
      expText: '先正常运行看两缸交替点火，再把正时链拆掉重摇曲轴：曲轴照转、活塞照动，但凸轮轴不再跟着转。',
      q: '正时链断掉之后继续摇曲轴，会发生什么？',
      options: ['凸轮轴不转，气门停在原位——活塞可能撞上气门', '凸轮轴跟着转但慢一半', '活塞停止运动'],
      a: 0,
      why: '链条是曲轴到凸轮轴唯一的传动。链条一断，凸轮轴和它控制的气门立刻停住；活塞仍在曲轴驱动下运动，上止点时就会撞到还开着的气门。这是真实发动机的正时链断裂事故。',
    },
  ],

  stage: {
    title: '拼一台会转的双缸机',
    hint: '从下方零件盒选一块模块，拖到机身缺口上。',
  },

  readout: [
    { key: 'crank', label: '曲轴', big: true },
    { key: 'cam', label: '凸轮轴' },
    { key: 'piston', label: '缸1 活塞' },
    { key: 'valve', label: '缸1 进气 / 排气' },
    { key: 'spark', label: '点火' },
  ],

  tray: { title: '第一盒 · 曲柄连杆机构', hint: '点选模块，再拖到机身缺口上' },

  modules: [
    {
      id: 'case', chapter: 0, name: '曲轴箱（上下对开）', parts: ['caseLower', 'caseUpper'],
      color: '#5b6470', icon: 'housing',
      tip: '先放下曲轴箱，再把上曲轴箱合上去。',
      learn: '曲轴箱分开上下两半：下半承油底壳与主轴承下座，上半顶面承受气缸体的缸头螺柱。曲轴装好后才能合箱。',
    },
    {
      id: 'crank', chapter: 0, name: '曲轴 · 连杆 · 飞轮', parts: ['crankshaft', 'mainBearings', 'rod1', 'rod2', 'rotor'],
      color: '#c2452d', icon: 'shaft',
      tip: '两根连杆并排套在同一个曲柄销上，一起放进曲轴箱。',
      learn: '这是 360° 曲轴：只有一个曲柄销，两个连杆并排共用。两个主轴颈由两副主轴承支承，飞轮压装在左端。曲轴转一圈，两个活塞同升同降。',
    },
    {
      id: 'piston', chapter: 0, name: '活塞组 ×2', parts: ['piston1', 'piston2'],
      color: '#8f969d', icon: 'piston',
      tip: '把活塞销穿进连杆小头，两个活塞各归各缸。',
      learn: '活塞销穿过连杆小头，两端卡在活塞销座里。活塞只能沿缸壁上下：连杆把曲轴的圆周运动变成往复直线运动。',
    },
    {
      id: 'barrel', chapter: 1, name: '气缸体与缸垫', parts: ['gasket', 'barrel'],
      color: '#a9aeb4', icon: 'box',
      tip: '先放两片缸垫，再把气缸体落到螺柱上。',
      learn: '缸垫夹在缸体与箱体之间，负责密封燃烧室。缸体上有两道缸筒、缸头螺柱和左侧的正时链通道。',
    },
    {
      id: 'head', chapter: 1, name: '气缸盖', parts: ['head'],
      color: '#b6bbc0', icon: 'shell',
      tip: '把气缸盖压到缸体顶面，缸头螺柱穿过四个孔。',
      learn: '缸盖里是燃烧室顶、两个气门座和凸轮轴腔。它被缸头螺柱压紧在缸体上，压紧后气缸才密闭。',
    },
    {
      id: 'valve', chapter: 1, name: '气门组 ×4', parts: ['valve1i', 'valve1e', 'valve2i', 'valve2e'],
      color: '#bfc4c9', icon: 'valve',
      tip: '四只气门各进各的导管：进气大、排气小。',
      learn: '气门杆穿过导管上下滑动，弹簧把它一直压回关闭位置。只有被挺柱压下去时才打开——进气门进混合气，排气门排废气。',
    },
    {
      id: 'cam', chapter: 1, name: '凸轮轴 · 挺柱', parts: ['camshaft', 'tappet1i', 'tappet1e', 'tappet2i', 'tappet2e'],
      color: '#a9afb5', icon: 'gear',
      tip: '凸轮轴放进两个轴承座，再把四只挺柱扣到气门杆顶上。',
      learn: '凸轮轴在高处，四个凸轮各自压在挺柱顶面上。挺柱直接坐在气门弹簧座上，凸轮升程 1:1 变成气门升程——中间没有杠杆，所以接触点永不走偏。凸轮轴转速是曲轴的一半。',
    },
    {
      id: 'timing', chapter: 2, name: '正时链与链轮', parts: ['crankSprocket', 'camSprocket', 'camChain'],
      color: '#74797f', icon: 'coil',
      tip: '曲轴链轮 15T、凸轮链轮 30T，套上链条完成 2:1 减速。',
      learn: '15 齿带 30 齿，凸轮轴正好半速。链条把曲轴的转角「告诉」凸轮轴，气门开闭才和活塞位置对得上——这就是正时。',
    },
    {
      id: 'ignition', chapter: 2, name: '火花塞 ×2', parts: ['sparkPlugs'],
      color: '#e9e3d6', icon: 'bolt',
      tip: '两只火花塞拧进缸盖中央，火花端伸进燃烧室。',
      learn: '火花塞在压缩行程末尾跳火点燃混合气。两个缸的活塞同上同下，但一个在压缩点火、另一个正在排气与进气之间交叠——所以两缸轮流在每隔 360° 点火一次。',
    },
    {
      id: 'cover', chapter: 2, name: '气门室盖', parts: ['valveCover'],
      color: '#5b6269', icon: 'plate',
      tip: '最后盖上气门室盖，把凸轮轴腔封起来。',
      learn: '气门室盖罩住凸轮轴和挺柱，防止机油飞溅外泄。盖上之后只能透过剖切看内部。',
    },
  ],

  notes: [
    '参考机型：雅马哈 XS650 并列双缸。公布参数（缸径 75 / 行程 74 / 排量 653 cc / SOHC 每缸 2 气门 / 360° 曲轴 / 链传动凸轮轴）按真机建模；连杆中心距、缸心距、壁厚、气门尺寸与配气正时均为教学估算。',
    '1 单位 = 1 mm。剖切、拖动吸附表示装配归位，不是真实压装工艺。变速箱与离合器未建模。',
    '<b>配气怎么动起来：</b>曲轴链轮 15 齿 → 正时链 → 凸轮链轮 30 齿，凸轮轴正好半速。凸轮轴上的 4 个凸轮各自压在 4 只挺柱的顶面；挺柱下面就是气门弹簧座，凸轮升程多少，气门就被顶开多少（1:1）。凸轮基圆段（R14）无法推开挺柱，弹簧把气门压回座上——关闭；凸轮桃尖扫过顶面时把挺柱顶下去，气门打开。进气凸轮在 350°–585°、排气凸轮在 135°–370°（曲轴角）做这件事，所以两缸的进排气在 720° 里交替开合。',
  ],

  scene: {
    spawn: [255, 26, 155],
    camera: { defaultFocus: 'engine', fov: 32, near: 2, far: 6000 },
    orbit: { minDistance: 190, maxDistance: 1800, minPolar: 0.06, maxPolar: 0.54 },
    renderer: { exposure: 0.94, pixelRatio: 1.5 },
    focus: {
      engine: { dir: [-34, 16], fit: 1.1 },
      all: { dir: [-34, 16], fit: 1.1, box: [[0, 148, 30], [360, 560, 260]] },
      camshaft: { dir: [-24, 44], fit: 1.75 },
      crankshaft: { dir: [-14, 6], fit: 1.75 },
      head: { dir: [-24, 40], fit: 1.75 },
      valveCover: { dir: [-24, 20], fit: 1.75 },
    },
    // 拆掉气门室盖 / 正时链时，这两件不再显示
    hiddenPart: (key, state) => (key === 'valveCover' && state.coverOff) || (key === 'camChain' && state.chainOff),
  },
};
