#!/usr/bin/env python3
"""mechbench · 通用构建：固定骨架 + kit + 一个物品 → dist/<slug>.html

用法：
    python3 tools/build.py _template            # 构建 items/_template
    python3 tools/build.py all                  # 构建 items/ 下全部物品
    python3 tools/build.py double-cylinder-engine --single   # 再打成离线单文件（需三维）
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KIT_ORDER = ["icons.mjs", "lab.mjs", "scene.mjs"]
ITEM_ORDER = ["model.mjs", "manifest.mjs", "main.mjs"]
MARKERS = {
    "<!--KIT:CSS-->": ("kit", "lab.css"),
    "<!--ITEM:CSS-->": ("item", "lab.css"),
    "<!--KIT:JS-->": ("kit", "*"),
    "<!--ITEM:JS-->": ("item", "*"),
}

IMPORT_RE = re.compile(r"^\s*(?:import|export\s+\*)\s.*$", re.M)
EXPORT_RE = re.compile(r"^\s*export\s+", re.M)


def inline(paths):
    """把若干模块拼进同一作用域：去掉 import 与 export 前缀。"""
    out = []
    for p in paths:
        src = p.read_text(encoding="utf-8")
        src = IMPORT_RE.sub("", src)
        src = EXPORT_RE.sub("", src)
        out.append(f"\n/* ==== {p.parent.name}/{p.name} ==== */\n{src}")
    return "".join(out)


def collect(base, names):
    if names == "*":
        return [base / n for n in (KIT_ORDER if base.name == "kit" else ITEM_ORDER) if (base / n).is_file()]
    return [base / names]


def build(slug, single=False):
    item_dir = ROOT / "items" / slug
    if not (item_dir / "manifest.mjs").is_file():
        sys.exit(f"物品缺少 manifest.mjs：{item_dir}")

    shell = (ROOT / "kit" / "shell.html").read_text(encoding="utf-8")
    for marker in MARKERS:
        if shell.count(marker) != 1:
            sys.exit(f"骨架占位标记必须各出现一次：{marker}")

    css_kit = (ROOT / "kit" / "lab.css").read_text(encoding="utf-8")
    css_item = item_dir / "lab.css"
    js_kit = inline(collect(ROOT / "kit", "*"))
    js_item = inline(collect(item_dir, "*"))

    html = shell.replace("<!--KIT:CSS-->", css_kit)
    html = html.replace("<!--ITEM:CSS-->", css_item.read_text(encoding="utf-8") if css_item.is_file() else "")
    html = html.replace("<!--KIT:JS-->", js_kit)
    html = html.replace("<!--ITEM:JS-->", js_item)

    if "window.__mechbench" not in html:
        html = html.replace("</main>", "</main>\n<script>window.__mechbench={slug:'%s',built:true}</script>" % slug)

    out_dir = ROOT / "dist"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"{slug}.html"
    out.write_text(html, encoding="utf-8")
    print(f"→ {out.relative_to(ROOT)}  ({len(html)//1024} KB)")

    if single:
        builder = Path.home() / ".pi/agent/skills/real-device-game/assets/build.py"
        if not builder.is_file():
            sys.exit("找不到技能打包器 assets/build.py")
        single_out = out_dir / f"{slug}-单文件.html"
        subprocess.run([sys.executable, str(builder), str(out), "-o", str(single_out), "--offline"], check=True)
        print(f"→ {single_out.relative_to(ROOT)}  ({single_out.stat().st_size//1024} KB)")
    return out


def main():
    ap = argparse.ArgumentParser(description="mechbench 构建")
    ap.add_argument("slug", help="物品目录名，或 all")
    ap.add_argument("--single", action="store_true", help="额外产出离线单文件")
    a = ap.parse_args()

    if a.slug == "all":
        items = sorted(p.name for p in (ROOT / "items").iterdir() if (p / "manifest.mjs").is_file())
        if not items:
            sys.exit("items/ 下还没有物品")
        for s in items:
            build(s, a.single)
    else:
        build(a.slug, a.single)


if __name__ == "__main__":
    main()
