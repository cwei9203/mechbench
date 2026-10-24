# mechbench

把真实机械做成"亲手装配 → 观察运作 → 验证因果"的科普小游戏。**页面布局已固化为 kit，一个物品只写数据和几何。**

## 快速开始

```bash
python3 tools/build.py _template && node tools/accept.mjs _template
open dist/_template.html
open dist/accept/_template/_template-1440.png
```

## 结构

```
kit/            固定骨架（冻结，物品不许改）
items/<slug>/   一个物品一个文件夹：manifest(文案) + model(几何) + main(接线)
tools/          build.py · make-item.py · accept.mjs(真实 Chrome 验收)
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
| `kit/scene.mjs` 三维舞台 | ⬜ 随第一个物品落地 |
| `items/double-cylinder-engine` 迁移 | ⬜ 下一步 |
| `items/electric-toothbrush` 迁移（验证插槽够用） | ⬜ |

## 加一个物品

```bash
python3 tools/make-item.py hand-crank-flashlight --title "手摇发电手电筒装配实验室"
```

然后按 `AGENTS.md` 的八步流程做；插槽字段查 `kit/slots.md`。
