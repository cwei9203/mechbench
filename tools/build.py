#!/usr/bin/env python3
"""mechbench · 通用构建：固定骨架 + kit + 一个物品 → dist/<slug>.html

用法：
    python3 tools/build.py _template            # 构建 items/_template
    python3 tools/build.py all                  # 构建 items/ 下全部物品
    python3 tools/build.py double-cylinder-engine --single   # 再打成离线单文件（需三维）
"""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KIT_ORDER = ["icons.mjs", "lab.mjs", "scene.mjs"]
ITEM_ORDER = ["model.mjs", "manifest.mjs", "logic.mjs", "main.mjs"]
MARKERS = {
    "<!--KIT:CSS-->": ("kit", "lab.css"),
    "<!--ITEM:CSS-->": ("item", "lab.css"),
    "<!--KIT:JS-->": ("kit", "*"),
    "<!--ITEM:JS-->": ("item", "*"),
}

# 纯逻辑三件套：不含 DOM、不含场景，node 可以直接 import
LOGIC_ORDER = ["model.mjs", "manifest.mjs", "logic.mjs"]
EXPORT_DECL_RE = re.compile(
    r"^\s*export\s+(?:async\s+function|const|let|var|function|class)\s+([A-Za-z_$][\w$]*)", re.M)

# node 里跑 geometry/logic 断言时的最小 DOM 桩（model.mjs 会用 canvas 生成贴图纹理）
DOM_SHIM = """/* node 环境最小 DOM 桩：model.mjs 里的 canvas 贴图纹理需要 */
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
}"""

IMPORT_RE = re.compile(r"^\s*(?:import|export\s+\*)\s.*$", re.M)
THREE_IMPORT_RE = re.compile(r"^\s*import\s+[^;]*?from\s+['\"](three[^'\"]*)['\"];?\s*$", re.M)
EXPORT_RE = re.compile(r"^\s*export\s+", re.M)
TOP_RE = re.compile(r"^(?:const|let|var|class|function)\s+([A-Za-z_$][\w$]*)", re.M)
MODULE_RE = re.compile(r'<script type="module">(.*?)</script>', re.S)
IMPORTMAP = ('<script type="importmap">{"imports":{"three":"./vendor/three.module.js",'
             '"three/addons/":"./vendor/addons/"}}</script>')


def inline(paths, imports, names=None):
    """把若干模块拼进同一作用域：three 的 import 提到顶部，其余 import/export 去掉。
    拼在同一作用域，所以顶层标识符不能重名；由 check_syntax() 把关。
    传 names 列表时顺便收集各文件的导出名（用于生成 .logic.mjs 的 export 列表）。"""
    out = []
    for p in paths:
        src = p.read_text(encoding="utf-8")
        if names is not None:
            names.extend(EXPORT_DECL_RE.findall(src))
        for m in THREE_IMPORT_RE.finditer(src):
            line = m.group(0).strip()
            if line not in imports:
                imports.append(line)
        src = THREE_IMPORT_RE.sub("", src)
        src = IMPORT_RE.sub("", src)
        src = EXPORT_RE.sub("", src)
        out.append(f"\n/* ==== {p.parent.name}/{p.name} ==== */\n{src}")
    return "".join(out)


def check_syntax(html):
    """用 node 做一次语法与重名检查（浏览器里报错太晚）。"""
    m = MODULE_RE.search(html)
    if not m:
        return
    tmp = pathlib_tempfile()
    tmp.write_text(m.group(1), encoding="utf-8")
    r = subprocess.run(["node", "--check", str(tmp)], capture_output=True, text=True)
    tmp.unlink(missing_ok=True)
    if r.returncode:
        sys.exit("构建产物语法/重名错误：\n" + r.stderr.strip())


def pathlib_tempfile():
    import tempfile
    return Path(tempfile.mkstemp(suffix=".mjs")[1])


def check_syntax_file(path):
    r = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"语法/重名错误：{path}\n" + r.stderr.strip())


