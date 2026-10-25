/* 注射笔 · 插槽填充（纯数据 + 少量回调）
 * 机构依据：一次性预充式注射笔（替尔泊肽 / KwikPen 类，一次性卡式瓶不可更换）。
 * 尺寸与简化项见 notes.md。
 */
export const MANIFEST = {
  slug: 'injection-pen',
  brand: {
    title: '注射笔装配实验室',
    subtitle: '一次性预充笔 · 17 件零件 / 12 模块 · 3 关',
    mark: { a: '#a02b4e', b: '#f0dade' },
  },

  chapters: [
    {
      title: '先装药：卡式瓶与活塞',
      subtitle: '药液封在玻璃卡式瓶里，前端被隔膜堵住，后端只有活塞能动。',
      badge: '药筒观察员',
      exp: '剖开，看药液与活塞',
      expText: '剖开笔身：玻璃卡式瓶、里面的药液、尾部那块黑色橡胶活塞。药液前端被隔膜封住，后端只有活塞能动。',
      q: '药液是被什么推向针头的？',
      options: ['活塞被丝杠顶着往前推', '药液自己会往外流', '靠重力往下滴'],
      a: 0,
      why: '卡式瓶两头一封：前端是铝盖压住的橡胶隔膜，后端是活塞。丝杠把活塞往隔膜顶，药液只能经针头出去——活塞每前进 2.82 mm，正好 0.2 mL（1.0 mg）。',
    },
    {
      title: '把旋转变成直推',
      subtitle: '旋钮转半圈 → 扭簧上弦 → 螺母转 → 丝杠前进 2.82 mm。',
      badge: '传动解码员',
      exp: '拨 8 格（1.0 mg），盯住丝杠',
      expText: '一格 22.5°，八格正好半圈。旋钮转了、刻度窗跳出 1.0、扭簧上弦——但丝杠和活塞一点没动。',
      q: '拨完剂量、还没按按钮，活塞前进了吗？',
      options: ['前进了 2.82 mm', '没动：剂量先存在扭簧里', '前进了 1.41 mm'],
      a: 1,
      why: '拨剂量只是把扭簧上弦、把旋钮转到刻度上；螺母被棘爪挡着不转，丝杠也就不会走。按下按钮才松闸，扭簧带着螺母转半圈，丝杠前进 2.82 mm。',
    },
    {
      title: '合笔、上帽、装针',
      subtitle: '笔身把丝杠键住只许直走；拔帽、装针、按到底，药才出去。',
      badge: '注射流程师',
      exp: '拔帽 · 拔内帽 · 装针 · 注射',
      expText: '按顺序做：拔外帽、拔内帽、把针头拧到针座上、拨 1.0 mg 后按下注射按钮。盯着活塞和剩余药量。',
      q: '按下按钮后，是什么让丝杠前进的？',
      options: ['手指直接推丝杠', '扭簧释放，螺母转，丝杠被笔身键住只能直走', '电机带动'],
      a: 1,
      why: '按钮只是松闸：棘爪脱开，扭簧把套筒和螺母带着转半圈；丝杠被笔身的防转键卡住不能自转，螺纹只能把它变成 2.82 mm 的直线行程。',
    },
  ],

  stage: {
    title: '装一支只会往前推的笔',
    hint: '选一块模块，把它放到笔身上它该在的位置。',
  },

  readout: [
    { key: 'dose', label: '剂量设定', big: true },
    { key: 'stroke', label: '活塞行程' },
    { key: 'left', label: '剩余药量' },
    { key: 'clicks', label: '棘轮咔哒' },
  ],

  tray: { title: '第一盒 · 药与活塞', hint: '点选模块，再拖到笔身上' },

  modules: [
    {
      id: 'cart', chapter: 0, name: '药筒组件', parts: ['holder', 'cartridge', 'drug'], color: '#9dbcc6', icon: 'disc',
      sub: '3 件预装',
      tip: '把装好药液的玻璃卡式瓶推进透明支架，瓶颈朝笔头。',
      learn: '卡式瓶是一次性密封件：玻璃管里装着 2 mL 药液（5 mg/mL），前端铝盖压住橡胶隔膜，后端由活塞密封。支架只负责抱住它，不参与密封。',
    },
    {
      id: 'bung', chapter: 0, name: '活塞', parts: ['bung'], color: '#4d4d57', icon: 'piston',
      tip: '把活塞从卡式瓶尾部塞进玻璃管内壁，两道密封筋朝上。',
      learn: '活塞是药液唯一的活动边界。它向前走多少，药液就被挤出多少——Ø9.5 的管内径下，每 2.82 mm 正好是 0.2 mL（1.0 mg）。',
    },
    {
      id: 'hub', chapter: 0, name: '螺纹针座', parts: ['hub'], color: '#aab3b8', icon: 'screw',
      tip: '把针座旋到支架前端，螺纹段朝外，中心孔对着隔膜。',
      learn: '针座外圆是 4 圈螺纹，针头就拧在这上面。它的中心孔正对橡胶隔膜：针头拧到底时，针管才能穿过隔膜进到药液里。',
    },
    {
      id: 'scale', chapter: 1, name: '剂量刻度套筒', parts: ['scale'], color: '#e5dad6', icon: 'disc',
      tip: '把印着 0 / 0.5 / 1.0 的套筒塞进笔身，字正好落在剂量窗后面。',
      learn: '刻度套筒和旋钮是同一根轴上的一体件：旋钮转多少，窗口里的数字就转过多少。数字之间还有 8 根分格线——一格就是一声咔哒。',
    },
    {
      id: 'spring', chapter: 1, name: '扭簧', parts: ['spring'], color: '#c6ced2', icon: 'coil',
      tip: '把钢带扭簧套到驱动套筒外，后端钩在刻度套筒、前端挂在笔身凸耳上。',
      learn: '拨剂量时旋钮把扭簧拧紧，弹性能先存着；按下按钮松闸，扭簧把套筒和螺母一起带着转。药不是被手指推出去的，是这股储能转出来的。',
    },
    {
      id: 'drive', chapter: 1, name: '驱动套筒与螺母', parts: ['sleeve', 'nut'], color: '#8f9a9e', icon: 'screw',
      sub: '2 件预装',
      tip: '把套筒推进笔身，让螺母的内螺纹对准丝杠中心。',
      learn: '螺母只能转、不能前后走（被套筒两侧的凸缘夹住）。它一转，吃在里面的丝杠就只能沿轴向走——这就是"旋转变直推"的那一步。',
    },
    {
      id: 'screw', chapter: 1, name: '丝杠（推杆）', parts: ['screw'], color: '#cfd6da', icon: 'shaft',
      tip: '把丝杠的扁位段穿进笔身的防转键座，螺纹段吃进螺母。',
      learn: '丝杠是双头螺纹，导程 5.64 mm。它的尾部有两道扁位，被笔身上的防转键咬住，所以它永远不会自转——只能被螺母推着直线前进。',
    },
    {
      id: 'dial', chapter: 1, name: '剂量旋钮', parts: ['dial'], color: '#a02b4e', icon: 'gear',
      tip: '把旋钮套到笔身后端，内侧的棘轮齿对准棘爪。',
      learn: '旋钮内侧有 16 个单向棘齿，配一只弹片棘爪：每转过一格（22.5°）棘爪跳一次齿，你听到的就是那声"咔哒"。棘爪只许它往拨剂量的方向转，回不了头。',
    },
    {
      id: 'button', chapter: 2, name: '注射按钮', parts: ['button'], color: '#6e1a33', icon: 'bolt',
      tip: '把按钮从旋钮后端推进去，按面朝外，行程 1.8 mm。',
      learn: '按钮自己不推药：它是一道闸。按下去棘爪被顶开，扭簧才有机会释放。没拨剂量时按钮是压不动的——旋钮不到 1.0，闸就是空的。',
    },
    {
      id: 'body', chapter: 2, name: '笔身与棘爪', parts: ['body', 'pawl'], color: '#f7e9ec', icon: 'housing',
      sub: '2 件预装',
      tip: '把笔身两端口对准，棘爪弹片朝里，剂量窗朝上。',
      learn: '笔身干三件事：托住刻度套筒、用防转键咬住丝杠的扁位、用棘爪给旋钮定格。剖开看，剂量窗后面就是转动的刻度套筒。',
    },
    {
      id: 'needle', chapter: 2, name: '一次性针头', parts: ['needle'], color: '#dfe4e7', icon: 'pin',
      tip: '把针头拧到针座螺纹上，拧到底时针管刚好穿过隔膜。',
      learn: '针头是一次性耗材：塑料座内螺纹咬住针座的 4 圈螺纹，一根 32G 套管针穿过隔膜伸进药液。用完连同针头一起丢，卡式瓶不能换。',
    },
    {
      id: 'caps', chapter: 2, name: '外帽与内帽', parts: ['capOuter', 'capInner'], color: '#8d2545', icon: 'shell',
      sub: '2 件预装',
      tip: '先套内帽护住针头，再扣外帽。取用时顺序相反：先外后内。',
      learn: '外帽是杯状硬壳，内帽是一层薄护套。两层都拔掉才能碰到针座；装针前必须先拔帽，否则针座被内帽整个罩住。',
    },
  ],

  experiments: [
    { id: 'dose', label: '拨剂量（一格 0.125 mg）', control: 'slider', min: 0, max: 8, step: 1, value: 0, unit: ' 格' },
    { id: 'inject', label: '按注射按钮', control: 'button' },
  ],

  notes: [
    '1 unit = 1 mm。含外帽总长 170 mm、笔身 Ø20.8、旋钮 Ø19、卡式瓶 Ø11.6（内径 Ø9.5，壁 1.05）：与公开的预充式注射笔尺度同一量级。除标准件（32G 针管、M 级螺纹）外，内部布置为教学估算。',
    '<b>三条传动链是一条：</b>旋钮（棘轮 16 齿，一格 22.5° = 0.125 mg）→ 扭簧上弦 → 按下按钮松闸 → 套筒与螺母转（180°/mg）→ 丝杠被笔身防转键咬住，只能沿 x 直线走（双头螺纹导程 5.64 mm）→ 活塞 2.82 mm/mg。剂量、行程、剩余药量三个读数都取自同一个 <code>delivered</code> / <code>windMg</code> 状态量。',
    '<b>为什么拨剂量时活塞不动：</b>拨剂量只是把扭簧拧紧、把旋钮转到刻度上；螺母被棘轮挡着不转，丝杠自然不动。按下按钮才松闸。这是这支笔最容易讲错的一环——所以第 2 关的实验专门让人盯着丝杠看。',
    '剖开看：外壳类零件（笔身、支架、卡式瓶、内外帽）在剖开模式下换成半透明，机构保持实体；针座与针头有局部放大窗。',
  ],

  scene: {
    bench: { y: -15, color: 0xe8e4da, size: 1200 },
    spawnFor: (id, info) => [0, 32 + (info.size.y > 16 ? 4 : 0), -4],
    camera: { fov: 30, near: 1, far: 3000, defaultFocus: 'all' },
    orbit: { minDistance: 60, maxDistance: 1800, minPolar: 0.05, maxPolar: 0.55 },
    renderer: { exposure: 1.0, pixelRatio: 1.5 },
    env: 0.55,
    lights: {
      hemi: [0xffffff, 0xcbc2b6, 1.1],
      key: { color: 0xfff4e8, intensity: 2.4, pos: [-100, 190, 170] },
      rim: { color: 0xcfe0f0, intensity: 1.0, pos: [130, 110, -160] },
    },
    cut: { normal: [0, 0, -1], constant: 0 },
    focus: {
      all: { dir: [56, 20], fit: 1.02, box: () => [[85, 0, 0], [196, 34, 34]] },
      rear: { dir: [62, 26], fit: 1.1, box: () => [[16, 0, 0], [54, 30, 30]] },
      drive: { dir: [62, 24], fit: 1.05, box: () => [[68, 0, 0], [48, 26, 26]] },
      cart: { dir: [62, 22], fit: 1.05, box: () => [[112, 0, 0], [58, 24, 24]] },
      tip: { dir: [62, 24], fit: 1.1, box: () => [[148, 0, 0], [32, 22, 22]] },
    },
    inset: {
      fov: 30,
      visible: (s) => s.phase !== 'build' && (s.capOuter || 0) < 0.5 && (s.capInner || 0) < 0.5
        && (s.needle || 0) > 0.6 && (s.placed || []).includes('needle'),
      target: () => ({
        part: 'needle',
        local: [149, 0, 0],
        offset: [11, 9, 20],
        title: '针座螺纹 · 针头 · 隔膜',
      }),
    },
  },
};
