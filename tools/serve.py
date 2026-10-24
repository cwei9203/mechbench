#!/usr/bin/env python3
"""mechbench · 本地启动：构建全部物品 → 起静态服务 → 打开目录页。

用法：
    python3 tools/serve.py            # 默认 8000，自动开浏览器
    python3 tools/serve.py --port 8100 --no-open
"""
import argparse
import http.server
import socketserver
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    ap = argparse.ArgumentParser(description="启动 mechbench 本地预览")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--no-open", action="store_true")
    ap.add_argument("--no-build", action="store_true", help="跳过构建，直接用现有 dist/")
    a = ap.parse_args()

    if not a.no_build:
        subprocess.run([sys.executable, str(ROOT / "tools" / "build.py"), "all"], check=True, cwd=ROOT)

    class Handler(http.server.SimpleHTTPRequestHandler):
        extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                          ".js": "text/javascript", ".mjs": "text/javascript"}

        def __init__(self, *args, **kw):
            super().__init__(*args, directory=str(ROOT / "dist"), **kw)

        def log_message(self, *args):
            pass

    class Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    try:
        httpd = Server(("127.0.0.1", a.port), Handler)
    except OSError:
        sys.exit(f"端口 {a.port} 被占用，换一个：python3 tools/serve.py --port {a.port + 1}")

    url = f"http://127.0.0.1:{a.port}/"
    print(f"\nmechbench 已启动 → {url}")
    print("目录页：/ · 单个物品：/<slug>.html · Ctrl+C 停止\n")
    if not a.no_open:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
