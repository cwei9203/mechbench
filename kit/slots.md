# 插槽契约

骨架固定，物品只提供数据。**物品不许改 `kit/shell.html` 和 `kit/lab.css`**；需要个别样式时写 `items/<slug>/lab.css`（同名选择器覆盖），需要个别交互时写 `items/<slug>/main.mjs`。

## 文件职责

| 文件 | 谁写 | 职责 |
|---|---|---|
| `kit/shell.html` | kit | 固定骨架，只有 8 个 `data-slot` 挂载点 + 固定控件 id |
| `kit/lab.css` | kit | 区域、断点、控件外观。不含任何物品文案 |
| `kit/lab.mjs` | kit | 填插槽 → DOM；把点击转成事件；维护 `lab.state` 的显示态 |
| `kit/icons.mjs` | kit | 通用零件图标库（`box/shaft/gear/spring/screw/plate/disc/piston/valve/coil/battery/bolt/lever/housing/pin`） |
| `kit/scene.mjs` | kit | three.js 舞台：相机/灯光/地面/剖切/目标轮廓/拾取/拖放/取景/循环 |
| `items/<slug>/model.mjs` | 物品 | 几何 + 运动（唯一真源），导出 `MODEL = { world, PARTS, byKey, applyMotion, moduleBounds, ... }` |
| `items/<slug>/manifest.mjs` | 物品 | **全部插槽填充**：`export const MANIFEST = {...}`（含 `scene` 三维数值） |
| `items/<slug>/logic.mjs` | 物品 | 业务规则（纯逻辑、无 DOM、无三维）；顶层可以读 `MANIFEST`；**必须 `export function createGame()`**，`dist/<slug>.logic.mjs` 靠这个名字把游戏拿出来 |
| `items/<slug>/logic.spec.mjs` | 物品 | 可选，无浏览器断言：`export default (t, { createGame, MANIFEST, MODEL }) => {}`，用 `t.ok/t.eq/t.near`。被 `node tools/verify.mjs <slug>` 执行 |
| `items/<slug>/main.mjs` | 物品 | 接线：`mountLab(MANIFEST)` + 业务规则 + 事件处理 |
| `items/<slug>/lab.css` | 物品 | 可选，个别视觉覆盖 |
| `items/<slug>/accept.mjs` | 物品 | 可选，浏览器验收的额外断言：页面内 async 函数体，`return {ok:[], bad:[]}`；只能用 DOM 驱动（页面模块作用域不可见） |
| `items/<slug>/notes.md` | 物品 | 尺寸依据、教学简化、未验证项 |

## 插槽（manifest 字段）

`✅` 必填，`—` 有默认值。

| 字段 | 位置 | 必填 | 形式与说明 |
|---|---|---|---|
| `brand.title` | 顶栏 + `<title>` | ✅ | 字符串。例：`双缸发动机装配实验室` |
| `brand.subtitle` | 顶栏第二行 | — | 一行摘要，例：`360° 并列双缸 · 26 组零件 · 3 关` |
| `brand.mark` | 顶栏左方块 | — | `{a,b}` 两色色块，或 `{svg:'<path .../>'}` 完全自定义 |
| `chapters[]` | 顶栏进度 + 教练面板头 | ✅ | `{title, subtitle, badge}`，数组长度即关卡数 |
| `stage.title` | 舞台左上大标题 | ✅ | 一句话说清这一关在干什么 |
| `stage.hint` | 舞台左上小字 | — | 首次操作提示 |
| `stage.gestures` | 舞台左下脚注 | — | 默认已写好鼠标/触屏手势 |
| `tools[]` | 舞台右上 | — | 默认 旋转/平移/剖开看/复位。`{id,label,pressed?}`；`id` 为 `rotate/pan/cut/home` 时骨架内置行为 |
| `envParts[]` | —（不进 DOM） | — | 环境件：安装在基准件上、不属于任何可装模块的零件 key（如门锁的门与门框）。不声明的话 `verify.mjs` 会报「零件未被认领」 |
| `readout[]` | 舞台右下读数 | ✅ | `{key,label,big?}`，`big` 给主读数。行数由物品决定（发动机 5 行，手电筒 2 行） |
| `tray.title` | 零件盒标题 | — | 默认 `零件盒` |
| `tray.hint` | 零件盒右侧小字 | — | 拖放提示 |
| `modules[]` | 零件盒卡片 | ✅ | `{id,chapter,name,sub,parts,tip,learn,color,icon}`；`parts` 对应 `model.mjs` 里的零件 key |
| `tasks[]` | 教练面板任务区 | ✅ | 按章节一一对应：`{exp,expText,q,options,a,why}` |
| `experiments[]` | 教练面板实验台 | — | `{id,label,control:'slider'\|'toggle'\|'button',min,max,step,value,unit}`，声明式，不用手写控件 |
| `notes[]` | 教练面板折叠区 | — | 段落字符串数组（可含内联 HTML），写"这是怎样的一套模型" |
| `copy.*` | 各类默认文案 | — | `copy.coach.tag` 支持 `{n}` `{total}`；`copy.labels.exp/quiz/done` |

## 三维舞台配置（`manifest.scene`）

只有三维物品需要；`createStage()` 全部有默认值，只写要改的。