def vendor_path(line):
    """把 three 的裸模块名改写成相对 vendor 的路径（node 里没有 importmap）。"""
    line = line.replace("from 'three/addons/", "from '../vendor/addons/")
    line = line.replace("from \"three/addons/", "from '../vendor/addons/")
    line = line.replace("from 'three'", "from '../vendor/three.module.js'")
    line = line.replace('from "three"', "from '../vendor/three.module.js'")
    return line


def run_static_verify(slug):
    """构建期把关：manifest × model 的交叉一致性（零件归属、读数 key、取景名…）。
    规则写错不该等到打开浏览器才发现。"""
    r = subprocess.run(["node", str(ROOT / "tools" / "verify.mjs"), slug, "--static"],
                       capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"静态断言未通过（{slug}）：\n" + (r.stdout or r.stderr).strip())


def build_logic(slug):
    """产出 dist/<slug>.logic.mjs：model + manifest + logic 三个纯模块，node 可直接 import。
    用途：无浏览器跑装配/剂量/传动比断言 —— node tools/verify.mjs <slug>"""
    item_dir = ROOT / "items" / slug
    files = [item_dir / n for n in LOGIC_ORDER if (item_dir / n).is_file()]
    if not files:
        return None
    names, imports = [], []
    body = inline(files, imports, names)
    uniq = list(dict.fromkeys(names))
    if any(re.match(r"import\s+\*\s+as\s+THREE\b", i) for i in imports):
        uniq.append("THREE")   # 几何自检要量 Box3 / 打射线，复用同一份 three 实例
    head = "\n".join(vendor_path(i) for i in imports)
    out = (
        f"/* mechbench · 生成物，勿手改\n"
        f" * 源：items/{slug}/{{{','.join(p.name for p in files)}}}\n"
        f" * 重新生成：python3 tools/build.py {slug}\n"
        f" * 用途：无浏览器断言 → node tools/verify.mjs {slug}\n"
        f" */\n"
        f"{DOM_SHIM}\n{head}\n{body}"
        f"\nexport {{ {', '.join(uniq)} }};\n"
    )
    path = ROOT / "dist" / f"{slug}.logic.mjs"
    path.parent.mkdir(exist_ok=True)
    path.write_text(out, encoding="utf-8")
    check_syntax_file(path)
    return path


def collect(base, names):
    if names == "*":
        return [base / n for n in (KIT_ORDER if base.name == "kit" else ITEM_ORDER) if (base / n).is_file()]
    return [base / names]


def build(slug, single=False, verify=True):
    item_dir = ROOT / "items" / slug
    if not (item_dir / "manifest.mjs").is_file():
        sys.exit(f"物品缺少 manifest.mjs：{item_dir}")

    shell = (ROOT / "kit" / "shell.html").read_text(encoding="utf-8")
    for marker in MARKERS:
        if shell.count(marker) != 1:
            sys.exit(f"骨架占位标记必须各出现一次：{marker}")

    css_kit = (ROOT / "kit" / "lab.css").read_text(encoding="utf-8")
    css_item = item_dir / "lab.css"
    imports = []
    kit_files = collect(ROOT / "kit", "*")
    item_files = collect(item_dir, "*")
    # 没用到三维的物品不带 scene.mjs（省掉 three 依赖与 importmap）
    if not any("createStage(" in f.read_text(encoding="utf-8") for f in item_files):
        kit_files = [f for f in kit_files if f.name != "scene.mjs"]
    js_kit = inline(kit_files, imports)
    js_item = inline(item_files, imports)
    logic = build_logic(slug)

    html = shell.replace("<!--KIT:CSS-->", css_kit)
    html = html.replace("<!--ITEM:CSS-->", css_item.read_text(encoding="utf-8") if css_item.is_file() else "")
    html = html.replace("<!--IMPORTMAP-->", IMPORTMAP if imports else "")
    html = html.replace("<!--KIT:JS-->", ("\n".join(imports) + "\n" if imports else "") + js_kit)
    html = html.replace("<!--ITEM:JS-->", js_item)

    if "window.__mechbench" not in html:
        html = html.replace("</main>", "</main>\n<script>window.__mechbench={slug:'%s',built:true}</script>" % slug)

    out_dir = ROOT / "dist"
    out_dir.mkdir(exist_ok=True)
    if imports:
        vendor = ROOT / "vendor"
        if not vendor.is_dir():
            sys.exit(f"需要三维但缺少 vendor/：{vendor}")
        shutil.copytree(vendor, out_dir / "vendor", dirs_exist_ok=True)
    out = out_dir / f"{slug}.html"
    out.write_text(html, encoding="utf-8")
    check_syntax(html)
    print(f"→ {out.relative_to(ROOT)}  ({len(html)//1024} KB)")
    if logic:
        print(f"→ {logic.relative_to(ROOT)}  ({logic.stat().st_size//1024} KB · node 可直接 import)")
        if verify:
            run_static_verify(slug)

    if single:
        builder = Path.home() / ".pi/agent/skills/real-device-game/assets/build.py"
        if not builder.is_file():
            sys.exit("找不到技能打包器 assets/build.py")
        single_out = out_dir / f"{slug}-单文件.html"
        subprocess.run([sys.executable, str(builder), str(out), "-o", str(single_out), "--offline"], check=True)
        print(f"→ {single_out.relative_to(ROOT)}  ({single_out.stat().st_size//1024} KB)")
    return out


