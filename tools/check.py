#!/usr/bin/env python3
"""mechbench · 仓库一致性检查（不修改工作区）

验收（accept.mjs）回答"页面能不能用"；这个脚本回答"交出去的东西是不是这一份"。
在临时目录里重建一遍，和仓库里的 dist/ 逐字节比对，再查链接、证据与 git 跟踪状态。

用法：
    python3 tools/check.py            # 全部检查
    python3 tools/check.py --no-build # 跳过重建比对（快，只查链接/证据/git）

退出码：0 = 没有 FAIL；1 = 有 FAIL（WARN 不影响退出码）。
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
ITEMS = ROOT / "items"

fails, warns, oks = [], [], []


def ok(msg):
    oks.append(msg)


def fail(msg):
    fails.append(msg)


def warn(msg):
    warns.append(msg)


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def slugs():
    """items/ 下所有物品（排除 _ 开头的模板）。"""
    if not ITEMS.is_dir():
        return []
    return sorted(p.name for p in ITEMS.iterdir()
                  if p.is_dir() and (p / "manifest.mjs").is_file() and not p.name.startswith("_"))


def build_in_temp(tmp):
    """把源文件镜像到临时目录重建，避免动工作区。build.py 以自身位置推断 ROOT。"""
    for name in ("kit", "items", "vendor"):
        src = ROOT / name
        if not src.is_dir():
            fail(f"缺少源目录 {name}/")
            return None
        shutil.copytree(src, tmp / name)
    (tmp / "tools").mkdir()
    for name in ("build.py", "manifest-dump.mjs", "verify.mjs"):
        shutil.copy2(ROOT / "tools" / name, tmp / "tools" / name)
    # 目录页缩略图直接取 dist/accept/*.jpg，属于构建输入，要一起镜像
    if (DIST / "accept").is_dir():
        shutil.copytree(DIST / "accept", tmp / "dist" / "accept",
                        ignore=shutil.ignore_patterns("*.png"))
    r = subprocess.run([sys.executable, str(tmp / "tools" / "build.py"), "all"],
                       cwd=tmp, capture_output=True, text=True)
    if r.returncode != 0:
        fail("重建失败，dist/ 无法验证是否最新：\n" + (r.stderr or r.stdout).strip()[-800:])
        return None
    return tmp / "dist"


def check_fresh(built):
    """dist/ 产物（*.html 与 *.logic.mjs）必须和当前 items/kit 重建的结果逐字节一致。"""
    arts = sorted(list(built.glob("*.html")) + list(built.glob("*.logic.mjs")))
    produced = {p.name for p in built.glob("*.html")}
    stale, missing = [], []
    for p in arts:
        target = DIST / p.name
        if not target.is_file():
            missing.append(p.name)
        elif sha(p) != sha(target):
            stale.append(p.name)
    if missing:
        fail("dist/ 缺少构建产物：" + ", ".join(missing) + "  → 跑 python3 tools/build.py all")
    if stale:
        fail("dist/ 与源文件不一致（交的页是旧的）：" + ", ".join(stale) + "  → 跑 python3 tools/build.py all")
    if not missing and not stale:
        ok(f"dist/ 与源文件一致（{len(arts)} 个产物逐字节相同）")

    known = lambda n: n == "_template.html" or n.endswith("-单文件.html")
    extra = sorted(p.name for p in DIST.glob("*.html") if p.name not in produced and not known(p.name))
    for name in extra:
        warn(f"dist/{name} 不是 `build.py all` 的产物（迁移前遗留），永远不会随源更新")
    return produced


def check_vendor():
    """三维页靠 ./vendor/three.module.js；dist/vendor 缺失=三维页全 404。"""
    pages = list(DIST.glob("*.html"))
    needs = [p.name for p in pages if 'type="importmap"' in p.read_text(encoding="utf-8", errors="ignore")]
    dv = DIST / "vendor"
    if not needs:
        return
    if not dv.is_dir():
        fail(f"dist/vendor/ 缺失，但 {len(needs)} 个页面需要三维（{', '.join(needs[:3])}…）")
        return
    src_files = sorted(p.relative_to(ROOT / "vendor") for p in (ROOT / "vendor").rglob("*") if p.is_file())
    bad = [str(rel) for rel in src_files
           if not (dv / rel).is_file() or sha(dv / rel) != sha(ROOT / "vendor" / rel)]
    if bad:
        fail(f"dist/vendor/ 与 vendor/ 不一致（{len(bad)} 个文件）：{', '.join(bad[:5])}")
    else:
        ok(f"dist/vendor/ 与 vendor/ 一致（{len(src_files)} 个文件），三维页可通过本地 HTTP 加载")


def check_links():
    """目录页的每个链接都要落到真实文件上。"""
    index = DIST / "index.html"
    if not index.is_file():
        fail("dist/index.html 不存在  → 跑 python3 tools/build.py all")
        return
    hrefs = re.findall(r'href="\./([^"#?]+)"', index.read_text(encoding="utf-8"))
    dead = [h for h in hrefs if not (DIST / h).is_file()]
    if dead:
        fail("目录页有死链：" + ", ".join(dead))
    elif hrefs:
        ok(f"目录页 {len(hrefs)} 个链接全部可达")


def check_evidence():
    """每个物品都要有页面 + 验收报告；accept/ 里不该留着已删除物品的证据。"""
    all_slugs = set(slugs())
    for s in sorted(all_slugs):
        if not (DIST / f"{s}.html").is_file():
            fail(f"{s}：没有 dist/{s}.html")
        rep = DIST / "accept" / s / "acceptance.json"
        if not rep.is_file():
            fail(f"{s}：没有验收报告 dist/accept/{s}/acceptance.json  → node tools/accept.mjs {s}")
            continue
        try:
            report = json.loads(rep.read_text(encoding="utf-8"))
            viewports = report.get("viewports", {})
            if not all(str(w) in viewports for w in (1440, 820, 390)):
                fail(f"{s}：验收报告缺少必需宽度 1440/820/390")
            if any(v.get("bad") for v in viewports.values()) or report.get("console"):
                fail(f"{s}：验收报告包含失败项或控制台错误")
            if not viewports or any(not v.get("ok") for v in viewports.values()):
                fail(f"{s}：验收报告没有有效断言")
        except (ValueError, AttributeError, TypeError) as e:
            fail(f"{s}：验收报告无效：{e}")
    if all_slugs and not fails:
        ok(f"{len(all_slugs)} 个物品都有页面与验收报告")
    # _template 与 -单文件 是合法产物（前者是脚手架、后者是离线交付），不算“已删除物品的证据”
    known = lambda n: n in all_slugs or n.startswith('_') or n.endswith('-单文件')
    for d in sorted(p for p in (DIST / "accept").iterdir() if p.is_dir()) if (DIST / "accept").is_dir() else []:
        if known(d.name):
            continue
        warn(f"dist/accept/{d.name}/ 没有对应物品（证据属于已删除或旧名产物）")


def jpeg_size(path):
    # Read JPEG frame dimensions without a third-party imaging dependency.
    with path.open("rb") as stream:
        if stream.read(2) != b"\xff\xd8":
            raise ValueError("不是 JPEG")
        while True:
            if stream.read(1) != b"\xff":
                raise ValueError("JPEG 缺少帧头")
            marker = stream.read(1)
            while marker == b"\xff":
                marker = stream.read(1)
            size = int.from_bytes(stream.read(2), "big")
            if size < 2:
                raise ValueError("JPEG 分段长度无效")
            data = stream.read(size - 2)
            if len(data) != size - 2:
                raise ValueError("JPEG 分段不完整")
            if marker in (b"\xc0", b"\xc1", b"\xc2"):
                if len(data) < 5:
                    raise ValueError("JPEG 帧头不完整")
                return int.from_bytes(data[3:5], "big"), int.from_bytes(data[1:3], "big")


def check_thumbs():
    # Validate actual file pixels, not the CSS crop rectangle in older reports.
    bad = []
    for slug in slugs():
        path = DIST / "accept" / slug / f"{slug}-card.jpg"
        if not path.is_file():
            bad.append(f"{slug} 缺少 JPEG")
            continue
        try:
            width, height = jpeg_size(path)
            if abs(width - 640) > 1 or not height or abs(width / height - 1.6) > 0.01:
                bad.append(f"{slug} 为 {width}×{height}，需要约 640×400")
        except (OSError, ValueError) as error:
            bad.append(f"{slug}：{error}")
    if bad:
        fail("缩略图检查失败：" + "; ".join(bad))
    else:
        ok(f"{len(slugs())} 个缩略图文件均为约 640×400 的 16:10 JPEG")


def git(args):
    r = subprocess.run(["git", "-C", str(ROOT)] + args, capture_output=True, text=True)
    return r.returncode, r.stdout


def check_git():
    """clone 下来能跑：物品目录、dist 页面、vendor 都必须在库里。"""
    if not (ROOT / ".git").exists():
        return
    code, _ = git(["rev-parse", "--is-inside-work-tree"])
    if code != 0:
        return
    untracked = []
    for s in slugs():
        code, _ = git(["ls-files", "--error-unmatch", f"items/{s}/manifest.mjs"])
        if code != 0:
            untracked.append(f"items/{s}/")
        code, _ = git(["ls-files", "--error-unmatch", f"dist/{s}.html"])
        if code != 0:
            untracked.append(f"dist/{s}.html")
    code, _ = git(["ls-files", "--error-unmatch", "dist/vendor/three.module.js"])
    if code != 0:
        untracked.append("dist/vendor/")
    if untracked:
        fail("未进库（clone 下来会缺页或缺依赖）：" + ", ".join(untracked))
    else:
        ok("所有物品的源与产物都已进库")

    code, out = git(["status", "--porcelain"])
    if code == 0:
        dirty = [ln for ln in out.splitlines() if ln.strip() and not ln.startswith("??")]
        if dirty:
            warn(f"工作区有 {len(dirty)} 个未提交改动（dist/ 也在里面时，交出去的可能是旧页）")


def main():
    ap = argparse.ArgumentParser(description="mechbench 仓库一致性检查")
    ap.add_argument("--no-build", action="store_true", help="跳过重建比对")
    a = ap.parse_args()

    if not DIST.is_dir():
        fail("dist/ 不存在  → 跑 python3 tools/build.py all")
    else:
        check_links()
        check_vendor()
        check_evidence()
        check_thumbs()
        if not a.no_build:
            tmp = Path(tempfile.mkdtemp(prefix="mechbench-check-"))
            try:
                built = build_in_temp(tmp)
                if built:
                    check_fresh(built)
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
        check_git()

    for m in oks:
        print(f"  ✓ {m}")
    for m in warns:
        print(f"  ! {m}")
    for m in fails:
        print(f"  ✗ {m}")
    print(f"\n{len(oks)} 通过 · {len(warns)} 警告 · {len(fails)} 失败")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
