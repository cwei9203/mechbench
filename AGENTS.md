# mechbench · 项目说明（给 agent 的唯一权威文档）

把真实机械做成"亲手装配 → 观察运作 → 验证因果"的科普小游戏。**页面布局已经固化，不重写**；本项目的活=建模、排布组件、填文案、跑验收。

## 铁律

1. **骨架不动**：`kit/shell.html` 和 `kit/lab.css` 是冻结资产。物品只填数据；个别视觉差异写 `items/<slug>/lab.css`，个别交互写 `items/<slug>/main.mjs`。
2. **一份几何，多处使用**：`model.mjs` 是几何与运动的唯一真源。读数必须取自驱动模型的那个状态量，不许另算一份。
3. **文案 ↔ 控件一一对应**：文案说"拆掉 X"，界面上就必须有能拆 X 的东西（`accept.mjs` 会查这条）。
4. **物品各自成文件夹**：一个物品 = `items/<slug>/` 一整个目录，不许跨物品共享文件。
5. **没跑浏览器验收就不算完成**：`node tools/accept.mjs <slug>` 全绿 + 人眼看过截图，才算交付。

## 目录

```
kit/            固定骨架（冻结）
  shell.html    data-slot 挂载点 + 固定控件 id
  lab.css       布局/断点/控件外观
  lab.mjs       插槽 → DOM，事件转发，lab.state
  scene.mjs     three.js 舞台：相机/灯光/剖切/轮廓/拾取/拖放/取景
  icons.mjs     通用零件图标
  slots.md      插槽契约（改字段先改这里）
items/<slug>/   一个物品
  manifest.mjs  全部文案/关卡/模块/读数 + scene 三维数值
  model.mjs     几何 + 运动 + 零件注册（导出 MODEL）
  logic.mjs     业务规则（纯逻辑，顶层可读 MANIFEST）
  main.mjs      接线：挂面板、连事件、驱动舞台
  lab.css       可选视觉覆盖
  accept.mjs    可选浏览器断言（只能用 DOM 驱动）
  notes.md      尺寸依据 / 教学简化 / 验证记录
tools/
  build.py      骨架+kit+物品 → dist/<slug>.html（内含 node --check 把关）
  make-item.py  新物品脚手架
  accept.mjs    真实 Chrome 验收 + 截图（CDP + 内置 http 服务，无第三方依赖）
vendor/         three.js 0.170.0 + addons（构建时复制到 dist/vendor）
dist/           构建产物 + 验收报告 + 截图（提交进库，作为交付证据）
```

## 一个新物品的固定流程

1. **机构核对**：先确认这是真实存在的实现。列零件表：`零件 ID / 尺寸与依据 / 由谁固定 / 如何运动 / 与谁连接 / 如何拆下 / 简化项`。每个运动件有驱动来源，每个固定件有支承，任意两件不穿模。
2. `python3 tools/make-item.py <slug> --title "…"` 生成目录。
3. **填 `manifest.mjs`**：品牌、关卡（3 关左右，按真实装配依赖切）、模块（零件盒卡片，每个零件只属于一个模块）、每题（`exp` 实验动作 / `expText` 怎么做 / `q` 判断题 / `why` 解释）、读数行、实验台控件。字段含义见 `kit/slots.md`。
4. **写 `model.mjs`**：几何建在 `world` 组里，零件注册成 `byKey`（每个 meshes 带 `userData.key`），导出 `MODEL = { world, PARTS, byKey, applyMotion, moduleBounds, ... }`。`shell:true` 的零件在剖开模式下换玻璃。1 单位 = 1 mm。
5. **写 `logic.mjs`**：业务状态与动作。规则：**先校验，再改状态**；失败操作不动已装件。动作返回 `{ok, message, learn?, kind?}`。
6. **写 `main.mjs`**：`mountLab(MANIFEST)` + `createStage({...})`，把 `select/place/undo/answer/tool/free/restart` 接上，并用 `lab.task(fn)` 换掉默认教练面板（按阶段给不同面板）。
7. `python3 tools/build.py <slug>` → `dist/<slug>.html`（自动跑 `node --check`，重名/语法错直接失败）。
8. `node tools/accept.mjs <slug>` → 3 个宽度全绿，看 `dist/accept/<slug>/*.png`（`-after` 是交互后画面）。
9. 需要离线交付时 `python3 tools/build.py <slug> --single`（技能打包器内联 three，产物 ~1.4 MB）。
10. 写 `notes.md`：尺寸依据、哪些是教学简化、验证记录、未验证项。

