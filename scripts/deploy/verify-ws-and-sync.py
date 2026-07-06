"""验证服务器 WS token 端点 + 飞书/助理 API 可达性"""
import paramiko
import sys
from pathlib import Path

# 添加 scripts/deploy 目录到 path 以导入 _config
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _config import get_ssh_config

_ssh = get_ssh_config()
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(_ssh["host"], 22, _ssh["user"], _ssh["password"], timeout=10)

# 1. WS token 端点（未登录应返回 401）
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5176/api/auth/ws-token')
print(f"[1] /api/auth/ws-token (未登录): HTTP {o.read().decode().strip()}")

# 2. 飞书状态端点
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5176/api/feishu/status')
print(f"[2] /api/feishu/status: HTTP {o.read().decode().strip()}")

# 3. AI 助理设置端点
_, o, _ = c.exec_command('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5176/api/ai/settings')
print(f"[3] /api/ai/settings: HTTP {o.read().decode().strip()}")

# 4. HermesAgent latest-json
_, o, _ = c.exec_command('curl -s http://127.0.0.1:5176/api/hermes/latest-json')
print(f"[4] /api/hermes/latest-json: {o.read().decode().strip()[:200]}")

# 5. WS 网关状态
_, o, _ = c.exec_command('pm2 jlist')
import json
procs = json.loads(o.read().decode())
for p in procs:
    if "ws-gateway" in p.get("name", "") or "lynx-app" in p.get("name", ""):
        print(f"[5] PM2 {p['name']}: {p['pm2_env']['status']} (pid={p['pid']}, uptime={p['pm2_env'].get('pm_uptime', 0)})")

# 6. WS 网关端口
_, o, _ = c.exec_command('ss -tlnp | grep 3001')
print(f"[6] WS 网关 3001 端口: {o.read().decode().strip() or '未监听'}")

c.close()
print("\n[OK] 验证完成")
