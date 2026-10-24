---
name: mechbench-item
description: 在 mechbench 项目里新建或修改一个机械装配小游戏物品（真实物件 → 可拖装、可运行、可验收的交互页面）。当用户说“做一个 X 的装配实验室 / 拆装演示 / 交互原理页 / 把这个机构做成小游戏”，或要改 items/<slug>/ 里已有物品时使用。
---

# 造一个 mechbench 物品

页面骨架、布局、拖放、剖切、验收都已经固化在项目里。**你的活只有三件：核对机构、填 4 个文件、跑验收。**

## 先读（必做，不许跳过）

1. `AGENTS.md` — 铁律、八步流程、必过清单
2. `kit/slots.md` — 插槽字段表、事件表、`manifest.scene` 字段、命名与拼接顺序

建模深度细则按需读 `~/.pi/agent/skills/real-device-game/references/`：
`modeling.md`（建件五标准）、`integrity.md`（零穿透/支承/12 条必过）、`pitfalls.md`（共面闪烁、裁切、拖拽符号）、`gameplay.md`（关卡与提示）。

## 判断改还是新建

- 用户点名已有物品（如“发动机加个油泵”）→ 只改 `items/<slug>/`
- 新物件 → `python3 tools/make-item.py <slug> --title "…装配实验室"`

## 第一步：机构核对（不核对就开始建模 = 返工）

先写零件表，进 `notes.md`：

```
零件 ID | 尺寸与依据（公布参数/标准/估算） | 由谁固定 | 如何运动 | 与谁连接 | 如何拆下 | 简化项
```

硬条件：每个运动件有驱动来源；每个固定件有支承；任意两件不穿模；可拆连接能解释拆开后两侧各自的运动。**尺寸标出处**，公布参数和教学估算分开写。不要把不同技术路线拼在一起。

## 第二步：填 4 个文件

| 文件 | 内容 | 关键约束 |
|---|---|---|
| `manifest.mjs` | 品牌/关卡/模块/读数/notes/`scene` | 一个零件只属于一个模块；关卡按真实装配依赖切；每关有 `exp`(实验动作) `expText` `q/options/a/why` |
| `model.mjs` | 几何 + 运动 | 1 单位 = 1 mm；建在 `world` 组里；每个 mesh 打 `userData.key`；导出 `MODEL={world,PARTS,byKey,applyMotion,moduleBounds,...}`；`shell:true` 的件在剖开时换玻璃 |
| `logic.mjs` | 业务规则 | 纯逻辑、无 DOM、无三维；**先校验再改状态**；动作返回 `{ok,message,learn?,kind?}`；失败不动已装件 |
| `main.mjs` | 接线 | `mountLab(MANIFEST)` + `createStage({...})`；接 `select/place/undo/answer/tool/free/restart`；分阶段面板用 `lab.task(fn)` |

需要个别视觉时写 `items/<slug>/lab.css`（同名覆盖），**不要动 `kit/`**。

## 第三步：命名与顺序（踩过就不要再踩）

所有文件拼进同一个作用域：

- 顶层标识符**不能重名**（`V`/`DEG`/`MODULES`/`world` 都撞过）。`build.py` 跑 `node --check` 会拦。
- 顺序固定 `model → manifest → logic → main`。`logic.mjs` 顶层读 `MANIFEST`，排前面会报 `Cannot access 'MANIFEST' before initialization`。

## 第四步：验收（没跑完不许说完成）

```bash
python3 tools/build.py <slug>          # 自动 node --check
node tools/accept.mjs <slug>           # 3 个宽度：1440 / 820 / 390
```

通用 25 项之外，必须自己写 `items/<slug>/accept.mjs`（页面内 async 函数体，`return {ok,bad}`，只能用 DOM 驱动），至少覆盖：

1. 每个按钮点了之后**场景状态真的变**（拆=从场景移除，不是变文案）
2. 每个实验控件（滑杆/开关）改变了读数或几何
3. 关卡推进：装完 → 实验 → 答题 → 徽章 → 下一关
4. 「自由实验」一键满装且卡片进入已装态

**像素级自检**（`tools/accept.mjs` 已内置，用 `stage.probe()` 在渲染帧内读像素）：

- 有局部放大窗的：窗里必须有画面，且窗的背景必须透明（DOM 背景会盖住 canvas 上的第二视角）
- 剖开 / 实体两次渲染必须不一样（否则剖切或材质还原失效）

**脚本抓不到的一类**：半壳中缝、按钮窗漏缝这种"看得出来但分不清是设计留隙还是漏做"的缺陷。做法固定为：**把 `-after.png` 裁一块放大看**（例：`sips -c 700 500 --cropOffset y x shot.png`），对着旧版同机位比一遍。别只看整图缩略。

最后看 `dist/accept/<slug>/*.png`（`-after` 是交互后画面）。截图不对就改，别只看 JSON 全绿。

需要离线交付：`python3 tools/build.py <slug> --single`（内联 three，~1.4 MB，双击能开）。

## 第五步：本地看

```bash
python3 tools/serve.py            # 构建全部 + 起服务 + 打开目录页
```

目录页 `/` 自动列出所有物品；单个物品 `/<slug>.html`。

## 完成判据（缺一条就不算完成）

- [ ] 零件表进 `notes.md`，尺寸依据与教学简化分开
- [ ] `node --check` 通过、`accept.mjs` 3 个宽度全绿
- [ ] 物品专属断言覆盖了每个按钮与实验控件
- [ ] 截图人眼看过：模型没穿模、没被剖切成半个、手机上不遮挡
- [ ] 放大窗、剖切、半壳接缝逐项裁图放大看过（不是只看全图）
- [ ] `notes.md` 写了未验证项
- [ ] 回复先给目录页链接 + 一条开始操作

## 不要做

- 不新写页面壳、不复制 `kit/*` 到物品目录
- 不引 npm 依赖（three 走 `vendor/`）
- 不把文案写进 `kit/`，全部走 `manifest.mjs`
- 不在验收没过时说“已完成”