## 浏览器验收（必过）

`tools/accept.mjs` 在真实 Chrome（headless，CDP，无依赖）里跑 1440 / 820 / 390 三个宽度：

- 四个区域（顶栏/舞台/教练/零件盒）可见，`#fault` 未出现
- 插槽全部填充：品牌、关卡、标题、卡片、读数行有值、工具栏有按钮
- 每个可见按钮有文字；每张卡有名称
- 进度条 `aria-valuenow/max` 有效
- 无横向溢出；手机上舞台高度 ≥ 300
- 交互全链路：点卡片 → 出现「装到这里」→ 装 → 进度变化 → 反馈变化 → 撤回 → 进度还原
- 无控制台报错 / 未捕获异常
- 截图存档 `dist/accept/<slug>/`，报告 `acceptance.json`

物品专属断言写 `items/<slug>/accept.mjs`（页面内 async 函数体，`return {ok:[], bad:[]}`），被自动执行。至少覆盖：**每个按钮/实验都真的改变了场景状态**（不能只改文案）。

## 三维与完整性

深度细则不在本文件重复，按需读：
- `~/.pi/agent/skills/real-device-game/references/modeling.md` — 建件五条硬标准
- `references/integrity.md` — 零穿透、支承接触、运动学与网格同源、相机与剖切契约
- `references/pitfalls.md` — 共面闪烁、透明与裁切、拖拽方向符号、截图约定
- `references/gameplay.md` — 关卡与提示分级
- `references/validation.md` — 验证方式
- `references/toothbrush.md` — 可运行范例

交付前自查（摘要，细则见 integrity.md）：

1. 任意两件不穿模；运动扫掠路径也没有干涉
2. 中间件真的同时接触两侧，不是悬空
3. 传动比与齿数/带轮一致
4. 每个按钮、每个实验动作都真的改变场景（拆=移除，不是冻住）
5. 文案提到的每个操作，界面上都有对应控件
6. 首屏就有「自由实验」入口（不用通关）
7. 剖切/相机/点击拾取三者不互相抢
8. 手机上标题、工具栏、读数、零件盒都不被遮挡

## 坑（本项目已踩过）

- **所有文件拼进同一个作用域**：顶层标识符不能重名（`V`、`DEG`、`MODULES` 都撞过）。`build.py` 的 `node --check` 会拦下，按提示改名，不要靠运行时发现。
- **拼接顺序固定**：`kit/icons → lab → scene → model → manifest → logic → main`。`logic.mjs` 顶层读 `MANIFEST`，顺序错了会报 `Cannot access 'MANIFEST' before initialization`。
- **`<title data-slot>` 会被当成插槽目标**：`document.querySelector('[data-slot="brand.title"]')` 先匹配到 `<title>`，顶栏标题就填不上。`<title>` 不带 `data-slot`。
- **CSS 覆盖顺序**：`.toolbar button` 比裸 `button[aria-pressed=true]` 更靠后，会吃掉按下态底色。加类前缀。
- **重渲染后旧节点失效**：`lab.render()` 会重建卡片。断言/取节点要在点击后**重新查询**。
- **三维必须走 http**：importmap + `document` 模块在 `file://` 下会因 CORS 失败。`accept.mjs` 自带静态服务器；手动看用 `python3 -m http.server -d dist`。
- **移动端工具栏会压住标题**：`.stage-title` 在 ≤780px 用 `max-width:calc(100% - 172px)` 让位。
- **读数为空是设计**：没装对应模块时读数显示 `—`。验收只要求"可见时至少一项有值"。

## 命令速查

```bash
python3 tools/make-item.py <slug> --title "…"   # 新物品
python3 tools/build.py <slug>                   # 构建 → dist/<slug>.html
python3 tools/build.py all                      # 全部构建
node tools/accept.mjs <slug>                    # 浏览器验收 + 截图
node tools/accept.mjs <slug> --widths 1440,390  # 只跑指定宽度
python3 tools/build.py <slug> --single          # 额外打离线单文件（需三维）
```

## 交付话术

先给成品路径和一条开始操作，再概括核心体验与已通过的检查，末尾列出未验证项。**不说"已完成"如果任何一条验收没过。**
