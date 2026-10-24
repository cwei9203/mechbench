/* 电动牙刷 · 插槽填充（纯数据 + 少量回调）
 * 参考：通用电磁摆动轴式结构，160 × 20 × 22 mm，除 AAA 电池外均为教学估算。
 */
export const MANIFEST = {
  slug: 'electric-toothbrush',
  brand: {
    title: '牙刷装配实验室',
    subtitle: '把原理，一块一块拼出来 · 10 模块 · 3 关',
    mark: { a: '#3d9c80', b: '#315efb' },
  },

  chapters: [
    {
      title: '搭起动力核心', subtitle: '先认识支承与复位，再给电机通电。', badge: '复位观察员',
      exp: '手拨一下',
      expText: '给金属轴一个小偏角，观察它往复几次后回到中间。没有通电，弹簧只释放手拨时储存的能量。',
      q: '手拨金属轴后，什么让它回到中间位置？',
      options: ['扭转复位弹簧', '电池', '固定线圈'],
      a: 0,
      why: '扭簧一端连骨架、一端连轴。手拨使它储存弹性能，松开后推动轴回中；尚未接电的线圈不会持续驱动轴。',
    },
    {
      title: '接通能量回路', subtitle: '从电池直流，到线圈的交变励磁。', badge: '电磁探索员',
      exp: '接电试运行',
      expText: '在装配台上接通供电，观察转子与金属轴持续往复。铜线圈固定，只有磁场随驱动电流改变。',
      q: '电池输出直流，金属轴为什么能持续往复？',
      options: ['电池自行改变正负极', '驱动板交替改变线圈电流方向', '外壳带动电机旋转'],
      a: 1,
      why: '驱动板让线圈交变励磁，推动永磁转子往复；转子与金属轴同步，线圈和机壳保持固定。',
    },
    {
      title: '让刷头接住摆动', subtitle: '对齐 D 形连接，完成从电机到刷毛的传动。', badge: '装配小工程师',
      exp: '整机试运行',
      expText: '观察金属轴、内衬、刷颈和刷毛同相摆动，机壳保持固定。通关后还能停机拔下刷头，查看连接关系。',
      q: '拔下刷头后，金属输出轴会一起被拔出吗？',
      options: ['不会，轴留在手柄，内衬随刷头离开', '会，轴和刷头是同一个零件', '会，金属轴藏在刷毛里面'],
      a: 0,
      why: '金属轴仍受机内轴套支撑，D 形内衬随刷头拔出。装回并对齐平面后，轴的摆动才能传给刷头。',
    },
  ],

  stage: {
    title: '拼一支会动的牙刷',
    hint: '选一块模块，把它放到蓝色轮廓里。',
  },

  readout: [
    { key: 'angle', label: '输出摆角', big: true },
    { key: 'mode', label: '状态' },
  ],

  tray: { title: '第一盒 · 动力核心', hint: '点选模块，再拖到蓝色位置' },

  modules: [
    { id: 'frame', chapter: 0, name: '装配骨架', parts: ['chassis'], color: '#40577b', icon: 'housing',
      tip: '把骨架放进装配台，其他模块都由它支撑。',
      learn: '骨架固定电机、轴套和电路板。装机壳前，装配台暂时托住整个机构。' },
    { id: 'core', chapter: 0, name: '预装动力芯', parts: ['rotor', 'shaft', 'spring', 'bearings'], color: '#e6a52d', icon: 'shaft',
      tip: '把带金属轴的动力芯放进骨架。轴套和扭簧已预装。',
      learn: '永磁转子与金属轴一起摆动；轴套支撑轴，扭转弹簧一端连轴、一端连骨架，负责回中。压装工序已预装，吸附只表示模块归位。' },
    { id: 'field', chapter: 0, name: '固定线圈', parts: ['stator'], color: '#d97545', icon: 'coil',
      tip: '把线圈和磁轭装在动力芯外侧。',
      learn: '线圈与磁轭固定在骨架上，与转子留有气隙。线圈不跟着轴摆动；现在尚未通电，只能手拨观察。' },
    { id: 'driver', chapter: 1, name: '交变驱动板', parts: ['pcb'], color: '#2b9a87', icon: 'plate',
      tip: '把驱动板卡进骨架下方的槽位。',
      learn: '电池输出直流。驱动板交替改变线圈电流方向，让磁场推动永磁转子往复摆动。电路参数在本模型中简化。' },
    { id: 'battery', chapter: 1, name: 'AAA 电池', parts: ['battery'], color: '#4b83c0', icon: 'battery',
      tip: '把电池装进电池仓，凸起的正极朝向驱动板。',
      learn: '电池提供能量，自己不会转动。这里使用标准 Ø10.5 × 44.5 mm 的 AAA 电池，正负触片接通后才能形成供电回路。' },
    { id: 'power', chapter: 1, name: '预装供电座', parts: ['contacts', 'cap', 'seal'], color: '#d4a332', icon: 'screw',
      tip: '把带触片、弹簧与密封圈的供电座合到底部。',
      learn: '底部弹簧接触电池负极，上触片接触正极；底盖托住弹簧。此模块把触片和底盖预装在一起，密封圈只展示位置，不代表防水验证。' },
    { id: 'seal', chapter: 2, name: '输出轴唇封', parts: ['neckseal'], color: '#60716c', icon: 'disc',
      tip: '把唇封套到输出轴根部；合壳后外缘固定在壳口。',
      learn: '唇封内唇接触金属轴，外缘固定在机壳口，允许轴小角度往复。橡胶压缩和装配拉伸没有模拟。' },
    { id: 'head', chapter: 2, name: '空心刷头', parts: ['coupler', 'brush', 'bristles'], color: '#65ab97', icon: 'piston',
      tip: '先旋转刷头，让 D 形内孔的平面与金属轴对齐，再插到轴肩上。',
      learn: '空心刷颈内有 D 形内衬和夹持弹片。平面对齐后，金属轴把摆动传给刷头；轴肩限位，刷头与机壳之间保留 1.7 mm 间隙。' },
    { id: 'button', chapter: 2, name: '电源按键', parts: ['button'], color: '#d87481', icon: 'bolt',
      tip: '把按键对准驱动板开关，随后合壳固定。',
      learn: '按键顶杆触发板上的开关，硅胶唇缘由前壳固定。按键控制供电，不是传动件。' },
    { id: 'shell', chapter: 2, name: '前后机壳', parts: ['front', 'rear'], color: '#99adbe', icon: 'shell',
      tip: '合拢前后机壳，固定按键、骨架和轴封。',
      learn: '机壳保护并固定内部组件。运行时机壳、线圈和轴套保持固定；转子、金属轴、刷头和刷毛同步小角度往复。' },
  ],

  notes: [
    '1 unit = 1 mm。通用声波式教学结构，整机约 160 × 20 × 22 mm；除 AAA 电池（标准 Ø10.5 × 44.5 mm）外，几何与性能参数均为估算，不对应某一品牌整机。',
    '简化项：橡胶密封压缩与装配拉伸未模拟；电路与线圈接线只示意；卡扣弹性省略；刷毛与牙齿接触未建模。',
    '<b>摆动从哪来：</b>电池供直流 → 驱动板交变励磁 → 固定线圈推动永磁转子 → 转子与金属轴一起往复（±3°）→ D 形内衬把摆动传给空心刷颈与刷毛。机壳、线圈、轴套全程不动，所以只有刷头在摆。',
  ],

  scene: {
    bench: false,
    spawnFor: (id, info) => [42, 72 - info.center.y, 0],
    camera: { defaultFocus: 'all', fov: 34, near: 0.1, far: 1500 },
    orbit: { minDistance: 22, maxDistance: 800 },
    renderer: { exposure: 1.1, pixelRatio: 2 },
    env: 0.65,
    lights: {
      hemi: [0xffffff, 0xb1c4de, 1.8],
      key: { color: 0xffffff, intensity: 2.5, pos: [-80, 160, 150] },
      rim: { color: 0xd8e9ff, intensity: 1.4, pos: [80, 100, -90] },
    },
    focus: {
      all: { dir: [14.6, 5.6], fit: 1.08, box: (s) => (s.chapter < 2 ? [[13, 63, 0], [102, 132, 50]] : [[13, s.headOff ? 92 : 82, 0], [102, s.headOff ? 196 : 176, 50]]) },
      drive: { dir: [14.6, 5.6], fit: 1.75, box: () => [[0, 94, 0], [38, 55, 30]] },
      head: { dir: [14.6, 5.6], fit: 1.75, box: (s) => (s.headOff ? [[10, 135, 0], [62, 92, 30]] : [[0, 120, 0], [35, 65, 30]]) },
    },
    inset: {
      fov: 36,
      visible: (s) => s.phase !== 'build' && s.placed.includes('core'),
      target: (s) => ({
        part: 'shaft',
        local: [0, s.chapter === 2 ? 117 : 92, 0],
        offset: s.chapter === 2 ? [10, 5, 44] : [15, 7, 61],
        title: s.chapter === 2 ? '金属轴与空心刷头' : '固定线圈与摆动轴',
      }),
    },
    // 剖开时隐藏后半壳等被切掉的网格（由 model.mjs 里的 userData.cutaway 标记）
    hiddenPart: (key, s) => false,
  },
};
