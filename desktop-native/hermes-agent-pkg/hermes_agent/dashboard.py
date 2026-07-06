"""Dashboard HTTP 服务器：提供管理界面和状态 API"""

import json
import os
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional

from . import __version__
from .config import get_data_dir, get_llm_config, is_model_configured


class DashboardHandler(BaseHTTPRequestHandler):
    """Dashboard 请求处理器"""

    def log_message(self, format, *args):
        """静默日志（避免 stderr 噪音）"""
        pass

    def _send_json(self, data: dict, status: int = 200):
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, html: str):
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/" or path == "/index.html":
            self._send_html(self._dashboard_html())
            return

        if path == "/api/status" or path == "/status":
            llm = get_llm_config()
            self._send_json({
                "status": "running",
                "version": __version__,
                "provider": llm["provider"],
                "model": llm["model"],
                "configured": is_model_configured(),
                "dataDir": str(get_data_dir()),
                "uptime": int(time.time() - self.server.start_time),
            })
            return

        if path == "/api/skills":
            from .skills import list_skills
            self._send_json({"skills": list_skills(), "total": len(list_skills())})
            return

        if path == "/api/config":
            llm = get_llm_config()
            self._send_json({
                "provider": llm["provider"],
                "model": llm["model"],
                "baseUrl": llm["base_url"],
                "configured": is_model_configured(),
            })
            return

        # 404
        self._send_json({"error": "Not Found", "path": path}, 404)

    def do_POST(self):
        path = self.path.split("?")[0]

        if path == "/api/execute" or path == "/execute":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                self._send_json({"error": "Invalid JSON"}, 400)
                return

            prompt = data.get("prompt", "")
            if not prompt:
                self._send_json({"error": "prompt is required"}, 400)
                return

            from .executor import execute_task
            timeout = data.get("timeout", 120)
            result = execute_task(prompt, yolo=True, timeout=timeout)
            self._send_json(result)
            return

        # 优雅关闭 Dashboard（供 Web 端浏览器直连停止）
        if path == "/api/shutdown" or path == "/shutdown":
            self._send_json({"success": True, "message": "Dashboard 正在关闭..."})
            # 异步关闭，避免响应未发出
            threading.Thread(target=lambda: (time.sleep(0.3), os._exit(0)), daemon=True).start()
            return

        self._send_json({"error": "Not Found", "path": path}, 404)

    def do_OPTIONS(self):
        """CORS 预检"""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _dashboard_html(self) -> str:
        llm = get_llm_config()
        status_color = "#10b981" if is_model_configured() else "#f59e0b"
        status_text = "已配置" if is_model_configured() else "未配置"

        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hermes Agent Dashboard</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
         min-height: 100vh; display: flex; align-items: center; justify-content: center; }}
  .card {{ background: rgba(255,255,255,0.95); backdrop-filter: blur(20px);
          border-radius: 24px; padding: 40px; max-width: 520px; width: 90%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3); }}
  h1 {{ font-size: 28px; color: #1a1a2e; margin-bottom: 8px; }}
  .version {{ color: #6b7280; font-size: 14px; margin-bottom: 24px; }}
  .status {{ display: flex; align-items: center; gap: 8px; padding: 12px 16px;
            background: #f3f4f6; border-radius: 12px; margin-bottom: 16px; }}
  .dot {{ width: 10px; height: 10px; border-radius: 50%; background: {status_color}; }}
  .info {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }}
  .info-item {{ background: #f9fafb; padding: 12px; border-radius: 8px; }}
  .info-label {{ font-size: 12px; color: #6b7280; margin-bottom: 4px; }}
  .info-value {{ font-size: 14px; color: #1a1a2e; font-weight: 500; word-break: break-all; }}
  .footer {{ text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px; }}
</style>
</head>
<body>
  <div class="card">
    <h1>🤖 Hermes Agent</h1>
    <p class="version">奇思 超级助理 · v{__version__}</p>
    <div class="status">
      <span class="dot"></span>
      <span>LLM 模型{status_text} · {llm["provider"] or "未设置"} / {llm["model"] or "未设置"}</span>
    </div>
    <div class="info">
      <div class="info-item">
        <div class="info-label">Provider</div>
        <div class="info-value">{llm["provider"] or "—"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Model</div>
        <div class="info-value">{llm["model"] or "—"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Base URL</div>
        <div class="info-value">{llm["base_url"] or "—"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Data Dir</div>
        <div class="info-value">{get_data_dir()}</div>
      </div>
    </div>
    <p style="color:#6b7280;font-size:13px;line-height:1.6;">
      Hermes Agent 已就绪。通过 奇思桌面端「超级助理」发送任务，
      或在终端执行 <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">hermes -z "你的任务" --yolo</code>
    </p>
    <div class="footer">© 2026 Lynn · 奇思 AI工作台</div>
  </div>
</body>
</html>"""


def start_dashboard(port: int = 9119, open_browser: bool = False) -> int:
    """启动 Dashboard HTTP 服务器（阻塞）"""
    server = HTTPServer(("127.0.0.1", port), DashboardHandler)
    server.start_time = time.time()

    # 可选：自动打开浏览器
    if open_browser:
        try:
            import webbrowser
            threading.Thread(
                target=lambda: (time.sleep(1), webbrowser.open(f"http://localhost:{port}")),
                daemon=True,
            ).start()
        except Exception:
            pass

    print(f"Hermes Agent Dashboard 启动在 http://localhost:{port}")
    print(f"版本: {__version__}")
    print("按 Ctrl+C 停止")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止...")
        server.shutdown()
        return 0

    return 0
