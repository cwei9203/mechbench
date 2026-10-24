#!/usr/bin/env python3
"""mechbench · 新物品脚手架：从 items/_template 复制一份并改名。

用法：
    python3 tools/make-item.py hand-crank-flashlight --title "手摇发电手电筒装配实验室"
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TPL = ROOT / "items" / "_template"


def main():
    ap = argparse.ArgumentParser(description="生成一个新物品目录")
    ap.add_argument("slug", help="目录名，用连字符小写")
    ap.add_argument("--title", help="品牌标题，默认用 slug")
    a = ap.parse_args()

    dest = ROOT / "items" / a.slug
    if dest.exists():
        sys.exit(f"已存在：{dest.relative_to(ROOT)}")

    dest.mkdir(parents=True)
    for name in ("model.mjs", "manifest.mjs", "main.mjs"):
        src = (TPL / name).read_text(encoding="utf-8")
        src = src.replace("'_template'", f"'{a.slug}'")
        src = src.replace("示例装配实验室", a.title or a.slug)
        (dest / name).write_text(src, encoding="utf-8")

    print(f"→ {dest.relative_to(ROOT)}/")
    print("下一步：改 manifest.mjs → model.mjs → main.mjs，然后")
    print(f"  python3 tools/build.py {a.slug} && node tools/accept.mjs {a.slug}")


if __name__ == "__main__":
    main()
