/* mechbench · 生成物，勿手改
 * 源：items/_template/{model.mjs,manifest.mjs}
 * 重新生成：python3 tools/build.py _template
 * 用途：无浏览器断言 → node tools/verify.mjs _template
 */
/* node 环境最小 DOM 桩：model.mjs 里的 canvas 贴图纹理需要 */
const __stubGradient = () => ({ addColorStop() {} });
const __stubCtx = () => ({
  fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '', lineWidth: 1, globalAlpha: 1,
  fillRect() {}, strokeRect() {}, clearRect() {}, save() {}, restore() {},
  translate() {}, rotate() {}, scale() {}, setTransform() {}, transform() {},
  fillText() {}, strokeText() {}, measureText: () => ({ width: 10 }),
  beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, rect() {},
  bezierCurveTo() {}, quadraticCurveTo() {}, stroke() {}, fill() {}, clip() {},
  drawImage() {}, createLinearGradient: __stubGradient, createRadialGradient: __stubGradient,
  createPattern: () => null, getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  putImageData() {},
});
if (!globalThis.document) {
  globalThis.document = {
    createElement: () => ({ width: 1, height: 1, style: {}, getContext: __stubCtx }),
    createElementNS: () => ({ width: 1, height: 1, style: {}, getContext: __stubCtx }),
  };
}


/* ==== _template/model.mjs ==== */
/* 模板物品 · 三维层（当前为空，用来验证"没有三维也能装配布局"）
 * 真物品在这里建件，导出：
 *   PARTS      [{ key, g:THREE.Object3D, shell?:bool, layer?:number }]
 *   applyMotion(view)        view = { crankDeg, camDeg, running, ... }
 *   bounds(partKeys[])       返回 THREE.Box3（用于拖动包围盒）
 *   createModel(MANIFEST)    可选：把零件装进场景，返回 { install(id), uninstall(id) }
 */
const PARTS = [];
function applyMotion() {}
function createModel() {
  return { install() {}, uninstall() {} };
}

/* ==== _template/manifest.mjs ==== */
/* 模板物品 · 插槽填充（纯数据，不含逻辑）
 * 字段含义见 kit/slots.md；把这里换成真物品的文案与模块表即可。
 */
const MANIFEST = {
  slug: '_template',
  brand: {
    title: '示例装配实验室',
    subtitle: '骨架自检 · 3 模块 · 2 关',
    mark: { a: '#c2452d', b: '#9aa6b2' },
  },

  chapters: [
    { title: '底座与轴', subtitle: '先把不动的东西放稳。', badge: 'A' },
    { title: '盖板与传动', subtitle: '再接动的东西。', badge: 'B' },
  ],

  stage: {
    title: '搭一个最小的例子',
    hint: '从下方零件盒选一块模块，拖到机身高亮处。',
  },

  readout: [
    { key: 'crank', label: '主轴', big: true },
    { key: 'state', label: '状态' },
  ],

  tray: { title: '零件盒 · 示例', hint: '点选模块，再拖到高亮位置' },

  modules: [
    {
      id: 'base', chapter: 0, name: '底座', sub: '固定不动的那块', parts: ['base'],
      color: '#5b6470', icon: 'box',
      tip: '先放底座：后面所有件都以它为基准。',
      learn: '底座提供支承面。任何会动的零件都要能追到一块不动的件上。',
    },
    {
      id: 'shaft', chapter: 0, name: '主轴', sub: '只转不平移', parts: ['shaft'],
      color: '#c2452d', icon: 'shaft',
      tip: '主轴两端落进底座的轴承孔。',
      learn: '轴由两处支承定位，旋转自由度只有一个。',
    },
    {
      id: 'cover', chapter: 1, name: '盖板', sub: '最后合上', parts: ['cover'],
      color: '#9aa6b2', icon: 'plate',
      tip: '盖板压在主轴上，挡住内部。',
      learn: '盖板是外壳，装上之后要靠剖切才能看见内部。',
    },
  ],

  tasks: [
    {
      exp: '转一下主轴',
      expText: '拖动滑块转主轴，观察它只是转，位置不变。',
      q: '主轴被几处支承定位？',
      options: ['两处', '一处', '不需要支承'],
      a: 0,
      why: '两端各一处轴承，两个支承点才能约束住轴的径向位置、只留旋转。',
    },
    {
      exp: '合上盖板',
      expText: '装盖板前后各看一次内部。',
      q: '盖板装上以后还能看见内部吗？',
      options: ['可以，打开剖切', '不能，永远看不见'],
      a: 0,
      why: '剖切模式下外壳变成半透明/切开，内部仍然可见。',
    },
  ],

  experiments: [
    { id: 'crank', label: '主轴转角', control: 'slider', min: 0, max: 360, step: 1, value: 0, unit: '°' },
  ],

  notes: [
    '这是骨架自检用的示例物品，没有三维模型，只用来验证布局、插槽和浏览器验收链路。',
    '真物品把 <code>model.mjs</code> 换成真实几何，其余插槽照抄。',
  ],
};

export { PARTS, applyMotion, createModel, MANIFEST };