def build_index():
    """扫描 items/ 生成 dist/index.html（目录页）。node 不可用时跳过。"""
    import json
    try:
        r = subprocess.run(["node", str(ROOT / "tools" / "manifest-dump.mjs")], cwd=ROOT,
                           capture_output=True, text=True, check=True)
        items = json.loads(r.stdout)
    except Exception as e:
        print(f"  （跳过目录页：{e}）")
        return

    tpl = (ROOT / "kit" / "index.html").read_text(encoding="utf-8")
    cards = []
    for it in items:
        slug = it["slug"]
        thumb = ""
        for name in (f"{slug}-card.jpg", f"{slug}-card.png", f"{slug}-1440-after.png", f"{slug}-1440.png"):
            rel = Path("accept") / slug / name
            if (ROOT / "dist" / rel).is_file():
                thumb = f'<img class="thumb" src="./{rel.as_posix()}" alt="" loading="lazy">'
                break
        if not thumb:
            thumb = '<span class="thumb"></span>'
        meta = [f'{it["chapters"]} 关', f'{it["modules"]} 模块']
        if it.get("has3d"):
            meta.append('<span class="solid">三维</span>')
        tags = "".join(m if m.startswith("<") else f"<span>{m}</span>" for m in meta)
        title = it["title"].replace("&", "&amp;").replace("<", "&lt;")
        sub = (it["subtitle"] or "").replace("&", "&amp;").replace("<", "&lt;")
        cards.append(f'<a class="item" href="./{slug}.html">{thumb}<div class="body">'
                     f'<strong>{title}</strong><small>{sub}</small><div class="meta">{tags}</div></div></a>')

    html = tpl.replace("{{ITEMS}}", "".join(cards) or
                       '<div class="empty">items/ 下还没有物品。先跑 <code>python3 tools/make-item.py &lt;slug&gt;</code>。</div>')
    html = html.replace("{{COUNT}}", f'{len(items)} 个物品' if items else "")
    out = ROOT / "dist" / "index.html"
    out.write_text(html, encoding="utf-8")
    print(f"→ {out.relative_to(ROOT)}  ({len(items)} 个物品)")


def main():
    ap = argparse.ArgumentParser(description="mechbench 构建")
    ap.add_argument("slug", help="物品目录名，或 all")
    ap.add_argument("--single", action="store_true", help="额外产出离线单文件")
    ap.add_argument("--skip-verify", action="store_true", help="跳过构建期的静态断言（不建议）")
    a = ap.parse_args()
    verify = not a.skip_verify

    if a.slug == "all":
        items = sorted(p.name for p in (ROOT / "items").iterdir()
                       if (p / "manifest.mjs").is_file() and not p.name.startswith("_"))
        if not items:
            sys.exit("items/ 下还没有物品")
        for s in items:
            build(s, a.single, verify)
    else:
        build(a.slug, a.single, verify)
    build_index()


if __name__ == "__main__":
    main()
