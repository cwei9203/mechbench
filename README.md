# mechbench

把真实机械做成"亲手装配 → 观察运作 → 验证因果"的科普小游戏。**页面布局已固化为 kit，一个物品只写数据和几何。**

## 快速开始

```bash
python3 tools/serve.py          # 构建全部 → 起服务 → 打开 http://127.0.0.1:8000/
```

目录页列出所有物品；点进去就是那一台的装配实验室。单独构建 / 验收：

```bash
python3 tools/build.py double-cylinder-engine   # 构建 → dist/double-cylinder-engine.html
node tools/verify.mjs double-cylinder-engine    # 无浏览器断言（规则/几何，0.3 秒）
node tools/accept.mjs double-cylinder-engine    # 浏览器验收 + 截图
open dist/accept/double-cylinder-engine/double-cylinder-engine-1440-after.png
```

交付前跑一遍一致性检查（临时目录重建 + 与 `dist/` 逐字节比对，不写工作区）：

```bash
python3 tools/check.py            # 页面是否最新 / 目录页死链 / vendor 是否齐 / 证据是否残留 / 是否进库
```

三维物品要 importmap，必须走 http（验收脚本自带静态服务器）：

```bash
python3 -m http.server -d dist 8000   # 然后开 http://127.0.0.1:8000/double-cylinder-engine.html
```

## 结构

```
kit/            固定骨架（冻结，物品不许改）
items/<slug>/   一个物品一个文件夹：manifest(文案/关卡/数值) + model(几何) + logic(规则) + main(接线)
tools/          build.py · make-item.py · verify.mjs(无浏览器断言) · accept.mjs(真实 Chrome 验收) · check.py(仓库一致性)
vendor/         three.js 0.170.0 + addons（构建时复制到 dist/vendor）
dist/           构建产物（<slug>.html + <slug>.logic.mjs）+ 验收报告 + 截图
```

## 当前状态

| 里程碑 | 状态 |
|---|---|
| 骨架 + 插槽契约（`kit/slots.md`） | ✅ |
| 布局渲染 `kit/lab.mjs` + 图标库 | ✅ |
| 通用构建 `tools/build.py` | ✅ |
| 浏览器验收 `tools/accept.mjs`（CDP，无依赖） | ✅ |
| 无浏览器断言 `tools/verify.mjs`（静态契约 + `logic.spec.mjs`） | ✅ 6 物品 1101 项 / 0.3 秒 |
| 示例物品 `items/_template`（无三维） | ✅ 25 项检查通过 |
| `kit/scene.mjs` 三维舞台 | ✅ |
| `items/double-cylinder-engine` 迁移 | ✅ 41 项检查 × 3 宽度 + 离线单文件 |
| `items/electric-toothbrush` 迁移 | ✅ 26+13 项检查 × 3 宽度 |
| `kit` 局部放大窗 / 通关撒花 / 发现卡 | ✅ 由牙刷迁移带出 |
| `items/nail-gun-lab` 迁移 | ✅ 49–52 项 × 3 宽度 + 几何自检 9 项 |
| `items/hand-crank-flashlight` 迁移 | ✅ 42–45 项 × 3 宽度 |
| `items/spherical-lock` 迁移 | ✅ 95–100 项 × 3 宽度 + 几何自检 97 项 |
| `items/injection-pen` 新建 | ✅ 82–85 项 × 3 宽度 + 几何自检 30 项 |

## 项目内 skill

`.pi/skills/mechbench-item/SKILL.md` 把“提需求 → 出成品”的流程固化下来：机构核对 → 填 4 个文件 → 构建 → 浏览器验收 → 交付。只要说想做什么物件，agent 会按它执行。

## 加一个物品

```bash
python3 tools/make-item.py hand-crank-flashlight --title "手摇发电手电筒装配实验室"
```

然后按 `AGENTS.md` 的八步流程做；插槽字段查 `kit/slots.md`。
