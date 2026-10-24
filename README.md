# mechbench

把真实机械做成"亲手装配 → 观察运作 → 验证因果"的科普小游戏。**页面布局已固化为 kit，一个物品只写数据和几何。**

## 快速开始

```bash
python3 tools/serve.py          # 构建全部 → 起服务 → 打开 http://127.0.0.1:8000/
```

目录页列出所有物品；点进去就是那一台的装配实验室。单独构建 / 验收：

```bash
python3 tools/build.py double-cylinder-engine   # 构建 → dist/double-cylinder-engine.html
node tools/accept.mjs double-cylinder-engine    # 浏览器验收 + 截图
open dist/accept/double-cylinder-engine/double-cylinder-engine-1440-after.png
```

三维物品要 importmap，必须走 http（验收脚本自带静态服务器）：

```bash
python3 -m http.server -d dist 8000   # 然后开 http://127.0.0.1:8000/double-cylinder-engine.html
```

## 结构

```
kit/            固定骨架（冻结，物品不许改）
items/<slug>/   一个物品一个文件夹：manifest(文案/关卡/数值) + model(几何) + logic(规则) + main(接线)
tools/          build.py · make-item.py · accept.mjs(真实 Chrome 验收)
vendor/         three.js 0.170.0 + addons（构建时复制到 dist/vendor）
dist/           构建产物 + 验收报告 + 截图
```

## 当前状态

| 里程碑 | 状态 |
|---|---|
| 骨架 + 插槽契约（`kit/slots.md`） | ✅ |
| 布局渲染 `kit/lab.mjs` + 图标库 | ✅ |
| 通用构建 `tools/build.py` | ✅ |
| 浏览器验收 `tools/accept.mjs`（CDP，无依赖） | ✅ |
| 示例物品 `items/_template`（无三维） | ✅ 25 项检查通过 |
| `kit/scene.mjs` 三维舞台 | ✅ |
| `items/double-cylinder-engine` 迁移 | ✅ 41 项检查 × 3 宽度 + 离线单文件 |
| `items/electric-toothbrush` 迁移 | ✅ 26+13 项检查 × 3 宽度 |
| `kit` 局部放大窗 / 通关撒花 / 发现卡 | ✅ 由牙刷迁移带出 |
| `items/nail-gun-lab` 迁移 | ⬜ 待做（还需：存档、物理状态同步） |
| `items/hand-crank-flashlight` 迁移 | ⬜ 待做 |

## 项目内 skill

`.pi/skills/mechbench-item/SKILL.md` 把“提需求 → 出成品”的流程固化下来：机构核对 → 填 4 个文件 → 构建 → 浏览器验收 → 交付。只要说想做什么物件，agent 会按它执行。

## 加一个物品

```bash
python3 tools/make-item.py hand-crank-flashlight --title "手摇发电手电筒装配实验室"
```

然后按 `AGENTS.md` 的八步流程做；插槽字段查 `kit/slots.md`。