| 字段 | 说明 |
|---|---|
| `spawn` | `[x,y,z]` 未装模块的待取位置 |
| `camera` | `{fov, near, far, defaultFocus}`，`defaultFocus` 就是「复位」去的视角 |
| `orbit` | `{minDistance, maxDistance, minPolar, maxPolar}`（polar 单位是 π） |
| `renderer` | `{exposure, pixelRatio}` |
| `bench` | `{y, color, size}` 地面 |
| `lights` | `{hemi:[sky,ground,i], key:{color,intensity,pos}, fill, rim}` |
| `env` | 环境光强度 |
| `cut` | 剖切平面 `{normal:[x,y,z], constant}` |
| `focus` | 取景预设：`{名字: {dir:[yaw,pitch], fit, box?}}`。`box:[[cx,cy,cz],[sx,sy,sz]]` 用于「自由实验看行程区」这种虚拟取景 |
| `hiddenPart` | `(key, state) => bool`，拆件后不再渲染某零件（如 `valveCover`） |

## 三维验收探针（`stage.probe`）

`stage.probe({x,y,width,height})` 返回 Promise → `{colors, lit, rows, cols, w, h}`。
rect 是相对舞台左上角的 CSS 像素；内部排队到渲染帧内 `readPixels`（帧外读只会得到全 0）。
用途：判断某块区域「有没有画面」「有没有贯通裂缝」。`tools/accept.mjs` 已内置三条断言。

## 事件（物品 → kit 监听）

`lab.on(name, fn)`：

| 事件 | payload | 触发 |
|---|---|---|
| `select` | `moduleId` | 点零件卡 |
| `place` | — | 点「装到这里」/ 骨架 socket |
| `undo` | — | 点「撤回一步」 |
| `next` / `replay` | — | 点「进入下一关」/「再看一遍」 |
| `answer` | `optionIndex` | 点测验选项 |
| `experiment` | `{id, value}` | 动滑块 / 点开关（`experiments[].id` 必须在这里被处理，否则控件是死的） |
| `experiment` | `{id, value}` | 动滑块 / 点开关 |
| `tool` | `toolId` | 点工具栏按钮（`home` 之外 kit 只切 `aria-pressed`） |
| `free` / `restart` | — | 点顶栏「自由实验」/「重新开始」 |

## 显示态（`lab.state`，物品直接改 + `lab.render()`）

```js
lab.state = {
  chapter: 0,          // 当前关
  placed: [],          // 已装模块 id
  selected: null,      // 选中模块 id（决定 socket 是否出现）
  phase: 'build',      // build | check | done
  badges: [],          // 已得徽章（字符串）
  readout: {},         // { key: '显示值' }
  visible: { readout: true },
  hint: '', feedback: '', feedbackKind: '', // '' | 'error' | 'success'
  completed: [],       // 每关是否完成（顶栏 ✓）
  progress: null,      // {done,total} 覆盖「本关模块数」的进度口径
  coach: null,         // {tag,title,intro} 覆盖教练面板头部（自由实验等特殊阶段）
  stageHint: '', trayTitle: '', trayHint: '',   // 覆盖静态插槽文案
  cardsLocked: false,  // 锁住零件卡（进入实验/自由实验阶段）
}
```

`lab.render()` 是幂等的，物品每次改完状态调一次即可。

### 读数只能走 `lab.paint()`

```js
lab.paint({ dose: s.windMg.toFixed(2) + ' mg', clicks: Math.round(s.windMg / MODEL.PEN.clickMg) + ' 格' });
```

按 `{key: 显示值}` 批量写入 `[data-rd]`，内部做 diff（每帧调也不会碰 DOM）。值给 `null` 就写 `—`。

**不要在物品里直写 `[data-rd]`**：`kit/lab.mjs` 的 `render()` 也会写同一批节点，两边各写一份就会互相覆盖。读数的格式化留在物品侧（只有那里知道 model/view/game），kit 只管写。

## 命名与顺序（拼在同一作用域）

所有 kit 与物品文件被拼进同一个 `<script type="module">`，因此：

- **顶层标识符不能重名**（`const V` 在两处出现就会报错）。`tools/build.py` 会跑 `node --check` 把关。
- 拼接顺序固定：`kit/icons → lab → scene → 物品 model → manifest → logic → main`。`logic.mjs` 顶层会读 `MANIFEST`，所以必须排在 `manifest.mjs` 之后。
- 物品代码里可以叫 `MODEL` / `MANIFEST` / `stage` / `lab` / `act`，但不要再用 `V`、`DEG`、`MODULES` 这类 kit 或 model 已占用的名字。

## 校验

1. `python3 tools/build.py <slug>` — 骨架占位标记齐全、manifest 存在、产物过 `node --check`、**并跑 `verify.mjs --static` 的静态契约**（零件归属、读数 key、取景名、applyMotion 不产 NaN）。
2. `node tools/verify.mjs <slug>` — 无浏览器断言：静态契约 + `logic.spec.mjs` 行为断言。毫秒级，改一行跑一次。
3. `node tools/accept.mjs <slug>` — 3 个宽度下检查：区域可见、插槽非空、读数已赋值、按钮有文字、无横向溢出、无控制台报错、选中→装上→撤回全链路、截图存档。
4. 物品自定义断言写进 `items/<slug>/accept.mjs`，被第 3 步自动执行——**只留浏览器才能证明的东西**（布局、DOM 交互、像素）。

## 新物品

```
python3 tools/make-item.py <slug>      # 生成骨架文件
# 改 manifest.mjs（文案/关卡/模块/读数）
# 改 model.mjs（几何/运动）
# 改 main.mjs（规则接线）
python3 tools/build.py <slug> && node tools/verify.mjs <slug> && node tools/accept.mjs <slug>
```
